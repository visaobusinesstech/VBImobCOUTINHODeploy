// Regression tests for schema validation & tipo inference used by
// calibrar-filtro-ia and filtrar-proprietarios-ia.
import {
  assertEquals,
  assert,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  canonicalizeTipo,
  inferTipoImovel,
  validateRawSchema,
} from "./tipoImovel.ts";

// ---------- canonicalizeTipo ----------
Deno.test("canonicalizeTipo: aliases comuns", () => {
  assertEquals(canonicalizeTipo("Apto"), "apartamento");
  assertEquals(canonicalizeTipo("APT"), "apartamento");
  assertEquals(canonicalizeTipo("Studio/Loft"), "studio");
  assertEquals(canonicalizeTipo("Galpão"), "galpao");
  assertEquals(canonicalizeTipo("Chácara"), "chacara");
  assertEquals(canonicalizeTipo("Sítio"), "sitio");
  assertEquals(canonicalizeTipo("lote"), "terreno");
  assertEquals(canonicalizeTipo(""), null);
  assertEquals(canonicalizeTipo(null), null);
  assertEquals(canonicalizeTipo("xyz123"), null);
});

// ---------- validateRawSchema ----------
Deno.test("validateRawSchema: raw inválido", () => {
  const r1 = validateRawSchema(null);
  assertEquals(r1.ok, false);
  assert(r1.fields_missing.includes("dados_extraidos_raw"));

  const r2 = validateRawSchema("string" as unknown);
  assertEquals(r2.ok, false);

  const r3 = validateRawSchema([1, 2, 3] as unknown);
  assertEquals(r3.ok, false);
});

Deno.test("validateRawSchema: raw completo pt-BR", () => {
  const raw = {
    tipo_imovel: "Apartamento",
    area: "78,5",
    quartos: "3",
    suites: 1,
    vagas: "2",
    condominio: "850",
    iptu: "1200.50",
    preco: "720000",
    endereco: "SQN 208 Bloco A",
    descricao: "Reformado, andar alto",
  };
  const r = validateRawSchema(raw);
  assertEquals(r.ok, true);
  assertEquals(r.data.tipo_imovel, "Apartamento");
  assertEquals(r.data.area, 78.5);
  assertEquals(r.data.quartos, 3);
  assertEquals(r.data.suites, 1);
  assertEquals(r.data.vagas, 2);
  assertEquals(r.data.condominio, 850);
  assertEquals(r.data.iptu, 1200.5);
  assertEquals(r.data.preco, 720000);
  // `tipo` (alternativo a `tipo_imovel`) não foi enviado → reportado
  assertEquals(r.fields_missing, ["tipo"]);

});


Deno.test("validateRawSchema: campos faltando reportados", () => {
  const r = validateRawSchema({ area: 60 });
  assertEquals(r.ok, false); // sem tipo_imovel/tipo
  assert(r.fields_missing.includes("tipo_imovel"));
  assert(r.fields_missing.includes("quartos"));
  assertEquals(r.data.area, 60);
});

Deno.test("validateRawSchema: strings não-numéricas são sanitized", () => {
  const r = validateRawSchema({
    tipo: "casa",
    area: "abc.def",
    quartos: "--",
  });
  assertEquals(r.ok, true);
  assert(r.sanitized.includes("area:invalid_number"));
  assert(r.sanitized.includes("quartos:invalid_number"));
});



Deno.test("validateRawSchema: coerção de tipos não-string", () => {
  const r = validateRawSchema({ tipo_imovel: 123, endereco: { rua: "X" } });
  assertEquals(r.data.tipo_imovel, "123");
  assert(r.sanitized.some((s) => s.startsWith("tipo_imovel:coerced")));
  assert(r.sanitized.some((s) => s.startsWith("endereco:coerced")));
});

