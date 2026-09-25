/**
 * Cliente de auditoria de segurança.
 *
 * Uso principal:
 *  - `logRlsDenied(...)`   — chame após uma mutação retornar `[]` para saber
 *                            se foi RLS silenciando ou "nada para atualizar".
 *  - `auditedUpdate(...)`  — wrapper que executa um UPDATE e loga
 *                            automaticamente se a linha alvo não foi tocada.
 *  - `auditedDelete(...)`  — idem para DELETE.
 *
 * Correlaciona por `tenant_id`, `actor_user_id` (auth.uid) e `correlation_id`.
 */
import { supabase } from "@/integrations/supabase/client";

type Action =
  | "select"
  | "insert"
  | "update"
  | "delete"
  | "upload"
  | "download"
  | "call";

export interface RlsDeniedInput {
  table: string;
  action: Action;
  recordId?: string | null;
  tenantId?: string | null;
  reason?: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}

const CORRELATION_KEY = "sec-audit-correlation";

/** ID de correlação estável por aba — permite amarrar eventos da mesma sessão UI. */
export function getCorrelationId(): string {
  try {
    let id = sessionStorage.getItem(CORRELATION_KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem(CORRELATION_KEY, id);
    }
    return id;
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

/** Registra tentativa negada por RLS. Nunca lança para não quebrar o fluxo do app. */
export async function logRlsDenied(input: RlsDeniedInput): Promise<void> {
  try {
    await supabase.rpc("log_rls_denied_attempt", {
      _table_name: input.table,
      _action: input.action,
      _record_id: input.recordId ?? null,
      _tenant_id: input.tenantId ?? null,
      _reason: input.reason ?? "silent-empty-result",
      _correlation_id: input.correlationId ?? getCorrelationId(),
      _metadata: {
        ...(input.metadata ?? {}),
        url: typeof window !== "undefined" ? window.location.pathname : null,
        ua:
          typeof navigator !== "undefined"
            ? navigator.userAgent.slice(0, 240)
            : null,
      },
    });
  } catch (err) {
    // Fail-open: auditoria não deve quebrar UX. Apenas warn.
    // eslint-disable-next-line no-console
    console.warn("[security-audit] logRlsDenied falhou:", err);
  }
}

/**
 * UPDATE auditado. Se o retorno vier vazio para uma linha que deveria existir,
 * assume denial por RLS e loga automaticamente.
 */
export async function auditedUpdate<T extends Record<string, unknown>>(
  table: string,
  recordId: string,
  patch: Partial<T>,
  opts?: { tenantId?: string; correlationId?: string }
): Promise<{ data: T | null; deniedByRls: boolean; error: unknown }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  const { data, error } = await client
    .from(table)
    .update(patch)
    .eq("id", recordId)
    .select()
    .maybeSingle();

  const deniedByRls = !error && !data;
  if (deniedByRls) {
    await logRlsDenied({
      table,
      action: "update",
      recordId,
      tenantId: opts?.tenantId,
      reason: "update returned zero rows (RLS or missing)",
      correlationId: opts?.correlationId,
      metadata: { patchKeys: Object.keys(patch) },
    });
  }

  return { data: (data ?? null) as T | null, deniedByRls, error };
}

/** DELETE auditado — análogo ao auditedUpdate. */
export async function auditedDelete(
  table: string,
  recordId: string,
  opts?: { tenantId?: string; correlationId?: string }
): Promise<{ deniedByRls: boolean; error: unknown }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  const { data, error } = await client
    .from(table)
    .delete()
    .eq("id", recordId)
    .select("id");

  const deniedByRls = !error && (!data || data.length === 0);
  if (deniedByRls) {
    await logRlsDenied({
      table,
      action: "delete",
      recordId,
      tenantId: opts?.tenantId,
      reason: "delete returned zero rows (RLS or missing)",
      correlationId: opts?.correlationId,
    });
  }

  return { deniedByRls, error };
}
