/**
 * Engine de cálculos para Avaliação Imobiliária Profissional
 * Conforme metodologia ABNT NBR 14.653.
 *
 * Funções puras — sem dependência de React/Supabase — para fácil teste.
 */

export interface ComparavelInput {
  id: string;
  endereco?: string;
  bairro?: string;
  area: number;           // m²
  valor_anunciado: number; // R$
  valor_negociado?: number; // R$ (preferencial)
  distancia_km?: number;
  data_pesquisa?: string;
  link_fonte?: string;
  fotos?: string[];
  observacoes?: string;
}

/** Fatores de homogeneização — multiplicadores (1 = neutro). */
export interface FatoresHomogeneizacao {
  localizacao: number;
  area: number;
  conservacao: number;
  padrao: number;
  idade: number;
  garagem: number;
  infraestrutura: number;
  vista: number;
  liquidez: number;
  outros: number;
}

export const FATORES_DEFAULT: FatoresHomogeneizacao = {
  localizacao: 1,
  area: 1,
  conservacao: 1,
  padrao: 1,
  idade: 1,
  garagem: 1,
  infraestrutura: 1,
  vista: 1,
  liquidez: 1,
  outros: 1,
};

export interface ComparavelHomogeneizado {
  id: string;
  valor_base: number;       // valor usado (negociado > anunciado)
  area: number;
  preco_m2_bruto: number;
  fator_total: number;
  preco_m2_homogeneizado: number;
  valor_total_homogeneizado: number;
  fatores: FatoresHomogeneizacao;
}

export interface ResultadoAvaliacao {
  comparaveis: ComparavelHomogeneizado[];
  amostraValida: number;
  precoM2: {
    media: number;
    mediana: number;
    min: number;
    max: number;
    desvioPadrao: number;
    coeficienteVariacao: number;
    intervaloConfianca: { inferior: number; superior: number };
  };
  valorFinal: {
    sugerido: number;
    minimo: number;
    maximo: number;
  };
  /** Avaliação de qualidade da amostra (NBR 14.653). */
  qualidade: {
    nivel: "rigoroso" | "normal" | "expedito" | "insuficiente";
    mensagem: string;
    alertas: string[];
  };
}

const PERCENT_NEUTRO = 1;

export function fatorTotal(f: FatoresHomogeneizacao): number {
  return (
    f.localizacao *
    f.area *
    f.conservacao *
    f.padrao *
    f.idade *
    f.garagem *
    f.infraestrutura *
    f.vista *
    f.liquidez *
    f.outros
  );
}

export function valorBase(c: ComparavelInput): number {
  if (c.valor_negociado && c.valor_negociado > 0) return c.valor_negociado;
  return c.valor_anunciado || 0;
}

export function homogeneizar(
  c: ComparavelInput,
  fatores: FatoresHomogeneizacao,
): ComparavelHomogeneizado {
  const vb = valorBase(c);
  const area = c.area > 0 ? c.area : 0;
  const ft = fatorTotal(fatores);
  const precoM2Bruto = area > 0 ? vb / area : 0;
  const precoM2Hom = precoM2Bruto * ft;
  return {
    id: c.id,
    valor_base: vb,
    area,
    preco_m2_bruto: precoM2Bruto,
    fator_total: ft,
    preco_m2_homogeneizado: precoM2Hom,
    valor_total_homogeneizado: precoM2Hom * area,
    fatores,
  };
}

export function media(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

export function mediana(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}

export function desvioPadrao(values: number[]): number {
  if (values.length < 2) return 0;
  const m = media(values);
  const variancia = values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variancia);
}

/** IC 95% (t-student aproximado por z=1.96 para n>=30, ajuste simples abaixo). */
export function intervaloConfianca95(values: number[]): { inferior: number; superior: number } {
  if (values.length < 2) return { inferior: 0, superior: 0 };
  const m = media(values);
  const sd = desvioPadrao(values);
  const n = values.length;
  // Fator t aproximado
  const t =
    n >= 30 ? 1.96 :
    n >= 20 ? 2.09 :
    n >= 10 ? 2.26 :
    n >= 5 ? 2.78 :
    n >= 3 ? 4.30 : 12.71;
  const erro = (t * sd) / Math.sqrt(n);
  return { inferior: m - erro, superior: m + erro };
}