// ---------- inferTipoImovel: prioridade em cascata ----------
Deno.test("inferTipoImovel: usa dados_extraidos_raw quando disponível", () => {
  const r = inferTipoImovel({
    dados_extraidos_raw: { tipo_imovel: "Cobertura Duplex" },
    titulo_imovel: "Casa de campo",
    tipo_imovel: "apartamento",
  });
  assertEquals(r.tipo, "cobertura");
  assertEquals(r.source, "dados_extraidos_raw");
  assertEquals(r.fallback, false);
});

Deno.test("inferTipoImovel: fallback para coluna tipo_imovel", () => {
  const r = inferTipoImovel({
    dados_extraidos_raw: { area: 100 },
    tipo_imovel: "Sobrado",
    titulo_imovel: "Anúncio",
  });
  assertEquals(r.tipo, "sobrado");
  assertEquals(r.source, "coluna_tipo_imovel");
  assertEquals(r.fallback, true);
});

Deno.test("inferTipoImovel: extrai do titulo_imovel", () => {
  const casos: Array<[string, string]> = [
    ["Apto 3 quartos no Sudoeste", "apartamento"],
    ["Kitnet mobiliada Asa Norte", "kitnet"],
    ["Studio novo próximo ao metrô", "studio"],
    ["Galpão logístico 1.200m²", "galpao"],
    ["Terreno em condomínio fechado", "terreno"],
    ["Sala comercial andar alto", "sala_comercial"],
    ["Chácara com piscina", "chacara"],
    ["Loja de esquina", "loja"],
  ];
  for (const [titulo, esperado] of casos) {
    const r = inferTipoImovel({ titulo_imovel: titulo });
    assertEquals(r.tipo, esperado, `titulo="${titulo}"`);
    assertEquals(r.source, "titulo_imovel");
  }
});

Deno.test("inferTipoImovel: extrai de observacoes/descricao", () => {
  const r = inferTipoImovel({
    observacoes: "Excelente flat na quadra 302",
  });
  assertEquals(r.tipo, "flat");
  assertEquals(r.source, "observacoes");
});

Deno.test("inferTipoImovel: extrai da url_anuncio (slug)", () => {
  const r = inferTipoImovel({
    url_anuncio:
      "https://www.zapimoveis.com.br/venda/apartamento/df-brasilia-asa-sul/id-123/",
  });
  assertEquals(r.tipo, "apartamento");
  assertEquals(r.source, "url_anuncio");
});

Deno.test("inferTipoImovel: url inválida não quebra", () => {
  const r = inferTipoImovel({ url_anuncio: "not-a-url" });
  assertEquals(r.tipo, "imovel");
  assertEquals(r.source, "default");
});

Deno.test("inferTipoImovel: default imovel quando sem sinais", () => {
  const r = inferTipoImovel({
    dados_extraidos_raw: { area: 50 },
    titulo_imovel: "Oportunidade única",
    observacoes: null,
  });
  assertEquals(r.tipo, "imovel");
  assertEquals(r.source, "default");
  assertEquals(r.fallback, true);
});

// ---------- casos reais amostrados de lista_proprietarios_captacao ----------
Deno.test("inferTipoImovel: amostras reais de captação", () => {
  const amostras = [
    {
      titulo_imovel: "APARTAMENTO 2 QUARTOS SQN 410 BLOCO H",
      dados_extraidos_raw: { preco: 850000, area: 65 },
      expected: "apartamento",
    },
    {
      titulo_imovel: "Casa 4 suítes Lago Sul",
      dados_extraidos_raw: null,
      expected: "casa",
    },
    {
      titulo_imovel: "Cobertura Duplex 300m² Sudoeste",
      dados_extraidos_raw: { tipo: "cobertura" },
      expected: "cobertura",
    },
    {
      titulo_imovel: "Sala Comercial Ed. Corporate",
      expected: "sala_comercial",
    },
    {
      titulo_imovel: "Kitnet Asa Norte próximo UnB",
      expected: "kitnet",
    },
  ];
  for (const a of amostras) {
    const r = inferTipoImovel(a);
    assertEquals(r.tipo, a.expected, `titulo="${a.titulo_imovel}"`);
  }
});
