import { describe, it, expect, beforeAll } from "vitest";
import { exportAvaliacaoPremiumPDF } from "./exportAvaliacaoPremiumPDF";

// ─────────────────────────────────────────────────────────────
// TESTE DE REGRESSÃO DE LAYOUT — PDF Premium
//
// Renderiza o PDF real e valida, além da presença dos títulos
// e blocos-chave, a POSIÇÃO VERTICAL aproximada de cada âncora
// dentro da sua página (banda: topo / meio-topo / meio / meio-
// baixo / rodapé). Se uma versão futura empurrar a "capa
// executiva", o "Como a IA chegou neste valor" ou a "Conclusão"
// para fora da banda esperada, o teste falha e sinaliza a
// regressão de layout — mesmo que o texto continue presente.
//
// Também garante que cada âncora aparece EXATAMENTE em UMA
// página (não vazou / não duplicou entre versões).
// ─────────────────────────────────────────────────────────────

type Item = { str: string; x: number; y: number };
type PageDoc = { page: number; items: Item[]; height: number };

async function parsePdf(bytes: Uint8Array): Promise<PageDoc[]> {
  const pdfjs = await import(
    /* @vite-ignore */ "pdfjs-dist/legacy/build/pdf.mjs" as string
  );
  (pdfjs as { GlobalWorkerOptions: { workerSrc: string } }).GlobalWorkerOptions.workerSrc =
    require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs");
  const loadingTask = (pdfjs as {
    getDocument: (o: unknown) => { promise: Promise<unknown> };
  }).getDocument({ data: bytes, isEvalSupported: false, useSystemFonts: false });
  const pdf = (await loadingTask.promise) as {
    numPages: number;
    getPage: (n: number) => Promise<{
      getViewport: (o: { scale: number }) => { height: number };
      getTextContent: () => Promise<{
        items: Array<{ str: string; transform: number[] }>;
      }>;
    }>;
  };
  const out: PageDoc[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const vp = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items: Item[] = content.items
      .filter((it) => typeof it.str === "string" && it.str.trim().length > 0)
      .map((it) => ({ str: it.str, x: it.transform[4], y: it.transform[5] }));
    out.push({ page: p, items, height: vp.height });
  }
  return out;
}

// Encontra o primeiro item cujo texto casa com a regex; devolve
// a coordenada y (pdfjs: origem no canto inferior esquerdo).
function findY(page: PageDoc, rx: RegExp): number | null {
  const sorted = [...page.items].sort((a, b) => b.y - a.y);
  for (const it of sorted) {
    if (rx.test(it.str)) return it.y;
  }
  // fallback: concatena por linha
  const byLine = new Map<number, string[]>();
  for (const it of sorted) {
    const key = Math.round(it.y);
    byLine.set(key, [...(byLine.get(key) ?? []), it.str]);
  }
  for (const [y, parts] of [...byLine.entries()].sort((a, b) => b[0] - a[0])) {
    if (rx.test(parts.join(" "))) return y;
  }
  return null;
}

// Banda vertical relativa (0 = rodapé, 1 = topo em pdfjs coords).
type Banda = "topo" | "meio-topo" | "meio" | "meio-baixo" | "rodape";
function banda(y: number, height: number): Banda {
  const rel = y / height;
  if (rel >= 0.82) return "topo";
  if (rel >= 0.62) return "meio-topo";
  if (rel >= 0.42) return "meio";
  if (rel >= 0.22) return "meio-baixo";
  return "rodape";
}

const imovel = {
  tipo: "Apartamento",
  endereco: "Rua Regressao, 250",
  bairro: "Asa Sul",
  cidade: "Brasília",
  estado: "DF",
  area: 105,
  preco: 950_000,
  fotos: [],
};
const avaliacao = {
  valor_ideal: 940_000,
  score_liquidez: 72,
  rating_ia: 8.7,
  pontos_fortes: ["Localização", "Andar alto", "Reforma"],
  pontos_atencao: ["Preço no teto", "Sem vaga extra"],
  estrategia: "Anunciar dentro da faixa.",
};
const comparaveis = [
  { titulo: "Comp A", area: 100, preco: 920_000, dias_anuncio: 25 },
  { titulo: "Comp B", area: 105, preco: 940_000, dias_anuncio: 40 },
  { titulo: "Comp C", area: 110, preco: 970_000, dias_anuncio: 55 },
];

let pages: PageDoc[];

beforeAll(async () => {
  const doc = await exportAvaliacaoPremiumPDF({
    imovel,
    avaliacao,
    comparaveis,
    brandName: "RegressBrand",
    corretorInfo: { nome: "Corretor Regressão" },
    skipSave: true,
  });
  const ab = doc.output("arraybuffer") as ArrayBuffer;
  pages = await parsePdf(new Uint8Array(ab));
}, 60_000);

// ── Âncoras de layout que definem o "esqueleto" do relatório ──
type Anchor = {
  nome: string;
  page: number;
  rx: RegExp;
  bandasAceitas: Banda[];
  /** Se true, valida também que a âncora só aparece na página informada. */
  exclusivo?: boolean;
};

