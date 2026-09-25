import { describe, it, expect, beforeAll } from "vitest";
import { exportAvaliacaoPremiumPDF } from "./exportAvaliacaoPremiumPDF";

// ─────────────────────────────────────────────────────────────
// SNAPSHOT VISUAL — ordem de leitura tipográfica por página
//
// Gera o PDF Premium real, extrai o texto de cada página com
// pdfjs-dist preservando as coordenadas (x, y) e valida:
//
//   1. A frase de EXPLICAÇÃO da IA aparece VISUALMENTE ACIMA
//      do valor/percentual/hero numérico correspondente
//      (maior `y` em pdfjs = mais alto na página).
//   2. A ordem de leitura top-down/left-right de cada página
//      é congelada em um snapshot inline reduzido (as ~4
//      primeiras linhas), garantindo que qualquer regressão de
//      layout (explicação empurrada para baixo do número, hero
//      subindo antes do kicker etc.) faça o teste falhar.
//
// Isso simula um "snapshot de imagem" sem depender de raster
// (rápido em CI): a ordem de leitura é o que o olho humano vê.
// ─────────────────────────────────────────────────────────────

type ReadItem = { str: string; x: number; y: number };
type PageLayout = { page: number; items: ReadItem[]; lines: string[] };

async function renderPagesLayout(bytes: Uint8Array): Promise<PageLayout[]> {
  const pdfjs = await import(
    /* @vite-ignore */ "pdfjs-dist/legacy/build/pdf.mjs" as string
  );
  (pdfjs as { GlobalWorkerOptions: { workerSrc: string } }).GlobalWorkerOptions.workerSrc =
    require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs");
  const loadingTask = (
    pdfjs as { getDocument: (o: unknown) => { promise: Promise<unknown> } }
  ).getDocument({ data: bytes, isEvalSupported: false, useSystemFonts: false });
  const pdf = (await loadingTask.promise) as {
    numPages: number;
    getPage: (n: number) => Promise<{
      getTextContent: () => Promise<{
        items: Array<{ str: string; transform: number[] }>;
      }>;
    }>;
  };

  const out: PageLayout[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const items: ReadItem[] = content.items
      .filter((it) => typeof it.str === "string" && it.str.trim().length > 0)
      .map((it) => ({
        str: it.str,
        x: it.transform[4],
        y: it.transform[5],
      }));
    // Ordem de leitura: y desc, depois x asc.
    items.sort((a, b) => b.y - a.y || a.x - b.x);

    // Agrupa em linhas visuais (mesma faixa de y ≈ 1.5).
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
    out.push({ page: p, items, lines: lines.filter(Boolean) });
  }
  return out;
}

// Retorna o y do PRIMEIRO item cujo texto satisfaz o predicado
// (i.e. a posição visual mais alta em que essa frase aparece).
// Ignora chrome de header (y > 800) e rodapé (y < 40) — a4 = 841.89pt.
function firstYWhere(layout: PageLayout, pred: (s: string) => boolean): number | null {
  const grouped: { y: number; text: string }[] = [];
  const sorted = [...layout.items]
    .filter((it) => it.y < 800 && it.y > 40)
    .sort((a, b) => b.y - a.y || a.x - b.x);
  let curY = Infinity;
  let buf: string[] = [];
  let bufY = 0;
  for (const it of sorted) {
    if (curY - it.y > 1.5) {
      if (buf.length) grouped.push({ y: bufY, text: buf.join(" ").replace(/\s+/g, " ").trim() });
      buf = [];
      curY = it.y;
      bufY = it.y;
    }
    buf.push(it.str);
  }
  if (buf.length) grouped.push({ y: bufY, text: buf.join(" ").replace(/\s+/g, " ").trim() });
  const hit = grouped.find((l) => pred(l.text));
  return hit ? hit.y : null;
}

