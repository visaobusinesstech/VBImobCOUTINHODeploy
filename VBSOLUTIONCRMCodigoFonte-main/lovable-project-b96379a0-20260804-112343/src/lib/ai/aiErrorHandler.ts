import { toast } from "sonner";

export type AiErrorPayload = {
  success?: false;
  error_code?: string;
  message?: string;
  error?: string;
  config_url?: string;
};

/**
 * Handles standardized AI edge function errors.
 * Returns true if the payload was an AI error and was handled (toast shown).
 *
 * Contract (todas as edge functions de IA agora retornam HTTP 200 com este payload):
 * { success: false, error_code, message, config_url? }
 *
 * error_code:
 * - no_ai_connected        → CTA "Conectar minha IA"
 * - invalid_provider_token → CTA "Reconectar IA"
 * - invalid_token          → CTA "Reconectar IA"
 * - no_credits             → sem CTA
 * - rate_limited           → sem CTA
 * - network_error          → sem CTA
 * - unknown_error          → sem CTA
 */
export function handleAiError(
  data: any,
  invokeError: any,
  navigate?: (path: string) => void,
): boolean {
  // Erro de rede/edge (não conseguimos ler payload)
  if (invokeError && !data) {
    toast.error("Erro ao conectar com a IA", {
      description: "Não foi possível se conectar. Tente novamente.",
    });
    return true;
  }

  if (!data || data.success !== false || !data.error_code) return false;

  const code = data.error_code as string;
  const providerDetail = (data as any).provider_detail as string | undefined;
  const httpStatus = (data as any).http_status as number | undefined;
  const baseMessage = data.message || data.error || "Erro ao processar com a IA.";
  const message = providerDetail && providerDetail !== baseMessage
    ? `${baseMessage}${httpStatus ? ` (HTTP ${httpStatus})` : ""} — ${providerDetail}`
    : baseMessage;

  // Log técnico completo no console para diagnóstico.
  // eslint-disable-next-line no-console
  console.error("[AI error]", { code, http_status: httpStatus, provider_detail: providerDetail, raw: data });

  const needsConfig =
    code === "no_ai_connected" ||
    code === "invalid_provider_token" ||
    code === "invalid_token" ||
    code === "model_unavailable";
  // Sinaliza banner global (ByokBanner) sobre chave ausente/inválida.
  try {
    if (needsConfig) localStorage.setItem("byok:invalid", code);
  } catch { /* noop */ }
  const ctaLabel = code === "no_ai_connected" ? "Conectar minha IA" : "Reconectar IA";

  toast.error(message, {
    action: needsConfig
      ? {
          label: ctaLabel,
          onClick: () => {
            if (navigate) navigate(data.config_url || "/configurar-ia");
            else window.location.href = data.config_url || "/configurar-ia";
          },
        }
      : undefined,
    duration: needsConfig ? 8000 : 8000,
  });

  return true;
}
