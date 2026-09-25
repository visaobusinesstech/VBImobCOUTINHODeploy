/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * CRM Condomínios — hub + CRUD (paridade Lovable CrmCondominios).
 */

import { Request, Response } from "express";
import LeadSale from "../models/LeadSale";
import RealtyCondominioIniciativa from "../models/RealtyCondominioIniciativa";
import RealtyCondominioContato from "../models/RealtyCondominioContato";
import RealtyCondominioIniciativaLog from "../models/RealtyCondominioIniciativaLog";
import {
  buildCondominioHub,
  computeCondominioKpis,
  mapLeadSaleToCondoLead,
  normalizeContatoPayload,
  normalizeIniciativaPayload,
  serializeContato,
  serializeIniciativa
} from "../helpers/condominioCrm";

async function appendSistemaLog(params: {
  companyId: number;
  iniciativaId: number;
  tipo: string;
  conteudo: string;
  autor?: string | null;
  metadata?: object;
}) {
  await RealtyCondominioIniciativaLog.create({
    companyId: params.companyId,
    iniciativaId: params.iniciativaId,
    tipo: params.tipo,
    conteudo: params.conteudo,
    autor: params.autor || null,
    metadata: params.metadata || {}
  } as any);
}

/** Hub agregado: KPIs + condomínios (iniciativas, contatos, leads). */
export const hubCondominios = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const search = String((req.query as any).search || "");

  const [iniciativasRows, contatosRows, leadsRows] = await Promise.all([
    RealtyCondominioIniciativa.findAll({
      where: { companyId },
      order: [["createdAt", "DESC"]]
    }),
    RealtyCondominioContato.findAll({
      where: { companyId },
      order: [["createdAt", "DESC"]]
    }),
    LeadSale.findAll({
      where: { companyId },
      order: [["createdAt", "DESC"]],
      limit: 2000,
      attributes: [
        "id",
        "name",
        "phone",
        "email",
        "status",
        "value",
        "origin",
        "interestType",
        "interestNeighborhood",
        "purpose",
        "description",
        "tags",
        "createdAt"
      ]
    })
  ]);

  const iniciativas = iniciativasRows.map(serializeIniciativa);
  const contatos = contatosRows.map(serializeContato);
  const leads = leadsRows.map(mapLeadSaleToCondoLead);

  const condominios = buildCondominioHub({ iniciativas, contatos, leads, search });
  const kpis = computeCondominioKpis({ condominios, iniciativas, leads });

  return res.json({
    kpis,
    condominios,
    iniciativas,
    contatos,
    leads
  });
};

export const listIniciativas = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const rows = await RealtyCondominioIniciativa.findAll({
    where: { companyId },
    order: [["updatedAt", "DESC"]]
  });
  return res.json({ iniciativas: rows.map(serializeIniciativa) });
};

export const storeIniciativa = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, id: userId } = req.user as any;
  const data = normalizeIniciativaPayload(req.body || {}, {
    status: "planejado",
    canal: "whatsapp_business"
  });
  if (!data.condominioNome) {
    return res.status(400).json({ error: "condominioNome é obrigatório" });
  }
  if (!data.titulo) {
    return res.status(400).json({ error: "titulo é obrigatório" });
  }
  if (!data.canal) {
    return res.status(400).json({ error: "canal é obrigatório" });
  }

  const record = await RealtyCondominioIniciativa.create({
    ...data,
    companyId,
    createdBy: userId || null,
    metadata: data.metadata || {}
  } as any);

  await appendSistemaLog({
    companyId,
    iniciativaId: record.id,
    tipo: "sistema",
    conteudo: `Iniciativa criada no canal ${record.canal} (status: ${record.status})`,
    metadata: { canal: record.canal, status: record.status }
  });

  return res.status(201).json(serializeIniciativa(record));
};

