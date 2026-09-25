/** Contas admin de organização dedicada — mesma UI de Configurações que admin@admin.com, dados só da própria org. */
export const FULL_ORG_SETTINGS_ADMIN_EMAILS = [
  "gestaovendas@gmail.com",
  "douglas@byll.com.br",
  "testeanalisemeta@gmail.com"
];

export function isFullOrgSettingsAdminEmail(email) {
  const e = String(email || "").trim().toLowerCase();
  return FULL_ORG_SETTINGS_ADMIN_EMAILS.includes(e);
}

export function isFullOrgSettingsAdmin(user) {
  if (!user) return false;
  return isFullOrgSettingsAdminEmail(user.email);
}

export function isPlatformAdminEmail(email) {
  const e = String(email || "").trim().toLowerCase();
  return e === "admin@admin" || e === "admin@admin.com";
}

/** UI de Configurações completa (Identidade Visual, Assinaturas, Planos, Logs, opções super). */
export function hasFullSettingsUi(user) {
  if (!user) return false;
  if (user.super) return true;
  if (isPlatformAdminEmail(user.email)) return true;
  return isFullOrgSettingsAdmin(user);
}
