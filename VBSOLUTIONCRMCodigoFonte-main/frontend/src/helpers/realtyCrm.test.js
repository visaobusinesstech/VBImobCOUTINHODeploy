import {
  CONTRATO_STATUSES,
  STATUS_CONTRATO,
  estimateAvaliacao,
  formatBRL,
  getDocCompleteness,
  groupLeadsByStage,
  isImovelAvailable,
  normalizeContratoStatus,
  rankImoveisForLead,
  scoreLeadImovelMatch,
} from "./realtyCrm";

describe("realtyCrm frontend helper", () => {
  it("formats BRL", () => {
    expect(formatBRL(1500)).toMatch(/1.?500/);
    expect(formatBRL("x")).toBe("—");
  });

  it("matches lead to property", () => {
    const { score } = scoreLeadImovelMatch(
      { interestCity: "São Paulo", interestType: "casa", value: 100000 },
      { id: 1, city: "Sao Paulo", type: "casa", price: 110000, status: "disponivel" }
    );
    expect(score).toBeGreaterThanOrEqual(40 + 20 + 15 + 10);
  });

  it("ranks best property first", () => {
    const ranked = rankImoveisForLead(
      { interestCity: "Curitiba", bedrooms: 2 },
      [
        { id: 1, city: "Curitiba", bedrooms: 1, status: "disponivel" },
        { id: 2, city: "Curitiba", bedrooms: 3, status: "disponivel" },
      ]
    );
    expect(ranked[0].imovelId).toBe(2);
    expect(isImovelAvailable("reservado")).toBe(false);
  });

  it("groups pipeline columns", () => {
    const grouped = groupLeadsByStage(
      [{ status: "novo" }, { status: "proposta" }],
      [{ key: "novo" }, { key: "proposta" }]
    );
    expect(grouped.novo).toHaveLength(1);
    expect(grouped.proposta).toHaveLength(1);
  });

  it("estimates avaliação vs mercado", () => {
    const { parecer, desvio } = estimateAvaliacao(250000, 80, 4000);
    expect(parecer).toContain("abaixo");
    expect(desvio).toBeLessThan(0);
  });

  it("normaliza status legado de contrato", () => {
    expect(normalizeContratoStatus("aguardando_assinatura")).toBe("aguardando");
    expect(normalizeContratoStatus("encerrado")).toBe("inativo");
    expect(normalizeContratoStatus("ativo")).toBe("ativo");
    expect(CONTRATO_STATUSES).toContain("aguardando");
    expect(STATUS_CONTRATO.find((s) => s.id === "vencendo").label).toBe("Vencendo");
  });

  it("calcula completude documental (smoke)", () => {
    const locacao = getDocCompleteness({
      tipo: "Locação",
      contratoAnexoUrl: "/files/contrato.pdf",
      vistoriaEntrada: true,
      vistoriaAnexoUrl: "/files/vistoria.pdf",
      apoliceSeguro: true,
      apoliceAnexoUrl: "/files/apolice.pdf",
      seguroIncendioAnexoUrl: "/files/incendio.pdf",
      inquilinoCpf: "123",
      inquilinoTelefone: "11999999999",
      proprietarioCpf: "456",
      proprietarioTelefone: "11888888888",
      matricula: "M-1",
    });
    expect(locacao.done).toBe(locacao.total);
    expect(locacao.missing).toEqual([]);

    const vendaIncompleta = getDocCompleteness({ tipo: "Venda" });
    expect(vendaIncompleta.total).toBeGreaterThan(0);
    expect(vendaIncompleta.missing.length).toBe(vendaIncompleta.total);
  });
});
