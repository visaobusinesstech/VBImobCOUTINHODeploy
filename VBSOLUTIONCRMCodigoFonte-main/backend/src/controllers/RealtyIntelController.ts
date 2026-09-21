/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 */

import { Request, Response } from "express";
import axios from "axios";
import {
  RadarZapGrupo,
  RadarZapMensagem,
  RadarZapLead,
  ImovelMercado,
  SeoConteudo
} from "../models/RealtyIntel";
import Imovel from "../models/Imovel";
import Contrato from "../models/Contrato";
import LeadSale from "../models/LeadSale";
import { analyzeRadarZapMessage } from "../helpers/radarZapAnalyze";
import {
  PORTAIS,
  buildPortalSearchUrl,
  parseListingHtml,
  extractListingLinks,
  qScoreListing
} from "../helpers/portalScraper";
import { generateSeoContent, computeSeoChecks } from "../helpers/seoContent";
import RealtyModulo from "../models/RealtyModulo";
import { estimateAvaliacao } from "../helpers/avaliacaoImovel";

export const listGrupos = async (req: Request, res: Response) => {
  const { companyId } = req.user;
  const grupos = await RadarZapGrupo.findAll({
    where: { companyId },
    order: [["createdAt", "DESC"]],
    limit: 300
  });
  return res.json({ grupos });
};

export const storeGrupo = async (req: Request, res: Response) => {
  const { companyId } = req.user;
  const name = String(req.body?.name || "").trim();
  if (!name) return res.status(400).json({ error: "name is required" });
  const grupo = await RadarZapGrupo.create({
    name,
    inviteUrl: req.body.inviteUrl || null,
    city: req.body.city || null,
    status: req.body.status || "ativo",
    companyId
  } as any);
  return res.status(201).json(grupo);
};

export const updateGrupo = async (req: Request, res: Response) => {
  const { companyId } = req.user;
  const record = await RadarZapGrupo.findOne({ where: { id: req.params.id, companyId } });
  if (!record) return res.status(404).json({ error: "Not found" });
  await record.update({
    name: req.body.name ?? record.name,
    inviteUrl: req.body.inviteUrl ?? record.inviteUrl,
    city: req.body.city ?? record.city,
    status: req.body.status ?? record.status
  });
  return res.json(record);
};

export const removeGrupo = async (req: Request, res: Response) => {
  const { companyId } = req.user;
  const record = await RadarZapGrupo.findOne({ where: { id: req.params.id, companyId } });
  if (!record) return res.status(404).json({ error: "Not found" });
  await record.destroy();
  return res.json({ message: "deleted" });
};

export const listMensagens = async (req: Request, res: Response) => {
  const { companyId } = req.user;
  const mensagens = await RadarZapMensagem.findAll({
    where: { companyId },
    order: [["createdAt", "DESC"]],
    limit: 200
  });
  return res.json({ mensagens });
};

export const analisarMensagem = async (req: Request, res: Response) => {
  const { companyId } = req.user;
  const textos: string[] = Array.isArray(req.body?.mensagens)
    ? req.body.mensagens.map((m: any) => String(m.texto || m))
    : req.body?.texto
    ? [String(req.body.texto)]
    : [];
  if (!textos.length) return res.status(400).json({ error: "texto is required" });

  const resultados = [];
  for (const texto of textos.slice(0, 20)) {
    const analise = analyzeRadarZapMessage(texto);
    const msg = await RadarZapMensagem.create({
      texto,
      autorContato: analise.contato,
      analisado: true,
      temImovel: analise.tem_imovel,
      intencao: analise.intencao,
      scoreIntencao: analise.score_intencao,
      extraido: analise,
      grupoId: req.body.grupoId || null,
      companyId
    } as any);
    let lead = null;
    if (analise.tem_imovel && ["venda", "aluguel", "temporada"].includes(analise.intencao)) {
      lead = await RadarZapLead.create({
        tipoImovel: analise.tipo_imovel,
        operacao: analise.operacao,
        bairro: analise.bairro,
        cidade: analise.cidade,
        preco: analise.preco,
        contato: analise.contato,
        resumo: analise.resumo,
        status: "novo",
        mensagemId: msg.id,
        grupoId: req.body.grupoId || null,
        companyId
      } as any);
    }
    resultados.push({ mensagem: msg, lead, analise });
  }
  return res.json({ resultados });
};

