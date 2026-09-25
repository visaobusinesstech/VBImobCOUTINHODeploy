import jsPDF from "jspdf";
import type { Contrato } from "@/hooks/useContratos";
import type { Transacao } from "@/hooks/useTransacoes";
import {
  formatCurrencyBRL,
  formatDateBR,
  safeNumber,
  getContratoImovel,
  getContratoImovelLabel,
  getContratoInquilino,
  getContratoLocalizacao,
  getTransacoesDoContrato,
  isActiveRentalContract,
  resumirTransacoesContrato,
  type RelatorioAluguelImovelRef,
} from "@/lib/relatorioAluguelUtils";

interface ExtratoAluguelMensalOptions {
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
  brandCnpj?: string;
  brandPhone?: string;
  brandEmail?: string;
  brandCreci?: string;
  mesReferencia?: Date;
}

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const normalizeLookupKey = (v: string | null | undefined) =>
  (v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

const formatMesAnoRef = (d: Date) => {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${m}/${d.getFullYear()}`;
};

const formatVigencia = (contrato: Contrato) => {
  if (!contrato.data_inicio || !contrato.data_fim) return "";
  const d1 = new Date(contrato.data_inicio + "T00:00:00");
  const d2 = new Date(contrato.data_fim + "T00:00:00");
  const meses = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24 * 30));
  return `${formatDateBR(contrato.data_inicio)} a ${formatDateBR(contrato.data_fim)} Vigência: ${meses} Meses`;
};

const formatRefPeriodo = (contrato: Contrato, mes: Date) => {
  const dia = contrato.dia_vencimento_aluguel || 12;
  const m = mes.getMonth();
  const y = mes.getFullYear();
  const inicio = new Date(y, m, dia);
  const fim = new Date(y, m + 1, dia);
  return `${formatDateBR(inicio.toISOString().slice(0, 10))} a ${formatDateBR(fim.toISOString().slice(0, 10))}`;
};

export function exportExtratoAluguelMensalPDF({
  contratos,
  transacoes,
  imoveis,
  proprietarios = [],
  brandName = "ImobPro",
  brandCnpj,
  brandPhone,
  brandEmail,
  brandCreci,
  mesReferencia,
}: ExtratoAluguelMensalOptions) {
  try {
    const contratosLocacao = contratos.filter(isActiveRentalContract);
    if (contratosLocacao.length === 0) return false;

    const ref = mesReferencia || new Date();
    const mesIdx = ref.getMonth();
    const ano = ref.getFullYear();

    const transacoesAluguel = transacoes.filter(
      (t) => t.categoria === "aluguel" || t.categoria === "repasse",
    );

    const proprietariosPorId = new Map(proprietarios.map((p) => [p.id, p]));
    const proprietariosPorNome = new Map(
      proprietarios.map((p) => [normalizeLookupKey(p.nome), p]),
    );

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pw = doc.internal.pageSize.getWidth();
    const mx = 25; // left margin
    let isFirst = true;

    for (const contrato of contratosLocacao) {
      if (!isFirst) doc.addPage();
      isFirst = false;

      const imovel = getContratoImovel(contrato, imoveis);
      const nomeImovel = getContratoImovelLabel(contrato, imovel);
      const endereco = getContratoLocalizacao(imovel);
      const inquilino = getContratoInquilino(contrato);
      const proprietarioRel =
        (contrato.proprietario_id ? proprietariosPorId.get(contrato.proprietario_id) : null) ||
        proprietariosPorNome.get(normalizeLookupKey(contrato.proprietario)) ||
        null;

      const unitTxs = getTransacoesDoContrato({ contrato, imovel, transacoes: transacoesAluguel });
      const monthTxs = unitTxs.filter((t) => {
        const d = new Date(t.data + "T00:00:00");
        return d.getMonth() === mesIdx && d.getFullYear() === ano;
      });

      const resumo = resumirTransacoesContrato(monthTxs);
      const comissaoPerc = safeNumber(contrato.comissao_percentual);
      const aluguelVal = safeNumber(contrato.valor);
      const comissaoCalc = monthTxs
        .filter((t) => t.tipo === "entrada" && t.status === "confirmado")
        .reduce((s, t) => s + safeNumber((t as any).comissao_valor || 0), 0) || (aluguelVal * comissaoPerc / 100);

      // Taxas extras from transactions
      const taxasExtras: Array<{ desc: string; valor: number }> = [];
      const condVal = safeNumber(contrato.valor_condominio);
      const iptuMensal = contrato.iptu_parcelado ? safeNumber(contrato.valor_iptu) / 12 : 0;
      if (condVal > 0) taxasExtras.push({ desc: "Condomínio", valor: condVal });
      if (iptuMensal > 0) taxasExtras.push({ desc: "IPTU (mensal)", valor: iptuMensal });

      // Check for taxa_extra on transactions
      for (const t of monthTxs) {
        const txExtra = safeNumber((t as any).taxa_extra || 0);
        const txExtraDesc = (t as any).taxa_extra_descricao || "Taxa Extra";
        if (txExtra > 0) taxasExtras.push({ desc: txExtraDesc, valor: txExtra });
      }

      const totalRepasse = aluguelVal - comissaoCalc - taxasExtras.reduce((s, t) => s + t.valor, 0);

      let y = 30;

      // ═══ HEADER — Company name + CNPJ centered ═══
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text(brandName.toUpperCase(), pw / 2, y, { align: "center" });
      y += 6;
      if (brandCnpj) {
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`CNPJ: ${brandCnpj}`, pw / 2, y, { align: "center" });
        y += 5;
      }
      if (brandCreci) {
        doc.setFontSize(9);
        doc.text(`CRECI: ${brandCreci}`, pw / 2, y, { align: "center" });
        y += 5;
      }
      if (brandPhone || brandEmail) {
        doc.setFontSize(8);
        const contact = [brandPhone, brandEmail].filter(Boolean).join(" | ");
        doc.text(contact, pw / 2, y, { align: "center" });
        y += 5;
      }

      // ═══ TITLE — RECIBO – MÊS XX/YYYY ═══
      y += 8;
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      const titulo = `RECIBO – MÊS ${formatMesAnoRef(ref)}`;
      doc.text(titulo, pw / 2, y, { align: "center" });
      // Underline
      const tw = doc.getTextWidth(titulo);
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);
      doc.line(pw / 2 - tw / 2, y + 1.5, pw / 2 + tw / 2, y + 1.5);

      y += 12;

      // ═══ CONTRATO ═══
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0, 0, 0);

      const enderecoFull = [nomeImovel, endereco].filter(Boolean).join(", ");
      const contratoLines = doc.splitTextToSize(`Contrato: ${enderecoFull}`, pw - 2 * mx);
      doc.text(contratoLines, mx, y);
      y += contratoLines.length * 5 + 2;

      if (imovel?.bairro || imovel?.cidade) {
        // CEP if available
      }

      if (contrato.numero_unidade) {
        doc.text(`Unidade: ${contrato.numero_unidade}`, mx, y);
        y += 6;
      }

      // ═══ LOCATÁRIO ═══
      y += 2;
      const locatarioText = `Locatário: ${inquilino.toUpperCase()}  CPF Nº ${contrato.inquilino_cpf || contrato.cliente_cpf || "—"}`;
      doc.text(locatarioText, mx, y);
      y += 6;

      // Inquilino 2
      if (contrato.inquilino2_nome) {
        doc.text(`Locatário 2: ${contrato.inquilino2_nome.toUpperCase()}  CPF Nº ${contrato.inquilino2_cpf || "—"}`, mx, y);
        y += 6;
      }

      // ═══ LOCADOR ═══
      const propNome = (contrato.proprietario || "—").toUpperCase();
      const propCpf = contrato.proprietario_cpf || proprietarioRel?.cpf_cnpj || "—";
      doc.text(`Locador: ${propNome}  CPF Nº ${propCpf}`, mx, y);
      y += 6;

      // Email proprietário
      const propEmail = contrato.proprietario_email || proprietarioRel?.email || "";
      if (propEmail) {
        doc.text(`Email: ${propEmail}`, mx, y);
        y += 6;
      }

      // ═══ REFERÊNCIA ═══
      y += 2;
      doc.text(`Referência: ${formatRefPeriodo(contrato, ref)}`, mx, y);
      y += 6;

      // ═══ PERÍODO / VIGÊNCIA ═══
      const vigencia = formatVigencia(contrato);
      if (vigencia) {
        doc.text(`Período: ${vigencia}`, mx, y);
        y += 6;
      }

      // ═══ FORMA DE PAGAMENTO ═══
      y += 2;
      const pagParts: string[] = [];
      if (contrato.proprietario_pix) pagParts.push(`PIX: ${contrato.proprietario_pix}`);
      if (contrato.proprietario_banco) {
        let bankLine = `Banco ${contrato.proprietario_banco}`;
        if (contrato.proprietario_agencia) bankLine += ` Ag ${contrato.proprietario_agencia}`;
        if (contrato.proprietario_conta) bankLine += ` CC ${contrato.proprietario_conta}`;
        pagParts.push(bankLine);
      }
      if (pagParts.length > 0) {
        doc.text(`Forma pagamento: ${pagParts[0]}`, mx, y);
        y += 5;
        for (let i = 1; i < pagParts.length; i++) {
          doc.text(pagParts[i], mx, y);
          y += 5;
        }
        y += 1;
      }

      // Nominal (company receiving)
      if (brandName) {
        doc.text(`Nominal: ${brandName.toUpperCase()}`, mx, y);
        y += 5;
        if (brandCnpj) {
          doc.text(`CNPJ: ${brandCnpj}`, mx, y);
          y += 5;
        }
      }

      // Pagamento em
      y += 2;
      const dataRecebimento = monthTxs.find((t) => t.status === "confirmado" && t.tipo === "entrada")?.data;
      if (dataRecebimento) {
        doc.text(`Pagamento em: ${formatDateBR(dataRecebimento)}.`, mx, y);
        y += 6;
      } else {
        doc.text(`Pagamento: Pendente`, mx, y);
        y += 6;
      }

      // ═══ DESCRIÇÃO DO REPASSE ═══
      y += 6;
      doc.setFont("helvetica", "bold");
      doc.text("Descrição do repasse:", mx, y);
      doc.setFont("helvetica", "normal");
      y += 8;

      // Aluguel line
      const refPeriodo = formatRefPeriodo(contrato, ref);
      const rightX = pw - mx;

      doc.text(`Aluguel - ${refPeriodo}`, mx, y);
      doc.text(formatCurrencyBRL(aluguelVal), rightX, y, { align: "right" });
      y += 7;

      // Taxa de administração
      const taxaLabel = comissaoPerc > 0
        ? `Taxa de administração – ${comissaoPerc}%`
        : "Taxa de administração";
      doc.text(taxaLabel, mx, y);
      doc.text(formatCurrencyBRL(comissaoCalc), rightX, y, { align: "right" });
      y += 7;

      // Taxas extras
      for (const taxa of taxasExtras) {
        doc.text(`${taxa.desc}`, mx, y);
        doc.text(formatCurrencyBRL(taxa.valor), rightX, y, { align: "right" });
        y += 7;
      }

      // Imposto retido
      const impostoVal = safeNumber(contrato.imposto_valor);
      if (impostoVal > 0) {
        const impostoLabel = contrato.imposto_tipo
          ? `${contrato.imposto_tipo} – ${safeNumber(contrato.imposto_percentual)}%`
          : "Imposto retido";
        doc.text(impostoLabel, mx, y);
        doc.text(formatCurrencyBRL(impostoVal), rightX, y, { align: "right" });
        y += 7;
      }

      // ═══ TOTAL PARA REPASSE ═══
      y += 4;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("Total para repasse", mx, y);
      doc.text(formatCurrencyBRL(totalRepasse > 0 ? totalRepasse : (resumo.recebido - comissaoCalc)), rightX, y, { align: "right" });

      // ═══ Footer ═══
      const ph = doc.internal.pageSize.getHeight();
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(150, 150, 150);
      doc.text("Documento gerado automaticamente pelo sistema de gestão imobiliária.", pw / 2, ph - 15, { align: "center" });
      doc.text("Válido como comprovante de pagamento e para fins fiscais.", pw / 2, ph - 10, { align: "center" });
    }

    // Page numbers
    const pageCount = doc.getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p);
      const ph = doc.internal.pageSize.getHeight();
      doc.setFontSize(7);
      doc.setTextColor(180, 180, 180);
      doc.text(`${p}/${pageCount}`, pw - 15, ph - 5, { align: "right" });
    }

    const fileName = `recibo_aluguel_${formatMesAnoRef(ref).replace("/", "_")}.pdf`;
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
    console.error("Erro ao gerar extrato de aluguel mensal:", error);
    return false;
  }
}
