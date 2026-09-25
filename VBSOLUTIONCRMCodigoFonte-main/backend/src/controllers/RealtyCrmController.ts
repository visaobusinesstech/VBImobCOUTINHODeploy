/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 */

import { Request, Response } from "express";
import { Op } from "sequelize";
import Proprietario from "../models/Proprietario";
import ProprietarioFamiliar from "../models/ProprietarioFamiliar";
import Imovel from "../models/Imovel";
import Contrato from "../models/Contrato";
import ContratoAnexoAnual from "../models/ContratoAnexoAnual";
import ContratoComprovanteMensal from "../models/ContratoComprovanteMensal";
import LeadSale from "../models/LeadSale";
import {
  CONTRATO_FIELD_KEYS,
  CONTRATO_NULLABLE_INT_KEYS,
  CONTRATO_BOOLEAN_KEYS,
  CONTRATO_SEARCH_FIELDS
} from "../helpers/contratoFields";
import Ticket from "../models/Ticket";
import RealtyFollowup from "../models/RealtyFollowup";
import RealtyVisita from "../models/RealtyVisita";
import RealtyCompromisso from "../models/RealtyCompromisso";
import RealtyProposta from "../models/RealtyProposta";
import RealtyLeadImovelEnvio from "../models/RealtyLeadImovelEnvio";
import RealtyNutricao from "../models/RealtyNutricao";
import RealtyProspeccao from "../models/RealtyProspeccao";
import RealtyProspeccaoDiaria from "../models/RealtyProspeccaoDiaria";
import RealtyTransacao from "../models/RealtyTransacao";
import RealtyInadimplenciaAlerta from "../models/RealtyInadimplenciaAlerta";
import Company from "../models/Company";
import RealtyConsultaCpf from "../models/RealtyConsultaCpf";
import {
  CreditCheckConfigError,
  CreditCheckProviderError,
  digitsOnly as digitsOnlyCpf,
  runCreditCheck,
  validateCpfForCreditCheck
} from "../helpers/consultaCpfCredit";
import {
  computeInadimplenciaItems,
  computeInadimplenciaMetrics,
  isLocacaoAtiva,
  resolveDiaVencimento,
  resolveInquilino,
  resolveTitulo,
  resolveValorAluguel,
  shouldAlertCurrentMonth
} from "../helpers/inadimplenciaParity";
import RealtyClienteRelacionamento from "../models/RealtyClienteRelacionamento";
import RealtyMensagemTemplate from "../models/RealtyMensagemTemplate";
import RealtyCaptacao from "../models/RealtyCaptacao";
import { composerAssistTransform } from "../services/PromptServices/ComposerAssistOpenAiService";
import {
  getDefaultTemplate,
  isValidTemplateTipo,
  normalizeClienteRelacionamentoPayload,
  TEMPLATE_TIPOS
} from "../helpers/relacionamentoCrm";
import logger from "../utils/logger";
import RealtyAutomacaoFollowup from "../models/RealtyAutomacaoFollowup";
import RealtyFilaConfig from "../models/RealtyFilaConfig";
import RealtyModulo from "../models/RealtyModulo";
import User from "../models/User";
import ResolveTicketForLeadPreviewService from "../services/TicketServices/ResolveTicketForLeadPreviewService";
import SendWhatsAppMessage from "../services/WbotServices/SendWhatsAppMessage";
import {
  clampPageSize,
  pickAllowedStatus,
  rankImoveisForLead,
  CONTRATO_STATUSES,
  IMOVEL_STATUSES,
  FOLLOWUP_STATUSES,
  FOLLOWUP_INACTIVE_LEAD_STATUSES,
  FOLLOWUP_INACTIVE_CONTRATO_STATUSES,
  VISITA_STATUSES,
  COMPROMISSO_STATUSES,
  COMPROMISSO_TIPOS,
  COMPROMISSO_PRIORIDADES,
  COMPROMISSO_RESULTADO_CLIENTE,
  PROPOSTA_STATUSES
} from "../helpers/realtyCrm";
import {
  CAPTACAO_OPERACOES,
  CAPTACAO_STATUSES,
  CAPTACAO_TIPOS,
  CAPTACAO_TIPOS_IMOVEL,
  isValidCaptacaoTipo
} from "../helpers/captacaoIndicacao";
import {
  buildDuplicateWarnings,
  normalizeProprietarioPayload,
  type FamiliarInput
} from "../helpers/proprietarioCrm";
import RealtyFollowupMessageTemplate from "../models/RealtyFollowupMessageTemplate";
import {
  dispatchFollowupWhatsApp,
  nextRecurrenceDate
} from "../services/RealtyServices/dispatchFollowupWhatsApp";

const FILA_CLOSED_STATUSES = [
  ...FOLLOWUP_INACTIVE_LEAD_STATUSES,
  "concluido",
  "comprou_outra",
  "desistiu",
  "cancelado"
];

const TEMP_AI_SCORE: Record<string, number> = {
  muito_quente: 95,
  quente: 80,
  morno: 55,
  frio: 25
};

function leadAiScore(lead: any): number {
  const tags = lead?.tags;
  if (Array.isArray(tags)) {
    for (const t of tags) {
      const m = String(t || "").match(/^ai_score[:=]?(\d+(?:\.\d+)?)$/i);
      if (m) return Math.max(0, Math.min(100, Number(m[1])));
    }
  }
  const temp = String(lead?.temperature || "").toLowerCase().trim();
  if (TEMP_AI_SCORE[temp] != null) return TEMP_AI_SCORE[temp];
  return 50;
}

function isLeadClosed(status: any): boolean {
  return FILA_CLOSED_STATUSES.includes(String(status || "").toLowerCase());
}

const FOLLOWUP_KEYS = [
  "type",
  "scheduledAt",
  "completedAt",
  "result",
  "notes",
  "status",
  "leadSaleId",
  "contratoId",
  "userId",
  "ticketId",
  "messageBody",
  "messageMode",
  "messageTemplateId",
  "whatsappId",
  "metaTemplateQuickMessageId",
  "metaTemplateVariables",
  "whatsappSent",
  "whatsappSentAt",
  "sendNow",
  "recurrenceEnabled",
  "recurrenceType",
  "recurrenceInterval",
  "recurrenceDays"
] as const;

const INACTIVE_LEAD = FOLLOWUP_INACTIVE_LEAD_STATUSES as readonly string[];
const INACTIVE_CONTRATO = FOLLOWUP_INACTIVE_CONTRATO_STATUSES as readonly string[];

function isLeadInactive(status?: string | null) {
  return INACTIVE_LEAD.includes(String(status || "").toLowerCase());
}
function isContratoInactive(status?: string | null) {
  return INACTIVE_CONTRATO.includes(String(status || "").toLowerCase());
}

function enrichFollowupRow(row: any) {
  const plain = typeof row?.toJSON === "function" ? row.toJSON() : { ...row };
  const lead = plain.leadSale || null;
  const contrato = plain.contrato || null;
  return {
    ...plain,
    leadNome: lead?.name || null,
    leadTelefone: lead?.phone || null,
    leadEmail: lead?.email || null,
    leadStatus: lead?.status || null,
    leadInativo: lead ? isLeadInactive(lead.status) : false,
    contratoTitulo: contrato?.title || null,
    contratoStatus: contrato?.status || null,
    contratoInativo: contrato ? isContratoInactive(contrato.status) : false,
    alvoInativo:
      (lead && isLeadInactive(lead.status)) ||
      (contrato && isContratoInactive(contrato.status))
  };
}

function pick(body: Record<string, any>, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (body[key] !== undefined) out[key] = body[key];
  }
  return out;
}

function emptyToNull(value: any) {
  if (value === "" || value === undefined) return null;
  return value;
}

async function paginate(Model: any, companyId: number, req: Request, searchFields: string[]) {
  const { searchParam, pageNumber, pageSize, status } = req.query as Record<string, string>;
  const limit = clampPageSize(pageSize, 20, 200);
  const page = +(pageNumber || 1);
  const offset = limit * (page - 1);
  const where: any = { companyId };
  if (status) where.status = status;
  if (searchParam) {
    const like = `%${searchParam}%`;
    where[Op.or] = searchFields.map(field => ({ [field]: { [Op.iLike]: like } }));
  }
  const { rows, count } = await Model.findAndCountAll({
    where,
    limit,
    offset,
    order: [["createdAt", "DESC"]]
  });
  return {
    rows,
    count,
    hasMore: count > offset + rows.length
  };
}

export const listProprietarios = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const data = await paginate(Proprietario, companyId, req, [
    "name",
    "phone",
    "email",
    "document",
    "city",
    "address",
    "canalOrigem",
    "dadosImovelEndereco"
  ]);
  const ids = data.rows.map((r: any) => r.id);
  let familiaresByProp = new Map<number, any[]>();
  if (ids.length > 0) {
    const fams = await ProprietarioFamiliar.findAll({
      where: { companyId, proprietarioId: { [Op.in]: ids } },
      order: [["id", "ASC"]]
    });
    familiaresByProp = new Map();
    fams.forEach((f: any) => {
      const arr = familiaresByProp.get(f.proprietarioId) || [];
      arr.push(f);
      familiaresByProp.set(f.proprietarioId, arr);
    });
  }
  const proprietarios = data.rows.map((r: any) => {
    const plain = typeof r.toJSON === "function" ? r.toJSON() : { ...r };
    plain.familiares = familiaresByProp.get(plain.id) || [];
    return plain;
  });
  return res.json({ proprietarios, count: data.count, hasMore: data.hasMore });
};

async function syncFamiliares(
  proprietarioId: number,
  companyId: number,
  familiares: FamiliarInput[]
) {
  const existentes = await ProprietarioFamiliar.findAll({
    where: { proprietarioId, companyId }
  });
  const existentesIds = new Set(existentes.map(f => f.id));
  const enviadosIds = new Set(
    familiares
      .map(f => Number(f.id))
      .filter(id => Number.isFinite(id) && id > 0)
  );

  const idsParaRemover = [...existentesIds].filter(id => !enviadosIds.has(id));
  if (idsParaRemover.length > 0) {
    await ProprietarioFamiliar.destroy({
      where: { id: { [Op.in]: idsParaRemover }, companyId, proprietarioId }
    });
  }

  for (const f of familiares) {
    const id = Number(f.id);
    const payload = {
      nome: String(f.nome || "").trim(),
      dataNascimento: f.dataNascimento || null,
      relacao: f.relacao || "filho"
    };
    if (Number.isFinite(id) && id > 0 && existentesIds.has(id)) {
      await ProprietarioFamiliar.update(payload as any, {
        where: { id, companyId, proprietarioId }
      });
    } else if (payload.nome) {
      await ProprietarioFamiliar.create({
        ...payload,
        proprietarioId,
        companyId
      } as any);
    }
  }

  return ProprietarioFamiliar.findAll({
    where: { proprietarioId, companyId },
    order: [["id", "ASC"]]
  });
}

async function loadProprietarioWithFamiliares(id: number, companyId: number) {
  const record = await Proprietario.findOne({ where: { id, companyId } });
  if (!record) return null;
  const familiares = await ProprietarioFamiliar.findAll({
    where: { proprietarioId: id, companyId },
    order: [["id", "ASC"]]
  });
  const plain = record.toJSON() as any;
  plain.familiares = familiares;
  return plain;
}

export const storeProprietario = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { data, familiares } = normalizeProprietarioPayload(req.body || {});
  if (!data.name) return res.status(400).json({ error: "name is required" });
  if (!data.tipo) data.tipo = "ambos";

  // Bloqueia cadastro duplicado (paridade Lovable useProprietarios.create)
  const docDigits = String(data.document || "").replace(/\D/g, "");
  const phoneDigits = String(data.phone || "").replace(/\D/g, "");
  const email = String(data.email || "")
    .trim()
    .toLowerCase();
  let byDocument: Proprietario | null = null;
  let byPhone: Proprietario | null = null;
  let byEmail: Proprietario | null = null;
  if (docDigits.length >= 11) {
    byDocument = await Proprietario.findOne({
      where: { companyId, document: { [Op.iLike]: `%${docDigits}%` } }
    });
  }
  if (phoneDigits.length >= 8) {
    byPhone = await Proprietario.findOne({
      where: {
        companyId,
        phone: { [Op.iLike]: `%${phoneDigits.slice(-8)}%` }
      }
    });
  }
  if (email) {
    byEmail = await Proprietario.findOne({
      where: { companyId, email: { [Op.iLike]: email } }
    });
  }
  const warnings = buildDuplicateWarnings({
    document: data.document,
    phone: data.phone,
    email: data.email,
    matches: { byDocument, byPhone, byEmail }
  });
  if (warnings.length > 0) {
    return res.status(409).json({
      error: "Proprietário possivelmente duplicado",
      warnings
    });
  }

  const record = await Proprietario.create({ ...data, companyId } as any);
  const fams = await syncFamiliares(record.id, companyId, familiares);
  const plain = record.toJSON() as any;
  plain.familiares = fams;
  return res.status(201).json(plain);
};

export const updateProprietario = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;
  const record = await Proprietario.findOne({ where: { id, companyId } });
  if (!record) return res.status(404).json({ error: "Not found" });
  const { data, familiares } = normalizeProprietarioPayload(req.body || {});
  await record.update(data as any);
  const fams = await syncFamiliares(record.id, companyId, familiares);
  const plain = record.toJSON() as any;
  plain.familiares = fams;
  return res.json(plain);
};

export const removeProprietario = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;
  const record = await Proprietario.findOne({ where: { id, companyId } });
  if (!record) return res.status(404).json({ error: "Not found" });
  await ProprietarioFamiliar.destroy({ where: { proprietarioId: record.id, companyId } });
  await record.destroy();
  return res.json({ message: "deleted" });
};

