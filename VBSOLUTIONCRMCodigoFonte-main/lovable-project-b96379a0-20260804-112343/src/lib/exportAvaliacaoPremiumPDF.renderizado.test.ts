/**
 * Verificação sobre o PDF RENDERIZADO (bytes reais, texto extraído com pdf.js).
 * Diferente dos demais testes, aqui não há mock de jsPDF: o arquivo é gerado,
 * lido de volta e os campos críticos são conferidos no texto final.
 *
 * Campos verificados:
 *  - "Comparáveis levantados: X — usados: Y — excluídos: Z" (aritmética X = Y + Z)
 *  - Rótulo da tabela "N DE M" x linhas realmente impressas
 *  - Números citados nos textos (metodologia, destaque, concorrência) = usados
 */
import { describe, it, expect } from "vitest";
import { exportAvaliacaoPremiumPDF, MAX_COMPARAVEIS_PDF, prepararComparaveis } from "./exportAvaliacaoPremiumPDF";

async function textoDoPdf(bytes: Uint8Array): Promise<string> {
  const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // Sem worker: extração roda na própria thread do teste.
  const { pathToFileURL } = await import("node:url");
  const { resolve } = await import("node:path");
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
    resolve(process.cwd(), "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"),
  ).href;
  const doc = await pdfjs.getDocument({ data: bytes, useSystemFonts: true, isEvalSupported: false }).promise;
  const partes: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    partes.push(content.items.map((it: any) => it.str).join(" "));
  }
  return partes.join("\n").replace(/\s+/g, " ");
}

const imovel = {
  tipo: "Apartamento",
  titulo: "Apartamento de verificação",
  endereco: "SQN 210, Bloco A",
  bairro: "Asa Norte",
  cidade: "Brasília",
  estado: "DF",
  area: 78,
  quartos: 3,
  vagas: 1,
  preco: 890_000,
  fotos: [],
};

const avaliacao = {
  valor_ideal: 870_000,
  valor_minimo: 830_000,
  valor_maximo: 910_000,
  preco_m2_estimado: 11_150,
  score_liquidez: 72,
  preco_competitivo: true,
  rating_ia: 8.4,
  pontos_fortes: ["Localização consolidada", "Reformado"],
  pontos_atencao: ["Condomínio acima da média"],
  estrategia: "Anunciar no valor ideal.",
};

const comp = (i: number, over: Record<string, unknown> = {}) => ({
  titulo: `Comparável ${i}`,
  area: 60 + (i % 5) * 4,
  preco: 480_000 + i * 12_000,
  dias_anuncio: 15 + i * 4,
  ...over,
});

async function gerarTexto(comparaveis: any[]) {
  const doc = await exportAvaliacaoPremiumPDF({
    imovel: imovel as never,
    avaliacao: avaliacao as never,
    comparaveis: comparaveis as never,
    brandName: "radarimobtech",
    corretorInfo: { nome: "CI", creci: "0000" },
    skipSave: true,
  });
  return textoDoPdf(new Uint8Array(doc.output("arraybuffer")));
}

/** Cenários: nome → lista de comparáveis (com duplicados e dados inválidos). */
const cenarios: Array<{ nome: string; lista: any[] }> = [
  { nome: "3 válidos", lista: [comp(1), comp(2), comp(3)] },
  { nome: "12 válidos", lista: Array.from({ length: 12 }, (_, i) => comp(i + 1)) },
  {
    nome: "com duplicado e dado inválido",
    lista: [comp(1), comp(1), comp(2), comp(3, { preco: 0 }), comp(4, { area: 0 }), comp(5)],
  },
  {
    nome: "acima do limite (20)",
    lista: Array.from({ length: 20 }, (_, i) => comp(i + 1)),
  },
];

describe("PDF renderizado — campos críticos de comparáveis", () => {
  it.each(cenarios)("$nome: levantados × usados × excluídos batem no PDF", async ({ lista }) => {
    const { usados, excluidos, totalBruto } = prepararComparaveis(lista);
    const texto = await gerarTexto(lista);

    const linha = /COMPAR[ÁA]VEIS\s+LEVANTADOS:\s*(\d+)\s*[—–\-/·]?\s*USADOS:\s*(\d+)\s*[—–\-/·]?\s*EXCLU[ÍI]DOS:\s*(\d+)/i.exec(texto);
    expect(linha, `linha de transparência ausente no PDF:\n${texto.slice(0, 400)}`).toBeTruthy();

    const [lev, us, ex] = [Number(linha![1]), Number(linha![2]), Number(linha![3])];
    expect(lev).toBe(totalBruto);
    expect(us).toBe(usados.length);
    expect(ex).toBe(excluidos.length);
    expect(lev).toBe(us + ex);
  }, 60_000);

  it.each(cenarios)("$nome: rótulo 'X DE Y' bate com as linhas impressas", async ({ lista }) => {
    const { usados } = prepararComparaveis(lista);
    const exibidos = Math.min(usados.length, MAX_COMPARAVEIS_PDF);
    const texto = await gerarTexto(lista);

    const rotulo = /IMÓVEIS SEMELHANTES ANUNCIADOS\s*(\d+)\s*DE\s*(\d+)/i.exec(texto);
    expect(rotulo, "rótulo da tabela ausente no PDF").toBeTruthy();
    expect(Number(rotulo![1])).toBe(exibidos);
    expect(Number(rotulo![2])).toBe(usados.length);

    const linhas = [...texto.matchAll(/\b(\d{1,2})\.\s+Comparável\s+\d+\s+\d+\s*m²/g)].map((m) => Number(m[1]));
    expect(linhas.length).toBe(exibidos);
    if (exibidos > 0) expect(Math.max(...linhas)).toBe(exibidos);
  }, 60_000);

  it.each(cenarios)("$nome: números citados no texto = comparáveis usados", async ({ lista }) => {
    const { usados } = prepararComparaveis(lista);
    const texto = await gerarTexto(lista);

    const citados = [...texto.matchAll(/(\d+)\s+imóveis\s+(?:semelhantes|comparáveis)/gi)].map((m) => Number(m[1]));
    expect(citados.length, "nenhuma citação numérica encontrada no PDF").toBeGreaterThanOrEqual(3);
    for (const n of citados) expect(n).toBe(usados.length);
  }, 60_000);

  it("não imprime placeholders (undefined/NaN/[object Object]) no PDF renderizado", async () => {
    const texto = await gerarTexto(cenarios[1].lista);
    expect(texto).not.toMatch(/\b(undefined|NaN)\b/);
    expect(texto).not.toContain("[object Object]");
  }, 60_000);
});
