import { describe, it, expect, beforeAll } from "vitest";
import { exportAvaliacaoPremiumPDF } from "./exportAvaliacaoPremiumPDF";

// ─────────────────────────────────────────────────────────────
// CONSISTÊNCIA DE FORMATAÇÃO — TODAS AS PÁGINAS
//
// Este teste gera o PDF Premium, extrai o texto de todas as
// páginas via pdfjs e valida que qualquer ocorrência de:
//
//   • moeda (R$ 815.000)
//   • percentual (72%, 12.5%, +1.4%, −8pp)
//   • tempo estimado em dias (75 dias, ~120 dias)
//
// segue exatamente o mesmo padrão de arredondamento e separador
// pt-BR em todo o relatório — nada de vírgula onde deveria ser
// ponto, nada de "R$815000" grudado, nada de "72.0%" em uma
// página e "72%" em outra, nada de "75.3 dias".
//
// A justificativa é que valores mostrados na capa, na página 3
// (preço recomendado), 4 (probabilidade), 5 (mercado), 6
// (comparáveis) e 9 (conclusão) precisam falar a mesma língua
// visual — regressões silenciosas em qualquer helper de
// formatação são bloqueadas aqui.
// ─────────────────────────────────────────────────────────────

type Item = { str: string; page: number };

async function extractAll(bytes: Uint8Array): Promise<Item[]> {
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
      getTextContent: () => Promise<{ items: Array<{ str: string }> }>;
    }>;
  };
  const out: Item[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const content = await (await pdf.getPage(p)).getTextContent();
    for (const it of content.items) {
      if (typeof it.str === "string" && it.str.trim().length > 0) {
        out.push({ str: it.str, page: p });
      }
    }
  }
  return out;
}

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
  preco_m2_estimado: 8_858,
  pontos_fortes: ["Localização privilegiada", "Sol da manhã"],
  pontos_atencao: ["Fotos escuras"],
  comparaveis_gerados: [],
};
const comparaveis = Array.from({ length: 6 }, (_, i) => ({
  titulo: `Comp ${i + 1}`,
  area: 88 + i,
  preco: 780_000 + i * 12_000,
  dias_anuncio: 22 + i * 14,
}));

let TEXT: string;
let LINES: Item[];

beforeAll(async () => {
  const doc = await exportAvaliacaoPremiumPDF({
    imovel,
    avaliacao,
    comparaveis,
    brandName: "FormatBrand",
    corretorInfo: { nome: "Corretor Teste" },
    skipSave: true,
  });
  const ab = (doc as { output: (t: string) => ArrayBuffer }).output("arraybuffer");
  LINES = await extractAll(new Uint8Array(ab));
  // Normaliza NBSP (\u00A0) → espaço comum para regex e junta
  // pedaços que o pdfjs quebra ("R$" + "\u00A0" + "815.000").
  TEXT = LINES.map((l) => l.str.replace(/\u00A0/g, " ")).join(" ");
}, 60_000);

// ─── helpers ─────────────────────────────────────────────────
const findAll = (rx: RegExp): string[] => {
  const m = TEXT.match(rx);
  return m ? Array.from(m) : [];
};

