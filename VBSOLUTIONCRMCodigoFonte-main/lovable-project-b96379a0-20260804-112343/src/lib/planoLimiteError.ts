/**
 * Traduz erros de limite de plano lançados pelos gatilhos do banco
 * (`enforce_plano_limite`) em mensagens amigáveis para o usuário.
 *
 * O enforcement é feito no servidor — o front apenas apresenta o motivo.
 */
export type PlanoLimiteInfo = {
  isLimite: boolean;
  titulo: string;
  descricao: string;
};

const RECURSO_LABEL: Record<string, string> = {
  imoveis: "imóveis",
  leads: "leads",
  corretores: "corretores",
};

export function parsePlanoLimiteError(error: unknown): PlanoLimiteInfo {
  const message =
    typeof error === "string"
      ? error
      : ((error as { message?: string } | null)?.message ?? "");

  if (!message.includes("Limite do plano atingido")) {
    return { isLimite: false, titulo: "", descricao: message };
  }

  const match = message.match(
    /Limite do plano atingido:\s*(\d+)\s*de\s*(\d+)\s*(\w+)\s*permitidos no plano\s*([\w-]+)/i,
  );

  const recurso = match ? (RECURSO_LABEL[match[3]] ?? match[3]) : "registros";
  const limite = match?.[2];

  return {
    isLimite: true,
    titulo: "Limite do plano atingido",
    descricao: limite
      ? `Seu plano permite até ${limite} ${recurso}. Faça upgrade para cadastrar mais.`
      : `Você atingiu o limite de ${recurso} do seu plano. Faça upgrade para continuar.`,
  };
}

/** Mensagem pronta para toasts: usa o texto amigável quando for limite de plano. */
export function mensagemErroComLimite(error: unknown, fallbackTitulo: string) {
  const info = parsePlanoLimiteError(error);
  return info.isLimite
    ? { title: info.titulo, description: info.descricao }
    : { title: fallbackTitulo, description: info.descricao };
}
