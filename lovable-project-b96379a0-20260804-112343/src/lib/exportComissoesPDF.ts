import jsPDF from "jspdf";
import "jspdf-autotable";

interface ContratoComissao {
  titulo: string;
  tipo: string;
  valor: number;
  comissao_percentual: number | null;
  comissao_valor: number | null;
  corretor_nome: string | null;
  corretor_comissao_percentual: number | null;
  corretor_comissao_valor: number | null;
  captador_nome: string | null;
  captador_comissao_percentual: number | null;
  captador_comissao_valor: number | null;
  captador_telefone: string | null;
  tem_parceria: boolean;
  parceiro_nome: string | null;
  parceiro_comissao_percentual: number | null;
  parceiro_comissao_valor: number | null;
  imposto_tipo: string | null;
  imposto_percentual: number | null;
  imposto_valor: number | null;
  canal_origem: string | null;
}

interface ComissoesResumo {
  totalComissao: number;
  totalCorretorComissao: number;
  totalCaptadorComissao: number;
  totalParceiroComissao: number;
  totalImpostos: number;
  liquido: number;
  qtdContratos: number;
}

interface ExportComissoesOptions {
  contratos: ContratoComissao[];
  resumo: ComissoesResumo;
  filtroTipo: string;
  brandName?: string;
  getCanalLabel?: (canal: string) => string;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export function exportComissoesPDF({
  contratos,
  resumo,
  filtroTipo,
  brandName,
  getCanalLabel,
}: ExportComissoesOptions) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const brand = brandName || "ImobPro";

  // Header
  doc.setFontSize(18);
  doc.setTextColor(37, 99, 235);
  doc.text(brand, 14, 20);

  doc.setFontSize(14);
  doc.setTextColor(30, 30, 30);
  doc.text("Resumo de Comissões dos Contratos", 14, 32);

  const filtroLabel = filtroTipo === "todos" ? "Todos os tipos" : filtroTipo;
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(
    `${resumo.qtdContratos} contrato${resumo.qtdContratos !== 1 ? "s" : ""} • Filtro: ${filtroLabel} • Gerado em ${new Date().toLocaleDateString("pt-BR")}`,
    14,
    38,
  );

  // Summary cards
  const summaryItems = [
    { label: "Comissão Total", value: fmt(resumo.totalComissao) },
    { label: "Corretor", value: fmt(resumo.totalCorretorComissao) },
    { label: "Captador", value: fmt(resumo.totalCaptadorComissao) },
    { label: "Parceiro", value: fmt(resumo.totalParceiroComissao) },
    { label: "Impostos", value: fmt(resumo.totalImpostos) },
    { label: "Líquido Imob.", value: fmt(resumo.liquido) },
  ];

  let y = 46;
  const cardW = (pageWidth - 28 - 5 * 4) / 6;
  summaryItems.forEach((item, i) => {
    const x = 14 + i * (cardW + 4);
    doc.setFillColor(245, 245, 250);
    doc.roundedRect(x, y, cardW, 18, 2, 2, "F");
    doc.setFontSize(6.5);
    doc.setTextColor(120, 120, 120);
    doc.text(item.label, x + 2, y + 7);
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);
    doc.text(item.value, x + 2, y + 14);
  });
  y += 26;

  // Table
  const tableData = contratos.map((c) => {
    const liquido =
      (c.comissao_valor || 0) -
      (c.corretor_comissao_valor || 0) -
      (c.captador_comissao_valor || 0) -
      (c.parceiro_comissao_valor || 0) -
      (c.imposto_valor || 0);

    return [
      c.titulo,
      c.tipo,
      fmt(c.valor),
      `${c.comissao_percentual || 0}%`,
      fmt(c.comissao_valor || 0),
      c.corretor_nome || "—",
      fmt(c.corretor_comissao_valor || 0),
      c.captador_nome || "—",
      fmt(c.captador_comissao_valor || 0),
      c.tem_parceria ? (c.parceiro_nome || "Sim") : "Não",
      fmt(c.parceiro_comissao_valor || 0),
      c.imposto_tipo || "—",
      fmt(c.imposto_valor || 0),
      fmt(liquido),
      c.canal_origem
        ? getCanalLabel
          ? getCanalLabel(c.canal_origem)
          : c.canal_origem
        : "—",
    ];
  });

  (doc as any).autoTable({
    startY: y,
    head: [
      [
        "Contrato",
        "Tipo",
        "Valor",
        "% Com.",
        "Comissão",
        "Corretor",
        "Val. Corr.",
        "Captador",
        "Val. Capt.",
        "Parceiro",
        "Val. Parc.",
        "Imposto",
        "Val. Imp.",
        "Líquido",
        "Canal",
      ],
    ],
    body: tableData,
    theme: "striped",
    headStyles: {
      fillColor: [37, 99, 235],
      textColor: 255,
      fontSize: 6.5,
      fontStyle: "bold",
    },
    bodyStyles: { fontSize: 6, textColor: [50, 50, 50] },
    alternateRowStyles: { fillColor: [248, 248, 252] },
    margin: { left: 8, right: 8 },
    styles: { cellPadding: 2, overflow: "linebreak" },
    columnStyles: {
      0: { cellWidth: 28 },
      2: { cellWidth: 18 },
      4: { cellWidth: 16 },
      6: { cellWidth: 14 },
      8: { cellWidth: 14 },
      10: { cellWidth: 14 },
      12: { cellWidth: 14 },
      13: { cellWidth: 16 },
    },
  });

  // Footer
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(160, 160, 160);
    const pageH = doc.internal.pageSize.getHeight();
    doc.text(
      `${brand} • Resumo de Comissões • Gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")} • Página ${i}/${pageCount}`,
      pageWidth / 2,
      pageH - 8,
      { align: "center" },
    );
  }

  try {
    doc.save(`resumo_comissoes_${filtroTipo.toLowerCase()}_${new Date().toISOString().split("T")[0]}.pdf`);
  } catch {
    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `resumo_comissoes_${filtroTipo.toLowerCase()}_${new Date().toISOString().split("T")[0]}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
