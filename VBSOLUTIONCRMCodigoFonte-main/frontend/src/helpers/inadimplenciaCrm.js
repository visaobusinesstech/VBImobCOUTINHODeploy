/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Helpers de inadimplência — espelho do backend inadimplenciaParity (Lovable).
 */

export const GRAVIDADE_OPTIONS = [
  { value: "todos", label: "Todos" },
  { value: "leve", label: "🟡 Leve (1-15 dias)" },
  { value: "moderado", label: "🟠 Moderado (16-30 dias)" },
  { value: "grave", label: "🔴 Grave (31-60 dias)" },
  { value: "critico", label: "⚫ Crítico (60+ dias)" },
];

export const GRAVIDADE_CONFIG = {
  leve: { label: "Leve", className: "inad-badge--leve", days: "1-15 dias" },
  moderado: { label: "Moderado", className: "inad-badge--moderado", days: "16-30 dias" },
  grave: { label: "Grave", className: "inad-badge--grave", days: "31-60 dias" },
  critico: { label: "Crítico", className: "inad-badge--critico", days: "60+ dias" },
};

export const INADIMPLENCIA_TABS = [
  { id: "lista", label: "Lista Detalhada" },
  { id: "graficos", label: "Gráficos" },
];

export const PIE_COLORS = ["#eab308", "#f97316", "#dc2626", "#7f1d1d"];

export function formatCurrency(v) {
  return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function filterByGravidade(items, filtro) {
  if (!filtro || filtro === "todos") return items || [];
  return (items || []).filter((i) => i.status_gravidade === filtro);
}

export function chartGravidadeData(items) {
  const list = items || [];
  return [
    { name: "Leve", value: list.filter((i) => i.status_gravidade === "leve").length },
    { name: "Moderado", value: list.filter((i) => i.status_gravidade === "moderado").length },
    { name: "Grave", value: list.filter((i) => i.status_gravidade === "grave").length },
    { name: "Crítico", value: list.filter((i) => i.status_gravidade === "critico").length },
  ].filter((d) => d.value > 0);
}

export function chartValorPorGravidade(items) {
  const list = items || [];
  return [
    {
      name: "Leve",
      valor: list.filter((i) => i.status_gravidade === "leve").reduce((s, i) => s + i.valor_total_divida, 0),
    },
    {
      name: "Moderado",
      valor: list
        .filter((i) => i.status_gravidade === "moderado")
        .reduce((s, i) => s + i.valor_total_divida, 0),
    },
    {
      name: "Grave",
      valor: list.filter((i) => i.status_gravidade === "grave").reduce((s, i) => s + i.valor_total_divida, 0),
    },
    {
      name: "Crítico",
      valor: list
        .filter((i) => i.status_gravidade === "critico")
        .reduce((s, i) => s + i.valor_total_divida, 0),
    },
  ].filter((d) => d.valor > 0);
}

export function buildWhatsAppMessage(item) {
  return `Olá ${item.inquilino}, identificamos que o aluguel referente ao contrato "${item.titulo}" encontra-se em atraso de ${item.dias_atraso} dia(s). Valor pendente: ${formatCurrency(item.valor_total_divida)}. Por favor, entre em contato para regularizar.`;
}

export function openWhatsApp(item) {
  const digits = String(item.inquilino_telefone || "").replace(/\D/g, "");
  const text = buildWhatsAppMessage(item);
  window.open(`https://wa.me/55${digits}?text=${encodeURIComponent(text)}`, "_blank");
}

export function persistTab(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export function loadTab(key, fallback = "lista") {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}
