import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────
// FORMATAÇÃO E SINCRONIZAÇÃO DO PREÇO RECOMENDADO
//
// Verifica que o valor recomendado:
//   • é formatado no padrão pt-BR de moeda (R$, separador de
//     milhar ".", sem casas decimais, "R$" seguido de espaço não-quebrável);
//   • aparece EXATAMENTE COM A MESMA STRING no destaque tipográfico
//     grande (capa, p.3, conclusão) e nos textos que citam o valor
//     ao redor do selo/hero (ex.: "Se o imóvel for anunciado por …",
//     "o preço mais competitivo é …", faixa e recap final).
// ─────────────────────────────────────────────────────────────

const _texts: Array<{ page: number; text: string; size: number }> = [];

vi.mock("jspdf", async (importOriginal) => {
  const actual = await importOriginal<typeof import("jspdf")>();
  const Original = actual.default;
  const Wrapped = function (this: unknown, ...args: unknown[]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inst = new (Original as any)(...args);
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
        _texts.push({ page, text, size: curSize });
      } catch { /* ignore */ }
      return origText(...tArgs);
    };
    return inst;
  } as unknown as typeof Original;
  return { ...actual, default: Wrapped };
});

const { exportAvaliacaoPremiumPDF } = await import("./exportAvaliacaoPremiumPDF");

// ── Fixtures ─────────────────────────────────────────────────
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

function baseAvaliacao(valor_ideal: number) {
  return {
    valor_ideal,
    valor_minimo: Math.round(valor_ideal * 0.94),
    valor_maximo: Math.round(valor_ideal * 1.08),
    preco_m2_estimado: 9_100,
    score_liquidez: 70,
    preco_competitivo: true,
    rating_ia: 8.4,
    pontos_fortes: ["Localização"],
    pontos_atencao: ["Fotos"],
    estrategia: "Anunciar no ideal.",
  };
}

const comparaveis = [
  { titulo: "C1", area: 88, preco: 800_000, dias_anuncio: 30 },
  { titulo: "C2", area: 92, preco: 830_000, dias_anuncio: 60 },
];

async function build(valor_ideal: number) {
  _texts.length = 0;
  await exportAvaliacaoPremiumPDF({
    imovel: baseImovel as never,
    avaliacao: baseAvaliacao(valor_ideal) as never,
    comparaveis: comparaveis as never,
    brandName: "TestBrand",
    corretorInfo: { nome: "Corretor", creci: "0" },
    skipSave: true,
  });
}

// Referência canônica: replica exatamente a formatação usada em produção.
// Regra do módulo: pt-BR, currency BRL, maximumFractionDigits: 0.
const REF = (v: number) =>
  Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

// ── Casos de valor ───────────────────────────────────────────
// Cobrimos ordens de grandeza distintas para pegar erros de
// separador de milhar e casas decimais.
const valores = [
  { nome: "valor de 6 dígitos redondo",     valor:   380_000 },
  { nome: "valor com milhar não trivial",   valor:   755_000 },
  { nome: "valor de 7 dígitos",             valor: 1_250_000 },
  { nome: "valor não múltiplo de 1000",     valor:   872_450 }, // testa arredondamento
  { nome: "valor > 1 milhão com centenas",  valor: 4_875_320 },
];

