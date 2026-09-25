import { describe, it, expect } from "vitest";
import { validarComparaveisReais, resumirMotivos } from "./validarComparaveisReais";

const base = { preco: 100000, area: 50 };

describe("validarComparaveisReais", () => {
  const opts = { idsCarteira: ["c1", "c2"], idsMercado: ["m1"] };

  it("aprova comparáveis com correspondência real", () => {
    const r = validarComparaveisReais(
      [
        { id: "c1", fonte: "carteira", ...base },
        { id: "m1", fonte: "mercado", ...base },
      ],
      opts,
    );
    expect(r.ok).toBe(true);
    expect(r.totalValidos).toBe(2);
    expect(r.totalInvalidos).toBe(0);
  });

  it("bloqueia comparável inventado pela IA", () => {
    const r = validarComparaveisReais([{ id: "fake", fonte: "mercado", ...base }], opts);
    expect(r.ok).toBe(false);
    expect(r.invalidos[0].motivo).toBe("sem_correspondencia_mercado");
  });

  it("bloqueia item sem id e com fonte inválida", () => {
    const r = validarComparaveisReais(
      [
        { fonte: "carteira", ...base },
        { id: "x", fonte: "ia", ...base },
      ],
      opts,
    );
    expect(r.totalInvalidos).toBe(2);
    expect(resumirMotivos(r.invalidos)).toEqual({ sem_id: 1, fonte_invalida: 1 });
  });

  it("bloqueia dados incompletos", () => {
    const r = validarComparaveisReais([{ id: "c1", fonte: "carteira", preco: 0, area: 50 }], opts);
    expect(r.invalidos[0].motivo).toBe("dados_incompletos");
  });

  it("falha quando lista vazia", () => {
    const r = validarComparaveisReais([], opts);
    expect(r.ok).toBe(false);
    expect(r.resumo).toContain("Nenhum imóvel de referência real");
  });

  it("respeita mínimo configurável", () => {
    const r = validarComparaveisReais([{ id: "c1", fonte: "carteira", ...base }], {
      ...opts,
      minimoValidos: 3,
    });
    expect(r.ok).toBe(false);
  });
});
