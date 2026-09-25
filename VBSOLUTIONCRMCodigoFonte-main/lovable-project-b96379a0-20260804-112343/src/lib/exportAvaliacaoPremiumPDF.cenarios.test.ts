import { describe, it, expect, vi, beforeEach } from "vitest";

// Wrap jsPDF para coletar TODO texto renderizado, por página.
// Mesma abordagem usada em exportAvaliacaoPremiumPDF.paginas.test.ts.
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

// ─────────────────────────────────────────────────────────────
// CONTRATO POR SEÇÃO
// Para cada uma das 9 páginas, declaramos:
//  - marcadores: strings que DEVEM aparecer na página
//  - camposObrigatorios: predicados que validam presença
//    de valor NÃO-vazio (ex.: preço formatado, %, bullets)
//  - foraDaPagina: strings/regex que NÃO podem vazar em outras páginas
// ─────────────────────────────────────────────────────────────

type Predicado = (textoDaPagina: string) => boolean;
type SecaoSpec = {
  n: number;
  nome: string;
  marcadores: string[];
  camposObrigatorios: Array<{ nome: string; check: Predicado }>;
};

// ── Predicados reutilizáveis ──────────────────────────────────
const temPrecoBRL: Predicado = (t) => /R\$\s*[\d\.]+/.test(t);
const temPercentual: Predicado = (t) => /\d{1,3}\s*%/.test(t);
const temNumero: Predicado = (t) => /\b\d+\b/.test(t);
const temAreaM2: Predicado = (t) => /\d+\s*m²/i.test(t);
const naoTemZerado: Predicado = (t) =>
  !/R\$\s*0(?!\d)/.test(t) && !/\b0\s*m²/.test(t) && !/(^|[^%\d])0\s*%/.test(t);
const naoTemPlaceholder: Predicado = (t) =>
  !/\b(undefined|null|NaN)\b/i.test(t) && !/\[object Object\]/.test(t);

// ── Especificação das 9 seções ────────────────────────────────
const secoes: SecaoSpec[] = [
  {
    n: 1,
    nome: "Resumo Executivo",
    marcadores: ["RESUMO EXECUTIVO", "VALOR RECOMENDADO PELA IA"],
    camposObrigatorios: [
      { nome: "endereço do imóvel", check: (t) => /\w+/.test(t) },
      { nome: "preço recomendado em R$", check: temPrecoBRL },
      { nome: "tempo estimado de venda", check: (t) => /TEMPO ESTIMADO|DIAS/i.test(t) },
    ],
  },
  {
    n: 2,
    nome: "Metodologia",
    marcadores: ["METODOLOGIA", "Como a IA chegou neste valor", "PESO DE CADA FATOR NA ANÁLISE"],
    camposObrigatorios: [
      { nome: "explicação textual", check: (t) => /inteligência artificial|cruzou dados/i.test(t) },
      { nome: "algum peso percentual", check: temPercentual },
    ],
  },
  {
    n: 3,
    nome: "Preço recomendado",
    marcadores: ["O NÚMERO", "Preço recomendado", "PARA VENDA MAIS RÁPIDA", "PARA MAIOR RETORNO"],
    camposObrigatorios: [
      { nome: "preço principal em R$", check: temPrecoBRL },
      { nome: "faixa mínima/máxima", check: (t) => (t.match(/R\$/g) || []).length >= 2 },
    ],
  },
  {
    n: 4,
    nome: "Probabilidade",
    marcadores: ["PROBABILIDADE", "Chance de vender no preço recomendado"],
    camposObrigatorios: [
      { nome: "janela 30 dias", check: (t) => /30\s*DIAS/i.test(t) },
      { nome: "janela 60 dias", check: (t) => /60\s*DIAS/i.test(t) },
      { nome: "janela 90 dias", check: (t) => /90\s*DIAS/i.test(t) },
      { nome: "percentuais de probabilidade", check: temPercentual },
    ],
  },
  {
    n: 5,
    nome: "Comparação de mercado",
    marcadores: ["MERCADO", "Como seu preço se compara à região", "PREÇOS COMPARADOS"],
    camposObrigatorios: [
      { nome: "preços em R$", check: temPrecoBRL },
      { nome: "ao menos 2 valores comparados", check: (t) => (t.match(/R\$/g) || []).length >= 2 },
    ],
  },
  {
    n: 6,
    nome: "Concorrência",
    marcadores: ["CONCORRÊNCIA", "Quem disputa a mesma venda"],
    camposObrigatorios: [
      { nome: "contagem de imóveis", check: temNumero },
    ],
  },
  {
    n: 7,
    nome: "Pontos positivos",
    marcadores: ["A FAVOR", "Pontos positivos do imóvel"],
    camposObrigatorios: [
      { nome: "ao menos um ponto forte", check: (t) => /[A-Za-zÀ-ú]{6,}/.test(t) },
    ],
  },
  {
    n: 8,
    nome: "Pontos de atenção",
    marcadores: ["ATENÇÃO", "Pontos que podem dificultar a venda"],
    camposObrigatorios: [
      { nome: "ao menos um ponto de atenção", check: (t) => /[A-Za-zÀ-ú]{6,}/.test(t) },
    ],
  },
  {
    n: 9,
    nome: "Conclusão",
    marcadores: ["CONCLUSÃO", "O que fazer com esta avaliação", "ÍNDICE DE CONFIANÇA DA IA"],
    camposObrigatorios: [
      { nome: "índice de confiança em %", check: temPercentual },
      { nome: "recap de preço", check: temPrecoBRL },
    ],
  },
];

