/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 *
 * Import/export de planilhas de contratos (paridade Lovable, campos camelCase).
 */

import { read, utils } from "xlsx";
import { CANAIS_ORIGEM, getCanalLabel } from "./realtyCrm";

const STATUS_LABELS = {
  rascunho: "Rascunho",
  aguardando: "Aguardando Assinatura",
  assinado: "Assinado",
  ativo: "Ativo",
  inativo: "Inativo",
  vencendo: "Vencendo",
  cancelado: "Cancelado",
};

const STATUS_BY_NORMALIZED_VALUE = {
  ativo: "ativo",
  assinado: "assinado",
  inativo: "inativo",
  aguardando: "aguardando",
  aguardando_assinatura: "aguardando",
  rascunho: "rascunho",
  vencendo: "vencendo",
  cancelado: "cancelado",
};

const FIELD_ALIASES = {
  title: ["Título", "Titulo", "titulo", "title"],
  cliente: ["cliente"],
  tipo: ["tipo"],
  status: ["status", "situação", "situacao"],
  value: ["valor", "valor r$", "valor brl", "value"],
  comissaoPercentual: ["Comissão %", "comissao %", "comissao", "comissao percentual", "comissao pct"],
  comissaoValor: ["Comissão R$", "comissao r$", "comissao valor", "comissao reais"],
  startDate: ["Início", "Inicio", "data inicio", "data início", "data_inicio", "startDate"],
  endDate: ["Fim", "data fim", "data_fim", "endDate"],
  proprietario: ["Proprietário", "proprietario"],
  proprietarioTelefone: ["Tel Proprietário", "telefone proprietário", "telefone proprietario", "proprietario telefone"],
  proprietarioCpf: ["CPF Proprietário", "cpf proprietario", "proprietario cpf"],
  proprietarioEmail: ["Email Proprietário", "email proprietario", "proprietario email"],
  proprietarioRg: ["RG Proprietário", "rg proprietario", "proprietario rg"],
  proprietarioBanco: ["Banco Proprietário", "banco proprietario", "proprietario banco", "banco"],
  proprietarioAgencia: ["Agência Proprietário", "agencia proprietario", "proprietario agencia", "agencia"],
  proprietarioConta: ["Conta Proprietário", "conta proprietario", "proprietario conta", "conta"],
  proprietarioPix: ["PIX Proprietário", "pix proprietario", "proprietario pix", "pix"],
  corretorNome: ["Corretor", "corretor nome"],
  corretorComissaoValor: ["Comissão Corretor R$", "comissao corretor r$", "corretor comissao valor"],
  inquilino: ["inquilino"],
  inquilinoTelefone: ["Tel Inquilino", "telefone inquilino", "inquilino telefone"],
  inquilinoCpf: ["CPF Inquilino", "inquilino cpf"],
  inquilinoEmail: ["Email Inquilino", "inquilino email"],
  inquilinoRg: ["RG Inquilino", "inquilino rg"],
  inquilino2Nome: ["Inquilino 2", "inquilino2", "inquilino 02"],
  inquilino2Telefone: ["Tel Inquilino 2", "telefone inquilino 2", "inquilino2 telefone"],
  inquilino2Cpf: ["CPF Inquilino 2", "inquilino2 cpf"],
  inquilino2Email: ["Email Inquilino 2", "inquilino2 email"],
  inquilino2Rg: ["RG Inquilino 2", "inquilino2 rg"],
  parceiroNome: ["Parceiro", "parceiro nome"],
  parceiroComissaoValor: ["Comissão Parceiro R$", "comissao parceiro r$", "parceiro comissao valor"],
  captadorNome: ["Captador", "captador nome"],
  captadorComissaoValor: ["Comissão Captador R$", "comissao captador r$", "captador comissao valor"],
  matricula: ["Matrícula", "matricula"],
  numeroUnidade: ["Unidade", "numero unidade", "número unidade", "numero_unidade"],
  canalOrigem: ["Canal Origem", "canal origem", "canal", "origem"],
  clienteTelefone: ["Tel Cliente", "telefone cliente", "cliente telefone"],
  clienteCpf: ["CPF Cliente", "cliente cpf"],
  clienteEmail: ["Email Cliente", "cliente email"],
  clienteRg: ["RG Cliente", "cliente rg"],
  notes: ["Observações", "observacoes", "obs", "notes"],
};

const NUMBER_FIELDS = new Set([
  "value",
  "comissaoPercentual",
  "comissaoValor",
  "corretorComissaoValor",
  "parceiroComissaoValor",
  "captadorComissaoValor",
]);

const DATE_FIELDS = new Set(["startDate", "endDate"]);

const normalizeColumnName = (value) =>
  String(value || "")
    .replace(/^\uFEFF/, "")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");

const FIELD_BY_ALIAS = Object.entries(FIELD_ALIASES).reduce((acc, [field, aliases]) => {
  aliases.forEach((alias) => {
    acc[normalizeColumnName(alias)] = field;
  });
  return acc;
}, {});

