/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Helpers puros do canal Indicação — paridade Lovable captacaoIndicacao.
 */

export type CaptacaoLike = {
  tipo?: string | null;
  status?: string | null;
  observacoes?: string | null;
};

export const CAPTACAO_TIPOS = [
  "porteiro",
  "construtor",
  "construtora",
  "sindico",
  "indicacao"
] as const;

export const CAPTACAO_STATUSES = [
  "pendente",
  "em_andamento",
  "concluida",
  "cancelada"
] as const;

export const CAPTACAO_TIPOS_IMOVEL = [
  "Apartamento",
  "Casa",
  "Terreno",
  "Comercial",
  "Cobertura",
  "Kitnet",
  "Galpão",
  "Sala Comercial",
  "Loja",
  "Flat",
  "Sobrado",
  "Chácara",
  "Fazenda",
  "Ponto Comercial",
  "Prédio",
  "Conjunto de Salas"
] as const;

export const CAPTACAO_OPERACOES = ["Venda", "Locação"] as const;

const INDICADO_POR_RE = /^Indicado por:\s*(.+)/;

export function extractIndicadoPor(observacoes?: string | null): string | null {
  const m = (observacoes || "").match(INDICADO_POR_RE);
  if (!m) return null;
  const value = m[1].split("\n")[0].trim();
  return value || null;
}

export function stripIndicadoPor(observacoes?: string | null): string {
  return (observacoes || "").replace(/^Indicado por:.*\n?/, "");
}

export function buildObservacoes(
  tipo: string,
  indicadoPor: string,
  obs: string
): string | null {
  if (tipo === "indicacao" && indicadoPor.trim()) {
    const rest = obs?.trim() ? `\n${obs}` : "";
    return `Indicado por: ${indicadoPor.trim()}${rest}`;
  }
  return obs?.trim() ? obs : null;
}

export function isCaptacaoSubmittable(params: {
  tipo: string;
  nome: string;
  indicadoPor?: string;
}): boolean {
  if (!params.nome.trim()) return false;
  if (params.tipo === "indicacao" && !(params.indicadoPor || "").trim()) {
    return false;
  }
  return true;
}

export type CaptacaoKpis = {
  total: number;
  pendentes: number;
  andamento: number;
  concluidas: number;
  indicacoes: number;
  taxa: number;
};

export function computeCaptacaoKpis(list: CaptacaoLike[]): CaptacaoKpis {
  const total = list.length;
  const pendentes = list.filter(c => c.status === "pendente").length;
  const andamento = list.filter(c => c.status === "em_andamento").length;
  const concluidas = list.filter(c => c.status === "concluida").length;
  const indicacoes = list.filter(c => c.tipo === "indicacao").length;
  const taxa = total > 0 ? Math.round((concluidas / total) * 100) : 0;
  return { total, pendentes, andamento, concluidas, indicacoes, taxa };
}

export function isValidCaptacaoTipo(tipo: unknown): boolean {
  return CAPTACAO_TIPOS.includes(String(tipo || "") as any);
}

/**
 * Mapeia formulário/body → campos persistidos (paridade Lovable CaptacaoFormDialog).
 * cep e aceitaCorretor são UI-only e não entram aqui.
 */
export function buildCaptacaoSavePayload(
  form: {
    tipo?: string | null;
    nomeContato?: string | null;
    telefoneContato?: string | null;
    emailContato?: string | null;
    enderecoImovel?: string | null;
    bairro?: string | null;
    cidade?: string | null;
    estado?: string | null;
    tipoImovel?: string | null;
    operacao?: string | null;
    nomeConstrutora?: string | null;
    nomeCondominio?: string | null;
    indicadoPor?: string | null;
    observacoes?: string | null;
    status?: string | null;
  },
  activeTipo?: string
): Record<string, any> {
  const tipo = String(form?.tipo || activeTipo || "porteiro")
    .trim()
    .toLowerCase();
  const obsFinal = buildObservacoes(
    tipo,
    form?.indicadoPor || "",
    form?.observacoes || ""
  );
  return {
    tipo,
    nomeContato: String(form?.nomeContato || "").trim(),
    telefoneContato: form?.telefoneContato || null,
    emailContato: form?.emailContato || null,
    enderecoImovel: form?.enderecoImovel || null,
    bairro: form?.bairro || null,
    cidade: form?.cidade || null,
    estado: form?.estado || "SP",
    tipoImovel: form?.tipoImovel || "Apartamento",
    operacao: form?.operacao || "Venda",
    nomeConstrutora: form?.nomeConstrutora || null,
    nomeCondominio: form?.nomeCondominio || null,
    observacoes: obsFinal,
    status: form?.status || "pendente"
  };
}
