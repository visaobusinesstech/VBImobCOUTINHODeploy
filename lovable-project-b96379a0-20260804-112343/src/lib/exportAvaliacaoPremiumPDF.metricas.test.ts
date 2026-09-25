import { describe, it, expect, vi } from "vitest";

// ─── Testes de integração: recálculo de probabilidades e coerência
// entre a página 3 (preço) e a página 4 (probabilidades). Cobrimos:
//   1. Unidade: derivarMetricas para diversos cenários de valor_ideal,
//      score_liquidez e comparáveis.
//   2. Integração: o preço grande da página 3 e as porcentagens
//      30/60/90d + "tempo estimado" da página 4 são exatamente os
//      valores calculados por derivarMetricas para o mesmo input —
//      as duas páginas falam a mesma coisa.

// ───────────────────── Captura de render ─────────────────
type Cap = { order: number; page: number; text: string; size: number };
const _cap: Cap[] = [];
let _order = 0;

vi.mock("jspdf", async (importOriginal) => {
  const actual = await importOriginal<typeof import("jspdf")>();
  const Original = actual.default;
  const Wrapped = function (this: unknown, ...args: unknown[]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inst = new (Original as any)(...args);
    let currentSize = inst.getFontSize?.() ?? 16;
    const origSetSize = inst.setFontSize.bind(inst);
    inst.setFontSize = function (s: number) {
      currentSize = s;
      return origSetSize(s);
    };
    const origText = inst.text.bind(inst);
    inst.text = function (...tArgs: unknown[]) {
      try {
        const page = inst.internal.getCurrentPageInfo().pageNumber as number;
        const arg0 = tArgs[0];
        const flat = Array.isArray(arg0) ? arg0.join(" ") : String(arg0 ?? "");
        _cap.push({ order: _order++, page, text: flat, size: currentSize });
      } catch {
        /* noop */
      }
      return origText(...tArgs);
    };
    return inst;
  } as unknown as typeof Original;
  return { ...actual, default: Wrapped };
});

const mod = await import("./exportAvaliacaoPremiumPDF");
const { derivarMetricas, exportAvaliacaoPremiumPDF } = mod;

