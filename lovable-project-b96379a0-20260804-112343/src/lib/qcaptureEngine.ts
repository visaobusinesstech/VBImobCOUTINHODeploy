/**
 * Q-Capture Intelligence Engine
 * Motor proprietário de análise de oportunidades de captação imobiliária.
 * Integra dados da carteira com dados reais de mercado (imoveis_mercado).
 */

export interface OportunidadeCaptacao {
  imovelId: string;
  titulo: string;
  tipo: string;
  operacao: string;
  bairro: string;
  cidade: string;
  preco: number;
  area: number;
  precoM2: number;
  diasAnuncio: number;
  qScore: number;
  faixaIdealMin: number;
  faixaIdealMax: number;
  tempoEstimadoDias: number;
  riscoSuperpreco: "baixo" | "moderado" | "alto" | "critico";
  potencialReposicionamento: "baixo" | "moderado" | "alto";
  urlAnuncio?: string | null;
  // Comparação com mercado real
  precoM2Mercado?: number;
  desvioMercado?: number; // % acima/abaixo do mercado real
  fonteComparacao?: "mercado_real" | "carteira";
  // Aluguel extras
  riscoVacancia?: "baixo" | "moderado" | "alto";
  potencialReajuste?: "baixo" | "moderado" | "alto";
}

export interface AnaliseRegional {
  bairro: string;
  totalOfertas: number;
  precoM2Medio: number;
  indiceLiquidez: number;
  indiceSaturacao: number;
  indiceVacancia: number;
  oportunidade: "alta" | "moderada" | "baixa";
  // Dados de mercado real
  precoM2MercadoReal?: number;
  totalOfertasMercado?: number;
  fontePreco: "mercado_real" | "carteira" | "combinado";
}

interface ImovelInput {
  id: string;
  titulo: string;
  tipo: string;
  operacao: string;
  bairro: string | null;
  cidade: string | null;
  preco: number;
  area: number;
  created_at: string;
  status: string;
  url_anuncio?: string | null;
}

export interface ImovelMercadoInput {
  id: string;
  titulo: string;
  tipo: string | null;
  operacao: string | null;
  bairro: string | null;
  cidade: string | null;
  preco: number | null;
  area: number | null;
  preco_m2: number | null;
  quartos: number | null;
  dias_anuncio: number | null;
  portal: string;
  data_scraping: string | null;
  url_anuncio?: string | null;
}

/**
 * Calcula o Q-Capture Score (0-100)
 */
function calcQScore(diasAnuncio: number, desvioPreco: number, liquidez: number, saturacao: number, temDadosReais: boolean): number {
  const fatorTempo = Math.min(diasAnuncio / 180, 1) * 30;
  const fatorPreco = Math.min(Math.abs(desvioPreco) / 30, 1) * 25;
  const fatorLiquidez = (liquidez / 100) * 25;
  const fatorSaturacao = ((100 - saturacao) / 100) * 20;

  // Bonus de confiança quando baseado em dados reais de mercado
  const bonus = temDadosReais ? 5 : 0;

  return Math.round(Math.min(100, fatorTempo + fatorPreco + fatorLiquidez + fatorSaturacao + bonus));
}

/**
 * Agrupa dados de mercado por bairro
 */
function agruparMercadoPorBairro(mercado: ImovelMercadoInput[], operacaoFiltro?: string) {
  const porBairro: Record<string, ImovelMercadoInput[]> = {};
  const filtered = operacaoFiltro
    ? mercado.filter(m => m.operacao === operacaoFiltro)
    : mercado;

  for (const m of filtered) {
    const b = m.bairro || "Sem bairro";
    if (!porBairro[b]) porBairro[b] = [];
    porBairro[b].push(m);
  }

  const resultado: Record<string, { precoM2Medio: number; total: number; diasMedio: number }> = {};

  for (const [bairro, lista] of Object.entries(porBairro)) {
    const comPreco = lista.filter(m => (m.preco_m2 && m.preco_m2 > 0) || (m.preco && m.area && m.area > 0));
    const precosM2 = comPreco.map(m => m.preco_m2 || (m.preco! / m.area!));
    const precoM2Medio = precosM2.length > 0 ? precosM2.reduce((a, b) => a + b, 0) / precosM2.length : 0;
    const diasMedio = lista.reduce((acc, m) => acc + (m.dias_anuncio || 0), 0) / (lista.length || 1);

    resultado[bairro] = { precoM2Medio, total: lista.length, diasMedio };
  }

  return resultado;
}

/**
 * Analisa regionalmente por bairro, integrando dados reais de mercado
 */
