// Load test comparativo do módulo webhookSecurity.
//
// Simula alta taxa de validações distribuídas entre múltiplos tenants/providers
// e mede lado-a-lado o cenário "cache habilitado" vs "cache desabilitado":
//   - latência (avg, p50, p95, p99, max)
//   - throughput (req/s)
//   - consultas SELECT em webhook_secrets (proxy de carga no banco)
//   - cache hit-rate reportado pelas métricas internas
//
// Roda offline usando o mesmo padrão do arquivo de testes: injetamos um
// SupabaseClient fake via `supabaseOverride`, e cada SELECT em `webhook_secrets`
// incrementa um contador — sem depender do DB real.
//
// Uso:
//   deno run -A supabase/functions/_shared/webhookSecurity.load.bench.ts
//
// Parâmetros via env:
//   LOAD_ITERATIONS=5000       (total de validações por cenário)
//   LOAD_TENANTS=10
//   LOAD_PROVIDERS=3
//   LOAD_CONCURRENCY=32        (paralelismo com Promise.all em lotes)
//   LOAD_MAX_DB_RATIO=0.15     (guarda: DB queries com cache / sem cache)
//   LOAD_MAX_LAT_RATIO=1.00    (guarda: latência avg com cache / sem cache)
//
// Saída: `coverage/webhook-security/load-report.json` + tabela em stdout.
// Sai com código 1 se cache não reduzir DB queries e latência conforme os
// thresholds — permitindo bloquear regressão em CI.

import {
  clearWebhookNonceCache,
  clearWebhookSecretsCache,
  getWebhookMetrics,
  resetWebhookMetrics,
  verifyWebhook,
} from "./webhookSecurity.ts";

// ---------------------------------------------------------------------------
// Fake Supabase — conta SELECTs em webhook_secrets (custo de banco)
// ---------------------------------------------------------------------------
type SecretRow = {
  id: string;
  imobiliaria_id: string;
  provider: string;
  secret: string;
  ativo: boolean;
  version?: number | null;
  expires_at?: string | null;
};

interface FakeState {
  secrets: SecretRow[];
  nonces: Set<string>;
  secretSelects: number;
  nonceInserts: number;
}

function makeFakeSupabase(state: FakeState) {
  const from = (table: string) => {
    const filters: Record<string, unknown> = {};
    const filterSecrets = () =>
      table !== "webhook_secrets" ? [] : state.secrets.filter((r) =>
        r.imobiliaria_id === filters.imobiliaria_id &&
        r.provider === filters.provider &&
        (filters.ativo === undefined || r.ativo === filters.ativo)
      );
    const builder = {
      eq(col: string, val: unknown) {
        filters[col] = val;
        return builder;
      },
      order(col: string, opts?: { ascending?: boolean }) {
        const rows = filterSecrets().slice().sort((a, b) => {
          const av = ((a as Record<string, unknown>)[col] as number) ?? 0;
          const bv = ((b as Record<string, unknown>)[col] as number) ?? 0;
          return (opts?.ascending ? 1 : -1) * (av - bv);
        });
        return Promise.resolve({ data: rows, error: null });
      },
      async maybeSingle() {
        return { data: filterSecrets()[0] ?? null, error: null };
      },
    };
    return {
      select(_c: string) {
        if (table === "webhook_secrets") state.secretSelects++;
        return builder;
      },
      async insert(row: Record<string, unknown>) {
        if (table === "webhook_nonces") {
          state.nonceInserts++;
          const k = `${row.imobiliaria_id}::${row.provider}::${row.nonce}`;
          if (state.nonces.has(k)) {
            return { error: { code: "23505", message: "unique violation" } };
          }
          state.nonces.add(k);
        }
        return { error: null };
      },
      update(_p: Record<string, unknown>) {
        const chain = {
          eq(_k: string, _v: unknown) { return chain; },
          then(onOk: (v: unknown) => unknown) {
            return Promise.resolve({ error: null }).then(onOk);
          },
        };
        return chain;
      },
    };
  };
  const rpc = (_n: string, _a: Record<string, unknown>) => ({
    then(onOk: (v: unknown) => unknown) {
      return Promise.resolve({ data: null, error: null }).then(onOk);
    },
  });
  // deno-lint-ignore no-explicit-any
  return { from, rpc } as any;
}