/** Remove outliers usando IQR (Tukey). */
export function removerOutliers(values: number[]): number[] {
  if (values.length < 4) return values;
  const s = [...values].sort((a, b) => a - b);
  const q1 = s[Math.floor(s.length * 0.25)];
  const q3 = s[Math.floor(s.length * 0.75)];
  const iqr = q3 - q1;
  const lo = q1 - 1.5 * iqr;
  const hi = q3 + 1.5 * iqr;
  return values.filter((v) => v >= lo && v <= hi);
}

export function avaliarQualidade(
  amostraSize: number,
  coefVariacao: number,
): ResultadoAvaliacao["qualidade"] {
  const alertas: string[] = [];
  if (amostraSize < 3) alertas.push("Amostra insuficiente — mínimo de 3 comparáveis recomendado.");
  if (amostraSize >= 3 && amostraSize < 5) alertas.push("Amostra reduzida — recomenda-se ao menos 5 comparáveis para maior precisão.");
  if (coefVariacao > 30) alertas.push(`Coeficiente de variação elevado (${coefVariacao.toFixed(1)}%) — amostra heterogênea.`);

  let nivel: ResultadoAvaliacao["qualidade"]["nivel"] = "insuficiente";
  let mensagem = "Amostra insuficiente para enquadramento NBR 14.653.";
  if (amostraSize >= 12 && coefVariacao <= 15) {
    nivel = "rigoroso";
    mensagem = "Grau III (Rigoroso) — amostra robusta, baixa variabilidade.";
  } else if (amostraSize >= 5 && coefVariacao <= 25) {
    nivel = "normal";
    mensagem = "Grau II (Normal) — amostra adequada para fundamentação.";
  } else if (amostraSize >= 3) {
    nivel = "expedito";
    mensagem = "Grau I (Expedito) — amostra mínima, resultado indicativo.";
  }
  return { nivel, mensagem, alertas };
}

export function calcularAvaliacao(
  comparaveis: ComparavelInput[],
  fatoresPorComparavel: Record<string, FatoresHomogeneizacao>,
  areaImovelAvaliando: number,
): ResultadoAvaliacao {
  const homogeneizados = comparaveis
    .filter((c) => c.area > 0 && valorBase(c) > 0)
    .map((c) => homogeneizar(c, fatoresPorComparavel[c.id] ?? FATORES_DEFAULT));

  const precosM2 = homogeneizados.map((h) => h.preco_m2_homogeneizado).filter((v) => v > 0);
  const precosLimpos = removerOutliers(precosM2);

  const med = media(precosLimpos);
  const sd = desvioPadrao(precosLimpos);
  const cv = med > 0 ? (sd / med) * 100 : 0;
  const ic = intervaloConfianca95(precosLimpos);
  const mediano = mediana(precosLimpos);
  const minV = precosLimpos.length ? Math.min(...precosLimpos) : 0;
  const maxV = precosLimpos.length ? Math.max(...precosLimpos) : 0;

  const precoM2Final = mediano > 0 ? mediano : med;
  const area = areaImovelAvaliando > 0 ? areaImovelAvaliando : 0;
  const sugerido = precoM2Final * area;
  const minimo = ic.inferior * area;
  const maximo = ic.superior * area;

  return {
    comparaveis: homogeneizados,
    amostraValida: precosLimpos.length,
    precoM2: {
      media: med,
      mediana: mediano,
      min: minV,
      max: maxV,
      desvioPadrao: sd,
      coeficienteVariacao: cv,
      intervaloConfianca: ic,
    },
    valorFinal: {
      sugerido: Math.max(0, sugerido),
      minimo: Math.max(0, minimo),
      maximo: Math.max(0, maximo),
    },
    qualidade: avaliarQualidade(precosLimpos.length, cv),
  };
}

/** Converte ajuste em porcentagem (-20 = -20%) para multiplicador (0.8). */
export function pctParaFator(pct: number): number {
  return 1 + (pct || 0) / 100;
}

/** Converte multiplicador (1.15) para porcentagem (+15). */
export function fatorParaPct(fator: number): number {
  return (fator - PERCENT_NEUTRO) * 100;
}
