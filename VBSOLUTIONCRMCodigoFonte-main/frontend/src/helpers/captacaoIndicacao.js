/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Helpers puros do canal Indicação — paridade Lovable captacaoIndicacao.
 */

export const CAPTACAO_TIPOS = [
  { id: "porteiro", label: "Porteiro" },
  { id: "construtor", label: "Construtor" },
  { id: "construtora", label: "Construtora" },
  { id: "sindico", label: "Síndico" },
  { id: "indicacao", label: "Indicação" },
];

export const CAPTACAO_STATUS_OPTIONS = [
  { id: "pendente", label: "Pendente" },
  { id: "em_andamento", label: "Em andamento" },
  { id: "concluida", label: "Concluída" },
  { id: "cancelada", label: "Cancelada" },
];

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
  "Conjunto de Salas",
];

export const CAPTACAO_OPERACOES = ["Venda", "Locação"];

const INDICADO_POR_RE = /^Indicado por:\s*(.+)/;

/** Extract the "Indicado por" name from observacoes (first line). */
export function extractIndicadoPor(observacoes) {
  const m = (observacoes || "").match(INDICADO_POR_RE);
  if (!m) return null;
  const value = m[1].split("\n")[0].trim();
  return value || null;
}

/** Return the observacoes without the "Indicado por: ..." line. */
export function stripIndicadoPor(observacoes) {
  return (observacoes || "").replace(/^Indicado por:.*\n?/, "");
}

/** Build the observacoes string persisted in DB for a capture of any tipo. */
export function buildObservacoes(tipo, indicadoPor, obs) {
  if (tipo === "indicacao" && String(indicadoPor || "").trim()) {
    const rest = obs?.trim() ? `\n${obs}` : "";
    return `Indicado por: ${String(indicadoPor).trim()}${rest}`;
  }
  return obs?.trim() ? obs : null;
}

/** Validate the submit button state for a capture. */
export function isCaptacaoSubmittable({ tipo, nome, indicadoPor }) {
  if (!String(nome || "").trim()) return false;
  if (tipo === "indicacao" && !String(indicadoPor || "").trim()) return false;
  return true;
}

/** Compute KPI strip values from a list of captacoes. */
export function computeCaptacaoKpis(list) {
  const arr = Array.isArray(list) ? list : [];
  const total = arr.length;
  const pendentes = arr.filter((c) => c.status === "pendente").length;
  const andamento = arr.filter((c) => c.status === "em_andamento").length;
  const concluidas = arr.filter((c) => c.status === "concluida").length;
  const indicacoes = arr.filter((c) => c.tipo === "indicacao").length;
  const taxa = total > 0 ? Math.round((concluidas / total) * 100) : 0;
  return { total, pendentes, andamento, concluidas, indicacoes, taxa };
}

/**
 * Mapeia o formulário VB → payload da API (paridade Lovable CaptacaoFormDialog.handleSubmit).
 * Campos UI-only NÃO entram: cep, aceitaCorretor.
 * Snake_case Lovable ↔ camelCase VB:
 *   nome_contato→nomeContato, telefone_contato→telefoneContato, email_contato→emailContato,
 *   endereco_imovel→enderecoImovel, tipo_imovel→tipoImovel,
 *   nome_construtora→nomeConstrutora, nome_condominio→nomeCondominio
 */
export function buildCaptacaoSavePayload(form, activeTipo) {
  const tipo = String(form?.tipo || activeTipo || "porteiro").trim().toLowerCase();
  const obsFinal = buildObservacoes(tipo, form?.indicadoPor || "", form?.observacoes || "");
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
    // Lovable sempre envia estes campos (null se vazio), independente do canal
    nomeConstrutora: form?.nomeConstrutora || null,
    nomeCondominio: form?.nomeCondominio || null,
    observacoes: obsFinal,
    status: form?.status || "pendente",
  };
}

/** Hidrata o formulário a partir de um registro da API (edit). */
export function captacaoRecordToForm(item, fallbackTipo = "porteiro") {
  return {
    tipo: item?.tipo || fallbackTipo,
    nomeContato: item?.nomeContato || "",
    telefoneContato: item?.telefoneContato || "",
    emailContato: item?.emailContato || "",
    cep: "",
    enderecoImovel: item?.enderecoImovel || "",
    bairro: item?.bairro || "",
    cidade: item?.cidade || "",
    estado: item?.estado || "SP",
    tipoImovel: item?.tipoImovel || "Apartamento",
    operacao: item?.operacao || "Venda",
    nomeConstrutora: item?.nomeConstrutora || "",
    nomeCondominio: item?.nomeCondominio || "",
    indicadoPor: extractIndicadoPor(item?.observacoes) || "",
    aceitaCorretor: false,
    observacoes: stripIndicadoPor(item?.observacoes),
    status: item?.status || "pendente",
  };
}

/** Ranking por canal — aceita Locação e alias Aluguel (bug histórico Lovable). */
export function rankCaptacaoByOperacao(captacoes, operacao, tipos = CAPTACAO_TIPOS) {
  const ops =
    operacao === "Locação" || operacao === "Aluguel"
      ? new Set(["Locação", "Aluguel"])
      : new Set([operacao]);
  const map = new Map();
  (Array.isArray(captacoes) ? captacoes : [])
    .filter((c) => ops.has(c.operacao))
    .forEach((c) => {
      const canal = tipos.find((t) => t.id === c.tipo)?.label || c.tipo;
      map.set(canal, (map.get(canal) || 0) + 1);
    });
  return Array.from(map.entries())
    .map(([canal, count]) => ({ canal, count }))
    .sort((a, b) => b.count - a.count);
}
