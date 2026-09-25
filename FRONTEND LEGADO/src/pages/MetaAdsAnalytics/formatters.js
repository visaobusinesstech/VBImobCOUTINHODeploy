export function money(value, currency = "BRL") {
  const n = Number(value);
  if (!Number.isFinite(n)) return "N/A";
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: currency || "BRL",
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `R$ ${n.toFixed(2)}`;
  }
}

export function numFmt(value, digits = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "N/A";
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: digits,
  }).format(n);
}

export function pctFmt(value, digits = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "N/A";
  return `${numFmt(n, digits)}%`;
}

export function naMoney(value, currency = "BRL") {
  if (value == null || value === "") return "N/A";
  const n = Number(value);
  if (!Number.isFinite(n)) return "N/A";
  return money(n, currency);
}

export function shortLabel(value, max = 16) {
  const s = String(value || "—");
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export function budgetReais(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n >= 1000 ? n / 100 : n;
}

export function statusLabel(status) {
  const s = String(status || "").toUpperCase();
  if (s === "ACTIVE") return "Ativa";
  if (s === "PAUSED") return "Pausada";
  if (s === "DELETED" || s === "ARCHIVED") return "Arquivada";
  return s || "—";
}
