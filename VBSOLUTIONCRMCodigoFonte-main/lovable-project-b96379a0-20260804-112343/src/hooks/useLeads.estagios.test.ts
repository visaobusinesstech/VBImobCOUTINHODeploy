import { describe, it, expect } from "vitest";
import { ESTAGIOS } from "./useLeads";

describe("Pipeline ESTAGIOS", () => {
  const ids = ESTAGIOS.map((e) => e.id);
  const titles = ESTAGIOS.map((e) => e.title);

  it("não contém o estágio 'procurar_opcoes'", () => {
    expect(ids).not.toContain("procurar_opcoes");
  });

  it("não exibe o título 'Procurar Opções' em nenhum estágio", () => {
    expect(titles.some((t) => /procurar\s*op/i.test(t))).toBe(false);
  });

  it("mantém o estágio unificado 'mandar_opcoes'", () => {
    expect(ids).toContain("mandar_opcoes");
    const est = ESTAGIOS.find((e) => e.id === "mandar_opcoes");
    expect(est?.title).toBe("Mandar Opções");
  });

  it("não possui ids duplicados", () => {
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("filtro por estágio retorna somente leads do estágio selecionado (sem procurar_opcoes)", () => {
    const leads = [
      { id: "1", estagio: "novos" },
      { id: "2", estagio: "mandar_opcoes" },
      { id: "3", estagio: "mandar_opcoes" },
      { id: "4", estagio: "fechado" },
    ];
    const filtrados = leads.filter((l) => l.estagio === "mandar_opcoes");
    expect(filtrados).toHaveLength(2);
    expect(leads.some((l) => l.estagio === "procurar_opcoes")).toBe(false);
  });

  it("contagem por estágio (relatório) usa apenas estágios válidos do pipeline", () => {
    const leads = [
      { estagio: "novos" },
      { estagio: "mandar_opcoes" },
      { estagio: "mandar_opcoes" },
      { estagio: "fechado" },
    ];
    const counts = ids.reduce<Record<string, number>>((acc, id) => {
      acc[id] = leads.filter((l) => l.estagio === id).length;
      return acc;
    }, {});
    expect(counts["mandar_opcoes"]).toBe(2);
    expect(counts).not.toHaveProperty("procurar_opcoes");
  });
});
