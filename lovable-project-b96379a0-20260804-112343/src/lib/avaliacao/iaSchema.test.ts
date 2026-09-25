import { describe, it, expect } from "vitest";
import { parseIaResponse } from "./iaSchema";

describe("parseIaResponse — validação Zod do payload da IA", () => {
  const valid = {
    inconsistencias: ["Distância > 5km"],
    suficiencia: "Amostra suficiente.",
    valor_sugerido_ia: 815000,
    fundamentacao: "Aplicado método comparativo NBR 14.653.",
    conclusao: "Valor final: R$ 815.000.",
  };

  it("aceita payload bem formado", () => {
    const r = parseIaResponse(valid);
    expect(r.ok).toBe(true);
    expect(r.data).toMatchObject(valid);
    expect(r.issues).toEqual([]);
  });

  it("normaliza valor_sugerido_ia vindo como string formatada", () => {
    const r = parseIaResponse({ ...valid, valor_sugerido_ia: "R$ 815.000,00" });
    expect(r.ok).toBe(true);
    expect(r.data.valor_sugerido_ia).toBeCloseTo(815000, 0);
  });

  it("ignora inconsistencias inválidas mas preserva conteúdo textual", () => {
    const r = parseIaResponse({ ...valid, inconsistencias: "não-array" as any });
    expect(r.ok).toBe(true);
    expect(r.data.inconsistencias).toEqual([]);
    expect(r.data.fundamentacao).toBe(valid.fundamentacao);
  });

  it("rejeita resposta nula/não-objeto", () => {
    expect(parseIaResponse(null).ok).toBe(false);
    expect(parseIaResponse("texto").ok).toBe(false);
    expect(parseIaResponse(123).ok).toBe(false);
  });

  it("marca como inválido quando não há fundamentação/conclusão/suficiência", () => {
    const r = parseIaResponse({
      inconsistencias: [],
      suficiencia: "",
      fundamentacao: "",
      conclusao: "",
    });
    expect(r.ok).toBe(false);
    expect(r.issues.length).toBeGreaterThan(0);
  });

  it("trunca/aplica trim em strings sem quebrar", () => {
    const r = parseIaResponse({
      ...valid,
      suficiencia: "   ok   ",
      fundamentacao: "x".repeat(20),
    });
    expect(r.data.suficiencia).toBe("ok");
    expect(r.data.fundamentacao.length).toBe(20);
  });

  it("descarta valor_sugerido_ia negativo ou zero", () => {
    const a = parseIaResponse({ ...valid, valor_sugerido_ia: -100 });
    expect(a.data.valor_sugerido_ia).toBeUndefined();
    const b = parseIaResponse({ ...valid, valor_sugerido_ia: "abc" });
    expect(b.data.valor_sugerido_ia).toBeUndefined();
  });
});
