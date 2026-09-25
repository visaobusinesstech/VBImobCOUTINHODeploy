// Utility for plan-based feature access control

export const PLANO_HIERARCHY = ["gratuito", "lite", "basico", "profissional", "premium", "imobiliaria"] as const;
export type PlanoType = (typeof PLANO_HIERARCHY)[number];

/** Returns true if user's plan is at least the required level */
export function hasPlanoAccess(userPlano: string, requiredPlano: PlanoType): boolean {
  // If user is master, they have access to everything
  if (userPlano === "master") return true;
  
  const userIndex = PLANO_HIERARCHY.indexOf(userPlano as PlanoType);
  const requiredIndex = PLANO_HIERARCHY.indexOf(requiredPlano);
  if (userIndex === -1) return false;
  return userIndex >= requiredIndex;
}

/**
 * Minimum plan required per route.
 * Routes not listed here are available to all plans.
 */
export const ROUTE_PLAN_GATE: Record<string, PlanoType> = {
  // Lite+ (Essential CRM)
  "/pipeline": "lite",
  "/agenda": "lite",
  
  // Basico+ (Property Management)
  "/imoveis": "basico",
  "/financeiro": "basico",
  "/relacionamento": "basico",

  // Profissional+ (Advanced & IA)
  "/consulta-cpf": "profissional",
  "/conteudo-seo": "profissional",
  "/captacao": "profissional",
  "/comparativo": "profissional",
  "/inteligencia": "profissional",
  "/avaliacao": "profissional",

  // Premium+
  "/contratos": "premium",
  "/inadimplencia": "premium",
  "/proprietarios": "premium",

  // Imobiliária+
  "/automacoes": "imobiliaria",
  "/usuarios": "imobiliaria",
  "/corretores": "imobiliaria",
  "/produtividade": "imobiliaria",
};

/** Check if a route is accessible for the given plan */
export function canAccessRoute(userPlano: string, route: string, isMaster: boolean): boolean {
  if (isMaster) return true;
  const requiredPlano = ROUTE_PLAN_GATE[route];
  if (!requiredPlano) return true; // no gate = all plans
  return hasPlanoAccess(userPlano, requiredPlano);
}

/** Human-readable plan name for upgrade prompts */
export const PLANO_LABELS: Record<PlanoType, string> = {
  gratuito: "Gratuito",
  lite: "Básico",
  basico: "Intermediário",
  profissional: "Avançado",
  premium: "Completo",
  imobiliaria: "Imobiliária Ilimitado",
};

/**
 * During trial (7 days, plano "gratuito"), ALL features are unlocked
 * but AI features are limited to 1 use per account total.
 * After trial, feature gates apply based on plan.
 */
export const DATA_LIMITS: Record<PlanoType, { corretores: number; imoveis: number; leads: number }> = {
  gratuito: { corretores: 1, imoveis: 10, leads: 50 },
  lite: { corretores: 1, imoveis: 50, leads: 200 },
  basico: { corretores: 3, imoveis: 200, leads: 1000 },
  profissional: { corretores: 7, imoveis: 1000, leads: 5000 },
  premium: { corretores: 15, imoveis: 5000, leads: 10000 },
  imobiliaria: { corretores: Infinity, imoveis: Infinity, leads: Infinity },
};

/** During trial, all features unlock but AI is limited to 1 per account */
export const TRIAL_AI_LIMIT = 1;

/** Monthly AI limits per plan */
export const PLANO_AI_LIMITS: Record<string, { avaliacoes_mes: number; captacoes_mes: number }> = {
  gratuito: { avaliacoes_mes: 1, captacoes_mes: 1 },
  lite: { avaliacoes_mes: 0, captacoes_mes: 0 },
  basico: { avaliacoes_mes: 5, captacoes_mes: 5 },
  profissional: { avaliacoes_mes: 20, captacoes_mes: 20 },
  premium: { avaliacoes_mes: 50, captacoes_mes: 50 },
  imobiliaria: { avaliacoes_mes: Infinity, captacoes_mes: Infinity },
};

/** Check if user is in trial period (gratuito plan, within 7 days) */
export function isInTrial(plano: string, trialDaysLeft: number | null, trialExpired: boolean): boolean {
  return plano === "gratuito" && !trialExpired && trialDaysLeft !== null && trialDaysLeft > 0;
}

/**
 * During trial: all features available but AI limited to 1 use per account.
 * After trial: plan gates apply normally.
 */
export function canAccessFeatureDuringTrial(
  plano: string,
  trialDaysLeft: number | null,
  trialExpired: boolean,
  isMaster: boolean,
): boolean {
  if (isMaster) return true;
  if (isInTrial(plano, trialDaysLeft, trialExpired)) return true;
  return false;
}
