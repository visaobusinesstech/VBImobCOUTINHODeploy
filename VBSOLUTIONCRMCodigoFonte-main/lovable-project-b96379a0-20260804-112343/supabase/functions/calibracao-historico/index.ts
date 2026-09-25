// Endpoint de histórico e status das calibrações de IA.
// GET/POST /calibracao-historico
// Query/body:
//   dias?: number (janela, default 30)
//   limit?: number (default 50, max 200)
//   status?: 'success' | 'failure' | 'all' (default all)
// Retorna: { runs[], stats{}, timeline[] }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const sbUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const anonClient = createClient(sbUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await anonClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let params: Record<string, any> = {};
    if (req.method === "GET") {
      const url = new URL(req.url);
      params = Object.fromEntries(url.searchParams.entries());
    } else {
      params = await req.json().catch(() => ({}));
    }

    const dias = Math.max(1, Math.min(365, Number(params.dias) || 30));
    const limit = Math.max(1, Math.min(200, Number(params.limit) || 50));
    const statusFiltro = ["success", "failure", "partial"].includes(String(params.status))
      ? String(params.status)
      : null;

    const desde = new Date(Date.now() - dias * 86400_000).toISOString();
    const sbAdmin = createClient(sbUrl, sbKey);

    let q = sbAdmin
      .from("calibracao_filtro_ia_runs")
      .select(
        "id,nome,notas,status,erro,duracao_ms,finalizado_em,criado_em,janela_dias,threshold_ai," +
        "amostra_total,positivos_reais,positivos_preditos,precision_v,recall_v,f1_v,accuracy_v," +
        "auc,lift,latency_ms_avg,latency_ms_p95,latency_batches,modelo,provider,dataset_id"
      )
      .eq("imobiliaria_id", user.id)
      .gte("criado_em", desde)
      .order("criado_em", { ascending: false })
      .limit(limit);
    if (statusFiltro) q = q.eq("status", statusFiltro);

    const { data: runs, error } = await q;
    if (error) {
      return new Response(JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const list = runs || [];
    const success = list.filter((r) => r.status === "success");
    const failure = list.filter((r) => r.status === "failure");
    const durMs = list.map((r) => Number(r.duracao_ms) || 0).filter((n) => n > 0).sort((a, b) => a - b);
    const p = (arr: number[], q: number) =>
      arr.length ? arr[Math.min(arr.length - 1, Math.floor((q / 100) * arr.length))] : 0;
    const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

    const stats = {
      total: list.length,
      success: success.length,
      failure: failure.length,
      success_rate: list.length ? success.length / list.length : 0,
      last_run_at: list[0]?.criado_em ?? null,
      last_status: list[0]?.status ?? null,
      last_erro: failure[0]?.erro ?? null,
      duracao_ms_avg: Math.round(avg(durMs)),
      duracao_ms_p50: p(durMs, 50),
      duracao_ms_p95: p(durMs, 95),
      f1_avg: +avg(success.map((r) => Number(r.f1_v) || 0)).toFixed(4),
      precision_avg: +avg(success.map((r) => Number(r.precision_v) || 0)).toFixed(4),
      recall_avg: +avg(success.map((r) => Number(r.recall_v) || 0)).toFixed(4),
      auc_avg: +avg(success.map((r) => Number(r.auc) || 0)).toFixed(4),
      amostra_total: success.reduce((a, r) => a + (Number(r.amostra_total) || 0), 0),
    };

    // Timeline agregada por dia (para sparkline)
    const buckets = new Map<string, { dia: string; total: number; success: number; failure: number; f1: number[] }>();
    for (const r of list) {
      const dia = String(r.criado_em).slice(0, 10);
      const b = buckets.get(dia) ?? { dia, total: 0, success: 0, failure: 0, f1: [] };
      b.total++;
      if (r.status === "success") b.success++;
      if (r.status === "failure") b.failure++;
      if (r.f1_v != null) b.f1.push(Number(r.f1_v));
      buckets.set(dia, b);
    }
    const timeline = Array.from(buckets.values())
      .map((b) => ({
        dia: b.dia,
        total: b.total,
        success: b.success,
        failure: b.failure,
        f1_avg: b.f1.length ? +avg(b.f1).toFixed(4) : null,
      }))
      .sort((a, b) => a.dia.localeCompare(b.dia));

    // Falhas estruturadas (últimas + agregação por fingerprint)
    const { data: falhasRaw } = await sbAdmin
      .from("calibracao_falhas_log")
      .select("id,run_id,fingerprint,erro,stack,http_status,duracao_ms,payload,query_context,ai_provider,ai_modelo,ocorrencias_24h,notificado,criado_em")
      .eq("imobiliaria_id", user.id)
      .gte("criado_em", desde)
      .order("criado_em", { ascending: false })
      .limit(100);
    const falhas = falhasRaw || [];
    const fpMap = new Map<string, { fingerprint: string; ocorrencias: number; ultimo_erro: string; ultimo_em: string; notificado: boolean }>();
    for (const f of falhas) {
      const cur = fpMap.get(f.fingerprint) ?? {
        fingerprint: f.fingerprint, ocorrencias: 0, ultimo_erro: f.erro, ultimo_em: f.criado_em, notificado: !!f.notificado,
      };
      cur.ocorrencias++;
      if (f.criado_em > cur.ultimo_em) { cur.ultimo_em = f.criado_em; cur.ultimo_erro = f.erro; cur.notificado = !!f.notificado; }
      fpMap.set(f.fingerprint, cur);
    }
    const recorrencias = Array.from(fpMap.values())
      .sort((a, b) => b.ocorrencias - a.ocorrencias)
      .slice(0, 10);

    return new Response(JSON.stringify({ runs: list, stats, timeline, falhas, recorrencias, dias, limit }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("calibracao-historico error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message || "Erro" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
