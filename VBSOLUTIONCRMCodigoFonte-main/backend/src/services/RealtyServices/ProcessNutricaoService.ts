/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Processamento de fluxos de nutrição multi-etapa (estilo Lovable),
 * com envio via WhatsApp Web (Baileys) ou API Oficial.
 */

import { Op } from "sequelize";
import Company from "../../models/Company";
import Imovel from "../../models/Imovel";
import LeadSale from "../../models/LeadSale";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import User from "../../models/User";
import Whatsapp from "../../models/Whatsapp";
import RealtyNutricaoEnvio from "../../models/RealtyNutricaoEnvio";
import RealtyNutricaoEtapa from "../../models/RealtyNutricaoEtapa";
import RealtyNutricaoEvento from "../../models/RealtyNutricaoEvento";
import RealtyNutricaoFluxo from "../../models/RealtyNutricaoFluxo";
import RealtyNutricaoInscricao from "../../models/RealtyNutricaoInscricao";
import ResolveTicketForLeadPreviewService from "../TicketServices/ResolveTicketForLeadPreviewService";
import FindOrCreateTicketService from "../TicketServices/FindOrCreateTicketService";
import ShowTicketService from "../TicketServices/ShowTicketService";
import Contact from "../../models/Contact";
import SendWhatsAppMessage from "../WbotServices/SendWhatsAppMessage";
import SendWhatsAppOficialMessage from "../WhatsAppOficial/SendWhatsAppOficialMessage";
import { sendMetaCloudMessageDirect } from "../WhatsAppOficial/sendMetaCloudMessageDirect";
import sendTelegramMessageFromTicket from "../TelegramServices/sendTelegramMessageFromTicket";
import sendTelegramUserMessageFromTicket from "../TelegramUserServices/sendTelegramUserMessageFromTicket";
import sendSmsMessageFromTicket from "../SmsServices/sendSmsMessageFromTicket";
import { sendFacebookMessage } from "../FacebookServices/sendFacebookMessage";
import logger from "../../utils/logger";

const PERFIL_MATCHERS: Record<string, RegExp> = {
  comprador: /(compra|comprar|venda|aquisic)/i,
  locatario: /(loca|alug|rent)/i,
  investidor: /(investi|renda|rentab)/i,
  moradia: /(moradia|residenc|morar|propria|própria)/i,
  proprietario: /(propriet|captac|captaç|anunciar)/i
};

const CLOSED_STATUSES = [
  "fechado",
  "perdido",
  "concluido",
  "comprou_outra",
  "desistiu",
  "cancelado",
  "ganho",
  "perda"
];

const VARIAVEIS_ESSENCIAIS = [
  "imovel_link",
  "imovel_endereco",
  "imovel_titulo",
  "imovel_resumo",
  "imovel_preco"
];
const VARIAVEIS_URL = ["imovel_link"];

const digitsOnly = (value?: string | null) => String(value || "").replace(/\D/g, "");

const norm = (v: unknown) =>
  String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

const brl = (v: unknown) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return "";
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0
  });
};

function saudacaoAgora(d = new Date()) {
  const h = Number(
    new Intl.DateTimeFormat("pt-BR", {
      hour: "numeric",
      hour12: false,
      timeZone: "America/Sao_Paulo"
    }).format(d)
  );
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function urlValida(valor: string) {
  try {
    const u = new URL(valor.trim());
    return (u.protocol === "http:" || u.protocol === "https:") && u.hostname.includes(".");
  } catch {
    return false;
  }
}

function essenciaisPendentes(texto: string, ctx: Record<string, string>) {
  const usadas = [...texto.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map(m => m[1]);
  return [...new Set(usadas)].filter(k => {
    if (!VARIAVEIS_ESSENCIAIS.includes(k)) return false;
    const valor = (ctx[k] ?? "").toString().trim();
    if (!valor) return true;
    return VARIAVEIS_URL.includes(k) && !urlValida(valor);
  });
}

function combinaSegmentacao(
  lead: LeadSale,
  perfis: string[],
  motivos: string[]
): boolean {
  if (perfis.length > 0) {
    const alvo = `${(lead as any).purpose ?? ""} ${(lead as any).interestType ?? ""} ${
      lead.description ?? ""
    } ${(lead as any).temperature ?? ""}`;
    const ok = perfis.some(p => {
      const re = PERFIL_MATCHERS[p];
      return re ? re.test(alvo) : true;
    });
    if (!ok) return false;
  }
  if (motivos.length > 0) {
    const lost = norm((lead as any).lostReason);
    if (!motivos.map(norm).includes(lost)) return false;
  }
  return true;
}

export function applyNutricaoVars(
  texto: string,
  ctx: Record<string, string | null | undefined>
): string {
  return String(texto || "")
    .replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key) => (ctx[key] ?? "").toString())
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +([,.!?;:])/g, "$1")
    .trimStart();
}

