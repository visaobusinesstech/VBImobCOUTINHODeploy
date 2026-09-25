/** Motor de Avaliação Mercadológica */

export function toCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value || 0);
}

export function toNumber(value) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(value || 0);
}

export function calculateEvaluation(propertyArea, comparables) {
  const validComparables = comparables
    .map(item => ({ ...item, priceM2: Number(item.priceM2) || (Number(item.price) / Number(item.area)) }))
    .filter(item => Number.isFinite(item.priceM2) && item.priceM2 > 0);

  if (!validComparables.length || !propertyArea) {
    return {
      count: 0,
      averagePriceM2: 0,
      medianPriceM2: 0,
      minPriceM2: 0,
      maxPriceM2: 0,
      marketFloor: 0,
      suggestedPrice: 0,
      idealSalePrice: 0,
      strategicListingPrice: 0
    };
  }

  const values = validComparables.map(item => item.priceM2).sort((a, b) => a - b);
  const count = values.length;
  const averagePriceM2 = values.reduce((acc, value) => acc + value, 0) / count;
  const middle = Math.floor(count / 2);
  const medianPriceM2 = count % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
  const minPriceM2 = values[0];
  const maxPriceM2 = values[count - 1];

  // Valor sugerido pondera mediana (60%) e média (40%), reduzindo influência de outliers
  const benchmarkPriceM2 = (medianPriceM2 * 0.6) + (averagePriceM2 * 0.4);
  const marketFloor = minPriceM2 * propertyArea;
  const suggestedPrice = benchmarkPriceM2 * propertyArea;
  const idealSalePrice = suggestedPrice * 0.99;
  const strategicListingPrice = suggestedPrice * 1.015;

  return {
    count,
    averagePriceM2,
    medianPriceM2,
    minPriceM2,
    maxPriceM2,
    marketFloor,
    suggestedPrice,
    idealSalePrice,
    strategicListingPrice,
    benchmarkPriceM2
  };
}

export function getEvaluationNarrative(evaluation) {
  const stats = calculateEvaluation(evaluation.propertyArea, evaluation.comparables || []);
  return {
    methodology: `Foram analisados ${stats.count} imóveis comparáveis, priorizando tipologia, área, região e padrão construtivo semelhantes. A referência de preço combina mediana (60%) e média aritmética (40%) do valor por metro quadrado, reduzindo distorções provocadas por anúncios fora do padrão local.`,
    marketAnalysis: `O valor de referência identificado para a região é de ${toCurrency(stats.benchmarkPriceM2)}/m². Para a área privativa de ${toNumber(evaluation.propertyArea)}m², a faixa observada no mercado situa-se entre ${toCurrency(stats.marketFloor)} e ${toCurrency(stats.maxPriceM2 * evaluation.propertyArea)}.`,
    pricingStrategy: `Recomenda-se anúncio inicial de ${toCurrency(stats.strategicListingPrice)}, criando espaço técnico para negociação até ${toCurrency(stats.idealSalePrice)}. O preço de entrada abaixo de ${toCurrency(stats.marketFloor)} não é recomendado sem condição especial de liquidez.`,
    disclaimer: 'Este documento representa opinião mercadológica elaborada para fins comerciais. Não substitui laudo técnico de avaliação elaborado por profissional habilitado, quando legalmente exigido.'
  };
}

/**
 * Avaliação Premium: comparáveis ponderados por similaridade de área,
 * ajustes por conservação/andar/diferenciais, faixa de confiança e projeção de valorização.
 */

const CONSERVATION_FACTORS = {
  'NOVO': 1.06,
  'EXCELENTE': 1.04,
  'REFORMADO': 1.03,
  'BOM': 1.0,
  'REGULAR': 0.95,
  'A_REFORMAR': 0.88
};

function conservationFactor(state) {
  if (!state) return 1.0;
  const key = state.toString().toUpperCase();
  const match = Object.keys(CONSERVATION_FACTORS).find(k => key.includes(k) || key.includes(k.replace('_', ' ')));
  if (match) return CONSERVATION_FACTORS[match];
  if (key.includes('EXCELENTE') || key.includes('ALTO PADRÃO') || key.includes('ALTO PADRAO')) return 1.04;
  if (key.includes('REFORMAD')) return 1.03;
  if (key.includes('REGULAR') || key.includes('USADO')) return 0.95;
  return 1.0;
}

