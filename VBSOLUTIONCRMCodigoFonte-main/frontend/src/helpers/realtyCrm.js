/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 */

import { getBackendUrl } from "../config";

export const IMOVEL_STATUSES = [
  "disponivel",
  "reservado",
  "vendido",
  "alugado",
  "captacao",
  "inativo",
];

export const IMOVEL_STATUS_LABELS = {
  disponivel: "Ativo",
  reservado: "Reservado",
  vendido: "Vendido",
  alugado: "Alugado",
  captacao: "Captação",
  inativo: "Inativo",
};

export const IMOVEL_PURPOSE_LABELS = {
  venda: "Venda",
  aluguel: "Aluguel",
  ambos: "Venda e Aluguel",
};

export const TIPOS_IMOVEL = [
  "Apartamento",
  "Casa",
  "Terreno",
  "Comercial",
  "Cobertura",
  "Kitnet",
  "Chácara",
  "Sala",
  "Sala Comercial",
  "Loja",
  "Galpão",
  "Sobrado",
  "Studio",
  "Flat",
  "Fazenda",
  "Sítio",
  "Prédio",
  "Loft",
];

/** Resolve URL relativa de mídia do backend para URL absoluta. */
export function mediaUrl(url) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url) || String(url).startsWith("data:") || String(url).startsWith("blob:")) {
    return url;
  }
  const base = String(getBackendUrl() || "").replace(/\/$/, "");
  return String(url).startsWith("/") ? `${base}${url}` : `${base}/${url}`;
}

export function normalizeHttpUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^[\w.-]+\.[\w.-]+/.test(raw)) return `https://${raw}`;
  return raw;
}

export function imovelStatusLabel(status) {
  return IMOVEL_STATUS_LABELS[status] || status || "—";
}

export function imovelPurposeLabel(purpose) {
  return IMOVEL_PURPOSE_LABELS[purpose] || purpose || "—";
}

/** Status de contrato (paridade Lovable) — objetos id/label para selects. */
export const STATUS_CONTRATO = [
  { id: "rascunho", label: "Rascunho" },
  { id: "aguardando", label: "Aguardando Assinatura" },
  { id: "assinado", label: "Assinado" },
  { id: "ativo", label: "Ativo" },
  { id: "inativo", label: "Inativo" },
  { id: "vencendo", label: "Vencendo" },
  { id: "cancelado", label: "Cancelado" },
];

/** Array de ids para back-compat com código legado. */
export const CONTRATO_STATUSES = STATUS_CONTRATO.map((s) => s.id);

const CONTRATO_STATUS_LEGACY = {
  aguardando_assinatura: "aguardando",
  encerrado: "inativo",
};

export function normalizeContratoStatus(status) {
  const raw = String(status || "").trim().toLowerCase();
  if (!raw) return "rascunho";
  if (CONTRATO_STATUS_LEGACY[raw]) return CONTRATO_STATUS_LEGACY[raw];
  if (CONTRATO_STATUSES.includes(raw)) return raw;
  return raw;
}

export const CANAIS_ORIGEM = [
  { id: "indicacao", label: "Indicação" },
  { id: "amigos", label: "Amigos" },
  { id: "portal_imoveis", label: "Portal de Imóveis" },
  { id: "instagram", label: "Instagram" },
  { id: "facebook", label: "Facebook" },
  { id: "trafego_pago_instagram", label: "Tráfego Pago Instagram" },
  { id: "trafego_pago_google", label: "Tráfego Pago Google" },
  { id: "google_ads", label: "Google Ads" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "site", label: "Site" },
  { id: "cliente_carteira", label: "Cliente de Carteira" },
  { id: "placa", label: "Placa / Faixa" },
  { id: "olx", label: "OLX" },
  { id: "dfimoveis", label: "DF Imóveis" },
  { id: "chave_na_mao", label: "Chave na Mão" },
  { id: "wimoveis", label: "W Imóveis" },
  { id: "evento", label: "Evento / Feira" },
  { id: "parceria_corretor", label: "Parceria Corretor" },
  { id: "outro", label: "Outro" },
];

export function getCanalLabel(id) {
  if (!id) return "Não informado";
  const found = CANAIS_ORIGEM.find((c) => c.id === id);
  return found ? found.label : id;
}

export const TIPOS_CONTRATO = [
  { id: "Venda", label: "Venda" },
  { id: "Locação", label: "Locação" },
  { id: "Administração", label: "Administração de Imóveis" },
  { id: "Exclusividade", label: "Exclusividade (Venda)" },
];