export const showProprietario = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;
  const plain = await loadProprietarioWithFamiliares(Number(id), companyId);
  if (!plain) return res.status(404).json({ error: "Not found" });
  return res.json(plain);
};

export const uploadProprietarioMedia = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;
  const files = (req.files as Express.Multer.File[]) || [];
  if (!files.length) {
    return res.status(400).json({ error: "Nenhum arquivo enviado" });
  }
  const urls = files.map(file => {
    const relative = file.path
      .replace(/\\/g, "/")
      .split("/public/")
      .pop();
    return `/public/${relative || `company${companyId}/proprietarios/${file.filename}`}`;
  });
  return res.status(201).json({ urls });
};

const IMOVEL_WRITABLE_FIELDS = [
  "title",
  "description",
  "type",
  "status",
  "price",
  "city",
  "neighborhood",
  "address",
  "bedrooms",
  "bathrooms",
  "areaM2",
  "images",
  "proprietarioId",
  "code",
  "purpose",
  "condoFee",
  "iptu",
  "state",
  "zipCode",
  "suites",
  "parkingSpots",
  "userId",
  "videoUrl",
  "exclusivo",
  "destaque",
  "aceitaPermuta",
  "aceitaFinanciamento",
  "aceitaFgts",
  "temEscritura",
  "andar",
  "posicaoSolar",
  "comissaoPercentual",
  "exclusividadeInicio",
  "exclusividadeFim",
  "portalOrigem",
  "urlAnuncio",
  "fotoCapaIndex",
  "documentosMatricula",
  "documentosIptu",
  "documentosOutros",
  "videos"
];

export const listImoveis = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const data = await paginate(Imovel, companyId, req, [
    "title",
    "city",
    "neighborhood",
    "type",
    "address",
    "code"
  ]);
  return res.json({ imoveis: data.rows, count: data.count, hasMore: data.hasMore });
};

export const storeImovel = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const data = pick(req.body || {}, IMOVEL_WRITABLE_FIELDS);
  if (!data.title) return res.status(400).json({ error: "title is required" });
  if (!data.status) {
    data.status = "disponivel";
  } else {
    data.status = pickAllowedStatus(data.status, IMOVEL_STATUSES, "disponivel");
  }
  data.proprietarioId = emptyToNull(data.proprietarioId);
  data.userId = emptyToNull(data.userId);
  const record = await Imovel.create({ ...data, companyId } as any);
  return res.status(201).json(record);
};

export const updateImovel = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;
  const record = await Imovel.findOne({ where: { id, companyId } });
  if (!record) return res.status(404).json({ error: "Not found" });
  const data = pick(req.body || {}, IMOVEL_WRITABLE_FIELDS);
  if (data.proprietarioId !== undefined) data.proprietarioId = emptyToNull(data.proprietarioId);
  if (data.userId !== undefined) data.userId = emptyToNull(data.userId);
  if (data.status !== undefined) {
    data.status = pickAllowedStatus(data.status, IMOVEL_STATUSES, record.status || "disponivel");
  }
  await record.update(data as any);
  return res.json(record);
};

export const removeImovel = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;
  const record = await Imovel.findOne({ where: { id, companyId } });
  if (!record) return res.status(404).json({ error: "Not found" });
  await record.destroy();
  return res.json({ message: "deleted" });
};

export const uploadImovelMedia = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const files = (req.files as Express.Multer.File[]) || [];
  if (!files.length) {
    return res.status(400).json({ error: "Nenhum arquivo enviado" });
  }
  const urls = files.map(file => {
    const relative = file.path
      .replace(/\\/g, "/")
      .split("/public/")
      .pop();
    return `/public/${relative || `company${companyId}/imoveis/${file.filename}`}`;
  });
  return res.status(201).json({ urls });
};

export const matchImoveis = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const leadId = Number(req.query.leadId || req.body?.leadId);
  const limit = clampPageSize(req.query.limit as string, 5, 20);
  if (!Number.isFinite(leadId)) {
    return res.status(400).json({ error: "leadId is required" });
  }
  const lead = await LeadSale.findOne({ where: { id: leadId, companyId } });
  if (!lead) return res.status(404).json({ error: "Lead not found" });

  const imoveis = await Imovel.findAll({ where: { companyId } });
  const matches = rankImoveisForLead(
    {
      interestCity: (lead as any).interestCity,
      interestNeighborhood: (lead as any).interestNeighborhood,
      interestType: (lead as any).interestType,
      bedrooms: (lead as any).bedrooms,
      value: lead.value
    },
    imoveis.map(row => ({
      id: row.id,
      title: row.title,
      city: row.city,
      neighborhood: row.neighborhood,
      type: row.type,
      bedrooms: row.bedrooms,
      price: Number(row.price),
      status: row.status
    })),
    limit
  );
  return res.json({ leadId, matches });
};

function coerceBool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1" || value === "true" || value === "True") return true;
  return false;
}

function normalizeContratoPayload(data: Record<string, unknown>): Record<string, unknown> {
  for (const k of CONTRATO_NULLABLE_INT_KEYS) {
    if (data[k] !== undefined) data[k] = emptyToNull(data[k]);
  }
  for (const k of CONTRATO_BOOLEAN_KEYS) {
    if (data[k] !== undefined) data[k] = coerceBool(data[k]);
  }
  if (data.parceriaEnvolvidos !== undefined) {
    if (typeof data.parceriaEnvolvidos === "string") {
      try {
        data.parceriaEnvolvidos = JSON.parse(data.parceriaEnvolvidos as string);
      } catch {
        data.parceriaEnvolvidos = [];
      }
    }
    if (!Array.isArray(data.parceriaEnvolvidos)) {
      data.parceriaEnvolvidos = [];
    }
  }
  return data;
}

function digitsOnly(value: unknown): string {
  return String(value || "").replace(/\D/g, "");
}

async function findLocacaoDuplicate(
  companyId: number,
  data: Record<string, unknown>
): Promise<{ message: string } | null> {
  if (String(data.tipo || "") !== "Locação") return null;

  const baseWhere: any = {
    companyId,
    tipo: "Locação",
    status: { [Op.ne]: "cancelado" }
  };

  const clienteCpf = digitsOnly(data.clienteCpf);
  if (clienteCpf.length >= 11) {
    const match = await Contrato.findOne({
      where: {
        ...baseWhere,
        clienteCpf: { [Op.iLike]: `%${clienteCpf}%` }
      }
    });
    if (match) {
      return {
        message: `Já existe um contrato de aluguel ativo para este CPF: "${match.title}" (${(match as any).cliente || ""}). Cancele o existente antes de criar um novo.`
      };
    }
  }

  const inquilinoCpf = digitsOnly(data.inquilinoCpf);
  if (inquilinoCpf.length >= 11) {
    const match = await Contrato.findOne({
      where: {
        ...baseWhere,
        inquilinoCpf: { [Op.iLike]: `%${inquilinoCpf}%` }
      }
    });
    if (match) {
      return {
        message: `Já existe um contrato de aluguel ativo para este inquilino (CPF): "${match.title}". Cancele o existente antes de criar um novo.`
      };
    }
  }

  const title = String(data.title || "").trim();
  if (title) {
    const match = await Contrato.findOne({
      where: {
        ...baseWhere,
        title: { [Op.iLike]: title }
      }
    });
    if (match) {
      return {
        message: `Já existe um contrato de aluguel com o mesmo título: "${match.title}" (${(match as any).cliente || ""}). Verifique antes de continuar.`
      };
    }
  }

  return null;
}

function generateCodigoContrato(id: number): string {
  const year = new Date().getFullYear();
  return `CTR-${year}-${String(id).padStart(5, "0")}`;
}

export const listContratos = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const data = await paginate(Contrato, companyId, req, [...CONTRATO_SEARCH_FIELDS]);
  return res.json({ contratos: data.rows, count: data.count, hasMore: data.hasMore });
};

export const storeContrato = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const data = normalizeContratoPayload(pick(req.body || {}, [...CONTRATO_FIELD_KEYS]));
  if (!data.title) return res.status(400).json({ error: "title is required" });
  if (!data.tipo) data.tipo = "Venda";
  if (!data.status) {
    data.status = "rascunho";
  } else {
    data.status = pickAllowedStatus(data.status, CONTRATO_STATUSES, "rascunho");
  }

  const dup = await findLocacaoDuplicate(companyId, data);
  if (dup) {
    return res.status(409).json({ error: "Contrato duplicado detectado", message: dup.message });
  }

  const record = await Contrato.create({ ...data, companyId } as any);
  if (!(record as any).codigoContrato) {
    await record.update({ codigoContrato: generateCodigoContrato(record.id) } as any);
  }
  return res.status(201).json(record);
};

export const updateContrato = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;
  const record = await Contrato.findOne({ where: { id, companyId } });
  if (!record) return res.status(404).json({ error: "Not found" });
  const data = normalizeContratoPayload(pick(req.body || {}, [...CONTRATO_FIELD_KEYS]));
  if (data.status !== undefined) {
    data.status = pickAllowedStatus(data.status, CONTRATO_STATUSES, record.status || "rascunho");
  }
  await record.update(data as any);
  return res.json(record);
};

export const removeContrato = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;
  const record = await Contrato.findOne({ where: { id, companyId } });
  if (!record) return res.status(404).json({ error: "Not found" });
  await record.destroy();
  return res.json({ message: "deleted" });
};

export const uploadContratoMedia = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const files = (req.files as Express.Multer.File[]) || [];
  if (!files.length) {
    return res.status(400).json({ error: "Nenhum arquivo enviado" });
  }
  const urls = files.map(file => {
    const relative = file.path
      .replace(/\\/g, "/")
      .split("/public/")
      .pop();
    return `/public/${relative || `company${companyId}/contratos/${file.filename}`}`;
  });
  return res.status(201).json({ urls });
};

async function assertContratoOwned(companyId: number, contratoId: number | string) {
  return Contrato.findOne({ where: { id: contratoId, companyId } });
}

const ANEXO_ANUAL_KEYS = ["ano", "tipo", "fileUrl", "fileName"];
const COMPROVANTE_MENSAL_KEYS = ["ano", "mes", "tipo", "fileUrl", "fileName", "recebido"];

export const listContratoAnexosAnuais = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;
  const contrato = await assertContratoOwned(companyId, id);
  if (!contrato) return res.status(404).json({ error: "Contrato not found" });
  const rows = await ContratoAnexoAnual.findAll({
    where: { companyId, contratoId: id },
    order: [["ano", "DESC"], ["id", "DESC"]]
  });
  return res.json({ anexosAnuais: rows });
};

export const storeContratoAnexoAnual = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;
  const contrato = await assertContratoOwned(companyId, id);
  if (!contrato) return res.status(404).json({ error: "Contrato not found" });
  const data = pick(req.body || {}, ANEXO_ANUAL_KEYS);
  if (data.ano === undefined || data.ano === null || data.ano === "") {
    return res.status(400).json({ error: "ano is required" });
  }
  data.ano = Number(data.ano);
  const record = await ContratoAnexoAnual.create({
    ...data,
    companyId,
    contratoId: Number(id)
  } as any);
  return res.status(201).json(record);
};

export const updateContratoAnexoAnual = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { id, anexoId } = req.params;
  const contrato = await assertContratoOwned(companyId, id);
  if (!contrato) return res.status(404).json({ error: "Contrato not found" });
  const record = await ContratoAnexoAnual.findOne({
    where: { id: anexoId, contratoId: id, companyId }
  });
  if (!record) return res.status(404).json({ error: "Not found" });
  const data = pick(req.body || {}, ANEXO_ANUAL_KEYS);
  if (data.ano !== undefined) data.ano = Number(data.ano);
  await record.update(data as any);
  return res.json(record);
};

export const removeContratoAnexoAnual = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { id, anexoId } = req.params;
  const contrato = await assertContratoOwned(companyId, id);
  if (!contrato) return res.status(404).json({ error: "Contrato not found" });
  const record = await ContratoAnexoAnual.findOne({
    where: { id: anexoId, contratoId: id, companyId }
  });
  if (!record) return res.status(404).json({ error: "Not found" });
  await record.destroy();
  return res.json({ message: "deleted" });
};

export const listContratoComprovantesMensais = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;
  const contrato = await assertContratoOwned(companyId, id);
  if (!contrato) return res.status(404).json({ error: "Contrato not found" });
  const rows = await ContratoComprovanteMensal.findAll({
    where: { companyId, contratoId: id },
    order: [["ano", "DESC"], ["mes", "DESC"], ["id", "DESC"]]
  });
  return res.json({ comprovantesMensais: rows });
};

export const storeContratoComprovanteMensal = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;
  const contrato = await assertContratoOwned(companyId, id);
  if (!contrato) return res.status(404).json({ error: "Contrato not found" });
  const data = pick(req.body || {}, COMPROVANTE_MENSAL_KEYS);
  if (data.ano === undefined || data.ano === null || data.ano === "") {
    return res.status(400).json({ error: "ano is required" });
  }
  if (data.mes === undefined || data.mes === null || data.mes === "") {
    return res.status(400).json({ error: "mes is required" });
  }
  data.ano = Number(data.ano);
  data.mes = Number(data.mes);
  if (data.recebido !== undefined) data.recebido = coerceBool(data.recebido);
  const record = await ContratoComprovanteMensal.create({
    ...data,
    companyId,
    contratoId: Number(id)
  } as any);
  return res.status(201).json(record);
};

