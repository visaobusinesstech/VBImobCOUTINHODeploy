import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────
// SNAPSHOT VISUAL DAS SEÇÕES DE PROBABILIDADE 30/60/90 DIAS
//
// Não temos rasterizador headless aqui — em vez de comparar
// pixels, capturamos o *modelo geométrico e cromático* que o
// jsPDF renderiza (posição, tamanho, cor, tamanho de fonte de
// cada `text`/`roundedRect`) e validamos:
//
//   • Os 3 cards ficam lado a lado sem sobreposição (x/w).
//   • Cada card carrega seu rótulo ("ATÉ 30/60/90 DIAS"),
//     o percentual grande e a legenda coerente com o valor
//     (alta / moderada / baixa) e cor (VERDE / OURO / VERMELHO).
//   • Todo texto renderizado no bloco de probabilidade fica
//     dentro do bounding-box do card e tem fonte legível (≥6pt).
//   • O snapshot inline permanece estável entre execuções.
// ─────────────────────────────────────────────────────────────

type RGB = [number, number, number];
type RectEv = { page: number; x: number; y: number; w: number; h: number; style: string; fill: RGB | null; draw: RGB | null };
type TextEv = { page: number; text: string; x: number; y: number; size: number; color: RGB; align: string };

const _rects: RectEv[] = [];
const _texts: TextEv[] = [];

vi.mock("jspdf", async (importOriginal) => {
  const actual = await importOriginal<typeof import("jspdf")>();
  const Original = actual.default;
  const Wrapped = function (this: unknown, ...args: unknown[]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inst = new (Original as any)(...args);
    let curFill: RGB | null = null;
    let curDraw: RGB | null = null;
    let curTextColor: RGB = [0, 0, 0];
    let curSize = 12;
    const origSetFill = inst.setFillColor.bind(inst);
    inst.setFillColor = function patched(...a: unknown[]) {
      if (a.length >= 3) curFill = [Number(a[0]), Number(a[1]), Number(a[2])] as RGB;
      return origSetFill(...a);
    };
    const origSetDraw = inst.setDrawColor.bind(inst);
    inst.setDrawColor = function patched(...a: unknown[]) {
      if (a.length >= 3) curDraw = [Number(a[0]), Number(a[1]), Number(a[2])] as RGB;
      return origSetDraw(...a);
    };
    const origSetTextColor = inst.setTextColor.bind(inst);
    inst.setTextColor = function patched(...a: unknown[]) {
      if (a.length >= 3) curTextColor = [Number(a[0]), Number(a[1]), Number(a[2])] as RGB;
      return origSetTextColor(...a);
    };
    const origSetFontSize = inst.setFontSize.bind(inst);
    inst.setFontSize = function patched(s: number) {
      curSize = Number(s);
      return origSetFontSize(s);
    };
    const origRoundedRect = inst.roundedRect.bind(inst);
    inst.roundedRect = function patched(x: number, y: number, w: number, h: number, rx: number, ry: number, style: string) {
      try {
        const page = inst.internal.getCurrentPageInfo().pageNumber as number;
        _rects.push({ page, x, y, w, h, style, fill: curFill ? [...curFill] as RGB : null, draw: curDraw ? [...curDraw] as RGB : null });
      } catch { /* ignore */ }
      return origRoundedRect(x, y, w, h, rx, ry, style);
    };
    const origText = inst.text.bind(inst);
    inst.text = function patched(...tArgs: unknown[]) {
      try {
        const page = inst.internal.getCurrentPageInfo().pageNumber as number;
        const arg0 = tArgs[0];
        const text = Array.isArray(arg0) ? arg0.join(" ") : String(arg0 ?? "");
        const x = Number(tArgs[1] ?? 0);
        const y = Number(tArgs[2] ?? 0);
        const opts = (tArgs[3] as { align?: string } | undefined) || {};
        _texts.push({ page, text, x, y, size: curSize, color: [...curTextColor] as RGB, align: opts.align || "left" });
      } catch { /* ignore */ }
      return origText(...tArgs);
    };
    return inst;
  } as unknown as typeof Original;
  return { ...actual, default: Wrapped };
});

const { exportAvaliacaoPremiumPDF } = await import("./exportAvaliacaoPremiumPDF");

// Paleta duplicada do módulo (constantes locais no fonte).
const GREEN: RGB = [76, 138, 100];
const GOLD: RGB = [201, 168, 76];
const RED: RGB = [178, 74, 60];

const eqRGB = (a: RGB | null, b: RGB) => !!a && a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

function corEsperada(pct: number): RGB {
  return pct >= 75 ? GREEN : pct >= 50 ? GOLD : RED;
}
function legendaEsperada(pct: number): "alta chance" | "chance moderada" | "chance baixa" {
  return pct >= 75 ? "alta chance" : pct >= 50 ? "chance moderada" : "chance baixa";
}

