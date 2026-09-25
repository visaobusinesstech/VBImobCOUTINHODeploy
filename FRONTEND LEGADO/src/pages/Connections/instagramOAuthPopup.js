/**
 * Popup OAuth Instagram Login.
 *
 * Fluxo padrão: abre DIRECTAMENTE /oauth/authorize (force_reauth=true).
 * O caminho logout→login→authorize quebrava com frequência: o Instagram
 * ignorava o `next=` aninhado e jogava o popup no feed (/), sem code —
 * a conexão nunca era criada.
 *
 * Troca de conta: o authorize com force_reauth já pede reauth; se precisar
 * forçar login, use options.forceAccountPicker (página intermediária).
 */
export const IG_OAUTH_POPUP_NAME = "vbsolution_instagram_oauth";
export const IG_OAUTH_STATE_POPUP = "vbsolution_ig_popup";
export const IG_OAUTH_RESULT_KEY = "vbsolution_instagram_oauth_result";
export const IG_OAUTH_START_PATH = "/connections/instagram-oauth-start";

export function buildInstagramAuthorizeUrl(clientId, redirectUri, scopes) {
  const params = new URLSearchParams({
    client_id: String(clientId || "").trim(),
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes,
    force_reauth: "true",
    state: IG_OAUTH_STATE_POPUP,
  });
  return `https://www.instagram.com/oauth/authorize?${params.toString()}`;
}

/** Login forçado → authorize (pede usuário/senha de novo). */
export function buildInstagramLoginGateUrl(authorizeUrl) {
  return `https://www.instagram.com/accounts/login/?force_authentication=1&next=${encodeURIComponent(
    authorizeUrl
  )}`;
}

/**
 * Logout nesta janela + login forçado + authorize.
 * Só use sob demanda — Instagram costuma ignorar next= aninhado e cair no feed.
 */
export function buildInstagramFreshSessionStartUrl(authorizeUrl) {
  const loginUrl = buildInstagramLoginGateUrl(authorizeUrl);
  return `https://www.instagram.com/accounts/logout/?next=${encodeURIComponent(
    loginUrl
  )}`;
}

/** Página intermediária (troca de conta opcional). */
export function buildInstagramOAuthStartPageUrl(authorizeUrl) {
  const params = new URLSearchParams({
    auth: authorizeUrl,
  });
  return `${window.location.origin}${IG_OAUTH_START_PATH}?${params.toString()}`;
}

/**
 * Decide a URL inicial do popup (testável sem window.open).
 * Default = authorize direto — evita logout→feed do Instagram.
 */
export function resolveInstagramOAuthPopupStartUrl(authorizeUrl, options = {}) {
  if (options.forceAccountPicker) {
    return buildInstagramOAuthStartPageUrl(authorizeUrl);
  }
  if (options.useCurrentSession) {
    return buildInstagramLoginGateUrl(authorizeUrl);
  }
  return authorizeUrl;
}

/**
 * Abre o popup OAuth.
 * @param {string} authorizeUrl URL /oauth/authorize
 * @param {{ forceAccountPicker?: boolean, useCurrentSession?: boolean }} [options]
 *   - default: authorize direto (recomendado)
 *   - forceAccountPicker: página nossa com opções (outra conta / já logada)
 *   - useCurrentSession: login gate sem logout (legado)
 */
export function openInstagramOAuthPopup(authorizeUrl, options = {}) {
  const w = 520;
  const h = 780;
  const left = Math.max(0, window.screenX + (window.outerWidth - w) / 2);
  const top = Math.max(0, window.screenY + (window.outerHeight - h) / 2);

  try {
    localStorage.setItem("vbsolution_ig_oauth_popup_active", String(Date.now()));
    localStorage.removeItem(IG_OAUTH_RESULT_KEY);
  } catch {
    // ignore
  }

  const startUrl = resolveInstagramOAuthPopupStartUrl(authorizeUrl, options);

  const popup = window.open(
    startUrl,
    IG_OAUTH_POPUP_NAME,
    `width=${w},height=${h},left=${left},top=${top},scrollbars=yes,resizable=yes`
  );

  if (!popup) {
    return { ok: false, reason: "blocked" };
  }

  try {
    popup.name = IG_OAUTH_POPUP_NAME;
    popup.focus();
  } catch {
    // ignore
  }

  return { ok: true, popup };
}

export function subscribeInstagramOAuthCallback(handler) {
  const seen = new Set();
  const listener = (event) => {
    if (event.origin !== window.location.origin) return;
    const payload = event.data;
    if (!payload || payload.type !== "instagram-oauth-callback") return;
    const key = `${payload.ts || ""}:${payload.code || ""}:${payload.ok}:${payload.error || ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    handler(payload);
  };

  window.addEventListener("message", listener);
  return () => window.removeEventListener("message", listener);
}

/** Valida que a URL de authorize é do Instagram OAuth (anti open-redirect). */
export function isSafeInstagramAuthorizeUrl(url) {
  try {
    const u = new URL(String(url || ""));
    if (u.protocol !== "https:") return false;
    if (u.hostname !== "www.instagram.com" && u.hostname !== "instagram.com") {
      return false;
    }
    return u.pathname.startsWith("/oauth/authorize");
  } catch {
    return false;
  }
}
