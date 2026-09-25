import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Contrato } from "@/hooks/useContratos";
import type { Transacao } from "@/hooks/useTransacoes";

const C = {
  primary: [37, 99, 235] as [number, number, number],
  primaryLight: [230, 236, 255] as [number, number, number],
  dark: [30, 41, 59] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  bg: [248, 250, 255] as [number, number, number],
  muted: [100, 116, 139] as [number, number, number],
  border: [226, 232, 240] as [number, number, number],
};

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const fmtDate = (d: string | null | undefined) => {
  if (!d) return "—";
  return new Date(d.includes("T") ? d : `${d}T00:00:00`).toLocaleDateString("pt-BR");
};

const safe = (v: string | null | undefined, fallback = "—") => (v && v.trim() ? v.trim() : fallback);

export interface InformeRendimentosOptions {
  contrato: Contrato;
  transacoes: Transacao[];
  anoReferencia: number;
  brandName?: string;
  brandCnpj?: string;
  brandPhone?: string;
  brandEmail?: string;
  brandCreci?: string;
}

export function exportInformeRendimentosPDF(opts: InformeRendimentosOptions) {
  const { contrato, transacoes, anoReferencia, brandName, brandCnpj, brandPhone, brandEmail, brandCreci } = opts;
  const doc = new jsPDF();
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const brand = brandName || "Imobiliária";
  const isLocacao = contrato.tipo === "Locação" || contrato.tipo === "Administração de Imóveis";

  // Filter transactions for the year
  const anoStr = String(anoReferencia);
  const txAno = transacoes.filter(t => {
    if (!t.data) return false;
    return t.data.startsWith(anoStr) && t.status === "confirmado";
  });

  const receitas = txAno.filter(t => t.tipo === "entrada");
  const despesas = txAno.filter(t => t.tipo === "saida");
  const totalReceitas = receitas.reduce((s, t) => s + (t.valor || 0), 0);
  const totalDespesas = despesas.reduce((s, t) => s + (t.valor || 0), 0);

  // Monthly breakdown
  const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const mensalReceitas = new Array(12).fill(0);
  const mensalDespesas = new Array(12).fill(0);
  receitas.forEach(t => {
    const m = new Date(t.data.includes("T") ? t.data : `${t.data}T00:00:00`).getMonth();
    mensalReceitas[m] += t.valor || 0;
  });
  despesas.forEach(t => {
    const m = new Date(t.data.includes("T") ? t.data : `${t.data}T00:00:00`).getMonth();
    mensalDespesas[m] += t.valor || 0;
  });

  // ── Header ──
  doc.setFillColor(...C.primary);
  doc.rect(0, 0, pw, 38, "F");
  doc.setTextColor(...C.white);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("INFORME DE RENDIMENTOS", pw / 2, 14, { align: "center" });
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(`Ano-Calendário ${anoReferencia}`, pw / 2, 22, { align: "center" });
  doc.setFontSize(9);
  doc.text(brand.toUpperCase(), pw / 2, 30, { align: "center" });
  if (brandCnpj) {
    doc.setFontSize(8);
    doc.text(`CNPJ: ${brandCnpj}`, pw / 2, 35, { align: "center" });
  }

  let y = 46;

  // ── Dados da Fonte Pagadora (Imobiliária) ──
  doc.setFillColor(...C.primaryLight);
  doc.roundedRect(14, y, pw - 28, 24, 2, 2, "F");
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...C.dark);
  doc.text("FONTE PAGADORA / ADMINISTRADORA", 18, y + 7);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const fonteParts = [
    `Razão Social: ${brand}`,
    brandCnpj ? `CNPJ: ${brandCnpj}` : null,
    brandPhone ? `Tel: ${brandPhone}` : null,
    brandEmail ? `E-mail: ${brandEmail}` : null,
    brandCreci ? `CRECI: ${brandCreci}` : null,
  ].filter(Boolean);
  doc.text(fonteParts.join("   |   "), 18, y + 14);
  if (fonteParts.length > 3) {
    doc.text(fonteParts.slice(3).join("   |   "), 18, y + 20);
  }
  y += 30;

  if (isLocacao) {
    // ── LOCAÇÃO: Proprietário e Inquilino ──

    // Proprietário (Beneficiário)
    doc.setFillColor(...C.bg);
    doc.roundedRect(14, y, pw - 28, 22, 2, 2, "F");
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...C.primary);
    doc.text("BENEFICIÁRIO (PROPRIETÁRIO / LOCADOR)", 18, y + 7);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...C.dark);
    const propParts = [
      `Nome: ${safe(contrato.proprietario)}`,
      `CPF/CNPJ: ${safe(contrato.proprietario_cpf)}`,
      contrato.proprietario_email ? `E-mail: ${contrato.proprietario_email}` : null,
      contrato.proprietario_telefone ? `Tel: ${contrato.proprietario_telefone}` : null,
    ].filter(Boolean);
    doc.text(propParts.join("   |   "), 18, y + 14);
    y += 28;

    // Inquilino (Pagador)
    doc.setFillColor(...C.bg);
    doc.roundedRect(14, y, pw - 28, 22, 2, 2, "F");
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...C.primary);
    doc.text("PAGADOR (INQUILINO / LOCATÁRIO)", 18, y + 7);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...C.dark);
    const inqParts = [
      `Nome: ${safe(contrato.inquilino)}`,
      `CPF: ${safe(contrato.inquilino_cpf)}`,
      contrato.inquilino_email ? `E-mail: ${contrato.inquilino_email}` : null,
      contrato.inquilino_telefone ? `Tel: ${contrato.inquilino_telefone}` : null,
    ].filter(Boolean);
    doc.text(inqParts.join("   |   "), 18, y + 14);
    y += 28;
  } else {
    // ── VENDA: Comprador e Vendedor ──

    // Vendedor (Proprietário)
    doc.setFillColor(...C.bg);
    doc.roundedRect(14, y, pw - 28, 22, 2, 2, "F");
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...C.primary);
    doc.text("VENDEDOR (PROPRIETÁRIO)", 18, y + 7);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...C.dark);
    const vendParts = [
      `Nome: ${safe(contrato.proprietario)}`,
      `CPF/CNPJ: ${safe(contrato.proprietario_cpf)}`,
      contrato.proprietario_email ? `E-mail: ${contrato.proprietario_email}` : null,
      contrato.proprietario_telefone ? `Tel: ${contrato.proprietario_telefone}` : null,
    ].filter(Boolean);
    doc.text(vendParts.join("   |   "), 18, y + 14);
    y += 28;

    // Comprador
    doc.setFillColor(...C.bg);
    doc.roundedRect(14, y, pw - 28, 22, 2, 2, "F");
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...C.primary);
    doc.text("COMPRADOR (ADQUIRENTE)", 18, y + 7);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...C.dark);
    const compParts = [
      `Nome: ${safe(contrato.cliente)}`,
      `CPF: ${safe(contrato.cliente_cpf)}`,
      contrato.cliente_email ? `E-mail: ${contrato.cliente_email}` : null,
      contrato.cliente_telefone ? `Tel: ${contrato.cliente_telefone}` : null,
    ].filter(Boolean);
    doc.text(compParts.join("   |   "), 18, y + 14);
    y += 28;
  }

  // ── Dados do Imóvel ──
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...C.dark);
  doc.text("DADOS DO IMÓVEL / CONTRATO", 14, y + 2);
  y += 6;

  const imovelData: [string, string][] = [
    ["Contrato", safe(contrato.titulo)],
    ["Código", safe(contrato.codigo_contrato)],
    ["Tipo", contrato.tipo],
    ["Vigência", `${fmtDate(contrato.data_inicio)} a ${fmtDate(contrato.data_fim)}`],
    ["Valor Contrato", fmt(contrato.valor)],
  ];
  if (isLocacao) {
    imovelData.push(["Valor Aluguel Mensal", fmt(contrato.valor)]);
    if (contrato.valor_condominio) imovelData.push(["Condomínio", fmt(contrato.valor_condominio)]);
    if (contrato.valor_iptu) imovelData.push(["IPTU", fmt(contrato.valor_iptu)]);
  }
  if (contrato.matricula) imovelData.push(["Matrícula", contrato.matricula]);
  if (contrato.inscricao_iptu) imovelData.push(["Inscrição IPTU", contrato.inscricao_iptu]);

  autoTable(doc, {
    startY: y,
    body: imovelData,
    theme: "grid",
    margin: { left: 14, right: 14 },
    styles: { fontSize: 8, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 55, fillColor: C.bg },
      1: { cellWidth: "auto" },
    },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // ── Demonstrativo Mensal ──
  if (y > ph - 80) { doc.addPage(); y = 20; }

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...C.dark);
  doc.text(`DEMONSTRATIVO DE RENDIMENTOS — ${anoReferencia}`, 14, y + 2);
  y += 6;

  const tableBody: (string | number)[][] = meses.map((mes, i) => [
    mes,
    fmt(mensalReceitas[i]),
    fmt(mensalDespesas[i]),
    fmt(mensalReceitas[i] - mensalDespesas[i]),
  ]);
  tableBody.push([
    "TOTAL ANUAL",
    fmt(totalReceitas),
    fmt(totalDespesas),
    fmt(totalReceitas - totalDespesas),
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Mês", "Rendimentos Brutos (R$)", "Despesas/Deduções (R$)", "Rendimento Líquido (R$)"]],
    body: tableBody,
    theme: "grid",
    margin: { left: 14, right: 14 },
    styles: { fontSize: 8, cellPadding: 3, halign: "right" },
    headStyles: { fillColor: C.primary, textColor: 255, halign: "center", fontSize: 8 },
    columnStyles: { 0: { halign: "left", fontStyle: "bold" } },
    didParseCell: (data: any) => {
      if (data.row.index === tableBody.length - 1) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = C.primaryLight;
      }
    },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // ── Resumo para Declaração ──
  if (y > ph - 60) { doc.addPage(); y = 20; }

  doc.setFillColor(...C.primaryLight);
  doc.roundedRect(14, y, pw - 28, 36, 2, 2, "F");
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...C.primary);
  doc.text("RESUMO PARA DECLARAÇÃO DE IMPOSTO DE RENDA", 18, y + 7);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...C.dark);

  const rendLiquido = totalReceitas - totalDespesas;
  doc.text(`Total de Rendimentos Brutos:  ${fmt(totalReceitas)}`, 18, y + 15);
  doc.text(`Total de Despesas/Deduções:   ${fmt(totalDespesas)}`, 18, y + 22);
  doc.setFont("helvetica", "bold");
  doc.text(`Rendimento Líquido Tributável: ${fmt(rendLiquido)}`, 18, y + 30);
  y += 42;

  // ── Comissão de Administração ──
  if (isLocacao && (contrato.comissao_valor || contrato.comissao_percentual)) {
    if (y > ph - 30) { doc.addPage(); y = 20; }
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...C.dark);
    doc.text("TAXA DE ADMINISTRAÇÃO IMOBILIÁRIA", 14, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const comissaoAnual = (contrato.comissao_valor || 0) * 12;
    const pctLabel = contrato.comissao_percentual ? `${contrato.comissao_percentual}%` : "";
    doc.text(`Percentual: ${pctLabel}   |   Valor Mensal: ${fmt(contrato.comissao_valor || 0)}   |   Valor Anual: ${fmt(comissaoAnual)}`, 14, y + 6);
    y += 14;
  }

  // ── Impostos retidos ──
  if (contrato.imposto_valor && contrato.imposto_valor > 0) {
    if (y > ph - 30) { doc.addPage(); y = 20; }
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("IMPOSTO RETIDO NA FONTE", 14, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const impostoAnual = (contrato.imposto_valor || 0) * 12;
    doc.text(`Tipo: ${safe(contrato.imposto_tipo, "IRRF")}   |   Valor Mensal: ${fmt(contrato.imposto_valor)}   |   Total Anual Estimado: ${fmt(impostoAnual)}`, 14, y + 6);
    y += 14;
  }

  // ── Observação Legal ──
  if (y > ph - 40) { doc.addPage(); y = 20; }
  doc.setDrawColor(...C.border);
  doc.line(14, y, pw - 14, y);
  y += 6;
  doc.setFontSize(7);
  doc.setTextColor(...C.muted);
  const avisoLines = doc.splitTextToSize(
    "Este documento é um informe de rendimentos emitido pela administradora para fins de Declaração de Imposto de Renda Pessoa Física (DIRPF). " +
    "Os valores apresentados referem-se ao ano-calendário indicado. Confira os dados junto à Receita Federal. " +
    "Documento gerado automaticamente pelo sistema " + brand + ".",
    pw - 28
  );
  doc.text(avisoLines, 14, y);
  y += avisoLines.length * 3.5 + 4;

  // ── Footer ──
  doc.setDrawColor(...C.border);
  doc.line(14, ph - 18, pw - 14, ph - 18);
  doc.setFontSize(7);
  doc.setTextColor(...C.muted);
  doc.text(`${brand} — Informe de Rendimentos ${anoReferencia}`, pw / 2, ph - 13, { align: "center" });
  doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}`, pw / 2, ph - 9, { align: "center" });

  const nomeBase = isLocacao
    ? `informe-rendimentos-${safe(contrato.proprietario, "proprietario").replace(/\s+/g, "_")}`
    : `informe-rendimentos-${safe(contrato.cliente, "comprador").replace(/\s+/g, "_")}`;
  doc.save(`${nomeBase}-${anoReferencia}.pdf`);
  return true;
}

export function exportInformeRendimentosBatch(opts: {
  contratos: Contrato[];
  transacoes: Transacao[];
  anoReferencia: number;
  brandName?: string;
  brandCnpj?: string;
  brandPhone?: string;
  brandEmail?: string;
  brandCreci?: string;
}) {
  let count = 0;
  const ativosOuAssinados = opts.contratos.filter(c =>
    ["ativo", "assinado", "vencendo", "inativo"].includes(c.status)
  );

  for (const contrato of ativosOuAssinados) {
    // Get transactions related to this contract by imovel_id or description match
    const txContrato = opts.transacoes.filter(t =>
      (t.imovel_id && t.imovel_id === contrato.imovel_id) ||
      (t.descricao && contrato.titulo && t.descricao.includes(contrato.titulo))
    );

    try {
      const result = exportInformeRendimentosPDF({
        contrato,
        transacoes: txContrato,
        anoReferencia: opts.anoReferencia,
        brandName: opts.brandName,
        brandCnpj: opts.brandCnpj,
        brandPhone: opts.brandPhone,
        brandEmail: opts.brandEmail,
        brandCreci: opts.brandCreci,
      });
      if (result) count++;
    } catch (e) {
      console.error("Erro ao gerar informe para contrato:", contrato.titulo, e);
    }
  }
  return count;
}