export const listRadarLeads = async (req: Request, res: Response) => {
  const { companyId } = req.user;
  const leads = await RadarZapLead.findAll({
    where: { companyId },
    order: [["createdAt", "DESC"]],
    limit: 200
  });
  return res.json({ leads });
};

export const updateRadarLead = async (req: Request, res: Response) => {
  const { companyId } = req.user;
  const record = await RadarZapLead.findOne({ where: { id: req.params.id, companyId } });
  if (!record) return res.status(404).json({ error: "Not found" });
  await record.update({ status: req.body.status ?? record.status });
  return res.json(record);
};

export const converterRadarLead = async (req: Request, res: Response) => {
  const { companyId } = req.user;
  const record = await RadarZapLead.findOne({ where: { id: req.params.id, companyId } });
  if (!record) return res.status(404).json({ error: "Not found" });
  const lead = await LeadSale.create({
    name: record.contato || record.resumo?.slice(0, 80) || "Lead RadarZAP",
    description: record.resumo,
    status: "novo",
    value: Number(record.preco) || 0,
    phone: record.contato,
    origin: "radarzap",
    interestCity: record.cidade,
    interestNeighborhood: record.bairro,
    interestType: record.tipoImovel,
    companyId
  } as any);
  await record.update({ status: "convertido" });
  return res.status(201).json({ lead, radarLead: record });
};

export const listMercado = async (req: Request, res: Response) => {
  const { companyId } = req.user;
  const rows = await ImovelMercado.findAll({
    where: { companyId },
    order: [["createdAt", "DESC"]],
    limit: 500
  });
  return res.json({ imoveis: rows, portais: PORTAIS });
};

export const scrapePortais = async (req: Request, res: Response) => {
  const { companyId } = req.user;
  const cidade = String(req.body?.cidade || "Brasília");
  const tipo = String(req.body?.tipo || "apartamento");
  const operacao = String(req.body?.operacao || "Venda");
  const portais: string[] = Array.isArray(req.body?.portais) && req.body.portais.length
    ? req.body.portais
    : PORTAIS.map(p => p.key);

  const errors: string[] = [];
  const encontrados: any[] = [];

  for (const portal of portais.slice(0, 8)) {
    const searchUrl = buildPortalSearchUrl(portal, cidade, tipo, operacao);
    try {
      const { data: html } = await axios.get(searchUrl, {
        timeout: 12000,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html"
        },
        maxRedirects: 3,
        validateStatus: s => s < 500
      });
      const host = new URL(searchUrl).host;
      const links = extractListingLinks(String(html || ""), host);
      if (!links.length) {
        encontrados.push({
          portal,
          url: searchUrl,
          titulo: `Busca ${tipo} ${operacao} ${cidade} (${portal})`,
          cidade,
          tipo,
          operacao,
          preco: null,
          qScore: 40
        });
        continue;
      }
      for (const url of links.slice(0, 8)) {
        try {
          const page = await axios.get(url, {
            timeout: 8000,
            headers: { "User-Agent": "Mozilla/5.0" },
            validateStatus: s => s < 500
          });
          const parsed = parseListingHtml(String(page.data || ""), url, portal);
          parsed.cidade = cidade;
          parsed.tipo = tipo;
          encontrados.push({
            ...parsed,
            operacao,
            qScore: qScoreListing(0, parsed.preco || 0, parsed.area || 0, 0)
          });
        } catch (e: any) {
          errors.push(`${url}: ${e.message}`);
        }
      }
    } catch (e: any) {
      errors.push(`${portal}: ${e.message}`);
      encontrados.push({
        portal,
        url: searchUrl,
        titulo: `Busca ${portal} — ${cidade}`,
        cidade,
        tipo,
        operacao,
        preco: null,
        qScore: 30
      });
    }
  }

  return res.json({ success: true, data: encontrados, errors, total: encontrados.length });
};

export const salvarMercado = async (req: Request, res: Response) => {
  const { companyId } = req.user;
  const items = Array.isArray(req.body?.imoveis) ? req.body.imoveis : [];
  const created = [];
  for (const i of items.slice(0, 100)) {
    if (!i.titulo) continue;
    const row = await ImovelMercado.create({
      portal: i.portal || "manual",
      url: i.url || i.url_anuncio || null,
      titulo: i.titulo,
      tipo: i.tipo || null,
      operacao: i.operacao || null,
      bairro: i.bairro || null,
      cidade: i.cidade || null,
      preco: i.preco || null,
      area: i.area || null,
      quartos: i.quartos || null,
      diasAnuncio: i.diasAnuncio || i.dias_anuncio || 0,
      qScore: i.qScore || i.q_score || null,
      raw: i,
      companyId
    } as any);
    created.push(row);
  }
  return res.status(201).json({ count: created.length, imoveis: created });
};

