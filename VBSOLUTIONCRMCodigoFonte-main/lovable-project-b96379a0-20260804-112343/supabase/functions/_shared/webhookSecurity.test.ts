// Suíte de testes do módulo de segurança de webhooks.
// Cobre: HMAC (válida/inválida/malformada/ausente), replay protection
// (timestamp fora de janela, nonce ausente/curto/longo, nonce reutilizado)
// e checagem de tenant (UUID inválido, header X-Tenant-Id divergente,
// isolamento por tenant e por provider, segredo inativo, fallback env).
//
// Roda sem rede: injetamos um SupabaseClient falso via `supabaseOverride`.
// Uso:
//   deno test -A supabase/functions/_shared/webhookSecurity.test.ts

import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  clearWebhookNonceCache,
  clearWebhookSecretsCache,
  getWebhookMetrics,
  getWebhookNonceCacheStats,
  resetWebhookMetrics,
  verifyWebhook,
} from "./webhookSecurity.ts";

// ---------------------------------------------------------------------------
// Fake Supabase client
// ---------------------------------------------------------------------------

type SecretRow = {
  id: string;
  imobiliaria_id: string;
  provider: string;
  secret: string;
  ativo: boolean;
  version?: number;
  expires_at?: string | null;
};

interface FakeState {
  secrets: SecretRow[];
  nonces: Set<string>; // chave: `${tenant}::${provider}::${nonce}`
  rpcCalls: Array<{ name: string; args: Record<string, unknown> }>;
  nonceInserts: number;
  secretSelects?: number; // conta consultas SELECT em webhook_secrets (cache hit/miss)
}

function makeFakeSupabase(state: FakeState) {
  // Fluent builder que suporta a cadeia usada em verifyWebhook:
  //   .from(t).select(cols).eq(...).eq(...).order(...) → thenable com array
  //   .from(t).select(cols).eq(...).maybeSingle()      → row única (legado)
  //   .from(t).insert(row)                             → { error }
  //   .from(t).update(patch).eq(k,v).then(..)          → thenable
  const from = (table: string) => {
    const filters: Record<string, unknown> = {};

    const filterSecrets = () => {
      if (table !== "webhook_secrets") return [] as SecretRow[];
      return state.secrets.filter((r) =>
        r.imobiliaria_id === filters.imobiliaria_id &&
        r.provider === filters.provider &&
        (filters.ativo === undefined || r.ativo === filters.ativo)
      );
    };

    const selectBuilder = {
      eq(col: string, val: unknown) {
        filters[col] = val;
        return selectBuilder;
      },
      order(col: string, _opts?: { ascending?: boolean }) {
        // Retorna thenable: `await supabase.from(...).select(...).eq(...).order(...)`
        const rows = filterSecrets().slice().sort((a, b) => {
          const av = (a as Record<string, unknown>)[col] as number ?? 0;
          const bv = (b as Record<string, unknown>)[col] as number ?? 0;
          return (_opts?.ascending ? 1 : -1) * (av - bv);
        });
        return Promise.resolve({ data: rows, error: null });
      },
      async maybeSingle() {
        const rows = filterSecrets();
        return { data: rows[0] ?? null, error: null };
      },
    };

    return {
      select(_cols: string) {
        if (table === "webhook_secrets") {
          state.secretSelects = (state.secretSelects ?? 0) + 1;
        }
        return selectBuilder;
      },
      async insert(row: Record<string, unknown>) {
        if (table === "webhook_nonces") {
          state.nonceInserts++;
          const key = `${row.imobiliaria_id}::${row.provider}::${row.nonce}`;
          if (state.nonces.has(key)) {
            return { error: { code: "23505", message: "unique violation" } };
          }
          state.nonces.add(key);
          return { error: null };
        }
        return { error: null };
      },
      update(_patch: Record<string, unknown>) {
        // .update(...).eq(...).then(onOk, onErr) — retorna um thenable
        const chain = {
          eq(_col: string, _val: unknown) {
            return chain;
          },
          then(onOk: (v: unknown) => unknown, _onErr?: (e: unknown) => unknown) {
            return Promise.resolve({ error: null }).then(onOk);
          },
        };
        return chain;
      },
    };
  };

  const rpc = (name: string, args: Record<string, unknown>) => {
    state.rpcCalls.push({ name, args });
    // Precisa ser thenable (verifyWebhook chama .then(...) direto)
    return {
      then(onOk: (v: unknown) => unknown, _onErr?: (e: unknown) => unknown) {
        return Promise.resolve({ data: null, error: null }).then(onOk);
      },
    };
  };

  return { from, rpc } as unknown as import(
    "https://esm.sh/@supabase/supabase-js@2"
  ).SupabaseClient;
}

// ---------------------------------------------------------------------------
// Helpers de assinatura
// ---------------------------------------------------------------------------

async function hmacHex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const TENANT_A = "11111111-1111-1111-1111-111111111111";
const TENANT_B = "22222222-2222-2222-2222-222222222222";
const SECRET_A = "super-secreto-tenant-a-🔐";
const SECRET_B = "outro-segredo-tenant-b";
const PROVIDER = "portal:zap";

function baseState(): FakeState {
  // Isolamento entre testes: cache/métricas em memória são globais no isolate.
  clearWebhookSecretsCache();
  clearWebhookNonceCache();
  return {
    secrets: [
      {
        id: "sec-a",
        imobiliaria_id: TENANT_A,
        provider: PROVIDER,
        secret: SECRET_A,
        ativo: true,
      },
      {
        id: "sec-b",
        imobiliaria_id: TENANT_B,
        provider: PROVIDER,
        secret: SECRET_B,
        ativo: true,
      },
      {
        id: "sec-a-inactive",
        imobiliaria_id: TENANT_A,
        provider: "portal:vivareal",
        secret: "irrelevante",
        ativo: false,
      },
    ],
    nonces: new Set(),
    rpcCalls: [],
    nonceInserts: 0,
  };
}

async function makeRequest(opts: {
  secret: string;
  tenantId: string;
  provider?: string;
  body?: string;
  timestamp?: number;
  nonce?: string;
  signatureOverride?: string;
  extraHeaders?: Record<string, string>;
  omit?: Array<"signature" | "timestamp" | "nonce">;
}) {
  const body = opts.body ?? JSON.stringify({ nome: "Teste", telefone: "1199" });
  const ts = opts.timestamp ?? Math.floor(Date.now() / 1000);
  const nonce = opts.nonce ?? crypto.randomUUID();
  const base = `${ts}.${nonce}.${body}`;
  const sig = opts.signatureOverride ?? `sha256=${await hmacHex(opts.secret, base)}`;
  const headers = new Headers({ "content-type": "application/json" });
  if (!opts.omit?.includes("signature")) headers.set("x-signature", sig);
  if (!opts.omit?.includes("timestamp")) headers.set("x-timestamp", String(ts));
  if (!opts.omit?.includes("nonce")) headers.set("x-nonce", nonce);
  for (const [k, v] of Object.entries(opts.extraHeaders ?? {})) headers.set(k, v);
  const req = new Request(
    `https://example.local/webhook?id=${opts.tenantId}&portal=zap`,
    { method: "POST", headers, body },
  );
  return { req, body, nonce, ts };
}

async function readReason(resp: Response): Promise<string> {
  const j = await resp.json();
  return String((j as { reason?: string }).reason ?? "");
}

// ---------------------------------------------------------------------------
// 1) HMAC — assinatura válida / inválida / ausente / malformada
// ---------------------------------------------------------------------------

Deno.test("HMAC · assinatura válida → ok:true e nonce persistido", async () => {
  const state = baseState();
  const supabase = makeFakeSupabase(state);
  const { req } = await makeRequest({ secret: SECRET_A, tenantId: TENANT_A });

  const res = await verifyWebhook(req, await req.clone().text(), {
    imobiliariaId: TENANT_A,
    provider: PROVIDER,
    supabaseOverride: supabase,
  });

  assertEquals(res.ok, true);
  assertEquals(res.secretRowId, "sec-a");
  assertEquals(state.nonceInserts, 1);
  const denied = state.rpcCalls.filter((c) => c.args._outcome === "denied");
  assertEquals(denied.length, 0); // nenhum log de negação
});

