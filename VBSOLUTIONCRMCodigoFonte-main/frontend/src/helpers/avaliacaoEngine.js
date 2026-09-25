/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Engine NBR 14.653 — paridade Lovable engine.ts (funções puras).
 */
import { FATORES_DEFAULT } from "./avaliacaoConstants";

export function fatorTotal(f) {
  const x = { ...FATORES_DEFAULT, ...(f || {}) };
  return (
    x.localizacao *
    x.area *
    x.conservacao *
    x.padrao *
    x.idade *
    x.garagem *
    x.infraestrutura *
    x.vista *
    x.liquidez *
    x.outros
  );
}

function mediana(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function desvioPadrao(arr, media) {
  if (arr.length < 2) return 0;
  const v = arr.reduce((acc, n) => acc + (n - media) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(v);
}

export function homogeneizarComparaveis(comparaveis, fatoresMap, areaAvaliando) {
  const areaAlvo = Number(areaAvaliando) || 0;
  return (comparaveis || [])
    .map((c) => {
      const area = Number(c.area) || 0;
      const valor =
        Number(c.valor_negociado) > 0 ? Number(c.valor_negociado) : Number(c.valor_anunciado) || 0;
      if (!(area > 0 && valor > 0)) return null;
      const fatores = { ...FATORES_DEFAULT, ...(fatoresMap?.[c.id] || {}) };
      const ft = fatorTotal(fatores);
      const precoM2Bruto = valor / area;
      const precoM2Hom = precoM2Bruto * ft;
      return {
        id: c.id,
        valor_base: valor,
        area,
        preco_m2_bruto: precoM2Bruto,
        fator_total: ft,
        preco_m2_homogeneizado: precoM2Hom,
        valor_total_homogeneizado: areaAlvo > 0 ? precoM2Hom * areaAlvo : valor * ft,
        fatores,
      };
    })
    .filter(Boolean);
}

export function calcularResultadoWizard(comparaveis, fatoresMap, areaConstruida) {
  const homog = homogeneizarComparaveis(comparaveis, fatoresMap, areaConstruida);
  const m2s = homog.map((h) => h.preco_m2_homogeneizado);
  const media = m2s.length ? m2s.reduce((a, b) => a + b, 0) / m2s.length : 0;
  const med = mediana(m2s);
  const dp = desvioPadrao(m2s, media);
  const cv = media > 0 ? dp / media : 0;
  const area = Number(areaConstruida) || 0;
  const precoM2 = med || media;
  const sugerido = Math.round(precoM2 * area);
  const min = Math.round(sugerido * 0.92);
  const max = Math.round(sugerido * 1.08);

  let nivel = "insuficiente";
  let mensagem = "Amostra insuficiente (mínimo 3 comparáveis).";
  const alertas = [];
  if (homog.length >= 5 && cv <= 0.15) {
    nivel = "rigoroso";
    mensagem = "Amostra rigorosa conforme NBR 14.653.";
  } else if (homog.length >= 3 && cv <= 0.3) {
    nivel = "normal";
    mensagem = "Amostra adequada para avaliação normal.";
  } else if (homog.length >= 3) {
    nivel = "expedito";
    mensagem = "Amostra expedita — alta dispersão.";
    alertas.push("Coeficiente de variação elevado");
  } else {
    alertas.push("Inclua ao menos 3 comparáveis válidos");
  }

  return {
    comparaveis: homog,
    amostraValida: homog.length,
    precoM2: {
      media: Math.round(media),
      mediana: Math.round(med),
      min: m2s.length ? Math.round(Math.min(...m2s)) : 0,
      max: m2s.length ? Math.round(Math.max(...m2s)) : 0,
      desvioPadrao: Math.round(dp),
      coeficienteVariacao: Number(cv.toFixed(3)),
      intervaloConfianca: {
        inferior: Math.round(precoM2 * 0.95),
        superior: Math.round(precoM2 * 1.05),
      },
    },
    valorFinal: { sugerido, minimo: min, maximo: max },
    qualidade: { nivel, mensagem, alertas },
  };
}
