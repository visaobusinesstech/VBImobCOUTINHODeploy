import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";

const ETAPA_LABEL: Record<string, string> = {
  portaria: "Portaria",
  administradora: "Administradora",
  sindico: "Síndico",
  canais_publicos: "Canais públicos",
  registro_lgpd: "Registro LGPD",
  custom: "Personalizada",
};

const ETAPAS_ORDEM = ["portaria", "administradora", "sindico", "canais_publicos", "registro_lgpd"];

export interface FunilRow {
  condominio: string;
  bairro: string;
  status: string;
  progresso: number;
  etapas_concluidas: string;
  criado_em: string;
  atualizado_em: string;
  observacoes: string;
  agendamentos_pendentes: number;
  agendamentos_concluidos: number;
  proximo_agendamento: string;
  contatos: string; // "Nome (papel) — telefone — email"
  iniciativas_ativas: number;
  ultimo_evento: string;
  fonte_lgpd: string;
}

export async function carregarFunilCondominios(imobiliariaId: string, prospIds?: string[]): Promise<FunilRow[]> {
  let q = supabase
    .from("condominio_prospeccoes" as any)
    .select("*")
    .eq("imobiliaria_id", imobiliariaId)
    .order("updated_at", { ascending: false });
  if (prospIds && prospIds.length) q = q.in("id", prospIds);
  const { data: prosps } = await q;
  const lista: any[] = (prosps as any[]) || [];
  if (!lista.length) return [];

  const ids = lista.map((p) => p.id);
  const nomes = Array.from(new Set(lista.map((p) => p.condominio_nome).filter(Boolean)));

  const [{ data: ags }, { data: contatos }, { data: inics }, { data: logs }] = await Promise.all([
    supabase
      .from("condominio_prospeccao_agendamentos" as any)
      .select("prospeccao_id, etapa, agendado_para, status, tentativa_num, max_tentativas, observacao")
      .in("prospeccao_id", ids),
    nomes.length
      ? supabase
          .from("condominio_contatos" as any)
          .select("condominio_nome, nome, papel, telefone, email")
          .eq("imobiliaria_id", imobiliariaId)
          .in("condominio_nome", nomes)
      : Promise.resolve({ data: [] as any[] }),
    nomes.length
      ? supabase
          .from("condominio_iniciativas" as any)
          .select("condominio_nome, canal, status, atualizado_em, updated_at")
          .eq("imobiliaria_id", imobiliariaId)
          .in("condominio_nome", nomes)
      : Promise.resolve({ data: [] as any[] }),
    supabase
      .from("condominio_prospeccao_historico" as any)
      .select("prospeccao_id, acao, detalhe, created_at")
      .in("prospeccao_id", ids)
      .order("created_at", { ascending: false }),
  ]);

  const agByProsp: Record<string, any[]> = {};
  ((ags as any[]) || []).forEach((a) => {
    (agByProsp[a.prospeccao_id] ||= []).push(a);
  });
  const contByNome: Record<string, any[]> = {};
  ((contatos as any[]) || []).forEach((c) => {
    (contByNome[c.condominio_nome] ||= []).push(c);
  });
  const inicByNome: Record<string, any[]> = {};
  ((inics as any[]) || []).forEach((i) => {
    (inicByNome[i.condominio_nome] ||= []).push(i);
  });
  const logByProsp: Record<string, any[]> = {};
  ((logs as any[]) || []).forEach((l) => {
    (logByProsp[l.prospeccao_id] ||= []).push(l);
  });

  const rows: FunilRow[] = lista.map((p) => {
    const pAgs = agByProsp[p.id] || [];
    const pend = pAgs.filter((a) => a.status === "pendente");
    const conc = pAgs.filter((a) => a.status === "concluida");
    const proxima = pend
      .map((a) => new Date(a.agendado_para))
      .sort((a, b) => a.getTime() - b.getTime())[0];
    const contList = contByNome[p.condominio_nome] || [];
    const contStr = contList
      .map((c) => {
        const partes = [c.nome, c.papel && `(${c.papel})`, c.telefone, c.email].filter(Boolean);
        return partes.join(" — ");
      })
      .join(" | ");
    const inicList = inicByNome[p.condominio_nome] || [];
    const ativas = inicList.filter((i) => !["concluida", "cancelada"].includes(i.status)).length;
    const etapasFmt = (p.etapas_concluidas || [])
      .map((e: string) => ETAPA_LABEL[e] || e)
      .join(", ");
    const ultimo = (logByProsp[p.id] || [])[0];
    const evento = ultimo
      ? `${ultimo.acao}: ${(ultimo.detalhe || "").slice(0, 60)} — ${new Date(ultimo.created_at).toLocaleDateString("pt-BR")}`
      : "—";
    return {
      condominio: p.condominio_nome || "—",
      bairro: p.bairro || "—",
      status: (p.status || "em_andamento").replace("_", " "),
      progresso: p.progresso ?? Math.round(((p.etapas_concluidas?.length || 0) / ETAPAS_ORDEM.length) * 100),
      etapas_concluidas: etapasFmt || "—",
      criado_em: new Date(p.created_at).toLocaleDateString("pt-BR"),
      atualizado_em: new Date(p.updated_at).toLocaleDateString("pt-BR"),
      observacoes: p.observacoes || "",
      agendamentos_pendentes: pend.length,
      agendamentos_concluidos: conc.length,
      proximo_agendamento: proxima ? proxima.toLocaleString("pt-BR") : "—",
      contatos: contStr || "—",
      iniciativas_ativas: ativas,
      ultimo_evento: evento,
      fonte_lgpd: p.fonte_lgpd_url || p.fonte || "—",
    };
  });

  return rows;
}

