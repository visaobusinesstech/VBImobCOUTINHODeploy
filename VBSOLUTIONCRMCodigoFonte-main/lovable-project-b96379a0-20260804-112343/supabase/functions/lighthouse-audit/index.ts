// Executa auditoria Lighthouse via Google PageSpeed Insights API (público, sem chave)
// para as rotas críticas do site e persiste o resultado em public.lighthouse_audits.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const BASE_URL = "https://radarimobtech.shop";

const CRITICAL_ROUTES = [
  "/",
  "/portal",
  "/anunciar-imovel",
  "/lgpd/meus-dados",
  "/anunciar-imovel/brasilia",
];

const PSI_ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

interface AuditRow {
  url: string;
  path: string;
  strategy: "mobile" | "desktop";
  performance_score: number | null;
  seo_score: number | null;
  accessibility_score: number | null;
  best_practices_score: number | null;
  pwa_score: number | null;
  lcp_ms: number | null;
  fcp_ms: number | null;
  cls: number | null;
  tbt_ms: number | null;
  tti_ms: number | null;
  speed_index_ms: number | null;
  status: "ok" | "error";
  error_message: string | null;
  duration_ms: number;
  raw: Record<string, unknown> | null;
}

function pctToScore(v: number | undefined | null): number | null {
  if (v === null || v === undefined) return null;
  return Math.round(v * 100);
}

function numOr<T = number>(v: unknown, fallback: T | null = null): number | T | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.round(v);
  return fallback;
}

async function runPsi(url: string, strategy: "mobile" | "desktop", path: string): Promise<AuditRow> {
  const t0 = Date.now();
  const qs = new URLSearchParams({
    url,
    strategy,
    category: "performance",
  });
  // categorias múltiplas
  ["seo", "accessibility", "best-practices", "pwa"].forEach((c) => qs.append("category", c));

  try {
    const res = await fetch(`${PSI_ENDPOINT}?${qs.toString()}`, {
      method: "GET",
      headers: { "Accept": "application/json" },
    });
    const duration = Date.now() - t0;
    if (!res.ok) {
      const body = await res.text();
      return {
        url, path, strategy,
        performance_score: null, seo_score: null, accessibility_score: null,
        best_practices_score: null, pwa_score: null,
        lcp_ms: null, fcp_ms: null, cls: null, tbt_ms: null, tti_ms: null, speed_index_ms: null,
        status: "error", error_message: `PSI ${res.status}: ${body.slice(0, 300)}`,
        duration_ms: duration, raw: null,
      };
    }
    const json = await res.json();
    const cats = json?.lighthouseResult?.categories ?? {};
    const audits = json?.lighthouseResult?.audits ?? {};
    return {
      url, path, strategy,
      performance_score: pctToScore(cats.performance?.score),
      seo_score: pctToScore(cats.seo?.score),
      accessibility_score: pctToScore(cats.accessibility?.score),
      best_practices_score: pctToScore(cats["best-practices"]?.score),
      pwa_score: pctToScore(cats.pwa?.score),
      lcp_ms: numOr(audits["largest-contentful-paint"]?.numericValue),
      fcp_ms: numOr(audits["first-contentful-paint"]?.numericValue),
      cls: typeof audits["cumulative-layout-shift"]?.numericValue === "number"
        ? Number(audits["cumulative-layout-shift"].numericValue.toFixed(3))
        : null,
      tbt_ms: numOr(audits["total-blocking-time"]?.numericValue),
      tti_ms: numOr(audits["interactive"]?.numericValue),
      speed_index_ms: numOr(audits["speed-index"]?.numericValue),
      status: "ok", error_message: null,
      duration_ms: duration,
      raw: {
        finalUrl: json?.lighthouseResult?.finalUrl,
        fetchTime: json?.lighthouseResult?.fetchTime,
      },
    };
  } catch (err) {
    return {
      url, path, strategy,
      performance_score: null, seo_score: null, accessibility_score: null,
      best_practices_score: null, pwa_score: null,
      lcp_ms: null, fcp_ms: null, cls: null, tbt_ms: null, tti_ms: null, speed_index_ms: null,
      status: "error", error_message: (err as Error).message,
      duration_ms: Date.now() - t0, raw: null,
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  let paths = CRITICAL_ROUTES;
  let strategies: Array<"mobile" | "desktop"> = ["mobile"];
  try {
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (Array.isArray(body?.paths) && body.paths.length > 0) {
        paths = body.paths.filter((p: unknown): p is string => typeof p === "string").slice(0, 20);
      }
      if (Array.isArray(body?.strategies) && body.strategies.length > 0) {
        strategies = body.strategies.filter(
          (s: unknown): s is "mobile" | "desktop" => s === "mobile" || s === "desktop",
        );
      }
    }
  } catch { /* ignore */ }

  const rows: AuditRow[] = [];
  for (const p of paths) {
    const url = `${BASE_URL}${p}`;
    for (const s of strategies) {
      const row = await runPsi(url, s, p);
      rows.push(row);
    }
  }

  const { error } = await supabase.from("lighthouse_audits").insert(rows);
  if (error) {
    console.error("insert lighthouse_audits failed", error);
    return new Response(
      JSON.stringify({ error: error.message, rows }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const summary = {
    total: rows.length,
    ok: rows.filter((r) => r.status === "ok").length,
    errors: rows.filter((r) => r.status === "error").length,
    avgPerformance: (() => {
      const vals = rows.map((r) => r.performance_score).filter((v): v is number => v !== null);
      return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
    })(),
    avgSeo: (() => {
      const vals = rows.map((r) => r.seo_score).filter((v): v is number => v !== null);
      return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
    })(),
  };

  return new Response(
    JSON.stringify({ summary, rows }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