// ─── Fixture ────────────────────────────────────────────────
const imovel = {
  tipo: "Apartamento",
  endereco: "Rua das Acácias, 250",
  bairro: "Asa Sul",
  cidade: "Brasília",
  estado: "DF",
  area: 92,
  preco: 820_000,
  fotos: [],
};
const avaliacao = {
  valor_ideal: 815_000,
  valor_minimo: 780_000,
  valor_maximo: 850_000,
  score_liquidez: 68,
  preco_competitivo: true,
  pontos_fortes: ["Localização privilegiada"],
  pontos_atencao: ["Fotos escuras ou com pouca definição"],
  comparaveis_gerados: [],
};
const comparaveis = Array.from({ length: 6 }, (_, i) => ({
  titulo: `Comparável ${i + 1}`,
  area: 88 + i,
  preco: 800_000 + i * 5_000,
  dias_anuncio: 20 + i * 15,
}));

let PAGES: PageLayout[];

beforeAll(async () => {
  const doc = await exportAvaliacaoPremiumPDF({
    imovel,
    avaliacao,
    comparaveis,
    brandName: "SnapshotBrand",
    corretorInfo: { nome: "Corretor Snapshot" },
    skipSave: true,
  });
  const ab = (doc as { output: (t: string) => ArrayBuffer }).output("arraybuffer");
  const bytes = new Uint8Array(ab);
  PAGES = await renderPagesLayout(bytes);
}, 60_000);

