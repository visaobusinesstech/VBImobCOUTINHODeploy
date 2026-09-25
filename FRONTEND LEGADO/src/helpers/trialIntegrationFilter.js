/**
 * Filtro de integrações para FREE_TRIAL (espelha backend).
 * Não exibe cards vazios nem mensagens do tipo "indisponível no teste".
 */

export const FREE_TRIAL_ALLOWED_KEYS = new Set([
  "whatsapp-web",
  "whatsapp-oficial",
  "telegram-bot",
  "telegram-oficial",
  "telegram",
  "facebook",
  "instagram",
  "openai",
  "claude",
  "gemini",
  "grok"
]);

export const FREE_TRIAL_BLOCKED_KEYS = new Set([
  "google-drive",
  "google-sheets",
  "google-calendar",
  "google",
  "gmail",
  "clickup",
  "notion",
  "pipedrive",
  "hubspot",
  "vbsolution-api",
  "platform-api",
  "supabase"
]);

export function isFreeTrialUser(user) {
  if (!user) return false;
  if (user.subscription?.isFreeTrial) return true;
  if (user.subscription?.accountType === "FREE_TRIAL") return true;
  const c = user.company;
  if (!c) return false;
  if (c.accountType === "FREE_TRIAL") return true;
  if (c.recurrence === "free_trial") return true;
  const meta = c.signupMetadata;
  if (meta && (meta.signupSource === "free_trial" || meta.accountType === "FREE_TRIAL")) {
    return true;
  }
  return false;
}

export function filterCatalogForFreeTrial(catalog, user) {
  if (!isFreeTrialUser(user)) return catalog || [];
  return (catalog || []).filter(item => {
    const key = String(item?.key || "").toLowerCase();
    if (!key) return false;
    if (key.startsWith("google")) return false;
    if (FREE_TRIAL_BLOCKED_KEYS.has(key)) return false;
    return FREE_TRIAL_ALLOWED_KEYS.has(key);
  });
}