export const importarMercadoComoImovel = async (req: Request, res: Response) => {
  const { companyId } = req.user;
  const row = await ImovelMercado.findOne({ where: { id: req.params.id, companyId } });
  if (!row) return res.status(404).json({ error: "Not found" });
  const imovel = await Imovel.create({
    title: row.titulo,
    type: row.tipo,
    status: "captacao",
    price: row.preco,
    city: row.cidade,
    neighborhood: row.bairro,
    bedrooms: row.quartos,
    areaM2: row.area,
    description: row.url,
    companyId
  } as any);
  return res.status(201).json(imovel);
};

export const listSeo = async (req: Request, res: Response) => {
  const { companyId } = req.user;
  const rows = await SeoConteudo.findAll({
    where: { companyId },
    order: [["createdAt", "DESC"]],
    limit: 100
  });
  return res.json({ conteudos: rows });
};

export const gerarSeo = async (req: Request, res: Response) => {
  const { companyId } = req.user;
  let imovel: any = null;
  if (req.body?.imovelId) {
    imovel = await Imovel.findOne({ where: { id: req.body.imovelId, companyId } });
  }
  const payload = generateSeoContent({
    title: req.body?.title || imovel?.title,
    type: req.body?.type || imovel?.type,
    city: req.body?.city || imovel?.city,
    neighborhood: req.body?.neighborhood || imovel?.neighborhood,
    bedrooms: req.body?.bedrooms ?? imovel?.bedrooms,
    price: req.body?.price ?? imovel?.price
  });
  return res.json(payload);
};

export const salvarSeo = async (req: Request, res: Response) => {
  const { companyId } = req.user;
  const titulo = String(req.body?.titulo || "").trim();
  if (!titulo) return res.status(400).json({ error: "titulo is required" });
  const checks = computeSeoChecks(req.body || {});
  const row = await SeoConteudo.create({
    titulo,
    slug: req.body.slug || null,
    keyword: req.body.keyword || null,
    meta: req.body.meta || null,
    corpo: req.body.corpo || null,
    score: checks.score,
    checks: checks.items,
    imovelId: req.body.imovelId || null,
    companyId
  } as any);
  return res.status(201).json(row);
};

export const qcaptureAnalise = async (req: Request, res: Response) => {
  const { companyId } = req.user;
  const carteira = await Imovel.findAll({ where: { companyId }, limit: 500 });
  const mercado = await ImovelMercado.findAll({ where: { companyId }, limit: 500 });
  const porBairro: Record<string, number[]> = {};
  for (const m of mercado) {
    const b = m.bairro || m.cidade || "Sem bairro";
    if (!porBairro[b]) porBairro[b] = [];
    const area = Number(m.area) || 0;
    const preco = Number(m.preco) || 0;
    if (area > 0 && preco > 0) porBairro[b].push(preco / area);
  }
  const regioes = Object.entries(porBairro).map(([bairro, arr]) => ({
    bairro,
    totalOfertas: arr.length,
    precoM2Medio: Math.round(arr.reduce((a, b) => a + b, 0) / arr.length),
    oportunidade: arr.length > 8 ? "alta" : arr.length > 3 ? "moderada" : "baixa"
  }));
  const oportunidades = carteira.map(im => {
    const bairro = im.neighborhood || im.city || "Sem bairro";
    const reg = regioes.find(r => r.bairro === bairro);
    const area = Number(im.areaM2) || 1;
    const preco = Number(im.price) || 0;
    const m2 = preco / area;
    const desvio = reg && reg.precoM2Medio ? ((m2 - reg.precoM2Medio) / reg.precoM2Medio) * 100 : 0;
    return {
      imovelId: im.id,
      titulo: im.title,
      bairro,
      preco,
      qScore: qScoreListing(0, preco, area, reg?.precoM2Medio || 0),
      desvioMercado: Math.round(desvio)
    };
  }).sort((a, b) => b.qScore - a.qScore);
  return res.json({ regioes, oportunidades, mercado: mercado.length, carteira: carteira.length });
};

