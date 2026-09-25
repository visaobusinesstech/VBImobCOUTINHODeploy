/**
 * Limpa localStorage/sessionStorage de dados de negócio.
 * Mantém apenas tokens de autenticação.
 */

const AUTH_KEYS = new Set(["token", "refreshToken", "public-token"]);

export function purgeNonAuthBrowserStorage() {
  try {
    const keep = {};
    for (const key of AUTH_KEYS) {
      const v = localStorage.getItem(key);
      if (v != null) keep[key] = v;
    }
    localStorage.clear();
    Object.keys(keep).forEach((k) => localStorage.setItem(k, keep[k]));
  } catch {
    /* ignore */
  }

  try {
    // Mantém retorno Stripe (efêmero de checkout)
    const stripe = sessionStorage.getItem("vb_stripe_checkout_return");
    sessionStorage.clear();
    if (stripe) sessionStorage.setItem("vb_stripe_checkout_return", stripe);
  } catch {
    /* ignore */
  }
}

export default purgeNonAuthBrowserStorage;
