import jsPDF from "jspdf";
import type { Contrato } from "@/hooks/useContratos";
import { formatCurrencyBRL, formatDateBR, safeNumber, isActiveRentalContract } from "@/lib/relatorioAluguelUtils";

interface ReciboRepasseOptions {
  contrato: Contrato;
  mesReferencia: Date;
  brandName?: string;
  brandCnpj?: string;
  brandPhone?: string;
  brandEmail?: string;
  taxaAdministracao?: number; // percentual, ex: 10
  taxasExtras?: Array<{ descricao: string; valor: number }>;
}

const formatMesAno = (d: Date) => {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${m}/${d.getFullYear()}`;
};

const formatPeriodoRef = (contrato: Contrato, mes: Date) => {
  const dia = contrato.dia_vencimento_aluguel || 12;
  const m = mes.getMonth();
  const y = mes.getFullYear();
  const inicio = new Date(y, m, dia);
  const fim = new Date(y, m + 1, dia);
  return `${formatDateBR(inicio.toISOString().slice(0, 10))} a ${formatDateBR(fim.toISOString().slice(0, 10))}`;
};

const formatVigencia = (contrato: Contrato) => {
  const inicio = contrato.data_inicio;
  const fim = contrato.data_fim;
  if (!inicio || !fim) return "";
  const d1 = new Date(inicio + "T00:00:00");
  const d2 = new Date(fim + "T00:00:00");
  const meses = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24 * 30));
  return `${formatDateBR(inicio)} a ${formatDateBR(fim)} Vigência: ${meses} Meses`;
};

export function exportReciboRepassePDF({
  contrato,
  mesReferencia,
  brandName = "ImobPro",
  brandCnpj,
  brandPhone,
  brandEmail,
  taxaAdministracao = 10,
  taxasExtras = [],
}: ReciboRepasseOptions) {
  try {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pw = doc.internal.pageSize.getWidth();
    const margin = 20;
    const contentW = pw - margin * 2;
    let y = 20;

    // Header - Brand name
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text(brandName, pw / 2, y, { align: "center" });
    y += 7;

    if (brandCnpj) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text(`CNPJ: ${brandCnpj}`, pw / 2, y, { align: "center" });
      y += 8;
    } else {
      y += 4;
    }

    // Separator line
    doc.setDrawColor(66, 99, 235);
    doc.setLineWidth(0.8);
    doc.line(margin, y, pw - margin, y);
    y += 10;

    // Title - RECIBO MÊS
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(66, 99, 235);
    doc.text(`RECIBO – MÊS ${formatMesAno(mesReferencia)}`, pw / 2, y, { align: "center" });
    y += 12;

    // Contract info section
    const drawField = (label: string, value: string, yPos: number, bold = false) => {
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 41, 59);
      doc.text(`${label}: `, margin, yPos);
      const labelW = doc.getTextWidth(`${label}: `);
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setTextColor(50, 50, 50);
      const lines = doc.splitTextToSize(value, contentW - labelW);
      doc.text(lines[0] || "—", margin + labelW, yPos);
      return lines.length > 1 ? yPos + (lines.length * 5) : yPos + 6;
    };

    // Contrato (endereço)
    y = drawField("Contrato", contrato.titulo || "—", y);

    // Locatário (inquilino)
    const locatarioInfo = [
      contrato.inquilino || contrato.cliente || "—",
      contrato.inquilino_cpf ? `CPF Nº ${contrato.inquilino_cpf}` : "",
    ].filter(Boolean).join("    ");
    y = drawField("Locatário", locatarioInfo, y);

    // Locador (proprietário)
    const locadorInfo = [
      contrato.proprietario || "—",
      contrato.proprietario_cpf ? `CPF Nº ${contrato.proprietario_cpf}` : "",
    ].filter(Boolean).join("    ");
    y = drawField("Locador", locadorInfo, y);

    // Email do locador
    if (contrato.proprietario_email) {
      y = drawField("Email", contrato.proprietario_email, y);
    }

    y += 2;

    // Referência
    y = drawField("Referência", formatPeriodoRef(contrato, mesReferencia), y);

    // Período / Vigência
    y = drawField("Período", formatVigencia(contrato), y);

    y += 2;

    // Forma de pagamento
    const pagamentoLines: string[] = [];
    if (contrato.proprietario_pix) {
      pagamentoLines.push(`PIX: ${contrato.proprietario_pix}`);
    }
    if (contrato.proprietario_banco) {
      const banco = contrato.proprietario_banco;
      const ag = contrato.proprietario_agencia ? `Ag ${contrato.proprietario_agencia}` : "";
      const cc = contrato.proprietario_conta ? `CC ${contrato.proprietario_conta}` : "";
      pagamentoLines.push([`Banco ${banco}`, ag, cc].filter(Boolean).join("  "));
    }
    if (pagamentoLines.length > 0) {
      y = drawField("Forma pagamento", pagamentoLines.join("  |  "), y);
    }

    y += 4;

    // Separator
    doc.setDrawColor(200, 210, 230);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pw - margin, y);
    y += 8;

    // Descrição do repasse - Title
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(66, 99, 235);
    doc.text("Descrição do repasse:", margin, y);
    y += 8;

    // Table
    const aluguel = safeNumber(contrato.valor);
    const taxaAdm = aluguel * (taxaAdministracao / 100);
    let totalExtras = 0;

    // Table header background
    doc.setFillColor(240, 244, 255);
    doc.rect(margin, y - 4, contentW, 8, "F");

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text("Descrição", margin + 4, y);
    doc.text("Valor", pw - margin - 4, y, { align: "right" });
    y += 6;

    // Separator
    doc.setDrawColor(66, 99, 235);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pw - margin, y);
    y += 6;

    // Aluguel row
    const diaVenc = contrato.dia_vencimento_aluguel || 12;
    const mesAtual = mesReferencia.getMonth();
    const anoAtual = mesReferencia.getFullYear();
    const mesProx = mesAtual + 1 > 11 ? 0 : mesAtual + 1;
    const anoProx = mesAtual + 1 > 11 ? anoAtual + 1 : anoAtual;
    const periodoAluguel = `${String(diaVenc).padStart(2, "0")}/${String(mesAtual + 1).padStart(2, "0")}/${anoAtual} – ${String(diaVenc).padStart(2, "0")}/${String(mesProx + 1).padStart(2, "0")}/${anoProx}`;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(50, 50, 50);
    doc.text(`Aluguel - ${periodoAluguel}`, margin + 4, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(22, 163, 74);
    doc.text(formatCurrencyBRL(aluguel), pw - margin - 4, y, { align: "right" });
    y += 6;

    // Linha separadora
    doc.setDrawColor(230, 235, 245);
    doc.setLineWidth(0.2);
    doc.line(margin, y - 2, pw - margin, y - 2);

    // Comissão imobiliária (taxa administração)
    doc.setFont("helvetica", "normal");
    doc.setTextColor(50, 50, 50);
    doc.text(`Comissão Imobiliária (Taxa Adm.) – ${taxaAdministracao}%`, margin + 4, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(220, 38, 38);
    doc.text(`- ${formatCurrencyBRL(taxaAdm)}`, pw - margin - 4, y, { align: "right" });
    y += 6;

    // Imposto da imobiliária
    const impostoPerc = safeNumber(contrato.imposto_percentual);
    const impostoValor = safeNumber(contrato.imposto_valor);
    if (impostoValor > 0 || impostoPerc > 0) {
      doc.setDrawColor(230, 235, 245);
      doc.line(margin, y - 2, pw - margin, y - 2);

      const impostoLabel = contrato.imposto_tipo
        ? `Imposto (${contrato.imposto_tipo}) – ${impostoPerc}%`
        : `Imposto – ${impostoPerc}%`;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(50, 50, 50);
      doc.text(impostoLabel, margin + 4, y);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(220, 38, 38);
      doc.text(`- ${formatCurrencyBRL(impostoValor)}`, pw - margin - 4, y, { align: "right" });
      y += 6;
    }

    // Taxas extras
    for (const taxa of taxasExtras) {
      doc.setDrawColor(230, 235, 245);
      doc.line(margin, y - 2, pw - margin, y - 2);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(50, 50, 50);
      doc.text(`Taxa Extra - ${taxa.descricao || ""}`, margin + 4, y);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(220, 38, 38);
      doc.text(`- ${formatCurrencyBRL(taxa.valor)}`, pw - margin - 4, y, { align: "right" });
      totalExtras += taxa.valor;
      y += 6;
    }

    // Condomínio (if applicable)
    const condominio = safeNumber(contrato.valor_condominio);
    if (condominio > 0) {
      doc.setDrawColor(230, 235, 245);
      doc.line(margin, y - 2, pw - margin, y - 2);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(50, 50, 50);
      doc.text("Condomínio", margin + 4, y);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(220, 38, 38);
      doc.text(`- ${formatCurrencyBRL(condominio)}`, pw - margin - 4, y, { align: "right" });
      y += 6;
    }

    // IPTU mensal (if applicable)
    const iptuAnual = safeNumber(contrato.valor_iptu);
    const iptuMensal = contrato.iptu_parcelado ? iptuAnual / 12 : 0;
    if (iptuMensal > 0) {
      doc.setDrawColor(230, 235, 245);
      doc.line(margin, y - 2, pw - margin, y - 2);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(50, 50, 50);
      doc.text("IPTU (parcela mensal)", margin + 4, y);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(220, 38, 38);
      doc.text(`- ${formatCurrencyBRL(iptuMensal)}`, pw - margin - 4, y, { align: "right" });
      y += 6;
    }

    y += 2;

    // Aluguel recebido (subtotal)
    doc.setDrawColor(200, 210, 230);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pw - margin, y);
    y += 6;

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(22, 163, 74);
    doc.text("Aluguel recebido", margin + 4, y);
    doc.text(formatCurrencyBRL(aluguel), pw - margin - 4, y, { align: "right" });
    y += 6;

    doc.setFont("helvetica", "bold");
    doc.setTextColor(220, 38, 38);
    doc.text("(-) Deduções totais", margin + 4, y);
    doc.text(`- ${formatCurrencyBRL(taxaAdm + impostoValor + totalExtras + condominio + iptuMensal)}`, pw - margin - 4, y, { align: "right" });
    y += 6;

    // Total line
    doc.setDrawColor(66, 99, 235);
    doc.setLineWidth(0.8);
    doc.line(margin, y, pw - margin, y);
    y += 6;

    const totalRepasse = aluguel - taxaAdm - impostoValor - totalExtras - condominio - iptuMensal;

    doc.setFillColor(66, 99, 235);
    doc.roundedRect(margin, y - 4, contentW, 10, 2, 2, "F");
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text("Total para repasse ao proprietário", margin + 6, y + 2);
    doc.text(formatCurrencyBRL(totalRepasse), pw - margin - 6, y + 2, { align: "right" });
    y += 16;

    // Data do pagamento
    const hoje = new Date();
    y = drawField("Pagamento em", formatDateBR(hoje.toISOString().slice(0, 10)), y);

    y += 10;

    // Informações para IR section - calculate dynamic height
    const irLines: string[] = [
      `Locador: ${contrato.proprietario || "—"}`,
      `CPF/CNPJ: ${contrato.proprietario_cpf || "—"}   RG: ${contrato.proprietario_rg || "—"}`,
      `Email: ${contrato.proprietario_email || "—"}   Tel: ${contrato.proprietario_telefone || "—"}`,
      "",
      `Locatário: ${contrato.inquilino || contrato.cliente || "—"}`,
      `CPF: ${contrato.inquilino_cpf || contrato.cliente_cpf || "—"}   RG: ${contrato.inquilino_rg || contrato.cliente_rg || "—"}`,
      `Email: ${contrato.inquilino_email || contrato.cliente_email || "—"}`,
      "",
      `Aluguel bruto mensal: ${formatCurrencyBRL(aluguel)}`,
      `Comissão imobiliária (${taxaAdministracao}%): ${formatCurrencyBRL(taxaAdm)}`,
      ...(impostoValor > 0 ? [`Imposto ${contrato.imposto_tipo || ""} (${impostoPerc}%): ${formatCurrencyBRL(impostoValor)}`] : []),
      `Valor líquido repassado: ${formatCurrencyBRL(totalRepasse)}`,
    ];

    const irBoxH = 12 + irLines.length * 5;
    doc.setFillColor(248, 250, 255);
    doc.roundedRect(margin, y, contentW, irBoxH, 3, 3, "F");
    doc.setDrawColor(66, 99, 235);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, y, contentW, irBoxH, 3, 3, "S");

    y += 8;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(66, 99, 235);
    doc.text("Dados para Imposto de Renda", margin + 6, y);
    y += 7;

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(50, 50, 50);

    for (const line of irLines) {
      if (line === "") {
        y += 2;
      } else {
        doc.text(line, margin + 6, y);
        y += 5;
      }
    }

    y += 10;

    // Footer
    doc.setDrawColor(200, 210, 230);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pw - margin, y);
    y += 6;

    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(140, 150, 170);
    doc.text("Este recibo foi gerado automaticamente pelo sistema de gestão imobiliária.", margin, y);
    y += 4;
    if (brandPhone) doc.text(`📞 ${brandPhone}`, margin, y);
    if (brandEmail) doc.text(`📧 ${brandEmail}`, margin + 50, y);

    // Save
    const mesStr = String(mesReferencia.getMonth() + 1).padStart(2, "0");
    const anoStr = mesReferencia.getFullYear();
    const tituloSafe = (contrato.titulo || "contrato").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);
    const fileName = `RECIBO_${tituloSafe}_${mesStr}-${anoStr}.pdf`;

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
    console.error("Erro ao gerar recibo de repasse:", error);
    return false;
  }
}

/** Export recibos for all active rental contracts */
export function exportRecibosRepasseBatch(options: {
  contratos: Contrato[];
  mesReferencia: Date;
  brandName?: string;
  brandCnpj?: string;
  brandPhone?: string;
  brandEmail?: string;
  taxaAdministracao?: number;
}) {
  const locacoes = options.contratos.filter(isActiveRentalContract);
  let gerados = 0;

  for (const contrato of locacoes) {
    const result = exportReciboRepassePDF({
      contrato,
      mesReferencia: options.mesReferencia,
      brandName: options.brandName,
      brandCnpj: options.brandCnpj,
      brandPhone: options.brandPhone,
      brandEmail: options.brandEmail,
      taxaAdministracao: options.taxaAdministracao,
    });
    if (result) gerados++;
  }

  return gerados;
}
