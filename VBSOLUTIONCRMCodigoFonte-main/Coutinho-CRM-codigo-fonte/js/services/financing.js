/**
 * Motor de Simulação de Financiamento Imobiliário
 * SAC / PRICE, poder de compra, comparador de bancos e análise MCMV/FGTS.
 * Nunca representa aprovação bancária — apenas estimativa de capacidade.
 */
import { toCurrency } from './evaluation.js';

// Taxas de referência para SIMULAÇÃO (editáveis no painel). NÃO são cotações oficiais.
// Cada banco deve ter data e fonte; quando não houver dado oficial, exibir aviso.
export const DEFAULT_BANKS = [
  { id: 'caixa', name: 'Caixa Econômica Federal', annualRate: 10.49, maxFinancePct: 80, maxTermMonths: 420, fgts: true, mcmv: true, system: 'SAC', source: 'A confirmar com a instituição', updatedAt: '2026-08-01', active: true },
  { id: 'bb', name: 'Banco do Brasil', annualRate: 10.99, maxFinancePct: 80, maxTermMonths: 420, fgts: true, mcmv: true, system: 'SAC', source: 'A confirmar com a instituição', updatedAt: '2026-08-01', active: true },
  { id: 'itau', name: 'Itaú', annualRate: 11.29, maxFinancePct: 82, maxTermMonths: 360, fgts: true, mcmv: false, system: 'PRICE', source: 'A confirmar com a instituição', updatedAt: '2026-08-01', active: true },
  { id: 'bradesco', name: 'Bradesco', annualRate: 11.49, maxFinancePct: 80, maxTermMonths: 360, fgts: true, mcmv: false, system: 'SAC', source: 'A confirmar com a instituição', updatedAt: '2026-08-01', active: true },
  { id: 'santander', name: 'Santander', annualRate: 11.19, maxFinancePct: 80, maxTermMonths: 420, fgts: true, mcmv: false, system: 'PRICE', source: 'A confirmar com a instituição', updatedAt: '2026-08-01', active: true }
];

const MAX_INCOME_COMMIT = 0.30; // comprometimento máximo de renda

function monthlyRate(annualRate) {
  return Math.pow(1 + annualRate / 100, 1 / 12) - 1;
}

// PRICE: parcela fixa
export function pricePayment(principal, annualRate, months) {
  const i = monthlyRate(annualRate);
  if (i === 0) return principal / months;
  return principal * (i * Math.pow(1 + i, months)) / (Math.pow(1 + i, months) - 1);
}

// SAC: primeira e última parcela (amortização constante)
export function sacSchedule(principal, annualRate, months) {
  const i = monthlyRate(annualRate);
  const amort = principal / months;
  const first = amort + principal * i;
  const last = amort + amort * i;
  const totalInterest = (first + last) / 2 * months - principal;
  return { amort, first, last, totalPaid: principal + totalInterest, totalInterest };
}

export function priceSchedule(principal, annualRate, months) {
  const payment = pricePayment(principal, annualRate, months);
  const totalPaid = payment * months;
  return { payment, totalPaid, totalInterest: totalPaid - principal };
}

/**
 * Poder de compra: dada a renda, entrada e FGTS, estima o valor do imóvel.
 * Usa comprometimento de 30% da renda como teto de parcela e o sistema/limite do banco.
 */
export function purchasingPower({ income, downPayment = 0, fgts = 0, bank, termMonths, age = 35 }) {
  const maxPayment = income * MAX_INCOME_COMMIT;
  const i = monthlyRate(bank.annualRate);
  const ageCapMonths = Math.max(120, Math.min(bank.maxTermMonths, (80 - age) * 12));
  const months = Math.min(termMonths || bank.maxTermMonths, ageCapMonths);

  let maxFinanced;
  if (bank.system === 'SAC') {
    maxFinanced = maxPayment / (1 / months + i);
  } else {
    maxFinanced = i === 0 ? maxPayment * months : maxPayment * (Math.pow(1 + i, months) - 1) / (i * Math.pow(1 + i, months));
  }

  const ownResources = downPayment + fgts;
  // Bancos sempre exigem entrada mínima. Se o cliente não informou entrada suficiente,
  // o valor do imóvel é limitado pelo teto financiável do banco:
  // valorImovel × maxFinancePct% = financiado, logo valorImovel = financiado / (maxFinancePct/100)
  const financePctDec = bank.maxFinancePct / 100;
  const propertyByFinance = maxFinanced / financePctDec;
  const propertyByResources = ownResources > 0 ? ownResources / (1 - financePctDec) : Infinity;
  const propertyValue = Math.min(propertyByFinance, propertyByResources);

  const minOwnResources = propertyValue * (1 - financePctDec);
  const requiredDown = Math.max(0, minOwnResources - fgts);
  const missingDown = Math.max(0, minOwnResources - ownResources);
  const financed = Math.min(maxFinanced, propertyValue * financePctDec);

  return {
    propertyValue: Math.max(0, propertyValue),
    financed,
    ownResources,
    minOwnResources,
    requiredDown,
    missingDown,
    months,
    maxPayment,
    maxFinancePct: bank.maxFinancePct,
    system: bank.system
  };
}

