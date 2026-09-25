import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type HistEtapaDef = { id: string; titulo: string; descricao: string };

export type HistProspeccao = {
  id: string;
  condominio_nome: string;
  bairro: string | null;
  status: string;
  progresso: number | null;
  etapas_concluidas: string[] | null;
  updated_at: string;
  created_at: string;
};

export type HistLog = {
  id: string;
  tipo: string;
  etapa: string | null;
  nota: string | null;
  created_at: string;
};

export type HistAgendamento = {
  id: string;
  etapa: string;
  status: string;
  agendado_para: string;
  tentativa_num: number;
  max_tentativas: number;
  concluido_em: string | null;
  motivo_pausa: string | null;
};

export type HistNota = {
  id: string;
  historico_id: string;
  autor_id: string;
  autor_nome: string | null;
  visibilidade: string;
  texto: string | null;
  anexo_nome: string | null;
  anexo_tipo: string | null;
  anexo_tamanho: number | null;
  created_at: string;
  updated_at?: string | null;
};

export type HistoricoExportInput = {
  prospeccao: HistProspeccao;
  etapas: HistEtapaDef[];
  logs: HistLog[];
  agendamentos: HistAgendamento[];
  /** Notas dos eventos (privadas só aparecem se o usuário atual for o autor). */
  notas?: HistNota[];
  /** ID do usuário atual — usado para autorizar a exibição de notas privadas. */
  currentUserId?: string | null;
  /** Quando false, notas privadas são omitidas mesmo sendo do próprio autor. */
  incluirPrivadas?: boolean;
  /** Nome/e-mail exibido na marca d'água de rastreabilidade do PDF. */
  usuarioNome?: string | null;
};


export type LinhaNota = {
  data: string;
  evento: string;
  etapa: string;
  visibilidade: string;
  autor: string;
  texto: string;
  anexo: string;
};

const fmtTamanho = (b?: number | null) => {
  if (!b || b <= 0) return "";
  const kb = b / 1024;
  return kb < 1024 ? `${Math.round(kb)} KB` : `${(kb / 1024).toFixed(1)} MB`;
};


type LinhaEtapa = {
  etapa: string;
  situacao: string;
  ultimaAcao: string;
  proximaTentativa: string;
  observacoes: string;
};

const fmtDataHora = (v?: string | null) => (v ? new Date(v).toLocaleString("pt-BR") : "—");
const fmtData = (v?: string | null) => (v ? new Date(v).toLocaleDateString("pt-BR") : "—");

