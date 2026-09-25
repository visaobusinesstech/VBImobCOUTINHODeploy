/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Paridade Corretores (Lovable ↔ VBSolution realty_modulos kind=corretor).
 */

/** Módulos do diálogo "Gerenciar Funções" — mesma ordem/keys do Lovable. */
export const CORRETOR_MODULOS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "imoveis", label: "Imóveis" },
  { key: "crm", label: "CRM Pipeline" },
  { key: "automacoes", label: "Automações" },
  { key: "financeiro", label: "Financeiro" },
  { key: "contratos", label: "Contratos" },
  { key: "relacionamento", label: "Relacionamento" },
  { key: "jornada", label: "Jornada do Cliente" },
  { key: "followups", label: "Follow-up" },
  { key: "seguranca", label: "Segurança" },
  { key: "configuracoes", label: "Configurações" },
  { key: "proprietarios", label: "Proprietários" }
] as const;

export type CorretorModuloKey = (typeof CORRETOR_MODULOS)[number]["key"];

/** Pontuação do ranking (Lovable CorretorDesempenhoTab). */
export const CORRETOR_PONTOS = {
  fechamento: 10,
  contrato: 8,
  visita: 3,
  reuniao: 2,
  lead: 1
} as const;

/** Metas individuais exibidas no detalhe do corretor. */
export const CORRETOR_METAS = {
  visitas: 20,
  conversoes: 5,
  contratos: 3
} as const;

export const CORRETOR_PERIODOS = ["7", "30", "90", "365"] as const;

/** Campos do formulário Equipe (create/edit) — exatamente o Lovable. */
export const CORRETOR_FORM_FIELDS = ["nome", "email", "telefone", "creci"] as const;

/** Lovable snake_case → VBSolution (realty_modulos + payload). */
export const CORRETOR_FIELD_MAP: Record<string, string> = {
  nome: "title",
  email: "payload.email",
  telefone: "payload.telefone",
  creci: "payload.creci",
  status: "status",
  limite_leads: "payload.limite",
  imobiliaria_id: "companyId",
  created_at: "createdAt"
};

export const ATRIBUICAO_FORM_FIELDS = [
  "corretor_id",
  "cidade",
  "bairro",
  "prioridade",
  "peso",
  "ativo"
] as const;

export const ATRIBUICAO_FIELD_MAP: Record<string, string> = {
  corretor_id: "corretorId",
  cidade: "cidade",
  bairro: "bairro",
  prioridade: "prioridade",
  peso: "peso",
  ativo: "ativo",
  imobiliaria_id: "companyId"
};

/** Estágios de pipeline de captação considerados "fechados" (não contam na carga). */
export const CAPTACAO_CLOSED_STAGES = ["Perdido", "Contrato Assinado"] as const;

export interface CorretorFormInput {
  nome?: string;
  email?: string | null;
  telefone?: string | null;
  creci?: string | null;
  status?: string;
  limite?: number;
  userId?: number | null;
}

/** Normaliza payload de create/edit da aba Equipe. */
export function normalizeCorretorForm(input: CorretorFormInput): {
  title: string;
  status: string;
  payload: Record<string, unknown>;
} | null {
  const nome = String(input?.nome || "").trim();
  if (!nome) return null;

  const email = input.email != null && String(input.email).trim() ? String(input.email).trim() : null;
  const telefone =
    input.telefone != null && String(input.telefone).trim()
      ? String(input.telefone).trim()
      : null;
  const creci =
    input.creci != null && String(input.creci).trim() ? String(input.creci).trim() : null;

  const statusRaw = String(input.status || "ativo").toLowerCase();
  const status = statusRaw === "inativo" || statusRaw === "ferias" ? statusRaw : "ativo";

  const limite =
    input.limite != null && Number.isFinite(Number(input.limite))
      ? Math.max(0, Math.floor(Number(input.limite)))
      : 20;

  const payload: Record<string, unknown> = {
    email,
    telefone,
    creci,
    statusCorretor: status,
    limite
  };

  if (input.userId != null && Number.isFinite(Number(input.userId)) && Number(input.userId) > 0) {
    payload.userId = Number(input.userId);
  }

  return { title: nome, status, payload };
}