describe("PDF Premium · consistência de formatação (moeda / % / dias)", () => {
  // ═══════════════════════ MOEDA ═══════════════════════
  describe("moeda (R$)", () => {
    it("todo valor 'R$' segue pt-BR canônico: R$ 000.000 (sem centavos, ponto como separador de milhar)", () => {
      // Captura qualquer sequência iniciada por "R$" seguida do valor.
      // Aceita espaço regular ou NBSP (já normalizado acima) e ponto ou
      // vírgula (para pegar defeitos).
      const rx = /R\$\s?\d{1,3}(?:\.\d{3})*(?:\/m²)?/g;
      const ocorrencias = findAll(rx);
      expect(ocorrencias.length, "esperados vários valores R$ no PDF").toBeGreaterThan(5);

      // Padrão aceito:
      //   R$ 780.000          → moeda inteira
      //   R$ 8.858/m²         → preço por m²
      //   R$ 780.000 —        → seguido de traço em faixa
      // Padrão proibido:
      //   R$780.000  (sem espaço)
      //   R$ 780,000 (vírgula como milhar)
      //   R$ 780.000,00 (centavos)
      //   R$ 780000   (sem separador em valor ≥ 1000)
      const ok = /^R\$ (?:\d{1,3}(?:\.\d{3})+|\d{1,3})(?:\/m²)?$/;
      for (const raw of ocorrencias) {
        const v = raw.trim().replace(/\s+/g, " ");
        expect(ok.test(v), `formato inválido: "${v}"`).toBe(true);
        expect(v).not.toMatch(/,\d{2}\b/); // sem centavos
        expect(v).not.toMatch(/^R\$\d/); // sem espaço após R$
      }
    });

    it("não existe 'R$' seguido de valor com centavos em nenhuma página", () => {
      // Regressão histórica: split de decimais quebra alinhamento tipográfico.
      expect(TEXT).not.toMatch(/R\$\s?\d[\d.]*,\d{2}/);
    });

    it("valores grandes (≥ 1.000) sempre usam ponto como separador de milhar", () => {
      const inteiros = findAll(/R\$\s?\d+/g)
        .map((s) => s.replace(/R\$\s?/, ""))
        .filter((s) => !s.includes(".") && Number(s) >= 1000);
      expect(
        inteiros,
        `valores >= 1000 sem separador de milhar: ${JSON.stringify(inteiros)}`,
      ).toHaveLength(0);
    });

    it("o preço recomendado formatado é idêntico em capa (p.1), destaque (p.3) e conclusão (p.9)", () => {
      const rx = /R\$\s?815\.000\b/;
      const paginasComPreco = new Set(
        LINES.filter((l) => rx.test(l.str.replace(/\u00A0/g, " ")))
          // Alguns runners de pdfjs quebram "R$" e "815.000" em dois
          // itens, então também recompomos linha a linha por página.
          .map((l) => l.page),
      );
      // Reconstrói por página, agregando strings da mesma página.
      const porPagina = new Map<number, string>();
      for (const l of LINES) {
        const s = (porPagina.get(l.page) || "") + " " + l.str.replace(/\u00A0/g, " ");
        porPagina.set(l.page, s);
      }
      for (const [p, s] of porPagina) if (rx.test(s)) paginasComPreco.add(p);

      // Deve aparecer nas páginas de referência.
      for (const alvo of [1, 3, 9]) {
        expect(
          paginasComPreco.has(alvo),
          `preço recomendado R$ 815.000 ausente na página ${alvo}`,
        ).toBe(true);
      }
    });
  });

  // ═══════════════════════ PERCENTUAIS ═══════════════════════
  describe("percentuais (%)", () => {
    it("percentuais inteiros do painel de probabilidade não têm casa decimal", () => {
      // Percentuais de probabilidade (p.4) devem ser inteiros —
      // formatPct usa digits=0 por padrão.
      const pctInteiros = findAll(/\b\d{1,3}%/g);
      expect(pctInteiros.length).toBeGreaterThan(3);
      // Nenhum percentual "inteiro" pode aparecer como "72.0%".
      expect(TEXT).not.toMatch(/\b\d{1,3}\.0%/);
    });

    it("percentuais com decimal (diff vs mercado) usam exatamente 1 casa e ponto como separador", () => {
      // diffPct.toFixed(1) na página 5 → padrão "+1.4%" ou "-8.2%".
      // Aceito: um ou nenhum sinal, 1..3 dígitos, ponto, 1 dígito, %.
      const comDecimal = findAll(/[+-−]?\s?\d{1,3}\.\d%/g);
      for (const p of comDecimal) {
        expect(p, `percentual com decimal fora do padrão: "${p}"`).toMatch(
          /^[+-−]?\s?\d{1,3}\.\d%$/,
        );
      }
      // Não pode haver vírgula em percentuais decimais.
      expect(TEXT).not.toMatch(/\d,\d%/);
      // Não pode haver duas ou mais casas decimais.
      expect(TEXT).not.toMatch(/\d\.\d{2,}%/);
    });

    it("percentuais estão dentro da faixa 0..100 (ou -100..+100 quando com sinal)", () => {
      const todos = findAll(/[+-−]?\d{1,3}(?:\.\d)?%/g);
      expect(todos.length).toBeGreaterThan(3);
      for (const p of todos) {
        const sinal = /^[-−]/.test(p) ? -1 : 1;
        const num = sinal * Number(p.replace(/[^\d.]/g, ""));
        expect(Number.isFinite(num), `percentual não numérico: "${p}"`).toBe(true);
        expect(Math.abs(num), `percentual fora da faixa: "${p}"`).toBeLessThanOrEqual(100);
      }
    });
  });

  // ═══════════════════════ TEMPO / DIAS ═══════════════════════
  describe("tempo estimado (dias)", () => {
    it("todo 'N dias' usa inteiro, espaço simples e nunca casa decimal", () => {
      // Padrões produzidos: "30 dias", "75 dias", "mediana de 60 dias",
      // "~120 dias" (conclusão). Nenhum "75.3 dias" ou "75,3 dias".
      const rx = /~?\s?\d+(?:[.,]\d+)?\s*dias\b/g;
      const ocorrencias = findAll(rx);
      expect(ocorrencias.length, "esperados vários 'N dias' no PDF").toBeGreaterThan(3);
      for (const raw of ocorrencias) {
        expect(raw, `formato inválido: "${raw}"`).toMatch(/^~?\s?\d+\s?dias$/);
        expect(raw).not.toMatch(/[.,]\d/); // sem decimais
      }
    });

    it("nenhum 'dias' aparece grudado ao número ('75dias')", () => {
      expect(TEXT).not.toMatch(/\d+dias\b/);
    });

    it("as três janelas de probabilidade (30/60/90 dias) aparecem na página 4", () => {
      const p4 = LINES.filter((l) => l.page === 4)
        .map((l) => l.str.replace(/\u00A0/g, " "))
        .join(" ");
      for (const dias of [30, 60, 90]) {
        expect(p4, `janela de ${dias} dias ausente na p.4`).toMatch(
          new RegExp(`AT[ÉE]\\s*${dias}\\s*DIAS`, "i"),
        );
      }
    });

    it("o tempo estimado (`~N dias até 75%…`) aparece na página 9 e é inteiro", () => {
      const p9 = LINES.filter((l) => l.page === 9)
        .map((l) => l.str.replace(/\u00A0/g, " "))
        .join(" ");
      const match = p9.match(/~?\s?(\d+)\s?dias\s+at[ée]\s+75%/i);
      expect(match, "linha '~N dias até 75%' ausente na p.9").toBeTruthy();
      const dias = Number(match![1]);
      expect(Number.isInteger(dias)).toBe(true);
      expect(dias).toBeGreaterThan(0);
      expect(dias).toBeLessThan(365);
    });
  });

  // ═══════════════════════ RESUMO GLOBAL ═══════════════════════
  it("nenhuma métrica exibe 'NaN', 'undefined' ou 'null' em qualquer página", () => {
    for (const proibido of [/\bNaN\b/, /\bundefined\b/, /\bnull\b/]) {
      expect(TEXT, `token proibido encontrado: ${proibido}`).not.toMatch(proibido);
    }
  });
});
