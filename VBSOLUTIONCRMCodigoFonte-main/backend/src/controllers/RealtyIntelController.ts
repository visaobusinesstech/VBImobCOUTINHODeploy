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
import RealtyFollowup from "../models/RealtyFollowup";
import RealtyVisita from "../models/RealtyVisita";
import RealtyProposta from "../models/RealtyProposta";
import Ticket from "../models/Ticket";
import User from "../models/User";
import { Op } from "sequelize";
import {
  buildAvaliacaoLaudo,
  validarDescricaoBackendShape
} from "../helpers/avaliacaoImovel";
import { DEMO_BY_KIND } from "../helpers/realtyDemoSeed";
import RealtyAvaliacaoHistorico from "../models/RealtyAvaliacaoHistorico";

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

  // Auto-preenche kinds vazios com dados estratégicos do legado
  if (kind) {
    const count = await RealtyModulo.count({ where: { companyId, kind } });
    if (count === 0) {
      const demos = DEMO_BY_KIND[kind] || [];
      for (const demo of demos) {
        await RealtyModulo.create({
          kind,
          title: demo.title,
          status: demo.status || "aberto",
          notes: demo.notes || null,
          value: demo.value ?? null,
          payload: demo.payload || null,
          companyId
        } as any);
      }
    }
  }

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
  const modo = String(req.body?.modo || "manual").toLowerCase();
  const requireDescricao = modo === "manual" || modo === "link";
  const descricao = req.body?.descricao != null ? String(req.body.descricao) : "";

  if (requireDescricao) {
    const descErr = validarDescricaoBackendShape(descricao);
    if (descErr) return res.status(400).json(descErr);
  }

  let preco = Number(req.body?.preco) || 0;
  let area = Number(req.body?.area) || 0;
  let m2 = Number(req.body?.precoM2Mercado) || 0;
  let cidade = String(req.body?.cidade || req.body?.city || "").trim();
  let bairro = String(req.body?.bairro || req.body?.neighborhood || "").trim();
  let tipo = String(req.body?.tipo || req.body?.type || "").trim();
  let operacao = String(req.body?.operacao || "Venda").trim();
  let quartos = req.body?.quartos != null ? Number(req.body.quartos) : null;
  let suites = req.body?.suites != null ? Number(req.body.suites) : null;
  let banheiros = req.body?.banheiros != null ? Number(req.body.banheiros) : null;
  let vagas = req.body?.vagas != null ? Number(req.body.vagas) : null;
  let imovelDescricao = descricao;

  if (req.body?.imovelId) {
    const im = await Imovel.findOne({ where: { id: req.body.imovelId, companyId } });
    if (im) {
      preco = preco || Number(im.price) || 0;
      area = area || Number(im.areaM2) || 0;
      cidade = cidade || String(im.city || "");
      bairro = bairro || String(im.neighborhood || "");
      tipo = tipo || String(im.type || "");
      operacao = operacao || String((im as any).purpose || "Venda");
      if (quartos == null || !Number.isFinite(quartos)) {
        quartos = im.bedrooms != null ? Number(im.bedrooms) : null;
      }
      if (!imovelDescricao) {
        imovelDescricao = String((im as any).description || (im as any).descricao || "");
      }
    }
  }

  let comparaveisCount = 0;
  if (!m2) {
    const mercado = await ImovelMercado.findAll({ where: { companyId }, limit: 400 });
    const norm = (s: string) =>
      s
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
    const cidadeN = cidade ? norm(cidade) : "";
    const bairroN = bairro ? norm(bairro) : "";
    const tipoN = tipo ? norm(tipo) : "";
    const scored = mercado
      .map(m => {
        const a = Number(m.area) || 0;
        const p = Number(m.preco) || 0;
        if (!(a > 0 && p > 0)) return null;
        let w = 1;
        const mc = norm(String((m as any).cidade || (m as any).city || ""));
        const mb = norm(String((m as any).bairro || (m as any).neighborhood || ""));
        const mt = norm(String((m as any).tipo || (m as any).type || ""));
        if (cidadeN && mc && mc === cidadeN) w += 2;
        if (bairroN && mb && mb === bairroN) w += 3;
        if (tipoN && mt && mt.includes(tipoN)) w += 1;
        return { m2: p / a, w };
      })
      .filter(Boolean) as { m2: number; w: number }[];
    comparaveisCount = scored.length;
    if (scored.length) {
      const tw = scored.reduce((s, x) => s + x.w, 0);
      m2 = scored.reduce((s, x) => s + x.m2 * x.w, 0) / tw;
    }
  } else if (Array.isArray(req.body?.comparaveis)) {
    comparaveisCount = req.body.comparaveis.length;
  }

  const result = buildAvaliacaoLaudo({
    preco,
    area,
    precoM2Mercado: m2,
    tipo,
    operacao,
    bairro,
    cidade,
    quartos,
    suites,
    banheiros,
    vagas,
    descricao: imovelDescricao,
    comparaveisCount
  });

  return res.json({
    ...result,
    inputs: {
      preco,
      area,
      cidade,
      bairro,
      tipo,
      operacao,
      quartos,
      suites,
      banheiros,
      vagas,
      precoM2Mercado: Math.round(m2),
      modo,
      comparaveisCount
    }
  });
};

