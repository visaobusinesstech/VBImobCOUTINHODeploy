import {
  clampPageSize,
  groupLeadsByStage,
  isImovelAvailable,
  normalizeText,
  pickAllowedStatus,
  rankImoveisForLead,
  REALTY_PIPELINE_STAGES,
  scoreLeadImovelMatch
} from "../helpers/realtyCrm";

describe("realtyCrm matching", () => {
  const lead = {
    interestCity: "Brasília",
    interestNeighborhood: "Asa Norte",
    interestType: "apartamento",
    bedrooms: 2,
    value: 500000
  };

  const imovel = {
    id: 7,
    title: "Apt Asa Norte",
    city: "Brasilia",
    neighborhood: "Asa Norte",
    type: "Apartamento",
    bedrooms: 3,
    price: 520000,
    status: "disponivel"
  };

  it("normalizes accents for city matching", () => {
    expect(normalizeText("Brasília")).toBe("brasilia");
  });

  it("scores a strong lead-imovel match", () => {
    const { score, reasons } = scoreLeadImovelMatch(lead, imovel);
    expect(score).toBe(40 + 25 + 20 + 10 + 15 + 10);
    expect(reasons).toEqual(
      expect.arrayContaining([
        "mesma cidade",
        "mesmo bairro",
        "mesmo tipo",
        "quartos suficientes",
        "faixa de preço",
        "disponível"
      ])
    );
  });

  it("ranks matches and ignores zero-score leftovers besides availability", () => {
    const ranked = rankImoveisForLead(lead, [
      imovel,
      { id: 9, city: "Recife", status: "vendido", price: 10 }
    ]);
    expect(ranked[0].imovelId).toBe(7);
    expect(ranked.some(r => r.imovelId === 9)).toBe(false);
  });

  it("treats captacao as available", () => {
    expect(isImovelAvailable("captacao")).toBe(true);
    expect(isImovelAvailable("vendido")).toBe(false);
  });
});

describe("realtyCrm helpers", () => {
  it("clamps page size", () => {
    expect(clampPageSize(undefined)).toBe(20);
    expect(clampPageSize("0")).toBe(20);
    expect(clampPageSize(9999, 20, 500)).toBe(500);
    expect(clampPageSize("50")).toBe(50);
  });

  it("picks allowed status with fallback", () => {
    expect(pickAllowedStatus("vendido", ["disponivel", "vendido"], "disponivel")).toBe(
      "vendido"
    );
    expect(pickAllowedStatus("x", ["disponivel"], "disponivel")).toBe("disponivel");
  });

  it("groups leads by pipeline stage including unknown keys", () => {
    const grouped = groupLeadsByStage(
      [
        { id: 1, status: "novo" },
        { id: 2, status: "visita" },
        { id: 3, status: "custom" }
      ],
      REALTY_PIPELINE_STAGES.map(s => ({ key: s.key }))
    );
    expect(grouped.novo).toHaveLength(1);
    expect(grouped.visita).toHaveLength(1);
    expect(grouped.custom).toHaveLength(1);
  });
});
