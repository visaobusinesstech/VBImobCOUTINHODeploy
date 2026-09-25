import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Contrato {
  titulo: string;
  tipo: string;
  valor: number;
  status: string;
  data_inicio: string | null;
  corretor_nome: string | null;
  corretor_comissao_percentual: number | null;
  corretor_comissao_valor: number | null;
  captador_nome: string | null;
  captador_comissao_valor: number | null;
  parceiro_nome: string | null;
  parceiro_comissao_valor: number | null;
  comissao_valor: number | null;
}

interface Props {
  contratos: Contrato[];
  brandName?: string;
  brandCreci?: string;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const fmtDate = (d: string | null) => {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("pt-BR");
};

export function exportComissoesCorretorPDF({ contratos, brandName, brandCreci }: Props): boolean {
  const ativos = contratos.filter((c) => c.status !== "cancelado" && c.corretor_nome);
  if (ativos.length === 0) return false;

  const doc = new jsPDF();
  const w = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(30, 64, 175);
  doc.rect(0, 0, w, 36, "F");
  doc.setTextColor(255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(brandName || "Relatório de Comissões", 14, 16);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Comissões por Corretor — Detalhamento Completo", 14, 26);
  if (brandCreci) doc.text(`CRECI: ${brandCreci}`, w - 14, 26, { align: "right" });

  // Group by corretor
  const corretorMap = new Map<string, Contrato[]>();
  ativos.forEach((c) => {
    const nome = c.corretor_nome || "Sem Corretor";
    if (!corretorMap.has(nome)) corretorMap.set(nome, []);
    corretorMap.get(nome)!.push(c);
  });

  let y = 44;

  // Summary table
  const summaryRows = Array.from(corretorMap.entries())
    .map(([nome, cs]) => {
      const totalComissao = cs.reduce((s, c) => s + (c.corretor_comissao_valor || 0), 0);
      const totalVGV = cs.reduce((s, c) => s + c.valor, 0);
      const vendas = cs.filter((c) => c.tipo === "Venda").length;
      const locacoes = cs.filter((c) => c.tipo === "Locação").length;
      return { nome, totalComissao, totalVGV, vendas, locacoes, qtd: cs.length };
    })
    .sort((a, b) => b.totalComissao - a.totalComissao);

  doc.setTextColor(0);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Ranking de Comissões", 14, y);
  y += 6;

  autoTable(doc, {
    startY: y,
    head: [["#", "Corretor", "Contratos", "Vendas", "Locações", "VGV Total", "Comissão Total"]],
    body: summaryRows.map((r, i) => [
      String(i + 1),
      r.nome,
      String(r.qtd),
      String(r.vendas),
      String(r.locacoes),
      fmt(r.totalVGV),
      fmt(r.totalComissao),
    ]),
    theme: "striped",
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: "bold" },
    margin: { left: 14, right: 14 },
  });

  y = (doc as any).lastAutoTable.finalY + 12;

  // Detail per corretor
  for (const [nome, cs] of corretorMap.entries()) {
    if (y > doc.internal.pageSize.getHeight() - 60) {
      doc.addPage();
      y = 20;
    }

    const totalComissao = cs.reduce((s, c) => s + (c.corretor_comissao_valor || 0), 0);
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 64, 175);
    doc.text(`${nome} — Total: ${fmt(totalComissao)}`, 14, y);
    y += 5;

    autoTable(doc, {
      startY: y,
      head: [["Contrato", "Tipo", "Data", "Valor Contrato", "% Comissão", "Valor Comissão"]],
      body: cs.map((c) => [
        c.titulo,
        c.tipo,
        fmtDate(c.data_inicio),
        fmt(c.valor),
        c.corretor_comissao_percentual ? `${c.corretor_comissao_percentual}%` : "—",
        fmt(c.corretor_comissao_valor || 0),
      ]),
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: "bold", fontSize: 8 },
      margin: { left: 14, right: 14 },
    });

    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // Grand total
  const grandTotal = ativos.reduce((s, c) => s + (c.corretor_comissao_valor || 0), 0);
  if (y > doc.internal.pageSize.getHeight() - 30) {
    doc.addPage();
    y = 20;
  }
  doc.setFillColor(236, 253, 245);
  doc.rect(14, y - 2, w - 28, 14, "F");
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(22, 163, 74);
  doc.text(`TOTAL GERAL DE COMISSÕES: ${fmt(grandTotal)}`, 18, y + 8);

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")} • ${brandName || "ImobPro"}`, 14, doc.internal.pageSize.getHeight() - 8);
    doc.text(`Página ${i}/${pageCount}`, w - 14, doc.internal.pageSize.getHeight() - 8, { align: "right" });
  }

  doc.save(`Comissoes_Corretores_${new Date().toISOString().split("T")[0]}.pdf`);
  return true;
}
