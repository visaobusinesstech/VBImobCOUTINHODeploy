/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Disparo de follow-up via WhatsApp Web (Baileys) ou API Oficial (Meta),
 * reutilizando os mesmos gatilhos das campanhas.
 */

import Contact from "../../models/Contact";
import LeadSale from "../../models/LeadSale";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import RealtyFollowup from "../../models/RealtyFollowup";
import ResolveTicketForLeadPreviewService from "../TicketServices/ResolveTicketForLeadPreviewService";
import ShowTicketService from "../TicketServices/ShowTicketService";
import SendWhatsAppMessage from "../WbotServices/SendWhatsAppMessage";
import SendWhatsAppOficialMessage from "../WhatsAppOficial/SendWhatsAppOficialMessage";
import { sendMetaCloudMessageDirect } from "../WhatsAppOficial/sendMetaCloudMessageDirect";
import ShowService from "../QuickMessageService/ShowService";
import {
  buildMetaTemplatePayload,
  MetaTemplateVariablesInput
} from "../WhatsAppOficial/buildMetaTemplatePayload";
import formatBody from "../../helpers/Mustache";
import logger from "../../utils/logger";

const digitsOnly = (value?: string | null) => String(value || "").replace(/\D/g, "");

function applyLeadVars(tpl: string, lead: LeadSale | null): string {
  const nome = lead?.name || "";
  const telefone = lead?.phone || "";
  return String(tpl || "")
    .replace(/\{nome\}/gi, nome)
    .replace(/\{name\}/gi, nome)
    .replace(/\{telefone\}/gi, telefone)
    .replace(/\{phone\}/gi, telefone);
}

function processTemplateVariables(
  raw: string | null | undefined,
  contact: Contact | null
): MetaTemplateVariablesInput {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as MetaTemplateVariablesInput;
    const ticketStub = {
      contact: contact || { name: "", number: "", email: "" },
      id: 0
    } as Ticket;

    const walk = (obj: any): any => {
      if (obj == null) return obj;
      if (typeof obj === "string") return formatBody(obj, ticketStub);
      if (Array.isArray(obj)) return obj.map(walk);
      if (typeof obj === "object") {
        const next: Record<string, unknown> = {};
        Object.keys(obj).forEach(k => {
          next[k] = walk(obj[k]);
        });
        return next;
      }
      return obj;
    };
    return walk(parsed);
  } catch {
    return {};
  }
}

export type DispatchFollowupResult = {
  sent: boolean;
  channel: string | null;
  ticketId: number | null;
  error: string | null;
  preview: string | null;
};

