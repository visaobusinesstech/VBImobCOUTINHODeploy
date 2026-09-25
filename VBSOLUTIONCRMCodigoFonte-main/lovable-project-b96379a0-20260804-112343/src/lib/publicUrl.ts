const LOVABLE_HOST_SUFFIX = ".lovable.app";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);

function isLovableHost(hostname: string) {
  return hostname.toLowerCase().endsWith(LOVABLE_HOST_SUFFIX);
}

function isLocalHost(hostname: string) {
  return LOCAL_HOSTS.has(hostname.toLowerCase());
}

function getConfiguredMetaOrigin() {
  if (typeof window === "undefined") return "";

  const candidates = [
    document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href,
    document.querySelector<HTMLMetaElement>('meta[property="og:url"]')?.content,
    document.querySelector<HTMLMetaElement>('meta[name="twitter:url"]')?.content,
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    try {
      const url = new URL(candidate, window.location.origin);

      if (!isLovableHost(url.hostname) && !isLocalHost(url.hostname)) {
        return url.origin;
      }
    } catch {
      continue;
    }
  }

  return "";
}

function getConfiguredPublicOrigin() {
  if (typeof window === "undefined") return "";

  return getConfiguredMetaOrigin() || window.location.origin;
}

export function getPublicUrl(pathname = "/") {
  if (typeof window === "undefined") return pathname;

  const normalizedPathname = pathname.startsWith("/") ? pathname : `/${pathname}`;

  return new URL(normalizedPathname, getConfiguredPublicOrigin()).toString();
}

export function getPublicCurrentUrl() {
  if (typeof window === "undefined") return "";

  return getPublicUrl(`${window.location.pathname}${window.location.search}${window.location.hash}`);
}

export function getShareUrl(pathname = "/", source = "social") {
  if (typeof window === "undefined") return pathname;

  const url = new URL(getPublicUrl(pathname));
  url.searchParams.set("share", source);
  return url.toString();
}

/**
 * Returns the OG edge function URL for a property, so social media crawlers
 * get proper Open Graph meta tags (including cover image).
 * Crawlers see the HTML with meta tags and get redirected to the public page.
 */
export function getOgShareUrl(imovelId: string) {
  if (typeof window === "undefined") return "";
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) return getShareUrl(`/imovel/${imovelId}`);
  return `${supabaseUrl}/functions/v1/og-imovel?id=${encodeURIComponent(imovelId)}`;
}

export function getShareCurrentUrl(source = "social") {
  if (typeof window === "undefined") return "";

  return getShareUrl(`${window.location.pathname}${window.location.search}${window.location.hash}`, source);
}