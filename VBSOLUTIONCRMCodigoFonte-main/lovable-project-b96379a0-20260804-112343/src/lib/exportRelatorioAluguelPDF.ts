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
  getGarantiaLabel,
  getCustoMensalTotal,
  type RelatorioAluguelImovelRef,
} from "@/lib/relatorioAluguelUtils";

interface RelatorioAluguelOptions {
  contratos: Contrato[];
  transacoes: Transacao[];
  imoveis: RelatorioAluguelImovelRef[];
  proprietarios?: Array<{
    id: string;
    nome: string;
    email: string | null;
    telefone: string | null;
    cpf_cnpj: string | null;
  }>;
  brandName?: string;
  brandPhone?: string;
  brandEmail?: string;
  brandCreci?: string;
  periodo?: { inicio: string; fim: string };
  filenameSuffix?: string;
}

/* ═══════════════════════════════════════════════════
   PALETTE — Gamma-style modern presentation colours
   ═══════════════════════════════════════════════════ */
const C = {
  primary: [66, 99, 235] as [number, number, number],
  primaryLight: [230, 236, 255] as [number, number, number],
  dark: [30, 41, 59] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  bg: [248, 250, 255] as [number, number, number],
  cardBg: [235, 240, 255] as [number, number, number],
  muted: [140, 150, 170] as [number, number, number],
  green: [22, 163, 74] as [number, number, number],
  orange: [234, 88, 12] as [number, number, number],
  red: [220, 38, 38] as [number, number, number],
  text: [30, 30, 30] as [number, number, number],
  textLight: [100, 116, 139] as [number, number, number],
};

const normalizeLookupKey = (value: string | null | undefined) =>
  (value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

const STATUS_LABEL: Record<string, string> = {
  confirmado: "Pago",
  pendente: "Pendente",
  atrasado: "Atrasado",
};

/* ═══════════════════ HELPERS ═══════════════════ */

function drawSlideBg(doc: jsPDF) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  doc.setFillColor(...C.bg);
  doc.rect(0, 0, pw, ph, "F");
}

function drawSlideFooter(doc: jsPDF, brand: string, page: number, total: number) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  doc.setFillColor(...C.dark);
  doc.rect(0, ph - 14, pw, 14, "F");
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...C.white);
  doc.text(brand, 16, ph - 5);
  doc.text(`${page} / ${total}`, pw - 16, ph - 5, { align: "right" });
}

function drawCard(
  doc: jsPDF,
  x: number, y: number, w: number, h: number,
  fill: [number, number, number] = C.cardBg,
  radius = 4,
) {
  doc.setFillColor(...fill);
  doc.roundedRect(x, y, w, h, radius, radius, "F");
}

function drawMetricCard(
  doc: jsPDF,
  x: number, y: number, w: number, h: number,
  label: string, value: string,
  valueColor: [number, number, number] = C.primary,
) {
  drawCard(doc, x, y, w, h, C.white);
  doc.setFillColor(...valueColor);
  doc.roundedRect(x, y, 3, h, 2, 2, "F");
  doc.rect(x + 1.5, y, 1.5, h, "F");

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...C.textLight);
  doc.text(label, x + 8, y + 9);

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...valueColor);
  const lines = doc.splitTextToSize(value, w - 12);
  doc.text(lines[0] || value, x + 8, y + 19);
}

function drawInfoRow(
  doc: jsPDF,
  x: number, y: number, w: number,
  label: string, value: string,
  valueColor?: [number, number, number],
) {
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...C.textLight);
  doc.text(label, x, y);

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...(valueColor || C.text));
  const safe = (value || "").trim() || "—";
  const lines = doc.splitTextToSize(safe, w);
  doc.text(lines[0] || safe, x, y + 5);
}

function drawSectionTitle(doc: jsPDF, x: number, y: number, title: string) {
  doc.setFillColor(...C.primary);
  doc.rect(x, y, 28, 1.5, "F");
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...C.primary);
  doc.text(title, x, y + 12);
}