export async function dispatchFollowupWhatsApp(params: {
  followup: RealtyFollowup;
  lead: LeadSale | null;
  companyId: number;
  userId: number;
  openTicket?: boolean;
}): Promise<DispatchFollowupResult> {
  const { followup, lead, companyId, userId } = params;
  const openTicket = params.openTicket !== false;

  const phone = lead?.phone || null;
  const messageBody = applyLeadVars(followup.messageBody || followup.notes || "", lead);

  let whatsapp: Whatsapp | null = null;
  if (followup.whatsappId) {
    whatsapp = await Whatsapp.findOne({
      where: { id: followup.whatsappId, companyId }
    });
  }

  // Resolve ticket (mesmo fluxo de campanhas / nutrição)
  let ticket: Ticket | null =
    followup.ticketId != null
      ? await Ticket.findOne({ where: { id: followup.ticketId, companyId } })
      : null;

  if (!ticket && lead) {
    ticket = await ResolveTicketForLeadPreviewService({
      companyId,
      contactId: lead.contactId,
      phone: lead.phone,
      requestUserId: userId
    });
    if (ticket?.id) {
      await lead.update({ ticketId: ticket.id });
      await followup.update({ ticketId: ticket.id });
    }
  }

  // Prefer channel from selected WhatsApp connection
  const channel =
    whatsapp?.channel ||
    (ticket as any)?.channel ||
    (ticket as any)?.whatsapp?.channel ||
    "whatsapp";

  // ——— WhatsApp API Oficial (mesmo gatilho de campanhas) ———
  if (channel === "whatsapp_oficial" || whatsapp?.channel === "whatsapp_oficial") {
    if (!whatsapp || whatsapp.channel !== "whatsapp_oficial") {
      return {
        sent: false,
        channel: "whatsapp_oficial",
        ticketId: ticket?.id || null,
        error: "Conexão WhatsApp API Oficial não encontrada.",
        preview: messageBody
      };
    }
    if (whatsapp.status !== "CONNECTED") {
      return {
        sent: false,
        channel: "whatsapp_oficial",
        ticketId: ticket?.id || null,
        error: `Conexão oficial status=${whatsapp.status}`,
        preview: messageBody
      };
    }
    if (!followup.metaTemplateQuickMessageId) {
      return {
        sent: false,
        channel: "whatsapp_oficial",
        ticketId: ticket?.id || null,
        error:
          "Follow-ups via WhatsApp API Oficial exigem template Meta aprovado (igual às campanhas).",
        preview: messageBody
      };
    }

    const template = await ShowService(
      followup.metaTemplateQuickMessageId,
      companyId
    );
    if (!template || template.status !== "APPROVED") {
      return {
        sent: false,
        channel: "whatsapp_oficial",
        ticketId: ticket?.id || null,
        error: "Template Meta indisponível ou não aprovado.",
        preview: messageBody
      };
    }

    let contact: Contact | null = null;
    const number = digitsOnly(phone || (ticket as any)?.contact?.number);

    if (openTicket && number) {
      const [c] = await Contact.findOrCreate({
        where: { number, companyId },
        defaults: {
          companyId,
          name: lead?.name || "Follow-up",
          number,
          email: lead?.email || "",
          whatsappId: whatsapp.id,
          channel: "whatsapp_oficial",
          profilePicUrl: ""
        }
      });
      contact = c;

      ticket = await Ticket.findOne({
        where: {
          contactId: contact.id,
          companyId,
          whatsappId: whatsapp.id,
          status: ["open", "pending"]
        }
      });

      if (!ticket) {
        ticket = await Ticket.create({
          companyId,
          contactId: contact.id,
          whatsappId: whatsapp.id,
          userId,
          status: "pending",
          channel: "whatsapp_oficial",
          isBot: false,
          useIntegration: false
        });
      }
      ticket = await ShowTicketService(ticket.id, companyId);
      await followup.update({ ticketId: ticket.id });
    } else if (number) {
      contact = await Contact.findOne({ where: { number, companyId } });
    }

    const variables = processTemplateVariables(
      followup.metaTemplateVariables,
      contact
    );
    const templatePayload = buildMetaTemplatePayload(template, variables);
    const bodyPreview = template.message || messageBody || `Template: ${template.shortcode}`;

    try {
      if (ticket) {
        await SendWhatsAppOficialMessage({
          body: bodyPreview,
          ticket,
          quotedMsg: null,
          type: "template",
          media: null,
          template: templatePayload
        });
      } else if (number) {
        await sendMetaCloudMessageDirect({
          whatsapp,
          toNumber: number,
          type: "template",
          template: templatePayload
        });
      } else {
        return {
          sent: false,
          channel: "whatsapp_oficial",
          ticketId: null,
          error: "Telefone não cadastrado para envio oficial.",
          preview: bodyPreview
        };
      }

      await followup.update({
        whatsappSent: true,
        whatsappSentAt: new Date(),
        result: followup.result || "enviado_whatsapp_oficial"
      } as any);

      return {
        sent: true,
        channel: "whatsapp_oficial",
        ticketId: ticket?.id || null,
        error: null,
        preview: bodyPreview
      };
    } catch (err: any) {
      logger.error(`[FOLLOWUP][WABA] Falha envio: ${err?.message || err}`);
      return {
        sent: false,
        channel: "whatsapp_oficial",
        ticketId: ticket?.id || null,
        error: err?.message || String(err),
        preview: bodyPreview
      };
    }
  }

  // ——— WhatsApp Web (Baileys) — mesmo gatilho de campanhas ———
  if (!messageBody.trim()) {
    return {
      sent: false,
      channel: "whatsapp",
      ticketId: ticket?.id || null,
      error: "Mensagem vazia.",
      preview: null
    };
  }

  if (!ticket) {
    return {
      sent: false,
      channel: "whatsapp",
      ticketId: null,
      error: "Sem ticket WhatsApp vinculado ao lead/telefone.",
      preview: messageBody
    };
  }

  try {
    const fullTicket = await Ticket.findByPk(ticket.id, {
      include: ["contact", "whatsapp"]
    } as any);
    if (!fullTicket) {
      return {
        sent: false,
        channel: "whatsapp",
        ticketId: ticket.id,
        error: "Ticket não encontrado.",
        preview: messageBody
      };
    }

    // Se o ticket for oficial mas caiu aqui sem template, bloqueia
    if ((fullTicket as any).channel === "whatsapp_oficial") {
      return {
        sent: false,
        channel: "whatsapp_oficial",
        ticketId: fullTicket.id,
        error:
          "Ticket é WhatsApp API Oficial — selecione template Meta aprovado (igual às campanhas).",
        preview: messageBody
      };
    }

    await SendWhatsAppMessage({ body: messageBody, ticket: fullTicket as any });
    await followup.update({
      whatsappSent: true,
      whatsappSentAt: new Date(),
      ticketId: fullTicket.id,
      result: followup.result || "enviado_whatsapp"
    } as any);

    return {
      sent: true,
      channel: "whatsapp",
      ticketId: fullTicket.id,
      error: null,
      preview: messageBody
    };
  } catch (err: any) {
    logger.error(`[FOLLOWUP][WEB] Falha envio: ${err?.message || err}`);
    return {
      sent: false,
      channel: "whatsapp",
      ticketId: ticket.id,
      error: err?.message || String(err),
      preview: messageBody
    };
  }
}

export function nextRecurrenceDate(
  from: Date,
  type?: string | null,
  interval?: number | null
): Date {
  const next = new Date(from);
  const step = Math.max(1, Number(interval) || 1);
  const t = String(type || "dias").toLowerCase();
  if (t === "minutely" || t === "minuto" || t === "minutos") {
    next.setMinutes(next.getMinutes() + step);
  } else if (t === "hourly" || t === "hora" || t === "horas") {
    next.setHours(next.getHours() + step);
  } else if (t === "semanas" || t === "semana" || t === "weekly") {
    next.setDate(next.getDate() + 7 * step);
  } else if (t === "biweekly" || t === "quinzenal" || t === "quinzena") {
    next.setDate(next.getDate() + 14 * step);
  } else if (t === "meses" || t === "mes" || t === "monthly") {
    next.setMonth(next.getMonth() + step);
  } else if (t === "yearly" || t === "anual" || t === "ano" || t === "anos") {
    next.setFullYear(next.getFullYear() + step);
  } else {
    // daily / dias / default
    next.setDate(next.getDate() + step);
  }
  return next;
}
