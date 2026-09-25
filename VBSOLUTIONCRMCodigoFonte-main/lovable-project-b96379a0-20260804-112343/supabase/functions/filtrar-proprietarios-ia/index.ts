import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireUserAi, callUserAi, tryParseJson, aiErrorResponse } from "../_shared/ai-config.ts";
import { inferTipoImovel, validateRawSchema } from "../_shared/tipoImovel.ts";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Criterio = "probabilidade" | "investimento" | "urgencia" | "portfolio";

interface Filtros {
  operacao?: "Venda" | "Aluguel" | null;
  cidade?: string | null;
  bairro?: string | null;
  tipo_imovel?: string | null;
  score_min?: number;
  criterios?: Record<Criterio, number>; // pesos 0-100
  limite?: number; // até N registros
  portfolio_hint?: string | null; // tipos/bairros que corretor mais fecha
  modo_teste?: boolean; // dry-run: roda em amostra pequena, não persiste
  amostra?: number; // tamanho da amostra em modo_teste (3-20, default 8)
}

const CRITERIOS_DEFAULT: Record<Criterio, number> = {
  probabilidade: 40,
  urgencia: 30,
  investimento: 15,
  portfolio: 15,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const runId = crypto.randomUUID();
  const startedAt = Date.now();
  const logLines: string[] = [];
  const tempos: Record<string, number> = {};
  const log = (...args: unknown[]) => {
    const line = `[+${Date.now() - startedAt}ms] ${args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ")}`;
    logLines.push(line);
    if (logLines.length > 60) logLines.shift();
    console.log(`[filtrar-proprietarios-ia][run:${runId}]`, ...args);
  };
  const mark = (label: string, ms: number) => { tempos[label] = ms; log(`⏱ ${label}=${ms}ms`); };

  // Persistente log helper (best-effort; nunca quebra a request)
  let sbAdmin: ReturnType<typeof createClient> | null = null;
  let userId: string | null = null;
  const persistLog = async (payload: Record<string, unknown>) => {
    if (!sbAdmin || !userId) return;
    try {
      await sbAdmin.from("filtro_ia_execucoes_log").insert({
        imobiliaria_id: userId,
        run_id: runId,
        duracao_ms: Date.now() - startedAt,
        tempos,
        ...payload,
      });
    } catch (e) {
      console.error(`[filtrar-proprietarios-ia][run:${runId}] persist log err`, e);
    }
  };

  const errorResponse = async (
    status: number,
    error_code: string,
    message: string,
    extra: Record<string, unknown> = {},
  ) => {
    log(`ERROR ${error_code}: ${message}`);
    await persistLog({ sucesso: false, error_code, filtros_aplicados: extra?.filtros_aplicados ?? {}, criterios: extra?.criterios ?? {} });
    return new Response(
      JSON.stringify({
        success: false,
        error: message,
        message,
        error_code,
        run_id: runId,
        duracao_ms: Date.now() - startedAt,
        tempos,
        log_excerpt: logLines.slice(-20),
        ...extra,
      }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  };

  try {
    log("boot", { url: req.url, method: req.method });
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return await errorResponse(401, "unauthorized", "Não autorizado");

    const sbUrl = Deno.env.get("SUPABASE_URL")!;
    const sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const anonClient = createClient(sbUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const tAuth = Date.now();
    const { data: { user }, error: authErr } = await anonClient.auth.getUser();
    mark("auth_ms", Date.now() - tAuth);
    if (authErr || !user) return await errorResponse(401, "invalid_session", "Sessão inválida");
    userId = user.id;

    sbAdmin = createClient(sbUrl, sbKey);
    const tGate = Date.now();
    const gate = await requireUserAi(sbAdmin, user.id, corsHeaders);
    mark("ai_gate_ms", Date.now() - tGate);
    if (gate.response) {
      const orig = await gate.response.clone().json().catch(() => ({}));
      log("ai gate blocked", orig);
      await persistLog({ sucesso: false, error_code: orig?.error_code ?? "ai_gate_blocked" });
      return new Response(
        JSON.stringify({ ...orig, success: false, run_id: runId, log_excerpt: logLines.slice(-20), duracao_ms: Date.now() - startedAt, tempos }),
        { status: gate.response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body: Filtros = await req.json().catch(() => ({}));
    const modoTeste = body.modo_teste === true;
    const amostra = modoTeste ? Math.max(3, Math.min(20, body.amostra ?? 8)) : 0;
    const criterios = { ...CRITERIOS_DEFAULT, ...(body.criterios || {}) };
    const scoreMin = Math.max(0, Math.min(100, body.score_min ?? 25));
    const limite = modoTeste ? amostra : Math.max(10, Math.min(200, body.limite ?? 80));
    const filtrosAplicados = {
      operacao: body.operacao ?? null,
      cidade: body.cidade?.trim() || null,
      bairro: body.bairro?.trim() || null,
      tipo_imovel: body.tipo_imovel?.trim() || null,
      score_min: scoreMin,
      limite,
      portfolio_hint: body.portfolio_hint ?? null,
    };
    log("filtros", { ...filtrosAplicados, modoTeste, amostra });

    if (!modoTeste) {
      await sbAdmin.from("ai_usage_log").insert({ user_id: user.id, function_name: "filtrar-proprietarios-ia" });
    }

    // ============= FILTROS EFETIVOS =============
    // Mede a redução em cada etapa aplicando os filtros em ordem.
    // Cada etapa é uma COUNT query leve (head:true) para não trafegar dados.
    const tFiltrosEfetivos = Date.now();
    type Etapa = { etapa: string; label: string; count: number; excluidos: number };
    const etapas: Etapa[] = [];
    const baseQuery = () =>
      sbAdmin!
        .from("lista_proprietarios_captacao")
        .select("id", { count: "exact", head: true })
        .eq("imobiliaria_id", user.id);

    const countWith = async (fn: (q: any) => any) => {
      const q = fn(baseQuery());
      const { count } = await q;
      return count ?? 0;
    };

    const totalBruto = await countWith((q) => q);
    etapas.push({ etapa: "total", label: "Total na carteira", count: totalBruto, excluidos: 0 });

    let prev = totalBruto;
    const step = async (etapa: string, label: string, fn: (q: any) => any) => {
      const c = await countWith(fn);
      etapas.push({ etapa, label, count: c, excluidos: Math.max(0, prev - c) });
      prev = c;
    };

    await step("score_min", `Score dor ≥ ${scoreMin}`, (q) => q.gte("motivacao_score", scoreMin));
    if (filtrosAplicados.operacao) {
      await step("operacao", `Operação = ${filtrosAplicados.operacao}`, (q) =>
        q.gte("motivacao_score", scoreMin).eq("operacao", filtrosAplicados.operacao),
      );
    }
    if (filtrosAplicados.cidade) {
      await step("cidade", `Cidade ~ ${filtrosAplicados.cidade}`, (q) => {
        let x = q.gte("motivacao_score", scoreMin);
        if (filtrosAplicados.operacao) x = x.eq("operacao", filtrosAplicados.operacao);
        return x.ilike("cidade", `%${filtrosAplicados.cidade}%`);
      });
    }
    if (filtrosAplicados.bairro) {
      await step("bairro", `Bairro ~ ${filtrosAplicados.bairro}`, (q) => {
        let x = q.gte("motivacao_score", scoreMin);
        if (filtrosAplicados.operacao) x = x.eq("operacao", filtrosAplicados.operacao);
        if (filtrosAplicados.cidade) x = x.ilike("cidade", `%${filtrosAplicados.cidade}%`);
        return x.ilike("bairro", `%${filtrosAplicados.bairro}%`);
      });
    }
    if (filtrosAplicados.tipo_imovel) {
      await step("tipo_imovel", `Tipo ~ ${filtrosAplicados.tipo_imovel}`, (q) => {
        let x = q.gte("motivacao_score", scoreMin);
        if (filtrosAplicados.operacao) x = x.eq("operacao", filtrosAplicados.operacao);
        if (filtrosAplicados.cidade) x = x.ilike("cidade", `%${filtrosAplicados.cidade}%`);
        if (filtrosAplicados.bairro) x = x.ilike("bairro", `%${filtrosAplicados.bairro}%`);
        return x.ilike("titulo_imovel", `%${filtrosAplicados.tipo_imovel}%`);
      });
    }
    mark("filtros_efetivos_ms", Date.now() - tFiltrosEfetivos);

    // Motivos de exclusão agregados
    const motivosExclusao: Record<string, number> = {
      abaixo_do_score_min: 0,
      filtro_operacao: 0,
      filtro_cidade: 0,
      filtro_bairro: 0,
      filtro_tipo_imovel: 0,
      alem_do_limite: 0,
      sem_resposta_ia: 0,
    };
    for (const e of etapas) {
      if (e.etapa === "score_min") motivosExclusao.abaixo_do_score_min = e.excluidos;
      else if (e.etapa === "operacao") motivosExclusao.filtro_operacao = e.excluidos;
      else if (e.etapa === "cidade") motivosExclusao.filtro_cidade = e.excluidos;
      else if (e.etapa === "bairro") motivosExclusao.filtro_bairro = e.excluidos;
      else if (e.etapa === "tipo_imovel") motivosExclusao.filtro_tipo_imovel = e.excluidos;
    }
    log("filtros_efetivos", etapas);

    // ============= CARREGA CANDIDATOS =============
    const tDb = Date.now();
    let q = sbAdmin
      .from("lista_proprietarios_captacao")
      .select("id,nome_proprietario,telefone,cidade,bairro,titulo_imovel,operacao,preco,ultimo_preco,origem,url_anuncio,motivacao_score,motivacao_nivel,motivacao_sinais,primeiro_visto_em,ultimo_visto_em,historico_precos,observacoes,dados_extraidos_raw")
      .eq("imobiliaria_id", user.id)
      .gte("motivacao_score", scoreMin)
      .order("motivacao_score", { ascending: false })
      .limit(limite);

    if (filtrosAplicados.operacao) q = q.eq("operacao", filtrosAplicados.operacao);
    if (filtrosAplicados.cidade) q = q.ilike("cidade", `%${filtrosAplicados.cidade}%`);
    if (filtrosAplicados.bairro) q = q.ilike("bairro", `%${filtrosAplicados.bairro}%`);
    if (filtrosAplicados.tipo_imovel) q = q.ilike("titulo_imovel", `%${filtrosAplicados.tipo_imovel}%`);

    const { data: candidatos, error: dbErr } = await q;
    mark("db_candidatos_ms", Date.now() - tDb);
    if (dbErr) {
      return await errorResponse(500, "db_error", "Falha ao carregar candidatos", {
        detalhe: dbErr.message,
        filtros_aplicados: filtrosAplicados,
        filtros_efetivos: etapas,
      });
    }

    // Alem do limite: quantos passaram por todos os filtros mas foram cortados pelo limite.
    const totalPosFiltros = prev; // último count após todos os filtros
    motivosExclusao.alem_do_limite = Math.max(0, totalPosFiltros - (candidatos?.length ?? 0));

    if (!candidatos || candidatos.length === 0) {
      log("sem candidatos");
      const payload = {
        success: true,
        resultados: [],
        total: 0,
        run_id: runId,
        duracao_ms: Date.now() - startedAt,
        tempos,
        modo_teste: modoTeste,
        contagem_nivel: { Frio: 0, Morno: 0, Quente: 0, Fervendo: 0 },
        contagem_prioridade: { alta: 0, media: 0, baixa: 0 },
        filtros_aplicados: filtrosAplicados,
        filtros_efetivos: etapas,
        motivos_exclusao: motivosExclusao,
        mensagem: modoTeste ? "Nenhum candidato atende ao filtro para a amostra de teste." : undefined,
      };
      await persistLog({
        sucesso: true,
        modo_teste: modoTeste,
        filtros_aplicados: filtrosAplicados,
        criterios,
        contagens: { total_bruto: totalBruto, total_pos_filtros: totalPosFiltros, retornados: 0 },
        motivos_exclusao: motivosExclusao,
        filtros_efetivos: etapas,
        total_resultados: 0,
      });
      return new Response(JSON.stringify(payload), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    log("candidatos", candidatos.length);

    // Contagem por nível de motivação (dado bruto do banco)
    const contagemNivel: Record<string, number> = { Frio: 0, Morno: 0, Quente: 0, Fervendo: 0 };
    for (const c of candidatos as any[]) {
      const n = (c.motivacao_nivel ?? "Frio") as string;
      contagemNivel[n] = (contagemNivel[n] ?? 0) + 1;
    }

    // Resumo compacto para IA
    const tPrep = Date.now();
    const schemaStats = { total: candidatos.length, raw_ok: 0, tipo_fallback: 0, tipo_default: 0 };
    const resumo = candidatos.map((c: any, i: number) => {
      const validated = validateRawSchema(c.dados_extraidos_raw);
      const tipoInfo = inferTipoImovel({
        dados_extraidos_raw: c.dados_extraidos_raw,
        tipo_imovel: c.tipo_imovel,
        titulo_imovel: c.titulo_imovel,
        observacoes: c.observacoes,
        descricao: c.descricao,
        url_anuncio: c.url_anuncio,
      });
      if (validated.ok) schemaStats.raw_ok++;
      if (tipoInfo.fallback) schemaStats.tipo_fallback++;
      if (tipoInfo.source === "default") schemaStats.tipo_default++;
      return {
        i,
        nome: c.nome_proprietario,
        op: c.operacao,
        tipo: tipoInfo.tipo,
        tipo_source: tipoInfo.source,
        tipo_fallback: tipoInfo.fallback,
        bairro: c.bairro,
        cidade: c.cidade,
        preco: c.ultimo_preco ?? c.preco,
        preco_inicial: Array.isArray(c.historico_precos) && c.historico_precos[0]?.preco,
        dias_mercado: c.motivacao_sinais?.dias_no_mercado ?? null,
        queda_pct: c.motivacao_sinais?.queda_pct ?? 0,
        republicacoes: c.motivacao_sinais?.republicacoes ?? 0,
        fsbo: !!c.motivacao_sinais?.fsbo,
        score_dor: c.motivacao_score,
        origem: c.origem,
        titulo: (c.titulo_imovel ?? "").slice(0, 120),
        descricao: (c.descricao ?? validated.data.descricao ?? "").slice(0, 300),
      };
    });
    mark("prep_prompt_ms", Date.now() - tPrep);

    const systemPrompt = `Você é um analista sênior de captação imobiliária. Sua missão é priorizar proprietários com maior potencial de conversão para um corretor de imóveis, cruzando sinais objetivos de mercado com pistas textuais dos anúncios.

Retorne EXCLUSIVAMENTE JSON válido, sem markdown, sem texto fora do JSON.`;

    const userPrompt = `Analise a lista abaixo e classifique cada proprietário considerando os pesos configurados (0-100):
- probabilidade_venda (peso ${criterios.probabilidade}): sinais de dor/dificuldade (dias no mercado, quedas de preço, republicações).
- urgencia (peso ${criterios.urgencia}): sinais textuais no título/descrição ("urgente", "abaixo do mercado", "aceito proposta", "mudança", "desocupado").
- perfil_investimento (peso ${criterios.investimento}): indícios de investidor vs. morador (múltiplos imóveis, linguagem comercial, FSBO estruturado).
- ajuste_portfolio (peso ${criterios.portfolio}): compatibilidade com o foco do corretor: ${body.portfolio_hint || "sem preferência declarada"}.

Para cada item retorne:
- i (índice original)
- ai_score (0-100, considerando os pesos)
- prioridade ("alta" | "media" | "baixa")
- perfil ("morador_motivado" | "morador_neutro" | "investidor" | "incerto")
- motivos: 2-4 bullets curtos explicando o score
- acao_recomendada: 1 frase acionável (ex: "Ligar hoje oferecendo reavaliação gratuita")
- mensagem_whatsapp: 1-2 frases personalizadas em pt-BR (sem saudação genérica)

Formato:
{"resultados":[{"i":0,"ai_score":85,"prioridade":"alta","perfil":"morador_motivado","motivos":["..."],"acao_recomendada":"...","mensagem_whatsapp":"..."}]}

Candidatos (${resumo.length}):
${JSON.stringify(resumo)}`;

    log("chamando IA", { provider: gate.config?.provider, model: gate.config?.model });
    const tAi = Date.now();
    const ai = await callUserAi(gate.config, {
      systemPrompt, userPrompt, wantJson: true, temperature: 0.2, maxTokens: 4096, timeoutMs: 45000,
    });
    mark("ai_call_ms", Date.now() - tAi);
    if (!ai.ok) {
      log("IA falhou", { error_code: (ai as any)?.error_code, message: (ai as any)?.message, status: (ai as any)?.status });
      const orig = await aiErrorResponse(ai, corsHeaders).clone().json().catch(() => ({}));
      await persistLog({
        sucesso: false,
        error_code: (ai as any)?.error_code ?? "ai_call_failed",
        modo_teste: modoTeste,
        filtros_aplicados: filtrosAplicados,
        criterios,
        motivos_exclusao: motivosExclusao,
        filtros_efetivos: etapas,
        contagens: { total_bruto: totalBruto, total_pos_filtros: totalPosFiltros, candidatos: candidatos.length },
      });
      return new Response(
        JSON.stringify({
          ...orig,
          success: false,
          run_id: runId,
          duracao_ms: Date.now() - startedAt,
          tempos,
          log_excerpt: logLines.slice(-20),
          filtros_aplicados: filtrosAplicados,
          filtros_efetivos: etapas,
          motivos_exclusao: motivosExclusao,
        }),
        { status: (ai as any)?.status ?? 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    log("IA ok", { provider: ai.provider, model: ai.model, chars: ai.text?.length ?? 0 });

    const tParse = Date.now();
    const parsed = tryParseJson<{ resultados?: any[] }>(ai.text);
    const raw = Array.isArray(parsed?.resultados) ? parsed!.resultados! : [];
    if (!parsed || raw.length === 0) {
      return await errorResponse(502, "ai_parse_error", "A IA retornou um formato inválido. Refaça a filtragem.", {
        preview: (ai.text ?? "").slice(0, 400),
        filtros_aplicados: filtrosAplicados,
        filtros_efetivos: etapas,
        motivos_exclusao: motivosExclusao,
      });
    }

    const byIndex = new Map<number, any>();
    for (const r of raw) {
      if (typeof r?.i === "number") byIndex.set(r.i, r);
    }

    const resultados = candidatos
      .map((c: any, i: number) => {
        const a = byIndex.get(i);
        if (!a) return null;
        const ai_score = Math.max(0, Math.min(100, Math.round(Number(a.ai_score) || 0)));
        return {
          proprietario: c,
          ai_score,
          prioridade: ["alta", "media", "baixa"].includes(a.prioridade) ? a.prioridade : (ai_score >= 75 ? "alta" : ai_score >= 50 ? "media" : "baixa"),
          perfil: ["morador_motivado", "morador_neutro", "investidor", "incerto"].includes(a.perfil) ? a.perfil : "incerto",
          motivos: Array.isArray(a.motivos) ? a.motivos.filter((m: any) => typeof m === "string").slice(0, 4) : [],
          acao_recomendada: typeof a.acao_recomendada === "string" ? a.acao_recomendada.trim() : "",
          mensagem_whatsapp: typeof a.mensagem_whatsapp === "string" ? a.mensagem_whatsapp.trim() : "",
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b!.ai_score - a!.ai_score);
    mark("pos_processamento_ms", Date.now() - tParse);

    motivosExclusao.sem_resposta_ia = Math.max(0, candidatos.length - resultados.length);

    const contagemPrioridade = { alta: 0, media: 0, baixa: 0 };
    for (const r of resultados as any[]) contagemPrioridade[r.prioridade as "alta" | "media" | "baixa"]++;

    const contagens = {
      total_bruto: totalBruto,
      total_pos_filtros: totalPosFiltros,
      candidatos_analisados: candidatos.length,
      retornados_pela_ia: resultados.length,
      por_nivel: contagemNivel,
      por_prioridade: contagemPrioridade,
    };

    log("finalizado", { total: resultados.length, modoTeste, contagens, motivos_exclusao: motivosExclusao });

    await persistLog({
      sucesso: true,
      modo_teste: modoTeste,
      filtros_aplicados: filtrosAplicados,
      criterios,
      contagens,
      motivos_exclusao: motivosExclusao,
      filtros_efetivos: etapas,
      modelo: ai.model,
      provider: ai.provider,
      total_resultados: resultados.length,
    });

    return new Response(JSON.stringify({
      success: true,
      total: resultados.length,
      resultados,
      criterios_aplicados: criterios,
      filtros_aplicados: filtrosAplicados,
      filtros_efetivos: etapas,
      motivos_exclusao: motivosExclusao,
      contagens,
      modelo: ai.model,
      provider: ai.provider,
      schema_diag: schemaStats,
      run_id: runId,
      duracao_ms: Date.now() - startedAt,
      tempos,
      modo_teste: modoTeste,
      amostra: modoTeste ? amostra : null,
      contagem_nivel: contagemNivel,
      contagem_prioridade: contagemPrioridade,
      persistido: !modoTeste,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    const err = e as Error;
    console.error(`[filtrar-proprietarios-ia][run:${runId}] fatal`, err);
    return await errorResponse(500, "unexpected_error", err?.message || "Erro ao processar filtragem IA", {
      stack: (err?.stack ?? "").split("\n").slice(0, 4).join("\n"),
    });
  }
});
