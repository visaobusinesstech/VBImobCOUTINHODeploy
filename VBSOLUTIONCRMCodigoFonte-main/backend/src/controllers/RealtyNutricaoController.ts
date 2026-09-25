/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Controllers de Nutrição multi-etapa (fluxos, envios, eventos, metas, IA).
 */

import { Request, Response } from "express";
import { Op } from "sequelize";
import RealtyNutricaoFluxo from "../models/RealtyNutricaoFluxo";
import RealtyNutricaoEtapa from "../models/RealtyNutricaoEtapa";
import RealtyNutricaoInscricao from "../models/RealtyNutricaoInscricao";
import RealtyNutricaoEnvio from "../models/RealtyNutricaoEnvio";
import RealtyNutricaoEvento from "../models/RealtyNutricaoEvento";
import RealtyNutricaoMetaConfig from "../models/RealtyNutricaoMetaConfig";
import RealtyNutricaoMetaAlerta from "../models/RealtyNutricaoMetaAlerta";
import RealtyNutricao from "../models/RealtyNutricao";
import Prompt from "../models/Prompt";
import {
  processNutricaoCompany,
  dispatchNutricaoEnvio,
  applyNutricaoVars
} from "../services/RealtyServices/ProcessNutricaoService";
import { composerAssistTransform } from "../services/PromptServices/ComposerAssistOpenAiService";
import logger from "../utils/logger";

const FLUXO_FIELDS = [
  "nome",
  "descricao",
  "publicoAlvo",
  "diasInatividade",
  "canal",
  "encerrarAoResponder",
  "ativo",
  "segmentoEstagios",
  "segmentoPerfis",
  "segmentoMotivosPerda",
  "destinatarioContactIds",
  "destinatarioLeadSaleIds",
  "whatsappId",
  "promptId"
] as const;

const META_FIELDS = [
  "fluxoId",
  "metaAbertura",
  "metaResposta",
  "metaAgendamento",
  "metaFechamento",
  "janelaDias",
  "minEnvios",
  "repetirAvisoHoras",
  "alertarZeroAgendamento",
  "alertarZeroResposta",
  "notificarApp",
  "monitoramentoAtivo"
] as const;

function pick<T extends string>(body: Record<string, any>, keys: readonly T[]) {
  const out: Partial<Record<T, any>> = {};
  for (const k of keys) {
    if (body[k] !== undefined) out[k] = body[k];
  }
  return out;
}

function normalizeEtapas(raw: any[], companyId: number, fluxoId: number) {
  if (!Array.isArray(raw)) return [];
  return raw.map((e, idx) => ({
    companyId,
    fluxoId,
    ordem: Number(e.ordem ?? idx + 1),
    diasApos: Number(e.diasApos ?? 0),
    canal: e.canal || "heranca",
    titulo: e.titulo || `Etapa ${idx + 1}`,
    mensagem: e.mensagem || "",
    ativo: e.ativo !== false,
    abAtivo: !!e.abAtivo,
    abTituloB: e.abTituloB || null,
    abMensagemB: e.abMensagemB || null,
    abSplit: e.abSplit != null ? Number(e.abSplit) : 50,
    abAutoEscolher: e.abAutoEscolher !== false,
    abMinEnvios: e.abMinEnvios != null ? Number(e.abMinEnvios) : 20,
    abVencedor: e.abVencedor || null,
    abDecididoEm: e.abDecididoEm || null
  }));
}

const DEFAULT_META = {
  metaAbertura: 25,
  metaResposta: 10,
  metaAgendamento: 5,
  metaFechamento: 1,
  janelaDias: 14,
  minEnvios: 10,
  repetirAvisoHoras: 24,
  alertarZeroAgendamento: true,
  alertarZeroResposta: true,
  notificarApp: true,
  monitoramentoAtivo: true
};

const pct = (p: number, t: number) => (t > 0 ? (p / t) * 100 : 0);

