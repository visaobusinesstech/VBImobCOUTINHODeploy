import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import { SEO_ROUTES, classifyDescription, classifyTitle } from "@/lib/seoRegistry";

interface MonitorSnapshot {
  id: string;
  total_urls: number;
  ok_count: number;
  error_count: number;
  new_urls_count: number | null;
  removed_urls_count: number | null;
  avg_ms: number | null;
  p95_ms: number | null;
  created_at: string;
}
interface MonitorAlerta {
  id: string;
  tipo: string;
  url: string;
  message: string | null;
  severity: string;
  status_code: number | null;
  response_ms: number | null;
  resolved_at: string | null;
  created_at: string;
}
interface LighthouseRow {
  id: string;
  path: string;
  strategy: string;
  performance_score: number | null;
  seo_score: number | null;
  accessibility_score: number | null;
  best_practices_score: number | null;
  lcp_ms: number | null;
  cls: number | null;
  tbt_ms: number | null;
  status: string;
  error_message: string | null;
  created_at: string;
}

export interface SeoReportData {
  generatedAt: string;
  routes: typeof SEO_ROUTES;
  sitemap: { loc: string; changefreq?: string; priority?: string }[];
  monitorSnapshots: MonitorSnapshot[];
  monitorAlertas: MonitorAlerta[];
  lighthouseLatest: LighthouseRow[];
}

export async function fetchSeoReportData(
  sitemap: { loc: string; changefreq?: string; priority?: string }[],
): Promise<SeoReportData> {
  const [{ data: snaps }, { data: alerts }, { data: lh }] = await Promise.all([
    supabase.from("seo_monitor_snapshots").select("id,total_urls,ok_count,error_count,new_urls_count,removed_urls_count,avg_ms,p95_ms,created_at").order("created_at", { ascending: false }).limit(20),
    supabase.from("seo_monitor_alertas").select("id,tipo,url,message,severity,status_code,response_ms,resolved_at,created_at").order("created_at", { ascending: false }).limit(200),
    supabase.from("lighthouse_audits").select("id,path,strategy,performance_score,seo_score,accessibility_score,best_practices_score,lcp_ms,cls,tbt_ms,status,error_message,created_at").order("created_at", { ascending: false }).limit(200),
  ]);
  const latestMap = new Map<string, LighthouseRow>();
  for (const r of (lh ?? []) as LighthouseRow[]) {
    const k = `${r.path}::${r.strategy}`;
    if (!latestMap.has(k)) latestMap.set(k, r);
  }
  return {
    generatedAt: new Date().toISOString(),
    routes: SEO_ROUTES,
    sitemap,
    monitorSnapshots: (snaps ?? []) as MonitorSnapshot[],
    monitorAlertas: (alerts ?? []) as MonitorAlerta[],
    lighthouseLatest: Array.from(latestMap.values()),
  };
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",;\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsvRows(rows: (string | number | null | undefined)[][]): string {
  return rows.map((r) => r.map(csvEscape).join(";")).join("\n");
}

