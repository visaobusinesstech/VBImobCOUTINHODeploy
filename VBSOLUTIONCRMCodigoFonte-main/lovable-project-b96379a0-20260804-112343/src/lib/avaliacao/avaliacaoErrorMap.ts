/**
 * Mapa canônico de códigos de erro devolvidos pela edge function
 * `avaliacao-imovel` (e correlatas) para mensagens legíveis em pt-BR.
 *
 * Regra de ouro (usada por `resolveBackendErrorMessage`):
 *   1. Se o backend devolveu `error` (string não vazia) → usa VERBATIM.
 *   2. Senão, se veio `code` conhecido → usa `AVALIACAO_ERROR_MESSAGES[code]`.
 *   3. Senão → usa o fallback fornecido pelo chamador.
 *
 * Isso garante que qualquer refinamento de mensagem no backend apareça
 * automaticamente no toast e no painel de erro do front-end, sem duplicar
 * cópias, e mantém uma mensagem previsível quando só o `code` chegar.
 */

export const AVALIACAO_ERROR_MESSAGES = {
  // Descrição
  DESCRICAO_OBRIGATORIA: "Descrição do imóvel é obrigatória (mínimo 30 caracteres).",
  DESCRICAO_ABAIXO_MINIMO: "Descrição abaixo do recomendado (mínimo 30 caracteres).",
  DESCRICAO_ACIMA_MAXIMO: "Descrição acima do limite (máximo 2000 caracteres).",
  // Autenticação / conta
  NAO_AUTORIZADO: "Sessão inválida ou expirada. Faça login novamente.",
  CONTA_NAO_APROVADA: "Sua conta ainda não foi aprovada pelo administrador.",
  // Cotas / plano
  LIMITE_ATINGIDO: "Limite de avaliações do seu plano atingido. Faça upgrade para continuar.",
  // Genéricos
  ERRO_INTERNO: "Erro interno ao gerar a avaliação. Tente novamente em instantes.",
  TIMEOUT_UPSTREAM: "O servidor de IA demorou muito para responder ou está instável.",
} as const;

export type AvaliacaoErrorCode = keyof typeof AVALIACAO_ERROR_MESSAGES;

export type BackendErrorPayload = {
  error?: unknown;
  code?: unknown;
  [key: string]: unknown;
};

/**
 * Retorna a mensagem final a exibir no toast / painel de erro.
 * SEMPRE prioriza o texto vindo do backend quando existir e for string
 * não vazia — evita divergência entre o que a edge function comunica e
 * o que o usuário vê.
 */
export function resolveBackendErrorMessage(
  payload: BackendErrorPayload | null | undefined,
  fallback: string,
): string {
  const rawError = payload?.error;
  if (typeof rawError === "string") {
    const trimmed = rawError.trim();
    if (trimmed.length > 0) return trimmed;
  }
  const rawCode = payload?.code;
  if (typeof rawCode === "string" && rawCode in AVALIACAO_ERROR_MESSAGES) {
    return AVALIACAO_ERROR_MESSAGES[rawCode as AvaliacaoErrorCode];
  }
  return fallback;
}

/** true quando `code` está no dicionário canônico. */
export function isKnownAvaliacaoErrorCode(code: unknown): code is AvaliacaoErrorCode {
  return typeof code === "string" && code in AVALIACAO_ERROR_MESSAGES;
}
