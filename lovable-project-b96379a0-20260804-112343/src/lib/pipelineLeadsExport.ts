import { ESTAGIOS, type Lead } from "@/hooks/useLeads";

export const PIPELINE_PDF_COLUMNS = [
  { header: "Nome", dataKey: "nome" },
  { header: "Interesse", dataKey: "interesse" },
  { header: "Valor", dataKey: "valorFmt" },
  { header: "Estágio", dataKey: "estagioNome" },
  { header: "Corretor", dataKey: "corretor" },
  { header: "Telefone", dataKey: "telefone" },
  { header: "Email", dataKey: "email" },
] as const;

export const PIPELINE_CSV_COLUMNS = [
  { header: "Nome", key: "nome" },
  { header: "Estágio", key: "estagio" },
  { header: "Valor", key: "valor" },
  { header: "Corretor", key: "corretor" },
  { header: "Telefone", key: "telefone" },
  { header: "Email", key: "email" },
  { header: "Interesse", key: "interesse" },
  { header: "Bairro", key: "bairro" },
] as const;

export type PipelineExportFilters = {
  estagio?: string; // "todos" | id
  corretorId?: string; // "todos" | "__none__" | id
  corretorNome?: string;
  valorMin?: string | number;
  valorMax?: string | number;
  searchQuery?: string;
};

const estagioMap = () => Object.fromEntries(ESTAGIOS.map((e) => [e.id, e.title])) as Record<string, string>;
const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v || 0));

const isActiveEstagio = (id?: string) => !!id && id !== "todos";
const isActiveCorretor = (id?: string) => !!id && id !== "todos";
const asNumber = (v: unknown) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : NaN;
};

/**
 * Summary do PDF respeita o filtro por estágio: quando um estágio específico
 * está selecionado, apenas ele aparece no resumo (evita colunas zeradas).
 */
export function buildPipelinePdfSummary(
  filteredLeads: Pick<Lead, "estagio">[],
  filters: PipelineExportFilters = {},
) {
  const estagios = isActiveEstagio(filters.estagio)
    ? ESTAGIOS.filter((e) => e.id === filters.estagio)
    : ESTAGIOS;
  return estagios.map((e) => ({
    label: e.title,
    value: String(filteredLeads.filter((l) => l.estagio === e.id).length),
  }));
}

export function buildPipelinePdfRows(filteredLeads: Lead[]) {
  const map = estagioMap();
  return filteredLeads.map((l) => ({
    nome: l.nome,
    interesse: l.interesse || "—",
    valorFmt: fmtBRL(l.valor),
    estagioNome: map[l.estagio] || l.estagio,
    corretor: l.corretor_nome || "—",
    telefone: l.telefone || "—",
    email: l.email || "—",
  }));
}

export function buildPipelineCsvRows(filteredLeads: Lead[]) {
  const map = estagioMap();
  return filteredLeads.map((l) => ({
    nome: l.nome,
    estagio: map[l.estagio] || l.estagio,
    valor: l.valor,
    corretor: l.corretor_nome || "",
    telefone: l.telefone || "",
    email: l.email || "",
    interesse: l.interesse || "",
    bairro: l.bairro_interesse || "",
  }));
}

/**
 * Descreve os filtros ativos de forma legível — usada no subtítulo do PDF
 * para que o relatório exportado deixe claro o recorte aplicado na tela.
 */
export function describePipelineFilters(filters: PipelineExportFilters = {}): string[] {
  const map = estagioMap();
  const parts: string[] = [];
  if (isActiveEstagio(filters.estagio)) {
    parts.push(`Estágio: ${map[filters.estagio!] || filters.estagio}`);
  }
  if (isActiveCorretor(filters.corretorId)) {
    if (filters.corretorId === "__none__") parts.push("Corretor: sem atribuição");
    else parts.push(`Corretor: ${filters.corretorNome || filters.corretorId}`);
  }
  const min = asNumber(filters.valorMin);
  const max = asNumber(filters.valorMax);
  if (!isNaN(min)) parts.push(`Valor mín.: ${fmtBRL(min)}`);
  if (!isNaN(max)) parts.push(`Valor máx.: ${fmtBRL(max)}`);
  const q = (filters.searchQuery || "").trim();
  if (q) parts.push(`Busca: "${q}"`);
  return parts;
}

export function buildPipelineExportSubtitle(
  filteredLeads: Pick<Lead, "valor">[],
  filters: PipelineExportFilters = {},
): string {
  const total = filteredLeads.reduce((s, l) => s + Number(l.valor || 0), 0);
  const base = `${filteredLeads.length} leads · ${fmtBRL(total)} em pipeline`;
  const desc = describePipelineFilters(filters);
  return desc.length ? `${base} · Filtros: ${desc.join(" · ")}` : base;
}

/**
 * Slugifica os filtros no nome do arquivo para diferenciar exportações
 * com recortes distintos.
 */
export function buildPipelineExportFileName(
  prefix: string,
  filters: PipelineExportFilters = {},
  date: Date = new Date(),
): string {
  const iso = date.toISOString().split("T")[0];
  const map = estagioMap();
  const tags: string[] = [];
  if (isActiveEstagio(filters.estagio)) tags.push(slug(map[filters.estagio!] || filters.estagio!));
  if (isActiveCorretor(filters.corretorId)) {
    tags.push(filters.corretorId === "__none__" ? "sem-corretor" : slug(filters.corretorNome || "corretor"));
  }
  if ((filters.searchQuery || "").trim()) tags.push("busca");
  return [prefix, ...tags, iso].filter(Boolean).join("_");
}

function slug(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .toLowerCase()
    .slice(0, 40);
}
