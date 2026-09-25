// Endpoint protegido para Super Admin (is_master) consultar métricas de webhook
// agregadas por tenant/provider com filtros de período.
//
// GET/POST /admin-webhook-metrics
// Body/Query params (todos opcionais):
//   tenant_id: uuid                — filtra por imobiliária
//   provider:  string              — filtra por provider (kiwify, hotmart, etc.)
//   start:     ISO8601             — início do período (default: -7d)
//   end:       ISO8601             — fim do período (default: now)
//   group_by:  "tenant"|"provider"|"both"  (default: "both")
//   include_live: boolean          — inclui snapshot in-memory (default: true)
//
// Retorna: { period, aggregates: [...], live?: [...], request_id }

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { z } from "https://esm.sh/zod@3.23.8";
import { getWebhookMetrics } from "../_shared/webhookSecurity.ts";
import {
  ADMIN_ERROR_MESSAGES,
  adminAuditError,
  adminCorsHeaders as corsHeaders,
  adminJson as json,
  type AdminAuditContext,
} from "../_shared/adminErrors.ts";

const toInt = (v: unknown) => (typeof v === "string" ? parseInt(v, 10) : v);
const QuerySchema = z.object({
  tenant_id: z.string().uuid().optional(),
  provider: z.string().min(1).max(64).optional(),
  start: z.string().datetime().optional(),
  end: z.string().datetime().optional(),
  group_by: z.enum(["tenant", "provider", "both"]).default("both"),
  include_live: z
    .union([z.boolean(), z.enum(["true", "false", "0", "1"])])
    .transform((v) => v === true || v === "true" || v === "1")
    .default(true),
  // Paginação sobre os buckets agregados. Defaults conservadores para manter payload pequeno.
  limit: z.preprocess(toInt, z.number().int().min(1).max(500)).optional().default(100),
  offset: z.preprocess(toInt, z.number().int().min(0).max(100000)).optional().default(0),
  sort_by: z
    .enum(["validations_total", "denied", "cache_hit_rate", "validation_ms_avg", "tenant_id", "provider"])
    .optional()
    .default("validations_total"),
  sort_dir: z.enum(["asc", "desc"]).optional().default("desc"),
});

// Wrapper local que fixa o edge_function e o catálogo de mensagens ao logar.
// Sempre correlaciona a resposta de erro com uma linha em security_audit_log
// via metadata.request_id.
function errorJson(
  ctx: AdminAuditContext,
  errorCode: keyof typeof ADMIN_ERROR_MESSAGES,
  status: number,
  details?: unknown,
) {
  return adminAuditError(ctx, errorCode, status, details);
}


async function parseParams(req: Request) {
  if (req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    return QuerySchema.safeParse(body);
  }
  const url = new URL(req.url);
  const raw: Record<string, unknown> = {};
  for (const [k, v] of url.searchParams.entries()) raw[k] = v;
  return QuerySchema.safeParse(raw);
}

async function ensureMaster(supabase: SupabaseClient, accessToken: string) {
  const { data: userRes, error: userErr } = await supabase.auth.getUser(accessToken);
  if (userErr || !userRes?.user) return { ok: false as const, reason: "unauthenticated" };
  const uid = userRes.user.id;
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, is_master")
    .eq("id", uid)
    .maybeSingle();
  if (error || !profile?.is_master) return { ok: false as const, reason: "forbidden", uid };
  return { ok: true as const, uid };
}

type Row = {
  imobiliaria_id: string;
  provider: string;
  outcome: string;
  cache_hit: boolean;
  keys_loaded: number | null;
  keys_tested: number | null;
  validation_ms: number | null;
};

function aggregate(rows: Row[], groupBy: "tenant" | "provider" | "both") {
  const buckets = new Map<
    string,
    {
      tenant_id: string | null;
      provider: string | null;
      total: number;
      allowed: number;
      denied: number;
      cache_hits: number;
      cache_misses: number;
      keys_loaded_sum: number;
      keys_loaded_max: number;
      keys_tested_sum: number;
      keys_tested_max: number;
      validation_ms_sum: number;
      validation_ms_max: number;
      validation_ms_count: number;
    }
  >();

  for (const r of rows) {
    const key =
      groupBy === "tenant"
        ? `${r.imobiliaria_id}::*`
        : groupBy === "provider"
        ? `*::${r.provider}`
        : `${r.imobiliaria_id}::${r.provider}`;

    let b = buckets.get(key);
    if (!b) {
      b = {
        tenant_id: groupBy === "provider" ? null : r.imobiliaria_id,
        provider: groupBy === "tenant" ? null : r.provider,
        total: 0,
        allowed: 0,
        denied: 0,
        cache_hits: 0,
        cache_misses: 0,
        keys_loaded_sum: 0,
        keys_loaded_max: 0,
        keys_tested_sum: 0,
        keys_tested_max: 0,
        validation_ms_sum: 0,
        validation_ms_max: 0,
        validation_ms_count: 0,
      };
      buckets.set(key, b);
    }
    b.total++;
    if (r.outcome === "allowed") b.allowed++;
    else b.denied++;
    if (r.cache_hit) b.cache_hits++;
    else b.cache_misses++;
    const kl = r.keys_loaded ?? 0;
    const kt = r.keys_tested ?? 0;
    b.keys_loaded_sum += kl;
    if (kl > b.keys_loaded_max) b.keys_loaded_max = kl;
    b.keys_tested_sum += kt;
    if (kt > b.keys_tested_max) b.keys_tested_max = kt;
    if (r.validation_ms != null) {
      b.validation_ms_sum += r.validation_ms;
      if (r.validation_ms > b.validation_ms_max) b.validation_ms_max = r.validation_ms;
      b.validation_ms_count++;
    }
  }

  return Array.from(buckets.values()).map((b) => {
    const cacheTotal = b.cache_hits + b.cache_misses;
    return {
      tenant_id: b.tenant_id,
      provider: b.provider,
      validations_total: b.total,
      allowed: b.allowed,
      denied: b.denied,
      cache_hits: b.cache_hits,
      cache_misses: b.cache_misses,
      cache_hit_rate: cacheTotal > 0 ? b.cache_hits / cacheTotal : 0,
      keys_loaded_avg: b.total > 0 ? b.keys_loaded_sum / b.total : 0,
      keys_loaded_max: b.keys_loaded_max,
      keys_tested_avg: b.total > 0 ? b.keys_tested_sum / b.total : 0,
      keys_tested_max: b.keys_tested_max,
      validation_ms_avg: b.validation_ms_count > 0 ? b.validation_ms_sum / b.validation_ms_count : 0,
      validation_ms_max: b.validation_ms_max,
    };
  });
}

