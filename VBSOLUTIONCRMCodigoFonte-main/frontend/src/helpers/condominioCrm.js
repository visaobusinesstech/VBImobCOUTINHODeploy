/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Helpers CRM Condomínios — paridade Lovable (frontend).
 */

export const CONDOMINIO_CANAIS = [
  { value: "whatsapp_business", label: "WhatsApp Business" },
  { value: "email", label: "E-mail" },
  { value: "facebook_groups", label: "Facebook Groups" },
  { value: "anuncio_geo", label: "Anúncio Geolocalizado" },
  { value: "portaria", label: "Portaria" },
  { value: "sindico", label: "Síndico" },
  { value: "administradora", label: "Administradora" },
  { value: "outro", label: "Outro" }
];

export const CONDOMINIO_INICIATIVA_STATUSES = [
  { value: "planejado", label: "Planejado" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "aguardando_retorno", label: "Aguardando retorno" },
  { value: "concluido", label: "Concluído" },
  { value: "sem_sucesso", label: "Sem sucesso" },
  { value: "cancelado", label: "Cancelado" }
];

export const CONDOMINIO_CONTATO_TIPOS = [
  { value: "administradora", label: "Administradora" },
  { value: "sindico", label: "Síndico" },
  { value: "portaria", label: "Portaria" },
  { value: "imobiliaria", label: "Imobiliária" },
  { value: "outro", label: "Outro" }
];

export const CONDOMINIO_CONTATO_STATUSES = [
  { value: "pendente", label: "Pendente" },
  { value: "verificado", label: "Verificado" },
  { value: "invalido", label: "Inválido" },
  { value: "contatado", label: "Contatado" }
];

export const STATUS_BADGE = {
  planejado: "realty-condo-badge realty-condo-badge--slate",
  em_andamento: "realty-condo-badge realty-condo-badge--blue",
  aguardando_retorno: "realty-condo-badge realty-condo-badge--amber",
  concluido: "realty-condo-badge realty-condo-badge--emerald",
  sem_sucesso: "realty-condo-badge realty-condo-badge--rose",
  cancelado: "realty-condo-badge realty-condo-badge--muted"
};

export function isLeadClosed(estagio) {
  const s = String(estagio || "")
    .trim()
    .toLowerCase();
  return ["fechados", "fechado", "ganho", "won"].includes(s);
}

export function isIniciativaAtrasada(i, now = new Date()) {
  if (!i?.dataAgendada || i.dataConclusao) return false;
  const when = new Date(i.dataAgendada);
  if (Number.isNaN(when.getTime())) return false;
  return when.getTime() < now.getTime();
}

export function emptyIniciativaForm() {
  return {
    condominioNome: "",
    bairro: "",
    cep: "",
    canal: "whatsapp_business",
    titulo: "",
    descricao: "",
    responsavel: "",
    dataAgendada: ""
  };
}

export function emptyContatoForm() {
  return {
    condominioNome: "",
    tipo: "administradora",
    nome: "",
    cargo: "",
    telefone: "",
    email: "",
    urlFonte: "manual",
    confianca: 50,
    status: "pendente"
  };
}

export function iniciativaToApiPayload(form) {
  return {
    condominioNome: String(form.condominioNome || "").trim(),
    bairro: form.bairro || null,
    cep: form.cep || null,
    canal: form.canal || "whatsapp_business",
    titulo: String(form.titulo || "").trim(),
    descricao: form.descricao || null,
    responsavel: form.responsavel || null,
    dataAgendada: form.dataAgendada || null,
    status: form.status || "planejado"
  };
}

export function contatoToApiPayload(form) {
  return {
    condominioNome: String(form.condominioNome || "").trim(),
    tipo: form.tipo || "administradora",
    nome: form.nome || null,
    cargo: form.cargo || null,
    telefone: form.telefone || null,
    email: form.email || null,
    urlFonte: form.urlFonte || "manual",
    confianca: Number(form.confianca) || 50,
    status: form.status || "pendente"
  };
}

export function formatBRL(value) {
  const n = Number(value || 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function digitsOnly(phone) {
  return String(phone || "").replace(/\D/g, "");
}
