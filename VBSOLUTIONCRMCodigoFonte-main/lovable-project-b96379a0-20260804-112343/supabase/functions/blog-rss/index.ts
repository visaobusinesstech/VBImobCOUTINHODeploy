import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE_URL = "https://radarimobtech.shop";

function escapeXml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function stripHtml(s: string): string {
  return String(s ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Sanitiza HTML para inclusão segura em feeds RSS/Atom.
 * - Remove scripts, iframes, embeds, objects, styles, formulários, links de mídia inseguros
 * - Remove atributos on* (handlers de evento) e javascript:/data: URLs
 * - Preserva formatação básica: p, h1-h6, ul/ol/li, strong, em, a, img, blockquote, code, pre, br, hr
 */
function sanitizeHtml(html: string): string {
  if (!html) return "";
  let s = String(html);
  // Blocos perigosos completos
  s = s.replace(/<(script|style|iframe|object|embed|form|noscript|link|meta)\b[^>]*>[\s\S]*?<\/\1>/gi, "");
  s = s.replace(/<(script|style|iframe|object|embed|form|noscript|link|meta)\b[^>]*\/?>/gi, "");
  // Handlers de evento on*="..." e on*='...'
  s = s.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "");
  s = s.replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "");
  s = s.replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, "");
  // URLs perigosas em href/src
  s = s.replace(/\s(href|src)\s*=\s*"(?:\s*javascript:|\s*data:(?!image\/))[^"]*"/gi, "");
  s = s.replace(/\s(href|src)\s*=\s*'(?:\s*javascript:|\s*data:(?!image\/))[^']*'/gi, "");
  // Comentários
  s = s.replace(/<!--[\s\S]*?-->/g, "");
  return s.trim();
}

/**
 * CDATA-safe wrap: quebra sequências ]]> para não fechar prematuramente o CDATA.
 */