export function buildNutricaoContext(params: {
  inscricao?: { nome?: string | null; telefone?: string | null; email?: string | null };
  lead?: LeadSale | null;
  imovel?: Imovel | null;
  company?: Company | null;
  corretor?: string;
  siteBase?: string;
}): Record<string, string> {
  const { inscricao, lead, imovel, company, corretor = "", siteBase = "" } = params;
  const nome = str(inscricao?.nome ?? lead?.name);
  const area = Number(imovel?.areaM2);
  const areaTxt = Number.isFinite(area) && area > 0 ? `${area} m²` : "";
  const resumo = [
    str(imovel?.type),
    imovel?.bedrooms ? `${imovel.bedrooms} quartos` : "",
    areaTxt,
    str(imovel?.neighborhood),
    brl(imovel?.price)
  ]
    .filter(Boolean)
    .join(" • ");

  const interesse =
    [
      (lead as any)?.interestType,
      (lead as any)?.purpose,
      lead?.description
    ]
      .filter(Boolean)
      .join(" / ") || "";

  const valorMax = brl((lead as any)?.priceMax) || brl(lead?.value);
  const bairro =
    str((lead as any)?.interestNeighborhood) || str((lead as any)?.interestCity);

  return {
    nome,
    primeiro_nome: nome.split(/\s+/)[0] || "",
    telefone: str(inscricao?.telefone ?? lead?.phone),
    email: str(inscricao?.email ?? lead?.email),
    interesse,
    tipo_operacao: str((lead as any)?.purpose),
    tipo_imovel_interesse: str((lead as any)?.interestType),
    bairro_interesse: bairro,
    bairro,
    valor: valorMax || "seu orçamento",
    valor_maximo: valorMax,
    quartos_minimo: str((lead as any)?.bedrooms),
    vagas_minimo: str((lead as any)?.parkingSpots),
    urgencia: str((lead as any)?.temperature),
    estagio: str(lead?.status),
    corretor: str(corretor),

    imovel_titulo: str(imovel?.title),
    imovel_tipo: str(imovel?.type),
    imovel_operacao: str(imovel?.purpose),
    imovel_preco: brl(imovel?.price),
    imovel_bairro: str(imovel?.neighborhood),
    imovel_cidade: str(imovel?.city),
    imovel_endereco: str(imovel?.address),
    imovel_quartos: str(imovel?.bedrooms),
    imovel_suites: str(imovel?.suites),
    imovel_banheiros: str(imovel?.bathrooms),
    imovel_vagas: str(imovel?.parkingSpots),
    imovel_area: areaTxt,
    imovel_condominio: brl(imovel?.condoFee),
    imovel_iptu: brl(imovel?.iptu),
    imovel_resumo: resumo,
    imovel_link: imovel?.id && siteBase ? `${siteBase.replace(/\/$/, "")}/imovel/${imovel.id}` : str(imovel?.videoUrl),

    imobiliaria: str(company?.name),
    imobiliaria_telefone: str(company?.phone),
    imobiliaria_email: str(company?.email),
    creci: "",

    hoje: new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }),
    saudacao: saudacaoAgora()
  };
}

