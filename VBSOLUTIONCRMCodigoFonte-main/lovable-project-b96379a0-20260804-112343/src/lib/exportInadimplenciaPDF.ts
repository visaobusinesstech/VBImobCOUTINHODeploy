import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface InadimplenciaItemPDF {
  contrato_id: string;
  titulo: string;
  inquilino: string;
  inquilino_telefone: string | null;
  proprietario: string | null;
  valor_aluguel: number;
  dia_vencimento: number;
  meses_atrasados: number;
  valor_total_divida: number;
  dias_atraso: number;
  status_gravidade: "leve" | "moderado" | "grave" | "critico";
  ultimo_pagamento: string | null;
}

interface Props {
  inadimplentes: InadimplenciaItemPDF[];
  contratosAtivos: number;
  brandName?: string;
  brandCreci?: string;
  brandCnpj?: string;
  brandTelefone?: string;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const fmtDate = (d: string) => {
  try {
    return new Date(d + "T00:00:00").toLocaleDateString("pt-BR");
  } catch {
    return d;
  }
};

const GRAVIDADE_LABELS: Record<string, string> = {
  leve: "Leve (1-15d)",
  moderado: "Moderado (16-30d)",
  grave: "Grave (31-60d)",
  critico: "Crítico (60+d)",
};

const GRAVIDADE_COLORS: Record<string, [number, number, number]> = {
  leve: [234, 179, 8],
  moderado: [249, 115, 22],
  grave: [220, 38, 38],
  critico: [127, 29, 29],
};

export function exportInadimplenciaPDF({
  inadimplentes,
  contratosAtivos,
  brandName,
  brandCreci,
  brandCnpj,
  brandTelefone,
}: Props): boolean {
  if (inadimplentes.length === 0) return false;

  const doc = new jsPDF();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const empresa = brandName || "ImobPro";
  const dataAtual = new Date().toLocaleDateString("pt-BR");

  // ── Header ──
  doc.setFillColor(153, 27, 27);
  doc.rect(0, 0, w, 40, "F");
  doc.setFillColor(185, 28, 28);
  doc.rect(0, 32, w, 8, "F");

  doc.setTextColor(255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Relatório de Inadimplência", 14, 18);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`${empresa} — ${dataAtual}`, 14, 28);
  if (brandCreci) doc.text(`CRECI: ${brandCreci}`, w - 14, 18, { align: "right" });
  if (brandCnpj) doc.text(`CNPJ: ${brandCnpj}`, w - 14, 25, { align: "right" });

  let y = 50;
  doc.setTextColor(40);

  // ── Resumo Executivo ──
  const totalDivida = inadimplentes.reduce((s, i) => s + i.valor_total_divida, 0);
  const totalInadimplentes = inadimplentes.length;
  const taxaInadimplencia = contratosAtivos > 0 ? ((totalInadimplentes / contratosAtivos) * 100) : 0;
  const mediaAtraso = totalInadimplentes > 0
    ? Math.round(inadimplentes.reduce((s, i) => s + i.dias_atraso, 0) / totalInadimplentes)
    : 0;
  const maiorDivida = Math.max(...inadimplentes.map(i => i.valor_total_divida));
  const maiorDevedorItem = inadimplentes.find(i => i.valor_total_divida === maiorDivida);

  const byGravidade = {
    leve: inadimplentes.filter(i => i.status_gravidade === "leve"),
    moderado: inadimplentes.filter(i => i.status_gravidade === "moderado"),
    grave: inadimplentes.filter(i => i.status_gravidade === "grave"),
    critico: inadimplentes.filter(i => i.status_gravidade === "critico"),
  };

  // Title
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(14, y, w - 28, 10, 2, 2, "F");
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(153, 27, 27);
  doc.text("RESUMO EXECUTIVO", 20, y + 7);
  y += 16;

  // KPIs in a grid
  doc.setTextColor(40);
  const kpis = [
    { label: "Total em Atraso", value: fmt(totalDivida) },
    { label: "Contratos Inadimplentes", value: `${totalInadimplentes} de ${contratosAtivos}` },
    { label: "Taxa de Inadimplência", value: `${taxaInadimplencia.toFixed(1)}%` },
    { label: "Média de Atraso", value: `${mediaAtraso} dias` },
  ];

  const kpiW = (w - 28 - 12) / 4;
  kpis.forEach((kpi, idx) => {
    const kx = 14 + idx * (kpiW + 4);
    doc.setFillColor(250, 250, 250);
    doc.roundedRect(kx, y, kpiW, 22, 2, 2, "F");
    doc.setDrawColor(220, 220, 220);
    doc.roundedRect(kx, y, kpiW, 22, 2, 2, "S");

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120);
    doc.text(kpi.label, kx + kpiW / 2, y + 8, { align: "center" });

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(40);
    doc.text(kpi.value, kx + kpiW / 2, y + 18, { align: "center" });
  });
  y += 30;

  // Distribuição por gravidade
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(80);
  doc.text("Distribuição por Gravidade:", 14, y);
  y += 5;

  autoTable(doc, {
    startY: y,
    head: [["Gravidade", "Qtd Contratos", "Valor Total", "% do Total"]],
    body: [
      ...["leve", "moderado", "grave", "critico"].map(g => {
        const items = byGravidade[g as keyof typeof byGravidade];
        const val = items.reduce((s, i) => s + i.valor_total_divida, 0);
        const pct = totalDivida > 0 ? ((val / totalDivida) * 100).toFixed(1) + "%" : "0%";
        return [GRAVIDADE_LABELS[g], String(items.length), fmt(val), pct];
      }),
      [
        { content: "TOTAL", styles: { fontStyle: "bold" as const } },
        { content: String(totalInadimplentes), styles: { fontStyle: "bold" as const } },
        { content: fmt(totalDivida), styles: { fontStyle: "bold" as const } },
        { content: "100%", styles: { fontStyle: "bold" as const } },
      ],
    ],
    theme: "striped",
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [153, 27, 27], textColor: 255, fontStyle: "bold" },
    margin: { left: 14, right: 14 },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // Insight box
  if (maiorDevedorItem) {
    doc.setFillColor(255, 247, 237);
    doc.roundedRect(14, y, w - 28, 16, 2, 2, "F");
    doc.setDrawColor(249, 115, 22);
    doc.roundedRect(14, y, w - 28, 16, 2, 2, "S");

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(154, 52, 18);
    doc.text("⚠ Maior devedor:", 18, y + 6);
    doc.setFont("helvetica", "normal");
    doc.text(
      `${maiorDevedorItem.inquilino} — ${fmt(maiorDevedorItem.valor_total_divida)} (${maiorDevedorItem.meses_atrasados} mês(es), ${maiorDevedorItem.dias_atraso} dias)`,
      18, y + 12
    );
    y += 22;
  }

  // ── Detalhamento por gravidade ──
  const gravidadeOrder: Array<keyof typeof byGravidade> = ["critico", "grave", "moderado", "leve"];

  for (const grav of gravidadeOrder) {
    const items = byGravidade[grav];
    if (items.length === 0) continue;

    if (y > h - 50) { doc.addPage(); y = 20; }

    const [r, g, b] = GRAVIDADE_COLORS[grav];
    doc.setFillColor(r, g, b);
    doc.roundedRect(14, y, w - 28, 8, 2, 2, "F");
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255);
    doc.text(`${GRAVIDADE_LABELS[grav].toUpperCase()} — ${items.length} contrato(s)`, 18, y + 6);
    y += 12;

    autoTable(doc, {
      startY: y,
      head: [["Contrato", "Inquilino", "Proprietário", "Aluguel", "Meses", "Dívida Total", "Dias", "Últ. Pgto"]],
      body: items.map(i => [
        i.titulo,
        i.inquilino,
        i.proprietario || "—",
        fmt(i.valor_aluguel),
        `${i.meses_atrasados}x`,
        fmt(i.valor_total_divida),
        `${i.dias_atraso}d`,
        i.ultimo_pagamento ? fmtDate(i.ultimo_pagamento) : "—",
      ]),
      theme: "grid",
      styles: { fontSize: 7.5, cellPadding: 2.5 },
      headStyles: { fillColor: [r, g, b], textColor: 255, fontStyle: "bold", fontSize: 7.5 },
      columnStyles: {
        0: { cellWidth: 35 },
        3: { halign: "right" },
        5: { halign: "right", fontStyle: "bold" },
        6: { halign: "center" },
      },
      margin: { left: 14, right: 14 },
    });

    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ── Footer ──
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(200);
    doc.line(14, h - 14, w - 14, h - 14);
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(
      `Gerado em ${new Date().toLocaleString("pt-BR")} • ${empresa}${brandTelefone ? ` • ${brandTelefone}` : ""}`,
      14, h - 8
    );
    doc.text(`Página ${i}/${pageCount}`, w - 14, h - 8, { align: "right" });
  }

  try {
    doc.save(`Inadimplencia_${new Date().toISOString().split("T")[0]}.pdf`);
  } catch {
    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Inadimplencia_${new Date().toISOString().split("T")[0]}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return true;
}