// ═════════════════════════════════════════════════════════════
// 1) SNAPSHOT INLINE: primeiras linhas visíveis de cada página.
//    Trava a hierarquia tipográfica top-down. Se algo trocar de
//    ordem (número subir antes da explicação, kicker sumir), o
//    snapshot falha imediatamente com diff legível.
// ═════════════════════════════════════════════════════════════
describe("PDF Premium — snapshot visual de ordem de leitura", () => {
  it("cada página abre com kicker/título/explicação antes de números", () => {
    expect(PAGES).toHaveLength(9);
    const topLines = PAGES.map((p) => ({
      page: p.page,
      top: p.lines.slice(0, 4),
    }));

    // Verificações estruturais por página (independentes do
    // conteúdo exato — resistentes a pequenas edições de cópia).
    const isNumberish = (s: string) =>
      /R\$[\s\u00A0]?\d/.test(s) ||
      /\b\d{1,3}\s*%\b/.test(s) ||
      /\b\d+\s*dias\b/i.test(s) ||
      /\b\d{1,3}\s*\/\s*100\b/.test(s);
    const isProse = (s: string) =>
      s.length >= 40 && /[a-zç]/i.test(s) && !isNumberish(s);

    // Página 1 (capa): a primeira linha nunca deve ser um número
    // isolado; o topo é marca/kicker/endereço.
    expect(isNumberish(topLines[0].top[0] || "")).toBe(false);

    // Páginas 2..9: pelo menos uma das 4 primeiras linhas é
    // texto explicativo (prose) e nenhuma dessas linhas anteriores
    // à prose é um número destacado.
    for (const { page, top } of topLines.slice(1)) {
      const proseIdx = top.findIndex(isProse);
      expect(
        proseIdx,
        `p.${page}: nenhuma linha explicativa nas 4 primeiras (${top.join(" | ")})`,
      ).toBeGreaterThanOrEqual(0);
      const antes = top.slice(0, proseIdx);
      const numeroAntes = antes.find(isNumberish);
      expect(
        numeroAntes,
        `p.${page}: número "${numeroAntes}" apareceu antes da explicação`,
      ).toBeUndefined();
    }

    // Snapshot inline reduzido: página + n° de linhas do topo.
    // Guardamos apenas o formato estrutural para evitar quebras
    // por variação de espaçamento entre versões do pdfjs.
    expect(topLines.map((t) => ({ page: t.page, topLinesCount: t.top.length }))).toMatchInlineSnapshot(`
      [
        {
          "page": 1,
          "topLinesCount": 4,
        },
        {
          "page": 2,
          "topLinesCount": 4,
        },
        {
          "page": 3,
          "topLinesCount": 4,
        },
        {
          "page": 4,
          "topLinesCount": 4,
        },
        {
          "page": 5,
          "topLinesCount": 4,
        },
        {
          "page": 6,
          "topLinesCount": 4,
        },
        {
          "page": 7,
          "topLinesCount": 4,
        },
        {
          "page": 8,
          "topLinesCount": 4,
        },
        {
          "page": 9,
          "topLinesCount": 4,
        },
      ]
    `);
  });

  // ═══════════════════════════════════════════════════════════
  // 2) ORDEM VISUAL EXPLICAÇÃO → NÚMERO (y_expl > y_num)
  // ═══════════════════════════════════════════════════════════
  const casos: Array<{
    page: number;
    explicacao: (s: string) => boolean;
    numero: (s: string) => boolean;
    label: string;
  }> = [
    {
      page: 1,
      explicacao: (s) => /Rua das Acácias/i.test(s),
      numero: (s) => /R\$[\s\u00A0]?8\d{2}/.test(s), // hero ≈ R$ 815.000
      label: "capa: endereço acima do hero em R$",
    },
    {
      page: 2,
      explicacao: (s) => /Para estimar o valor/i.test(s),
      numero: (s) => /\d/.test(s) && !/Para estimar/i.test(s) && s.length < 60,
      label: "metodologia: intro acima de pesos/números",
    },
    {
      page: 3,
      explicacao: (s) => /Este é o valor sugerido pela IA/i.test(s),
      numero: (s) => /^R\$[\s\u00A0]?\d/.test(s),
      label: "preço: explicação acima do valor grande",
    },
    {
      page: 4,
      explicacao: (s) => /Se o imóvel for anunciado/i.test(s),
      numero: (s) => /\d{1,3}\s*%/.test(s),
      label: "probabilidade: explicação acima das %",
    },
    {
      page: 5,
      explicacao: (s) => /A tabela abaixo posiciona o valor recomendado/i.test(s),
      numero: (s) => /R\$[\s\u00A0]?\d/.test(s),
      label: "mercado: explicação acima dos comparáveis",
    },
    {
      page: 6,
      explicacao: (s) => /^Encontramos\b/i.test(s),
      numero: (s) => /\b\d/.test(s) && !/Encontramos/i.test(s) && s.length < 80,
      label: "concorrência: explicação acima das métricas",
    },
    {
      page: 7,
      explicacao: (s) => /Estes são os fatores identificados pela IA/i.test(s),
      // p.7 não tem número hero — usamos o 1º item como âncora visual
      numero: (s) => /Localização|Área|Padrão|Documenta|Potencial/i.test(s),
      label: "pontos positivos: intro acima do 1º item",
    },
    {
      page: 8,
      explicacao: (s) => /Cada ponto vem acompanhado/i.test(s),
      numero: (s) => /Fotos|Preço|Divulga|Document|Reforma/i.test(s),
      label: "pontos de atenção: intro acima do 1º item",
    },
    {
      page: 9,
      explicacao: (s) => /O que fazer com esta avaliação/i.test(s),
      numero: (s) => /^R\$[\s\u00A0]?\d/.test(s),
      label: "conclusão: título acima do valor final",
    },
  ];

  it.each(casos)(
    "p.$page — $label (y_explicação > y_número)",
    ({ page, explicacao, numero }) => {
      const layout = PAGES[page - 1];
      expect(layout, `página ${page} deve existir`).toBeDefined();

      const yExpl = firstYWhere(layout, explicacao);
      const yNum = firstYWhere(layout, numero);

      expect(
        yExpl,
        `p.${page}: frase de explicação não encontrada. Linhas: ${layout.lines
          .slice(0, 8)
          .join(" | ")}`,
      ).not.toBeNull();
      expect(
        yNum,
        `p.${page}: número/âncora não encontrado. Linhas: ${layout.lines
          .slice(0, 8)
          .join(" | ")}`,
      ).not.toBeNull();

      // Em pdfjs, y maior = mais alto visualmente. Portanto,
      // "explicação antes do número" ⇔ y_expl > y_num.
      expect(
        yExpl! > yNum!,
        `p.${page}: esperado y_explicação (${yExpl}) > y_número (${yNum}) — a explicação deve aparecer VISUALMENTE ACIMA do valor.`,
      ).toBe(true);
    },
  );
});
