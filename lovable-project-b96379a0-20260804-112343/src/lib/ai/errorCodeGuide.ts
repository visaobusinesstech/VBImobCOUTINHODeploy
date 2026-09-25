/**
 * Guia canônico de mensagens para `error_code` retornados pelas Edge Functions
 * de IA / extração. Usado para exibir, na própria tela do anúncio, uma
 * explicação clara + instruções de correção + CTA.
 */

export type ErrorGuide = {
  title: string;
  instruction: string;
  cta?: { label: string; href: string };
  severity?: "info" | "warn" | "error";
};

const CONFIG_IA: ErrorGuide["cta"] = { label: "Configurar minha IA", href: "/configurar-ia" };
const RECONECTAR_IA: ErrorGuide["cta"] = { label: "Reconectar IA", href: "/configurar-ia" };
const UPGRADE: ErrorGuide["cta"] = { label: "Ver planos", href: "/planos" };

const GUIDES: Record<string, ErrorGuide> = {
  no_ai_connected: {
    title: "Nenhuma IA conectada",
    instruction:
      "Conecte sua chave de IA (Gemini, OpenAI ou Anthropic) para habilitar a extração e a avaliação automática.",
    cta: CONFIG_IA,
    severity: "warn",
  },
  invalid_provider_token: {
    title: "Chave de IA inválida",
    instruction:
      "Sua chave foi rejeitada pelo provedor. Gere uma nova chave no painel da IA (Google AI Studio / OpenAI / Anthropic) e cole novamente em Configurar IA.",
    cta: RECONECTAR_IA,
    severity: "error",
  },
  invalid_token: {
    title: "Chave de IA inválida",
    instruction:
      "A chave configurada não é aceita mais. Reconecte a IA com uma chave válida para continuar.",
    cta: RECONECTAR_IA,
    severity: "error",
  },
  IA_CHAVE_INVALIDA: {
    title: "Chave de IA inválida",
    instruction:
      "A chave configurada não é aceita mais. Reconecte a IA com uma chave válida para continuar.",
    cta: RECONECTAR_IA,
    severity: "error",
  },
  no_credits: {
    title: "Sem créditos no provedor de IA",
    instruction:
      "Sua conta da IA (Gemini/OpenAI/Anthropic) está sem créditos. Recarregue no painel do provedor ou troque a chave em Configurar IA.",
    cta: CONFIG_IA,
    severity: "error",
  },
  rate_limited: {
    title: "Limite de requisições atingido",
    instruction:
      "O provedor de IA aplicou rate-limit temporário. Aguarde 30–60 segundos e tente novamente. Se persistir, reduza a frequência de importações em lote.",
    severity: "warn",
  },
  model_unavailable: {
    title: "Modelo indisponível",
    instruction:
      "O modelo selecionado está fora do ar ou não é liberado para sua chave. Troque o modelo em Configurar IA (ex.: gemini-1.5-flash ou gpt-4o-mini).",
    cta: CONFIG_IA,
    severity: "warn",
  },
  network_error: {
    title: "Falha de rede com o provedor de IA",
    instruction:
      "Não conseguimos falar com o provedor. Verifique sua conexão e tente novamente em alguns segundos.",
    severity: "warn",
  },
  provider_error: {
    title: "Erro do provedor de IA",
    instruction:
      "O provedor devolveu um erro inesperado. Tente novamente; se persistir, gere uma nova chave e reconecte.",
    cta: RECONECTAR_IA,
    severity: "error",
  },
  upstream_error: {
    title: "Portal do anúncio indisponível",
    instruction:
      "O site do anúncio respondeu com erro (502/503). Aguarde alguns minutos e tente novamente, ou abra o link no navegador para confirmar que está online.",
    severity: "warn",
  },
  limit_reached: {
    title: "Limite do plano atingido",
    instruction:
      "Você atingiu o limite diário de extrações do seu plano. Faça upgrade ou aguarde o próximo ciclo.",
    cta: UPGRADE,
    severity: "warn",
  },
};

// Prefixos usados pelo extractor (`stage_<stage>_<httpStatus>`)
function matchByStagePrefix(code: string): ErrorGuide | undefined {
  if (!code.startsWith("stage_")) return undefined;
  const parts = code.split("_");
  const status = Number(parts[parts.length - 1]);
  if (status === 402) return GUIDES.no_credits;
  if (status === 401) return GUIDES.invalid_provider_token;
  if (status === 403) return GUIDES.limit_reached;
  if (status === 429) return GUIDES.rate_limited;
  if (status === 502 || status === 503 || status === 504) return GUIDES.upstream_error;
  if (status === 422) {
    return {
      title: "Dados insuficientes no anúncio",
      instruction:
        "Não foi possível ler área, preço ou fotos deste anúncio. Tente outro link do mesmo imóvel ou preencha os campos manualmente.",
      severity: "warn",
    };
  }
  return undefined;
}

export function getErrorCodeGuide(errorCode?: string | null): ErrorGuide | null {
  if (!errorCode) return null;
  return GUIDES[errorCode] ?? matchByStagePrefix(errorCode) ?? null;
}