function melhorImovel(lead: LeadSale | null, imoveis: Imovel[]): Imovel | null {
  if (!lead || imoveis.length === 0) return null;
  const alvoTipo = norm((lead as any).interestType);
  const alvoBairro = norm((lead as any).interestNeighborhood);
  const teto = Number((lead as any).priceMax ?? lead.value ?? 0);
  const quartos = Number((lead as any).bedrooms ?? 0);

  let melhor: Imovel | null = null;
  let melhorScore = -1;
  for (const im of imoveis) {
    let score = 0;
    if (alvoTipo && norm(im.type).includes(alvoTipo)) score += 3;
    if (alvoBairro && norm(im.neighborhood).includes(alvoBairro)) score += 3;
    const preco = Number(im.price ?? 0);
    if (teto > 0 && preco > 0 && preco <= teto) score += 2;
    if (quartos > 0 && Number(im.bedrooms ?? 0) >= quartos) score += 1;
    if (score > melhorScore) {
      melhorScore = score;
      melhor = im;
    }
  }
  return melhorScore > 0 ? melhor : null;
}

export type DispatchNutricaoResult = {
  sent: boolean;
  channel: string | null;
  ticketId: number | null;
  error: string | null;
};

export async function dispatchNutricaoEnvio(params: {
  envio: RealtyNutricaoEnvio;
  companyId: number;
  userId: number;
  whatsappId?: number | null;
}): Promise<DispatchNutricaoResult> {
  const { envio, companyId, userId } = params;
  const messageBody = String(envio.mensagem || "").trim();
  if (!messageBody) {
    await envio.update({ status: "falha", erro: "Mensagem vazia." });
    return { sent: false, channel: envio.canal, ticketId: null, error: "Mensagem vazia." };
  }

  if (String(envio.canal || "").toLowerCase() === "email") {
    const err =
      "Canal e-mail: envio automático via SMTP não está ligado neste fluxo. Use o contato por e-mail do lead.";
    await envio.update({ status: "falha", erro: err });
    return { sent: false, channel: "email", ticketId: null, error: err };
  }

  const lead = envio.leadSaleId
    ? await LeadSale.findOne({ where: { id: envio.leadSaleId, companyId } })
    : null;

  // Resolve conexão escolhida na Integração (nome + canal)
  let whatsapp: Whatsapp | null = null;
  const waId = params.whatsappId;
  if (waId) {
    whatsapp = await Whatsapp.findOne({ where: { id: waId, companyId } });
  }
  if (!whatsapp && String(envio.canal || "").startsWith("conn:")) {
    const parsed = Number(String(envio.canal).slice(5));
    if (Number.isFinite(parsed) && parsed > 0) {
      whatsapp = await Whatsapp.findOne({ where: { id: parsed, companyId } });
    }
  }

  if (!whatsapp) {
    const err =
      "Nenhuma conexão selecionada. Escolha um canal conectado em Integrações no fluxo de nutrição.";
    await envio.update({ status: "falha", erro: err });
    return { sent: false, channel: envio.canal, ticketId: null, error: err };
  }

  if (String(whatsapp.status || "").toUpperCase() !== "CONNECTED") {
    const err = `Conexão "${whatsapp.name || whatsapp.id}" não está conectada (status=${whatsapp.status}).`;
    await envio.update({ status: "falha", erro: err });
    return {
      sent: false,
      channel: whatsapp.channel,
      ticketId: null,
      error: err
    };
  }

  const channel = whatsapp.channel || "whatsapp";
  const number = digitsOnly(
    envio.destino || lead?.phone || ""
  );

  // Contato + ticket NA conexão escolhida (não em outra sessão)
  let contact: Contact | null = null;
  if (lead?.contactId) {
    contact = await Contact.findOne({ where: { id: lead.contactId, companyId } });
  }
  if (!contact && number) {
    const [c] = await Contact.findOrCreate({
      where: { number, companyId },
      defaults: {
        companyId,
        name: lead?.name || envio.titulo || "Nutrição",
        number,
        email: lead?.email || "",
        whatsappId: whatsapp.id,
        channel,
        profilePicUrl: ""
      }
    });
    contact = c;
    if (lead && !lead.contactId) {
      await lead.update({ contactId: contact.id });
    }
  }

  let ticket: Ticket | null = null;
  if (contact) {
    try {
      ticket = await FindOrCreateTicketService(
        contact,
        whatsapp,
        0,
        companyId,
        null,
        userId,
        undefined,
        channel
      );
      if (ticket?.id) {
        await envio.update({ ticketId: ticket.id });
        if (lead) await lead.update({ ticketId: ticket.id });
      }
    } catch (err: any) {
      logger.warn(
        `[NUTRICAO] FindOrCreateTicket falhou: ${err?.message || err}`
      );
    }
  }

  // Fallback genérico se ainda sem ticket
  if (!ticket && lead) {
    ticket = await ResolveTicketForLeadPreviewService({
      companyId,
      contactId: lead.contactId || contact?.id,
      phone: lead.phone || envio.destino,
      requestUserId: userId
    });
  }

  const markSent = async (ticketId: number | null) => {
    await envio.update({
      status: "enviado",
      enviadoEm: new Date(),
      erro: null,
      ticketId: ticketId || envio.ticketId,
      canal: channel
    });
    return {
      sent: true,
      channel,
      ticketId: ticketId || envio.ticketId || null,
      error: null
    } as DispatchNutricaoResult;
  };

  const markFail = async (msg: string, ticketId: number | null = null) => {
    await envio.update({ status: "falha", erro: msg, ticketId: ticketId || envio.ticketId });
    return {
      sent: false,
      channel,
      ticketId: ticketId || envio.ticketId || null,
      error: msg
    } as DispatchNutricaoResult;
  };

  try {
    // ——— WhatsApp API Oficial ———
    if (channel === "whatsapp_oficial") {
      if (ticket) {
        const fullTicket = await ShowTicketService(ticket.id, companyId);
        await SendWhatsAppOficialMessage({
          body: messageBody,
          ticket: fullTicket,
          quotedMsg: null,
          type: "text",
          media: null
        });
        return markSent(fullTicket.id);
      }
      if (number) {
        await sendMetaCloudMessageDirect({
          whatsapp,
          toNumber: number,
          type: "text",
          textBody: messageBody
        });
        return markSent(null);
      }
      return markFail("Telefone não cadastrado para envio oficial.");
    }

    // ——— WhatsApp Web (Baileys) ———
    if (channel === "whatsapp") {
      if (!ticket) {
        return markFail("Sem ticket WhatsApp vinculado ao lead/telefone nesta conexão.");
      }
      const fullTicket = await Ticket.findByPk(ticket.id, {
        include: ["contact", "whatsapp"]
      } as any);
      if (!fullTicket) return markFail("Ticket não encontrado.");
      await SendWhatsAppMessage({ body: messageBody, ticket: fullTicket as any });
      return markSent(fullTicket.id);
    }

    // ——— Demais canais da Integração ———
    if (!ticket) {
      return markFail(
        `Sem ticket no canal ${channel}. Abra um atendimento com esta conexão primeiro.`
      );
    }
    const fullTicket = await ShowTicketService(ticket.id, companyId);

    if (channel === "telegram") {
      await sendTelegramMessageFromTicket({ body: messageBody, ticket: fullTicket });
      return markSent(fullTicket.id);
    }
    if (channel === "telegram_oficial") {
      await sendTelegramUserMessageFromTicket({ body: messageBody, ticket: fullTicket });
      return markSent(fullTicket.id);
    }
    if (channel === "sms") {
      await sendSmsMessageFromTicket({ body: messageBody, ticket: fullTicket });
      return markSent(fullTicket.id);
    }
    if (channel === "facebook" || channel === "instagram") {
      await sendFacebookMessage({ body: messageBody, ticket: fullTicket });
      return markSent(fullTicket.id);
    }

    return markFail(`Canal "${channel}" ainda não suportado no envio automático de nutrição.`);
  } catch (err: any) {
    const msg = err?.message || String(err);
    logger.error(`[NUTRICAO][${channel}] Falha envio: ${msg}`);
    return markFail(msg, ticket?.id || null);
  }
}