export const dashboard = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user as any;

  const [fluxos, etapas, inscricoes, envios, eventos, legacy, metasConfig, alertas] =
    await Promise.all([
      RealtyNutricaoFluxo.findAll({
        where: { companyId },
        order: [["updatedAt", "DESC"]]
      }),
      RealtyNutricaoEtapa.findAll({
        where: { companyId },
        order: [
          ["fluxoId", "ASC"],
          ["ordem", "ASC"]
        ]
      }),
      RealtyNutricaoInscricao.findAll({
        where: { companyId },
        order: [["updatedAt", "DESC"]],
        limit: 500
      }),
      RealtyNutricaoEnvio.findAll({
        where: { companyId },
        order: [["createdAt", "DESC"]],
        limit: 500
      }),
      RealtyNutricaoEvento.findAll({
        where: { companyId },
        order: [["createdAt", "DESC"]],
        limit: 500
      }),
      RealtyNutricao.findAll({
        where: { companyId },
        order: [["updatedAt", "DESC"]],
        limit: 100
      }),
      RealtyNutricaoMetaConfig.findAll({ where: { companyId } }),
      RealtyNutricaoMetaAlerta.findAll({
        where: { companyId, resolvido: false },
        order: [["createdAt", "DESC"]],
        limit: 100
      })
    ]);

  return res.json({
    fluxos,
    etapas,
    inscricoes,
    envios,
    eventos,
    legacy,
    metasConfig,
    alertas
  });
};

export const createFluxo = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user as any;
  const data = pick(req.body || {}, FLUXO_FIELDS);
  if (!data.nome) return res.status(400).json({ error: "nome é obrigatório" });

  const fluxo = await RealtyNutricaoFluxo.create({
    companyId,
    nome: data.nome,
    descricao: data.descricao || null,
    publicoAlvo: data.publicoAlvo || "lead_sem_resposta",
    diasInatividade: data.diasInatividade != null ? Number(data.diasInatividade) : 30,
    canal: data.canal || "whatsapp",
    encerrarAoResponder: data.encerrarAoResponder !== false,
    ativo: data.ativo !== false,
    segmentoEstagios: data.segmentoEstagios || [],
    segmentoPerfis: data.segmentoPerfis || [],
    segmentoMotivosPerda: data.segmentoMotivosPerda || [],
    destinatarioContactIds: Array.isArray(data.destinatarioContactIds)
      ? data.destinatarioContactIds
      : [],
    destinatarioLeadSaleIds: Array.isArray(data.destinatarioLeadSaleIds)
      ? data.destinatarioLeadSaleIds
      : [],
    whatsappId: data.whatsappId || null,
    promptId: data.promptId || null
  } as any);

  const etapasPayload = normalizeEtapas(req.body?.etapas || [], companyId, fluxo.id);
  let etapas: RealtyNutricaoEtapa[] = [];
  if (etapasPayload.length) {
    etapas = await RealtyNutricaoEtapa.bulkCreate(etapasPayload as any);
  }

  return res.status(201).json({ fluxo, etapas });
};

export const updateFluxo = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user as any;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "id inválido" });

  const fluxo = await RealtyNutricaoFluxo.findOne({ where: { id, companyId } });
  if (!fluxo) return res.status(404).json({ error: "Fluxo não encontrado" });

  const data = pick(req.body || {}, FLUXO_FIELDS);
  await fluxo.update(data as any);

  let etapas: RealtyNutricaoEtapa[] = [];
  if (Array.isArray(req.body?.etapas)) {
    await RealtyNutricaoEtapa.destroy({ where: { fluxoId: fluxo.id, companyId } });
    const payload = normalizeEtapas(req.body.etapas, companyId, fluxo.id);
    if (payload.length) {
      etapas = await RealtyNutricaoEtapa.bulkCreate(payload as any);
    }
  } else {
    etapas = await RealtyNutricaoEtapa.findAll({
      where: { fluxoId: fluxo.id, companyId },
      order: [["ordem", "ASC"]]
    });
  }

  return res.json({ fluxo, etapas });
};

export const removeFluxo = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user as any;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "id inválido" });

  const fluxo = await RealtyNutricaoFluxo.findOne({ where: { id, companyId } });
  if (!fluxo) return res.status(404).json({ error: "Fluxo não encontrado" });

  await RealtyNutricaoEtapa.destroy({ where: { fluxoId: id, companyId } });
  await fluxo.destroy();
  return res.json({ ok: true });
};

export const toggleFluxo = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user as any;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "id inválido" });

  const fluxo = await RealtyNutricaoFluxo.findOne({ where: { id, companyId } });
  if (!fluxo) return res.status(404).json({ error: "Fluxo não encontrado" });

  const ativo = req.body?.ativo !== undefined ? !!req.body.ativo : !fluxo.ativo;
  await fluxo.update({ ativo });
  return res.json(fluxo);
};

export const processar = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, id: userId } = req.user as any;
  const autoSend = req.body?.autoSend !== false && req.query?.autoSend !== "false";
  const result = await processNutricaoCompany({ companyId, userId, autoSend });
  return res.json({ success: true, ...result });
};

