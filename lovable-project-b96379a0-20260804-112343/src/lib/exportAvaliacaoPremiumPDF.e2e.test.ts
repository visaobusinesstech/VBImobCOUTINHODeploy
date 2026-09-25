import { describe, it, expect, beforeAll } from "vitest";
import { exportAvaliacaoPremiumPDF } from "./exportAvaliacaoPremiumPDF";

// ─────────────────────────────────────────────────────────────
// TESTE E2E: gera o PDF Premium real, extrai o texto de cada
// página com pdfjs-dist e valida em ordem de leitura:
//   1. Nenhum "gráfico" (barras, cards KPI de probabilidade,
//      quadro de concorrência) aparece sem parágrafo de
//      contexto na MESMA página antes dele.
//   2. Sequência editorial: kicker → título → contexto →
//      gráfico/conteúdo em cada página, e páginas 1..9 na
//      ordem correta.
//
// Parte dos bytes finais do PDF (doc.output("arraybuffer")),
// portanto valida o artefato entregue ao usuário.
// ─────────────────────────────────────────────────────────────

type PageText = { page: number; reading: string };

async function parsePdfPages(bytes: Uint8Array): Promise<PageText[]> {
  const pdfjs = await import(
    /* @vite-ignore */ "pdfjs-dist/legacy/build/pdf.mjs" as string
  );
  (pdfjs as { GlobalWorkerOptions: { workerSrc: string } }).GlobalWorkerOptions.workerSrc =
    require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs");
  const loadingTask = (pdfjs as { getDocument: (o: unknown) => { promise: Promise<unknown> } }).getDocument({
    data: bytes,
    isEvalSupported: false,
    useSystemFonts: false,
  });
  const pdf = (await loadingTask.promise) as {
    numPages: number;
    getPage: (n: number) => Promise<{
      getTextContent: () => Promise<{ items: Array<{ str: string; transform: number[] }> }>;
    }>;
  };
  const out: PageText[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    // Ordena top-down (y decresce em pdfjs) e depois left-right.
    // Agrupamos por linha (mesma faixa de y) para reconstruir o
    // fluxo de leitura real do PDF.
    const items = content.items
      .filter((it) => typeof it.str === "string" && it.str.length > 0)
      .map((it) => ({ str: it.str, x: it.transform[4], y: it.transform[5] }));
    items.sort((a, b) => (b.y - a.y) || (a.x - b.x));
    // Junta em linhas quando y difere em < 1.5
    const lines: string[] = [];
    let currentY = Infinity;
    let buf: string[] = [];
    for (const it of items) {
      if (currentY - it.y > 1.5) {
        if (buf.length) lines.push(buf.join(" ").replace(/\s+/g, " ").trim());
        buf = [];
        currentY = it.y;
      }
      buf.push(it.str);
    }
    if (buf.length) lines.push(buf.join(" ").replace(/\s+/g, " ").trim());
    const reading = lines.filter(Boolean).join("\n");
    out.push({ page: p, reading });
  }
  return out;
}

const imovelBase = {
  tipo: "Apartamento",
  endereco: "Rua Teste, 100",
  bairro: "Centro",
  cidade: "Brasília",
  estado: "DF",
  area: 92,
  preco: 820_000,
  fotos: [],
};

const avaliacaoBase = {
  valor_ideal: 815_000,
  score_liquidez: 65,
  rating_ia: 8.4,
  pontos_fortes: ["Localização premium", "Reforma recente", "Vista privilegiada"],
  pontos_atencao: ["Preço acima do teto", "Fotos com pouca luz"],
  estrategia: "Anunciar dentro da faixa recomendada e reforçar diferenciais.",
};

const comparaveisBase = [
  { titulo: "Comp A", area: 90, preco: 800_000, dias_anuncio: 30 },
  { titulo: "Comp B", area: 92, preco: 815_000, dias_anuncio: 45 },
  { titulo: "Comp C", area: 88, preco: 830_000, dias_anuncio: 60 },
];

let pages: PageText[];

beforeAll(async () => {
  const doc = await exportAvaliacaoPremiumPDF({
    imovel: imovelBase,
    avaliacao: avaliacaoBase,
    comparaveis: comparaveisBase,
    brandName: "TestBrand",
    corretorInfo: { nome: "Corretor Teste" },
    skipSave: true,
  });
  const ab = doc.output("arraybuffer") as ArrayBuffer;
  pages = await parsePdfPages(new Uint8Array(ab));
}, 60_000);

// ── posição de regex no fluxo de leitura da página ─────────
const idxOf = (reading: string, rx: RegExp): number => {
  const m = reading.match(rx);
  return m?.index ?? -1;
};

// ── Especificação editorial (baseada no código fonte) ──────
type Spec = {
  page: number;
  kicker: RegExp;
  title: RegExp;
  context: RegExp;
  chart?: { rx: RegExp; label: string };
};

