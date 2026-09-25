/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 *
 * Etapas, canais e opções alinhados ao CRM Pipeline (Radarimobtech / Lovable).
 */

export const PIPELINE_ESTAGIOS = [
  { id: "novos", title: "Novos Leads", color: "#0ea5e9" },
  { id: "qualificados", title: "Qualificados", color: "#f59e0b" },
  { id: "visita", title: "Visita Agendada", color: "#8b5cf6" },
  { id: "proposta", title: "Proposta", color: "#22c55e" },
  { id: "mandar_opcoes", title: "Mandar Opções", color: "#3b82f6" },
  { id: "pediu_tempo", title: "Pediu Tempo", color: "#f97316" },
  { id: "quer_alugar", title: "Quer Alugar", color: "#14b8a6" },
  { id: "nao_responde", title: "Não Responde", color: "#8c8c8c" },
  { id: "fechado", title: "Fechado", color: "#eab308" },
  { id: "comprou_outra", title: "Comprou c/ Outra", color: "#ea580c" },
  { id: "desistiu", title: "Desistiu", color: "#b91c1c" },
  { id: "perdido", title: "Perdido", color: "#ef4444" },
];

export const LEGACY_ESTAGIO_REMAP = {
  novo: "novos",
  contato: "qualificados",
  qualificacao: "qualificados",
  imoveis_enviados: "mandar_opcoes",
  negociacao: "proposta",
  pos_venda: "fechado",
  procurar_opcoes: "mandar_opcoes",
  opcoes: "mandar_opcoes",
  lost: "perdido",
};

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

export const TIPOS_IMOVEL = [
  "Apartamento",
  "Casa",
  "Terreno",
  "Sala Comercial",
  "Loja",
  "Cobertura",
  "Kitnet",
  "Lote",
  "Outro",
];

export const MOTIVOS_PERDA = [
  { id: "desistiu", label: "Desistiu da compra/aluguel" },
  { id: "concorrente", label: "Comprou com concorrente" },
  { id: "sem_resposta", label: "Sem resposta / Não retornou" },
  { id: "financeiro", label: "Problema financeiro" },
  { id: "outro", label: "Outro motivo" },
];

export function getCanalLabel(id) {
  if (!id) return "Não informado";
  const found = CANAIS_ORIGEM.find((c) => c.id === id || c.label === id);
  return found ? found.label : id;
}

export function normalizeEstagio(estagio) {
  const raw = String(estagio || "").trim().toLowerCase();
  if (!raw) return "novos";
  if (LEGACY_ESTAGIO_REMAP[raw]) return LEGACY_ESTAGIO_REMAP[raw];
  if (PIPELINE_ESTAGIOS.some((e) => e.id === raw)) return raw;
  return raw;
}

export function formatCurrencyDisplay(value) {
  const n = Number(value) || 0;
  if (!n) return "";
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function parseCurrencyInput(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return 0;
  return parseInt(digits, 10) / 100;
}

export function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
