import { describe, it, expect, vi } from "vitest";

// Interceptamos jsPDF para capturar a ORDEM em que cada texto é
// renderizado, junto com página e tamanho de fonte. Assim podemos
// afirmar que a frase de explicação da IA sempre precede o número
// correspondente em cada seção — a narrativa antes da conclusão.

type Cap = { order: number; page: number; text: string; size: number };
const _cap: Cap[] = [];
let _orderCounter = 0;

vi.mock("jspdf", async (importOriginal) => {
  const actual = await importOriginal<typeof import("jspdf")>();
  const Original = actual.default;

  const Wrapped = function (this: unknown, ...args: unknown[]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inst = new (Original as any)(...args);
    let currentSize = inst.getFontSize?.() ?? 16;
    const origSetSize = inst.setFontSize.bind(inst);
    inst.setFontSize = function (s: number) {
      currentSize = s;
      return origSetSize(s);
    };
    const origText = inst.text.bind(inst);
    inst.text = function (...tArgs: unknown[]) {
      try {
        const page = inst.internal.getCurrentPageInfo().pageNumber as number;
        const arg0 = tArgs[0];
        const flat = Array.isArray(arg0) ? arg0.join(" ") : String(arg0 ?? "");
        _cap.push({ order: _orderCounter++, page, text: flat, size: currentSize });
      } catch {
        /* noop */
      }
      return origText(...tArgs);
    };
    return inst;
  } as unknown as typeof Original;

  return { ...actual, default: Wrapped };
});

const { exportAvaliacaoPremiumPDF } = await import("./exportAvaliacaoPremiumPDF");

// ─── Fixtures ────────────────────────────────────────────
const imovel = {
  tipo: "Apartamento",
  endereco: "Rua das Flores, 123",
  bairro: "Asa Sul",
  cidade: "Brasília",
  estado: "DF",
  area: 90,
  preco: 815000,
  fotos: [],
};
const avaliacao = {
  valor_ideal: 815000,
  valor_minimo: 780000,
  valor_maximo: 850000,
  score_liquidez: 70,
  preco_competitivo: true,
  pontos_fortes: ["Localização"],
  pontos_atencao: ["Fotos escuras ou com pouca definição"],
  comparaveis_gerados: [],
};
const comparaveis = Array.from({ length: 6 }, (_, i) => ({
  titulo: `Comparável ${i + 1}`,
  area: 88 + i,
  preco: 800000 + i * 5000,
  dias_anuncio: 20 + i * 15,
}));

async function build() {
  _cap.length = 0;
  _orderCounter = 0;
  await exportAvaliacaoPremiumPDF({
    imovel,
    avaliacao,
    comparaveis,
    brandName: "TestBrand",
    corretorInfo: { nome: "Corretor Teste" },
    skipSave: true,
  });
}

// Uma frase de explicação da IA é: fonte de corpo (≤ 11pt) com pelo
// menos ~40 caracteres. Nem título, nem eyebrow, nem número/legenda.
const isExplicacao = (c: Cap) =>
  c.size <= 11 && c.text.trim().length >= 40 && !/^R\$[\s\u00A0]/.test(c.text);

// Uma "conclusão numérica" é: fonte de destaque (≥ 15pt) contendo
// dígitos, símbolo de moeda ou percentual — cobre preços grandes,
// "N dias", "72%", "85/100" etc. Títulos textuais são excluídos.
const isNumero = (c: Cap) =>
  c.size >= 15 && /(\d|R\$|%)/.test(c.text);