const POSITIONAL_FIELDS = Object.keys(FIELD_ALIASES);

export const CONTRATO_EXPORT_COLUMNS = [
  { header: "Título", key: "title" },
  { header: "Cliente", key: "cliente" },
  { header: "Tipo", key: "tipo" },
  { header: "Status", key: "status" },
  { header: "Valor", key: "value" },
  { header: "Comissão %", key: "comissaoPercentual" },
  { header: "Comissão R$", key: "comissaoValor" },
  { header: "Início", key: "startDate" },
  { header: "Fim", key: "endDate" },
  { header: "Proprietário", key: "proprietario" },
  { header: "Tel Proprietário", key: "proprietarioTelefone" },
  { header: "CPF Proprietário", key: "proprietarioCpf" },
  { header: "Email Proprietário", key: "proprietarioEmail" },
  { header: "RG Proprietário", key: "proprietarioRg" },
  { header: "Banco Proprietário", key: "proprietarioBanco" },
  { header: "Agência Proprietário", key: "proprietarioAgencia" },
  { header: "Conta Proprietário", key: "proprietarioConta" },
  { header: "PIX Proprietário", key: "proprietarioPix" },
  { header: "Corretor", key: "corretorNome" },
  { header: "Comissão Corretor R$", key: "corretorComissaoValor" },
  { header: "Inquilino", key: "inquilino" },
  { header: "Tel Inquilino", key: "inquilinoTelefone" },
  { header: "CPF Inquilino", key: "inquilinoCpf" },
  { header: "Email Inquilino", key: "inquilinoEmail" },
  { header: "RG Inquilino", key: "inquilinoRg" },
  { header: "Inquilino 2", key: "inquilino2Nome" },
  { header: "Tel Inquilino 2", key: "inquilino2Telefone" },
  { header: "CPF Inquilino 2", key: "inquilino2Cpf" },
  { header: "Email Inquilino 2", key: "inquilino2Email" },
  { header: "RG Inquilino 2", key: "inquilino2Rg" },
  { header: "Parceiro", key: "parceiroNome" },
  { header: "Comissão Parceiro R$", key: "parceiroComissaoValor" },
  { header: "Captador", key: "captadorNome" },
  { header: "Comissão Captador R$", key: "captadorComissaoValor" },
  { header: "Matrícula", key: "matricula" },
  { header: "Unidade", key: "numeroUnidade" },
  { header: "Canal Origem", key: "canalOrigem" },
  { header: "Tel Cliente", key: "clienteTelefone" },
  { header: "CPF Cliente", key: "clienteCpf" },
  { header: "Email Cliente", key: "clienteEmail" },
  { header: "RG Cliente", key: "clienteRg" },
  { header: "Observações", key: "notes" },
];

const isBlankValue = (value) => {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" || trimmed === "—" || trimmed === "-";
  }
  return false;
};

const parseDate = (value) => {
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

const parseNumber = (value) => {
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

const parseTipo = (value) => {
  const raw = String(value || "").trim();
  const normalized = normalizeColumnName(raw);

  if (normalized.includes("loca") || normalized.includes("aluguel")) return "Locação";
  if (normalized.includes("admin")) return "Administração";
  if (normalized.includes("exclus")) return "Exclusividade";
  if (normalized.includes("vend")) return "Venda";

  return raw || "Venda";
};

const parseStatus = (value) => {
  const normalized = normalizeColumnName(String(value || ""));
  return STATUS_BY_NORMALIZED_VALUE[normalized] || "rascunho";
};

const parseCanalOrigem = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const normalized = normalizeColumnName(raw);
  const canal = CANAIS_ORIGEM.find(
    (item) => item.id === normalized || normalizeColumnName(item.label) === normalized
  );

  return canal ? canal.id : raw;
};

const normalizeFieldValue = (field, value) => {
  if (NUMBER_FIELDS.has(field)) return parseNumber(value);
  if (DATE_FIELDS.has(field)) return parseDate(value);
  if (field === "tipo") return parseTipo(value);
  if (field === "status") return parseStatus(value);
  if (field === "canalOrigem") return parseCanalOrigem(value);

  return String(value).trim();
};

const normalizeContratoColumn = (column) => {
  const normalized = normalizeColumnName(column);
  return FIELD_BY_ALIAS[normalized] || null;
};

const mapRowsToContratos = (rows) => {
  if (rows.length === 0) {
    return { items: [], errors: ["Planilha vazia."] };
  }

  const headers = (rows[0] || []).map((column) => String(column ?? "").trim());
  let mappedHeaders = headers.map(normalizeContratoColumn);
  const recognizedColumns = mappedHeaders.filter(Boolean).length;
  let dataRows = rows.slice(1);

  if (recognizedColumns === 0) {
    mappedHeaders = headers.map((_, index) => POSITIONAL_FIELDS[index] || null);
    dataRows = rows;
  } else if (!mappedHeaders.some((field) => field === "title") && mappedHeaders.length > 0) {
    mappedHeaders = mappedHeaders.map((field, index) => (index === 0 ? "title" : field));
  }

  const items = [];
  const errors = [];

  dataRows.forEach((row, index) => {
    const lineNumber = recognizedColumns === 0 ? index + 1 : index + 2;
    const item = {
      title: "",
      cliente: "",
      tipo: "Venda",
      status: "rascunho",
      value: 0,
    };

    let hasContent = false;

    mappedHeaders.forEach((field, columnIndex) => {
      const rawValue = row?.[columnIndex];
      if (!field || isBlankValue(rawValue)) return;

      hasContent = true;
      item[field] = normalizeFieldValue(field, rawValue);
    });

    const title = String(item.title || "").trim();
    const cliente = String(item.cliente || "").trim();

    if (!hasContent) return;

    if (!title && !cliente) {
      errors.push(`Linha ${lineNumber}: título e cliente vazios, ignorada.`);
      return;
    }

    item.title = title || `Contrato ${items.length + 1}`;
    item.cliente = cliente || "N/I";
    items.push(item);
  });

  return { items, errors };
};

export function parseContratoText(text) {
  const lines = String(text || "")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { items: [], errors: ["Arquivo vazio."] };
  }

  const separator = lines[0].includes("\t")
    ? "\t"
    : lines[0].includes(";")
      ? ";"
      : lines[0].includes(",")
        ? ","
        : null;

  if (!separator) {
    return mapRowsToContratos(lines.map((line) => [line]));
  }

  const rows = lines.map((line) => line.split(separator).map((value) => value.trim()));
  return mapRowsToContratos(rows);
}