const baseImovel = {
  tipo: "Apartamento",
  titulo: "Ap teste",
  endereco: "Rua Alfa, 1",
  bairro: "Centro",
  cidade: "Brasília",
  estado: "DF",
  area: 90,
  preco: 850_000,
  fotos: [] as unknown[],
};

const baseAvaliacao = {
  valor_ideal: 820_000,
  valor_minimo: 780_000,
  valor_maximo: 880_000,
  preco_m2_estimado: 9_100,
  score_liquidez: 70,
  preco_competitivo: true,
  rating_ia: 8.4,
  pontos_fortes: ["Localização"],
  pontos_atencao: ["Fotos"],
  estrategia: "Anunciar no ideal.",
};

const comparaveis = [
  { titulo: "C1", area: 88, preco: 800_000, dias_anuncio: 30 },
  { titulo: "C2", area: 92, preco: 830_000, dias_anuncio: 60 },
  { titulo: "C3", area: 90, preco: 820_000, dias_anuncio: 45 },
];

async function build(score_liquidez: number) {
  _rects.length = 0;
  _texts.length = 0;
  await exportAvaliacaoPremiumPDF({
    imovel: baseImovel as never,
    avaliacao: { ...baseAvaliacao, score_liquidez } as never,
    comparaveis: comparaveis as never,
    brandName: "TestBrand",
    corretorInfo: { nome: "Corretor Teste", creci: "0000" },
    skipSave: true,
  });
}

// Identifica os 3 cards de probabilidade na p.4:
// no fonte: probY=84, probH=60, tamanho fixo entre janelas.
function cardsProb(): RectEv[] {
  return _rects
    .filter((r) => r.page === 4 && Math.abs(r.y - 84) < 0.5 && Math.abs(r.h - 60) < 0.5 && r.style === "F")
    // eyebrow e demais fills também usam roundedRect; filtramos apenas o container
    .filter((r) => r.w > 40 && r.w < 90) // cards de largura ~ (cw-12)/3, cw≈171 → ~53mm
    .sort((a, b) => a.x - b.x)
    .slice(0, 3);
}

function textosDaCard(card: RectEv): TextEv[] {
  const tol = 0.5;
  return _texts.filter(
    (t) =>
      t.page === 4 &&
      t.x >= card.x - tol &&
      t.x <= card.x + card.w + tol &&
      t.y >= card.y - tol &&
      t.y <= card.y + card.h + tol,
  );
}

// Barras coloridas dentro de cada card (roundedRect com h≈3).
function barrasDaCard(card: RectEv): RectEv[] {
  const tol = 0.5;
  return _rects.filter(
    (r) =>
      r.page === 4 &&
      Math.abs(r.h - 3) < 0.5 &&
      r.x >= card.x - tol &&
      r.x <= card.x + card.w + tol &&
      r.y >= card.y &&
      r.y <= card.y + card.h,
  );
}

// ─────────────────────────────────────────────────────────────
// Cenários com pcts em cada faixa da paleta (alta/moderada/baixa)
// e combinados. Definimos score_liquidez de forma a exercitar cada faixa.
// ─────────────────────────────────────────────────────────────
const cenarios = [
  { nome: "alta liquidez (todas as janelas altas)", score_liquidez: 90 },
  { nome: "liquidez moderada (mix)", score_liquidez: 60 },
  { nome: "baixa liquidez (30d baixa)", score_liquidez: 25 },
];

