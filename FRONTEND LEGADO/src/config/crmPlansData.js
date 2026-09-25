/**
 * Catálogo CRM alinhado à landing page e aos preços Stripe LIVE.
 * Fonte: Stripe/stripe-planos-links.json + VBSOLUTIONLANDINGPAGEdeploy-main/src/data/crmPlansData.ts
 */

export const CRM_ANNUAL_TOTALS = {
  starter: 1890,
  essencial: 4770,
  pro: 8610
};

export const CRM_PLAN_CREDITS = {
  starter: 300,
  essencial: 1000,
  pro: 3000
};

export function formatBrainCredits(credits) {
  return credits >= 1000
    ? `${(credits / 1000).toLocaleString("pt-BR")}.000`
    : credits.toLocaleString("pt-BR");
}

export const CRM_PLAN_PRICES = {
  starter: { mensal: 197, anual: Math.round(CRM_ANNUAL_TOTALS.starter / 12) },
  essencial: { mensal: 497, anual: Math.round(CRM_ANNUAL_TOTALS.essencial / 12) },
  pro: { mensal: 897, anual: Math.round(CRM_ANNUAL_TOTALS.pro / 12) }
};

/** Add-on opcional nos planos CRM (não Brain.IA) — também nos Payment Links Stripe. */
export const CRM_ONBOARDING_ADDON = {
  name: "Treinamento + Implantação",
  price: 400,
  description:
    "4 Treinamentos ao vivo + Implantação do sistema (configurações iniciais) + acompanhamento via suporte WhatsApp",
  maxInstallments: 12,
  installmentOnlyOnMonthly: true,
  stripeProductId: "prod_Ul285olJRpbKFz",
  stripePriceBrl: "price_1TlW4JLWDDKenrhhx3TKehB1",
  stripePriceUsd: "price_1TlW4MLWDDKenrhhT9sxl8tZ"
};

export const CRM_STRIPE_CHECKOUT_URLS = {
  starter: {
    mensal: "https://buy.stripe.com/6oUaEYcpYcqp6JYgXJ4sE00",
    anual: "https://buy.stripe.com/6oU9AU9dMgGF5FU6j54sE01"
  },
  essencial: {
    mensal: "https://buy.stripe.com/6oUcN64Xw7652tIfTF4sE04",
    anual: "https://buy.stripe.com/5kQfZicpY765c4i5f14sE05"
  },
  pro: {
    mensal: "https://buy.stripe.com/8x2fZi9dM4XXfgudLx4sE08",
    anual: "https://buy.stripe.com/bJe28sfCa9ed1pE9vh4sE09"
  }
};

export function getCrmCheckoutUrl(plan, cycle) {
  const normalizedCycle = cycle === "semestral" ? "mensal" : cycle;
  return CRM_STRIPE_CHECKOUT_URLS[plan]?.[normalizedCycle] || null;
}

export function getCrmPlanPrice(plan, cycle) {
  const normalizedCycle = cycle === "semestral" ? "mensal" : cycle;
  return CRM_PLAN_PRICES[plan]?.[normalizedCycle] ?? null;
}

const starterFeatures = [
  "Criação e gerenciamento de negócios e produtos.",
  "Gerenciamento de até 10 mil leads com controle de tags.",
  "Cadastro de até 3 membros da sua empresa.",
  `Brain.IA com ${formatBrainCredits(CRM_PLAN_CREDITS.starter)} créditos inclusos.`,
  "Automação para interagir com leads ilimitado.",
  "Multi-Atendimento com até 3 conexões.",
  "Integração com IA: Claude, OpenAI e Gemini.",
  "Integração com CRM: ClickUp, Notion, Pipedrive e HubSpot.",
  "Integração com Google: Google Calendar, Google Sheets e Google Drive.",
  "Integração com Figma.",
  "2 integrações com Webhooks para conectar outras ferramentas.",
  "Dashboards de negócios das pipelines."
];

const essencialFeatures = [
  "Criação e gerenciamento de pipeline ilimitado.",
  "Criação e gerenciamento de negócios e produtos.",
  "Gerenciamento de até 100 mil leads com controle de tags.",
  "Cadastro de 15 membros na empresa.",
  `Brain.IA com ${formatBrainCredits(CRM_PLAN_CREDITS.essencial)} créditos inclusos.`,
  "Automação para interagir com leads ilimitado.",
  "Multi-Atendimento com até 10 conexões.",
  "Integração com IA: Claude, OpenAI e Gemini.",
  "Integração com CRM: ClickUp, Notion, Pipedrive e HubSpot.",
  "Integração com Google: Google Calendar, Google Sheets e Google Drive.",
  "Integração com Figma.",
  "15 integrações com Webhooks para conectar outras ferramentas.",
  "Dashboards de negócios das pipelines.",
  "Acesso à API para integração com outras ferramentas."
];

const proFeatures = [
  "Criação e gerenciamento de pipelines ilimitadas.",
  "Gerenciamento ilimitado de leads com controle de tags.",
  "Criação e gerenciamento de negócios e produtos.",
  "Cadastro ilimitado de membros na empresa.",
  `Brain.IA com ${formatBrainCredits(CRM_PLAN_CREDITS.pro)} créditos inclusos.`,
  "Automações ilimitadas para otimizar interações com leads.",
  "Multi-Atendimento com conexões ilimitadas.",
  "Integração com IA: Claude, OpenAI e Gemini.",
  "Integração com CRM: ClickUp, Notion, Pipedrive e HubSpot.",
  "Integração com Google: Google Calendar, Google Sheets e Google Drive.",
  "Integração com Figma.",
  "Integrações com Webhooks ilimitadas para conectar outras ferramentas.",
  "Dashboards de negócios das pipelines.",
  "Acesso à API para integração com outras ferramentas."
];

export const CRM_PRICING_PLANS = [
  {
    id: "starter",
    name: "Starter",
    description:
      "Para quem está começando, com recursos essenciais e limites ideais para pequenas equipes.",
    features: starterFeatures,
    prices: CRM_PLAN_PRICES.starter,
    annualTotal: CRM_ANNUAL_TOTALS.starter
  },
  {
    id: "essencial",
    name: "Essencial",
    description:
      "Funcionalidades avançadas e limites ampliados para empresas em crescimento constante.",
    badge: "Melhor preço",
    highlight: true,
    features: essencialFeatures,
    prices: CRM_PLAN_PRICES.essencial,
    annualTotal: CRM_ANNUAL_TOTALS.essencial
  },
  {
    id: "pro",
    name: "Pro",
    description:
      "Para operações de alta escala com automações avançadas, integrações ilimitadas e suporte enterprise.",
    badge: "Mais vendido",
    dark: true,
    features: proFeatures,
    prices: CRM_PLAN_PRICES.pro,
    annualTotal: CRM_ANNUAL_TOTALS.pro
  }
];