function slugify(s: string) {
  return (s || "condominio")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

export function montarLinhasEtapas({ prospeccao, etapas, logs, agendamentos }: HistoricoExportInput): LinhaEtapa[] {
  const concluidas = new Set(prospeccao.etapas_concluidas ?? []);
  const agsPorEtapa = agendamentos.reduce<Record<string, HistAgendamento[]>>((acc, a) => {
    (acc[a.etapa] ||= []).push(a);
    return acc;
  }, {});
  const ultimaPorEtapa = logs.reduce<Record<string, HistLog>>((acc, l) => {
    if (l.etapa && !acc[l.etapa]) acc[l.etapa] = l;
    return acc;
  }, {});

  return etapas.map((et) => {
    const done = concluidas.has(et.id);
    const agsEt = agsPorEtapa[et.id] ?? [];
    const proximo = agsEt.find((a) => a.status === "pendente");
    const pausado = agsEt.find((a) => a.status === "pausada" || a.status === "pausado");
    const ultima = ultimaPorEtapa[et.id];

    const obs: string[] = [];
    if (ultima?.nota) obs.push(ultima.nota);
    if (pausado?.motivo_pausa) obs.push(`Motivo da pausa: ${pausado.motivo_pausa}`);
    if (!ultima && !proximo && !pausado && !done) obs.push("Nenhuma atividade registrada ainda.");

    return {
      etapa: et.titulo,
      situacao: done ? "Concluída" : proximo ? "Agendada" : pausado ? "Pausada" : "Não iniciada",
      ultimaAcao: ultima ? `${ultima.tipo.replace(/_/g, " ")} em ${fmtDataHora(ultima.created_at)}` : "—",
      proximaTentativa: proximo
        ? `${fmtDataHora(proximo.agendado_para)} (tentativa ${proximo.tentativa_num}/${proximo.max_tentativas})`
        : "—",
      observacoes: obs.join(" | ") || "—",
    };
  });
}

/**
 * Monta as linhas de notas/anexos dos eventos visíveis.
 * Notas privadas só entram quando o usuário atual é o autor (mesma regra da RLS).
 */
export function montarLinhasNotas({
  etapas,
  logs,
  notas = [],
  currentUserId,
  incluirPrivadas = true,
}: HistoricoExportInput): LinhaNota[] {
  const logsById = new Map(logs.map((l) => [l.id, l]));
  return notas
    .filter((n) => logsById.has(n.historico_id))
    .filter((n) =>
      n.visibilidade === "privada"
        ? incluirPrivadas && !!currentUserId && n.autor_id === currentUserId
        : true
    )
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .map((n) => {
      const log = logsById.get(n.historico_id)!;
      const etapaLabel = log.etapa ? etapas.find((e) => e.id === log.etapa)?.titulo ?? log.etapa : "—";
      const editada = n.updated_at && n.updated_at !== n.created_at ? ` (editada em ${fmtDataHora(n.updated_at)})` : "";
      const tam = fmtTamanho(n.anexo_tamanho);
      return {
        data: fmtDataHora(n.created_at) + editada,
        evento: log.tipo.replace(/_/g, " "),
        etapa: etapaLabel,
        visibilidade: n.visibilidade === "privada" ? "Privada" : "Time",
        autor: n.autor_nome ?? "Usuário",
        texto: n.texto ?? "—",
        anexo: n.anexo_nome
          ? `${n.anexo_nome}${tam ? ` (${tam})` : ""}${n.anexo_tipo ? ` · ${n.anexo_tipo}` : ""}`
          : "—",
      };
    });
}


function esc(v: unknown) {
  const s = String(v ?? "");
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function baixar(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportarHistoricoCondominioCsv(input: HistoricoExportInput) {
  const { prospeccao, etapas, logs } = input;
  const progresso =
    prospeccao.progresso ??
    Math.round(((prospeccao.etapas_concluidas ?? []).length / Math.max(etapas.length, 1)) * 100);
  const linhas: string[] = [];

  linhas.push(["Condomínio", "Bairro", "Status", "Progresso %", "Criado em", "Atualizado em"].join(";"));
  linhas.push(
    [
      prospeccao.condominio_nome,
      prospeccao.bairro ?? "",
      prospeccao.status.replace(/_/g, " "),
      progresso,
      fmtData(prospeccao.created_at),
      fmtData(prospeccao.updated_at),
    ]
      .map(esc)
      .join(";")
  );

  linhas.push("");
  linhas.push("STATUS POR ETAPA");
  linhas.push(["Etapa", "Situação", "Última ação", "Próxima tentativa", "Observações"].join(";"));
  montarLinhasEtapas(input).forEach((l) => {
    linhas.push([l.etapa, l.situacao, l.ultimaAcao, l.proximaTentativa, l.observacoes].map(esc).join(";"));
  });

  linhas.push("");
  linhas.push("LINHA DO TEMPO");
  linhas.push(["Data", "Evento", "Etapa", "Observação"].join(";"));
  if (!logs.length) {
    linhas.push(esc("Nenhum evento registrado."));
  } else {
    logs.forEach((l) => {
      const etapaLabel = l.etapa ? etapas.find((e) => e.id === l.etapa)?.titulo ?? l.etapa : "—";
      linhas.push(
        [fmtDataHora(l.created_at), l.tipo.replace(/_/g, " "), etapaLabel, l.nota ?? "—"].map(esc).join(";")
      );
    });
  }

  const linhasNotas = montarLinhasNotas(input);
  linhas.push("");
  linhas.push("NOTAS E ANEXOS");
  linhas.push(["Data", "Evento", "Etapa", "Visibilidade", "Autor", "Nota", "Anexo"].join(";"));
  if (!linhasNotas.length) {
    linhas.push(esc("Nenhuma nota registrada."));
  } else {
    linhasNotas.forEach((n) => {
      linhas.push([n.data, n.evento, n.etapa, n.visibilidade, n.autor, n.texto, n.anexo].map(esc).join(";"));
    });
  }


  baixar(new Blob(["\uFEFF" + linhas.join("\n")], { type: "text/csv;charset=utf-8" }),
    `historico-${slugify(prospeccao.condominio_nome)}.csv`);
}

function construirHistoricoCondominioPdf(input: HistoricoExportInput) {
  const { prospeccao, etapas, logs } = input;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const progresso =
    prospeccao.progresso ??
    Math.round(((prospeccao.etapas_concluidas ?? []).length / Math.max(etapas.length, 1)) * 100);

  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  doc.text("Histórico de Prospecção — Condomínio", 14, 16);

  doc.setFontSize(11);
  doc.text(prospeccao.condominio_nome, 14, 23);

  doc.setFontSize(9);
  doc.setTextColor(100);
  const sub = [
    prospeccao.bairro || null,
    `${progresso}% concluído`,
    `Status: ${prospeccao.status.replace(/_/g, " ")}`,
    `Iniciado em ${fmtData(prospeccao.created_at)}`,
    `Atualizado em ${fmtData(prospeccao.updated_at)}`,
  ]
    .filter(Boolean)
    .join("  ·  ");
  doc.text(doc.splitTextToSize(sub, pageWidth - 28), 14, 29);
  doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, 14, 35);

  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text("Status por etapa", 14, 43);

  autoTable(doc, {
    startY: 46,
    styles: { fontSize: 7.5, cellPadding: 1.8, valign: "top", overflow: "linebreak" },
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 7.5 },
    columnStyles: {
      0: { cellWidth: 32 },
      1: { cellWidth: 22 },
      2: { cellWidth: 42 },
      3: { cellWidth: 42 },
      4: { cellWidth: 44 },
    },
    head: [["Etapa", "Situação", "Última ação", "Próxima tentativa", "Observações"]],
    body: montarLinhasEtapas(input).map((l) => [
      l.etapa,
      l.situacao,
      l.ultimaAcao,
      l.proximaTentativa,
      l.observacoes,
    ]),
  });

  const afterEtapas = (doc as any).lastAutoTable?.finalY ?? 46;
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text(`Linha do tempo (${logs.length} evento${logs.length === 1 ? "" : "s"})`, 14, afterEtapas + 10);

  autoTable(doc, {
    startY: afterEtapas + 13,
    styles: { fontSize: 7.5, cellPadding: 1.8, valign: "top", overflow: "linebreak" },
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 7.5 },
    columnStyles: {
      0: { cellWidth: 32 },
      1: { cellWidth: 36 },
      2: { cellWidth: 32 },
      3: { cellWidth: 82 },
    },
    head: [["Data", "Evento", "Etapa", "Observação"]],
    body: logs.length
      ? logs.map((l) => [
          fmtDataHora(l.created_at),
          l.tipo.replace(/_/g, " "),
          l.etapa ? etapas.find((e) => e.id === l.etapa)?.titulo ?? l.etapa : "—",
          l.nota ?? "—",
        ])
      : [["—", "Nenhum evento registrado.", "—", "—"]],
    didDrawPage: () => {
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(
        `Página ${doc.getNumberOfPages()}`,
        pageWidth - 20,
        doc.internal.pageSize.getHeight() - 8
      );
    },
  });

  const linhasNotas = montarLinhasNotas(input);
  const afterLogs = (doc as any).lastAutoTable?.finalY ?? afterEtapas + 13;
  const privadas = linhasNotas.filter((n) => n.visibilidade === "Privada").length;
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text(
    `Notas e anexos (${linhasNotas.length}${privadas ? ` · ${privadas} privada${privadas === 1 ? "" : "s"}` : ""})`,
    14,
    afterLogs + 10
  );

  autoTable(doc, {
    startY: afterLogs + 13,
    styles: { fontSize: 7, cellPadding: 1.6, valign: "top", overflow: "linebreak" },
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 7 },
    columnStyles: {
      0: { cellWidth: 26 },
      1: { cellWidth: 24 },
      2: { cellWidth: 24 },
      3: { cellWidth: 16 },
      4: { cellWidth: 24 },
      5: { cellWidth: 40 },
      6: { cellWidth: 28 },
    },
    head: [["Data", "Evento", "Etapa", "Visib.", "Autor", "Nota", "Anexo"]],
    body: linhasNotas.length
      ? linhasNotas.map((n) => [n.data, n.evento, n.etapa, n.visibilidade, n.autor, n.texto, n.anexo])
      : [["—", "Nenhuma nota registrada.", "—", "—", "—", "—", "—"]],
    didDrawPage: () => {
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(
        `Página ${doc.getNumberOfPages()}`,
        pageWidth - 20,
        doc.internal.pageSize.getHeight() - 8
      );
    },
  });


  aplicarMarcaDagua(doc, input);

  return { doc, filename: `historico-${slugify(prospeccao.condominio_nome)}.pdf` };
}

