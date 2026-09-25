import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const FIRECRAWL_V2 = "https://api.firecrawl.dev/v2";

interface SearchItem {
  url: string;
  title?: string;
  description?: string;
  markdown?: string;
  metadata?: Record<string, unknown>;
}

async function hashString(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function canonicalizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.hash = "";
    // strip common tracking params
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid"].forEach(
      (p) => u.searchParams.delete(p),
    );
    return u.toString().replace(/\/$/, "");
  } catch {
    return raw.trim();
  }
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function scoreViralidade(item: SearchItem, keywords: string[], recente: boolean): {
  score: number;
  sinais: Record<string, unknown>;
} {
  const title = (item.title ?? "").toLowerCase();
  const desc = (item.description ?? "").toLowerCase();
  const text = `${title} ${desc}`;
  let score = 40;
  const sinais: Record<string, unknown> = {};

  // Recência (via tbs filter)
  if (recente) {
    score += 20;
    sinais.recente = true;
  }
  // Keyword matches
  const kwHits = keywords.filter((k) => text.includes(k.toLowerCase())).length;
  score += Math.min(kwHits * 6, 24);
  sinais.keyword_hits = kwHits;

  // Trend words
  const trendWords = ["viral", "explode", "recorde", "alta", "queda", "boom", "cresce", "novo", "urgente", "tendência", "top", "melhor", "pior", "polêmica"];
  const tHits = trendWords.filter((w) => text.includes(w)).length;
  score += Math.min(tHits * 4, 16);
  sinais.trend_hits = tHits;

  // Título curto e forte
  if (item.title && item.title.length >= 30 && item.title.length <= 80) score += 4;
  // Presença em metadata (ogImage etc)
  if (item.metadata && (item.metadata.ogImage || (item.metadata as any)["og:image"])) {
    score += 4;
    sinais.tem_imagem = true;
  }

  return { score: Math.max(0, Math.min(100, Math.round(score))), sinais };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startedAt = Date.now();
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sbUrl = Deno.env.get("SUPABASE_URL")!;
    const sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(sbUrl, sbKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Sessão expirada" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { tema_id } = await req.json().catch(() => ({}));

    // Load temas
    let temasQuery = supabase
      .from("curadoria_temas")
      .select("*")
      .eq("imobiliaria_id", user.id)
      .eq("ativo", true);
    if (tema_id) temasQuery = temasQuery.eq("id", tema_id);
    const { data: temas, error: temasErr } = await temasQuery;
    if (temasErr) throw temasErr;
    if (!temas || temas.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "Nenhum tema ativo", encontradas: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (!FIRECRAWL_API_KEY) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "FIRECRAWL_API_KEY não configurada. Configure o conector Firecrawl.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let totalEncontradas = 0;
    let totalNovas = 0;
    const detalhesTemas: Record<string, unknown>[] = [];

    for (const tema of temas) {
      const keywords: string[] = Array.isArray(tema.palavras_chave) ? tema.palavras_chave : [];
      const query = [tema.nome, ...keywords].filter(Boolean).slice(0, 6).join(" ");
      const tbs = tema.periodo_busca || "qdr:w";

      let items: SearchItem[] = [];
      try {
        const searchRes = await fetch(`${FIRECRAWL_V2}/search`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query,
            limit: Math.min(tema.max_por_execucao || 10, 20),
            lang: (tema.idioma || "pt-BR").split("-")[0],
            country: "br",
            tbs,
          }),
        });

        if (searchRes.ok) {
          const searchData = await searchRes.json();
          const raw = Array.isArray(searchData?.data)
            ? searchData.data
            : Array.isArray(searchData?.web)
              ? searchData.web
              : [];
          items = raw as SearchItem[];
        } else {
          const errText = await searchRes.text();
          detalhesTemas.push({ tema: tema.nome, erro: `Firecrawl ${searchRes.status}: ${errText.slice(0, 200)}` });
          continue;
        }
      } catch (err) {
        detalhesTemas.push({ tema: tema.nome, erro: String(err) });
        continue;
      }

      const permitidas: string[] = (tema.fontes_permitidas || []).map((s: string) => s.toLowerCase());
      const bloqueadas: string[] = (tema.fontes_bloqueadas || []).map((s: string) => s.toLowerCase());

      let novas = 0;
      for (const item of items) {
        if (!item.url) continue;
        const canonical = canonicalizeUrl(item.url);
        const dominio = domainOf(canonical);
        if (!dominio) continue;
        if (bloqueadas.some((b) => dominio.includes(b))) continue;
        if (permitidas.length > 0 && !permitidas.some((p) => dominio.includes(p))) continue;

        const recente = tbs === "qdr:d" || tbs === "qdr:h";
        const { score, sinais } = scoreViralidade(item, keywords, recente);
        const url_hash = await hashString(canonical);

        const { error: insErr } = await supabase.from("curadoria_descobertas").insert({
          imobiliaria_id: user.id,
          tema_id: tema.id,
          url: canonical,
          url_hash,
          titulo: item.title || canonical,
          resumo: item.description || null,
          fonte_nome: (item.metadata as any)?.siteName || dominio,
          fonte_dominio: dominio,
          imagem_url: (item.metadata as any)?.ogImage || (item.metadata as any)?.["og:image"] || null,
          score_viralidade: score,
          sinais,
          payload: item,
          status: "nova",
        });
        if (!insErr) novas++;
        // duplicates (unique constraint) simplesmente ignoram
        totalEncontradas++;
      }
      totalNovas += novas;
      detalhesTemas.push({ tema: tema.nome, encontradas: items.length, novas });

      await supabase
        .from("curadoria_temas")
        .update({ ultima_execucao: new Date().toISOString() })
        .eq("id", tema.id);
    }

    await supabase.from("curadoria_execucoes_log").insert({
      imobiliaria_id: user.id,
      tipo: "descoberta",
      status: "sucesso",
      descobertas_encontradas: totalEncontradas,
      descobertas_novas: totalNovas,
      duracao_ms: Date.now() - startedAt,
      detalhes: { temas: detalhesTemas },
    });

    return new Response(
      JSON.stringify({
        success: true,
        encontradas: totalEncontradas,
        novas: totalNovas,
        temas: detalhesTemas,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[curadoria-viral-descobrir] erro:", e);
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
