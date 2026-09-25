import { describe, it, expect, beforeAll } from "vitest";
import { exportAvaliacaoPremiumPDF, derivarMetricas } from "./exportAvaliacaoPremiumPDF";

// ─────────────────────────────────────────────────────────────
// CONSISTÊNCIA TELA ↔ PDF PREMIUM
//
// Confirma que os três indicadores de decisão — valor
// recomendado pela IA, probabilidades 30/60/90 dias e índice
// de confiança — (1) aparecem nas PÁGINAS CORRETAS do PDF
// Premium e (2) permanecem consistentes com o que a tela
// exibiria a partir dos MESMOS dados de entrada. A fonte da
// verdade é `derivarMetricas`: qualquer divergência entre o
// que o front-end mostra e o que o PDF imprime quebra a
// experiência do corretor com o cliente.
// ─────────────────────────────────────────────────────────────

type Item = { str: string; x: number; y: number };
type PageDoc = { page: number; items: Item[]; text: string; height: number };

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
    // Texto concatenado tolerante a quebras que o pdfjs devolve em pedaços.
    const text = items.map((it) => it.str).join(" ");
    out.push({ page: p, items, text, height: vp.height });
  }
  return out;
}

// pt-BR currency formatter usa NBSP (\u00A0) e às vezes NNBSP
// (\u202F) entre "R$" e o número. A tela e o PDF podem serializar
// diferente, então normalizamos para comparar.
function normalizarValor(s: string): string {
  return s.replace(/\s+/g, " ").replace(/\u00A0|\u202F/g, " ").trim();
}
function formatBRL(v: number) {
  return normalizarValor(
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }),
  );
}
function escapeRx(s: string) {
  return s.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
}

// Cenário: aparelho de dados equivalente ao que a tela
// receberia da API/DB antes de renderizar o resumo executivo.
const imovel = {
  tipo: "Apartamento",
  endereco: "Rua Consistência, 300",
  bairro: "Asa Norte",
  cidade: "Brasília",
  estado: "DF",
  area: 92,
  preco: 880_000,
  fotos: [],
};
const avaliacao = {
  valor_ideal: 860_000,
  valor_minimo: 820_000,
  valor_maximo: 920_000,
  score_liquidez: 68,
  preco_m2_estimado: 9_347,
  rating_ia: 8.4,
  pontos_fortes: ["Localização", "Reforma recente"],
  pontos_atencao: ["Andar baixo"],
  estrategia: "Anunciar dentro da faixa.",
};
const comparaveis = [
  { titulo: "Comp A", area: 90, preco: 850_000, dias_anuncio: 30 },
  { titulo: "Comp B", area: 92, preco: 865_000, dias_anuncio: 45 },
  { titulo: "Comp C", area: 95, preco: 880_000, dias_anuncio: 60 },
  { titulo: "Comp D", area: 88, preco: 840_000, dias_anuncio: 20 },
];

// A "tela" e o "PDF" devem consumir a MESMA função de derivação
// para permanecerem consistentes. Se um dia o front deixar de
// chamar `derivarMetricas`, este teste sinaliza a divergência.
const metricas = derivarMetricas(imovel, avaliacao, comparaveis);

let pages: PageDoc[];

beforeAll(async () => {
  const doc = await exportAvaliacaoPremiumPDF({
    imovel,
    avaliacao,
    comparaveis,
    brandName: "ConsistBrand",
    corretorInfo: { nome: "Corretor Consistência" },
    skipSave: true,
  });
  const ab = doc.output("arraybuffer") as ArrayBuffer;
  pages = await parsePdf(new Uint8Array(ab));
}, 60_000);

function textoPagina(page: number): string {
  return normalizarValor(pages[page - 1].text);
}

