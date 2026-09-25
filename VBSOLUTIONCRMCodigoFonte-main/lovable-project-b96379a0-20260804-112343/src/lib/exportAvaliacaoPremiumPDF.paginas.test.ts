import { describe, it, expect, vi } from "vitest";

// Wrap jsPDF to intercept `text` on every instance BEFORE the module
// under test imports it. vi.mock is hoisted, so both this file and
// exportAvaliacaoPremiumPDF.ts receive the wrapped constructor.
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

// Import AFTER vi.mock so the mocked jspdf is applied.
const { exportAvaliacaoPremiumPDF } = await import("./exportAvaliacaoPremiumPDF");

/**
 * Valida que o Relatório Premium sempre sai com 9 páginas na ordem
 * correta e que cada seção contém apenas os campos definidos para
 * sua pergunta — sem repetição de títulos/subtítulos entre páginas.
 */

const imovelFixture = {
  tipo: "Apartamento",
  titulo: "Ap 302",
  endereco: "Rua das Flores, 123",
  bairro: "Asa Sul",
  cidade: "Brasília",
  estado: "DF",
  area: 90,
  preco: 850000,
  fotos: [],
};

const avaliacaoFixture = {
  valor_ideal: 820000,
  valor_minimo: 780000,
  valor_maximo: 880000,
  preco_m2_estimado: 9100,
  score_liquidez: 70,
  preco_competitivo: true,
  pontos_fortes: [
    "Localização privilegiada",
    "Área bem distribuída",
    "Padrão construtivo alto",
  ],
  pontos_atencao: [
    "Preço inicial acima do teto do mercado",
    "Fotos escuras ou com pouca definição",
  ],
  comparaveis_gerados: [],
};

const comparaveisFixture = Array.from({ length: 6 }, (_, i) => ({
  titulo: `Comparável ${i + 1}`,
  area: 88 + i,
  preco: 800000 + i * 5000,
  dias_anuncio: 20 + i * 15,
}));

async function build() {
  _collected.length = 0;
  const doc = await exportAvaliacaoPremiumPDF({
    imovel: imovelFixture,
    avaliacao: avaliacaoFixture,
    comparaveis: comparaveisFixture,
    brandName: "TestBrand",
    corretorInfo: { nome: "Corretor Teste", creci: "0000" },
    skipSave: true,
  });
  return doc;
}

// Marcadores exclusivos de cada página. Cada seção tem uma "pergunta"
// própria — os marcadores refletem esse recorte.
const paginas: Array<{ n: number; nome: string; marcadores: string[] }> = [
  { n: 1, nome: "Resumo Executivo",     marcadores: ["RESUMO EXECUTIVO", "VALOR RECOMENDADO PELA IA"] },
  { n: 2, nome: "Metodologia",          marcadores: ["METODOLOGIA", "Como a IA chegou neste valor", "PESO DE CADA FATOR NA ANÁLISE"] },
  { n: 3, nome: "Preço recomendado",    marcadores: ["O NÚMERO", "Preço recomendado", "PARA VENDA MAIS RÁPIDA", "PARA MAIOR RETORNO"] },
  { n: 4, nome: "Probabilidade",        marcadores: ["PROBABILIDADE", "Chance de vender no preço recomendado"] },
  { n: 5, nome: "Comparação de mercado",marcadores: ["MERCADO", "Como seu preço se compara à região", "PREÇOS COMPARADOS (R$)"] },
  { n: 6, nome: "Concorrência",         marcadores: ["CONCORRÊNCIA", "Quem disputa a mesma venda", "IMÓVEIS SEMELHANTES ANUNCIADOS"] },
  { n: 7, nome: "Pontos positivos",     marcadores: ["A FAVOR", "Pontos positivos do imóvel"] },
  { n: 8, nome: "Pontos de atenção",    marcadores: ["ATENÇÃO", "Pontos que podem dificultar a venda"] },
  { n: 9, nome: "Conclusão",            marcadores: ["CONCLUSÃO", "O que fazer com esta avaliação", "ÍNDICE DE CONFIANÇA DA IA"] },
];