const editorial: Spec[] = [
  {
    page: 1,
    kicker: /RESUMO EXECUTIVO/,
    title: /Rua Teste/i, // endereço grande na capa
    context: /VALOR RECOMENDADO PELA IA/,
    chart: { rx: /TEMPO ESTIMADO DE VENDA/, label: "KPI de tempo" },
  },
  {
    page: 2,
    kicker: /METODOLOGIA/,
    title: /Como a IA chegou neste valor/i,
    context: /a inteligência artificial cruzou dados/i,
    chart: { rx: /Peso de cada fator/i, label: "gráfico de pesos" },
  },
  {
    page: 3,
    kicker: /O NÚMERO/,
    title: /Preço recomendado/i,
    context: /Este é o valor sugerido pela IA/i,
  },
  {
    page: 4,
    kicker: /PROBABILIDADE/,
    title: /Chance de vender no preço recomendado/i,
    context: /Se o imóvel for anunciado por/i,
    chart: { rx: /ATÉ\s*30\s*DIAS/i, label: "cards de probabilidade" },
  },
  {
    page: 5,
    kicker: /MERCADO/,
    title: /Como seu preço se compara à região/i,
    context: /A tabela abaixo posiciona/i,
    chart: { rx: /PREÇOS COMPARADOS/i, label: "gráfico de barras" },
  },
  {
    page: 6,
    kicker: /CONCORRÊNCIA/,
    title: /Quem disputa a mesma venda/i,
    context: /Encontramos\s+\d+\s+imóveis/i,
    chart: { rx: /IMÓVEIS SEMELHANTES/, label: "cards de concorrência" },
  },
  {
    page: 7,
    kicker: /A FAVOR/,
    title: /Pontos positivos do imóvel/i,
    context: /aumentam o valor percebido/i,
  },
  {
    page: 8,
    kicker: /ATENÇÃO/,
    title: /Pontos que podem dificultar a venda/i,
    context: /sugestão prática/i,
  },
  {
    page: 9,
    kicker: /CONCLUSÃO/,
    title: /O que fazer com esta avaliação/i,
    context: /Reunindo tudo o que foi analisado/i,
    chart: { rx: /ÍNDICE DE CONFIANÇA DA IA/i, label: "índice de confiança" },
  },
];

describe("E2E PDF Premium — parse do artefato final", () => {
  it("gera exatamente 9 páginas na ordem 1 → 9", () => {
    expect(pages.length).toBe(9);
    pages.forEach((p, i) => expect(p.page).toBe(i + 1));
  });

  it.each(editorial)(
    "página $page: sequência kicker → título → contexto (elementos em ordem)",
    (spec) => {
      const p = pages[spec.page - 1];
      const iK = idxOf(p.reading, spec.kicker);
      const iT = idxOf(p.reading, spec.title);
      const iC = idxOf(p.reading, spec.context);

      expect(iK, `kicker ${spec.kicker} ausente na p.${spec.page}`).toBeGreaterThanOrEqual(0);
      expect(iT, `título ${spec.title} ausente na p.${spec.page}`).toBeGreaterThanOrEqual(0);
      expect(iC, `contexto ${spec.context} ausente na p.${spec.page}`).toBeGreaterThanOrEqual(0);

      // Ordem visual (top-down)
      expect(iK, `kicker depois do título na p.${spec.page}`).toBeLessThan(iT);
      expect(iT, `título depois do contexto na p.${spec.page}`).toBeLessThan(iC);
    },
  );

  it.each(editorial.filter((e) => e.chart))(
    "página $page: gráfico ($chart.label) não aparece sem contexto textual imediatamente anterior",
    (spec) => {
      const p = pages[spec.page - 1];
      const iCtx = idxOf(p.reading, spec.context);
      const iChart = idxOf(p.reading, spec.chart!.rx);

      expect(iChart, `marcador de gráfico ${spec.chart!.rx} ausente na p.${spec.page}`).toBeGreaterThanOrEqual(0);
      expect(iCtx, `contexto ausente na p.${spec.page}`).toBeGreaterThanOrEqual(0);

      // Contexto SEMPRE antes do gráfico na ordem de leitura
      expect(
        iCtx,
        `p.${spec.page}: gráfico "${spec.chart!.label}" aparece antes do contexto explicativo`,
      ).toBeLessThan(iChart);

      // E deve haver corpo mínimo entre título e gráfico: nunca
      // pulamos direto do heading para uma visualização.
      const iTitle = idxOf(p.reading, spec.title);
      const gap = p.reading.slice(iTitle, iChart);
      const alfa = (gap.match(/[A-Za-zÀ-ú]/g) || []).length;
      expect(
        alfa,
        `p.${spec.page}: menos de 40 caracteres de texto entre título e gráfico "${spec.chart!.label}"`,
      ).toBeGreaterThanOrEqual(40);
    },
  );

  it("sequência das 9 páginas segue a ordem editorial esperada", () => {
    for (const spec of editorial) {
      const p = pages[spec.page - 1];
      expect(
        idxOf(p.reading, spec.kicker),
        `kicker ${spec.kicker} não encontrado na página ${spec.page}`,
      ).toBeGreaterThanOrEqual(0);
    }
  });

  it("kickers exclusivos não vazam entre páginas (sem elementos fora de ordem)", () => {
    // Kickers com texto único no relatório inteiro — se um deles
    // aparecesse em outra página, seria página fora de ordem.
    const exclusivos: Array<{ page: number; rx: RegExp }> = [
      { page: 1, rx: /RESUMO EXECUTIVO/ },
      { page: 2, rx: /METODOLOGIA/ },
      { page: 3, rx: /O NÚMERO/ },
      { page: 4, rx: /PROBABILIDADE/ },
      { page: 5, rx: /PREÇOS COMPARADOS/ },
      { page: 6, rx: /IMÓVEIS SEMELHANTES/ },
      { page: 9, rx: /ÍNDICE DE CONFIANÇA DA IA/ },
    ];
    for (const { page, rx } of exclusivos) {
      for (const p of pages) {
        const match = rx.test(p.reading);
        if (p.page === page) {
          expect(match, `esperado ${rx} na p.${page}`).toBe(true);
        } else {
          expect(match, `${rx} vazou para a p.${p.page}`).toBe(false);
        }
      }
    }
  });
});
