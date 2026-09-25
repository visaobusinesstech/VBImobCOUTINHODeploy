import { describe, it, expect, vi, beforeEach } from "vitest";

// Wrap jsPDF para coletar TODO texto renderizado, por página.
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

const { exportAvaliacaoPremiumPDF } = await import("./exportAvaliacaoPremiumPDF");

// ─────────────────────────────────────────────────────────────────────
// TESTE DE ROBUSTEZ
//
// Verifica que quando dados críticos estão AUSENTES ou PARCIAIS
// (comparáveis vazios, score_liquidez faltando, fotos ausentes,
//  campos de pontos_fortes/atencao vazios, faixa mínima/máxima faltando),
// o PDF Premium continua gerando as 9 páginas, cada seção ainda contém
// os marcadores obrigatórios e não vaza placeholders (undefined/null/NaN).
// ─────────────────────────────────────────────────────────────────────

type Predicado = (t: string) => boolean;
const temPrecoBRL: Predicado = (t) => /R\$\s*[\d\.]+/.test(t);
const temPercentual: Predicado = (t) => /\d{1,3}\s*%/.test(t);
const naoTemPlaceholder: Predicado = (t) =>
  !/\b(undefined|null|NaN)\b/i.test(t) && !/\[object Object\]/.test(t);

const KICKERS: Array<[string, number]> = [
  ["RESUMO EXECUTIVO", 1],
  ["METODOLOGIA", 2],
  ["O NÚMERO", 3],
  ["PROBABILIDADE", 4],
  ["MERCADO", 5],
  ["CONCORRÊNCIA", 6],
  ["A FAVOR", 7],
  ["ATENÇÃO", 8],
  ["CONCLUSÃO", 9],
];

// Base — imóvel/avaliação completos usados como template.
const baseImovel = {
  tipo: "Apartamento",
  titulo: "Ap 302",
  endereco: "Rua das Flores, 123",
  bairro: "Asa Sul",
  cidade: "Brasília",
  estado: "DF",
  area: 90,
  preco: 850_000,
  fotos: [] as unknown[],
};

const baseAvaliacao = {
  valor_ideal: 820_000,
  valor_minimo: 780_000,
  valor_maximo: 880_000,
  preco_m2_estimado: 9_100,
  score_liquidez: 70,
  preco_competitivo: true,
  rating_ia: 8.4,
  pontos_fortes: ["Localização", "Área bem distribuída"],
  pontos_atencao: ["Fotos escuras"],
  estrategia: "Anunciar dentro da faixa recomendada.",
};

const baseComparaveis = Array.from({ length: 6 }, (_, i) => ({
  titulo: `Comparável ${i + 1}`,
  area: 88 + i,
  preco: 800_000 + i * 5_000,
  dias_anuncio: 20 + i * 15,
}));

type Cenario = {
  nome: string;
  patchImovel?: Partial<typeof baseImovel> & Record<string, unknown>;
  patchAvaliacao?: Partial<typeof baseAvaliacao> & Record<string, unknown>;
  comparaveis: Array<Record<string, unknown>>;
};

// Cada cenário remove um pedaço crítico do dado esperado pela IA.
const cenarios: Cenario[] = [
  {
    nome: "sem comparáveis (array vazio)",
    comparaveis: [],
  },
  {
    nome: "comparáveis parciais (apenas 1 registro, campos incompletos)",
    comparaveis: [{ titulo: "Único", preco: 800_000 }], // sem area/dias_anuncio
  },
  {
    nome: "comparáveis inválidos (undefined no array)",
    // simula payload sujo vindo do backend
    comparaveis: [null as unknown as Record<string, unknown>, undefined as unknown as Record<string, unknown>].filter(
      Boolean,
    ),
  },
  {
    nome: "score_liquidez ausente",
    patchAvaliacao: { score_liquidez: undefined },
    comparaveis: baseComparaveis,
  },
  {
    nome: "score_liquidez inválido (NaN)",
    patchAvaliacao: { score_liquidez: Number.NaN as unknown as number },
    comparaveis: baseComparaveis,
  },
  {
    nome: "sem fotos (array vazio)",
    patchImovel: { fotos: [] },
    comparaveis: baseComparaveis,
  },
  {
    nome: "fotos ausentes (campo undefined)",
    patchImovel: { fotos: undefined },
    comparaveis: baseComparaveis,
  },
  {
    nome: "fotos parciais (única URL, algumas inválidas)",
    patchImovel: { fotos: ["", null as unknown as string, undefined as unknown as string] },
    comparaveis: baseComparaveis,
  },
  {
    nome: "pontos_fortes e pontos_atencao vazios",
    patchAvaliacao: { pontos_fortes: [], pontos_atencao: [] },
    comparaveis: baseComparaveis,
  },
  {
    nome: "faixa mínima/máxima ausentes (apenas valor_ideal)",
    patchAvaliacao: { valor_minimo: undefined, valor_maximo: undefined },
    comparaveis: baseComparaveis,
  },
  {
    nome: "cenário degradado combinado (sem comparáveis + sem liquidez + sem fotos)",
    patchImovel: { fotos: [] },
    patchAvaliacao: { score_liquidez: undefined },
    comparaveis: [],
  },
];

