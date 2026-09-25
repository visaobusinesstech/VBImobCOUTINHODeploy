/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Avaliação imobiliária (paridade de campos/resultado com Lovable avaliacao-imovel).
 */

export const DESCRICAO_MIN = 30;
export const DESCRICAO_MAX = 2000;

export type DescricaoErroCode =
  | "DESCRICAO_OBRIGATORIA"
  | "DESCRICAO_ABAIXO_MINIMO"
  | "DESCRICAO_ACIMA_MAXIMO";

export type DescricaoErroBackend = {
  error: string;
  code: DescricaoErroCode;
  field: "descricao";
  descricao_length: number;
  descricao_min: number;
  descricao_max: number;
};

function normalizar(txt: string | null | undefined): string {
  const s = txt ?? "";
  try {
    return s.normalize("NFC");
  } catch {
    return s;
  }
}

function toCodePoints(txt: string): string[] {
  return Array.from(txt);
}

export function contarDescricao(txt: string | null | undefined): number {
  return toCodePoints(normalizar(txt)).length;
}

export function validarDescricaoBackendShape(
  txt: string | null | undefined
): DescricaoErroBackend | null {
  const normalizado = normalizar(txt);
  const trimmed = normalizado.trim();
  const len = toCodePoints(trimmed).length;
  const base = {
    field: "descricao" as const,
    descricao_length: len,
    descricao_min: DESCRICAO_MIN,
    descricao_max: DESCRICAO_MAX
  };
  if (len === 0) {
    return {
      ...base,
      code: "DESCRICAO_OBRIGATORIA",
      error: `Descrição do imóvel é obrigatória (mínimo ${DESCRICAO_MIN} caracteres).`
    };
  }
  if (len < DESCRICAO_MIN) {
    return {
      ...base,
      code: "DESCRICAO_ABAIXO_MINIMO",
      error: `Descrição abaixo do recomendado (${len}/${DESCRICAO_MIN} caracteres mínimos).`
    };
  }
  if (len > DESCRICAO_MAX) {
    return {
      ...base,
      code: "DESCRICAO_ACIMA_MAXIMO",
      error: `Descrição acima do limite (${len}/${DESCRICAO_MAX} caracteres).`
    };
  }
  return null;
}

/** Estimativa simples m² (legado + fallback offline). */
export function estimateAvaliacao(preco: number, area: number, precoM2Mercado: number) {
  const p = Number(preco) || 0;
  const a = Number(area) || 0;
  const m2 = Number(precoM2Mercado) || 0;
  const imovelM2 = a > 0 ? p / a : 0;
  const valorJusto = m2 > 0 && a > 0 ? m2 * a : p;
  const desvio = valorJusto > 0 ? ((p - valorJusto) / valorJusto) * 100 : 0;
  let parecer = "em linha com o mercado";
  if (desvio > 15) parecer = "acima do mercado";
  else if (desvio < -15) parecer = "abaixo do mercado — oportunidade";
  return {
    precoM2: Math.round(imovelM2),
    valorJusto: Math.round(valorJusto),
    desvio: Math.round(desvio),
    parecer
  };
}

export type AvaliacaoLaudoInput = {
  preco: number;
  area: number;
  precoM2Mercado: number;
  tipo?: string;
  operacao?: string;
  bairro?: string;
  cidade?: string;
  quartos?: number | null;
  suites?: number | null;
  banheiros?: number | null;
  vagas?: number | null;
  descricao?: string | null;
  comparaveisCount?: number;
};

/**
 * Monta laudo no mesmo shape do Lovable (valor_minimo/ideal/maximo, liquidez, etc.).
 */