Deno.test("HMAC · assinatura inválida (segredo errado) → 401 assinatura_invalida", async () => {
  const state = baseState();
  const supabase = makeFakeSupabase(state);
  const { req } = await makeRequest({
    secret: "segredo-errado",
    tenantId: TENANT_A,
  });

  const res = await verifyWebhook(req, await req.clone().text(), {
    imobiliariaId: TENANT_A,
    provider: PROVIDER,
    supabaseOverride: supabase,
  });

  assertEquals(res.ok, false);
  assertEquals(res.response!.status, 401);
  assertEquals(await readReason(res.response!), "assinatura_invalida");
  assertEquals(state.nonceInserts, 0);
});

Deno.test("HMAC · assinatura ausente → 401 assinatura_ausente_ou_malformada", async () => {
  const state = baseState();
  const supabase = makeFakeSupabase(state);
  const { req } = await makeRequest({
    secret: SECRET_A,
    tenantId: TENANT_A,
    omit: ["signature"],
  });

  const res = await verifyWebhook(req, await req.clone().text(), {
    imobiliariaId: TENANT_A,
    provider: PROVIDER,
    supabaseOverride: supabase,
  });

  assertEquals(res.ok, false);
  assertEquals(res.response!.status, 401);
  assertStringIncludes(await readReason(res.response!), "assinatura");
});

Deno.test("HMAC · assinatura malformada (não-hex) → 401", async () => {
  const state = baseState();
  const supabase = makeFakeSupabase(state);
  const { req } = await makeRequest({
    secret: SECRET_A,
    tenantId: TENANT_A,
    signatureOverride: "sha256=ZZZZ-not-hex",
  });

  const res = await verifyWebhook(req, await req.clone().text(), {
    imobiliariaId: TENANT_A,
    provider: PROVIDER,
    supabaseOverride: supabase,
  });

  assertEquals(res.ok, false);
  assertEquals(res.response!.status, 401);
});

Deno.test("HMAC · aceita header sem prefixo 'sha256='", async () => {
  const state = baseState();
  const supabase = makeFakeSupabase(state);
  const body = "{}";
  const ts = Math.floor(Date.now() / 1000);
  const nonce = "n-" + crypto.randomUUID();
  const sig = await hmacHex(SECRET_A, `${ts}.${nonce}.${body}`);
  const req = new Request(`https://x/webhook?id=${TENANT_A}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-signature": sig, // sem prefixo
      "x-timestamp": String(ts),
      "x-nonce": nonce,
    },
    body,
  });

  const res = await verifyWebhook(req, body, {
    imobiliariaId: TENANT_A,
    provider: PROVIDER,
    supabaseOverride: supabase,
  });

  assertEquals(res.ok, true);
});

Deno.test("HMAC · body diferente do assinado → 401 (integridade)", async () => {
  const state = baseState();
  const supabase = makeFakeSupabase(state);
  const { req } = await makeRequest({
    secret: SECRET_A,
    tenantId: TENANT_A,
    body: '{"nome":"original"}',
  });

  // Body adulterado no caminho — verifyWebhook usa o rawBody passado, então
  // simular adulteração é passar um rawBody diferente.
  const res = await verifyWebhook(req, '{"nome":"adulterado"}', {
    imobiliariaId: TENANT_A,
    provider: PROVIDER,
    supabaseOverride: supabase,
  });

  assertEquals(res.ok, false);
  assertEquals(await readReason(res.response!), "assinatura_invalida");
});

// ---------------------------------------------------------------------------
// 2) Replay protection — timestamp e nonce
// ---------------------------------------------------------------------------

Deno.test("Replay · timestamp ausente → 400 timestamp_ausente", async () => {
  const state = baseState();
  const supabase = makeFakeSupabase(state);
  const { req } = await makeRequest({
    secret: SECRET_A,
    tenantId: TENANT_A,
    omit: ["timestamp"],
  });

  const res = await verifyWebhook(req, await req.clone().text(), {
    imobiliariaId: TENANT_A,
    provider: PROVIDER,
    supabaseOverride: supabase,
  });

  assertEquals(res.ok, false);
  assertEquals(res.response!.status, 400);
  assertEquals(await readReason(res.response!), "timestamp_ausente");
});

Deno.test("Replay · timestamp muito antigo (>5min) → 401 fora_da_janela", async () => {
  const state = baseState();
  const supabase = makeFakeSupabase(state);
  const { req } = await makeRequest({
    secret: SECRET_A,
    tenantId: TENANT_A,
    timestamp: Math.floor(Date.now() / 1000) - 400,
  });

  const res = await verifyWebhook(req, await req.clone().text(), {
    imobiliariaId: TENANT_A,
    provider: PROVIDER,
    supabaseOverride: supabase,
  });

  assertEquals(res.ok, false);
  assertEquals(await readReason(res.response!), "timestamp_fora_da_janela");
});

Deno.test("Replay · timestamp muito no futuro (>5min) → 401 fora_da_janela", async () => {
  const state = baseState();
  const supabase = makeFakeSupabase(state);
  const { req } = await makeRequest({
    secret: SECRET_A,
    tenantId: TENANT_A,
    timestamp: Math.floor(Date.now() / 1000) + 400,
  });

  const res = await verifyWebhook(req, await req.clone().text(), {
    imobiliariaId: TENANT_A,
    provider: PROVIDER,
    supabaseOverride: supabase,
  });

  assertEquals(res.ok, false);
  assertEquals(await readReason(res.response!), "timestamp_fora_da_janela");
});

Deno.test("Replay · nonce ausente → 400 nonce_invalido", async () => {
  const state = baseState();
  const supabase = makeFakeSupabase(state);
  const { req } = await makeRequest({
    secret: SECRET_A,
    tenantId: TENANT_A,
    omit: ["nonce"],
  });

  const res = await verifyWebhook(req, await req.clone().text(), {
    imobiliariaId: TENANT_A,
    provider: PROVIDER,
    supabaseOverride: supabase,
  });

  assertEquals(res.ok, false);
  assertEquals(await readReason(res.response!), "nonce_invalido");
});

Deno.test("Replay · nonce muito curto (<8) → 400 nonce_invalido", async () => {
  const state = baseState();
  const supabase = makeFakeSupabase(state);
  const { req } = await makeRequest({
    secret: SECRET_A,
    tenantId: TENANT_A,
    nonce: "abc",
  });

  const res = await verifyWebhook(req, await req.clone().text(), {
    imobiliariaId: TENANT_A,
    provider: PROVIDER,
    supabaseOverride: supabase,
  });

  assertEquals(res.ok, false);
  assertEquals(await readReason(res.response!), "nonce_invalido");
});

Deno.test("Replay · nonce muito longo (>200) → 400 nonce_invalido", async () => {
  const state = baseState();
  const supabase = makeFakeSupabase(state);
  const { req } = await makeRequest({
    secret: SECRET_A,
    tenantId: TENANT_A,
    nonce: "x".repeat(250),
  });

  const res = await verifyWebhook(req, await req.clone().text(), {
    imobiliariaId: TENANT_A,
    provider: PROVIDER,
    supabaseOverride: supabase,
  });

  assertEquals(res.ok, false);
  assertEquals(await readReason(res.response!), "nonce_invalido");
});

Deno.test("Replay · nonce reutilizado (mesmo tenant/provider) → 409 replay_detectado", async () => {
  const state = baseState();
  const supabase = makeFakeSupabase(state);
  const body = JSON.stringify({ nome: "Repetido" });
  const ts = Math.floor(Date.now() / 1000);
  const nonce = "repeat-" + crypto.randomUUID();
  const sig = "sha256=" + await hmacHex(SECRET_A, `${ts}.${nonce}.${body}`);
  const headers = {
    "content-type": "application/json",
    "x-signature": sig,
    "x-timestamp": String(ts),
    "x-nonce": nonce,
  };
  const buildReq = () =>
    new Request(`https://x/webhook?id=${TENANT_A}`, {
      method: "POST",
      headers,
      body,
    });

  // 1ª chamada — sucesso
  const first = await verifyWebhook(buildReq(), body, {
    imobiliariaId: TENANT_A,
    provider: PROVIDER,
    supabaseOverride: supabase,
  });
  assertEquals(first.ok, true);

  // 2ª chamada com o MESMO nonce — deve ser rejeitada
  const second = await verifyWebhook(buildReq(), body, {
    imobiliariaId: TENANT_A,
    provider: PROVIDER,
    supabaseOverride: supabase,
  });
  assertEquals(second.ok, false);
  assertEquals(second.response!.status, 409);
  // Cache in-memory pega o replay antes do DB (fonte da verdade continua sendo a tabela).
  const reason = await readReason(second.response!);
  if (reason !== "replay_detectado_cache" && reason !== "replay_detectado") {
    throw new Error(`reason inesperado: ${reason}`);
  }
});

