// Shared photo extractor with cascade strategies.
// Order: JSON-LD → OG/Twitter meta → __NEXT_DATA__/__NUXT__/__INITIAL_STATE__/apollo inline JSON
//        → <img> src/srcset/data-src → raw regex CDN pattern hunt.
// Also detects captcha/block pages, filters junk (logo/icon/ad/placeholder),
// dedups CDN size variants and caps output.
//
// Reused by:
//   - supabase/functions/extrair-dados-anuncio
//   - supabase/functions/importar-carteira-portal
//   - supabase/functions/scrape-portais-imoveis

export const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent": BROWSER_UA,
  "Accept":
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  "Pragma": "no-cache",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
};

export type PhotoStrategy =
  | "json-ld"
  | "og-meta"
  | "inline-json"
  | "img-srcset"
  | "img-src"
  | "img-datasrc"
  | "regex-cdn";

export interface PhotoExtractionResult {
  photos: string[];
  strategy_stats: Record<PhotoStrategy, number>;
  blocked: boolean;
  block_reason?: string;
  total_candidates: number;
  after_filter: number;
  after_dedup: number;
  max_out: number;
}

const MAX_PHOTOS_DEFAULT = 20;

// --------------------------- Captcha / block detection ---------------------------

const BLOCK_SIGNATURES: Array<{ re: RegExp; reason: string }> = [
  { re: /<title[^>]*>[^<]*(access denied|acesso negado|403 forbidden)[^<]*<\/title>/i, reason: "403 access denied page" },
  { re: /captcha|g-recaptcha|hcaptcha|cf-challenge|cloudflare[^<]{0,40}(security|checking)/i, reason: "captcha / cloudflare challenge" },
  { re: /please enable javascript|habilite o javascript/i, reason: "js-required interstitial" },
  { re: /request unsuccessful.*incapsula|imperva/i, reason: "imperva/incapsula block" },
  { re: /perimeterx|px-captcha/i, reason: "perimeterx bot wall" },
  { re: /datadome|dd-captcha/i, reason: "datadome bot wall" },
  { re: /rate limit|too many requests/i, reason: "rate limited" },
];

export function detectBlockPage(html: string): { blocked: boolean; reason?: string } {
  if (!html || html.length < 100) {
    return { blocked: true, reason: "empty or too-small response body" };
  }
  for (const sig of BLOCK_SIGNATURES) {
    if (sig.re.test(html)) return { blocked: true, reason: sig.reason };
  }
  return { blocked: false };
}

// --------------------------- Junk / property filtering ---------------------------

const JUNK_PATH_PATTERNS = [
  /(^|[\/\-_.])logo([\/\-_.]|$)/i,
  /(^|[\/\-_.])favicon(\.|$)/i,
  /(^|[\/\-_.])sprite([\/\-_.]|$)/i,
  /(^|[\/\-_.])icon(?:s)?([\/\-_.]|$)/i,
  /(^|[\/\-_.])placeholder([\/\-_.]|$)/i,
  /(^|[\/\-_.])blur([\/\-_.]|$)/i,
  /(^|[\/\-_.])avatar([\/\-_.]|$)/i,
  /(^|[\/\-_.])watermark([\/\-_.]|$)/i,
  /(^|[\/\-_.])marker([\/\-_.]|$)/i,
  /(^|[\/\-_.])banner([\/\-_.]|$)/i,
  /(^|[\/\-_.])ads?([\/\-_.]|$)/i,
  /\/pixel\.gif/i,
  /doubleclick\.net/i,
  /googletagmanager|google-analytics|googlesyndication/i,
  /facebook\.com\/tr\?/i,
];

const KNOWN_CDN_HOSTS = [
  "img.olx.com.br",
  "images.olx.com.br",
  "resizedimgs",
  "img.zap",
  "images.zap",
  "photos.zap",
  "img.vivareal",
  "cloudinary.com",
  "amazonaws.com",
  "cloudfront.net",
  "imgix.net",
  "akamai",
  "chavenamao",
  "chavenaomao",
  "quintoandar",
  "wimoveis",
  "imovelweb",
  "netimoveis",
  "cbre",
  "loft.com.br",
];