export function analisarRegioes(imoveis: ImovelInput[], operacaoFiltro?: string, mercado?: ImovelMercadoInput[]): AnaliseRegional[] {
  const porBairro: Record<string, ImovelInput[]> = {};
  const filtered = operacaoFiltro ? imoveis.filter(i => i.operacao === operacaoFiltro) : imoveis;

  for (const im of filtered) {
    const b = im.bairro || "Sem bairro";
    if (!porBairro[b]) porBairro[b] = [];
    porBairro[b].push(im);
  }

  const mercadoPorBairro = mercado ? agruparMercadoPorBairro(mercado, operacaoFiltro) : {};
  const totalGeral = filtered.length || 1;

  // Collect all neighborhoods (from both carteira and mercado)
  const todosBairros = new Set([...Object.keys(porBairro), ...Object.keys(mercadoPorBairro)]);

  return Array.from(todosBairros).map(bairro => {
    const lista = porBairro[bairro] || [];
    const mercadoBairro = mercadoPorBairro[bairro];

    // Preço/m² da carteira
    const precosCarteira = lista.filter(i => i.area > 0).map(i => i.preco / i.area);
    const precoM2Carteira = precosCarteira.length > 0 ? precosCarteira.reduce((a, b) => a + b, 0) / precosCarteira.length : 0;

    // Preço/m² do mercado real
    const precoM2MercadoReal = mercadoBairro?.precoM2Medio || 0;
    const totalOfertasMercado = mercadoBairro?.total || 0;

    // Preço combinado: prioriza mercado real, fallback para carteira
    let precoM2Medio: number;
    let fontePreco: "mercado_real" | "carteira" | "combinado";
    if (precoM2MercadoReal > 0 && precoM2Carteira > 0) {
      precoM2Medio = precoM2MercadoReal * 0.7 + precoM2Carteira * 0.3; // peso maior para mercado real
      fontePreco = "combinado";
    } else if (precoM2MercadoReal > 0) {
      precoM2Medio = precoM2MercadoReal;
      fontePreco = "mercado_real";
    } else {
      precoM2Medio = precoM2Carteira;
      fontePreco = "carteira";
    }

    const totalOfertas = lista.length + totalOfertasMercado;
    const indiceSaturacao = Math.round((totalOfertas / Math.max(totalGeral + (mercado?.length || 0), 1)) * 100);

    // Liquidez: se temos dados reais, usa tempo médio real
    let diasMedios: number;
    if (mercadoBairro && mercadoBairro.diasMedio > 0) {
      diasMedios = mercadoBairro.diasMedio;
    } else {
      diasMedios = lista.reduce((acc, i) => {
        const dias = Math.floor((Date.now() - new Date(i.created_at).getTime()) / 86400000);
        return acc + dias;
      }, 0) / (lista.length || 1);
    }
    const indiceLiquidez = Math.round(Math.max(0, 100 - diasMedios * 0.5));

    const aluguelCount = lista.filter(i => i.operacao === "Aluguel").length;
    const indiceVacancia = aluguelCount > 0 ? Math.round((aluguelCount / (lista.length || 1)) * 60 + Math.random() * 20) : 0;

    const oportunidade: "alta" | "moderada" | "baixa" = indiceLiquidez > 60 && indiceSaturacao < 40 ? "alta"
      : indiceLiquidez > 30 ? "moderada" : "baixa";

    return {
      bairro,
      totalOfertas,
      precoM2Medio: Math.round(precoM2Medio),
      indiceLiquidez,
      indiceSaturacao: Math.min(100, indiceSaturacao),
      indiceVacancia: Math.min(100, indiceVacancia),
      oportunidade,
      precoM2MercadoReal: precoM2MercadoReal > 0 ? Math.round(precoM2MercadoReal) : undefined,
      totalOfertasMercado: totalOfertasMercado > 0 ? totalOfertasMercado : undefined,
      fontePreco,
    };
  }).sort((a, b) => b.indiceLiquidez - a.indiceLiquidez);
}

/**
 * Gera oportunidades de captação para cada imóvel, usando dados reais quando disponíveis
 */