/* ═══════════════════ MAIN EXPORT ═══════════════════ */

export function exportRelatorioAluguelPDF({
  contratos,
  transacoes,
  imoveis,
  proprietarios = [],
  brandName,
  brandPhone,
  brandEmail,
  brandCreci,
  periodo,
  filenameSuffix,
}: RelatorioAluguelOptions) {
  try {
    const contratosLocacao = contratos.filter(isActiveRentalContract);
    if (contratosLocacao.length === 0) return false;

    const transacoesAluguel = transacoes.filter(
      (t) => t.categoria === "aluguel" || t.categoria === "repasse",
    );

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const brand = brandName || "ImobPro";
    const proprietariosPorId = new Map(proprietarios.map((p) => [p.id, p]));
    const proprietariosPorNome = new Map(
      proprietarios.map((p) => [normalizeLookupKey(p.nome), p]),
    );

    const periodoText = periodo
      ? `Período: ${formatDateBR(periodo.inicio)} a ${formatDateBR(periodo.fim)}`
      : `Gerado em ${new Date().toLocaleDateString("pt-BR")}`;

    // ═══════════════════════════════════════════════
    // Calculate cover totals with commission deducted
    // ═══════════════════════════════════════════════
    const totalContratos = contratosLocacao.length;
    const totalAluguel = contratosLocacao.reduce((s, c) => s + safeNumber(c.valor), 0);

    // Per-unit: calculate received minus commission = líquido proprietário
    let coverRecebidoProprietario = 0;
    let coverPendenteTotal = 0;
    let coverComissaoTotal = 0;
    for (const c of contratosLocacao) {
      const im = getContratoImovel(c, imoveis);
      const tx = getTransacoesDoContrato({ contrato: c, imovel: im, transacoes: transacoesAluguel });
      const r = resumirTransacoesContrato(tx);
      const comissao = tx
        .filter((t) => t.tipo === "entrada" && t.status === "confirmado")
        .reduce((s, t) => s + safeNumber((t as any).comissao_valor || 0), 0);
      coverRecebidoProprietario += r.recebido - comissao;
      coverPendenteTotal += r.pendente + r.atrasado;
      coverComissaoTotal += comissao;
    }

    // ═══════════════════════════════════════════════
    // SLIDE 1 — COVER
    // ═══════════════════════════════════════════════
    drawSlideBg(doc);

    // Left colour block
    doc.setFillColor(...C.primary);
    doc.rect(0, 0, pw * 0.45, ph, "F");

    doc.setFontSize(28);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...C.white);
    doc.text(brand, 24, 50);

    if (brandCreci) {
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`CRECI: ${brandCreci}`, 24, 60);
    }

    const contactY = 75;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(200, 220, 255);
    if (brandPhone) doc.text(`📞 ${brandPhone}`, 24, contactY);
    if (brandEmail) doc.text(`📧 ${brandEmail}`, 24, contactY + 8);

    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.5);
    doc.line(24, ph - 50, pw * 0.45 - 24, ph - 50);
    doc.setFontSize(8);
    doc.setTextColor(180, 200, 255);
    doc.text("Documento confidencial", 24, ph - 42);

    // Right side — Title
    const rx = pw * 0.45 + 24;
    doc.setFontSize(26);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...C.primary);
    doc.text("Relatório de Aluguéis", rx, 55);

    doc.setFontSize(14);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...C.textLight);
    doc.text("Prestação de contas detalhada por unidade", rx, 68);

    doc.setFontSize(10);
    doc.text(periodoText, rx, 82);

    // Cover metrics — show proprietário values (commission deducted)
    const mcW = 62;
    const mcH = 26;
    const mcY = 100;
    drawMetricCard(doc, rx, mcY, mcW, mcH, "Unidades Ativas", String(totalContratos), C.primary);
    drawMetricCard(doc, rx + mcW + 6, mcY, mcW, mcH, "Aluguel/Mês", formatCurrencyBRL(totalAluguel), C.primary);
    drawMetricCard(doc, rx, mcY + mcH + 6, mcW, mcH, "Recebido Proprietário", formatCurrencyBRL(coverRecebidoProprietario), C.green);
    drawMetricCard(doc, rx + mcW + 6, mcY + mcH + 6, mcW, mcH, "Comissão Imobiliária", formatCurrencyBRL(coverComissaoTotal), C.orange);

    // ═══════════════════════════════════════════════
    // SLIDES PER UNIT
    // ═══════════════════════════════════════════════
    for (const contrato of contratosLocacao) {
      const imovel = getContratoImovel(contrato, imoveis);
      const nome = getContratoImovelLabel(contrato, imovel);
      const endereco = getContratoLocalizacao(imovel);
      const custo = getCustoMensalTotal(contrato);
      const garantia = getGarantiaLabel(contrato);
      const proprietarioRelacionado =
        (contrato.proprietario_id ? proprietariosPorId.get(contrato.proprietario_id) : null) ||
        proprietariosPorNome.get(normalizeLookupKey(contrato.proprietario)) ||
        null;

      // Get unit-specific pending (condomínio, IPTU, etc.)
      const unitTxs = getTransacoesDoContrato({ contrato, imovel, transacoes: transacoesAluguel });
      const unitResumo = resumirTransacoesContrato(unitTxs);
      const unitComissao = unitTxs
        .filter((t) => t.tipo === "entrada" && t.status === "confirmado")
        .reduce((s, t) => s + safeNumber((t as any).comissao_valor || 0), 0);
      const unitRecebidoProprietario = unitResumo.recebido - unitComissao;

      // ── SLIDE: Unit overview ──
      doc.addPage();
      drawSlideBg(doc);

      doc.setFillColor(...C.primary);
      doc.rect(0, 0, pw, 8, "F");

      drawSectionTitle(doc, 20, 18, nome);

      // Status badge
      const statusText = contrato.status === "vencendo" ? "VENCENDO" : "ATIVO";
      const statusColor = contrato.status === "vencendo" ? C.orange : C.green;
      doc.setFillColor(...statusColor);
      const stw = doc.getTextWidth(statusText) + 10;
      doc.roundedRect(pw - 20 - stw, 22, stw, 8, 3, 3, "F");
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...C.white);
      doc.text(statusText, pw - 20 - stw + 5, 27.5);

      // ── 3 characteristic cards ──
      const cardW = (pw - 60) / 3;
      const cardY = 42;
      const cardH = 34;

      // Card 1 — Inquilino
      drawCard(doc, 20, cardY, cardW, cardH, C.cardBg);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...C.dark);
      doc.text("Inquilino", 28, cardY + 10);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...C.text);
      const inquilinoName = getContratoInquilino(contrato);
      doc.text(inquilinoName, 28, cardY + 18);
      doc.setFontSize(7);
      doc.setTextColor(...C.textLight);
      doc.text(contrato.inquilino_cpf || "CPF não informado", 28, cardY + 24);
      doc.text(contrato.inquilino_telefone || "", 28, cardY + 29);

      // Card 2 — Localização
      drawCard(doc, 20 + cardW + 10, cardY, cardW, cardH, C.cardBg);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...C.dark);
      doc.text("Localização", 28 + cardW + 10, cardY + 10);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...C.text);
      const enderecoLines = doc.splitTextToSize(endereco, cardW - 16);
      doc.text(enderecoLines.slice(0, 2), 28 + cardW + 10, cardY + 18);
      doc.setFontSize(7);
      doc.setTextColor(...C.textLight);
      doc.text(`Unidade: ${contrato.numero_unidade || "—"}`, 28 + cardW + 10, cardY + 29);

      // Card 3 — Contrato
      drawCard(doc, 20 + 2 * (cardW + 10), cardY, cardW, cardH, C.cardBg);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...C.dark);
      doc.text("Contrato", 28 + 2 * (cardW + 10), cardY + 10);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...C.text);
      doc.text(`${formatDateBR(contrato.data_inicio)} a ${formatDateBR(contrato.data_fim)}`, 28 + 2 * (cardW + 10), cardY + 18);
      doc.setFontSize(7);
      doc.setTextColor(...C.textLight);
      doc.text(`Garantia: ${garantia}`, 28 + 2 * (cardW + 10), cardY + 24);
      doc.text(`Venc: Dia ${contrato.dia_vencimento_aluguel || 10}`, 28 + 2 * (cardW + 10), cardY + 29);

      // ── Financial summary — NO "Custo Total/Mês", show commission & líquido ──
      const fY = cardY + cardH + 12;
      doc.setFillColor(...C.primary);
      doc.rect(20, fY, 28, 1.5, "F");
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...C.primary);
      doc.text("Resumo Financeiro", 20, fY + 11);

      const fmY = fY + 18;
      const fmW = (pw - 60) / 5;
      const fmH = 24;

      drawMetricCard(doc, 20, fmY, fmW, fmH, "Aluguel", formatCurrencyBRL(custo.aluguel), C.primary);
      drawMetricCard(doc, 20 + (fmW + 5), fmY, fmW, fmH, "Condomínio", formatCurrencyBRL(custo.condominio), C.textLight);
      drawMetricCard(doc, 20 + 2 * (fmW + 5), fmY, fmW, fmH, "IPTU Mensal", formatCurrencyBRL(custo.iptuMensal), C.textLight);
      drawMetricCard(doc, 20 + 3 * (fmW + 5), fmY, fmW, fmH, "Comissão Imob.", formatCurrencyBRL(unitComissao), C.orange);
      drawMetricCard(doc, 20 + 4 * (fmW + 5), fmY, fmW, fmH, "Líquido Propri.", formatCurrencyBRL(unitRecebidoProprietario), C.green);

      // ── Pendente específico do imóvel por categoria ──
      const pendY = fmY + fmH + 6;
      const pendingTxs = unitTxs.filter((t) => t.tipo === "entrada" && (t.status === "pendente" || t.status === "atrasado"));
      const pendingByCategory: Record<string, { pendente: number; atrasado: number }> = {};
      for (const t of pendingTxs) {
        const desc = (t.descricao || "").toLowerCase();
        let cat = "Aluguel";
        if (desc.includes("condomínio") || desc.includes("condominio")) cat = "Condomínio";
        else if (desc.includes("iptu")) cat = "IPTU";
        else if (desc.includes("seguro")) cat = "Seguro";
        else if (desc.includes("taxa")) cat = "Taxas";
        else if (t.categoria === "aluguel") cat = "Aluguel";
        else cat = "Outros";
        if (!pendingByCategory[cat]) pendingByCategory[cat] = { pendente: 0, atrasado: 0 };
        if (t.status === "pendente") pendingByCategory[cat].pendente += safeNumber(t.valor);
        else pendingByCategory[cat].atrasado += safeNumber(t.valor);
      }
      const pendingEntries = Object.entries(pendingByCategory);
      if (pendingEntries.length > 0 || unitResumo.recebido > 0) {
        const cols = Math.min(pendingEntries.length + 1, 5);
        const pendW = (pw - 60) / cols;
        let pIdx = 0;
        for (const [cat, vals] of pendingEntries) {
          const total = vals.pendente + vals.atrasado;
          const color = vals.atrasado > 0 ? C.red : C.orange;
          const label = vals.atrasado > 0 ? `${cat} (Atrasado)` : `${cat} (Pendente)`;
          drawMetricCard(doc, 20 + pIdx * (pendW + 4), pendY, pendW, 20, label, formatCurrencyBRL(total), color);
          pIdx++;
        }
        drawMetricCard(doc, 20 + pIdx * (pendW + 4), pendY, pendW, 20, `Recebido (✅)`, formatCurrencyBRL(unitResumo.recebido), C.green);
      }

      // ── People details — ALL parties ──
      const hasPendingCards = pendingEntries.length > 0 || unitResumo.recebido > 0;
      const pY = hasPendingCards ? pendY + 28 : pendY;
      const colW = (pw - 60) / 4;

      // Proprietário
      drawInfoRow(doc, 20, pY, colW, "Proprietário", contrato.proprietario || "—");
      drawInfoRow(doc, 20 + colW, pY, colW, "CPF Proprietário", contrato.proprietario_cpf || proprietarioRelacionado?.cpf_cnpj || "—");
      drawInfoRow(doc, 20 + 2 * colW, pY, colW, "Tel. Proprietário", contrato.proprietario_telefone || proprietarioRelacionado?.telefone || "—");
      drawInfoRow(doc, 20 + 3 * colW, pY, colW, "E-mail Proprietário", contrato.proprietario_email || proprietarioRelacionado?.email || "—");

      // Inquilino 1
      let nextY = pY + 14;
      drawInfoRow(doc, 20, nextY, colW, "Inquilino", contrato.inquilino || contrato.cliente || "—");
      drawInfoRow(doc, 20 + colW, nextY, colW, "CPF Inquilino", contrato.inquilino_cpf || contrato.cliente_cpf || "—");
      drawInfoRow(doc, 20 + 2 * colW, nextY, colW, "Tel. Inquilino", contrato.inquilino_telefone || contrato.cliente_telefone || "—");
      drawInfoRow(doc, 20 + 3 * colW, nextY, colW, "E-mail Inquilino", contrato.inquilino_email || contrato.cliente_email || "—");

      // Inquilino 2
      if (contrato.inquilino2_nome) {
        nextY += 14;
        drawInfoRow(doc, 20, nextY, colW, "Inquilino 2", contrato.inquilino2_nome);
        drawInfoRow(doc, 20 + colW, nextY, colW, "CPF Inquilino 2", contrato.inquilino2_cpf || "—");
        drawInfoRow(doc, 20 + 2 * colW, nextY, colW, "Tel. Inquilino 2", contrato.inquilino2_telefone || "—");
        drawInfoRow(doc, 20 + 3 * colW, nextY, colW, "E-mail Inquilino 2", contrato.inquilino2_email || "—");
      }

      // Cônjuge
      if (contrato.conjuge_proprietario || contrato.conjuge_cpf) {
        nextY += 14;
        drawInfoRow(doc, 20, nextY, colW, "Cônjuge", contrato.conjuge_proprietario || "—");
        drawInfoRow(doc, 20 + colW, nextY, colW, "CPF Cônjuge", contrato.conjuge_cpf || "—");
        drawInfoRow(doc, 20 + 2 * colW, nextY, colW, "Tel. Cônjuge", contrato.conjuge_telefone || "—");
        drawInfoRow(doc, 20 + 3 * colW, nextY, colW, "E-mail Cônjuge", contrato.conjuge_email || "—");
      }

      // Fiador 1
      if (contrato.fiador_nome) {
        nextY += 14;
        drawInfoRow(doc, 20, nextY, colW, "Fiador", contrato.fiador_nome);
        drawInfoRow(doc, 20 + colW, nextY, colW, "CPF Fiador", contrato.fiador_cpf || "—");
        drawInfoRow(doc, 20 + 2 * colW, nextY, colW, "Tel. Fiador", contrato.fiador_telefone || "—");
        drawInfoRow(doc, 20 + 3 * colW, nextY, colW, "E-mail Fiador", contrato.fiador_email || "—");
      }

      // Fiador 2
      if (contrato.fiador2_nome) {
        nextY += 14;
        drawInfoRow(doc, 20, nextY, colW, "Fiador 2", contrato.fiador2_nome);
        drawInfoRow(doc, 20 + colW, nextY, colW, "CPF Fiador 2", contrato.fiador2_cpf || "—");
        drawInfoRow(doc, 20 + 2 * colW, nextY, colW, "Tel. Fiador 2", contrato.fiador2_telefone || "—");
        drawInfoRow(doc, 20 + 3 * colW, nextY, colW, "E-mail Fiador 2", contrato.fiador2_email || "—");
      }

      // ── SLIDE: Transaction history ──
      const txs = getTransacoesDoContrato({ contrato, imovel, transacoes: transacoesAluguel });
      if (txs.length > 0) {
        doc.addPage();
        drawSlideBg(doc);
        doc.setFillColor(...C.primary);
        doc.rect(0, 0, pw, 8, "F");

        drawSectionTitle(doc, 20, 18, "Histórico Financeiro");
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...C.textLight);
        doc.text(nome, 20, 40);

        const sorted = [...txs].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
        const resumo = resumirTransacoesContrato(sorted);

        const totalComissao = sorted
          .filter((t) => t.tipo === "entrada" && t.status === "confirmado")
          .reduce((s, t) => s + safeNumber((t as any).comissao_valor || 0), 0);
        const totalBruto = resumo.recebido;
        const totalLiquido = totalBruto - totalComissao;

        // Summary cards — 6 cards in 2 rows
        const smW = (pw - 60) / 3;
        const smY = 48;
        const smH = 22;
        drawMetricCard(doc, 20, smY, smW, smH, "Total Bruto", formatCurrencyBRL(totalBruto), C.primary);
        drawMetricCard(doc, 20 + smW + 6, smY, smW, smH, "Comissão Abatida", formatCurrencyBRL(totalComissao), C.orange);
        drawMetricCard(doc, 20 + 2 * (smW + 6), smY, smW, smH, "Líquido Proprietário", formatCurrencyBRL(totalLiquido), C.green);

        // Pending breakdown by category
        const sm2Y = smY + smH + 4;
        const histPendingTxs = sorted.filter((t) => t.tipo === "entrada" && (t.status === "pendente" || t.status === "atrasado"));
        const histPendByCat: Record<string, number> = {};
        for (const t of histPendingTxs) {
          const desc = (t.descricao || "").toLowerCase();
          let cat = "Aluguel";
          if (desc.includes("condomínio") || desc.includes("condominio")) cat = "Condomínio";
          else if (desc.includes("iptu")) cat = "IPTU";
          else if (desc.includes("seguro")) cat = "Seguro";
          else if (desc.includes("taxa")) cat = "Taxas";
          else if (t.categoria === "aluguel") cat = "Aluguel";
          else cat = "Outros";
          histPendByCat[cat] = (histPendByCat[cat] || 0) + safeNumber(t.valor);
        }
        const histPendEntries = Object.entries(histPendByCat);
        const sm2Cols = Math.max(histPendEntries.length + 1, 3);
        const sm2W = (pw - 60) / sm2Cols;
        let sm2Idx = 0;
        for (const [cat, val] of histPendEntries) {
          drawMetricCard(doc, 20 + sm2Idx * (sm2W + 4), sm2Y, sm2W, smH, `${cat} Pendente`, formatCurrencyBRL(val), C.orange);
          sm2Idx++;
        }
        drawMetricCard(doc, 20 + sm2Idx * (sm2W + 4), sm2Y, sm2W, smH, "Despesas Imóvel", formatCurrencyBRL(resumo.despesas), C.dark);

        const tableBody = sorted.map((t) => {
          const descricao = (t.descricao || "").trim() || "—";
          const comissaoVal = safeNumber((t as any).comissao_valor || 0);
          const bruto = safeNumber(t.valor);
          const liquido = bruto - comissaoVal;
          const isRecebido = t.status === "confirmado" && t.tipo === "entrada";
          return [
            formatDateBR(t.data),
            descricao.length > 30 ? descricao.slice(0, 28) + "…" : descricao,
            t.tipo === "entrada" ? "Receita" : "Despesa",
            formatCurrencyBRL(bruto),
            formatCurrencyBRL(comissaoVal),
            formatCurrencyBRL(liquido),
            isRecebido ? "✅ RECEBIDO" : STATUS_LABEL[t.status] || t.status || "—",
          ];
        });

        autoTable(doc, {
          head: [["Data", "Descrição", "Tipo", "Valor Total", "Comissão", "Líquido", "Status"]],
          body: tableBody,
          startY: sm2Y + smH + 6,
          theme: "plain",
          headStyles: {
            fillColor: C.primary,
            textColor: 255,
            fontSize: 7,
            fontStyle: "bold",
            cellPadding: 3,
          },
          styles: { fontSize: 6.5, cellPadding: 2.5, lineColor: [230, 235, 245], lineWidth: 0.3 },
          columnStyles: {
            0: { cellWidth: 22 },
            1: { cellWidth: "auto" },
            2: { cellWidth: 18, halign: "center" },
            3: { cellWidth: 26, halign: "right", fontStyle: "bold" },
            4: { cellWidth: 24, halign: "right" },
            5: { cellWidth: 26, halign: "right", fontStyle: "bold" },
            6: { cellWidth: 26, halign: "center" },
          },
          alternateRowStyles: { fillColor: [245, 248, 255] },
          margin: { left: 20, right: 20 },
          didParseCell: (d) => {
            if (d.column.index === 6 && d.section === "body") {
              const v = String(d.cell.raw);
              if (v.includes("RECEBIDO")) d.cell.styles.textColor = C.green;
              else if (v === "Pendente") d.cell.styles.textColor = C.orange;
              else if (v === "Atrasado") d.cell.styles.textColor = C.red;
            }
            if (d.column.index === 4 && d.section === "body") {
              d.cell.styles.textColor = C.orange;
            }
            if (d.column.index === 5 && d.section === "body") {
              d.cell.styles.textColor = C.green;
            }
          },
        });
      }
    }

    // ═══════════════════════════════════════════════
    // SLIDE: CONSOLIDATED SUMMARY
    // ═══════════════════════════════════════════════
    if (contratosLocacao.length > 1) {
      doc.addPage();
      drawSlideBg(doc);
      doc.setFillColor(...C.primary);
      doc.rect(0, 0, pw, 8, "F");

      drawSectionTitle(doc, 20, 18, "Resumo Consolidado");

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...C.textLight);
      doc.text(`Visão geral de ${contratosLocacao.length} unidades alugadas`, 20, 40);

      const rows = contratosLocacao.map((c) => {
        const im = getContratoImovel(c, imoveis);
        const tx = getTransacoesDoContrato({ contrato: c, imovel: im, transacoes: transacoesAluguel });
        const r = resumirTransacoesContrato(tx);
        const comissao = tx
          .filter((t) => t.tipo === "entrada" && t.status === "confirmado")
          .reduce((s, t) => s + safeNumber((t as any).comissao_valor || 0), 0);
        const cu = getCustoMensalTotal(c);
        return [
          getContratoImovelLabel(c, im),
          getContratoInquilino(c),
          formatCurrencyBRL(cu.aluguel),
          formatCurrencyBRL(comissao),
          formatCurrencyBRL(r.recebido - comissao),
          formatCurrencyBRL(r.pendente + r.atrasado),
        ];
      });

      autoTable(doc, {
        head: [["Unidade", "Inquilino", "Aluguel", "Comissão", "Líquido Propri.", "Pendente"]],
        body: rows,
        startY: 48,
        theme: "plain",
        headStyles: {
          fillColor: C.dark,
          textColor: 255,
          fontSize: 8,
          fontStyle: "bold",
          cellPadding: 3,
        },
        styles: { fontSize: 7.5, cellPadding: 2.5, lineColor: [230, 235, 245], lineWidth: 0.3 },
        columnStyles: {
          0: { cellWidth: 55 },
          1: { cellWidth: 45 },
          2: { cellWidth: 30, halign: "right" },
          3: { cellWidth: 30, halign: "right" },
          4: { cellWidth: 35, halign: "right", fontStyle: "bold" },
          5: { cellWidth: 30, halign: "right" },
        },
        alternateRowStyles: { fillColor: [245, 248, 255] },
        margin: { left: 20, right: 20 },
        didParseCell: (d) => {
          if (d.section === "body") {
            if (d.column.index === 3) d.cell.styles.textColor = C.orange;
            if (d.column.index === 4) d.cell.styles.textColor = C.green;
            if (d.column.index === 5) d.cell.styles.textColor = C.orange;
          }
        },
      });

      const tableEndY = (doc as any).lastAutoTable.finalY + 10;

      drawCard(doc, 20, tableEndY, pw - 40, 16, C.primary, 4);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...C.white);
      doc.text(
        `TOTAL  →  Aluguel: ${formatCurrencyBRL(totalAluguel)}  |  Comissão: ${formatCurrencyBRL(coverComissaoTotal)}  |  Líquido Proprietário: ${formatCurrencyBRL(coverRecebidoProprietario)}`,
        30,
        tableEndY + 10,
      );
    }

    // ═══════════════════════════════════════════════
    // SLIDE: BROKER INFO (last slide)
    // ═══════════════════════════════════════════════
    doc.addPage();
    drawSlideBg(doc);

    doc.setFillColor(...C.primary);
    doc.rect(0, 0, 8, ph, "F");

    drawSectionTitle(doc, 24, 30, "Informações do Responsável");

    const infoX = 24;
    let infoY = 58;
    const gap = 14;

    const infoItems: [string, string][] = [
      ["Empresa", brand],
      ["CRECI", brandCreci || "—"],
      ["Telefone", brandPhone || "—"],
      ["E-mail", brandEmail || "—"],
      ["Data do Relatório", new Date().toLocaleDateString("pt-BR")],
    ];

    for (const [label, value] of infoItems) {
      drawCard(doc, infoX, infoY, pw / 2 - 40, 10, C.white);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...C.textLight);
      doc.text(label, infoX + 6, infoY + 4);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...C.text);
      doc.text(value, infoX + 6, infoY + 8.5);
      infoY += gap;
    }

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...C.textLight);
    const rightX = pw / 2 + 20;
    doc.text("Este relatório foi gerado automaticamente", rightX, 65);
    doc.text("pelo sistema de gestão imobiliária.", rightX, 75);
    doc.text("Para dúvidas ou esclarecimentos,", rightX, 92);
    doc.text("entre em contato pelos canais acima.", rightX, 102);

    doc.setFontSize(8);
    doc.setTextColor(...C.muted);
    doc.text("Documento confidencial — Relatório detalhado para", rightX, ph - 40);
    doc.text("prestação de contas ao proprietário.", rightX, ph - 34);

    // ═══════════════════════════════════════════════
    // ADD FOOTERS TO ALL PAGES
    // ═══════════════════════════════════════════════
    const pageCount = doc.getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p);
      drawSlideFooter(doc, brand, p, pageCount);
    }

    // ═══════════════════════════════════════════════
    // SAVE
    // ═══════════════════════════════════════════════
    const suffix = filenameSuffix
      ? `_${filenameSuffix.replace(/[^a-zA-Z0-9_-]/g, "_")}`
      : "";
    const fileName = `relatorio_alugueis${suffix}_${new Date().toISOString().slice(0, 10)}.pdf`;
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
    console.error("Erro ao gerar relatório de aluguéis:", error);
    return false;
  }
}