/** Texto da marca d'água (usado no PDF e exibido na pré-visualização). */
export function montarTextoMarcaDagua(input: HistoricoExportInput) {
  const quem = (input.usuarioNome || "").trim() || "Usuário não identificado";
  return `${quem} · ${new Date().toLocaleString("pt-BR")}`;
}

/** Marca d'água diagonal repetida + rodapé com autor e data em todas as páginas. */
function aplicarMarcaDagua(doc: jsPDF, input: HistoricoExportInput) {
  const texto = montarTextoMarcaDagua(input);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const total = doc.getNumberOfPages();
  const temGState = typeof (doc as any).GState === "function";

  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    if (temGState) (doc as any).setGState(new (doc as any).GState({ opacity: 0.13 }));
    doc.setFontSize(20);
    doc.setTextColor(30, 41, 59);
    for (let y = 40; y < pageHeight; y += 70) {
      doc.text(texto, pageWidth / 2, y, { align: "center", angle: 30 });
    }
    if (temGState) (doc as any).setGState(new (doc as any).GState({ opacity: 1 }));

    doc.setFontSize(7);
    doc.setTextColor(140);
    doc.text(`Documento gerado por ${texto}`, 14, pageHeight - 8);
  }
}


export function gerarHistoricoCondominioPdfPreview(input: HistoricoExportInput) {

  const { doc, filename } = construirHistoricoCondominioPdf(input);
  const blob = doc.output("blob") as Blob;
  return { blob, url: URL.createObjectURL(blob), filename };
}

export function exportarHistoricoCondominioPdf(input: HistoricoExportInput) {
  const { doc, filename } = construirHistoricoCondominioPdf(input);
  doc.save(filename);
}
