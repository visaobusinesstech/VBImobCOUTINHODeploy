import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Contrato } from "@/hooks/useContratos";
import type { Transacao } from "@/hooks/useTransacoes";
import {
  formatCurrencyBRL,
  formatDateBR,
  safeNumber,
  type RelatorioAluguelImovelRef,
} from "@/lib/relatorioAluguelUtils";

interface RelatorioVendaOptions {
  contratos: Contrato[];
  transacoes: Transacao[];
  imoveis: RelatorioAluguelImovelRef[];
  brandName?: string;
  brandPhone?: string;
  brandEmail?: string;
  brandCreci?: string;
}

const STATUS_LABEL: Record<string, string> = {
  confirmado: "Pago",
  pendente: "Pendente",
  atrasado: "Atrasado",
};

function drawInfoCard(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  label: string,
  value: string,
  valueColor?: [number, number, number],
) {
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(x, y, w, 16, 1.5, 1.5, "F");
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 120, 120);
  doc.text(label, x + 2.5, y + 6);
  doc.setFontSize(8.5);
  doc.setTextColor(...(valueColor || [30, 30, 30]));
  const truncated = value.length > 22 ? value.slice(0, 20) + "…" : value;
  doc.text(truncated, x + 2.5, y + 13);
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > doc.internal.pageSize.getHeight() - 25) {
    doc.addPage();
    return 20;
  }
  return y;
}

const isActiveSaleContract = (c: Pick<Contrato, "tipo" | "status">) =>
  c.tipo === "Venda" && ["ativo", "assinado", "vencendo", "rascunho"].includes(c.status);

const getImovel = (c: Pick<Contrato, "imovel_id">, imoveis: RelatorioAluguelImovelRef[]) =>
  imoveis.find((im) => im.id === c.imovel_id) ?? null;

const getLabel = (c: Pick<Contrato, "titulo">, im?: RelatorioAluguelImovelRef | null) =>
  im?.titulo?.trim() || c.titulo?.trim() || "Imóvel sem título";

const getLocalizacao = (im?: RelatorioAluguelImovelRef | null) =>
  [im?.bairro, im?.cidade].filter(Boolean).join(", ") || im?.endereco || "—";