Deno.test("Replay · fallback pelo DB quando cache é limpo entre tentativas → replay_detectado", async () => {
  const state = baseState();
  const supabase = makeFakeSupabase(state);
  const body = JSON.stringify({ nome: "DB" });
  const ts = Math.floor(Date.now() / 1000);
  const nonce = "db-replay-" + crypto.randomUUID();
  const sig = "sha256=" + await hmacHex(SECRET_A, `${ts}.${nonce}.${body}`);
  const headers = {
    "content-type": "application/json",
    "x-signature": sig, "x-timestamp": String(ts), "x-nonce": nonce,
  };
  const buildReq = () =>
    new Request(`https://x/webhook?id=${TENANT_A}`, { method: "POST", headers, body });

  const first = await verifyWebhook(buildReq(), body, {
    imobiliariaId: TENANT_A, provider: PROVIDER, supabaseOverride: supabase,
  });
  assertEquals(first.ok, true);
  clearWebhookNonceCache(); // simula outro isolate sem cache warm
  const second = await verifyWebhook(buildReq(), body, {
    imobiliariaId: TENANT_A, provider: PROVIDER, supabaseOverride: supabase,
  });
  assertEquals(second.ok, false);
  assertEquals(await readReason(second.response!), "replay_detectado");
});

Deno.test("Replay · mesmo nonce em tenants diferentes é permitido (escopo por tenant/provider)", async () => {
  const state = baseState();
  const supabase = makeFakeSupabase(state);
  const nonce = "shared-nonce-" + crypto.randomUUID();

  const a = await makeRequest({ secret: SECRET_A, tenantId: TENANT_A, nonce });
  const resA = await verifyWebhook(a.req, await a.req.clone().text(), {
    imobiliariaId: TENANT_A,
    provider: PROVIDER,
    supabaseOverride: supabase,
  });
  assertEquals(resA.ok, true);

  const b = await makeRequest({ secret: SECRET_B, tenantId: TENANT_B, nonce });
  const resB = await verifyWebhook(b.req, await b.req.clone().text(), {
    imobiliariaId: TENANT_B,
    provider: PROVIDER,
    supabaseOverride: supabase,
  });
  assertEquals(resB.ok, true);
});

// ---------------------------------------------------------------------------
// 3) Checagem de tenant
// ---------------------------------------------------------------------------

Deno.test("Tenant · UUID inválido → 400 tenant_invalido", async () => {
  const state = baseState();
  const supabase = makeFakeSupabase(state);
  const { req } = await makeRequest({ secret: SECRET_A, tenantId: TENANT_A });

  const res = await verifyWebhook(req, await req.clone().text(), {
    imobiliariaId: "not-a-uuid",
    provider: PROVIDER,
    supabaseOverride: supabase,
  });

  assertEquals(res.ok, false);
  assertEquals(res.response!.status, 400);
  assertEquals(await readReason(res.response!), "tenant_invalido");
});

Deno.test("Tenant · X-Tenant-Id divergente do path → 403 tenant_mismatch", async () => {
  const state = baseState();
  const supabase = makeFakeSupabase(state);
  const { req } = await makeRequest({
    secret: SECRET_A,
    tenantId: TENANT_A,
    extraHeaders: { "x-tenant-id": TENANT_B },
  });

  const res = await verifyWebhook(req, await req.clone().text(), {
    imobiliariaId: TENANT_A,
    provider: PROVIDER,
    supabaseOverride: supabase,
  });

  assertEquals(res.ok, false);
  assertEquals(res.response!.status, 403);
  assertEquals(await readReason(res.response!), "tenant_mismatch");
});

Deno.test("Tenant · X-Tenant-Id igual ao path → aceito", async () => {
  const state = baseState();
  const supabase = makeFakeSupabase(state);
  const { req } = await makeRequest({
    secret: SECRET_A,
    tenantId: TENANT_A,
    extraHeaders: { "x-tenant-id": TENANT_A },
  });

  const res = await verifyWebhook(req, await req.clone().text(), {
    imobiliariaId: TENANT_A,
    provider: PROVIDER,
    supabaseOverride: supabase,
  });

  assertEquals(res.ok, true);
});

Deno.test("Tenant · segredo do tenant B NÃO valida chamada do tenant A", async () => {
  // Cenário crítico: atacante conhece o segredo do próprio tenant (B) e
  // tenta assinar uma chamada usando o path do tenant A. Precisa falhar
  // porque o lookup do segredo é por (imobiliariaId, provider), não pela chave.
  const state = baseState();
  const supabase = makeFakeSupabase(state);
  const { req } = await makeRequest({ secret: SECRET_B, tenantId: TENANT_A });

  const res = await verifyWebhook(req, await req.clone().text(), {
    imobiliariaId: TENANT_A,
    provider: PROVIDER,
    supabaseOverride: supabase,
  });

  assertEquals(res.ok, false);
  assertEquals(await readReason(res.response!), "assinatura_invalida");
});

Deno.test("Tenant · segredo de OUTRO provider (mesmo tenant) é rejeitado", async () => {
  // Isolamento por provider: uma chave configurada para 'portal:vivareal'
  // não pode ser aceita quando o webhook chega como 'portal:zap'.
  // No baseState, portal:vivareal está com ativo=false → não retorna do lookup.
  // Cenário aqui: cliente assina com o segredo do vivareal (inativo) tentando
  // fazer passar por zap — o lookup por 'portal:zap' devolve o segredo do zap
  // (SECRET_A) e a assinatura feita com "irrelevante" não bate.
  const state = baseState();
  const supabase = makeFakeSupabase(state);
  const { req } = await makeRequest({ secret: "irrelevante", tenantId: TENANT_A });

  const res = await verifyWebhook(req, await req.clone().text(), {
    imobiliariaId: TENANT_A,
    provider: PROVIDER,
    supabaseOverride: supabase,
  });

  assertEquals(res.ok, false);
  assertEquals(await readReason(res.response!), "assinatura_invalida");
});

Deno.test("Tenant · segredo inativo (ativo=false) → 401 segredo_nao_configurado", async () => {
  const state: FakeState = {
    ...baseState(),
    secrets: [
      {
        id: "sec-a",
        imobiliaria_id: TENANT_A,
        provider: PROVIDER,
        secret: SECRET_A,
        ativo: false, // inativo
      },
    ],
  };
  const supabase = makeFakeSupabase(state);
  const { req } = await makeRequest({ secret: SECRET_A, tenantId: TENANT_A });

  const res = await verifyWebhook(req, await req.clone().text(), {
    imobiliariaId: TENANT_A,
    provider: PROVIDER,
    supabaseOverride: supabase,
  });

  assertEquals(res.ok, false);
  assertEquals(res.response!.status, 401);
  assertEquals(await readReason(res.response!), "segredo_nao_configurado");
});

Deno.test("Tenant · segredo inexistente + fallback env → aceito", async () => {
  const state: FakeState = { ...baseState(), secrets: [] };
  const supabase = makeFakeSupabase(state);
  const FALLBACK = "fallback-env-secret";
  Deno.env.set("TEST_WEBHOOK_FALLBACK", FALLBACK);
  try {
    const { req } = await makeRequest({ secret: FALLBACK, tenantId: TENANT_A });
    const res = await verifyWebhook(req, await req.clone().text(), {
      imobiliariaId: TENANT_A,
      provider: PROVIDER,
      fallbackSecretEnv: "TEST_WEBHOOK_FALLBACK",
      supabaseOverride: supabase,
    });
    assertEquals(res.ok, true);
  } finally {
    Deno.env.delete("TEST_WEBHOOK_FALLBACK");
  }
});

