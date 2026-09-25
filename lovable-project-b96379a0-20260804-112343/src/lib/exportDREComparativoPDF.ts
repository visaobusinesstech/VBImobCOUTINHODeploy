import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface PeriodData {
  label: string;
  transacoes: {
    tipo: string;
    categoria: string;
    valor: number;
    status: string;
    comissao_valor?: number | null;
    parceiro_comissao_valor?: number | null;
    captador_comissao_valor?: number | null;
  }[];
}

interface DREComparativoData {
  periods: PeriodData[];
  brandName?: string;
  brandCreci?: string;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const pct = (curr: number, prev: number) => {
  if (prev === 0) return curr > 0 ? "+∞" : "—";
  const change = ((curr - prev) / Math.abs(prev)) * 100;
  const sign = change >= 0 ? "+" : "";
  return `${sign}${change.toFixed(1)}%`;
};

function calcPeriod(transacoes: PeriodData["transacoes"]) {
  const confirmadas = transacoes.filter((t) => t.status === "confirmado");
  const entradas = confirmadas.filter((t) => t.tipo === "entrada");
  const saidas = confirmadas.filter((t) => t.tipo === "saida");

  const receitaAluguel = entradas.filter((t) => t.categoria === "aluguel").reduce((s, t) => s + t.valor, 0);
  const receitaComissao = entradas.filter((t) => t.categoria === "comissao").reduce((s, t) => s + t.valor, 0);
  const receitaRepasse = entradas.filter((t) => t.categoria === "repasse").reduce((s, t) => s + t.valor, 0);
  const receitaOutros = entradas.filter((t) => !["aluguel", "comissao", "repasse"].includes(t.categoria)).reduce((s, t) => s + t.valor, 0);
  const receitaBruta = entradas.reduce((s, t) => s + t.valor, 0);

  const totalCorretorComissao = entradas.reduce((s, t) => s + (t.comissao_valor || 0), 0);
  const totalParceiroComissao = entradas.reduce((s, t) => s + (t.parceiro_comissao_valor || 0), 0);
  const totalCaptadorComissao = entradas.reduce((s, t) => s + (t.captador_comissao_valor || 0), 0);
  const totalDeducoes = totalCorretorComissao + totalParceiroComissao + totalCaptadorComissao;
  const receitaLiquida = receitaBruta - totalDeducoes;

  const totalDespesas = saidas.reduce((s, t) => s + t.valor, 0);
  const resultadoOperacional = receitaLiquida - totalDespesas;

  return {
    receitaAluguel, receitaComissao, receitaRepasse, receitaOutros,
    receitaBruta, totalDeducoes, receitaLiquida, totalDespesas, resultadoOperacional,
    totalCorretorComissao, totalParceiroComissao, totalCaptadorComissao,
  };
}

export function exportDREComparativoPDF({ periods, brandName, brandCreci }: DREComparativoData): boolean {
  if (periods.length < 2) return false;

  const doc = new jsPDF({ orientation: "landscape" });
  const w = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(30, 64, 175);
  doc.rect(0, 0, w, 36, "F");
  doc.setTextColor(255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(brandName || "DRE Comparativo", 14, 16);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Comparativo: ${periods.map((p) => p.label).join(" × ")}`, 14, 26);
  if (brandCreci) doc.text(`CRECI: ${brandCreci}`, w - 14, 26, { align: "right" });

  const calcs = periods.map((p) => calcPeriod(p.transacoes));

  // Build table
  const headers = ["Descrição", ...periods.map((p) => p.label)];
  if (periods.length === 2) headers.push("Variação");

  type RowCell = string | { content: string; styles?: Record<string, any> };

  const makeRow = (label: string, values: number[], opts?: { bold?: boolean; bg?: number[]; colorResult?: boolean }): RowCell[] => {
    const cells: RowCell[] = [];
    const styles: Record<string, any> = {};
    if (opts?.bold) styles.fontStyle = "bold";
    if (opts?.bg) styles.fillColor = opts.bg;

    cells.push(opts?.bold || opts?.bg ? { content: label, styles: { ...styles } } : label);

    values.forEach((v, i) => {
      const valStyles: Record<string, any> = { ...styles, halign: "right" };
      if (opts?.colorResult) {
        valStyles.textColor = v >= 0 ? [22, 163, 74] : [220, 38, 38];
      }
      cells.push({ content: fmt(v), styles: valStyles });
    });

    if (periods.length === 2) {
      const variation = pct(values[1], values[0]);
      const isPos = values[1] >= values[0];
      cells.push({
        content: variation,
        styles: {
          ...styles,
          halign: "center",
          textColor: isPos ? [22, 163, 74] : [220, 38, 38],
          fontStyle: "bold",
        },
      });
    }

    return cells;
  };

  const rows: RowCell[][] = [
    makeRow("RECEITA OPERACIONAL BRUTA", calcs.map((c) => c.receitaBruta), { bold: true, bg: [240, 243, 255] }),
    makeRow("  Receita de Aluguéis", calcs.map((c) => c.receitaAluguel)),
    makeRow("  Comissões de Vendas", calcs.map((c) => c.receitaComissao)),
    makeRow("  Repasses", calcs.map((c) => c.receitaRepasse)),
    makeRow("  Outras Receitas", calcs.map((c) => c.receitaOutros)),
    [{ content: "", styles: {} }, ...periods.map(() => ({ content: "", styles: {} } as RowCell)), ...(periods.length === 2 ? [{ content: "", styles: {} } as RowCell] : [])],
    makeRow("(-) DEDUÇÕES DA RECEITA", calcs.map((c) => -c.totalDeducoes), { bold: true, bg: [255, 243, 240] }),
    makeRow("  Comissão Corretor", calcs.map((c) => -c.totalCorretorComissao)),
    makeRow("  Comissão Parceiro", calcs.map((c) => -c.totalParceiroComissao)),
    makeRow("  Comissão Captador", calcs.map((c) => -c.totalCaptadorComissao)),
    [{ content: "", styles: {} }, ...periods.map(() => ({ content: "", styles: {} } as RowCell)), ...(periods.length === 2 ? [{ content: "", styles: {} } as RowCell] : [])],
    makeRow("= RECEITA OPERACIONAL LÍQUIDA", calcs.map((c) => c.receitaLiquida), { bold: true, bg: [236, 253, 245], colorResult: true }),
    [{ content: "", styles: {} }, ...periods.map(() => ({ content: "", styles: {} } as RowCell)), ...(periods.length === 2 ? [{ content: "", styles: {} } as RowCell] : [])],
    makeRow("(-) DESPESAS OPERACIONAIS", calcs.map((c) => -c.totalDespesas), { bold: true, bg: [255, 243, 240] }),
    [{ content: "", styles: {} }, ...periods.map(() => ({ content: "", styles: {} } as RowCell)), ...(periods.length === 2 ? [{ content: "", styles: {} } as RowCell] : [])],
    makeRow("= RESULTADO OPERACIONAL", calcs.map((c) => c.resultadoOperacional), { bold: true, bg: [236, 253, 245], colorResult: true }),
  ];

  autoTable(doc, {
    startY: 44,
    head: [headers],
    body: rows as any,
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 70 },
    },
    margin: { left: 14, right: 14 },
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")} • ${brandName || "ImobPro"}`, 14, doc.internal.pageSize.getHeight() - 8);
    doc.text(`Página ${i}/${pageCount}`, w - 14, doc.internal.pageSize.getHeight() - 8, { align: "right" });
  }

  const labels = periods.map((p) => p.label.replace(/\s/g, "_")).join("_vs_");
  doc.save(`DRE_Comparativo_${labels}.pdf`);
  return true;
}
