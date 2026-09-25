import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Transacao {
  id: string;
  descricao: string;
  tipo: string;
  categoria: string;
  valor: number;
  data: string;
  status: string;
  numero_unidade?: string | null;
  proprietario_nome?: string | null;
  proprietario_telefone?: string | null;
  proprietario_cpf?: string | null;
  corretor_nome?: string | null;
  comissao_valor?: number | null;
  imposto_valor?: number | null;
  imposto_tipo?: string | null;
  valor_nao_tributavel?: number | null;
  valor_iptu?: number | null;
  valor_condominio?: number | null;
  taxa_extra?: number | null;
  taxa_extra_descricao?: string | null;
  canal_origem?: string | null;
}

interface RelatorioUnidadeOptions {
  transacoes: Transacao[];
  brandName?: string;
  brandCreci?: string;
  brandPhone?: string;
  brandEmail?: string;
  filterUnidade?: string;
  filenameSuffix?: string;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const formatDate = (d: string) => {
  const date = new Date(d + "T00:00:00");
  return date.toLocaleDateString("pt-BR");
};

const categoriaLabel: Record<string, string> = {
  comissao: "Comissão",
  aluguel: "Aluguel",
  repasse: "Repasse",
  despesa: "Despesa",
  outros: "Outros",
};

const statusLabel: Record<string, string> = {
  confirmado: "Pago",
  pendente: "Pendente",
  atrasado: "Atrasado",
  cancelado: "Cancelado",
};

export function exportRelatorioUnidadePDF(options: RelatorioUnidadeOptions): boolean {
  const { transacoes, brandName, brandCreci, brandPhone, brandEmail, filterUnidade, filenameSuffix } = options;

  // Filter by unit if specified
  const txsToUse = filterUnidade
    ? transacoes.filter((t) => (t.numero_unidade?.trim() || "Sem Unidade") === filterUnidade)
    : transacoes;

  // Group by numero_unidade
  const groups = new Map<string, Transacao[]>();
  txsToUse.forEach((t) => {
    const key = t.numero_unidade?.trim() || "Sem Unidade";
    const arr = groups.get(key) || [];
    arr.push(t);
    groups.set(key, arr);
  });

  if (groups.size === 0) return false;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = 15;

  // Header
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("Relatório Financeiro por Unidade", margin, y);
  y += 7;

  if (brandName) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    const brandParts = [brandName, brandCreci ? `CRECI: ${brandCreci}` : "", brandPhone || "", brandEmail || ""].filter(Boolean);
    doc.text(brandParts.join(" • "), margin, y);
    y += 5;
  }

  doc.setFontSize(9);
  doc.setTextColor(130, 130, 130);
  doc.text(`Gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}`, margin, y);
  y += 4;

  // Line
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  // Summary overview
  const sortedGroups = Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  // Overview table
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("Resumo por Unidade", margin, y);
  y += 5;

