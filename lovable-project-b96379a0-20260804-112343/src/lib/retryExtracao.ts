/**
 * Retentativas com backoff exponencial para chamadas de extração.
 * Retorna após sucesso ou quando o erro NÃO é transitório.
 *
 * Transitórios: 429 (rate-limit), 502/503/504 (upstream), erros de rede.
 * Não-transitórios (não reexecuta): 400/401/402/403/404/422 e afins.
 *
 * Como a edge function agora devolve HTTP 200 com `error_code` para erros
 * de negócio, também tratamos `data.error_code` como sinal transitório
 * quando for `rate_limit` ou `upstream_error`.
 */

type InvokeResult = { data: any; error: any };
type InvokeFn = () => Promise<InvokeResult>;

const TRANSIENT_CODES = new Set(["rate_limit", "upstream_error", "timeout"]);
const TRANSIENT_HTTP = new Set([429, 502, 503, 504]);

function getStatus(err: any): number | undefined {
  if (!err) return undefined;
  return (
    err.status ??
    err.context?.status ??
    err.context?.response?.status ??
    err.response?.status
  );
}

function isNetworkError(err: any): boolean {
  if (!err) return false;
  const msg = String(err.message || err).toLowerCase();
  return (
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("network request failed") ||
    msg.includes("load failed") ||
    msg.includes("timeout") ||
    msg.includes("timed out")
  );
}

export function isTransient(result: InvokeResult): boolean {
  const { data, error } = result;
  if (error) {
    const status = getStatus(error);
    if (status && TRANSIENT_HTTP.has(status)) return true;
    if (isNetworkError(error)) return true;
    // supabase-js retorna FunctionsHttpError sem status confiável às vezes:
    // se a mensagem contiver "non-2xx" e não temos como distinguir, NÃO retenta
    // (a edge agora usa 200 para erros de negócio, então non-2xx = falha real).
    return false;
  }
  if (data?.error_code && TRANSIENT_CODES.has(String(data.error_code))) return true;
  return false;
}

export interface RetryOptions {
  maxAttempts?: number;      // total de tentativas (default 4)
  baseDelayMs?: number;      // delay inicial (default 800ms)
  maxDelayMs?: number;       // teto do delay (default 8000ms)
  onRetry?: (info: { attempt: number; delayMs: number; result: InvokeResult }) => void;
  signal?: AbortSignal;
}

export async function invokeWithRetry(
  invoke: InvokeFn,
  opts: RetryOptions = {},
): Promise<InvokeResult> {
  const maxAttempts = opts.maxAttempts ?? 4;
  const baseDelay = opts.baseDelayMs ?? 800;
  const maxDelay = opts.maxDelayMs ?? 8000;

  let last: InvokeResult = { data: null, error: null };
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (opts.signal?.aborted) break;
    last = await invoke();
    if (!isTransient(last)) return last;
    if (attempt === maxAttempts) break;

    const jitter = Math.random() * 250;
    const delayMs = Math.min(maxDelay, baseDelay * 2 ** (attempt - 1)) + jitter;
    opts.onRetry?.({ attempt, delayMs, result: last });
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return last;
}
