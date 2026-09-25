import jsPDF from "jspdf";
import "jspdf-autotable";

import {
  addContratoPdfFooter,
  ensureContratoPdfSpace,
  formatContratoPdfCurrency,
  formatContratoPdfDate,
  getContratoPdfLastY,
  pushContratoPdfRow,
  pushContratoPdfSection,
  sanitizeContratoPdfFilename,
  saveContratoPdf,
  safeContratoPdfText,
  type ContratoPdfTableRow,
} from "./contratoPdfUtils";

interface ContratoData {
  titulo: string;
  cliente: string;
  tipo: string;
  valor: number;
  status: string;
  data_inicio: string | null;
  data_fim: string | null;
  inquilino?: string | null;
  inquilino_telefone?: string | null;
  inquilino_cpf?: string | null;
  proprietario?: string | null;
  proprietario_telefone?: string | null;
  proprietario_cpf?: string | null;
  matricula?: string | null;
  dia_vencimento_aluguel?: number;
  indice_correcao?: string;
  percentual_correcao?: number;
  data_proxima_correcao?: string | null;
  data_vencimento_apolice?: string | null;
  tipo_garantia?: string;
  vistoria_entrada?: boolean;
  vistoria_video?: boolean;
  apolice_seguro?: boolean;
  observacoes?: string | null;
  numero_agua?: string | null;
  numero_luz?: string | null;
  inscricao_iptu?: string | null;
  valor_iptu?: number | null;
  iptu_parcelado?: boolean | null;
  valor_condominio?: number | null;
  condominio_inclui?: string | null;
  comissao_percentual?: number | null;
  comissao_valor?: number | null;
  corretor_nome?: string | null;
  corretor_comissao_percentual?: number | null;
  corretor_comissao_valor?: number | null;
  parceiro_nome?: string | null;
  parceiro_comissao_percentual?: number | null;
  parceiro_comissao_valor?: number | null;
  captador_nome?: string | null;
  captador_comissao_percentual?: number | null;
  captador_comissao_valor?: number | null;
  imposto_tipo?: string | null;
  imposto_percentual?: number | null;
  imposto_valor?: number | null;
  cliente_telefone?: string | null;
  cliente_cpf?: string | null;
  cliente_email?: string | null;
  canal_origem?: string | null;
  numero_unidade?: string | null;
  inquilino2_nome?: string | null;
  inquilino2_cpf?: string | null;
  inquilino2_telefone?: string | null;
  inquilino2_email?: string | null;
}

interface ProprietarioData {
  nome: string;
  cpf_cnpj?: string | null;
  telefone?: string | null;
  email?: string | null;
  endereco?: string | null;
  cidade?: string | null;
  estado?: string | null;
  banco?: string | null;
  agencia?: string | null;
  conta?: string | null;
  pix?: string | null;
}

const garantiaLabels: Record<string, string> = {
  seguro_fianca: "Seguro Fiança",
  caucao: "Caução",
  fiador: "Fiador",
  titulo_capitalizacao: "Título de Capitalização",
  renda_locatario: "Apenas Renda do Locatário",
};

const RENTAL_CONTRACT_TYPES = new Set(["Locação", "Administração de Imóveis"]);

function isRentalContract(tipo: string | null | undefined) {
  return RENTAL_CONTRACT_TYPES.has(safeContratoPdfText(tipo, ""));
}

function renderTable(
  doc: jsPDF,
  rows: ContratoPdfTableRow[],
  startY: number,
  headFillColor: [number, number, number],
  alternateRowFillColor: [number, number, number],
) {
  (doc as jsPDF & { autoTable: (options: Record<string, unknown>) => void }).autoTable({
    startY,
    head: [["Campo", "Valor"]],
    body: rows,
    theme: "striped",
    headStyles: {
      fillColor: headFillColor,
      textColor: 255,
      fontSize: 9,
      fontStyle: "bold",
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [50, 50, 50],
      valign: "top",
      overflow: "linebreak",
    },
    alternateRowStyles: { fillColor: alternateRowFillColor },
    margin: { left: 14, right: 14 },
    styles: { cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 54, fontStyle: "bold" },
      1: { cellWidth: "auto" },
    },
  });
}