export const listModulos = async (req: Request, res: Response) => {
  const { companyId } = req.user;
  const kind = String(req.query.kind || "");
  const where: any = { companyId };
  if (kind) where.kind = kind;
  const items = await RealtyModulo.findAll({
    where,
    order: [["createdAt", "DESC"]],
    limit: 400
  });
  return res.json({ items });
};

export const storeModulo = async (req: Request, res: Response) => {
  const { companyId } = req.user;
  const kind = String(req.body?.kind || "").trim();
  const title = String(req.body?.title || "").trim();
  if (!kind || !title) return res.status(400).json({ error: "kind and title are required" });
  const row = await RealtyModulo.create({
    kind,
    title,
    status: req.body.status || "aberto",
    notes: req.body.notes || null,
    value: req.body.value ?? null,
    dueDate: req.body.dueDate || null,
    payload: req.body.payload || null,
    companyId
  } as any);
  return res.status(201).json(row);
};

export const updateModulo = async (req: Request, res: Response) => {
  const { companyId } = req.user;
  const record = await RealtyModulo.findOne({ where: { id: req.params.id, companyId } });
  if (!record) return res.status(404).json({ error: "Not found" });
  await record.update({
    title: req.body.title ?? record.title,
    status: req.body.status ?? record.status,
    notes: req.body.notes ?? record.notes,
    value: req.body.value !== undefined ? req.body.value : record.value,
    dueDate: req.body.dueDate !== undefined ? req.body.dueDate : record.dueDate,
    payload: req.body.payload !== undefined ? req.body.payload : record.payload
  });
  return res.json(record);
};

export const removeModulo = async (req: Request, res: Response) => {
  const { companyId } = req.user;
  const record = await RealtyModulo.findOne({ where: { id: req.params.id, companyId } });
  if (!record) return res.status(404).json({ error: "Not found" });
  await record.destroy();
  return res.json({ message: "deleted" });
};

export const avaliarImovel = async (req: Request, res: Response) => {
  const { companyId } = req.user;
  let preco = Number(req.body?.preco) || 0;
  let area = Number(req.body?.area) || 0;
  let m2 = Number(req.body?.precoM2Mercado) || 0;
  if (req.body?.imovelId) {
    const im = await Imovel.findOne({ where: { id: req.body.imovelId, companyId } });
    if (im) {
      preco = preco || Number(im.price) || 0;
      area = area || Number(im.areaM2) || 0;
    }
  }
  if (!m2) {
    const mercado = await ImovelMercado.findAll({ where: { companyId }, limit: 200 });
    const vals = mercado
      .map(m => {
        const a = Number(m.area) || 0;
        const p = Number(m.preco) || 0;
        return a > 0 && p > 0 ? p / a : 0;
      })
      .filter(v => v > 0);
    if (vals.length) m2 = vals.reduce((a, b) => a + b, 0) / vals.length;
  }
  return res.json(estimateAvaliacao(preco, area, m2));
};

export const jornadaCliente = async (req: Request, res: Response) => {
  const { companyId } = req.user;
  const leads = await LeadSale.findAll({
    where: { companyId },
    order: [["updatedAt", "DESC"]],
    limit: 400
  });
  const etapas: Record<string, number> = {};
  for (const l of leads) {
    const s = l.status || "novo";
    etapas[s] = (etapas[s] || 0) + 1;
  }
  const timeline = leads.slice(0, 40).map(l => ({
    id: l.id,
    name: l.name,
    status: l.status,
    followUpAt: (l as any).followUpAt,
    ticketId: (l as any).ticketId,
    updatedAt: l.updatedAt
  }));
  return res.json({ etapas, timeline, total: leads.length });
};

export const inteligenciaMercado = async (req: Request, res: Response) => {
  const { companyId } = req.user;
  const [leads, imoveis, contratos, mercado] = await Promise.all([
    LeadSale.count({ where: { companyId } }),
    Imovel.count({ where: { companyId } }),
    Contrato.count({ where: { companyId } }).catch(() => 0),
    ImovelMercado.count({ where: { companyId } })
  ]);
  const porStatus = await LeadSale.findAll({
    where: { companyId },
    attributes: ["status"],
    limit: 2000
  });
  const funil: Record<string, number> = {};
  for (const l of porStatus) {
    const s = l.status || "novo";
    funil[s] = (funil[s] || 0) + 1;
  }
  return res.json({ leads, imoveis, contratos, mercado, funil });
};
