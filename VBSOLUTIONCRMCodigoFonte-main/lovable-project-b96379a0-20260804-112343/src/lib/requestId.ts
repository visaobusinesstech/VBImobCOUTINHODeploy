/**
 * Gera um request_id único e o propaga via header `x-request-id` nas
 * chamadas a edge functions. A edge function ecoa o mesmo id em seus logs
 * estruturados, permitindo correlacionar uma ação do usuário no navegador
 * com a entrada correspondente em `edge_function_logs`.
 */
export function newRequestId(prefix = "req"): string {
  const rnd =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${rnd}`;
}

/**
 * Extrai o `x-request-id` da resposta da edge function. O Supabase Functions
 * SDK não retorna headers diretamente em `invoke()`, então este helper aceita
 * tanto um objeto `Headers` quanto o `response` cru de `fetch`. Volta para o
 * id local enviado se o servidor não retornou nada.
 */
export function readRequestId(
  source: Headers | Response | Record<string, string> | null | undefined,
  fallback: string,
): string {
  if (!source) return fallback;
  try {
    if (source instanceof Response) return source.headers.get("x-request-id") || fallback;
    if (source instanceof Headers) return source.get("x-request-id") || fallback;
    const lower = Object.fromEntries(
      Object.entries(source).map(([k, v]) => [k.toLowerCase(), v]),
    );
    return (lower["x-request-id"] as string) || fallback;
  } catch {
    return fallback;
  }
}

/**
 * Log estruturado no console do navegador com o mesmo formato dos logs
 * da edge function — facilita o cruzamento manual quando o DevTools está
 * aberto durante uma sessão de debug.
 */
export function logClientEvent(
  requestId: string,
  level: "info" | "warn" | "error",
  fn: string,
  event: string,
  fields: Record<string, unknown> = {},
) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    fn,
    request_id: requestId,
    event,
    ...fields,
  };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}