function buildContratoDetails(contrato: ContratoData): ContratoPdfTableRow[] {
  const details: ContratoPdfTableRow[] = [
    ["Título", safeContratoPdfText(contrato.titulo)],
    ["Tipo", safeContratoPdfText(contrato.tipo)],
    ["Cliente", safeContratoPdfText(contrato.cliente)],
    [
      "Valor",
      `${formatContratoPdfCurrency(contrato.valor)}${isRentalContract(contrato.tipo) ? "/mês" : ""}`,
    ],
    ["Status", safeContratoPdfText(contrato.status)],
    ["Período", `${formatContratoPdfDate(contrato.data_inicio)} a ${formatContratoPdfDate(contrato.data_fim)}`],
  ];

  pushContratoPdfRow(details, "Matrícula", contrato.matricula);
  pushContratoPdfRow(details, "Nº Cliente Água", contrato.numero_agua);
  pushContratoPdfRow(details, "Nº Cliente Luz", contrato.numero_luz);
  pushContratoPdfRow(details, "Inscrição IPTU", contrato.inscricao_iptu);

  if (typeof contrato.valor_iptu === "number" && contrato.valor_iptu > 0) {
    const parcelas = contrato.iptu_parcelado ? 6 : 1;
    const label = contrato.iptu_parcelado
      ? `${formatContratoPdfCurrency(contrato.valor_iptu)} (${parcelas}x ${formatContratoPdfCurrency(contrato.valor_iptu / parcelas)})`
      : formatContratoPdfCurrency(contrato.valor_iptu);
    details.push(["IPTU", label]);
  }

  if (typeof contrato.valor_condominio === "number" && contrato.valor_condominio > 0) {
    let label = formatContratoPdfCurrency(contrato.valor_condominio);
    if (contrato.condominio_inclui) {
      label += ` — Inclui: ${safeContratoPdfText(contrato.condominio_inclui)}`;
    }
    details.push(["Condomínio", label]);
  }

  pushContratoPdfRow(details, "Unidade", contrato.numero_unidade);
  pushContratoPdfRow(details, "Inquilino", contrato.inquilino);
  pushContratoPdfRow(details, "Proprietário", contrato.proprietario);
  pushContratoPdfRow(details, "Canal Origem", contrato.canal_origem);

  if (isRentalContract(contrato.tipo)) {
    const aluguelBruto = contrato.valor || 0;
    const comissaoImob = contrato.comissao_valor || 0;
    const impostoImob = contrato.imposto_valor || 0;
    const condominio = contrato.valor_condominio || 0;
    const parcelasIptu = contrato.iptu_parcelado ? 6 : 1;
    const iptuMensal = contrato.iptu_parcelado ? (contrato.valor_iptu || 0) / parcelasIptu : 0;
    const liquidoProprietario = aluguelBruto - comissaoImob - impostoImob - condominio - iptuMensal;

    pushContratoPdfSection(details, "Resumo Financeiro (Proprietário)");
    details.push(["Aluguel Bruto", formatContratoPdfCurrency(aluguelBruto)]);

    if (comissaoImob > 0) {
      details.push([
        "(-) Comissão Imobiliária",
        `${formatContratoPdfCurrency(comissaoImob)} (${safeContratoPdfText(contrato.comissao_percentual, "0")}%)`,
      ]);
    }

    if (impostoImob > 0) {
      details.push([
        "(-) Imposto Imobiliária",
        `${formatContratoPdfCurrency(impostoImob)} (${safeContratoPdfText(contrato.imposto_percentual, "0")}%)`,
      ]);
    }

    if (condominio > 0) details.push(["(-) Condomínio", formatContratoPdfCurrency(condominio)]);
    if (iptuMensal > 0) details.push(["(-) IPTU mensal", formatContratoPdfCurrency(iptuMensal)]);
    details.push(["= Líquido do Proprietário", formatContratoPdfCurrency(liquidoProprietario)]);
  } else {
    if ((contrato.comissao_valor || 0) > 0) {
      details.push([
        "Comissão Imobiliária",
        `${formatContratoPdfCurrency(contrato.comissao_valor)} (${safeContratoPdfText(contrato.comissao_percentual, "0")}%)`,
      ]);
    }

    if ((contrato.imposto_valor || 0) > 0) {
      details.push([
        "Imposto Imobiliária",
        `${formatContratoPdfCurrency(contrato.imposto_valor)} (${safeContratoPdfText(contrato.imposto_percentual, "0")}%)`,
      ]);
    }
  }

  const hasTeamCommissions =
    (contrato.corretor_comissao_valor || 0) > 0 ||
    (contrato.parceiro_comissao_valor || 0) > 0 ||
    (contrato.captador_comissao_valor || 0) > 0;

  if (hasTeamCommissions) {
    pushContratoPdfSection(details, "Comissões da Equipe");
    pushContratoPdfRow(details, "Corretor", contrato.corretor_nome);

    if ((contrato.corretor_comissao_valor || 0) > 0) {
      details.push([
        "Comissão Corretor",
        `${formatContratoPdfCurrency(contrato.corretor_comissao_valor)} (${safeContratoPdfText(contrato.corretor_comissao_percentual, "0")}%)`,
      ]);
    }

    pushContratoPdfRow(details, "Parceiro", contrato.parceiro_nome);
    if ((contrato.parceiro_comissao_valor || 0) > 0) {
      details.push([
        "Comissão Parceiro",
        `${formatContratoPdfCurrency(contrato.parceiro_comissao_valor)} (${safeContratoPdfText(contrato.parceiro_comissao_percentual, "0")}%)`,
      ]);
    }

    pushContratoPdfRow(details, "Captador", contrato.captador_nome);
    if ((contrato.captador_comissao_valor || 0) > 0) {
      details.push([
        "Comissão Captador",
        `${formatContratoPdfCurrency(contrato.captador_comissao_valor)} (${safeContratoPdfText(contrato.captador_comissao_percentual, "0")}%)`,
      ]);
    }
  }

  if (!isRentalContract(contrato.tipo)) {
    pushContratoPdfRow(details, "Telefone Comprador", contrato.cliente_telefone);
    pushContratoPdfRow(details, "CPF Comprador", contrato.cliente_cpf);
    pushContratoPdfRow(details, "E-mail Comprador", contrato.cliente_email);
  }

  if (isRentalContract(contrato.tipo)) {
    pushContratoPdfRow(details, "Telefone Locatário", contrato.inquilino_telefone);
    pushContratoPdfRow(details, "CPF Locatário", contrato.inquilino_cpf);

    if (contrato.inquilino2_nome) {
      details.push(["Inquilino 2", safeContratoPdfText(contrato.inquilino2_nome)]);
      pushContratoPdfRow(details, "CPF Inquilino 2", contrato.inquilino2_cpf);
      pushContratoPdfRow(details, "Tel Inquilino 2", contrato.inquilino2_telefone);
      pushContratoPdfRow(details, "E-mail Inquilino 2", contrato.inquilino2_email);
    }

    details.push(["Dia Vencimento", safeContratoPdfText(contrato.dia_vencimento_aluguel, "10")]);
    details.push(["Índice Correção", safeContratoPdfText(contrato.indice_correcao, "IGP-M")]);
    details.push(["% Correção", `${safeContratoPdfText(contrato.percentual_correcao, "0")}%`]);
    details.push(["Próx. Correção", formatContratoPdfDate(contrato.data_proxima_correcao)]);
    details.push([
      "Tipo Garantia",
      garantiaLabels[safeContratoPdfText(contrato.tipo_garantia, "")] || "—",
    ]);
    details.push(["Venc. Apólice", formatContratoPdfDate(contrato.data_vencimento_apolice)]);
    details.push(["Vistoria Entrada", contrato.vistoria_entrada ? "✓ Realizada" : "Pendente"]);
    details.push(["Vídeo Vistoria", contrato.vistoria_video ? "✓ Enviado" : "Pendente"]);
    details.push(["Apólice Seguro", contrato.apolice_seguro ? "✓ Ativa" : "Pendente"]);
  }

  pushContratoPdfRow(details, "Telefone Proprietário", contrato.proprietario_telefone);
  pushContratoPdfRow(details, "CPF/CNPJ Proprietário", contrato.proprietario_cpf);

  return details;
}

