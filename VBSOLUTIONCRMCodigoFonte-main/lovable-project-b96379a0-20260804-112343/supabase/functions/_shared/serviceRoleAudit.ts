// deno-lint-ignore-file no-explicit-any
/**
 * Helper compartilhado por edge functions que precisam usar SERVICE_ROLE.
 *
 * Objetivos:
 *  1) Centralizar a criação do client service_role (evita duplicação).
 *  2) Registrar auditoria em `security_audit_log` para TODA chamada.
 *  3) Correlacionar por tenant + usuário autenticado + correlation_id.
 *
 * NÃO importe do bundle do app (`src/integrations/supabase`). Edge functions
 * têm contexto próprio.
 */
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export interface AuditContext {
  edgeFunction: string;
  action: string;                    // ex.: 'admin.reset-password' | 'cron.expire-trials'
  actorUserId?: string | null;       // extraído do JWT do chamador, quando existir
  tenantId?: string | null;          // imobiliária alvo do recurso
  recordId?: string | null;
  correlationId?: string | null;
  requestIp?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ServiceRoleClient {
  admin: SupabaseClient;
  /** Marca o resultado da operação sensível no log. */
  audit: (result: { outcome: "allowed" | "denied" | "error"; reason?: string; metadata?: Record<string, unknown> }) => Promise<void>;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function extractActorFromRequest(req: Request): {
  actorUserId: string | null;
  ip: string | null;
  ua: string | null;
} {
  const ua = req.headers.get("user-agent");
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("cf-connecting-ip") ??
    null;

  // Best-effort: decodifica payload do JWT sem validar (validação já foi feita
  // upstream por verify_jwt=true ou pela própria function).
  let actorUserId: string | null = null;
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    try {
      const [, payload] = auth.slice(7).split(".");
      const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
      actorUserId = decoded.sub ?? null;
    } catch {
      /* ignore */
    }
  }

  return { actorUserId, ip, ua };
}

/**
 * Cria um client service_role já instrumentado.
 *
 * O log de ENTRADA é gravado imediatamente com `outcome='allowed'` (pré-execução);
 * ao terminar, chame `audit({ outcome })` para registrar o resultado real.
 * Ambos os eventos compartilham o mesmo `correlation_id`.
 */
export function createAuditedServiceRoleClient(
  req: Request,
  ctx: Omit<AuditContext, "actorUserId" | "requestIp" | "userAgent">
): ServiceRoleClient {
  const { actorUserId, ip, ua } = extractActorFromRequest(req);

  const correlationId =
    ctx.correlationId ??
    req.headers.get("x-correlation-id") ??
    crypto.randomUUID();

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const writeAudit = async (
    outcome: "allowed" | "denied" | "error",
    reason?: string,
    extra?: Record<string, unknown>,
  ) => {
    try {
      await admin.rpc("log_service_role_call", {
        _edge_function: ctx.edgeFunction,
        _action: ctx.action,
        _actor_user_id: actorUserId,
        _tenant_id: ctx.tenantId ?? null,
        _table_name: (ctx.metadata?.table as string) ?? null,
        _record_id: ctx.recordId ?? null,
        _outcome: outcome,
        _reason: reason ?? null,
        _correlation_id: correlationId,
        _request_ip: ip,
        _user_agent: ua,
        _metadata: { ...(ctx.metadata ?? {}), ...(extra ?? {}) },
      });
    } catch (err) {
      console.error("[security-audit] failed to write service_role log:", err);
    }
  };

  // Grava entrada da chamada
  writeAudit("allowed", "service_role_call:start");

  return {
    admin,
    audit: ({ outcome, reason, metadata }) =>
      writeAudit(outcome, reason ?? `service_role_call:${outcome}`, metadata),
  };
}