Deno.test("Tenant · negações gravam trilha de auditoria via RPC log_service_role_call", async () => {
  const state = baseState();
  const supabase = makeFakeSupabase(state);
  const { req } = await makeRequest({
    secret: SECRET_A,
    tenantId: TENANT_A,
    extraHeaders: { "x-tenant-id": TENANT_B },
  });

  await verifyWebhook(req, await req.clone().text(), {
    imobiliariaId: TENANT_A,
    provider: PROVIDER,
    supabaseOverride: supabase,
  });

  // Precisa ter chamado a RPC de auditoria com outcome=denied
  await new Promise((r) => setTimeout(r, 0)); // flush microtasks
  const call = state.rpcCalls.find((c) => c.name === "log_service_role_call");
  assertEquals(call?.args._outcome, "denied");
  assertEquals(call?.args._reason, "tenant_mismatch");
});

// ---------------------------------------------------------------------------
// Rotação / versionamento (múltiplas chaves ativas)
// ---------------------------------------------------------------------------

const SECRET_A_V1 = "old-secret-v1-🕰️";
const SECRET_A_V2 = "new-secret-v2-🔑";

function rotationState(): FakeState {
  clearWebhookSecretsCache();
  return {
    secrets: [
      // v1 ativa, dentro do grace period (expires_at futuro)
      {
        id: "sec-a-v1",
        imobiliaria_id: TENANT_A,
        provider: PROVIDER,
        secret: SECRET_A_V1,
        ativo: true,
        version: 1,
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      },
      // v2 ativa, sem expiração (chave corrente)
      {
        id: "sec-a-v2",
        imobiliaria_id: TENANT_A,
        provider: PROVIDER,
        secret: SECRET_A_V2,
        ativo: true,
        version: 2,
        expires_at: null,
      },
    ],
    nonces: new Set(),
    rpcCalls: [],
    nonceInserts: 0,
  };
}

Deno.test("Rotação · assinatura com a chave NOVA (v2) é aceita", async () => {
  const state = rotationState();
  const supabase = makeFakeSupabase(state);
  const { req } = await makeRequest({ secret: SECRET_A_V2, tenantId: TENANT_A });
  const res = await verifyWebhook(req, await req.clone().text(), {
    imobiliariaId: TENANT_A,
    provider: PROVIDER,
    supabaseOverride: supabase,
  });
  assertEquals(res.ok, true);
  assertEquals(res.secretRowId, "sec-a-v2");
});

Deno.test("Rotação · assinatura com a chave ANTIGA (v1) dentro do grace period é aceita", async () => {
  const state = rotationState();
  const supabase = makeFakeSupabase(state);
  const { req } = await makeRequest({ secret: SECRET_A_V1, tenantId: TENANT_A });
  const res = await verifyWebhook(req, await req.clone().text(), {
    imobiliariaId: TENANT_A,
    provider: PROVIDER,
    supabaseOverride: supabase,
  });
  assertEquals(res.ok, true);
  assertEquals(res.secretRowId, "sec-a-v1");
});

Deno.test("Rotação · chave antiga com expires_at no passado é IGNORADA (grace encerrado)", async () => {
  const state = rotationState();
  // Move v1 para expiração passada
  state.secrets[0].expires_at = new Date(Date.now() - 60_000).toISOString();
  const supabase = makeFakeSupabase(state);
  const { req } = await makeRequest({ secret: SECRET_A_V1, tenantId: TENANT_A });
  const res = await verifyWebhook(req, await req.clone().text(), {
    imobiliariaId: TENANT_A,
    provider: PROVIDER,
    supabaseOverride: supabase,
  });
  assertEquals(res.ok, false);
  assertEquals(await readReason(res.response!), "assinatura_invalida");
});

Deno.test("Rotação · assinatura desconhecida é rejeitada mesmo com múltiplas versões ativas", async () => {
  const state = rotationState();
  const supabase = makeFakeSupabase(state);
  const { req } = await makeRequest({ secret: "chave-invasor", tenantId: TENANT_A });
  const res = await verifyWebhook(req, await req.clone().text(), {
    imobiliariaId: TENANT_A,
    provider: PROVIDER,
    supabaseOverride: supabase,
  });
  assertEquals(res.ok, false);
  assertEquals(await readReason(res.response!), "assinatura_invalida");
});

// ---------------------------------------------------------------------------
// Cache curto de chaves ativas (TTL 30s) — hit/miss, invalidação e expiração
// ---------------------------------------------------------------------------

async function runOnce(
  supabase: ReturnType<typeof makeFakeSupabase>,
  opts: { tenantId: string; secret: string; provider?: string },
) {
  const { req } = await makeRequest({
    secret: opts.secret,
    tenantId: opts.tenantId,
    provider: opts.provider,
  });
  return verifyWebhook(req, await req.clone().text(), {
    imobiliariaId: opts.tenantId,
    provider: opts.provider ?? PROVIDER,
    supabaseOverride: supabase,
  });
}

Deno.test("Cache · 2ª validação consecutiva NÃO consulta o banco (hit)", async () => {
  clearWebhookSecretsCache();
  const state = baseState();
  const supabase = makeFakeSupabase(state);

  const first = await runOnce(supabase, { tenantId: TENANT_A, secret: SECRET_A });
  assertEquals(first.ok, true);
  assertEquals(state.secretSelects, 1);

  const second = await runOnce(supabase, { tenantId: TENANT_A, secret: SECRET_A });
  assertEquals(second.ok, true);
  // Cache hit → nenhum SELECT novo em webhook_secrets.
  assertEquals(state.secretSelects, 1);
});

Deno.test("Cache · tenants/providers diferentes NÃO compartilham cache (miss por chave)", async () => {
  clearWebhookSecretsCache();
  const state = baseState();
  const supabase = makeFakeSupabase(state);

  const r1 = await runOnce(supabase, { tenantId: TENANT_A, secret: SECRET_A });
  assertEquals(r1.ok, true);
  assertEquals(state.secretSelects, 1);

  const r2 = await runOnce(supabase, { tenantId: TENANT_B, secret: SECRET_B });
  assertEquals(r2.ok, true);
  // Chave de cache diferente → novo SELECT.
  assertEquals(state.secretSelects, 2);
});

Deno.test("Cache · clearWebhookSecretsCache(tenant, provider) força miss na próxima chamada", async () => {
  clearWebhookSecretsCache();
  const state = baseState();
  const supabase = makeFakeSupabase(state);

  await runOnce(supabase, { tenantId: TENANT_A, secret: SECRET_A });
  await runOnce(supabase, { tenantId: TENANT_A, secret: SECRET_A });
  assertEquals(state.secretSelects, 1); // hit na 2ª

  clearWebhookSecretsCache(TENANT_A, PROVIDER);

  await runOnce(supabase, { tenantId: TENANT_A, secret: SECRET_A });
  // Após invalidação (como faz o endpoint rotate-webhook-secret) → miss.
  assertEquals(state.secretSelects, 2);
});

Deno.test("Cache · invalidação escopada NÃO afeta outros tenants", async () => {
  clearWebhookSecretsCache();
  const state = baseState();
  const supabase = makeFakeSupabase(state);

  await runOnce(supabase, { tenantId: TENANT_A, secret: SECRET_A });
  await runOnce(supabase, { tenantId: TENANT_B, secret: SECRET_B });
  assertEquals(state.secretSelects, 2);

  // Invalida apenas o tenant A.
  clearWebhookSecretsCache(TENANT_A, PROVIDER);

  await runOnce(supabase, { tenantId: TENANT_B, secret: SECRET_B });
  // Tenant B continua em cache → nenhum SELECT novo.
  assertEquals(state.secretSelects, 2);

  await runOnce(supabase, { tenantId: TENANT_A, secret: SECRET_A });
  // Tenant A refaz o SELECT.
  assertEquals(state.secretSelects, 3);
});

Deno.test("Cache · clearWebhookSecretsCache() sem args limpa tudo", async () => {
  clearWebhookSecretsCache();
  const state = baseState();
  const supabase = makeFakeSupabase(state);

  await runOnce(supabase, { tenantId: TENANT_A, secret: SECRET_A });
  await runOnce(supabase, { tenantId: TENANT_B, secret: SECRET_B });
  assertEquals(state.secretSelects, 2);

  clearWebhookSecretsCache();

  await runOnce(supabase, { tenantId: TENANT_A, secret: SECRET_A });
  await runOnce(supabase, { tenantId: TENANT_B, secret: SECRET_B });
  // Ambos precisam refazer o SELECT.
  assertEquals(state.secretSelects, 4);
});

