import { describe, it, expect, vi, beforeEach } from "vitest";

// Coleta todo texto renderizado (com página) — mesma técnica dos outros testes.
const _collected: Array<{ page: number; text: string }> = [];

vi.mock("jspdf", async (importOriginal) => {
  const actual = await importOriginal<typeof import("jspdf")>();
  const Original = actual.default;
  const Wrapped = function (this: unknown, ...args: unknown[]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inst = new (Original as any)(...args);
    const originalText = inst.text.bind(inst);
    inst.text = function patched(...tArgs: unknown[]) {
      try {
        const page = inst.internal.getCurrentPageInfo().pageNumber as number;
        const arg0 = tArgs[0];
        const flat = Array.isArray(arg0) ? arg0.join(" ") : String(arg0 ?? "");
        _collected.push({ page, text: flat });
      } catch {
        /* ignore */
      }
      return originalText(...tArgs);
    };
    return inst;
  } as unknown as typeof Original;
  return { ...actual, default: Wrapped };
});

const { exportAvaliacaoPremiumPDF, derivarMetricas } = await import("./exportAvaliacaoPremiumPDF");

// ─────────────────────────────────────────────────────────────
// REGRA DE SELO (lida diretamente do código-fonte):
//   competitivo = Math.abs(diffPct) <= 4   → "PREÇO COMPETITIVO"
//   caso contrário                          → "PREÇO INTELIGENTE"
//
// diffPct = ((precoRecomendado - precoMercado) / precoMercado) * 100
// precoMercado = mediana(comparaveis.preco)
//
// Fixamos precoMercado = 1_000_000 (via 1 comparável) e variamos
// valor_ideal para atingir exatamente as fronteiras.
// ─────────────────────────────────────────────────────────────

const PRECO_MERCADO = 1_000_000;

type Caso = {
  nome: string;
  valor_ideal: number;
  diffPctEsperado: number;
  seloEsperado: "COMPETITIVO" | "INTELIGENTE";
};

const casos: Caso[] = [
  { nome: "exatamente igual ao mercado (0%)",           valor_ideal: 1_000_000, diffPctEsperado: 0,     seloEsperado: "COMPETITIVO" },
  { nome: "abaixo do mercado dentro da faixa (-2%)",    valor_ideal:   980_000, diffPctEsperado: -2,    seloEsperado: "COMPETITIVO" },
  { nome: "acima do mercado dentro da faixa (+2%)",     valor_ideal: 1_020_000, diffPctEsperado: +2,    seloEsperado: "COMPETITIVO" },
  { nome: "fronteira inferior exata (-4%)",             valor_ideal:   960_000, diffPctEsperado: -4,    seloEsperado: "COMPETITIVO" },
  { nome: "fronteira superior exata (+4%)",             valor_ideal: 1_040_000, diffPctEsperado: +4,    seloEsperado: "COMPETITIVO" },
  { nome: "logo abaixo do piso (-4,01%)",               valor_ideal:   959_900, diffPctEsperado: -4.01, seloEsperado: "INTELIGENTE" },
  { nome: "logo acima do teto (+4,01%)",                valor_ideal: 1_040_100, diffPctEsperado: +4.01, seloEsperado: "INTELIGENTE" },
  { nome: "bem abaixo do mercado (-10%)",               valor_ideal:   900_000, diffPctEsperado: -10,   seloEsperado: "INTELIGENTE" },
  { nome: "bem acima do mercado (+10%)",                valor_ideal: 1_100_000, diffPctEsperado: +10,   seloEsperado: "INTELIGENTE" },
];

const baseImovel = {
  tipo: "Apartamento",
  titulo: "Ap teste",
  endereco: "Rua X, 1",
  bairro: "Centro",
  cidade: "Brasília",
  estado: "DF",
  area: 90,
  preco: 1_000_000,
  fotos: [] as unknown[],
};

function baseAvaliacao(valor_ideal: number) {
  return {
    valor_ideal,
    valor_minimo: Math.round(valor_ideal * 0.94),
    valor_maximo: Math.round(valor_ideal * 1.08),
    preco_m2_estimado: 10_000,
    score_liquidez: 70,
    preco_competitivo: true,
    rating_ia: 8,
    pontos_fortes: ["Localização", "Área"],
    pontos_atencao: ["Fotos"],
    estrategia: "Anunciar no ideal.",
  };
}

