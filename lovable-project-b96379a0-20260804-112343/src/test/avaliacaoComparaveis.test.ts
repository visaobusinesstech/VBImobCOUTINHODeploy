import { describe, it, expect } from "vitest";
import {
  MAX_COMPARAVEIS_PDF,
  prepararComparaveis,
  montarRotuloComparaveis,
  textosComparaveis,
  validarConsistenciaComparaveis,
} from "@/lib/exportAvaliacaoPremiumPDF";

const comp = (i: number, over: Record<string, unknown> = {}) => ({
  titulo: `Imóvel ${i}`,
  area: 60 + i,
  preco: 400000 + i * 1000,
  dias_anuncio: 30 + i,
  ...over,
});

const gerar = (n: number) => Array.from({ length: n }, (_, i) => comp(i + 1));

/** Simula a montagem da seção de comparáveis do PDF. */
function montarSecao(lista: any[]) {
  const { usados, excluidos, totalBruto } = prepararComparaveis(lista);
  const total = usados.length;
  const exibidos = usados.slice(0, MAX_COMPARAVEIS_PDF).length;
  return {
    total,
    exibidos,
    excluidos,
    totalBruto,
    rotulo: montarRotuloComparaveis(exibidos, total),
    textos: textosComparaveis(total),
  };
}

const numerosCitados = (t: Record<string, string>) =>
  Object.values(t).map((s) => Number(s.match(/(\d+)\s+imóveis/)?.[1]));

describe("PDF de avaliação — consistência de comparáveis", () => {
  it.each([0, 1, 3, 8, 12, 14, 20, 37])(
    "mantém X de Y e os textos corretos com %i imóveis na região",
    (n) => {
      const s = montarSecao(gerar(n));
      const esperado = Math.min(n, MAX_COMPARAVEIS_PDF);

      expect(s.total).toBe(esperado);
      expect(s.exibidos).toBe(esperado);
      expect(s.rotulo).toBe(`Imóveis semelhantes anunciados — ${esperado} de ${esperado}`);
      expect(numerosCitados(s.textos)).toEqual([esperado, esperado, esperado]);
      expect(validarConsistenciaComparaveis(s.total, s.exibidos)).toBe(true);
    },
  );

  it("nunca exibe menos linhas do que o número citado no texto", () => {
    for (let n = 0; n <= 30; n++) {
      const s = montarSecao(gerar(n));
      expect(s.exibidos).toBe(s.total);
    }
  });

  it("exclui duplicados e registra o motivo", () => {
    const lista = [comp(1), comp(1), comp(2)];
    const s = montarSecao(lista);
    expect(s.total).toBe(2);
    expect(s.excluidos).toHaveLength(1);
    expect(s.excluidos[0].motivo).toMatch(/duplicado/i);
    expect(s.rotulo).toBe("Imóveis semelhantes anunciados — 2 de 2");
  });

  it("exclui itens sem preço ou área com motivo de dados insuficientes", () => {
    const s = montarSecao([comp(1), comp(2, { preco: 0 }), comp(3, { area: null })]);
    expect(s.total).toBe(1);
    expect(s.excluidos.map((e) => e.motivo)).toEqual([
      "Dados insuficientes (preço ou área ausente)",
      "Dados insuficientes (preço ou área ausente)",
    ]);
  });

  it("registra excedentes acima do limite do relatório", () => {
    const s = montarSecao(gerar(MAX_COMPARAVEIS_PDF + 5));
    expect(s.total).toBe(MAX_COMPARAVEIS_PDF);
    expect(s.excluidos).toHaveLength(5);
    expect(s.excluidos[0].motivo).toContain(`limite de ${MAX_COMPARAVEIS_PDF}`);
    expect(s.totalBruto).toBe(MAX_COMPARAVEIS_PDF + 5);
  });

  it("soma usados + excluídos = total levantado", () => {
    const lista = [...gerar(20), comp(1), comp(2, { preco: 0 })];
    const s = montarSecao(lista);
    expect(s.total + s.excluidos.length).toBe(s.totalBruto);
  });

  it("ignora entradas nulas sem quebrar a contagem", () => {
    const s = montarSecao([null, undefined, comp(1), comp(2)] as any);
    expect(s.total).toBe(2);
    expect(s.totalBruto).toBe(2);
  });
});
