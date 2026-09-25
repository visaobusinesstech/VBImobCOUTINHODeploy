import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireUserAi, callUserAi, tryParseJson } from "../_shared/ai-config.ts";
import { validarDescricaoImovel } from "./_validacaoDescricao.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type JsonRecord = Record<string, any>;

function calcStats(values: number[]) {
  if (values.length === 0) return { avg: 0, median: 0, min: 0, max: 0, stdDev: 0, q1: 0, q3: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const avg = values.reduce((s, v) => s + v, 0) / n;
  const median = n % 2 ? sorted[Math.floor(n / 2)] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
  const variance = values.reduce((s, v) => s + (v - avg) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);
  const q1 = sorted[Math.floor(n * 0.25)] || sorted[0];
  const q3 = sorted[Math.floor(n * 0.75)] || sorted[n - 1];
  return { avg, median, min: sorted[0], max: sorted[n - 1], stdDev, q1, q3 };
}

function removeOutliers(values: number[]): number[] {
  if (values.length < 4) return values;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const q1 = sorted[Math.floor(n * 0.25)];
  const q3 = sorted[Math.floor(n * 0.75)];
  const iqr = q3 - q1;
  const lower = q1 - 1.5 * iqr;
  const upper = q3 + 1.5 * iqr;
  return values.filter((v) => v >= lower && v <= upper);
}

function positiveNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getFallbackPricePerM2(imovel: JsonRecord) {
  const tipo = normalizeText(imovel?.tipo);
  const operacao = normalizeText(imovel?.operacao);
  const isRent = operacao.includes("alug") || operacao.includes("loca");

  const venda: Record<string, number> = {
    apartamento: 6500, casa: 4800, sobrado: 5200, cobertura: 7800,
    studio: 7200, kitnet: 6800, loft: 7400, comercial: 5200,
    sala: 5800, loja: 6200, terreno: 1200, lote: 1200,
  };

  const locacao: Record<string, number> = {
    apartamento: 32, casa: 22, sobrado: 25, cobertura: 40,
    studio: 36, kitnet: 34, loft: 38, comercial: 28,
    sala: 32, loja: 45, terreno: 5, lote: 5,
  };

  const benchmark = isRent ? locacao : venda;
  const matched = Object.entries(benchmark).find(([key]) => tipo.includes(key))?.[1];
  return matched ?? (isRent ? 26 : 5200);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // === Auth Check ===
    const _authHeader = req.headers.get("Authorization");
    if (!_authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado", code: "NAO_AUTORIZADO" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const _sbUrl = Deno.env.get("SUPABASE_URL")!;
    const _sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const { createClient: _createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const _sbAdmin = _createClient(_sbUrl, _sbKey);
    const _token = _authHeader.replace("Bearer ", "");
    const { data: { user: _aiUser } } = await _sbAdmin.auth.getUser(_token);

    const _iaGate = await requireUserAi(_sbAdmin, _aiUser?.id, corsHeaders);
    if (_iaGate.response) return _iaGate.response;
    if (!_aiUser) {
      return new Response(JSON.stringify({ error: "Não autorizado", code: "NAO_AUTORIZADO" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check profile approval and plan
    const { data: _profile } = await _sbAdmin
      .from("profiles")
      .select("approved, plano, is_master")
      .eq("id", _aiUser.id)
      .single();

    if (!_profile?.approved) {
      return new Response(JSON.stringify({ error: "Conta não aprovada.", code: "CONTA_NAO_APROVADA" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only limit free/trial users - paid plans and master get unlimited
    const isLimitedPlan = _profile.plano === "gratuito" || _profile.plano === "basico";
    if (isLimitedPlan && !_profile.is_master) {
      const { data: _usageCount } = await _sbAdmin.rpc("get_ai_usage_count", {
        _user_id: _aiUser.id, _function_name: "avaliacao-imovel"
      });
      const limit = _profile.plano === "gratuito" ? 3 : 10;
      if (_usageCount && _usageCount >= limit) {
        return new Response(JSON.stringify({
          error: `Limite de ${limit} avaliações atingido para o plano ${_profile.plano}. Faça upgrade para avaliações ilimitadas.`,
          code: "LIMITE_ATINGIDO",
          limit_reached: true,
        }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
    // === End Auth Check ===

    const { imovel, comparaveis, correlation_id: correlationId } = await req.json();

    // === Validação da descrição do imóvel (regra alinhada ao front-end) ===
    // Ver `./_validacaoDescricao.ts` — retorna o body 400 estruturado ou null.
    const descricaoErro = validarDescricaoImovel((imovel as JsonRecord | undefined)?.descricao);

    if (descricaoErro) {
      await _sbAdmin.from("system_logs").insert({
        user_id: _aiUser.id,
        module: "AvaliacaoImovel",
        action: "edge-function-validacao-descricao",
        level: "warn",
        message: `Bloqueado por validação de descrição: ${descricaoErro.code}`,
        correlation_id: correlationId,
        metadata: {
          imovel_id: (imovel as JsonRecord | undefined)?.id,
          descricao_length: descricaoErro.descricao_length,
          descricao_min: descricaoErro.descricao_min,
          descricao_max: descricaoErro.descricao_max,
        },
      });
      return new Response(
        JSON.stringify(descricaoErro),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }


    
    // Log start of process
    await _sbAdmin.from("system_logs").insert({
      user_id: _aiUser.id,
      module: "AvaliacaoImovel",
      action: "edge-function-start",
      level: "info",
      message: `Iniciando avaliação via Edge Function para ${imovel?.titulo || 'Imóvel'}`,
      correlation_id: correlationId,
      metadata: { 
        imovel_id: imovel?.id,
        comparaveis_count: Array.isArray(comparaveis) ? comparaveis.length : 0
      }
    });

    // BYOK-only: uses _iaGate.config resolved at line ~94.

    const formatBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

    const inputImovel = (imovel ?? {}) as JsonRecord;
    const inputComparaveis = Array.isArray(comparaveis) ? comparaveis : [];

    // Filter comparables: must have price and area, and MUST match operation (venda vs aluguel)
    const imovelOperacao = normalizeText(inputImovel?.operacao);
    const isRent = imovelOperacao.includes("alug") || imovelOperacao.includes("loca");
    const allValidComps = inputComparaveis.filter((c: any) => {
      if (positiveNumber(c?.preco) <= 0 || positiveNumber(c?.area) <= 0) return false;
      // Strict operation filter: never mix rent with sale comparables
      const compOp = normalizeText(c?.operacao);
      const compIsRent = compOp.includes("alug") || compOp.includes("loca");
      return compIsRent === isRent;
    });
    
    // Prioritize same-type comparables with similar area (±50%)
    const imovelTipo = normalizeText(inputImovel?.tipo);
    const imovelArea = positiveNumber(inputImovel.area, 0);
    
    const sameTypeComps = allValidComps.filter((c: any) => {
      const compTipo = normalizeText(c?.tipo);
      const compArea = positiveNumber(c?.area);
      const areaRatio = imovelArea > 0 && compArea > 0 ? compArea / imovelArea : 1;
      const sameType = compTipo && imovelTipo && (compTipo.includes(imovelTipo) || imovelTipo.includes(compTipo));
      const similarArea = areaRatio >= 0.5 && areaRatio <= 1.5;
      return sameType && similarArea;
    });
    
    // Use same-type if enough, otherwise all valid
    const validComps = sameTypeComps.length >= 3 ? sameTypeComps : allValidComps;
    const pricesPerM2 = validComps.map((c: any) => positiveNumber(c.preco) / positiveNumber(c.area));
    const cleanPricesPerM2 = removeOutliers(pricesPerM2);
    const stats = calcStats(cleanPricesPerM2);

    const precoInformado = positiveNumber(inputImovel.preco, 0);
    const precoInformadoM2 = precoInformado > 0 && imovelArea > 0 ? precoInformado / imovelArea : 0;
    const benchmarkM2 = getFallbackPricePerM2(inputImovel);

    const sameBairroComps = validComps.filter((c: any) => {
      const compBairro = normalizeText(c?.bairro);
      const imovelBairro = normalizeText(inputImovel?.bairro);
      return compBairro && imovelBairro && compBairro === imovelBairro;
    });
    const sameBairroPricesM2 = sameBairroComps.map((c: any) => positiveNumber(c.preco) / positiveNumber(c.area));
    const sameBairroStats = calcStats(removeOutliers(sameBairroPricesM2));

    const fallbackMode = cleanPricesPerM2.length === 0;

    // A âncora SEMPRE parte da média/mediana real de mercado.
    // O preço informado pelo usuário nunca ancora a avaliação: serve apenas como comparação.
    const marketBairroM2 = sameBairroPricesM2.length >= 3
      ? (sameBairroStats.median * 0.6 + sameBairroStats.avg * 0.4)
      : 0;
    const marketGeralM2 = cleanPricesPerM2.length > 0
      ? (stats.median * 0.6 + stats.avg * 0.4)
      : 0;
    const anchorM2 = marketBairroM2 > 0
      ? marketBairroM2
      : marketGeralM2 > 0
        ? marketGeralM2
        : benchmarkM2;
    const valorAncora = anchorM2 * imovelArea;
    const valorBaseMediana = stats.median * imovelArea;
    const valorBaseMedia = stats.avg * imovelArea;
    const allowedDeviation = fallbackMode ? 0.12 : 0.08;
    const compRangeMin = Math.max(1, Math.round(cleanPricesPerM2.length > 0 ? stats.q1 : anchorM2 * 0.90));
    const compRangeMax = Math.max(compRangeMin + 1, Math.round(cleanPricesPerM2.length > 0 ? stats.q3 : anchorM2 * 1.05));

    const anchorSource = marketBairroM2 > 0
      ? `média real de mercado do bairro ${inputImovel.bairro || "informado"} (mediana + média dos comparáveis)`
      : marketGeralM2 > 0
        ? "média real de mercado dos comparáveis válidos"
        : "benchmark técnico por tipologia (sem comparáveis reais)";


    const buildFallbackAvaliacao = (): JsonRecord => {
      const baseIdeal = Math.round(
        valorAncora > 0
          ? valorAncora
          : precoInformado > 0
            ? precoInformado * 0.97
            : Math.max(anchorM2, benchmarkM2) * Math.max(imovelArea, 50)
      );
      const valorMinimo = Math.round(baseIdeal * 0.92);
      const valorMaximo = Math.round(baseIdeal * 1.05);
      const precoM2 = Math.round(imovelArea > 0 ? baseIdeal / imovelArea : Math.max(anchorM2, benchmarkM2));
      const score = Math.round(clamp((fallbackMode ? 38 : 52) + Math.min(validComps.length, 8) * 4 + (sameBairroPricesM2.length >= 3 ? 8 : 0), 28, 82));
      const classificacao = score >= 70 ? "alta" : score >= 40 ? "media" : "baixa";
      const precoCompetitivo = precoInformado > 0 ? precoInformado <= valorMaximo : true;
      const prob30 = Math.round(clamp(score - (precoCompetitivo ? 10 : 22), 5, 85));
      const prob60 = Math.round(clamp(prob30 + 24, 12, 94));
      const prob90 = Math.round(clamp(prob60 + 18, 20, 98));

      const portalsFromBase = Array.from(new Set(validComps.map((c: any) => String(c.portal || "").trim()).filter(Boolean)));
      const defaultPortais = portalsFromBase.length > 0
        ? portalsFromBase
        : ["DFImóveis", "WImóveis", "Chave na Mão", "Viva Real", "ZAP", "OLX"];

      // IMPORTANTE: comparáveis do relatório só podem ser imóveis REAIS recebidos
      // no payload (carteira/mercado). Nunca gerar imóveis sintéticos.
      const comparaveisGerados = validComps.slice(0, 14).map((c: any, idx: number) => ({
        titulo: String(c.titulo || `Comparável ${idx + 1}`),
        preco: Math.round(positiveNumber(c.preco)),
        area: positiveNumber(c.area),
        quartos: positiveNumber(c.quartos, 0),
        suites: positiveNumber(c.suites, 0),
        vagas: positiveNumber(c.vagas, 0),
        bairro: String(c.bairro || inputImovel.bairro || ""),
        portal: String(c.portal || (c.fonte === "carteira" ? "Carteira própria" : "Mercado")),
        url_anuncio: String(c.url_anuncio || ""),
        dias_anuncio: positiveNumber(c.dias_anuncio, 0),
        estado_conservacao: String(c.estado_conservacao || ""),
      }));


      const portalBuckets = new Map<string, { values: number[]; dias: number[] }>();
      validComps.forEach((comp: any) => {
        const portal = String(comp.portal || "Mercado").trim() || "Mercado";
        const bucket = portalBuckets.get(portal) ?? { values: [], dias: [] };
        const area = positiveNumber(comp.area);
        const preco = positiveNumber(comp.preco);
        if (area > 0 && preco > 0) bucket.values.push(preco / area);
        if (positiveNumber(comp.dias_anuncio) > 0) bucket.dias.push(positiveNumber(comp.dias_anuncio));
        portalBuckets.set(portal, bucket);
      });

      const comparativoPortais = Array.from(portalBuckets.entries()).slice(0, 6).map(([portal, bucket]) => {
        const mediaM2 = bucket.values.length > 0
          ? Math.round(bucket.values.reduce((sum, value) => sum + value, 0) / bucket.values.length)
          : precoM2;
        const tempoMedio = bucket.dias.length > 0
          ? Math.round(bucket.dias.reduce((sum, value) => sum + value, 0) / bucket.dias.length)
          : 45;

        return {
          portal,
          preco_medio_m2: mediaM2,
          volume_anuncios: `${Math.max(bucket.values.length, 3)} anúncios comparáveis`,
          tempo_medio_venda: `${tempoMedio} dias`,
          observacao: mediaM2 >= precoM2 ? "Oferta acima da média do recorte" : "Boa aderência ao preço competitivo",
        };
      });

      if (comparativoPortais.length === 0) {
        defaultPortais.slice(0, 4).forEach((portal, idx) => {
          comparativoPortais.push({
            portal,
            preco_medio_m2: Math.round(precoM2 * (0.98 + idx * 0.02)),
            volume_anuncios: `${4 + idx} anúncios comparáveis`,
            tempo_medio_venda: `${35 + idx * 8} dias`,
            observacao: idx < 2 ? "Portal com boa tração para o perfil do imóvel" : "Canal complementar para ampliar alcance",
          });
        });
      }

      return {
        valor_minimo: valorMinimo,
        valor_ideal: baseIdeal,
        valor_maximo: valorMaximo,
        preco_m2_estimado: precoM2,
        preco_m2_regiao: Math.round(anchorM2 || stats.median || benchmarkM2),
        score_liquidez: score,
        classificacao_liquidez: classificacao,
        probabilidade_venda_30dias: prob30,
        probabilidade_venda_60dias: prob60,
        probabilidade_venda_90dias: prob90,
        preco_competitivo: precoCompetitivo,
        analise_resumo: fallbackMode
          ? `A estimativa foi calculada por contingência usando a âncora técnica de ${formatBRL(Math.round(anchorM2 || benchmarkM2))}/m² para ${inputImovel.tipo || "o imóvel"}, ajustada ao recorte de ${inputImovel.bairro || inputImovel.cidade || "mercado local"}. O valor ideal ficou em ${formatBRL(baseIdeal)}, com faixa sugerida entre ${formatBRL(valorMinimo)} e ${formatBRL(valorMaximo)}.`
          : `A estimativa foi ancorada na mediana dos comparáveis válidos do recorte, priorizando imóveis de mesma tipologia, bairro e metragem semelhante. O valor ideal calculado foi ${formatBRL(baseIdeal)}, equivalente a R$ ${precoM2.toFixed(0)}/m², dentro de uma faixa conservadora para acelerar absorção.`,
        pontos_fortes: [
          `Tipologia ${inputImovel.tipo || "residencial"} com aderência ao recorte pesquisado`,
          inputImovel.bairro ? `Localização em ${inputImovel.bairro}` : "Boa inserção urbana no contexto analisado",
          `${positiveNumber(inputImovel.area, imovelArea || 0)}m² com metragem competitiva para a região`,
          positiveNumber(inputImovel.vagas) > 0 ? `${positiveNumber(inputImovel.vagas)} vaga(s) agregando liquidez` : "Perfil funcional para o público comprador",
          inputImovel.aceita_financiamento ? "Aceita financiamento, ampliando base de compradores" : "Preço calibrado para negociação objetiva",
        ].filter(Boolean),
        pontos_atencao: [
          !precoCompetitivo && precoInformado > 0 ? "Preço informado atual acima da faixa sugerida para venda rápida" : "Manter disciplina na precificação para evitar perda de tração",
          fallbackMode ? "Baixa amostra de comparáveis no recorte imediato exige monitoramento semanal" : "Monitorar novos anúncios concorrentes no mesmo bairro",
          !inputImovel.tem_escritura ? "Regularização documental pode influenciar a percepção de valor" : "Evitar margem excessiva de negociação na abertura",
          positiveNumber(inputImovel.valor_condominio) > 0 ? "Condomínio deve ser comunicado com clareza na divulgação" : "Detalhar diferenciais construtivos para sustentar o ticket",
        ].filter(Boolean),
        estrategia_venda: `Recomenda-se anunciar próximo de ${formatBRL(Math.round(baseIdeal * 1.02))}, com revisão comercial entre 10 e 15 dias conforme volume de contatos qualificados. Priorize portais com melhor aderência no bairro e materiais com fotos completas, planta e diferenciais objetivos para sustentar o preço competitivo.`,
        portais_recomendados: defaultPortais.slice(0, 6),
        sugestao_preco_inicial: Math.round(baseIdeal * 1.02),
        rentabilidade_mensal: Math.round(baseIdeal * 0.0052),
        rentabilidade_percentual: 0.52,
        preco_idealista: Math.round(baseIdeal * 0.93),
        preco_realista: baseIdeal,
        preco_projetado: Math.round(baseIdeal * 1.04),
        preco_otimista: Math.round(baseIdeal * 1.08),
        analise_investimento: `Considerando o valor estimado e a liquidez ${classificacao}, o ativo apresenta perfil ${fallbackMode ? "mais conservador" : "equilibrado"} para investimento. A estratégia mais segura é aquisição dentro ou abaixo da faixa realista, com foco em proteção de margem e exposição qualificada nos principais portais.`,
        destaques_localizacao: [
          inputImovel.bairro ? `Bairro ${inputImovel.bairro} com demanda aderente ao perfil do imóvel` : "Região com demanda imobiliária monitorada",
          inputImovel.cidade ? `Inserção em ${inputImovel.cidade}/${inputImovel.estado || "DF"}` : "Boa conexão com polos urbanos",
          "Oferta comparável suficiente para leitura inicial de mercado",
          "Potencial de absorção favorecido por precificação competitiva",
        ],
        analise_bairro: {
          descricao: `${inputImovel.bairro || "A região"} apresenta dinâmica compatível com imóveis de ${inputImovel.tipo || "perfil residencial"}, combinando oferta ativa e demanda recorrente.`,
          potencial_valorizacao: `O potencial de valorização é ${sameBairroPricesM2.length >= 3 ? "consistente" : "moderado"}, sustentado pela aderência do bairro ao perfil de compradores e pela liquidez observada nos comparáveis.`,
          tendencias: `Os anúncios mais competitivos na região concentram-se em faixas de preço conservadoras, com maior resposta para imóveis bem fotografados e com descrição objetiva.`,
        },
        perfil_publico: {
          profissao: `O público predominante busca imóveis com boa relação entre localização, funcionalidade e previsibilidade de custo mensal.`,
          preferencias: `Há maior aderência a imóveis com metragem eficiente, vagas compatíveis e documentação regular.`,
          renda_media: `A capacidade de investimento observada no recorte aponta para compradores sensíveis a preço por m² e custo de ocupação.`,
          interesses: `O público costuma valorizar conveniência urbana, mobilidade, comércio de apoio e segurança percebida.`,
        },
        comparaveis_gerados: comparaveisGerados,
        comparativo_portais: comparativoPortais,
        metodologia_aplicada: `Avaliação calculada a partir da âncora ${anchorSource}, com uso prioritário da mediana dos comparáveis válidos, remoção de outliers por IQR e faixa comercial conservadora para ampliar liquidez.`,
        confianca_avaliacao: validComps.length >= 5 ? "alta" : validComps.length >= 3 ? "media" : "baixa",
        ajustes_aplicados: [
          { fator: "Âncora estatística do recorte", impacto_percentual: 0 },
          { fator: inputImovel.bairro ? "Aderência de bairro" : "Aderência de cidade", impacto_percentual: sameBairroPricesM2.length >= 3 ? 2 : 0 },
          { fator: precoCompetitivo ? "Preço competitivo" : "Preço acima da faixa rápida", impacto_percentual: precoCompetitivo ? 1 : -4 },
        ],
      };
    };

    const compList = validComps.map((c: any, i: number) =>
      `${i + 1}. ${c.titulo} - ${formatBRL(positiveNumber(c.preco))} - ${positiveNumber(c.area)}m² - ${positiveNumber(c.quartos, 0)}q/${positiveNumber(c.suites, 0)}s/${positiveNumber(c.banheiros, 0)}bnh - ${c.bairro || "N/A"} - R$${(positiveNumber(c.preco) / positiveNumber(c.area)).toFixed(0)}/m² - Portal: ${c.portal || "interno"}${c.dias_anuncio ? ` - ${c.dias_anuncio}d anúncio` : ""}`
    ).join("\n");

    const pricingValidationRule = cleanPricesPerM2.length > 0
      ? `- preco_m2_estimado deve estar entre R$ ${stats.q1.toFixed(0)} e R$ ${stats.q3.toFixed(0)}/m² (IQR dos comparáveis)`
      : `- Sem comparáveis válidos suficientes, use a âncora técnica de R$ ${anchorM2.toFixed(0)}/m² e nunca retorne valores zerados`;

    const systemPrompt = `SISTEMA DE AVALIAÇÃO IMOBILIÁRIA PROFISSIONAL (SAS)

Você é um avaliador imobiliário especialista, perito judicial, analista de mercado e cientista de dados imobiliários. Opera segundo a ABNT NBR 14.653, Método Comparativo Direto de Dados de Mercado, análise estatística, IA preditiva, geolocalização e indicadores de liquidez — no padrão usado por bancos, FIIs e grandes plataformas.

OBJETIVO: determinar valor de VENDA e LOCAÇÃO com máxima precisão usando comparáveis reais, ajustes automáticos, dados históricos e score de liquidez.

FRAMEWORK SAS (aplique mentalmente as 11 etapas e reflita o resultado no JSON):
1. Coleta de dados (identificação, localização, características, dimensões, ambientes, ano, conservação).
2. Análise de localização — índice 0-100 (escolas, hospitais, transporte, comércio, áreas verdes, valorização).
3. Comparáveis ponderados por distância (≤500m=10, ≤1km=8, ≤3km=5) e atualização (≤30d=10, ≤60d=8, >90d=5).
4. Ajustes automáticos: suíte +3%, vaga +2%, piscina +5%, gourmet +4%, vista permanente +8%, nascente +4%, andar alto +3%, reforma recente +7%, condomínio clube +5%, acabamento premium +10% (sempre respeitando os tetos técnicos abaixo).
5. Motor: valor mínimo (venda rápida) / valor recomendado (ideal) / valor máximo (sem urgência).
6. Score de liquidez 0-100 + tempo estimado de venda em dias.
7. Avaliação para locação: conservador / ideal / premium.
8. Score de investimento 0-100 (valorização, liquidez, rentabilidade, crescimento urbano, segurança).
9. Justificativa em linguagem natural explicando o porquê do valor.
10. Insights de dashboard (valor médio m², tendência, bairro).
11. Saída pronta para relatório profissional (faixa, valor recomendado, metodologia).

ÍNDICE PROPRIETÁRIO DE MERCADO (0-100): combine R$/m² da região, comparáveis, liquidez, tendência, oferta/demanda e IA preditiva, retornando interpretação curta.

REGRAS NUMÉRICAS OBRIGATÓRIAS (precedência máxima sobre o framework acima):

Você é um perito avaliador imobiliário sênior com 20+ anos de experiência em Brasília/DF e CRECI ativo.

Sua fonte prioritária são os comparáveis REAIS fornecidos. Se eles forem insuficientes, use a âncora de contingência já calculada. Nunca retorne valores zerados.

REGRA FUNDAMENTAL: O valor_ideal DEVE estar dentro de ±${Math.round(allowedDeviation * 100)}% do VALOR ÂNCORA calculado estatisticamente. PRIORIZE SEMPRE A MEDIANA dos comparáveis, NÃO a média. Qualquer desvio maior DEVE ser justificado.

VIÉS DE PRECIFICAÇÃO: Em caso de dúvida, ARREDONDE PARA BAIXO. Preços acima do mercado dificultam a venda. Melhor precificar 3-5% abaixo da mediana do que 3-5% acima.

VALOR ÂNCORA PRÉ-CALCULADO (use como referência obrigatória):
- Fonte da âncora: ${anchorSource}
- R$/m² âncora: R$ ${anchorM2.toFixed(0)}/m²
- Valor âncora (R$/m² × área): ${formatBRL(valorAncora)}
- Este é o ponto de partida. Ajustes técnicos podem variar ±${Math.round(allowedDeviation * 100)}% no máximo.

METODOLOGIA ESTRITA:
1. PARTA do R$/m² âncora acima. NÃO invente valores zerados.
2. Aplique ajustes técnicos CONSERVADORES e DOCUMENTADOS:
   - Acabamento superior: +2% a +3% | Acabamento inferior: -3% a -5%
   - Andar alto (>10°): +1% a +3% | Andar baixo (1°-3°): -2% a -3%
   - Posição solar nascente: +1%
   - Vaga extra (além do padrão): +1% por vaga
   - Escritura regular: +1%
   - Imóvel exclusivo: +1%
   - Imóvel antigo (>15 anos): -2% a -5%
   - Necessita reformas: -5% a -10%
3. O SOMATÓRIO dos ajustes positivos NÃO pode ultrapassar +${Math.round(allowedDeviation * 100 * 0.7)}%.
4. Ajustes negativos podem somar até -${Math.round(allowedDeviation * 100)}%.
5. valor_ideal = R$/m² âncora × (1 + soma_ajustes) × área
6. valor_minimo = valor_ideal × 0.92
7. valor_maximo = valor_ideal × 1.05
8. sugestao_preco_inicial = valor_ideal × 1.02

VALIDAÇÕES OBRIGATÓRIAS:
- |valor_ideal - valor_âncora| / valor_âncora ≤ ${allowedDeviation.toFixed(2)}
- |valor_maximo - valor_minimo| / valor_ideal ≤ 0.14
${pricingValidationRule}
- Se preço informado > valor_maximo: preco_competitivo = false, probabilidade_venda_30dias < 8%
- Se preço informado está dentro da faixa: preco_competitivo = true

CENÁRIOS (desvios em relação ao valor_ideal):
- idealista: valor_ideal × 0.93 (venda rápida <30d)
- realista: = valor_ideal
- projetado: valor_ideal × 1.04
- otimista: valor_ideal × 1.08

IMPORTANTE: Compare SEMPRE com imóveis do MESMO tipo, MESMA região e área SIMILAR (±30%). Desconsidere comparáveis de tipologia diferente ou bairros distantes.

Responda SOMENTE em JSON válido, sem markdown, sem comentários, sem explicações fora do JSON.`;

    const statsBlock = cleanPricesPerM2.length > 0
      ? `
ESTATÍSTICAS DOS COMPARÁVEIS (após remoção de outliers por IQR):
- Quantidade após limpeza: ${cleanPricesPerM2.length} de ${pricesPerM2.length} total
- R$/m² médio: R$ ${stats.avg.toFixed(0)}/m²
- R$/m² mediano: R$ ${stats.median.toFixed(0)}/m²
- Desvio padrão: R$ ${stats.stdDev.toFixed(0)}/m²
- Q1 (25%): R$ ${stats.q1.toFixed(0)}/m² | Q3 (75%): R$ ${stats.q3.toFixed(0)}/m²
- Faixa: R$ ${stats.min.toFixed(0)} a R$ ${stats.max.toFixed(0)}/m²
- Valor estimado pela mediana: ${formatBRL(valorBaseMediana)}
- Valor estimado pela média: ${formatBRL(valorBaseMedia)}
${sameBairroPricesM2.length >= 3 ? `
ESTATÍSTICAS DO BAIRRO ${inputImovel.bairro} (${sameBairroPricesM2.length} comparáveis):
- R$/m² mediano do bairro: R$ ${sameBairroStats.median.toFixed(0)}/m²
- R$/m² médio do bairro: R$ ${sameBairroStats.avg.toFixed(0)}/m²
- Valor âncora do bairro: ${formatBRL(sameBairroStats.median * imovelArea)}` : ""}`
      : `
BASELINE DE CONTINGÊNCIA (sem comparáveis válidos suficientes):
- R$/m² do preço informado: ${precoInformadoM2 > 0 ? `R$ ${precoInformadoM2.toFixed(0)}/m²` : "N/A"}
- Benchmark técnico por tipologia: R$ ${benchmarkM2.toFixed(0)}/m²
- R$/m² âncora adotado: R$ ${anchorM2.toFixed(0)}/m²
- Valor âncora adotado: ${formatBRL(valorAncora)}
- Confiança: baixa a média, mas nunca retorne valores zerados.`;

    const userPrompt = `IMÓVEL AVALIADO:
- Título: ${inputImovel.titulo}
- Tipo: ${inputImovel.tipo}
- Operação: ${inputImovel.operacao}
- Área: ${inputImovel.area}m²
- Quartos: ${inputImovel.quartos}
- Suítes: ${inputImovel.suites || 0}
- Banheiros: ${inputImovel.banheiros || 0}
- Vagas: ${inputImovel.vagas || 0}
- Bairro: ${inputImovel.bairro || "N/A"}
- Cidade: ${inputImovel.cidade || "Brasília"}
- Estado: ${inputImovel.estado || "DF"}
- Preço atual: ${precoInformado ? formatBRL(precoInformado) : "Não definido"}
- Condomínio: ${inputImovel.valor_condominio ? formatBRL(inputImovel.valor_condominio) : "N/A"}
- IPTU: ${inputImovel.valor_iptu ? formatBRL(inputImovel.valor_iptu) : "N/A"}
- Andar: ${inputImovel.andar || "N/A"}
- Posição Solar: ${inputImovel.posicao_solar || "N/A"}
- Exclusivo: ${inputImovel.exclusivo ? "Sim" : "Não"}
- Aceita permuta: ${inputImovel.aceita_permuta ? "Sim" : "Não"}
- Aceita financiamento: ${inputImovel.aceita_financiamento ? "Sim" : "Não"}
- Tem escritura: ${inputImovel.tem_escritura ? "Sim" : "Não"}
${inputImovel.descricao ? `\nDESCRIÇÃO DETALHADA DO IMÓVEL (informada pelo corretor):\n${String(inputImovel.descricao).slice(0, 2000)}\n` : ""}

COMPARÁVEIS REAIS DA BASE (${validComps.length} válidos):
${compList || "Nenhum comparável encontrado."}
${statsBlock}

VALOR ÂNCORA OBRIGATÓRIO: ${formatBRL(valorAncora)} (${anchorSource} = R$ ${anchorM2.toFixed(0)}/m² × ${imovelArea}m²)
→ O valor_ideal DEVE estar entre ${formatBRL(valorAncora * (1 - allowedDeviation))} e ${formatBRL(valorAncora * (1 + allowedDeviation))}.
→ REGRA CRÍTICA: o preço informado pelo proprietário/corretor (${precoInformado ? formatBRL(precoInformado) : "não informado"}) NÃO pode ser usado como base de cálculo. Use SEMPRE a média/mediana real de mercado dos comparáveis. Se o preço informado estiver acima ou abaixo da média real, explique o desvio percentual no texto, mas mantenha o valor_ideal ancorado no mercado.

COMPARÁVEIS GERADOS:
Gere 6 imóveis comparáveis adicionais da mesma região (±25% área) com preços entre R$ ${compRangeMin} e R$ ${compRangeMax}/m². Títulos realistas do DF.

PORTAIS obrigatórios: DFImóveis, WImóveis, Chave na Mão, OLX, Viva Real, ZAP.

Responda no formato JSON:
{
  "valor_minimo": número,
  "valor_ideal": número,
  "valor_maximo": número,
  "preco_m2_estimado": número,
  "preco_m2_regiao": número,
  "score_liquidez": 0-100,
  "classificacao_liquidez": "alta"|"media"|"baixa",
  "probabilidade_venda_30dias": 0-100,
  "probabilidade_venda_60dias": 0-100,
  "probabilidade_venda_90dias": 0-100,
  "preco_competitivo": boolean,
  "analise_resumo": "texto 4-5 frases mencionando o R$/m² da região e como chegou ao valor",
  "pontos_fortes": ["5-7 pontos"],
  "pontos_atencao": ["4-6 pontos"],
  "estrategia_venda": "texto 3-4 frases",
  "portais_recomendados": ["lista"],
  "sugestao_preco_inicial": número,
  "rentabilidade_mensal": número,
  "rentabilidade_percentual": número,
  "preco_idealista": número,
  "preco_realista": número,
  "preco_projetado": número,
  "preco_otimista": número,
  "analise_investimento": "texto ROI 3-4 frases",
  "destaques_localizacao": ["4-6 itens"],
  "analise_bairro": {
    "descricao": "texto detalhado 4-5 frases sobre o bairro",
    "potencial_valorizacao": "texto 3-4 frases sobre potencial de valorização",
    "tendencias": "texto 3-4 frases sobre tendências do mercado"
  },
  "perfil_publico": {
    "profissao": "texto 2-3 frases sobre perfil profissional",
    "preferencias": "texto 2-3 frases sobre preferências",
    "renda_media": "texto 2-3 frases sobre renda",
    "interesses": "texto 2-3 frases sobre interesses"
  },
  "comparaveis_gerados": [{"titulo":"","preco":0,"area":0,"quartos":0,"suites":0,"vagas":0,"bairro":"","portal":"","url_anuncio":"","dias_anuncio":0,"estado_conservacao":"texto curto"}],
  "comparativo_portais": [{"portal":"","preco_medio_m2":0,"volume_anuncios":"","tempo_medio_venda":"","observacao":""}],
  "metodologia_aplicada": "descreva ajustes aplicados",
  "confianca_avaliacao": "alta"|"media"|"baixa",
  "ajustes_aplicados": [{"fator":"","impacto_percentual":0}]
}`;

    let parsed: JsonRecord;
    try {
      const aiRes = await callUserAi(_iaGate.config, {
        systemPrompt,
        userPrompt,
        wantJson: true,
        temperature: 0.2,
      });
      if (!aiRes.ok) {
        console.error("avaliacao-imovel BYOK provider error:", aiRes.error);
        parsed = buildFallbackAvaliacao();
      } else {
        const p = tryParseJson<JsonRecord>(aiRes.text);
        parsed = p ?? buildFallbackAvaliacao();
      }
    } catch (aiError) {
      console.error("avaliacao-imovel fallback due to AI error:", aiError);
      parsed = buildFallbackAvaliacao();
    }

    const fallbackIdeal = Math.round(
      valorAncora > 0
        ? valorAncora
        : precoInformado > 0
          ? precoInformado
          : Math.max(anchorM2, benchmarkM2) * Math.max(imovelArea, 50)
    );

    parsed.valor_ideal = positiveNumber(parsed.valor_ideal, fallbackIdeal);

    if (valorAncora > 0) {
      // O valor final nunca pode se descolar da média real de mercado, mesmo que
      // o preço informado pelo proprietário seja muito maior ou menor.
      const minIdeal = valorAncora * (1 - allowedDeviation);
      const maxIdeal = valorAncora * (1 + allowedDeviation);
      parsed.valor_ideal = Math.round(clamp(parsed.valor_ideal, minIdeal, maxIdeal));
    }


    parsed.valor_minimo = Math.round(positiveNumber(parsed.valor_minimo, parsed.valor_ideal * 0.92));
    parsed.valor_maximo = Math.round(positiveNumber(parsed.valor_maximo, parsed.valor_ideal * 1.05));
    if (parsed.valor_minimo >= parsed.valor_ideal) parsed.valor_minimo = Math.round(parsed.valor_ideal * 0.92);
    if (parsed.valor_maximo <= parsed.valor_ideal) parsed.valor_maximo = Math.round(parsed.valor_ideal * 1.05);

    parsed.sugestao_preco_inicial = Math.round(positiveNumber(parsed.sugestao_preco_inicial, parsed.valor_ideal * 1.02));
    parsed.preco_realista = Math.round(positiveNumber(parsed.preco_realista, parsed.valor_ideal));
    parsed.preco_idealista = Math.round(positiveNumber(parsed.preco_idealista, parsed.valor_ideal * 0.93));
    parsed.preco_projetado = Math.round(positiveNumber(parsed.preco_projetado, parsed.valor_ideal * 1.04));
    parsed.preco_otimista = Math.round(positiveNumber(parsed.preco_otimista, parsed.valor_ideal * 1.08));

    parsed.preco_m2_estimado = Math.round(
      positiveNumber(
        parsed.preco_m2_estimado,
        imovelArea > 0 ? parsed.valor_ideal / imovelArea : Math.max(anchorM2, benchmarkM2)
      )
    );

    parsed.preco_m2_regiao = Math.round(
      positiveNumber(parsed.preco_m2_regiao, anchorM2 || parsed.preco_m2_estimado || benchmarkM2)
    );

    if (anchorM2 > 0 && Math.abs(parsed.preco_m2_regiao - anchorM2) / anchorM2 > 0.2) {
      parsed.preco_m2_regiao = Math.round(anchorM2);
    }

    parsed.score_liquidez = Math.round(clamp(Number(parsed.score_liquidez) || (fallbackMode ? 38 : 62), 0, 100));
    const liquidezFallback = parsed.score_liquidez >= 70 ? "alta" : parsed.score_liquidez >= 40 ? "media" : "baixa";
    parsed.classificacao_liquidez = ["alta", "media", "baixa"].includes(String(parsed.classificacao_liquidez))
      ? parsed.classificacao_liquidez
      : liquidezFallback;

    parsed.probabilidade_venda_30dias = Math.round(clamp(Number(parsed.probabilidade_venda_30dias) || (fallbackMode ? 12 : 28), 0, 100));
    parsed.probabilidade_venda_60dias = Math.round(clamp(Number(parsed.probabilidade_venda_60dias) || (fallbackMode ? 32 : 54), 0, 100));
    parsed.probabilidade_venda_90dias = Math.round(clamp(Number(parsed.probabilidade_venda_90dias) || (fallbackMode ? 52 : 76), 0, 100));

    if (precoInformado > 0) {
      parsed.preco_competitivo = precoInformado <= parsed.valor_maximo;
      if (!parsed.preco_competitivo && parsed.probabilidade_venda_30dias > 15) {
        parsed.probabilidade_venda_30dias = 15;
      }
    } else {
      parsed.preco_competitivo = Boolean(parsed.preco_competitivo);
    }

    parsed.analise_resumo = String(parsed.analise_resumo || (fallbackMode
      ? `A avaliação foi calculada com base em uma âncora técnica de R$ ${anchorM2.toFixed(0)}/m².`
      : `A avaliação foi calculada com base em comparáveis reais, usando âncora de R$ ${anchorM2.toFixed(0)}/m².`));

    parsed.estrategia_venda = String(parsed.estrategia_venda || "Recomenda-se iniciar a divulgação próximo ao preço sugerido.");
    parsed.analise_investimento = parsed.analise_investimento ? String(parsed.analise_investimento) : undefined;
    parsed.portais_recomendados = Array.isArray(parsed.portais_recomendados) && parsed.portais_recomendados.length > 0
      ? parsed.portais_recomendados
      : ["DFImóveis", "WImóveis", "ZAP"];
    parsed.pontos_fortes = Array.isArray(parsed.pontos_fortes) ? parsed.pontos_fortes : [];
    parsed.pontos_atencao = Array.isArray(parsed.pontos_atencao) ? parsed.pontos_atencao : [];
    parsed.destaques_localizacao = Array.isArray(parsed.destaques_localizacao) ? parsed.destaques_localizacao : [];
    // Os imóveis de referência do laudo/PDF SEMPRE vêm dos comparáveis reais
    // recebidos no payload. Qualquer item inventado pela IA é descartado.
    parsed.comparaveis_gerados = validComps.slice(0, 14).map((c: any, idx: number) => ({
      titulo: String(c.titulo || `Comparável ${idx + 1}`),
      preco: Math.round(positiveNumber(c.preco)),
      area: positiveNumber(c.area),
      quartos: positiveNumber(c.quartos, 0),
      suites: positiveNumber(c.suites, 0),
      vagas: positiveNumber(c.vagas, 0),
      bairro: String(c.bairro || inputImovel.bairro || ""),
      portal: String(c.portal || (c.fonte === "carteira" ? "Carteira própria" : "Mercado")),
      url_anuncio: String(c.url_anuncio || ""),
      dias_anuncio: positiveNumber(c.dias_anuncio, 0),
      estado_conservacao: String(c.estado_conservacao || ""),
      fonte: String(c.fonte || "mercado"),
    }));

    parsed.comparativo_portais = Array.isArray(parsed.comparativo_portais) ? parsed.comparativo_portais : [];
    parsed.analise_bairro = parsed.analise_bairro && typeof parsed.analise_bairro === "object"
      ? {
          descricao: String(parsed.analise_bairro.descricao || "Panorama do bairro não informado."),
          potencial_valorizacao: String(parsed.analise_bairro.potencial_valorizacao || "Potencial de valorização moderado."),
          tendencias: String(parsed.analise_bairro.tendencias || "Mercado local sensível a fotos e precificação."),
        }
      : {
          descricao: "Panorama do bairro não informado.",
          potencial_valorizacao: "Potencial de valorização moderado.",
          tendencias: "Mercado local sensível a fotos e precificação.",
        };
    parsed.perfil_publico = parsed.perfil_publico && typeof parsed.perfil_publico === "object"
      ? {
          profissao: String(parsed.perfil_publico.profissao || "Perfil profissional diversificado."),
          preferencias: String(parsed.perfil_publico.preferencias || "Preferência por imóveis funcionais."),
          renda_media: String(parsed.perfil_publico.renda_media || "Capacidade de investimento moderada."),
          interesses: String(parsed.perfil_publico.interesses || "Interesse em conveniência urbana."),
        }
      : {
          profissao: "Perfil profissional diversificado.",
          preferencias: "Preferência por imóveis funcionais.",
          renda_media: "Capacidade de investimento moderada.",
          interesses: "Interesse em conveniência urbana.",
        };

    // Log AI usage AFTER successful evaluation
    await _sbAdmin.from("ai_usage_log").insert({ user_id: _aiUser.id, function_name: "avaliacao-imovel" });

    return new Response(JSON.stringify({ avaliacao: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("avaliacao-imovel error:", e);
    
    // Log fatal error to system_logs if possible
    try {
      const _sbUrl = Deno.env.get("SUPABASE_URL")!;
      const _sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const { createClient: _createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      const _sbAdmin = _createClient(_sbUrl, _sbKey);
      const _authHeader = req.headers.get("Authorization");
      const _token = _authHeader?.replace("Bearer ", "");
      if (_token) {
        const { data: { user: _errUser } } = await _sbAdmin.auth.getUser(_token);
        if (_errUser) {
          await _sbAdmin.from("system_logs").insert({
            user_id: _errUser.id,
            module: "AvaliacaoImovel",
            action: "edge-function-error",
            level: "fatal",
            message: e instanceof Error ? e.message : String(e),
            correlation_id: correlationId,
            metadata: { 
              stack: e instanceof Error ? e.stack : undefined,
              alert_required: true,
              environment: Deno.env.get("ENVIRONMENT") || "production"
            }
          });
        }
      }
    } catch (logErr) {
      console.error("Failed to log error to database:", logErr);
    }

    return new Response(JSON.stringify({
      error: `Erro ao gerar avaliação: ${e instanceof Error ? e.message : "Erro interno"}`,
      code: "ERRO_INTERNO",
    }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
