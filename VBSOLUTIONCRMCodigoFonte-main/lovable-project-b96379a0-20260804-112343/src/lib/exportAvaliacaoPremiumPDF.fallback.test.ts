import { describe, it, expect } from "vitest";
import { derivarMetricas, exportAvaliacaoPremiumPDF } from "./exportAvaliacaoPremiumPDF";

// ─────────────────────────────────────────────────────────────
// INTEGRAÇÃO — FALLBACK COERENTE PARA DADOS AUSENTES/INVÁLIDOS
//
// Cenários em que a IA/avaliação chega ao gerador com campos
// faltando ou inválidos:
//
//   • score_liquidez ausente / string / fora da faixa 0..100
//   • valor_ideal ausente / zero / string
//   • comparáveis vazios / com preco=0 / com dias_anuncio inválido
//
// Regras invariantes que o relatório precisa manter em TODOS
// os cenários:
//
//   1. derivarMetricas nunca retorna NaN em nenhum campo numérico.
//   2. probRecom.d30/d60/d90 permanecem em [3, 98] (clamp da fn).
//   3. liq permanece em [15, 95] (clamp explícito).
//   4. indiceConfianca em [30, 98].
//   5. tempoEstimadoDias é inteiro finito e ≥ 30.
//   6. precoMinimo ≤ precoRecomendado ≤ precoMaximo (quando existe
//      preço recomendado > 0).
//   7. O PDF completo gera 9 páginas mesmo com dados degradados e
//      NUNCA imprime "NaN", "undefined" ou "null" no texto.
// ─────────────────────────────────────────────────────────────

const baseImovel = {
  tipo: "Apartamento",
  endereco: "Rua Teste, 10",
  bairro: "Centro",
  cidade: "Brasília",
  estado: "DF",
  area: 80,
  preco: 700_000,
  fotos: [],
};

const compsValidos = Array.from({ length: 5 }, (_, i) => ({
  titulo: `Comp ${i + 1}`,
  area: 78 + i,
  preco: 680_000 + i * 8_000,
  dias_anuncio: 25 + i * 10,
}));

// Utilitário: percorre todo objeto/array e falha se encontra NaN.
function assertNoNaN(obj: unknown, path = "root") {
  if (typeof obj === "number") {
    expect(Number.isFinite(obj), `campo ${path} = ${obj} (não finito)`).toBe(true);
    return;
  }
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => assertNoNaN(v, `${path}[${i}]`));
    return;
  }
  if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) assertNoNaN(v, `${path}.${k}`);
  }
}

function assertInvariantes(met: ReturnType<typeof derivarMetricas>) {
  assertNoNaN(met);
  // clamps de probabilidade
  for (const janela of ["d30", "d60", "d90"] as const) {
    const v = met.probRecom[janela];
    expect(v, `probRecom.${janela}=${v}`).toBeGreaterThanOrEqual(3);
    expect(v, `probRecom.${janela}=${v}`).toBeLessThanOrEqual(98);
    expect(Number.isInteger(v)).toBe(true);
  }
  if (met.probPedido) {
    for (const janela of ["d30", "d60", "d90"] as const) {
      const v = met.probPedido[janela];
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(98);
    }
  }
  // clamps de liquidez / confiança
  expect(met.liq).toBeGreaterThanOrEqual(15);
  expect(met.liq).toBeLessThanOrEqual(95);
  expect(met.indiceConfianca).toBeGreaterThanOrEqual(30);
  expect(met.indiceConfianca).toBeLessThanOrEqual(98);
  // tempo estimado
  expect(Number.isInteger(met.tempoEstimadoDias)).toBe(true);
  expect(met.tempoEstimadoDias).toBeGreaterThanOrEqual(30);
  expect(met.tempoEstimadoDias).toBeLessThanOrEqual(365);
  // faixa preços coerente quando existe preço recomendado
  if (met.precoRecomendado > 0) {
    expect(met.precoMinimo).toBeLessThanOrEqual(met.precoRecomendado);
    expect(met.precoMaximo).toBeGreaterThanOrEqual(met.precoRecomendado);
  }
  // dias sempre inteiro positivo
  expect(met.diasMedio).toBeGreaterThan(0);
  expect(met.diasMediano).toBeGreaterThan(0);
}

