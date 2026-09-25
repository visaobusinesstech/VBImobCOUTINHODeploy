import { describe, it, expect, vi } from "vitest";

// Wrap jsPDF para interceptar text() capturando o tamanho de fonte
// vigente no momento da renderização. Assim conseguimos afirmar
// visualmente (por hierarquia tipográfica) que o preço recomendado
// é o maior elemento do relatório.

type Cap = { page: number; text: string; size: number };
const _cap: Cap[] = [];

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
        _cap.push({ page, text: flat, size: currentSize });
      } catch {
        /* noop */
      }
      return origText(...tArgs);
    };
    return inst;
  } as unknown as typeof Original;

  return { ...actual, default: Wrapped };
});

const { exportAvaliacaoPremiumPDF } = await import("./exportAvaliacaoPremiumPDF");

// ─── Fixtures ────────────────────────────────────────────
const baseImovel = {
  tipo: "Apartamento",
  endereco: "Rua das Flores, 123",
  bairro: "Asa Sul",
  cidade: "Brasília",
  estado: "DF",
  area: 90,
  fotos: [],
};

const baseComparaveis = Array.from({ length: 6 }, (_, i) => ({
  titulo: `Comparável ${i + 1}`,
  area: 88 + i,
  preco: 800000 + i * 5000,
  dias_anuncio: 20 + i * 15,
}));

// diffPct depende do preco_mercado (mediana dos comparáveis) vs valor_ideal.
// Mediana da série 800k, 805k, 810k, 815k, 820k, 825k = 812500.
// Para forçar competitivo: valor_ideal próximo a 812500 (±4%).
// Para forçar inteligente: valor_ideal bem acima (ex: +15%).
const cenarios = {
  competitivo: {
    imovel: { ...baseImovel, preco: 815000 },
    avaliacao: {
      valor_ideal: 815000,          // ~ +0.3% vs mediana → competitivo
      valor_minimo: 780000,
      valor_maximo: 850000,
      score_liquidez: 70,
      preco_competitivo: true,
      pontos_fortes: ["Localização"],
      pontos_atencao: ["Fotos escuras"],
      comparaveis_gerados: [],
    },
  },
  inteligente: {
    imovel: { ...baseImovel, preco: 960000 },
    avaliacao: {
      valor_ideal: 960000,          // ~ +18% vs mediana → inteligente
      valor_minimo: 900000,
      valor_maximo: 1020000,
      score_liquidez: 55,
      preco_competitivo: false,
      pontos_fortes: ["Padrão elevado"],
      pontos_atencao: ["Preço acima da média"],
      comparaveis_gerados: [],
    },
  },
};

async function build(kind: "competitivo" | "inteligente") {
  _cap.length = 0;
  const c = cenarios[kind];
  await exportAvaliacaoPremiumPDF({
    imovel: c.imovel,
    avaliacao: c.avaliacao,
    comparaveis: baseComparaveis,
    brandName: "TestBrand",
    corretorInfo: { nome: "Corretor Teste" },
    skipSave: true,
  });
}

// Detector: o preço recomendado é renderizado como uma string BRL.
// Regex reconhece "R$ 815.000" com espaço não-quebrável (\u00A0) ou normal.
const brlRegex = /^R\$[\s\u00A0][\d.]+$/;