/** Serializa modulo realty → shape Lovable usado na UI. */
export function serializeCorretor(row: any): {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  creci: string | null;
  status: string;
  limite_leads: number;
  userId: number | null;
  createdAt: string | null;
} {
  const payload = row?.payload && typeof row.payload === "object" ? row.payload : {};
  const status =
    String(payload.statusCorretor || row?.status || "ativo").toLowerCase() === "ativo"
      ? "ativo"
      : String(payload.statusCorretor || row?.status || "inativo").toLowerCase();

  return {
    id: String(row?.id ?? ""),
    nome: String(row?.title || ""),
    email: payload.email != null ? String(payload.email) : null,
    telefone: payload.telefone != null ? String(payload.telefone) : null,
    creci: payload.creci != null ? String(payload.creci) : null,
    status,
    limite_leads: Math.max(0, Math.floor(Number(payload.limite ?? 20) || 20)),
    userId:
      payload.userId != null && Number.isFinite(Number(payload.userId))
        ? Number(payload.userId)
        : null,
    createdAt: row?.createdAt ? new Date(row.createdAt).toISOString() : null
  };
}

export function buildDefaultPermissoes(
  existing?: Array<{ modulo: string; ativo: boolean }>
): Array<{ modulo: string; ativo: boolean }> {
  const map = new Map((existing || []).map(p => [p.modulo, !!p.ativo]));
  return CORRETOR_MODULOS.map(m => ({
    modulo: m.key,
    ativo: map.has(m.key) ? (map.get(m.key) as boolean) : true
  }));
}

export interface DesempenhoInput {
  id: string;
  nome: string;
  leadsAtribuidos: number;
  leadsFechados: number;
  leadsNovos: number;
  visitas: number;
  reunioes: number;
  contratos: number;
  valorContratos: number;
  comissaoAcumulada: number;
}

export function computePontuacao(stats: {
  leadsFechados: number;
  contratos: number;
  visitas: number;
  reunioes: number;
  leadsAtribuidos: number;
}): number {
  return (
    stats.leadsFechados * CORRETOR_PONTOS.fechamento +
    stats.contratos * CORRETOR_PONTOS.contrato +
    stats.visitas * CORRETOR_PONTOS.visita +
    stats.reunioes * CORRETOR_PONTOS.reuniao +
    stats.leadsAtribuidos * CORRETOR_PONTOS.lead
  );
}

export function computeTaxaConversao(leadsAtribuidos: number, leadsFechados: number): number {
  if (!leadsAtribuidos || leadsAtribuidos <= 0) return 0;
  return (leadsFechados / leadsAtribuidos) * 100;
}

export function finalizeDesempenho(row: DesempenhoInput) {
  const taxaConversao = computeTaxaConversao(row.leadsAtribuidos, row.leadsFechados);
  const pontuacao = computePontuacao({
    leadsFechados: row.leadsFechados,
    contratos: row.contratos,
    visitas: row.visitas,
    reunioes: row.reunioes,
    leadsAtribuidos: row.leadsAtribuidos
  });
  return { ...row, taxaConversao, pontuacao };
}

export function isLeadFechado(status: string | null | undefined): boolean {
  const s = String(status || "").toLowerCase();
  return s === "fechado" || s === "won" || s === "ganho" || s === "closed";
}

export function isLeadNovo(status: string | null | undefined): boolean {
  const s = String(status || "").toLowerCase();
  return s === "novo" || s === "novos" || s === "new" || s === "aberto";
}

export function normalizeAtribuicaoForm(input: {
  corretor_id?: string | number;
  corretorId?: string | number;
  cidade?: string | null;
  bairro?: string | null;
  prioridade?: number | string;
  peso?: number | string;
  ativo?: boolean;
}): {
  corretorId: number;
  cidade: string | null;
  bairro: string | null;
  prioridade: number;
  peso: number;
  ativo: boolean;
} | null {
  const raw = input.corretor_id ?? input.corretorId;
  const corretorId = Number(raw);
  if (!Number.isFinite(corretorId) || corretorId <= 0) return null;

  const prioridade = Number(input.prioridade ?? 100);
  const peso = Math.max(1, Math.floor(Number(input.peso ?? 1) || 1));

  return {
    corretorId,
    cidade: input.cidade != null && String(input.cidade).trim() ? String(input.cidade).trim() : null,
    bairro: input.bairro != null && String(input.bairro).trim() ? String(input.bairro).trim() : null,
    prioridade: Number.isFinite(prioridade) ? prioridade : 100,
    peso,
    ativo: input.ativo !== false
  };
}

export function filterCorretoresBySearch<T extends { nome?: string; email?: string | null; telefone?: string | null }>(
  list: T[],
  query: string
): T[] {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return list;
  return list.filter(
    c =>
      String(c.nome || "")
        .toLowerCase()
        .includes(q) ||
      (c.email && String(c.email).toLowerCase().includes(q)) ||
      (c.telefone && String(c.telefone).toLowerCase().includes(q))
  );
}
