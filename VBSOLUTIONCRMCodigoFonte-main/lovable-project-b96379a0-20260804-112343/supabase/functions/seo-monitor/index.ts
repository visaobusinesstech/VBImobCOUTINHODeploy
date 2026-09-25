import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const BASE_URL = "https://radarimobtech.shop";
const SITEMAP_URL = `${BASE_URL}/sitemap.xml`;
const TIMEOUT_MS = 12000;
const SLOW_THRESHOLD_MS = 4000;
// Amostra para não estourar CPU: sempre inclui estáticas + amostra imóveis
const DYNAMIC_SAMPLE = 25;

interface CheckResult {
  url: string;
  status: number;
  ms: number;
  ok: boolean;
  error?: string;
}

function parseSitemap(xml: string): string[] {
  const urls: string[] = [];
  const blocks = xml.match(/<url>[\s\S]*?<\/url>/g) || [];
  for (const b of blocks) {
    const loc = b.match(/<loc>([^<]+)<\/loc>/)?.[1];
    if (loc) urls.push(loc.trim());
  }
  return urls;
}

async function check(url: string): Promise<CheckResult> {
  const t0 = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: { "User-Agent": "radarimobtech-seo-monitor/1.0" },
      signal: controller.signal,
    });
    const ms = Date.now() - t0;
    return { url, status: res.status, ms, ok: res.ok };
  } catch (e) {
    return {
      url,
      status: 0,
      ms: Date.now() - t0,
      ok: false,
      error: (e as Error).message,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function batch<T, R>(items: T[], size: number, fn: (t: T) => Promise<R>) {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    const chunk = items.slice(i, i + size);
    const r = await Promise.all(chunk.map(fn));
    out.push(...r);
  }
  return out;
}

function pctl(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const started = Date.now();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // 1. Buscar sitemap
    const sitemapRes = await fetch(SITEMAP_URL, { headers: { "User-Agent": "seo-monitor" } });
    if (!sitemapRes.ok) {
      return new Response(
        JSON.stringify({ error: "sitemap fetch failed", status: sitemapRes.status }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const allUrls = parseSitemap(await sitemapRes.text());

    // 2. Amostrar: todas as estáticas + N imóveis aleatórios
    const staticUrls = allUrls.filter((u) => !u.includes("/imovel/"));
    const dynamicUrls = allUrls.filter((u) => u.includes("/imovel/"));
    const sampleDynamic = dynamicUrls
      .sort(() => Math.random() - 0.5)
      .slice(0, DYNAMIC_SAMPLE);
    const toCheck = [...staticUrls, ...sampleDynamic];

    // 3. Snapshot anterior
    const { data: prev } = await supabase
      .from("seo_monitor_snapshots")
      .select("id, results")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const prevUrls = new Set<string>(
      (prev?.results as CheckResult[] | undefined)?.map((r) => r.url) ?? [],
    );
    const prevMap = new Map<string, CheckResult>(
      (prev?.results as CheckResult[] | undefined)?.map((r) => [r.url, r]) ?? [],
    );

    // 4. Executar checks em paralelo (batch de 6)
    const results = await batch(toCheck, 6, check);

    // 5. Métricas
    const okCount = results.filter((r) => r.ok).length;
    const errorCount = results.length - okCount;
    const times = results.filter((r) => r.ok).map((r) => r.ms);
    const avgMs = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
    const p95Ms = pctl(times, 95);

    const currentUrls = new Set(results.map((r) => r.url));
    const newUrls = [...currentUrls].filter((u) => !prevUrls.has(u) && prev);
    const removedUrls = [...prevUrls].filter((u) => !currentUrls.has(u));

    // 6. Salvar snapshot
    const { data: snap, error: snapErr } = await supabase
      .from("seo_monitor_snapshots")
      .insert({
        total_urls: results.length,
        ok_count: okCount,
        error_count: errorCount,
        new_urls_count: newUrls.length,
        removed_urls_count: removedUrls.length,
        avg_ms: avgMs,
        p95_ms: p95Ms,
        results,
        duration_ms: Date.now() - started,
      })
      .select("id")
      .single();

    if (snapErr) throw snapErr;

    // 7. Gerar alertas
    const alertas: Array<Record<string, unknown>> = [];

    for (const r of results) {
      if (!r.ok) {
        alertas.push({
          tipo: r.status === 0 ? "timeout" : "http_error",
          severity: "error",
          url: r.url,
          status_code: r.status || null,
          response_ms: r.ms,
          message:
            r.status === 0
              ? `Timeout/erro ao acessar (${r.error || "sem resposta"})`
              : `HTTP ${r.status} ao acessar rota`,
          snapshot_id: snap.id,
        });
        continue;
      }
      if (r.ms > SLOW_THRESHOLD_MS) {
        alertas.push({
          tipo: "slow",
          severity: "warn",
          url: r.url,
          response_ms: r.ms,
          status_code: r.status,
          message: `Resposta lenta: ${r.ms}ms (limite ${SLOW_THRESHOLD_MS}ms)`,
          snapshot_id: snap.id,
        });
      }
      // Regressão: 2x mais lento que último snapshot
      const prevR = prevMap.get(r.url);
      if (prevR?.ok && prevR.ms > 0 && r.ms > prevR.ms * 2 && r.ms > 1500) {
        alertas.push({
          tipo: "slow",
          severity: "warn",
          url: r.url,
          response_ms: r.ms,
          status_code: r.status,
          message: `Regressão de performance: ${r.ms}ms (antes ${prevR.ms}ms)`,
          metadata: { previous_ms: prevR.ms },
          snapshot_id: snap.id,
        });
      }
    }

    if (prev) {
      for (const u of newUrls) {
        alertas.push({
          tipo: "new_route",
          severity: "info",
          url: u,
          message: "Nova rota detectada no sitemap",
          snapshot_id: snap.id,
        });
      }
      for (const u of removedUrls) {
        alertas.push({
          tipo: "removed_route",
          severity: "warn",
          url: u,
          message: "Rota removida do sitemap desde a última verificação",
          snapshot_id: snap.id,
        });
      }
    }

    if (alertas.length) {
      const { error: alertErr } = await supabase.from("seo_monitor_alertas").insert(alertas);
      if (alertErr) console.error("alertas insert error", alertErr);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        snapshot_id: snap.id,
        total: results.length,
        ok_count: okCount,
        error_count: errorCount,
        avg_ms: avgMs,
        p95_ms: p95Ms,
        new_urls: newUrls.length,
        removed_urls: removedUrls.length,
        alertas_criados: alertas.length,
        duration_ms: Date.now() - started,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("seo-monitor error", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
