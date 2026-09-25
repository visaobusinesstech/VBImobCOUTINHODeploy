/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Helpers CRM Condomínios — paridade Lovable CrmCondominios + Orquestração/Enriquecimento.
 */

export const CONDOMINIO_CANAIS = [
  "whatsapp_business",
  "email",
  "facebook_groups",
  "anuncio_geo",
  "portaria",
  "sindico",
  "administradora",
  "outro"
] as const;

export const CONDOMINIO_INICIATIVA_STATUSES = [
  "planejado",
  "em_andamento",
  "aguardando_retorno",
  "concluido",
  "sem_sucesso",
  "cancelado"
] as const;

export const CONDOMINIO_CONTATO_TIPOS = [
  "administradora",
  "sindico",
  "portaria",
  "imobiliaria",
  "outro"
] as const;

export const CONDOMINIO_CONTATO_STATUSES = [
  "pendente",
  "verificado",
  "invalido",
  "contatado"
] as const;

export const CONDOMINIO_LOG_TIPOS = [
  "nota",
  "status_change",
  "mensagem_enviada",
  "resposta_recebida",
  "anexo",
  "sistema"
] as const;

/** Lovable estagio "fechados" ↔ VBSolution status "fechado" */
export const CONDOMINIO_LEAD_CLOSED_STATUSES = [
  "fechados",
  "fechado",
  "ganho",
  "won"
] as const;

export type CondominioIniciativaLike = {
  id?: number | string;
  condominioNome: string;
  bairro?: string | null;
  cep?: string | null;
  canal: string;
  titulo: string;
  descricao?: string | null;
  status: string;
  responsavel?: string | null;
  dataAgendada?: string | Date | null;
  dataConclusao?: string | Date | null;
  resultado?: string | null;
};

export type CondominioContatoLike = {
  id?: number | string;
  condominioNome: string;
  tipo: string;
  nome?: string | null;
  telefone?: string | null;
  email?: string | null;
  urlFonte?: string | null;
  status?: string | null;
  confianca?: number | null;
};

export type CondominioLeadLike = {
  id: number | string;
  nome: string;
  telefone?: string | null;
  email?: string | null;
  interesse?: string | null;
  bairroInteresse?: string | null;
  estagio: string;
  valor?: number | null;
  canalOrigem?: string | null;
  createdAt?: string | Date | null;
};

export function pickAllowed(
  value: unknown,
  allowed: readonly string[],
  fallback: string
): string {
  const v = String(value || "")
    .trim()
    .toLowerCase();
  if (allowed.includes(v)) return v;
  return fallback;
}

export function clampConfianca(value: unknown, fallback = 50): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function isLeadClosed(estagio?: string | null): boolean {
  const s = String(estagio || "")
    .trim()
    .toLowerCase();
  return (CONDOMINIO_LEAD_CLOSED_STATUSES as readonly string[]).includes(s);
}

export function isIniciativaAberta(i: {
  dataConclusao?: string | Date | null;
}): boolean {
  return !i.dataConclusao;
}

export function isIniciativaAtrasada(i: {
  dataAgendada?: string | Date | null;
  dataConclusao?: string | Date | null;
  now?: Date;
}): boolean {
  if (!i.dataAgendada || i.dataConclusao) return false;
  const when = new Date(i.dataAgendada);
  if (Number.isNaN(when.getTime())) return false;
  const now = i.now || new Date();
  return when.getTime() < now.getTime();
}

export function leadInteresseHaystack(lead: {
  interesse?: string | null;
  bairroInteresse?: string | null;
}): string {
  return `${lead.interesse ?? ""} ${lead.bairroInteresse ?? ""}`.toLowerCase();
}

export function matchLeadsToCondo(
  condoNome: string,
  leads: CondominioLeadLike[]
): CondominioLeadLike[] {
  const needle = String(condoNome || "")
    .trim()
    .toLowerCase();
  if (!needle) return [];
  return leads.filter(ld => leadInteresseHaystack(ld).includes(needle));
}

export type CondoHubEntry = {
  nome: string;
  bairro: string | null;
  iniciativas: CondominioIniciativaLike[];
  contatos: CondominioContatoLike[];
  leads: CondominioLeadLike[];
};

/** Agrupa iniciativas + contatos por nome e vincula leads (paridade Lovable). */
export function buildCondominioHub(params: {
  iniciativas: CondominioIniciativaLike[];
  contatos: CondominioContatoLike[];
  leads: CondominioLeadLike[];
  search?: string;
}): CondoHubEntry[] {
  const map = new Map<string, CondoHubEntry>();

  const push = (nome: string, bairro: string | null) => {
    const key = String(nome || "").trim();
    if (!key) return null;
    if (!map.has(key)) {
      map.set(key, { nome: key, bairro, iniciativas: [], contatos: [], leads: [] });
    }
    const entry = map.get(key)!;
    if (!entry.bairro && bairro) entry.bairro = bairro;
    return entry;
  };

  params.iniciativas.forEach(it => {
    const e = push(it.condominioNome, it.bairro || null);
    if (e) e.iniciativas.push(it);
  });
  params.contatos.forEach(c => {
    const e = push(c.condominioNome, null);
    if (e) e.contatos.push(c);
  });

  for (const entry of Array.from(map.values())) {
    entry.leads = matchLeadsToCondo(entry.nome, params.leads);
  }

  let arr = Array.from(map.values());
  const q = String(params.search || "")
    .trim()
    .toLowerCase();
  if (q) {
    arr = arr.filter(
      c =>
        c.nome.toLowerCase().includes(q) || (c.bairro || "").toLowerCase().includes(q)
    );
  }

  return arr.sort(
    (a, b) =>
      b.leads.length - a.leads.length || b.iniciativas.length - a.iniciativas.length
  );
}