// ── Cenários de imóveis distintos ─────────────────────────────
type Cenario = {
  nome: string;
  imovel: Record<string, unknown>;
  avaliacao: Record<string, unknown>;
  comparaveis: Array<Record<string, unknown>>;
};

const cenarios: Cenario[] = [
  {
    nome: "Apartamento urbano padrão (dados completos)",
    imovel: {
      tipo: "Apartamento",
      titulo: "Ap 302",
      endereco: "Rua das Flores, 123",
      bairro: "Asa Sul",
      cidade: "Brasília",
      estado: "DF",
      area: 90,
      preco: 850_000,
      fotos: [],
    },
    avaliacao: {
      valor_ideal: 820_000,
      valor_minimo: 780_000,
      valor_maximo: 880_000,
      preco_m2_estimado: 9100,
      score_liquidez: 70,
      preco_competitivo: true,
      rating_ia: 8.4,
      pontos_fortes: ["Localização privilegiada", "Área bem distribuída", "Padrão construtivo alto"],
      pontos_atencao: ["Preço inicial acima do teto do mercado", "Fotos escuras"],
      estrategia: "Anunciar dentro da faixa recomendada.",
    },
    comparaveis: Array.from({ length: 6 }, (_, i) => ({
      titulo: `Comparável ${i + 1}`,
      area: 88 + i,
      preco: 800_000 + i * 5_000,
      dias_anuncio: 20 + i * 15,
    })),
  },
  {
    nome: "Casa alto padrão (valores altos, poucos comparáveis)",
    imovel: {
      tipo: "Casa",
      titulo: "Casa em condomínio",
      endereco: "Alameda dos Ipês, 55",
      bairro: "Lago Sul",
      cidade: "Brasília",
      estado: "DF",
      area: 480,
      preco: 4_800_000,
      fotos: [],
    },
    avaliacao: {
      valor_ideal: 4_500_000,
      valor_minimo: 4_200_000,
      valor_maximo: 4_900_000,
      preco_m2_estimado: 9_400,
      score_liquidez: 45,
      preco_competitivo: false,
      rating_ia: 7.9,
      pontos_fortes: ["Terreno amplo", "Piscina aquecida", "Automação completa"],
      pontos_atencao: ["Ticket alto restringe público", "Manutenção elevada"],
      estrategia: "Trabalhar com corretores de alto padrão.",
    },
    comparaveis: [
      { titulo: "Casa A", area: 450, preco: 4_600_000, dias_anuncio: 90 },
      { titulo: "Casa B", area: 500, preco: 5_000_000, dias_anuncio: 150 },
    ],
  },
  {
    nome: "Imóvel comercial (uso misto, valores intermediários)",
    imovel: {
      tipo: "Sala comercial",
      titulo: "Sala corporativa",
      endereco: "SCS Quadra 2, Edifício X",
      bairro: "Setor Comercial Sul",
      cidade: "Brasília",
      estado: "DF",
      area: 55,
      preco: 620_000,
      fotos: [],
    },
    avaliacao: {
      valor_ideal: 600_000,
      valor_minimo: 570_000,
      valor_maximo: 640_000,
      preco_m2_estimado: 10_900,
      score_liquidez: 55,
      preco_competitivo: true,
      rating_ia: 8.1,
      pontos_fortes: ["Localização corporativa", "Andar alto com vista"],
      pontos_atencao: ["Condomínio elevado"],
      estrategia: "Focar em investidor buscando renda.",
    },
    comparaveis: [
      { titulo: "Sala A", area: 52, preco: 580_000, dias_anuncio: 60 },
      { titulo: "Sala B", area: 58, preco: 630_000, dias_anuncio: 75 },
      { titulo: "Sala C", area: 60, preco: 650_000, dias_anuncio: 40 },
    ],
  },
  {
    nome: "Studio compacto (valores baixos, muitos comparáveis)",
    imovel: {
      tipo: "Studio",
      titulo: "Studio Vila Olímpia",
      endereco: "Rua Nova, 900",
      bairro: "Vila Olímpia",
      cidade: "São Paulo",
      estado: "SP",
      area: 28,
      preco: 380_000,
      fotos: [],
    },
    avaliacao: {
      valor_ideal: 365_000,
      valor_minimo: 345_000,
      valor_maximo: 385_000,
      preco_m2_estimado: 13_000,
      score_liquidez: 82,
      preco_competitivo: true,
      rating_ia: 8.8,
      pontos_fortes: ["Alta liquidez", "Metrô a 200m", "Bem mobiliado"],
      pontos_atencao: ["Área reduzida limita público"],
      estrategia: "Anunciar já no valor ideal.",
    },
    comparaveis: Array.from({ length: 10 }, (_, i) => ({
      titulo: `Studio ${i + 1}`,
      area: 26 + (i % 4),
      preco: 340_000 + i * 6_000,
      dias_anuncio: 10 + i * 5,
    })),
  },
];