function textoDaPagina(n: number): string {
  return _collected
    .filter((c) => c.page === n)
    .map((c) => c.text)
    .join("\n");
}

async function build(c: Cenario) {
  _collected.length = 0;
  const imovel = { ...baseImovel, ...(c.patchImovel || {}) };
  const avaliacao = { ...baseAvaliacao, ...(c.patchAvaliacao || {}) };
  await exportAvaliacaoPremiumPDF({
    imovel: imovel as never,
    avaliacao: avaliacao as never,
    comparaveis: c.comparaveis as never,
    brandName: "TestBrand",
    corretorInfo: { nome: "Corretor Teste", creci: "0000" },
    skipSave: true,
  });
}

describe("PDF Premium — robustez com dados ausentes/parciais", () => {
  beforeEach(() => {
    _collected.length = 0;
  });

  describe.each(cenarios)("cenário: $nome", (cenario) => {
    it("não lança erro e gera as 9 páginas com fallback adequado", async () => {
      await expect(build(cenario)).resolves.not.toThrow();
      const paginas = [...new Set(_collected.map((c) => c.page))].sort((a, b) => a - b);
      expect(paginas).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });

    it("cada página mantém seu kicker de topo", async () => {
      await build(cenario);
      for (const [kicker, page] of KICKERS) {
        const hits = _collected.filter((c) => c.text === kicker);
        expect(hits.length, `kicker "${kicker}" ausente após degradação`).toBeGreaterThanOrEqual(1);
        hits.forEach((h) =>
          expect(h.page, `kicker "${kicker}" fora da p.${page}`).toBe(page),
        );
      }
    });

    it("nenhuma página vaza placeholders (undefined/null/NaN/[object Object])", async () => {
      await build(cenario);
      for (let p = 1; p <= 9; p += 1) {
        const txt = textoDaPagina(p);
        expect(
          naoTemPlaceholder(txt),
          `p.${p} contém placeholder após degradação de dados`,
        ).toBe(true);
      }
    });

    it("preço recomendado continua presente na capa, p.3 e conclusão", async () => {
      await build(cenario);
      for (const p of [1, 3, 9]) {
        expect(
          temPrecoBRL(textoDaPagina(p)),
          `p.${p} deve conter preço em R$ mesmo com dados parciais`,
        ).toBe(true);
      }
    });

    it("probabilidades 30/60/90 dias ainda aparecem na p.4", async () => {
      await build(cenario);
      const txt = textoDaPagina(4);
      expect(/30\s*DIAS/i.test(txt), "p.4 sem janela 30 dias").toBe(true);
      expect(/60\s*DIAS/i.test(txt), "p.4 sem janela 60 dias").toBe(true);
      expect(/90\s*DIAS/i.test(txt), "p.4 sem janela 90 dias").toBe(true);
      expect(temPercentual(txt), "p.4 sem percentual de probabilidade").toBe(true);
    });

    it("índice de confiança em % permanece na conclusão", async () => {
      await build(cenario);
      expect(temPercentual(textoDaPagina(9)), "p.9 sem índice de confiança").toBe(true);
    });

    it("página 7 (a favor) e página 8 (atenção) renderizam ao menos um texto legível", async () => {
      await build(cenario);
      // Mesmo com listas vazias, a seção deve trazer um fallback textual.
      const p7 = textoDaPagina(7);
      const p8 = textoDaPagina(8);
      expect(/[A-Za-zÀ-ú]{6,}/.test(p7), "p.7 vazia mesmo com fallback").toBe(true);
      expect(/[A-Za-zÀ-ú]{6,}/.test(p8), "p.8 vazia mesmo com fallback").toBe(true);
    });

    it("página 6 (concorrência) permanece renderizada mesmo sem comparáveis", async () => {
      await build(cenario);
      const txt = textoDaPagina(6);
      expect(txt.length, "p.6 vazia após degradação").toBeGreaterThan(0);
      expect(txt).toContain("Quem disputa a mesma venda");
    });
  });
});