export function buildAvaliacaoLaudo(input: AvaliacaoLaudoInput) {
  const base = estimateAvaliacao(input.preco, input.area, input.precoM2Mercado);
  const valorIdeal = base.valorJusto || Number(input.preco) || 0;
  const valorMinimo = Math.round(valorIdeal * 0.92);
  const valorMaximo = Math.round(valorIdeal * 1.08);
  const preco = Number(input.preco) || 0;
  const area = Number(input.area) || 0;
  const m2Regiao = Number(input.precoM2Mercado) || 0;
  const precoM2Estimado = area > 0 ? Math.round(preco / area) : base.precoM2;
  const desvioAbs = Math.abs(base.desvio);

  let scoreLiquidez = 55;
  if (desvioAbs <= 5) scoreLiquidez = 85;
  else if (desvioAbs <= 10) scoreLiquidez = 72;
  else if (desvioAbs <= 15) scoreLiquidez = 60;
  else if (base.desvio > 15) scoreLiquidez = 40;
  else scoreLiquidez = 68;

  if ((input.comparaveisCount || 0) >= 5) scoreLiquidez = Math.min(95, scoreLiquidez + 8);
  if ((input.quartos || 0) >= 3) scoreLiquidez = Math.min(95, scoreLiquidez + 3);

  const classificacaoLiquidez =
    scoreLiquidez >= 70 ? "alta" : scoreLiquidez >= 50 ? "media" : "baixa";

  const precoCompetitivo = base.desvio <= 5;
  const sugestaoPrecoInicial = precoCompetitivo
    ? Math.round(preco || valorIdeal)
    : Math.round(valorIdeal * 0.98);

  const pontosFortes: string[] = [];
  const pontosAtencao: string[] = [];
  if (input.bairro) pontosFortes.push(`Localização em ${input.bairro}`);
  if ((input.quartos || 0) >= 3) pontosFortes.push("Boa quantidade de quartos para o perfil da região");
  if ((input.vagas || 0) >= 2) pontosFortes.push("Vagas de garagem acima da média");
  if (precoCompetitivo) pontosFortes.push("Preço alinhado ou abaixo do valor justo estimado");
  if (!pontosFortes.length) pontosFortes.push("Imóvel com potencial conforme comparáveis da região");

  if (base.desvio > 15) pontosAtencao.push("Preço pretendido acima do mercado — renegociar pode acelerar a venda");
  if (base.desvio < -15) pontosAtencao.push("Preço muito abaixo do mercado — revisar para não deixar valor na mesa");
  if (!(input.comparaveisCount || 0)) pontosAtencao.push("Poucos comparáveis encontrados — enriquecer base de mercado");
  if ((input.descricao || "").trim().length < 80) {
    pontosAtencao.push("Descrição curta — detalhar acabamento e diferenciais melhora o laudo");
  }
  if (!pontosAtencao.length) pontosAtencao.push("Manter acompanhamento de anúncios similares na região");

  const operacao = input.operacao || "Venda";
  const isAluguel = /alug|loca/i.test(operacao);
  const analiseResumo = [
    `Avaliação ${input.tipo || "imóvel"} em ${[input.bairro, input.cidade].filter(Boolean).join(", ") || "região informada"}.`,
    `Valor justo estimado em R$ ${valorIdeal.toLocaleString("pt-BR")} (faixa R$ ${valorMinimo.toLocaleString("pt-BR")} – R$ ${valorMaximo.toLocaleString("pt-BR")}).`,
    `Preço informado ${base.parecer} (${base.desvio > 0 ? "+" : ""}${base.desvio}% vs m² de mercado).`,
    `Liquidez classificada como ${classificacaoLiquidez} (score ${scoreLiquidez}).`
  ].join(" ");

  const estrategiaVenda = isAluguel
    ? "Posicionar o anúncio com fotos atualizadas, destacar condomínio/IPTU e responder leads em até 2h."
    : precoCompetitivo
      ? "Manter preço competitivo, reforçar diferenciais na descrição e anunciar nos portais recomendados."
      : "Ajustar preço inicial para próximo do valor ideal, testar por 15 dias e renegociar com base nos leads.";

  const portaisRecomendados = isAluguel
    ? ["QuintoAndar", "ZAP Imóveis", "VivaReal", "OLX"]
    : ["ZAP Imóveis", "VivaReal", "OLX", "Chave na Mão"];

  const p30 =
    classificacaoLiquidez === "alta" ? 35 : classificacaoLiquidez === "media" ? 22 : 12;
  const p60 =
    classificacaoLiquidez === "alta" ? 58 : classificacaoLiquidez === "media" ? 42 : 28;
  const p90 =
    classificacaoLiquidez === "alta" ? 78 : classificacaoLiquidez === "media" ? 65 : 45;

  return {
    ...base,
    avaliacao: {
      valor_minimo: valorMinimo,
      valor_ideal: valorIdeal,
      valor_maximo: valorMaximo,
      preco_m2_estimado: precoM2Estimado,
      preco_m2_regiao: Math.round(m2Regiao),
      score_liquidez: scoreLiquidez,
      classificacao_liquidez: classificacaoLiquidez,
      analise_resumo: analiseResumo,
      pontos_fortes: pontosFortes,
      pontos_atencao: pontosAtencao,
      estrategia_venda: estrategiaVenda,
      portais_recomendados: portaisRecomendados,
      sugestao_preco_inicial: sugestaoPrecoInicial,
      probabilidade_venda_30dias: p30,
      probabilidade_venda_60dias: p60,
      probabilidade_venda_90dias: p90,
      preco_competitivo: precoCompetitivo
    }
  };
}
