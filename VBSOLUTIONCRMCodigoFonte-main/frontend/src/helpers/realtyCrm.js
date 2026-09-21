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
];

export const CONTRATO_STATUSES = [
  "rascunho",
  "aguardando_assinatura",
  "ativo",
  "encerrado",
];

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