describe("PDF Premium — hierarquia visual e selos", () => {
  describe("Hierarquia tipográfica: preço recomendado domina", () => {
    it("competitivo — preço recomendado usa a maior fonte de texto do relatório", async () => {
      await build("competitivo");

      // Descobre o maior fontSize de qualquer texto renderizado.
      const maxSize = _cap.reduce((m, c) => Math.max(m, c.size), 0);
      // O texto com a maior fonte deve ser um valor em R$ (o preço).
      const maiores = _cap.filter((c) => c.size === maxSize);
      expect(maiores.length).toBeGreaterThan(0);
      maiores.forEach((m) => {
        expect(
          brlRegex.test(m.text),
          `Maior elemento (${m.size}pt) deveria ser um preço em R$, mas foi "${m.text}"`,
        ).toBe(true);
      });

      // E esse pico deve estar na página 3 (a página "Preço recomendado"),
      // que é onde o número é o herói do layout.
      maiores.forEach((m) =>
        expect(
          m.page,
          `Maior preço está na página ${m.page}, esperado na 3 (Preço recomendado)`,
        ).toBe(3),
      );

      // O maior valor deve ser exatamente o valor_ideal (R$ 815.000).
      expect(maiores[0].text.replace(/\D/g, "")).toBe("815000");
    });

    it("inteligente — mesma regra: o número mais destacado é o preço recomendado", async () => {
      await build("inteligente");

      const maxSize = _cap.reduce((m, c) => Math.max(m, c.size), 0);
      const maiores = _cap.filter((c) => c.size === maxSize);
      expect(maiores.length).toBeGreaterThan(0);
      maiores.forEach((m) => expect(brlRegex.test(m.text)).toBe(true));
      maiores.forEach((m) => expect(m.page).toBe(3));
      expect(maiores[0].text.replace(/\D/g, "")).toBe("960000");
    });

    it("o preço herói é significativamente maior que o corpo de texto (>2x)", async () => {
      await build("competitivo");
      const maxSize = _cap.reduce((m, c) => Math.max(m, c.size), 0);
      // Corpo de texto típico: parágrafos e legendas usam ~7-10pt.
      // A média dos textos que não são o herói deve ser bem menor.
      const naoHeroi = _cap.filter((c) => c.size < maxSize);
      const media =
        naoHeroi.reduce((s, c) => s + c.size, 0) / Math.max(1, naoHeroi.length);
      expect(maxSize / media).toBeGreaterThan(2);
    });

    it("o preço da página 1 (resumo) está entre os 3 maiores destaques do relatório", async () => {
      await build("competitivo");
      // Coleta tamanhos únicos em ordem decrescente.
      const tamanhos = [...new Set(_cap.map((c) => c.size))].sort((a, b) => b - a);
      const topTres = new Set(tamanhos.slice(0, 3));
      // O preço em R$ da página 1 (hero do resumo executivo, 34pt) precisa
      // estar entre os três elementos tipograficamente mais destacados.
      const precoP1 = _cap.find(
        (c) => c.page === 1 && brlRegex.test(c.text) && topTres.has(c.size),
      );
      expect(
        precoP1,
        `Preço da página 1 não está entre os 3 maiores tamanhos (${[...topTres].join(", ")})`,
      ).toBeDefined();
    });
  });

  describe("Selos de competitividade", () => {
    it("cenário competitivo → renderiza 'COMPETITIVO' e nunca 'INTELIGENTE'", async () => {
      await build("competitivo");
      const textos = _cap.map((c) => c.text);
      expect(textos).toContain("COMPETITIVO");
      expect(textos).not.toContain("INTELIGENTE");
    });

    it("cenário inteligente → renderiza 'INTELIGENTE' e nunca 'COMPETITIVO'", async () => {
      await build("inteligente");
      const textos = _cap.map((c) => c.text);
      expect(textos).toContain("INTELIGENTE");
      expect(textos).not.toContain("COMPETITIVO");
    });

    it("o selo sempre aparece nas páginas 1 (resumo) e 3 (preço)", async () => {
      await build("competitivo");
      const paginasDoSelo = new Set(
        _cap
          .filter((c) => c.text === "COMPETITIVO" || c.text === "PREÇO COMPETITIVO")
          .map((c) => c.page),
      );
      // Página 1 usa "COMPETITIVO" (linha 2 do selo).
      // Página 3 usa "PREÇO COMPETITIVO" (selo lateral do bloco herói).
      expect(paginasDoSelo.has(1)).toBe(true);
      expect(paginasDoSelo.has(3)).toBe(true);
    });

    it("o selo é acompanhado da variação percentual vs. mercado", async () => {
      await build("inteligente");
      // Ex: "+18.2% vs mercado" — o número exato depende dos comparáveis,
      // mas o sufixo "% vs mercado" é fixo e deve existir.
      const temPct = _cap.some((c) => /%\s+vs\s+mercado/i.test(c.text));
      expect(temPct).toBe(true);
    });

    it("no cenário competitivo o rótulo 'PREÇO COMPETITIVO' aparece na página 3", async () => {
      await build("competitivo");
      const hits = _cap.filter((c) => c.text === "PREÇO COMPETITIVO");
      expect(hits.length).toBeGreaterThan(0);
      hits.forEach((h) => expect(h.page).toBe(3));
    });

    it("no cenário inteligente o rótulo 'PREÇO INTELIGENTE' aparece na página 3", async () => {
      await build("inteligente");
      const hits = _cap.filter((c) => c.text === "PREÇO INTELIGENTE");
      expect(hits.length).toBeGreaterThan(0);
      hits.forEach((h) => expect(h.page).toBe(3));
    });
  });

  describe("Snapshot de hierarquia (regressão visual)", () => {
    it("assinatura tipográfica das páginas 1, 3 e 9 é estável", async () => {
      await build("competitivo");
      // Para cada página herói (1, 3, 9), guardamos o tamanho máximo
      // e o texto que o carrega. Se o layout mudar de forma a
      // aumentar/diminuir o herói de preço, este snapshot quebra.
      const assinatura = [1, 3, 9].map((page) => {
        const desta = _cap.filter((c) => c.page === page);
        const max = desta.reduce((m, c) => Math.max(m, c.size), 0);
        const heroi = desta.find((c) => c.size === max)!;
        return {
          page,
          maxSize: max,
          heroIsPrice: brlRegex.test(heroi.text),
        };
      });
      expect(assinatura).toMatchInlineSnapshot(`
        [
          {
            "heroIsPrice": true,
            "maxSize": 34,
            "page": 1,
          },
          {
            "heroIsPrice": true,
            "maxSize": 52,
            "page": 3,
          },
          {
            "heroIsPrice": true,
            "maxSize": 30,
            "page": 9,
          },
        ]
      `);
    });
  });
});