export const updateIniciativa = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;
  const record = await RealtyCondominioIniciativa.findOne({ where: { id, companyId } });
  if (!record) return res.status(404).json({ error: "Not found" });

  const prevStatus = record.status;
  const data = normalizeIniciativaPayload(req.body || {}, {
    status: record.status,
    canal: record.canal
  });

  // Partial update: keep existing nome/titulo if blank in body
  if (!data.condominioNome) data.condominioNome = record.condominioNome;
  if (!data.titulo) data.titulo = record.titulo;

  await record.update(data as any);

  if (data.status && data.status !== prevStatus) {
    await appendSistemaLog({
      companyId,
      iniciativaId: record.id,
      tipo: "status_change",
      conteudo: `Status alterado de "${prevStatus}" para "${data.status}"`,
      metadata: { from: prevStatus, to: data.status }
    });
  }

  return res.json(serializeIniciativa(record));
};

export const removeIniciativa = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;
  const record = await RealtyCondominioIniciativa.findOne({ where: { id, companyId } });
  if (!record) return res.status(404).json({ error: "Not found" });
  await RealtyCondominioIniciativaLog.destroy({ where: { iniciativaId: record.id, companyId } });
  await record.destroy();
  return res.json({ message: "deleted" });
};

export const listIniciativaLogs = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;
  const iniciativa = await RealtyCondominioIniciativa.findOne({ where: { id, companyId } });
  if (!iniciativa) return res.status(404).json({ error: "Not found" });
  const logs = await RealtyCondominioIniciativaLog.findAll({
    where: { iniciativaId: iniciativa.id, companyId },
    order: [["createdAt", "DESC"]]
  });
  return res.json({
    logs: logs.map(l => {
      const j = l.toJSON() as any;
      return {
        id: j.id,
        tipo: j.tipo,
        conteudo: j.conteudo,
        autor: j.autor,
        metadata: j.metadata || {},
        createdAt: j.createdAt
      };
    })
  });
};

export const storeIniciativaLog = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user as any;
  const { id } = req.params;
  const iniciativa = await RealtyCondominioIniciativa.findOne({ where: { id, companyId } });
  if (!iniciativa) return res.status(404).json({ error: "Not found" });

  const conteudo = String(req.body?.conteudo || "").trim();
  if (!conteudo) return res.status(400).json({ error: "conteudo é obrigatório" });

  const log = await RealtyCondominioIniciativaLog.create({
    companyId,
    iniciativaId: iniciativa.id,
    tipo: String(req.body?.tipo || "nota"),
    conteudo,
    autor: req.body?.autor || (req.user as any)?.email || null,
    metadata: req.body?.metadata || {}
  } as any);

  const j = log.toJSON() as any;
  return res.status(201).json({
    id: j.id,
    tipo: j.tipo,
    conteudo: j.conteudo,
    autor: j.autor,
    createdAt: j.createdAt
  });
};

export const listContatos = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const rows = await RealtyCondominioContato.findAll({
    where: { companyId },
    order: [["updatedAt", "DESC"]]
  });
  return res.json({ contatos: rows.map(serializeContato) });
};

export const storeContato = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const data = normalizeContatoPayload(req.body || {});
  if (!data.condominioNome) {
    return res.status(400).json({ error: "condominioNome é obrigatório" });
  }
  if (!data.tipo) {
    return res.status(400).json({ error: "tipo é obrigatório" });
  }

  const record = await RealtyCondominioContato.create({
    ...data,
    companyId,
    metadata: data.metadata || {}
  } as any);

  return res.status(201).json(serializeContato(record));
};

export const updateContato = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;
  const record = await RealtyCondominioContato.findOne({ where: { id, companyId } });
  if (!record) return res.status(404).json({ error: "Not found" });

  const data = normalizeContatoPayload(req.body || {}, {
    status: record.status,
    tipo: record.tipo
  });
  if (!data.condominioNome) data.condominioNome = record.condominioNome;

  await record.update(data as any);
  return res.json(serializeContato(record));
};

export const removeContato = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;
  const record = await RealtyCondominioContato.findOne({ where: { id, companyId } });
  if (!record) return res.status(404).json({ error: "Not found" });
  await record.destroy();
  return res.json({ message: "deleted" });
};