function toCsv(rows: FunilRow[]): string {
  const headers = [
    "Condomínio", "Bairro", "Status", "Progresso %",
    "Etapas concluídas", "Criado em", "Atualizado em",
    "Agendamentos pendentes", "Agendamentos concluídos", "Próximo agendamento",
    "Pessoas contatadas", "Iniciativas ativas", "Último evento", "Fonte LGPD", "Observações",
  ];
  const esc = (v: any) => {
    const s = String(v ?? "");
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(";")];
  rows.forEach((r) => {
    lines.push([
      r.condominio, r.bairro, r.status, r.progresso,
      r.etapas_concluidas, r.criado_em, r.atualizado_em,
      r.agendamentos_pendentes, r.agendamentos_concluidos, r.proximo_agendamento,
      r.contatos, r.iniciativas_ativas, r.ultimo_evento, r.fonte_lgpd, r.observacoes,
    ].map(esc).join(";"));
  });
  return "\uFEFF" + lines.join("\n");
}

export function exportarFunilCsv(rows: FunilRow[], filename = "funil-prospeccao-condominios.csv") {
  const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportarFunilPdf(rows: FunilRow[], filename = "funil-prospeccao-condominios.pdf") {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const geradoEm = new Date().toLocaleString("pt-BR");

  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  doc.text("Funil de Prospecção — Condomínios", 14, 14);
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`Gerado em ${geradoEm} · ${rows.length} condomínio(s)`, 14, 20);

  // Resumo
  const totalAg = rows.reduce((s, r) => s + r.agendamentos_pendentes, 0);
  const concluidos = rows.filter((r) => r.progresso >= 100).length;
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text(
    `Concluídos: ${concluidos}  ·  Em andamento: ${rows.length - concluidos}  ·  Agendamentos pendentes: ${totalAg}`,
    14, 26
  );

  autoTable(doc, {
    startY: 30,
    styles: { fontSize: 7, cellPadding: 1.5, valign: "top", overflow: "linebreak" },
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 7 },
    columnStyles: {
      0: { cellWidth: 34 },   // Condominio
      1: { cellWidth: 22 },   // Bairro
      2: { cellWidth: 18 },   // Status
      3: { cellWidth: 12, halign: "right" }, // %
      4: { cellWidth: 34 },   // Etapas
      5: { cellWidth: 18 },   // Prox agend
      6: { cellWidth: 12, halign: "right" }, // Pend
      7: { cellWidth: 12, halign: "right" }, // Conc
      8: { cellWidth: 50 },   // Contatos
      9: { cellWidth: 40 },   // Ultimo evento
      10: { cellWidth: 30 },  // Observacoes
    },
    head: [[
      "Condomínio", "Bairro", "Status", "%", "Etapas concluídas",
      "Próx. agend.", "Pend.", "Conc.", "Pessoas contatadas", "Último evento", "Observações",
    ]],
    body: rows.map((r) => [
      r.condominio, r.bairro, r.status, `${r.progresso}%`, r.etapas_concluidas,
      r.proximo_agendamento, r.agendamentos_pendentes, r.agendamentos_concluidos,
      r.contatos, r.ultimo_evento, r.observacoes,
    ]),
    didDrawPage: () => {
      const str = `Página ${doc.getNumberOfPages()}`;
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(str, doc.internal.pageSize.getWidth() - 20, doc.internal.pageSize.getHeight() - 8);
    },
  });

  doc.save(filename);
}
