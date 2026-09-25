// Post-deploy audit workflow
// - Corre uma auditoria completa (Lighthouse via PSI) para as rotas informadas
// - Compara com o baseline (última auditoria OK anterior) por (path, strategy)
// - Detecta regressões em Core Web Vitals e scores
// - Persiste um "run" em post_deploy_audit_runs e as ações recomendadas em
//   post_deploy_audit_actions (auto-fix quando aplicável, manual caso contrário).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const BASE_URL = "https://radarimobtech.shop";
const PSI_ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

// Limites de excelência (podem ser sobrescritos por lighthouse_config)
const DEFAULT_THRESHOLDS = {
  min_performance: 90,
  min_seo: 95,
  min_accessibility: 90,
  min_best_practices: 90,
  max_lcp_ms: 2500,
  max_cls: 0.1,
  max_tbt_ms: 200,
  max_inp_ms: 200,
  max_fcp_ms: 1800,
  max_si_ms: 3400,
  regression_delta_score: 5, // queda mínima de score para considerar regressão
  regression_delta_pct: 0.15, // ou 15% pior em métrica de tempo
};

type Strategy = "mobile" | "desktop";

interface AuditRow {
  id?: string;
  url: string;
  path: string;
  strategy: Strategy;
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

interface Action {
  path: string;
  strategy: Strategy;
  metric: string;
  severity: "info" | "warn" | "critical";
  previous_value: number | null;
  current_value: number | null;
  delta: number | null;
  threshold: number | null;
  probable_cause: string;
  recommendation: string;
  category: "image" | "javascript" | "css" | "fonts" | "cache" | "cdn" | "html" | "seo" | "other";
  auto_fixable: boolean;
}

function pctToScore(v: number | undefined | null): number | null {
  if (v === null || v === undefined) return null;
  return Math.round(v * 100);
}
function numOr(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.round(v);
  return null;
}

async function runPsi(url: string, strategy: Strategy, path: string): Promise<AuditRow> {
  const t0 = Date.now();
  const qs = new URLSearchParams({ url, strategy, category: "performance" });
  ["seo", "accessibility", "best-practices"].forEach((c) => qs.append("category", c));
  try {
    const res = await fetch(`${PSI_ENDPOINT}?${qs.toString()}`);
    const duration = Date.now() - t0;
    if (!res.ok) {
      const body = await res.text();
      return blankRow(url, path, strategy, duration, `PSI ${res.status}: ${body.slice(0, 200)}`);
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
      pwa_score: null,
      lcp_ms: numOr(audits["largest-contentful-paint"]?.numericValue),
      fcp_ms: numOr(audits["first-contentful-paint"]?.numericValue),
      cls: typeof audits["cumulative-layout-shift"]?.numericValue === "number"
        ? Number(audits["cumulative-layout-shift"].numericValue.toFixed(3))
        : null,
      tbt_ms: numOr(audits["total-blocking-time"]?.numericValue),
      tti_ms: numOr(audits["interactive"]?.numericValue),
      speed_index_ms: numOr(audits["speed-index"]?.numericValue),
      status: "ok",
      error_message: null,
      duration_ms: duration,
      raw: { finalUrl: json?.lighthouseResult?.finalUrl },
    };
  } catch (err) {
    return blankRow(url, path, strategy, Date.now() - t0, (err as Error).message);
  }
}

function blankRow(url: string, path: string, strategy: Strategy, duration: number, err: string): AuditRow {
  return {
    url, path, strategy,
    performance_score: null, seo_score: null, accessibility_score: null,
    best_practices_score: null, pwa_score: null,
    lcp_ms: null, fcp_ms: null, cls: null, tbt_ms: null, tti_ms: null, speed_index_ms: null,
    status: "error", error_message: err, duration_ms: duration, raw: null,
  };
}

function compareAndBuildActions(current: AuditRow, previous: AuditRow | null, t: typeof DEFAULT_THRESHOLDS): Action[] {
  if (current.status !== "ok") return [];
  const actions: Action[] = [];

  // ---- Score-based regressions (comparar com baseline anterior) ----
  const scoreChecks: Array<{
    metric: string; cur: number | null; prev: number | null; min: number;
    cat: Action["category"]; auto: boolean; cause: string; rec: string;
  }> = [
    {
      metric: "performance", cur: current.performance_score, prev: previous?.performance_score ?? null,
      min: t.min_performance, cat: "javascript", auto: false,
      cause: "Aumento no peso de JS/CSS ou LCP mais lento após a publicação.",
      rec: "Auditar bundle (npm run build --report), aplicar code-splitting, remover libs não usadas, revisar dependências pesadas adicionadas nesta release.",
    },
    {
      metric: "seo", cur: current.seo_score, prev: previous?.seo_score ?? null,
      min: t.min_seo, cat: "seo", auto: true,
      cause: "Meta tags, canonical, viewport, robots ou títulos regridiram nesta rota.",
      rec: "Rodar corretor automático de SEO (título/description/canonical/og) via componente <Seo /> e conferir Helmet da rota.",
    },
    {
      metric: "accessibility", cur: current.accessibility_score, prev: previous?.accessibility_score ?? null,
      min: t.min_accessibility, cat: "html", auto: false,
      cause: "Contraste, labels de formulário ou landmarks ARIA foram alterados.",
      rec: "Revisar componentes recém-adicionados: labels, alt em imagens, contraste de texto e foco visível.",
    },
    {
      metric: "best_practices", cur: current.best_practices_score, prev: previous?.best_practices_score ?? null,
      min: t.min_best_practices, cat: "html", auto: false,
      cause: "Console errors, libs deprecated, uso de http em recursos, ou permissões inseguras.",
      rec: "Abrir DevTools → Console + Issues nesta rota e resolver warnings; garantir HTTPS em todos os assets.",
    },
  ];

  for (const c of scoreChecks) {
    if (c.cur === null) continue;
    const belowThreshold = c.cur < c.min;
    const regressed = c.prev !== null && (c.prev - c.cur) >= t.regression_delta_score;
    if (!belowThreshold && !regressed) continue;

    const severity: Action["severity"] = c.cur < c.min - 15 ? "critical" : regressed ? "warn" : "info";
    actions.push({
      path: current.path, strategy: current.strategy, metric: c.metric,
      severity,
      previous_value: c.prev,
      current_value: c.cur,
      delta: c.prev !== null ? c.cur - c.prev : null,
      threshold: c.min,
      probable_cause: c.cause,
      recommendation: c.rec,
      category: c.cat,
      auto_fixable: c.auto,
    });
  }

  // ---- Core Web Vitals ----
  // LCP
  if (current.lcp_ms !== null) {
    const prev = previous?.lcp_ms ?? null;
    const regressed = prev !== null && current.lcp_ms > prev * (1 + t.regression_delta_pct);
    if (current.lcp_ms > t.max_lcp_ms || regressed) {
      actions.push({
        path: current.path, strategy: current.strategy, metric: "lcp_ms",
        severity: current.lcp_ms > t.max_lcp_ms * 1.6 ? "critical" : "warn",
        previous_value: prev, current_value: current.lcp_ms,
        delta: prev !== null ? current.lcp_ms - prev : null,
        threshold: t.max_lcp_ms,
        probable_cause: "Imagem hero pesada, fontes bloqueantes ou LCP element atrasado por JS.",
        recommendation: "Aplicar lazy-loading em imagens fora do viewport, preload da imagem LCP, converter para AVIF/WebP via vite-imagetools e revisar fontes (font-display: swap).",
        category: "image", auto_fixable: true,
      });
    }
  }

  // CLS
  if (current.cls !== null) {
    const prev = previous?.cls ?? null;
    const regressed = prev !== null && current.cls > prev + 0.05;
    if (current.cls > t.max_cls || regressed) {
      actions.push({
        path: current.path, strategy: current.strategy, metric: "cls",
        severity: current.cls > t.max_cls * 2 ? "critical" : "warn",
        previous_value: prev, current_value: current.cls,
        delta: prev !== null ? Number((current.cls - prev).toFixed(3)) : null,
        threshold: t.max_cls,
        probable_cause: "Imagens/embeds sem width/height, banners injetados após render ou fontes com FOUT.",
        recommendation: "Definir width/height explícitos em <img>, reservar espaço para banners e adotar font-display: optional/swap com preload das fontes principais.",
        category: "html", auto_fixable: false,
      });
    }
  }

  // TBT (proxy de INP)
  if (current.tbt_ms !== null) {
    const prev = previous?.tbt_ms ?? null;
    const regressed = prev !== null && current.tbt_ms > prev * (1 + t.regression_delta_pct);
    if (current.tbt_ms > t.max_tbt_ms || regressed) {
      actions.push({
        path: current.path, strategy: current.strategy, metric: "tbt_ms",
        severity: current.tbt_ms > t.max_tbt_ms * 2 ? "critical" : "warn",
        previous_value: prev, current_value: current.tbt_ms,
        delta: prev !== null ? current.tbt_ms - prev : null,
        threshold: t.max_tbt_ms,
        probable_cause: "Long tasks de JS no thread principal (bibliotecas pesadas ou hidratação lenta).",
        recommendation: "Aplicar code-splitting por rota, mover libs pesadas para dynamic import(), memoizar componentes e usar React.lazy nos painéis do dashboard.",
        category: "javascript", auto_fixable: false,
      });
    }
  }

  // FCP
  if (current.fcp_ms !== null && current.fcp_ms > t.max_fcp_ms) {
    actions.push({
      path: current.path, strategy: current.strategy, metric: "fcp_ms",
      severity: "warn",
      previous_value: previous?.fcp_ms ?? null,
      current_value: current.fcp_ms,
      delta: previous?.fcp_ms ? current.fcp_ms - previous.fcp_ms : null,
      threshold: t.max_fcp_ms,
      probable_cause: "TTFB alto, CSS bloqueante ou fontes remotas sem preconnect.",
      recommendation: "Habilitar cache CDN (Cache-Control: public, max-age=31536000, immutable) para assets estáticos e adicionar <link rel=preconnect> para origens de fontes.",
      category: "cache", auto_fixable: true,
    });
  }

  // Speed Index
  if (current.speed_index_ms !== null && current.speed_index_ms > t.max_si_ms) {
    actions.push({
      path: current.path, strategy: current.strategy, metric: "speed_index_ms",
      severity: "info",
      previous_value: previous?.speed_index_ms ?? null,
      current_value: current.speed_index_ms,
      delta: previous?.speed_index_ms ? current.speed_index_ms - previous.speed_index_ms : null,
      threshold: t.max_si_ms,
      probable_cause: "Pintura visual progressiva atrasada por CSS/JS pesados acima da dobra.",
      recommendation: "Inlinar CSS crítico da rota, adiar JS não essencial (defer/async) e priorizar recursos above-the-fold.",
      category: "css", auto_fixable: false,
    });
  }

  return actions;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let paths: string[] = ["/"];
  let strategies: Strategy[] = ["mobile"];
  let releaseTag: string | null = null;
  let triggerSource: string = "manual";
  let triggeredBy: string | null = null;

  try {
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (Array.isArray(body?.paths) && body.paths.length > 0) {
        paths = body.paths.filter((p: unknown): p is string => typeof p === "string" && p.startsWith("/")).slice(0, 20);
      }
      if (Array.isArray(body?.strategies)) {
        const s = body.strategies.filter((x: unknown): x is Strategy => x === "mobile" || x === "desktop");
        if (s.length) strategies = s;
      }
      if (typeof body?.release_tag === "string") releaseTag = body.release_tag.slice(0, 100);
      if (typeof body?.trigger_source === "string") triggerSource = body.trigger_source;
      if (typeof body?.triggered_by === "string" && /^[0-9a-f-]{36}$/i.test(body.triggered_by)) triggeredBy = body.triggered_by;
    }
  } catch { /* ignore */ }