// Um único comparável ⇒ mediana = seu preço ⇒ precoMercado fixo.
const comparaveis = [{ titulo: "Comp único", area: 90, preco: PRECO_MERCADO, dias_anuncio: 45 }];

async function build(valor_ideal: number) {
  _collected.length = 0;
  await exportAvaliacaoPremiumPDF({
    imovel: baseImovel as never,
    avaliacao: baseAvaliacao(valor_ideal) as never,
    comparaveis: comparaveis as never,
    brandName: "TestBrand",
    corretorInfo: { nome: "Corretor", creci: "0" },
    skipSave: true,
  });
}

function textos(): string[] {
  return _collected.map((c) => c.text);
}

describe("PDF Premium — casos-limite de diffPct (selo de competitividade)", () => {
  beforeEach(() => {
    _collected.length = 0;
  });

  it("regra do selo: threshold = 4% (documentada em código)", () => {
    // Sanidade: derivarMetricas produz diffPct esperado nos limites exatos.
    const abaixo = derivarMetricas(baseImovel, baseAvaliacao(960_000), comparaveis);
    const acima = derivarMetricas(baseImovel, baseAvaliacao(1_040_000), comparaveis);
    expect(abaixo.diffPct).toBeCloseTo(-4, 6);
    expect(acima.diffPct).toBeCloseTo(+4, 6);
    expect(Math.abs(abaixo.diffPct) <= 4).toBe(true);
    expect(Math.abs(acima.diffPct) <= 4).toBe(true);
  });

  describe.each(casos)("caso: $nome", (c) => {
    it(`derivarMetricas retorna diffPct ≈ ${c.diffPctEsperado}%`, () => {
      const met = derivarMetricas(baseImovel, baseAvaliacao(c.valor_ideal), comparaveis);
      expect(met.diffPct).toBeCloseTo(c.diffPctEsperado, 2);
    });

    it(`renderiza selo "PREÇO ${c.seloEsperado}" e NÃO o outro`, async () => {
      await build(c.valor_ideal);
      const linhas = textos();
      const outroSelo = c.seloEsperado === "COMPETITIVO" ? "INTELIGENTE" : "COMPETITIVO";
      expect(
        linhas.includes(c.seloEsperado),
        `selo esperado "${c.seloEsperado}" ausente para diffPct=${c.diffPctEsperado}%`,
      ).toBe(true);
      expect(
        linhas.includes(outroSelo),
        `selo indevido "${outroSelo}" apareceu para diffPct=${c.diffPctEsperado}%`,
      ).toBe(false);
    });

    it("selo aparece exatamente 1 vez e apenas na capa (p.1)", async () => {
      await build(c.valor_ideal);
      const alvo = _collected.filter((x) => x.text === c.seloEsperado);
      expect(alvo.length, "selo deve renderizar 1x").toBe(1);
      expect(alvo[0].page, "selo deve estar na capa (p.1)").toBe(1);
    });

    it("texto '% vs mercado' na capa reflete o diffPct calculado", async () => {
      await build(c.valor_ideal);
      const capa = _collected.filter((x) => x.page === 1).map((x) => x.text);
      const esperado = `${c.diffPctEsperado >= 0 ? "+" : ""}${c.diffPctEsperado.toFixed(1)}% vs mercado`;
      // formatação com 1 casa decimal, com sinal explícito quando >= 0.
      expect(capa, `capa deve conter "${esperado}"`).toContain(esperado);
    });
  });

  it("função é monotônica em torno da fronteira: -4,01% e +4,01% caem em INTELIGENTE", async () => {
    await build(959_900);
    expect(textos()).toContain("INTELIGENTE");
    await build(1_040_100);
    expect(textos()).toContain("INTELIGENTE");
  });

  it("sem comparáveis: precoMercado cai em precoRecomendado ⇒ diffPct=0 ⇒ COMPETITIVO", async () => {
    _collected.length = 0;
    await exportAvaliacaoPremiumPDF({
      imovel: baseImovel as never,
      avaliacao: baseAvaliacao(750_000) as never,
      comparaveis: [] as never,
      brandName: "TestBrand",
      corretorInfo: { nome: "Corretor", creci: "0" },
      skipSave: true,
    });
    const met = derivarMetricas(baseImovel, baseAvaliacao(750_000), []);
    expect(met.diffPct).toBe(0);
    expect(textos()).toContain("COMPETITIVO");
    expect(textos()).not.toContain("INTELIGENTE");
  });
});
