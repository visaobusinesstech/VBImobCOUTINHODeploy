/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 */

import { normalizeText } from "./realtyCrm";

export type RadarZapAnalise = {
  tem_imovel: boolean;
  intencao: "venda" | "aluguel" | "temporada" | "busca" | "duvida" | "nao_imovel";
  score_intencao: number;
  tipo_imovel: string | null;
  operacao: "venda" | "aluguel" | "temporada" | null;
  bairro: string | null;
  cidade: string | null;
  preco: number | null;
  contato: string | null;
  proprietario_nome: string | null;
  resumo: string;
};

const TIPO_MAP: Array<[RegExp, string]> = [
  [/cobertura/i, "cobertura"],
  [/kitnet|quitinete/i, "kitnet"],
  [/sobrado/i, "sobrado"],
  [/casa/i, "casa"],
  [/apto|apartamento|ap\b/i, "apartamento"],
  [/terreno|lote/i, "terreno"],
  [/sala comercial|sala/i, "sala"],
  [/loja/i, "loja"]
];

function extractPrice(text: string): number | null {
  const mil = text.match(/(\d{1,3}(?:[.\s]\d{3})*|\d+)\s*mil(?:h[oõ]es)?/i);
  if (mil) {
    const n = Number(String(mil[1]).replace(/[.\s]/g, ""));
    if (Number.isFinite(n) && n > 0) {
      if (/milh/i.test(mil[0])) return n * 1000000;
      return n * 1000;
    }
  }
  const money = text.match(/r\$\s*([\d.]{2,12})/i);
  if (money) {
    const raw = money[1].replace(/\./g, "");
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 1000) return n;
  }
  return null;
}

function extractPhone(text: string): string | null {
  const m = text.replace(/\s+/g, " ").match(/(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?\d{4,5}[-\s]?\d{4}/);
  return m ? m[0].replace(/\s+/g, "") : null;
}

export function analyzeRadarZapMessage(texto: string): RadarZapAnalise {
  const text = String(texto || "").trim().slice(0, 4000);
  const n = normalizeText(text);
  let tipo: string | null = null;
  for (const [re, label] of TIPO_MAP) {
    if (re.test(text)) {
      tipo = label;
      break;
    }
  }

  const isBusca = /\b(procuro|procurando|quero alugar|quero comprar|busco)\b/i.test(text);
  const isAluguel = /\b(alugo|aluguel|para alugar|locacao|loca[cç]ao)\b/i.test(n) || /\balugo\b/i.test(text);
  const isVenda = /\b(vendo|venda|a venda|à venda|passando)\b/i.test(n);
  const isTemp = /\b(temporada|airbnb|diaria)\b/i.test(n);
  const temImovel = !!(tipo || isAluguel || isVenda || isTemp || /\bimovel\b/.test(n));

  let intencao: RadarZapAnalise["intencao"] = "nao_imovel";
  if (isBusca && temImovel) intencao = "busca";
  else if (isTemp) intencao = "temporada";
  else if (isAluguel) intencao = "aluguel";
  else if (isVenda) intencao = "venda";
  else if (temImovel) intencao = "duvida";

  let score = 20;
  if (temImovel) score += 25;
  if (tipo) score += 15;
  if (isVenda || isAluguel || isTemp) score += 20;
  const preco = extractPrice(text);
  if (preco) score += 15;
  const contato = extractPhone(text);
  if (contato) score += 10;
  score = Math.min(100, score);

  const bairroMatch = text.match(/\b(?:no|em|na)\s+([A-ZÁÉÍÓÚÂÊÔÃÕ][\wÁÉÍÓÚÂÊÔÃÕáéíóúâêôãõç'-]{2,40}(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕ][\wÁÉÍÓÚÂÊÔÃÕáéíóúâêôãõç'-]{1,20}){0,3})/);
  const cidadeMatch = text.match(/\b(brasilia|brasília|taguatinga|aguas claras|águas claras|asa norte|asa sul|guara|guará|ceilândia|ceilandia)\b/i);

  const operacao =
    intencao === "venda" || intencao === "aluguel" || intencao === "temporada" ? intencao : null;

  return {
    tem_imovel: temImovel && intencao !== "nao_imovel",
    intencao: temImovel ? intencao : "nao_imovel",
    score_intencao: temImovel ? score : 5,
    tipo_imovel: tipo,
    operacao,
    bairro: bairroMatch ? bairroMatch[1].trim() : null,
    cidade: cidadeMatch ? cidadeMatch[1] : null,
    preco,
    contato,
    proprietario_nome: null,
    resumo: text.slice(0, 180)
  };
}
