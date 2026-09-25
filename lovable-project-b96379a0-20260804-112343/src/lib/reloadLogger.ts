/**
 * Logger dedicado a erros que disparam recarregamento automático da SPA
 * (falhas de chunks dinâmicos, unhandled rejections críticas, etc.).
 *
 * Cada evento recebe um `request_id` estável — o mesmo id é:
 *   1. logado no console em formato JSON estruturado (para debug local),
 *   2. persistido em `sessionStorage` como buffer de pré-reload,
 *   3. enviado ao backend (`system_logs`) via `logger.error(...)`,
 *   4. reenviado após o reload para garantir entrega mesmo quando o
 *      próprio unload aborta o INSERT.
 */
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { logClientEvent, newRequestId } from "@/lib/requestId";

const BUFFER_KEY = "lovable:reload-logger:pending";
const MAX_BUFFER = 20;

export type ReloadTrigger =
  | "dynamic_import_failure"
  | "dynamic_import_failure_rejection"
  | "manual_reload"
  | "chunk_retry_exhausted";

export interface ReloadLogPayload {
  trigger: ReloadTrigger;
  message: string;
  stackTrace?: string;
  filename?: string;
  lineno?: number;
  colno?: number;
  extra?: Record<string, unknown>;
}

interface BufferedEntry extends ReloadLogPayload {
  request_id: string;
  ts: string;
  url: string;
  userAgent: string;
  willReload: boolean;
}

function readBuffer(): BufferedEntry[] {
  try {
    const raw = sessionStorage.getItem(BUFFER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeBuffer(entries: BufferedEntry[]) {
  try {
    sessionStorage.setItem(BUFFER_KEY, JSON.stringify(entries.slice(-MAX_BUFFER)));
  } catch {
    // sessionStorage cheio/negado — nada a fazer
  }
}

function clearBufferEntry(requestId: string) {
  writeBuffer(readBuffer().filter((e) => e.request_id !== requestId));
}

async function sendToBackend(entry: BufferedEntry) {
  try {
    const { data } = await supabase.auth.getUser();
    await logger.error({
      module: "ReloadLogger",
      action: entry.trigger,
      message: entry.message,
      stackTrace: entry.stackTrace,
      userId: data.user?.id,
      correlationId: entry.request_id,
      metadata: {
        request_id: entry.request_id,
        filename: entry.filename,
        lineno: entry.lineno,
        colno: entry.colno,
        url: entry.url,
        userAgent: entry.userAgent,
        willReload: entry.willReload,
        capturedAt: entry.ts,
        ...(entry.extra ?? {}),
      },
    });
    clearBufferEntry(entry.request_id);
  } catch {
    // Fica no buffer para retry no próximo boot.
  }
}

/**
 * Registra um evento de reload. Deve ser chamado ANTES de disparar
 * `window.location.reload()`. Retorna o `request_id` gerado para
 * correlação (ex.: exibir ao usuário em telas de erro).
 */
export function logReloadEvent(
  payload: ReloadLogPayload,
  options: { willReload?: boolean } = {},
): string {
  const request_id = newRequestId("reload");
  const entry: BufferedEntry = {
    ...payload,
    request_id,
    ts: new Date().toISOString(),
    url: typeof window !== "undefined" ? window.location.href : "",
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    willReload: options.willReload ?? true,
  };

  // 1) Console estruturado
  logClientEvent(request_id, "error", "reloadLogger", entry.trigger, {
    message: entry.message,
    filename: entry.filename,
    lineno: entry.lineno,
    willReload: entry.willReload,
  });

  // 2) Buffer de pré-reload (sobrevive ao unload)
  const buffer = readBuffer();
  buffer.push(entry);
  writeBuffer(buffer);

  // 3) Envio em fire-and-forget — se completar antes do reload, ótimo;
  //    caso contrário o buffer garante entrega no próximo boot.
  void sendToBackend(entry);

  return request_id;
}

/**
 * Reenvia entradas pendentes do buffer (chamar uma vez no boot).
 * Garante entrega mesmo quando o INSERT foi cortado pelo reload.
 */
export function flushPendingReloadLogs() {
  const pending = readBuffer();
  if (!pending.length) return;
  for (const entry of pending) {
    void sendToBackend(entry);
  }
}
