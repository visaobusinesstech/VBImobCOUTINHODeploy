// Endpoint admin: redefine senha de um usuário via Admin API.
// Requer:
//   - Authorization: Bearer <access_token> de um usuário `is_master`;
//   - Body: { user_id: uuid, password: string (>=8, letras+números) }.
//
// Respostas de erro seguem o formato padronizado admin:
//   { error_code, message, details?, request_id }
// O `request_id` do corpo é gravado em `security_audit_log.metadata.request_id`.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";
import {
  adminAuditError,
  adminCorsHeaders as corsHeaders,
  adminJson,
  getRequestId,
  type AdminAuditContext,
} from "../_shared/adminErrors.ts";

Deno.serve(async (req) => {
  const requestId = getRequestId(req);
  const ctx: AdminAuditContext = {
    edgeFunction: "reset-user-password",
    requestId,
    action: "update",
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
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey =
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ||
      Deno.env.get("SUPABASE_ANON_KEY")!;

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user: caller },
    } = await anonClient.auth.getUser();
    if (!caller) return await adminAuditError(ctx, "unauthenticated", 401);
    ctx.actorUserId = caller.id;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: profile } = await adminClient
      .from("profiles")
      .select("is_master")
      .eq("id", caller.id)
      .single();

    if (!profile?.is_master) {
      return await adminAuditError(ctx, "forbidden", 403);
    }

    let body: { user_id?: string; password?: string };
    try {
      body = await req.json();
    } catch {
      return await adminAuditError(ctx, "invalid_json", 400);
    }
    const { user_id, password } = body;

    const fieldErrors: Record<string, string[]> = {};
    if (!user_id) fieldErrors.user_id = ["obrigatório"];
    if (!password || password.length < 8) {
      fieldErrors.password = ["deve ter no mínimo 8 caracteres"];
    } else {
      const hasLetter = /[a-zA-Z]/.test(password);
      const hasNumber = /[0-9]/.test(password);
      if (!hasLetter || !hasNumber) {
        fieldErrors.password = ["deve conter letras e números"];
      }
    }
    if (Object.keys(fieldErrors).length > 0) {
      return await adminAuditError(ctx, "invalid_params", 400, {
        fieldErrors,
        formErrors: [],
      });
    }
    ctx.recordId = user_id!;

    const { error } = await adminClient.auth.admin.updateUserById(user_id!, {
      password: password!,
    });
    if (error) {
      const leaked =
        error.message?.includes("weak") || error.message?.includes("known");
      return await adminAuditError(
        ctx,
        leaked ? "weak_password" : "update_failed",
        400,
        leaked ? undefined : { reason: error.message },
      );
    }

    return adminJson({ success: true }, 200, requestId);
  } catch (err) {
    return await adminAuditError(ctx, "internal_error", 500, {
      reason: (err as Error).message,
    });
  }
});
