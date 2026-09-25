import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface ReportData {
  periodo: string;
  nomeEmpresa: string;
  leads: { total: number; novos: number; fechados: number; perdidos: number; conversao: string };
  receita: { total: number; vendas: number; aluguel: number; despesas: number; saldo: number };
  contratos: number;
  corretores: number;
  followupsPendentes: number;
  compromissosRealizados: number;
  topEstagios: { nome: string; qtd: number }[];
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export function exportRelatorioMensalPDF(data: ReportData) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  // Header
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, pageWidth, 35, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("RELATÓRIO MENSAL", 14, 18);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(data.nomeEmpresa || "radarimobtech", 14, 26);
  doc.text(data.periodo, pageWidth - 14, 18, { align: "right" });
  doc.text(`Gerado em ${new Date().toLocaleDateString("pt-BR")}`, pageWidth - 14, 26, { align: "right" });

  y = 45;

  // KPIs Section
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("📊 Indicadores Chave", 14, y);
  y += 8;

  const kpis = [
    ["Leads Captados", String(data.leads.total)],
    ["Leads Novos", String(data.leads.novos)],
    ["Leads Fechados", String(data.leads.fechados)],
    ["Leads Perdidos", String(data.leads.perdidos)],
    ["Taxa de Conversão", data.leads.conversao + "%"],
    ["Contratos Ativos", String(data.contratos)],
    ["Corretores", String(data.corretores)],
    ["Follow-ups Pendentes", String(data.followupsPendentes)],
  ];

  autoTable(doc, {
    startY: y,
    head: [["Indicador", "Valor"]],
    body: kpis,
    theme: "grid",
    headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontSize: 10, fontStyle: "bold" },
    bodyStyles: { fontSize: 10 },
    columnStyles: { 0: { fontStyle: "bold" }, 1: { halign: "right" } },
    margin: { left: 14, right: 14 },
  });

  y = (doc as any).lastAutoTable.finalY + 12;

  // Financial Section
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("💰 Resumo Financeiro", 14, y);
  y += 8;

  const financeiro = [
    ["Receita Total", formatCurrency(data.receita.total)],
    ["Receita Vendas", formatCurrency(data.receita.vendas)],
    ["Receita Aluguel", formatCurrency(data.receita.aluguel)],
    ["Despesas", formatCurrency(data.receita.despesas)],
    ["Saldo Líquido", formatCurrency(data.receita.saldo)],
  ];

  autoTable(doc, {
    startY: y,
    head: [["Categoria", "Valor"]],
    body: financeiro,
    theme: "grid",
    headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontSize: 10, fontStyle: "bold" },
    bodyStyles: { fontSize: 10 },
    columnStyles: { 0: { fontStyle: "bold" }, 1: { halign: "right" } },
    margin: { left: 14, right: 14 },
    didParseCell: (hookData: any) => {
      if (hookData.section === "body" && hookData.row.index === 4) {
        hookData.cell.styles.textColor = data.receita.saldo >= 0 ? [16, 185, 129] : [239, 68, 68];
        hookData.cell.styles.fontStyle = "bold";
      }
    },
  });

  y = (doc as any).lastAutoTable.finalY + 12;

  // Pipeline Section
  if (data.topEstagios.length > 0) {
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("🎯 Pipeline por Estágio", 14, y);
    y += 8;

    autoTable(doc, {
      startY: y,
      head: [["Estágio", "Quantidade"]],
      body: data.topEstagios.map(e => [e.nome, String(e.qtd)]),
      theme: "grid",
      headStyles: { fillColor: [139, 92, 246], textColor: [255, 255, 255], fontSize: 10, fontStyle: "bold" },
      bodyStyles: { fontSize: 10 },
      columnStyles: { 1: { halign: "right" } },
      margin: { left: 14, right: 14 },
    });
  }

  // Footer
  const totalPages = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`${data.nomeEmpresa || "radarimobtech"} • Página ${i} de ${totalPages}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 8, { align: "center" });
  }

  const mesLabel = data.periodo.replace(/\s/g, "-").toLowerCase();
  try {
    doc.save(`relatorio-mensal-${mesLabel}.pdf`);
  } catch {
    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-mensal-${mesLabel}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
