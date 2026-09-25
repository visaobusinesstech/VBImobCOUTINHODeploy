/**
 * Revalidação dos limites 0/2000 da descrição.
 *
 * Garante que:
 *  1. Contagem e validação usam code points Unicode (não code units UTF-16),
 *     de modo que emojis e pares substitutos não permitam ultrapassar 2000.
 *  2. Apenas espaços em branco (spaces, tabs, \n, NBSP) NÃO satisfazem o mínimo
 *     de 30 caracteres — devem ser tratados como vazio pelo trim.
 *  3. As fronteiras exatas 0, 29, 30, 1999, 2000, 2001 se comportam como esperado.
 */

import { describe, it, expect } from "vitest";
import {
  DESCRICAO_MAX,
  DESCRICAO_MIN,
  contarDescricao,
  truncarDescricao,
  validarDescricaoAvaliacao,
} from "./avaliacaoDescricao";

const repetir = (ch: string, n: number) => Array.from({ length: n }, () => ch).join("");

describe("Limites 0/2000 revalidados por code points", () => {
  it("string vazia => inválida com mensagem de obrigatoriedade", () => {
    const r = validarDescricaoAvaliacao("");
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.erro).toMatch(/obrigatória/i);
  });

  it("apenas espaços (30 spaces) NÃO passa — trim reduz a 0", () => {
    const r = validarDescricaoAvaliacao(repetir(" ", 30));
    expect(r.valid).toBe(false);
  });

  it("apenas tabs/quebras/NBSP NÃO passam mesmo com 60 chars", () => {
    const soWhitespace = "\t".repeat(20) + "\n".repeat(20) + "\u00A0".repeat(20);
    expect(soWhitespace.length).toBe(60);
    const r = validarDescricaoAvaliacao(soWhitespace);
    // \u00A0 (NBSP) NÃO é removido pelo String.prototype.trim tradicional? Na verdade é.
    // Confirmamos que o trim JS trata NBSP como whitespace, então isso deve invalidar.
    expect(r.valid).toBe(false);
  });

  it("29 caracteres reais => inválido (faltam 1)", () => {
    const r = validarDescricaoAvaliacao(repetir("a", 29));
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.erro).toMatch(/faltam\s+1\s+caractere/);
  });

  it("30 caracteres reais => válido (mínimo exato)", () => {
    expect(validarDescricaoAvaliacao(repetir("a", DESCRICAO_MIN)).valid).toBe(true);
  });

  it("30 chars mas com espaços nas bordas — trim aplica antes da contagem", () => {
    const txt = "   " + repetir("a", 30) + "   ";
    expect(validarDescricaoAvaliacao(txt).valid).toBe(true);
  });

  it("29 chars + espaços extras nas bordas continua inválido", () => {
    const txt = "     " + repetir("a", 29) + "     ";
    expect(validarDescricaoAvaliacao(txt).valid).toBe(false);
  });

  it("2000 caracteres => válido (limite exato)", () => {
    const txt = repetir("a", DESCRICAO_MAX);
    expect(contarDescricao(txt)).toBe(DESCRICAO_MAX);
    expect(validarDescricaoAvaliacao(txt).valid).toBe(true);
  });

  it("2001 caracteres => truncarDescricao corta para 2000 e passa a validar", () => {
    const bruto = repetir("a", DESCRICAO_MAX + 1);
    const truncado = truncarDescricao(bruto);
    expect(contarDescricao(truncado)).toBe(DESCRICAO_MAX);
    expect(validarDescricaoAvaliacao(truncado).valid).toBe(true);
  });

  it("2000 emojis (pares substitutos) => contagem por code points = 2000, válido", () => {
    const txt = repetir("🏠", DESCRICAO_MAX);
    // Se contássemos por .length (UTF-16), daria 4000 e invalidaria por excesso.
    expect(txt.length).toBe(DESCRICAO_MAX * 2);
    expect(contarDescricao(txt)).toBe(DESCRICAO_MAX);
    expect(validarDescricaoAvaliacao(txt).valid).toBe(true);
  });

  it("2001 emojis => trunca para 2000 emojis inteiros (sem surrogate órfão)", () => {
    const bruto = repetir("🏠", DESCRICAO_MAX + 1);
    const truncado = truncarDescricao(bruto);
    expect(contarDescricao(truncado)).toBe(DESCRICAO_MAX);
    // Confirma que o último code point é o emoji completo, não meio par substituto.
    const ultimo = Array.from(truncado).at(-1);
    expect(ultimo).toBe("🏠");
    expect(validarDescricaoAvaliacao(truncado).valid).toBe(true);
  });

  it("2000 chars válidos + espaços extras => trim mantém válido", () => {
    const txt = "  " + repetir("a", DESCRICAO_MAX) + "  ";
    // Contagem crua (com espaços) passa de 2000, mas validação usa trim antes.
    expect(contarDescricao(txt)).toBeGreaterThan(DESCRICAO_MAX);
    expect(validarDescricaoAvaliacao(txt).valid).toBe(true);
  });

  it("null/undefined => tratados como vazio (inválido)", () => {
    expect(validarDescricaoAvaliacao(null).valid).toBe(false);
    expect(validarDescricaoAvaliacao(undefined).valid).toBe(false);
    expect(contarDescricao(null)).toBe(0);
    expect(contarDescricao(undefined)).toBe(0);
  });
});
