// Tests para admin-webhook-metrics:
// - 401 quando não há Authorization
// - 401 quando o token é inválido
// - 403 quando o usuário autenticado não é master (requer TEST_NON_MASTER_EMAIL/PASSWORD)
// - X-Request-Id ecoado no header e no body em todos os cenários
// - log_service_role_call gravado em security_audit_log com o mesmo request_id
//
// Rodar via: supabase--test_edge_functions (deno test --allow-net --allow-env)

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import {
  assert,
  assertEquals,
  assertNotEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY =
  Deno.env.get("SUPABASE_ANON_KEY") ??
  Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const FN_URL = `${SUPABASE_URL}/functions/v1/admin-webhook-metrics`;

function newRequestId(prefix: string) {
  return `test-${prefix}-${crypto.randomUUID()}`;
}

async function callFn(opts: {
  requestId: string;
  authorization?: string;
  method?: string;
}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-request-id": opts.requestId,
    apikey: ANON_KEY,
  };
  if (opts.authorization) headers["Authorization"] = opts.authorization;
  const res = await fetch(FN_URL, {
    method: opts.method ?? "POST",
    headers,
    body: JSON.stringify({}),
  });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    /* not json */
  }
  return { status: res.status, headers: res.headers, body: json };
}

async function findAuditLog(requestId: string) {
  if (!SERVICE_ROLE) return null;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // pequena espera para o insert assíncrono do RPC concluir
  for (let i = 0; i < 5; i++) {
    const { data } = await admin
      .from("security_audit_log")
      .select("id, event_type, outcome, reason, edge_function, metadata")
      .eq("edge_function", "admin-webhook-metrics")
      .contains("metadata", { request_id: requestId })
      .limit(1);
    if (data && data.length > 0) return data[0];
    await new Promise((r) => setTimeout(r, 400));
  }
  return null;
}

Deno.test("401 missing_authorization grava request_id em security_audit_log", async () => {
  const requestId = newRequestId("missing-auth");
  const { status, headers, body } = await callFn({ requestId });

  assertEquals(status, 401);
  assertEquals(headers.get("x-request-id"), requestId);
  assertEquals(body.request_id, requestId);
  assertEquals(body.error_code, "missing_authorization");
  assert(typeof body.message === "string" && body.message.length > 0);

  if (SERVICE_ROLE) {
    const log = await findAuditLog(requestId);
    assert(log, "audit log não encontrado para request_id " + requestId);
    assertEquals(log!.edge_function, "admin-webhook-metrics");
    assertEquals(log!.outcome, "denied");
    assertEquals(log!.reason, "missing_authorization");
    const md = log!.metadata as { request_id?: string; error_code?: string; status?: number };
    assertEquals(md.request_id, requestId);
    assertEquals(md.error_code, "missing_authorization");
    assertEquals(md.status, 401);
  }
});

Deno.test("401 unauthenticated grava request_id em security_audit_log", async () => {
  const requestId = newRequestId("invalid-token");
  const { status, headers, body } = await callFn({
    requestId,
    authorization: "Bearer invalid.jwt.token",
  });

  assertEquals(status, 401);
  assertEquals(headers.get("x-request-id"), requestId);
  assertEquals(body.request_id, requestId);
  assertEquals(body.error_code, "unauthenticated");
  assert(typeof body.message === "string" && body.message.length > 0);

  if (SERVICE_ROLE) {
    const log = await findAuditLog(requestId);
    assert(log, "audit log não encontrado para request_id " + requestId);
    assertEquals(log!.edge_function, "admin-webhook-metrics");
    assertEquals(log!.outcome, "denied");
    assertEquals(log!.reason, "unauthenticated");
    const md = log!.metadata as { request_id?: string; error_code?: string };
    assertEquals(md.request_id, requestId);
    assertEquals(md.error_code, "unauthenticated");
  }
});

