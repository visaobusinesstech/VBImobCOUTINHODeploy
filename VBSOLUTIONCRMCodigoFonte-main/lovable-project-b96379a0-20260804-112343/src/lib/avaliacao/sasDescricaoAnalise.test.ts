import { describe, it, expect } from "vitest";
import {
  analisarTexto,
  TOPICOS_DESCRICAO,
  TOPICOS_TAXA_EXTRA,
  LIMITES,
  truncarAoMax,
  atingiuMax,
  estadoContadorDescricao,
  estadoContadorTaxaExtra,
  norm,
} from "./sasDescricaoAnalise";

describe("norm()", () => {
  it("remove acentos e normaliza para minúsculas", () => {
    expect(norm("Ápartamento Ótimo — Área")).toBe("apartamento otimo — area");
  });
});

describe("truncarAoMax()", () => {
  it("mantém o texto quando dentro do limite", () => {
    expect(truncarAoMax("abc", 10)).toBe("abc");
  });
  it("corta exatamente no limite máximo", () => {
    expect(truncarAoMax("abcdefghij", 5)).toBe("abcde");
    expect(truncarAoMax("abcdefghij", 5).length).toBe(5);
  });
  it("aceita string vazia", () => {
    expect(truncarAoMax("", 5)).toBe("");
  });
});

describe("atingiuMax()", () => {
  it("dispara quando o novo valor atinge o máximo e o anterior não", () => {
    expect(atingiuMax("abcd", "abcde", 5)).toBe(true);
    expect(atingiuMax("abcd", "abcdefghij", 5)).toBe(true);
  });
  it("não dispara quando já estava no máximo (não é uma NOVA batida)", () => {
    expect(atingiuMax("abcde", "abcdef", 5)).toBe(false);
  });
  it("não dispara quando ainda está abaixo do máximo", () => {
    expect(atingiuMax("ab", "abc", 5)).toBe(false);
  });
});

describe("estadoContadorDescricao()", () => {
  const { max, minRec, ideal } = LIMITES.descricao;

  it("retorna 'empty' para string em branco", () => {
    expect(estadoContadorDescricao("")).toBe("empty");
    expect(estadoContadorDescricao("   \n  ")).toBe("empty");
  });

  it("retorna 'belowMin' quando abaixo do mínimo recomendado", () => {
    expect(estadoContadorDescricao("Casa boa")).toBe("belowMin");
    expect(estadoContadorDescricao("x".repeat(minRec - 1))).toBe("belowMin");
  });

  it("retorna 'belowIdeal' quando entre o mínimo e o ideal", () => {
    expect(estadoContadorDescricao("x".repeat(minRec))).toBe("belowIdeal");
    expect(estadoContadorDescricao("x".repeat(ideal - 1))).toBe("belowIdeal");
  });

  it("retorna 'good' quando alcança o ideal", () => {
    expect(estadoContadorDescricao("x".repeat(ideal))).toBe("good");
    expect(estadoContadorDescricao("x".repeat(ideal + 500))).toBe("good");
  });

  it("retorna 'nearMax' entre 90% e o limite máximo", () => {
    const near = Math.ceil(max * 0.9);
    expect(estadoContadorDescricao("x".repeat(near))).toBe("nearMax");
    expect(estadoContadorDescricao("x".repeat(max - 1))).toBe("nearMax");
  });

  it("retorna 'atMax' ao atingir ou exceder o máximo", () => {
    expect(estadoContadorDescricao("x".repeat(max))).toBe("atMax");
    // Overflow não é possível na UI (truncado), mas o estado deve permanecer 'atMax'
    expect(estadoContadorDescricao("x".repeat(max + 10))).toBe("atMax");
  });
});

describe("estadoContadorTaxaExtra()", () => {
  const { max, min } = LIMITES.taxaExtra;

  it("cobre todos os limites principais", () => {
    expect(estadoContadorTaxaExtra("")).toBe("empty");
    expect(estadoContadorTaxaExtra("x".repeat(min - 1))).toBe("belowMin");
    expect(estadoContadorTaxaExtra("x".repeat(min))).toBe("good");
    expect(estadoContadorTaxaExtra("x".repeat(Math.ceil(max * 0.9)))).toBe("nearMax");
    expect(estadoContadorTaxaExtra("x".repeat(max))).toBe("atMax");
  });

  it("considera espaços em branco no cálculo do mínimo (trim)", () => {
    expect(estadoContadorTaxaExtra("   ".repeat(20))).toBe("empty");
  });
});

