import { describe, it, expect } from "vitest";
import { derivarMetricas, exportAvaliacaoPremiumPDF } from "./exportAvaliacaoPremiumPDF";

// ─────────────────────────────────────────────────────────────
// CONSISTÊNCIA CROSS-PÁGINA — pp. 3 · 4 · 9
//
// A verdade única é `derivarMetricas`. O PDF então rende os
// mesmos números em três locais diferentes:
//
//   • Página 3  — preço recomendado (hero) + tempo estimado
//   • Página 4  — probabilidade 30/60/90 dias
//   • Página 9  — preço recomendado (conclusão) + "~N dias até 75%"
//
// Regressões silenciosas onde uma página usa métrica X e outra
// usa Y quebram credibilidade do relatório. Este teste:
//
//   1. Gera o PDF para 3 cenários com preços diferentes.
//   2. Para cada cenário, extrai texto das pp. 3/4/9 via pdfjs.
//   3. Confirma que o preço recomendado em p.3 == p.9.
//   4. Confirma que o tempo estimado em p.3 == p.9 (mesmo inteiro).
//   5. Confirma que d30/d60/d90 em p.4 batem exatamente com
//      `derivarMetricas(...).probRecom`.
//   6. Confirma que mudar o preço na entrada muda as métricas de
//      forma monotônica e coerente entre as três páginas.
// ─────────────────────────────────────────────────────────────

type PagText = Map<number, string>;

async function extractPagesText(bytes: Uint8Array): Promise<PagText> {
  const pdfjs = await import(
    /* @vite-ignore */ "pdfjs-dist/legacy/build/pdf.mjs" as string
  );
  (pdfjs as { GlobalWorkerOptions: { workerSrc: string } }).GlobalWorkerOptions.workerSrc =
    require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs");
  const task = (
    pdfjs as { getDocument: (o: unknown) => { promise: Promise<unknown> } }
  ).getDocument({ data: bytes, isEvalSupported: false, useSystemFonts: false });
  const pdf = (await task.promise) as {
    numPages: number;
    getPage: (n: number) => Promise<{
      getTextContent: () => Promise<{ items: Array<{ str: string }> }>;
    }>;
  };
  const out: PagText = new Map();
  for (let p = 1; p <= pdf.numPages; p++) {
    const c = await (await pdf.getPage(p)).getTextContent();
    out.set(
      p,
      c.items.map((it) => it.str).join(" ").replace(/\u00A0/g, " ").replace(/\s+/g, " "),
    );
  }
  return out;
}

function formatBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
    .replace(/\u00A0/g, " ");
}

// Constrói um pattern regex flexível para o preço, tolerando quebras
// entre "R$" e o valor por conta do splitTextToSize do jsPDF.
function precoPattern(preco: number): RegExp {
  const numero = preco.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
  const escapado = numero.replace(/\./g, "\\.");
  return new RegExp(`R\\$\\s*${escapado}\\b`);
}

async function gerarECapturar(imovel: unknown, avaliacao: unknown, comps: unknown[]) {
  const doc = await exportAvaliacaoPremiumPDF({
    imovel: imovel as never,
    avaliacao: avaliacao as never,
    comparaveis: comps as never,
    brandName: "TestBrand",
    corretorInfo: { nome: "Corretor" },
    skipSave: true,
  });
  const ab = (doc as { output: (t: string) => ArrayBuffer }).output("arraybuffer");
  const pages = await extractPagesText(new Uint8Array(ab));
  const met = derivarMetricas(imovel as never, avaliacao as never, comps as never);
  return { pages, met };
}

const baseImovel = {
  tipo: "Apartamento",
  endereco: "Rua Teste, 42",
  bairro: "Asa Sul",
  cidade: "Brasília",
  estado: "DF",
  area: 90,
  preco: 800_000,
  fotos: [],
};
const comps = Array.from({ length: 6 }, (_, i) => ({
  titulo: `Comp ${i + 1}`,
  area: 88 + i,
  preco: 780_000 + i * 10_000,
  dias_anuncio: 30 + i * 12,
}));