export function exportSeoReportCsv(data: SeoReportData): Blob {
  const parts: string[] = [];
  parts.push(`radarimobtech — Auditoria SEO`);
  parts.push(`Gerado em;${new Date(data.generatedAt).toLocaleString("pt-BR")}`);
  parts.push("");

  parts.push("=== ROTAS & METADADOS ===");
  parts.push(toCsvRows([
    ["path", "categoria", "titulo", "titulo_status", "description", "description_status", "noindex", "dynamic", "hasJsonLd", "hasImage", "notes"],
    ...data.routes.map((r) => {
      const t = classifyTitle(r.title);
      const d = classifyDescription(r.description);
      return [
        r.path, r.category, r.title, `${t.level}:${t.msg}`,
        r.description, `${d.level}:${d.msg}`,
        r.noindex ? "sim" : "", r.dynamic ? "sim" : "",
        r.hasJsonLd ? "sim" : "", r.hasImage ? "sim" : "",
        r.notes ?? "",
      ];
    }),
  ]));
  parts.push("");

  parts.push("=== LIGHTHOUSE (últimas por rota+device) ===");
  parts.push(toCsvRows([
    ["path", "device", "performance", "seo", "accessibility", "best_practices", "lcp_ms", "cls", "tbt_ms", "status", "erro", "quando"],
    ...data.lighthouseLatest.map((r) => [
      r.path, r.strategy,
      r.performance_score, r.seo_score, r.accessibility_score, r.best_practices_score,
      r.lcp_ms, r.cls, r.tbt_ms, r.status, r.error_message ?? "",
      new Date(r.created_at).toLocaleString("pt-BR"),
    ]),
  ]));
  parts.push("");

  parts.push("=== MONITORAMENTO — SNAPSHOTS (últimos 20) ===");
  parts.push(toCsvRows([
    ["quando", "total_urls", "ok", "erros", "novas", "removidas", "latencia_media_ms", "latencia_p95_ms"],
    ...data.monitorSnapshots.map((s) => [
      new Date(s.created_at).toLocaleString("pt-BR"),
      s.total_urls, s.ok_count, s.error_count,
      s.new_urls_count, s.removed_urls_count,
      s.avg_ms, s.p95_ms,
    ]),
  ]));
  parts.push("");

  parts.push("=== ALERTAS DE MONITORAMENTO ===");
  parts.push(toCsvRows([
    ["quando", "tipo", "severidade", "url", "status_code", "response_ms", "mensagem", "resolvido"],
    ...data.monitorAlertas.map((a) => [
      new Date(a.created_at).toLocaleString("pt-BR"),
      a.tipo, a.severity, a.url, a.status_code, a.response_ms,
      a.message ?? "", a.resolved_at ? "sim" : "não",
    ]),
  ]));
  parts.push("");

  parts.push("=== SITEMAP ===");
  parts.push(toCsvRows([
    ["url", "changefreq", "priority"],
    ...data.sitemap.map((u) => [u.loc, u.changefreq ?? "", u.priority ?? ""]),
  ]));

  const csv = "\uFEFF" + parts.join("\n"); // BOM p/ Excel pt-BR
  return new Blob([csv], { type: "text/csv;charset=utf-8" });
}

