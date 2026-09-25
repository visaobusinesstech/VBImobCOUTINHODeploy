/**
 * Escopos do Facebook Login (popup facebook.com) vs Instagram Login.
 *
 * Instagram DMs de clientes exigem Advanced Access nas permissões certas:
 * - Messenger Platform (Facebook Login): instagram_basic + instagram_manage_messages
 * - Instagram Login (API Instagram): instagram_business_basic + instagram_business_manage_messages
 *
 * O app Meta já tem App Review em instagram_business_* — o connect do Instagram
 * usa Instagram Login. Pedir instagram_business_* no Facebook SDK gera Invalid Scopes.
 */

const PAGE_SCOPES = [
  "public_profile",
  "pages_show_list",
  "pages_manage_metadata",
  "pages_read_engagement",
  "pages_messaging",
];

const withBusinessManagement = (scopes) =>
  process.env.REACT_APP_REQUIRE_BUSINESS_MANAGEMENT?.toUpperCase() === "TRUE"
    ? [...scopes, "business_management"]
    : scopes;

/** Login Facebook para Marketing API (contas de anúncios extras). */
export const META_ADS_OAUTH_SCOPE = withBusinessManagement([
  "public_profile",
  "ads_read",
  "ads_management",
]).join(",");

/** Login Facebook Messenger (Página). */
export const META_FACEBOOK_LOGIN_SCOPE = withBusinessManagement(PAGE_SCOPES).join(",");

/**
 * Instagram Login (oauth authorize) — permissões aprovadas no App Review.
 * NÃO usar no Facebook Login SDK.
 */
export const META_INSTAGRAM_BUSINESS_LOGIN_SCOPES = [
  "instagram_business_basic",
  "instagram_business_manage_messages",
  "instagram_business_manage_comments",
].join(",");

/** @deprecated Mantido por compat; Instagram agora usa META_INSTAGRAM_BUSINESS_LOGIN_SCOPES. */
export const META_INSTAGRAM_LOGIN_SCOPE = withBusinessManagement([
  ...PAGE_SCOPES,
  "instagram_basic",
  "instagram_manage_messages",
  "instagram_manage_comments",
]).join(",");
