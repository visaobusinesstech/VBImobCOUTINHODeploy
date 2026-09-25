/**
 * Payment Links Stripe LIVE — CRM (Starter, Essencial, Pro).
 * Fonte: Integração Stripe VBSolution Completa/stripe-planos-links.json
 */
export const STRIPE_CRM_PAYMENT_LINKS = {
  mensal: {
    starter: "https://buy.stripe.com/6oUaEYcpYcqp6JYgXJ4sE00",
    essencial: "https://buy.stripe.com/6oUcN64Xw7652tIfTF4sE04",
    pro: "https://buy.stripe.com/8x2fZi9dM4XXfgudLx4sE08"
  },
  anual: {
    starter: "https://buy.stripe.com/6oU9AU9dMgGF5FU6j54sE01",
    essencial: "https://buy.stripe.com/5kQfZicpY765c4i5f14sE05",
    pro: "https://buy.stripe.com/bJe28sfCa9ed1pE9vh4sE09"
  }
};

/**
 * Payment Links Stripe LIVE — Brain.IA add-ons (Starter / Essencial / Pro).
 * Fonte: Stripe/stripe-planos-links.json — brain_lite, brain_growth, brain_scale
 */
export const STRIPE_BRAIN_PAYMENT_LINKS = {
  mensal: {
    starter: "https://buy.stripe.com/fZufZi3Ts4XXc4igXJ4sE0c",
    essencial: "https://buy.stripe.com/5kQaEY4Xwcqpd8m5f14sE0g",
    pro: "https://buy.stripe.com/28E14oblU1LLecqePB4sE0k"
  },
  anual: {
    starter: "https://buy.stripe.com/fZu28s1Lk6215FU0YL4sE0d",
    essencial: "https://buy.stripe.com/eVq4gA3Ts0HH3xMazl4sE0h",
    pro: "https://buy.stripe.com/14A3cwcpYgGF4BQ5f14sE0l"
  }
};

/** Tier interno → productKey Stripe (backend) */
export const BRAIN_TIER_TO_STRIPE_PRODUCT = {
  starter: "brain_lite",
  essencial: "brain_growth",
  pro: "brain_scale"
};

/** Valores exibidos nos cards (BRL, LIVE) — alinhados à landing page. */
export const STRIPE_CRM_DISPLAY_PRICES = {
  mensal: {
    starter: 197,
    essencial: 497,
    pro: 897
  },
  anual: {
    starter: 158,
    essencial: 398,
    pro: 718
  }
};