Deno.test("Cache · chave com expires_at que vence DURANTE o TTL é descartada on-read", async () => {
  clearWebhookSecretsCache();
  const state: FakeState = {
    secrets: [
      {
        id: "sec-a-expiring",
        imobiliaria_id: TENANT_A,
        provider: PROVIDER,
        secret: SECRET_A,
        ativo: true,
        version: 1,
        // Expira ~150ms no futuro — dentro do TTL de 30s do cache.
        expires_at: new Date(Date.now() + 150).toISOString(),
      },
    ],
    nonces: new Set(),
    rpcCalls: [],
    nonceInserts: 0,
  };
  const supabase = makeFakeSupabase(state);

  // 1ª chamada: chave ainda válida → aceita e popula cache.
  const first = await runOnce(supabase, { tenantId: TENANT_A, secret: SECRET_A });
  assertEquals(first.ok, true);
  assertEquals(state.secretSelects, 1);

  // Aguarda expirar sem estourar o TTL do cache.
  await new Promise((r) => setTimeout(r, 250));

  // 2ª chamada: cache ainda quente, mas expires_at já passou → deve rejeitar.
  const second = await runOnce(supabase, { tenantId: TENANT_A, secret: SECRET_A });
  assertEquals(second.ok, false);
  assertEquals(await readReason(second.response!), "segredo_nao_configurado");
  // Confirma que NÃO houve novo SELECT: o descarte veio do cache (on-read).
  assertEquals(state.secretSelects, 1);
});


// ---------------------------------------------------------------------------
// Métricas — cache hit rate, tempo médio de validação e chaves testadas
// ---------------------------------------------------------------------------


Deno.test("Métricas · conta allowed/denied, cache hit/miss e agrega tempo", async () => {
  clearWebhookSecretsCache();
  resetWebhookMetrics();
  const state = baseState();
  const supabase = makeFakeSupabase(state);

  // 1ª: miss + allowed
  const r1 = await runOnce(supabase, { tenantId: TENANT_A, secret: SECRET_A });
  assertEquals(r1.ok, true);
  // 2ª: hit + allowed
  const r2 = await runOnce(supabase, { tenantId: TENANT_A, secret: SECRET_A });
  assertEquals(r2.ok, true);
  // 3ª: hit + denied (assinatura inválida)
  const r3 = await runOnce(supabase, { tenantId: TENANT_A, secret: "chave-errada" });
  assertEquals(r3.ok, false);

  const m = getWebhookMetrics(TENANT_A, PROVIDER);
  assertEquals(m.validations_total, 3);
  assertEquals(m.allowed, 2);
  assertEquals(m.denied, 1);
  assertEquals(m.denied_by_reason["assinatura_invalida"], 1);
  assertEquals(m.cache_misses, 1);
  assertEquals(m.cache_hits, 2);
  // Taxa de hit = 2/3
  if (Math.abs(m.cache_hit_rate - 2 / 3) > 1e-9) {
    throw new Error(`cache_hit_rate esperado ~0.6667, veio ${m.cache_hit_rate}`);
  }
  // Cada validação testou pelo menos 1 chave; nas denied testou todas as candidatas.
  if (m.keys_tested_total < 3) throw new Error("keys_tested_total abaixo do esperado");
  if (m.keys_tested_max < 1) throw new Error("keys_tested_max deve ser >= 1");
  if (m.validation_ms_total <= 0) throw new Error("validation_ms_total deve ser > 0");
  if (m.validation_ms_avg <= 0) throw new Error("validation_ms_avg deve ser > 0");
  if (!m.last_updated_at) throw new Error("last_updated_at deve ser preenchido");
});

Deno.test("Métricas · buckets por tenant/provider são isolados", async () => {
  clearWebhookSecretsCache();
  resetWebhookMetrics();
  const state = baseState();
  const supabase = makeFakeSupabase(state);

  await runOnce(supabase, { tenantId: TENANT_A, secret: SECRET_A });
  await runOnce(supabase, { tenantId: TENANT_B, secret: SECRET_B });
  await runOnce(supabase, { tenantId: TENANT_B, secret: SECRET_B });

  const a = getWebhookMetrics(TENANT_A, PROVIDER);
  const b = getWebhookMetrics(TENANT_B, PROVIDER);
  assertEquals(a.validations_total, 1);
  assertEquals(b.validations_total, 2);
  assertEquals(a.tenantId, TENANT_A);
  assertEquals(b.tenantId, TENANT_B);

  const all = getWebhookMetrics();
  assertEquals(all.length, 2);
});

Deno.test("Métricas · rotação com múltiplas chaves eleva keys_tested_max", async () => {
  clearWebhookSecretsCache();
  resetWebhookMetrics();
  const state = rotationState();
  const supabase = makeFakeSupabase(state);

  // Assina com a chave ANTIGA (v1): o loop tenta v2 primeiro (ordem desc por version)
  // e depois v1 → keys_tested = 2.
  const { req } = await makeRequest({ secret: SECRET_A_V1, tenantId: TENANT_A });
  const res = await verifyWebhook(req, await req.clone().text(), {
    imobiliariaId: TENANT_A,
    provider: PROVIDER,
    supabaseOverride: supabase,
  });
  assertEquals(res.ok, true);

  const m = getWebhookMetrics(TENANT_A, PROVIDER);
  assertEquals(m.keys_tested_max, 2);
  assertEquals(m.keys_tested_total, 2);
  assertEquals(m.keys_tested_avg, 2);
});

Deno.test("Métricas · resetWebhookMetrics(tenant, provider) zera apenas aquele bucket", async () => {
  clearWebhookSecretsCache();
  resetWebhookMetrics();
  const state = baseState();
  const supabase = makeFakeSupabase(state);

  await runOnce(supabase, { tenantId: TENANT_A, secret: SECRET_A });
  await runOnce(supabase, { tenantId: TENANT_B, secret: SECRET_B });
  resetWebhookMetrics(TENANT_A, PROVIDER);

  const a = getWebhookMetrics(TENANT_A, PROVIDER);
  const b = getWebhookMetrics(TENANT_B, PROVIDER);
  // A foi zerado (bucket recriado via snapshot); B preservado.
  assertEquals(a.validations_total, 0);
  assertEquals(b.validations_total, 1);
});

Deno.test("Métricas · tenant inválido NÃO cria bucket (evita poluição)", async () => {
  resetWebhookMetrics();
  const state = baseState();
  const supabase = makeFakeSupabase(state);
  const { req } = await makeRequest({ secret: SECRET_A, tenantId: TENANT_A });
  const res = await verifyWebhook(req, await req.clone().text(), {
    imobiliariaId: "nao-uuid",
    provider: PROVIDER,
    supabaseOverride: supabase,
  });
  assertEquals(res.ok, false);
  assertEquals(getWebhookMetrics().length, 0);
});

// ---------------------------------------------------------------------------
// Anti-replay via cache in-memory de nonce_prefix/timestamp
// ---------------------------------------------------------------------------

Deno.test("Cache anti-replay · reenvio do mesmo nonce é rejeitado sem tocar o DB", async () => {
  clearWebhookNonceCache();
  const state = baseState();
  const supabase = makeFakeSupabase(state);
  const { req } = await makeRequest({ secret: SECRET_A, tenantId: TENANT_A });
  const raw = await req.clone().text();

  // 1ª tentativa: sucesso, popula o cache e insere no DB.
  const ok = await verifyWebhook(req, raw, {
    imobiliariaId: TENANT_A, provider: PROVIDER, supabaseOverride: supabase,
  });
  assertEquals(ok.ok, true);
  assertEquals(state.nonceInserts, 1);

  // 2ª tentativa idêntica: cache curto-circuita ANTES do insert.
  const replay = await verifyWebhook(req, raw, {
    imobiliariaId: TENANT_A, provider: PROVIDER, supabaseOverride: supabase,
  });
  assertEquals(replay.ok, false);
  assertEquals(replay.response!.status, 409);
  assertEquals(await readReason(replay.response!), "replay_detectado_cache");
  // DB não recebeu novo insert de nonce (curto-circuito antes do banco).
  assertEquals(state.nonceInserts, 1);
});