export function exportSeoReportPdf(data: SeoReportData): Blob {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const now = new Date(data.generatedAt).toLocaleString("pt-BR");

  // Capa
  doc.setFontSize(20);
  doc.setTextColor(20);
  doc.text("Auditoria SEO — radarimobtech", 40, 60);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Gerado em: ${now}`, 40, 80);

  // KPIs
  const routesOk = data.routes.filter((r) => {
    const t = classifyTitle(r.title); const d = classifyDescription(r.description);
    return t.level === "ok" && d.level === "ok";
  }).length;
  const routesWarn = data.routes.length - routesOk;
  const lastSnap = data.monitorSnapshots[0];
  const alertasAbertos = data.monitorAlertas.filter((a) => !a.resolved_at).length;
  const perfAvg = (() => {
    const v = data.lighthouseLatest.map((r) => r.performance_score).filter((x): x is number => x !== null);
    return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
  })();

  autoTable(doc, {
    startY: 100,
    theme: "grid",
    styles: { fontSize: 9 },
    head: [["Métrica", "Valor"]],
    body: [
      ["Rotas registradas", String(data.routes.length)],
      ["Metadata OK", String(routesOk)],
      ["Metadata com avisos", String(routesWarn)],
      ["URLs no sitemap", String(data.sitemap.length)],
      ["Último snapshot (total/OK/erros)", lastSnap
        ? `${lastSnap.total_urls}/${lastSnap.ok_count}/${lastSnap.error_count}`
        : "—"],
      ["Latência média · p95 (último)", lastSnap
        ? `${lastSnap.avg_ms ?? "—"}ms · ${lastSnap.p95_ms ?? "—"}ms`
        : "—"],
      ["Alertas abertos", String(alertasAbertos)],
      ["Performance Lighthouse média", perfAvg !== null ? String(perfAvg) : "—"],
    ],
    headStyles: { fillColor: [30, 41, 59] },
  });

  // Rotas & metadados
  doc.addPage();
  doc.setFontSize(14); doc.setTextColor(20);
  doc.text("Rotas & metadados", 40, 50);
  autoTable(doc, {
    startY: 65,
    theme: "striped",
    styles: { fontSize: 7, cellPadding: 3, overflow: "linebreak" },
    head: [["Rota", "Categoria", "Título (status)", "Description (status)", "Flags"]],
    body: data.routes.map((r) => {
      const t = classifyTitle(r.title); const d = classifyDescription(r.description);
      const flags = [
        r.noindex && "noindex", r.dynamic && "dinâmica",
        r.hasJsonLd && "JSON-LD", r.hasImage && "og:image",
      ].filter(Boolean).join(", ");
      return [
        r.path, r.category,
        `${r.title}\n[${t.level}: ${t.msg}]`,
        `${r.description}\n[${d.level}: ${d.msg}]`,
        flags,
      ];
    }),
    columnStyles: { 0: { cellWidth: 90 }, 1: { cellWidth: 55 }, 2: { cellWidth: 150 }, 3: { cellWidth: 180 }, 4: { cellWidth: 75 } },
    headStyles: { fillColor: [30, 41, 59] },
  });

  // Lighthouse
  if (data.lighthouseLatest.length) {
    doc.addPage();
    doc.setFontSize(14); doc.setTextColor(20);
    doc.text("Lighthouse — últimas por rota + device", 40, 50);
    autoTable(doc, {
      startY: 65,
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 3 },
      head: [["Rota", "Dev.", "Perf", "SEO", "A11y", "BP", "LCP", "CLS", "TBT", "Status"]],
      body: data.lighthouseLatest.map((r) => [
        r.path, r.strategy,
        r.performance_score ?? "—", r.seo_score ?? "—",
        r.accessibility_score ?? "—", r.best_practices_score ?? "—",
        r.lcp_ms ? `${(r.lcp_ms / 1000).toFixed(2)}s` : "—",
        r.cls ?? "—",
        r.tbt_ms ? `${r.tbt_ms}ms` : "—",
        r.status,
      ]),
      headStyles: { fillColor: [30, 41, 59] },
    });
  }

  // Monitor snapshots
  if (data.monitorSnapshots.length) {
    doc.addPage();
    doc.setFontSize(14); doc.setTextColor(20);
    doc.text("Monitoramento — snapshots recentes", 40, 50);
    autoTable(doc, {
      startY: 65,
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 3 },
      head: [["Quando", "Total", "OK", "Erros", "Novas", "Removidas", "Latência méd (ms)", "p95 (ms)"]],
      body: data.monitorSnapshots.map((s) => [
        new Date(s.created_at).toLocaleString("pt-BR"),
        s.total_urls, s.ok_count, s.error_count,
        s.new_urls_count ?? "—", s.removed_urls_count ?? "—",
        s.avg_ms ?? "—", s.p95_ms ?? "—",
      ]),
      headStyles: { fillColor: [30, 41, 59] },
    });
  }

  // Alertas
  if (data.monitorAlertas.length) {
    doc.addPage();
    doc.setFontSize(14); doc.setTextColor(20);
    doc.text(`Alertas de monitoramento (${data.monitorAlertas.length})`, 40, 50);
    autoTable(doc, {
      startY: 65,
      theme: "striped",
      styles: { fontSize: 7, cellPadding: 3, overflow: "linebreak" },
      head: [["Quando", "Tipo", "Sev.", "URL", "Mensagem", "Resolvido"]],
      body: data.monitorAlertas.map((a) => [
        new Date(a.created_at).toLocaleString("pt-BR"),
        a.tipo, a.severity, a.url, a.message ?? "", a.resolved_at ? "sim" : "não",
      ]),
      columnStyles: { 3: { cellWidth: 140 }, 4: { cellWidth: 180 } },
      headStyles: { fillColor: [30, 41, 59] },
    });
  }

  // Footer com contagem de páginas
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(8); doc.setTextColor(140);
    doc.text(`radarimobtech — Auditoria SEO · ${now}`, 40, doc.internal.pageSize.getHeight() - 20);
    doc.text(`${i}/${total}`, pageW - 60, doc.internal.pageSize.getHeight() - 20);
  }

  return doc.output("blob");
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