export const updateContratoComprovanteMensal = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;
  const { id, compId } = req.params;
  const contrato = await assertContratoOwned(companyId, id);
  if (!contrato) return res.status(404).json({ error: "Contrato not found" });
  const record = await ContratoComprovanteMensal.findOne({
    where: { id: compId, contratoId: id, companyId }
  });
  if (!record) return res.status(404).json({ error: "Not found" });
  const data = pick(req.body || {}, COMPROVANTE_MENSAL_KEYS);
  if (data.ano !== undefined) data.ano = Number(data.ano);
  if (data.mes !== undefined) data.mes = Number(data.mes);
  if (data.recebido !== undefined) data.recebido = coerceBool(data.recebido);
  await record.update(data as any);
  return res.json(record);
};

export const removeContratoComprovanteMensal = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;
  const { id, compId } = req.params;
  const contrato = await assertContratoOwned(companyId, id);
  if (!contrato) return res.status(404).json({ error: "Contrato not found" });
  const record = await ContratoComprovanteMensal.findOne({
    where: { id: compId, contratoId: id, companyId }
  });
  if (!record) return res.status(404).json({ error: "Not found" });
  await record.destroy();
  return res.json({ message: "deleted" });
};

function crudFactory(Model: any, keys: string[], searchFields: string[], listKey: string, statusList?: readonly string[]) {
  return {
    list: async (req: Request, res: Response): Promise<Response> => {
      const { companyId } = req.user;
      const data = await paginate(Model, companyId, req, searchFields);
      return res.json({ [listKey]: data.rows, count: data.count, hasMore: data.hasMore });
    },
    store: async (req: Request, res: Response): Promise<Response> => {
      const { companyId, id: userId } = req.user as any;
      const data = pick(req.body || {}, keys);
      if (data.status !== undefined && statusList) {
        data.status = pickAllowedStatus(data.status, statusList as any, statusList[0]);
      }
      if (data.userId === undefined && keys.includes("userId")) data.userId = userId;
      ["leadSaleId", "imovelId", "userId", "ticketId"].forEach(k => {
        if (data[k] !== undefined) data[k] = emptyToNull(data[k]);
      });
      const record = await Model.create({ ...data, companyId } as any);
      return res.status(201).json(record);
    },
    update: async (req: Request, res: Response): Promise<Response> => {
      const { companyId } = req.user;
      const { id } = req.params;
      const record = await Model.findOne({ where: { id, companyId } });
      if (!record) return res.status(404).json({ error: "Not found" });
      const data = pick(req.body || {}, keys);
      if (data.status !== undefined && statusList) {
        data.status = pickAllowedStatus(data.status, statusList as any, record.status || statusList[0]);
      }
      ["leadSaleId", "imovelId", "userId", "ticketId"].forEach(k => {
        if (data[k] !== undefined) data[k] = emptyToNull(data[k]);
      });
      await record.update(data as any);
      return res.json(record);
    },
    remove: async (req: Request, res: Response): Promise<Response> => {
      const { companyId } = req.user;
      const { id } = req.params;
      const record = await Model.findOne({ where: { id, companyId } });
      if (!record) return res.status(404).json({ error: "Not found" });
      await record.destroy();
      return res.json({ message: "deleted" });
    }
  };
}

const followupsCrud = crudFactory(
  RealtyFollowup,
  [...FOLLOWUP_KEYS],
  ["type", "result", "notes", "status", "messageBody"],
  "followups",
  FOLLOWUP_STATUSES
);

export const listFollowups = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { searchParam, pageNumber, pageSize, status } = req.query as Record<string, string>;
  const limit = clampPageSize(pageSize, 50, 500);
  const page = +(pageNumber || 1);
  const offset = limit * (page - 1);
  const where: any = { companyId };
  if (status) where.status = status;
  if (searchParam) {
    const like = `%${searchParam}%`;
    where[Op.or] = [
      { type: { [Op.iLike]: like } },
      { result: { [Op.iLike]: like } },
      { notes: { [Op.iLike]: like } },
      { status: { [Op.iLike]: like } },
      { messageBody: { [Op.iLike]: like } }
    ];
  }

  const { rows, count } = await RealtyFollowup.findAndCountAll({
    where,
    limit,
    offset,
    order: [["scheduledAt", "ASC"]],
    include: [
      {
        model: LeadSale,
        as: "leadSale",
        required: false,
        attributes: ["id", "name", "phone", "email", "status", "contactId", "ticketId", "createdAt"]
      },
      {
        model: Contrato,
        as: "contrato",
        required: false,
        attributes: ["id", "title", "status", "leadSaleId", "value"]
      },
      {
        model: User,
        as: "user",
        required: false,
        attributes: ["id", "name"]
      }
    ]
  });

  return res.json({
    followups: rows.map(enrichFollowupRow),
    count,
    hasMore: count > offset + rows.length
  });
};

export const removeFollowup = followupsCrud.remove;

export const updateFollowup = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;
  const record = await RealtyFollowup.findOne({ where: { id, companyId } });
  if (!record) return res.status(404).json({ error: "Not found" });
  const data = pick(req.body || {}, [...FOLLOWUP_KEYS]);
  if (data.status !== undefined) {
    data.status = pickAllowedStatus(
      data.status as string,
      FOLLOWUP_STATUSES as any,
      record.status || "pendente"
    );
  }
  [
    "leadSaleId",
    "contratoId",
    "userId",
    "ticketId",
    "messageTemplateId",
    "whatsappId",
    "metaTemplateQuickMessageId",
    "recurrenceInterval"
  ].forEach(k => {
    if (data[k] !== undefined) data[k] = emptyToNull(data[k]);
  });
  if (data.status === "concluido" && !data.completedAt && !record.completedAt) {
    data.completedAt = new Date();
  }
  await record.update(data as any);

  // Recorrência: ao concluir, agenda próximo
  if (
    data.status === "concluido" &&
    (record as any).recurrenceEnabled
  ) {
    const nextDate = nextRecurrenceDate(
      new Date(),
      (record as any).recurrenceType,
      (record as any).recurrenceInterval
    );
    await RealtyFollowup.create({
      type: record.type,
      scheduledAt: nextDate,
      status: "pendente",
      notes: record.notes,
      messageBody: (record as any).messageBody,
      messageMode: (record as any).messageMode,
      messageTemplateId: (record as any).messageTemplateId,
      whatsappId: (record as any).whatsappId,
      metaTemplateQuickMessageId: (record as any).metaTemplateQuickMessageId,
      metaTemplateVariables: (record as any).metaTemplateVariables,
      leadSaleId: record.leadSaleId,
      contratoId: (record as any).contratoId,
      userId: record.userId,
      ticketId: record.ticketId,
      recurrenceEnabled: true,
      recurrenceType: (record as any).recurrenceType,
      recurrenceInterval: (record as any).recurrenceInterval,
      recurrenceDays: (record as any).recurrenceDays,
      companyId
    } as any);
  }

  const fresh = await RealtyFollowup.findByPk(record.id, {
    include: [
      { model: LeadSale, as: "leadSale", required: false },
      { model: Contrato, as: "contrato", required: false }
    ]
  });
  return res.json(enrichFollowupRow(fresh || record));
};

export const storeFollowup = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, id: userId } = req.user as any;
  const data = pick(req.body || {}, [...FOLLOWUP_KEYS]);
  if (!data.leadSaleId && !data.contratoId) {
    return res.status(400).json({ error: "leadSaleId ou contratoId é obrigatório" });
  }
  if (!data.scheduledAt) return res.status(400).json({ error: "scheduledAt is required" });
  if (!data.status) data.status = "pendente";
  else data.status = pickAllowedStatus(data.status as string, FOLLOWUP_STATUSES as any, "pendente");
  if (data.userId === undefined) data.userId = userId;
  if (!data.type) data.type = "whatsapp";
  if (!data.messageMode) data.messageMode = "pronta";

  [
    "leadSaleId",
    "contratoId",
    "userId",
    "ticketId",
    "messageTemplateId",
    "whatsappId",
    "metaTemplateQuickMessageId",
    "recurrenceInterval"
  ].forEach(k => {
    if (data[k] !== undefined) data[k] = emptyToNull(data[k]);
  });

  // Se modo template interno, carrega mensagem
  if (data.messageTemplateId && !data.messageBody) {
    const tpl = await RealtyFollowupMessageTemplate.findOne({
      where: { id: data.messageTemplateId as number, companyId, active: true }
    });
    if (tpl) data.messageBody = tpl.message;
  }

  const record = await RealtyFollowup.create({ ...data, companyId } as any);

  let lead: LeadSale | null = null;
  if (data.leadSaleId) {
    lead = await LeadSale.findOne({ where: { id: data.leadSaleId, companyId } });
    if (lead) {
      await lead.update({
        followUpAt: new Date(data.scheduledAt as any),
        nextContactAt: new Date(data.scheduledAt as any)
      } as any);
    }
  } else if (data.contratoId) {
    const contrato = await Contrato.findOne({ where: { id: data.contratoId, companyId } });
    if (contrato?.leadSaleId) {
      lead = await LeadSale.findOne({ where: { id: contrato.leadSaleId, companyId } });
      if (lead && !record.leadSaleId) {
        await record.update({ leadSaleId: lead.id } as any);
      }
    }
  }

  // Envio imediato se sendNow ou scheduledAt <= agora e tipo whatsapp
  const shouldSendNow =
    data.sendNow === true ||
    data.sendNow === "true" ||
    (String(data.type || "").toLowerCase() === "whatsapp" &&
      new Date(data.scheduledAt as any).getTime() <= Date.now() + 60_000);

  let dispatchResult = null;
  if (shouldSendNow && String(data.type || "").toLowerCase() === "whatsapp") {
    dispatchResult = await dispatchFollowupWhatsApp({
      followup: record,
      lead,
      companyId,
      userId
    });
    await record.reload();
  }

  const fresh = await RealtyFollowup.findByPk(record.id, {
    include: [
      { model: LeadSale, as: "leadSale", required: false },
      { model: Contrato, as: "contrato", required: false }
    ]
  });

  return res.status(201).json({
    ...enrichFollowupRow(fresh || record),
    dispatch: dispatchResult
  });
};

export const getFollowupCounts = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const includeInactive = String(req.query.includeInactive || "") === "true";
  const semContatoDays = Math.max(1, Math.min(90, Number(req.query.semContatoDays) || 7));

  const all = await RealtyFollowup.findAll({
    where: { companyId },
    include: [
      {
        model: LeadSale,
        as: "leadSale",
        required: false,
        attributes: ["id", "status", "createdAt"]
      },
      {
        model: Contrato,
        as: "contrato",
        required: false,
        attributes: ["id", "status"]
      }
    ]
  });

  const enriched = all.map(enrichFollowupRow);
  const pendentes = enriched.filter(f => {
    if (f.status !== "pendente" && f.status !== "aguardando") return false;
    if (!includeInactive && f.alvoInativo) return false;
    return true;
  });

  const startOfDay = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  };
  const today = startOfDay(new Date());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // semana: domingo → sábado (igual Lovable com ptBR)
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const hoje = pendentes.filter(f => {
    const d = startOfDay(new Date(f.scheduledAt));
    return d.getTime() === today.getTime();
  }).length;

  const atrasados = pendentes.filter(f => {
    const d = startOfDay(new Date(f.scheduledAt));
    return d.getTime() < today.getTime();
  }).length;

  const semana = pendentes.filter(f => {
    const d = new Date(f.scheduledAt);
    return d >= weekStart && d < weekEnd;
  }).length;

  // Sem contato: leads sem follow-up recente
  const leadsWhere: any = { companyId };
  if (!includeInactive) {
    leadsWhere.status = { [Op.notIn]: [...INACTIVE_LEAD] };
  }
  const leads = await LeadSale.findAll({
    where: leadsWhere,
    attributes: ["id", "createdAt", "status"]
  });
  const now = Date.now();
  const byLead = new Map<number, number>();
  for (const f of enriched) {
    if (!f.leadSaleId) continue;
    const t = new Date(f.scheduledAt).getTime();
    const prev = byLead.get(f.leadSaleId);
    if (prev == null || t > prev) byLead.set(f.leadSaleId, t);
  }
  let sem_contato = 0;
  for (const lead of leads) {
    const last = byLead.get(lead.id);
    const base = last != null ? last : new Date(lead.createdAt).getTime();
    const days = (now - base) / (1000 * 60 * 60 * 24);
    if (days > semContatoDays) sem_contato += 1;
  }

  const concluidos = enriched.filter(f => f.status === "concluido").length;
  const total = enriched.length;
  const pendentesCount = pendentes.length;

  return res.json({
    hoje,
    atrasados,
    semana,
    sem_contato,
    total,
    concluidos,
    pendentes: pendentesCount,
    taxaConclusao: total > 0 ? Math.round((concluidos / total) * 100) : 0
  });
};

export const sendFollowupWhatsApp = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, id: userId } = req.user as any;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "id inválido" });

  const record = await RealtyFollowup.findOne({ where: { id, companyId } });
  if (!record) return res.status(404).json({ error: "Not found" });

  // Permite override de mensagem / template no body
  const patch = pick(req.body || {}, [
    "messageBody",
    "messageMode",
    "messageTemplateId",
    "whatsappId",
    "metaTemplateQuickMessageId",
    "metaTemplateVariables",
    "ticketId"
  ]);
  if (Object.keys(patch).length) {
    await record.update(patch as any);
  }

  if (req.body?.messageTemplateId && !req.body?.messageBody) {
    const tpl = await RealtyFollowupMessageTemplate.findOne({
      where: { id: Number(req.body.messageTemplateId), companyId, active: true }
    });
    if (tpl) await record.update({ messageBody: tpl.message } as any);
  }

  const lead = record.leadSaleId
    ? await LeadSale.findOne({ where: { id: record.leadSaleId, companyId } })
    : null;

  let resolvedLead = lead;
  if (!resolvedLead && (record as any).contratoId) {
    const contrato = await Contrato.findOne({
      where: { id: (record as any).contratoId, companyId }
    });
    if (contrato?.leadSaleId) {
      resolvedLead = await LeadSale.findOne({
        where: { id: contrato.leadSaleId, companyId }
      });
    }
  }

  const result = await dispatchFollowupWhatsApp({
    followup: record,
    lead: resolvedLead,
    companyId,
    userId,
    openTicket: req.body?.openTicket !== false
  });

  await record.reload();
  const fresh = await RealtyFollowup.findByPk(record.id, {
    include: [
      { model: LeadSale, as: "leadSale", required: false },
      { model: Contrato, as: "contrato", required: false }
    ]
  });
  return res.json({ ...result, followup: enrichFollowupRow(fresh || record) });
};