export const enviarEnvio = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, id: userId } = req.user as any;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "id inválido" });

  const envio = await RealtyNutricaoEnvio.findOne({ where: { id, companyId } });
  if (!envio) return res.status(404).json({ error: "Envio não encontrado" });

  let whatsappId: number | null = null;
  if (envio.inscricaoId) {
    const insc = await RealtyNutricaoInscricao.findByPk(envio.inscricaoId);
    if (insc?.fluxoId) {
      const fluxo = await RealtyNutricaoFluxo.findByPk(insc.fluxoId);
      whatsappId = fluxo?.whatsappId || null;
    }
  }

  // Etapa pode apontar para conexão específica (canal = "conn:123")
  if (envio.etapaId) {
    const etapa = await RealtyNutricaoEtapa.findByPk(envio.etapaId);
    const canalEtapa = String(etapa?.canal || "");
    if (canalEtapa.startsWith("conn:")) {
      const parsed = Number(canalEtapa.slice(5));
      if (Number.isFinite(parsed) && parsed > 0) whatsappId = parsed;
    }
  }
  if (String(envio.canal || "").startsWith("conn:")) {
    const parsed = Number(String(envio.canal).slice(5));
    if (Number.isFinite(parsed) && parsed > 0) whatsappId = parsed;
  }

  const result = await dispatchNutricaoEnvio({
    envio,
    companyId,
    userId,
    whatsappId
  });
  await envio.reload();
  return res.json({ ...result, envio });
};

export const updateEnvioStatus = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user as any;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "id inválido" });

  const envio = await RealtyNutricaoEnvio.findOne({ where: { id, companyId } });
  if (!envio) return res.status(404).json({ error: "Envio não encontrado" });

  const status = String(req.body?.status || "").toLowerCase();
  if (!["pendente", "enviado", "falha"].includes(status)) {
    return res.status(400).json({ error: "status inválido" });
  }

  const patch: any = { status };
  if (status === "enviado") {
    patch.enviadoEm = req.body?.enviadoEm || new Date();
    patch.erro = null;
  }
  if (status === "falha" && req.body?.erro != null) {
    patch.erro = String(req.body.erro);
  }
  await envio.update(patch);
  return res.json(envio);
};

export const encerrarInscricao = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user as any;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "id inválido" });

  const insc = await RealtyNutricaoInscricao.findOne({ where: { id, companyId } });
  if (!insc) return res.status(404).json({ error: "Inscrição não encontrada" });

  await insc.update({
    status: "encerrada",
    motivoEncerramento: req.body?.motivo || "Encerrada manualmente"
  });
  return res.json(insc);
};

export const registrarEvento = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user as any;
  const tipo = String(req.body?.tipo || "").toLowerCase();
  const allowed = ["abertura", "clique", "resposta", "agendamento", "fechamento"];
  if (!allowed.includes(tipo)) {
    return res.status(400).json({ error: "tipo inválido" });
  }

  const evento = await RealtyNutricaoEvento.create({
    companyId,
    fluxoId: req.body?.fluxoId || null,
    envioId: req.body?.envioId || null,
    inscricaoId: req.body?.inscricaoId || null,
    etapaId: req.body?.etapaId || null,
    leadSaleId: req.body?.leadSaleId || null,
    tipo,
    canal: req.body?.canal || null,
    valor: req.body?.valor != null ? Number(req.body.valor) : null
  } as any);

  return res.status(201).json(evento);
};

export const definirAbVencedor = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user as any;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "id inválido" });

  const etapa = await RealtyNutricaoEtapa.findOne({ where: { id, companyId } });
  if (!etapa) return res.status(404).json({ error: "Etapa não encontrada" });

  const vencedor = String(req.body?.vencedor || "").toUpperCase();
  if (vencedor !== "A" && vencedor !== "B") {
    return res.status(400).json({ error: "vencedor deve ser A ou B" });
  }

  const patch: any = {
    abAtivo: false,
    abVencedor: vencedor,
    abDecididoEm: new Date()
  };
  if (vencedor === "B") {
    patch.titulo = etapa.abTituloB || etapa.titulo;
    patch.mensagem = etapa.abMensagemB || etapa.mensagem;
  }
  await etapa.update(patch);
  return res.json(etapa);
};

export const reabrirAb = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user as any;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "id inválido" });

  const etapa = await RealtyNutricaoEtapa.findOne({ where: { id, companyId } });
  if (!etapa) return res.status(404).json({ error: "Etapa não encontrada" });

  await etapa.update({
    abAtivo: true,
    abVencedor: null,
    abDecididoEm: null
  } as any);
  return res.json(etapa);
};

export const getMetas = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user as any;
  const configs = await RealtyNutricaoMetaConfig.findAll({ where: { companyId } });
  const alertas = await RealtyNutricaoMetaAlerta.findAll({
    where: { companyId },
    order: [["createdAt", "DESC"]],
    limit: 200
  });
  return res.json({ configs, alertas, defaults: DEFAULT_META });
};