async function pdfTexto(imovel: unknown, avaliacao: unknown, comparaveis: unknown[]) {
  const doc = await exportAvaliacaoPremiumPDF({
    imovel: imovel as never,
    avaliacao: avaliacao as never,
    comparaveis: comparaveis as never,
    brandName: "TestBrand",
    corretorInfo: { nome: "Corretor" },
    skipSave: true,
  });
  const numPages = (doc as unknown as { getNumberOfPages: () => number }).getNumberOfPages();
  const ab = (doc as { output: (t: string) => ArrayBuffer }).output("arraybuffer");

  const pdfjs = await import(
    /* @vite-ignore */ "pdfjs-dist/legacy/build/pdf.mjs" as string
  );
  (pdfjs as { GlobalWorkerOptions: { workerSrc: string } }).GlobalWorkerOptions.workerSrc =
    require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs");
  const task = (
    pdfjs as { getDocument: (o: unknown) => { promise: Promise<unknown> } }
  ).getDocument({ data: new Uint8Array(ab), isEvalSupported: false, useSystemFonts: false });
  const pdf = (await task.promise) as {
    numPages: number;
    getPage: (n: number) => Promise<{
      getTextContent: () => Promise<{ items: Array<{ str: string }> }>;
    }>;
  };
  let texto = "";
  for (let p = 1; p <= pdf.numPages; p++) {
    const c = await (await pdf.getPage(p)).getTextContent();
    texto += " " + c.items.map((it) => it.str).join(" ");
  }
  return { texto: texto.replace(/\u00A0/g, " "), numPages, numPagesPdfjs: pdf.numPages };
}

function assertPdfSemLixo(texto: string) {
  for (const proibido of [/\bNaN\b/, /\bundefined\b/, /\bnull\b/, /R\$\s?NaN/]) {
    expect(texto, `token proibido encontrado (${proibido})`).not.toMatch(proibido);
  }
}

