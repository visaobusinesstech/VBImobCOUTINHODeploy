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
import {
  clampPageSize,
  pickAllowedStatus,
  rankImoveisForLead,
  CONTRATO_STATUSES,
  IMOVEL_STATUSES
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
    "proprietarioId"
  ]);
  if (!data.title) return res.status(400).json({ error: "title is required" });
  if (!data.status) {
    data.status = "disponivel";
  } else {
    data.status = pickAllowedStatus(data.status, IMOVEL_STATUSES, "disponivel");
  }
  data.proprietarioId = emptyToNull(data.proprietarioId);
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
    "proprietarioId"
  ]);
  if (data.proprietarioId !== undefined) data.proprietarioId = emptyToNull(data.proprietarioId);
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
    "leadSaleId"
  ]);
  if (!data.title) return res.status(400).json({ error: "title is required" });
  if (!data.status) {
    data.status = "rascunho";
  } else {
    data.status = pickAllowedStatus(data.status, CONTRATO_STATUSES, "rascunho");
  }
  ["imovelId", "proprietarioId", "leadSaleId"].forEach(k => {
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
    "leadSaleId"
  ]);
  ["imovelId", "proprietarioId", "leadSaleId"].forEach(k => {
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
