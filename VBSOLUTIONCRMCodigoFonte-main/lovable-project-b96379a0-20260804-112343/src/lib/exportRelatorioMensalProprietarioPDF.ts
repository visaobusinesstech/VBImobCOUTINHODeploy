import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Contrato } from "@/hooks/useContratos";
import type { Transacao } from "@/hooks/useTransacoes";
import {
  formatCurrencyBRL,
  formatDateBR,
  getContratoImovel,
  getContratoImovelLabel,
  getContratoInquilino,
  getContratoLocalizacao,
  getTransacoesDoContrato,
  isActiveRentalContract,
  resumirTransacoesContrato,
  safeNumber,
  getCustoMensalTotal,
  getGarantiaLabel,
  type RelatorioAluguelImovelRef,
} from "@/lib/relatorioAluguelUtils";

interface ProprietarioRef {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  cpf_cnpj: string | null;
}

export interface RelatorioMensalProprietarioOptions {
  contratos: Contrato[];
  transacoes: Transacao[];
  imoveis: RelatorioAluguelImovelRef[];
  proprietarioNome: string;
  proprietarioEmail?: string | null;
  proprietarioTelefone?: string | null;
  brandName?: string;
  brandPhone?: string;
  brandEmail?: string;
  brandCreci?: string;
  mesReferencia?: string; // e.g. "Março 2025"
}

const C = {
  primary: [37, 99, 235] as [number, number, number],
  primaryLight: [230, 236, 255] as [number, number, number],
  dark: [30, 41, 59] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  bg: [248, 250, 255] as [number, number, number],
  green: [22, 163, 74] as [number, number, number],
  orange: [234, 88, 12] as [number, number, number],
  red: [220, 38, 38] as [number, number, number],
  text: [30, 30, 30] as [number, number, number],
  muted: [100, 116, 139] as [number, number, number],
};

function drawHeader(doc: jsPDF, brand: string, mesRef: string, proprietario: string) {
  const pw = doc.internal.pageSize.getWidth();
  doc.setFillColor(...C.primary);
  doc.rect(0, 0, pw, 42, "F");

  doc.setTextColor(...C.white);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("RELATÓRIO MENSAL DO PROPRIETÁRIO", 14, 16);

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(`${brand}`, 14, 25);
  doc.text(`Proprietário: ${proprietario}`, 14, 33);

  doc.text(mesRef, pw - 14, 16, { align: "right" });
  doc.text(`Gerado em ${new Date().toLocaleDateString("pt-BR")}`, pw - 14, 25, { align: "right" });
}

function drawFooter(doc: jsPDF, brand: string) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const totalPages = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `${brand} • Relatório confidencial • Página ${i} de ${totalPages}`,
      pw / 2,
      ph - 8,
      { align: "center" }
    );
  }
}

