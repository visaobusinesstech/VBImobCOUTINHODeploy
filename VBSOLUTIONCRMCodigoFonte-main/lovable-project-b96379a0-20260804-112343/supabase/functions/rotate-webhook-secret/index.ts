// Endpoint protegido para rotacionar segredo de webhook.
// - Requer JWT válido (Authorization: Bearer <token>).
// - Chama a RPC `rotate_webhook_secret` no contexto do usuário (RLS + auth.uid()).
// - Retorna { id, version, label, grace_period_hours, expires_at, provider }.
// - Registra a operação em `security_audit_log` via `log_service_role_call`,
//   incluindo o usuário solicitante, tenant, provider, versão nova e o
//   `request_id` correlacionado com o corpo/header retornado ao cliente.

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  adminAuditError,
  adminCorsHeaders as corsHeaders,
  adminJson,
  getRequestId,
  logAdminAudit,
  type AdminAuditContext,
} from "../_shared/adminErrors.ts";
import { invalidateWebhookSecretsCache } from "../_shared/webhookSecurity.ts";

interface RotateBody {
  provider?: string;
  new_secret?: string;
  grace_period_hours?: number;
  label?: string | null;
}

Deno.serve(async (req) => {
  const requestId = getRequestId(req);
  const correlationId = req.headers.get("x-correlation-id") ?? requestId;
  const requestIp = req.headers.get("x-forwarded-for") ?? req.headers.get("cf-connecting-ip") ?? null;
  const userAgent = req.headers.get("user-agent") ?? null;

  const ctx: AdminAuditContext = {
    edgeFunction: "rotate-webhook-secret",
    requestId,
    action: "update",
    tableName: "webhook_secrets",
    correlationId,
    requestIp,
    userAgent,
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: { ...corsHeaders, "X-Request-Id": requestId },
    });
  }
  if (req.method !== "POST") {
    return await adminAuditError(ctx, "method_not_allowed", 405);
  }

  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!authHeader?.toLowerCase().startsWith("bearer ")) {
    return await adminAuditError(ctx, "missing_authorization", 401);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const token = authHeader.slice(7).trim();
  const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
  if (claimsErr || !claims?.claims?.sub) {
    return await adminAuditError(ctx, "unauthenticated", 401);
  }
  const userId = claims.claims.sub as string;
  ctx.actorUserId = userId;
  ctx.tenantId = userId;

  let body: RotateBody;
  try {
    body = (await req.json()) as RotateBody;
  } catch {
    return await adminAuditError(ctx, "invalid_json", 400);
  }

  const provider = (body.provider ?? "").trim();
  const newSecret = (body.new_secret ?? "").trim();
  const grace = body.grace_period_hours ?? 24;
  const label = body.label?.toString().trim() || null;

  const fieldErrors: Record<string, string[]> = {};
  if (!provider || provider.length > 128) {
    fieldErrors.provider = ["obrigatório e com até 128 caracteres"];
  }
  if (!newSecret || newSecret.length < 16 || newSecret.length > 512) {
    fieldErrors.new_secret = ["deve ter entre 16 e 512 caracteres"];
  }
  if (typeof grace !== "number" || !Number.isFinite(grace) || grace < 0 || grace > 24 * 30) {
    fieldErrors.grace_period_hours = ["deve ser um número entre 0 e 720"];
  }
  if (Object.keys(fieldErrors).length > 0) {
    ctx.extraMetadata = { provider: provider || null };
    return await adminAuditError(ctx, "invalid_params", 400, {
      fieldErrors,
      formErrors: [],
    });
  }
  ctx.extraMetadata = { provider, grace_period_hours: grace, has_label: !!label };

  const { data: rpcData, error: rpcErr } = await userClient.rpc("rotate_webhook_secret", {
    _provider: provider,
    _new_secret: newSecret,
    _grace_period_hours: grace,
    _label: label,
  });

  if (rpcErr) {
    return await adminAuditError(ctx, "rotation_failed", 400, {
      reason: rpcErr.message,
      correlation_id: correlationId,
    });
  }

  const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
  const newId = row?.new_id ?? null;
  const newVersion = row?.new_version ?? null;
  const previousExpiresAt = row?.previous_expires_at ?? null;

  await invalidateWebhookSecretsCache(userId, provider);

  await logAdminAudit(
    {
      ...ctx,
      recordId: newId ? String(newId) : null,
      extraMetadata: {
        ...(ctx.extraMetadata ?? {}),
        new_version: newVersion,
        label,
        previous_expires_at: previousExpiresAt,
        requested_by: userId,
      },
    },
    "allowed",
    "webhook_secret_rotated",
  );
  // Backwards-compat: também escreve via RPC direta para preservar a linha
  // de auditoria de sucesso com _reason específico (idempotente do ponto de
  // vista do consumidor: metadata.request_id é o mesmo).

  return adminJson(
    {
      ok: true,
      provider,
      id: newId,
      version: newVersion,
      label,
      grace_period_hours: grace,
      previous_expires_at: previousExpiresAt,
      requested_by: userId,
      correlation_id: correlationId,
    },
    200,
    requestId,
  );
});
