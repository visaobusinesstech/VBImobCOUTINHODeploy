// Camada única de tracking (dataLayer -> GTM -> GA4).
// Todos os eventos passam por push() para o GTM disparar tags GA4 configuradas
// com base no nome do evento. Nunca chamamos gtag() diretamente — mantemos GTM
// como fonte única de verdade para tags, triggers e variáveis.

type DLEvent = Record<string, unknown> & { event: string };

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

function push(payload: DLEvent) {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    ...payload,
    page_location: typeof window !== "undefined" ? window.location.href : undefined,
    page_path: typeof window !== "undefined" ? window.location.pathname : undefined,
  });
}

// ---------- Free Trial ----------

export type TrialType = "standard" | "premium";

export function trackFreeTrialStarted(params: {
  trial_type?: TrialType;
  button_text?: string;
  source?: string; // ex: 'hero_cta', 'pricing_card', 'sticky_bottom'
}) {
  push({
    event: "free_trial_started",
    trial_type: params.trial_type ?? "standard",
    button_text: params.button_text,
    source: params.source,
  });
}

export function trackFreeTrialSignupSuccess(params: {
  user_id?: string; // já anonimizado (hash ou UUID Supabase)
  plan_selected?: string; // ex: 'gratuito', 'starter', 'pro'
  signup_method?: "email_password" | "google" | "magic_link";
  value?: number; // opcional, receita esperada do trial
}) {
  push({
    event: "free_trial_signup_success",
    user_id: params.user_id,
    plan_selected: params.plan_selected ?? "gratuito",
    signup_method: params.signup_method ?? "email_password",
    value: params.value ?? 0,
    currency: "BRL",
  });
}

// ---------- Lead / Form ----------

export type LeadType =
  | "contact"
  | "demo"
  | "newsletter_signup"
  | "captura_bairro"
  | "landing_capture";

export function trackFormSubmission(params: {
  form_id: string;
  form_name: string;
  lead_type: LeadType;
  form_status?: "success" | "error";
  extra?: Record<string, unknown>;
}) {
  push({
    event: "form_submission",
    form_id: params.form_id,
    form_name: params.form_name,
    lead_type: params.lead_type,
    form_status: params.form_status ?? "success",
    ...(params.extra ?? {}),
  });
}