export const putMetas = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user as any;
  const data = pick(req.body || {}, META_FIELDS);
  const fluxoId = data.fluxoId != null ? Number(data.fluxoId) : null;

  let config = await RealtyNutricaoMetaConfig.findOne({
    where: {
      companyId,
      fluxoId: fluxoId == null ? { [Op.is]: null } : fluxoId
    } as any
  });

  if (config) {
    await config.update(data as any);
  } else {
    config = await RealtyNutricaoMetaConfig.create({
      companyId,
      fluxoId,
      ...DEFAULT_META,
      ...data
    } as any);
  }

  return res.json(config);
};

export const verificarMetas = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user as any;

  const fluxos = await RealtyNutricaoFluxo.findAll({
    where: { companyId, ativo: true }
  });
  if (!fluxos.length) {
    return res.json({ alertas: 0, message: "Nenhum fluxo ativo" });
  }

  const configs = await RealtyNutricaoMetaConfig.findAll({ where: { companyId } });

  const configFor = (fluxoId: number) => {
    const especifica = configs.find(c => c.fluxoId === fluxoId);
    const global = configs.find(c => c.fluxoId == null);
    return {
      ...DEFAULT_META,
      ...(global ? global.toJSON() : {}),
      ...(especifica ? especifica.toJSON() : {}),
      fluxoId
    } as typeof DEFAULT_META & { fluxoId: number; monitoramentoAtivo: boolean; repetirAvisoHoras: number };
  };

  let criados = 0;
  const criadosLista: RealtyNutricaoMetaAlerta[] = [];

  for (const fluxo of fluxos) {
    const cfg = configFor(fluxo.id);
    if (cfg.monitoramentoAtivo === false) continue;

    const janelaDias = Number(cfg.janelaDias) || 14;
    const minEnvios = Number(cfg.minEnvios) || 10;
    const repetirHoras = Number(cfg.repetirAvisoHoras) || 24;
    const desde = new Date(Date.now() - janelaDias * 86400000);

    const inscricoes = await RealtyNutricaoInscricao.findAll({
      where: { fluxoId: fluxo.id, companyId },
      attributes: ["id"]
    });
    const inscricaoIds = inscricoes.map(i => i.id);
    if (!inscricaoIds.length) continue;

    const envios = await RealtyNutricaoEnvio.findAll({
      where: {
        companyId,
        inscricaoId: { [Op.in]: inscricaoIds },
        createdAt: { [Op.gte]: desde }
      },
      attributes: ["id", "status"]
    });
    const enviados = envios.filter(e => e.status === "enviado").length;
    if (enviados < minEnvios) continue;

    const eventos = await RealtyNutricaoEvento.findAll({
      where: {
        companyId,
        fluxoId: fluxo.id,
        createdAt: { [Op.gte]: desde }
      },
      attributes: ["tipo"]
    });

    const conta = (tipo: string) => eventos.filter(e => e.tipo === tipo).length;
    const aberturas = conta("abertura");
    const respostas = conta("resposta");
    const agendamentos = conta("agendamento");
    const fechamentos = conta("fechamento");

    const taxaAbertura = pct(aberturas, enviados);
    const taxaResposta = pct(respostas, enviados);
    const taxaAgendamento = pct(agendamentos, enviados);
    const taxaFechamento = pct(fechamentos, enviados);

    type Cand = { tipo: string; severidade: string; mensagem: string };
    const candidatos: Cand[] = [];

    if (cfg.alertarZeroAgendamento && agendamentos === 0) {
      candidatos.push({
        tipo: "zero_agendamento",
        severidade: "critico",
        mensagem: `O fluxo "${fluxo.nome}" não gerou nenhum agendamento nos últimos ${janelaDias} dias (${enviados} mensagens enviadas).`
      });
    } else if (taxaAgendamento < Number(cfg.metaAgendamento)) {
      candidatos.push({
        tipo: "abaixo_meta_agendamento",
        severidade: "alerta",
        mensagem: `Taxa de agendamento do fluxo "${fluxo.nome}" está em ${taxaAgendamento.toFixed(1)}% (meta ${cfg.metaAgendamento}%).`
      });
    }

    if (cfg.alertarZeroResposta && respostas === 0) {
      candidatos.push({
        tipo: "zero_resposta",
        severidade: "critico",
        mensagem: `O fluxo "${fluxo.nome}" não recebeu nenhuma resposta nos últimos ${janelaDias} dias.`
      });
    } else if (taxaResposta < Number(cfg.metaResposta)) {
      candidatos.push({
        tipo: "abaixo_meta_resposta",
        severidade: "alerta",
        mensagem: `Taxa de resposta do fluxo "${fluxo.nome}" está em ${taxaResposta.toFixed(1)}% (meta ${cfg.metaResposta}%).`
      });
    }

    if (taxaAbertura < Number(cfg.metaAbertura)) {
      candidatos.push({
        tipo: "abaixo_meta_abertura",
        severidade: "alerta",
        mensagem: `Taxa de abertura do fluxo "${fluxo.nome}" está em ${taxaAbertura.toFixed(1)}% (meta ${cfg.metaAbertura}%).`
      });
    }

    if (taxaFechamento < Number(cfg.metaFechamento)) {
      candidatos.push({
        tipo: "abaixo_meta_fechamento",
        severidade: "alerta",
        mensagem: `Taxa de fechamento do fluxo "${fluxo.nome}" está em ${taxaFechamento.toFixed(1)}% (meta ${cfg.metaFechamento}%).`
      });
    }

    if (!candidatos.length) continue;

    const desdeDedup = new Date(Date.now() - repetirHoras * 3600000);
    const recentes = await RealtyNutricaoMetaAlerta.findAll({
      where: {
        companyId,
        fluxoId: fluxo.id,
        createdAt: { [Op.gte]: desdeDedup }
      },
      attributes: ["tipo"]
    });
    const tiposRecentes = new Set(recentes.map(r => r.tipo));
    const novos = candidatos.filter(c => !tiposRecentes.has(c.tipo));
    if (!novos.length) continue;

    for (const c of novos) {
      const alerta = await RealtyNutricaoMetaAlerta.create({
        companyId,
        fluxoId: fluxo.id,
        tipo: c.tipo,
        severidade: c.severidade,
        mensagem: c.mensagem,
        resolvido: false
      } as any);
      criadosLista.push(alerta);
      criados += 1;
    }
  }

  return res.json({ alertas: criados, items: criadosLista });
};