export function gerarOportunidades(imoveis: ImovelInput[], regioes: AnaliseRegional[]): OportunidadeCaptacao[] {
  const regMap: Record<string, AnaliseRegional> = {};
  for (const r of regioes) regMap[r.bairro] = r;

  return imoveis.map(im => {
    const bairro = im.bairro || "Sem bairro";
    const reg = regMap[bairro] || { indiceLiquidez: 50, indiceSaturacao: 50, precoM2Medio: 0, indiceVacancia: 20, fontePreco: "carteira" as const };
    const area = im.area || 1;
    const precoM2 = im.preco / area;
    const diasAnuncio = Math.floor((Date.now() - new Date(im.created_at).getTime()) / 86400000);

    const desvioPreco = reg.precoM2Medio > 0 ? ((precoM2 - reg.precoM2Medio) / reg.precoM2Medio) * 100 : 0;
    const temDadosReais = reg.fontePreco === "mercado_real" || reg.fontePreco === "combinado";

    const qScore = calcQScore(diasAnuncio, desvioPreco, reg.indiceLiquidez, reg.indiceSaturacao, temDadosReais);

    // Faixa ideal de preço baseada em dados reais quando disponível
    const faixaIdealMin = Math.round(reg.precoM2Medio * area * 0.9);
    const faixaIdealMax = Math.round(reg.precoM2Medio * area * 1.1);

    const tempoEstimadoDias = Math.round(30 + diasAnuncio * 0.3 + (desvioPreco > 0 ? desvioPreco * 2 : 0));

    const riscoSuperpreco: "baixo" | "moderado" | "alto" | "critico" = desvioPreco > 25 ? "critico" : desvioPreco > 15 ? "alto" : desvioPreco > 5 ? "moderado" : "baixo";
    const potencialReposicionamento: "baixo" | "moderado" | "alto" = desvioPreco > 10 ? "alto" : desvioPreco > 0 ? "moderado" : "baixo";

    // Desvio vs mercado real
    const precoM2Mercado = (reg as AnaliseRegional).precoM2MercadoReal;
    const desvioMercado = precoM2Mercado ? ((precoM2 - precoM2Mercado) / precoM2Mercado) * 100 : undefined;

    const isAluguel = im.operacao === "Aluguel";

    return {
      imovelId: im.id,
      titulo: im.titulo,
      urlAnuncio: im.url_anuncio || null,
      tipo: im.tipo,
      operacao: im.operacao,
      bairro,
      cidade: im.cidade || "",
      preco: im.preco,
      area,
      precoM2: Math.round(precoM2),
      diasAnuncio,
      qScore,
      faixaIdealMin,
      faixaIdealMax,
      tempoEstimadoDias,
      riscoSuperpreco,
      potencialReposicionamento,
      precoM2Mercado,
      desvioMercado: desvioMercado !== undefined ? Math.round(desvioMercado) : undefined,
      fonteComparacao: temDadosReais ? "mercado_real" as const : "carteira" as const,
      ...(isAluguel ? {
        riscoVacancia: reg.indiceVacancia > 60 ? "alto" as const : reg.indiceVacancia > 30 ? "moderado" as const : "baixo" as const,
        potencialReajuste: reg.indiceLiquidez > 60 ? "alto" as const : reg.indiceLiquidez > 30 ? "moderado" as const : "baixo" as const,
      } : {}),
    };
  }).sort((a, b) => b.qScore - a.qScore);
}

/**
 * Gera scripts de abordagem baseados nos dados de análise
 */
export function gerarScriptAbordagem(op: OportunidadeCaptacao, nomeCorretor: string) {
  const precoFormatado = op.preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const faixaMin = op.faixaIdealMin.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const faixaMax = op.faixaIdealMax.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const fonteLabel = op.fonteComparacao === "mercado_real" ? " (baseado em dados reais de mercado)" : "";

  const ligacao = `Bom dia/Boa tarde! Meu nome é ${nomeCorretor}, sou consultor imobiliário especializado na região ${op.bairro}. Identifiquei uma oportunidade pública de mercado referente ao seu imóvel localizado em ${op.bairro}. Nossa análise territorial${fonteLabel} indica que imóveis similares na região têm uma faixa estratégica entre ${faixaMin} e ${faixaMax}, e o tempo médio de negociação é de ${op.tempoEstimadoDias} dias. Gostaria de compartilhar um relatório estratégico gratuito com o senhor(a)?`;

  const desvioInfo = op.desvioMercado !== undefined ? `\n📊 Desvio do mercado real: ${op.desvioMercado > 0 ? "+" : ""}${op.desvioMercado}%` : "";
  const whatsapp = `Olá! Sou ${nomeCorretor}, consultor imobiliário. 📊 Realizamos uma análise de mercado da região *${op.bairro}* e identificamos uma oportunidade estratégica para seu imóvel.\n\n📈 *Q-Capture Score: ${op.qScore}/100*\n💰 Faixa ideal: ${faixaMin} a ${faixaMax}${desvioInfo}\n⏱️ Tempo estimado: ${op.tempoEstimadoDias} dias\n\nPosso enviar um *relatório executivo completo* sem compromisso?`;

  const followup = `Olá! Espero que esteja bem. Entramos em contato recentemente sobre a análise de mercado do seu imóvel em ${op.bairro}. Nosso relatório atualizado mostra que o Q-Capture Score está em ${op.qScore}/100, indicando ${op.qScore >= 71 ? "alta probabilidade de captação" : "uma boa oportunidade no momento atual"}. Gostaria de agendar uma conversa de 10 minutos para apresentar os dados?`;

  return { ligacao, whatsapp, followup };
}