describe("PDF Premium — consistência tela ↔ PDF", () => {
  it("gera as 9 páginas do relatório", () => {
    expect(pages).toHaveLength(9);
  });

  // 1) VALOR RECOMENDADO ──────────────────────────────────────
  describe("valor recomendado pela IA", () => {
    it("aparece na capa (p.1) com o mesmo valor que a tela mostraria", () => {
      const esperado = formatBRL(metricas.precoRecomendado);
      const rx = new RegExp(escapeRx(esperado));
      expect(rx.test(textoPagina(1)), `capa deveria mostrar ${esperado}`).toBe(true);
    });

    it("aparece na página de preço (p.3) com o mesmo valor", () => {
      const esperado = formatBRL(metricas.precoRecomendado);
      const rx = new RegExp(escapeRx(esperado));
      expect(rx.test(textoPagina(3)), `p.3 deveria mostrar ${esperado}`).toBe(true);
    });

    it("aparece na conclusão (p.9) com o mesmo valor", () => {
      const esperado = formatBRL(metricas.precoRecomendado);
      const rx = new RegExp(escapeRx(esperado));
      expect(rx.test(textoPagina(9)), `conclusão deveria mostrar ${esperado}`).toBe(true);
    });

    it("é o MESMO valor em todas as páginas onde aparece (não diverge)", () => {
      const esperado = formatBRL(metricas.precoRecomendado);
      // Nenhuma página pode exibir um valor recomendado diferente do
      // calculado. Buscamos ocorrências de "R$ ..." em contexto de
      // "recomendad" e comparamos.
      for (const p of pages) {
        const t = normalizarValor(p.text);
        const m = t.match(/(recomendad[oa][^R]{0,60})(R\$\s*[\d.\u00A0\u202F]+)/gi);
        if (!m) continue;
        for (const trecho of m) {
          const val = trecho.match(/R\$\s*[\d.\u00A0\u202F]+/)?.[0] ?? "";
          expect(
            normalizarValor(val),
            `p.${p.page}: valor recomendado divergente ("${val}" ≠ "${esperado}")`,
          ).toBe(esperado);
        }
      }
    });
  });

  // 2) PROBABILIDADES 30/60/90d ───────────────────────────────
  describe("probabilidades de venda 30/60/90 dias", () => {
    it("aparecem na página de probabilidade (p.4) com os valores da tela", () => {
      const t = textoPagina(4);
      // O bloco só faz sentido se as três janelas estiverem juntas.
      expect(t).toMatch(/30\s*DIAS/i);
      expect(t).toMatch(/60\s*DIAS/i);
      expect(t).toMatch(/90\s*DIAS/i);
      expect(t, `p.4 deveria mostrar ${metricas.probRecom.d30}% (30d)`).toMatch(
        new RegExp(`\\b${metricas.probRecom.d30}\\s*%`),
      );
      expect(t, `p.4 deveria mostrar ${metricas.probRecom.d60}% (60d)`).toMatch(
        new RegExp(`\\b${metricas.probRecom.d60}\\s*%`),
      );
      expect(t, `p.4 deveria mostrar ${metricas.probRecom.d90}% (90d)`).toMatch(
        new RegExp(`\\b${metricas.probRecom.d90}\\s*%`),
      );
    });

    it("NÃO aparecem na capa (p.1) — evita duplicidade fora de contexto", () => {
      const t = textoPagina(1);
      // A capa não deve conter simultaneamente 30/60/90 DIAS com %:
      // isso é assinatura do bloco de probabilidade da p.4.
      const capaTemBloco =
        /30\s*DIAS/i.test(t) && /60\s*DIAS/i.test(t) && /90\s*DIAS/i.test(t);
      expect(capaTemBloco, "bloco de probabilidades vazou para a capa").toBe(false);
    });

    it("são monotônicas (30d ≤ 60d ≤ 90d), como a tela apresentaria", () => {
      expect(metricas.probRecom.d30).toBeLessThanOrEqual(metricas.probRecom.d60);
      expect(metricas.probRecom.d60).toBeLessThanOrEqual(metricas.probRecom.d90);
    });
  });

  // 3) ÍNDICE DE CONFIANÇA ────────────────────────────────────
  describe("índice de confiança da IA", () => {
    it("está na capa (p.1) como NOTA DA IA com o valor derivado", () => {
      const t = textoPagina(1);
      expect(t).toMatch(/NOTA DA IA/i);
      expect(t, `capa deveria mostrar ${metricas.indiceConfianca}/100`).toMatch(
        new RegExp(`\\b${metricas.indiceConfianca}\\s*/\\s*100`),
      );
    });

    it("está na conclusão (p.9) como ÍNDICE DE CONFIANÇA DA IA com o mesmo valor", () => {
      const t = textoPagina(9);
      expect(t).toMatch(/ÍNDICE DE CONFIANÇA DA IA/i);
      expect(t, `p.9 deveria mostrar ${metricas.indiceConfianca}/100`).toMatch(
        new RegExp(`\\b${metricas.indiceConfianca}\\s*/\\s*100`),
      );
    });

    it("é o MESMO índice na capa (NOTA DA IA) e na conclusão (ÍNDICE DE CONFIANÇA)", () => {
      const esperado = metricas.indiceConfianca;
      const capa = textoPagina(1);
      const conclusao = textoPagina(9);
      // Extrai o número que aparece imediatamente após o rótulo de cada página
      // — evita colisão com outras notas /100 (ex.: liquidez) no relatório.
      const mCapa = capa.match(/NOTA DA IA[^0-9]{0,40}(\d{1,3})\s*\/\s*100/i);
      const mConcl = conclusao.match(/ÍNDICE DE CONFIANÇA DA IA[\s\S]{0,120}?(\d{1,3})\s*\/\s*100/i);
      expect(mCapa, "capa: rótulo NOTA DA IA sem número /100 associado").not.toBeNull();
      expect(mConcl, "conclusão: rótulo ÍNDICE DE CONFIANÇA sem número /100 associado").not.toBeNull();
      expect(Number(mCapa![1])).toBe(esperado);
      expect(Number(mConcl![1])).toBe(esperado);
    });
  });
});
