/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 */

export const PORTAIS = [
  { key: "olx", label: "OLX" },
  { key: "vivareal", label: "VivaReal" },
  { key: "zapimoveis", label: "ZAP Imóveis" },
  { key: "quintoandar", label: "QuintoAndar" },
  { key: "chavenaomao", label: "Chave na Mão" },
  { key: "mercadolivre", label: "Mercado Livre" }
] as const;

export type ParsedListing = {
  portal: string;
  url: string;
  titulo: string;
  preco: number | null;
  cidade: string | null;
  bairro: string | null;
  tipo: string | null;
  area: number | null;
  quartos: number | null;
};

function slugCity(cidade: string): string {
  return String(cidade || "brasilia")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "-");
}

export function buildPortalSearchUrl(
  portal: string,
  cidade: string,
  tipo = "apartamento",
  operacao = "Venda"
): string {
  const city = slugCity(cidade);
  const op = /alug/i.test(operacao) ? "aluguel" : "venda";
  const t = slugCity(tipo);
  switch (portal) {
    case "olx":
      return `https://www.olx.com.br/imoveis/${op}/${t}?q=${encodeURIComponent(cidade)}`;
    case "vivareal":
      return `https://www.vivareal.com.br/${op}/${t}/${city}/`;
    case "zapimoveis":
      return `https://www.zapimoveis.com.br/${op}/${t}/${city}/`;
    case "quintoandar":
      return `https://www.quintoandar.com.br/${op}/${city}/${t}`;
    case "chavenaomao":
      return `https://www.chavenaomao.com.br/${op}/${t}/${city}`;
    case "mercadolivre":
      return `https://lista.mercadolivre.com.br/imoveis/${op}/${city}`;
    default:
      return `https://www.google.com/search?q=${encodeURIComponent(`${tipo} ${op} ${cidade} site:olx.com.br`)}`;
  }
}

export function parseListingHtml(html: string, url: string, portal = "generic"): ParsedListing {
  const title =
    (html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i) || [])[1] ||
    (html.match(/<title>([^<]+)/i) || [])[1] ||
    url;
  const priceRaw =
    (html.match(/r\$\s*([\d.]{3,12})/i) || [])[1] ||
    (html.match(/"price"\s*:\s*"?(\d+)/i) || [])[1];
  const preco = priceRaw ? Number(String(priceRaw).replace(/\./g, "")) : null;
  const areaMatch = html.match(/(\d{2,4})\s*m[²2]/i);
  const quartosMatch = html.match(/(\d)\s*(?:quarto|dorm)/i);
  return {
    portal,
    url,
    titulo: String(title).replace(/\s+/g, " ").trim().slice(0, 240),
    preco: Number.isFinite(preco as number) ? (preco as number) : null,
    cidade: null,
    bairro: null,
    tipo: null,
    area: areaMatch ? Number(areaMatch[1]) : null,
    quartos: quartosMatch ? Number(quartosMatch[1]) : null
  };
}

export function extractListingLinks(html: string, baseHost: string): string[] {
  const hrefs = Array.from(html.matchAll(/href=["']([^"']+)["']/gi)).map(m => m[1]);
  const out: string[] = [];
  for (const href of hrefs) {
    if (!/imovel|imoveis|anuncio|apartamento|casa/i.test(href)) continue;
    try {
      const abs = href.startsWith("http") ? href : `https://${baseHost}${href.startsWith("/") ? "" : "/"}${href}`;
      if (!out.includes(abs) && abs.length < 400) out.push(abs);
    } catch {
      /* ignore */
    }
  }
  return out.slice(0, 25);
}

export function qScoreListing(diasAnuncio: number, preco: number, area: number, mediaM2: number): number {
  const dias = Math.max(0, Number(diasAnuncio) || 0);
  const m2 = area > 0 ? preco / area : 0;
  const desvio = mediaM2 > 0 && m2 > 0 ? Math.abs(m2 - mediaM2) / mediaM2 : 0;
  const tempo = Math.min(dias / 180, 1) * 40;
  const precoF = Math.min(desvio, 1) * 35;
  const base = 25;
  return Math.round(Math.min(100, tempo + precoF + base));
}