describe("analisarTexto() - descrição", () => {
  it("retorna todos os tópicos como faltantes para texto vazio", () => {
    const r = analisarTexto("", TOPICOS_DESCRICAO);
    expect(r.cobertos).toHaveLength(0);
    expect(r.faltando).toHaveLength(TOPICOS_DESCRICAO.length);
    expect(r.cobertura).toBe(0);
  });

  it("detecta cobertura completa de uma descrição rica", () => {
    const texto =
      "Apartamento reformado de 3 quartos, sendo 1 suíte, banheiro social e sala ampla. " +
      "Área privativa de 90 metros. Piso porcelanato, bancadas de granito e armários planejados. " +
      "Localizado no bairro Asa Sul, próximo a supermercado e escola. " +
      "Vista livre, andar alto, portaria 24h.";
    const r = analisarTexto(texto, TOPICOS_DESCRICAO);
    expect(r.faltando).toHaveLength(0);
    expect(r.cobertura).toBe(1);
  });

  it("é insensível a acentos e caixa", () => {
    const r = analisarTexto("APARTAMENTO com ÁREA ampla e ÓTIMA localização no bairro", TOPICOS_DESCRICAO);
    const ids = r.cobertos.map(t => t.id);
    expect(ids).toContain("area");
    expect(ids).toContain("localizacao");
  });

  it("identifica cobertura parcial e retorna dicas do que falta", () => {
    const r = analisarTexto("3 quartos e 2 banheiros", TOPICOS_DESCRICAO);
    expect(r.cobertos.map(t => t.id)).toEqual(["ambientes"]);
    expect(r.faltando.map(t => t.id)).toEqual(
      expect.arrayContaining(["area", "acabamento", "estado", "localizacao", "diferenciais"]),
    );
    expect(r.faltando.length).toBe(TOPICOS_DESCRICAO.length - 1);
  });
});

describe("analisarTexto() - taxa extra", () => {
  it("marca 'motivo' e 'prazo' como faltantes quando texto é vazio", () => {
    const r = analisarTexto("", TOPICOS_TAXA_EXTRA);
    expect(r.faltando.map(t => t.id)).toEqual(["motivo", "prazo"]);
  });

  it("reconhece motivo mas não prazo", () => {
    const r = analisarTexto("Rateio de obra da fachada", TOPICOS_TAXA_EXTRA);
    expect(r.cobertos.map(t => t.id)).toContain("motivo");
    expect(r.faltando.map(t => t.id)).toContain("prazo");
  });

  it("reconhece motivo e prazo juntos", () => {
    const r = analisarTexto("Fundo de reserva mensal por 12 meses", TOPICOS_TAXA_EXTRA);
    expect(r.faltando).toHaveLength(0);
    expect(r.cobertura).toBe(1);
  });
});

import { validarDescricao, validarTaxaExtra } from "./sasDescricaoAnalise";

describe("validarDescricao()", () => {
  it("rejeita descrição vazia como obrigatória", () => {
    const r = validarDescricao("");
    expect(r.valid).toBe(false);
    expect(r.erro).toMatch(/obrigatória/i);
  });

  it("rejeita descrição só com espaços", () => {
    expect(validarDescricao("     \n\t  ").valid).toBe(false);
  });

  it("rejeita descrição abaixo do mínimo recomendado", () => {
    const r = validarDescricao("Casa boa");
    expect(r.valid).toBe(false);
    expect(r.erro).toMatch(/mínimo|caracteres/i);
    expect(r.erro).toMatch(/faltam/);
  });

  it("aceita descrição exatamente no mínimo recomendado", () => {
    const r = validarDescricao("x".repeat(LIMITES.descricao.minRec));
    expect(r.valid).toBe(true);
    expect(r.erro).toBeUndefined();
  });

  it("aceita descrição longa dentro do limite", () => {
    expect(validarDescricao("x".repeat(1500)).valid).toBe(true);
  });

  it("aceita descrição exatamente no limite máximo", () => {
    expect(validarDescricao("x".repeat(LIMITES.descricao.max)).valid).toBe(true);
  });

  it("rejeita descrição acima do limite máximo", () => {
    const r = validarDescricao("x".repeat(LIMITES.descricao.max + 1));
    expect(r.valid).toBe(false);
    expect(r.erro).toMatch(/excede/i);
  });
});

describe("validarTaxaExtra()", () => {
  it("é sempre válida quando não há valor de taxa extra", () => {
    expect(validarTaxaExtra("", 0).valid).toBe(true);
    expect(validarTaxaExtra("", -5).valid).toBe(true);
    expect(validarTaxaExtra("qualquer coisa curta", 0).valid).toBe(true);
  });

  it("exige descrição quando há taxa extra > 0", () => {
    const r = validarTaxaExtra("", 100);
    expect(r.valid).toBe(false);
    expect(r.erro).toMatch(/motivo/i);
  });

  it("rejeita descrição curta com taxa > 0", () => {
    const r = validarTaxaExtra("obra", 50);
    expect(r.valid).toBe(false);
    expect(r.erro).toMatch(/mínimo|faltam/i);
  });

  it("aceita descrição no mínimo com taxa > 0", () => {
    const r = validarTaxaExtra("x".repeat(LIMITES.taxaExtra.min), 100);
    expect(r.valid).toBe(true);
  });

  it("rejeita descrição acima do máximo", () => {
    const r = validarTaxaExtra("x".repeat(LIMITES.taxaExtra.max + 1), 100);
    expect(r.valid).toBe(false);
    expect(r.erro).toMatch(/excede/i);
  });
});
