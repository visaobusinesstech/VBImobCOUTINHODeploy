import jsPDF from "jspdf";

export type ContratoPdfTableRow = [string, string];

export function formatContratoPdfCurrency(value: number | null | undefined): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value ?? 0);
}

export function formatContratoPdfDate(value: string | null | undefined): string {
  if (!value) return "—";

  const normalized = value.includes("T") ? value : `${value}T00:00:00`;
  const parsedDate = new Date(normalized);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return parsedDate.toLocaleDateString("pt-BR");
}

export function hasContratoPdfValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

export function safeContratoPdfText(value: unknown, fallback = "—"): string {
  if (!hasContratoPdfValue(value)) return fallback;

  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : fallback;
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (Array.isArray(value)) return value.map((item) => safeContratoPdfText(item, "")).filter(Boolean).join(", ") || fallback;

  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
}

export function pushContratoPdfRow(
  rows: ContratoPdfTableRow[],
  label: string,
  value: unknown,
  options?: { allowEmpty?: boolean; fallback?: string },
) {
  if (!options?.allowEmpty && !hasContratoPdfValue(value)) return;
  rows.push([label, safeContratoPdfText(value, options?.fallback ?? "—")]);
}

export function pushContratoPdfSection(rows: ContratoPdfTableRow[], title: string) {
  rows.push([`─── ${title} ───`, ""]);
}

export function getContratoPdfLastY(doc: jsPDF, fallback: number) {
  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY;
  return typeof finalY === "number" ? finalY : fallback;
}

export function ensureContratoPdfSpace(doc: jsPDF, y: number, minHeight = 20, topMargin = 20, bottomMargin = 14) {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + minHeight <= pageHeight - bottomMargin) return y;
  doc.addPage();
  return topMargin;
}

export function addContratoPdfFooter(doc: jsPDF, brand: string, timestamp: Date) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageCount = (doc as jsPDF & { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  const issuedAt = timestamp.toLocaleDateString("pt-BR");

  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFontSize(7);
    doc.setTextColor(160, 160, 160);
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.text(`${brand} • Gerado em ${issuedAt} • Página ${page}/${pageCount}`, pageWidth / 2, pageHeight - 8, {
      align: "center",
    });
  }
}

export function sanitizeContratoPdfFilename(value: string | null | undefined, fallback = "contrato") {
  const sanitized = safeContratoPdfText(value, fallback)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .toLowerCase();

  return sanitized.slice(0, 80) || fallback;
}

export function saveContratoPdf(doc: jsPDF, filename: string) {
  try {
    doc.save(filename);
    return;
  } catch {
    if (typeof window === "undefined" || typeof document === "undefined" || typeof URL === "undefined") {
      throw new Error("Não foi possível iniciar o download do PDF neste ambiente.");
    }
  }

  const blob = doc.output("blob");
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = objectUrl;
  link.download = filename;
  link.rel = "noopener noreferrer";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}