export function exportRelatorioVendaPDF({
  contratos,
  transacoes,
  imoveis,
  brandName,
  brandPhone,
  brandEmail,
  brandCreci,
}: RelatorioVendaOptions) {
  try {
    const contratosVenda = contratos.filter(isActiveSaleContract);
    if (contratosVenda.length === 0) return false;

    const transacoesComissao = transacoes.filter(
      (t) => t.categoria === "comissao" || t.categoria === "venda",
    );

    const doc = new jsPDF();
    const pw = doc.internal.pageSize.getWidth();
    const brand = brandName || "ImobPro";

    // ═══ HEADER ═══
    doc.setFillColor(16, 185, 129); // emerald-500
    doc.rect(0, 0, pw, 36, "F");

    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(brand, 14, 18);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Relatório Detalhado de Vendas", pw - 14, 14, { align: "right" });

    doc.setFontSize(8);
    doc.setTextColor(200, 255, 230);
    doc.text(
      `Gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
      pw - 14, 22, { align: "right" },
    );
    if (brandCreci) doc.text(`CRECI: ${brandCreci}`, pw - 14, 28, { align: "right" });
    const contact = [brandPhone, brandEmail].filter(Boolean).join("  •  ");
    if (contact) doc.text(contact, pw - 14, 34, { align: "right" });

    let y = 46;

    // ═══ SUMMARY CARDS ═══
    const totalContratos = contratosVenda.length;
    const totalValorVendas = contratosVenda.reduce((s, c) => s + safeNumber(c.valor), 0);
    const totalComissao = contratosVenda.reduce((s, c) => s + safeNumber(c.comissao_valor), 0);
    const totalRecebido = transacoesComissao
      .filter((t) => t.status === "confirmado" && t.tipo === "entrada")
      .reduce((s, t) => s + safeNumber(t.valor), 0);
    const totalPendente = transacoesComissao
      .filter((t) => (t.status === "pendente" || t.status === "atrasado") && t.tipo === "entrada")
      .reduce((s, t) => s + safeNumber(t.valor), 0);

    const cw = (pw - 28 - 4 * 4) / 5;
    drawInfoCard(doc, 14, y, cw, "Vendas Ativas", String(totalContratos));
    drawInfoCard(doc, 14 + (cw + 4), y, cw, "Valor Total Vendas", formatCurrencyBRL(totalValorVendas), [16, 185, 129]);
    drawInfoCard(doc, 14 + 2 * (cw + 4), y, cw, "Comissão Total", formatCurrencyBRL(totalComissao), [37, 99, 235]);
    drawInfoCard(doc, 14 + 3 * (cw + 4), y, cw, "Recebido", formatCurrencyBRL(totalRecebido), [34, 139, 34]);
    drawInfoCard(doc, 14 + 4 * (cw + 4), y, cw, "Pendente", formatCurrencyBRL(totalPendente), [200, 120, 0]);
    y += 24;

    // ═══ PER-UNIT SECTIONS ═══
    for (const contrato of contratosVenda) {
      y = ensureSpace(doc, y, 90);

      const imovel = getImovel(contrato, imoveis);
      const nome = getLabel(contrato, imovel);
      const endereco = getLocalizacao(imovel);

      // Header bar
      doc.setFillColor(16, 185, 129);
      doc.roundedRect(14, y, pw - 28, 10, 2, 2, "F");
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text(nome, 18, y + 7);

      const statusText = contrato.status.toUpperCase();
      const stw = doc.getTextWidth(statusText) + 6;
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(pw - 14 - stw - 4, y + 2, stw, 6, 1, 1, "F");
      doc.setFontSize(6);
      doc.setTextColor(16, 185, 129);
      doc.text(statusText, pw - 14 - stw - 1, y + 6.5);
      y += 14;
      doc.setFont("helvetica", "normal");

      // Row 1: Comprador
      const r1w = (pw - 28 - 2 * 4) / 3;
      drawInfoCard(doc, 14, y, r1w, "Comprador / Cliente", contrato.cliente || "—");
      drawInfoCard(doc, 14 + r1w + 4, y, r1w, "CPF Inquilino", contrato.inquilino_cpf || "—");
      drawInfoCard(doc, 14 + 2 * (r1w + 4), y, r1w, "Tel. Cliente", contrato.inquilino_telefone || "—");
      y += 20;

      // Row 2: Proprietário
      drawInfoCard(doc, 14, y, r1w, "Proprietário / Vendedor", contrato.proprietario || "—");
      drawInfoCard(doc, 14 + r1w + 4, y, r1w, "CPF Proprietário", contrato.proprietario_cpf || "—");
      drawInfoCard(doc, 14 + 2 * (r1w + 4), y, r1w, "Tel. Proprietário", contrato.proprietario_telefone || "—");
      y += 20;

      // Row 3: Cônjuge (if exists)
      if (contrato.conjuge_proprietario || contrato.conjuge_cpf) {
        drawInfoCard(doc, 14, y, r1w, "Cônjuge", contrato.conjuge_proprietario || "—");
        drawInfoCard(doc, 14 + r1w + 4, y, r1w, "CPF Cônjuge", contrato.conjuge_cpf || "—");
        drawInfoCard(doc, 14 + 2 * (r1w + 4), y, r1w, "Endereço / Local", endereco);
        y += 20;
      } else {
        drawInfoCard(doc, 14, y, r1w, "Endereço / Local", endereco);
        drawInfoCard(doc, 14 + r1w + 4, y, r1w, "Unidade", contrato.numero_unidade || "—");
        drawInfoCard(doc, 14 + 2 * (r1w + 4), y, r1w, "Matrícula", contrato.matricula || "—");
        y += 20;
      }

      // Row 4: Financial details
      const r2w = (pw - 28 - 3 * 4) / 4;
      drawInfoCard(doc, 14, y, r2w, "Valor de Venda", formatCurrencyBRL(safeNumber(contrato.valor)), [16, 185, 129]);
      drawInfoCard(doc, 14 + (r2w + 4), y, r2w, "Comissão (%)", `${safeNumber(contrato.comissao_percentual)}%`);
      drawInfoCard(doc, 14 + 2 * (r2w + 4), y, r2w, "Comissão (R$)", formatCurrencyBRL(safeNumber(contrato.comissao_valor)), [37, 99, 235]);
      drawInfoCard(doc, 14 + 3 * (r2w + 4), y, r2w, "Data Venda", formatDateBR(contrato.data_inicio));
      y += 20;

      // Row 5: Corretor + Parceria
      if (contrato.corretor_nome || contrato.captador_nome || contrato.parceiro_nome) {
        y = ensureSpace(doc, y, 20);
        drawInfoCard(doc, 14, y, r2w, "Corretor", contrato.corretor_nome || "—");
        drawInfoCard(doc, 14 + (r2w + 4), y, r2w, "Captador", contrato.captador_nome || "—");
        drawInfoCard(doc, 14 + 2 * (r2w + 4), y, r2w, "Parceiro", contrato.parceiro_nome || "—");
        drawInfoCard(doc, 14 + 3 * (r2w + 4), y, r2w, "Canal Origem", contrato.canal_origem || "—");
        y += 20;
      }

      y += 2;

      // Transactions for this contract
      const txs = transacoesComissao.filter((t) => t.imovel_id === contrato.imovel_id && contrato.imovel_id);

      if (txs.length === 0) {
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text("Nenhuma transação financeira registrada para esta venda.", 18, y);
        y += 8;
        doc.setDrawColor(220, 220, 220);
        doc.line(14, y, pw - 14, y);
        y += 8;
        continue;
      }

      y = ensureSpace(doc, y, 30);
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(55, 65, 81);
      doc.text("Histórico Financeiro", 18, y);
      doc.setFont("helvetica", "normal");
      y += 4;

      const sorted = [...txs].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

      const tableBody = sorted.map((t) => [
        formatDateBR(t.data),
        t.descricao.length > 30 ? t.descricao.slice(0, 28) + "…" : t.descricao,
        t.categoria === "comissao" ? "Comissão" : t.categoria,
        t.tipo === "entrada" ? "Receita" : "Despesa",
        formatCurrencyBRL(t.valor),
        STATUS_LABEL[t.status] || t.status,
      ]);

      autoTable(doc, {
        head: [["Data", "Descrição", "Categ.", "Tipo", "Valor", "Status"]],
        body: tableBody,
        startY: y,
        theme: "striped",
        headStyles: { fillColor: [55, 65, 81], textColor: 255, fontSize: 7, fontStyle: "bold" },
        styles: { fontSize: 6.5, cellPadding: 2, valign: "middle" },
        columnStyles: {
          0: { cellWidth: 20 },
          4: { cellWidth: 24, halign: "right", fontStyle: "bold" },
          5: { cellWidth: 18, halign: "center" },
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: 18, right: 18 },
        didParseCell: (d) => {
          if (d.column.index === 5 && d.section === "body") {
            const v = d.cell.raw;
            if (v === "Pago") d.cell.styles.textColor = [34, 139, 34];
            else if (v === "Pendente") d.cell.styles.textColor = [200, 120, 0];
            else if (v === "Atrasado") d.cell.styles.textColor = [220, 38, 38];
          }
        },
      });

      y = (doc as any).lastAutoTable.finalY + 4;

      // Subtotal
      const recebido = sorted.filter((t) => t.tipo === "entrada" && t.status === "confirmado").reduce((s, t) => s + safeNumber(t.valor), 0);
      const pendente = sorted.filter((t) => t.tipo === "entrada" && t.status !== "confirmado").reduce((s, t) => s + safeNumber(t.valor), 0);

      doc.setFillColor(245, 247, 250);
      doc.roundedRect(14, y, pw - 28, 10, 2, 2, "F");
      doc.setFontSize(7);
      doc.setTextColor(34, 139, 34);
      doc.text(`Recebido: ${formatCurrencyBRL(recebido)}`, 18, y + 7);
      doc.setTextColor(200, 120, 0);
      doc.text(`Pendente: ${formatCurrencyBRL(pendente)}`, 80, y + 7);
      y += 16;

      doc.setDrawColor(220, 220, 220);
      doc.line(14, y - 4, pw - 14, y - 4);
    }

    // ═══ CONSOLIDATED TABLE ═══
    if (contratosVenda.length > 1) {
      y = ensureSpace(doc, y, 60);

      doc.setFillColor(55, 65, 81);
      doc.roundedRect(14, y, pw - 28, 9, 2, 2, "F");
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text("Resumo Consolidado de Vendas", 18, y + 6.5);
      y += 14;

      const rows = contratosVenda.map((c) => {
        const im = getImovel(c, imoveis);
        return [
          getLabel(c, im),
          c.cliente || "—",
          formatCurrencyBRL(safeNumber(c.valor)),
          `${safeNumber(c.comissao_percentual)}%`,
          formatCurrencyBRL(safeNumber(c.comissao_valor)),
          formatDateBR(c.data_inicio),
          c.status === "ativo" ? "Ativo" : c.status,
        ];
      });

      autoTable(doc, {
        head: [["Imóvel", "Comprador", "Valor Venda", "Com. %", "Comissão R$", "Data", "Status"]],
        body: rows,
        startY: y,
        theme: "grid",
        headStyles: { fillColor: [55, 65, 81], textColor: 255, fontSize: 7, fontStyle: "bold" },
        styles: { fontSize: 6.5, cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 35 },
          1: { cellWidth: 28 },
          2: { cellWidth: 24, halign: "right" },
          3: { cellWidth: 14, halign: "center" },
          4: { cellWidth: 24, halign: "right", fontStyle: "bold" },
          5: { cellWidth: 20, halign: "center" },
          6: { cellWidth: 18, halign: "center" },
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: 14, right: 14 },
      });

      y = (doc as any).lastAutoTable.finalY + 6;

      // Grand total
      doc.setFillColor(16, 185, 129);
      doc.roundedRect(14, y, pw - 28, 12, 2, 2, "F");
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text(
        `TOTAL  →  Vendas: ${formatCurrencyBRL(totalValorVendas)}  |  Comissões: ${formatCurrencyBRL(totalComissao)}  |  Recebido: ${formatCurrencyBRL(totalRecebido)}`,
        18,
        y + 8,
      );
    }

    // ═══ FOOTER ═══
    const pageCount = doc.getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p);
      const ph = doc.internal.pageSize.getHeight();
      doc.setDrawColor(200, 200, 200);
      doc.line(14, ph - 18, pw - 14, ph - 18);
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text([brand, brandPhone, brandEmail].filter(Boolean).join("  •  "), 14, ph - 12);
      doc.text(`Página ${p} de ${pageCount}`, pw - 14, ph - 12, { align: "right" });
      doc.text("Documento confidencial — Relatório detalhado de vendas.", pw / 2, ph - 7, { align: "center" });
    }

    // ═══ SAVE ═══
    const fileName = `relatorio_detalhado_vendas_${new Date().toISOString().slice(0, 10)}.pdf`;
    try {
      doc.save(fileName);
    } catch {
      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    return true;
  } catch (error) {
    console.error("Erro ao gerar relatório de vendas:", error);
    return false;
  }
}
