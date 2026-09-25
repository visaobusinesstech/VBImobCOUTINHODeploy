import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type ProprietarioCaptadoExport = {
  id: string;
  nome_proprietario: string | null;
  operacao: string | null;
  created_at: string;
  url_anuncio: string | null;
  telefone: string | null;
  email: string | null;
  cidade: string | null;
  bairro: string | null;
  titulo_imovel: string | null;
  preco: number | null;
  q_score: number | null;
  status_revisao: string | null;
};

export type ProprietariosExportFiltros = {
  tipo_operacao: "venda" | "aluguel" | "ambos";
  data_inicial: string | null;
  data_final: string | null;
  status_proprietario: string | null;
  responsavel: string | null;
};

function tsSlug() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}

function operacaoLabel(op: string | null): string {
  if (!op) return "";
  const v = op.toLowerCase();
  if (v.startsWith("venda")) return "Venda";
  if (v.startsWith("alug")) return "Aluguel";
  return op;
}

function fmtDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR");
  } catch { return iso; }
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",;\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const HEADERS = [
  "id_proprietario",
  "nome_proprietario",
  "tipo_operacao",
  "data_captacao",
  "url_anuncio",
  "telefone",
  "email",
  "cidade",
  "bairro",
  "titulo_imovel",
  "preco",
  "q_score",
  "status_proprietario",
];

function toRow(p: ProprietarioCaptadoExport): (string | number)[] {
  return [
    p.id,
    p.nome_proprietario ?? "",
    operacaoLabel(p.operacao),
    fmtDateTime(p.created_at),
    p.url_anuncio ?? "",
    p.telefone ?? "",
    p.email ?? "",
    p.cidade ?? "",
    p.bairro ?? "",
    p.titulo_imovel ?? "",
    p.preco ?? "",
    p.q_score ?? "",
    p.status_revisao ?? "",
  ];
}

export function exportProprietariosCSV(itens: ProprietarioCaptadoExport[]) {
  const rows = [HEADERS.join(",")];
  for (const p of itens) {
    rows.push(toRow(p).map(csvEscape).join(","));
  }
  const csv = "\uFEFF" + rows.join("\r\n"); // BOM p/ Excel UTF-8
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `proprietarios_captados_${tsSlug()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportProprietariosPDF(
  itens: ProprietarioCaptadoExport[],
  filtros: ProprietariosExportFiltros,
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const marginX = 32;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Relatório de Proprietários Captados", marginX, 40);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80);
  const tipoLbl =
    filtros.tipo_operacao === "ambos" ? "Venda + Aluguel" :
    filtros.tipo_operacao === "venda" ? "Venda" : "Aluguel";
  const periodo = `${filtros.data_inicial ?? "—"} até ${filtros.data_final ?? "—"}`;
  const infoLines = [
    `Gerado em: ${new Date().toLocaleString("pt-BR")}`,
    `Tipo de operação: ${tipoLbl}`,
    `Período de captação: ${periodo}`,
    `Status: ${filtros.status_proprietario ?? "Todos"}`,
    `Responsável: ${filtros.responsavel ?? "Todos"}`,
    `Total de registros: ${itens.length}`,
  ];
  infoLines.forEach((l, i) => doc.text(l, marginX, 58 + i * 12));

  autoTable(doc, {
    startY: 58 + infoLines.length * 12 + 8,
    head: [[
      "ID", "Nome", "Operação", "Data Captação", "Cidade/Bairro",
      "Telefone", "Preço", "Q-Score", "Status", "URL Anúncio",
    ]],
    body: itens.map(p => [
      p.id.slice(0, 8),
      p.nome_proprietario ?? "",
      operacaoLabel(p.operacao),
      fmtDateTime(p.created_at),
      [p.cidade, p.bairro].filter(Boolean).join(" / "),
      p.telefone ?? "",
      p.preco != null ? p.preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "",
      p.q_score ?? "",
      p.status_revisao ?? "",
      p.url_anuncio ?? "",
    ]),
    styles: { fontSize: 7, cellPadding: 3, overflow: "linebreak" },
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { cellWidth: 100 },
      2: { cellWidth: 45 },
      3: { cellWidth: 80 },
      4: { cellWidth: 100 },
      5: { cellWidth: 75 },
      6: { cellWidth: 65 },
      7: { cellWidth: 40 },
      8: { cellWidth: 55 },
      9: { cellWidth: 170 },
    },
    margin: { left: marginX, right: marginX },
    didDrawPage: () => {
      const pageCount = doc.getNumberOfPages();
      const currentPage = doc.getCurrentPageInfo().pageNumber;
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(
        `Página ${currentPage}/${pageCount} — radarimobtech`,
        doc.internal.pageSize.getWidth() - marginX,
        doc.internal.pageSize.getHeight() - 16,
        { align: "right" },
      );
    },
  });

  doc.save(`proprietarios_captados_${tsSlug()}.pdf`);
}
