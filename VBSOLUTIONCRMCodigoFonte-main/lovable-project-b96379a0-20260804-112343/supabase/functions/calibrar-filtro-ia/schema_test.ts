// Regression tests: guard against schema drift in calibrar-filtro-ia.
// Ensures every column selected in index.ts still exists in the DB.
import {
  assertFunctionSchemaValid,
  extractFromSelectPairs,
  getTableColumns,
  readFn,
} from "../_shared/schemaValidation.ts";
import { assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("calibrar-filtro-ia: every selected column exists in its table", async () => {
  await assertFunctionSchemaValid("calibrar-filtro-ia");
});

Deno.test("calibrar-filtro-ia: uses titulo_imovel (never tipo_imovel) on lista_proprietarios_captacao", async () => {
  const src = await readFn("calibrar-filtro-ia");
  const pairs = extractFromSelectPairs(src).filter((p) => p.table === "lista_proprietarios_captacao");
  assert(pairs.length > 0, "expected at least one select from lista_proprietarios_captacao");
  for (const p of pairs) {
    assert(!p.cols.includes("tipo_imovel"), "must not select non-existent lista_proprietarios_captacao.tipo_imovel");
    assert(p.cols.includes("titulo_imovel"), "must select titulo_imovel (the real column)");
  }
});

Deno.test("calibrar-filtro-ia: captacoes.tipo_imovel is still available", async () => {
  const cols = await getTableColumns("captacoes");
  assert(cols.has("tipo_imovel"), "calibrar-filtro-ia depends on captacoes.tipo_imovel");
  assert(cols.has("telefone_contato"), "calibrar-filtro-ia depends on captacoes.telefone_contato");
});
