// Helpers de análise e limites de caracteres usados pelo formulário SAS.
// Extraídos para permitir testes unitários independentes da UI.

export const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export type Topico = { id: string; label: string; hint: string; palavras: RegExp };

export const TOPICOS_DESCRICAO: Topico[] = [
  { id: "ambientes", label: "Ambientes", hint: "cite quantos quartos, suítes, banheiros e salas", palavras: /\b(quarto|dormitorio|suite|banheiro|lavabo|sala|cozinha|copa|escritorio|varanda|sacada)/ },
  { id: "area", label: "Área / tamanho", hint: "mencione a metragem (m²) ou o porte do imóvel", palavras: /(\bm2\b|\bm²|metros|\barea\b|amplo|ampla|espacoso|espacosa|compacto)/ },
  { id: "acabamento", label: "Acabamentos", hint: "descreva pisos, revestimentos, bancadas, esquadrias", palavras: /\b(piso|porcelanato|ceramica|granito|marmore|laminado|madeira|armario|planejad|pintura|revestimento|esquadria|bancada)/ },
  { id: "estado", label: "Estado de conservação", hint: "diga se é novo, reformado, semi-novo ou original", palavras: /\b(novo|reformad|semi\-?novo|conservad|original|impecavel|revitalizad)/ },
  { id: "localizacao", label: "Localização / entorno", hint: "cite bairro, ruas, comércio, escolas ou transporte próximo", palavras: /\b(proxim|perto|localiza|bairro|avenida|rua|comercio|mercado|supermercado|escola|metro|onibus|transporte|shopping|hospital|parque)/ },
  { id: "diferenciais", label: "Diferenciais / lazer", hint: "cite vista, andar, sol, lazer, portaria ou área comum", palavras: /\b(vista|andar|sol|nascente|poente|lazer|piscina|academia|salao|festa|churrasqueira|playground|portaria|24h|elevador|garagem|vaga)/ },
];

export const TOPICOS_TAXA_EXTRA: Topico[] = [
  { id: "motivo", label: "Motivo", hint: "explique o motivo (obra, reforma, fundo de reserva, rateio)", palavras: /\b(obra|reforma|fundo|reserva|rateio|extraordinari|manutencao|pintura|fachada|elevador|telhado)/ },
  { id: "prazo", label: "Prazo / duração", hint: "informe por quantos meses a taxa será cobrada", palavras: /\b(mes|meses|ate|prazo|duracao|parcela|vezes|inicio|termino)\b/ },
];

export function analisarTexto(txt: string, topicos: Topico[]) {
  const n = norm(txt);
  const cobertos = topicos.filter(t => t.palavras.test(n));
  const faltando = topicos.filter(t => !t.palavras.test(n));
  return { cobertos, faltando, cobertura: topicos.length ? cobertos.length / topicos.length : 0 };
}

// Limites de caracteres
export const LIMITES = {
  descricao: { max: 2000, minRec: 30, ideal: 200 },
  taxaExtra: { max: 400, min: 15 },
} as const;

export type CounterState =
  | "empty"
  | "belowMin"
  | "belowIdeal"
  | "good"
  | "nearMax"
  | "atMax";

/** Trunca um valor ao limite máximo, garantindo que não exceda o cap. */
export function truncarAoMax(input: string, max: number): string {
  return input.length > max ? input.slice(0, max) : input;
}

/** Retorna true quando a edição fez o valor atingir o limite máximo (para disparar alerta). */
export function atingiuMax(prev: string, nextRaw: string, max: number): boolean {
  return nextRaw.length >= max && prev.length < max;
}

/** Classifica o estado do contador da descrição principal. */
export function estadoContadorDescricao(txt: string): CounterState {
  const { max, minRec, ideal } = LIMITES.descricao;
  const len = txt.length;
  const trimmed = txt.trim().length;
  if (len >= max) return "atMax";
  if (len >= max * 0.9) return "nearMax";
  if (trimmed === 0) return "empty";
  if (trimmed < minRec) return "belowMin";
  if (trimmed < ideal) return "belowIdeal";
  return "good";
}

/** Classifica o estado do contador da taxa extra. */
export function estadoContadorTaxaExtra(txt: string): CounterState {
  const { max, min } = LIMITES.taxaExtra;
  const len = txt.length;
  const trimmed = txt.trim().length;
  if (len >= max) return "atMax";
  if (len >= max * 0.9) return "nearMax";
  if (trimmed === 0) return "empty";
  if (trimmed < min) return "belowMin";
  return "good";
}

export type ValidacaoLimite = { valid: boolean; erro?: string };

/** Valida a descrição do imóvel (obrigatória, mínimo recomendado e máximo). */
export function validarDescricao(txt: string): ValidacaoLimite {
  const { max, minRec } = LIMITES.descricao;
  const trimmed = txt.trim().length;
  if (trimmed === 0) return { valid: false, erro: "Descrição é obrigatória" };
  if (trimmed < minRec) {
    return { valid: false, erro: `Descrição muito curta — mínimo de ${minRec} caracteres (faltam ${minRec - trimmed})` };
  }
  if (txt.length > max) {
    return { valid: false, erro: `Descrição excede o limite de ${max} caracteres` };
  }
  return { valid: true };
}

/** Valida a descrição da taxa extra (opcional; obrigatória quando houver taxa). */
export function validarTaxaExtra(txt: string, valorTaxa: number): ValidacaoLimite {
  if (!(valorTaxa > 0)) return { valid: true }; // sem taxa, não valida
  const { max, min } = LIMITES.taxaExtra;
  const trimmed = txt.trim().length;
  if (trimmed === 0) return { valid: false, erro: "Descreva o motivo da taxa extra" };
  if (trimmed < min) {
    return { valid: false, erro: `Descrição muito curta — mínimo de ${min} caracteres (faltam ${min - trimmed})` };
  }
  if (txt.length > max) {
    return { valid: false, erro: `Descrição excede o limite de ${max} caracteres` };
  }
  return { valid: true };
}
