import { describe, it, expect } from "vitest";
import {
  calcularAvaliacao,
  fatorTotal,
  FATORES_DEFAULT,
  homogeneizar,
  media,
  mediana,
  desvioPadrao,
  intervaloConfianca95,
  pctParaFator,
  removerOutliers,
  valorBase,
  avaliarQualidade,
} from "./engine";

describe("engine de avaliação", () => {
  it("valorBase prefere negociado quando presente", () => {
    expect(valorBase({ id: "a", area: 80, valor_anunciado: 500_000, valor_negociado: 480_000 })).toBe(480_000);
    expect(valorBase({ id: "a", area: 80, valor_anunciado: 500_000 })).toBe(500_000);
  });

  it("fatorTotal com fatores neutros = 1", () => {
    expect(fatorTotal(FATORES_DEFAULT)).toBe(1);
  });

  it("pctParaFator converte corretamente", () => {
    expect(pctParaFator(0)).toBe(1);
    expect(pctParaFator(10)).toBeCloseTo(1.1);
    expect(pctParaFator(-15)).toBeCloseTo(0.85);
  });

  it("homogeneiza preço/m² com fatores neutros", () => {
    const h = homogeneizar(
      { id: "x", area: 100, valor_anunciado: 600_000 },
      FATORES_DEFAULT,
    );
    expect(h.preco_m2_bruto).toBe(6000);
    expect(h.preco_m2_homogeneizado).toBe(6000);
    expect(h.fator_total).toBe(1);
  });

  it("homogeneiza com fator de localização +10%", () => {
    const h = homogeneizar(
      { id: "x", area: 100, valor_anunciado: 600_000 },
      { ...FATORES_DEFAULT, localizacao: 1.1 },
    );
    expect(h.preco_m2_homogeneizado).toBeCloseTo(6600);
  });

  it("estatísticas básicas", () => {
    expect(media([10, 20, 30])).toBe(20);
    expect(mediana([10, 20, 30])).toBe(20);
    expect(mediana([10, 20])).toBe(15);
    expect(desvioPadrao([10, 10, 10])).toBe(0);
    expect(desvioPadrao([1, 2, 3, 4, 5])).toBeGreaterThan(0);
  });

  it("intervaloConfianca95 gera faixa simétrica em torno da média", () => {
    const ic = intervaloConfianca95([100, 110, 90, 105, 95]);
    const m = media([100, 110, 90, 105, 95]);
    expect(ic.inferior).toBeLessThan(m);
    expect(ic.superior).toBeGreaterThan(m);
  });

  it("removerOutliers remove valor extremo", () => {
    const r = removerOutliers([10, 11, 9, 10, 12, 11, 100]);
    expect(r).not.toContain(100);
  });

  it("avaliarQualidade classifica corretamente", () => {
    expect(avaliarQualidade(2, 10).nivel).toBe("insuficiente");
    expect(avaliarQualidade(4, 20).nivel).toBe("expedito");
    expect(avaliarQualidade(8, 20).nivel).toBe("normal");
    expect(avaliarQualidade(15, 10).nivel).toBe("rigoroso");
  });

  it("calcularAvaliacao produz valor coerente", () => {
    const comparaveis = [
      { id: "1", area: 80, valor_anunciado: 480_000 }, // 6000/m²
      { id: "2", area: 90, valor_anunciado: 558_000 }, // 6200/m²
      { id: "3", area: 75, valor_anunciado: 442_500 }, // 5900/m²
      { id: "4", area: 100, valor_anunciado: 620_000 }, // 6200/m²
    ];
    const fatores = Object.fromEntries(comparaveis.map((c) => [c.id, FATORES_DEFAULT]));
    const res = calcularAvaliacao(comparaveis, fatores, 85);

    expect(res.amostraValida).toBe(4);
    expect(res.precoM2.media).toBeGreaterThan(5800);
    expect(res.precoM2.media).toBeLessThan(6300);
    expect(res.valorFinal.sugerido).toBeGreaterThan(85 * 5800);
    expect(res.valorFinal.sugerido).toBeLessThan(85 * 6300);
    expect(res.qualidade.nivel).toBeDefined();
  });

  it("ignora comparáveis com dados inválidos", () => {
    const res = calcularAvaliacao(
      [
        { id: "a", area: 0, valor_anunciado: 100_000 },
        { id: "b", area: 50, valor_anunciado: 0 },
        { id: "c", area: 100, valor_anunciado: 500_000 },
      ],
      { c: FATORES_DEFAULT },
      100,
    );
    expect(res.amostraValida).toBe(1);
  });
});
