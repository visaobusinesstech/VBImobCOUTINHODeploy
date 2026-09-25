// Regression tests: guard against schema drift in filtrar-proprietarios-ia.
import {
  assertFunctionSchemaValid,
  extractFromSelectPairs,
  readFn,
} from "../_shared/schemaValidation.ts";
import { assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("filtrar-proprietarios-ia: every selected column exists in its table", async () => {
  await assertFunctionSchemaValid("filtrar-proprietarios-ia");
});

Deno.test("filtrar-proprietarios-ia: filters titulo_imovel (never lista_proprietarios_captacao.tipo_imovel)", async () => {
  const src = await readFn("filtrar-proprietarios-ia");
  const pairs = extractFromSelectPairs(src).filter((p) => p.table === "lista_proprietarios_captacao");
  assert(pairs.length > 0, "expected at least one select from lista_proprietarios_captacao");
  for (const p of pairs) {
    assert(!p.cols.includes("tipo_imovel"), "must not select non-existent lista_proprietarios_captacao.tipo_imovel");
  }
  // Data-loading select (the one with many columns) MUST include titulo_imovel.
  const dataSelects = pairs.filter((p) => p.cols.length >= 5);
  assert(dataSelects.length > 0, "expected at least one full data-loading select");
  for (const p of dataSelects) {
    assert(p.cols.includes("titulo_imovel"), "data-loading select must include titulo_imovel");
  }

  // The .ilike() clause must target titulo_imovel too.
  assert(
    /\.ilike\(\s*["'`]titulo_imovel["'`]/.test(src),
    "filtrar-proprietarios-ia must .ilike() on titulo_imovel — not tipo_imovel",
  );
  assert(
    !/\.ilike\(\s*["'`]tipo_imovel["'`]/.test(src),
    "filtrar-proprietarios-ia must NOT .ilike() on non-existent tipo_imovel column",
  );
});

Deno.test("filtrar-proprietarios-ia: required motivation columns are read", async () => {
  const src = await readFn("filtrar-proprietarios-ia");
  const pairs = extractFromSelectPairs(src).filter((p) => p.table === "lista_proprietarios_captacao");
  const cols = new Set(pairs.flatMap((p) => p.cols));
  for (const required of ["motivacao_score", "motivacao_nivel", "motivacao_sinais", "dados_extraidos_raw"]) {
    assert(cols.has(required), `missing required column in select: ${required}`);
  }
});
