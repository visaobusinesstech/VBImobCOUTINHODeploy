import jsPDF from "jspdf";
import "jspdf-autotable";

interface ReportColumn {
  header: string;
  dataKey: string;
}

interface ReportOptions {
  title: string;
  subtitle?: string;
  columns: ReportColumn[];
  data: Record<string, any>[];
  summary?: { label: string; value: string }[];
  brandName?: string;
}

export function exportToPDF({ title, subtitle, columns, data, summary, brandName }: ReportOptions) {
  try {
    if (!data || data.length === 0) {
      console.warn("[exportPDF] No data to export");
      return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const brand = brandName || "ImobPro";

    // Header
    doc.setFontSize(18);
    doc.setTextColor(37, 99, 235);
    doc.text(brand, 14, 20);

    doc.setFontSize(14);
    doc.setTextColor(30, 30, 30);
    doc.text(title || "Relatório", 14, 32);

    if (subtitle) {
      doc.setFontSize(9);
      doc.setTextColor(120, 120, 120);
      doc.text(subtitle, 14, 38);
    }

    // Summary cards
    let startY = subtitle ? 46 : 40;
    if (summary && summary.length > 0) {
      const cardWidth = (pageWidth - 28 - (summary.length - 1) * 4) / summary.length;
      summary.forEach((item, i) => {
        const x = 14 + i * (cardWidth + 4);
        doc.setFillColor(245, 245, 250);
        doc.roundedRect(x, startY, cardWidth, 18, 2, 2, "F");
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.text(String(item.label ?? ""), x + 4, startY + 7);
        doc.setFontSize(11);
        doc.setTextColor(30, 30, 30);
        doc.text(String(item.value ?? ""), x + 4, startY + 14);
      });
      startY += 24;
    }

    // Table — null-safe cell values
    (doc as any).autoTable({
      startY,
      head: [columns.map((c) => c.header ?? "")],
      body: data.map((row) =>
        columns.map((c) => {
          const val = row?.[c.dataKey];
          if (val === null || val === undefined) return "";
          if (typeof val === "object") return JSON.stringify(val);
          return String(val);
        })
      ),
      theme: "striped",
      headStyles: {
        fillColor: [37, 99, 235],
        textColor: 255,
        fontSize: 9,
        fontStyle: "bold",
      },
      bodyStyles: { fontSize: 8, textColor: [50, 50, 50] },
      alternateRowStyles: { fillColor: [248, 248, 252] },
      margin: { left: 14, right: 14 },
      styles: { cellPadding: 3 },
    });

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(160, 160, 160);
      const pageH = doc.internal.pageSize.getHeight();
      doc.text(
        `${brand} • Gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")} • Página ${i}/${pageCount}`,
        pageWidth / 2,
        pageH - 8,
        { align: "center" }
      );
    }

    const safeTitle = (title || "relatorio").replace(/[^\w\s-]/g, "").replace(/\s+/g, "_").toLowerCase().slice(0, 80);
    const filename = `${safeTitle}_${new Date().toISOString().split("T")[0]}.pdf`;

    // Try save, fallback to blob
    try {
      doc.save(filename);
    } catch {
      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  } catch (err) {
    console.error("[exportPDF] Export failed:", err);
    throw err;
  }
}