function buildProprietarioDetails(proprietario: ProprietarioData): ContratoPdfTableRow[] {
  const details: ContratoPdfTableRow[] = [
    ["Nome", safeContratoPdfText(proprietario.nome)],
    ["CPF/CNPJ", safeContratoPdfText(proprietario.cpf_cnpj)],
    ["Telefone", safeContratoPdfText(proprietario.telefone)],
    ["E-mail", safeContratoPdfText(proprietario.email)],
  ];

  const endereco = [
    safeContratoPdfText(proprietario.endereco, "").trim(),
    proprietario.cidade ? `${safeContratoPdfText(proprietario.cidade, "")}/${safeContratoPdfText(proprietario.estado, "")}` : "",
  ]
    .filter(Boolean)
    .join(", ");

  details.push(["Endereço", endereco || "—"]);
  pushContratoPdfRow(details, "PIX", proprietario.pix);

  if (proprietario.banco) {
    const bancoInfo = [
      safeContratoPdfText(proprietario.banco, ""),
      proprietario.agencia ? `Ag:${safeContratoPdfText(proprietario.agencia, "")}` : "",
      proprietario.conta ? `Cc:${safeContratoPdfText(proprietario.conta, "")}` : "",
    ]
      .filter(Boolean)
      .join(" ");

    details.push(["Banco", bancoInfo || "—"]);
  }

  return details;
}