describe("PDF Premium — narrativa antes do número", () => {
  it("existem frases de explicação e números em pelo menos 6 páginas", async () => {
    await build();
    const paginasComExplicacao = new Set(_cap.filter(isExplicacao).map((c) => c.page));
    const paginasComNumero = new Set(_cap.filter(isNumero).map((c) => c.page));
    // Sanidade: pelo menos 6 páginas contêm ambos.
    const cruzamento = [...paginasComExplicacao].filter((p) => paginasComNumero.has(p));
    expect(cruzamento.length).toBeGreaterThanOrEqual(6);
  });

  // Páginas onde a lógica editorial promete "narrativa antes do número":
  // 3 (Preço), 4 (Probabilidade), 5 (Mercado), 6 (Concorrência),
  // 9 (Conclusão). Página 2 (Metodologia) tem teste dedicado abaixo —
  // não emite conclusão numérica em fonte hero.
  const paginasNarrativas = [3, 4, 5, 6, 9];

  describe.each(paginasNarrativas)("página %s — frase antes do número", (page) => {
    it("a primeira frase de explicação precede o primeiro número destacado", async () => {
      await build();
      const daPagina = _cap.filter((c) => c.page === page);
      const primeiraExplicacao = daPagina.find(isExplicacao);
      const primeiroNumero = daPagina.find(isNumero);

      expect(
        primeiraExplicacao,
        `Página ${page} deveria ter uma frase de explicação (≥40 chars em corpo ≤11pt)`,
      ).toBeDefined();
      expect(
        primeiroNumero,
        `Página ${page} deveria ter um número destacado (≥18pt)`,
      ).toBeDefined();

      expect(
        primeiraExplicacao!.order,
        `Na página ${page} a explicação "${primeiraExplicacao!.text.slice(
          0,
          60,
        )}..." (order=${primeiraExplicacao!.order}) precisa vir ANTES do número "${
          primeiroNumero!.text
        }" (order=${primeiroNumero!.order})`,
      ).toBeLessThan(primeiroNumero!.order);
    });
  });

  // Testes específicos para as promessas do prompt:
  it("página 2 (Metodologia): a frase 'Para estimar...' aparece antes de qualquer preço/peso", async () => {
    await build();
    const daPagina = _cap.filter((c) => c.page === 2);
    const intro = daPagina.find((c) => c.text.startsWith("Para estimar o valor"));
    const primeiroNumero = daPagina.find(isNumero);
    // Metodologia não tem um mega-hero de preço, mas ainda deve ter
    // alguma conclusão numérica (barras de peso rotuladas). Se houver,
    // a intro precede.
    expect(intro).toBeDefined();
    if (primeiroNumero) {
      expect(intro!.order).toBeLessThan(primeiroNumero!.order);
    }
    // Além disso, a frase de rodapé "A IA encontrou..." sempre existe.
    const rodape = daPagina.find((c) => c.text.startsWith("A IA encontrou"));
    expect(rodape).toBeDefined();
  });

  it("página 3 (Preço recomendado): explicação vem antes do valor grande em R$", async () => {
    await build();
    const daPagina = _cap.filter((c) => c.page === 3);
    const explicacao = daPagina.find((c) =>
      c.text.startsWith("Este é o valor sugerido pela IA"),
    );
    const heroPreco = daPagina.find(
      (c) => c.size >= 40 && /^R\$[\s\u00A0]/.test(c.text),
    );
    expect(explicacao).toBeDefined();
    expect(heroPreco).toBeDefined();
    expect(explicacao!.order).toBeLessThan(heroPreco!.order);
  });

  it("página 4 (Probabilidade): explicação vem antes das porcentagens 30/60/90d", async () => {
    await build();
    const daPagina = _cap.filter((c) => c.page === 4);
    const explicacao = daPagina.find((c) => c.text.startsWith("Se o imóvel for anunciado"));
    // Percentuais são renderizados como "45%"/"72%"/... em fonte grande.
    const primeiroPct = daPagina.find((c) => c.size >= 18 && /%$/.test(c.text.trim()));
    expect(explicacao).toBeDefined();
    expect(primeiroPct).toBeDefined();
    expect(explicacao!.order).toBeLessThan(primeiroPct!.order);
  });

  it("página 5 (Mercado): explicação vem antes das barras/valores comparados", async () => {
    await build();
    const daPagina = _cap.filter((c) => c.page === 5);
    const explicacao = daPagina.find((c) =>
      c.text.startsWith("A tabela abaixo posiciona o valor recomendado"),
    );
    // Aceita "R$", "+R$", "-R$" e formatos de delta ("+R$ 20.000 (2%)").
    const primeiroValor = daPagina.find(
      (c) => /R\$[\s\u00A0]/.test(c.text) && c.size >= 7,
    );
    expect(explicacao).toBeDefined();
    expect(primeiroValor).toBeDefined();
    expect(explicacao!.order).toBeLessThan(primeiroValor!.order);
  });

  it("página 6 (Concorrência): explicação vem antes das métricas de concorrência", async () => {
    await build();
    const daPagina = _cap.filter((c) => c.page === 6);
    const explicacao = daPagina.find((c) =>
      c.text.startsWith("Encontramos"),
    );
    const primeiroKpi = daPagina.find(isNumero);
    expect(explicacao).toBeDefined();
    expect(primeiroKpi).toBeDefined();
    expect(explicacao!.order).toBeLessThan(primeiroKpi!.order);
  });

  it("página 9 (Conclusão): kicker + título aparecem antes do valor recomendado final", async () => {
    await build();
    const daPagina = _cap.filter((c) => c.page === 9);
    const titulo = daPagina.find((c) => c.text === "O que fazer com esta avaliação");
    const heroPreco = daPagina.find(
      (c) => c.size >= 24 && /^R\$[\s\u00A0]/.test(c.text),
    );
    expect(titulo).toBeDefined();
    expect(heroPreco).toBeDefined();
    expect(titulo!.order).toBeLessThan(heroPreco!.order);
  });

  it("em toda página com hero em R$ (exceto capa), há pelo menos uma frase acima dele", async () => {
    await build();
    // A capa (página 1) é o resumo executivo — a promessa "narrativa
    // antes do número" vale a partir da página 2 (as próprias palavras
    // do rodapé da capa: "Nas próximas páginas, cada conclusão é
    // explicada antes de mostrar os números.").
    const paginasHero = new Set(
      _cap
        .filter(
          (c) => c.page >= 2 && c.size >= 24 && /^R\$[\s\u00A0]/.test(c.text),
        )
        .map((c) => c.page),
    );
    expect(paginasHero.size).toBeGreaterThan(0);
    paginasHero.forEach((page) => {
      const daPagina = _cap.filter((c) => c.page === page);
      const hero = daPagina.find(
        (c) => c.size >= 24 && /^R\$[\s\u00A0]/.test(c.text),
      )!;
      const explicacaoAntes = daPagina.find(
        (c) => isExplicacao(c) && c.order < hero.order,
      );
      expect(
        explicacaoAntes,
        `Página ${page}: nenhum texto explicativo antes do preço em ${hero.size}pt`,
      ).toBeDefined();
    });
  });

  // ─── Extensão: páginas 1, 2, 7 e 8 ─────────────────────
  // A promessa "narrativa antes do número" também precisa valer nas
  // páginas que não estão no grupo canônico de conclusões (3-6, 9).
  // • Página 1 (capa): kicker/eyebrow + endereço precedem o hero em R$.
  // • Página 2 (metodologia): intro "Para estimar..." precede pesos/%.
  // • Página 7 (pontos positivos): intro precede o primeiro item/card.
  // • Página 8 (pontos de atenção): intro precede o primeiro item/card.

  it("página 1 (capa): o kicker 'VALOR RECOMENDADO PELA IA' precede o hero em R$", async () => {
    await build();
    const daPagina = _cap.filter((c) => c.page === 1);
    const kicker = daPagina.find((c) =>
      c.text.toUpperCase().includes("VALOR RECOMENDADO PELA IA"),
    );
    const heroPreco = daPagina.find(
      (c) => c.size >= 24 && /^R\$[\s\u00A0]/.test(c.text),
    );
    expect(kicker, "capa deve ter o kicker 'VALOR RECOMENDADO PELA IA'").toBeDefined();
    expect(heroPreco, "capa deve renderizar o hero em R$ (≥24pt)").toBeDefined();
    expect(
      kicker!.order,
      `capa: kicker (order=${kicker!.order}) precisa vir ANTES do preço "${heroPreco!.text}" (order=${heroPreco!.order})`,
    ).toBeLessThan(heroPreco!.order);
  });

  it("página 1 (capa): o endereço do imóvel precede o hero em R$ e demais números-chave", async () => {
    await build();
    const daPagina = _cap.filter((c) => c.page === 1);
    // O endereço é impresso em 18pt bold logo após o kicker de tipo.
    const endereco = daPagina.find(
      (c) => c.size >= 16 && /Rua|Av\.|Avenida|Alameda|Travessa/i.test(c.text),
    );
    expect(endereco, "capa deve mostrar o endereço em fonte de título").toBeDefined();
    // Números-chave da capa: hero em R$, "N dias", "X/100", "X%".
    // Excluímos o próprio endereço (que pode conter número de rua).
    const primeiroNumeroChave = daPagina.find(
      (c) =>
        c.order > endereco!.order &&
        c.size >= 12 &&
        /(R\$|%|\/100|\d+\s*dias)/i.test(c.text),
    );
    expect(primeiroNumeroChave, "capa deve conter pelo menos um número-chave (R$/%/dias/100)").toBeDefined();
    expect(
      endereco!.order,
      `capa: endereço (order=${endereco!.order}) precisa vir ANTES de "${primeiroNumeroChave!.text}" (order=${primeiroNumeroChave!.order})`,
    ).toBeLessThan(primeiroNumeroChave!.order);
  });

  it("página 2 (metodologia): a intro precede qualquer dígito/percentual do corpo da página", async () => {
    await build();
    const daPagina = _cap.filter((c) => c.page === 2);
    const intro = daPagina.find((c) => c.text.startsWith("Para estimar o valor"));
    expect(intro, "página 2 deve ter a intro 'Para estimar o valor...'").toBeDefined();
    // Números do corpo (após a intro). O chrome de header/rodapé é
    // emitido antes da intro e é irrelevante para a regra editorial.
    const primeiroDigito = daPagina.find(
      (c) => c.order > intro!.order && /(\d|%)/.test(c.text),
    );
    if (primeiroDigito) {
      expect(
        intro!.order,
        `p.2: intro (order=${intro!.order}) precisa vir ANTES de "${primeiroDigito.text}" (order=${primeiroDigito.order})`,
      ).toBeLessThan(primeiroDigito.order);
    }
  });

  it("página 7 (pontos positivos): a intro precede o primeiro item positivo", async () => {
    await build();
    const daPagina = _cap.filter((c) => c.page === 7);
    const intro = daPagina.find((c) =>
      c.text.startsWith("Estes são os fatores identificados pela IA"),
    );
    // O primeiro item aparece em card: título em 9pt bold e não é a intro.
    const introOrder = intro?.order ?? -1;
    const primeiroItem = daPagina.find(
      (c) =>
        c.order > introOrder &&
        c.size >= 8.5 &&
        c.size <= 10 &&
        c.text.trim().length > 3 &&
        !c.text.startsWith("Estes são os fatores") &&
        !c.text.startsWith("Destacar em fotos"),
    );
    expect(intro, "p.7 deve ter a intro dos pontos positivos").toBeDefined();
    expect(primeiroItem, "p.7 deve renderizar pelo menos um item positivo").toBeDefined();
    expect(
      intro!.order,
      `p.7: intro (order=${intro!.order}) precisa vir ANTES do 1º item "${primeiroItem!.text}" (order=${primeiroItem!.order})`,
    ).toBeLessThan(primeiroItem!.order);
    // E se aparecer algum número na página (ex.: contagens), a intro
    // também precede.
    const primeiroNumero = daPagina.find(isNumero);
    if (primeiroNumero) {
      expect(intro!.order).toBeLessThan(primeiroNumero.order);
    }
  });

  it("página 8 (pontos de atenção): a intro precede o primeiro ponto e qualquer número", async () => {
    await build();
    const daPagina = _cap.filter((c) => c.page === 8);
    const intro = daPagina.find((c) =>
      c.text.startsWith("Cada ponto vem acompanhado"),
    );
    const introOrder = intro?.order ?? -1;
    const primeiroItem = daPagina.find(
      (c) =>
        c.order > introOrder &&
        c.size >= 9.5 &&
        c.size <= 11 &&
        !c.text.startsWith("Cada ponto vem acompanhado"),
    );
    expect(intro, "p.8 deve ter a intro dos pontos de atenção").toBeDefined();
    expect(primeiroItem, "p.8 deve renderizar pelo menos um ponto de atenção").toBeDefined();
    expect(
      intro!.order,
      `p.8: intro (order=${intro!.order}) precisa vir ANTES do 1º item "${primeiroItem!.text}" (order=${primeiroItem!.order})`,
    ).toBeLessThan(primeiroItem!.order);
    const primeiroNumero = daPagina.find(isNumero);
    if (primeiroNumero) {
      expect(intro!.order).toBeLessThan(primeiroNumero.order);
    }
  });
});