// Cenários: mesmo imóvel e comparáveis, apenas mudando valor_ideal.
const cenarios = [
  { rotulo: "abaixo do mercado", valor_ideal: 750_000 },
  { rotulo: "próximo ao mercado", valor_ideal: 810_000 },
  { rotulo: "acima do mercado", valor_ideal: 900_000 },
];

describe("PDF Premium · consistência cross-página · pp. 3 · 4 · 9", () => {
  for (const cenario of cenarios) {
    describe(`cenário: ${cenario.rotulo} (valor_ideal=${cenario.valor_ideal})`, () => {
      const avaliacao = {
        valor_ideal: cenario.valor_ideal,
        valor_minimo: Math.round(cenario.valor_ideal * 0.95),
        valor_maximo: Math.round(cenario.valor_ideal * 1.06),
        score_liquidez: 62,
        preco_competitivo: true,
      };

      it("preço recomendado idêntico entre p.3 e p.9", async () => {
        const { pages, met } = await gerarECapturar(baseImovel, avaliacao, comps);
        const rx = precoPattern(met.precoRecomendado);
        expect(pages.get(3), `preço ${formatBRL(met.precoRecomendado)} ausente na p.3`).toMatch(rx);
        expect(pages.get(9), `preço ${formatBRL(met.precoRecomendado)} ausente na p.9`).toMatch(rx);
      }, 30_000);

      it("tempo estimado (dias) idêntico entre p.1 (KPI da capa) e p.9 (conclusão)", async () => {
        const { pages, met } = await gerarECapturar(baseImovel, avaliacao, comps);
        const dias = met.tempoEstimadoDias;
        // Página 1: card KPI "TEMPO ESTIMADO DE VENDA" com "N dias"
        expect(pages.get(1)).toMatch(/TEMPO ESTIMADO DE VENDA/i);
        expect(pages.get(1), `p.1 sem '${dias} dias'`).toMatch(new RegExp(`\\b${dias}\\s?dias\\b`));
        // Página 9: "~N dias até 75% de probabilidade"
        expect(pages.get(9), `p.9 sem '~${dias} dias até 75%'`).toMatch(
          new RegExp(`~?\\s?${dias}\\s?dias\\s+at[ée]\\s+75%`, "i"),
        );
      }, 30_000);

      it("percentuais d30/d60/d90 da p.4 batem exatamente com derivarMetricas", async () => {
        const { pages, met } = await gerarECapturar(baseImovel, avaliacao, comps);
        const p4 = pages.get(4) ?? "";
        for (const [rotulo, esperado] of [
          ["d30", met.probRecom.d30],
          ["d60", met.probRecom.d60],
          ["d90", met.probRecom.d90],
        ] as const) {
          // Aceita quebras entre número e "%" (pdfjs às vezes separa).
          const rx = new RegExp(`\\b${esperado}\\s?%`);
          expect(p4, `p.4 sem ${rotulo}=${esperado}%`).toMatch(rx);
        }
        // Monotonicidade cumulativa (regra do domínio)
        expect(met.probRecom.d30).toBeLessThanOrEqual(met.probRecom.d60);
        expect(met.probRecom.d60).toBeLessThanOrEqual(met.probRecom.d90);
      }, 30_000);

      it("p.4 é textualmente coerente com p.3 (o preço da hero é o que ancora as probs)", async () => {
        const { pages, met } = await gerarECapturar(baseImovel, avaliacao, comps);
        // A frase-âncora da p.4 cita literalmente o preço recomendado.
        const trechoP4 = pages.get(4) ?? "";
        const rxPreco = precoPattern(met.precoRecomendado);
        expect(trechoP4, "p.4 não menciona o preço recomendado usado na p.3").toMatch(rxPreco);
      }, 30_000);
    });
  }

  // ═══════════════════════════════════════════════════════════
  // MUDANÇA DE PREÇO → mudança consistente e monotônica
  // ═══════════════════════════════════════════════════════════
  describe("mudar o preço da p.3 propaga métricas coerentes para p.4 e p.9", () => {
    it("preço maior (mais caro que mercado) reduz probs e aumenta tempo estimado, refletindo em p.4 e p.9", async () => {
      const barato = {
        valor_ideal: 720_000,
        valor_minimo: 690_000,
        valor_maximo: 760_000,
        score_liquidez: 62,
      };
      const caro = {
        valor_ideal: 900_000,
        valor_minimo: 860_000,
        valor_maximo: 950_000,
        score_liquidez: 62,
      };
      const A = await gerarECapturar(baseImovel, barato, comps);
      const B = await gerarECapturar(baseImovel, caro, comps);

      // Regra do domínio: preço acima do mercado ⇒ probs menores em todas as janelas.
      expect(B.met.probRecom.d30).toBeLessThan(A.met.probRecom.d30);
      expect(B.met.probRecom.d60).toBeLessThan(A.met.probRecom.d60);
      expect(B.met.probRecom.d90).toBeLessThanOrEqual(A.met.probRecom.d90);
      // Probs menores ⇒ leva mais tempo para atingir 75%.
      expect(B.met.tempoEstimadoDias).toBeGreaterThanOrEqual(A.met.tempoEstimadoDias);

      // p.4 do cenário caro exibe os NOVOS percentuais, não os do cenário barato.
      const p4B = B.pages.get(4) ?? "";
      expect(p4B).toMatch(new RegExp(`\\b${B.met.probRecom.d30}\\s?%`));
      expect(p4B).toMatch(new RegExp(`\\b${B.met.probRecom.d60}\\s?%`));
      expect(p4B).toMatch(new RegExp(`\\b${B.met.probRecom.d90}\\s?%`));

      // p.9 do cenário caro cita o novo tempo (e não o do cenário barato).
      const p9B = B.pages.get(9) ?? "";
      expect(p9B).toMatch(new RegExp(`~?\\s?${B.met.tempoEstimadoDias}\\s?dias\\s+at[ée]\\s+75%`, "i"));
      if (B.met.tempoEstimadoDias !== A.met.tempoEstimadoDias) {
        expect(p9B).not.toMatch(new RegExp(`~?\\s?${A.met.tempoEstimadoDias}\\s?dias\\s+at[ée]\\s+75%`, "i"));
      }

      // p.3 e p.9 continuam sincronizadas dentro de CADA cenário.
      const rxPrecoB = precoPattern(B.met.precoRecomendado);
      expect(B.pages.get(3)).toMatch(rxPrecoB);
      expect(B.pages.get(9)).toMatch(rxPrecoB);
      const rxPrecoA = precoPattern(A.met.precoRecomendado);
      expect(A.pages.get(3)).toMatch(rxPrecoA);
      expect(A.pages.get(9)).toMatch(rxPrecoA);
    }, 60_000);

    it("o preço do cenário barato NÃO vaza no PDF do cenário caro (nem vice-versa)", async () => {
      const barato = { valor_ideal: 720_000, score_liquidez: 62 };
      const caro = { valor_ideal: 900_000, score_liquidez: 62 };
      const A = await gerarECapturar(baseImovel, barato, comps);
      const B = await gerarECapturar(baseImovel, caro, comps);
      const rxA = precoPattern(A.met.precoRecomendado); // 720.000
      const rxB = precoPattern(B.met.precoRecomendado); // 900.000
      // p.3 e p.9 de B não podem carregar o preço de A.
      expect(B.pages.get(3)).not.toMatch(rxA);
      expect(B.pages.get(9)).not.toMatch(rxA);
      expect(A.pages.get(3)).not.toMatch(rxB);
      expect(A.pages.get(9)).not.toMatch(rxB);
    }, 60_000);
  });
});
