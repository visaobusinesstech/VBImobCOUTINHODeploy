import React from "react";
import IntegrationBrandIcon, { getBrandVisual } from "./IntegrationBrandIcon";

/**
 * Catálogo de integrações exibido no hub /connections.
 * `channels` filtram registros do WhatsAppsContext (modelo Whatsapp).
 */
export const INTEGRATION_CATALOG = [
  {
    key: "whatsapp-web",
    channels: ["whatsapp"],
    label: "WhatsApp Web",
    description: "Conecte via QR Code e atenda conversas no navegador, como WhatsApp Web.",
    infoLine: "QR Code · Sessão web",
    highlights: ["Leitura em tempo real", "Filas e tags", "Múltiplos atendentes"],
    iconColor: "#25D366",
    planFlag: "useWhatsapp",
  },
  {
    key: "whatsapp-oficial",
    channels: ["whatsapp_oficial"],
    label: "WhatsApp API Oficial",
    description: "API oficial Meta (Cloud API) com templates, webhook e número verificado.",
    infoLine: "Meta Cloud API · Templates",
    highlights: ["Templates aprovados", "Webhook Meta", "Número verificado"],
    iconColor: "#25D366",
    planFlag: "useWhatsappOfficial",
  },
  {
    key: "telegram-bot",
    channels: ["telegram"],
    label: "Telegram",
    description: "Bot API — clientes enviam mensagem ao seu @bot e viram tickets.",
    infoLine: "Bot API · Webhook",
    highlights: ["@bot do Telegram", "Webhook ou polling", "Tickets automáticos"],
    iconColor: "#0088cc",
  },
  {
    key: "telegram-oficial",
    channels: ["telegram_oficial"],
    label: "Telegram Oficial",
    description: "Conta real (MTProto). Mensagens da conta logada viram tickets.",
    infoLine: "MTProto · Conta real",
    highlights: ["Login SMS/app", "Sessão MTProto", "Mensagens da conta"],
    iconColor: "#229ED9",
  },
  {
    key: "sms",
    channels: ["sms"],
    label: "SMS",
    description: "Envio e recebimento via Vonage ou Twilio com webhook inbound.",
    infoLine: "Vonage · Twilio",
    highlights: ["Inbound webhook", "Vonage ou Twilio", "Filas de atendimento"],
    iconColor: "#2563eb",
  },
  {
    key: "instagram",
    channels: ["instagram"],
    label: "Instagram",
    description:
      "Permite acessar DMs, criar tickets com as DMs e automações envolvendo comentários.",
    infoLine: "Instagram Login · DMs e comentários",
    highlights: ["Acesso a DMs", "Tickets com DMs", "Automações de comentários"],
    iconColor: "#E1306C",
    planFlag: "useInstagram",
  },
  {
    key: "facebook",
    channels: ["facebook"],
    label: "Facebook",
    description:
      "Permite acessar DMs e criar tickets com as DMs do Messenger da Página.",
    infoLine: "OAuth Meta · DMs Messenger",
    highlights: ["Acesso a DMs", "Tickets com DMs", "Messenger da Página"],
    iconColor: "#1877F2",
    planFlag: "useFacebook",
  },
  {
    key: "email",
    channels: [],
    label: "E-mail",
    description: "Campanhas, templates, agendamentos e caixa de envio integrada.",
    infoLine: "Gmail · Outlook",
    highlights: ["Campanhas", "Templates", "Agendamentos"],
    iconColor: "#EA4335",
  },
  {
    key: "openai",
    channels: [],
    label: "Open IA",
    description: "Agentes de IA, prompts e automações — configure a API Key aqui.",
    infoLine: "API Key · Modelos",
    highlights: ["Agentes IA", "Prompts", "Automações"],
    iconColor: "#10a37f",
  },
  {
    key: "claude",
    channels: [],
    label: "Claude",
    description:
      "Modelos Anthropic para agentes, respostas longas e fluxos com raciocínio avançado.",
    infoLine: "Sonnet · Opus · Haiku",
    highlights: ["API Anthropic", "Sonnet 4", "Contexto estendido"],
    iconColor: "#D97757",
  },
  {
    key: "gemini",
    channels: [],
    label: "Gemini",
    description:
      "Modelos Google Gemini para agentes, multimodal (texto, imagem) e fluxos no ecossistema Google.",
    infoLine: "Gemini Pro · Flash · API Google AI",
    highlights: ["API Google AI Studio", "Multimodal", "Contexto longo"],
    iconColor: "#4285F4",
  },
  {
    key: "grok",
    channels: [],
    label: "Grok",
    description:
      "Modelos xAI Grok para agentes de atendimento, respostas rápidas e uso no Brain.AI.",
    infoLine: "Grok 4 · Fast · API xAI",
    highlights: ["API xAI Console", "Agentes IA", "Brain.AI"],
    iconColor: "#1C1C1C",
  },
  {
    key: "meta-ads",
    channels: [],
    label: "Meta Ads",
    description:
      "Conecte Gerenciador de Eventos (Conversions API) e Anúncios & Pixels (Marketing API) num só lugar: CTWA, conversões, campanhas e dashboard Análises Ads. Também dá para vincular várias contas via OAuth.",
    infoLine: "CAPI · Marketing API · Pixels · Insights",
    highlights: [
      "Dataset + Conversions API",
      "Campanhas e anúncios",
      "Análises Ads no CRM",
    ],
    iconColor: "#0081FB",
  },
  {
    key: "linkedin-messaging",
    channels: [],
    label: "LinkedIn",
    description:
      "Messaging API do LinkedIn para DMs e contexto no BrainAI — disponível em breve.",
    infoLine: "Messaging API · Em breve",
    highlights: ["DMs", "Publicações", "Tickets LinkedIn"],
    iconColor: "#0A66C2",
    comingSoon: true,
    comingSoonProvider: "LinkedIn",
  },
  {
    key: "tiktok",
    channels: [],
    label: "TikTok",
    description:
      "Direct do TikTok no CRM: receba e envie DMs, abra tickets e use nas automações, filas e agentes de IA — no mesmo fluxo de WhatsApp e Instagram.",
    infoLine: "DM · Tickets · Automações · Em breve",
    highlights: ["Receber e enviar DMs", "Tickets no atendimento", "Automações e IA"],
    iconColor: "#111111",
    comingSoon: true,
    comingSoonProvider: "TikTok",
  },
  {
    key: "hotmart",
    channels: [],
    label: "Hotmart",
    description:
      "Vendas de infoprodutos e checkouts Hotmart entram no CRM já vinculadas ao anúncio que gerou a conversão — campanha, criativo e UTM no mesmo funil.",
    infoLine: "OAuth API · Vendas + Meta Ads",
    highlights: ["Vendas no CRM", "Produtos e valores", "ROI e ROAS no Meta Ads"],
    iconColor: "#F04E23",
  },
  {
    key: "cakto",
    channels: [],
    label: "Cakto",
    description:
      "Pedidos aprovados no checkout Cakto fluem para o CRM já atribuídos aos anúncios: do clique na campanha até o pagamento, sem cruzar planilha.",
    infoLine: "OAuth API · Vendas + Meta Ads",
    highlights: ["Vendas no CRM", "Produtos e valores", "ROI e ROAS no Meta Ads"],
    iconColor: "#0B8F5A",
    mcp: true,
  },
  {
    key: "google-drive",
    channels: [],
    label: "Google Drive",
    description:
      "Conecte sua conta Google para o Brain listar e referenciar arquivos e pastas do Drive em anexos, documentos e automações.",
    infoLine: "OAuth Google",
    highlights: ["Login Google", "Arquivos e pastas", "Contexto no Brain"],
    iconColor: "#4285F4",
    mcp: true,
    googleWorkspace: true,
  },
  {
    key: "google-sheets",
    channels: [],
    label: "Google Sheets",
    description:
      "Conecte planilhas da sua conta Google para leitura, escrita e dados no Brain, leads e relatórios operacionais.",
    infoLine: "Planilhas Google",
    highlights: ["OAuth Google", "Leitura e escrita", "Dados no Brain"],
    iconColor: "#0F9D58",
    mcp: true,
    googleWorkspace: true,
  },
  {
    key: "google-calendar",
    channels: [],
    label: "Google Calendário",
    description:
      "Conecte o Google Calendar para o Brain consultar eventos e alinhar agendamentos com sua agenda real.",
    infoLine: "Google Calendar",
    highlights: ["Eventos da agenda", "OAuth Google", "Schedules e Brain"],
    iconColor: "#4285F4",
    mcp: true,
    googleWorkspace: true,
  },
  {
    key: "figma",
    channels: [],
    label: "Figma",
    description:
      "MCP para o Brain: consultar frames, componentes, protótipos e contexto de design para revisão, aprovação e handoff.",
    infoLine: "Design files",
    highlights: ["Links de protótipo", "Comentários", "Handoff visual"],
    iconColor: "#A259FF",
    mcp: true,
  },
  {
    key: "github",
    channels: [],
    label: "GitHub",
    description:
      "MCP para o Brain: issues, pull requests, repositórios e código da organização para suporte técnico e bugs.",
    infoLine: "Repositories",
    highlights: ["Issues vinculadas", "Pull requests", "Código no Brain"],
    iconColor: "#181717",
    mcp: true,
  },
  {
    key: "supabase",
    channels: [],
    label: "Supabase",
    description:
      "Supabase da organização para o Brain.AI IDE Build — publique apps com Postgres, auth e storage. Mirror CRM opcional.",
    infoLine: "Brain IDE Build · OAuth · Postgres",
    highlights: ["Brain IDE Build", "Postgres", "Mirror CRM"],
    iconColor: "#3ECF8E",
    mcp: false,
    platformIntegration: true,
  },
  {
    key: "hubspot",
    channels: [],
    label: "HubSpot",
    description:
      "MCP CRM — importe negócios, tarefas, empresas e produtos do HubSpot para o VBSolution.",
    infoLine: "Leads · Atividades · Empresas · Produtos",
    highlights: ["Leads", "Atividades", "Empresas", "Produtos"],
    iconColor: "#FF7A59",
    platformIntegration: true,
  },
  {
    key: "clickup",
    channels: [],
    label: "ClickUp",
    description:
      "MCP CRM — importe Atividades e Projetos (listas/spaces) do ClickUp para o VBSolution.",
    infoLine: "Atividades · Projetos",
    highlights: ["Atividades", "Projetos", "Listas", "Spaces"],
    iconColor: "#7B68EE",
    platformIntegration: true,
  },
  {
    key: "pipedrive",
    channels: [],
    label: "Pipedrive",
    description:
      "MCP CRM — importe leads, atividades e projetos do Pipedrive para o VBSolution.",
    infoLine: "Leads · Atividades · Projetos",
    highlights: ["Leads", "Funis", "Atividades", "Projetos"],
    iconColor: "#017737",
    platformIntegration: true,
  },
  {
    key: "notion",
    channels: [],
    label: "Notion",
    description:
      "MCP — reuniões do Notion viram eventos no Calendário; anotações e tarefas vão para Atividades; páginas alimentam o Brain.",
    infoLine: "Reuniões · Anotações · Páginas · Wikis",
    highlights: ["Reuniões → Calendário", "Anotações → Atividades", "Páginas no Brain"],
    iconColor: "#000000",
    mcp: true,
    platformIntegration: true,
  },
  {
    key: "vbsolution-api",
    channels: [],
    label: "API & MCP CRM",
    description:
      "Gere credenciais de API e MCP da sua organização para extrair leads, atividades, tickets e enviar contexto ao Claude Code, Cursor, Zapier e mais.",
    infoLine: "API · MCP · Sua organização",
    highlights: ["Leads e contatos", "Atividades e projetos", "Claude · Zapier · Make"],
    iconColor: "#1e3a5f",
    mcp: true,
    externalPath: "/platform-api",
  },
];

