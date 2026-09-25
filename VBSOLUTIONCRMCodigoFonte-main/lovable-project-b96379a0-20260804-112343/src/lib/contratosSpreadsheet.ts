import { read, utils } from "xlsx";

import { CANAIS_ORIGEM, getCanalLabel } from "@/lib/canaisOrigem";
import type { Contrato } from "@/hooks/useContratos";

type ImportableContratoField =
  | "titulo"
  | "cliente"
  | "tipo"
  | "status"
  | "valor"
  | "comissao_percentual"
  | "comissao_valor"
  | "data_inicio"
  | "data_fim"
  | "proprietario"
  | "proprietario_telefone"
  | "proprietario_cpf"
  | "proprietario_email"
  | "proprietario_rg"
  | "proprietario_banco"
  | "proprietario_agencia"
  | "proprietario_conta"
  | "proprietario_pix"
  | "corretor_nome"
  | "corretor_comissao_valor"
  | "inquilino"
  | "inquilino_telefone"
  | "inquilino_cpf"
  | "inquilino_email"
  | "inquilino_rg"
  | "inquilino2_nome"
  | "inquilino2_telefone"
  | "inquilino2_cpf"
  | "inquilino2_email"
  | "inquilino2_rg"
  | "parceiro_nome"
  | "parceiro_comissao_valor"
  | "captador_nome"
  | "captador_comissao_valor"
  | "matricula"
  | "numero_unidade"
  | "canal_origem"
  | "cliente_telefone"
  | "cliente_cpf"
  | "cliente_email"
  | "cliente_rg"
  | "observacoes";

type SpreadsheetColumn = {
  header: string;
  key: ImportableContratoField;
};

type ParsedContratoImport = {
  items: Partial<Contrato>[];
  errors: string[];
};

const STATUS_LABELS: Record<string, string> = {
  rascunho: "Rascunho",
  aguardando: "Aguardando Assinatura",
  assinado: "Assinado",
  ativo: "Ativo",
  inativo: "Inativo",
  vencendo: "Vencendo",
  cancelado: "Cancelado",
};

const STATUS_BY_NORMALIZED_VALUE: Record<string, string> = {
  ativo: "ativo",
  assinado: "assinado",
  inativo: "inativo",
  aguardando: "aguardando",
  aguardando_assinatura: "aguardando",
  rascunho: "rascunho",
  vencendo: "vencendo",
  cancelado: "cancelado",
};

const FIELD_ALIASES: Record<ImportableContratoField, string[]> = {
  titulo: ["Título", "Titulo", "titulo"],
  cliente: ["cliente"],
  tipo: ["tipo"],
  status: ["status", "situação", "situacao"],
  valor: ["valor", "valor r$", "valor brl"],
  comissao_percentual: ["Comissão %", "comissao %", "comissao", "comissao percentual", "comissao pct"],
  comissao_valor: ["Comissão R$", "comissao r$", "comissao valor", "comissao reais"],
  data_inicio: ["Início", "Inicio", "data inicio", "data início", "data_inicio"],
  data_fim: ["Fim", "data fim", "data_fim"],
  proprietario: ["Proprietário", "proprietario"],
  proprietario_telefone: ["Tel Proprietário", "telefone proprietário", "telefone proprietario", "proprietario telefone"],
  proprietario_cpf: ["CPF Proprietário", "cpf proprietario", "proprietario cpf"],
  proprietario_email: ["Email Proprietário", "email proprietario", "proprietario email"],
  proprietario_rg: ["RG Proprietário", "rg proprietario", "proprietario rg"],
  proprietario_banco: ["Banco Proprietário", "banco proprietario", "proprietario banco", "banco"],
  proprietario_agencia: ["Agência Proprietário", "agencia proprietario", "proprietario agencia", "agencia"],
  proprietario_conta: ["Conta Proprietário", "conta proprietario", "proprietario conta", "conta"],
  proprietario_pix: ["PIX Proprietário", "pix proprietario", "proprietario pix", "pix"],
  corretor_nome: ["Corretor", "corretor nome"],
  corretor_comissao_valor: ["Comissão Corretor R$", "comissao corretor r$", "corretor comissao valor"],
  inquilino: ["inquilino"],
  inquilino_telefone: ["Tel Inquilino", "telefone inquilino", "inquilino telefone"],
  inquilino_cpf: ["CPF Inquilino", "inquilino cpf"],
  inquilino_email: ["Email Inquilino", "inquilino email"],
  inquilino_rg: ["RG Inquilino", "inquilino rg"],
  inquilino2_nome: ["Inquilino 2", "inquilino2", "inquilino 02"],
  inquilino2_telefone: ["Tel Inquilino 2", "telefone inquilino 2", "inquilino2 telefone"],
  inquilino2_cpf: ["CPF Inquilino 2", "inquilino2 cpf"],
  inquilino2_email: ["Email Inquilino 2", "inquilino2 email"],
  inquilino2_rg: ["RG Inquilino 2", "inquilino2 rg"],
  parceiro_nome: ["Parceiro", "parceiro nome"],
  parceiro_comissao_valor: ["Comissão Parceiro R$", "comissao parceiro r$", "parceiro comissao valor"],
  captador_nome: ["Captador", "captador nome"],
  captador_comissao_valor: ["Comissão Captador R$", "comissao captador r$", "captador comissao valor"],
  matricula: ["Matrícula", "matricula"],
  numero_unidade: ["Unidade", "numero unidade", "número unidade", "numero_unidade"],
  canal_origem: ["Canal Origem", "canal origem", "canal", "origem"],
  cliente_telefone: ["Tel Cliente", "telefone cliente", "cliente telefone"],
  cliente_cpf: ["CPF Cliente", "cliente cpf"],
  cliente_email: ["Email Cliente", "cliente email"],
  cliente_rg: ["RG Cliente", "cliente rg"],
  observacoes: ["Observações", "observacoes", "obs"],
};

