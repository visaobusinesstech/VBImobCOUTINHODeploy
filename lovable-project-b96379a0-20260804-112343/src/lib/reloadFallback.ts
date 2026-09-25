/**
 * Tela de fallback quando o carregamento de módulos falha repetidamente.
 * Renderizada diretamente via DOM (sem React) para funcionar mesmo quando
 * o bundle principal ou chunks essenciais não carregaram.
 */
const FALLBACK_ID = "lovable-reload-fallback";
const CLEANUP_DISABLED_FLAG = "lovable:disable-sw-cleanup";
const FAIL_COUNT_KEY = "lovable:chunk-fail-count";
const RELOAD_TS_KEY = "lovable:chunk-reload:global";

export interface ReloadFallbackOptions {
  requestId: string;
  message?: string;
  reason?: string;
  failures?: number;
  lastReloadAt?: number | null;
  onRetry?: () => void;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function readCleanupDisabled(): boolean {
  try {
    return localStorage.getItem(CLEANUP_DISABLED_FLAG) === "1";
  } catch {
    return false;
  }
}

export function showReloadFallback({
  requestId,
  message,
  reason,
  failures,
  lastReloadAt,
  onRetry,
}: ReloadFallbackOptions) {
  if (typeof document === "undefined") return;
  if (document.getElementById(FALLBACK_ID)) return; // já exibido

  const container = document.createElement("div");
  container.id = FALLBACK_ID;
  container.setAttribute("role", "alertdialog");
  container.setAttribute("aria-modal", "true");
  container.style.cssText = [
    "position:fixed",
    "inset:0",
    "z-index:2147483647",
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "background:rgba(15,23,42,0.85)",
    "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
    "padding:24px",
    "color:#0f172a",
  ].join(";");

  const card = document.createElement("div");
  card.style.cssText = [
    "max-width:520px",
    "width:100%",
    "background:#ffffff",
    "border-radius:16px",
    "padding:32px",
    "box-shadow:0 20px 60px rgba(0,0,0,0.35)",
    "text-align:left",
  ].join(";");

  const cleanupDisabled = readCleanupDisabled();
  const lastReloadLabel =
    lastReloadAt && lastReloadAt > 0
      ? new Date(lastReloadAt).toLocaleTimeString("pt-BR")
      : "—";
  const failuresLabel = typeof failures === "number" ? String(failures) : "—";
  const reasonLabel = reason ? escapeHtml(reason) : "Falha repetida ao carregar módulos dinâmicos";

  const rowStyle =
    "display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:12px;";
  const labelStyle = "color:#64748b;";
  const valueStyle =
    "color:#0f172a;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;text-align:right;word-break:break-all;";

  const cleanupBadge = cleanupDisabled
    ? `<span style="display:inline-block;background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;">DESATIVADA</span>`
    : `<span style="display:inline-block;background:#dcfce7;color:#166534;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;">ATIVA</span>`;

  card.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
      <div style="width:40px;height:40px;border-radius:50%;background:#fef2f2;display:flex;align-items:center;justify-content:center;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      </div>
      <h2 style="margin:0;font-size:18px;font-weight:600;">Não foi possível carregar</h2>
    </div>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#334155;">
      ${escapeHtml(message ?? "Detectamos falhas repetidas ao carregar recursos da aplicação. Verifique sua conexão e tente novamente.")}
    </p>

    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;margin-bottom:16px;">
      <div style="${rowStyle}">
        <span style="${labelStyle}">Motivo</span>
        <span style="${valueStyle}">${reasonLabel}</span>
      </div>
      <div style="${rowStyle}">
        <span style="${labelStyle}">Request ID</span>
        <span style="${valueStyle}">${escapeHtml(requestId)}</span>
      </div>
      <div style="${rowStyle}">
        <span style="${labelStyle}">Tentativas de reload</span>
        <span style="${valueStyle}">${failuresLabel}</span>
      </div>
      <div style="${rowStyle}">
        <span style="${labelStyle}">Último reload</span>
        <span style="${valueStyle}">${lastReloadLabel}</span>
      </div>
      <div style="display:flex;justify-content:space-between;gap:12px;padding:6px 0 0;font-size:12px;">
        <span style="${labelStyle}">Limpeza SW/cache</span>
        <span>${cleanupBadge}</span>
      </div>
    </div>

    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <button id="${FALLBACK_ID}-retry" style="flex:1;min-width:140px;background:#0f172a;color:#fff;border:none;padding:12px 16px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;">
        Tentar novamente
      </button>
      <button id="${FALLBACK_ID}-reload" style="flex:1;min-width:140px;background:#f1f5f9;color:#0f172a;border:none;padding:12px 16px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;">
        Recarregar página
      </button>
      ${
        cleanupDisabled
          ? `<button id="${FALLBACK_ID}-reenable" style="flex:1 1 100%;min-width:140px;background:#fef3c7;color:#92400e;border:1px solid #fcd34d;padding:12px 16px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;">
              Reativar limpeza automática de SW/cache
            </button>`
          : ""
      }
    </div>
  `;

  container.appendChild(card);
  document.body.appendChild(container);

  const dismiss = () => {
    container.remove();
  };

  document.getElementById(`${FALLBACK_ID}-retry`)?.addEventListener("click", () => {
    dismiss();
    onRetry?.();
  });

  document.getElementById(`${FALLBACK_ID}-reload`)?.addEventListener("click", () => {
    try {
      sessionStorage.removeItem(RELOAD_TS_KEY);
      sessionStorage.removeItem(FAIL_COUNT_KEY);
    } catch {}
    window.location.reload();
  });

  document.getElementById(`${FALLBACK_ID}-reenable`)?.addEventListener("click", () => {
    try {
      localStorage.removeItem(CLEANUP_DISABLED_FLAG);
      // força re-execução da limpeza no próximo boot
      localStorage.removeItem("lovable:sw-cache-cleanup:v1");
      sessionStorage.removeItem(RELOAD_TS_KEY);
      sessionStorage.removeItem(FAIL_COUNT_KEY);
    } catch {}
    window.location.reload();
  });
}

export function hideReloadFallback() {
  document.getElementById(FALLBACK_ID)?.remove();
}