describe("PDF Premium — formatação e sincronização do preço recomendado", () => {
  beforeEach(() => {
    _texts.length = 0;
  });

  describe("formatação isolada (pt-BR / BRL / 0 casas)", () => {
    it.each(valores)("$nome → padrão pt-BR", ({ valor }) => {
      const s = REF(valor);
      // Deve começar com R$ e ter separador de milhar "." (pt-BR).
      // Aceita o espaço não-quebrável (\u00A0) que Intl insere entre "R$" e o número.
      expect(s).toMatch(/^R\$[\s\u00A0]\d{1,3}(\.\d{3})+$/);
      // Zero casas decimais: nunca contém vírgula seguida de dígitos.
      expect(s).not.toMatch(/,\d/);
      // Contém o número desprovido de separadores.
      const semSep = s.replace(/[^\d]/g, "");
      expect(semSep).toBe(String(valor));
    });
  });

  describe.each(valores)("caso: $nome (valor = $valor)", ({ valor }) => {
    it("string canônica aparece pelo menos 1 vez em cada página-âncora (capa, p.3, p.9)", async () => {
      await build(valor);
      const alvo = REF(valor);
      for (const p of [1, 3, 9]) {
        const naPagina = _texts.filter((t) => t.page === p).some((t) => t.text.includes(alvo));
        expect(naPagina, `p.${p} não contém "${alvo}"`).toBe(true);
      }
    });

    it("destaque tipográfico do preço usa a MESMA string do selo/hero (sem divergência de formato)", async () => {
      await build(valor);
      const alvo = REF(valor);
      // 1) Destaque grande na capa: renderizado com fontSize alta (≥28pt) e igual a `alvo` sozinho.
      const destaqueCapa = _texts.find((t) => t.page === 1 && t.text === alvo && t.size >= 28);
      expect(destaqueCapa, `capa deve conter destaque tipográfico "${alvo}" (≥28pt) igual ao usado no selo/hero`).toBeDefined();

      // 2) Destaque grande na p.3 (número recomendado): fontSize ≥ 28pt.
      const destaqueP3 = _texts.find((t) => t.page === 3 && t.text === alvo && t.size >= 28);
      expect(destaqueP3, `p.3 deve conter destaque tipográfico "${alvo}" (≥28pt)`).toBeDefined();

      // 3) Frases contextuais na p.2, p.4 e p.9 devem citar a mesma string.
      // Normalizamos NBSP↔espaço porque `splitTextToSize` do jsPDF pode
      // quebrar linha entre "R$" e o número, mas a string lógica é a mesma.
      const norm = (s: string) => s.replace(/\u00A0/g, " ");
      const alvoN = norm(alvo);
      const pageText = (p: number) => norm(_texts.filter((t) => t.page === p).map((t) => t.text).join(" "));
      expect(pageText(2), `p.2 deve conter "${alvo}"`).toContain(alvoN);
      expect(pageText(4), `p.4 deve conter "${alvo}"`).toContain(alvoN);
      expect(pageText(9), `p.9 deve conter recap "${alvo}"`).toContain(alvoN);
    });

    it("faixa (min/max) e recomendado usam o mesmo padrão de moeda", async () => {
      await build(valor);
      const av = baseAvaliacao(valor);
      const strs = [REF(av.valor_minimo), REF(av.valor_maximo), REF(valor)];
      // Todos devem estar presentes em algum lugar do PDF, com o mesmo padrão.
      for (const s of strs) {
        expect(_texts.some((t) => t.text.includes(s)), `string "${s}" ausente em algum bloco de preço`).toBe(true);
        expect(s).toMatch(/^R\$[\s\u00A0]/); // prefixo padrão
        expect(s).not.toMatch(/,\d/);        // sem centavos
      }
    });

    it("nenhum destaque grande de preço aparece em formato divergente (ex.: 'R$ 820000' ou 'R$ 820.000,00')", async () => {
      await build(valor);
      const grandes = _texts.filter((t) => t.size >= 22 && t.text.startsWith("R$"));
      expect(grandes.length, "esperado ao menos 1 destaque de preço").toBeGreaterThan(0);
      grandes.forEach((t) => {
        // Deve ter separador de milhar E não ter centavos.
        expect(t.text, `destaque "${t.text}" deve usar separador '.' de milhar`).toMatch(/\d\.\d{3}/);
        expect(t.text, `destaque "${t.text}" não pode ter centavos`).not.toMatch(/,\d{2}\b/);
        // Deve começar com "R$".
        expect(t.text).toMatch(/^R\$[\s\u00A0]/);
      });
    });
  });

  it("todas as ocorrências do valor recomendado batem exatamente com a string canônica", async () => {
    const valor = 820_000;
    await build(valor);
    const alvo = REF(valor);
    // Toda vez que o número 820000 aparecer (com qualquer formatação de separador
    // em qualquer texto), deve ter sido escrito na forma canônica `alvo`.
    // Aceitamos aparições dentro de frases (contains), mas rejeitamos variantes
    // como "820000", "R$820.000" (sem espaço), "R$ 820.000,00" (com centavos).
    const variantesErradas = [
      /R\$820\.000/,       // sem espaço
      /820000(?!\d)/,      // sem separador
      /R\$\s?820\.000,\d/, // com centavos
    ];
    for (const regex of variantesErradas) {
      const hit = _texts.find((t) => regex.test(t.text));
      expect(hit, `formato divergente detectado: ${hit?.text}`).toBeUndefined();
    }
    // A string canônica deve aparecer em pelo menos 3 páginas distintas
    // (capa, página do número recomendado e conclusão são as âncoras mínimas).
    const norm = (s: string) => s.replace(/\u00A0/g, " ");
    const alvoN = norm(alvo);
    const paginas = new Set(_texts.filter((t) => norm(t.text).includes(alvoN)).map((t) => t.page));
    expect(paginas.size, "valor recomendado deve estar sincronizado em ≥3 páginas").toBeGreaterThanOrEqual(3);
  });
});