export function computeCondominioKpis(params: {
  condominios: CondoHubEntry[];
  iniciativas: CondominioIniciativaLike[];
  leads: CondominioLeadLike[];
  now?: Date;
}) {
  const now = params.now || new Date();
  const totalCondos = params.condominios.length;
  const totalLeads = params.condominios.reduce((s, c) => s + c.leads.length, 0);
  const proximos = params.iniciativas.filter(
    i => i.dataAgendada && !i.dataConclusao
  ).length;
  const atrasados = params.iniciativas.filter(i =>
    isIniciativaAtrasada({ ...i, now })
  ).length;
  const fechados = params.leads.filter(l => isLeadClosed(l.estagio)).length;
  return { totalCondos, totalLeads, proximos, atrasados, fechados };
}

export function normalizeIniciativaPayload(
  body: Record<string, any>,
  defaults: { status?: string; canal?: string } = {}
): Record<string, any> {
  const status = pickAllowed(
    body.status,
    CONDOMINIO_INICIATIVA_STATUSES,
    defaults.status || "planejado"
  );
  const canal = pickAllowed(
    body.canal,
    CONDOMINIO_CANAIS,
    defaults.canal || "whatsapp_business"
  );

  const data: Record<string, any> = {
    condominioNome: String(body.condominioNome || body.condominio_nome || "").trim(),
    bairro: body.bairro != null && body.bairro !== "" ? String(body.bairro).trim() : null,
    cep: body.cep != null && body.cep !== "" ? String(body.cep).trim() : null,
    canal,
    titulo: String(body.titulo || "").trim(),
    descricao:
      body.descricao != null && body.descricao !== ""
        ? String(body.descricao).trim()
        : null,
    status,
    responsavel:
      body.responsavel != null && body.responsavel !== ""
        ? String(body.responsavel).trim()
        : null,
    dataAgendada: body.dataAgendada || body.data_agendada || null,
    dataConclusao: body.dataConclusao || body.data_conclusao || null,
    resultado:
      body.resultado != null && body.resultado !== ""
        ? String(body.resultado).trim()
        : null
  };

  if (body.metadata && typeof body.metadata === "object") {
    data.metadata = body.metadata;
  }

  const terminal = ["concluido", "sem_sucesso", "cancelado"];
  if (terminal.includes(status) && !data.dataConclusao) {
    data.dataConclusao = new Date();
  }

  return data;
}

export function normalizeContatoPayload(
  body: Record<string, any>,
  defaults: { status?: string; tipo?: string } = {}
): Record<string, any> {
  return {
    condominioNome: String(body.condominioNome || body.condominio_nome || "").trim(),
    tipo: pickAllowed(
      body.tipo,
      CONDOMINIO_CONTATO_TIPOS,
      defaults.tipo || "administradora"
    ),
    nome: body.nome != null && body.nome !== "" ? String(body.nome).trim() : null,
    cargo: body.cargo != null && body.cargo !== "" ? String(body.cargo).trim() : null,
    telefone:
      body.telefone != null && body.telefone !== "" ? String(body.telefone).trim() : null,
    email: body.email != null && body.email !== "" ? String(body.email).trim() : null,
    urlFonte: String(body.urlFonte || body.url_fonte || "manual").trim() || "manual",
    trechoFonte:
      body.trechoFonte || body.trecho_fonte
        ? String(body.trechoFonte || body.trecho_fonte).trim()
        : null,
    confianca: clampConfianca(body.confianca, 50),
    status: pickAllowed(
      body.status,
      CONDOMINIO_CONTATO_STATUSES,
      defaults.status || "pendente"
    ),
    metadata:
      body.metadata && typeof body.metadata === "object" ? body.metadata : undefined
  };
}

/** Converte LeadSale (VBSolution) → shape Lovable do hub. */
export function mapLeadSaleToCondoLead(row: any): CondominioLeadLike {
  const tags = Array.isArray(row.tags) ? row.tags.join(" ") : "";
  const interesse = [row.interestType, row.purpose, tags, row.description]
    .filter(Boolean)
    .join(" ");
  return {
    id: row.id,
    nome: row.name || `Lead #${row.id}`,
    telefone: row.phone || null,
    email: row.email || null,
    interesse: interesse || null,
    bairroInteresse: row.interestNeighborhood || null,
    estagio: row.status || "novo",
    valor: row.value != null ? Number(row.value) : 0,
    canalOrigem: row.origin || null,
    createdAt: row.createdAt || null
  };
}

export function serializeIniciativa(row: any) {
  const j = typeof row.toJSON === "function" ? row.toJSON() : row;
  return {
    id: j.id,
    condominioNome: j.condominioNome,
    bairro: j.bairro,
    cep: j.cep,
    canal: j.canal,
    titulo: j.titulo,
    descricao: j.descricao,
    status: j.status,
    responsavel: j.responsavel,
    dataAgendada: j.dataAgendada,
    dataConclusao: j.dataConclusao,
    resultado: j.resultado,
    metadata: j.metadata || {},
    createdAt: j.createdAt,
    updatedAt: j.updatedAt
  };
}

export function serializeContato(row: any) {
  const j = typeof row.toJSON === "function" ? row.toJSON() : row;
  return {
    id: j.id,
    condominioNome: j.condominioNome,
    tipo: j.tipo,
    nome: j.nome,
    cargo: j.cargo,
    telefone: j.telefone,
    email: j.email,
    urlFonte: j.urlFonte,
    trechoFonte: j.trechoFonte,
    confianca: j.confianca,
    status: j.status,
    metadata: j.metadata || {},
    createdAt: j.createdAt,
    updatedAt: j.updatedAt
  };
}