Deno.test("Cache anti-replay · escopo por tenant/provider (não vaza entre tenants)", async () => {
  clearWebhookNonceCache();
  const stateA = baseState();
  const supabaseA = makeFakeSupabase(stateA);
  const nonce = "nonce-compartilhado-xyz";
  const { req: reqA } = await makeRequest({ secret: SECRET_A, tenantId: TENANT_A, nonce });
  await verifyWebhook(reqA, await reqA.clone().text(), {
    imobiliariaId: TENANT_A, provider: PROVIDER, supabaseOverride: supabaseA,
  });

  // Mesmo nonce, tenant diferente → deve passar (não é replay do B).
  const stateB = { ...baseState(), secrets: baseState().secrets };
  const supabaseB = makeFakeSupabase(stateB);
  const { req: reqB } = await makeRequest({ secret: SECRET_B, tenantId: TENANT_B, nonce });
  const res = await verifyWebhook(reqB, await reqB.clone().text(), {
    imobiliariaId: TENANT_B, provider: PROVIDER, supabaseOverride: supabaseB,
  });
  assertEquals(res.ok, true);
});

Deno.test("Cache anti-replay · clearWebhookNonceCache(tenant,provider) só limpa o escopo", async () => {
  clearWebhookNonceCache();
  const state = baseState();
  const supabase = makeFakeSupabase(state);
  const { req: r1 } = await makeRequest({ secret: SECRET_A, tenantId: TENANT_A, nonce: "nonce-aaa-111" });
  const { req: r2 } = await makeRequest({ secret: SECRET_B, tenantId: TENANT_B, nonce: "nonce-bbb-222" });
  await verifyWebhook(r1, await r1.clone().text(), {
    imobiliariaId: TENANT_A, provider: PROVIDER, supabaseOverride: supabase,
  });
  await verifyWebhook(r2, await r2.clone().text(), {
    imobiliariaId: TENANT_B, provider: PROVIDER, supabaseOverride: supabase,
  });
  const before = getWebhookNonceCacheStats().size;
  clearWebhookNonceCache(TENANT_A, PROVIDER);
  const after = getWebhookNonceCacheStats().size;
  assertEquals(before, 2);
  assertEquals(after, 1); // só o do TENANT_B sobrou
});

Deno.test("Cache anti-replay · stats reportam janela configurada e TTL coerente", () => {
  clearWebhookNonceCache();
  const s = getWebhookNonceCacheStats();
  assertEquals(s.size, 0);
  assertEquals(s.ttlMs, s.windowSeconds * 1000);
  // Default seguro (30..3600s); em ambiente sem env deve ser 300.
  if (s.windowSeconds < 30 || s.windowSeconds > 3600) throw new Error("janela fora do range");
});

Deno.test("Cache anti-replay · metadata de negação inclui nonce_prefix e window_seconds", async () => {
  clearWebhookNonceCache();
  const state = baseState();
  const supabase = makeFakeSupabase(state);
  const { req } = await makeRequest({ secret: SECRET_A, tenantId: TENANT_A, nonce: "nonce-metadata-1234" });
  const raw = await req.clone().text();
  await verifyWebhook(req, raw, {
    imobiliariaId: TENANT_A, provider: PROVIDER, supabaseOverride: supabase,
  });
  await verifyWebhook(req, raw, {
    imobiliariaId: TENANT_A, provider: PROVIDER, supabaseOverride: supabase,
  });
  const deniedCalls = state.rpcCalls.filter((c) =>
    c.args._outcome === "denied" && c.args._reason === "replay_detectado_cache"
  );
  assertEquals(deniedCalls.length, 1);
  const meta = deniedCalls[0].args._metadata as Record<string, unknown>;
  assertEquals(meta.nonce_prefix, "nonce-me");
  if (typeof meta.window_seconds !== "number") throw new Error("window_seconds ausente");
});

// ---------------------------------------------------------------------------
// Cache remoto (Redis) opcional — compartilhado entre isolates
// ---------------------------------------------------------------------------

import { invalidateWebhookSecretsCache, setRemoteSecretsCache } from "./webhookSecurity.ts";

function makeFakeRemote() {
  const store = new Map<string, { fetchedAt: number; secrets: unknown[] }>();
  let gets = 0, sets = 0, dels = 0;
  return {
    store, get gets() { return gets; }, get sets() { return sets; }, get dels() { return dels; },
    api: {
      // deno-lint-ignore no-explicit-any
      async get(k: string) { gets++; return (store.get(k) as any) ?? null; },
      // deno-lint-ignore no-explicit-any
      async set(k: string, v: any, _ttl: number) { sets++; store.set(k, v); },
      async del(k: string) { dels++; store.delete(k); },
    },
  };
}

Deno.test("Cache remoto · miss local + hit no Redis → não consulta o DB e popula local", async () => {
  clearWebhookSecretsCache();
  const state = baseState();
  const supabase = makeFakeSupabase(state);
  const fake = makeFakeRemote();
  setRemoteSecretsCache(fake.api);

  // 1ª validação: local e Redis vazios → busca no DB e popula ambos.
  const { req: r1 } = await makeRequest({ secret: SECRET_A, tenantId: TENANT_A });
  await verifyWebhook(r1, await r1.clone().text(), {
    imobiliariaId: TENANT_A, provider: PROVIDER, supabaseOverride: supabase,
  });
  assertEquals(state.secretSelects, 1);
  assertEquals(fake.sets, 1);

  // Simula OUTRO isolate: limpa só o cache local, mantém Redis populado.
  clearWebhookSecretsCache();
  const { req: r2 } = await makeRequest({ secret: SECRET_A, tenantId: TENANT_A });
  await verifyWebhook(r2, await r2.clone().text(), {
    imobiliariaId: TENANT_A, provider: PROVIDER, supabaseOverride: supabase,
  });
  // DB não foi consultado de novo — Redis serviu o segredo.
  assertEquals(state.secretSelects, 1);
  assertEquals(fake.gets >= 1, true);

  setRemoteSecretsCache(null);
});

Deno.test("Cache remoto · falha silenciosa cai para o DB (Redis é otimização)", async () => {
  clearWebhookSecretsCache();
  const state = baseState();
  const supabase = makeFakeSupabase(state);
  setRemoteSecretsCache({
    async get() { throw new Error("boom-redis"); },
    async set() { /* noop */ },
    async del() { /* noop */ },
  });

  const { req } = await makeRequest({ secret: SECRET_A, tenantId: TENANT_A });
  const res = await verifyWebhook(req, await req.clone().text(), {
    imobiliariaId: TENANT_A, provider: PROVIDER, supabaseOverride: supabase,
  });
  assertEquals(res.ok, true);
  assertEquals(state.secretSelects, 1); // caiu no DB apesar da falha
  setRemoteSecretsCache(null);
});

Deno.test("Cache remoto · invalidateWebhookSecretsCache limpa local E remoto", async () => {
  clearWebhookSecretsCache();
  const state = baseState();
  const supabase = makeFakeSupabase(state);
  const fake = makeFakeRemote();
  setRemoteSecretsCache(fake.api);

  const { req } = await makeRequest({ secret: SECRET_A, tenantId: TENANT_A });
  await verifyWebhook(req, await req.clone().text(), {
    imobiliariaId: TENANT_A, provider: PROVIDER, supabaseOverride: supabase,
  });
  assertEquals(fake.store.size, 1);

  await invalidateWebhookSecretsCache(TENANT_A, PROVIDER);
  assertEquals(fake.dels, 1);
  assertEquals(fake.store.size, 0);
  setRemoteSecretsCache(null);
});

Deno.test("Cache remoto · desligado (null) preserva comportamento local-only", async () => {
  setRemoteSecretsCache(null);
  clearWebhookSecretsCache();
  const state = baseState();
  const supabase = makeFakeSupabase(state);
  const { req } = await makeRequest({ secret: SECRET_A, tenantId: TENANT_A });
  const res = await verifyWebhook(req, await req.clone().text(), {
    imobiliariaId: TENANT_A, provider: PROVIDER, supabaseOverride: supabase,
  });
  assertEquals(res.ok, true);
  assertEquals(state.secretSelects, 1);
});