export const concluirFollowupsInativos = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;
  const all = await RealtyFollowup.findAll({
    where: { companyId, status: { [Op.in]: ["pendente", "aguardando"] } },
    include: [
      { model: LeadSale, as: "leadSale", required: false, attributes: ["id", "status"] },
      { model: Contrato, as: "contrato", required: false, attributes: ["id", "status"] }
    ]
  });

  let closed = 0;
  for (const row of all) {
    const enriched = enrichFollowupRow(row);
    if (!enriched.alvoInativo) continue;
    await row.update({
      status: "concluido",
      completedAt: new Date(),
      result: row.result || "encerrado_alvo_inativo"
    } as any);
    closed += 1;
  }
  return res.json({ closed });
};

// ——— Templates de mensagem de follow-up ———
export const listFollowupTemplates = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;
  const templates = await RealtyFollowupMessageTemplate.findAll({
    where: { companyId },
    order: [["updatedAt", "DESC"]]
  });
  return res.json({ templates });
};

export const storeFollowupTemplate = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;
  const title = String(req.body?.title || "").trim();
  const message = String(req.body?.message || "").trim();
  if (!title || !message) {
    return res.status(400).json({ error: "title e message são obrigatórios" });
  }
  const record = await RealtyFollowupMessageTemplate.create({
    title,
    message,
    active: req.body?.active !== false,
    companyId
  } as any);
  return res.status(201).json(record);
};

export const updateFollowupTemplate = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;
  const record = await RealtyFollowupMessageTemplate.findOne({ where: { id, companyId } });
  if (!record) return res.status(404).json({ error: "Not found" });
  const data = pick(req.body || {}, ["title", "message", "active"]);
  await record.update(data as any);
  return res.json(record);
};

export const removeFollowupTemplate = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;
  const record = await RealtyFollowupMessageTemplate.findOne({ where: { id, companyId } });
  if (!record) return res.status(404).json({ error: "Not found" });
  await record.destroy();
  return res.json({ message: "deleted" });
};

const visitasCrud = crudFactory(
  RealtyVisita,
  ["scheduledAt", "status", "result", "notes", "location", "leadSaleId", "imovelId", "userId", "ticketId"],
  ["status", "result", "notes", "location"],
  "visitas",
  VISITA_STATUSES
);
export const listVisitas = visitasCrud.list;
export const storeVisita = visitasCrud.store;
export const updateVisita = visitasCrud.update;
export const removeVisita = visitasCrud.remove;

const COMPROMISSO_KEYS = [
  "title",
  "description",
  "tipo",
  "dataInicio",
  "dataFim",
  "local",
  "leadSaleId",
  "userId",
  "imovelId",
  "status",
  "lembreteWhatsapp",
  "telefoneLembrete",
  "prioridade",
  "emailCliente",
  "googleMapsLink",
  "confirmado",
  "lembreteNivel",
  "checkinAt",
  "checkoutAt",
  "feedbackVisita",
  "feedbackIa",
  "confirmacaoStatus",
  "confirmacaoToken",
  "confirmacaoMensagem",
  "clienteResposta",
  "dataReagendamentoSugerida",
  "resultadoCliente"
] as const;

function enrichCompromissoRow(row: any) {
  const plain = typeof row?.toJSON === "function" ? row.toJSON() : { ...row };
  const lead = plain.leadSale || null;
  const user = plain.user || null;
  return {
    ...plain,
    leadNome: lead?.name || null,
    leadTelefone: lead?.phone || null,
    leadEmail: lead?.email || null,
    corretorNome: user?.name || null
  };
}

function normalizeCompromissoPayload(body: Record<string, any>, defaults?: { status?: string }) {
  const data = pick(body || {}, [...COMPROMISSO_KEYS]) as Record<string, any>;
  if (data.status !== undefined) {
    data.status = pickAllowedStatus(
      data.status as string,
      COMPROMISSO_STATUSES as any,
      defaults?.status || "pendente"
    );
  }
  if (data.tipo !== undefined) {
    const t = String(data.tipo || "").toLowerCase();
    data.tipo = (COMPROMISSO_TIPOS as readonly string[]).includes(t) ? t : "outro";
  }
  if (data.prioridade !== undefined) {
    const p = String(data.prioridade || "").toLowerCase();
    data.prioridade = (COMPROMISSO_PRIORIDADES as readonly string[]).includes(p) ? p : "media";
  }
  if (data.resultadoCliente !== undefined && data.resultadoCliente !== null && data.resultadoCliente !== "") {
    const r = String(data.resultadoCliente || "").toLowerCase();
    data.resultadoCliente = (COMPROMISSO_RESULTADO_CLIENTE as readonly string[]).includes(r)
      ? r
      : null;
  }
  if (data.lembreteWhatsapp !== undefined) {
    data.lembreteWhatsapp = Boolean(data.lembreteWhatsapp);
  }
  if (data.confirmado !== undefined) {
    data.confirmado = Boolean(data.confirmado);
  }
  ["leadSaleId", "imovelId", "userId"].forEach(k => {
    if (data[k] !== undefined) data[k] = emptyToNull(data[k]);
  });
  ["dataInicio", "dataFim", "checkinAt", "checkoutAt", "dataReagendamentoSugerida"].forEach(k => {
    if (data[k] !== undefined && data[k] !== null && data[k] !== "") {
      data[k] = new Date(data[k] as string);
    } else if (data[k] === "") {
      data[k] = null;
    }
  });
  return data;
}

export const listCompromissos = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { searchParam, pageNumber, pageSize, status, tipo, userId, leadSaleId } = req.query as Record<
    string,
    string
  >;
  const limit = clampPageSize(pageSize, 50, 500);
  const page = +(pageNumber || 1);
  const offset = limit * (page - 1);
  const where: any = { companyId };
  if (status) where.status = status;
  if (tipo) where.tipo = tipo;
  if (userId) where.userId = Number(userId);
  if (leadSaleId) where.leadSaleId = Number(leadSaleId);
  if (searchParam) {
    const like = `%${searchParam}%`;
    where[Op.or] = [
      { title: { [Op.iLike]: like } },
      { description: { [Op.iLike]: like } },
      { tipo: { [Op.iLike]: like } },
      { local: { [Op.iLike]: like } },
      { status: { [Op.iLike]: like } }
    ];
  }

  const { rows, count } = await RealtyCompromisso.findAndCountAll({
    where,
    limit,
    offset,
    order: [["dataInicio", "ASC"]],
    include: [
      {
        model: LeadSale,
        as: "leadSale",
        required: false,
        attributes: ["id", "name", "phone", "email", "status"]
      },
      {
        model: User,
        as: "user",
        required: false,
        attributes: ["id", "name"]
      }
    ]
  });

  return res.json({
    compromissos: rows.map(enrichCompromissoRow),
    count,
    hasMore: count > offset + rows.length
  });
};

export const storeCompromisso = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user as any;
  const data = normalizeCompromissoPayload(req.body || {}, { status: "pendente" });
  if (!data.title) return res.status(400).json({ error: "title é obrigatório" });
  if (!data.dataInicio) return res.status(400).json({ error: "dataInicio é obrigatório" });
  if (!data.tipo) data.tipo = "reuniao";
  if (!data.status) data.status = "pendente";
  if (!data.prioridade) data.prioridade = "media";
  if (data.userId === undefined || data.userId === null) {
    // optional: leave unassigned
  }
  if (data.lembreteWhatsapp === undefined) data.lembreteWhatsapp = false;
  if (data.confirmado === undefined) data.confirmado = false;
  if (data.lembreteNivel === undefined) data.lembreteNivel = 0;
  if (!data.confirmacaoStatus) data.confirmacaoStatus = "pendente";

  const record = await RealtyCompromisso.create({ ...data, companyId } as any);
  const fresh = await RealtyCompromisso.findByPk(record.id, {
    include: [
      { model: LeadSale, as: "leadSale", required: false, attributes: ["id", "name", "phone", "email", "status"] },
      { model: User, as: "user", required: false, attributes: ["id", "name"] }
    ]
  });
  return res.status(201).json(enrichCompromissoRow(fresh || record));
};

export const updateCompromisso = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;
  const record = await RealtyCompromisso.findOne({ where: { id, companyId } });
  if (!record) return res.status(404).json({ error: "Not found" });
  const data = normalizeCompromissoPayload(req.body || {}, { status: record.status || "pendente" });
  await record.update(data as any);
  const fresh = await RealtyCompromisso.findByPk(record.id, {
    include: [
      { model: LeadSale, as: "leadSale", required: false, attributes: ["id", "name", "phone", "email", "status"] },
      { model: User, as: "user", required: false, attributes: ["id", "name"] }
    ]
  });
  return res.json(enrichCompromissoRow(fresh || record));
};

export const removeCompromisso = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;
  const record = await RealtyCompromisso.findOne({ where: { id, companyId } });
  if (!record) return res.status(404).json({ error: "Not found" });
  await record.destroy();
  return res.json({ message: "deleted" });
};

/** Gera mensagem de confirmação (paridade Lovable gerar-confirmacao, sem edge function). */
export const gerarConfirmacaoCompromisso = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;
  const record = await RealtyCompromisso.findOne({
    where: { id, companyId },
    include: [
      { model: LeadSale, as: "leadSale", required: false, attributes: ["id", "name", "phone", "email"] }
    ]
  });
  if (!record) return res.status(404).json({ error: "Not found" });

  const token =
    record.confirmacaoToken ||
    `c${record.id}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const tipoLabel =
    record.tipo === "visita"
      ? "visita ao imóvel"
      : record.tipo === "reuniao"
        ? "reunião"
        : record.tipo === "assinatura"
          ? "assinatura de contrato"
          : "compromisso";
  const when = record.dataInicio
    ? new Date(record.dataInicio).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      })
    : "";
  const leadNome = (record as any).leadSale?.name || "cliente";
  const mensagem =
    record.confirmacaoMensagem ||
    `Olá ${leadNome}! Confirmando nossa ${tipoLabel} "${record.title}" em ${when}${
      record.local ? ` no local ${record.local}` : ""
    }. Pode confirmar sua presença?`;

  const phone = (record.telefoneLembrete || (record as any).leadSale?.phone || "").replace(/\D/g, "");
  const whatsappLink = phone ? `https://wa.me/55${phone}?text=${encodeURIComponent(mensagem)}` : null;
  const confirmationLink = `/agenda/confirmacao/${token}`;

  await record.update({
    confirmacaoToken: token,
    confirmacaoMensagem: mensagem,
    confirmacaoStatus: "enviado"
  } as any);

  return res.json({
    mensagem,
    whatsappLink,
    confirmationLink,
    token,
    compromisso: enrichCompromissoRow(record)
  });
};

const PROPOSTA_KEYS = [
  "title",
  "clienteNome",
  "clienteTelefone",
  "clienteEmail",
  "value",
  "paymentMethod",
  "downPayment",
  "financing",
  "conditions",
  "prazoContrato",
  "status",
  "numeroProposta",
  "validUntil",
  "notes",
  "leadSaleId",
  "imovelId",
  "userId",
  "ticketId"
];

const propostasCrud = crudFactory(
  RealtyProposta,
  PROPOSTA_KEYS,
  ["title", "clienteNome", "clienteTelefone", "clienteEmail", "status", "notes", "paymentMethod"],
  "propostas",
  PROPOSTA_STATUSES
);
export const listPropostas = propostasCrud.list;
export const removeProposta = propostasCrud.remove;

export const storeProposta = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, id: userId } = req.user as any;
  const data = pick(req.body || {}, PROPOSTA_KEYS);

  if (!data.clienteNome && data.title) data.clienteNome = data.title;
  if (!data.clienteNome) {
    return res.status(400).json({ error: "clienteNome is required" });
  }
  if (!data.title) data.title = String(data.clienteNome);

  if (!data.status) data.status = "em_negociacao";
  else data.status = pickAllowedStatus(data.status, PROPOSTA_STATUSES as any, "em_negociacao");

  if (data.paymentMethod === "financiamento") data.financing = true;
  else if (data.financing === undefined) data.financing = false;

  if (data.userId === undefined) data.userId = userId;
  ["leadSaleId", "imovelId", "userId", "ticketId"].forEach(k => {
    if (data[k] !== undefined) data[k] = emptyToNull(data[k]);
  });

  const whereNumero: any = { companyId };
  if (data.imovelId) whereNumero.imovelId = data.imovelId;
  const maxRow = await RealtyProposta.findOne({
    where: whereNumero,
    order: [["numeroProposta", "DESC"]],
    attributes: ["numeroProposta"]
  });
  const nextNum = Number((maxRow as any)?.numeroProposta || 0) + 1;
  data.numeroProposta = nextNum;

  const record = await RealtyProposta.create({ ...data, companyId } as any);
  return res.status(201).json(record);
};