// ── Helpers ────────────────────────────────────────────────────
function textoDaPagina(n: number): string {
  return _collected
    .filter((c) => c.page === n)
    .map((c) => c.text)
    .join("\n");
}
function paginasComTexto(marcador: string): number[] {
  return [...new Set(_collected.filter((c) => c.text.includes(marcador)).map((c) => c.page))];
}

async function build(c: Cenario) {
  _collected.length = 0;
  await exportAvaliacaoPremiumPDF({
    imovel: c.imovel as never,
    avaliacao: c.avaliacao as never,
    comparaveis: c.comparaveis as never,
    brandName: "TestBrand",
    corretorInfo: { nome: "Corretor Teste", creci: "0000" },
    skipSave: true,
  });
}

// ── Testes ─────────────────────────────────────────────────────
describe("PDF Premium — cenários de imóveis × contrato por seção", () => {
  beforeEach(() => {
    _collected.length = 0;
  });

  describe.each(cenarios)("cenário: $nome", (cenario) => {
    it("gera exatamente 9 páginas", async () => {
      await build(cenario);
      const paginas = [...new Set(_collected.map((c) => c.page))].sort((a, b) => a - b);
      expect(paginas).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });

    it.each(secoes)(
      "página $n ($nome): contém todos os marcadores da sua pergunta",
      async ({ n, marcadores }) => {
        await build(cenario);
        const txt = textoDaPagina(n);
        for (const m of marcadores) {
          expect(txt, `p.${n} deve conter marcador "${m}"`).toContain(m);
        }
      },
    );

    it.each(secoes)(
      "página $n ($nome): todos os campos obrigatórios preenchidos (não vazios)",
      async ({ n, camposObrigatorios }) => {
        await build(cenario);
        const txt = textoDaPagina(n);
        for (const c of camposObrigatorios) {
          expect(
            c.check(txt),
            `p.${n}: campo obrigatório "${c.nome}" ausente ou vazio`,
          ).toBe(true);
        }
        // Nenhum placeholder / valor "zerado" fantasma
        expect(naoTemPlaceholder(txt), `p.${n}: contém placeholder (undefined/null/NaN/[object])`).toBe(true);
        expect(naoTemZerado(txt), `p.${n}: contém valor "zerado" suspeito (R$ 0 / 0 m² / 0%)`).toBe(true);
      },
    );

    it.each(secoes)(
      "página $n ($nome): marcadores exclusivos NÃO aparecem em outras páginas",
      async ({ n, marcadores }) => {
        await build(cenario);
        // Frases longas (>=20 chars) são únicas por seção.
        const exclusivos = marcadores.filter((m) => m.length >= 20);
        for (const m of exclusivos) {
          expect(paginasComTexto(m), `"${m}" só pode existir na p.${n}`).toEqual([n]);
        }
      },
    );

    it("kickers de topo aparecem cada um em uma única página", async () => {
      await build(cenario);
      const kickers: Array<[string, number]> = [
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
      for (const [kicker, page] of kickers) {
        const hits = _collected.filter((c) => c.text === kicker);
        expect(hits.length, `kicker "${kicker}" deve renderizar ao menos 1x`).toBeGreaterThanOrEqual(1);
        hits.forEach((h) =>
          expect(h.page, `kicker "${kicker}" só pode estar na p.${page}`).toBe(page),
        );
      }
    });

    it("nenhum título de seção é reutilizado em outra seção", async () => {
      await build(cenario);
      // Cada frase longa de marcador pertence a exatamente 1 página em todos os cenários.
      const frases = secoes.flatMap((s) =>
        s.marcadores.filter((m) => m.length >= 20).map((m) => ({ frase: m, pagina: s.n })),
      );
      for (const { frase, pagina } of frases) {
        expect(paginasComTexto(frase), `frase "${frase}" fora da p.${pagina}`).toEqual([pagina]);
      }
    });
  });
});
