/**
 * Largura de coluna do Kanban.
 *
 * Desktop (>= 600px de viewport): divide o board igualmente entre as colunas
 * (comportamento antigo — etapas padrão cabem sem scroll).
 *
 * Mobile (< 600px): se a divisão ficar menor que minPx, fixa minPx e permite
 * scroll horizontal (comportamento construído para mobile).
 */
export const KANBAN_MIN_COL_PX = 260;
export const KANBAN_IDEAL_COL_PX = 280;
export const KANBAN_MOBILE_MAX_WIDTH = 600;

export function isKanbanMobileViewport(width) {
  const w =
    typeof width === "number"
      ? width
      : typeof window !== "undefined"
        ? window.innerWidth
        : 1024;
  return w < KANBAN_MOBILE_MAX_WIDTH;
}

export function calcKanbanColumnWidth(el, columnCount, options = {}) {
  const minPx = options.minPx ?? KANBAN_MIN_COL_PX;
  const fallbackPadding = options.fallbackPadding ?? 16;
  const n = Math.max(1, Number(columnCount) || 1);

  if (!el || typeof window === "undefined") {
    return minPx;
  }

  const style = window.getComputedStyle(el);
  const paddingLeft = parseFloat(style.paddingLeft || String(fallbackPadding)) || fallbackPadding;
  const paddingRight = parseFloat(style.paddingRight || String(fallbackPadding)) || fallbackPadding;
  const gap = parseFloat(style.columnGap || style.gap || "16") || 16;
  const totalGap = gap * Math.max(0, n - 1);
  const inner = el.clientWidth - paddingLeft - paddingRight - totalGap;

  if (inner <= 0) return minPx;

  const fit = Math.max(1, Math.floor(inner / n));
  const mobile = isKanbanMobileViewport(
    options.viewportWidth != null ? options.viewportWidth : window.innerWidth
  );

  // Desktop: sempre encaixa todas as colunas no viewport (como /4 e /5 antigos).
  if (!mobile) {
    return fit;
  }

  // Mobile: mínimo legível; se não cabe, scroll horizontal.
  if (fit >= minPx) return fit;
  return minPx;
}

export function kanbanNeedsHorizontalPan(el, columnCount, colPx, options = {}) {
  const fallbackPadding = options.fallbackPadding ?? 16;
  const n = Math.max(1, Number(columnCount) || 1);
  const width = Number(colPx) || KANBAN_MIN_COL_PX;
  if (!el) return false;

  const mobile = isKanbanMobileViewport(
    options.viewportWidth != null ? options.viewportWidth : window.innerWidth
  );
  // Desktop com fit igualitário não deve precisar de pan.
  if (!mobile) return false;

  const style = window.getComputedStyle(el);
  const paddingLeft = parseFloat(style.paddingLeft || String(fallbackPadding)) || fallbackPadding;
  const paddingRight = parseFloat(style.paddingRight || String(fallbackPadding)) || fallbackPadding;
  const gap = parseFloat(style.columnGap || style.gap || "16") || 16;
  const total = paddingLeft + paddingRight + n * width + gap * Math.max(0, n - 1);
  return total > el.clientWidth + 1;
}