// ---------------------------------------------------------------------------
// Helpers de assinatura HMAC
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

async function buildRequest(
  secret: string,
  tenantId: string,
  provider: string,
): Promise<{ req: Request; body: string }> {
  const ts = Math.floor(Date.now() / 1000);
  // Nonce único por request evita rejeição por replay durante o bench.
  const nonce = crypto.randomUUID();
  const body = JSON.stringify({ lead_id: nonce.slice(0, 8), tenant: tenantId });
  const sig = `sha256=${await hmacHex(secret, `${ts}.${nonce}.${body}`)}`;
  const req = new Request(
    `https://bench.local/webhook?id=${tenantId}&provider=${encodeURIComponent(provider)}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-signature": sig,
        "x-timestamp": String(ts),
        "x-nonce": nonce,
        "x-tenant-id": tenantId,
      },
      body,
    },
  );
  return { req, body };
}

// ---------------------------------------------------------------------------
// Estatísticas
// ---------------------------------------------------------------------------
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

function summarize(latencies: number[]) {
  const sorted = latencies.slice().sort((a, b) => a - b);
  const total = latencies.reduce((s, x) => s + x, 0);
  return {
    count: latencies.length,
    avg: total / (latencies.length || 1),
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    max: sorted[sorted.length - 1] ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Cenário de carga
// ---------------------------------------------------------------------------
interface RunOptions {
  label: "cache_on" | "cache_off";
  iterations: number;
  tenants: string[];
  providers: string[];
  secretsByTenant: Map<string, string>;
  concurrency: number;
}

interface RunResult {
  label: string;
  iterations: number;
  wall_ms: number;
  throughput_rps: number;
  latency_ms: ReturnType<typeof summarize>;
  db_selects: number;
  db_selects_per_1k: number;
  nonce_inserts: number;
  denied: number;
  cache_hit_rate: number;
}

async function runScenario(opts: RunOptions): Promise<RunResult> {
  // Estado limpo para cada cenário — sem contaminação entre passes.
  clearWebhookSecretsCache();
  clearWebhookNonceCache();
  resetWebhookMetrics();

  const state: FakeState = {
    secrets: opts.tenants.flatMap((t) =>
      opts.providers.map((p, i) => ({
        id: `${t}-${p}-${i}`,
        imobiliaria_id: t,
        provider: p,
        secret: opts.secretsByTenant.get(t)!,
        ativo: true,
        version: 1,
        expires_at: null,
      }))
    ),
    nonces: new Set(),
    secretSelects: 0,
    nonceInserts: 0,
  };
  const supabase = makeFakeSupabase(state);

  const latencies: number[] = new Array(opts.iterations);
  let denied = 0;
  const wallStart = performance.now();

  // Execução em lotes para simular concorrência sem estourar memória.
  for (let start = 0; start < opts.iterations; start += opts.concurrency) {
    const batch: Promise<void>[] = [];
    const end = Math.min(start + opts.concurrency, opts.iterations);
    for (let i = start; i < end; i++) {
      const tenant = opts.tenants[i % opts.tenants.length];
      const provider = opts.providers[i % opts.providers.length];
      const secret = opts.secretsByTenant.get(tenant)!;
      batch.push((async () => {
        // Cache OFF: invalida antes de CADA validação para forçar hit ao DB.
        // Cache ON: deixa o cache local acumular naturalmente (TTL 60s).
        if (opts.label === "cache_off") {
          clearWebhookSecretsCache(tenant, provider);
        }
        const { req, body } = await buildRequest(secret, tenant, provider);
        const t0 = performance.now();
        const res = await verifyWebhook(req, body, {
          imobiliariaId: tenant,
          provider,
          supabaseOverride: supabase,
        });
        latencies[i] = performance.now() - t0;
        if (!res.ok) denied++;
      })());
    }
    await Promise.all(batch);
  }

  const wall = performance.now() - wallStart;
  const stats = summarize(latencies);

  // Agrega cache_hit_rate ponderado por tenant/provider.
  let hits = 0, total = 0;
  for (const t of opts.tenants) {
    for (const p of opts.providers) {
      const m = getWebhookMetrics(t, p);
      if (!m) continue;
      hits += m.cache_hits;
      total += m.cache_hits + m.cache_misses;
    }
  }

  return {
    label: opts.label,
    iterations: opts.iterations,
    wall_ms: Number(wall.toFixed(2)),
    throughput_rps: Number(((opts.iterations / wall) * 1000).toFixed(2)),
    latency_ms: {
      count: stats.count,
      avg: Number(stats.avg.toFixed(4)),
      p50: Number(stats.p50.toFixed(4)),
      p95: Number(stats.p95.toFixed(4)),
      p99: Number(stats.p99.toFixed(4)),
      max: Number(stats.max.toFixed(4)),
    },
    db_selects: state.secretSelects,
    db_selects_per_1k: Number(((state.secretSelects / opts.iterations) * 1000).toFixed(2)),
    nonce_inserts: state.nonceInserts,
    denied,
    cache_hit_rate: total === 0 ? 0 : Number((hits / total).toFixed(4)),
  };
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------
function envNumber(key: string, fallback: number): number {
  const raw = Deno.env.get(key);
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const iterations = envNumber("LOAD_ITERATIONS", 5000);
const numTenants = envNumber("LOAD_TENANTS", 10);
const numProviders = envNumber("LOAD_PROVIDERS", 3);
const concurrency = envNumber("LOAD_CONCURRENCY", 32);
const maxDbRatio = Number(Deno.env.get("LOAD_MAX_DB_RATIO") ?? "0.15");
const maxLatRatio = Number(Deno.env.get("LOAD_MAX_LAT_RATIO") ?? "1.00");

// Gera tenants (UUIDs determinísticos) e providers.
const tenants = Array.from({ length: numTenants }, (_, i) => {
  const hex = String(i + 1).padStart(12, "0");
  return `00000000-0000-4000-8000-${hex}`;
});
const providers = ["portal:zap", "portal:vivareal", "portal:olx", "portal:imovelweb", "portal:quintoandar"]
  .slice(0, numProviders);
const secretsByTenant = new Map(
  tenants.map((t, i) => [t, `bench-secret-${i}-🔐-${crypto.randomUUID()}`]),
);

console.log(`\n🚀 Load test webhookSecurity`);
console.log(`   iterations=${iterations}  tenants=${numTenants}  providers=${numProviders}  concurrency=${concurrency}`);

// Warm-up rápido: JIT do Deno + primeira compilação do HMAC não deve poluir
// o cenário "cache_on".
await runScenario({
  label: "cache_off",
  iterations: Math.min(200, iterations),
  tenants,
  providers,
  secretsByTenant,
  concurrency,
});

const off = await runScenario({
  label: "cache_off",
  iterations,
  tenants,
  providers,
  secretsByTenant,
  concurrency,
});
const on = await runScenario({
  label: "cache_on",
  iterations,
  tenants,
  providers,
  secretsByTenant,
  concurrency,
});

// ---------------------------------------------------------------------------
// Relatório
// ---------------------------------------------------------------------------
const dbRatio = off.db_selects === 0 ? 0 : on.db_selects / off.db_selects;
const latRatio = off.latency_ms.avg === 0 ? 1 : on.latency_ms.avg / off.latency_ms.avg;
const rpsGain = off.throughput_rps === 0 ? 0 : on.throughput_rps / off.throughput_rps;

const report = {
  generated_at: new Date().toISOString(),
  config: { iterations, tenants: numTenants, providers: numProviders, concurrency },
  thresholds: { max_db_ratio: maxDbRatio, max_latency_ratio: maxLatRatio },
  scenarios: { cache_off: off, cache_on: on },
  comparison: {
    db_query_ratio: Number(dbRatio.toFixed(4)),           // menor = melhor
    db_query_reduction_pct: Number(((1 - dbRatio) * 100).toFixed(2)),
    avg_latency_ratio: Number(latRatio.toFixed(4)),       // <1 = melhor
    throughput_multiplier: Number(rpsGain.toFixed(2)),    // >1 = melhor
  },
};

const line = "─".repeat(78);
console.log(`\n${line}`);
console.log(`Métrica                       │ cache_off        │ cache_on         │ delta`);
console.log(line);
const row = (label: string, a: number | string, b: number | string, delta: string) =>
  console.log(`${label.padEnd(30)}│ ${String(a).padEnd(17)}│ ${String(b).padEnd(17)}│ ${delta}`);
row("iterações", off.iterations, on.iterations, "—");
row("wall (ms)", off.wall_ms, on.wall_ms, `${(on.wall_ms / off.wall_ms).toFixed(2)}x`);
row("throughput (req/s)", off.throughput_rps, on.throughput_rps, `${rpsGain.toFixed(2)}x`);
row("latência avg (ms)", off.latency_ms.avg, on.latency_ms.avg, `${latRatio.toFixed(2)}x`);
row("latência p50 (ms)", off.latency_ms.p50, on.latency_ms.p50, "—");
row("latência p95 (ms)", off.latency_ms.p95, on.latency_ms.p95, "—");
row("latência p99 (ms)", off.latency_ms.p99, on.latency_ms.p99, "—");
row("DB selects (webhook_secrets)", off.db_selects, on.db_selects, `${(dbRatio * 100).toFixed(1)}%`);
row("DB selects / 1k reqs", off.db_selects_per_1k, on.db_selects_per_1k, "—");
row("cache hit-rate", off.cache_hit_rate, on.cache_hit_rate, "—");
row("negações", off.denied, on.denied, "—");
console.log(line);
console.log(`Redução de carga no DB: ${report.comparison.db_query_reduction_pct}%   ·   Ganho de throughput: ${rpsGain.toFixed(2)}x\n`);

// ---------------------------------------------------------------------------
// Persistência do relatório
// ---------------------------------------------------------------------------
const outDir = "coverage/webhook-security";
try { await Deno.mkdir(outDir, { recursive: true }); } catch { /* ok */ }
await Deno.writeTextFile(`${outDir}/load-report.json`, JSON.stringify(report, null, 2));
console.log(`📄 Relatório salvo em ${outDir}/load-report.json`);

const gh = Deno.env.get("GITHUB_STEP_SUMMARY");
if (gh) {
  const md = `## ⚡ Load test · webhookSecurity

| Métrica | cache_off | cache_on | delta |
|---------|-----------|----------|-------|
| Throughput (req/s) | ${off.throughput_rps} | ${on.throughput_rps} | **${rpsGain.toFixed(2)}x** |
| Latência avg (ms) | ${off.latency_ms.avg} | ${on.latency_ms.avg} | ${latRatio.toFixed(2)}x |
| Latência p95 (ms) | ${off.latency_ms.p95} | ${on.latency_ms.p95} | — |
| DB selects | ${off.db_selects} | ${on.db_selects} | **${(dbRatio * 100).toFixed(1)}%** |
| Cache hit-rate | ${(off.cache_hit_rate * 100).toFixed(1)}% | ${(on.cache_hit_rate * 100).toFixed(1)}% | — |

Config: ${iterations} iters · ${numTenants} tenants · ${numProviders} providers · concurrency ${concurrency}
`;
  await Deno.writeTextFile(gh, md, { append: true });
}

// ---------------------------------------------------------------------------
// Guardrails de regressão
// ---------------------------------------------------------------------------
const failures: string[] = [];
if (dbRatio > maxDbRatio) {
  failures.push(`DB query ratio ${dbRatio.toFixed(3)} > ${maxDbRatio} (cache não está reduzindo hits ao banco)`);
}
if (latRatio > maxLatRatio) {
  failures.push(`Latência avg com cache ${latRatio.toFixed(3)}x > ${maxLatRatio}x sem cache (regressão)`);
}
if (off.denied > 0 || on.denied > 0) {
  failures.push(`Requests negadas inesperadamente: off=${off.denied} on=${on.denied}`);
}

if (failures.length > 0) {
  console.error(`\n❌ Load test falhou:\n  - ${failures.join("\n  - ")}`);
  Deno.exit(1);
}
console.log(`✅ Load test aprovado (cache reduziu DB em ${report.comparison.db_query_reduction_pct}% e manteve latência dentro do threshold).`);
