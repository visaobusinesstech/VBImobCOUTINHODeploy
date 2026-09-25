export const AUTOMATION_FONT =
  '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, "Segoe UI", sans-serif';

export const AUTOMATION_TEMPLATES = [
  {
    id: "ig_follow_dm",
    name: "Começou a seguir no Instagram",
    action: "Manda uma mensagem na DM",
    description:
      "Quando alguém mandar a primeira Direct, o CRM responde sozinho. O Instagram oficial não avisa “novo follow” — o disparo real é a primeira DM (já funciona com permissões aprovadas).",
    channels: ["instagram"],
    bind: "welcome",
    defaultMessage:
      "Oi! Vi que você chegou aqui. Obrigada por seguir — em que posso te ajudar?",
    featured: true
  },
  {
    id: "ig_comment_dm",
    name: "Comentou no post",
    action: "Abre uma DM automática",
    description:
      "Quando o comentário contém a palavra-chave (ex.: GUIA), o CRM envia uma Direct (Private Reply). Precisa de instagram_business_manage_comments aprovado + manage_messages. Funciona na janela que a Meta permite após o comentário.",
    channels: ["instagram"],
    bind: "ig_comment_dm",
    defaultMessage:
      "VBSolution CRM – resposta automática ao comentário GUIA 001.",
    defaultPhrase: "GUIA",
    needsCommentsPermission: true
  },
  {
    id: "ig_comment_reply",
    name: "Responder comentário no post",
    action: "Resposta pública no comentário",
    description:
      "Responde na thread do comentário com o texto que você definir. Use {{username}} e {{comment}} se quiser. Exige aprovação do screencast de instagram_business_manage_comments. Se a automação de DM tiver palavra-chave (GUIA), esse fluxo não dispara nesses comentários.",
    channels: ["instagram"],
    bind: "ig_comment_reply",
    defaultMessage:
      "Obrigada pelo comentário, {{username}}! Já te respondo por aqui.",
    needsCommentsPermission: true
  },
  {
    id: "ig_comment_ai_reply",
    name: "Responder comentário com IA",
    action: "Resposta pública gerada por IA",
    description:
      "A IA gera uma resposta curta ao comentário (usa a chave OpenAI da empresa). O texto abaixo vira a instrução do sistema. Também exige instagram_business_manage_comments aprovado.",
    channels: ["instagram"],
    bind: "ig_comment_reply",
    useAi: true,
    defaultMessage:
      "Você é o atendimento da marca no Instagram. Responda o comentário público de forma curta, amigável e em português do Brasil. Não invente promoções nem dados.",
    needsCommentsPermission: true
  },
  {
    id: "fb_first_dm",
    name: "Começou a falar no Facebook",
    action: "Responde no Messenger",
    description:
      "Na primeira mensagem do Messenger, envia a DM automaticamente.",
    channels: ["facebook"],
    bind: "welcome",
    defaultMessage: "Olá! Obrigada por escrever. Como posso te ajudar hoje?"
  },
  {
    id: "ig_fb_welcome",
    name: "Instagram e Facebook juntos",
    action: "Primeira DM nos dois canais",
    description:
      "A mesma mensagem de boas-vindas nas conexões de Instagram e Facebook.",
    channels: ["instagram", "facebook"],
    bind: "welcome",
    defaultMessage: "Oi! Que bom ter você por aqui. Me conta como posso ajudar?"
  },
  {
    id: "ig_keyword_dm",
    name: "Palavra-chave no Instagram",
    action: "Responde na DM",
    description:
      "Se a Direct contiver a palavra, dispara o fluxo nessa conexão.",
    channels: ["instagram"],
    bind: "keyword",
    defaultMessage: "Recebi sua mensagem! Já te respondo por aqui.",
    defaultPhrase: "oi"
  },
  {
    id: "fb_keyword_dm",
    name: "Palavra-chave no Facebook",
    action: "Responde no Messenger",
    description:
      "Se a mensagem do Messenger contiver a palavra, dispara o fluxo.",
    channels: ["facebook"],
    bind: "keyword",
    defaultMessage: "Recebi sua mensagem! Já te respondo por aqui.",
    defaultPhrase: "oi"
  },
  {
    id: "wa_first_msg",
    name: "Primeira mensagem no WhatsApp",
    action: "Responde na conversa",
    description:
      "Na primeira mensagem da conversa no WhatsApp, envia a resposta automática.",
    channels: ["whatsapp"],
    bind: "welcome",
    defaultMessage: "Olá! Obrigada por nos chamar. Em que posso ajudar?"
  }
];

export const matchesChannel = (connection, channels) => {
  const channel = String(connection?.channel || "").toLowerCase();
  return channels.some((item) => {
    if (item === "whatsapp") {
      return channel === "whatsapp" || channel === "whatsapp_oficial";
    }
    return channel === item;
  });
};
