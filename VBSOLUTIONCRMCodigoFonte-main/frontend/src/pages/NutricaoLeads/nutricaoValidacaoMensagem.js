/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 *
 * Validação de mensagens de nutrição (port do Lovable).
 */

import {
  CHAVES_VALIDAS,
  VARIAVEIS_NUTRICAO,
  variaveisUsadas,
  variaveisDesconhecidas,
} from "./nutricaoVariaveis";

export const VARIAVEIS_ESSENCIAIS = [
  "imovel_link",
  "imovel_endereco",
  "imovel_titulo",
  "imovel_resumo",
  "imovel_preco",
];

export const VARIAVEIS_URL = ["imovel_link"];

const LIMITE_WHATSAPP = 1200;

const rotulo = (chave) =>
  VARIAVEIS_NUTRICAO.find((v) => v.chave === chave)?.label ?? chave;

export function placeholdersMalformados(texto) {
  const problemas = [];
  if (/\{\{\s*\}\}/.test(texto)) problemas.push("{{ }} sem nome de variável");
  const semFechar = texto.match(/\{\{(?:(?!\}\})[\s\S]){0,40}$/);
  if (semFechar) problemas.push("chave `{{` aberta sem fechamento `}}`");
  const chaveSimples = texto
    .replace(/\{\{[\s\S]*?\}\}/g, "")
    .match(/\{[^{}\n]{1,40}\}/g);
  if (chaveSimples?.length) {
    problemas.push(`use chaves duplas: ${chaveSimples.slice(0, 3).join(", ")}`);
  }
  return problemas;
}

export function urlValida(valor) {
  try {
    const u = new URL(String(valor || "").trim());
    return (u.protocol === "http:" || u.protocol === "https:") && u.hostname.includes(".");
  } catch {
    return false;
  }
}

export function validarMensagemNutricao(mensagem, opcoes = {}) {
  const texto = String(mensagem || "");
  const titulo = String(opcoes.titulo || "");
  const canal = opcoes.canal || "whatsapp";
  const contexto = opcoes.contexto || {};
  const erros = [];
  const avisos = [];

  if (!texto.trim()) {
    erros.push({ tipo: "erro", codigo: "vazia", mensagem: "Mensagem vazia." });
  }
  if (!titulo.trim()) {
    avisos.push({ tipo: "aviso", codigo: "titulo", mensagem: "Título da etapa vazio." });
  }

  placeholdersMalformados(texto).forEach((p) => {
    erros.push({ tipo: "erro", codigo: "placeholder_malformado", mensagem: p });
  });

  variaveisDesconhecidas(texto).forEach((k) => {
    erros.push({
      tipo: "erro",
      codigo: "variavel_invalida",
      mensagem: `Variável desconhecida: {{${k}}}`,
    });
  });

  variaveisUsadas(texto).forEach((k) => {
    if (!CHAVES_VALIDAS.has(k)) return;
    const valor = String(contexto[k] ?? "").trim();
    if (VARIAVEIS_ESSENCIAIS.includes(k) && !valor) {
      avisos.push({
        tipo: "aviso",
        codigo: "essencial_vazia",
        mensagem: `${rotulo(k)} ({{${k}}}) sem valor no preview — o envio real pode ser bloqueado.`,
      });
    } else if (VARIAVEIS_URL.includes(k) && valor && !urlValida(valor)) {
      erros.push({
        tipo: "erro",
        codigo: "url_invalida",
        mensagem: `${rotulo(k)} precisa ser uma URL http(s) válida.`,
      });
    } else if (!valor && !VARIAVEIS_ESSENCIAIS.includes(k)) {
      avisos.push({
        tipo: "aviso",
        codigo: "sem_valor",
        mensagem: `${rotulo(k)} pode ficar vazio em alguns leads.`,
      });
    }
  });

  if (canal !== "email" && texto.length > LIMITE_WHATSAPP) {
    avisos.push({
      tipo: "aviso",
      codigo: "tamanho",
      mensagem: `Mensagem com ${texto.length} caracteres (limite sugerido WhatsApp: ${LIMITE_WHATSAPP}).`,
    });
  }

  return { erros, avisos, podeEnviar: erros.length === 0 };
}
