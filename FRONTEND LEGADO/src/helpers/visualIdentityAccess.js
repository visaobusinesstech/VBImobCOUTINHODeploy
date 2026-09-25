import { PLATFORM_DEFAULT_COMPANY_ID } from "../constants/platformCompany";
import { VISUAL_IDENTITY_EMAIL_ALLOWLIST } from "../constants/visualIdentity";
import { isFullOrgSettingsAdmin } from "../constants/fullOrgSettingsAdmin";

/** Conta administrativa da plataforma (texto explicativo longo da Identidade Visual só para ela / org 1). */
export function isPlatformWhitelabelIntroAccount(user) {
  if (!user) return false;
  const e = String(user.email || "").toLowerCase();
  if (e === "admin@admin" || e === "admin@admin.com") return true;
  return Number(user.companyId) === PLATFORM_DEFAULT_COMPANY_ID;
}

/** Só estas contas editam o nome da aplicação na Identidade Visual. */
export function isWhitelabelAppNameEditor(user) {
  if (!user) return false;
  const e = String(user.email || "").toLowerCase();
  return e === "admin@admin" || e === "admin@admin.com";
}

/** Cor do texto dos botões principais na Identidade Visual: empresas tenant (não organização 1). */
export function isTenantVisualIdentityCompany(user) {
  if (!user) return false;
  return Number(user.companyId) !== PLATFORM_DEFAULT_COMPANY_ID;
}

/**
 * Quem pode ver/editar a aba Identidade Visual (alinhado ao backend + fallback de sessão antiga).
 */
export function canAccessVisualIdentityUi(user) {
  if (!user || !user.id) return false;
  const email = String(user.email || "").toLowerCase();
  if (user.super) return true;
  if (email === "admin@admin.com") return true;
  if (VISUAL_IDENTITY_EMAIL_ALLOWLIST.includes(email)) return true;
  if (isFullOrgSettingsAdmin(user)) return true;
  if (Boolean(user.canAccessVisualIdentitySettings)) return true;
  if (Boolean(user.isWhiteLabelCustomer)) return true;
  if (Boolean(user.allowOrgManualVisualIdentity)) return true;
  if (Boolean(user.company?.allowOrgManualVisualIdentity)) return true;
  if (
    user.subscription?.isFreeTrial ||
    user.subscription?.accountType === "FREE_TRIAL" ||
    user.company?.accountType === "FREE_TRIAL" ||
    user.company?.recurrence === "free_trial"
  ) {
    return user.profile === "admin";
  }
  if (
    Number(user.companyId) === PLATFORM_DEFAULT_COMPANY_ID &&
    user.profile === "admin"
  ) {
    return true;
  }
  return false;
}