async function maybeDecideAbWinner(etapa: RealtyNutricaoEtapa, agora: Date): Promise<void> {
  if (!etapa.abAtivo || etapa.abAutoEscolher === false || etapa.abVencedor) return;
  const minEnvios = Number(etapa.abMinEnvios ?? 20);

  const envios = await RealtyNutricaoEnvio.findAll({
    where: { etapaId: etapa.id },
    attributes: ["id", "status", "variante"],
    limit: 2000
  });
  const grupo = (v: string) => envios.filter(e => (e.variante || "A") === v);
  const enviadosA = grupo("A").filter(e => e.status === "enviado");
  const enviadosB = grupo("B").filter(e => e.status === "enviado");
  if (enviadosA.length < minEnvios || enviadosB.length < minEnvios) return;

  const eventos = await RealtyNutricaoEvento.findAll({
    where: { etapaId: etapa.id },
    attributes: ["envioId", "tipo"],
    limit: 4000
  });
  const score = (ids: Set<number>, total: number) => {
    const evs = eventos.filter(e => e.envioId && ids.has(e.envioId));
    const resposta = evs.filter(e => e.tipo === "resposta").length;
    const conv = evs.filter(e => e.tipo === "agendamento" || e.tipo === "fechamento").length;
    return total > 0 ? ((resposta + conv) / total) * 100 : 0;
  };
  const sA = score(new Set(enviadosA.map(e => e.id)), enviadosA.length);
  const sB = score(new Set(enviadosB.map(e => e.id)), enviadosB.length);
  if (sA === sB) return;

  const vencedor = sA > sB ? "A" : "B";
  const patch: Partial<RealtyNutricaoEtapa> = {
    abAtivo: false,
    abVencedor: vencedor,
    abDecididoEm: agora
  } as any;
  if (vencedor === "B") {
    (patch as any).titulo = etapa.abTituloB || etapa.titulo;
    (patch as any).mensagem = etapa.abMensagemB || etapa.mensagem;
    etapa.titulo = String((patch as any).titulo);
    etapa.mensagem = String((patch as any).mensagem);
  }
  etapa.abAtivo = false;
  etapa.abVencedor = vencedor;
  await etapa.update(patch as any);
}

