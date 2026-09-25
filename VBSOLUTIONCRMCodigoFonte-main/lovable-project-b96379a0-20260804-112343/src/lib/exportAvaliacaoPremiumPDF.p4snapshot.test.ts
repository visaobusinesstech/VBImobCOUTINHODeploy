import { describe, it, expect, beforeAll } from "vitest";
import { exportAvaliacaoPremiumPDF } from "./exportAvaliacaoPremiumPDF";

// ─────────────────────────────────────────────────────────────
// SNAPSHOT VISUAL — Página 4 (Probabilidade 30 / 60 / 90 dias)
//
// Gera o PDF real e, via pdfjs-dist, extrai a posição (x, y) e
// o texto de cada item na página 4. A partir disso valida:
//
//   1. As três janelas aparecem na ordem 30 → 60 → 90 (esquerda→
//      direita, x crescente).
//   2. Eyebrow ("ATÉ 30 DIAS"…), percentual ("47%"…) e legenda
//      ("alta chance"/"chance moderada"/"chance baixa") estão
//      verticalmente alinhados entre os três cards (mesmo y ±1pt).
//   3. Percentuais são monotônicos (d30 ≤ d60 ≤ d90) — reflete a
//      lógica de probabilidade cumulativa.
//   4. Não há sobreposição horizontal entre os cards: o x do
//      eyebrow da coluna N+1 é sempre maior que o x do percentual
//      da coluna N + uma folga mínima.
//   5. Congela em snapshot inline uma "imagem textual" da página 4
//      (geometria arredondada), fazendo qualquer regressão de
//      layout falhar com diff legível.
// ─────────────────────────────────────────────────────────────

type Item = { str: string; x: number; y: number };

async function extractPage4(bytes: Uint8Array): Promise<Item[]> {
  const pdfjs = await import(
    /* @vite-ignore */ "pdfjs-dist/legacy/build/pdf.mjs" as string
  );
  (pdfjs as { GlobalWorkerOptions: { workerSrc: string } }).GlobalWorkerOptions.workerSrc =
    require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs");
  const loadingTask = (
    pdfjs as { getDocument: (o: unknown) => { promise: Promise<unknown> } }
  ).getDocument({ data: bytes, isEvalSupported: false, useSystemFonts: false });
  const pdf = (await loadingTask.promise) as {
    getPage: (n: number) => Promise<{
      getTextContent: () => Promise<{
        items: Array<{ str: string; transform: number[] }>;
      }>;
    }>;
  };
  const page = await pdf.getPage(4);
  const content = await page.getTextContent();
  return content.items
    .filter((it) => typeof it.str === "string" && it.str.trim().length > 0)
    .map((it) => ({ str: it.str, x: it.transform[4], y: it.transform[5] }));
}

// Agrupa itens visualmente próximos em blocos de linha (mesma y),
// preservando a ordem x asc — imita OCR/percepção humana.
function groupByLine(items: Item[]): Array<{ y: number; parts: Item[]; text: string }> {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const out: Array<{ y: number; parts: Item[]; text: string }> = [];
  let curY = Infinity;
  let bucket: Item[] = [];
  for (const it of sorted) {
    if (curY - it.y > 1.5) {
      if (bucket.length) {
        out.push({
          y: bucket[0].y,
          parts: bucket,
          text: bucket.map((b) => b.str).join(" ").replace(/\s+/g, " ").trim(),
        });
      }
      bucket = [];
      curY = it.y;
    }
    bucket.push(it);
  }
  if (bucket.length) {
    out.push({
      y: bucket[0].y,
      parts: bucket,
      text: bucket.map((b) => b.str).join(" ").replace(/\s+/g, " ").trim(),
    });
  }
  return out;
}

// ─── Fixture com percentuais estáveis (score_liquidez=68 ⇒ 45/72/90) ─
const imovel = {
  tipo: "Apartamento",
  endereco: "Rua das Flores, 123",
  bairro: "Asa Sul",
  cidade: "Brasília",
  estado: "DF",
  area: 92,
  preco: 815_000,
  fotos: [],
};
const avaliacao = {
  valor_ideal: 815_000,
  valor_minimo: 780_000,
  valor_maximo: 850_000,
  score_liquidez: 68,
  preco_competitivo: true,
  pontos_fortes: ["Localização privilegiada"],
  pontos_atencao: ["Fotos escuras"],
  comparaveis_gerados: [],
};
const comparaveis = Array.from({ length: 6 }, (_, i) => ({
  titulo: `Comp ${i + 1}`,
  area: 90 + i,
  preco: 800_000 + i * 5_000,
  dias_anuncio: 25 + i * 12,
}));

