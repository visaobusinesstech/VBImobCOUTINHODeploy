// Gera public/sitemap.xml antes de dev e build.
// Inclui rotas públicas + páginas SEO programáticas por cidade + imóveis publicados.
import { writeFileSync } from "fs";
import { resolve } from "path";
import { SEO_CIDADES } from "../src/lib/seo/cidades";
import { SEO_BAIRROS } from "../src/lib/seo/bairros";

const BASE_URL = "https://radarimobtech.shop";
const SUPABASE_URL = "https://ugxnxztecfsklijmhhmo.supabase.co";
const SUPABASE_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVneG54enRlY2Zza2xpam1oaG1vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0OTkyNTYsImV4cCI6MjA4ODA3NTI1Nn0.yk0nsCjYOuRnwTWaR5iQaiOrn936eb_l4DuBolzVBIM";

interface Entry {
  path: string;
  changefreq?: "daily" | "weekly" | "monthly";
  priority?: string;
  lastmod?: string;
}

async function fetchImoveisPublicos(): Promise<Entry[]> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/imoveis?select=id,updated_at&status=eq.Ativo&limit=2000`,
      { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } },
    );
    if (!res.ok) return [];
    const rows: Array<{ id: string; updated_at?: string }> = await res.json();
    return rows.map((r) => ({
      path: `/imovel/${r.id}`,
      changefreq: "weekly" as const,
      priority: "0.7",
      lastmod: r.updated_at ? new Date(r.updated_at).toISOString().slice(0, 10) : undefined,
    }));
  } catch {
    return [];
  }
}

interface PostRow {
  slug: string;
  updated_at?: string;
  tipo?: string | null;
  cidade?: string | null;
  tags?: string[] | null;
}

async function fetchBlogPosts(): Promise<PostRow[]> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/conteudos_seo?select=slug,updated_at,tipo,cidade,tags&status=eq.publicado&slug=not.is.null&limit=2000`,
      { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } },
    );
    if (!res.ok) return [];
    const rows: PostRow[] = await res.json();
    return rows.filter((r) => !!r.slug);
  } catch {
    return [];
  }
}

function postEntry(r: PostRow): Entry {
  return {
    path: `/blog/${r.slug}`,
    changefreq: "weekly",
    priority: "0.7",
    lastmod: r.updated_at ? new Date(r.updated_at).toISOString().slice(0, 10) : undefined,
  };
}

const BLOG_PAGE_SIZE = 9; // deve refletir src/pages/Blog.tsx

async function main() {
  const [imoveis, posts] = await Promise.all([fetchImoveisPublicos(), fetchBlogPosts()]);

  // Paginação principal do blog
  const totalBlogPages = Math.max(1, Math.ceil(posts.length / BLOG_PAGE_SIZE));
  const blogPaginated: Entry[] = [];
  for (let p = 2; p <= totalBlogPages; p++) {
    blogPaginated.push({ path: `/blog?page=${p}`, changefreq: "daily", priority: "0.6" });
  }

  // Facetas de filtro (categoria e cidade) com paginação por faceta
  const enc = (v: string) => encodeURIComponent(v);
  const groupCount = (key: "tipo" | "cidade") => {
    const m = new Map<string, number>();
    posts.forEach((p) => {
      const v = (p[key] || "").toString().trim();
      if (v) m.set(v, (m.get(v) || 0) + 1);
    });
    return m;
  };

  const blogFacetas: Entry[] = [];
  for (const [tipo, count] of groupCount("tipo")) {
    const pages = Math.max(1, Math.ceil(count / BLOG_PAGE_SIZE));
    for (let p = 1; p <= pages; p++) {
      blogFacetas.push({
        path: p === 1 ? `/blog?tipo=${enc(tipo)}` : `/blog?tipo=${enc(tipo)}&page=${p}`,
        changefreq: "weekly",
        priority: "0.6",
      });
    }
  }
  for (const [cidade, count] of groupCount("cidade")) {
    const pages = Math.max(1, Math.ceil(count / BLOG_PAGE_SIZE));
    for (let p = 1; p <= pages; p++) {
      blogFacetas.push({
        path: p === 1 ? `/blog?cidade=${enc(cidade)}` : `/blog?cidade=${enc(cidade)}&page=${p}`,
        changefreq: "weekly",
        priority: "0.6",
      });
    }
  }

  const entries: Entry[] = [
    { path: "/", changefreq: "weekly", priority: "1.0" },
    { path: "/landing", changefreq: "weekly", priority: "0.9" },
    { path: "/anunciar-imovel", changefreq: "weekly", priority: "0.9" },
    { path: "/solucoes/seo-imobiliario", changefreq: "weekly", priority: "0.9" },
    { path: "/comparativo/kenlo-vs-radarimobtech", changefreq: "monthly", priority: "0.8" },
    { path: "/portal", changefreq: "daily", priority: "0.9" },
    { path: "/imoveis", changefreq: "daily", priority: "0.8" },
    { path: "/blog", changefreq: "daily", priority: "0.9" },
    { path: "/auth", changefreq: "monthly", priority: "0.3" },
    { path: "/reset-password", changefreq: "monthly", priority: "0.2" },
    { path: "/lgpd/meus-dados", changefreq: "monthly", priority: "0.5" },
    ...SEO_CIDADES.map((c) => ({
      path: `/anunciar-imovel/${c.slug}`,
      changefreq: "weekly" as const,
      priority: "0.8",
    })),
    ...SEO_BAIRROS.map((b) => ({
      path: `/imoveis/${b.cidadeSlug}/${b.slug}`,
      changefreq: "weekly" as const,
      priority: "0.7",
    })),
    ...blogPaginated,
    ...blogFacetas,
    ...posts.map(postEntry),
    ...imoveis,
  ];

  const xml = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...entries.map((e) =>
      [
        `  <url>`,
        `    <loc>${BASE_URL}${e.path}</loc>`,
        e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : "",
        e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : "",
        e.priority ? `    <priority>${e.priority}</priority>` : "",
        `  </url>`,
      ]
        .filter(Boolean)
        .join("\n"),
    ),
    `</urlset>`,
  ].join("\n");

  writeFileSync(resolve("public/sitemap.xml"), xml);
  console.log(`sitemap.xml written (${entries.length} entries, ${imoveis.length} imóveis, ${posts.length} posts, ${totalBlogPages} páginas de blog)`);
}

void main();
