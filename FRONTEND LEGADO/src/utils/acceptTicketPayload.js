/**
 * Payload padrão ao aceitar ticket: assume atendimento humano e desativa agente/integração.
 */
export function buildAcceptTicketPayload(ticket, userId) {
  const isWhatsappGroup =
    ticket?.isGroup && ticket?.channel === "whatsapp";
  return {
    userId: userId ?? null,
    isBot: false,
    useIntegration: false,
    integrationId: null,
    status: isWhatsappGroup ? "group" : "open",
  };
}
