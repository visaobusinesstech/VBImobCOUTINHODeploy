/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * API Corretores — paridade Lovable (Equipe / Desempenho / Atribuição).
 */

import { Request, Response } from "express";
import { Op } from "sequelize";
import RealtyModulo from "../models/RealtyModulo";
import RealtyCorretorPermissao from "../models/RealtyCorretorPermissao";
import RealtyCorretorAtribuicaoRegra from "../models/RealtyCorretorAtribuicaoRegra";
import RealtyCompromisso from "../models/RealtyCompromisso";
import LeadSale from "../models/LeadSale";
import Contrato from "../models/Contrato";
import User from "../models/User";
import {
  CORRETOR_MODULOS,
  CAPTACAO_CLOSED_STAGES,
  normalizeCorretorForm,
  serializeCorretor,
  buildDefaultPermissoes,
  finalizeDesempenho,
  isLeadFechado,
  isLeadNovo,
  normalizeAtribuicaoForm
} from "../helpers/corretoresParity";

async function resolveUserLink(
  companyId: number,
  row: any
): Promise<number | null> {
  const payload = row?.payload && typeof row.payload === "object" ? row.payload : {};
  let userId = payload.userId != null ? Number(payload.userId) : null;
  if (Number.isFinite(userId) && userId! > 0) return userId;

  const name = String(row?.title || "")
    .trim()
    .toLowerCase();
  if (!name) return null;
  const user = await User.findOne({
    where: { companyId, name: { [Op.iLike]: row.title } },
    attributes: ["id"]
  });
  return user ? Number(user.id) : null;
}

export const listCorretores = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const items = await RealtyModulo.findAll({
    where: { companyId, kind: "corretor" },
    order: [["createdAt", "DESC"]],
    limit: 400
  });
  return res.json({ corretores: items.map(serializeCorretor) });
};

export const storeCorretor = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const body = req.body || {};
  const normalized = normalizeCorretorForm({
    nome: body.nome ?? body.title,
    email: body.email,
    telefone: body.telefone,
    creci: body.creci,
    status: body.status || "ativo",
    limite: body.limite ?? body.limite_leads,
    userId: body.userId
  });
  if (!normalized) return res.status(400).json({ error: "nome is required" });

  const existingPayload =
    body.payload && typeof body.payload === "object" ? body.payload : {};
  const payload = { ...existingPayload, ...normalized.payload };

  const row = await RealtyModulo.create({
    kind: "corretor",
    title: normalized.title,
    status: normalized.status,
    notes: body.notes || null,
    payload,
    companyId
  } as any);

  await RealtyCorretorPermissao.bulkCreate(
    CORRETOR_MODULOS.map(m => ({
      companyId,
      corretorId: Number(row.id),
      modulo: m.key,
      ativo: true
    })) as any[]
  );

  return res.status(201).json(serializeCorretor(row));
};

export const updateCorretor = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const record = await RealtyModulo.findOne({
    where: { id: req.params.id, companyId, kind: "corretor" }
  });
  if (!record) return res.status(404).json({ error: "Not found" });

  const body = req.body || {};
  const current = serializeCorretor(record);
  const normalized = normalizeCorretorForm({
    nome: body.nome ?? body.title ?? current.nome,
    email: body.email !== undefined ? body.email : current.email,
    telefone: body.telefone !== undefined ? body.telefone : current.telefone,
    creci: body.creci !== undefined ? body.creci : current.creci,
    status: body.status || current.status,
    limite: body.limite ?? body.limite_leads ?? current.limite_leads,
    userId: body.userId !== undefined ? body.userId : current.userId
  });
  if (!normalized) return res.status(400).json({ error: "nome is required" });

  const prevPayload =
    (record as any).payload && typeof (record as any).payload === "object"
      ? { ...(record as any).payload }
      : {};
  await record.update({
    title: normalized.title,
    status: normalized.status,
    payload: { ...prevPayload, ...normalized.payload }
  } as any);

  return res.json(serializeCorretor(record));
};

export const removeCorretor = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const record = await RealtyModulo.findOne({
    where: { id: req.params.id, companyId, kind: "corretor" }
  });
  if (!record) return res.status(404).json({ error: "Not found" });

  const corretorId = Number(record.id);
  await RealtyCorretorPermissao.destroy({ where: { companyId, corretorId } });
  await RealtyCorretorAtribuicaoRegra.destroy({ where: { companyId, corretorId } });
  await record.destroy();
  return res.json({ message: "deleted" });
};

export const listPermissoes = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const corretorId = Number(req.params.id);
  const corretor = await RealtyModulo.findOne({
    where: { id: corretorId, companyId, kind: "corretor" }
  });
  if (!corretor) return res.status(404).json({ error: "Not found" });

  const rows = await RealtyCorretorPermissao.findAll({
    where: { companyId, corretorId },
    attributes: ["modulo", "ativo"]
  });
  return res.json({
    permissoes: buildDefaultPermissoes(rows.map(r => ({ modulo: r.modulo, ativo: r.ativo })))
  });
};

