/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 */

import { Request, Response } from "express";
import { Op } from "sequelize";
import Proprietario from "../models/Proprietario";
import Imovel from "../models/Imovel";
import Contrato from "../models/Contrato";
import LeadSale from "../models/LeadSale";
import Ticket from "../models/Ticket";
import RealtyFollowup from "../models/RealtyFollowup";
import RealtyVisita from "../models/RealtyVisita";
import RealtyProposta from "../models/RealtyProposta";
import RealtyLeadImovelEnvio from "../models/RealtyLeadImovelEnvio";
import RealtyNutricao from "../models/RealtyNutricao";
import RealtyProspeccao from "../models/RealtyProspeccao";
import RealtyAutomacaoFollowup from "../models/RealtyAutomacaoFollowup";
import RealtyFilaConfig from "../models/RealtyFilaConfig";
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
  VISITA_STATUSES,
  PROPOSTA_STATUSES
} from "../helpers/realtyCrm";

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
  const data = await paginate(Proprietario, companyId, req, ["name", "phone", "email", "document"]);
  return res.json({ proprietarios: data.rows, count: data.count, hasMore: data.hasMore });
};

export const storeProprietario = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const data = pick(req.body || {}, ["name", "phone", "email", "document", "notes"]);
  if (!data.name) return res.status(400).json({ error: "name is required" });
  const record = await Proprietario.create({ ...data, companyId } as any);
  return res.status(201).json(record);
};

export const updateProprietario = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;
  const record = await Proprietario.findOne({ where: { id, companyId } });
  if (!record) return res.status(404).json({ error: "Not found" });
  const data = pick(req.body || {}, ["name", "phone", "email", "document", "notes"]);
  await record.update(data as any);
  return res.json(record);
};

export const removeProprietario = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;
  const record = await Proprietario.findOne({ where: { id, companyId } });
  if (!record) return res.status(404).json({ error: "Not found" });
  await record.destroy();
  return res.json({ message: "deleted" });
};

export const listImoveis = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const data = await paginate(Imovel, companyId, req, ["title", "city", "neighborhood", "type", "address"]);
  return res.json({ imoveis: data.rows, count: data.count, hasMore: data.hasMore });
};

export const storeImovel = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const data = pick(req.body || {}, [
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
    "videoUrl"
  ]);
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
  const data = pick(req.body || {}, [
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
    "videoUrl"
  ]);
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

export const listContratos = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const data = await paginate(Contrato, companyId, req, ["title", "status", "notes"]);
  return res.json({ contratos: data.rows, count: data.count, hasMore: data.hasMore });
};

export const storeContrato = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const data = pick(req.body || {}, [
    "title",
    "status",
    "value",
    "startDate",
    "endDate",
    "notes",
    "imovelId",
    "proprietarioId",
    "leadSaleId",
    "propostaId"
  ]);
  if (!data.title) return res.status(400).json({ error: "title is required" });
  if (!data.status) {
    data.status = "rascunho";
  } else {
    data.status = pickAllowedStatus(data.status, CONTRATO_STATUSES, "rascunho");
  }
  ["imovelId", "proprietarioId", "leadSaleId", "propostaId"].forEach(k => {
    data[k] = emptyToNull(data[k]);
  });
  const record = await Contrato.create({ ...data, companyId } as any);
  return res.status(201).json(record);
};

export const updateContrato = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;
  const record = await Contrato.findOne({ where: { id, companyId } });
  if (!record) return res.status(404).json({ error: "Not found" });
  const data = pick(req.body || {}, [
    "title",
    "status",
    "value",
    "startDate",
    "endDate",
    "notes",
    "imovelId",
    "proprietarioId",
    "leadSaleId",
    "propostaId"
  ]);
  ["imovelId", "proprietarioId", "leadSaleId", "propostaId"].forEach(k => {
    if (data[k] !== undefined) data[k] = emptyToNull(data[k]);
  });
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
  ["type", "scheduledAt", "completedAt", "result", "notes", "status", "leadSaleId", "userId", "ticketId"],
  ["type", "result", "notes", "status"],
  "followups",
  FOLLOWUP_STATUSES
);
export const listFollowups = followupsCrud.list;
export const updateFollowup = followupsCrud.update;
export const removeFollowup = followupsCrud.remove;

