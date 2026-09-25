/**
 * Testes da validação de descrição do imóvel usada pela edge function
 * `avaliacao-imovel`. Confirma que descrições vazias, <30 e >2000
 * caracteres retornam um body 400 estruturado com `code`, `field` e os
 * limites (`descricao_min` / `descricao_max` / `descricao_length`) corretos.
 *
 * Rode com: `deno test supabase/functions/avaliacao-imovel/index_test.ts`
 */

import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  DESCRICAO_MAX,
  DESCRICAO_MIN,
  validarDescricaoImovel,
} from "./_validacaoDescricao.ts";

/** Simula o Response que a edge function devolveria a partir do resultado da validação. */
function toHttp400(result: ReturnType<typeof validarDescricaoImovel>) {
  if (!result) throw new Error("Esperava erro de validação, veio null");
  return new Response(JSON.stringify(result), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  });
}

async function assertBadRequest(body: unknown, expected: {
  code: string;
  length: number;
}) {
  const result = validarDescricaoImovel(body);
  const resp = toHttp400(result);

  assertEquals(resp.status, 400);
  assertEquals(resp.headers.get("Content-Type"), "application/json");

  const parsed = await resp.json();
  assertEquals(parsed.code, expected.code);
  assertEquals(parsed.field, "descricao");
  assertEquals(parsed.descricao_min, DESCRICAO_MIN);
  assertEquals(parsed.descricao_max, DESCRICAO_MAX);
  assertEquals(parsed.descricao_length, expected.length);
  assert(typeof parsed.error === "string" && parsed.error.length > 0, "error deve ser string");
  return parsed;
}

// ---------- Vazia ----------

Deno.test("descrição vazia (string '') → 400 DESCRICAO_OBRIGATORIA com length 0", async () => {
  const body = await assertBadRequest("", { code: "DESCRICAO_OBRIGATORIA", length: 0 });
  assertEquals(
    body.error,
    `Descrição do imóvel é obrigatória (mínimo ${DESCRICAO_MIN} caracteres).`,
  );
});

Deno.test("descrição ausente (undefined) → 400 DESCRICAO_OBRIGATORIA", async () => {
  await assertBadRequest(undefined, { code: "DESCRICAO_OBRIGATORIA", length: 0 });
});

Deno.test("descrição null → 400 DESCRICAO_OBRIGATORIA", async () => {
  await assertBadRequest(null, { code: "DESCRICAO_OBRIGATORIA", length: 0 });
});

Deno.test("descrição não-string (número) → 400 DESCRICAO_OBRIGATORIA", async () => {
  await assertBadRequest(123 as unknown, { code: "DESCRICAO_OBRIGATORIA", length: 0 });
});

Deno.test("descrição só whitespace → 400 DESCRICAO_OBRIGATORIA (trim aplica)", async () => {
  await assertBadRequest("   \n\t  ", { code: "DESCRICAO_OBRIGATORIA", length: 0 });
});

// ---------- < mínimo ----------

Deno.test("descrição com 1 char → 400 DESCRICAO_ABAIXO_MINIMO com length 1", async () => {
  const body = await assertBadRequest("a", { code: "DESCRICAO_ABAIXO_MINIMO", length: 1 });
  assertEquals(
    body.error,
    `Descrição abaixo do recomendado (1/${DESCRICAO_MIN} caracteres mínimos).`,
  );
});

Deno.test("descrição com 29 chars → 400 DESCRICAO_ABAIXO_MINIMO com length 29", async () => {
  const body = await assertBadRequest("a".repeat(29), {
    code: "DESCRICAO_ABAIXO_MINIMO",
    length: 29,
  });
  assertEquals(
    body.error,
    `Descrição abaixo do recomendado (29/${DESCRICAO_MIN} caracteres mínimos).`,
  );
});

Deno.test("descrição com 29 chars + espaços nas bordas → ainda 400 (trim antes de contar)", async () => {
  await assertBadRequest(`   ${"a".repeat(29)}   `, {
    code: "DESCRICAO_ABAIXO_MINIMO",
    length: 29,
  });
});

// ---------- > máximo ----------

Deno.test("descrição com 2001 chars → 400 DESCRICAO_ACIMA_MAXIMO com length 2001", async () => {
  const body = await assertBadRequest("a".repeat(DESCRICAO_MAX + 1), {
    code: "DESCRICAO_ACIMA_MAXIMO",
    length: DESCRICAO_MAX + 1,
  });
  assertEquals(
    body.error,
    `Descrição acima do limite (${DESCRICAO_MAX + 1}/${DESCRICAO_MAX} caracteres).`,
  );
});

Deno.test("descrição com 3000 chars → 400 DESCRICAO_ACIMA_MAXIMO com length 3000", async () => {
  await assertBadRequest("b".repeat(3000), {
    code: "DESCRICAO_ACIMA_MAXIMO",
    length: 3000,
  });
});

Deno.test("2001 emojis (pares substitutos) → 400 DESCRICAO_ACIMA_MAXIMO length=2001 (code points)", async () => {
  // Se a contagem fosse por code units UTF-16, .length seria 4002 e o número seria distorcido.
  await assertBadRequest("🏠".repeat(DESCRICAO_MAX + 1), {
    code: "DESCRICAO_ACIMA_MAXIMO",
    length: DESCRICAO_MAX + 1,
  });
});

// ---------- Fronteiras válidas ----------

Deno.test("descrição com exatamente 30 chars → válido (sem erro)", () => {
  const r = validarDescricaoImovel("a".repeat(DESCRICAO_MIN));
  assertEquals(r, null);
});

Deno.test("descrição com exatamente 2000 chars → válido (sem erro)", () => {
  const r = validarDescricaoImovel("a".repeat(DESCRICAO_MAX));
  assertEquals(r, null);
});

Deno.test("descrição válida com acentos NFD → normaliza NFC e passa (sem erro)", () => {
  // "café" em NFD tem 5 code points antes de compor, NFC deixa 4 code points visíveis
  const nfd = "cafe\u0301 ".repeat(10); // 40 chars após NFC + espaço
  const r = validarDescricaoImovel(nfd);
  assertEquals(r, null);
});