export const upsertPermissao = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const corretorId = Number(req.params.id);
  const modulo = String(req.body?.modulo || "").trim();
  const ativo = req.body?.ativo !== false && req.body?.ativo !== "false";

  if (!CORRETOR_MODULOS.some(m => m.key === modulo)) {
    return res.status(400).json({ error: "modulo inválido" });
  }

  const corretor = await RealtyModulo.findOne({
    where: { id: corretorId, companyId, kind: "corretor" }
  });
  if (!corretor) return res.status(404).json({ error: "Not found" });

  let row = await RealtyCorretorPermissao.findOne({
    where: { companyId, corretorId, modulo }
  });
  if (row) {
    await row.update({ ativo });
  } else {
    row = await RealtyCorretorPermissao.create({
      companyId,
      corretorId,
      modulo,
      ativo
    } as any);
  }
  return res.json({ modulo: row.modulo, ativo: row.ativo });
};

export const listAtribuicaoRegras = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;

  const [corretoresRows, regras, pipeline, leads] = await Promise.all([
    RealtyModulo.findAll({
      where: { companyId, kind: "corretor" },
      order: [["title", "ASC"]],
      limit: 400
    }),
    RealtyCorretorAtribuicaoRegra.findAll({
      where: { companyId },
      order: [["prioridade", "ASC"]],
      limit: 500
    }),
    RealtyModulo.findAll({
      where: { companyId, kind: "pipeline_captacao" },
      attributes: ["id", "status", "payload"],
      limit: 500
    }),
    LeadSale.findAll({
      where: {
        companyId,
        responsibleId: { [Op.ne]: null },
        status: { [Op.notIn]: ["fechado", "perdido", "descartado", "inativo"] }
      },
      attributes: ["id", "responsibleId"]
    })
  ]);

  const corretores = corretoresRows.map(serializeCorretor).filter(c => c.status === "ativo");
  const userByCorretor = new Map<string, number | null>();
  for (const row of corretoresRows) {
    const s = serializeCorretor(row);
    if (s.status !== "ativo") continue;
    userByCorretor.set(s.id, await resolveUserLink(companyId, row));
  }

  const carga: Record<string, number> = {};
  for (const p of pipeline) {
    const payload = (p as any).payload && typeof (p as any).payload === "object" ? (p as any).payload : {};
    const cid = payload.corretorId != null ? String(payload.corretorId) : null;
    if (!cid) continue;
    const estagio = String(payload.estagio || p.status || "");
    if ((CAPTACAO_CLOSED_STAGES as readonly string[]).includes(estagio)) continue;
    carga[cid] = (carga[cid] || 0) + 1;
  }

  for (const [cid, userId] of userByCorretor.entries()) {
    if (!userId) continue;
    const n = leads.filter(l => Number((l as any).responsibleId) === userId).length;
    carga[cid] = Math.max(carga[cid] || 0, n);
  }

  return res.json({
    corretores,
    regras: regras.map(r => ({
      id: String(r.id),
      corretor_id: String(r.corretorId),
      cidade: r.cidade,
      bairro: r.bairro,
      prioridade: r.prioridade,
      peso: r.peso,
      ativo: r.ativo
    })),
    carga
  });
};

export const storeAtribuicaoRegra = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;
  const normalized = normalizeAtribuicaoForm(req.body || {});
  if (!normalized) return res.status(400).json({ error: "Selecione um corretor" });

  const corretor = await RealtyModulo.findOne({
    where: { id: normalized.corretorId, companyId, kind: "corretor" }
  });
  if (!corretor) return res.status(404).json({ error: "Corretor não encontrado" });

  const row = await RealtyCorretorAtribuicaoRegra.create({
    companyId,
    ...normalized
  } as any);

  return res.status(201).json({
    id: String(row.id),
    corretor_id: String(row.corretorId),
    cidade: row.cidade,
    bairro: row.bairro,
    prioridade: row.prioridade,
    peso: row.peso,
    ativo: row.ativo
  });
};

export const updateAtribuicaoRegra = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;
  const row = await RealtyCorretorAtribuicaoRegra.findOne({
    where: { id: req.params.id, companyId }
  });
  if (!row) return res.status(404).json({ error: "Not found" });

  const body = req.body || {};
  if (body.ativo !== undefined) {
    await row.update({ ativo: body.ativo !== false && body.ativo !== "false" });
  } else {
    const normalized = normalizeAtribuicaoForm({
      corretor_id: body.corretor_id ?? body.corretorId ?? row.corretorId,
      cidade: body.cidade !== undefined ? body.cidade : row.cidade,
      bairro: body.bairro !== undefined ? body.bairro : row.bairro,
      prioridade: body.prioridade !== undefined ? body.prioridade : row.prioridade,
      peso: body.peso !== undefined ? body.peso : row.peso,
      ativo: body.ativo !== undefined ? body.ativo : row.ativo
    });
    if (!normalized) return res.status(400).json({ error: "Dados inválidos" });
    await row.update(normalized as any);
  }

  return res.json({
    id: String(row.id),
    corretor_id: String(row.corretorId),
    cidade: row.cidade,
    bairro: row.bairro,
    prioridade: row.prioridade,
    peso: row.peso,
    ativo: row.ativo
  });
};

