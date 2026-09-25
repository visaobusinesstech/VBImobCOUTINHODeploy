import jsPDF from "jspdf";
import "jspdf-autotable";

interface RestrictionDetail {
  descricao: string;
  credor: string;
  valor: number;
  data: string;
  cidade: string;
  uf: string;
}

interface ProviderResult {
  provider: string;
  score: number;
  status: string;
  restrictions: (string | RestrictionDetail)[];
}

interface CreditResult {
  simulated?: boolean;
  providers?: string[];
  results?: ProviderResult[];
  score?: number | null;
  riskLevel?: string;
  status?: string;
  restrictions?: (string | RestrictionDetail)[];
  cpfMasked?: string;
  consultedAt?: string;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export function exportConsultaCPFPDF(result: CreditResult, brandName?: string) {
  const doc = new jsPDF();
  const pw = doc.internal.pageSize.getWidth();
  const brand = brandName || "ImobPro";
  const now = result.consultedAt
    ? new Date(result.consultedAt).toLocaleString("pt-BR")
    : new Date().toLocaleString("pt-BR");

  const allRestrictions: RestrictionDetail[] = [];
  if (result.restrictions) {
    result.restrictions.forEach((r) => {
      if (typeof r === "string") {
        allRestrictions.push({ descricao: r, credor: "", valor: 0, data: "", cidade: "", uf: "" });
      } else {
        allRestrictions.push(r);
      }
    });
  }
  const hasRestrictions = allRestrictions.length > 0;

  // ── Header ──
  doc.setFillColor(20, 30, 60);
  doc.rect(0, 0, pw, 40, "F");

  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text(brand, 14, 18);

  doc.setFontSize(11);
  doc.setTextColor(200, 210, 230);
  doc.text("Relatório de Consulta CPF — Restrição", 14, 28);

  doc.setFontSize(8);
  doc.setTextColor(170, 180, 200);
  doc.text(`Emitido em: ${now}`, 14, 35);
  if (result.cpfMasked) {
    doc.text(`CPF: ${result.cpfMasked}`, pw - 14, 35, { align: "right" });
  }

  let y = 50;

  // ── Resultado Principal ──
  if (hasRestrictions) {
    doc.setFillColor(254, 226, 226);
    doc.roundedRect(14, y, pw - 28, 22, 3, 3, "F");
    doc.setFontSize(14);
    doc.setTextColor(185, 28, 28);
    doc.text("⚠ CPF COM RESTRIÇÃO", pw / 2, y + 14, { align: "center" });
  } else {
    doc.setFillColor(220, 252, 231);
    doc.roundedRect(14, y, pw - 28, 22, 3, 3, "F");
    doc.setFontSize(14);
    doc.setTextColor(22, 101, 52);
    doc.text("✓ CPF SEM RESTRIÇÃO", pw / 2, y + 14, { align: "center" });
  }
  y += 30;

  // ── Score Consolidado ──
  doc.setFillColor(245, 245, 250);
  doc.roundedRect(14, y, pw - 28, 24, 3, 3, "F");

  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text("Score Consolidado", 20, y + 9);

  const score = result.score || 0;
  const scoreColor: [number, number, number] = score >= 700 ? [22, 101, 52] : score >= 500 ? [161, 98, 7] : [185, 28, 28];
  doc.setFontSize(22);
  doc.setTextColor(...scoreColor);
  doc.text(String(score), 20, y + 20);

  const riskLabel =
    result.riskLevel === "baixo" ? "Risco Baixo ✅" : result.riskLevel === "moderado" ? "Risco Moderado ⚠️" : "Risco Alto 🔴";
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text(riskLabel, pw - 20, y + 15, { align: "right" });

  if (result.simulated) {
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text("(Dados simulados)", pw - 20, y + 21, { align: "right" });
  }
  y += 32;

  // ── Resultado por Bureau ──
  if (result.results && result.results.length > 0) {
    doc.setFontSize(11);
    doc.setTextColor(30, 30, 30);
    doc.text("Resultado por Bureau", 14, y);
    y += 6;

    const tableBody = result.results.map((r) => {
      const provRestrictions = (r.restrictions || []).map((rest) =>
        typeof rest === "string" ? rest : rest.descricao
      );
      return [
        r.provider,
        String(r.score),
        provRestrictions.length > 0 ? "COM RESTRIÇÃO" : "SEM RESTRIÇÃO",
        provRestrictions.length > 0 ? provRestrictions.join("; ") : "Nenhuma pendência",
      ];
    });

    (doc as any).autoTable({
      startY: y,
      head: [["Bureau", "Score", "Status", "Pendências"]],
      body: tableBody,
      margin: { left: 14, right: 14 },
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [20, 30, 60], textColor: 255 },
      columnStyles: {
        1: { halign: "center" },
        2: { halign: "center" },
      },
      didParseCell: (data: any) => {
        if (data.section === "body" && data.column.index === 2) {
          if (data.cell.raw === "COM RESTRIÇÃO") {
            data.cell.styles.textColor = [185, 28, 28];
            data.cell.styles.fontStyle = "bold";
          } else {
            data.cell.styles.textColor = [22, 101, 52];
            data.cell.styles.fontStyle = "bold";
          }
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // ── Detalhes das Restrições ──
  if (allRestrictions.length > 0) {
    doc.setFontSize(11);
    doc.setTextColor(185, 28, 28);
    doc.text("Detalhes das Restrições Encontradas", 14, y);
    y += 6;

    const restrictionBody = allRestrictions.map((r) => [
      r.descricao,
      r.credor || "—",
      r.valor > 0 ? formatCurrency(r.valor) : "—",
      r.cidade ? `${r.cidade}${r.uf ? " - " + r.uf : ""}` : "—",
      r.data ? new Date(r.data + "T12:00:00").toLocaleDateString("pt-BR") : "—",
    ]);

    (doc as any).autoTable({
      startY: y,
      head: [["Tipo", "Credor", "Valor", "Local", "Data"]],
      body: restrictionBody,
      margin: { left: 14, right: 14 },
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [185, 28, 28], textColor: 255 },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // ── Rodapé ──
  const pageH = doc.internal.pageSize.getHeight();
  doc.setDrawColor(200, 200, 200);
  doc.line(14, pageH - 20, pw - 14, pageH - 20);
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(
    "Este relatório é um documento informativo. Consulte os bureaus oficiais para dados vinculantes.",
    pw / 2,
    pageH - 14,
    { align: "center" }
  );
  doc.text(`${brand} — Gerado automaticamente`, pw / 2, pageH - 9, { align: "center" });

  // ── Download ──
  const cpfLabel = result.cpfMasked?.replace(/[.*]/g, "") || "cpf";
  doc.save(`consulta-cpf-${cpfLabel}-${new Date().toISOString().slice(0, 10)}.pdf`);
}