  const overviewData = sortedGroups.map(([unidade, txs]) => {
    const receitas = txs.filter((t) => t.tipo === "entrada").reduce((s, t) => s + t.valor, 0);
    const despesas = txs.filter((t) => t.tipo === "saida").reduce((s, t) => s + t.valor, 0);
    const comissoes = txs.reduce((s, t) => s + (t.comissao_valor || 0), 0);
    const impostos = txs.reduce((s, t) => s + (t.imposto_valor || 0), 0);
    const iptu = txs.reduce((s, t) => s + (t.valor_iptu || 0), 0);
    const condominio = txs.reduce((s, t) => s + (t.valor_condominio || 0), 0);
    const taxaExtra = txs.reduce((s, t) => s + (t.taxa_extra || 0), 0);
    const proprietario = txs.find((t) => t.proprietario_nome)?.proprietario_nome || "—";
    return {
      unidade,
      proprietario,
      qtd: txs.length,
      receitas,
      despesas,
      comissoes,
      impostos,
      iptu,
      condominio,
      taxaExtra,
      saldo: receitas - despesas,
    };
  });

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Unidade", "Proprietário", "Qtd", "Receitas", "Despesas", "Comissões", "IPTU", "Condomínio", "Saldo"]],
    body: overviewData.map((d) => [
      d.unidade,
      d.proprietario,
      String(d.qtd),
      formatCurrency(d.receitas),
      formatCurrency(d.despesas),
      formatCurrency(d.comissoes),
      formatCurrency(d.iptu),
      formatCurrency(d.condominio),
      formatCurrency(d.saldo),
    ]),
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: "bold", fontSize: 7 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: {
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
      7: { halign: "right" },
      8: { halign: "right" },
    },
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  // Detail per unit
  sortedGroups.forEach(([unidade, txs]) => {
    // Check if we need a new page
    if (y > 240) {
      doc.addPage();
      y = 15;
    }

    const proprietario = txs.find((t) => t.proprietario_nome)?.proprietario_nome;
    const proprietarioCpf = txs.find((t) => t.proprietario_cpf)?.proprietario_cpf;
    const proprietarioTel = txs.find((t) => t.proprietario_telefone)?.proprietario_telefone;

    // Unit header
    doc.setFillColor(41, 128, 185);
    doc.rect(margin, y - 4, pageWidth - margin * 2, 8, "F");
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(`Unidade: ${unidade}`, margin + 3, y + 1);
    y += 8;

    // Proprietário info
    if (proprietario) {
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(60, 60, 60);
      const propInfo = [`Proprietário: ${proprietario}`, proprietarioCpf ? `CPF: ${proprietarioCpf}` : "", proprietarioTel ? `Tel: ${proprietarioTel}` : ""].filter(Boolean).join(" • ");
      doc.text(propInfo, margin, y + 2);
      y += 6;
    }

    // Summary for this unit
    const receitas = txs.filter((t) => t.tipo === "entrada").reduce((s, t) => s + t.valor, 0);
    const despesas = txs.filter((t) => t.tipo === "saida").reduce((s, t) => s + t.valor, 0);
    const comissoes = txs.reduce((s, t) => s + (t.comissao_valor || 0), 0);
    const impostos = txs.reduce((s, t) => s + (t.imposto_valor || 0), 0);
    const naoTributavel = txs.reduce((s, t) => s + (t.valor_nao_tributavel || 0), 0);
    const iptu = txs.reduce((s, t) => s + (t.valor_iptu || 0), 0);
    const condominio = txs.reduce((s, t) => s + (t.valor_condominio || 0), 0);
    const taxaExtra = txs.reduce((s, t) => s + (t.taxa_extra || 0), 0);

    doc.setFontSize(7);
    doc.setTextColor(80, 80, 80);
    const summaryLine = [
      `Receitas: ${formatCurrency(receitas)}`,
      `Despesas: ${formatCurrency(despesas)}`,
      `Comissões: ${formatCurrency(comissoes)}`,
      impostos > 0 ? `Impostos: ${formatCurrency(impostos)}` : "",
      naoTributavel > 0 ? `Não Tributável: ${formatCurrency(naoTributavel)}` : "",
      iptu > 0 ? `IPTU: ${formatCurrency(iptu)}` : "",
      condominio > 0 ? `Condomínio: ${formatCurrency(condominio)}` : "",
      taxaExtra > 0 ? `Taxa Extra: ${formatCurrency(taxaExtra)}` : "",
    ].filter(Boolean).join(" | ");
    doc.text(summaryLine, margin, y + 2);
    y += 6;

    // Transactions table
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Data", "Descrição", "Tipo", "Categoria", "Valor", "Status", "Corretor"]],
      body: txs
        .sort((a, b) => a.data.localeCompare(b.data))
        .map((t) => [
          formatDate(t.data),
          t.descricao,
          t.tipo === "entrada" ? "Entrada" : "Saída",
          categoriaLabel[t.categoria] || t.categoria,
          formatCurrency(t.valor),
          statusLabel[t.status] || t.status,
          t.corretor_nome || "—",
        ]),
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [52, 73, 94], textColor: 255, fontStyle: "bold", fontSize: 7 },
      alternateRowStyles: { fillColor: [248, 249, 250] },
      columnStyles: {
        4: { halign: "right" },
      },
    });

    y = (doc as any).lastAutoTable.finalY + 8;
  });

  // Grand total footer
  if (y > 260) {
    doc.addPage();
    y = 15;
  }

  const totalReceitas = txsToUse.filter((t) => t.tipo === "entrada").reduce((s, t) => s + t.valor, 0);
  const totalDespesas = txsToUse.filter((t) => t.tipo === "saida").reduce((s, t) => s + t.valor, 0);
  const totalComissoes = txsToUse.reduce((s, t) => s + (t.comissao_valor || 0), 0);
  const totalImpostos = txsToUse.reduce((s, t) => s + (t.imposto_valor || 0), 0);

  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("Totais Gerais", margin, y);
  y += 5;

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  const totals = [
    `Total Receitas: ${formatCurrency(totalReceitas)}`,
    `Total Despesas: ${formatCurrency(totalDespesas)}`,
    `Total Comissões: ${formatCurrency(totalComissoes)}`,
    `Total Impostos: ${formatCurrency(totalImpostos)}`,
    `Saldo Geral: ${formatCurrency(totalReceitas - totalDespesas)}`,
    `Unidades: ${groups.size}`,
    `Transações: ${txsToUse.length}`,
  ];
  totals.forEach((line) => {
    doc.text(line, margin, y);
    y += 4;
  });

  const suffix = filenameSuffix
    ? `_${filenameSuffix.replace(/[^a-zA-Z0-9_-]/g, "_")}`
    : "";
  doc.save(`Relatorio_Por_Unidade${suffix}_${new Date().toISOString().split("T")[0]}.pdf`);
  return true;
}