export function parseContratoSpreadsheet(buffer) {
  const workbook = read(buffer, { type: "array" });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];

  if (!worksheet) {
    return { items: [], errors: ["Planilha vazia ou formato não reconhecido."] };
  }

  const rows = utils.sheet_to_json(worksheet, { header: 1, defval: "", raw: false });
  return mapRowsToContratos(rows);
}

export async function parseContratoImportFile(file) {
  const extension = (file.name.split(".").pop() || "").toLowerCase();
  const isSpreadsheet = ["xlsx", "xls", "ods"].includes(extension);

  if (isSpreadsheet) {
    return parseContratoSpreadsheet(await file.arrayBuffer());
  }

  return parseContratoText(await file.text());
}

const formatSpreadsheetDate = (date) => {
  if (!date) return "";
  const raw = String(date).slice(0, 10);
  return new Date(`${raw}T00:00:00`).toLocaleDateString("pt-BR");
};

export function buildContratoExportRows(contratos) {
  return (contratos || []).map((contrato) => ({
    title: contrato.title || "",
    cliente: contrato.cliente || "",
    tipo: contrato.tipo || "",
    status: STATUS_LABELS[contrato.status] || contrato.status || "",
    value: contrato.value || 0,
    comissaoPercentual: contrato.comissaoPercentual || 0,
    comissaoValor: contrato.comissaoValor || 0,
    startDate: formatSpreadsheetDate(contrato.startDate),
    endDate: formatSpreadsheetDate(contrato.endDate),
    proprietario: contrato.proprietario || "",
    proprietarioTelefone: contrato.proprietarioTelefone || "",
    proprietarioCpf: contrato.proprietarioCpf || "",
    proprietarioEmail: contrato.proprietarioEmail || "",
    proprietarioRg: contrato.proprietarioRg || "",
    proprietarioBanco: contrato.proprietarioBanco || "",
    proprietarioAgencia: contrato.proprietarioAgencia || "",
    proprietarioConta: contrato.proprietarioConta || "",
    proprietarioPix: contrato.proprietarioPix || "",
    corretorNome: contrato.corretorNome || "",
    corretorComissaoValor: contrato.corretorComissaoValor || 0,
    inquilino: contrato.inquilino || "",
    inquilinoTelefone: contrato.inquilinoTelefone || "",
    inquilinoCpf: contrato.inquilinoCpf || "",
    inquilinoEmail: contrato.inquilinoEmail || "",
    inquilinoRg: contrato.inquilinoRg || "",
    inquilino2Nome: contrato.inquilino2Nome || "",
    inquilino2Telefone: contrato.inquilino2Telefone || "",
    inquilino2Cpf: contrato.inquilino2Cpf || "",
    inquilino2Email: contrato.inquilino2Email || "",
    inquilino2Rg: contrato.inquilino2Rg || "",
    parceiroNome: contrato.parceiroNome || "",
    parceiroComissaoValor: contrato.parceiroComissaoValor || 0,
    captadorNome: contrato.captadorNome || "",
    captadorComissaoValor: contrato.captadorComissaoValor || 0,
    matricula: contrato.matricula || "",
    numeroUnidade: contrato.numeroUnidade || "",
    canalOrigem: contrato.canalOrigem ? getCanalLabel(contrato.canalOrigem) : "",
    clienteTelefone: contrato.clienteTelefone || "",
    clienteCpf: contrato.clienteCpf || "",
    clienteEmail: contrato.clienteEmail || "",
    clienteRg: contrato.clienteRg || "",
    notes: contrato.notes || "",
  }));
}
