// Testes de alertas por threshold (cache_hit_rate_low e validation_latency_high).
// Cobre:
//   - Amostra mínima: não dispara antes de atingir `minSamples`.
//   - Disparo warning vs critical (limites de severidade).
//   - Cooldown por (tenant, provider, alert_type): segundo disparo é suprimido.
//   - Reset de cooldown reabilita o alerta.
//   - Flag WEBHOOK_ALERTS_ENABLED=0 suprime tudo.
//   - Alertas isolados por tenant/provider (não vazam entre chaves).
//
// Rodar: deno test -A supabase/functions/_shared/webhookSecurity.alerts.test.ts

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  __seedWebhookMetricsForTest,
  checkWebhookThresholds,
  resetWebhookAlertCooldowns,
  resetWebhookMetrics,
  resetWebhookThresholdOverrideCache,
} from "./webhookSecurity.ts";

const TENANT_A = "11111111-1111-1111-1111-111111111111";
const TENANT_B = "22222222-2222-2222-2222-222222222222";
const PROVIDER = "portal-leads";

function resetAll() {
  resetWebhookMetrics();
  resetWebhookAlertCooldowns();
  resetWebhookThresholdOverrideCache();
}

// -----------------------------------------------------------------------------
// cache_hit_rate_low
// -----------------------------------------------------------------------------

Deno.test("cache_hit_rate_low · abaixo da amostra mínima → nenhum alerta", () => {
  resetAll();
  // 10 validações (default minSamples=50), taxa de cache 20% (bem abaixo do 70%).
  __seedWebhookMetricsForTest(TENANT_A, PROVIDER, {
    validations_total: 10,
    allowed: 10,
    cache_hits: 2,
    cache_misses: 8,
    validation_ms_total: 100,
    validation_ms_max: 20,
    last_updated_at: Date.now(),
  });
  const alerts = checkWebhookThresholds(TENANT_A, PROVIDER);
  assertEquals(alerts.length, 0, "amostra pequena não deve disparar");
});

Deno.test("cache_hit_rate_low · atinge amostra mínima → dispara warning", () => {
  resetAll();
  // 60 validações, hit rate 50% (< 70% default, mas > 40% crítico) → warning.
  __seedWebhookMetricsForTest(TENANT_A, PROVIDER, {
    validations_total: 60,
    allowed: 60,
    cache_hits: 30,
    cache_misses: 30,
    validation_ms_total: 300, // avg 5ms (não estoura latência)
    validation_ms_max: 10,
    last_updated_at: Date.now(),
  });
  const alerts = checkWebhookThresholds(TENANT_A, PROVIDER);
  assertEquals(alerts.length, 1);
  assertEquals(alerts[0].alertType, "cache_hit_rate_low");
  assertEquals(alerts[0].severity, "warning");
  assertEquals(alerts[0].tenantId, TENANT_A);
  assertEquals(alerts[0].provider, PROVIDER);
  assertEquals(alerts[0].sampleSize, 60);
});

Deno.test("cache_hit_rate_low · hit rate abaixo do crítico → severity=critical", () => {
  resetAll();
  // hit rate 20% (< 40% crítico default) → critical.
  __seedWebhookMetricsForTest(TENANT_A, PROVIDER, {
    validations_total: 60,
    allowed: 60,
    cache_hits: 12,
    cache_misses: 48,
    validation_ms_total: 300,
    validation_ms_max: 10,
    last_updated_at: Date.now(),
  });
  const alerts = checkWebhookThresholds(TENANT_A, PROVIDER);
  assertEquals(alerts.length, 1);
  assertEquals(alerts[0].severity, "critical");
});

// -----------------------------------------------------------------------------
// validation_latency_high
// -----------------------------------------------------------------------------

Deno.test("validation_latency_high · abaixo da amostra mínima → nenhum alerta", () => {
  resetAll();
  __seedWebhookMetricsForTest(TENANT_A, PROVIDER, {
    validations_total: 10,
    allowed: 10,
    cache_hits: 10,        // 100% hit — não dispara cache_hit_rate_low
    cache_misses: 0,
    validation_ms_total: 20_000, // avg 2000ms
    validation_ms_max: 2500,
    last_updated_at: Date.now(),
  });
  const alerts = checkWebhookThresholds(TENANT_A, PROVIDER);
  assertEquals(alerts.length, 0);
});

Deno.test("validation_latency_high · avg > 500ms com amostra suficiente → warning", () => {
  resetAll();
  // 60 validações, avg 800ms (> 500), max 1200 (< 1500 crítico) → warning.
  __seedWebhookMetricsForTest(TENANT_A, PROVIDER, {
    validations_total: 60,
    allowed: 60,
    cache_hits: 60,
    cache_misses: 0,
    validation_ms_total: 48_000, // 60 * 800
    validation_ms_max: 1200,
    last_updated_at: Date.now(),
  });
  const alerts = checkWebhookThresholds(TENANT_A, PROVIDER);
  assertEquals(alerts.length, 1);
  assertEquals(alerts[0].alertType, "validation_latency_high");
  assertEquals(alerts[0].severity, "warning");
});

Deno.test("validation_latency_high · avg > 1500ms → severity=critical", () => {
  resetAll();
  __seedWebhookMetricsForTest(TENANT_A, PROVIDER, {
    validations_total: 60,
    allowed: 60,
    cache_hits: 60,
    cache_misses: 0,
    validation_ms_total: 120_000, // avg 2000ms
    validation_ms_max: 3000,
    last_updated_at: Date.now(),
  });
  const alerts = checkWebhookThresholds(TENANT_A, PROVIDER);
  assertEquals(alerts.length, 1);
  assertEquals(alerts[0].severity, "critical");
});