export const updateProposta = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;
  const record = await RealtyProposta.findOne({ where: { id, companyId } });
  if (!record) return res.status(404).json({ error: "Not found" });

  const data = pick(req.body || {}, PROPOSTA_KEYS);
  if (data.clienteNome && !data.title) data.title = String(data.clienteNome);
  if (data.status !== undefined) {
    data.status = pickAllowedStatus(data.status, PROPOSTA_STATUSES as any, record.status || "em_negociacao");
  }
  if (data.paymentMethod === "financiamento") data.financing = true;
  ["leadSaleId", "imovelId", "userId", "ticketId"].forEach(k => {
    if (data[k] !== undefined) data[k] = emptyToNull(data[k]);
  });

  await record.update(data as any);
  return res.json(record);
};

export const sendMatchWhatsApp = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, id: userId } = req.user as any;
  const leadId = Number(req.body?.leadId || req.params.leadId);
  const imovelIds: number[] = Array.isArray(req.body?.imovelIds)
    ? req.body.imovelIds.map(Number).filter((n: number) => Number.isFinite(n))
    : [];

  if (!Number.isFinite(leadId)) {
    return res.status(400).json({ error: "leadId is required" });
  }

  const lead = await LeadSale.findOne({ where: { id: leadId, companyId } });
  if (!lead) return res.status(404).json({ error: "Lead not found" });

  let imoveis = await Imovel.findAll({ where: { companyId } });
  if (imovelIds.length) {
    imoveis = imoveis.filter(i => imovelIds.includes(i.id));
  } else {
    const ranked = rankImoveisForLead(
      {
        interestCity: (lead as any).interestCity,
        interestNeighborhood: (lead as any).interestNeighborhood,
        interestType: (lead as any).interestType,
        bedrooms: (lead as any).bedrooms,
        value: lead.value
      },
      imoveis.map(row => ({
        id: row.id,
        title: row.title,
        city: row.city,
        neighborhood: row.neighborhood,
        type: row.type,
        bedrooms: row.bedrooms,
        price: Number(row.price),
        status: row.status
      })),
      5
    );
    const ids = new Set(ranked.map(r => r.imovelId));
    imoveis = imoveis.filter(i => ids.has(i.id));
  }

  if (!imoveis.length) {
    return res.status(400).json({ error: "Nenhum imóvel compatível para enviar" });
  }

  const lines = imoveis.map((imov, idx) => {
    const code = (imov as any).code ? ` [${(imov as any).code}]` : "";
    return `${idx + 1}) ${imov.title}${code}\n   ${imov.neighborhood || "—"} / ${imov.city || "—"} · ${imov.bedrooms || "?"} qts · R$ ${Number(imov.price || 0).toLocaleString("pt-BR")}`;
  });
  const messageBody =
    `Olá ${lead.name || ""}! Separei opções alinhadas ao seu perfil:\n\n` +
    lines.join("\n\n") +
    `\n\nQual dessas opções gostaria de visitar?`;

  let ticket =
    lead.ticketId != null
      ? await Ticket.findOne({ where: { id: lead.ticketId, companyId } })
      : null;

  if (!ticket) {
    ticket = await ResolveTicketForLeadPreviewService({
      companyId,
      contactId: lead.contactId,
      phone: lead.phone,
      requestUserId: userId
    });
    if (ticket?.id) {
      await lead.update({ ticketId: ticket.id });
    }
  }

  let sent = false;
  let sendError: string | null = null;
  if (ticket) {
    try {
      const fullTicket = await Ticket.findByPk(ticket.id, {
        include: ["contact", "whatsapp"]
      } as any);
      if (fullTicket) {
        await SendWhatsAppMessage({ body: messageBody, ticket: fullTicket as any });
        sent = true;
      }
    } catch (err: any) {
      sendError = err?.message || String(err);
    }
  }

  const now = new Date();
  const envios = [];
  for (const imov of imoveis) {
    const row = await RealtyLeadImovelEnvio.create({
      leadSaleId: lead.id,
      imovelId: imov.id,
      ticketId: ticket?.id || null,
      score: null,
      messageBody,
      sentAt: now,
      userId,
      companyId
    } as any);
    envios.push(row);
  }

  const early = ["novo", "contato", "qualificacao"];
  if (early.includes(String(lead.status || "").toLowerCase())) {
    await lead.update({ status: "imoveis_enviados", imovelId: imoveis[0]?.id || lead.imovelId });
  } else if (!lead.imovelId && imoveis[0]) {
    await lead.update({ imovelId: imoveis[0].id });
  }

  return res.json({
    leadId: lead.id,
    ticketId: ticket?.id || null,
    sent,
    sendError,
    messageBody,
    envios,
    imoveis: imoveis.map(i => ({ id: i.id, title: i.title }))
  });
};

export const leadTimeline = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const leadId = Number(req.query.leadId || req.params.leadId);
  if (!Number.isFinite(leadId)) return res.status(400).json({ error: "leadId required" });
  const lead = await LeadSale.findOne({ where: { id: leadId, companyId } });
  if (!lead) return res.status(404).json({ error: "Lead not found" });

  const [followups, visitas, propostas, envios, nutricao] = await Promise.all([
    RealtyFollowup.findAll({ where: { companyId, leadSaleId: leadId }, order: [["scheduledAt", "DESC"]], limit: 50 }),
    RealtyVisita.findAll({ where: { companyId, leadSaleId: leadId }, order: [["scheduledAt", "DESC"]], limit: 50 }),
    RealtyProposta.findAll({ where: { companyId, leadSaleId: leadId }, order: [["createdAt", "DESC"]], limit: 50 }),
    RealtyLeadImovelEnvio.findAll({ where: { companyId, leadSaleId: leadId }, order: [["sentAt", "DESC"]], limit: 50 }),
    RealtyNutricao.findAll({ where: { companyId, leadSaleId: leadId }, order: [["updatedAt", "DESC"]], limit: 50 })
  ]);

  return res.json({ lead, followups, visitas, propostas, envios, nutricao });
};

const nutricaoCrud = crudFactory(
  RealtyNutricao,
  ["title", "leadSaleId", "cadenceDays", "nextSendAt", "channel", "messageTemplate", "status", "notes", "userId"],
  ["title", "status", "channel", "notes"],
  "items"
);
export const listNutricao = nutricaoCrud.list;
export const storeNutricao = nutricaoCrud.store;
export const updateNutricao = nutricaoCrud.update;
export const removeNutricao = nutricaoCrud.remove;

function applyNutricaoVars(tpl: string, lead: LeadSale | null): string {
  const nome = lead?.name || "cliente";
  const interesse =
    [(lead as any)?.interestType, (lead as any)?.purpose, lead?.description]
      .filter(Boolean)
      .join(" / ") || "imóveis";
  const bairro = (lead as any)?.interestNeighborhood
    ? ` em ${(lead as any).interestNeighborhood}`
    : (lead as any)?.interestCity
      ? ` em ${(lead as any).interestCity}`
      : "";
  const valor = lead?.value
    ? Number(lead.value).toLocaleString("pt-BR")
    : (lead as any)?.priceMax
      ? Number((lead as any).priceMax).toLocaleString("pt-BR")
      : "seu orçamento";
  return String(tpl || "")
    .replace(/\{\{nome\}\}/gi, nome)
    .replace(/\{\{interesse\}\}/gi, interesse)
    .replace(/\{\{bairro\}\}/gi, bairro)
    .replace(/\{\{valor\}\}/gi, valor);
}

export const sendNutricaoWhatsApp = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, id: userId } = req.user as any;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "id inválido" });

  const item = await RealtyNutricao.findOne({ where: { id, companyId } });
  if (!item) return res.status(404).json({ error: "Cadência não encontrada" });

  const lead = item.leadSaleId
    ? await LeadSale.findOne({ where: { id: item.leadSaleId, companyId } })
    : null;
  if (!lead) {
    return res.status(400).json({ error: "Cadência sem lead vinculado", sent: false });
  }

  const messageBody = applyNutricaoVars(item.messageTemplate || "", lead);

  let ticket =
    lead.ticketId != null
      ? await Ticket.findOne({ where: { id: lead.ticketId, companyId } })
      : null;

  if (!ticket) {
    ticket = await ResolveTicketForLeadPreviewService({
      companyId,
      contactId: lead.contactId,
      phone: lead.phone,
      requestUserId: userId
    });
    if (ticket?.id) await lead.update({ ticketId: ticket.id });
  }

  let sent = false;
  let sendError: string | null = null;
  if (ticket) {
    try {
      const fullTicket = await Ticket.findByPk(ticket.id, {
        include: ["contact", "whatsapp"]
      } as any);
      if (fullTicket) {
        await SendWhatsAppMessage({ body: messageBody, ticket: fullTicket as any });
        sent = true;
      }
    } catch (err: any) {
      sendError = err?.message || String(err);
    }
  }

  const cadence = Number(item.cadenceDays) || 7;
  const next = new Date();
  next.setDate(next.getDate() + cadence);
  await item.update({
    nextSendAt: next,
    notes: [item.notes, sent ? `Enviado WA ${new Date().toISOString()}` : `Falha WA: ${sendError || "sem ticket"}`]
      .filter(Boolean)
      .join("\n")
      .slice(0, 4000)
  } as any);

  return res.json({
    sent,
    error: sendError,
    ticket: ticket ? { id: ticket.id, uuid: (ticket as any).uuid, status: ticket.status } : null,
    preview: messageBody,
    item
  });
};

export const processNutricao = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, id: userId } = req.user as any;
  const { processNutricaoCompany } = await import(
    "../services/RealtyServices/ProcessNutricaoService"
  );
  const autoSend = req.body?.autoSend !== false && req.query?.autoSend !== "false";
  const result = await processNutricaoCompany({ companyId, userId, autoSend });
  return res.json({ success: true, ...result });
};

const prospeccaoCrud = crudFactory(
  RealtyProspeccao,
  ["title", "prospectDate", "leadSaleId", "phone", "targetCount", "doneCount", "status", "notes", "userId", "ticketId"],
  ["title", "status", "phone", "notes"],
  "items"
);
export const listProspeccao = prospeccaoCrud.list;
export const storeProspeccao = prospeccaoCrud.store;
export const updateProspeccao = prospeccaoCrud.update;
export const removeProspeccao = prospeccaoCrud.remove;

function toIntNonNeg(v: any, fallback = 0): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.floor(n);
}

function normalizeDateOnly(v: any): string | null {
  if (v == null || v === "") return null;
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Lista registros diários (últimos 90 dias). */
export const listProspeccaoDiaria = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const rows = await RealtyProspeccaoDiaria.findAll({
    where: { companyId },
    order: [["data", "DESC"]],
    limit: 90
  });
  return res.json({ registros: rows });
};

const CAPTACAO_KEYS = [
  "tipo",
  "nomeContato",
  "telefoneContato",
  "emailContato",
  "enderecoImovel",
  "bairro",
  "cidade",
  "estado",
  "tipoImovel",
  "operacao",
  "nomeConstrutora",
  "nomeCondominio",
  "observacoes",
  "status",
  "userId"
] as const;

function emptyStrToNull(v: any): any {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v === "string" && v.trim() === "") return null;
  return v;
}

function normalizeCaptacaoPayload(body: Record<string, any>, { partial = false } = {}) {
  const data = pick(body || {}, [...CAPTACAO_KEYS]);

  // Aceita aliases snake_case do Lovable
  const aliases: Record<string, string> = {
    nome_contato: "nomeContato",
    telefone_contato: "telefoneContato",
    email_contato: "emailContato",
    endereco_imovel: "enderecoImovel",
    tipo_imovel: "tipoImovel",
    nome_construtora: "nomeConstrutora",
    nome_condominio: "nomeCondominio"
  };
  for (const [snake, camel] of Object.entries(aliases)) {
    if (data[camel] === undefined && body?.[snake] !== undefined) {
      data[camel] = body[snake];
    }
  }

  if (data.tipo !== undefined) {
    data.tipo = String(data.tipo).trim().toLowerCase();
    if (!isValidCaptacaoTipo(data.tipo)) {
      throw new Error(`tipo inválido. Use: ${CAPTACAO_TIPOS.join(", ")}`);
    }
  } else if (!partial) {
    data.tipo = "porteiro";
  }

  if (data.nomeContato !== undefined) {
    data.nomeContato = String(data.nomeContato || "").trim();
  }

  if (!partial && !data.nomeContato) {
    throw new Error("nomeContato é obrigatório");
  }
  if (partial && data.nomeContato !== undefined && !data.nomeContato) {
    throw new Error("nomeContato é obrigatório");
  }

  if (data.status !== undefined) {
    data.status = pickAllowedStatus(data.status, CAPTACAO_STATUSES as any, "pendente");
  } else if (!partial) {
    data.status = "pendente";
  }

  if (data.tipoImovel !== undefined) {
    const tip = String(data.tipoImovel || "").trim();
    data.tipoImovel = (CAPTACAO_TIPOS_IMOVEL as readonly string[]).includes(tip)
      ? tip
      : "Apartamento";
  } else if (!partial) {
    data.tipoImovel = "Apartamento";
  }

  if (data.operacao !== undefined) {
    const op = String(data.operacao || "").trim();
    // Aceita Aluguel como alias de Locação (bug histórico Lovable ranking)
    if (op === "Aluguel" || op === "aluguel") data.operacao = "Locação";
    else if ((CAPTACAO_OPERACOES as readonly string[]).includes(op)) data.operacao = op;
    else data.operacao = "Venda";
  } else if (!partial) {
    data.operacao = "Venda";
  }

  if (data.estado !== undefined) {
    data.estado = data.estado ? String(data.estado).trim().toUpperCase().slice(0, 2) : "SP";
  } else if (!partial) {
    data.estado = "SP";
  }

  [
    "telefoneContato",
    "emailContato",
    "enderecoImovel",
    "bairro",
    "cidade",
    "nomeConstrutora",
    "nomeCondominio",
    "observacoes"
  ].forEach(k => {
    if (data[k] !== undefined) data[k] = emptyStrToNull(data[k]);
  });

  if (data.userId !== undefined) data.userId = emptyToNull(data.userId);

  return data;
}