  // Criar run em estado "running"
  const { data: runData, error: runErr } = await supabase
    .from("post_deploy_audit_runs")
    .insert({
      trigger_source: triggerSource,
      release_tag: releaseTag,
      triggered_by: triggeredBy,
      paths, strategies,
      total_routes: paths.length * strategies.length,
      status: "running",
    })
    .select("id")
    .single();
  if (runErr || !runData) {
    return new Response(JSON.stringify({ error: runErr?.message ?? "failed to create run" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const runId = runData.id as string;
  const t0 = Date.now();

  const rows: AuditRow[] = [];
  for (const p of paths) {
    const url = `${BASE_URL}${p}`;
    for (const s of strategies) rows.push(await runPsi(url, s, p));
  }

  // Persistir auditorias em lighthouse_audits (reaproveita infra existente)
  const { data: insertedAudits, error: audErr } = await supabase
    .from("lighthouse_audits")
    .insert(rows.map((r) => ({ ...r, raw: r.raw ?? null })))
    .select("id,path,strategy,created_at");

  if (audErr) {
    await supabase.from("post_deploy_audit_runs").update({
      status: "failed", error_message: audErr.message, completed_at: new Date().toISOString(),
      duration_ms: Date.now() - t0,
    }).eq("id", runId);
    return new Response(JSON.stringify({ error: audErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const auditIds = (insertedAudits ?? []).map((a) => a.id as string);

  // Buscar baselines (auditoria OK anterior por path+strategy)
  const baselines = new Map<string, AuditRow>();
  for (const p of paths) {
    for (const s of strategies) {
      const { data: prev } = await supabase
        .from("lighthouse_audits")
        .select("*")
        .eq("path", p).eq("strategy", s).eq("status", "ok")
        .not("id", "in", `(${auditIds.map((x) => `"${x}"`).join(",") || `"00000000-0000-0000-0000-000000000000"`})`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (prev) baselines.set(`${p}::${s}`, prev as unknown as AuditRow);
    }
  }

  // Construir ações a partir das regressões / limites de excelência
  const allActions: Action[] = [];
  for (const cur of rows) {
    const prev = baselines.get(`${cur.path}::${cur.strategy}`) ?? null;
    allActions.push(...compareAndBuildActions(cur, prev, DEFAULT_THRESHOLDS));
  }

  if (allActions.length > 0) {
    const { error: actErr } = await supabase.from("post_deploy_audit_actions").insert(
      allActions.map((a) => ({ ...a, run_id: runId })),
    );
    if (actErr) console.error("failed inserting actions:", actErr);
  }

  const okRows = rows.filter((r) => r.status === "ok");
  const avg = (arr: (number | null)[]) => {
    const v = arr.filter((x): x is number => x !== null);
    return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
  };
  const avgCls = (() => {
    const v = okRows.map((r) => r.cls).filter((x): x is number => x !== null);
    if (!v.length) return null;
    return Number((v.reduce((a, b) => a + b, 0) / v.length).toFixed(3));
  })();

  const summary = {
    total_actions: allActions.length,
    critical: allActions.filter((a) => a.severity === "critical").length,
    warn: allActions.filter((a) => a.severity === "warn").length,
    info: allActions.filter((a) => a.severity === "info").length,
    auto_fixable: allActions.filter((a) => a.auto_fixable).length,
    routes_with_regression: new Set(allActions.map((a) => a.path)).size,
    baseline_available: baselines.size,
  };

  await supabase.from("post_deploy_audit_runs").update({
    status: "completed",
    ok_routes: okRows.length,
    regressions_count: allActions.length,
    avg_performance: avg(okRows.map((r) => r.performance_score)),
    avg_seo: avg(okRows.map((r) => r.seo_score)),
    avg_lcp_ms: avg(okRows.map((r) => r.lcp_ms)),
    avg_cls: avgCls,
    avg_tbt_ms: avg(okRows.map((r) => r.tbt_ms)),
    audit_ids: auditIds,
    summary,
    duration_ms: Date.now() - t0,
    completed_at: new Date().toISOString(),
  }).eq("id", runId);

  return new Response(JSON.stringify({
    run_id: runId,
    summary,
    actions: allActions,
    audits: rows,
  }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