// -----------------------------------------------------------------------------
// Cooldown
// -----------------------------------------------------------------------------

Deno.test("cooldown · segundo disparo consecutivo é suprimido para o mesmo tipo", () => {
  resetAll();
  __seedWebhookMetricsForTest(TENANT_A, PROVIDER, {
    validations_total: 60,
    allowed: 60,
    cache_hits: 12,
    cache_misses: 48,
    validation_ms_total: 300,
    validation_ms_max: 10,
    last_updated_at: Date.now(),
  });
  const first = checkWebhookThresholds(TENANT_A, PROVIDER);
  assertEquals(first.length, 1, "primeiro disparo deve emitir alerta");
  const second = checkWebhookThresholds(TENANT_A, PROVIDER);
  assertEquals(second.length, 0, "cooldown deve suprimir disparo imediato");
});

Deno.test("cooldown · reset reabilita alertas para o par", () => {
  resetAll();
  __seedWebhookMetricsForTest(TENANT_A, PROVIDER, {
    validations_total: 60,
    allowed: 60,
    cache_hits: 12,
    cache_misses: 48,
    validation_ms_total: 300,
    validation_ms_max: 10,
    last_updated_at: Date.now(),
  });
  assertEquals(checkWebhookThresholds(TENANT_A, PROVIDER).length, 1);
  assertEquals(checkWebhookThresholds(TENANT_A, PROVIDER).length, 0);
  resetWebhookAlertCooldowns(TENANT_A, PROVIDER);
  assertEquals(checkWebhookThresholds(TENANT_A, PROVIDER).length, 1);
});

Deno.test("cooldown · isolado por tipo de alerta", () => {
  resetAll();
  // hit rate baixo + latência alta, ambos passíveis de disparo.
  __seedWebhookMetricsForTest(TENANT_A, PROVIDER, {
    validations_total: 60,
    allowed: 60,
    cache_hits: 12,
    cache_misses: 48,
    validation_ms_total: 48_000, // avg 800ms
    validation_ms_max: 1200,
    last_updated_at: Date.now(),
  });
  const alerts = checkWebhookThresholds(TENANT_A, PROVIDER);
  const types = alerts.map((a) => a.alertType).sort();
  assertEquals(types, ["cache_hit_rate_low", "validation_latency_high"]);
});

Deno.test("cooldown · isolado por tenant/provider", () => {
  resetAll();
  const seed = {
    validations_total: 60,
    allowed: 60,
    cache_hits: 12,
    cache_misses: 48,
    validation_ms_total: 300,
    validation_ms_max: 10,
    last_updated_at: Date.now(),
  };
  __seedWebhookMetricsForTest(TENANT_A, PROVIDER, seed);
  __seedWebhookMetricsForTest(TENANT_B, PROVIDER, seed);
  __seedWebhookMetricsForTest(TENANT_A, "outra-integracao", seed);

  assertEquals(checkWebhookThresholds(TENANT_A, PROVIDER).length, 1);
  // Outros pares NÃO devem ser afetados pelo cooldown do primeiro.
  assertEquals(checkWebhookThresholds(TENANT_B, PROVIDER).length, 1);
  assertEquals(checkWebhookThresholds(TENANT_A, "outra-integracao").length, 1);
});

// -----------------------------------------------------------------------------
// Overrides via env / desligamento
// -----------------------------------------------------------------------------

Deno.test("WEBHOOK_ALERTS_ENABLED=0 · suprime disparo mesmo com métricas ruins", () => {
  resetAll();
  __seedWebhookMetricsForTest(TENANT_A, PROVIDER, {
    validations_total: 200,
    allowed: 200,
    cache_hits: 10,
    cache_misses: 190,
    validation_ms_total: 400_000, // avg 2000ms
    validation_ms_max: 3000,
    last_updated_at: Date.now(),
  });
  const original = Deno.env.get("WEBHOOK_ALERTS_ENABLED");
  Deno.env.set("WEBHOOK_ALERTS_ENABLED", "0");
  try {
    assertEquals(checkWebhookThresholds(TENANT_A, PROVIDER).length, 0);
  } finally {
    if (original === undefined) Deno.env.delete("WEBHOOK_ALERTS_ENABLED");
    else Deno.env.set("WEBHOOK_ALERTS_ENABLED", original);
  }
});

Deno.test("overrides in-memory · cooldown=0 permite disparos consecutivos", () => {
  resetAll();
  __seedWebhookMetricsForTest(TENANT_A, PROVIDER, {
    validations_total: 60,
    allowed: 60,
    cache_hits: 12,
    cache_misses: 48,
    validation_ms_total: 300,
    validation_ms_max: 10,
    last_updated_at: Date.now(),
  });
  const a = checkWebhookThresholds(TENANT_A, PROVIDER, { cooldownMs: 0 });
  const b = checkWebhookThresholds(TENANT_A, PROVIDER, { cooldownMs: 0 });
  assertEquals(a.length, 1);
  assertEquals(b.length, 1, "cooldownMs=0 deve permitir disparo consecutivo");
});

Deno.test("overrides · minSamples elevado impede disparo mesmo com métricas ruins", () => {
  resetAll();
  __seedWebhookMetricsForTest(TENANT_A, PROVIDER, {
    validations_total: 60,
    allowed: 60,
    cache_hits: 12,
    cache_misses: 48,
    validation_ms_total: 300,
    validation_ms_max: 10,
    last_updated_at: Date.now(),
  });
  const alerts = checkWebhookThresholds(TENANT_A, PROVIDER, { minSamples: 1000 });
  assertEquals(alerts.length, 0);
});