/** Captações por canal — paridade Lovable `captacoes`. */
export const listCaptacoes = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { searchParam, pageNumber, pageSize, status, tipo } = req.query as Record<string, string>;
  const limit = clampPageSize(pageSize, 200, 500);
  const page = +(pageNumber || 1);
  const offset = limit * (page - 1);
  const where: any = { companyId };
  if (status) where.status = status;
  if (tipo && isValidCaptacaoTipo(tipo)) where.tipo = tipo;
  if (searchParam) {
    const like = `%${searchParam}%`;
    where[Op.or] = [
      { nomeContato: { [Op.iLike]: like } },
      { telefoneContato: { [Op.iLike]: like } },
      { emailContato: { [Op.iLike]: like } },
      { enderecoImovel: { [Op.iLike]: like } },
      { bairro: { [Op.iLike]: like } },
      { cidade: { [Op.iLike]: like } },
      { nomeConstrutora: { [Op.iLike]: like } },
      { nomeCondominio: { [Op.iLike]: like } },
      { observacoes: { [Op.iLike]: like } }
    ];
  }
  const { rows, count } = await RealtyCaptacao.findAndCountAll({
    where,
    limit,
    offset,
    order: [["createdAt", "DESC"]]
  });
  return res.json({
    captacoes: rows,
    count,
    hasMore: count > offset + rows.length
  });
};

export const storeCaptacao = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, id: userId } = req.user as any;
  try {
    const data = normalizeCaptacaoPayload(req.body || {}, { partial: false });
    if (data.userId === undefined) data.userId = userId;
    const record = await RealtyCaptacao.create({ ...data, companyId } as any);
    return res.status(201).json(record);
  } catch (err: any) {
    return res.status(400).json({ error: err?.message || "Dados inválidos" });
  }
};

export const updateCaptacao = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;
  const record = await RealtyCaptacao.findOne({ where: { id, companyId } });
  if (!record) return res.status(404).json({ error: "Not found" });
  try {
    const data = normalizeCaptacaoPayload(req.body || {}, { partial: true });
    await record.update(data);
    return res.json(record);
  } catch (err: any) {
    return res.status(400).json({ error: err?.message || "Dados inválidos" });
  }
};

export const removeCaptacao = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;
  const record = await RealtyCaptacao.findOne({ where: { id, companyId } });
  if (!record) return res.status(404).json({ error: "Not found" });
  await record.destroy();
  return res.json({ message: "deleted" });
};

/** Upsert por (companyId, data) — paridade Lovable. */
export const upsertProspeccaoDiaria = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, id: userId } = req.user as any;
  const body = req.body || {};
  const data = normalizeDateOnly(body.data);
  if (!data) {
    return res.status(400).json({ error: "Data inválida" });
  }

  const payload = {
    prospeccoesAluguel: toIntNonNeg(body.prospeccoesAluguel ?? body.prospeccoes_aluguel),
    prospeccoesVenda: toIntNonNeg(body.prospeccoesVenda ?? body.prospeccoes_venda),
    proprietariosContatados: toIntNonNeg(
      body.proprietariosContatados ?? body.proprietarios_contatados
    ),
    leadsConversados: toIntNonNeg(body.leadsConversados ?? body.leads_conversados),
    observacoes:
      body.observacoes != null && String(body.observacoes).trim() !== ""
        ? String(body.observacoes).trim()
        : null,
    userId: userId != null ? Number(userId) : null
  };

  const existing = await RealtyProspeccaoDiaria.findOne({
    where: { companyId, data }
  });

  if (existing) {
    await existing.update(payload as any);
    return res.json(existing);
  }

  const created = await RealtyProspeccaoDiaria.create({
    companyId,
    data,
    ...payload
  } as any);
  return res.status(201).json(created);
};

export const removeProspeccaoDiaria = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const id = Number(req.params.id);
  const row = await RealtyProspeccaoDiaria.findOne({ where: { id, companyId } });
  if (!row) return res.status(404).json({ error: "Registro não encontrado" });
  await row.destroy();
  return res.json({ ok: true });
};

/* ─── Consulta CPF (paridade Lovable credit-check + ConsultaCPFWidget) ─── */

export const creditCheckConsultaCpf = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId, id: userId } = req.user as any;
  const body = req.body || {};
  const cpf = body.cpf;
  const lgpdConsent = body.lgpdConsent === true || body.lgpdConsent === "true" || body.lgpd_consent === true;
  const contratoId =
    body.contratoId != null
      ? Number(body.contratoId)
      : body.contrato_id != null
        ? Number(body.contrato_id)
        : null;

  if (!lgpdConsent) {
    return res.status(400).json({
      error: "Marque o consentimento antes de consultar."
    });
  }

  const validationError = validateCpfForCreditCheck(cpf);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const cleanCpf = digitsOnlyCpf(cpf);

  let result;
  try {
    result = await runCreditCheck(cleanCpf);
  } catch (err: any) {
    if (err instanceof CreditCheckConfigError) {
      return res.status(503).json({ error: err.message });
    }
    if (err instanceof CreditCheckProviderError) {
      return res.status(502).json({ error: err.message });
    }
    return res.status(500).json({
      error: err?.message || "Erro ao processar consulta de crédito. Tente novamente."
    });
  }

  try {
    await RealtyConsultaCpf.create({
      companyId,
      userId: userId != null ? Number(userId) : null,
      cpf: cleanCpf,
      cpfMasked: result.cpfMasked,
      lgpdConsent: true,
      contratoId: Number.isFinite(contratoId as number) ? (contratoId as number) : null,
      score: result.score,
      riskLevel: result.riskLevel,
      status: result.status,
      simulated: false,
      resultado: result as any,
      consultedAt: new Date(result.consultedAt)
    } as any);
  } catch (err) {
    console.error("[consulta-cpf] Falha ao persistir histórico:", (err as Error)?.message);
  }

  return res.json(result);
};

export const listConsultaCpfHistorico = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;
  const rows = await RealtyConsultaCpf.findAll({
    where: { companyId },
    order: [["consultedAt", "DESC"]],
    limit: 50,
    attributes: [
      "id",
      "cpfMasked",
      "score",
      "riskLevel",
      "status",
      "simulated",
      "consultedAt",
      "contratoId"
    ]
  });
  return res.json({ items: rows });
};

/* ─── Relacionamento (paridade Lovable clientes_relacionamento) ─── */

function serializeClienteRelacionamento(row: RealtyClienteRelacionamento) {
  const plain: any = row.toJSON ? row.toJSON() : row;
  const filhos = Array.isArray(plain.filhos)
    ? plain.filhos.map((f: any) => ({
        nome: f?.nome || "",
        dataNascimento: f?.dataNascimento || f?.data_nascimento || ""
      }))
    : [];
  return { ...plain, filhos };
}

export const listClientesRelacionamento = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;
  const rows = await RealtyClienteRelacionamento.findAll({
    where: { companyId },
    order: [["nome", "ASC"]]
  });
  return res.json({
    clientes: rows.map(serializeClienteRelacionamento),
    count: rows.length
  });
};

export const storeClienteRelacionamento = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;
  const data = normalizeClienteRelacionamentoPayload(req.body || {});
  if (!data.nome) {
    return res.status(400).json({ error: "Nome é obrigatório" });
  }

  const phone = digitsOnly(data.telefone);
  const email = data.email ? String(data.email).trim().toLowerCase() : "";
  const warnings: string[] = [];

  if (phone && phone.length >= 8) {
    const phoneMatches = await RealtyClienteRelacionamento.findAll({
      where: {
        companyId,
        telefone: { [Op.iLike]: `%${phone.slice(-8)}%` }
      },
      attributes: ["id", "nome", "telefone"],
      limit: 1
    });
    if (phoneMatches.length > 0) {
      warnings.push(
        `Já existe "${phoneMatches[0].nome}" com telefone semelhante. Verifique antes de cadastrar.`
      );
    }
  }

  if (email) {
    const emailMatches = await RealtyClienteRelacionamento.findAll({
      where: {
        companyId,
        email: { [Op.iLike]: email }
      },
      attributes: ["id", "nome", "email"],
      limit: 1
    });
    if (emailMatches.length > 0) {
      warnings.push(
        `Já existe "${emailMatches[0].nome}" com o mesmo e-mail. Verifique antes de cadastrar.`
      );
    }
  }

  if (warnings.length) {
    return res.status(409).json({ error: "Contato possivelmente duplicado", warnings });
  }

  const record = await RealtyClienteRelacionamento.create({ ...data, companyId } as any);
  return res.status(201).json(serializeClienteRelacionamento(record));
};

export const updateClienteRelacionamento = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;
  const id = Number(req.params.id);
  const record = await RealtyClienteRelacionamento.findOne({ where: { id, companyId } });
  if (!record) return res.status(404).json({ error: "Cliente não encontrado" });

  const data = normalizeClienteRelacionamentoPayload(req.body || {}, { partial: true });
  if (data.nome !== undefined && !data.nome) {
    return res.status(400).json({ error: "Nome é obrigatório" });
  }
  await record.update(data as any);
  return res.json(serializeClienteRelacionamento(record));
};

export const removeClienteRelacionamento = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;
  const id = Number(req.params.id);
  const record = await RealtyClienteRelacionamento.findOne({ where: { id, companyId } });
  if (!record) return res.status(404).json({ error: "Cliente não encontrado" });
  await record.destroy();
  return res.json({ message: "deleted" });
};

export const listMensagemTemplates = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;
  const rows = await RealtyMensagemTemplate.findAll({
    where: { companyId },
    order: [["tipo", "ASC"]]
  });
  return res.json({ templates: rows, defaults: TEMPLATE_TIPOS });
};

export const upsertMensagemTemplate = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;
  const tipo = String(req.body?.tipo || "").trim();
  const mensagem = String(req.body?.mensagem || "").trim();
  if (!isValidTemplateTipo(tipo)) {
    return res.status(400).json({ error: "Tipo de template inválido" });
  }
  if (!mensagem) {
    return res.status(400).json({ error: "Mensagem é obrigatória" });
  }

  const existing = await RealtyMensagemTemplate.findOne({ where: { companyId, tipo } });
  if (existing) {
    await existing.update({ mensagem, ativo: true } as any);
    return res.json(existing);
  }
  const created = await RealtyMensagemTemplate.create({
    companyId,
    tipo,
    mensagem,
    ativo: true
  } as any);
  return res.status(201).json(created);
};

export const gerarMensagensRelacionamentoIa = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user as any;
  const tipo = String(req.body?.tipo || "").trim();
  const contexto = String(req.body?.contexto || "").trim();

  if (!isValidTemplateTipo(tipo)) {
    return res.status(400).json({ error: "Tipo de template inválido" });
  }

  const tipoLabels: Record<string, string> = {
    aniversario: "aniversário do cliente",
    casamento: "aniversário de casamento do cliente",
    profissao: "dia da profissão do cliente",
    filho_aniversario: "aniversário do filho do cliente",
    mudanca: "aniversário de mudança do cliente",
    compra_imovel: "aniversário de compra do imóvel",
    reativacao: "reativação de cliente inativo"
  };
  const variaveis: Record<string, string> = {
    aniversario: "{nome} = primeiro nome do cliente",
    casamento: "{nome} = primeiro nome do cliente",
    profissao: "{nome} = primeiro nome do cliente, {profissao} = profissão do cliente",
    filho_aniversario: "{nome} = primeiro nome do cliente, {filho} = nome do filho",
    mudanca: "{nome} = primeiro nome do cliente",
    compra_imovel: "{nome} = primeiro nome do cliente",
    reativacao: "{nome} = primeiro nome do cliente"
  };

  const systemPrompt = `Você é um especialista em marketing de relacionamento para imobiliárias brasileiras.
Gere exatamente 5 mensagens curtas e carinhosas para ${tipoLabels[tipo] || "evento especial"}.
Cada mensagem deve usar as variáveis: ${variaveis[tipo] || "{nome}"}.
Use emojis relevantes no início de cada mensagem.
Responda APENAS com as 5 mensagens, uma por linha, sem numeração.
${contexto ? `Contexto adicional do usuário: ${contexto}` : ""}`;

  try {
    const text = await composerAssistTransform({
      companyId,
      systemPrompt,
      userPrompt: `Gere 5 mensagens para ${tipoLabels[tipo] || tipo}. Sejam criativas e únicas.`
    });
    const mensagens = String(text || "")
      .split(/\r?\n/)
      .map(l => l.replace(/^\d+[\).\-\s]+/, "").trim())
      .filter(Boolean)
      .slice(0, 5);
    if (mensagens.length >= 3) {
      return res.json({ mensagens, source: "composerAssist" });
    }
  } catch (err: any) {
    logger.warn(`[RelacionamentoIA] composerAssist falhou: ${err?.message || err}`);
  }

  // Fallback: opções padrão do tipo (paridade funcional sem IA)
  const def = TEMPLATE_TIPOS.find(t => t.value === tipo);
  return res.json({
    mensagens: def?.opcoes?.slice(0, 5) || [getDefaultTemplate(tipo)],
    source: "fallback"
  });
};

const automacaoCrud = crudFactory(
  RealtyAutomacaoFollowup,
  ["title", "trigger", "daysWithoutContact", "fromStatus", "toStatus", "action", "messageTemplate", "active", "notes"],
  ["title", "trigger", "action", "notes"],
  "items"
);