const NUMBER_FIELDS = new Set<ImportableContratoField>([
  "valor",
  "comissao_percentual",
  "comissao_valor",
  "corretor_comissao_valor",
  "parceiro_comissao_valor",
  "captador_comissao_valor",
]);

const DATE_FIELDS = new Set<ImportableContratoField>(["data_inicio", "data_fim"]);

const normalizeColumnName = (value: string) =>
  value
    .replace(/^\uFEFF/, "")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");

const FIELD_BY_ALIAS = Object.entries(FIELD_ALIASES).reduce<Record<string, ImportableContratoField>>((acc, [field, aliases]) => {
  aliases.forEach((alias) => {
    acc[normalizeColumnName(alias)] = field as ImportableContratoField;
  });
  return acc;
}, {});

const POSITIONAL_FIELDS = Object.keys(FIELD_ALIASES) as ImportableContratoField[];

export const CONTRATO_EXPORT_COLUMNS: SpreadsheetColumn[] = [
  { header: "Título", key: "titulo" },
  { header: "Cliente", key: "cliente" },
  { header: "Tipo", key: "tipo" },
  { header: "Status", key: "status" },
  { header: "Valor", key: "valor" },
  { header: "Comissão %", key: "comissao_percentual" },
  { header: "Comissão R$", key: "comissao_valor" },
  { header: "Início", key: "data_inicio" },
  { header: "Fim", key: "data_fim" },
  { header: "Proprietário", key: "proprietario" },
  { header: "Tel Proprietário", key: "proprietario_telefone" },
  { header: "CPF Proprietário", key: "proprietario_cpf" },
  { header: "Email Proprietário", key: "proprietario_email" },
  { header: "RG Proprietário", key: "proprietario_rg" },
  { header: "Banco Proprietário", key: "proprietario_banco" },
  { header: "Agência Proprietário", key: "proprietario_agencia" },
  { header: "Conta Proprietário", key: "proprietario_conta" },
  { header: "PIX Proprietário", key: "proprietario_pix" },
  { header: "Corretor", key: "corretor_nome" },
  { header: "Comissão Corretor R$", key: "corretor_comissao_valor" },
  { header: "Inquilino", key: "inquilino" },
  { header: "Tel Inquilino", key: "inquilino_telefone" },
  { header: "CPF Inquilino", key: "inquilino_cpf" },
  { header: "Email Inquilino", key: "inquilino_email" },
  { header: "RG Inquilino", key: "inquilino_rg" },
  { header: "Inquilino 2", key: "inquilino2_nome" },
  { header: "Tel Inquilino 2", key: "inquilino2_telefone" },
  { header: "CPF Inquilino 2", key: "inquilino2_cpf" },
  { header: "Email Inquilino 2", key: "inquilino2_email" },
  { header: "RG Inquilino 2", key: "inquilino2_rg" },
  { header: "Parceiro", key: "parceiro_nome" },
  { header: "Comissão Parceiro R$", key: "parceiro_comissao_valor" },
  { header: "Captador", key: "captador_nome" },
  { header: "Comissão Captador R$", key: "captador_comissao_valor" },
  { header: "Matrícula", key: "matricula" },
  { header: "Unidade", key: "numero_unidade" },
  { header: "Canal Origem", key: "canal_origem" },
  { header: "Tel Cliente", key: "cliente_telefone" },
  { header: "CPF Cliente", key: "cliente_cpf" },
  { header: "Email Cliente", key: "cliente_email" },
  { header: "RG Cliente", key: "cliente_rg" },
  { header: "Observações", key: "observacoes" },
];