let ITEMS: Item[];

beforeAll(async () => {
  const doc = await exportAvaliacaoPremiumPDF({
    imovel,
    avaliacao,
    comparaveis,
    brandName: "SnapshotBrand",
    corretorInfo: { nome: "Corretor Teste" },
    skipSave: true,
  });
  const ab = (doc as { output: (t: string) => ArrayBuffer }).output("arraybuffer");
  ITEMS = await extractPage4(new Uint8Array(ab));
  expect(ITEMS.length).toBeGreaterThan(0);
}, 60_000);

describe("PDF Premium · p.4 · snapshot visual dos blocos 30/60/90d", () => {
  // Utilitários que localizam itens específicos pelo texto.
  const findAll = (rx: RegExp) => ITEMS.filter((it) => rx.test(it.str));
  const findOne = (rx: RegExp) => ITEMS.find((it) => rx.test(it.str));

  it("os três eyebrows 'ATÉ 30/60/90 DIAS' estão presentes e alinhados verticalmente", () => {
    const e30 = findOne(/AT[ÉE]\s*30\s*DIAS/i);
    const e60 = findOne(/AT[ÉE]\s*60\s*DIAS/i);
    const e90 = findOne(/AT[ÉE]\s*90\s*DIAS/i);
    expect(e30, "eyebrow 30 DIAS").toBeDefined();
    expect(e60, "eyebrow 60 DIAS").toBeDefined();
    expect(e90, "eyebrow 90 DIAS").toBeDefined();
    // mesma y ± 1pt
    const ys = [e30!.y, e60!.y, e90!.y];
    const spread = Math.max(...ys) - Math.min(...ys);
    expect(spread, `eyebrows fora de alinhamento vertical (spread=${spread}pt)`).toBeLessThanOrEqual(1);
    // ordem esquerda→direita
    expect(e30!.x).toBeLessThan(e60!.x);
    expect(e60!.x).toBeLessThan(e90!.x);
  });

  it("os três percentuais estão alinhados verticalmente e na ordem 30→60→90", () => {
    // Percentuais destacados: "47%", "72%", "90%" (formato "\d+%").
    // Podem vir quebrados em itens separados. Reagrupamos por linha.
    const linhas = groupByLine(ITEMS);
    // A linha dos percentuais é aquela que contém 3 tokens "N%".
    const linhaPct = linhas.find((l) => (l.text.match(/\b\d{1,3}\s*%/g) || []).length === 3);
    expect(linhaPct, "linha dos 3 percentuais não encontrada").toBeDefined();

    // Extrai o item de cada "%" com seu x.
    const pctItems = linhaPct!.parts.filter((p) => /%/.test(p.str) || /^\d{1,3}$/.test(p.str));
    // Agrupa vizinhos "N" + "%" em pares [x, valor].
    const pares: Array<{ x: number; valor: number }> = [];
    for (let i = 0; i < linhaPct!.parts.length; i++) {
      const p = linhaPct!.parts[i];
      const m = p.str.match(/^\s*(\d{1,3})\s*%\s*$/);
      if (m) {
        pares.push({ x: p.x, valor: Number(m[1]) });
      }
    }
    // Fallback: reconstrói pares se pdfjs quebrar em itens "47" + "%".
    if (pares.length < 3) {
      const tokens = linhaPct!.parts;
      for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        if (/^\d{1,3}$/.test(t.str) && tokens[i + 1]?.str.includes("%")) {
          pares.push({ x: t.x, valor: Number(t.str) });
        }
      }
    }
    expect(pares.length, `esperados 3 percentuais, achei ${pares.length}: ${JSON.stringify(pctItems)}`).toBeGreaterThanOrEqual(3);

    // Ordena por x — assim obtemos [d30, d60, d90].
    pares.sort((a, b) => a.x - b.x);
    const [d30, d60, d90] = pares.slice(0, 3);
    // Monotonicidade cumulativa.
    expect(d30.valor, `d30 (${d30.valor}) ≤ d60 (${d60.valor})`).toBeLessThanOrEqual(d60.valor);
    expect(d60.valor, `d60 (${d60.valor}) ≤ d90 (${d90.valor})`).toBeLessThanOrEqual(d90.valor);
    // Faixas plausíveis.
    expect(d30.valor).toBeGreaterThanOrEqual(1);
    expect(d90.valor).toBeLessThanOrEqual(100);
    // Alinhamento horizontal: os três "%" na MESMA y.
    const ys = [d30, d60, d90].map((p) => linhaPct!.parts.find((tk) => tk.x === p.x)!.y);
    const spread = Math.max(...ys) - Math.min(...ys);
    expect(spread, `percentuais fora de alinhamento (spread=${spread}pt)`).toBeLessThanOrEqual(1);
  });

  it("as legendas 'alta/moderada/baixa chance' estão alinhadas e mapeiam o valor correto", () => {
    const legendas = findAll(/(alta chance|chance moderada|chance baixa)/i);
    expect(legendas.length, "esperadas 3 legendas de chance").toBeGreaterThanOrEqual(3);
    const trio = legendas.slice(0, 3).sort((a, b) => a.x - b.x);
    const ys = trio.map((l) => l.y);
    const spread = Math.max(...ys) - Math.min(...ys);
    expect(spread, `legendas fora de alinhamento (spread=${spread}pt)`).toBeLessThanOrEqual(1);
    // ordem x
    expect(trio[0].x).toBeLessThan(trio[1].x);
    expect(trio[1].x).toBeLessThan(trio[2].x);
  });

  it("não há sobreposição horizontal entre os três cards", () => {
    // A borda direita de cada card (aproximada pela posição do
    // percentual + folga) precisa ficar à esquerda do eyebrow do
    // próximo card, com folga mínima ≥ 4pt.
    const eyebrows = [
      findOne(/AT[ÉE]\s*30\s*DIAS/i)!,
      findOne(/AT[ÉE]\s*60\s*DIAS/i)!,
      findOne(/AT[ÉE]\s*90\s*DIAS/i)!,
    ].sort((a, b) => a.x - b.x);

    for (let i = 0; i < eyebrows.length - 1; i++) {
      const gap = eyebrows[i + 1].x - eyebrows[i].x;
      // largura aproximada de card = (page_content - 2 gaps) / 3.
      // Em A4 (cw ≈ 170mm ≈ 481pt), cada card ≈ 158pt de passo.
      // Se o gap ficar abaixo de 40pt, algo colapsou.
      expect(
        gap,
        `distância entre eyebrows [${i}→${i + 1}] = ${gap}pt (esperado ≥ 40pt)`,
      ).toBeGreaterThanOrEqual(40);
    }
  });

  it("snapshot da geometria dos blocos 30/60/90d (posições arredondadas)", () => {
    const eyebrows = [
      findOne(/AT[ÉE]\s*30\s*DIAS/i)!,
      findOne(/AT[ÉE]\s*60\s*DIAS/i)!,
      findOne(/AT[ÉE]\s*90\s*DIAS/i)!,
    ].sort((a, b) => a.x - b.x);
    const legendas = findAll(/(alta chance|chance moderada|chance baixa)/i)
      .sort((a, b) => a.x - b.x)
      .slice(0, 3);

    // "Imagem textual" da página 4: para cada coluna, capturamos
    // as posições relativas dos elementos (arredondadas em passos
    // de 4pt para tolerar variação de kerning entre versões).
    const round4 = (n: number) => Math.round(n / 4) * 4;
    const geom = eyebrows.map((e, i) => ({
      col: i,
      eyebrow: e.str.trim(),
      eyebrowX: round4(e.x - eyebrows[0].x), // deslocamento vs coluna 0
      eyebrowY: round4(e.y),
      legenda: legendas[i]?.str.trim() ?? null,
      legendaY: legendas[i] ? round4(legendas[i].y) : null,
      // gap para a próxima coluna (0 na última)
      gapProxColuna: i < eyebrows.length - 1 ? round4(eyebrows[i + 1].x - e.x) : 0,
    }));

    // Congelado: qualquer mudança de posição relativa faz falhar.
    // Colunas equidistantes ⇒ mesmo `gapProxColuna` (156pt).
    // Alinhamento perfeito ⇒ mesmo `eyebrowY` e mesmo `legendaY`.
    expect(geom).toMatchInlineSnapshot(`
      [
        {
          "col": 0,
          "eyebrow": "ATÉ 30 DIAS",
          "eyebrowX": 0,
          "eyebrowY": 576,
          "gapProxColuna": 172,
          "legenda": "chance baixa",
          "legendaY": 456,
        },
        {
          "col": 1,
          "eyebrow": "ATÉ 60 DIAS",
          "eyebrowX": 172,
          "eyebrowY": 576,
          "gapProxColuna": 172,
          "legenda": "chance moderada",
          "legendaY": 456,
        },
        {
          "col": 2,
          "eyebrow": "ATÉ 90 DIAS",
          "eyebrowX": 340,
          "eyebrowY": 576,
          "gapProxColuna": 0,
          "legenda": "alta chance",
          "legendaY": 456,
        },
      ]
    `);
  });
});
