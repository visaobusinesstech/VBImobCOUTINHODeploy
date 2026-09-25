import { describe, it, expect, vi, beforeAll } from "vitest";

// ─────────────────────────────────────────────────────────────
// Garantia: o preço recomendado NÃO vaza para elementos globais
// (cabeçalho / rodapé) nem para "caixas coladas" nas bordas de
// nenhuma página do PDF Premium. Ele deve aparecer apenas em
// posições editoriais previstas (hero da capa, destaque da p.3,
// recap da conclusão e frases contextuais no corpo).
// ─────────────────────────────────────────────────────────────

type Rec = { page: number; text: string; size: number; x: number; y: number };
const _texts: Rec[] = [];
let _pw = 210;
let _ph = 297;

vi.mock("jspdf", async (importOriginal) => {
  const actual = await importOriginal<typeof import("jspdf")>();
  const Original = actual.default;
  const Wrapped = function (this: unknown, ...args: unknown[]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inst = new (Original as any)(...args);
    _pw = inst.internal.pageSize.getWidth();
    _ph = inst.internal.pageSize.getHeight();
    let curSize = 12;
    const origSize = inst.setFontSize.bind(inst);
    inst.setFontSize = function patched(s: number) {
      curSize = Number(s);
      return origSize(s);
    };
    const origText = inst.text.bind(inst);
    inst.text = function patched(...tArgs: unknown[]) {
      try {
        const page = inst.internal.getCurrentPageInfo().pageNumber as number;
        const arg0 = tArgs[0];
        const text = Array.isArray(arg0) ? arg0.join(" ") : String(arg0 ?? "");
        const x = Number(tArgs[1] ?? 0);
        const y = Number(tArgs[2] ?? 0);
        _texts.push({ page, text, size: curSize, x, y });
      } catch { /* ignore */ }
      return origText(...tArgs);
    };
    return inst;
  } as unknown as typeof Original;
  return { ...actual, default: Wrapped };
});

const { exportAvaliacaoPremiumPDF } = await import("./exportAvaliacaoPremiumPDF");

const PRECO = 987_000;
const alvo = Number(PRECO).toLocaleString("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});
const norm = (s: string) => s.replace(/\u00A0/g, " ");
const alvoN = norm(alvo);
// Também qualquer moeda "R$ 123.456" — para detectar QUALQUER preço vazando.
const anyBRL = /R\$[\s\u00A0]\d{1,3}(?:\.\d{3})+(?:,\d{2})?/;

beforeAll(async () => {
  _texts.length = 0;
  await exportAvaliacaoPremiumPDF({
    imovel: {
      tipo: "Apartamento",
      titulo: "Ap teste",
      endereco: "Rua Alfa, 1",
      bairro: "Centro",
      cidade: "Brasília",
      estado: "DF",
      area: 90,
      preco: 900_000,
      fotos: [],
    } as never,
    avaliacao: {
      valor_ideal: PRECO,
      valor_minimo: Math.round(PRECO * 0.94),
      valor_maximo: Math.round(PRECO * 1.08),
      preco_m2_estimado: 10_000,
      score_liquidez: 70,
      preco_competitivo: true,
      rating_ia: 8,
      pontos_fortes: ["Localização"],
      pontos_atencao: ["Fotos"],
      estrategia: "ok",
    } as never,
    comparaveis: [
      { titulo: "C1", area: 88, preco: 900_000, dias_anuncio: 30 },
      { titulo: "C2", area: 92, preco: 970_000, dias_anuncio: 60 },
    ] as never,
    brandName: "TestBrand",
    corretorInfo: { nome: "Corretor", creci: "0" },
    skipSave: true,
  });
});

describe("PDF Premium — preço não vaza para chrome global", () => {
  // Bandas do chrome, conforme implementação (header y=11, rule y=14 · footer y=ph-7, rule y=ph-12).
  const HEADER_MAX_Y = 15;   // qualquer texto com y ≤ 15mm é considerado header
  const FOOTER_MIN_Y = _ph - 13; // qualquer texto com y ≥ ph-13mm é rodapé

  it("nenhuma ocorrência do preço recomendado cai dentro da banda do cabeçalho", () => {
    const hits = _texts.filter((t) => norm(t.text).includes(alvoN) && t.y <= HEADER_MAX_Y);
    expect(hits, `preço vazando no header: ${JSON.stringify(hits)}`).toHaveLength(0);
  });

  it("nenhuma ocorrência do preço recomendado cai dentro da banda do rodapé", () => {
    const hits = _texts.filter((t) => norm(t.text).includes(alvoN) && t.y >= FOOTER_MIN_Y);
    expect(hits, `preço vazando no footer: ${JSON.stringify(hits)}`).toHaveLength(0);
  });

  it("nenhum valor monetário (R$ ...) aparece no header/footer de nenhuma página", () => {
    // Chrome global é puramente editorial (marca, versão, paginação, data). Nunca deve conter moeda.
    const chrome = _texts.filter((t) => t.y <= HEADER_MAX_Y || t.y >= FOOTER_MIN_Y);
    const vazando = chrome.filter((t) => anyBRL.test(t.text));
    expect(vazando, `moeda vazando em chrome: ${JSON.stringify(vazando)}`).toHaveLength(0);
  });

  it("chrome de todas as 9 páginas contém apenas os textos editoriais esperados", () => {
    // Sanidade: cada página tem header+footer, e nenhum deles casa com o padrão de moeda.
    const paginas = new Set(_texts.map((t) => t.page));
    expect(paginas.size).toBeGreaterThanOrEqual(9);
    for (const p of paginas) {
      const chrome = _texts.filter(
        (t) => t.page === p && (t.y <= HEADER_MAX_Y || t.y >= FOOTER_MIN_Y),
      );
      // Ao menos: marca no header + paginação no footer.
      expect(chrome.length, `p.${p} sem chrome`).toBeGreaterThan(0);
      for (const t of chrome) {
        expect(anyBRL.test(t.text), `p.${p} chrome contém moeda: "${t.text}"`).toBe(false);
        expect(norm(t.text).includes(alvoN), `p.${p} chrome contém preço recomendado: "${t.text}"`).toBe(false);
      }
    }
  });

  it("preço recomendado só aparece em bandas editoriais (nem topo nem base coladas)", () => {
    // Nenhuma ocorrência pode estar a menos de 3mm da borda superior/inferior útil do papel.
    const EDGE = 3;
    const colados = _texts.filter(
      (t) => norm(t.text).includes(alvoN) && (t.y < EDGE || t.y > _ph - EDGE),
    );
    expect(colados, `preço colado na borda: ${JSON.stringify(colados)}`).toHaveLength(0);
  });

  it("preço aparece em posições editoriais previstas (capa, p.3, p.9) mas nunca em faixa de chrome dessas mesmas páginas", () => {
    const ocorrencias = _texts.filter((t) => norm(t.text).includes(alvoN));
    expect(ocorrencias.length, "preço deve aparecer no PDF").toBeGreaterThan(0);
    const paginasComPreco = new Set(ocorrencias.map((t) => t.page));
    // Deve estar nas âncoras conhecidas.
    for (const p of [1, 3, 9]) {
      expect(paginasComPreco.has(p), `preço ausente na p.${p}`).toBe(true);
    }
    // Todas as ocorrências ficam FORA das bandas de chrome.
    for (const t of ocorrencias) {
      expect(t.y).toBeGreaterThan(HEADER_MAX_Y);
      expect(t.y).toBeLessThan(FOOTER_MIN_Y);
    }
  });
});