const isBlankValue = (value: unknown) => {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" || trimmed === "—" || trimmed === "-";
  }
  return false;
};

const parseDate = (value: unknown): string | null => {
  if (isBlankValue(value)) return null;

  if (typeof value === "number") {
    const parsed = new Date((value - 25569) * 86400 * 1000);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().split("T")[0];
  }

  const raw = String(value).trim();
  const brMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (brMatch) {
    return `${brMatch[3]}-${brMatch[2].padStart(2, "0")}-${brMatch[1].padStart(2, "0")}`;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().split("T")[0];
};

const parseNumber = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (isBlankValue(value)) return 0;

  const cleaned = String(value).replace(/[^\d,.-]/g, "").trim();
  if (!cleaned) return 0;

  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");

  if (hasComma && hasDot) {
    if (cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")) {
      const parsed = Number(cleaned.replace(/\./g, "").replace(",", "."));
      return Number.isFinite(parsed) ? parsed : 0;
    }

    const parsed = Number(cleaned.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  const parsed = Number(hasComma ? cleaned.replace(",", ".") : cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseTipo = (value: unknown): string => {
  const raw = String(value || "").trim();
  const normalized = normalizeColumnName(raw);

  if (normalized.includes("loca") || normalized.includes("aluguel")) return "Locação";
  if (normalized.includes("admin")) return "Administração";
  if (normalized.includes("exclus")) return "Exclusividade";
  if (normalized.includes("vend")) return "Venda";

  return raw || "Venda";
};

const parseStatus = (value: unknown): string => {
  const normalized = normalizeColumnName(String(value || ""));
  return STATUS_BY_NORMALIZED_VALUE[normalized] || "rascunho";
};

const parseCanalOrigem = (value: unknown): string => {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const normalized = normalizeColumnName(raw);
  const canal = CANAIS_ORIGEM.find(
    (item) => item.id === normalized || normalizeColumnName(item.label) === normalized,
  );

  return canal?.id || raw;
};

const normalizeFieldValue = (field: ImportableContratoField, value: unknown) => {
  if (NUMBER_FIELDS.has(field)) return parseNumber(value);
  if (DATE_FIELDS.has(field)) return parseDate(value);
  if (field === "tipo") return parseTipo(value);
  if (field === "status") return parseStatus(value);
  if (field === "canal_origem") return parseCanalOrigem(value);

  return String(value).trim();
};

const normalizeContratoColumn = (column: string): ImportableContratoField | null => {
  const normalized = normalizeColumnName(column);
  return FIELD_BY_ALIAS[normalized] || null;
};

const mapRowsToContratos = (rows: unknown[][]): ParsedContratoImport => {
  if (rows.length === 0) {
    return { items: [], errors: ["Planilha vazia."] };
  }

  const headers = (rows[0] ?? []).map((column) => String(column ?? "").trim());
  let mappedHeaders = headers.map(normalizeContratoColumn);
  const recognizedColumns = mappedHeaders.filter(Boolean).length;
  let dataRows = rows.slice(1);

  if (recognizedColumns === 0) {
    mappedHeaders = headers.map((_, index) => POSITIONAL_FIELDS[index] ?? null);
    dataRows = rows;
  } else if (!mappedHeaders.some((field) => field === "titulo") && mappedHeaders.length > 0) {
    mappedHeaders = mappedHeaders.map((field, index) => (index === 0 ? "titulo" : field));
  }

  const items: Partial<Contrato>[] = [];
  const errors: string[] = [];

  dataRows.forEach((row, index) => {
    const lineNumber = recognizedColumns === 0 ? index + 1 : index + 2;
    const item: Partial<Contrato> = {
      titulo: "",
      cliente: "",
      tipo: "Venda",
      status: "rascunho",
      valor: 0,
    };

    let hasContent = false;

    mappedHeaders.forEach((field, columnIndex) => {
      const rawValue = row?.[columnIndex];
      if (!field || isBlankValue(rawValue)) return;

      hasContent = true;
      (item as any)[field] = normalizeFieldValue(field, rawValue);
    });

    const titulo = String(item.titulo || "").trim();
    const cliente = String(item.cliente || "").trim();

    if (!hasContent) return;

    if (!titulo && !cliente) {
      errors.push(`Linha ${lineNumber}: título e cliente vazios, ignorada.`);
      return;
    }

    item.titulo = titulo || `Contrato ${items.length + 1}`;
    item.cliente = cliente || "N/I";
    items.push(item);
  });

  return { items, errors };
};

export function parseContratoText(text: string): ParsedContratoImport {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { items: [], errors: ["Arquivo vazio."] };
  }

  const separator = lines[0].includes("\t") ? "\t" : lines[0].includes(";") ? ";" : lines[0].includes(",") ? "," : null;

  if (!separator) {
    return mapRowsToContratos(lines.map((line) => [line]));
  }

  const rows = lines.map((line) => line.split(separator).map((value) => value.trim()));
  return mapRowsToContratos(rows);
}

export function parseContratoSpreadsheet(buffer: ArrayBuffer): ParsedContratoImport {
  const workbook = read(buffer, { type: "array" });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];

  if (!worksheet) {
    return { items: [], errors: ["Planilha vazia ou formato não reconhecido."] };
  }

  const rows = utils.sheet_to_json(worksheet, { header: 1, defval: "", raw: false }) as unknown[][];
  return mapRowsToContratos(rows);
}

export async function parseContratoImportFile(file: File): Promise<ParsedContratoImport> {
  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  const isSpreadsheet = ["xlsx", "xls", "ods"].includes(extension);

  if (isSpreadsheet) {
    return parseContratoSpreadsheet(await file.arrayBuffer());
  }

  return parseContratoText(await file.text());
}

const formatSpreadsheetDate = (date: string | null) => {
  if (!date) return "";
  return new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR");
};

export function buildContratoExportRows(contratos: Contrato[]): Record<ImportableContratoField, string | number>[] {
  return contratos.map((contrato) => ({
    titulo: contrato.titulo || "",
    cliente: contrato.cliente || "",
    tipo: contrato.tipo || "",
    status: STATUS_LABELS[contrato.status] || contrato.status || "",
    valor: contrato.valor || 0,
    comissao_percentual: contrato.comissao_percentual || 0,
    comissao_valor: contrato.comissao_valor || 0,
    data_inicio: formatSpreadsheetDate(contrato.data_inicio),
    data_fim: formatSpreadsheetDate(contrato.data_fim),
    proprietario: contrato.proprietario || "",
    proprietario_telefone: contrato.proprietario_telefone || "",
    proprietario_cpf: contrato.proprietario_cpf || "",
    proprietario_email: contrato.proprietario_email || "",
    proprietario_rg: contrato.proprietario_rg || "",
    proprietario_banco: contrato.proprietario_banco || "",
    proprietario_agencia: contrato.proprietario_agencia || "",
    proprietario_conta: contrato.proprietario_conta || "",
    proprietario_pix: contrato.proprietario_pix || "",
    corretor_nome: contrato.corretor_nome || "",
    corretor_comissao_valor: contrato.corretor_comissao_valor || 0,
    inquilino: contrato.inquilino || "",
    inquilino_telefone: contrato.inquilino_telefone || "",
    inquilino_cpf: contrato.inquilino_cpf || "",
    inquilino_email: contrato.inquilino_email || "",
    inquilino_rg: contrato.inquilino_rg || "",
    inquilino2_nome: contrato.inquilino2_nome || "",
    inquilino2_telefone: contrato.inquilino2_telefone || "",
    inquilino2_cpf: contrato.inquilino2_cpf || "",
    inquilino2_email: contrato.inquilino2_email || "",
    inquilino2_rg: contrato.inquilino2_rg || "",
    parceiro_nome: contrato.parceiro_nome || "",
    parceiro_comissao_valor: contrato.parceiro_comissao_valor || 0,
    captador_nome: contrato.captador_nome || "",
    captador_comissao_valor: contrato.captador_comissao_valor || 0,
    matricula: contrato.matricula || "",
    numero_unidade: contrato.numero_unidade || "",
    canal_origem: contrato.canal_origem ? getCanalLabel(contrato.canal_origem) : "",
    cliente_telefone: contrato.cliente_telefone || "",
    cliente_cpf: contrato.cliente_cpf || "",
    cliente_email: contrato.cliente_email || "",
    cliente_rg: contrato.cliente_rg || "",
    observacoes: contrato.observacoes || "",
  }));
}