export const extrairDadosAnuncio = async (req: Request, res: Response) => {
  const url = String(req.body?.url || req.body?.link || "").trim();
  if (!url || !/^https?:\/\//i.test(url)) {
    return res.status(400).json({ error: "Informe uma URL válida do anúncio" });
  }
  try {
    const { data: html } = await axios.get(url, {
      timeout: 15000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html"
      },
      maxRedirects: 3,
      validateStatus: s => s < 500
    });
    const host = new URL(url).host;
    const parsed = parseListingHtml(String(html || ""), url, host);
    const links = extractListingLinks(String(html || ""), host);
    const fotos = Array.from(
      String(html || "").matchAll(/<img[^>]+src=["']([^"']+)["']/gi)
    )
      .map(m => m[1])
      .filter(src => /^https?:\/\//i.test(src) && !/logo|icon|sprite/i.test(src))
      .slice(0, 12);

    const descMatch =
      String(html || "").match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)/i) ||
      String(html || "").match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i);

    return res.json({
      success: true,
      dados: {
        titulo: parsed.titulo,
        tipo: parsed.tipo || "Apartamento",
        operacao: /alug/i.test(url) ? "Aluguel" : "Venda",
        area: parsed.area != null ? String(parsed.area) : "",
        quartos: parsed.quartos != null ? String(parsed.quartos) : "",
        bairro: parsed.bairro || "",
        cidade: parsed.cidade || "",
        preco: parsed.preco != null ? String(parsed.preco) : "",
        descricao: descMatch ? String(descMatch[1]).slice(0, 2000) : "",
        link_imovel: url,
        fotos,
        caracteristicas: [] as string[]
      },
      linksDetectados: links.filter(l => l !== url).slice(0, 10)
    });
  } catch (e: any) {
    return res.status(502).json({
      error: `Falha ao extrair anúncio: ${e?.message || "erro de rede"}`,
      code: "EXTRACAO_FALHOU"
    });
  }
};

export const listAvaliacoesHistorico = async (req: Request, res: Response) => {
  const { companyId } = req.user;
  const cidade = String(req.query?.cidade || "").trim();
  const bairro = String(req.query?.bairro || "").trim();
  const where: any = { companyId };
  if (cidade) where.cidade = { [Op.iLike]: `%${cidade}%` };
  if (bairro) where.bairro = { [Op.iLike]: `%${bairro}%` };
  const rows = await RealtyAvaliacaoHistorico.findAll({
    where,
    order: [["createdAt", "DESC"]],
    limit: Math.min(Number(req.query?.limit) || 100, 300)
  });
  return res.json({ historico: rows });
};

export const storeAvaliacaoHistorico = async (req: Request, res: Response) => {
  const { companyId, id: userId } = req.user;
  const b = req.body || {};
  const row = await RealtyAvaliacaoHistorico.create({
    companyId,
    userId,
    imovelId: b.imovelId || null,
    titulo: String(b.titulo || "").slice(0, 255),
    tipo: String(b.tipo || "Apartamento"),
    operacao: String(b.operacao || "Venda"),
    area: Number(b.area) || 0,
    quartos: Number(b.quartos) || 0,
    bairro: b.bairro || null,
    cidade: b.cidade || null,
    estado: b.estado || null,
    precoInformado: Number(b.precoInformado ?? b.preco_informado) || 0,
    valorMinimo: Number(b.valorMinimo ?? b.valor_minimo) || 0,
    valorIdeal: Number(b.valorIdeal ?? b.valor_ideal) || 0,
    valorMaximo: Number(b.valorMaximo ?? b.valor_maximo) || 0,
    precoM2Estimado: Number(b.precoM2Estimado ?? b.preco_m2_estimado) || 0,
    precoM2Regiao: Number(b.precoM2Regiao ?? b.preco_m2_regiao) || 0,
    scoreLiquidez: Number(b.scoreLiquidez ?? b.score_liquidez) || 0,
    classificacaoLiquidez: String(
      b.classificacaoLiquidez ?? b.classificacao_liquidez ?? "media"
    ),
    analiseResumo: b.analiseResumo ?? b.analise_resumo ?? null,
    pontosFortes: b.pontosFortes ?? b.pontos_fortes ?? [],
    pontosAtencao: b.pontosAtencao ?? b.pontos_atencao ?? [],
    estrategiaVenda: b.estrategiaVenda ?? b.estrategia_venda ?? null,
    portaisRecomendados: b.portaisRecomendados ?? b.portais_recomendados ?? [],
    sugestaoPrecoInicial: Number(b.sugestaoPrecoInicial ?? b.sugestao_preco_inicial) || 0,
    probabilidadeVenda30dias:
      Number(b.probabilidadeVenda30dias ?? b.probabilidade_venda_30dias) || 0,
    probabilidadeVenda60dias:
      Number(b.probabilidadeVenda60dias ?? b.probabilidade_venda_60dias) || 0,
    probabilidadeVenda90dias:
      Number(b.probabilidadeVenda90dias ?? b.probabilidade_venda_90dias) || 0,
    precoCompetitivo: Boolean(b.precoCompetitivo ?? b.preco_competitivo),
    modo: String(b.modo || "manual"),
    comparaveisCount: Number(b.comparaveisCount ?? b.comparaveis_count) || 0,
    descricao: b.descricao || null,
    dadosCompletos: b.dadosCompletos ?? b.dados_completos ?? {}
  });
  return res.status(201).json(row);
};