// ─── Helpers ─────────────────────────────────────────────
const fmtBRL = (v: number) =>
  (Number(v) || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

const clip = (n: number) => Math.max(3, Math.min(98, Math.round(n)));

/** Reimplementação de referência da mesma fórmula usada pelo produto.
 * Serve como oráculo independente: se a função interna mudar sem
 * intenção, o teste quebra. */
function oraculoProbs(
  precoRecomendado: number,
  precoMercado: number,
  scoreLiquidez: number,
  precoAvaliado: number = precoRecomendado,
) {
  const liq = Math.max(15, Math.min(95, scoreLiquidez));
  const delta = precoMercado
    ? ((precoAvaliado - precoMercado) / precoMercado) * 100
    : 0;
  const base30 = 45,
    base60 = 72,
    base90 = 88;
  const ajusteDelta = -delta * 1.6;
  const ajusteLiq = (liq - 60) * 0.35;
  return {
    d30: clip(base30 + ajusteDelta + ajusteLiq),
    d60: clip(base60 + ajusteDelta * 0.75 + ajusteLiq),
    d90: clip(base90 + ajusteDelta * 0.45 + ajusteLiq),
  };
}

function oraculoTempo(probs: { d30: number; d60: number; d90: number }) {
  if (probs.d30 >= 75) return 30;
  if (probs.d60 >= 75) {
    const t =
      30 + ((75 - probs.d30) / Math.max(1, probs.d60 - probs.d30)) * 30;
    return Math.round(t);
  }
  if (probs.d90 >= 75) {
    const t =
      60 + ((75 - probs.d60) / Math.max(1, probs.d90 - probs.d60)) * 30;
    return Math.round(t);
  }
  return 120;
}

function comps(valores: number[], diasAnuncio: number[] = []) {
  return valores.map((preco, i) => ({
    titulo: `Comp ${i + 1}`,
    area: 90,
    preco,
    dias_anuncio: diasAnuncio[i] ?? 30 + i * 5,
  }));
}

const imovelBase = {
  tipo: "Apartamento",
  endereco: "Rua Teste, 1",
  bairro: "Centro",
  cidade: "Brasília",
  estado: "DF",
  area: 90,
  preco: 0,
  fotos: [],
};

// ══════════════════════════════════════════════════════════
// 1. UNIDADE — derivarMetricas
// ══════════════════════════════════════════════════════════
describe("derivarMetricas — recálculo de probabilidades e tempo", () => {
  it("cenário alinhado ao mercado (delta≈0, liq=60): baseline 45/72/88 e ~55 dias", () => {
    const avaliacao = { valor_ideal: 800_000, score_liquidez: 60 };
    const met = derivarMetricas(
      imovelBase,
      avaliacao,
      comps([790_000, 800_000, 810_000]),
    );
    expect(met.precoMercado).toBe(800_000);
    expect(met.diffPct).toBeCloseTo(0, 3);
    expect(met.probRecom).toEqual({ d30: 45, d60: 72, d90: 88 });
    // d60=72 < 75, então a interpolação cai na janela 60→90d:
    // t = 60 + (75-72)/(88-72)*30 = 60 + 5.625 → 66
    expect(met.tempoEstimadoDias).toBe(66);
  });

  it("liquidez alta acelera a venda (mesma diferença de preço)", () => {
    const baixa = derivarMetricas(
      imovelBase,
      { valor_ideal: 800_000, score_liquidez: 40 },
      comps([800_000]),
    );
    const alta = derivarMetricas(
      imovelBase,
      { valor_ideal: 800_000, score_liquidez: 90 },
      comps([800_000]),
    );
    expect(alta.probRecom.d30).toBeGreaterThan(baixa.probRecom.d30);
    expect(alta.probRecom.d60).toBeGreaterThan(baixa.probRecom.d60);
    expect(alta.probRecom.d90).toBeGreaterThan(baixa.probRecom.d90);
    expect(alta.tempoEstimadoDias).toBeLessThanOrEqual(baixa.tempoEstimadoDias);
  });

  it("preço acima do mercado reduz probabilidade e amplia tempo", () => {
    const noPreco = derivarMetricas(
      imovelBase,
      { valor_ideal: 800_000, score_liquidez: 60 },
      comps([800_000]),
    );
    const caro = derivarMetricas(
      imovelBase,
      { valor_ideal: 880_000, score_liquidez: 60 }, // +10% vs mercado
      comps([800_000]),
    );
    expect(caro.diffPct).toBeCloseTo(10, 3);
    expect(caro.probRecom.d30).toBeLessThan(noPreco.probRecom.d30);
    expect(caro.probRecom.d60).toBeLessThan(noPreco.probRecom.d60);
    expect(caro.probRecom.d90).toBeLessThan(noPreco.probRecom.d90);
    expect(caro.tempoEstimadoDias).toBeGreaterThan(noPreco.tempoEstimadoDias);
  });

  it("liquidez é limitada em [15,95] e probabilidades em [3,98]", () => {
    const extremoAlto = derivarMetricas(
      imovelBase,
      { valor_ideal: 500_000, score_liquidez: 500 }, // saturado em 95
      comps([800_000]),
    );
    expect(extremoAlto.liq).toBe(95);
    expect(extremoAlto.probRecom.d30).toBeLessThanOrEqual(98);
    expect(extremoAlto.probRecom.d90).toBeLessThanOrEqual(98);

    const extremoBaixo = derivarMetricas(
      imovelBase,
      { valor_ideal: 2_000_000, score_liquidez: -10 }, // saturado em 15
      comps([800_000]),
    );
    expect(extremoBaixo.liq).toBe(15);
    expect(extremoBaixo.probRecom.d30).toBeGreaterThanOrEqual(3);
  });

  it("bate exatamente com o oráculo em 6 cenários variados", () => {
    const casos = [
      { ideal: 800_000, liq: 60, comparaveis: [800_000] },
      { ideal: 750_000, liq: 80, comparaveis: [800_000, 780_000, 820_000] },
      { ideal: 900_000, liq: 45, comparaveis: [800_000, 810_000] },
      { ideal: 1_200_000, liq: 70, comparaveis: [1_100_000, 1_150_000, 1_250_000] },
      { ideal: 420_000, liq: 30, comparaveis: [500_000, 480_000] },
      { ideal: 650_000, liq: 90, comparaveis: [620_000, 640_000, 660_000, 670_000] },
    ];
    for (const c of casos) {
      const met = derivarMetricas(
        imovelBase,
        { valor_ideal: c.ideal, score_liquidez: c.liq },
        comps(c.comparaveis),
      );
      const esperado = oraculoProbs(c.ideal, met.precoMercado, c.liq);
      expect(
        met.probRecom,
        `ideal=${c.ideal} liq=${c.liq} mercado=${met.precoMercado}`,
      ).toEqual(esperado);
      expect(met.tempoEstimadoDias).toBe(oraculoTempo(esperado));
    }
  });

  it("sem comparáveis, o mercado colapsa no valor_ideal (delta=0)", () => {
    const met = derivarMetricas(
      imovelBase,
      { valor_ideal: 700_000, score_liquidez: 60 },
      [],
    );
    expect(met.precoMercado).toBe(700_000);
    expect(met.diffPct).toBe(0);
    expect(met.probRecom).toEqual({ d30: 45, d60: 72, d90: 88 });
  });

  it("probPedido usa preco do imóvel e é diferente de probRecom quando divergem", () => {
    const met = derivarMetricas(
      { ...imovelBase, preco: 900_000 },
      { valor_ideal: 800_000, score_liquidez: 60 },
      comps([800_000]),
    );
    expect(met.probPedido).not.toBeNull();
    expect(met.probPedido).toEqual(oraculoProbs(800_000, 800_000, 60, 900_000));
    // Pedido acima do recomendado → menor probabilidade em todos prazos.
    expect(met.probPedido!.d30).toBeLessThan(met.probRecom.d30);
    expect(met.probPedido!.d60).toBeLessThan(met.probRecom.d60);
    expect(met.probPedido!.d90).toBeLessThan(met.probRecom.d90);
  });
});

// ══════════════════════════════════════════════════════════
// 2. INTEGRAÇÃO — página 3 ↔ página 4 do PDF
// ══════════════════════════════════════════════════════════

async function renderPDF(avaliacao: any, comparaveis: any[], imovel = imovelBase) {
  _cap.length = 0;
  _order = 0;
  await exportAvaliacaoPremiumPDF({
    imovel,
    avaliacao,
    comparaveis,
    brandName: "TestBrand",
    corretorInfo: { nome: "Corretor Teste" },
    skipSave: true,
  });
}

describe("Integração página 3 (preço) ↔ página 4 (probabilidades)", () => {
  const cenarios = [
    {
      nome: "alinhado, liquidez média",
      avaliacao: { valor_ideal: 815_000, score_liquidez: 65 },
      comparaveis: comps([800_000, 815_000, 830_000]),
    },
    {
      nome: "acima do mercado, liquidez baixa",
      avaliacao: { valor_ideal: 900_000, score_liquidez: 40 },
      comparaveis: comps([800_000, 810_000, 820_000]),
    },
    {
      nome: "abaixo do mercado, liquidez alta",
      avaliacao: { valor_ideal: 720_000, score_liquidez: 85 },
      comparaveis: comps([800_000, 810_000]),
    },
  ];

  it.each(cenarios)("cenário: $nome — página 3 e página 4 usam os mesmos números", async (c) => {
    await renderPDF(c.avaliacao, c.comparaveis);
    const met = derivarMetricas(imovelBase, c.avaliacao, c.comparaveis);

    // Página 3: preço hero (52pt) precisa ser exatamente formatBRL(precoRecomendado)
    const pagina3 = _cap.filter((x) => x.page === 3);
    const heroPreco = pagina3.find((x) => x.size >= 40 && /^R\$/.test(x.text));
    expect(heroPreco, "página 3 sem hero em R$").toBeDefined();
    expect(heroPreco!.text).toBe(fmtBRL(met.precoRecomendado));

    // Página 4: 3 porcentagens em fonte grande (uma por janela)
    const pagina4 = _cap.filter((x) => x.page === 4);
    const pcts = pagina4
      .filter((x) => x.size >= 18 && /^\d+%$/.test(x.text.trim()))
      .map((x) => parseInt(x.text.trim().replace("%", ""), 10));
    expect(pcts.length).toBeGreaterThanOrEqual(3);

    const [p30, p60, p90] = pcts;
    expect(p30).toBe(met.probRecom.d30);
    expect(p60).toBe(met.probRecom.d60);
    expect(p90).toBe(met.probRecom.d90);

    // O parágrafo introdutório da página 4 cita o mesmo preço da página 3.
    const intro = pagina4.find((x) =>
      x.text.startsWith("Se o imóvel for anunciado por"),
    );
    expect(intro, "página 4 sem intro esperado").toBeDefined();
    // O sanitizer do PDF converte NBSP em espaço normal — comparamos
    // ambos os lados com whitespace unificado.
    const norm = (s: string) => s.replace(/\s+/g, " ");
    expect(norm(intro!.text)).toContain(norm(fmtBRL(met.precoRecomendado)));
  });

  it("o 'tempo estimado' da página 1 é consistente com as probabilidades da página 4", async () => {
    const avaliacao = { valor_ideal: 815_000, score_liquidez: 65 };
    const comparaveis = comps([800_000, 815_000, 830_000]);
    await renderPDF(avaliacao, comparaveis);
    const met = derivarMetricas(imovelBase, avaliacao, comparaveis);

    const pagina1 = _cap.filter((x) => x.page === 1);
    const tempo = pagina1.find((x) => /^\d+\s+dias$/.test(x.text.trim()));
    expect(tempo, "página 1 sem KPI de tempo").toBeDefined();
    expect(tempo!.text.trim()).toBe(`${met.tempoEstimadoDias} dias`);
    expect(met.tempoEstimadoDias).toBe(oraculoTempo(met.probRecom));
  });

  it("página 9 replica o mesmo preço recomendado da página 3 (mesma conclusão)", async () => {
    const avaliacao = { valor_ideal: 815_000, score_liquidez: 65 };
    const comparaveis = comps([800_000, 815_000, 830_000]);
    await renderPDF(avaliacao, comparaveis);
    const esperado = fmtBRL(815_000);
    const pagina3Hero = _cap.find(
      (x) => x.page === 3 && x.size >= 40 && x.text === esperado,
    );
    const pagina9Hero = _cap.find(
      (x) => x.page === 9 && x.size >= 24 && x.text === esperado,
    );
    expect(pagina3Hero).toBeDefined();
    expect(pagina9Hero).toBeDefined();
  });
});
