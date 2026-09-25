import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface DREData {
  transacoes: {
    tipo: string;
    categoria: string;
    valor: number;
    data: string;
    status: string;
    descricao: string;
    comissao_valor?: number | null;
    parceiro_comissao_valor?: number | null;
    captador_comissao_valor?: number | null;
  }[];
  brandName?: string;
  brandCreci?: string;
  periodo?: string;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export function exportDREPDF({ transacoes, brandName, brandCreci, periodo }: DREData): boolean {
  const confirmadas = transacoes.filter((t) => t.status === "confirmado");
  if (confirmadas.length === 0) return false;

  const doc = new jsPDF();
  const w = doc.internal.pageSize.getWidth();
  const periodoLabel = periodo || new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  // Header
  doc.setFillColor(30, 64, 175);
  doc.rect(0, 0, w, 36, "F");
  doc.setTextColor(255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(brandName || "Relatório DRE", 14, 16);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Demonstrativo de Resultado do Exercício — ${periodoLabel}`, 14, 26);
  if (brandCreci) doc.text(`CRECI: ${brandCreci}`, w - 14, 26, { align: "right" });

  let y = 44;
  doc.setTextColor(0);

  // Revenue categories
  const entradas = confirmadas.filter((t) => t.tipo === "entrada");
  const saidas = confirmadas.filter((t) => t.tipo === "saida");

  const receitaAluguel = entradas.filter((t) => t.categoria === "aluguel").reduce((s, t) => s + t.valor, 0);
  const receitaComissao = entradas.filter((t) => t.categoria === "comissao").reduce((s, t) => s + t.valor, 0);
  const receitaRepasse = entradas.filter((t) => t.categoria === "repasse").reduce((s, t) => s + t.valor, 0);
  const receitaOutros = entradas.filter((t) => !["aluguel", "comissao", "repasse"].includes(t.categoria)).reduce((s, t) => s + t.valor, 0);
  const receitaBruta = entradas.reduce((s, t) => s + t.valor, 0);

  // Deductions
  const totalCorretorComissao = entradas.reduce((s, t) => s + (t.comissao_valor || 0), 0);
  const totalParceiroComissao = entradas.reduce((s, t) => s + (t.parceiro_comissao_valor || 0), 0);
  const totalCaptadorComissao = entradas.reduce((s, t) => s + (t.captador_comissao_valor || 0), 0);
  const totalDeducoes = totalCorretorComissao + totalParceiroComissao + totalCaptadorComissao;
  const receitaLiquida = receitaBruta - totalDeducoes;

  // Expenses by category
  const despesaMap = new Map<string, number>();
  const CAT_LABELS: Record<string, string> = {
    combustivel: "Combustível", manutencao_carro: "Manutenção Veículo", pagamento_imobiliaria: "Pag. Imobiliária",
    pagamento_estagiaria: "Pag. Estagiária", facebook_ads: "Facebook Ads", google_ads: "Google Ads",
    faixa: "Faixa/Placa", material_marketing: "Material Marketing", plataformas: "Plataformas", outros: "Outros",
    despesa: "Despesa Geral",
  };
  saidas.forEach((t) => {
    const cat = CAT_LABELS[t.categoria] || t.categoria;
    despesaMap.set(cat, (despesaMap.get(cat) || 0) + t.valor);
  });
  const totalDespesas = saidas.reduce((s, t) => s + t.valor, 0);
  const resultadoOperacional = receitaLiquida - totalDespesas;

  // Build DRE table
  const dreRows: (string | { content: string; styles?: any })[][] = [
    [{ content: "RECEITA OPERACIONAL BRUTA", styles: { fontStyle: "bold", fillColor: [240, 243, 255] } }, { content: fmt(receitaBruta), styles: { fontStyle: "bold", fillColor: [240, 243, 255], halign: "right" } }],
    ["  Receita de Aluguéis", fmt(receitaAluguel)],
    ["  Comissões de Vendas", fmt(receitaComissao)],
    ["  Repasses", fmt(receitaRepasse)],
    ...(receitaOutros > 0 ? [["  Outras Receitas", fmt(receitaOutros)]] : []),
    ["", ""],
    [{ content: "(-) DEDUÇÕES DA RECEITA", styles: { fontStyle: "bold", fillColor: [255, 243, 240] } }, { content: fmt(-totalDeducoes), styles: { fontStyle: "bold", fillColor: [255, 243, 240], halign: "right", textColor: [220, 38, 38] } }],
    ["  Comissão Corretor", fmt(-totalCorretorComissao)],
    ["  Comissão Parceiro", fmt(-totalParceiroComissao)],
    ["  Comissão Captador", fmt(-totalCaptadorComissao)],
    ["", ""],
    [{ content: "= RECEITA OPERACIONAL LÍQUIDA", styles: { fontStyle: "bold", fillColor: [236, 253, 245] } }, { content: fmt(receitaLiquida), styles: { fontStyle: "bold", fillColor: [236, 253, 245], halign: "right", textColor: [22, 163, 74] } }],
    ["", ""],
    [{ content: "(-) DESPESAS OPERACIONAIS", styles: { fontStyle: "bold", fillColor: [255, 243, 240] } }, { content: fmt(-totalDespesas), styles: { fontStyle: "bold", fillColor: [255, 243, 240], halign: "right", textColor: [220, 38, 38] } }],
    ...Array.from(despesaMap.entries()).sort((a, b) => b[1] - a[1]).map(([cat, val]) => [`  ${cat}`, fmt(-val)]),
    ["", ""],
    [
      { content: "= RESULTADO OPERACIONAL", styles: { fontStyle: "bold", fontSize: 12, fillColor: resultadoOperacional >= 0 ? [236, 253, 245] : [255, 228, 228] } },
      { content: fmt(resultadoOperacional), styles: { fontStyle: "bold", fontSize: 12, fillColor: resultadoOperacional >= 0 ? [236, 253, 245] : [255, 228, 228], halign: "right", textColor: resultadoOperacional >= 0 ? [22, 163, 74] : [220, 38, 38] } },
    ],
  ];

  autoTable(doc, {
    startY: y,
    head: [["Descrição", "Valor (R$)"]],
    body: dreRows as any,
    theme: "plain",
    styles: { fontSize: 10, cellPadding: 4 },
    headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: w - 80 },
      1: { cellWidth: 52, halign: "right" },
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

  doc.save(`DRE_${periodoLabel.replace(/\s/g, "_")}.pdf`);
  return true;
}