export const TIPO_GARANTIA = [
  { id: "seguro_fianca", label: "Seguro Fiança" },
  { id: "caucao", label: "Caução" },
  { id: "fiador", label: "Fiador" },
  { id: "titulo_capitalizacao", label: "Título de Capitalização" },
  { id: "renda_locatario", label: "Apenas Renda do Locatário" },
];

export const INDICE_CORRECAO = [
  { id: "IGPM", label: "IGP-M" },
  { id: "IPCA", label: "IPCA" },
  { id: "INPC", label: "INPC" },
];

export const IMPOSTO_TIPOS = [
  { id: "ISS", label: "ISS" },
  { id: "IRPF", label: "IRPF" },
  { id: "IRPJ", label: "IRPJ" },
  { id: "CSLL", label: "CSLL" },
  { id: "PIS_COFINS", label: "PIS/COFINS" },
  { id: "SIMPLES", label: "Simples Nacional" },
  { id: "OUTRO", label: "Outro" },
];

export const ESTADO_CIVIL = [
  { id: "solteiro", label: "Solteiro(a)" },
  { id: "casado", label: "Casado(a)" },
  { id: "divorciado", label: "Divorciado(a)" },
  { id: "viuvo", label: "Viúvo(a)" },
  { id: "uniao_estavel", label: "União Estável" },
];

export const COMISSAO_TIPOS = [
  { id: "mensal", label: "Mensal (sobre cada aluguel)" },
  { id: "anual", label: "Anual (sobre 12 meses)" },
];

/**
 * Completude documental do contrato (paridade Lovable Contratos.tsx).
 * Usa campos camelCase da API VBSolution.
 */
export function getDocCompleteness(c) {
  const contrato = c || {};
  const check = (val, type) => {
    if (type === "bool") return val === true;
    if (type === "file") return typeof val === "string" && val.length > 5;
    if (typeof val === "number") return val > 0;
    return typeof val === "string" && val.trim().length > 0;
  };

  let items = [];
  if (contrato.tipo === "Locação") {
    items = [
      { label: "Contrato PDF", val: contrato.contratoAnexoUrl, type: "file" },
      { label: "Vistoria entrada", val: contrato.vistoriaEntrada, type: "bool" },
      { label: "Laudo vistoria", val: contrato.vistoriaAnexoUrl, type: "file" },
      { label: "Apólice seguro", val: contrato.apoliceSeguro, type: "bool" },
      { label: "Apólice PDF", val: contrato.apoliceAnexoUrl, type: "file" },
      { label: "Seguro incêndio", val: contrato.seguroIncendioAnexoUrl, type: "file" },
      { label: "CPF inquilino", val: contrato.inquilinoCpf, type: "data" },
      { label: "Tel inquilino", val: contrato.inquilinoTelefone, type: "data" },
      { label: "CPF proprietário", val: contrato.proprietarioCpf, type: "data" },
      { label: "Tel proprietário", val: contrato.proprietarioTelefone, type: "data" },
      { label: "Matrícula", val: contrato.matricula, type: "data" },
    ];
  } else if (contrato.tipo === "Venda" || contrato.tipo === "Exclusividade") {
    items = [
      { label: "Contrato PDF", val: contrato.contratoAnexoUrl, type: "file" },
      { label: "CPF comprador", val: contrato.clienteCpf, type: "data" },
      { label: "Tel comprador", val: contrato.clienteTelefone, type: "data" },
      { label: "E-mail comprador", val: contrato.clienteEmail, type: "data" },
      { label: "CPF proprietário", val: contrato.proprietarioCpf, type: "data" },
      { label: "Tel proprietário", val: contrato.proprietarioTelefone, type: "data" },
      { label: "Matrícula", val: contrato.matricula, type: "data" },
      { label: "Comissão", val: contrato.comissaoPercentual || contrato.comissaoValor, type: "data" },
    ];
  } else {
    items = [
      { label: "Contrato PDF", val: contrato.contratoAnexoUrl, type: "file" },
      { label: "CPF proprietário", val: contrato.proprietarioCpf, type: "data" },
      { label: "Tel proprietário", val: contrato.proprietarioTelefone, type: "data" },
      { label: "Matrícula", val: contrato.matricula, type: "data" },
      { label: "Comissão", val: contrato.comissaoPercentual || contrato.comissaoValor, type: "data" },
    ];
  }

  const done = items.filter((i) => check(i.val, i.type)).length;
  const missing = items.filter((i) => !check(i.val, i.type)).map((i) => i.label);
  return { done, total: items.length, missing };
}

