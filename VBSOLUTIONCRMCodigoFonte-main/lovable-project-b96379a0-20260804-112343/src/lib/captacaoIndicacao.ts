/**
 * Pure helpers for the "Indicação" capture channel.
 * Extracted to enable unit testing without rendering the Captacao page.
 */

export type CaptacaoLike = {
  tipo?: string | null;
  status?: string | null;
  observacoes?: string | null;
};

const INDICADO_POR_RE = /^Indicado por:\s*(.+)/;

/** Extract the "Indicado por" name from observacoes (first line). */
export function extractIndicadoPor(observacoes?: string | null): string | null {
  const m = (observacoes || "").match(INDICADO_POR_RE);
  if (!m) return null;
  const value = m[1].split("\n")[0].trim();
  return value || null;
}

/** Return the observacoes without the "Indicado por: ..." line. */
export function stripIndicadoPor(observacoes?: string | null): string {
  return (observacoes || "").replace(/^Indicado por:.*\n?/, "");
}

/** Build the observacoes string persisted in DB for a capture of any tipo. */
export function buildObservacoes(
  tipo: string,
  indicadoPor: string,
  obs: string
): string | null {
  if (tipo === "indicacao" && indicadoPor.trim()) {
    const rest = obs?.trim() ? `\n${obs}` : "";
    return `Indicado por: ${indicadoPor.trim()}${rest}`;
  }
  return obs?.trim() ? obs : null;
}

/** Validate the submit button state for a capture. */
export function isCaptacaoSubmittable(params: {
  tipo: string;
  nome: string;
  indicadoPor?: string;
}): boolean {
  if (!params.nome.trim()) return false;
  if (params.tipo === "indicacao" && !(params.indicadoPor || "").trim())
    return false;
  return true;
}

export type CaptacaoKpis = {
  total: number;
  pendentes: number;
  andamento: number;
  concluidas: number;
  indicacoes: number;
  taxa: number;
};

/** Compute KPI strip values from a list of captacoes. */
export function computeCaptacaoKpis(list: CaptacaoLike[]): CaptacaoKpis {
  const total = list.length;
  const pendentes = list.filter((c) => c.status === "pendente").length;
  const andamento = list.filter((c) => c.status === "em_andamento").length;
  const concluidas = list.filter((c) => c.status === "concluida").length;
  const indicacoes = list.filter((c) => c.tipo === "indicacao").length;
  const taxa = total > 0 ? Math.round((concluidas / total) * 100) : 0;
  return { total, pendentes, andamento, concluidas, indicacoes, taxa };
}
