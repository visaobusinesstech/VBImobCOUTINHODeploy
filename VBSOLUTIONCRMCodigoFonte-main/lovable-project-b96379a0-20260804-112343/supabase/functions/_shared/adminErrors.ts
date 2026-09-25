// Formato de erro padronizado compartilhado entre TODOS os endpoints admin.
//
// Contrato único de resposta de erro:
//   { error_code, message, details?, request_id }
//
// - `error_code` é a chave estável (consumida por clientes e monitoramento);
// - `message`    é human-readable em pt-BR;
// - `details`    é opcional e carrega contexto (ex.: Zod flatten, motivo de
//                falha de query). É OMITIDO quando não aplicável.
// - `request_id` é injetado por `adminJson()` e ecoado no header `X-Request-Id`.
//
// TODO handler admin DEVE usar `adminAuditError()` (ou `logAdminAudit()` manual)
// em cada resposta de erro para garantir que o mesmo `request_id` retornado no
// corpo também seja gravado em `security_audit_log.metadata.request_id`.
//
// Handlers específicos estendem o catálogo com `extendAdminErrorMessages`.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";


export const adminCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-request-id",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
} as const;

// Catálogo canônico de mensagens de erro. Chaves NUNCA mudam (contrato público);
// mensagens podem ser refinadas.
export const ADMIN_ERROR_MESSAGES = {
  // Auth / autorização
  missing_authorization:
    "Authorization header ausente. Envie 'Bearer <access_token>'.",
  unauthenticated: "Access token inválido ou expirado.",
  forbidden:
    "Usuário autenticado não possui privilégio de Super Admin (is_master).",

  // Validação de request
  invalid_params: "Um ou mais parâmetros da requisição são inválidos.",
  invalid_json: "Corpo da requisição não é JSON válido.",
  invalid_input: "Entrada inválida.",
  invalid_period:
    "Período inválido: 'start' deve ser anterior a 'end' e ambos devem ser datas válidas.",
  method_not_allowed: "Método HTTP não suportado por este endpoint.",

  // Regras de negócio (admin)
  cannot_delete_self: "Você não pode excluir sua própria conta.",
  cannot_delete_master: "Não é possível excluir um usuário Master.",
  weak_password:
    "A senha é muito fraca ou foi vazada em violações conhecidas. Use uma senha mais forte e única.",

  // Falhas internas
  query_failed: "Falha ao consultar dados no banco.",
  rotation_failed: "Falha ao rotacionar segredo de webhook.",
  delete_failed: "Falha ao excluir usuário.",
  update_failed: "Falha ao atualizar recurso.",
  internal_error: "Erro interno inesperado.",
} as const;

export type AdminErrorCode = keyof typeof ADMIN_ERROR_MESSAGES | string;

export function extendAdminErrorMessages<
  T extends Record<string, string>,
>(extra: T): Record<string, string> {
  return { ...ADMIN_ERROR_MESSAGES, ...extra };
}

/** Resposta JSON padronizada com request_id ecoado no body e no header. */
export function adminJson(body: unknown, status: number, requestId: string) {
  return new Response(
    JSON.stringify({ ...(body as object), request_id: requestId }),
    {
      status,
      headers: {
        ...adminCorsHeaders,
        "Content-Type": "application/json",
        "X-Request-Id": requestId,
      },
    },
  );
}

/**
 * Constrói uma resposta de erro no shape padronizado.
 * `details` é OMITIDO quando não fornecido (undefined).
 */
export function adminErrorJson(
  errorCode: AdminErrorCode,
  status: number,
  requestId: string,
  details?: unknown,
  messages: Record<string, string> = ADMIN_ERROR_MESSAGES,
) {
  const body: Record<string, unknown> = {
    error_code: errorCode,
    message: messages[errorCode] ?? String(errorCode),
  };
  if (details !== undefined) body.details = details;
  return adminJson(body, status, requestId);
}

/** Extrai/gera o request_id a partir dos headers. */
export function getRequestId(req: Request): string {
  return req.headers.get("x-request-id") ?? crypto.randomUUID();
}

// ─────────────────────────────────────────────────────────────────────────────
// Correlação com security_audit_log
// ─────────────────────────────────────────────────────────────────────────────
//
// Todo endpoint admin DEVE registrar o `request_id` que ecoa no corpo/header
// de erro dentro de `security_audit_log.metadata.request_id`. Isso permite
// correlacionar 1:1 uma resposta de erro observada pelo cliente com a linha
// de auditoria no banco.

let cachedAuditClient: SupabaseClient | null = null;
function getAuditClient(): SupabaseClient | null {
  if (cachedAuditClient) return cachedAuditClient;
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  cachedAuditClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedAuditClient;
}

export interface AdminAuditContext {
  edgeFunction: string;
  requestId: string;
  action?: string;
  actorUserId?: string | null;
  tenantId?: string | null;
  tableName?: string | null;
  recordId?: string | null;
  correlationId?: string | null;
  requestIp?: string | null;
  userAgent?: string | null;
  extraMetadata?: Record<string, unknown>;
}

/**
 * Grava uma linha em `security_audit_log` via RPC `log_service_role_call`.
 * O `request_id` do contexto SEMPRE entra em `metadata.request_id`.
 * Fire-and-forget: falhas silenciadas para nunca mascarar o erro original.
 */
export async function logAdminAudit(
  ctx: AdminAuditContext,
  outcome: "denied" | "error" | "allowed",
  reason: string | null,
): Promise<void> {
  const client = getAuditClient();
  if (!client) return;
  try {
    await client.rpc("log_service_role_call", {
      _edge_function: ctx.edgeFunction,
      _action: ctx.action ?? "call",
      _actor_user_id: ctx.actorUserId ?? null,
      _tenant_id: ctx.tenantId ?? null,
      _table_name: ctx.tableName ?? null,
      _record_id: ctx.recordId ?? null,
      _outcome: outcome,
      _reason: reason,
      _correlation_id: ctx.correlationId ?? null,
      _request_ip: ctx.requestIp ?? null,
      _user_agent: ctx.userAgent ?? null,
      _metadata: {
        ...(ctx.extraMetadata ?? {}),
        request_id: ctx.requestId,
      },
    });
  } catch {
    /* fire-and-forget: nunca bloqueia a resposta */
  }
}

/**
 * Retorna uma resposta de erro padronizada E registra o mesmo `request_id`
 * em `security_audit_log.metadata.request_id` (fire-and-forget).
 *
 * - `outcome` é derivado do status: 5xx → "error", demais → "denied".
 * - `reason` é o próprio `error_code` (permite consultas por reason).
 * - `metadata` inclui `error_code`, `status` e o `request_id`.
 */
export async function adminAuditError(
  ctx: AdminAuditContext,
  errorCode: AdminErrorCode,
  status: number,
  details?: unknown,
  messages: Record<string, string> = ADMIN_ERROR_MESSAGES,
): Promise<Response> {
  const outcome: "denied" | "error" = status >= 500 ? "error" : "denied";
  await logAdminAudit(
    {
      ...ctx,
      extraMetadata: {
        ...(ctx.extraMetadata ?? {}),
        error_code: errorCode,
        status,
      },
    },
    outcome,
    String(errorCode),
  );
  return adminErrorJson(errorCode, status, ctx.requestId, details, messages);
}

