import * as XLSX from "xlsx";

interface ExportExcelOptions {
  fileName: string;
  sheetName?: string;
  columns: { header: string; key: string }[];
  data: Record<string, any>[];
}

export function exportToExcel({ fileName, sheetName = "Dados", columns, data }: ExportExcelOptions): boolean {
  try {
    if (!data || data.length === 0) {
      console.warn("[exportExcel] No data to export");
      return false;
    }

    // Build rows with headers — null-safe
    const headers = columns.map((c) => c.header ?? "");
    const rows = data.map((row) =>
      columns.map((c) => {
        const val = row?.[c.key];
        if (val === null || val === undefined) return "";
        if (typeof val === "object") return JSON.stringify(val);
        return val;
      })
    );

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

    // Auto-width columns — null-safe
    const colWidths = columns.map((col, i) => {
      const maxLen = Math.max(
        (col.header ?? "").length,
        ...rows.map((r) => String(r[i] ?? "").length)
      );
      return { wch: Math.min(maxLen + 2, 50) };
    });
    ws["!cols"] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, (sheetName || "Dados").slice(0, 31));

    const safeFileName = (fileName || "export").replace(/[^\w\s-]/g, "").trim() || "export";

    // Try writeFile first, fallback to blob download
    try {
      XLSX.writeFile(wb, `${safeFileName}.xlsx`);
    } catch {
      console.warn("[exportExcel] writeFile failed, using blob fallback");
      const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeFileName}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    return true;
  } catch (err) {
    console.error("[exportExcel] Export failed:", err);
    return false;
  }
}

interface ExportExcelMultiSheetOptions {
  fileName: string;
  sheets: {
    sheetName: string;
    columns: { header: string; key: string }[];
    data: Record<string, any>[];
  }[];
}

export function exportToExcelMultiSheet({ fileName, sheets }: ExportExcelMultiSheetOptions): boolean {
  try {
    const wb = XLSX.utils.book_new();
    let added = 0;

    for (const s of sheets) {
      if (!s.data || s.data.length === 0) continue;
      const headers = s.columns.map((c) => c.header ?? "");
      const rows = s.data.map((row) =>
        s.columns.map((c) => {
          const val = row?.[c.key];
          if (val === null || val === undefined) return "";
          if (typeof val === "object") return JSON.stringify(val);
          return val;
        })
      );
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws["!cols"] = s.columns.map((col, i) => ({
        wch: Math.min(Math.max((col.header ?? "").length, ...rows.map((r) => String(r[i] ?? "").length)) + 2, 50),
      }));
      XLSX.utils.book_append_sheet(wb, ws, (s.sheetName || `Sheet${added + 1}`).slice(0, 31));
      added++;
    }

    if (added === 0) return false;

    const safeFileName = (fileName || "export").replace(/[^\w\s-]/g, "").trim() || "export";
    try {
      XLSX.writeFile(wb, `${safeFileName}.xlsx`);
    } catch {
      const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeFileName}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
    return true;
  } catch (err) {
    console.error("[exportExcelMultiSheet] Failed:", err);
    return false;
  }
}
