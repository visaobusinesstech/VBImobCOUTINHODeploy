// Tests para o contrato do campo `details` no corpo de erro padronizado
// { error_code, message, details?, request_id }.
//
// Regras verificadas:
//  - missing_authorization  (401): `details` OMITIDO
//  - unauthenticated        (401): `details` OMITIDO
//  - forbidden              (403): `details` OMITIDO      (requer TEST_NON_MASTER_*)
//  - invalid_params         (400): `details` é OBJECT     (Zod flatten: formErrors[], fieldErrors{})  (requer TEST_MASTER_*)
//  - invalid_period         (400): `details` é OBJECT com { start:string|null, end:string|null }      (requer TEST_MASTER_*)
//
// Rodar via: supabase--test_edge_functions (deno test --allow-net --allow-env)

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY =
  Deno.env.get("SUPABASE_ANON_KEY") ??
  Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

const FN_URL = `${SUPABASE_URL}/functions/v1/admin-webhook-metrics`;

function rid(prefix: string) {
  return `test-details-${prefix}-${crypto.randomUUID()}`;
}

type Body = Record<string, unknown>;

async function call(opts: {
  requestId: string;
  authorization?: string;
  body?: unknown;
}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-request-id": opts.requestId,
    apikey: ANON_KEY,
  };
  if (opts.authorization) headers["Authorization"] = opts.authorization;
  const res = await fetch(FN_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(opts.body ?? {}),
  });
  const text = await res.text();
  let json: Body = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    /* not json */
  }
  return { status: res.status, body: json };
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

async function signIn(email: string, password: string) {
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });
  assert(!error && data.session, `falha ao autenticar ${email}`);
  return data.session!.access_token;
}

// ─────────────────────────────────────────────────────────────────────────────
// details OMITIDO para erros de auth
// ─────────────────────────────────────────────────────────────────────────────

Deno.test("missing_authorization: omite `details` no corpo de erro", async () => {
  const requestId = rid("missing-auth");
  const { status, body } = await call({ requestId });
  assertEquals(status, 401);
  assertEquals(body.error_code, "missing_authorization");
  assert(
    !("details" in body),
    `esperava details ausente, veio: ${JSON.stringify(body.details)}`,
  );
});

Deno.test("unauthenticated: omite `details` no corpo de erro", async () => {
  const requestId = rid("invalid-token");
  const { status, body } = await call({
    requestId,
    authorization: "Bearer invalid.jwt.token",
  });
  assertEquals(status, 401);
  assertEquals(body.error_code, "unauthenticated");
  assert(
    !("details" in body),
    `esperava details ausente, veio: ${JSON.stringify(body.details)}`,
  );
});

Deno.test({
  name: "forbidden: omite `details` no corpo de erro (requer TEST_NON_MASTER_*)",
  ignore:
    !Deno.env.get("TEST_NON_MASTER_EMAIL") ||
    !Deno.env.get("TEST_NON_MASTER_PASSWORD"),
  fn: async () => {
    const token = await signIn(
      Deno.env.get("TEST_NON_MASTER_EMAIL")!,
      Deno.env.get("TEST_NON_MASTER_PASSWORD")!,
    );
    const requestId = rid("non-master");
    const { status, body } = await call({
      requestId,
      authorization: `Bearer ${token}`,
    });
    assertEquals(status, 403);
    assertEquals(body.error_code, "forbidden");
    assert(
      !("details" in body),
      `esperava details ausente, veio: ${JSON.stringify(body.details)}`,
    );
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// details PRESENTE e com tipo correto para 400
// ─────────────────────────────────────────────────────────────────────────────

Deno.test({
  name: "invalid_params: `details` é object no shape do Zod flatten (formErrors[], fieldErrors{}) (requer TEST_MASTER_*)",
  ignore:
    !Deno.env.get("TEST_MASTER_EMAIL") ||
    !Deno.env.get("TEST_MASTER_PASSWORD"),
  fn: async () => {
    const token = await signIn(
      Deno.env.get("TEST_MASTER_EMAIL")!,
      Deno.env.get("TEST_MASTER_PASSWORD")!,
    );
    const requestId = rid("invalid-params");
    // tenant_id não-UUID e provider vazio → Zod rejeita
    const { status, body } = await call({
      requestId,
      authorization: `Bearer ${token}`,
      body: { tenant_id: "nao-e-uuid", provider: "" },
    });
    assertEquals(status, 400);
    assertEquals(body.error_code, "invalid_params");
    assert("details" in body, "esperava details presente");
    assert(isPlainObject(body.details), "details deve ser object");
    const d = body.details as Record<string, unknown>;
    assert(
      Array.isArray(d.formErrors),
      "details.formErrors deve ser array (Zod flatten)",
    );
    assert(
      isPlainObject(d.fieldErrors),
      "details.fieldErrors deve ser object (Zod flatten)",
    );
    // pelo menos tenant_id deve aparecer nos fieldErrors
    const fe = d.fieldErrors as Record<string, unknown>;
    assert(
      Array.isArray(fe.tenant_id),
      "details.fieldErrors.tenant_id deve ser array de mensagens",
    );
  },
});

Deno.test({
  name: "invalid_period: `details` é object com start/end (string|null) (requer TEST_MASTER_*)",
  ignore:
    !Deno.env.get("TEST_MASTER_EMAIL") ||
    !Deno.env.get("TEST_MASTER_PASSWORD"),
  fn: async () => {
    const token = await signIn(
      Deno.env.get("TEST_MASTER_EMAIL")!,
      Deno.env.get("TEST_MASTER_PASSWORD")!,
    );
    const requestId = rid("invalid-period");
    // start > end → invalid_period
    const { status, body } = await call({
      requestId,
      authorization: `Bearer ${token}`,
      body: {
        start: "2026-07-10T00:00:00.000Z",
        end: "2026-07-01T00:00:00.000Z",
      },
    });
    assertEquals(status, 400);
    assertEquals(body.error_code, "invalid_period");
    assert("details" in body, "esperava details presente");
    assert(isPlainObject(body.details), "details deve ser object");
    const d = body.details as Record<string, unknown>;
    assert("start" in d && "end" in d, "details deve conter start e end");
    for (const k of ["start", "end"] as const) {
      const v = d[k];
      assert(
        v === null || typeof v === "string",
        `details.${k} deve ser string|null, veio ${typeof v}`,
      );
    }
  },
});