function coerceAutomacaoBody(body: Record<string, any>) {
  const data = pick(body || {}, [
    "title",
    "trigger",
    "daysWithoutContact",
    "fromStatus",
    "toStatus",
    "action",
    "messageTemplate",
    "active",
    "notes"
  ]);
  if (data.active !== undefined) {
    data.active = data.active === true || data.active === "true" || data.active === 1 || data.active === "1";
  }
  if (data.daysWithoutContact !== undefined && data.daysWithoutContact !== null && data.daysWithoutContact !== "") {
    data.daysWithoutContact = Number(data.daysWithoutContact) || 3;
  }
  return data;
}

export const listAutomacaoFollowup = automacaoCrud.list;
export const removeAutomacaoFollowup = automacaoCrud.remove;

export const storeAutomacaoFollowup = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const data = coerceAutomacaoBody(req.body || {});
  if (!data.title) return res.status(400).json({ error: "title is required" });
  if (data.active === undefined) data.active = true;
  if (!data.action) data.action = "criar_followup";
  if (data.daysWithoutContact === undefined) data.daysWithoutContact = 3;
  const record = await RealtyAutomacaoFollowup.create({ ...data, companyId } as any);
  return res.status(201).json(record);
};

export const updateAutomacaoFollowup = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;
  const record = await RealtyAutomacaoFollowup.findOne({ where: { id, companyId } });
  if (!record) return res.status(404).json({ error: "Not found" });
  const data = coerceAutomacaoBody(req.body || {});
  await record.update(data as any);
  return res.json(record);
};

export const getFilaConfig = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  let cfg = await RealtyFilaConfig.findOne({ where: { companyId, active: true }, order: [["id", "DESC"]] });
  if (!cfg) {
    cfg = await RealtyFilaConfig.create({
      companyId,
      strategy: "round_robin",
      userIds: [],
      active: true
    } as any);
  }
  return res.json(cfg);
};

export const saveFilaConfig = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const data = pick(req.body || {}, ["strategy", "lastUserId", "userIds", "active", "notes"]);
  let cfg = await RealtyFilaConfig.findOne({ where: { companyId }, order: [["id", "DESC"]] });
  if (!cfg) {
    cfg = await RealtyFilaConfig.create({ ...data, companyId, strategy: data.strategy || "round_robin" } as any);
  } else {
    await cfg.update(data as any);
  }
  return res.json(cfg);
};

async function buildCorretoresCap(companyId: number) {
  const [corretores, users, leads] = await Promise.all([
    RealtyModulo.findAll({
      where: { companyId, kind: "corretor" },
      order: [["title", "ASC"]],
      limit: 200
    }),
    User.findAll({
      where: { companyId },
      attributes: ["id", "name"],
      order: [["id", "ASC"]],
      limit: 200
    }),
    LeadSale.findAll({
      where: {
        companyId,
        responsibleId: { [Op.ne]: null },
        status: { [Op.notIn]: FILA_CLOSED_STATUSES }
      },
      attributes: ["id", "responsibleId", "status"]
    })
  ]);

  const usersById = new Map(users.map((u: any) => [Number(u.id), u]));
  const usersByName = new Map(
    users.map((u: any) => [String(u.name || "").trim().toLowerCase(), u])
  );
  const ativosByUser = new Map<number, number>();
  for (const l of leads) {
    const rid = Number((l as any).responsibleId);
    if (!Number.isFinite(rid)) continue;
    ativosByUser.set(rid, (ativosByUser.get(rid) || 0) + 1);
  }

  return corretores.map((c: any) => {
    const payload = (c.payload && typeof c.payload === "object" ? c.payload : {}) as any;
    let userId = payload.userId != null ? Number(payload.userId) : null;
    if (!Number.isFinite(userId) || userId <= 0) {
      const byName = usersByName.get(String(c.title || "").trim().toLowerCase());
      userId = byName ? Number(byName.id) : null;
    }
    const limite = Math.max(0, Math.floor(Number(payload.limite ?? 20) || 0));
    const ativos = userId ? ativosByUser.get(userId) || 0 : 0;
    const status =
      String(payload.statusCorretor || c.status || "ativo").toLowerCase() === "ativo"
        ? "ativo"
        : String(payload.statusCorretor || c.status || "inativo");
    return {
      corretor_id: String(c.id),
      moduloId: Number(c.id),
      nome: c.title || `Corretor #${c.id}`,
      status,
      limite,
      ativos,
      capacidade_livre: Math.max(0, limite - ativos),
      userId: userId && usersById.has(userId) ? userId : null,
      payload
    };
  });
}

export const getFilaOverview = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const statusFilter = String(req.query.status || "pending");

  const [caps, leads, cfg] = await Promise.all([
    buildCorretoresCap(companyId),
    LeadSale.findAll({
      where: { companyId },
      include: [{ model: User, as: "responsible", attributes: ["id", "name"], required: false }],
      order: [["createdAt", "ASC"]],
      limit: 500
    }),
    RealtyFilaConfig.findOne({ where: { companyId }, order: [["id", "DESC"]] })
  ]);

  const userNameById = new Map(
    caps.filter(c => c.userId).map(c => [c.userId as number, c.nome])
  );

  const fila = leads
    .map((lead: any) => {
      const closed = isLeadClosed(lead.status);
      const hasResp = lead.responsibleId != null;
      let qStatus: "pending" | "assigned" | "closed" = "pending";
      if (closed) qStatus = "closed";
      else if (hasResp) qStatus = "assigned";
      const ai_score = leadAiScore(lead);
      return {
        id: String(lead.id),
        leadId: Number(lead.id),
        source: lead.origin || "crm",
        ai_score,
        payload: {
          nome: lead.name,
          bairro: lead.interestNeighborhood || lead.address?.neighborhood || null,
          cidade: lead.interestCity || lead.address?.city || null,
          operacao: lead.purpose || lead.interestType || null,
          telefone: lead.phone || null,
          temperatura: lead.temperature || null
        },
        status: qStatus,
        leadStatus: lead.status,
        corretor_id: lead.responsibleId != null ? String(lead.responsibleId) : null,
        corretor: hasResp
          ? {
              nome:
                lead.responsible?.name ||
                userNameById.get(Number(lead.responsibleId)) ||
                `Usuário #${lead.responsibleId}`
            }
          : null,
        created_at: lead.createdAt,
        assigned_at: hasResp ? lead.updatedAt : null,
        closed_at: closed ? lead.updatedAt : null
      };
    })
    .filter(row => {
      if (statusFilter === "all") return row.status !== "closed";
      return row.status === statusFilter;
    })
    .sort((a, b) => {
      if (b.ai_score !== a.ai_score) return b.ai_score - a.ai_score;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

  return res.json({
    fila,
    caps,
    config: cfg,
    totals: {
      pend: leads.filter((l: any) => !l.responsibleId && !isLeadClosed(l.status)).length,
      atrib: leads.filter((l: any) => l.responsibleId && !isLeadClosed(l.status)).length,
      capTotal: caps.reduce((a, c) => a + c.limite, 0),
      capUsada: caps.reduce((a, c) => a + c.ativos, 0)
    }
  });
};

export const assignFilaLead = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const leadId = Number(req.body?.leadId);
  let userId = req.body?.userId != null ? Number(req.body.userId) : null;
  if (!Number.isFinite(leadId)) return res.status(400).json({ error: "leadId required" });

  const lead = await LeadSale.findOne({ where: { id: leadId, companyId } });
  if (!lead) return res.status(404).json({ error: "Lead not found" });

  let cfg = await RealtyFilaConfig.findOne({ where: { companyId }, order: [["id", "DESC"]] });
  if (!cfg) {
    cfg = await RealtyFilaConfig.create({ companyId, strategy: "round_robin", userIds: [], active: true } as any);
  }

  const caps = await buildCorretoresCap(companyId);

  if (!userId) {
    const eligible = caps.filter(
      c => c.userId && c.status === "ativo" && c.capacidade_livre > 0
    );
    let pool: number[] = eligible.map(c => c.userId as number);

    if (!pool.length) {
      pool = Array.isArray((cfg as any).userIds) && (cfg as any).userIds.length
        ? (cfg as any).userIds.map(Number)
        : (
            await User.findAll({
              where: { companyId },
              attributes: ["id"],
              order: [["id", "ASC"]],
              limit: 50
            })
          ).map((u: any) => u.id);
    }

    if (!pool.length) return res.status(400).json({ error: "Nenhum corretor na fila" });

    if ((cfg as any).strategy === "round_robin" || !(cfg as any).strategy) {
      const last = Number((cfg as any).lastUserId) || 0;
      const idx = pool.findIndex(id => id === last);
      userId = pool[(idx + 1) % pool.length];
    } else {
      userId = pool[0];
    }
  }

  await lead.update({ responsibleId: userId } as any);
  await cfg.update({ lastUserId: userId } as any);

  return res.json({ lead, assignedUserId: userId });
};

export const distribuirFila = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;

  let cfg = await RealtyFilaConfig.findOne({ where: { companyId }, order: [["id", "DESC"]] });
  if (!cfg) {
    cfg = await RealtyFilaConfig.create({ companyId, strategy: "round_robin", userIds: [], active: true } as any);
  }

  const pending = await LeadSale.findAll({
    where: {
      companyId,
      responsibleId: null,
      status: { [Op.notIn]: FILA_CLOSED_STATUSES }
    },
    limit: 500
  });

  pending.sort((a: any, b: any) => {
    const sa = leadAiScore(a);
    const sb = leadAiScore(b);
    if (sb !== sa) return sb - sa;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  const caps = await buildCorretoresCap(companyId);
  let slots = caps
    .filter(c => c.userId && c.status === "ativo" && c.capacidade_livre > 0)
    .map(c => ({
      userId: c.userId as number,
      livre: c.capacidade_livre
    }));

  if (!slots.length) {
    const users = await User.findAll({
      where: { companyId },
      attributes: ["id"],
      order: [["id", "ASC"]],
      limit: 50
    });
    const ativos = await LeadSale.findAll({
      where: {
        companyId,
        responsibleId: { [Op.ne]: null },
        status: { [Op.notIn]: FILA_CLOSED_STATUSES }
      },
      attributes: ["responsibleId"]
    });
    const countByUser = new Map<number, number>();
    for (const l of ativos) {
      const rid = Number((l as any).responsibleId);
      countByUser.set(rid, (countByUser.get(rid) || 0) + 1);
    }
    const defaultLim = 20;
    slots = users
      .map((u: any) => {
        const uid = Number(u.id);
        const usados = countByUser.get(uid) || 0;
        return { userId: uid, livre: Math.max(0, defaultLim - usados) };
      })
      .filter(s => s.livre > 0);
  }

  if (!slots.length) {
    return res.json({
      relatorio: [
        {
          resultado: {
            atribuidos: 0,
            restantes: pending.length,
            sem_corretor_elegivel: true
          }
        }
      ]
    });
  }

  let last = Number((cfg as any).lastUserId) || 0;
  let startIdx = slots.findIndex(s => s.userId === last);
  if (startIdx < 0) startIdx = -1;
  let cursor = startIdx;
  let atribuidos = 0;

  for (const lead of pending) {
    let picked: { userId: number; livre: number } | null = null;
    for (let i = 0; i < slots.length; i += 1) {
      cursor = (cursor + 1) % slots.length;
      if (slots[cursor].livre > 0) {
        picked = slots[cursor];
        break;
      }
    }
    if (!picked) break;
    await (lead as any).update({ responsibleId: picked.userId });
    picked.livre -= 1;
    last = picked.userId;
    atribuidos += 1;
  }

  await cfg.update({ lastUserId: last } as any);

  return res.json({
    relatorio: [
      {
        resultado: {
          atribuidos,
          restantes: pending.length - atribuidos,
          sem_corretor_elegivel: atribuidos === 0 && pending.length > 0
        }
      }
    ]
  });
};

export const setLimiteCorretorFila = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const moduloId = Number(req.body?.corretor_id || req.params?.id);
  const limite = Math.max(0, Math.floor(Number(req.body?.limite) || 0));
  if (!Number.isFinite(moduloId)) return res.status(400).json({ error: "corretor_id required" });

  const row = await RealtyModulo.findOne({ where: { id: moduloId, companyId, kind: "corretor" } });
  if (!row) return res.status(404).json({ error: "Corretor not found" });

  const payload = { ...((row as any).payload || {}), limite };
  await row.update({ payload } as any);
  return res.json(row);
};

export const encerrarLeadFila = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const leadId = Number(req.params.id || req.body?.leadId);
  if (!Number.isFinite(leadId)) return res.status(400).json({ error: "leadId required" });

  const lead = await LeadSale.findOne({ where: { id: leadId, companyId } });
  if (!lead) return res.status(404).json({ error: "Lead not found" });

  await lead.update({ status: "fechado" } as any);
  return res.json(lead);
};

