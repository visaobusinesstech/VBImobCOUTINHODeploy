import { describe, it, expect, beforeAll } from "vitest";
import { exportAvaliacaoPremiumPDF } from "./exportAvaliacaoPremiumPDF";

// ─────────────────────────────────────────────────────────────
// AUDITORIA DE NÃO-REPETIÇÃO — PDF Premium
//
// Cada uma das 9 seções tem marcadores-chave (kicker + título)
// que devem ser EXCLUSIVOS da seção. Se um dia alguém copiar e
// colar wording entre páginas ou renomear duas seções com o
// mesmo termo, este teste falha e força a decisão consciente:
// renomear ou tornar o marcador realmente único.
//
// A auditoria é baseada no TEXTO EXTRAÍDO do PDF real, então
// pega qualquer regressão de wording independente do código.
// ─────────────────────────────────────────────────────────────

async function parsePdfText(bytes: Uint8Array): Promise<string[]> {
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
      getTextContent: () => Promise<{ items: Array<{ str: string }> }>;
    }>;
  };
  const out: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const raw = content.items
      .filter((it) => typeof it.str === "string")
      .map((it) => it.str)
      .join(" ");
    // Normaliza espaços, NBSP e casefolding para a auditoria.
    const norm = raw
      .replace(/[\u00A0\u202F]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    out.push(norm);
  }
  return out;
}

const imovel = {
  tipo: "Apartamento",
  endereco: "Rua Auditoria, 45",
  bairro: "Vila Olímpia",
  cidade: "São Paulo",
  estado: "SP",
  area: 88,
  preco: 1_050_000,
  fotos: [],
};
const avaliacao = {
  valor_ideal: 1_020_000,
  valor_minimo: 970_000,
  valor_maximo: 1_090_000,
  score_liquidez: 74,
  preco_m2_estimado: 11_590,
  rating_ia: 8.9,
  pontos_fortes: ["Localização", "Vaga dupla", "Andar alto"],
  pontos_atencao: ["Condomínio elevado", "Preço no teto"],
  estrategia: "Anunciar dentro da faixa recomendada.",
};
const comparaveis = [
  { titulo: "Comp A", area: 85, preco: 990_000, dias_anuncio: 25 },
  { titulo: "Comp B", area: 90, preco: 1_020_000, dias_anuncio: 40 },
  { titulo: "Comp C", area: 92, preco: 1_060_000, dias_anuncio: 60 },
];

// Marcadores exclusivos por seção. Precisamos de wording
// específico o bastante para não colidir com texto corrido de
// outras páginas — por isso NÃO usamos kickers curtos (uma
// palavra como "mercado" ou "concorrência" aparece em muitas
// páginas em contexto natural). Usamos SEMPRE os títulos
// completos e um rótulo distintivo adicional por seção.
type Marker = { pagina: number; secao: string; termo: string };
const marcadoresExclusivos: Marker[] = [
  { pagina: 1, secao: "Resumo Executivo · kicker",  termo: "resumo executivo" },
  { pagina: 1, secao: "Resumo Executivo · rótulo",  termo: "nota da ia" },
  { pagina: 2, secao: "Metodologia · título",        termo: "como a ia chegou neste valor" },
  { pagina: 2, secao: "Metodologia · gráfico",       termo: "peso de cada fator na análise" },
  { pagina: 3, secao: "Preço · estratégia rápida",   termo: "para venda mais rápida" },
  { pagina: 3, secao: "Preço · estratégia retorno",  termo: "para maior retorno" },
  { pagina: 4, secao: "Probabilidade · título",      termo: "chance de vender no preço recomendado" },
  { pagina: 5, secao: "Mercado · título",            termo: "como seu preço se compara à região" },
  { pagina: 5, secao: "Mercado · gráfico",           termo: "preços comparados" },
  { pagina: 6, secao: "Concorrência · título",       termo: "quem disputa a mesma venda" },
  { pagina: 6, secao: "Concorrência · tabela",       termo: "imóveis semelhantes anunciados" },
  { pagina: 7, secao: "Pontos Fortes · título",      termo: "pontos positivos do imóvel" },
  { pagina: 8, secao: "Desafios · título",           termo: "pontos que podem dificultar a venda" },
  { pagina: 9, secao: "Conclusão · título",          termo: "o que fazer com esta avaliação" },
  { pagina: 9, secao: "Conclusão · índice",          termo: "índice de confiança da ia" },
];

let paginas: string[];

beforeAll(async () => {
  const doc = await exportAvaliacaoPremiumPDF({
    imovel,
    avaliacao,
    comparaveis,
    brandName: "AuditBrand",
    corretorInfo: { nome: "Corretor Auditoria" },
    skipSave: true,
  });
  const ab = doc.output("arraybuffer") as ArrayBuffer;
  paginas = await parsePdfText(new Uint8Array(ab));
}, 60_000);

describe("PDF Premium — auditoria de não-repetição entre seções", () => {
  it("gera 9 páginas para a auditoria", () => {
    expect(paginas).toHaveLength(9);
  });

  it.each(marcadoresExclusivos)(
    "marcador «$termo» pertence apenas à p.$pagina ($secao)",
    ({ pagina, termo }) => {
      const paginasComTermo = paginas
        .map((txt, i) => (txt.includes(termo) ? i + 1 : 0))
        .filter((n) => n > 0);
      expect(
        paginasComTermo,
        `«${termo}» deveria aparecer só na p.${pagina}, mas apareceu em: ${paginasComTermo.join(", ") || "nenhuma"}`,
      ).toEqual([pagina]);
    },
  );

  it("nenhum par de páginas compartilha marcador-chave", () => {
    // Cruza todos os marcadores × páginas: se qualquer marcador for
    // encontrado em mais de uma página, listamos o conflito.
    const conflitos: string[] = [];
    for (const { pagina, termo, secao } of marcadoresExclusivos) {
      const encontros = paginas
        .map((txt, i) => (txt.includes(termo) ? i + 1 : 0))
        .filter((n) => n > 0);
      if (encontros.length !== 1 || encontros[0] !== pagina) {
        conflitos.push(
          `«${secao}» (marcador "${termo}") — esperado só p.${pagina}, encontrado em [${encontros.join(", ") || "vazio"}]`,
        );
      }
    }
    expect(conflitos, `Conflitos de marcadores entre seções:\n- ${conflitos.join("\n- ")}`).toEqual([]);
  });

  it("títulos exclusivos são distintos entre si (sem colisão de wording)", () => {
    const termos = marcadoresExclusivos.map((m) => m.termo);
    const set = new Set(termos);
    expect(
      set.size,
      `Marcadores duplicados detectados: ${termos.join(", ")}`,
    ).toBe(termos.length);
  });
});
