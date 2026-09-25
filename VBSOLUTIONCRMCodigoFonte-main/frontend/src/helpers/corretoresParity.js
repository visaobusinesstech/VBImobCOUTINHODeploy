/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Paridade Corretores (Lovable) — constantes e helpers de UI.
 */

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
  { key: "proprietarios", label: "Proprietários" },
];

export const CORRETOR_PONTOS = {
  fechamento: 10,
  contrato: 8,
  visita: 3,
  reuniao: 2,
  lead: 1,
};

export const CORRETOR_METAS = {
  visitas: 20,
  conversoes: 5,
  contratos: 3,
};

export const CORRETOR_PERIODOS = [
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
  { value: "365", label: "Último ano" },
];

export const CORRETOR_FORM_FIELDS = ["nome", "email", "telefone", "creci"];

export const ATRIBUICAO_FORM_FIELDS = [
  "corretor_id",
  "cidade",
  "bairro",
  "prioridade",
  "peso",
  "ativo",
];

export const emptyCorretorForm = () => ({
  nome: "",
  email: "",
  telefone: "",
  creci: "",
});

export const initials = (nome) =>
  String(nome || "")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export const fmtCur = (v) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(Number(v) || 0);

export const filterCorretoresBySearch = (list, query) => {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return list;
  return (list || []).filter(
    (c) =>
      String(c.nome || "")
        .toLowerCase()
        .includes(q) ||
      (c.email && String(c.email).toLowerCase().includes(q)) ||
      (c.telefone && String(c.telefone).toLowerCase().includes(q))
  );
};

export const waLink = (telefone) => {
  const digits = String(telefone || "").replace(/\D/g, "");
  if (!digits) return null;
  return `https://wa.me/55${digits}`;
};