/**
 * Simula um banco específico dado o valor do imóvel.
 */
export function simulateBank({ propertyValue, downPayment = 0, fgts = 0, bank, termMonths, age = 35 }) {
  const ownResources = downPayment + fgts;
  const financed = Math.max(0, propertyValue - ownResources);
  const financePct = propertyValue > 0 ? (financed / propertyValue) * 100 : 0;
  const ageCapMonths = Math.max(120, Math.min(bank.maxTermMonths, (80 - age) * 12));
  const months = Math.min(termMonths || bank.maxTermMonths, ageCapMonths);

  const feasibleByPct = financePct <= bank.maxFinancePct + 0.5;

  let firstPayment, lastPayment, totalPaid, totalInterest;
  if (bank.system === 'SAC') {
    const s = sacSchedule(financed, bank.annualRate, months);
    firstPayment = s.first; lastPayment = s.last; totalPaid = s.totalPaid; totalInterest = s.totalInterest;
  } else {
    const p = priceSchedule(financed, bank.annualRate, months);
    firstPayment = p.payment; lastPayment = p.payment; totalPaid = p.totalPaid; totalInterest = p.totalInterest;
  }

  return {
    bankId: bank.id, bankName: bank.name, system: bank.system,
    annualRate: bank.annualRate, financed, financePct, months,
    firstPayment, lastPayment, totalPaid, totalInterest,
    fgts: bank.fgts, mcmv: bank.mcmv, feasible: feasibleByPct,
    maxFinancePct: bank.maxFinancePct, source: bank.source, updatedAt: bank.updatedAt
  };
}

/**
 * Compara bancos e ranqueia por compatibilidade (0-100) com o perfil.
 */
export function compareBanks({ propertyValue, income, downPayment = 0, fgts = 0, banks, termMonths, age = 35 }) {
  const results = banks.filter(b => b.active).map(bank => {
    const sim = simulateBank({ propertyValue, downPayment, fgts, bank, termMonths, age });
    const commit = income > 0 ? sim.firstPayment / income : 1;

    let score = 0;
    if (sim.feasible) score += 30;
    if (commit <= MAX_INCOME_COMMIT) score += 25; else if (commit <= 0.35) score += 12;
    // menor taxa → mais pontos (11% baseline)
    score += Math.max(0, Math.round((13 - bank.annualRate) * 4));
    if (bank.fgts && fgts > 0) score += 8;
    if (bank.maxFinancePct >= 80) score += 6;
    if (bank.mcmv) score += 4;
    score = Math.max(0, Math.min(100, score));

    return { ...sim, commitPct: commit * 100, score };
  });
  return results.sort((a, b) => b.score - a.score);
}

/**
 * Análise de possível enquadramento no Minha Casa Minha Vida.
 * Faixas de renda são REFERÊNCIA e devem ser atualizadas conforme regras oficiais.
 */
export function analyzeMCMV({ income, propertyValue }) {
  // Referência (a confirmar oficialmente): teto de renda ~R$ 8.000 e imóvel até ~R$ 350.000
  const RENDA_TETO = 8000;
  const IMOVEL_TETO = 350000;
  const potential = income <= RENDA_TETO && propertyValue <= IMOVEL_TETO;

  let faixa = 'Fora das faixas de referência';
  if (income <= 2640) faixa = 'Faixa 1 (referência)';
  else if (income <= 4400) faixa = 'Faixa 2 (referência)';
  else if (income <= RENDA_TETO) faixa = 'Faixa 3 (referência)';

  return {
    potential,
    faixa,
    rendaTeto: RENDA_TETO,
    imovelTeto: IMOVEL_TETO,
    disclaimer: 'Enquadramento e faixas do Minha Casa Minha Vida são estimativas de referência. As condições, tetos e subsídios oficiais devem ser confirmados junto à Caixa/Governo Federal.'
  };
}

export function leadScoreFromSim(sim) {
  let score = 0;
  if (sim.income > 0) score += 10;
  if (sim.downPayment > 0) score += 10;
  if (sim.fgts > 0) score += 10;
  if (sim.propertyValue > 0) score += 10;
  if (['IMEDIATO', 'ATE_3M'].includes(sim.deadline)) score += 15;
  if (sim.feasible) score += 15;
  if (sim.requestedContact) score += 10;
  if (sim.completed) score += 10;
  const total = Math.min(100, score);
  let temp = 'FRIO';
  if (total >= 81) temp = 'MUITO_QUENTE';
  else if (total >= 61) temp = 'QUENTE';
  else if (total >= 31) temp = 'MORNO';
  return { score: total, temperature: temp };
}

export { toCurrency };