Deno.test({
  name: "403 forbidden grava request_id em security_audit_log (requer TEST_NON_MASTER_*)",
  ignore:
    !Deno.env.get("TEST_NON_MASTER_EMAIL") ||
    !Deno.env.get("TEST_NON_MASTER_PASSWORD"),
  fn: async () => {
    const email = Deno.env.get("TEST_NON_MASTER_EMAIL")!;
    const password = Deno.env.get("TEST_NON_MASTER_PASSWORD")!;
    const client = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    assert(!error && data.session, "falha ao autenticar usuário não-master");

    const requestId = newRequestId("non-master");
    const { status, headers, body } = await callFn({
      requestId,
      authorization: `Bearer ${data.session!.access_token}`,
    });

    assertEquals(status, 403);
    assertEquals(headers.get("x-request-id"), requestId);
    assertEquals(body.request_id, requestId);
    assertEquals(body.error_code, "forbidden");

    if (SERVICE_ROLE) {
      const log = await findAuditLog(requestId);
      assert(log, "audit log não encontrado para request_id " + requestId);
      assertEquals(log!.outcome, "denied");
      assertEquals(log!.reason, "forbidden");
      const md = log!.metadata as { request_id?: string; error_code?: string };
      assertEquals(md.request_id, requestId);
      assertEquals(md.error_code, "forbidden");
    }
  },
});

Deno.test({
  name: "400 invalid_params grava request_id em security_audit_log (requer TEST_MASTER_*)",
  ignore:
    !Deno.env.get("TEST_MASTER_EMAIL") || !Deno.env.get("TEST_MASTER_PASSWORD"),
  fn: async () => {
    const email = Deno.env.get("TEST_MASTER_EMAIL")!;
    const password = Deno.env.get("TEST_MASTER_PASSWORD")!;
    const client = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    assert(!error && data.session, "falha ao autenticar master");

    const requestId = newRequestId("invalid-params");
    const res = await fetch(FN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-request-id": requestId,
        apikey: ANON_KEY,
        Authorization: `Bearer ${data.session!.access_token}`,
      },
      body: JSON.stringify({ tenant_id: "nao-e-uuid" }),
    });
    const body = (await res.json()) as Record<string, unknown>;

    assertEquals(res.status, 400);
    assertEquals(res.headers.get("x-request-id"), requestId);
    assertEquals(body.request_id, requestId);
    assertEquals(body.error_code, "invalid_params");
    assert(body.details && typeof body.details === "object");

    if (SERVICE_ROLE) {
      const log = await findAuditLog(requestId);
      assert(log, "audit log não encontrado para invalid_params request_id " + requestId);
      assertEquals(log!.outcome, "denied");
      assertEquals(log!.reason, "invalid_params");
      const md = log!.metadata as { request_id?: string; error_code?: string; status?: number };
      assertEquals(md.request_id, requestId);
      assertEquals(md.error_code, "invalid_params");
      assertEquals(md.status, 400);
    }
  },
});

Deno.test({
  name: "400 invalid_period grava request_id em security_audit_log (requer TEST_MASTER_*)",
  ignore:
    !Deno.env.get("TEST_MASTER_EMAIL") || !Deno.env.get("TEST_MASTER_PASSWORD"),
  fn: async () => {
    const email = Deno.env.get("TEST_MASTER_EMAIL")!;
    const password = Deno.env.get("TEST_MASTER_PASSWORD")!;
    const client = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    assert(!error && data.session, "falha ao autenticar master");

    const requestId = newRequestId("invalid-period");
    const res = await fetch(FN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-request-id": requestId,
        apikey: ANON_KEY,
        Authorization: `Bearer ${data.session!.access_token}`,
      },
      // start > end força invalid_period
      body: JSON.stringify({
        start: "2099-01-02T00:00:00Z",
        end: "2099-01-01T00:00:00Z",
      }),
    });
    const body = (await res.json()) as Record<string, unknown>;

    assertEquals(res.status, 400);
    assertEquals(body.request_id, requestId);
    assertEquals(body.error_code, "invalid_period");

    if (SERVICE_ROLE) {
      const log = await findAuditLog(requestId);
      assert(log, "audit log não encontrado para invalid_period request_id " + requestId);
      assertEquals(log!.reason, "invalid_period");
      const md = log!.metadata as { request_id?: string; error_code?: string };
      assertEquals(md.request_id, requestId);
      assertEquals(md.error_code, "invalid_period");
    }
  },
});

Deno.test("X-Request-Id é gerado quando o cliente não envia o header e é ecoado na auditoria", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({}),
  });
  const echoed = res.headers.get("x-request-id");
  const body = await res.json();
  assertEquals(res.status, 401);
  assert(echoed && echoed.length > 0, "X-Request-Id ausente no header");
  assertEquals(body.request_id, echoed);
  assertNotEquals(echoed, "");

  if (SERVICE_ROLE && echoed) {
    const log = await findAuditLog(echoed);
    assert(log, "audit log não encontrado para request_id gerado " + echoed);
    const md = log!.metadata as { request_id?: string };
    assertEquals(md.request_id, echoed);
  }
});