describe("PDF Premium · integração · fallback para dados ausentes/inválidos", () => {
  // ═══════════════════════════════════════════════════════════
  // score_liquidez
  // ═══════════════════════════════════════════════════════════
  describe("score_liquidez ausente/inválido → fallback 62 e clamp [15,95]", () => {
    const cenarios: Array<[string, unknown]> = [
      ["undefined", undefined],
      ["null", null],
      ["string vazia", ""],
      ["string não numérica", "muito líquido"],
      ["NaN literal", Number.NaN],
      ["negativo (-50)", -50],
      ["acima do teto (999)", 999],
      ["0 (edge, cai no fallback do toNum)", 0],
    ];
    for (const [label, valor] of cenarios) {
      it(`score_liquidez=${label} mantém invariantes`, async () => {
        const av = { valor_ideal: 800_000, valor_minimo: 760_000, valor_maximo: 840_000, score_liquidez: valor };
        const met = derivarMetricas(baseImovel, av, compsValidos);
        assertInvariantes(met);
        // liq deve estar clamped (não pode ser 999 nem -50 nem NaN)
        expect(met.liq).toBeGreaterThanOrEqual(15);
        expect(met.liq).toBeLessThanOrEqual(95);
        const { texto, numPages } = await pdfTexto(baseImovel, av, compsValidos);
        expect(numPages).toBe(9);
        assertPdfSemLixo(texto);
      }, 30_000);
    }
  });

  // ═══════════════════════════════════════════════════════════
  // valor_ideal
  // ═══════════════════════════════════════════════════════════
  describe("valor_ideal ausente/inválido → probs clamped, faixa reconstruída", () => {
    it("valor_ideal ausente + comparáveis presentes → probs em [3,98], PDF completo", async () => {
      const av = { score_liquidez: 70 };
      const met = derivarMetricas(baseImovel, av, compsValidos);
      assertInvariantes(met);
      // Sem valor_ideal (=0) vs comparáveis ~R$ 700k → delta = -100% →
      // ajusteDelta = +160 → clip em 98 (teto).
      expect(met.probRecom.d30).toBeLessThanOrEqual(98);
      expect(met.probRecom.d90).toBeLessThanOrEqual(98);
      const { texto, numPages } = await pdfTexto(baseImovel, av, compsValidos);
      expect(numPages).toBe(9);
      assertPdfSemLixo(texto);
    }, 30_000);

    it("valor_ideal como string ('abc') é tratado como 0 e não gera NaN", async () => {
      const av = { valor_ideal: "abc", score_liquidez: 60 };
      const met = derivarMetricas(baseImovel, av, compsValidos);
      assertInvariantes(met);
      expect(met.precoRecomendado).toBe(0);
      const { texto, numPages } = await pdfTexto(baseImovel, av, compsValidos);
      expect(numPages).toBe(9);
      assertPdfSemLixo(texto);
    }, 30_000);

    it("valor_ideal com faixa min/max ausentes → fallback -6%/+8% ao redor do preço", () => {
      const av = { valor_ideal: 1_000_000, score_liquidez: 55 };
      const met = derivarMetricas(baseImovel, av, compsValidos);
      assertInvariantes(met);
      expect(met.precoMinimo).toBe(Math.round(1_000_000 * 0.94));
      expect(met.precoMaximo).toBe(Math.round(1_000_000 * 1.08));
    });
  });

  // ═══════════════════════════════════════════════════════════
  // comparáveis
  // ═══════════════════════════════════════════════════════════
  describe("comparáveis ausentes/parciais → precoMercado e dias caem em fallback", () => {
    it("array vazio → precoMercado=precoRecomendado, diffPct=0, diasMedio=60", async () => {
      const av = { valor_ideal: 900_000, valor_minimo: 850_000, valor_maximo: 950_000, score_liquidez: 65 };
      const met = derivarMetricas(baseImovel, av, []);
      assertInvariantes(met);
      expect(met.precoMercado).toBe(met.precoRecomendado);
      expect(met.diffPct).toBe(0);
      expect(met.diasMedio).toBe(60);
      expect(met.diasMediano).toBe(60);
      const { texto, numPages } = await pdfTexto(baseImovel, av, []);
      expect(numPages).toBe(9);
      assertPdfSemLixo(texto);
    }, 30_000);

    it("comparáveis com preço 0/null/negativo → filtrados, cai no fallback", () => {
      const av = { valor_ideal: 500_000, score_liquidez: 50 };
      const compsSujos = [
        { preco: 0, dias_anuncio: 0 },
        { preco: null, dias_anuncio: null },
        { preco: -1000, dias_anuncio: "abc" },
        { preco: "não é número", dias_anuncio: undefined },
      ];
      const met = derivarMetricas(baseImovel, av, compsSujos as never);
      assertInvariantes(met);
      // median filtra <=0 → precoMercado cai no precoRecomendado
      expect(met.precoMercado).toBe(500_000);
      // nenhum dias válido → cai no fallback 60
      expect(met.diasMedio).toBe(60);
    });

    it("comparáveis com dias_anuncio válidos mas preços zerados → dias reais, preço fallback", () => {
      const av = { valor_ideal: 600_000, score_liquidez: 45 };
      const comps = [
        { preco: 0, dias_anuncio: 40 },
        { preco: 0, dias_anuncio: 70 },
        { preco: 0, dias_anuncio: 100 },
      ];
      const met = derivarMetricas(baseImovel, av, comps as never);
      assertInvariantes(met);
      expect(met.diasMedio).toBe(70); // (40+70+100)/3
      expect(met.diasMediano).toBe(70);
      expect(met.precoMercado).toBe(met.precoRecomendado); // preço fallback
    });
  });

  // ═══════════════════════════════════════════════════════════
  // pior cenário: TODOS os campos ausentes
  // ═══════════════════════════════════════════════════════════
  describe("cenário totalmente degradado", () => {
    it("avaliacao=null + comparáveis=[] → sem NaN, PDF de 9 páginas, texto limpo", async () => {
      const met = derivarMetricas(baseImovel, null, []);
      assertInvariantes(met);
      const { texto, numPages } = await pdfTexto(baseImovel, null, []);
      expect(numPages).toBe(9);
      assertPdfSemLixo(texto);
    }, 30_000);

    it("imovel sem preco + avaliacao=undefined → probPedido=null (sem crash) e resto clamped", async () => {
      const imv = { ...baseImovel, preco: undefined };
      const met = derivarMetricas(imv, undefined, compsValidos);
      assertInvariantes(met);
      expect(met.probPedido).toBeNull();
      const { texto, numPages } = await pdfTexto(imv, undefined, compsValidos);
      expect(numPages).toBe(9);
      assertPdfSemLixo(texto);
    }, 30_000);
  });

  // ═══════════════════════════════════════════════════════════
  // coerência tempoEstimadoDias
  // ═══════════════════════════════════════════════════════════
  describe("tempoEstimadoDias sempre finito e coerente com probs", () => {
    it("d30 já ≥ 75 → 30 dias", () => {
      // liquidez altíssima + preço 20% abaixo do mercado empurra d30 para 98
      const av = { valor_ideal: 500_000, score_liquidez: 95 };
      const comps = [{ preco: 700_000, dias_anuncio: 30 }];
      const met = derivarMetricas(baseImovel, av, comps);
      assertInvariantes(met);
      expect(met.probRecom.d30).toBeGreaterThanOrEqual(75);
      expect(met.tempoEstimadoDias).toBe(30);
    });

    it("d90 < 75 (cenário extremo) → cap em 120 dias, nunca Infinity/NaN", () => {
      // preço 60% ACIMA do mercado + liquidez mínima → probs colapsam
      const av = { valor_ideal: 1_600_000, score_liquidez: 15 };
      const comps = [
        { preco: 1_000_000, dias_anuncio: 200 },
        { preco: 1_050_000, dias_anuncio: 220 },
      ];
      const met = derivarMetricas(baseImovel, av, comps);
      assertInvariantes(met);
      expect(met.probRecom.d90).toBeLessThan(75);
      expect(met.tempoEstimadoDias).toBe(120);
    });
  });
});