export function exportContratoPDF(
  contrato: ContratoData,
  proprietario?: ProprietarioData | null,
  brandName?: string
) {
  try {
    const doc = new jsPDF();
    const brand = safeContratoPdfText(brandName, "ImobPro");
    const generatedAt = new Date();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 14;

    doc.setFontSize(18);
    doc.setTextColor(37, 99, 235);
    doc.text(brand, 14, y);
    y += 12;

    doc.setFontSize(14);
    doc.setTextColor(30, 30, 30);
    doc.text("Relatório do Contrato", 14, y);
    y += 8;

    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `Gerado em ${generatedAt.toLocaleDateString("pt-BR")} às ${generatedAt.toLocaleTimeString("pt-BR")}`,
      14,
      y,
    );
    y += 10;

    renderTable(doc, buildContratoDetails(contrato), y, [37, 99, 235], [248, 248, 252]);

    y = getContratoPdfLastY(doc, y) + 10;

    if (proprietario) {
      y = ensureContratoPdfSpace(doc, y, 42);
      doc.setFontSize(12);
      doc.setTextColor(37, 99, 235);
      doc.text("Dados do Proprietário", 14, y);
      y += 6;

      renderTable(doc, buildProprietarioDetails(proprietario), y, [34, 197, 94], [248, 252, 248]);
      y = getContratoPdfLastY(doc, y) + 10;
    }

    if (safeContratoPdfText(contrato.observacoes, "").trim()) {
      y = ensureContratoPdfSpace(doc, y, 28);
      doc.setFontSize(12);
      doc.setTextColor(37, 99, 235);
      doc.text("Observações", 14, y);
      y += 4;

      (doc as jsPDF & { autoTable: (options: Record<string, unknown>) => void }).autoTable({
        startY: y,
        body: [[safeContratoPdfText(contrato.observacoes, "")]],
        theme: "grid",
        margin: { left: 14, right: 14 },
        styles: {
          fontSize: 9,
          cellPadding: 4,
          textColor: [60, 60, 60],
          valign: "top",
          overflow: "linebreak",
        },
        tableLineColor: [226, 232, 240],
        tableLineWidth: 0.1,
      });
    }

    addContratoPdfFooter(doc, brand, generatedAt);

    const filename = `contrato_${sanitizeContratoPdfFilename(contrato.titulo)}_${generatedAt.toISOString().split("T")[0]}.pdf`;
    saveContratoPdf(doc, filename);
    return doc;
  } catch (err) {
    console.error("Erro ao exportar contrato PDF:", err);
    throw err;
  }
}
