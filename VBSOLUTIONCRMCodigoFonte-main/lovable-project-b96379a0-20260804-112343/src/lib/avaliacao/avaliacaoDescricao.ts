/**
 * Helpers de descrição do imóvel usados no fluxo de Avaliação (modos manual e por link).
 * Extraídos em módulo próprio para permitir testes de integração isolados,
 * garantindo que contador, limite de caracteres e resolução de manualImovel.descricao
 * se comportem exatamente como são usados em `src/pages/Avaliacao.tsx`.
 *
 * Contagem e truncamento são feitos por **code points Unicode** (após normalização NFC)
 * para evitar quebras com:
 *  - Colagens grandes (> DESCRICAO_MAX)
 *  - Emojis / pares substitutos UTF-16 (evita cortar no meio de um par)
 *  - Caracteres acentuados (á, ç, ã…) — normalizados para forma canônica
 *  - Espaços extras (\r\n do clipboard, tabs) — preservados 1:1 no estado
 */

export const DESCRICAO_MIN = 30;
export const DESCRICAO_MAX = 2000;
export const DESCRICAO_LIMITE_ALERTA = 1800;
export const DESCRICAO_TEXTAREA_ID = "avaliacao-descricao-textarea";

/**
 * Códigos estruturados devolvidos pela edge function `avaliacao-imovel`
 * ao bloquear o submit por descrição fora do limite. Devem espelhar 1:1
 * o backend (`supabase/functions/avaliacao-imovel/index.ts`) para que o
 * front-end consiga bloquear preventivamente com a MESMA carga de erro.
 */
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

export type ValidacaoDescricao = { valid: true; erro: null } | { valid: false; erro: string };

/** Normaliza para NFC (compõe acentos), preservando conteúdo visível. */
function normalizar(txt: string | null | undefined): string {
  const s = txt ?? "";
  try {
    return s.normalize("NFC");
  } catch {
    return s;
  }
}

/** Divide a string em code points reais, sem quebrar pares substitutos (emojis, etc). */
function toCodePoints(txt: string): string[] {
  return Array.from(txt);
}

/** Conta o comprimento visível (code points) exibido no contador 0/2000. */
export function contarDescricao(txt: string | null | undefined): number {
  return toCodePoints(normalizar(txt)).length;
}

/**
 * Aplica o limite máximo no onChange da textarea de forma segura:
 *  - Normaliza (NFC) para casar com a contagem.
 *  - Trunca por code points (não por code units UTF-16), evitando surrogates órfãos.
 *  - Sempre retorna string (aceita null/undefined em colagens vazias).
 */
export function truncarDescricao(next: string | null | undefined): string {
  const normalized = normalizar(next);
  const cps = toCodePoints(normalized);
  if (cps.length <= DESCRICAO_MAX) return normalized;
  return cps.slice(0, DESCRICAO_MAX).join("");
}

/** true quando o contador deve mudar de cor (próximo ou no limite). */
export function contadorEmAlerta(txt: string | null | undefined): boolean {
  return contarDescricao(txt) > DESCRICAO_LIMITE_ALERTA;
}

/** Formata o rótulo do contador ("123/2000") direto do estado atual. */
export function formatarContador(txt: string | null | undefined): string {
  return `${contarDescricao(txt)}/${DESCRICAO_MAX}`;
}

/** Valida a descrição para bloqueio de envio (contagem sempre em code points). */
export function validarDescricaoAvaliacao(txt: string | null | undefined): ValidacaoDescricao {
  const normalizado = normalizar(txt);
  const trimmed = normalizado.trim();
  const len = toCodePoints(trimmed).length;
  if (len === 0) {
    return {
      valid: false,
      erro: `Descrição do imóvel é obrigatória — faltam ${DESCRICAO_MIN} caracteres para atingir o mínimo (0/${DESCRICAO_MIN}).`,
    };
  }
  if (len < DESCRICAO_MIN) {
    const faltam = DESCRICAO_MIN - len;
    return {
      valid: false,
      erro: `Descrição abaixo do recomendado — faltam ${faltam} ${faltam === 1 ? "caractere" : "caracteres"} para atingir o mínimo (${len}/${DESCRICAO_MIN} caracteres mínimos).`,
    };
  }
  if (len > DESCRICAO_MAX) {
    const excedeu = len - DESCRICAO_MAX;
    return {
      valid: false,
      erro: `Descrição acima do limite — excedeu em ${excedeu} ${excedeu === 1 ? "caractere" : "caracteres"} o máximo permitido (${len}/${DESCRICAO_MAX} caracteres).`,
    };
  }
  return { valid: true, erro: null };
}

