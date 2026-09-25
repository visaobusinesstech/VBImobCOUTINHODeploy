// Endpoint admin: exclui um usuário (auth.users) e limpa recursos associados.
// Requer:
//   - Authorization: Bearer <access_token> de um usuário `is_master`;
//   - Body: { user_id: uuid } (não pode ser o próprio caller nem outro master).
//
// Respostas de erro seguem o formato padronizado admin:
//   { error_code, message, details?, request_id }
// O `request_id` retornado no corpo é também gravado em
// `security_audit_log.metadata.request_id` (via `adminAuditError`).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  adminAuditError,
  adminCorsHeaders as corsHeaders,
  adminJson,
  getRequestId,
  type AdminAuditContext,
} from "../_shared/adminErrors.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  const requestId = getRequestId(req);
  const ctx: AdminAuditContext = {
    edgeFunction: "delete-user",
    requestId,
    action: "delete",
    tableName: "auth.users",
    requestIp:
      req.headers.get("x-forwarded-for") ?? req.headers.get("cf-connecting-ip") ?? null,
    userAgent: req.headers.get("user-agent") ?? null,
  };

  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: { ...corsHeaders, "X-Request-Id": requestId },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return await adminAuditError(ctx, "missing_authorization", 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return await adminAuditError(ctx, "unauthenticated", 401);
    }
    ctx.actorUserId = userData.user.id;

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: profile } = await admin
      .from("profiles")
      .select("is_master")
      .eq("id", userData.user.id)
      .single();
    if (!profile?.is_master) {
      return await adminAuditError(ctx, "forbidden", 403);
    }

    let body: { user_id?: string };
    try {
      body = await req.json();
    } catch {
      return await adminAuditError(ctx, "invalid_json", 400);
    }
    const { user_id } = body;
    if (!user_id || !UUID_RE.test(user_id)) {
      return await adminAuditError(ctx, "invalid_params", 400, {
        fieldErrors: { user_id: ["deve ser um UUID válido"] },
      });
    }
    ctx.recordId = user_id;

    if (user_id === userData.user.id) {
      return await adminAuditError(ctx, "cannot_delete_self", 400);
    }

    const { data: target } = await admin
      .from("profiles")
      .select("is_master")
      .eq("id", user_id)
      .single();
    if (target?.is_master) {
      return await adminAuditError(ctx, "cannot_delete_master", 403);
    }

    const { error: delErr } = await admin.auth.admin.deleteUser(user_id);
    if (delErr) {
      return await adminAuditError(ctx, "delete_failed", 500, {
        reason: delErr.message,
      });
    }

    return adminJson({ success: true }, 200, requestId);
  } catch (err) {
    return await adminAuditError(ctx, "internal_error", 500, {
      reason: (err as Error).message,
    });
  }
});