export const removeAtribuicaoRegra = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;
  const row = await RealtyCorretorAtribuicaoRegra.findOne({
    where: { id: req.params.id, companyId }
  });
  if (!row) return res.status(404).json({ error: "Not found" });
  await row.destroy();
  return res.json({ message: "deleted" });
};

export const getDesempenho = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const periodo = String(req.query.periodo || "30");
  const dias = Math.max(1, Math.min(365, parseInt(periodo, 10) || 30));
  const dataInicio = new Date();
  dataInicio.setDate(dataInicio.getDate() - dias);

  const corretoresRows = await RealtyModulo.findAll({
    where: { companyId, kind: "corretor" },
    order: [["title", "ASC"]],
    limit: 200
  });

  const ativos = corretoresRows.filter(c => serializeCorretor(c).status === "ativo");
  if (!ativos.length) {
    return res.json({ periodo: String(dias), corretores: [] });
  }

  const links = await Promise.all(
    ativos.map(async c => ({
      row: c,
      serialized: serializeCorretor(c),
      userId: await resolveUserLink(companyId, c)
    }))
  );

  const userIds = links.map(l => l.userId).filter((id): id is number => id != null && id > 0);

  const [leads, compromissos, contratos] = await Promise.all([
    userIds.length
      ? LeadSale.findAll({
          where: {
            companyId,
            responsibleId: { [Op.in]: userIds },
            createdAt: { [Op.gte]: dataInicio }
          },
          attributes: ["id", "responsibleId", "status", "createdAt"]
        })
      : Promise.resolve([] as LeadSale[]),
    userIds.length
      ? RealtyCompromisso.findAll({
          where: {
            companyId,
            userId: { [Op.in]: userIds },
            dataInicio: { [Op.gte]: dataInicio }
          },
          attributes: ["id", "userId", "tipo", "status", "dataInicio"]
        })
      : Promise.resolve([] as RealtyCompromisso[]),
    Contrato.findAll({
      where: {
        companyId,
        createdAt: { [Op.gte]: dataInicio }
      },
      attributes: [
        "id",
        "corretorId",
        "corretorNome",
        "value",
        "comissaoValor",
        "corretorComissaoValor",
        "status",
        "createdAt"
      ],
      limit: 2000
    })
  ]);

  const stats = links.map(({ serialized, userId, row }) => {
    const meusLeads = userId
      ? leads.filter(l => Number((l as any).responsibleId) === userId)
      : [];
    const leadsFechados = meusLeads.filter(l => isLeadFechado((l as any).status)).length;
    const leadsNovos = meusLeads.filter(l => isLeadNovo((l as any).status)).length;

    const meusComp = userId
      ? compromissos.filter(c => Number((c as any).userId) === userId)
      : [];
    const visitas = meusComp.filter(
      c => String((c as any).tipo) === "visita" && String((c as any).status) === "concluido"
    ).length;
    const reunioes = meusComp.filter(
      c => String((c as any).tipo) === "reuniao" && String((c as any).status) === "concluido"
    ).length;

    const nomeLower = serialized.nome.toLowerCase();
    const meusContratos = contratos.filter(ct => {
      const cid = (ct as any).corretorId != null ? Number((ct as any).corretorId) : null;
      if (cid && (cid === Number(row.id) || (userId && cid === userId))) return true;
      const cn = String((ct as any).corretorNome || "").toLowerCase();
      return cn && cn === nomeLower;
    });
    const valorContratos = meusContratos.reduce(
      (s, ct) => s + Number((ct as any).value || 0),
      0
    );
    const comissaoAcumulada = meusContratos.reduce(
      (s, ct) =>
        s +
        Number(
          (ct as any).corretorComissaoValor != null
            ? (ct as any).corretorComissaoValor
            : (ct as any).comissaoValor || 0
        ),
      0
    );

    return finalizeDesempenho({
      id: serialized.id,
      nome: serialized.nome,
      leadsAtribuidos: meusLeads.length,
      leadsFechados,
      leadsNovos,
      visitas,
      reunioes,
      contratos: meusContratos.length,
      valorContratos,
      comissaoAcumulada
    });
  });

  stats.sort((a, b) => b.pontuacao - a.pontuacao);
  return res.json({ periodo: String(dias), corretores: stats });
};