/**
 * Validação preventiva no front-end que devolve EXATAMENTE o mesmo
 * payload estruturado retornado pela edge function `avaliacao-imovel`
 * ao bloquear por descrição inválida (mesmos `code`, `message`, `field`
 * e métricas). Usado no gate de submit dos modos MANUAL e POR LINK
 * para evitar chamada de rede desnecessária e apresentar ao usuário
 * a mesma mensagem que o backend produziria.
 *
 * Retorna `null` quando a descrição é válida.
 */
export function validarDescricaoBackendShape(
  txt: string | null | undefined,
): DescricaoErroBackend | null {
  const normalizado = normalizar(txt);
  const trimmed = normalizado.trim();
  const len = toCodePoints(trimmed).length;

  const base = {
    field: "descricao" as const,
    descricao_length: len,
    descricao_min: DESCRICAO_MIN,
    descricao_max: DESCRICAO_MAX,
  };

  if (len === 0) {
    return {
      ...base,
      code: "DESCRICAO_OBRIGATORIA",
      error: `Descrição do imóvel é obrigatória (mínimo ${DESCRICAO_MIN} caracteres).`,
    };
  }
  if (len < DESCRICAO_MIN) {
    return {
      ...base,
      code: "DESCRICAO_ABAIXO_MINIMO",
      error: `Descrição abaixo do recomendado (${len}/${DESCRICAO_MIN} caracteres mínimos).`,
    };
  }
  if (len > DESCRICAO_MAX) {
    return {
      ...base,
      code: "DESCRICAO_ACIMA_MAXIMO",
      error: `Descrição acima do limite (${len}/${DESCRICAO_MAX} caracteres).`,
    };
  }
  return null;
}

/**
 * Resolve o valor final de `manualImovel.descricao` conforme regra da página:
 * - Se o usuário digitou algo (após trim), usa a descrição manual normalizada.
 * - Senão, no modo por link, usa a descrição extraída (dadosExtraidos.descricao).
 * - Fora do modo por link e sem texto manual, retorna null.
 */
export function resolveManualImovelDescricao(
  manualDescricao: string | null | undefined,
  modoLink: boolean,
  dadosExtraidosDescricao: string | null | undefined,
): string | null {
  const manualTrim = normalizar(manualDescricao).trim();
  if (manualTrim.length > 0) return manualTrim;
  if (modoLink) return dadosExtraidosDescricao ?? null;
  return null;
}

/**
 * Valor que deve ir para a coluna `descricao` de `avaliacoes_historico`
 * ao SALVAR (insert) ou ATUALIZAR (update) uma avaliação.
 * Aceita o `selectedImovel.descricao` resolvido; devolve null se vazio.
 */
export function descricaoParaPersistencia(descricao: string | null | undefined): string | null {
  const t = normalizar(descricao).trim();
  return t.length > 0 ? t : null;
}

/**
 * Valor que deve preencher `manual.descricao` ao RECARREGAR uma avaliação
 * do histórico. Sempre string (nunca null) para não quebrar o `value` da textarea.
 */
export function descricaoParaFormulario(descricao: string | null | undefined): string {
  return normalizar(descricao);
}

/**
 * Foca e rola até a textarea de descrição do imóvel.
 * Usado pelo gate de bloqueio no submit para chamar a atenção do usuário
 * quando a descrição está fora dos limites (vazia, < min ou > max).
 * Retorna `true` quando o elemento foi encontrado e focado, `false` caso contrário
 * — permite testar o comportamento de forma determinística.
 */
export function focusDescricaoTextarea(delayMs = 50): Promise<boolean> {
  return new Promise((resolve) => {
    const run = () => {
      if (typeof document === "undefined") return resolve(false);
      const el = document.getElementById(DESCRICAO_TEXTAREA_ID) as HTMLTextAreaElement | null;
      if (!el) return resolve(false);
      try {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      } catch {
        /* jsdom pode não implementar scrollIntoView — ignoramos */
      }
      try {
        el.focus({ preventScroll: true });
      } catch {
        el.focus();
      }
      resolve(true);
    };
    if (delayMs > 0) setTimeout(run, delayMs);
    else run();
  });
}