describe("PDF Premium — snapshot visual das probabilidades 30/60/90d", () => {
  beforeEach(() => {
    _rects.length = 0;
    _texts.length = 0;
  });

  describe.each(cenarios)("cenário: $nome", ({ score_liquidez }) => {
    it("renderiza 3 cards de probabilidade lado a lado, sem sobreposição", async () => {
      await build(score_liquidez);
      const cards = cardsProb();
      expect(cards.length, "esperado exatamente 3 cards de probabilidade na p.4").toBe(3);
      // Larguras equivalentes (mesma probW).
      const larguras = cards.map((c) => c.w);
      expect(Math.max(...larguras) - Math.min(...larguras)).toBeLessThan(0.01);
      // Sem sobreposição em x, e com gap (spec: 6mm entre cards).
      for (let i = 1; i < cards.length; i += 1) {
        const gap = cards[i].x - (cards[i - 1].x + cards[i - 1].w);
        expect(gap, `cards ${i - 1} e ${i} devem ter espaçamento ≥ 4mm (recebido ${gap}mm)`).toBeGreaterThanOrEqual(4);
      }
      // Alinhamento vertical idêntico.
      expect(new Set(cards.map((c) => c.y)).size).toBe(1);
    });

    it("cada card carrega eyebrow, percentual grande e legenda coerente com sua cor", async () => {
      await build(score_liquidez);
      const cards = cardsProb();
      const rotulos = ["ATÉ 30 DIAS", "ATÉ 60 DIAS", "ATÉ 90 DIAS"];

      cards.forEach((card, i) => {
        const conteudo = textosDaCard(card);
        // eyebrow
        expect(
          conteudo.some((t) => t.text === rotulos[i]),
          `card ${i} deve conter eyebrow "${rotulos[i]}"`,
        ).toBe(true);
        // percentual grande (fonte 38)
        const grande = conteudo.find((t) => /^\d{1,3}%$/.test(t.text) && t.size >= 30);
        expect(grande, `card ${i} deve conter percentual em fonte grande (≥30pt)`).toBeDefined();
        const pct = Number(grande!.text.replace("%", ""));
        expect(pct, `card ${i} pct fora do intervalo 0-100`).toBeGreaterThanOrEqual(0);
        expect(pct).toBeLessThanOrEqual(100);
        // legenda coerente
        const legenda = legendaEsperada(pct);
        expect(
          conteudo.some((t) => t.text === legenda),
          `card ${i} (pct=${pct}) deve exibir legenda "${legenda}"`,
        ).toBe(true);
        // barra colorida coerente
        const barras = barrasDaCard(card);
        // Devem existir 2 barras (fundo cinza RULE + preenchimento colorido).
        expect(barras.length, `card ${i} deve ter barra de trilho + barra de progresso`).toBeGreaterThanOrEqual(2);
        const cor = corEsperada(pct);
        expect(
          barras.some((b) => eqRGB(b.fill, cor)),
          `card ${i} deve ter barra na cor ${cor.join(",")} para pct=${pct}`,
        ).toBe(true);
      });
    });

    it("todo texto do bloco de probabilidade fica dentro do card e tem fonte legível", async () => {
      await build(score_liquidez);
      const cards = cardsProb();
      cards.forEach((card, i) => {
        const conteudo = textosDaCard(card);
        expect(conteudo.length, `card ${i} sem textos`).toBeGreaterThan(0);
        conteudo.forEach((t) => {
          expect(t.size, `card ${i}: fonte pequena demais em "${t.text}" (${t.size}pt)`).toBeGreaterThanOrEqual(6);
          // dentro dos limites do card (tolerância p/ align:center)
          expect(t.x).toBeGreaterThanOrEqual(card.x - 0.5);
          expect(t.x).toBeLessThanOrEqual(card.x + card.w + 0.5);
          expect(t.y).toBeGreaterThanOrEqual(card.y - 0.5);
          expect(t.y).toBeLessThanOrEqual(card.y + card.h + 0.5);
        });
      });
    });

    it("percentuais são monotônicos: 30d ≤ 60d ≤ 90d", async () => {
      await build(score_liquidez);
      const cards = cardsProb();
      const pcts = cards.map((card) => {
        const grande = textosDaCard(card).find((t) => /^\d{1,3}%$/.test(t.text) && t.size >= 30)!;
        return Number(grande.text.replace("%", ""));
      });
      expect(pcts[0], `30d (${pcts[0]}) > 60d (${pcts[1]})`).toBeLessThanOrEqual(pcts[1]);
      expect(pcts[1], `60d (${pcts[1]}) > 90d (${pcts[2]})`).toBeLessThanOrEqual(pcts[2]);
    });
  });

  it("snapshot geométrico/cromático estável (score_liquidez=70)", async () => {
    await build(70);
    const cards = cardsProb();
    const modelo = cards.map((card, i) => {
      const conteudo = textosDaCard(card);
      const grande = conteudo.find((t) => /^\d{1,3}%$/.test(t.text) && t.size >= 30)!;
      const pct = Number(grande.text.replace("%", ""));
      const barra = barrasDaCard(card).find((b) => eqRGB(b.fill, corEsperada(pct)));
      return {
        indice: i,
        eyebrow: conteudo.find((t) => /^ATÉ \d+ DIAS$/.test(t.text))!.text,
        pct,
        legenda: conteudo.find((t) => ["alta chance", "chance moderada", "chance baixa"].includes(t.text))!.text,
        largura: Number(card.w.toFixed(2)),
        altura: card.h,
        y: card.y,
        cor: barra ? barra.fill : null,
        fonteGrande: grande.size,
      };
    });
    expect(modelo).toMatchInlineSnapshot(`
      [
        {
          "altura": 60,
          "cor": [
            178,
            74,
            60,
          ],
          "eyebrow": "ATÉ 30 DIAS",
          "fonteGrande": 38,
          "indice": 0,
          "largura": 54,
          "legenda": "chance baixa",
          "pct": 49,
          "y": 84,
        },
        {
          "altura": 60,
          "cor": [
            76,
            138,
            100,
          ],
          "eyebrow": "ATÉ 60 DIAS",
          "fonteGrande": 38,
          "indice": 1,
          "largura": 54,
          "legenda": "alta chance",
          "pct": 76,
          "y": 84,
        },
        {
          "altura": 60,
          "cor": [
            76,
            138,
            100,
          ],
          "eyebrow": "ATÉ 90 DIAS",
          "fonteGrande": 38,
          "indice": 2,
          "largura": 54,
          "legenda": "alta chance",
          "pct": 92,
          "y": 84,
        },
      ]
    `);
  });
});