describe("PDF Premium — estrutura de 9 páginas", () => {
  it("gera exatamente 9 páginas", async () => {
    const doc = await build();
    expect(doc.getNumberOfPages()).toBe(9);
  });

  it("emite texto em todas as 9 páginas, na ordem 1 → 9", async () => {
    await build();
    const pagesTouched = Array.from(new Set(_collected.map((c) => c.page))).sort(
      (a, b) => a - b,
    );
    expect(pagesTouched).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    // Monotonicidade: primeiro toque de cada página em ordem crescente
    const firstIdxByPage = new Map<number, number>();
    _collected.forEach((c, i) => {
      if (!firstIdxByPage.has(c.page)) firstIdxByPage.set(c.page, i);
    });
    for (let p = 1; p <= 8; p++) {
      expect(firstIdxByPage.get(p)!).toBeLessThan(firstIdxByPage.get(p + 1)!);
    }
  });

  describe.each(paginas)("página $n — $nome", ({ n, marcadores }) => {
    it("contém todos os marcadores da sua pergunta", async () => {
      await build();
      const textoDaPagina = _collected
        .filter((c) => c.page === n)
        .map((c) => c.text)
        .join("\n");
      for (const marcador of marcadores) {
        expect(
          textoDaPagina,
          `Página ${n} deve conter "${marcador}"`,
        ).toContain(marcador);
      }
    });

    it("não repete seus marcadores exclusivos em outras páginas", async () => {
      await build();
      // Marcadores longos são exclusivos de seção (frases inteiras).
      const exclusivos = marcadores.filter((m) => m.length >= 20);
      for (const marcador of exclusivos) {
        const paginasComMarcador = new Set(
          _collected.filter((c) => c.text.includes(marcador)).map((c) => c.page),
        );
        expect(
          [...paginasComMarcador],
          `"${marcador}" só pode existir na página ${n}`,
        ).toEqual([n]);
      }
    });
  });

  it("página 1 é a única com a tag RESUMO EXECUTIVO", async () => {
    await build();
    const paginasComTag = new Set(
      _collected.filter((c) => c.text.includes("RESUMO EXECUTIVO")).map((c) => c.page),
    );
    expect([...paginasComTag]).toEqual([1]);
  });

  it("página 9 é a única com o Índice de Confiança da IA", async () => {
    await build();
    const paginasComIndice = new Set(
      _collected
        .filter((c) => c.text.includes("ÍNDICE DE CONFIANÇA DA IA"))
        .map((c) => c.page),
    );
    expect([...paginasComIndice]).toEqual([9]);
  });

  it("kickers de pageTitle só aparecem na sua página", async () => {
    await build();
    // Todos os kickers passam por eyebrow → uppercase.
    const kickers: Array<[string, number]> = [
      ["METODOLOGIA", 2],
      ["O NÚMERO", 3],
      ["PROBABILIDADE", 4],
      ["MERCADO", 5],
      ["CONCORRÊNCIA", 6],
      ["A FAVOR", 7],
      ["ATENÇÃO", 8],
      ["CONCLUSÃO", 9],
    ];
    for (const [kicker, page] of kickers) {
      // Comparação exata (kicker é renderizado sozinho pelo eyebrow).
      const hits = _collected.filter((c) => c.text === kicker);
      expect(
        hits.length,
        `kicker "${kicker}" deve renderizar ao menos 1x`,
      ).toBeGreaterThanOrEqual(1);
      hits.forEach((h) =>
        expect(
          h.page,
          `kicker "${kicker}" só pode estar na página ${page}, achou na ${h.page}`,
        ).toBe(page),
      );
    }
  });

  it("o valor recomendado (preço) só é destacado nas páginas onde é a pergunta", async () => {
    // "VALOR RECOMENDADO PELA IA" só na página 1 (resumo executivo).
    // "VALOR RECOMENDADO" (sem "PELA IA") aparece na página 3 (o número)
    // e na 9 (conclusão) — as três seções que respondem preço.
    await build();
    const paginasResumo = new Set(
      _collected
        .filter((c) => c.text === "VALOR RECOMENDADO PELA IA")
        .map((c) => c.page),
    );
    expect([...paginasResumo]).toEqual([1]);

    const paginasNumero = new Set(
      _collected
        .filter((c) => c.text === "VALOR RECOMENDADO")
        .map((c) => c.page),
    );
    // Deve existir em pelo menos uma página, e apenas nas 3 permitidas.
    expect(paginasNumero.size).toBeGreaterThan(0);
    [...paginasNumero].forEach((p) => expect([3, 9]).toContain(p));
  });
});