/** Base de cálculo da comissão (Locação anual = 12× aluguel). */
export function getCommissionBaseValue(state) {
  const s = state || {};
  const valor = Number(s.value) || 0;
  if (s.tipo === "Locação" && s.comissaoTipo === "anual") return valor * 12;
  return valor;
}

/** Recalcula valores de comissão/imposto a partir dos percentuais (camelCase). */
export function recalculateCommissionState(state) {
  const s = state || {};
  const comissaoBase = getCommissionBaseValue(s);
  const comissaoPercentual = Number(s.comissaoPercentual) || 0;
  const comissaoValor =
    comissaoPercentual > 0
      ? (comissaoBase * comissaoPercentual) / 100
      : Number(s.comissaoValor) || 0;

  const parceiroPct = Number(s.parceiroComissaoPercentual) || 0;
  const captadorPct = Number(s.captadorComissaoPercentual) || 0;
  const corretorPct = Number(s.corretorComissaoPercentual) || 0;
  const impostoPct = Number(s.impostoPercentual) || 0;

  return {
    ...s,
    comissaoValor,
    parceiroComissaoValor:
      parceiroPct > 0 ? (comissaoValor * parceiroPct) / 100 : Number(s.parceiroComissaoValor) || 0,
    captadorComissaoValor:
      captadorPct > 0 ? (comissaoValor * captadorPct) / 100 : Number(s.captadorComissaoValor) || 0,
    corretorComissaoValor:
      corretorPct > 0 ? (comissaoValor * corretorPct) / 100 : Number(s.corretorComissaoValor) || 0,
    impostoValor: impostoPct > 0 ? (comissaoValor * impostoPct) / 100 : Number(s.impostoValor) || 0,
  };
}

export const STATUS_PROPOSTA = [
  { id: "em_negociacao", label: "Em Negociação" },
  { id: "aceita", label: "Aceita" },
  { id: "recusada", label: "Recusada" },
  { id: "cancelada", label: "Cancelada" },
];

export const FORMAS_PAGAMENTO = [
  { id: "a_vista", label: "À Vista" },
  { id: "financiamento", label: "Financiamento" },
  { id: "parcelado", label: "Parcelado" },
  { id: "permuta", label: "Permuta" },
  { id: "consorcio", label: "Consórcio" },
  { id: "outro", label: "Outro" },
];

export const FOLLOWUP_STATUS_OPTIONS = [
  { id: "pendente", label: "Novo lead", color: "#3b82f6" },
  { id: "aguardando", label: "Aguardando resposta", color: "#eab308" },
  { id: "visita_realizada", label: "Visita realizada", color: "#a855f7" },
  { id: "proposta", label: "Proposta enviada", color: "#f97316" },
  { id: "negociacao", label: "Negociação", color: "#06b6d4" },
  { id: "concluido", label: "Fechado", color: "#22c55e" },
  { id: "perdido", label: "Perdido", color: "#ef4444" },
  { id: "cancelado", label: "Cancelado", color: "#94a3b8" },
];

export const FOLLOWUP_TIPO_LABELS = {
  ligacao: "Ligação",
  whatsapp: "WhatsApp",
  email: "E-mail",
  visita: "Visita",
  reuniao: "Reunião",
  outro: "Outro",
};

/** Tipos de compromisso — paridade Lovable TIPOS_COMPROMISSO */
export const TIPOS_COMPROMISSO = [
  { id: "visita", label: "Visita a Imóvel", emoji: "🏠", color: "#7c3aed" },
  { id: "reuniao", label: "Reunião", emoji: "🤝", color: "#0ea5e9" },
  { id: "tarefa", label: "Tarefa Interna", emoji: "📋", color: "#f59e0b" },
  { id: "ligacao", label: "Ligação", emoji: "📞", color: "#22c55e" },
  { id: "assinatura", label: "Assinatura", emoji: "✍️", color: "#ef4444" },
  { id: "outro", label: "Outro", emoji: "📌", color: "#64748b" },
];

export const COMPROMISSO_PRIORIDADE_OPTIONS = [
  { id: "alta", label: "Alta" },
  { id: "media", label: "Média" },
  { id: "baixa", label: "Baixa" },
];

export const COMPROMISSO_RESULTADO_OPTIONS = [
  { id: "gostou", label: "Gostou do imóvel" },
  { id: "mais_opcoes", label: "Pediu mais opções" },
  { id: "nao_gostou", label: "Não gostou" },
];