export function calculatePremiumEvaluation(evaluation) {
  const area = Number(evaluation.propertyArea) || 0;
  const comparables = (evaluation.comparables || [])
    .map(item => ({ ...item, priceM2: Number(item.priceM2) || (Number(item.price) / Number(item.area)) }))
    .filter(item => Number.isFinite(item.priceM2) && item.priceM2 > 0);

  const base = calculateEvaluation(area, comparables);
  if (!comparables.length || !area) {
    return { ...base, weightedPriceM2: 0, confidenceLow: 0, confidenceHigh: 0, coefVariation: 0, confidenceLabel: 'Insuficiente', adjustedPriceM2: 0, adjustments: [], appreciation: [] };
  }

  // Ponderação por similaridade de área (peso maior para áreas próximas)
  let weightSum = 0, weightedM2Sum = 0;
  comparables.forEach(c => {
    const areaDiff = Math.abs((Number(c.area) || area) - area) / area;
    const weight = 1 / (1 + areaDiff * 2); // quanto mais próxima a área, maior o peso
    weightSum += weight;
    weightedM2Sum += c.priceM2 * weight;
  });
  const weightedPriceM2 = weightSum ? weightedM2Sum / weightSum : base.averagePriceM2;

  // Coeficiente de variação → confiança da amostra
  const mean = base.averagePriceM2;
  const variance = comparables.reduce((acc, c) => acc + Math.pow(c.priceM2 - mean, 2), 0) / comparables.length;
  const stdDev = Math.sqrt(variance);
  const coefVariation = mean ? stdDev / mean : 0;
  let confidenceLabel = 'Alta';
  if (coefVariation > 0.20) confidenceLabel = 'Baixa';
  else if (coefVariation > 0.10) confidenceLabel = 'Moderada';

  // Ajustes qualitativos aplicados ao m² ponderado
  const adjustments = [];
  let factor = 1.0;

  const consFactor = conservationFactor(evaluation.conservationState);
  if (consFactor !== 1.0) {
    adjustments.push({ label: `Conservação (${evaluation.conservationState || 'padrão'})`, percent: (consFactor - 1) * 100 });
    factor *= consFactor;
  }

  const floor = Number(evaluation.floor);
  if (Number.isFinite(floor) && floor > 0) {
    const floorFactor = floor >= 10 ? 1.03 : floor >= 5 ? 1.015 : floor <= 1 ? 0.985 : 1.0;
    if (floorFactor !== 1.0) {
      adjustments.push({ label: `Andar (${floor}º)`, percent: (floorFactor - 1) * 100 });
      factor *= floorFactor;
    }
  }

  const diffs = Array.isArray(evaluation.differentials) ? evaluation.differentials : [];
  if (diffs.length) {
    const diffFactor = Math.min(1.08, 1 + diffs.length * 0.012);
    adjustments.push({ label: `Diferenciais (${diffs.length}: ${diffs.slice(0, 3).join(', ')}${diffs.length > 3 ? '…' : ''})`, percent: (diffFactor - 1) * 100 });
    factor *= diffFactor;
  }

  const adjustedPriceM2 = weightedPriceM2 * factor;
  const suggestedPrice = adjustedPriceM2 * area;
  const idealSalePrice = suggestedPrice * 0.99;
  const strategicListingPrice = suggestedPrice * 1.02;

  // Faixa de confiança (±1 desvio padrão sobre o m² ajustado, limitado)
  const bandPct = Math.min(0.12, Math.max(0.03, coefVariation));
  const confidenceLow = suggestedPrice * (1 - bandPct);
  const confidenceHigh = suggestedPrice * (1 + bandPct);

  // Projeção de valorização (cenário conservador ~7% a.a. para DF consolidado)
  const annualRate = 0.07;
  const appreciation = [1, 2, 3, 5].map(years => ({
    years,
    value: suggestedPrice * Math.pow(1 + annualRate, years)
  }));

  return {
    ...base,
    weightedPriceM2,
    adjustedPriceM2,
    adjustments,
    factor,
    suggestedPrice,
    idealSalePrice,
    strategicListingPrice,
    coefVariation,
    confidenceLabel,
    confidenceLow,
    confidenceHigh,
    appreciation
  };
}

export function getPremiumScore(evaluation) {
  const stats = calculatePremiumEvaluation(evaluation);
  let score = 40;
  if (stats.count >= 3) score += 20;
  if (stats.count >= 5) score += 10;
  if (stats.confidenceLabel === 'Alta') score += 20;
  else if (stats.confidenceLabel === 'Moderada') score += 10;
  if ((evaluation.comparables || []).some(c => c.url || c.link)) score += 5;
  if (evaluation.conservationState) score += 5;
  return Math.min(100, score);
}

