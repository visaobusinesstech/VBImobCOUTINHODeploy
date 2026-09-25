import jsPDF from "jspdf";
import "jspdf-autotable";

export type CaptacaoExportItem = {
  titulo?: string;
  endereco: string;
  bairro?: string;
  preco_estimado: number;
  tipo_imovel: string;
  link_anuncio?: string;
  portal_origem?: string;
};

export type CaptacaoExportFiltros = {
  bairro?: string;
  cidade?: string;
  tipo_imovel?: string;
  operacao?: string;
  faixa_preco?: string;
  apenas_proprietarios?: boolean;
  nome_predio?: string;
  // Filtros de tela aplicados sobre resultados já carregados
  portal_filtro?: string;
  bairro_filtro?: string;
  anunciante_filtro?: string;
  busca_texto?: string;
};

export type CaptacaoExportInput = {
  itens: CaptacaoExportItem[];
  filtros: CaptacaoExportFiltros;
  portais?: string[];
  cidades?: string[];
  coletadoEm?: string | null;
};

function timestamp() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function fmtBRL(v: number) {
  return (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportCaptacaoCSV({ itens, filtros, coletadoEm }: CaptacaoExportInput) {
  const headers = [
    "ID",
    "Endereço",
    "Preço",
    "Tipo de Imóvel",
    "Link do Anúncio",
    "Data de Captação",
    "Portal de Origem",
    "Cidade",
  ];
  const dataColeta = coletadoEm ? new Date(coletadoEm).toISOString() : new Date().toISOString();
  const cidade = filtros.cidade || "Brasília";

  const lines = [headers.join(",")];
  itens.forEach((it, idx) => {
    const enderecoCompleto = [it.endereco, it.bairro].filter(Boolean).join(" - ");
    lines.push(
      [
        idx + 1,
        enderecoCompleto,
        it.preco_estimado ?? 0,
        it.tipo_imovel ?? "",
        it.link_anuncio ?? "",
        dataColeta,
        it.portal_origem ?? "",
        cidade,
      ]
        .map(csvEscape)
        .join(",")
    );
  });

  // UTF-8 BOM para compatibilidade com Excel
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  download(blob, `lovable_captacao_${timestamp()}.csv`);
}

export function exportCaptacaoPDF({ itens, filtros, portais, cidades }: CaptacaoExportInput) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const now = new Date().toLocaleString("pt-BR");

  doc.setFontSize(16);
  doc.setTextColor(37, 99, 235);
  doc.text("Captação Inteligente — Resultados", 14, 18);

  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`Exportado em: ${now}`, 14, 25);

  // Filtros aplicados
  const filtrosLinhas: string[] = [];
  if (filtros.bairro) filtrosLinhas.push(`Bairro: ${filtros.bairro}`);
  if (filtros.cidade) filtrosLinhas.push(`Cidade: ${filtros.cidade}`);
  if (filtros.tipo_imovel) filtrosLinhas.push(`Tipo: ${filtros.tipo_imovel}`);
  if (filtros.operacao) filtrosLinhas.push(`Operação: ${filtros.operacao}`);
  if (filtros.faixa_preco) filtrosLinhas.push(`Faixa: ${filtros.faixa_preco}`);
  if (filtros.nome_predio) filtrosLinhas.push(`Prédio: ${filtros.nome_predio}`);
  if (filtros.apenas_proprietarios) filtrosLinhas.push("Apenas proprietários");

  doc.setFontSize(9);
  doc.setTextColor(50);
  doc.text("Filtros aplicados:", 14, 32);
  doc.setTextColor(90);
  const filtrosTxt = filtrosLinhas.length ? filtrosLinhas.join(" · ") : "Nenhum filtro específico";
  const wrappedFiltros = doc.splitTextToSize(filtrosTxt, pageWidth - 28);
  doc.text(wrappedFiltros, 14, 37);

  let cursorY = 37 + wrappedFiltros.length * 4 + 3;

  if (portais && portais.length) {
    const t = `Portais pesquisados (${portais.length}): ${portais.join(", ")}`;
    const w = doc.splitTextToSize(t, pageWidth - 28);
    doc.text(w, 14, cursorY);
    cursorY += w.length * 4 + 2;
  }
  if (cidades && cidades.length) {
    const t = `Cidades / RAs cobertas (${cidades.length}): ${cidades.join(", ")}`;
    const w = doc.splitTextToSize(t, pageWidth - 28);
    doc.text(w, 14, cursorY);
    cursorY += w.length * 4 + 2;
  }
  cursorY += 2;

  (doc as any).autoTable({
    startY: cursorY,
    head: [["#", "Endereço", "Preço", "Portal"]],
    body: itens.map((it, i) => [
      i + 1,
      [it.endereco, it.bairro].filter(Boolean).join(" - "),
      fmtBRL(it.preco_estimado),
      it.portal_origem || "—",
    ]),
    theme: "striped",
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 8, textColor: [40, 40, 40] },
    alternateRowStyles: { fillColor: [248, 248, 252] },
    margin: { left: 14, right: 14 },
    styles: { cellPadding: 2.5, overflow: "linebreak" },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 95 },
      2: { cellWidth: 32 },
      3: { cellWidth: 45 },
    },
  });

  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(160);
    const h = doc.internal.pageSize.getHeight();
    doc.text(`radarimobtech · Captação Inteligente · Página ${i}/${pageCount}`, pageWidth / 2, h - 8, { align: "center" });
  }

  const filename = `lovable_captacao_${timestamp()}.pdf`;
  try {
    doc.save(filename);
  } catch {
    const blob = doc.output("blob");
    download(blob, filename);
  }
}
