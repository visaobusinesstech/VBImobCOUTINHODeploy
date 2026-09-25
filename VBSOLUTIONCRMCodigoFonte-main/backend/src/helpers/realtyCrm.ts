/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 */

export const IMOVEL_STATUSES = [
  "disponivel",
  "reservado",
  "vendido",
  "alugado",
  "captacao",
  "inativo"
] as const;

export const CONTRATO_STATUSES = [
  "rascunho",
  "aguardando",
  "assinado",
  "ativo",
  "inativo",
  "vencendo",
  "cancelado",
  "aguardando_assinatura",
  "encerrado"
] as const;

export const REALTY_PIPELINE_STAGES = [
  { key: "novo", label: "Novos", order: 1 },
  { key: "contato", label: "Contato", order: 2 },
  { key: "qualificacao", label: "Qualificação", order: 3 },
  { key: "imoveis_enviados", label: "Imóveis enviados", order: 4 },
  { key: "visita", label: "Visita", order: 5 },
  { key: "proposta", label: "Proposta", order: 6 },
  { key: "negociacao", label: "Negociação", order: 7 },
  { key: "fechado", label: "Fechado", order: 8 },
  { key: "perdido", label: "Perdido", order: 9 },
  { key: "pos_venda", label: "Pós-venda", order: 10 }
] as const;

export const FOLLOWUP_STATUSES = [
  "pendente",
  "aguardando",
  "visita_realizada",
  "proposta",
  "negociacao",
  "concluido",
  "perdido",
  "cancelado"
] as const;

export const FOLLOWUP_INACTIVE_LEAD_STATUSES = [
  "fechado",
  "perdido",
  "descartado",
  "inativo"
] as const;

export const FOLLOWUP_INACTIVE_CONTRATO_STATUSES = [
  "inativo",
  "cancelado",
  "encerrado",
  "finalizado",
  "distratado"
] as const;
export const VISITA_STATUSES = ["agendada", "confirmada", "realizada", "cancelada", "reagendada"] as const;

/** Status da agenda Lovable (compromissos) */
export const COMPROMISSO_STATUSES = ["pendente", "concluido", "cancelado"] as const;
export const COMPROMISSO_TIPOS = [
  "visita",
  "reuniao",
  "tarefa",
  "ligacao",
  "assinatura",
  "outro"
] as const;
export const COMPROMISSO_PRIORIDADES = ["alta", "media", "baixa"] as const;
export const COMPROMISSO_RESULTADO_CLIENTE = ["gostou", "mais_opcoes", "nao_gostou"] as const;
export const PROPOSTA_STATUSES = [
  "em_negociacao",
  "aceita",
  "recusada",
  "cancelada",
  "rascunho",
  "enviada",
  "expirada"
] as const;

export type LeadMatchInput = {
  interestCity?: string | null;
  interestNeighborhood?: string | null;
  interestType?: string | null;
  bedrooms?: number | null;
  value?: number | null;
};

export type ImovelMatchInput = {
  id: number;
  title?: string | null;
  city?: string | null;
  neighborhood?: string | null;
  type?: string | null;
  bedrooms?: number | null;
  price?: number | null;
  status?: string | null;
};

export type MatchResult = {
  imovelId: number;
  score: number;
  reasons: string[];
  imovel: ImovelMatchInput;
};

export function normalizeText(value?: string | null): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function isImovelAvailable(status?: string | null): boolean {
  const s = normalizeText(status);
  return !s || s === "disponivel" || s === "captacao";
}

export function scoreLeadImovelMatch(
  lead: LeadMatchInput,
  imovel: ImovelMatchInput
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  const leadCity = normalizeText(lead.interestCity);
  const imovelCity = normalizeText(imovel.city);
  if (leadCity && imovelCity && leadCity === imovelCity) {
    score += 40;
    reasons.push("mesma cidade");
  }

  const leadNbhd = normalizeText(lead.interestNeighborhood);
  const imovelNbhd = normalizeText(imovel.neighborhood);
  if (leadNbhd && imovelNbhd && leadNbhd === imovelNbhd) {
    score += 25;
    reasons.push("mesmo bairro");
  }

  const leadType = normalizeText(lead.interestType);
  const imovelType = normalizeText(imovel.type);
  if (leadType && imovelType && leadType === imovelType) {
    score += 20;
    reasons.push("mesmo tipo");
  }

  const leadBeds = Number(lead.bedrooms);
  const imovelBeds = Number(imovel.bedrooms);
  if (Number.isFinite(leadBeds) && Number.isFinite(imovelBeds) && leadBeds > 0) {
    if (imovelBeds >= leadBeds) {
      score += 10;
      reasons.push("quartos suficientes");
    }
  }

  const leadValue = Number(lead.value);
  const price = Number(imovel.price);
  if (Number.isFinite(leadValue) && leadValue > 0 && Number.isFinite(price) && price > 0) {
    const ratio = Math.abs(price - leadValue) / leadValue;
    if (ratio <= 0.2) {
      score += 15;
      reasons.push("faixa de preço");
    }
  }

  if (isImovelAvailable(imovel.status)) {
    score += 10;
    reasons.push("disponível");
  }

  return { score, reasons };
}

export function rankImoveisForLead(
  lead: LeadMatchInput,
  imoveis: ImovelMatchInput[],
  limit = 5
): MatchResult[] {
  return (imoveis || [])
    .map(imovel => {
      const { score, reasons } = scoreLeadImovelMatch(lead, imovel);
      return { imovelId: Number(imovel.id), score, reasons, imovel };
    })
    .filter(row => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, limit));
}

export function clampPageSize(pageSize?: string | number, fallback = 20, max = 500): number {
  const n = Number(pageSize);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(Math.floor(n), max);
}

export function pickAllowedStatus(
  value: unknown,
  allowed: readonly string[],
  fallback: string
): string {
  const s = String(value || "").trim();
  return allowed.includes(s) ? s : fallback;
}

export function groupLeadsByStage<T extends { status?: string | null }>(
  leads: T[],
  stages: Array<{ key: string }>
): Record<string, T[]> {
  const map: Record<string, T[]> = {};
  stages.forEach(st => {
    map[st.key] = [];
  });
  (leads || []).forEach(lead => {
    const key = String(lead.status || "novo").toLowerCase();
    if (!map[key]) map[key] = [];
    map[key].push(lead);
  });
  return map;
}
