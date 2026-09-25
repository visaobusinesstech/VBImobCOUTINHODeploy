/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Testes de paridade dos helpers de Avaliação (Lovable ↔ VBSolution).
 */
import {
  DESCRICAO_MAX,
  DESCRICAO_MIN,
  contarDescricao,
  formatarContador,
  truncarDescricao,
  validarDescricaoAvaliacao,
  validarDescricaoBackendShape,
  resolveManualImovelDescricao,
  descricaoParaPersistencia,
  descricaoParaFormulario,
} from "./avaliacaoDescricao";
import {
  getMissingCriticalFields,
  isChecklistItemMissing,
  resolveWarningPayloadForDescricao,
} from "./avaliacaoCamposCriticos";
import {
  TIPOS_MANUAL,
  TIPOS_SAS,
  TIPOS_WIZARD,
  OPERACOES_MANUAL,
  OPERACOES_SAS,
  FINALIDADES_WIZARD,
  CONSERVACOES,
  PADROES,
  POSICAO_SOLAR_SAS,
  createEmptyManualState,
  createEmptySasState,
  mapSasToManual,
} from "./avaliacaoConstants";
import { calcularResultadoWizard, fatorTotal } from "./avaliacaoEngine";
import { estimateAvaliacao } from "./realtyCrm";

describe("avaliacaoDescricao", () => {
  it("counts and truncates by code points", () => {
    expect(contarDescricao("abc")).toBe(3);
    expect(contarDescricao("🙂🙂")).toBe(2);
    const big = "x".repeat(DESCRICAO_MAX + 50);
    expect(contarDescricao(truncarDescricao(big))).toBe(DESCRICAO_MAX);
    expect(formatarContador("ola")).toBe(`3/${DESCRICAO_MAX}`);
  });

  it("validates min/max like lovable", () => {
    expect(validarDescricaoAvaliacao("").valid).toBe(false);
    expect(validarDescricaoAvaliacao("curta").valid).toBe(false);
    expect(validarDescricaoAvaliacao("x".repeat(DESCRICAO_MIN)).valid).toBe(true);
    expect(validarDescricaoBackendShape("")).toMatchObject({ code: "DESCRICAO_OBRIGATORIA" });
    expect(validarDescricaoBackendShape("abc")).toMatchObject({ code: "DESCRICAO_ABAIXO_MINIMO" });
    expect(validarDescricaoBackendShape("y".repeat(40))).toBeNull();
  });

  it("resolves description precedence for link mode", () => {
    expect(resolveManualImovelDescricao("  manual  ", true, "extraida")).toBe("manual");
    expect(resolveManualImovelDescricao("", true, "extraida")).toBe("extraida");
    expect(resolveManualImovelDescricao("", false, "extraida")).toBeNull();
    expect(descricaoParaPersistencia("  ok  ")).toBe("ok");
    expect(descricaoParaFormulario(null)).toBe("");
  });
});

describe("avaliacaoCamposCriticos", () => {
  it("lists missing critical fields", () => {
    const missing = getMissingCriticalFields({
      preco: 0,
      area: 2,
      cidade: "",
      bairro: "",
      tipo: "",
      fotos: [],
      descricao: "curta",
    });
    expect(missing.some((m) => m.startsWith("Preço"))).toBe(true);
    expect(missing.some((m) => m.startsWith("Área"))).toBe(true);
    expect(missing).toContain("Cidade");
    expect(missing.some((m) => m.startsWith("Bairro"))).toBe(true);
    expect(missing.some((m) => m.startsWith("Fotos"))).toBe(true);
    expect(missing.some((m) => m.startsWith("Tipo"))).toBe(true);
    expect(missing.some((m) => m.startsWith("Descrição"))).toBe(true);
    expect(isChecklistItemMissing(missing, "Preço")).toBe(true);
  });

  it("resolveWarningPayloadForDescricao keeps only descricao when alone", () => {
    const imovel = {
      preco: 500000,
      area: 80,
      cidade: "Brasília",
      bairro: "Asa Norte",
      tipo: "Apartamento",
      fotos: ["https://x.jpg"],
      descricao: "curta",
    };
    const warn = resolveWarningPayloadForDescricao(imovel);
    expect(warn.length).toBe(1);
    expect(warn[0].startsWith("Descrição")).toBe(true);
  });
});

describe("avaliacaoConstants field parity", () => {
  it("keeps lovable option lists", () => {
    expect(TIPOS_MANUAL).toEqual([
      "Apartamento",
      "Casa",
      "Terreno",
      "Comercial",
      "Cobertura",
      "Kitnet",
      "Sala",
      "Loja",
      "Galpão",
      "Prédio",
    ]);
    expect(OPERACOES_MANUAL).toEqual(["Venda", "Aluguel"]);
    expect(OPERACOES_SAS).toEqual(["Venda", "Locação", "Venda e Locação"]);
    expect(TIPOS_SAS).toContain("Sala Comercial");
    expect(TIPOS_WIZARD).toContain("Studio");
    expect(FINALIDADES_WIZARD).toContain("Avaliação Judicial");
    expect(CONSERVACOES).toContain("Necessita reforma");
    expect(PADROES).toContain("Alto Luxo");
    expect(POSICAO_SOLAR_SAS).toEqual(["Nascente", "Poente", "Norte", "Sul"]);
  });

  it("maps SAS form into manual state", () => {
    const sas = {
      ...createEmptySasState(),
      tipo: "Apartamento",
      operacao: "Locação",
      codigo: "A-12",
      bairro: "Águas Claras",
      cidade: "Brasília",
      area_privativa: "75",
      quartos: "3",
      preco: "450000",
      elevador: true,
      descricao: "x".repeat(40),
    };
    const manual = mapSasToManual(sas);
    expect(manual.titulo).toContain("A-12");
    expect(manual.operacao).toBe("Aluguel");
    expect(manual.area).toBe("75");
    expect(manual.elevador).toBe(true);
    expect(createEmptyManualState().estado).toBe("DF");
  });
});

describe("avaliacaoEngine", () => {
  it("computes NBR homogenization result", () => {
    expect(fatorTotal({ localizacao: 1.1, area: 1 })).toBeCloseTo(1.1);
    const comps = [
      { id: "1", area: 80, valor_anunciado: 480000 },
      { id: "2", area: 85, valor_anunciado: 510000 },
      { id: "3", area: 78, valor_anunciado: 460000 },
    ];
    const result = calcularResultadoWizard(comps, {}, 80);
    expect(result.amostraValida).toBe(3);
    expect(result.valorFinal.sugerido).toBeGreaterThan(0);
    expect(result.valorFinal.minimo).toBeLessThan(result.valorFinal.maximo);
  });
});

describe("estimateAvaliacao legacy", () => {
  it("still estimates vs mercado", () => {
    // 400k / 80m² vs m² mercado 6000 → valorJusto 480k → abaixo
    const abaixo = estimateAvaliacao(400000, 80, 6000);
    expect(abaixo.parecer).toContain("abaixo");
    expect(abaixo.desvio).toBeLessThan(0);
    // 800k / 80m² vs m² 4000 → valorJusto 320k → acima
    const acima = estimateAvaliacao(800000, 80, 4000);
    expect(acima.parecer).toContain("acima");
    expect(acima.desvio).toBeGreaterThan(15);
  });
});
