import jsPDF from "jspdf";
import { FORMAS_PAGAMENTO, STATUS_PROPOSTA, type Proposta } from "@/hooks/usePropostas";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const fmtDate = (d: string) => new Date(d).toLocaleDateString("pt-BR");
const statusLabel = (id: string) => STATUS_PROPOSTA.find(s => s.id === id)?.label || id;
const pgtoLabel = (id: string) => FORMAS_PAGAMENTO.find(f => f.id === id)?.label || id;

interface ExportOptions {
  proposta: Proposta;
  imovelTitulo?: string;
  leadNome?: string;
  brandName?: string;
}

export function exportPropostaIndividualPDF({ proposta, imovelTitulo, leadNome, brandName }: ExportOptions) {
  const doc = new jsPDF();
  const pw = doc.internal.pageSize.getWidth();
  const brand = brandName || "ImobPro";
  const primary: [number, number, number] = [65, 144, 240];
  const dark: [number, number, number] = [20, 24, 40];
  const muted: [number, number, number] = [130, 135, 155];
  const cardBg: [number, number, number] = [245, 246, 252];

  let y = 0;

  // ── Header band ──
  doc.setFillColor(...primary);
  doc.rect(0, 0, pw, 44, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(brand, 16, 18);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Proposta Comercial", 16, 28);

  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text(`P${proposta.numero_proposta}`, pw - 16, 22, { align: "right" });

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Emitida em ${fmtDate(proposta.created_at)}`, pw - 16, 32, { align: "right" });

  y = 56;

  // ── Status badge ──
  const stLabel = statusLabel(proposta.status);
  const statusColors: Record<string, [number, number, number]> = {
    em_negociacao: [234, 179, 8],
    aceita: [34, 197, 94],
    recusada: [239, 68, 68],
    cancelada: [156, 163, 175],
  };
  const stColor = statusColors[proposta.status] || primary;
  doc.setFillColor(...stColor);
  const stWidth = doc.getTextWidth(stLabel) * 1.1 + 12;
  doc.roundedRect(16, y - 5, stWidth, 10, 3, 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(stLabel, 22, y + 2);

  y += 16;

  // ── Value highlight ──
  doc.setFillColor(...cardBg);
  doc.roundedRect(16, y, pw - 32, 28, 4, 4, "F");
  doc.setFontSize(10);
  doc.setTextColor(...muted);
  doc.setFont("helvetica", "normal");
  doc.text("Valor da Proposta", 24, y + 10);
  doc.setFontSize(22);
  doc.setTextColor(...dark);
  doc.setFont("helvetica", "bold");
  doc.text(fmt(proposta.valor), 24, y + 22);
  y += 38;

  // ── Helper for section titles ──
  const sectionTitle = (label: string) => {
    doc.setFillColor(...primary);
    doc.rect(16, y, 3, 10, "F");
    doc.setFontSize(12);
    doc.setTextColor(...dark);
    doc.setFont("helvetica", "bold");
    doc.text(label, 24, y + 8);
    y += 16;
  };

  // ── Helper for info rows ──
  const infoRow = (label: string, value: string) => {
    doc.setFontSize(9);
    doc.setTextColor(...muted);
    doc.setFont("helvetica", "normal");
    doc.text(label, 24, y);
    doc.setTextColor(...dark);
    doc.setFont("helvetica", "bold");
    doc.text(value || "—", 80, y);
    y += 8;
  };

  // ── Client info ──
  sectionTitle("Dados do Cliente");
  infoRow("Nome:", proposta.cliente_nome);
  infoRow("Telefone:", proposta.cliente_telefone || "Não informado");
  infoRow("E-mail:", proposta.cliente_email || "Não informado");
  if (leadNome) {
    infoRow("Lead:", leadNome);
  }
  y += 6;

  // ── Proposal details ──
  sectionTitle("Detalhes da Proposta");
  infoRow("Imóvel:", imovelTitulo || "—");
  infoRow("Pagamento:", pgtoLabel(proposta.forma_pagamento));
  infoRow("Status:", stLabel);
  infoRow("Criada em:", fmtDate(proposta.created_at));
  infoRow("Atualizada:", fmtDate(proposta.updated_at));
  y += 6;

  // ── Observations ──
  if (proposta.observacoes) {
    sectionTitle("Observações");
    doc.setFontSize(9);
    doc.setTextColor(...dark);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(proposta.observacoes, pw - 48);
    doc.text(lines, 24, y);
    y += lines.length * 5 + 10;
  }

  // ── Footer divider ──
  const pageH = doc.internal.pageSize.getHeight();
  doc.setDrawColor(cardBg[0], cardBg[1], cardBg[2]);
  doc.setLineWidth(0.5);
  doc.line(16, pageH - 20, pw - 16, pageH - 20);

  doc.setFontSize(7);
  doc.setTextColor(...muted);
  doc.text(
    `${brand} • Documento gerado em ${fmtDate(new Date().toISOString())} às ${new Date().toLocaleTimeString("pt-BR")}`,
    pw / 2,
    pageH - 12,
    { align: "center" }
  );

  // ── Save ──
  try {
    doc.save(`proposta_P${proposta.numero_proposta}_${proposta.cliente_nome.replace(/\s+/g, "_")}.pdf`);
  } catch {
    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `proposta_P${proposta.numero_proposta}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