export function exportRelatorioMensalProprietarioPDF(options: RelatorioMensalProprietarioOptions): boolean {
  const {
    contratos,
    transacoes,
    imoveis,
    proprietarioNome,
    brandName,
    brandPhone,
    brandEmail,
    brandCreci,
    mesReferencia,
  } = options;

  const contratosLocacao = contratos.filter(isActiveRentalContract);
  if (contratosLocacao.length === 0) return false;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const brand = brandName || "ImobPro";
  const mesRef = mesReferencia || new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const transacoesAluguel = transacoes.filter(
    (t) => t.categoria === "aluguel" || t.categoria === "repasse"
  );

  // ── PAGE 1: Header + Summary ──
  drawHeader(doc, brand, mesRef, proprietarioNome);
  let y = 52;

  // Global summary
  const totalAluguel = contratosLocacao.reduce((s, c) => s + safeNumber(c.valor), 0);
  let totalRecebido = 0;
  let totalPendente = 0;
  let totalAtrasado = 0;
  let totalDespesas = 0;

  const contratosComResumo = contratosLocacao.map((c) => {
    const imovel = getContratoImovel(c, imoveis);
    const txs = getTransacoesDoContrato({ contrato: c, imovel, transacoes: transacoesAluguel });
    const resumo = resumirTransacoesContrato(txs);
    totalRecebido += resumo.recebido;
    totalPendente += resumo.pendente;
    totalAtrasado += resumo.atrasado;
    totalDespesas += resumo.despesas;
    return { contrato: c, imovel, txs, resumo };
  });

  // Summary cards
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...C.primary);
  doc.text("Resumo Geral", 14, y);
  y += 8;

  const summaryData = [
    ["Unidades Ativas", String(contratosLocacao.length)],
    ["Aluguel Total / Mês", formatCurrencyBRL(totalAluguel)],
    ["Total Recebido", formatCurrencyBRL(totalRecebido)],
    ["Total Pendente", formatCurrencyBRL(totalPendente)],
    ["Total Atrasado", formatCurrencyBRL(totalAtrasado)],
    ["Despesas", formatCurrencyBRL(totalDespesas)],
    ["Saldo Líquido", formatCurrencyBRL(totalRecebido - totalDespesas)],
  ];

  autoTable(doc, {
    startY: y,
    head: [["Indicador", "Valor"]],
    body: summaryData,
    theme: "grid",
    headStyles: { fillColor: C.primary, textColor: [255, 255, 255], fontSize: 9, fontStyle: "bold" },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { fontStyle: "bold" }, 1: { halign: "right" } },
    margin: { left: 14, right: 14 },
    didParseCell: (hookData: any) => {
      if (hookData.section === "body" && hookData.row.index === 6) {
        const saldo = totalRecebido - totalDespesas;
        hookData.cell.styles.textColor = saldo >= 0 ? C.green : C.red;
        hookData.cell.styles.fontStyle = "bold";
      }
      if (hookData.section === "body" && hookData.row.index === 4 && totalAtrasado > 0) {
        hookData.cell.styles.textColor = C.red;
      }
    },
  });

  y = (doc as any).lastAutoTable.finalY + 14;

  // ── Per-unit details ──
  for (const { contrato, imovel, txs, resumo } of contratosComResumo) {
    const nome = getContratoImovelLabel(contrato, imovel);
    const custo = getCustoMensalTotal(contrato);

    // Check if we need a new page
    if (y > 210) {
      doc.addPage();
      y = 20;
    }

    // Unit header
    doc.setFillColor(...C.primaryLight);
    doc.roundedRect(14, y, pw - 28, 8, 2, 2, "F");
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...C.primary);
    doc.text(nome, 18, y + 6);

    // Status badge
    const statusText = contrato.status === "vencendo" ? "VENCENDO" : "ATIVO";
    const statusColor = contrato.status === "vencendo" ? C.orange : C.green;
    doc.setFillColor(...statusColor);
    const stw = doc.getTextWidth(statusText) + 6;
    doc.roundedRect(pw - 14 - stw - 4, y + 1, stw + 4, 6, 2, 2, "F");
    doc.setFontSize(7);
    doc.setTextColor(...C.white);
    doc.text(statusText, pw - 14 - stw - 2, y + 5.5);

    y += 14;

    // Property details table
    const detailsData = [
      ["Inquilino", getContratoInquilino(contrato)],
      ["Localização", getContratoLocalizacao(imovel)],
      ["Vigência", `${formatDateBR(contrato.data_inicio)} a ${formatDateBR(contrato.data_fim)}`],
      ["Garantia", getGarantiaLabel(contrato)],
      ["Vencimento", `Dia ${contrato.dia_vencimento_aluguel || 10}`],
      ["Aluguel", formatCurrencyBRL(custo.aluguel)],
      ["Condomínio", formatCurrencyBRL(custo.condominio)],
      ["IPTU Mensal", formatCurrencyBRL(custo.iptuMensal)],
      ["Custo Total/Mês", formatCurrencyBRL(custo.total)],
    ];

    autoTable(doc, {
      startY: y,
      body: detailsData,
      theme: "plain",
      bodyStyles: { fontSize: 8, cellPadding: 2 },
      columnStyles: {
        0: { fontStyle: "bold", textColor: C.muted, cellWidth: 40 },
        1: { textColor: C.text },
      },
      margin: { left: 14, right: 14 },
    });

    y = (doc as any).lastAutoTable.finalY + 6;

    // Financial summary for this unit
    const finData = [
      ["Recebido", formatCurrencyBRL(resumo.recebido)],
      ["Pendente", formatCurrencyBRL(resumo.pendente)],
      ["Atrasado", formatCurrencyBRL(resumo.atrasado)],
      ["Despesas", formatCurrencyBRL(resumo.despesas)],
      ["Líquido", formatCurrencyBRL(resumo.recebido - resumo.despesas)],
    ];

    autoTable(doc, {
      startY: y,
      head: [["Extrato Financeiro", "Valor"]],
      body: finData,
      theme: "grid",
      headStyles: { fillColor: C.green, textColor: [255, 255, 255], fontSize: 8, fontStyle: "bold" },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 0: { fontStyle: "bold" }, 1: { halign: "right" } },
      margin: { left: 14, right: 14 },
      didParseCell: (hookData: any) => {
        if (hookData.section === "body") {
          if (hookData.row.index === 2 && resumo.atrasado > 0) {
            hookData.cell.styles.textColor = C.red;
          }
          if (hookData.row.index === 4) {
            const liq = resumo.recebido - resumo.despesas;
            hookData.cell.styles.textColor = liq >= 0 ? C.green : C.red;
            hookData.cell.styles.fontStyle = "bold";
          }
        }
      },
    });

    y = (doc as any).lastAutoTable.finalY + 6;

    // Transaction history (last entries)
    if (txs.length > 0) {
      const sorted = [...txs].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()).slice(0, 12);
      const txBody = sorted.map((t) => [
        formatDateBR(t.data),
        (t.descricao || "").slice(0, 35) || "—",
        t.tipo === "entrada" ? "Receita" : "Despesa",
        formatCurrencyBRL(t.valor),
        t.status === "confirmado" ? "Pago" : t.status === "pendente" ? "Pendente" : t.status === "atrasado" ? "Atrasado" : t.status,
      ]);

      if (y > 230) {
        doc.addPage();
        y = 20;
      }

      autoTable(doc, {
        startY: y,
        head: [["Data", "Descrição", "Tipo", "Valor", "Status"]],
        body: txBody,
        theme: "striped",
        headStyles: { fillColor: C.primary, textColor: [255, 255, 255], fontSize: 7.5, fontStyle: "bold" },
        bodyStyles: { fontSize: 7.5 },
        columnStyles: { 3: { halign: "right" } },
        margin: { left: 14, right: 14 },
        didParseCell: (hookData: any) => {
          if (hookData.section === "body" && hookData.column.index === 4) {
            const val = hookData.cell.raw as string;
            if (val === "Pago") hookData.cell.styles.textColor = C.green;
            else if (val === "Atrasado") hookData.cell.styles.textColor = C.red;
            else if (val === "Pendente") hookData.cell.styles.textColor = C.orange;
          }
        },
      });

      y = (doc as any).lastAutoTable.finalY + 6;
    }

    // Upcoming due dates
    const vencimentos: string[][] = [];
    if (contrato.data_fim) {
      const fim = new Date(contrato.data_fim + "T00:00:00");
      const diasRestantes = Math.round((fim.getTime() - Date.now()) / 86400000);
      if (diasRestantes <= 90 && diasRestantes > 0) {
        vencimentos.push(["Vencimento do Contrato", formatDateBR(contrato.data_fim), `${diasRestantes} dias`]);
      }
    }
    if (contrato.data_proxima_correcao) {
      vencimentos.push(["Próximo Reajuste", formatDateBR(contrato.data_proxima_correcao), contrato.indice_correcao || "—"]);
    }
    if (contrato.data_vencimento_apolice) {
      vencimentos.push(["Vencimento Apólice", formatDateBR(contrato.data_vencimento_apolice), "—"]);
    }
    // Next rent due date
    const diaVenc = contrato.dia_vencimento_aluguel || 10;
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, diaVenc);
    vencimentos.push(["Próximo Aluguel", nextMonth.toLocaleDateString("pt-BR"), formatCurrencyBRL(custo.aluguel)]);

    if (vencimentos.length > 0) {
      if (y > 250) {
        doc.addPage();
        y = 20;
      }

      autoTable(doc, {
        startY: y,
        head: [["Próximos Vencimentos", "Data", "Detalhe"]],
        body: vencimentos,
        theme: "grid",
        headStyles: { fillColor: C.orange, textColor: [255, 255, 255], fontSize: 8, fontStyle: "bold" },
        bodyStyles: { fontSize: 8 },
        columnStyles: { 0: { fontStyle: "bold" } },
        margin: { left: 14, right: 14 },
      });

      y = (doc as any).lastAutoTable.finalY + 12;
    } else {
      y += 6;
    }
  }

  // Contact footer
  if (brandPhone || brandEmail || brandCreci) {
    if (y > 260) {
      doc.addPage();
      y = 20;
    }
    doc.setFontSize(8);
    doc.setTextColor(...C.muted);
    const contactLines: string[] = [];
    if (brandPhone) contactLines.push(`Tel: ${brandPhone}`);
    if (brandEmail) contactLines.push(`E-mail: ${brandEmail}`);
    if (brandCreci) contactLines.push(`CRECI: ${brandCreci}`);
    doc.text(contactLines.join("  •  "), 14, y);
  }

  drawFooter(doc, brand);

  const slug = proprietarioNome.replace(/\s+/g, "-").toLowerCase();
  const mesSlug = (mesReferencia || "mensal").replace(/\s+/g, "-").toLowerCase();
  try {
    doc.save(`relatorio-mensal-${slug}-${mesSlug}.pdf`);
  } catch {
    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-mensal-${slug}-${mesSlug}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return true;
}