export const FOLLOWUP_AGENDA_TIPOS = [
  { id: "ligacao", label: "Ligação" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "email", label: "E-mail" },
  { id: "visita", label: "Visita" },
  { id: "reuniao", label: "Reunião" },
  { id: "outro", label: "Outro" },
];

export const FOLLOWUP_MENSAGENS_PRONTAS = [
  "Olá, estou passando para saber se você ainda tem interesse no imóvel que visitamos.",
  "Gostaria de saber se você teve tempo de analisar a proposta enviada.",
  "Olá! Temos novidades sobre imóveis que podem te interessar. Podemos conversar?",
  "Boa tarde! Gostaria de agendar uma visita ao imóvel? Tenho horários disponíveis.",
];

export function parseCurrencyInput(value) {
  const cleaned = String(value || "").replace(/[^\d.,]/g, "");
  if (!cleaned) return 0;
  const normalized = cleaned.replace(/\./g, "").replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatCurrencyInput(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return "";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function isImovelAvailable(status) {
  const s = normalizeText(status);
  return !s || s === "disponivel" || s === "captacao";
}

export function scoreLeadImovelMatch(lead, imovel) {
  const reasons = [];
  let score = 0;
  const leadCity = normalizeText(lead && lead.interestCity);
  const imovelCity = normalizeText(imovel && imovel.city);
  if (leadCity && imovelCity && leadCity === imovelCity) {
    score += 40;
    reasons.push("mesma cidade");
  }
  const leadNbhd = normalizeText(lead && lead.interestNeighborhood);
  const imovelNbhd = normalizeText(imovel && imovel.neighborhood);
  if (leadNbhd && imovelNbhd && leadNbhd === imovelNbhd) {
    score += 25;
    reasons.push("mesmo bairro");
  }
  const leadType = normalizeText(lead && lead.interestType);
  const imovelType = normalizeText(imovel && imovel.type);
  if (leadType && imovelType && leadType === imovelType) {
    score += 20;
    reasons.push("mesmo tipo");
  }
  const leadBeds = Number(lead && lead.bedrooms);
  const imovelBeds = Number(imovel && imovel.bedrooms);
  if (Number.isFinite(leadBeds) && Number.isFinite(imovelBeds) && leadBeds > 0 && imovelBeds >= leadBeds) {
    score += 10;
    reasons.push("quartos suficientes");
  }
  const leadValue = Number(lead && lead.value);
  const price = Number(imovel && imovel.price);
  if (Number.isFinite(leadValue) && leadValue > 0 && Number.isFinite(price) && price > 0) {
    const ratio = Math.abs(price - leadValue) / leadValue;
    if (ratio <= 0.2) {
      score += 15;
      reasons.push("faixa de preço");
    }
  }
  if (isImovelAvailable(imovel && imovel.status)) {
    score += 10;
    reasons.push("disponível");
  }
  return { score, reasons };
}

export function rankImoveisForLead(lead, imoveis, limit = 5) {
  return (imoveis || [])
    .map((imovel) => {
      const { score, reasons } = scoreLeadImovelMatch(lead, imovel);
      return { imovelId: Number(imovel.id), score, reasons, imovel };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, limit));
}

export function formatBRL(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function estimateAvaliacao(preco, area, precoM2Mercado) {
  const p = Number(preco) || 0;
  const a = Number(area) || 0;
  const m2 = Number(precoM2Mercado) || 0;
  const imovelM2 = a > 0 ? p / a : 0;
  const valorJusto = m2 > 0 && a > 0 ? m2 * a : p;
  const desvio = valorJusto > 0 ? ((p - valorJusto) / valorJusto) * 100 : 0;
  let parecer = "em linha com o mercado";
  if (desvio > 15) parecer = "acima do mercado";
  else if (desvio < -15) parecer = "abaixo do mercado — oportunidade";
  return {
    precoM2: Math.round(imovelM2),
    valorJusto: Math.round(valorJusto),
    desvio: Math.round(desvio),
    parecer,
  };
}

export function groupLeadsByStage(leads, stages) {
  const map = {};
  (stages || []).forEach((st) => {
    map[st.key] = [];
  });
  (leads || []).forEach((lead) => {
    const key = String(lead.status || "novo").toLowerCase();
    if (!map[key]) map[key] = [];
    map[key].push(lead);
  });
  return map;
}