Deno.serve(async (req) => {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const requestIp =
    req.headers.get("x-forwarded-for") ?? req.headers.get("cf-connecting-ip") ?? null;
  const userAgent = req.headers.get("user-agent") ?? null;

  // Contexto base de auditoria — enriquecido conforme o request avança.
  const ctx: AdminAuditContext = {
    edgeFunction: "admin-webhook-metrics",
    requestId,
    action: "call",
    requestIp,
    userAgent,
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { ...corsHeaders, "X-Request-Id": requestId } });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const accessToken = authHeader.replace(/^Bearer\s+/i, "");
  if (!accessToken) return errorJson(ctx, "missing_authorization", 401);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const auth = await ensureMaster(admin, accessToken);
  if (!auth.ok) {
    ctx.actorUserId = (auth as { uid?: string }).uid ?? null;
    return errorJson(
      ctx,
      auth.reason as "unauthenticated" | "forbidden",
      auth.reason === "unauthenticated" ? 401 : 403,
    );
  }
  ctx.actorUserId = auth.uid;

  const parsed = await parseParams(req);
  if (!parsed.success) {
    return errorJson(ctx, "invalid_params", 400, parsed.error.flatten());
  }
  const { tenant_id, provider, start, end, group_by, include_live, limit, offset, sort_by, sort_dir } = parsed.data;
  ctx.tenantId = tenant_id ?? null;
  ctx.extraMetadata = { provider: provider ?? null, group_by };

  const endDate = end ? new Date(end) : new Date();
  const startDate = start ? new Date(start) : new Date(endDate.getTime() - 7 * 86400_000);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate > endDate) {
    return errorJson(ctx, "invalid_period", 400, {
      start: startDate.toISOString?.() ?? null,
      end: endDate.toISOString?.() ?? null,
    });
  }

  // Consulta em lotes para evitar payloads gigantes.
  const rows: Row[] = [];
  const BATCH = 1000;
  let from = 0;
  while (true) {
    let q = admin
      .from("webhook_metrics")
      .select("imobiliaria_id, provider, outcome, cache_hit, keys_loaded, keys_tested, validation_ms")
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString())
      .order("created_at", { ascending: true })
      .range(from, from + BATCH - 1);
    if (tenant_id) q = q.eq("imobiliaria_id", tenant_id);
    if (provider) q = q.eq("provider", provider);

    const { data, error } = await q;
    if (error) {
      return errorJson(ctx, "query_failed", 500, { reason: error.message });
    }
    const batch = (data ?? []) as Row[];
    rows.push(...batch);
    if (batch.length < BATCH) break;
    from += BATCH;
    if (from >= 50_000) break; // safety cap
  }


  const allAggregates = aggregate(rows, group_by);

  // Ordenação estável antes de paginar
  const dir = sort_dir === "asc" ? 1 : -1;
  allAggregates.sort((a, b) => {
    const av = (a as Record<string, unknown>)[sort_by] ?? 0;
    const bv = (b as Record<string, unknown>)[sort_by] ?? 0;
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
    return String(av).localeCompare(String(bv)) * dir;
  });

  const total = allAggregates.length;
  const paged = allAggregates.slice(offset, offset + limit);
  const nextOffset = offset + paged.length < total ? offset + paged.length : null;

  const payload: Record<string, unknown> = {
    period: { start: startDate.toISOString(), end: endDate.toISOString() },
    filters: { tenant_id: tenant_id ?? null, provider: provider ?? null, group_by },
    sample_size: rows.length,
    pagination: {
      limit,
      offset,
      total,
      returned: paged.length,
      next_offset: nextOffset,
      has_more: nextOffset !== null,
      sort_by,
      sort_dir,
    },
    aggregates: paged,
  };

  if (include_live) {
    const liveAll = getWebhookMetrics().filter(
      (m) => (!tenant_id || m.tenantId === tenant_id) && (!provider || m.provider === provider),
    );
    payload.live = liveAll.slice(0, Math.min(limit, 200));
    payload.live_total = liveAll.length;
  }

  await admin.rpc("log_service_role_call", {
    _edge_function: "admin-webhook-metrics",
    _action: "call",
    _actor_user_id: auth.uid,
    _tenant_id: tenant_id ?? null,
    _outcome: "allowed",
    _correlation_id: null,
    _metadata: {
      request_id: requestId,
      provider: provider ?? null,
      group_by,
      period_start: startDate.toISOString(),
      period_end: endDate.toISOString(),
      sample_size: rows.length,
      total_buckets: total,
      limit,
      offset,
    },
  });


  return json(payload, 200, requestId);
});
