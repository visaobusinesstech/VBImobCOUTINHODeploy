/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 */

export function estimateAvaliacao(preco: number, area: number, precoM2Mercado: number) {
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
    parecer
  };
}
