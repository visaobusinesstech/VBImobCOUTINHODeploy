// Worker: processa itens da fila photo_extraction_queue com reprocessamento
// automático (backoff exponencial) para timeouts e bloqueios temporários.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Retry policy tuned to typical anti-bot cool-down windows
const BASE_DELAY_SEC = 60;          // 1min
const MAX_DELAY_SEC = 60 * 60 * 4;  // 4h
const BATCH_SIZE = 5;
const PROCESSING_STALE_MIN = 10;    // requeue rows stuck in 'processing'

type Job = {
  id: string;
  user_id: string;
  imovel_id: string | null;
  source_url: string;
  portal: string | null;
  attempts: number;
  max_attempts: number;
};

function backoffSeconds(attempt: number): number {
  // exponential w/ jitter: 60, 120, 240, 480, ... capped
  const base = Math.min(BASE_DELAY_SEC * Math.pow(2, Math.max(0, attempt - 1)), MAX_DELAY_SEC);
  const jitter = Math.floor(Math.random() * Math.min(60, base * 0.2));
  return base + jitter;
}

function classifyError(status: number | null, body: any): {
  reason: string;
  retriable: boolean;
  block_reason: string | null;
  error_code: string | null;
} {
  const msg = typeof body === "string" ? body : JSON.stringify(body ?? {});
  const lower = msg.toLowerCase();
  const code = body?.error_code ?? body?.code ?? null;
  const blockReason = body?.block_reason ?? null;

  if (code === "PORTAL_BLOCKED_TRY_MANUAL_UPLOAD" || lower.includes("captcha") || lower.includes("anti-bot") || status === 403 || status === 429)
    return { reason: "portal_blocked", retriable: true, block_reason: blockReason ?? "captcha_ou_antibot", error_code: code ?? "PORTAL_BLOCKED" };
  if (lower.includes("timeout") || lower.includes("timed out") || status === 504)
    return { reason: "timeout", retriable: true, block_reason: null, error_code: "TIMEOUT" };
  if (status && status >= 500)
    return { reason: "upstream_5xx", retriable: true, block_reason: null, error_code: `HTTP_${status}` };
  if (status === 402 || code === "IA_CHAVE_INVALIDA")
    return { reason: "config_error", retriable: false, block_reason: null, error_code: code ?? `HTTP_${status}` };

  return { reason: "unknown", retriable: false, block_reason: null, error_code: code ?? (status ? `HTTP_${status}` : "UNKNOWN") };
}

async function processJob(admin: ReturnType<typeof createClient>, job: Job) {
  const started = Date.now();
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/extrair-dados-anuncio`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SERVICE_ROLE}`,
        "x-worker-user-id": job.user_id, // extractor uses this to resolve IA config
      },
      body: JSON.stringify({ url: job.source_url, worker_job_id: job.id }),
    });

    let body: any = null;
    try { body = await res.json(); } catch { body = null; }

    const photos: string[] = Array.isArray(body?.dados?.fotos) ? body.dados.fotos : [];
    const success = res.ok && body?.success === true && photos.length > 0;

    if (success) {
      // Optionally attach to imóvel
      if (job.imovel_id) {
        try {
          const { data: img } = await admin.from("imoveis").select("fotos").eq("id", job.imovel_id).maybeSingle();
          const existing: string[] = Array.isArray(img?.fotos) ? img!.fotos as string[] : [];
          const merged = Array.from(new Set([...existing, ...photos])).slice(0, 30);
          await admin.from("imoveis").update({ fotos: merged }).eq("id", job.imovel_id);
        } catch (e) {
          console.warn(`[worker] job ${job.id} imovel update failed`, e);
        }
      }

      await admin.from("photo_extraction_queue").update({
        status: "done",
        finished_at: new Date().toISOString(),
        result: { fotos: photos, count: photos.length, elapsed_ms: Date.now() - started },
        last_error: null,
      }).eq("id", job.id);

      console.log(`[worker] job ${job.id} DONE photos=${photos.length}`);
      return { id: job.id, status: "done" };
    }

    // Failed — classify and decide retry vs. dead-letter
    const cls = classifyError(res.status, body);
    const shouldRetry = cls.retriable && job.attempts < job.max_attempts;

    if (shouldRetry) {
      const delay = backoffSeconds(job.attempts);
      const next = new Date(Date.now() + delay * 1000).toISOString();
      await admin.from("photo_extraction_queue").update({
        status: "pending",
        next_run_at: next,
        last_error: (body?.message || body?.error || cls.reason || "unknown").toString().slice(0, 500),
        last_error_code: cls.error_code,
        last_block_reason: cls.block_reason,
        started_at: null,
      }).eq("id", job.id);
      console.log(`[worker] job ${job.id} RETRY in ${delay}s (attempt=${job.attempts}/${job.max_attempts}, reason=${cls.reason})`);
      return { id: job.id, status: "retry", delay_sec: delay, reason: cls.reason };
    }

    await admin.from("photo_extraction_queue").update({
      status: "failed",
      finished_at: new Date().toISOString(),
      last_error: (body?.message || body?.error || cls.reason || "unknown").toString().slice(0, 500),
      last_error_code: cls.error_code,
      last_block_reason: cls.block_reason,
    }).eq("id", job.id);
    console.log(`[worker] job ${job.id} FAILED reason=${cls.reason} retriable=${cls.retriable}`);
    return { id: job.id, status: "failed", reason: cls.reason };

  } catch (err: any) {
    const shouldRetry = job.attempts < job.max_attempts;
    if (shouldRetry) {
      const delay = backoffSeconds(job.attempts);
      const next = new Date(Date.now() + delay * 1000).toISOString();
      await admin.from("photo_extraction_queue").update({
        status: "pending",
        next_run_at: next,
        last_error: (err?.message || String(err)).slice(0, 500),
        last_error_code: "WORKER_EXCEPTION",
        started_at: null,
      }).eq("id", job.id);
      return { id: job.id, status: "retry", delay_sec: delay, reason: "exception" };
    }
    await admin.from("photo_extraction_queue").update({
      status: "failed",
      finished_at: new Date().toISOString(),
      last_error: (err?.message || String(err)).slice(0, 500),
      last_error_code: "WORKER_EXCEPTION",
    }).eq("id", job.id);
    return { id: job.id, status: "failed", reason: "exception" };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    // Requeue stale 'processing' rows (worker crash / cold-start)
    await admin.rpc as any; // no-op reference to keep import
    const staleCutoff = new Date(Date.now() - PROCESSING_STALE_MIN * 60_000).toISOString();
    await admin.from("photo_extraction_queue")
      .update({ status: "pending", started_at: null })
      .lt("started_at", staleCutoff)
      .eq("status", "processing");

    // Claim next batch atomically
    const { data: claimed, error: claimErr } = await admin.rpc("claim_photo_extraction_jobs", { _limit: BATCH_SIZE });
    if (claimErr) throw claimErr;
    const jobs = (claimed || []) as Job[];

    if (jobs.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0, message: "empty queue" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    const results = [];
    for (const j of jobs) {
      results.push(await processJob(admin, j));
    }

    return new Response(JSON.stringify({ ok: true, processed: jobs.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
    });
  } catch (e: any) {
    console.error("[photo-extraction-worker] fatal", e);
    return new Response(JSON.stringify({ ok: false, error: e?.message || String(e) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500,
    });
  }
});
