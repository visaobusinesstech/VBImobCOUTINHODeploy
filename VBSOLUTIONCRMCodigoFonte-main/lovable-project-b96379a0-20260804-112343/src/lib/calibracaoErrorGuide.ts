// Mapa canônico de erros da calibração da IA → mensagem amigável + orientação.
// Usado tanto para `data.error_code` (falhas de negócio, HTTP 200) quanto para
// mensagens capturadas via `Error.message`/`data.detalhe` (falhas técnicas).

export interface CalibracaoFriendlyError {
  code: string;
  title: string;
  description: string;
  checklist: string[];
  action?: { label: string; kind: "config_ia" | "ajustar_filtros" | "criar_dataset" | "rever_amostra" };
  severity: "warning" | "error";
}

const CODE_MAP: Record<string, Omit<CalibracaoFriendlyError, "code">> = {
  amostra_insuficiente: {
    title: "Amostra insuficiente para calibrar",
    description:
      "Encontramos menos de 5 imóveis rotulados no período/filtro atual. A IA precisa de exemplos positivos e negativos para aprender.",
    checklist: [
      "Aumente a janela de dias (ex.: 90 ou 180) para pegar mais registros.",
      "Remova filtros muito específicos de cidade/bairro/operação.",
      "Rotule mais proprietários como 'Frio/Morno/Quente' antes de rodar.",
      "Se estiver usando um dataset salvo, verifique se ele tem pelo menos 5 itens.",
    ],
    action: { label: "Rever filtros", kind: "ajustar_filtros" },
    severity: "warning",
  },
  dataset_nao_encontrado: {
    title: "Dataset não encontrado",
    description: "O dataset selecionado não existe mais ou pertence a outra imobiliária.",
    checklist: [
      "Selecione 'Amostra ao vivo' ou escolha outro dataset na lista.",
      "Se você excluiu o dataset, crie um novo snapshot com o botão 'Criar dataset'.",
    ],
    action: { label: "Criar novo dataset", kind: "criar_dataset" },
    severity: "warning",
  },
  no_ai_connected: {
    title: "IA não conectada",
    description: "Você ainda não configurou uma chave de IA (BYOK) para executar a calibração.",
    checklist: [
      "Acesse Configurações → Configurar IA e conecte uma chave válida (OpenAI, Gemini, Claude…).",
      "Depois de conectar, use o botão 'Testar conexão' para validar antes de calibrar.",
    ],
    action: { label: "Configurar IA", kind: "config_ia" },
    severity: "error",
  },
  invalid_provider_token: {
    title: "Chave da IA inválida ou expirada",
    description: "O provedor rejeitou sua chave (401/403). Ela pode ter sido revogada, expirada ou digitada incorretamente.",
    checklist: [
      "Verifique se a chave ainda está ativa no painel do provedor.",
      "Cole a chave novamente em Configurar IA e clique em Testar conexão.",
      "Se você tem rotação automática ativa, confirme se a nova chave foi salva.",
    ],
    action: { label: "Configurar IA", kind: "config_ia" },
    severity: "error",
  },
  invalid_token: {
    title: "Sessão expirada",
    description: "Sua sessão expirou durante a calibração.",
    checklist: ["Recarregue a página e faça login novamente."],
    severity: "error",
  },
  rate_limit: {
    title: "Limite do provedor de IA atingido",
    description: "O provedor devolveu rate-limit (429). Isso é temporário.",
    checklist: [
      "Aguarde 1–2 minutos e tente novamente.",
      "Reduza a amostra (ex.: de 100 para 40) ou o batch size (ex.: 4).",
      "Se persistir, veja no painel do provedor o limite de requisições/minuto do seu plano.",
    ],
    action: { label: "Reduzir amostra", kind: "rever_amostra" },
    severity: "warning",
  },
  provider_error: {
    title: "Provedor de IA retornou erro",
    description: "A chamada para a IA falhou no lado do provedor (5xx).",
    checklist: [
      "Tente novamente em alguns minutos.",
      "Se repetir com o mesmo padrão de erro, troque temporariamente o modelo em Configurar IA.",
    ],
    severity: "error",
  },
  schema_invalido: {
    title: "Dados de entrada incompletos",
    description:
      "Vários registros na amostra estão sem tipo de imóvel, título ou dados extraídos. A calibração ainda roda, mas com fallback.",
    checklist: [
      "Rode a extração de anúncios pendentes na aba 'Captação' para preencher os dados brutos.",
      "Verifique se os links de anúncio estão OK (a coluna 'status do link' precisa estar verde).",
    ],
    severity: "warning",
  },
};

// Padrões (regex) sobre mensagens técnicas quando não há `error_code`.
const PATTERN_MAP: { re: RegExp; code: keyof typeof CODE_MAP }[] = [
  { re: /rate.?limit|429|too many requests/i, code: "rate_limit" },
  { re: /401|unauthor|invalid.?api.?key|invalid.?token/i, code: "invalid_provider_token" },
  { re: /5\d\d|internal server error|bad gateway|service unavailable/i, code: "provider_error" },
  { re: /amostra|sample.*insufficient|precisa de pelo menos/i, code: "amostra_insuficiente" },
  { re: /dataset.*(n[aã]o encontrado|not found|inexistente)/i, code: "dataset_nao_encontrado" },
  { re: /timeout|timed out|abort/i, code: "provider_error" },
];

export function resolveCalibracaoError(input: {
  error_code?: string | null;
  message?: string | null;
  detalhe?: string | null;
}): CalibracaoFriendlyError {
  const code = input.error_code?.trim();
  if (code && CODE_MAP[code]) {
    return { code, ...CODE_MAP[code] };
  }

  const raw = `${input.message ?? ""} ${input.detalhe ?? ""}`.trim();
  if (raw) {
    for (const { re, code: c } of PATTERN_MAP) {
      if (re.test(raw)) return { code: c, ...CODE_MAP[c] };
    }
  }

  // Genérico
  return {
    code: code || "unknown",
    title: "A calibração falhou",
    description:
      raw ||
      "Não conseguimos concluir a calibração. Um log detalhado foi gravado no painel de Status & Histórico.",
    checklist: [
      "Confira se a IA está conectada em Configurar IA.",
      "Aumente a janela de dias e a amostra e tente novamente.",
      "Abra a aba 'Status & Histórico' → 'Falhas & recorrências' para ver o payload e o stack.",
    ],
    severity: "error",
  };
}