const anchors: Anchor[] = [
  // Capa executiva — kicker deve estar no topo da página 1
  { nome: "Capa · kicker RESUMO EXECUTIVO", page: 1, rx: /RESUMO EXECUTIVO/, bandasAceitas: ["topo", "meio-topo"], exclusivo: true },
  { nome: "Capa · endereço do imóvel", page: 1, rx: /Rua Regressao/i, bandasAceitas: ["topo", "meio-topo", "meio"], exclusivo: true },
  // "VALOR RECOMENDADO" pode ecoar em outras páginas (ex.: prob.), não é exclusivo.
  { nome: "Capa · rótulo VALOR RECOMENDADO", page: 1, rx: /VALOR RECOMENDADO PELA IA/i, bandasAceitas: ["meio-topo", "meio", "meio-baixo"] },

  // "Como a IA chegou lá" — página 2, título no topo/meio-topo
  { nome: "Metodologia · kicker", page: 2, rx: /METODOLOGIA/, bandasAceitas: ["topo", "meio-topo"], exclusivo: true },
  { nome: "Metodologia · título", page: 2, rx: /Como a IA chegou neste valor/i, bandasAceitas: ["topo", "meio-topo"], exclusivo: true },
  { nome: "Metodologia · gráfico de pesos abaixo do título", page: 2, rx: /Peso de cada fator/i, bandasAceitas: ["meio-topo", "meio", "meio-baixo"], exclusivo: true },

  // Preço recomendado — página 3 (o número deve dominar a página).
  // O termo "Preço recomendado" pode aparecer também em referências na p.4;
  // por isso não marcamos como exclusivo.
  { nome: "Preço · título", page: 3, rx: /Preço recomendado/i, bandasAceitas: ["topo", "meio-topo"] },

  // Conclusão — página 9
  { nome: "Conclusão · kicker", page: 9, rx: /CONCLUSÃO/, bandasAceitas: ["topo", "meio-topo"], exclusivo: true },
  { nome: "Conclusão · título", page: 9, rx: /O que fazer com esta avaliação/i, bandasAceitas: ["topo", "meio-topo"], exclusivo: true },
  { nome: "Conclusão · índice de confiança", page: 9, rx: /ÍNDICE DE CONFIANÇA DA IA/i, bandasAceitas: ["meio-topo", "meio", "meio-baixo", "rodape"], exclusivo: true },
];

describe("PDF Premium — regressão de layout (posição de blocos-chave)", () => {
  it("gera 9 páginas", () => {
    expect(pages).toHaveLength(9);
  });

  it.each(anchors)(
    "$nome aparece na página $page dentro das bandas verticais aceitas",
    ({ page, rx, bandasAceitas, nome }) => {
      const pg = pages[page - 1];
      const y = findY(pg, rx);
      expect(y, `âncora "${nome}" (${rx}) ausente na página ${page}`).not.toBeNull();
      const b = banda(y as number, pg.height);
      expect(
        bandasAceitas,
        `âncora "${nome}" caiu na banda "${b}" (y=${(y as number).toFixed(1)} de ${pg.height.toFixed(0)}) — esperado uma de: ${bandasAceitas.join(", ")}`,
      ).toContain(b);
    },
  );

  it.each(anchors.filter((a) => a.exclusivo))(
    "$nome não vaza para outras páginas (aparece só na página $page)",
    ({ page, rx, nome }) => {
      for (const pg of pages) {
        const encontrou = pg.items.some((it) => rx.test(it.str)) ||
          rx.test(pg.items.map((it) => it.str).join(" "));
        if (pg.page === page) {
          expect(encontrou, `âncora "${nome}" desapareceu da p.${page}`).toBe(true);
        } else {
          expect(
            encontrou,
            `âncora "${nome}" vazou para a p.${pg.page} (esperava só na p.${page})`,
          ).toBe(false);
        }
      }
    },
  );

  it("capa executiva tem título/endereço acima do rótulo de valor (hierarquia visual)", () => {
    const p1 = pages[0];
    const yEndereco = findY(p1, /Rua Regressao/i);
    const yValor = findY(p1, /VALOR RECOMENDADO PELA IA/i);
    expect(yEndereco).not.toBeNull();
    expect(yValor).not.toBeNull();
    // Em pdfjs, y maior = mais alto na página.
    expect(
      yEndereco as number,
      "endereço deve estar acima do rótulo VALOR RECOMENDADO na capa",
    ).toBeGreaterThan(yValor as number);
  });

  it("página 2: kicker, título e contexto descem em ordem", () => {
    const p2 = pages[1];
    const yKicker = findY(p2, /METODOLOGIA/);
    const yTitulo = findY(p2, /Como a IA chegou neste valor/i);
    const yGrafico = findY(p2, /Peso de cada fator/i);
    expect(yKicker).not.toBeNull();
    expect(yTitulo).not.toBeNull();
    expect(yGrafico).not.toBeNull();
    expect(yKicker as number).toBeGreaterThan(yTitulo as number);
    expect(yTitulo as number).toBeGreaterThan(yGrafico as number);
  });

  it("página 9: conclusão desce do kicker até o índice de confiança", () => {
    const p9 = pages[8];
    const yKicker = findY(p9, /CONCLUSÃO/);
    const yTitulo = findY(p9, /O que fazer com esta avaliação/i);
    const yIndice = findY(p9, /ÍNDICE DE CONFIANÇA DA IA/i);
    expect(yKicker).not.toBeNull();
    expect(yTitulo).not.toBeNull();
    expect(yIndice).not.toBeNull();
    expect(yKicker as number).toBeGreaterThan(yTitulo as number);
    expect(yTitulo as number).toBeGreaterThan(yIndice as number);
  });
});
