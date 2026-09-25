export function whatsappHasConnectionAgent(whatsapp) {
  if (!whatsapp || whatsapp.agentDisabled === true) return false;
  const promptId = whatsapp.promptId;
  const anthropicId = whatsapp.anthropicMultiAgentId;
  return (
    (promptId != null &&
      String(promptId).trim() !== "" &&
      !Number.isNaN(Number(promptId))) ||
    (anthropicId != null &&
      String(anthropicId).trim() !== "" &&
      !Number.isNaN(Number(anthropicId)))
  );
}

export function ticketFromCampaign(ticket) {
  const sourceId = ticket?.dataWebhook?.sourceCampaignId;
  if (sourceId != null && sourceId !== "") return true;
  const tags = ticket?.contact?.tags || [];
  return tags.some((t) => /^Campanha #\d+$/i.test(String(t?.name || "")));
}

/** IA ainda está no controle desta conversa (isBot / useIntegration). */
export function ticketAiAgentIsResponding(ticket) {
  return ticket?.isBot === true || ticket?.useIntegration === true;
}

/**
 * "Assumir humano" só é clicável quando a conexão tem agente
 * e a IA está respondendo neste ticket.
 */
export function canAssumeHumanOnTicket(ticket) {
  return (
    whatsappHasConnectionAgent(ticket?.whatsapp) &&
    ticketAiAgentIsResponding(ticket)
  );
}

/** Motivo de desabilitar o item (tooltip). */
export function assumeHumanDisabledReason(ticket) {
  if (!whatsappHasConnectionAgent(ticket?.whatsapp)) {
    return "Agente de IA não habilitado nesta conexão";
  }
  if (!ticketAiAgentIsResponding(ticket)) {
    return "O agente de IA não está respondendo neste ticket";
  }
  return "";
}

/** Tag azul "Agente de IA" só quando o agente realmente enviou mensagem na conversa. */
export function shouldShowAiAgentPreview(ticket) {
  if (!ticket?.lastMessage) return false;
  if (ticket.fromMe !== true) return false;
  if (ticketFromCampaign(ticket)) return false;
  if (!whatsappHasConnectionAgent(ticket?.whatsapp)) return false;

  const hasAgentMessage =
    ticket.hasAgentMessage === true ||
    ticket.hasAgentMessage === 1 ||
    ticket.hasAgentMessage === "1" ||
    ticket.hasAgentMessage === "true";
  if (!hasAgentMessage) return false;

  return ticket.isBot === true || ticket.useIntegration === true;
}