export const updateAvaliacaoHistorico = async (req: Request, res: Response) => {
  const { companyId } = req.user;
  const id = Number(req.params.id);
  const row = await RealtyAvaliacaoHistorico.findOne({ where: { id, companyId } });
  if (!row) return res.status(404).json({ error: "Avaliação não encontrada" });
  const b = req.body || {};
  const map: Record<string, string> = {
    titulo: "titulo",
    tipo: "tipo",
    operacao: "operacao",
    area: "area",
    quartos: "quartos",
    bairro: "bairro",
    cidade: "cidade",
    estado: "estado",
    precoInformado: "precoInformado",
    preco_informado: "precoInformado",
    valorMinimo: "valorMinimo",
    valor_minimo: "valorMinimo",
    valorIdeal: "valorIdeal",
    valor_ideal: "valorIdeal",
    valorMaximo: "valorMaximo",
    valor_maximo: "valorMaximo",
    descricao: "descricao",
    dadosCompletos: "dadosCompletos",
    dados_completos: "dadosCompletos",
    analiseResumo: "analiseResumo",
    analise_resumo: "analiseResumo"
  };
  const patch: any = {};
  for (const [k, field] of Object.entries(map)) {
    if (b[k] !== undefined) patch[field] = b[k];
  }
  await row.update(patch);
  return res.json(row);
};