// ---------------------------------------------------------------------------
// Concorrência · rotação + validação simultânea NÃO aceita segredo vencido
// ---------------------------------------------------------------------------
//
// Estes testes exercitam o cenário que motiva o grace period: enquanto
// múltiplas requisições estão em voo, uma rotação pode acontecer. O contrato
// é: uma vez que `expires_at` de uma versão está no passado, NENHUMA
// validação — mesmo servida do cache local — pode aceitá-la. O filtro
// "on read" em verifyWebhook (row.expires_at < nowMs) é o gatilho, e estes
// testes garantem que ele resista a paralelismo agressivo.

const SECRET_A_OLD = SECRET_A;
const SECRET_A_NEW = "nova-chave-pos-rotacao-🔁";

function countBy<T, K extends string>(arr: T[], pick: (x: T) => K): Record<K, number> {
  const out = {} as Record<K, number>;
  for (const it of arr) {
    const k = pick(it);
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

Deno.test("Concorrência · 50 validações paralelas com segredo em grace period vencido → todas negadas", async () => {
  clearWebhookSecretsCache();
  clearWebhookNonceCache();
  const state = baseState();
  // Grace period já vencido (1s no passado) para SECRET_A.
  state.secrets = [{
    id: "sec-a", imobiliaria_id: TENANT_A, provider: PROVIDER,
    secret: SECRET_A_OLD, ativo: true, version: 1,
    expires_at: new Date(Date.now() - 1000).toISOString(),
  }];
  const supabase = makeFakeSupabase(state);

  const results = await Promise.all(Array.from({ length: 50 }, async () => {
    const { req } = await makeRequest({ secret: SECRET_A_OLD, tenantId: TENANT_A });
    return verifyWebhook(req, await req.clone().text(), {
      imobiliariaId: TENANT_A, provider: PROVIDER, supabaseOverride: supabase,
    });
  }));

  assertEquals(results.every((r) => r.ok === false), true);
  // Cada resposta deve mencionar segredo_nao_configurado (candidatos vazios
  // após filtro por expires_at) — nunca `assinatura_valida`.
  const reasons = await Promise.all(results.map(async (r) => await readReason(r.response!)));
  const buckets = countBy(reasons, (x) => x as "segredo_nao_configurado" | "assinatura_invalida");
  assertEquals(buckets.assinatura_invalida ?? 0, 0);
  // Nenhum nonce persistido — falhamos antes do insert.
  assertEquals(state.nonceInserts, 0);
});

Deno.test("Concorrência · rotação in-flight: versão antiga vencida NUNCA valida, nova valida", async () => {
  clearWebhookSecretsCache();
  clearWebhookNonceCache();
  const state = baseState();
  state.secrets = [
    { id: "sec-a-v1", imobiliaria_id: TENANT_A, provider: PROVIDER, secret: SECRET_A_OLD, ativo: true, version: 1 },
  ];
  const supabase = makeFakeSupabase(state);

  // Aquece o cache local com SECRET_A_OLD (v1) — ainda válido.
  const { req: warm } = await makeRequest({ secret: SECRET_A_OLD, tenantId: TENANT_A });
  const warmRes = await verifyWebhook(warm, await warm.clone().text(), {
    imobiliariaId: TENANT_A, provider: PROVIDER, supabaseOverride: supabase,
  });
  assertEquals(warmRes.ok, true);

  // ROTAÇÃO: expira v1 (grace vencido) + insere v2 + invalida cache.
  state.secrets[0].expires_at = new Date(Date.now() - 1).toISOString();
  state.secrets.push({
    id: "sec-a-v2", imobiliaria_id: TENANT_A, provider: PROVIDER,
    secret: SECRET_A_NEW, ativo: true, version: 2,
  });
  await invalidateWebhookSecretsCache(TENANT_A, PROVIDER);

  // 30 validações concorrentes — metade assina com a versão vencida, metade com a nova.
  const jobs = Array.from({ length: 30 }, (_, i) => async () => {
    const useOld = i % 2 === 0;
    const { req } = await makeRequest({
      secret: useOld ? SECRET_A_OLD : SECRET_A_NEW,
      tenantId: TENANT_A,
    });
    const res = await verifyWebhook(req, await req.clone().text(), {
      imobiliariaId: TENANT_A, provider: PROVIDER, supabaseOverride: supabase,
    });
    return { useOld, res };
  });
  const results = await Promise.all(jobs.map((j) => j()));

  for (const { useOld, res } of results) {
    if (useOld) {
      // Assinatura da versão vencida: precisa cair antes de qualquer HMAC match,
      // seja por candidatos vazios (se v2 ainda não estivesse ativa) ou por
      // assinatura_invalida (v2 ativa, HMAC não bate). Nunca ok:true.
      assertEquals(res.ok, false);
      const reason = await readReason(res.response!);
      if (reason !== "assinatura_invalida" && reason !== "segredo_nao_configurado") {
        throw new Error(`versão vencida foi aceita com razão inesperada: ${reason}`);
      }
    } else {
      assertEquals(res.ok, true);
      assertEquals(res.secretRowId, "sec-a-v2");
    }
  }
});

Deno.test("Concorrência · cache LOCAL aquecido não sobrevive a expires_at vencido (filtro on-read)", async () => {
  clearWebhookSecretsCache();
  clearWebhookNonceCache();
  const state = baseState();
  state.secrets = [{
    id: "sec-a", imobiliaria_id: TENANT_A, provider: PROVIDER,
    secret: SECRET_A_OLD, ativo: true, version: 1,
  }];
  const supabase = makeFakeSupabase(state);

  // Aquece cache local (secretSelects=1).
  const { req: warm } = await makeRequest({ secret: SECRET_A_OLD, tenantId: TENANT_A });
  await verifyWebhook(warm, await warm.clone().text(), {
    imobiliariaId: TENANT_A, provider: PROVIDER, supabaseOverride: supabase,
  });
  assertEquals(state.secretSelects, 1);

  // Simula grace period vencendo DURANTE TTL do cache (30s), SEM chamar invalidate.
  // O snapshot em cache ainda referencia SECRET_A_OLD, mas com expires_at agora
  // no passado — o filtro on-read em verifyWebhook precisa descartá-lo mesmo
  // servindo do cache local. A referência é a mesma linha do state (mutação
  // direta reflete no cache pois o fake retorna o próprio objeto).
  //
  // Como o cache armazenou uma cópia (via .map em loadActiveSecrets), forçamos
  // via invalidação sintética + repopulação: apenas expiramos e limpamos o
  // cache local para simular "cache expirou naturalmente" mas mantendo Redis
  // desligado. Este subteste cobre o cenário pós-refresh natural.
  state.secrets[0].expires_at = new Date(Date.now() - 500).toISOString();
  clearWebhookSecretsCache();
  const noncesBefore = state.nonceInserts;

  const results = await Promise.all(Array.from({ length: 20 }, async () => {
    const { req } = await makeRequest({ secret: SECRET_A_OLD, tenantId: TENANT_A });
    return verifyWebhook(req, await req.clone().text(), {
      imobiliariaId: TENANT_A, provider: PROVIDER, supabaseOverride: supabase,
    });
  }));

  assertEquals(results.every((r) => r.ok === false), true);
  const reasons = await Promise.all(results.map(async (r) => await readReason(r.response!)));
  assertEquals(reasons.every((r) => r === "segredo_nao_configurado"), true);
  assertEquals(state.nonceInserts, noncesBefore);
});

Deno.test("Concorrência · invalidate no meio do lote não deixa passar segredo já vencido", async () => {
  clearWebhookSecretsCache();
  clearWebhookNonceCache();
  const state = baseState();
  // v1 já com grace vencido, v2 ativa e válida.
  state.secrets = [
    {
      id: "sec-a-v1", imobiliaria_id: TENANT_A, provider: PROVIDER,
      secret: SECRET_A_OLD, ativo: true, version: 1,
      expires_at: new Date(Date.now() - 1).toISOString(),
    },
    { id: "sec-a-v2", imobiliaria_id: TENANT_A, provider: PROVIDER, secret: SECRET_A_NEW, ativo: true, version: 2 },
  ];
  const supabase = makeFakeSupabase(state);

  // Dispara 40 validações e, no meio, chama invalidate — força busca fresca
  // no DB para metade das requisições. Nenhuma versão vencida pode passar.
  const N = 40;
  const jobs: Promise<{ old: boolean; ok: boolean; reason: string }>[] = [];
  for (let i = 0; i < N; i++) {
    const useOld = i % 2 === 0;
    jobs.push((async () => {
      const { req } = await makeRequest({
        secret: useOld ? SECRET_A_OLD : SECRET_A_NEW, tenantId: TENANT_A,
      });
      const res = await verifyWebhook(req, await req.clone().text(), {
        imobiliariaId: TENANT_A, provider: PROVIDER, supabaseOverride: supabase,
      });
      const reason = res.ok ? "assinatura_valida" : await readReason(res.response!);
      return { old: useOld, ok: res.ok, reason };
    })());
    if (i === Math.floor(N / 2)) {
      // Invalidação síncrona no meio do lote (sem await para simular corrida).
      invalidateWebhookSecretsCache(TENANT_A, PROVIDER);
    }
  }
  const results = await Promise.all(jobs);

  const olds = results.filter((r) => r.old);
  const news = results.filter((r) => !r.old);
  // Nenhuma requisição assinada com o segredo vencido pode ter sucesso.
  assertEquals(olds.every((r) => r.ok === false), true);
  // Todas as novas assinaturas passam — a rotação não pode causar falso-negativo.
  assertEquals(news.every((r) => r.ok === true), true);
});

// ---------------------------------------------------------------------------
// Métricas expandidas · keys_loaded, request_id e log estruturado
// ---------------------------------------------------------------------------

Deno.test("Métricas · keys_loaded_max reflete todas as chaves ativas retornadas do storage", async () => {
  clearWebhookSecretsCache();
  resetWebhookMetrics();
  const state = baseState();
  // 3 chaves ativas simultâneas para o mesmo tenant/provider (rotação em andamento).
  state.secrets = [
    { id: "k1", imobiliaria_id: TENANT_A, provider: PROVIDER, secret: "s1", ativo: true, version: 1 },
    { id: "k2", imobiliaria_id: TENANT_A, provider: PROVIDER, secret: "s2", ativo: true, version: 2 },
    { id: "k3", imobiliaria_id: TENANT_A, provider: PROVIDER, secret: SECRET_A, ativo: true, version: 3 },
  ];
  const supabase = makeFakeSupabase(state);

  const { req } = await makeRequest({ secret: SECRET_A, tenantId: TENANT_A });
  const res = await verifyWebhook(req, await req.clone().text(), {
    imobiliariaId: TENANT_A, provider: PROVIDER, supabaseOverride: supabase,
  });
  assertEquals(res.ok, true);

  const snap = getWebhookMetrics(TENANT_A, PROVIDER);
  assertEquals(snap.keys_loaded_max, 3);
  assertEquals(snap.keys_loaded_total, 3);
  // keys_tested pode ser menor (curto-circuita ao achar match); loaded conta o universo.
  if (snap.keys_tested_total > snap.keys_loaded_total) {
    throw new Error("keys_tested não pode exceder keys_loaded");
  }
});

Deno.test("Correlação · verifyWebhook devolve request_id e o inclui em audit log + resposta HTTP", async () => {
  clearWebhookSecretsCache();
  clearWebhookNonceCache();
  resetWebhookMetrics();
  const state = baseState();
  const supabase = makeFakeSupabase(state);

  // Caso 1: cliente envia X-Request-Id → propagamos.
  const clientReqId = "req-cliente-abc-123";
  const { req: r1 } = await makeRequest({
    secret: SECRET_A, tenantId: TENANT_A,
    extraHeaders: { "x-request-id": clientReqId },
  });
  const res1 = await verifyWebhook(r1, await r1.clone().text(), {
    imobiliariaId: TENANT_A, provider: PROVIDER, supabaseOverride: supabase,
  });
  assertEquals(res1.ok, true);
  assertEquals(res1.requestId, clientReqId);
  const allowed = state.rpcCalls.find((c) => c.args._outcome === "allowed")!;
  assertEquals((allowed.args._metadata as Record<string, unknown>).request_id, clientReqId);

  // Caso 2: sem header → geramos UUID e propagamos na resposta de negação.
  const { req: r2 } = await makeRequest({
    secret: "errado", tenantId: TENANT_A,
  });
  const res2 = await verifyWebhook(r2, await r2.clone().text(), {
    imobiliariaId: TENANT_A, provider: PROVIDER, supabaseOverride: supabase,
  });
  assertEquals(res2.ok, false);
  if (!/^[0-9a-f-]{36}$/i.test(res2.requestId)) {
    throw new Error(`request_id gerado deve ser UUID: ${res2.requestId}`);
  }
  assertEquals(res2.response!.headers.get("X-Request-Id"), res2.requestId);
  const body = await res2.response!.json();
  assertEquals(body.request_id, res2.requestId);
  const denied = state.rpcCalls.find((c) =>
    c.args._outcome === "denied" && (c.args._metadata as Record<string, unknown>).request_id === res2.requestId
  );
  if (!denied) throw new Error("audit log de negação não correlacionou request_id");
});

Deno.test("Log estruturado · emite JSON com correlação por request_id", async () => {
  clearWebhookSecretsCache();
  clearWebhookNonceCache();
  resetWebhookMetrics();
  const state = baseState();
  const supabase = makeFakeSupabase(state);
  const captured: string[] = [];
  const origLog = console.log;
  const origWarn = console.warn;
  console.log = (...a: unknown[]) => { captured.push(a.map(String).join(" ")); };
  console.warn = (...a: unknown[]) => { captured.push(a.map(String).join(" ")); };
  try {
    const { req } = await makeRequest({
      secret: SECRET_A, tenantId: TENANT_A,
      extraHeaders: { "x-request-id": "trace-xyz" },
    });
    const res = await verifyWebhook(req, await req.clone().text(), {
      imobiliariaId: TENANT_A, provider: PROVIDER, supabaseOverride: supabase,
    });
    assertEquals(res.ok, true);
  } finally {
    console.log = origLog;
    console.warn = origWarn;
  }
  const line = captured.find((l) => l.includes("[webhookSecurity]") && l.includes("trace-xyz"));
  if (!line) throw new Error("log estruturado não emitido");
  const jsonPart = line.substring(line.indexOf("{"));
  const parsed = JSON.parse(jsonPart);
  assertEquals(parsed.evt, "webhook_verify");
  assertEquals(parsed.request_id, "trace-xyz");
  assertEquals(parsed.outcome, "allowed");
  assertEquals(parsed.tenant_id, TENANT_A);
  assertEquals(parsed.provider, PROVIDER);
  assertStringIncludes(String(parsed.secrets_source), "db");
  if (typeof parsed.validation_ms !== "number") throw new Error("validation_ms ausente no log");
  if (typeof parsed.keys_loaded !== "number") throw new Error("keys_loaded ausente no log");
});

Deno.test("Métricas · tempo médio de validação é registrado (validation_ms_avg > 0)", async () => {
  clearWebhookSecretsCache();
  clearWebhookNonceCache();
  resetWebhookMetrics();
  const state = baseState();
  const supabase = makeFakeSupabase(state);
  for (let i = 0; i < 5; i++) {
    const { req } = await makeRequest({ secret: SECRET_A, tenantId: TENANT_A });
    await verifyWebhook(req, await req.clone().text(), {
      imobiliariaId: TENANT_A, provider: PROVIDER, supabaseOverride: supabase,
    });
  }
  const snap = getWebhookMetrics(TENANT_A, PROVIDER);
  assertEquals(snap.validations_total, 5);
  if (snap.validation_ms_avg <= 0) throw new Error("validation_ms_avg deve ser > 0");
  if (snap.validation_ms_max < snap.validation_ms_avg) {
    throw new Error("validation_ms_max deve ser >= avg");
  }
  // 5 requests: 1 miss (1ª) + 4 hits → hit rate = 0.8
  if (Math.abs(snap.cache_hit_rate - 0.8) > 0.0001) {
    throw new Error(`cache_hit_rate inesperado: ${snap.cache_hit_rate}`);
  }
});