function cdata(s: string): string {
  return `<![CDATA[${String(s ?? "").replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
}

/**
 * Extrai mídias (imagens/vídeos) do HTML para uso como enclosures.
 * Retorna URLs absolutas + mime type inferido pela extensão.
 * Ignora data: URIs e URLs relativas sem host.
 */
type MediaItem = { url: string; type: string };
function extractMedia(html: string, siteUrl: string): MediaItem[] {
  if (!html) return [];
  const found: MediaItem[] = [];
  const seen = new Set<string>();
  const mimeFor = (u: string): string | null => {
    const ext = (u.split("?")[0].split("#")[0].split(".").pop() || "").toLowerCase();
    const map: Record<string, string> = {
      jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif",
      webp: "image/webp", avif: "image/avif", svg: "image/svg+xml",
      mp4: "video/mp4", webm: "video/webm", ogv: "video/ogg", mov: "video/quicktime",
      mp3: "audio/mpeg", ogg: "audio/ogg", wav: "audio/wav", m4a: "audio/mp4",
    };
    return map[ext] || null;
  };
  const absolutize = (u: string): string | null => {
    const raw = u.trim();
    if (!raw || raw.startsWith("data:") || raw.startsWith("javascript:")) return null;
    try {
      return new URL(raw, siteUrl).toString();
    } catch {
      return null;
    }
  };
  // Coleta srcs de <img>, <video>, <audio>, <source>
  const re = /<(?:img|video|audio|source)\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const abs = absolutize(m[1]);
    if (!abs || seen.has(abs)) continue;
    const type = mimeFor(abs);
    if (!type) continue;
    seen.add(abs);
    found.push({ url: abs, type });
  }
  return found;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      },
    });
  }

  const isHead = req.method === "HEAD";
  if (req.method !== "GET" && !isHead) {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: {
        "Allow": "GET, HEAD, OPTIONS",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  const url = new URL(req.url);
  const format = (url.searchParams.get("format") || "rss").toLowerCase();
  const tipo = url.searchParams.get("tipo");
  const cidade = url.searchParams.get("cidade");
  const orderParam = (url.searchParams.get("order") || "date").toLowerCase();
  const order: "date" | "relevance" = orderParam === "relevance" || orderParam === "relevancia"
    ? "relevance"
    : "date";
  // `?sort=` — ordenação explícita. Sobrepõe `?order=` quando presente.
  //   date_desc | recentes | newest  (padrão)
  //   date_asc  | antigos  | oldest
  //   title_asc | titulo   | title
  //   title_desc
  const sortParam = (url.searchParams.get("sort") || "").toLowerCase().trim();
  type SortMode = "date_desc" | "date_asc" | "title_asc" | "title_desc" | null;
  const sortMap: Record<string, SortMode> = {
    "date_desc": "date_desc", "recentes": "date_desc", "newest": "date_desc", "desc": "date_desc",
    "date_asc": "date_asc", "antigos": "date_asc", "oldest": "date_asc", "asc": "date_asc",
    "title_asc": "title_asc", "titulo": "title_asc", "title": "title_asc", "a-z": "title_asc",
    "title_desc": "title_desc", "z-a": "title_desc",
  };
  const sort: SortMode = sortParam ? (sortMap[sortParam] ?? null) : null;

  const q = (url.searchParams.get("q") || "").trim().toLowerCase();
  const modeParam = (url.searchParams.get("mode") || "full").toLowerCase();
  const mode: "summary" | "full" = modeParam === "summary" || modeParam === "resumo"
    ? "summary"
    : "full";

  // `?media=0|1` — controla inclusão de enclosures (imagens/vídeos).
  // Default: 1 (incluir). Aceita: 0, 1, true, false, yes, no, on, off.
  const mediaRaw = (url.searchParams.get("media") ?? "1").toLowerCase().trim();
  const includeMedia = !["0", "false", "no", "off", "none"].includes(mediaRaw);

  // Configuráveis via query string, com limites de segurança.
  // - limit:  1..200  (padrão 50)
  // - cache:  0..86400 segundos (padrão 600 = 10 min)
  // Padrões podem ser sobrescritos por categoria/cidade via `blog_rss_defaults`.
  const DEFAULT_LIMIT = 50;
  const DEFAULT_CACHE = 600;
  const parseIntSafe = (v: string | null, def: number, min: number, max: number) => {
    const n = parseInt(v ?? "", 10);
    if (!Number.isFinite(n)) return def;
    return Math.min(max, Math.max(min, n));
  };
  const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
  );

  // Resolve defaults por escopo: (tipo+cidade) > tipo > cidade > global.
  let scopedLimit: number | null = null;
  let scopedCache: number | null = null;
  try {
    const { data: defs } = await supabase
      .from("blog_rss_defaults")
      .select('tipo,cidade,"limit",cache_seconds');
    const rows = (defs as any[]) || [];
    const pick = (t: string | null, c: string | null) =>
      rows.find((r) => (r.tipo ?? null) === t && (r.cidade ?? null) === c) || null;
    const match =
      (tipo && cidade && pick(tipo, cidade)) ||
      (tipo && pick(tipo, null)) ||
      (cidade && pick(null, cidade)) ||
      pick(null, null);
    if (match) {
      if (typeof match["limit"] === "number") scopedLimit = clamp(match["limit"], 1, 200);
      if (typeof match.cache_seconds === "number") scopedCache = clamp(match.cache_seconds, 0, 86400);
    }
  } catch {
    // silencioso: cai nos defaults globais
  }

  const limit = url.searchParams.has("limit")
    ? parseIntSafe(url.searchParams.get("limit"), DEFAULT_LIMIT, 1, 200)
    : (scopedLimit ?? DEFAULT_LIMIT);
  const cacheSec = url.searchParams.has("cache")
    ? parseIntSafe(url.searchParams.get("cache"), DEFAULT_CACHE, 0, 86400)
    : (scopedCache ?? DEFAULT_CACHE);
  // Overrides opcionais e independentes para browser (max-age) e CDN (s-maxage).
  // Se ausentes, ambos herdam `cacheSec`. Valores inválidos ou fora do intervalo
  // [0, 86400] retornam 400 com mensagem clara (não fazem clamp silencioso).
  const CACHE_MIN = 0;
  const CACHE_MAX = 86400;
  const validateCacheParam = (name: string): number | Response | null => {
    if (!url.searchParams.has(name)) return null;
    const raw = url.searchParams.get(name) ?? "";
    const trimmed = raw.trim();
    if (trimmed === "" || !/^-?\d+$/.test(trimmed)) {
      return new Response(
        JSON.stringify({
          error: "invalid_query_parameter",
          param: name,
          message: `${name} deve ser um inteiro entre ${CACHE_MIN} e ${CACHE_MAX} segundos.`,
          received: raw,
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-store",
          },
        },
      );
    }
    const n = parseInt(trimmed, 10);
    if (n < CACHE_MIN || n > CACHE_MAX) {
      return new Response(
        JSON.stringify({
          error: "out_of_range",
          param: name,
          message: `${name} fora do intervalo permitido [${CACHE_MIN}, ${CACHE_MAX}].`,
          received: n,
          min: CACHE_MIN,
          max: CACHE_MAX,
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-store",
          },
        },
      );
    }
    return n;
  };
  const maxAgeCheck = validateCacheParam("cache_max_age");
  if (maxAgeCheck instanceof Response) return maxAgeCheck;
  const sMaxAgeCheck = validateCacheParam("cache_s_max_age");
  if (sMaxAgeCheck instanceof Response) return sMaxAgeCheck;
  const maxAgeSec = maxAgeCheck ?? cacheSec;
  const sMaxAgeSec = sMaxAgeCheck ?? cacheSec;
  // `?cache_stale_while_revalidate=` e `?cache_stale_if_error=` — diretivas RFC 5861.
  // Permitem que caches sirvam resposta stale enquanto revalidam em background
  // (SWR) ou quando a origem falha (SIE). 0 = omitir a diretiva. Máx 86400s.
  const swrSec = url.searchParams.has("cache_stale_while_revalidate")
    ? parseIntSafe(url.searchParams.get("cache_stale_while_revalidate"), 0, 0, 86400)
    : 0;
  const sieSec = url.searchParams.has("cache_stale_if_error")
    ? parseIntSafe(url.searchParams.get("cache_stale_if_error"), 0, 0, 86400)
    : 0;
  // `?no_store=1` — força `Cache-Control: no-store`, ignorando quaisquer
  // valores de cache_max_age / cache_s_max_age / SWR / SIE.
  const noStoreRaw = (url.searchParams.get("no_store") ?? "0").toLowerCase().trim();
  const noStore = ["1", "true", "yes", "on"].includes(noStoreRaw);

  // Filtro de status via query params:
  //   ?status=publicado (padrão) | ?status=publicado,agendado | ?status=all
  //   ?exclude=rascunho,cancelado
  // Observação: leitura pública é restrita a "publicado" pela RLS — outros
  // status só retornam quando o request é autenticado com escopo adequado.
  const rawStatus = (url.searchParams.get("status") || "publicado").trim().toLowerCase();
  const rawExclude = (url.searchParams.get("exclude") || "").trim().toLowerCase();
  const splitCsv = (s: string) =>
    s.split(",").map((v) => v.trim()).filter(Boolean);
  const statusList = rawStatus === "all" || rawStatus === "todos" ? [] : splitCsv(rawStatus);
  const excludeList = splitCsv(rawExclude);

  // `?since=` — filtra apenas posts com updated_at >= since.
  // Aceita ISO 8601 (`2025-01-15`, `2025-01-15T12:00:00Z`), unix seconds/ms,
  // ou durações relativas curtas (`7d`, `24h`, `30m`). Se inválido, ignora.
  const sinceRaw = (url.searchParams.get("since") || "").trim();
  let sinceIso: string | null = null;
  if (sinceRaw) {
    let d: Date | null = null;
    const relMatch = sinceRaw.match(/^(\d+)\s*(m|h|d|w)$/i);
    if (relMatch) {
      const n = parseInt(relMatch[1], 10);
      const unit = relMatch[2].toLowerCase();
      const mult = unit === "m" ? 60_000 : unit === "h" ? 3_600_000 : unit === "d" ? 86_400_000 : 604_800_000;
      d = new Date(Date.now() - n * mult);
    } else if (/^\d+$/.test(sinceRaw)) {
      const n = parseInt(sinceRaw, 10);
      d = new Date(n < 1e12 ? n * 1000 : n);
    } else {
      d = new Date(sinceRaw);
    }
    if (d && !isNaN(d.getTime())) sinceIso = d.toISOString();
  } else {
    // Fallback: If-Modified-Since (RFC 7232) → mesma semântica de `?since`.
    const ims = req.headers.get("if-modified-since");
    if (ims) {
      const d = new Date(ims);
      if (!isNaN(d.getTime())) sinceIso = d.toISOString();
    }
  }

  // Paginação: `?page=` (1-indexado) OU `?offset=` (0-indexado). Se ambos forem
  // enviados, `offset` prevalece. `limit` continua controlando o tamanho da página.
  const pageParam = parseInt(url.searchParams.get("page") ?? "", 10);
  const offsetParam = parseInt(url.searchParams.get("offset") ?? "", 10);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
  const offset = Number.isFinite(offsetParam) && offsetParam >= 0
    ? offsetParam
    : (page - 1) * limit;
  const rangeFrom = offset;
  const rangeTo = offset + limit - 1;

  let query = supabase
    .from("conteudos_seo")
    .select(
      "id,slug,titulo,tipo,meta_description,cidade,bairro,publicado_em,created_at,updated_at,conteudo,status",
      { count: "exact" },
    )
    .not("slug", "is", null);

  // Ordenação SQL. `sort` sobrepõe o comportamento padrão de data.
  // Se `order=relevance`, o sort final acontece em memória depois — aqui só
  // buscamos por data desc para termos os candidatos mais atuais.
  if (sort === "title_asc") {
    query = query.order("titulo", { ascending: true, nullsFirst: false });
  } else if (sort === "title_desc") {
    query = query.order("titulo", { ascending: false, nullsFirst: false });
  } else if (sort === "date_asc") {
    query = query
      .order("publicado_em", { ascending: true, nullsFirst: true })
      .order("created_at", { ascending: true });
  } else {
    query = query
      .order("publicado_em", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
  }
  query = query.range(rangeFrom, rangeTo);

  if (statusList.length === 1) query = query.eq("status", statusList[0]);
  else if (statusList.length > 1) query = query.in("status", statusList);
  if (excludeList.length > 0) {
    // PostgREST: not.in.(a,b) — escapa aspas/parenteses simples
    const safe = excludeList.map((v) => v.replace(/[(),]/g, "")).join(",");
    query = query.not("status", "in", `(${safe})`);
  }

  if (tipo) query = query.eq("tipo", tipo);
  if (cidade) query = query.eq("cidade", cidade);
  if (sinceIso) query = query.gte("updated_at", sinceIso);

  const { data, error, count } = await query;
  if (error) {
    return new Response(`Error: ${error.message}`, { status: 500 });
  }

  const posts = (data as any[]) || [];

  // Ordenação por relevância (em memória) — só quando `order=relevance` e
  // nenhum `sort` explícito foi solicitado. `sort` sempre vence.
  if (order === "relevance" && !sort) {
    const now = Date.now();
    const HALF_LIFE_MS = 30 * 24 * 3600 * 1000; // 30 dias
    const scoreOf = (p: any) => {
      const ts = new Date(p.publicado_em || p.created_at || 0).getTime();
      const ageDays = Math.max(0, (now - ts) / (24 * 3600 * 1000));
      const recency = Math.pow(0.5, ageDays / (HALF_LIFE_MS / (24 * 3600 * 1000))); // 0..1
      const contentLen = String(p.conteudo || "").length;
      const richness = Math.min(1, contentLen / 4000); // 0..1
      const hasMeta = p.meta_description ? 0.15 : 0;
      const hasLocal = (p.cidade ? 0.1 : 0) + (p.bairro ? 0.05 : 0);
      let match = 0;
      if (q) {
        const hay = `${p.titulo || ""} ${p.meta_description || ""} ${p.tipo || ""} ${p.cidade || ""} ${p.bairro || ""}`.toLowerCase();
        if (hay.includes(q)) match += 0.5;
        if (String(p.titulo || "").toLowerCase().includes(q)) match += 0.5;
      }
      return recency * 1.0 + richness * 0.5 + hasMeta + hasLocal + match;
    };
    posts.sort((a, b) => scoreOf(b) - scoreOf(a));
  }

  // Reordenação por título em memória usa comparação locale-aware pt-BR
  // (garante acentos corretos mesmo quando a query SQL já ordenou).
  if (sort === "title_asc" || sort === "title_desc") {
    const cmp = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true }).compare;
    posts.sort((a, b) => cmp(String(a.titulo || ""), String(b.titulo || "")));
    if (sort === "title_desc") posts.reverse();
  }

  const lastBuild = new Date(
    posts[0]?.updated_at || posts[0]?.publicado_em || posts[0]?.created_at || Date.now(),
  ).toUTCString();

  const feedUrl = `${SITE_URL}/functions/v1/blog-rss${url.search}`;
  const title = "Blog radarimobtech";
  const description =
    "Artigos, guias e análises sobre captação, CRM imobiliário, avaliação de imóveis e mercado brasileiro.";

  // Links de paginação (RFC 5005 — feed paging). Preserva todos os params, só troca `page`.
  const total = typeof count === "number" ? count : posts.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const buildPageUrl = (p: number) => {
    const params = new URLSearchParams(url.search);
    params.delete("offset");
    params.set("page", String(p));
    return `${SITE_URL}/functions/v1/blog-rss?${params.toString()}`;
  };
  const firstUrl = buildPageUrl(1);
  const lastUrl = buildPageUrl(totalPages);
  const nextUrl = page < totalPages ? buildPageUrl(page + 1) : null;
  const prevUrl = page > 1 ? buildPageUrl(page - 1) : null;

  let body: string;
  let contentType: string;

  if (format === "atom") {
    const entries = posts
      .map((p) => {
        const link = `${SITE_URL}/blog/${p.slug}`;
        const updated = new Date(p.updated_at || p.publicado_em || p.created_at).toISOString();
        const published = new Date(p.publicado_em || p.created_at).toISOString();
        const summary = stripHtml(p.meta_description || "").slice(0, 500);
        const fullHtml = mode === "full" ? sanitizeHtml(p.conteudo || "") : "";
        const contentEl = mode === "full"
          ? `<content type="html">${cdata(fullHtml || summary)}</content>`
          : "";
        const media = includeMedia ? extractMedia(fullHtml || sanitizeHtml(p.conteudo || ""), SITE_URL) : [];
        const enclosures = media
          .map((mm) => `<link rel="enclosure" href="${escapeXml(mm.url)}" type="${escapeXml(mm.type)}"/>`)
          .join("\n    ");
        return `  <entry>
    <title>${escapeXml(p.titulo)}</title>
    <link href="${escapeXml(link)}"/>
    <id>${escapeXml(link)}</id>
    <updated>${updated}</updated>
    <published>${published}</published>
    <category term="${escapeXml(p.tipo || "post")}"/>
    ${p.cidade ? `<category term="${escapeXml(p.cidade)}"/>` : ""}
    ${enclosures}
    <summary type="html">${cdata(summary)}</summary>
    ${contentEl}
  </entry>`;
      })
      .join("\n");

    const atomPageLinks = [
      `<link href="${escapeXml(firstUrl)}" rel="first"/>`,
      `<link href="${escapeXml(lastUrl)}" rel="last"/>`,
      prevUrl ? `<link href="${escapeXml(prevUrl)}" rel="previous"/>` : "",
      nextUrl ? `<link href="${escapeXml(nextUrl)}" rel="next"/>` : "",
    ].filter(Boolean).join("\n  ");

    body = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:opensearch="http://a9.com/-/spec/opensearch/1.1/">
  <title>${escapeXml(title)}</title>
  <subtitle>${escapeXml(description)}</subtitle>
  <link href="${escapeXml(feedUrl)}" rel="self"/>
  <link href="${SITE_URL}/blog"/>
  ${atomPageLinks}
  <opensearch:totalResults>${total}</opensearch:totalResults>
  <opensearch:startIndex>${offset + 1}</opensearch:startIndex>
  <opensearch:itemsPerPage>${limit}</opensearch:itemsPerPage>
  <id>${SITE_URL}/blog</id>
  <updated>${new Date(lastBuild).toISOString()}</updated>
${entries}
</feed>`;
    contentType = "application/atom+xml; charset=utf-8";
  } else {
    const items = posts
      .map((p) => {
        const link = `${SITE_URL}/blog/${p.slug}`;
        const pubDate = new Date(p.publicado_em || p.created_at).toUTCString();
        const summary = stripHtml(p.meta_description || "").slice(0, 500);
        const fullHtml = mode === "full" ? sanitizeHtml(p.conteudo || "") : "";
        const contentEl = mode === "full"
          ? `<content:encoded>${cdata(fullHtml || summary)}</content:encoded>`
          : "";
        // RSS 2.0 permite apenas 1 <enclosure> por item — usa a primeira mídia.
        const media = includeMedia ? extractMedia(fullHtml || sanitizeHtml(p.conteudo || ""), SITE_URL) : [];
        const first = media[0];
        const enclosureEl = first
          ? `<enclosure url="${escapeXml(first.url)}" type="${escapeXml(first.type)}" length="0"/>`
          : "";
        // Mídias adicionais expostas via media:content (namespace media:).
        const extraMedia = media.slice(1)
          .map((mm) => `<media:content url="${escapeXml(mm.url)}" type="${escapeXml(mm.type)}"/>`)
          .join("\n      ");
        return `    <item>
      <title>${escapeXml(p.titulo)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <pubDate>${pubDate}</pubDate>
      <category>${escapeXml(p.tipo || "post")}</category>
      ${p.cidade ? `<category>${escapeXml(p.cidade)}</category>` : ""}
      ${enclosureEl}
      ${extraMedia}
      <description>${escapeXml(summary)}</description>
      ${contentEl}
    </item>`;
      })
      .join("\n");

    const rssPageLinks = [
      `<atom:link href="${escapeXml(firstUrl)}" rel="first"/>`,
      `<atom:link href="${escapeXml(lastUrl)}" rel="last"/>`,
      prevUrl ? `<atom:link href="${escapeXml(prevUrl)}" rel="previous"/>` : "",
      nextUrl ? `<atom:link href="${escapeXml(nextUrl)}" rel="next"/>` : "",
    ].filter(Boolean).join("\n    ");

    body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:media="http://search.yahoo.com/mrss/" xmlns:opensearch="http://a9.com/-/spec/opensearch/1.1/">
  <channel>
    <title>${escapeXml(title)}</title>
    <link>${SITE_URL}/blog</link>
    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml"/>
    ${rssPageLinks}
    <opensearch:totalResults>${total}</opensearch:totalResults>
    <opensearch:startIndex>${offset + 1}</opensearch:startIndex>
    <opensearch:itemsPerPage>${limit}</opensearch:itemsPerPage>
    <description>${escapeXml(description)}</description>
    <language>pt-BR</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
${items}
  </channel>
</rss>`;
    contentType = "application/rss+xml; charset=utf-8";
  }

  // ETag forte baseado em SHA-1 do corpo. Suporta If-None-Match → 304.
  const bytes = new TextEncoder().encode(body);
  const digest = await crypto.subtle.digest("SHA-1", bytes);
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  // `?weak_etag=1` — emite ETag fraco (W/"...") para caches que recompactam
  // ou fazem transformações leves na resposta (gzip/brotli reencoding, etc.).
  // Aceita: 1, true, yes, on. Padrão: strong ETag.
  const weakRaw = (url.searchParams.get("weak_etag") ?? "0").toLowerCase().trim();
  const useWeakEtag = ["1", "true", "yes", "on"].includes(weakRaw);
  const strongEtag = `"${hex}"`;
  const etag = useWeakEtag ? `W/${strongEtag}` : strongEtag;

  const inm = req.headers.get("if-none-match") || "";
  const matches = inm
    .split(",")
    .map((s) => s.trim())
    .some((t) => t === etag || t === "*" || t === strongEtag || t === `W/${strongEtag}`);

  // Se `?no_store=1`, zera todos os TTLs efetivos e emite `no-store`.
  const effMaxAge = noStore ? 0 : maxAgeSec;
  const effSMaxAge = noStore ? 0 : sMaxAgeSec;
  const effSwr = noStore ? 0 : swrSec;
  const effSie = noStore ? 0 : sieSec;

  const cacheDirectives = noStore
    ? "no-store"
    : (effMaxAge > 0 || effSMaxAge > 0)
      ? [
          `public`,
          `max-age=${effMaxAge}`,
          `s-maxage=${effSMaxAge}`,
          effSwr > 0 ? `stale-while-revalidate=${effSwr}` : "",
          effSie > 0 ? `stale-if-error=${effSie}` : "",
        ].filter(Boolean).join(", ")
      : "no-store";

  const commonHeaders: Record<string, string> = {
    "Content-Type": contentType,
    "Cache-Control": cacheDirectives,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Expose-Headers":
      "ETag, Last-Modified, X-Cache-Max-Age, X-Cache-S-Max-Age, X-Cache-Stale-While-Revalidate, X-Cache-Stale-If-Error, X-Cache-TTL, X-Cache-No-Store",
    "ETag": etag,
    "Last-Modified": lastBuild,
    "Vary": "If-None-Match, If-Modified-Since, Accept-Encoding",
    "X-Cache-Max-Age": String(effMaxAge),
    "X-Cache-S-Max-Age": String(effSMaxAge),
    "X-Cache-Stale-While-Revalidate": String(effSwr),
    "X-Cache-Stale-If-Error": String(effSie),
    "X-Cache-No-Store": noStore ? "1" : "0",
    "X-Cache-TTL": noStore
      ? "no-store"
      : `browser=${effMaxAge}s; cdn=${effSMaxAge}s; swr=${effSwr}s; sie=${effSie}s`,
  };

  if (matches) {
    return new Response(null, { status: 304, headers: commonHeaders });
  }

  // HEAD: mesmos headers do GET (incluindo Content-Length real), sem corpo.
  if (isHead) {
    return new Response(null, {
      status: 200,
      headers: { ...commonHeaders, "Content-Length": String(bytes.byteLength) },
    });
  }

  return new Response(body, { status: 200, headers: commonHeaders });
});
