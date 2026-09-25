import { describe, it, expect } from "vitest";
import jsPDF from "jspdf";

/**
 * Valida que a tabela de comparáveis da página 7 do PDF Premium
 * mantém todas as colunas dentro dos limites úteis da página em
 * diferentes formatos (A4 e Carta), evitando overflow horizontal
 * em qualquer visualizador.
 *
 * Espelha a matemática usada em src/lib/exportAvaliacaoPremiumPDF.ts
 * (linhas ~705-750). Se a fórmula mudar lá, atualize aqui também.
 */

type Fmt = "a4" | "letter";

function computeTableLayout(format: Fmt) {
  const doc = new jsPDF({ unit: "mm", format, orientation: "portrait" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const m = 12;
  const cw = pw - 2 * m;
  const pad = 2;
  const tableH = 36;

  const cols = [
    { x: m + 6, w: cw * 0.34, label: "Comparavel" },
    { x: m + 6 + cw * 0.34, w: cw * 0.18, label: "Valor anunciado" },
    { x: m + 6 + cw * 0.52, w: cw * 0.14, label: "Dias" },
    { x: m + 6 + cw * 0.66, w: cw * 0.28, label: "Destino provavel" },
  ];

  return { doc, pw, ph, m, cw, pad, tableH, cols };
}

describe("PDF Premium – tabela de comparáveis (página 7)", () => {
  (["a4", "letter"] as Fmt[]).forEach((format) => {
    describe(`formato ${format.toUpperCase()}`, () => {
      const layout = computeTableLayout(format);
      const { pw, m, cw, cols, tableH, ph } = layout;
      const rightLimit = m + cw; // limite direito da área útil

      it("todas as colunas começam dentro da área útil", () => {
        cols.forEach((c) => {
          expect(c.x).toBeGreaterThanOrEqual(m);
          expect(c.x).toBeLessThan(rightLimit);
        });
      });

      it("nenhuma coluna ultrapassa o limite direito (x + w ≤ margem)", () => {
        cols.forEach((c) => {
          expect(c.x + c.w).toBeLessThanOrEqual(rightLimit + 0.001);
        });
      });

      it("colunas não se sobrepõem (x crescente, sem overlap)", () => {
        for (let i = 1; i < cols.length; i++) {
          expect(cols[i].x).toBeGreaterThanOrEqual(cols[i - 1].x + cols[i - 1].w - 0.001);
        }
      });

      it("largura de cada coluna é positiva e suficiente para padding", () => {
        cols.forEach((c) => {
          expect(c.w).toBeGreaterThan(2 + 2); // pad + 1 caractere mínimo
        });
      });

      it("altura da tabela cabe acima do rodapé (≥ 14mm de margem inferior)", () => {
        const chartYMax = ph - 14 - tableH - 4;
        expect(chartYMax).toBeGreaterThan(0);
      });

      it("textos truncados via getTextWidth respeitam col.w - pad", () => {
        const { doc } = layout;
        doc.setFont("helvetica", "normal");
        const longTitle = "1. Apartamento muito longo na quadra 999 bloco ZZ com varanda gourmet";
        const fit = (s: string, maxW: number, size: number) => {
          doc.setFontSize(size);
          let t = s;
          if (doc.getTextWidth(t) <= maxW) return t;
          while (t.length > 1 && doc.getTextWidth(t + "...") > maxW) t = t.slice(0, -1);
          return t + "...";
        };
        cols.forEach((c) => {
          const out = fit(longTitle, c.w - 2, 6.8);
          expect(doc.getTextWidth(out)).toBeLessThanOrEqual(c.w - 2 + 0.001);
        });
      });

      it("largura útil total é coerente com o formato", () => {
        if (format === "a4") expect(pw).toBeCloseTo(210, 0);
        if (format === "letter") expect(pw).toBeCloseTo(215.9, 0);
      });
    });
  });
});
