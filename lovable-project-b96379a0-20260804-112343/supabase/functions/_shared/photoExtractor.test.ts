// Tests for the cascade photo extractor. Uses inline + on-disk fixtures
// representing OLX, ZAP, VivaReal, QuintoAndar, ImovelWeb and blocked pages.
//
// Run with: supabase--test_edge_functions { functions: ["_shared"] }
// or: deno test supabase/functions/_shared/photoExtractor.test.ts

import { assert, assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { fromFileUrl, dirname, join } from "https://deno.land/std@0.224.0/path/mod.ts";
import {
  detectBlockPage,
  extractPhotosFromHtml,
  isLikelyPropertyPhoto,
  normalizeImageUrl,
} from "./photoExtractor.ts";

const FIXTURES = join(dirname(fromFileUrl(import.meta.url)), "fixtures", "photoExtractor");
const load = (name: string) => Deno.readTextFileSync(join(FIXTURES, name));

Deno.test("isLikelyPropertyPhoto — filters junk and accepts known CDNs", () => {
  assert(isLikelyPropertyPhoto("https://img.olx.com.br/images/abc-800x600.jpg"));
  assert(isLikelyPropertyPhoto("https://resizedimgs.zapimoveis.com.br/fit-in/800x600/x.jpg"));
  assert(!isLikelyPropertyPhoto("https://img.olx.com.br/static/logo.png"));
  assert(!isLikelyPropertyPhoto("https://cdn.site/icon-facebook.svg"));
  assert(!isLikelyPropertyPhoto("data:image/png;base64,AAA"));
  assert(!isLikelyPropertyPhoto("https://cdn.site/1x1.gif"));
  assert(!isLikelyPropertyPhoto("https://tracker.doubleclick.net/pixel.jpg"));
});

Deno.test("normalizeImageUrl — protocol-relative + entity decoding + resolves relative", () => {
  assertEquals(
    normalizeImageUrl("//img.olx.com.br/a.jpg"),
    "https://img.olx.com.br/a.jpg",
  );
  assertEquals(
    normalizeImageUrl("/media/x.jpg", "https://portal.com/anuncio/123"),
    "https://portal.com/media/x.jpg",
  );
  assertEquals(
    normalizeImageUrl("https://cdn.site/a.jpg?w=1&amp;h=2"),
    "https://cdn.site/a.jpg?w=1&h=2",
  );
  assertEquals(normalizeImageUrl("javascript:alert(1)"), null);
  assertEquals(normalizeImageUrl(""), null);
});

Deno.test("detectBlockPage — captcha / cloudflare / datadome", () => {
  assert(detectBlockPage(load("blocked-cloudflare.html")).blocked);
  assert(detectBlockPage(load("blocked-datadome.html")).blocked);
  assert(!detectBlockPage(load("olx.html")).blocked);
  assert(detectBlockPage("").blocked, "empty body must be treated as blocked");
});

Deno.test("OLX fixture — JSON-LD wins, junk filtered, __NEXT_DATA__ merged, dedup keeps highest-res", () => {
  const html = load("olx.html");
  const result = extractPhotosFromHtml(html, {
    sourceUrl: "https://www.olx.com.br/imoveis/df/apartamento-3-quartos-asa-sul-1234",
  });

  assert(!result.blocked, JSON.stringify(result));
  assert(result.photos.length >= 5, `expected >=5 unique photos, got ${result.photos.length}`);

  // Logo must not appear
  assert(!result.photos.some((u) => /logo\.png/i.test(u)), "logo leaked through filter");

  // JSON-LD candidates should appear before img-src
  assertStringIncludes(result.photos[0], "img.olx.com.br");

  // strategy stats populated
  assert(result.strategy_stats["json-ld"] >= 3, "json-ld stat");
  assert(result.strategy_stats["og-meta"] >= 2, "og-meta stat");
  assert(result.strategy_stats["inline-json"] >= 2, "inline-json stat");
  assert(result.strategy_stats["img-src"] + result.strategy_stats["img-datasrc"] >= 1, "img-src/datasrc stat");

  // Dedup: same photo id 001 appears in og:secure_url (-800x600) and json-ld (-1200x900) with
  // matching path structure — those size variants must collapse. The thumbs256x256 variant
  // lives on a distinct path and legitimately survives.
  const highRes001 = result.photos.filter((u) => /\/images\/120000000000000001/.test(u));
  assertEquals(highRes001.length, 1, "size variants sharing the same base path should dedup");
});

Deno.test("ZAP fixture — srcset picks largest variant and rejects favicon", () => {
  const html = load("zap.html");
  const result = extractPhotosFromHtml(html, {
    sourceUrl: "https://www.zapimoveis.com.br/imovel/casa-4-quartos-99999/",
  });

  assert(!result.blocked);
  assert(result.photos.length >= 3, `got ${result.photos.length}`);
  // Largest srcset variant (1600w) must be chosen over 300w/800w
  assert(
    result.photos.some((u) => /1600x1200\/vr\.images\.sp\/aaa1\.jpg/.test(u)),
    "srcset should pick 1600w variant",
  );
  assert(!result.photos.some((u) => /favicon/i.test(u)));
  assert(result.strategy_stats["img-srcset"] >= 1);
});

Deno.test("VivaReal fixture — __INITIAL_STATE__ inline-json path", () => {
  const html = load("vivareal.html");
  const result = extractPhotosFromHtml(html, {
    sourceUrl: "https://www.vivareal.com.br/imovel/x/",
  });

  assert(!result.blocked);
  assertEquals(result.photos.length, 3, "expected exactly 3 media items");
  assert(result.photos.every((u) => u.includes("resizedimgs.vivareal.com")));
  assert(result.strategy_stats["inline-json"] >= 3);
  assert(!result.photos.some((u) => /\.svg/i.test(u)), "SVG logo must be filtered");
});

Deno.test("QuintoAndar fixture — __NUXT__ path + og + placeholder filtered", () => {
  const html = load("quintoandar.html");
  const result = extractPhotosFromHtml(html, {
    sourceUrl: "https://www.quintoandar.com.br/imovel/qa-001",
  });

  assert(!result.blocked);
  assert(result.photos.length >= 3, `got ${result.photos.length}`);
  assert(!result.photos.some((u) => /placeholder/i.test(u)));
  assert(result.strategy_stats["og-meta"] >= 1);
});

Deno.test("ImovelWeb fixture — falls back to regex-cdn when no JSON/meta present", () => {
  const html = load("imovelweb.html");
  const result = extractPhotosFromHtml(html, {
    sourceUrl: "https://www.imovelweb.com.br/anuncio/x-123.html",
  });

  assert(!result.blocked);
  assertEquals(result.photos.length, 4);
  assert(result.photos.every((u) => u.includes("imagenes-1.imovelweb.com.br")));
  assert(result.strategy_stats["regex-cdn"] >= 4);
  assertEquals(result.strategy_stats["json-ld"], 0);
  assertEquals(result.strategy_stats["og-meta"], 0);
});

Deno.test("Blocked pages — return blocked=true with reason and zero photos", () => {
  const cf = extractPhotosFromHtml(load("blocked-cloudflare.html"), {
    sourceUrl: "https://portal.com/anuncio",
  });
  assert(cf.blocked);
  assertEquals(cf.photos.length, 0);
  assert(cf.block_reason && cf.block_reason.length > 0);

  const dd = extractPhotosFromHtml(load("blocked-datadome.html"), {
    sourceUrl: "https://portal.com/anuncio",
  });
  assert(dd.blocked);
  assertEquals(dd.photos.length, 0);
});

Deno.test("maxPhotos cap is respected", () => {
  const html = load("olx.html");
  const result = extractPhotosFromHtml(html, {
    sourceUrl: "https://www.olx.com.br/x",
    maxPhotos: 2,
  });
  assertEquals(result.photos.length, 2);
  assertEquals(result.max_out, 2);
});

Deno.test("seedPhotos take highest priority and are deduped against strategy results", () => {
  const html = load("olx.html");
  const seeded = "https://img.olx.com.br/images/seed-super-hd-2000x1500.jpg";
  const result = extractPhotosFromHtml(html, {
    sourceUrl: "https://www.olx.com.br/x",
    seedPhotos: [seeded, "https://img.olx.com.br/static/logo.png"], // junk seed filtered
  });
  assertEquals(result.photos[0], seeded, "seed must be first");
  assert(!result.photos.some((u) => /logo\.png/i.test(u)));
});

Deno.test("Regression: empty HTML → blocked, and photo output stays deterministic", () => {
  const empty = extractPhotosFromHtml("", { sourceUrl: "https://a.com" });
  assert(empty.blocked);

  const html = load("vivareal.html");
  const a = extractPhotosFromHtml(html, { sourceUrl: "https://www.vivareal.com.br/x" });
  const b = extractPhotosFromHtml(html, { sourceUrl: "https://www.vivareal.com.br/x" });
  assertEquals(a.photos, b.photos, "extractor must be deterministic");
});