/**
 * Avaliar com IA: encontra imóveis semelhantes no portfólio real do CRM,
 * calcula % de similaridade explicável e índice de confiança.
 * Trabalha com dados reais cadastrados — não inventa comparáveis.
 */
function similarityScore(subject, prop) {
  let score = 0;
  const reasons = [];

  // Mesma região (peso alto)
  if (subject.region && prop.region && subject.region.toLowerCase() === prop.region.toLowerCase()) {
    score += 30; reasons.push('mesma região');
  } else if (subject.region && prop.region && prop.region.toLowerCase().includes(subject.region.split(' ')[0].toLowerCase())) {
    score += 12; reasons.push('região próxima');
  }

  // Mesmo tipo
  if (subject.type && prop.type && subject.type === prop.type) { score += 20; reasons.push('mesmo tipo de imóvel'); }

  // Área semelhante
  if (subject.area && prop.area) {
    const diff = Math.abs(prop.area - subject.area) / subject.area;
    if (diff <= 0.10) { score += 25; reasons.push('área muito próxima'); }
    else if (diff <= 0.25) { score += 15; reasons.push('área semelhante'); }
    else if (diff <= 0.40) { score += 6; }
  }

  // Quartos
  if (subject.bedrooms != null && prop.bedrooms != null) {
    if (subject.bedrooms === prop.bedrooms) { score += 12; reasons.push('mesmo nº de quartos'); }
    else if (Math.abs(subject.bedrooms - prop.bedrooms) === 1) { score += 5; }
  }

  // Vagas
  if (subject.parkingSpots != null && prop.parkingSpots != null && subject.parkingSpots === prop.parkingSpots) {
    score += 8; reasons.push('mesmo nº de vagas');
  }

  // Suítes
  if (subject.suites != null && prop.suites != null && subject.suites === prop.suites) {
    score += 5; reasons.push('mesmo nº de suítes');
  }

  return { score: Math.min(100, score), reasons };
}

export function findComparablesWithAI(subject, portfolio) {
  const candidates = (portfolio || [])
    .filter(p => p.id !== subject.id && (p.salePrice || p.price) > 0 && (p.area || 0) > 0)
    .map(p => {
      const price = p.salePrice || p.price;
      const { score, reasons } = similarityScore(subject, p);
      return {
        propertyId: p.id,
        address: p.title || p.address || p.region || 'Imóvel',
        area: p.area,
        bedrooms: p.bedrooms,
        suites: p.suites,
        parking: p.parkingSpots,
        price,
        priceM2: Number((price / p.area).toFixed(2)),
        source: 'Portfólio Coutinho (CRM)',
        url: '',
        similarity: score,
        reasons,
        date: new Date().toISOString().split('T')[0]
      };
    })
    .filter(c => c.similarity >= 40)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 6);

  // Índice de confiança: quantidade + similaridade média + dispersão
  const count = candidates.length;
  const avgSim = count ? candidates.reduce((s, c) => s + c.similarity, 0) / count : 0;
  const m2 = candidates.map(c => c.priceM2);
  const meanM2 = m2.length ? m2.reduce((a, b) => a + b, 0) / m2.length : 0;
  const variance = m2.length ? m2.reduce((a, b) => a + Math.pow(b - meanM2, 2), 0) / m2.length : 0;
  const cv = meanM2 ? Math.sqrt(variance) / meanM2 : 1;

  let confidence = 0;
  confidence += Math.min(40, count * 8);        // até 40 pts por quantidade (5+ comparáveis)
  confidence += Math.round(avgSim * 0.4);        // até 40 pts por similaridade média
  confidence += Math.max(0, Math.round((1 - Math.min(1, cv * 3)) * 20)); // até 20 pts por baixa dispersão
  confidence = Math.min(100, confidence);

  let confidenceLabel = 'Baixa';
  if (confidence >= 75) confidenceLabel = 'Alta';
  else if (confidence >= 50) confidenceLabel = 'Moderada';

  const sufficient = count >= 3;

  return {
    comparables: candidates,
    count,
    avgSimilarity: Math.round(avgSim),
    confidence,
    confidenceLabel,
    sufficient,
    message: sufficient
      ? `Encontrei ${count} imóveis reais semelhantes no portfólio, com similaridade média de ${Math.round(avgSim)}%.`
      : `Dados insuficientes para uma estimativa confiável: apenas ${count} imóvel(is) semelhante(is) no portfólio. Cadastre ou capte mais imóveis da mesma região/tipo, ou adicione comparáveis de portais manualmente.`
  };
}
