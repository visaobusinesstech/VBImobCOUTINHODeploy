import { extractIndicadoPor } from "./captacaoIndicacao";

export const TIPO_LABELS: Record<string, string> = {
  porteiro: "Porteiro",
  construtor: "Construtor",
  construtora: "Construtora",
  sindico: "Síndico",
  indicacao: "Indicação",
  proprietario: "Proprietário Direto",
};

export const STATUS_LABELS: Record<string, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

export type RelatorioCaptacaoItem = {
  tipo?: string | null;
  status?: string | null;
  operacao?: string | null;
  observacoes?: string | null;
  nome_contato?: string | null;
  telefone_contato?: string | null;
  created_at: string;
};

export type RelatorioCaptacaoMetric = {
  canal: string;
  total: number;
  concluidas: number;
  emAndamento: number;
  pendentes: number;
  canceladas: number;
  taxaConversao: number;
  tempoRespostaHoras: number | null;
  tempoFechamentoDias: number | null;
};

export const formatHoursCsv = (h: number | null) => {
  if (h === null) return "—";
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h < 24) return `${h.toFixed(1)} h`;
  return `${(h / 24).toFixed(1)} d`;
};

export const formatDaysCsv = (d: number | null) =>
  d === null ? "—" : `${d.toFixed(1)} d`;

export const escapeCsvCell = (value: unknown) => {
  const s = value === null || value === undefined ? "" : String(value);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * Build the CSV string for the Relatório de Performance de Captação.
 * Includes the "Indicado por" column and an appended "Detalhe Indicações"
 * block when the filtered period contains any item of tipo = "indicacao".
 */
export function buildRelatorioCaptacaoCsv(
  metrics: RelatorioCaptacaoMetric[],
  filtered: RelatorioCaptacaoItem[],
): string {
  const headers = [
    "Canal",
    "Total",
    "Concluídas",
    "Em Andamento",
    "Pendentes",
    "Canceladas",
    "Conversão (%)",
    "Tempo Resposta",
    "Tempo Fechamento",
    "Indicado por",
  ];

  const rows = metrics.map((m) => {
    const itensCanal = filtered.filter(
      (c) => (TIPO_LABELS[c.tipo || "outro"] || c.tipo || "outro") === m.canal,
    );
    const indicadores = Array.from(
      new Set(
        itensCanal
          .map((c) => extractIndicadoPor(c.observacoes))
          .filter((v): v is string => !!v),
      ),
    );
    return [
      m.canal,
      m.total,
      m.concluidas,
      m.emAndamento,
      m.pendentes,
      m.canceladas,
      m.taxaConversao.toFixed(1),
      formatHoursCsv(m.tempoRespostaHoras),
      formatDaysCsv(m.tempoFechamentoDias),
      indicadores.join(" | "),
    ];
  });

  const indicacoes = filtered.filter((c) => c.tipo === "indicacao");
  const detalheHeaders = [
    "Data",
    "Nome",
    "Telefone",
    "Indicado por",
    "Operação",
    "Status",
  ];
  const detalheRows = indicacoes.map((c) => [
    new Date(c.created_at).toLocaleDateString("pt-BR"),
    c.nome_contato || "",
    c.telefone_contato || "",
    extractIndicadoPor(c.observacoes) || "",
    c.operacao || "",
    STATUS_LABELS[c.status || ""] || c.status || "",
  ]);

  const lines: (string | number)[][] = [headers, ...rows];
  if (indicacoes.length > 0) {
    lines.push([], ["Detalhe Indicações"], detalheHeaders, ...detalheRows);
  }
  return lines.map((r) => r.map(escapeCsvCell).join(";")).join("\n");
}