export const runAutomacoesFollowup = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, id: userId } = req.user as any;
  const rules = await RealtyAutomacaoFollowup.findAll({
    where: { companyId, active: true }
  });
  const created: any[] = [];
  const sentMessages: any[] = [];
  const now = Date.now();

  for (const rule of rules) {
    const days = Number((rule as any).daysWithoutContact) || 3;
    const cutoff = new Date(now - days * 24 * 60 * 60 * 1000);
    const where: any = { companyId };
    if ((rule as any).fromStatus) where.status = (rule as any).fromStatus;

    const leads = await LeadSale.findAll({
      where: {
        ...where,
        [Op.or]: [
          { followUpAt: { [Op.lt]: cutoff } },
          { followUpAt: null, updatedAt: { [Op.lt]: cutoff } }
        ]
      },
      limit: 100
    });

    for (const lead of leads) {
      const action = String((rule as any).action || "criar_followup");
      const scheduledAt = new Date(now + 60 * 60 * 1000);

      if (action === "enviar_mensagem") {
        const tpl = String((rule as any).messageTemplate || "").trim();
        const messageBody = tpl
          ? applyNutricaoVars(tpl, lead)
          : `Olá ${lead.name || ""}! Passando para retomar nosso contato sobre imóveis. Podemos conversar?`;

        let ticket =
          lead.ticketId != null
            ? await Ticket.findOne({ where: { id: lead.ticketId, companyId } })
            : null;
        if (!ticket) {
          ticket = await ResolveTicketForLeadPreviewService({
            companyId,
            contactId: lead.contactId,
            phone: lead.phone,
            requestUserId: userId
          });
          if (ticket?.id) await lead.update({ ticketId: ticket.id });
        }

        let sent = false;
        if (ticket) {
          try {
            const fullTicket = await Ticket.findByPk(ticket.id, {
              include: ["contact", "whatsapp"]
            } as any);
            if (fullTicket) {
              await SendWhatsAppMessage({ body: messageBody, ticket: fullTicket as any });
              sent = true;
            }
          } catch {
            sent = false;
          }
        }

        const fu = await RealtyFollowup.create({
          type: "whatsapp",
          scheduledAt: sent ? new Date() : scheduledAt,
          completedAt: sent ? new Date() : null,
          status: sent ? "concluido" : "pendente",
          notes: `Auto msg: ${(rule as any).title}\n${messageBody}`.slice(0, 4000),
          result: sent ? "enviado_whatsapp" : "aguardando_envio",
          leadSaleId: lead.id,
          userId: lead.responsibleId || userId,
          ticketId: ticket?.id || lead.ticketId,
          companyId
        } as any);
        await lead.update({
          followUpAt: scheduledAt,
          nextContactAt: scheduledAt,
          ...((rule as any).toStatus ? { status: (rule as any).toStatus } : {})
        } as any);
        created.push({ leadId: lead.id, followupId: fu.id, ruleId: rule.id, action });
        sentMessages.push({ leadId: lead.id, sent, ruleId: rule.id });
        continue;
      }

      // default: criar_followup
      const fu = await RealtyFollowup.create({
        type: "whatsapp",
        scheduledAt,
        status: "pendente",
        notes: `Auto: ${(rule as any).title}`,
        leadSaleId: lead.id,
        userId: lead.responsibleId || userId,
        ticketId: lead.ticketId,
        companyId
      } as any);
      await lead.update({ followUpAt: scheduledAt, nextContactAt: scheduledAt } as any);
      if ((rule as any).toStatus) {
        await lead.update({ status: (rule as any).toStatus } as any);
      }
      created.push({ leadId: lead.id, followupId: fu.id, ruleId: rule.id, action });
    }
  }

  return res.json({ created, sentMessages, count: created.length });
};

export const sendComparativoWhatsApp = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, id: userId } = req.user as any;
  const leadId = Number(req.body?.leadId);
  const imovelIds: number[] = Array.isArray(req.body?.imovelIds)
    ? req.body.imovelIds.map(Number).filter((n: number) => Number.isFinite(n))
    : [];
  if (!Number.isFinite(leadId) || imovelIds.length < 2) {
    return res.status(400).json({ error: "leadId e ao menos 2 imovelIds são obrigatórios" });
  }

  const lead = await LeadSale.findOne({ where: { id: leadId, companyId } });
  if (!lead) return res.status(404).json({ error: "Lead not found" });

  const imoveis = await Imovel.findAll({
    where: { companyId, id: { [Op.in]: imovelIds } }
  });
  // preserve selection order
  const ordered = imovelIds
    .map(id => imoveis.find(i => i.id === id))
    .filter(Boolean) as typeof imoveis;
  if (ordered.length < 2) {
    return res.status(400).json({ error: "Informe ao menos 2 imóveis válidos" });
  }

  const labels = ["A", "B", "C", "D", "E"];
  const blocks = ordered.map((imov, idx) => {
    const code = (imov as any).code ? ` [${(imov as any).code}]` : "";
    const area = imov.areaM2 != null ? `${imov.areaM2} m²` : "—";
    const vagas = (imov as any).parkingSpots != null ? `${(imov as any).parkingSpots} vagas` : "—";
    return (
      `*Opção ${labels[idx] || idx + 1}:* ${imov.title}${code}\n` +
      `• Tipo: ${imov.type || "—"}\n` +
      `• Local: ${imov.neighborhood || "—"} / ${imov.city || "—"}\n` +
      `• ${imov.bedrooms || "?"} qts · ${area} · ${vagas}\n` +
      `• Preço: R$ ${Number(imov.price || 0).toLocaleString("pt-BR")}`
    );
  });
  const messageBody =
    `Olá ${lead.name || ""}! Segue o *comparativo* das opções que selecionamos:\n\n` +
    blocks.join("\n\n") +
    `\n\nQual opção faz mais sentido para você? Posso agendar visita.`;

  let ticket =
    lead.ticketId != null
      ? await Ticket.findOne({ where: { id: lead.ticketId, companyId } })
      : null;

  if (!ticket) {
    ticket = await ResolveTicketForLeadPreviewService({
      companyId,
      contactId: lead.contactId,
      phone: lead.phone,
      requestUserId: userId
    });
    if (ticket?.id) {
      await lead.update({ ticketId: ticket.id });
    }
  }

  let sent = false;
  let sendError: string | null = null;
  if (ticket) {
    try {
      const fullTicket = await Ticket.findByPk(ticket.id, {
        include: ["contact", "whatsapp"]
      } as any);
      if (fullTicket) {
        await SendWhatsAppMessage({ body: messageBody, ticket: fullTicket as any });
        sent = true;
      }
    } catch (err: any) {
      sendError = err?.message || String(err);
    }
  }

  const now = new Date();
  const envios = [];
  for (const imov of ordered) {
    const row = await RealtyLeadImovelEnvio.create({
      leadSaleId: lead.id,
      imovelId: imov.id,
      ticketId: ticket?.id || null,
      score: null,
      messageBody,
      sentAt: now,
      userId,
      companyId
    } as any);
    envios.push(row);
  }

  if (!lead.imovelId && ordered[0]) {
    await lead.update({ imovelId: ordered[0].id });
  }

  return res.json({
    leadId: lead.id,
    ticketId: ticket?.id || null,
    sent,
    sendError,
    messageBody,
    envios,
    imoveis: ordered.map(i => ({ id: i.id, title: i.title })),
    kind: "comparativo"
  });
};

/* ─── Transações / Inadimplência (paridade Lovable) ─── */

const TRANSACAO_KEYS = [
  "descricao",
  "tipo",
  "categoria",
  "valor",
  "data",
  "status",
  "imovelId",
  "contratoId",
  "corretorId",
  "observacoes",
  "canalOrigem",
  "recorrencia",
  "corretorNome",
  "parceiroNome",
  "captadorNome",
  "comissaoPercentual",
  "comissaoValor",
  "dataRecebimento",
  "numeroUnidade",
  "proprietarioNome"
] as const;

function normalizeTransacaoPayload(body: Record<string, any>, { partial = false } = {}) {
  const aliases: Record<string, string> = {
    imovel_id: "imovelId",
    contrato_id: "contratoId",
    corretor_id: "corretorId",
    canal_origem: "canalOrigem",
    corretor_nome: "corretorNome",
    parceiro_nome: "parceiroNome",
    captador_nome: "captadorNome",
    comissao_percentual: "comissaoPercentual",
    comissao_valor: "comissaoValor",
    data_recebimento: "dataRecebimento",
    numero_unidade: "numeroUnidade",
    proprietario_nome: "proprietarioNome"
  };
  const merged = { ...(body || {}) };
  for (const [snake, camel] of Object.entries(aliases)) {
    if (merged[camel] === undefined && merged[snake] !== undefined) {
      merged[camel] = merged[snake];
    }
  }
  const data = pick(merged, [...TRANSACAO_KEYS]);
  if (!partial) {
    if (data.data == null || String(data.data).trim() === "") {
      throw Object.assign(new Error("Data obrigatória"), { status: 400 });
    }
    if (data.descricao == null) data.descricao = "";
    if (data.tipo == null) data.tipo = "entrada";
    if (data.categoria == null) data.categoria = "outros";
    if (data.status == null) data.status = "pendente";
    if (data.valor == null) data.valor = 0;
  }
  if (data.valor !== undefined) data.valor = Number(data.valor) || 0;
  if (data.data != null) data.data = String(data.data).slice(0, 10);
  if (data.dataRecebimento != null && data.dataRecebimento !== "") {
    data.dataRecebimento = String(data.dataRecebimento).slice(0, 10);
  } else if (data.dataRecebimento === "") {
    data.dataRecebimento = null;
  }
  return data;
}

export const listTransacoes = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const rows = await RealtyTransacao.findAll({
    where: { companyId },
    order: [["data", "DESC"], ["id", "DESC"]],
    limit: 2000
  });
  return res.json({ transacoes: rows });
};

export const storeTransacao = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  try {
    const payload = normalizeTransacaoPayload(req.body || {});
    const created = await RealtyTransacao.create({ companyId, ...payload } as any);
    return res.status(201).json(created);
  } catch (err: any) {
    return res.status(err?.status || 500).json({ error: err?.message || "Erro ao criar transação" });
  }
};

export const updateTransacao = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;
  const row = await RealtyTransacao.findOne({ where: { id, companyId } });
  if (!row) return res.status(404).json({ error: "Transação não encontrada" });
  try {
    const payload = normalizeTransacaoPayload(req.body || {}, { partial: true });
    await row.update(payload as any);
    return res.json(row);
  } catch (err: any) {
    return res.status(err?.status || 500).json({ error: err?.message || "Erro ao atualizar" });
  }
};

export const removeTransacao = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;
  const row = await RealtyTransacao.findOne({ where: { id, companyId } });
  if (!row) return res.status(404).json({ error: "Transação não encontrada" });
  await row.destroy();
  return res.status(204).send();
};

export const getInadimplencia = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;

  const [contratos, transacoes, comprovantes, company, configModulos] = await Promise.all([
    Contrato.findAll({ where: { companyId }, order: [["createdAt", "DESC"]], limit: 2000 }),
    RealtyTransacao.findAll({ where: { companyId }, order: [["data", "DESC"]], limit: 5000 }),
    ContratoComprovanteMensal.findAll({ where: { companyId }, limit: 10000 }),
    Company.findByPk(companyId),
    RealtyModulo.findAll({
      where: { companyId, kind: "config_imobiliaria" },
      limit: 1,
      order: [["id", "DESC"]]
    })
  ]);

  const txPlain = transacoes.map(t => t.get({ plain: true }));
  const compsPlain = comprovantes.map(c => ({
    contratoId: c.contratoId,
    ano: c.ano,
    mes: c.mes,
    recebido: c.recebido
  }));
  const contratosPlain = contratos.map(c => c.get({ plain: true }));

  const inadimplentes = computeInadimplenciaItems(contratosPlain as any, txPlain as any, {
    comprovantes: compsPlain
  });
  const contratosAtivos = contratosPlain.filter(c => isLocacaoAtiva(c as any)).length;
  const metrics = computeInadimplenciaMetrics(inadimplentes, contratosAtivos);

  const cfg = configModulos?.[0] as any;
  const payload = cfg?.payload || {};
  const brand = {
    nome_empresa: payload.marca || company?.name || "VB Solution",
    creci: payload.creciEmpresa || null,
    telefone: payload.telefone || company?.phone || null,
    cnpj: company?.document || null
  };

  return res.json({
    inadimplentes,
    metrics,
    contratosAtivos,
    brand,
    transacoes: txPlain,
    contratos: contratosPlain
  });
};

export const gerarAlertasInadimplencia = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;
  const hoje = new Date();
  const hojeStr = hoje.toISOString().split("T")[0];

  const [contratos, transacoes, comprovantes] = await Promise.all([
    Contrato.findAll({
      where: { companyId, tipo: "Locação", status: "ativo" }
    }),
    RealtyTransacao.findAll({ where: { companyId } }),
    ContratoComprovanteMensal.findAll({ where: { companyId } })
  ]);

  if (!contratos.length) {
    return res.json({
      alertas_gerados: 0,
      message: "Nenhum contrato de locação ativo"
    });
  }

  const txPlain = transacoes.map(t => t.get({ plain: true }));
  const compsPlain = comprovantes.map(c => ({
    contratoId: c.contratoId,
    ano: c.ano,
    mes: c.mes,
    recebido: c.recebido
  }));

  let alertasGerados = 0;

  for (const contrato of contratos) {
    const plain = contrato.get({ plain: true }) as any;
    const check = shouldAlertCurrentMonth(plain, txPlain as any, hoje, compsPlain);
    if (!check.alert) continue;

    const tituloContrato = resolveTitulo(plain);
    const existing = await RealtyInadimplenciaAlerta.findOne({
      where: {
        companyId,
        createdAt: { [Op.gte]: new Date(`${hojeStr}T00:00:00`) },
        description: { [Op.iLike]: `%${tituloContrato}%` }
      }
    });
    if (existing) continue;

    const inquilino = resolveInquilino(plain);
    const valor = Number(resolveValorAluguel(plain) || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });
    const diaVenc = resolveDiaVencimento(plain);
    const mesAtual = hoje.getMonth();
    const anoAtual = hoje.getFullYear();

    await RealtyInadimplenciaAlerta.create({
      companyId,
      contratoId: contrato.id,
      titulo: `${check.gravidadeLabel} Inadimplência - ${check.diasAtraso} dias`,
      description: `Contrato "${tituloContrato}" - Inquilino: ${inquilino} - Aluguel ${valor} vencido em ${String(diaVenc).padStart(2, "0")}/${String(mesAtual + 1).padStart(2, "0")}/${anoAtual}`,
      diasAtraso: check.diasAtraso,
      gravidade: check.gravidadeLabel
    } as any);

    alertasGerados++;
  }

  return res.json({ alertas_gerados: alertasGerados });
};