/** Canais com formulário em /connections/:key/new */
export const INTEGRATION_SETUP_KEYS = new Set([
  "whatsapp-web",
  "whatsapp-oficial",
  "telegram-bot",
  "telegram-oficial",
  "facebook",
  "instagram",
  "sms",
  "email",
  "openai",
  "claude",
  "gemini",
  "grok",
  "meta-ads",
  "google-drive",
  "google-sheets",
  "google-calendar",
  "figma",
  "cakto",
  "hotmart",
  "github",
  "hubspot",
  "clickup",
  "pipedrive",
  "notion",
  "supabase",
]);

export const GOOGLE_WORKSPACE_INTEGRATION_KEYS = new Set([
  "google-drive",
  "google-sheets",
  "google-calendar",
]);

export function getIntegrationByKey(key) {
  return INTEGRATION_CATALOG.find((i) => i.key === key) || null;
}

export function integrationSupportsNewForm(key) {
  return INTEGRATION_SETUP_KEYS.has(key);
}

/** Integrações com cartão único (OAuth/API) em /connections/:key/manage */
export function integrationUsesConfigManage(integration) {
  if (!integration?.key) return false;
  if (integration.platformIntegration) return true;
  if (GOOGLE_WORKSPACE_INTEGRATION_KEYS.has(integration.key)) return true;
  return ["email", "openai", "claude", "gemini", "grok", "meta-ads", "figma", "cakto", "hotmart", "github"].includes(
    integration.key
  );
}

export function countConnectionsForIntegration(whatsApps, integration) {
  if (!integration?.channels?.length) return 0;
  return (whatsApps || []).filter((w) =>
    integration.channels.includes(w.channel || "whatsapp")
  ).length;
}

export function renderIntegrationIcon(integration, size = 22) {
  if (!integration) return null;
  const visual = getBrandVisual(integration);
  const variant =
    size >= 40 ? "hub" : size >= 30 ? "header" : size >= 22 ? "list" : "table";
  return (
    <IntegrationBrandIcon
      brandKey={visual.brandKey}
      variant={variant}
      background={visual.iconBg}
    />
  );
}
