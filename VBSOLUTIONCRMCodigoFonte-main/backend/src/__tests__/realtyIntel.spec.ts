import { analyzeRadarZapMessage } from "../helpers/radarZapAnalyze";
import { buildPortalSearchUrl, parseListingHtml, qScoreListing } from "../helpers/portalScraper";
import { computeSeoChecks, generateSeoContent } from "../helpers/seoContent";
import { estimateAvaliacao } from "../helpers/avaliacaoImovel";

describe("radarZapAnalyze", () => {
  it("extracts sale listing from whatsapp text", () => {
    const a = analyzeRadarZapMessage(
      "Vendo apto 2 quartos no Asa Norte R$ 520.000 whatsapp 61999998888"
    );
    expect(a.tem_imovel).toBe(true);
    expect(a.intencao).toBe("venda");
    expect(a.tipo_imovel).toBe("apartamento");
    expect(a.preco).toBe(520000);
    expect(a.contato).toBeTruthy();
    expect(a.score_intencao).toBeGreaterThan(50);
  });

  it("marks search intent", () => {
    const a = analyzeRadarZapMessage("Procuro casa para alugar em Taguatinga");
    expect(a.intencao).toBe("busca");
  });
});

describe("portalScraper", () => {
  it("builds olx search url", () => {
    const url = buildPortalSearchUrl("olx", "Brasília", "apartamento", "Venda");
    expect(url).toContain("olx.com.br");
    expect(url).toContain("venda");
  });

  it("parses og:title and price from html", () => {
    const html =
      '<meta property="og:title" content="Apto Asa Sul"><title>x</title> R$ 450.000 75 m² 3 quartos';
    const parsed = parseListingHtml(html, "https://olx.com.br/imovel/1", "olx");
    expect(parsed.titulo).toContain("Apto");
    expect(parsed.preco).toBe(450000);
    expect(parsed.area).toBe(75);
    expect(parsed.quartos).toBe(3);
  });

  it("scores listings", () => {
    expect(qScoreListing(10, 100000, 50, 2000)).toBeGreaterThan(20);
  });
});

describe("seoContent", () => {
  it("generates title meta and checklist", () => {
    const seo = generateSeoContent({
      title: "Cobertura Lago Sul",
      type: "Cobertura",
      city: "Brasília",
      neighborhood: "Lago Sul",
      bedrooms: 4,
      price: 2000000
    });
    expect(seo.titulo.length).toBeGreaterThan(10);
    expect(seo.meta.length).toBeGreaterThan(40);
    expect(seo.slug).toContain("cobertura");
    expect(Array.isArray(seo.items)).toBe(true);
    const checks = computeSeoChecks({
      titulo: seo.titulo,
      meta: seo.meta,
      corpo: seo.corpo,
      keyword: seo.keyword
    });
    expect(checks.score).toBeGreaterThanOrEqual(0);
  });
});

describe("avaliacaoImovel", () => {
  it("flags listing above market", () => {
    const { parecer, desvio } = estimateAvaliacao(800000, 80, 4000);
    expect(desvio).toBeGreaterThan(15);
    expect(parecer).toContain("acima");
  });
});
