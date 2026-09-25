/**
 * Normaliza URLs externas para garantir que abram em nova aba corretamente.
 * - Adiciona https:// quando falta esquema (senão o browser trata como relativo e fica no domínio atual)
 * - Remove espaços/aspas acidentais
 * - Remove barra final quando não é raiz de domínio (padronização)
 * - Retorna null se claramente inválida
 */
export function normalizeExternalUrl(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  let url = String(raw).trim().replace(/^['"]|['"]$/g, "");
  if (!url) return null;

  // Protocolo-relativo: //exemplo.com/x
  if (url.startsWith("//")) url = "https:" + url;

  // Sem esquema: adiciona https://
  if (!/^https?:\/\//i.test(url)) {
    // ignora esquemas perigosos como javascript:, data:, etc.
    if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return null;
    url = "https://" + url.replace(/^\/+/, "");
  }

  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;

    // Host precisa ter pelo menos um ponto (ex.: dominio.com) — descarta "localhost", "abc"
    if (!u.hostname || !u.hostname.includes(".")) return null;

    // Remove barra final se não for a raiz do domínio
    // (u.pathname === "/" é a raiz e deve ser mantida)
    if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
      u.pathname = u.pathname.replace(/\/+$/, "");
    }

    return u.toString();
  } catch {
    return null;
  }
}

/** Abre a URL em nova aba, normalizando antes. Retorna true se conseguiu abrir. */
export function openExternalUrl(raw: string | null | undefined): boolean {
  const url = normalizeExternalUrl(raw);
  if (!url) return false;
  window.open(url, "_blank", "noopener,noreferrer");
  return true;
}

/**
 * Valida e normaliza o campo obrigatório `linkReferencia` de um Anúncio de Proprietário.
 * Retorna `{ ok: true, url }` se válido, ou `{ ok: false, error }` com mensagem amigável.
 *
 * Regras:
 *  1. Obrigatório (não pode ser nulo, vazio ou apenas espaços).
 *  2. Normaliza: trim, prefixa `https://` se faltar protocolo, remove barra final (exceto raiz).
 *  3. Após normalizar, deve ser uma URL http(s) válida e bem formada com host contendo TLD.
 */
export type ReferenceUrlValidation =
  | { ok: true; url: string }
  | { ok: false; error: string };

export function normalizeAndValidateReferenceUrl(
  raw: string | null | undefined,
): ReferenceUrlValidation {
  if (raw === null || raw === undefined || String(raw).trim() === "") {
    return {
      ok: false,
      error: "O link de referência é obrigatório. Informe a URL pública onde o anúncio foi publicado pelo proprietário.",
    };
  }
  const normalized = normalizeExternalUrl(raw);
  if (!normalized) {
    return {
      ok: false,
      error: "Link de referência inválido. Informe uma URL http(s) bem formada, como https://www.exemplo.com/anuncio/123.",
    };
  }
  return { ok: true, url: normalized };
}

