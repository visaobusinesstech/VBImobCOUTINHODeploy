import { ESTAGIOS } from "@/hooks/useLeads";

/**
 * Métricas avançadas do Dashboard — funções puras alimentadas pelos mesmos
 * datasets do dashboard (leads, contratos, atividades). Toda derivação de
 * estágio passa por `ESTAGIOS` para garantir consistência com o pipeline.
 */

export type LeadMinimo = {
  id: string;
  estagio: string;
  created_at: string;
  valor?: number | null;
};

export type ContratoMinimo = {
  id: string;
  tipo: "Venda" | "Locação" | string;
  status: string;
  valor?: number | null;
  data_inicio?: string | null;
  data_fim?: string | null;
};

export type AtividadeMinima = {
  lead_id: string;
  created_at: string;
};

const STATUS_ATIVOS = new Set(["ativo", "assinado"]);

const isEstagioValido = (id: string) => ESTAGIOS.some((e) => e.id === id);
const ESTAGIO_FECHADO = "fechado";
const ESTAGIOS_DESCARTE = new Set(["perdido", "desistiu", "comprou_outra"]);

/**
 * Taxa de conversão = fechados / total de leads (%). Usa o id "fechado" de ESTAGIOS.
 */
export function computeConversao(leads: LeadMinimo[]): number {
  if (!leads.length) return 0;
  const fechado = ESTAGIOS.find((e) => e.id === ESTAGIO_FECHADO);
  if (!fechado) return 0;
  const fechados = leads.filter((l) => l.estagio === fechado.id).length;
  return +((fechados / leads.length) * 100).toFixed(2);
}

/**
 * Taxa de fechamento = fechados / (fechados + descartados). Ignora leads
 * ainda em andamento (mais fiel do que "fechados / total").
 */
export function computeTaxaFechamento(leads: LeadMinimo[]): number {
  const fechado = ESTAGIOS.find((e) => e.id === ESTAGIO_FECHADO);
  if (!fechado) return 0;
  const decididos = leads.filter(
    (l) => l.estagio === fechado.id || ESTAGIOS_DESCARTE.has(l.estagio),
  );
  if (!decididos.length) return 0;
  const fechados = decididos.filter((l) => l.estagio === fechado.id).length;
  return +((fechados / decididos.length) * 100).toFixed(2);
}

/**
 * MRR = soma dos aluguéis mensais dos contratos de Locação em vigor.
 */
export function computeMRR(contratos: ContratoMinimo[], reference: Date = new Date()): number {
  const ref = reference.getTime();
  return contratos
    .filter((c) => c.tipo === "Locação" && STATUS_ATIVOS.has(c.status))
    .filter((c) => {
      const inicio = c.data_inicio ? new Date(c.data_inicio).getTime() : -Infinity;
      const fim = c.data_fim ? new Date(c.data_fim).getTime() : Infinity;
      return inicio <= ref && ref <= fim;
    })
    .reduce((s, c) => s + Number(c.valor || 0), 0);
}

/**
 * Tempo médio de resposta (horas) = média do intervalo entre o `created_at`
 * do lead e a primeira atividade registrada para aquele lead.
 */
export function computeTempoRespostaMedioHoras(
  leads: LeadMinimo[],
  atividades: AtividadeMinima[],
): number | null {
  const primeirasPorLead = new Map<string, number>();
  for (const a of atividades) {
    const t = new Date(a.created_at).getTime();
    const atual = primeirasPorLead.get(a.lead_id);
    if (atual === undefined || t < atual) primeirasPorLead.set(a.lead_id, t);
  }

  const diffs: number[] = [];
  for (const l of leads) {
    const primeira = primeirasPorLead.get(l.id);
    if (primeira === undefined) continue;
    const criado = new Date(l.created_at).getTime();
    const diffH = (primeira - criado) / 36e5;
    if (Number.isFinite(diffH) && diffH >= 0) diffs.push(diffH);
  }
  if (!diffs.length) return null;
  const media = diffs.reduce((s, v) => s + v, 0) / diffs.length;
  return +media.toFixed(2);
}

/**
 * Distribuição de leads por estágio usando a ordem oficial de `ESTAGIOS`.
 * Garante que qualquer relatório derivado do dashboard não hardcode ids.
 */
export function computeLeadsPorEstagio(leads: LeadMinimo[]) {
  return ESTAGIOS.map((e) => ({
    id: e.id,
    title: e.title,
    total: leads.filter((l) => l.estagio === e.id).length,
  }));
}

export const __internal = { isEstagioValido, ESTAGIOS_DESCARTE, STATUS_ATIVOS };