export const removeAvaliacaoHistorico = async (req: Request, res: Response) => {
  const { companyId } = req.user;
  const id = Number(req.params.id);
  const row = await RealtyAvaliacaoHistorico.findOne({ where: { id, companyId } });
  if (!row) return res.status(404).json({ error: "Avaliação não encontrada" });
  await row.destroy();
  return res.json({ ok: true });
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

export const realtyDashboard = async (req: Request, res: Response) => {
  const empty = {
    kpis: {
      totalLeads: 0,
      leadsMes: 0,
      leadsWon: 0,
      leadsQuentes: 0,
      leadsParados: 0,
      leadsSemCorretor: 0,
      conversao: 0,
      imoveis: 0,
      imoveisCaptacao: 0,
      imoveisDisponiveis: 0,
      contratos: 0,
      followupsPendentes: 0,
      followupsAtrasados: 0,
      visitasHoje: 0,
      propostasAbertas: 0,
      ticketsAbertos: 0,
      corretores: 0,
      landingNovos: 0
    },
    funil: {} as Record<string, number>,
    recentLeads: [] as any[]
  };

  try {
    const { companyId } = req.user;
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

    const safeCount = async (fn: () => any): Promise<number> => {
      try {
        const n = await fn();
        return Number(n) || 0;
      } catch {
        return 0;
      }
    };

    const [
      totalLeads,
      leadsMes,
      leadsWon,
      leadsQuentes,
      leadsSemCorretor,
      imoveis,
      imoveisCaptacao,
      imoveisDisponiveis,
      contratos,
      followupsPendentes,
      followupsAtrasados,
      visitasHoje,
      propostasAbertas,
      ticketsAbertos,
      corretores,
      landingNovos,
      leadsSample
    ] = await Promise.all([
      safeCount(() => LeadSale.count({ where: { companyId } })),
      safeCount(() =>
        LeadSale.count({ where: { companyId, createdAt: { [Op.gte]: startOfMonth } } as any })
      ),
      safeCount(() =>
        LeadSale.count({
          where: {
            companyId,
            status: { [Op.in]: ["fechado", "ganho", "won", "contrato"] }
          }
        })
      ),
      safeCount(() =>
        LeadSale.count({
          where: {
            companyId,
            temperature: { [Op.in]: ["quente", "muito_quente"] }
          } as any
        })
      ),
      safeCount(() =>
        LeadSale.count({
          where: {
            companyId,
            [Op.or]: [{ responsibleId: null }, { responsibleId: 0 }]
          }
        })
      ),
      safeCount(() => Imovel.count({ where: { companyId } })),
      safeCount(() => Imovel.count({ where: { companyId, status: "captacao" } })),
      safeCount(() =>
        Imovel.count({
          where: { companyId, status: { [Op.in]: ["disponivel", "ativo", "publicado"] } }
        })
      ),
      safeCount(() => Contrato.count({ where: { companyId } })),
      safeCount(() => RealtyFollowup.count({ where: { companyId, status: "pendente" } })),
      safeCount(() =>
        RealtyFollowup.count({
          where: {
            companyId,
            status: "pendente",
            scheduledAt: { [Op.lt]: now }
          } as any
        })
      ),
      safeCount(() =>
        RealtyVisita.count({
          where: {
            companyId,
            scheduledAt: {
              [Op.gte]: startOfDay,
              [Op.lte]: endOfDay
            }
          } as any
        })
      ),
      safeCount(() =>
        RealtyProposta.count({
          where: {
            companyId,
            status: { [Op.in]: ["enviada", "em_negociacao", "rascunho"] }
          }
        })
      ),
      safeCount(() =>
        Ticket.count({
          where: { companyId, status: { [Op.in]: ["open", "pending"] } }
        })
      ),
      safeCount(() => User.count({ where: { companyId } })),
      safeCount(() =>
        RealtyModulo.count({
          where: { companyId, kind: "leads_landing", status: { [Op.ne]: "lido" } }
        })
      ),
      LeadSale.findAll({
        where: { companyId },
        attributes: ["id", "name", "status", "temperature", "value", "followUpAt", "updatedAt"],
        order: [["updatedAt", "DESC"]],
        limit: 8
      }).catch(() => [])
    ]);

    const leadsParados = await safeCount(() =>
      LeadSale.count({
        where: {
          companyId,
          updatedAt: { [Op.lt]: threeDaysAgo },
          status: { [Op.notIn]: ["fechado", "ganho", "won", "perdido", "lost"] }
        } as any
      })
    );

    const porStatus = await LeadSale.findAll({
      where: { companyId },
      attributes: ["status"],
      limit: 3000
    }).catch(() => []);
    const funil: Record<string, number> = {};
    for (const l of porStatus) {
      const s = l.status || "novo";
      funil[s] = (funil[s] || 0) + 1;
    }

    const conversao =
      totalLeads > 0 ? Math.round((leadsWon / totalLeads) * 1000) / 10 : 0;

    return res.json({
      kpis: {
        totalLeads,
        leadsMes,
        leadsWon,
        leadsQuentes,
        leadsParados,
        leadsSemCorretor,
        conversao,
        imoveis,
        imoveisCaptacao,
        imoveisDisponiveis,
        contratos,
        followupsPendentes,
        followupsAtrasados,
        visitasHoje,
        propostasAbertas,
        ticketsAbertos,
        corretores,
        landingNovos
      },
      funil,
      recentLeads: leadsSample
    });
  } catch {
    return res.json(empty);
  }
};

/** Seed estratégico (legado Radar/Coutinho) — só preenche kinds vazios da empresa. */
export const seedRealtyDemo = async (req: Request, res: Response) => {
  const { companyId } = req.user;
  let created = 0;
  for (const kind of Object.keys(DEMO_BY_KIND)) {
    const existing = await RealtyModulo.count({ where: { companyId, kind } });
    if (existing > 0) continue;
    for (const demo of DEMO_BY_KIND[kind]) {
      await RealtyModulo.create({
        kind: demo.kind,
        title: demo.title,
        status: demo.status || "aberto",
        notes: demo.notes || null,
        value: demo.value ?? null,
        payload: demo.payload || null,
        companyId
      } as any);
      created += 1;
    }
  }

  const fuCount = await RealtyFollowup.count({ where: { companyId } }).catch(() => 0);
  const lead = await LeadSale.findOne({ where: { companyId }, order: [["id", "ASC"]] });
  if (fuCount === 0 && lead) {
    await RealtyFollowup.create({
      type: "whatsapp",
      scheduledAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
      status: "pendente",
      notes: "Retorno estratégico pós-LP — confirmar interesse e cidade.",
      result: "",
      leadSaleId: lead.id,
      companyId
    } as any);
    created += 1;
  }

  return res.json({ created, message: created ? "Dados estratégicos carregados" : "Já havia dados; nada a criar" });
};