export const resolverAlerta = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user as any;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "id inválido" });

  const alerta = await RealtyNutricaoMetaAlerta.findOne({ where: { id, companyId } });
  if (!alerta) return res.status(404).json({ error: "Alerta não encontrado" });

  await alerta.update({ resolvido: true, resolvidoEm: new Date() });
  return res.json(alerta);
};

export const sugerirMensagem = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user as any;
  const mensagemAtual = String(req.body?.mensagem || "").trim();
  const contextoRaw = req.body?.contexto;
  const contexto =
    typeof contextoRaw === "string"
      ? contextoRaw.trim()
      : contextoRaw != null
        ? JSON.stringify(contextoRaw)
        : "";
  const etapaTitulo = String(req.body?.etapaTitulo || req.body?.titulo || "").trim();
  const promptId = req.body?.promptId != null ? Number(req.body.promptId) : null;

  if (!contexto && !etapaTitulo && !mensagemAtual) {
    return res.status(400).json({ error: "Informe mensagem, contexto ou etapaTitulo" });
  }

  const base =
    mensagemAtual ||
    contexto ||
    `Escreva uma mensagem curta de nutrição de lead imobiliário para a etapa "${etapaTitulo}". Tom consultivo, WhatsApp, pt-BR. Preserve placeholders {{variavel}}.`;

  let systemPrompt =
    "Você é um copywriter de CRM imobiliário. Reescreva/sugira mensagens de nutrição claras, humanas e objetivas. Preserve placeholders {{variavel}}. Responda só com o texto da mensagem.";

  if (promptId) {
    const prompt = await Prompt.findOne({ where: { id: promptId, companyId } });
    if (prompt?.prompt) {
      systemPrompt = String(prompt.prompt).slice(0, 4000);
    }
  }

  try {
    const text = await composerAssistTransform({
      companyId,
      systemPrompt,
      userPrompt: base.slice(0, 4000)
    });
    return res.json({ mensagem: text, source: "composerAssist" });
  } catch (err: any) {
    logger.warn(`[NutricaoIA] composerAssist falhou: ${err?.message || err}`);
    // Fallback: polish simples sem IA
    const polished = applyNutricaoVars(
      base
        .replace(/\s+/g, " ")
        .replace(/\.\s*$/, ".")
        .trim(),
      {
        saudacao: "Olá",
        primeiro_nome: "{{primeiro_nome}}",
        nome: "{{nome}}"
      }
    );
    return res.json({
      mensagem: polished || `Olá {{primeiro_nome}}, passando para retomar contato sobre sua busca.`,
      source: "fallback"
    });
  }
};
