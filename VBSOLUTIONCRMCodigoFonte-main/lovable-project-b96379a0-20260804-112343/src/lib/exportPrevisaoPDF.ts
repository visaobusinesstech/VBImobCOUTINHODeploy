import jsPDF from "jspdf";
import "jspdf-autotable";

interface PredictionData {
  bairro: string;
  tendencia: string;
  variacao_percentual: number;
  confianca: string;
  liquidez: string;
  resumo: string;
  recomendacao: string;
  dados?: {
    precoM2Medio: number;
    precoM2Min: number;
    precoM2Max: number;
    totalAnuncios: number;
    diasMedioAnuncio: number | null;
    tipoMaisComum: string;
    carteiraPropria: number;
  };
}

export function exportPrevisaoPDF(predictions: PredictionData[], brandName?: string) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const brand = brandName || "ImobPro";
  const today = new Date().toLocaleDateString("pt-BR");

  // Header
  doc.setFontSize(18);
  doc.setTextColor(37, 99, 235);
  doc.text(brand, 14, 20);

  doc.setFontSize(14);
  doc.setTextColor(30, 30, 30);
  doc.text("Relatório de Previsão de Valorização", 14, 32);

  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(`Gerado em ${today} • Análise por IA • ${predictions.length} bairro(s)`, 14, 40);

  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(0.5);
  doc.line(14, 44, pageWidth - 14, 44);

  // Summary table
  const tableData = predictions.map((p) => [
    p.bairro,
    p.tendencia === "alta" ? "↑ Alta" : p.tendencia === "queda" ? "↓ Queda" : "→ Estável",
    `${p.variacao_percentual > 0 ? "+" : ""}${p.variacao_percentual?.toFixed(1)}%`,
    p.dados ? `R$ ${p.dados.precoM2Medio.toLocaleString("pt-BR")}` : "—",
    p.confianca.charAt(0).toUpperCase() + p.confianca.slice(1),
    p.liquidez.charAt(0).toUpperCase() + p.liquidez.slice(1),
    p.dados?.totalAnuncios?.toString() || "—",
  ]);

  (doc as any).autoTable({
    startY: 50,
    head: [["Bairro", "Tendência", "Variação", "R$/m²", "Confiança", "Liquidez", "Anúncios"]],
    body: tableData,
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: {
      0: { cellWidth: 32 },
      2: { halign: "center" },
      3: { halign: "right" },
      4: { halign: "center" },
      5: { halign: "center" },
      6: { halign: "center" },
    },
  });

  let currentY = (doc as any).lastAutoTable.finalY + 12;

  // Detailed analysis per bairro
  doc.setFontSize(12);
  doc.setTextColor(30, 30, 30);
  doc.text("Análise Detalhada por Bairro", 14, currentY);
  currentY += 8;

  for (const p of predictions) {
    // Check if we need a new page
    if (currentY > 250) {
      doc.addPage();
      currentY = 20;
    }

    // Bairro header
    doc.setFontSize(10);
    doc.setTextColor(37, 99, 235);
    const tendLabel = p.tendencia === "alta" ? "↑" : p.tendencia === "queda" ? "↓" : "→";
    const varLabel = `${p.variacao_percentual > 0 ? "+" : ""}${p.variacao_percentual?.toFixed(1)}%`;
    doc.text(`${p.bairro} — ${tendLabel} ${varLabel}`, 14, currentY);
    currentY += 5;

    // Data row
    if (p.dados) {
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text(
        `R$/m² médio: R$ ${p.dados.precoM2Medio.toLocaleString("pt-BR")} | Min: R$ ${p.dados.precoM2Min.toLocaleString("pt-BR")} | Max: R$ ${p.dados.precoM2Max.toLocaleString("pt-BR")} | ${p.dados.totalAnuncios} anúncios | Tipo: ${p.dados.tipoMaisComum}`,
        14, currentY
      );
      currentY += 5;
    }

    // Resumo
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    const resumoLines = doc.splitTextToSize(p.resumo, pageWidth - 28);
    doc.text(resumoLines, 14, currentY);
    currentY += resumoLines.length * 4 + 2;

    // Recomendação
    doc.setFontSize(8);
    doc.setTextColor(37, 99, 235);
    const recLines = doc.splitTextToSize(`💡 ${p.recomendacao}`, pageWidth - 28);
    doc.text(recLines, 14, currentY);
    currentY += recLines.length * 4 + 6;

    // Separator
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.line(14, currentY - 3, pageWidth - 14, currentY - 3);
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(160, 160, 160);
    doc.text(
      `${brand} • Previsão de Valorização • ${today} • Página ${i}/${pageCount}`,
      pageWidth / 2, doc.internal.pageSize.getHeight() - 8,
      { align: "center" }
    );
    doc.text(
      "⚠️ Previsões baseadas em IA e dados de mercado. Não constitui garantia de valorização.",
      pageWidth / 2, doc.internal.pageSize.getHeight() - 4,
      { align: "center" }
    );
  }

  doc.save(`previsao-valorizacao-${today.replace(/\//g, "-")}.pdf`);
}