async function leadRespondeuAposInscricao(
  insc: RealtyNutricaoInscricao,
  lead: LeadSale | null,
  companyId: number
): Promise<boolean> {
  if (!lead) return false;
  const statusNorm = norm(lead.status);
  if (CLOSED_STATUSES.some(s => statusNorm === s || statusNorm.includes(s))) {
    return true;
  }
  // Lead updated after enrollment (activity)
  if (
    lead.updatedAt &&
    insc.createdAt &&
    new Date(lead.updatedAt).getTime() > new Date(insc.createdAt).getTime() + 60000
  ) {
    // Prefer ticket inbound check when available
    if (lead.ticketId) {
      const inbound = await Message.findOne({
        where: {
          ticketId: lead.ticketId,
          fromMe: false,
          createdAt: { [Op.gt]: insc.createdAt }
        },
        order: [["createdAt", "DESC"]]
      });
      if (inbound) return true;
    }
    // Without ticket messages, updatedAt alone is a weak signal — still honor Lovable behavior
    return true;
  }
  if (lead.ticketId) {
    const inbound = await Message.findOne({
      where: {
        ticketId: lead.ticketId,
        fromMe: false,
        createdAt: { [Op.gt]: insc.createdAt }
      }
    });
    if (inbound) return true;
  }
  void companyId;
  return false;
}