export const storeFollowup = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, id: userId } = req.user as any;
  const data = pick(req.body || {}, [
    "type", "scheduledAt", "completedAt", "result", "notes", "status", "leadSaleId", "userId", "ticketId"
  ]);
  if (!data.leadSaleId) return res.status(400).json({ error: "leadSaleId is required" });
  if (!data.scheduledAt) return res.status(400).json({ error: "scheduledAt is required" });
  if (!data.status) data.status = "pendente";
  else data.status = pickAllowedStatus(data.status, FOLLOWUP_STATUSES as any, "pendente");
  if (data.userId === undefined) data.userId = userId;
  ["leadSaleId", "userId", "ticketId"].forEach(k => {
    if (data[k] !== undefined) data[k] = emptyToNull(data[k]);
  });
  const record = await RealtyFollowup.create({ ...data, companyId } as any);

  const lead = await LeadSale.findOne({ where: { id: data.leadSaleId, companyId } });
  if (lead) {
    await lead.update({
      followUpAt: new Date(data.scheduledAt as any),
      nextContactAt: new Date(data.scheduledAt as any)
    } as any);
  }

  return res.status(201).json(record);
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

const propostasCrud = crudFactory(
  RealtyProposta,
  [
    "title", "value", "paymentMethod", "downPayment", "financing", "conditions",
    "status", "validUntil", "notes", "leadSaleId", "imovelId", "userId", "ticketId"
  ],
  ["title", "status", "notes", "paymentMethod"],
  "propostas",
  PROPOSTA_STATUSES
);
export const listPropostas = propostasCrud.list;
export const storeProposta = propostasCrud.store;
export const updateProposta = propostasCrud.update;
export const removeProposta = propostasCrud.remove;

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

  const [followups, visitas, propostas, envios] = await Promise.all([
    RealtyFollowup.findAll({ where: { companyId, leadSaleId: leadId }, order: [["scheduledAt", "DESC"]], limit: 50 }),
    RealtyVisita.findAll({ where: { companyId, leadSaleId: leadId }, order: [["scheduledAt", "DESC"]], limit: 50 }),
    RealtyProposta.findAll({ where: { companyId, leadSaleId: leadId }, order: [["createdAt", "DESC"]], limit: 50 }),
    RealtyLeadImovelEnvio.findAll({ where: { companyId, leadSaleId: leadId }, order: [["sentAt", "DESC"]], limit: 50 })
  ]);

  return res.json({ lead, followups, visitas, propostas, envios });
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

const automacaoCrud = crudFactory(
  RealtyAutomacaoFollowup,
  ["title", "trigger", "daysWithoutContact", "fromStatus", "toStatus", "action", "messageTemplate", "active", "notes"],
  ["title", "trigger", "action", "notes"],
  "items"
);
export const listAutomacaoFollowup = automacaoCrud.list;
export const storeAutomacaoFollowup = automacaoCrud.store;
export const updateAutomacaoFollowup = automacaoCrud.update;
export const removeAutomacaoFollowup = automacaoCrud.remove;

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

  if (!userId) {
    const pool: number[] = Array.isArray((cfg as any).userIds) && (cfg as any).userIds.length
      ? (cfg as any).userIds.map(Number)
      : (
          await User.findAll({
            where: { companyId },
            attributes: ["id"],
            order: [["id", "ASC"]],
            limit: 50
          })
        ).map((u: any) => u.id);

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

export const runAutomacoesFollowup = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, id: userId } = req.user as any;
  const rules = await RealtyAutomacaoFollowup.findAll({
    where: { companyId, active: true }
  });
  const created: any[] = [];
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
      if ((rule as any).action === "criar_followup" || !(rule as any).action) {
        const scheduledAt = new Date(now + 60 * 60 * 1000);
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
        created.push({ leadId: lead.id, followupId: fu.id, ruleId: rule.id });
      }
    }
  }

  return res.json({ created, count: created.length });
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
  req.body.imovelIds = imovelIds;
  return sendMatchWhatsApp(req, res);
};