const IMG_EXT_RE = /\.(jpe?g|png|webp|avif)(\?|#|$)/i;

export function isLikelyPropertyPhoto(url: string): boolean {
  if (!url || url.length < 12) return false;
  if (!/^https?:\/\//i.test(url)) return false;
  if (/\.svg(\?|#|$)/i.test(url)) return false;
  if (/data:image/i.test(url)) return false;
  if (/1x1|spacer|blank\.gif/i.test(url)) return false;
  for (const p of JUNK_PATH_PATTERNS) if (p.test(url)) return false;
  if (IMG_EXT_RE.test(url)) return true;
  for (const host of KNOWN_CDN_HOSTS) if (url.toLowerCase().includes(host)) return true;
  return false;
}

// --------------------------- Normalization / dedup ---------------------------

export function decodeHtmlEntities(v: string): string {
  return v
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x2F;/gi, "/");
}

export function normalizeImageUrl(value: unknown, sourceUrl?: string): string | null {
  if (typeof value !== "string") return null;
  const cleaned = decodeHtmlEntities(value).trim();
  if (!cleaned) return null;
  try {
    const u = cleaned.startsWith("//")
      ? new URL(`https:${cleaned}`)
      : new URL(cleaned, sourceUrl || "https://example.com");
    if (!["http:", "https:"].includes(u.protocol)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

function photoIdentityKey(url: string): string {
  try {
    const p = new URL(url);
    return `${p.hostname}${p.pathname
      .replace(/[-_]\d{2,4}x\d{2,4}/g, "")
      .replace(/[-_](?:thumb|small|medium|large|xlarge|original|hd|full|crop|fit|preview)/gi, "")
      .toLowerCase()}`;
  } catch {
    return url;
  }
}

function pickLargestFromSrcset(srcset: string): string | null {
  // "url1 300w, url2 600w, url3 1200w" or with x descriptors
  const parts = srcset.split(",").map((s) => s.trim()).filter(Boolean);
  let best: { url: string; weight: number } | null = null;
  for (const part of parts) {
    const bits = part.split(/\s+/);
    const url = bits[0];
    const desc = bits[1] || "";
    let weight = 1;
    const wMatch = desc.match(/(\d+)w/);
    const xMatch = desc.match(/(\d+(?:\.\d+)?)x/);
    if (wMatch) weight = Number(wMatch[1]);
    else if (xMatch) weight = Number(xMatch[1]) * 1000;
    if (!best || weight > best.weight) best = { url, weight };
  }
  return best?.url ?? null;
}

// --------------------------- Individual strategies ---------------------------

function stripSourceMap(s: string): string {
  return s.replace(/\/\/#\s*sourceMappingURL=.*$/gm, "");
}

function extractFromJsonLd(html: string, sourceUrl: string): string[] {
  const found: string[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const raw = stripSourceMap(m[1]).trim();
    if (!raw) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // some sites embed multiple JSON blobs — try array wrap
      try {
        parsed = JSON.parse(`[${raw}]`);
      } catch {
        continue;
      }
    }
    walkForImages(parsed, sourceUrl, found);
  }
  return found;
}

function walkForImages(node: unknown, sourceUrl: string, out: string[], depth = 0): void {
  if (!node || depth > 8) return;
  if (typeof node === "string") {
    const norm = normalizeImageUrl(node, sourceUrl);
    if (norm && isLikelyPropertyPhoto(norm)) out.push(norm);
    return;
  }
  if (Array.isArray(node)) {
    for (const item of node) walkForImages(item, sourceUrl, out, depth + 1);
    return;
  }
  if (typeof node === "object") {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      // prioritize likely image keys but also walk everything
      if (/^(image|images|photo|photos|foto|fotos|picture|pictures|gallery|galeria|media|thumbnail|thumb|contentUrl|url)$/i.test(k)) {
        walkForImages(v, sourceUrl, out, depth + 1);
      } else {
        walkForImages(v, sourceUrl, out, depth + 1);
      }
    }
  }
}

function extractFromOgMeta(html: string, sourceUrl: string): string[] {
  const found: string[] = [];
  const patterns = [
    /<meta[^>]+(?:property|name)=["'](?:og:image(?::secure_url|:url)?|twitter:image(?::src)?)["'][^>]+content=["']([^"']+)["']/gi,
    /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image(?::secure_url|:url)?|twitter:image(?::src)?)["']/gi,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      const n = normalizeImageUrl(m[1], sourceUrl);
      if (n) found.push(n);
    }
  }
  return found;
}

function extractFromInlineJson(html: string, sourceUrl: string): string[] {
  const found: string[] = [];
  const blocks: string[] = [];

  // __NEXT_DATA__ (Next.js) — OLX uses this
  const next = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (next) blocks.push(next[1]);

  // __NUXT__ (Nuxt.js)
  const nuxt = html.match(/<script[^>]*>window\.__NUXT__\s*=\s*(\{[\s\S]*?\});?\s*<\/script>/i);
  if (nuxt) blocks.push(nuxt[1]);

  // __INITIAL_STATE__ / __PRELOADED_STATE__ / __APOLLO_STATE__
  const stateRegexes = [
    /window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});?\s*(?:<\/script>|window\.)/i,
    /window\.__PRELOADED_STATE__\s*=\s*(\{[\s\S]*?\});?\s*(?:<\/script>|window\.)/i,
    /window\.__APOLLO_STATE__\s*=\s*(\{[\s\S]*?\});?\s*(?:<\/script>|window\.)/i,
    /window\.__DATA__\s*=\s*(\{[\s\S]*?\});?\s*(?:<\/script>|window\.)/i,
    /<script[^>]+id=["']__APOLLO_STATE__["'][^>]*>([\s\S]*?)<\/script>/i,
  ];
  for (const re of stateRegexes) {
    const m = html.match(re);
    if (m) blocks.push(m[1]);
  }

  // Generic <script type="application/json"> blobs (Nuxt/Remix/etc.)
  const genericJsonRe = /<script[^>]+type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let gm: RegExpExecArray | null;
  while ((gm = genericJsonRe.exec(html)) !== null) {
    if (gm[1].length > 200 && gm[1].length < 2_000_000) blocks.push(gm[1]);
  }

  for (const raw of blocks) {
    const cleaned = stripSourceMap(raw).trim().replace(/^\s*JSON\.parse\((["'`])([\s\S]*?)\1\)\s*;?$/, "$2");
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // fallback: harvest URLs by regex from the raw blob
      const urlRe = /"(https?:\\?\/\\?\/[^"\s]+?\.(?:jpe?g|png|webp|avif)[^"]*)"/gi;
      let um: RegExpExecArray | null;
      while ((um = urlRe.exec(cleaned)) !== null) {
        const norm = normalizeImageUrl(um[1].replace(/\\\//g, "/"), sourceUrl);
        if (norm && isLikelyPropertyPhoto(norm)) found.push(norm);
      }
      continue;
    }
    walkForImages(parsed, sourceUrl, found);
  }
  return found;
}

function extractFromImgSrcset(html: string, sourceUrl: string): string[] {
  const found: string[] = [];
  const re = /<(?:img|source)[^>]+srcset=["']([^"']+)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const best = pickLargestFromSrcset(m[1]);
    if (best) {
      const n = normalizeImageUrl(best, sourceUrl);
      if (n) found.push(n);
    }
  }
  return found;
}

function extractFromImgSrc(html: string, sourceUrl: string): string[] {
  const found: string[] = [];
  const re = /<img[^>]+\ssrc=["']([^"']+)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const n = normalizeImageUrl(m[1], sourceUrl);
    if (n) found.push(n);
  }
  return found;
}

function extractFromImgDataSrc(html: string, sourceUrl: string): string[] {
  const found: string[] = [];
  const attrs = ["data-src", "data-lazy-src", "data-lazy", "data-original", "data-echo", "data-hi-res-src"];
  for (const attr of attrs) {
    const re = new RegExp(`${attr}=["']([^"']+)["']`, "gi");
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      const n = normalizeImageUrl(m[1], sourceUrl);
      if (n) found.push(n);
    }
  }
  return found;
}

function extractFromRegexCdn(html: string, sourceUrl: string): string[] {
  const found: string[] = [];
  const re = /(https?:\\?\/\\?\/[^\s"'<>()]+?\.(?:jpe?g|png|webp|avif))(?:\?[^\s"'<>()]*)?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const cleaned = m[0].replace(/\\\//g, "/");
    const n = normalizeImageUrl(cleaned, sourceUrl);
    if (n) found.push(n);
  }
  return found;
}

// --------------------------- Orchestrator ---------------------------

export interface ExtractPhotosOptions {
  sourceUrl: string;
  maxPhotos?: number;
  // optional additional hints (e.g. photos already extracted upstream)
  seedPhotos?: string[];
}

export function extractPhotosFromHtml(
  html: string,
  opts: ExtractPhotosOptions,
): PhotoExtractionResult {
  const maxOut = opts.maxPhotos ?? MAX_PHOTOS_DEFAULT;
  const block = detectBlockPage(html);

  const stats: Record<PhotoStrategy, number> = {
    "json-ld": 0,
    "og-meta": 0,
    "inline-json": 0,
    "img-srcset": 0,
    "img-src": 0,
    "img-datasrc": 0,
    "regex-cdn": 0,
  };

  if (block.blocked) {
    return {
      photos: [],
      strategy_stats: stats,
      blocked: true,
      block_reason: block.reason,
      total_candidates: 0,
      after_filter: 0,
      after_dedup: 0,
      max_out: maxOut,
    };
  }

  const src = opts.sourceUrl;
  // Order matters — strategy that produces something first still adds to pool,
  // we merge all and score by strategy priority (json-ld > og > inline > srcset > datasrc > src > regex).
  const strategyResults: Array<{ s: PhotoStrategy; urls: string[] }> = [
    { s: "json-ld", urls: extractFromJsonLd(html, src) },
    { s: "og-meta", urls: extractFromOgMeta(html, src) },
    { s: "inline-json", urls: extractFromInlineJson(html, src) },
    { s: "img-srcset", urls: extractFromImgSrcset(html, src) },
    { s: "img-datasrc", urls: extractFromImgDataSrc(html, src) },
    { s: "img-src", urls: extractFromImgSrc(html, src) },
    { s: "regex-cdn", urls: extractFromRegexCdn(html, src) },
  ];

  // seed with upstream-provided photos (get highest priority)
  const seed = (opts.seedPhotos ?? [])
    .map((u) => normalizeImageUrl(u, src))
    .filter((u): u is string => Boolean(u));

  const priorityByKey = new Map<string, { url: string; priority: number }>();

  const push = (url: string, priority: number) => {
    const key = photoIdentityKey(url);
    const existing = priorityByKey.get(key);
    if (!existing || priority < existing.priority || (priority === existing.priority && url.length > existing.url.length)) {
      priorityByKey.set(key, { url, priority });
    }
  };

  let totalRaw = 0;
  for (const s of seed) {
    if (isLikelyPropertyPhoto(s)) push(s, -1); // beat everything
    totalRaw++;
  }
  strategyResults.forEach((r, idx) => {
    stats[r.s] = r.urls.length;
    for (const url of r.urls) {
      totalRaw++;
      if (!isLikelyPropertyPhoto(url)) continue;
      push(url, idx);
    }
  });

  const afterFilter = Array.from(priorityByKey.values()).length;

  // Sort by priority (lower = better) then by url length (longer usually = higher-res variant)
  const ordered = Array.from(priorityByKey.values())
    .sort((a, b) => (a.priority - b.priority) || (b.url.length - a.url.length))
    .map((v) => v.url);

  return {
    photos: ordered.slice(0, maxOut),
    strategy_stats: stats,
    blocked: false,
    total_candidates: totalRaw,
    after_filter: afterFilter,
    after_dedup: ordered.length,
    max_out: maxOut,
  };
}

// --------------------------- Reachability check (optional, best-effort) ---------------------------

export async function filterReachablePhotos(
  urls: string[],
  opts: { timeoutMs?: number; concurrency?: number } = {},
): Promise<string[]> {
  const timeoutMs = opts.timeoutMs ?? 4000;
  const concurrency = opts.concurrency ?? 6;
  const out: string[] = [];
  let i = 0;

  async function worker() {
    while (i < urls.length) {
      const idx = i++;
      const url = urls[idx];
      try {
        const ctl = AbortSignal.timeout(timeoutMs);
        const res = await fetch(url, { method: "HEAD", headers: { "User-Agent": BROWSER_UA }, signal: ctl, redirect: "follow" });
        if (res.ok || res.status === 405) out.push(url);
        else if (res.status === 403 || res.status === 401) out.push(url); // some CDNs reject HEAD, keep them
      } catch {
        // network error → keep it, HEAD often fails on CDNs that still serve GET
        out.push(url);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, worker));
  // preserve original order
  const kept = new Set(out);
  return urls.filter((u) => kept.has(u));
}

// --------------------------- In-memory rate limiter (per instance) ---------------------------

const rlBuckets = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, limit = 20, windowMs = 60_000): { ok: boolean; retryAfterMs: number } {
  const now = Date.now();
  const b = rlBuckets.get(key);
  if (!b || b.resetAt < now) {
    rlBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterMs: 0 };
  }
  if (b.count >= limit) return { ok: false, retryAfterMs: b.resetAt - now };
  b.count += 1;
  return { ok: true, retryAfterMs: 0 };
}