export async function processNutricaoCompany(params: {
  companyId: number;
  userId: number;
  autoSend?: boolean;
}): Promise<{
  inscritos: number;
  envios: number;
  enviados: number;
  encerrados: number;
  skipped: number;
  concluidos: number;
}> {
  const { companyId, userId } = params;
  const autoSend = params.autoSend !== false;
  const agora = new Date();
  const resumo = {
    inscritos: 0,
    envios: 0,
    enviados: 0,
    encerrados: 0,
    skipped: 0,
    concluidos: 0
  };

  const company = await Company.findByPk(companyId);
  const siteBase = process.env.FRONTEND_URL || process.env.SITE_URL || "";

  const fluxos = await RealtyNutricaoFluxo.findAll({
    where: { companyId, ativo: true }
  });

  const imoveisCache = await Imovel.findAll({
    where: { companyId },
    limit: 300
  });

  for (const fluxo of fluxos) {
    const etapas = await RealtyNutricaoEtapa.findAll({
      where: { fluxoId: fluxo.id, companyId, ativo: true },
      order: [["ordem", "ASC"]]
    });
    if (etapas.length === 0) {
      resumo.skipped += 1;
      continue;
    }

    for (const etapa of etapas) {
      await maybeDecideAbWinner(etapa, agora);
    }

    // 1) Auto-enroll inactive leads (ou destinatários manuais selecionados)
    const corte = new Date(agora);
    corte.setDate(corte.getDate() - (Number(fluxo.diasInatividade) || 30));

    const segEstagios: string[] = Array.isArray(fluxo.segmentoEstagios)
      ? fluxo.segmentoEstagios
      : [];
    const segPerfis: string[] = Array.isArray(fluxo.segmentoPerfis) ? fluxo.segmentoPerfis : [];
    const segMotivos: string[] = Array.isArray(fluxo.segmentoMotivosPerda)
      ? fluxo.segmentoMotivosPerda
      : [];
    const destLeadIds: number[] = Array.isArray((fluxo as any).destinatarioLeadSaleIds)
      ? (fluxo as any).destinatarioLeadSaleIds.map(Number).filter((n: number) => Number.isFinite(n) && n > 0)
      : [];
    const destContactIds: number[] = Array.isArray((fluxo as any).destinatarioContactIds)
      ? (fluxo as any).destinatarioContactIds.map(Number).filter((n: number) => Number.isFinite(n) && n > 0)
      : [];

    let leadsBrutos: LeadSale[] = [];

    if (destLeadIds.length > 0 || destContactIds.length > 0) {
      const orConds: any[] = [];
      if (destLeadIds.length > 0) orConds.push({ id: { [Op.in]: destLeadIds } });
      if (destContactIds.length > 0) orConds.push({ contactId: { [Op.in]: destContactIds } });
      leadsBrutos = await LeadSale.findAll({
        where: {
          companyId,
          [Op.or]: orConds,
          [Op.and]: [{ [Op.or]: [{ phone: { [Op.ne]: null } }, { email: { [Op.ne]: null } }] }]
        },
        limit: 500
      });
      if (destContactIds.length > 0) {
        const linkedContactIds = new Set(
          leadsBrutos.map(l => l.contactId).filter((id): id is number => id != null)
        );
        const missingContactIds = destContactIds.filter(id => !linkedContactIds.has(id));
        if (missingContactIds.length > 0) {
          const contacts = await Contact.findAll({
            where: { companyId, id: { [Op.in]: missingContactIds } },
            limit: 500
          });
          const jaInscritosPhones = await RealtyNutricaoInscricao.findAll({
            where: { fluxoId: fluxo.id, companyId },
            attributes: ["telefone", "leadSaleId"]
          });
          const phoneSet = new Set(
            jaInscritosPhones.map(i => String(i.telefone || "").replace(/\D/g, "")).filter(Boolean)
          );
          for (const c of contacts) {
            const phone = String(c.number || "").replace(/\D/g, "");
            if (!phone || phoneSet.has(phone)) continue;
            await RealtyNutricaoInscricao.create({
              companyId,
              fluxoId: fluxo.id,
              leadSaleId: null,
              nome: c.name,
              telefone: c.number || null,
              email: c.email || null,
              status: "ativa",
              etapaAtual: 0,
              proximaExecucao: new Date(agora.getTime() + (etapas[0].diasApos || 0) * 86400000)
            } as any);
            phoneSet.add(phone);
            resumo.inscritos += 1;
          }
        }
      }
    } else {
      const whereLead: any = {
        companyId,
        updatedAt: { [Op.lte]: corte },
        [Op.or]: [{ phone: { [Op.ne]: null } }, { email: { [Op.ne]: null } }]
      };

      if (segEstagios.length > 0) {
        whereLead.status = { [Op.in]: segEstagios };
      } else if (fluxo.publicoAlvo === "lead_sem_resposta") {
        whereLead.status = {
          [Op.in]: ["novo", "contato", "contatado", "qualificado", "em_atendimento", "aberto"]
        };
      } else if (segMotivos.length > 0) {
        whereLead.status = { [Op.notIn]: ["fechado", "ganho"] };
      } else {
        whereLead.status = { [Op.notIn]: CLOSED_STATUSES };
      }

      leadsBrutos = await LeadSale.findAll({ where: whereLead, limit: 200 });
    }

    const leads = leadsBrutos.filter(l =>
      destLeadIds.length > 0 || destContactIds.length > 0
        ? true
        : combinaSegmentacao(l, segPerfis, segMotivos)
    );

    const jaInscritos = await RealtyNutricaoInscricao.findAll({
      where: { fluxoId: fluxo.id, companyId },
      attributes: ["leadSaleId"]
    });
    const inscritosSet = new Set(
      jaInscritos.map(i => i.leadSaleId).filter((id): id is number => id != null)
    );

    const novos = leads.filter(
      l => !inscritosSet.has(l.id) && (l.phone || l.email)
    );

    for (const l of novos) {
      await RealtyNutricaoInscricao.create({
        companyId,
        fluxoId: fluxo.id,
        leadSaleId: l.id,
        nome: l.name,
        telefone: l.phone || null,
        email: l.email || null,
        status: "ativa",
        etapaAtual: 0,
        proximaExecucao: new Date(agora.getTime() + (etapas[0].diasApos || 0) * 86400000)
      } as any);
      resumo.inscritos += 1;
    }

    // 2) Process due enrollments
    const pendentes = await RealtyNutricaoInscricao.findAll({
      where: {
        fluxoId: fluxo.id,
        companyId,
        status: "ativa",
        proximaExecucao: { [Op.lte]: agora }
      },
      limit: 300
    });

    for (const insc of pendentes) {
      const lead = insc.leadSaleId
        ? await LeadSale.findOne({ where: { id: insc.leadSaleId, companyId } })
        : null;

      if (fluxo.encerrarAoResponder) {
        const respondeu = await leadRespondeuAposInscricao(insc, lead, companyId);
        if (respondeu) {
          await insc.update({
            status: "encerrada",
            motivoEncerramento: "Lead voltou a interagir"
          });
          resumo.encerrados += 1;
          continue;
        }
      }

      const etapa = etapas[insc.etapaAtual];
      if (!etapa) {
        await insc.update({
          status: "concluida",
          motivoEncerramento: "Fluxo finalizado"
        });
        resumo.concluidos += 1;
        continue;
      }

      let canal =
        etapa.canal === "heranca" || !etapa.canal ? fluxo.canal || "whatsapp" : etapa.canal;
      let etapaWhatsappId: number | null = fluxo.whatsappId || null;
      if (String(canal).startsWith("conn:")) {
        const id = Number(String(canal).slice(5));
        if (Number.isFinite(id) && id > 0) {
          etapaWhatsappId = id;
          const waConn = await Whatsapp.findOne({
            where: { id, companyId },
            attributes: ["id", "channel", "status", "name"]
          });
          canal = waConn?.channel || "whatsapp";
        }
      }
      // Se o fluxo tem canal messaging sem whatsappId, pega conexão CONNECTED desse tipo
      if (
        !etapaWhatsappId &&
        canal !== "email" &&
        !String(canal).startsWith("conn:")
      ) {
        const waFallback = await Whatsapp.findOne({
          where: {
            companyId,
            channel: canal || "whatsapp",
            status: "CONNECTED"
          },
          order: [["updatedAt", "DESC"]]
        });
        if (waFallback) etapaWhatsappId = waFallback.id;
      }
      const destino = canal === "email" ? insc.email : insc.telefone || lead?.phone;

      let corretorNome = "";
      if (lead?.responsibleId) {
        const u = await User.findByPk(lead.responsibleId, { attributes: ["name"] });
        corretorNome = u?.name || "";
      }

      const linkedImovel =
        lead?.imovelId != null
          ? imoveisCache.find(i => i.id === lead.imovelId) ||
            (await Imovel.findOne({ where: { id: lead.imovelId, companyId } }))
          : null;
      const imovelCtx = linkedImovel || melhorImovel(lead, imoveisCache);

      const ctx = buildNutricaoContext({
        inscricao: insc,
        lead,
        imovel: imovelCtx,
        company,
        corretor: corretorNome,
        siteBase
      });

      const usaAB = !!etapa.abAtivo && !!(etapa.abMensagemB || "").trim();
      const splitA = Math.min(95, Math.max(5, Number(etapa.abSplit ?? 50)));
      const variante = usaAB ? (Math.random() * 100 < splitA ? "A" : "B") : "A";
      const tituloBase = variante === "B" ? etapa.abTituloB || etapa.titulo : etapa.titulo;
      const mensagemBase =
        variante === "B" ? etapa.abMensagemB || etapa.mensagem : etapa.mensagem;

      const pendentesVars = essenciaisPendentes(`${tituloBase} ${mensagemBase}`, ctx);
      const bloqueado = pendentesVars.length > 0;

      const envio = await RealtyNutricaoEnvio.create({
        companyId,
        inscricaoId: insc.id,
        etapaId: etapa.id,
        leadSaleId: insc.leadSaleId,
        canal,
        destino: destino || null,
        variante: usaAB ? variante : null,
        titulo: applyNutricaoVars(tituloBase || "", ctx),
        mensagem: applyNutricaoVars(mensagemBase || "", ctx),
        status: !destino || bloqueado ? "falha" : "pendente",
        erro: !destino
          ? "Contato sem telefone/e-mail para o canal escolhido"
          : bloqueado
            ? `Envio bloqueado: variáveis essenciais vazias ou inválidas (${pendentesVars.join(
                ", "
              )})`
            : null
      } as any);
      resumo.envios += 1;

      const canAutoSendWa =
        String(canal).startsWith("whatsapp") ||
        canal === "telegram" ||
        canal === "telegram_oficial" ||
        canal === "instagram" ||
        canal === "facebook" ||
        canal === "sms";
      if (autoSend && envio.status === "pendente" && canAutoSendWa) {
        const result = await dispatchNutricaoEnvio({
          envio,
          companyId,
          userId,
          whatsappId: etapaWhatsappId || fluxo.whatsappId
        });
        if (result.sent) resumo.enviados += 1;
        else resumo.skipped += 1;
      }

      const proximaEtapa = etapas[insc.etapaAtual + 1];
      await insc.update({
        etapaAtual: insc.etapaAtual + 1,
        ultimaExecucao: agora,
        status: proximaEtapa ? "ativa" : "concluida",
        motivoEncerramento: proximaEtapa ? null : "Fluxo finalizado",
        proximaExecucao: proximaEtapa
          ? new Date(agora.getTime() + (proximaEtapa.diasApos || 0) * 86400000)
          : agora
      });
      if (!proximaEtapa) resumo.concluidos += 1;
    }
  }

  return resumo;
}

export default processNutricaoCompany;
