/**
 * Normalização e validação de telefone para o formato E.164.
 * E.164: '+' seguido do código do país + assinante, apenas dígitos, total entre 8 e 15 dígitos.
 * Foco em números BR (código 55) — assume BR quando o número não trouxer código do país.
 */

export interface E164Result {
  ok: boolean;
  /** Número normalizado no formato E.164 (ex.: +5511987654321). Presente somente quando `ok = true`. */
  e164?: string;
  /** Apenas dígitos, sem '+'. Útil para montar links wa.me. */
  digits?: string;
  /** Código do país sem '+' (ex.: "55"). */
  countryCode?: string;
  /** Número do assinante (sem código do país). */
  subscriber?: string;
  /** Motivo estruturado da falha, para exibição/telemetria. */
  reason?:
    | "empty"
    | "invalid_chars"
    | "too_short"
    | "too_long"
    | "invalid_country"
    | "invalid_br_number";
  message?: string;
}

const ALLOWED_INPUT_RE = /^[\d+\s().\-\u00A0]+$/;
const DEFAULT_COUNTRY = "55"; // Brasil

/**
 * Normaliza um telefone bruto para E.164. NÃO gera link wa.me em caso de falha.
 * Regras:
 *  - Aceita apenas dígitos, espaços, parênteses, ponto, hífen, NBSP e um '+' inicial.
 *  - Remove tudo que não for dígito depois da checagem de caracteres válidos.
 *  - Se o input original começar com '+', preserva o país informado.
 *  - Se não começar com '+' e tiver 10–11 dígitos, assume BR (+55).
 *  - Se não começar com '+' e já vier com 55 no prefixo (12–13 dígitos), respeita.
 *  - Valida BR: DDD 11–99 e assinante com 8 ou 9 dígitos (9º dígito começando em 9 quando 9 dígitos).
 *  - Comprimento total (dígitos, sem '+'): mínimo 8, máximo 15.
 */
export function normalizeToE164(raw: string | null | undefined, defaultCountry = DEFAULT_COUNTRY): E164Result {
  if (raw == null) return { ok: false, reason: "empty", message: "Telefone não informado." };
  const trimmed = String(raw).trim();
  if (!trimmed) return { ok: false, reason: "empty", message: "Telefone não informado." };

  if (!ALLOWED_INPUT_RE.test(trimmed)) {
    return {
      ok: false,
      reason: "invalid_chars",
      message: "O telefone contém caracteres inválidos. Use apenas dígitos, espaços, '(', ')', '-', '.' e opcionalmente '+' no início.",
    };
  }

  const hasPlusPrefix = trimmed.startsWith("+");
  const digitsOnlyInput = trimmed.replace(/\D/g, "");

  if (!digitsOnlyInput) {
    return { ok: false, reason: "empty", message: "Telefone não informado." };
  }

  let digits = digitsOnlyInput;

  // Inferência do país quando não veio com '+'
  if (!hasPlusPrefix) {
    // Já começa com o código do país (55) e tem tamanho compatível com BR
    if (digits.startsWith(defaultCountry) && (digits.length === 12 || digits.length === 13)) {
      // ok, mantém
    } else if (digits.length === 10 || digits.length === 11) {
      // Número BR sem DDI
      digits = defaultCountry + digits;
    } else {
      // Caso ambíguo — anexa o país padrão e valida abaixo
      digits = defaultCountry + digits;
    }
  }

  if (digits.length < 8) {
    return { ok: false, reason: "too_short", message: "Telefone muito curto para o padrão E.164 (mínimo de 8 dígitos)." };
  }
  if (digits.length > 15) {
    return { ok: false, reason: "too_long", message: "Telefone excede o limite E.164 (máximo de 15 dígitos)." };
  }

  // Código do país 1–3 dígitos (heurística: usamos correspondências comuns quando explícito).
  // Como o foco é BR, tratamos '55' primeiro; caso contrário, assumimos os 1–3 primeiros dígitos.
  let countryCode = "";
  if (digits.startsWith("55")) {
    countryCode = "55";
  } else {
    // Heurística simples: tenta 1, 2 ou 3 dígitos como país
    countryCode = digits.slice(0, Math.min(3, Math.max(1, digits.length - 8)));
    if (!countryCode) {
      return { ok: false, reason: "invalid_country", message: "Não foi possível identificar o código do país." };
    }
  }

  const subscriber = digits.slice(countryCode.length);

  if (countryCode === "55") {
    // BR: DDD (2 dígitos) + assinante (8 ou 9 dígitos). Total: 10 ou 11.
    if (subscriber.length !== 10 && subscriber.length !== 11) {
      return {
        ok: false,
        reason: "invalid_br_number",
        message: "Número BR inválido: informe DDD + telefone (10 ou 11 dígitos após o país).",
      };
    }
    const ddd = subscriber.slice(0, 2);
    const localPart = subscriber.slice(2);
    const dddNum = Number(ddd);
    if (!Number.isFinite(dddNum) || dddNum < 11 || dddNum > 99) {
      return { ok: false, reason: "invalid_br_number", message: `DDD inválido: ${ddd}.` };
    }
    // Celular BR de 9 dígitos deve iniciar em 9
    if (localPart.length === 9 && !localPart.startsWith("9")) {
      return {
        ok: false,
        reason: "invalid_br_number",
        message: "Celular BR com 9 dígitos deve iniciar em 9 após o DDD.",
      };
    }
  }

  return {
    ok: true,
    e164: `+${digits}`,
    digits,
    countryCode,
    subscriber,
  };
}

/** Helper para exibição amigável (não normaliza — apenas formata o E.164). */
export function formatE164Display(e164: string): string {
  if (!e164 || !e164.startsWith("+")) return e164;
  const digits = e164.slice(1);
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    const ddd = digits.slice(2, 4);
    const rest = digits.slice(4);
    const mid = rest.length === 9 ? rest.slice(0, 5) : rest.slice(0, 4);
    const tail = rest.length === 9 ? rest.slice(5) : rest.slice(4);
    return `+55 (${ddd}) ${mid}-${tail}`;
  }
  return e164;
}
