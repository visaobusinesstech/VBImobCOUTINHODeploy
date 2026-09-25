// Módulo compartilhado de segurança para webhooks (leads e pagamentos).
// - Verifica assinatura HMAC-SHA256 (comparação em tempo constante).
// - Bloqueia replay via timestamp (janela ±5 min) + nonce persistido em `webhook_nonces`.
// - Confirma que o tenant informado no path/query bate com o tenant do segredo.
//
// Uso típico numa edge function:
//   const check = await verifyWebhook(req, rawBody, {
//     imobiliariaId, provider: "portal-leads",
//   });
//   if (!check.ok) return check.response;
//
// Headers esperados (aceitos em maiúsculas/minúsculas):
//   X-Signature   : "sha256=<hex>"    (ou apenas o hex)
//   X-Timestamp   : unix seconds
//   X-Nonce       : identificador único do provedor para o evento (idempotência)
//   X-Tenant-Id   : opcional, checa cruzado com o parâmetro do path
//
// A base assinada é: `${timestamp}.${nonce}.${rawBody}` — o mesmo formato que
// o remetente deve produzir com o segredo compartilhado (webhook_secrets.secret).

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// Janela de replay configurável via env (default 300s = ±5min).
function readReplayWindowSeconds(): number {
  try {
    const raw = Deno.env.get("WEBHOOK_REPLAY_WINDOW_SECONDS");
    const n = raw ? parseInt(raw, 10) : NaN;
    if (Number.isFinite(n) && n >= 30 && n <= 3600) return n;
  } catch { /* ambiente sem Deno.env — usa default */ }
  return 300;
}
const REPLAY_WINDOW_SECONDS = readReplayWindowSeconds();

// -------- Cache in-memory de nonces recentes (anti-replay rápido) --------
// Antes de recalcular HMAC e tocar o banco, checamos um cache local de
// nonces já vistos dentro da janela de replay. Isso rejeita reenvios
// óbvios em O(1), sem trabalho criptográfico e sem round-trip ao DB.
// A tabela `webhook_nonces` continua sendo a fonte da verdade em cluster
// (múltiplos isolates); o cache é apenas uma primeira linha de defesa.
const NONCE_CACHE_TTL_MS = REPLAY_WINDOW_SECONDS * 1000;
const NONCE_CACHE_MAX_ENTRIES = 10_000;
interface NonceCacheEntry { expiresAt: number; timestamp: number; }
const nonceCache = new Map<string, NonceCacheEntry>();

function nonceCacheKey(tenantId: string, provider: string, nonce: string): string {
  return `${tenantId}::${provider}::${nonce}`;
}
function nonceCacheGet(key: string): NonceCacheEntry | null {
  const entry = nonceCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    nonceCache.delete(key);
    return null;
  }
  return entry;
}
function nonceCacheSet(key: string, timestamp: number): void {
  if (nonceCache.size >= NONCE_CACHE_MAX_ENTRIES) {
    // Descarta as entradas mais antigas (Map preserva ordem de inserção).
    const drop = Math.max(1, Math.floor(NONCE_CACHE_MAX_ENTRIES * 0.1));
    let i = 0;
    for (const k of nonceCache.keys()) {
      nonceCache.delete(k);
      if (++i >= drop) break;
    }
  }
  nonceCache.set(key, { expiresAt: Date.now() + NONCE_CACHE_TTL_MS, timestamp });
}

/** Limpa cache in-memory de nonces (uso: testes, rotação, incidentes). */
export function clearWebhookNonceCache(tenantId?: string, provider?: string): void {
  if (!tenantId || !provider) { nonceCache.clear(); return; }
  const prefix = `${tenantId}::${provider}::`;
  for (const k of nonceCache.keys()) if (k.startsWith(prefix)) nonceCache.delete(k);
}
/** Retorna estatística simples do cache (para observabilidade/testes). */
export function getWebhookNonceCacheStats(): { size: number; ttlMs: number; windowSeconds: number } {
  // Compacta on-read: remove expirados antes de contar.
  const now = Date.now();
  for (const [k, v] of nonceCache) if (v.expiresAt <= now) nonceCache.delete(k);
  return { size: nonceCache.size, ttlMs: NONCE_CACHE_TTL_MS, windowSeconds: REPLAY_WINDOW_SECONDS };
}

// -------- Cache curto de chaves ativas por tenant/provider --------
// Reduz consultas ao banco sob alta carga. TTL curto (30s) mantém a janela
// de propagação de rotações/expirações praticamente imperceptível — na pior
// hipótese, uma chave recém-rotacionada leva ~30s para aparecer, e uma chave
// que acabou de expirar leva o mesmo tempo para sair do cache. Como cada
// entrada carrega `expires_at`, também filtramos "on read" segredos que
// venceram entre a última busca e agora — assim, mesmo dentro do TTL,
// segredos com grace_period já vencido são descartados automaticamente.
const SECRETS_CACHE_TTL_MS = 30_000;
const SECRETS_CACHE_MAX_ENTRIES = 500;

interface CachedSecret {
  id: string;
  secret: string;
  version: number | null;
  expires_at: string | null;
}
interface SecretsCacheEntry {
  fetchedAt: number;
  secrets: CachedSecret[];
}
const secretsCache = new Map<string, SecretsCacheEntry>();

function secretsCacheKey(tenantId: string, provider: string): string {
  return `${tenantId}::${provider}`;
}

// -------- Remote cache (Redis) opcional --------
// Compartilha o cache de chaves ativas entre múltiplos isolates. Injetável via
// `setRemoteSecretsCache(...)` (testes) OU auto-configurável via Upstash REST
// quando `WEBHOOK_SECRETS_REDIS_URL` + `WEBHOOK_SECRETS_REDIS_TOKEN` estiverem
// definidos. Em qualquer falha (rede, timeout, JSON), caímos silenciosamente
// para o cache local + DB — Redis é otimização, não fonte da verdade.
export interface RemoteSecretsCache {
  get(key: string): Promise<SecretsCacheEntry | null>;
  set(key: string, value: SecretsCacheEntry, ttlMs: number): Promise<void>;
  del(key: string): Promise<void>;
}

let remoteCacheOverride: RemoteSecretsCache | null | undefined;
let remoteCacheAutoInstance: RemoteSecretsCache | null | undefined;

/** Injeta (ou desliga com `null`) um backend remoto para o cache de segredos. */
export function setRemoteSecretsCache(cache: RemoteSecretsCache | null): void {
  remoteCacheOverride = cache;
}

function buildUpstashRestCache(baseUrl: string, token: string): RemoteSecretsCache {
  const KEY_PREFIX = "webhook_secrets:v1:";
  const TIMEOUT_MS = 400; // Redis é otimização — não travar validação por falhas de rede.
  const withTimeout = <T,>(p: Promise<T>): Promise<T> =>
    Promise.race([
      p,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error("redis_timeout")), TIMEOUT_MS)
      ),
    ]);
  const call = async (segments: string[]): Promise<unknown> => {
    const url = `${baseUrl.replace(/\/$/, "")}/${segments.map(encodeURIComponent).join("/")}`;
    const res = await withTimeout(fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    }));
    if (!res.ok) throw new Error(`redis_http_${res.status}`);
    return await res.json();
  };
  return {
    async get(key) {
      try {
        const r = await call(["get", KEY_PREFIX + key]) as { result?: string | null };
        if (!r || typeof r.result !== "string") return null;
        const parsed = JSON.parse(r.result) as SecretsCacheEntry;
        if (!parsed || !Array.isArray(parsed.secrets)) return null;
        return parsed;
      } catch (e) {
        console.warn("[webhookSecurity] redis get falhou:", (e as Error).message);
        return null;
      }
    },
    async set(key, value, ttlMs) {
      try {
        const ttl = Math.max(1, Math.floor(ttlMs / 1000));
        await call(["set", KEY_PREFIX + key, JSON.stringify(value), "EX", String(ttl)]);
      } catch (e) {
        console.warn("[webhookSecurity] redis set falhou:", (e as Error).message);
      }
    },
    async del(key) {
      try {
        await call(["del", KEY_PREFIX + key]);
      } catch (e) {
        console.warn("[webhookSecurity] redis del falhou:", (e as Error).message);
      }
    },
  };
}

function getRemoteCache(): RemoteSecretsCache | null {
  if (remoteCacheOverride !== undefined) return remoteCacheOverride;
  if (remoteCacheAutoInstance !== undefined) return remoteCacheAutoInstance;
  try {
    const url = Deno.env.get("WEBHOOK_SECRETS_REDIS_URL");
    const tok = Deno.env.get("WEBHOOK_SECRETS_REDIS_TOKEN");
    remoteCacheAutoInstance = url && tok ? buildUpstashRestCache(url, tok) : null;
  } catch {
    remoteCacheAutoInstance = null;
  }
  return remoteCacheAutoInstance;
}

/** Limpa manualmente o cache LOCAL (útil em testes e após rotação explícita). */
export function clearWebhookSecretsCache(tenantId?: string, provider?: string): void {
  if (tenantId && provider) {
    secretsCache.delete(secretsCacheKey(tenantId, provider));
    return;
  }
  secretsCache.clear();
}

/**
 * Invalida cache local E remoto (Redis, quando configurado). Use após rotação
 * de chaves para garantir que nenhum isolate — nem sequer outros nós — sirva
 * segredos obsoletos. `clearWebhookSecretsCache` (sync) continua disponível
 * para chamadas de teste que não precisam propagar ao Redis.
 */
export async function invalidateWebhookSecretsCache(
  tenantId?: string,
  provider?: string,
): Promise<void> {
  clearWebhookSecretsCache(tenantId, provider);
  const remote = getRemoteCache();
  if (!remote) return;
  if (tenantId && provider) {
    await remote.del(secretsCacheKey(tenantId, provider));
  }
  // Sem tenant/provider não fazemos flush total remoto — Redis é multi-projeto
  // por natureza; use o TTL para expirar entradas globalmente se necessário.
}


// -------- Métricas por tenant/provider (in-memory, resetáveis) --------
// Contadores agregados para observar taxa de cache hit, tempo médio de
// validação e número de chaves testadas por requisição. Ficam em memória
// do isolate — em produção, cada instância acumula seu próprio recorte
// e os valores devem ser exportados via /metrics ou reset periódico.
export interface WebhookMetricsSnapshot {
  tenantId: string;
  provider: string;
  validations_total: number;
  allowed: number;
  denied: number;
  denied_by_reason: Record<string, number>;
  cache_hits: number;
  cache_misses: number;
  cache_hit_rate: number;              // hits / (hits + misses)
  keys_loaded_total: number;           // chaves ativas retornadas pelo storage
  keys_loaded_max: number;
  keys_loaded_avg: number;
  keys_tested_total: number;           // chaves realmente submetidas ao HMAC
  keys_tested_max: number;
  keys_tested_avg: number;             // total / validations_total
  validation_ms_total: number;
  validation_ms_max: number;
  validation_ms_avg: number;           // total / validations_total
  last_updated_at: string | null;
}

interface MetricsBucket {
  validations_total: number;
  allowed: number;
  denied: number;
  denied_by_reason: Map<string, number>;
  cache_hits: number;
  cache_misses: number;
  keys_loaded_total: number;
  keys_loaded_max: number;
  keys_tested_total: number;
  keys_tested_max: number;
  validation_ms_total: number;
  validation_ms_max: number;
  last_updated_at: number | null;
}

const metricsStore = new Map<string, MetricsBucket>();

function metricsKey(tenantId: string, provider: string): string {
  return `${tenantId}::${provider}`;
}
function metricsBucket(tenantId: string, provider: string): MetricsBucket {
  const key = metricsKey(tenantId, provider);
  let b = metricsStore.get(key);
  if (!b) {
    b = {
      validations_total: 0,
      allowed: 0,
      denied: 0,
      denied_by_reason: new Map(),
      cache_hits: 0,
      cache_misses: 0,
      keys_loaded_total: 0,
      keys_loaded_max: 0,
      keys_tested_total: 0,
      keys_tested_max: 0,
      validation_ms_total: 0,
      validation_ms_max: 0,
      last_updated_at: null,
    };
    metricsStore.set(key, b);
  }
  return b;
}
function snapshotBucket(tenantId: string, provider: string, b: MetricsBucket): WebhookMetricsSnapshot {
  const totalCache = b.cache_hits + b.cache_misses;
  const n = b.validations_total || 0;
  const denied_by_reason: Record<string, number> = {};
  for (const [k, v] of b.denied_by_reason) denied_by_reason[k] = v;
  return {
    tenantId,
    provider,
    validations_total: n,
    allowed: b.allowed,
    denied: b.denied,
    denied_by_reason,
    cache_hits: b.cache_hits,
    cache_misses: b.cache_misses,
    cache_hit_rate: totalCache > 0 ? b.cache_hits / totalCache : 0,
    keys_loaded_total: b.keys_loaded_total,
    keys_loaded_max: b.keys_loaded_max,
    keys_loaded_avg: n > 0 ? b.keys_loaded_total / n : 0,
    keys_tested_total: b.keys_tested_total,
    keys_tested_max: b.keys_tested_max,
    keys_tested_avg: n > 0 ? b.keys_tested_total / n : 0,
    validation_ms_total: b.validation_ms_total,
    validation_ms_max: b.validation_ms_max,
    validation_ms_avg: n > 0 ? b.validation_ms_total / n : 0,
    last_updated_at: b.last_updated_at ? new Date(b.last_updated_at).toISOString() : null,
  };
}

/** Retorna snapshot das métricas. Sem args, retorna array de todos os buckets. */
export function getWebhookMetrics(): WebhookMetricsSnapshot[];
export function getWebhookMetrics(tenantId: string, provider: string): WebhookMetricsSnapshot;
export function getWebhookMetrics(
  tenantId?: string,
  provider?: string,
): WebhookMetricsSnapshot | WebhookMetricsSnapshot[] {
  if (tenantId && provider) {
    return snapshotBucket(tenantId, provider, metricsBucket(tenantId, provider));
  }
  const out: WebhookMetricsSnapshot[] = [];
  for (const [key, b] of metricsStore) {
    const [t, ...rest] = key.split("::");
    out.push(snapshotBucket(t, rest.join("::"), b));
  }
  return out;
}

/** Reseta métricas — útil em testes ou após flush para sistema externo. */
export function resetWebhookMetrics(tenantId?: string, provider?: string): void {
  if (tenantId && provider) {
    metricsStore.delete(metricsKey(tenantId, provider));
    return;
  }
  metricsStore.clear();
}

/**
 * Helper somente para testes: injeta valores agregados no bucket de métricas
 * sem precisar executar `verifyWebhook`. Permite testar `checkWebhookThresholds`
 * de forma determinística. NÃO use em produção.
 */
export function __seedWebhookMetricsForTest(
  tenantId: string,
  provider: string,
  patch: Partial<{
    validations_total: number;
    allowed: number;
    denied: number;
    cache_hits: number;
    cache_misses: number;
    keys_loaded_total: number;
    keys_loaded_max: number;
    keys_tested_total: number;
    keys_tested_max: number;
    validation_ms_total: number;
    validation_ms_max: number;
    last_updated_at: number | null;
  }>,
): void {
  const b = metricsBucket(tenantId, provider);
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    // deno-lint-ignore no-explicit-any
    (b as any)[k] = v as any;
  }
}

// -------- Alertas automáticos por threshold --------
// Dispara alerta quando, dentro da janela agregada em memória:
//   1) cache_hit_rate < WEBHOOK_ALERT_CACHE_HIT_MIN (default 0.7)
//   2) validation_ms_avg > WEBHOOK_ALERT_LATENCY_MAX_MS (default 500)
// Requer amostra mínima (WEBHOOK_ALERT_MIN_SAMPLES, default 50) para evitar
// falso-positivo com poucas requisições. Cooldown por (tenant, provider,
// alert_type) — controlado em memória (WEBHOOK_ALERT_COOLDOWN_MINUTES,
// default 15) para não inundar o banco/notificações. Persistência em
// `webhook_alerts` é fire-and-forget e nunca bloqueia a verificação.

export type WebhookAlertType = "cache_hit_rate_low" | "validation_latency_high";
export type WebhookAlertSeverity = "info" | "warning" | "critical";

export interface WebhookAlert {
  tenantId: string;
  provider: string;
  alertType: WebhookAlertType;
  severity: WebhookAlertSeverity;
  metricValue: number;
  threshold: number;
  sampleSize: number;
  windowSeconds: number;
  message: string;
  details: Record<string, unknown>;
}

interface AlertThresholds {
  cacheHitMin: number;         // 0..1
  latencyMaxMs: number;        // ms
  minSamples: number;          // amostra mínima
  cooldownMs: number;
  criticalCacheHitMin: number; // fração — abaixo disso vira "critical"
  criticalLatencyMaxMs: number;
}

function readAlertThresholds(): AlertThresholds {
  const getEnv = (k: string): string | undefined => {
    try { return Deno.env.get(k) ?? undefined; } catch { return undefined; }
  };
  const num = (raw: string | undefined, def: number, min: number, max: number): number => {
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) && n >= min && n <= max ? n : def;
  };
  return {
    cacheHitMin:          num(getEnv("WEBHOOK_ALERT_CACHE_HIT_MIN"),          0.7,  0,     1),
    latencyMaxMs:         num(getEnv("WEBHOOK_ALERT_LATENCY_MAX_MS"),         500,  1,     60_000),
    minSamples:           num(getEnv("WEBHOOK_ALERT_MIN_SAMPLES"),            50,   1,     100_000),
    cooldownMs:           num(getEnv("WEBHOOK_ALERT_COOLDOWN_MINUTES"),       15,   0,     24 * 60) * 60_000,
    criticalCacheHitMin:  num(getEnv("WEBHOOK_ALERT_CRITICAL_CACHE_HIT_MIN"), 0.4,  0,     1),
    criticalLatencyMaxMs: num(getEnv("WEBHOOK_ALERT_CRITICAL_LATENCY_MS"),    1500, 1,     600_000),
  };
}

const alertCooldown = new Map<string, number>(); // key -> lastFiredAt (ms)
function alertKey(tenantId: string, provider: string, type: WebhookAlertType): string {
  return `${tenantId}::${provider}::${type}`;
}
function alertsEnabled(): boolean {
  try {
    const raw = (Deno.env.get("WEBHOOK_ALERTS_ENABLED") ?? "1").toLowerCase();
    return raw !== "0" && raw !== "false" && raw !== "off";
  } catch { return true; }
}

/** Limpa cooldowns em memória — uso em testes e após incidentes. */
export function resetWebhookAlertCooldowns(tenantId?: string, provider?: string): void {
  if (!tenantId || !provider) { alertCooldown.clear(); return; }
  const prefix = `${tenantId}::${provider}::`;
  for (const k of alertCooldown.keys()) if (k.startsWith(prefix)) alertCooldown.delete(k);
}

// -------- Overrides por tenant/provider (tabela webhook_alert_thresholds) --------
// Cache in-memory best-effort: TTL curto para refletir mudanças de config sem
// martelar o banco. Se a leitura falhar, mantém defaults globais (env).
// Resolução de precedência: (tenant, provider) > (tenant, provider IS NULL) > defaults.
interface ThresholdOverrideEntry {
  overrides: Partial<AlertThresholds> | null;
  enabled: boolean;
  expiresAt: number;
  loading?: Promise<void>;
}
const thresholdOverrideCache = new Map<string, ThresholdOverrideEntry>();
const THRESHOLD_OVERRIDE_TTL_MS = 60_000;

function overrideCacheKey(tenantId: string, provider: string): string {
  return `${tenantId}::${provider}`;
}

/** Limpa cache de overrides — útil em testes e após update de config. */
export function resetWebhookThresholdOverrideCache(tenantId?: string, provider?: string): void {
  if (!tenantId) { thresholdOverrideCache.clear(); return; }
  if (!provider) {
    const prefix = `${tenantId}::`;
    for (const k of thresholdOverrideCache.keys()) if (k.startsWith(prefix)) thresholdOverrideCache.delete(k);
    return;
  }
  thresholdOverrideCache.delete(overrideCacheKey(tenantId, provider));
}

interface ThresholdRow {
  provider: string | null;
  enabled: boolean;
  cache_hit_min: number | null;
  latency_max_ms: number | null;
  min_samples: number | null;
  cooldown_minutes: number | null;
  critical_cache_hit_min: number | null;
  critical_latency_max_ms: number | null;
}

function rowToOverrides(row: ThresholdRow | null): Partial<AlertThresholds> {
  if (!row) return {};
  const out: Partial<AlertThresholds> = {};
  if (row.cache_hit_min != null)           out.cacheHitMin = Number(row.cache_hit_min);
  if (row.latency_max_ms != null)          out.latencyMaxMs = Number(row.latency_max_ms);
  if (row.min_samples != null)             out.minSamples = Number(row.min_samples);
  if (row.cooldown_minutes != null)        out.cooldownMs = Number(row.cooldown_minutes) * 60_000;
  if (row.critical_cache_hit_min != null)  out.criticalCacheHitMin = Number(row.critical_cache_hit_min);
  if (row.critical_latency_max_ms != null) out.criticalLatencyMaxMs = Number(row.critical_latency_max_ms);
  return out;
}

/**
 * Carrega (best-effort) os overrides configurados para `(tenantId, provider)`.
 * A precedência é: linha específica do provider, senão linha "coringa"
 * (provider IS NULL). Se `enabled=false` na linha resolvida, alertas são
 * suprimidos para o par. Erros nunca lançam — a validação usa defaults.
 */
export async function loadWebhookAlertOverrides(
  supabase: SupabaseClient,
  tenantId: string,
  provider: string,
): Promise<{ overrides: Partial<AlertThresholds>; enabled: boolean }> {
  const key = overrideCacheKey(tenantId, provider);
  const cached = thresholdOverrideCache.get(key);
  const now = Date.now();
  if (cached && cached.expiresAt > now && !cached.loading) {
    return { overrides: cached.overrides ?? {}, enabled: cached.enabled };
  }
  try {
    const { data } = await supabase
      .from("webhook_alert_thresholds")
      .select("provider,enabled,cache_hit_min,latency_max_ms,min_samples,cooldown_minutes,critical_cache_hit_min,critical_latency_max_ms")
      .eq("imobiliaria_id", tenantId)
      .or(`provider.eq.${provider},provider.is.null`);
    const rows = (data ?? []) as ThresholdRow[];
    // Precedência: match exato de provider ganha sobre coringa (NULL).
    const specific = rows.find((r) => r.provider === provider) ?? null;
    const wildcard = rows.find((r) => r.provider === null) ?? null;
    const picked = specific ?? wildcard;
    const entry: ThresholdOverrideEntry = {
      overrides: picked ? rowToOverrides(picked) : null,
      enabled: picked ? picked.enabled !== false : true,
      expiresAt: now + THRESHOLD_OVERRIDE_TTL_MS,
    };
    thresholdOverrideCache.set(key, entry);
    return { overrides: entry.overrides ?? {}, enabled: entry.enabled };
  } catch {
    // Falha silenciosa: usa defaults e cacheia por TTL curto para não retentar em loop.
    thresholdOverrideCache.set(key, { overrides: null, enabled: true, expiresAt: now + 5_000 });
    return { overrides: {}, enabled: true };
  }
}

/** Dispara refresh assíncrono do cache de overrides (fire-and-forget). */
function prefetchOverrides(supabase: SupabaseClient, tenantId: string, provider: string): void {
  const key = overrideCacheKey(tenantId, provider);
  const cached = thresholdOverrideCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return;
  loadWebhookAlertOverrides(supabase, tenantId, provider).catch(() => {});
}

/** Retorna overrides já em cache (sincrono). Não bate no banco. */
function getCachedOverrides(tenantId: string, provider: string): { overrides: Partial<AlertThresholds>; enabled: boolean } {
  const cached = thresholdOverrideCache.get(overrideCacheKey(tenantId, provider));
  if (cached && cached.expiresAt > Date.now()) {
    return { overrides: cached.overrides ?? {}, enabled: cached.enabled };
  }
  return { overrides: {}, enabled: true };
}

/**
 * Avalia thresholds do bucket atual e devolve os alertas disparados (respeitando
 * cooldown). Exportado para testes e para pipelines de flush externo.
 */
export function checkWebhookThresholds(
  tenantId: string,
  provider: string,
  overrides?: Partial<AlertThresholds>,
): WebhookAlert[] {
  if (!alertsEnabled()) return [];
  // Overrides por tenant/provider (fallback silencioso caso ainda não carregado).
  const tenantCfg = getCachedOverrides(tenantId, provider);
  if (tenantCfg.enabled === false) return [];
  const bucket = metricsStore.get(metricsKey(tenantId, provider));
  if (!bucket) return [];
  const snap = snapshotBucket(tenantId, provider, bucket);
  const th = { ...readAlertThresholds(), ...tenantCfg.overrides, ...(overrides ?? {}) };
  if (snap.validations_total < th.minSamples) return [];
  const now = Date.now();
  const out: WebhookAlert[] = [];

  const fireIfAllowed = (type: WebhookAlertType, build: () => WebhookAlert) => {
    const key = alertKey(tenantId, provider, type);
    const last = alertCooldown.get(key) ?? 0;
    if (now - last < th.cooldownMs) return;
    alertCooldown.set(key, now);
    out.push(build());
  };

  const totalCache = snap.cache_hits + snap.cache_misses;
  if (totalCache >= th.minSamples && snap.cache_hit_rate < th.cacheHitMin) {
    fireIfAllowed("cache_hit_rate_low", () => ({
      tenantId, provider,
      alertType: "cache_hit_rate_low",
      severity: snap.cache_hit_rate < th.criticalCacheHitMin ? "critical" : "warning",
      metricValue: Number(snap.cache_hit_rate.toFixed(4)),
      threshold: th.cacheHitMin,
      sampleSize: totalCache,
      windowSeconds: Math.round((now - (bucket.last_updated_at ?? now)) / 1000),
      message:
        `Cache hit rate de webhook em ${(snap.cache_hit_rate * 100).toFixed(1)}% ` +
        `(< ${(th.cacheHitMin * 100).toFixed(0)}%) para provider "${provider}" ` +
        `após ${totalCache} validações.`,
      details: {
        cache_hits: snap.cache_hits,
        cache_misses: snap.cache_misses,
        validations_total: snap.validations_total,
        denied: snap.denied,
      },
    }));
  }

  if (snap.validations_total >= th.minSamples && snap.validation_ms_avg > th.latencyMaxMs) {
    fireIfAllowed("validation_latency_high", () => ({
      tenantId, provider,
      alertType: "validation_latency_high",
      severity: snap.validation_ms_avg > th.criticalLatencyMaxMs ? "critical" : "warning",
      metricValue: Math.round(snap.validation_ms_avg * 1000) / 1000,
      threshold: th.latencyMaxMs,
      sampleSize: snap.validations_total,
      windowSeconds: Math.round((now - (bucket.last_updated_at ?? now)) / 1000),
      message:
        `Latência média de validação em ${snap.validation_ms_avg.toFixed(1)}ms ` +
        `(> ${th.latencyMaxMs}ms) para provider "${provider}" ` +
        `após ${snap.validations_total} validações.`,
      details: {
        validation_ms_avg: snap.validation_ms_avg,
        validation_ms_max: snap.validation_ms_max,
        keys_tested_avg: snap.keys_tested_avg,
        keys_tested_max: snap.keys_tested_max,
        cache_hit_rate: snap.cache_hit_rate,
      },
    }));
  }

  return out;
}

/**
 * Persiste alertas na tabela `webhook_alerts` e (opcionalmente) notifica o
 * master via `notifications`. Fire-and-forget — falhas são engolidas.
 */
export function persistWebhookAlerts(
  supabase: SupabaseClient,
  alerts: WebhookAlert[],
  requestId: string,
): void {
  if (!alerts.length) return;
  try {
    const rows = alerts.map((a) => ({
      imobiliaria_id: a.tenantId,
      provider: a.provider,
      alert_type: a.alertType,
      severity: a.severity,
      metric_value: a.metricValue,
      threshold: a.threshold,
      sample_size: a.sampleSize,
      window_seconds: a.windowSeconds,
      message: a.message,
      details: a.details,
      request_id: requestId,
    }));
    supabase.from("webhook_alerts").insert(rows).then(() => {}, () => {});
    // Log estruturado para observabilidade.
    for (const a of alerts) {
      const line = JSON.stringify({
        evt: "webhook_alert",
        request_id: requestId,
        tenant_id: a.tenantId,
        provider: a.provider,
        alert_type: a.alertType,
        severity: a.severity,
        metric_value: a.metricValue,
        threshold: a.threshold,
        sample_size: a.sampleSize,
      });
      (a.severity === "critical" ? console.error : console.warn)(
        `[webhookSecurity] ${line}`,
      );
    }
    // Fire-and-forget: envia para Slack via Incoming Webhook (se configurado).
    notifySlackAlerts(alerts, requestId).catch(() => {});
  } catch { /* nunca falha por alerta */ }
}

// -------- Slack Incoming Webhook (envio automático de alertas) --------
// Ativa quando SLACK_WEBHOOK_URL está configurado. Por padrão, apenas
// severidade "critical" é enviada (configurável via SLACK_ALERT_MIN_SEVERITY:
// "critical" | "warning" | "info"). Falhas nunca bloqueiam o request.

const SEVERITY_RANK: Record<WebhookAlertSeverity, number> = {
  info: 1,
  warning: 2,
  critical: 3,
};

function slackMinSeverity(): WebhookAlertSeverity {
  try {
    const raw = (Deno.env.get("SLACK_ALERT_MIN_SEVERITY") ?? "critical").toLowerCase();
    if (raw === "info" || raw === "warning" || raw === "critical") return raw;
  } catch { /* ignore */ }
  return "critical";
}

function dashboardBaseUrl(): string {
  try {
    return (
      Deno.env.get("WEBHOOK_METRICS_DASHBOARD_URL") ??
      Deno.env.get("APP_PUBLIC_URL") ??
      "https://realty-wave.lovable.app"
    ).replace(/\/+$/, "");
  } catch {
    return "https://realty-wave.lovable.app";
  }
}

function buildDashboardLink(a: WebhookAlert): string {
  const base = dashboardBaseUrl();
  const qs = new URLSearchParams({
    tenant: a.tenantId,
    provider: a.provider,
    range: "24h",
  });
  return `${base}/webhook-metrics?${qs.toString()}`;
}

function formatMetric(a: WebhookAlert): { valueLabel: string; thresholdLabel: string } {
  if (a.alertType === "cache_hit_rate_low") {
    return {
      valueLabel: `${(a.metricValue * 100).toFixed(1)}%`,
      thresholdLabel: `${(a.threshold * 100).toFixed(0)}%`,
    };
  }
  // validation_latency_high (ms)
  return {
    valueLabel: `${a.metricValue.toFixed(0)} ms`,
    thresholdLabel: `${a.threshold.toFixed(0)} ms`,
  };
}

export async function notifySlackAlerts(
  alerts: WebhookAlert[],
  requestId: string,
): Promise<void> {
  if (!alerts.length) return;
  let webhookUrl: string | undefined;
  try {
    webhookUrl = Deno.env.get("SLACK_WEBHOOK_URL") ?? undefined;
  } catch { /* ignore */ }
  if (!webhookUrl) return;

  const minRank = SEVERITY_RANK[slackMinSeverity()];
  const filtered = alerts.filter((a) => SEVERITY_RANK[a.severity] >= minRank);
  if (!filtered.length) return;

  for (const a of filtered) {
    const { valueLabel, thresholdLabel } = formatMetric(a);
    const link = buildDashboardLink(a);
    const emoji = a.severity === "critical" ? "🚨" : a.severity === "warning" ? "⚠️" : "ℹ️";
    const typeLabel =
      a.alertType === "cache_hit_rate_low" ? "Cache hit rate baixo" : "Latência de validação alta";

    const payload = {
      text: `${emoji} *Webhook Security* — ${typeLabel} (${a.severity})`,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: `${emoji} ${typeLabel} — ${a.severity.toUpperCase()}`,
          },
        },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*Tenant:*\n\`${a.tenantId}\`` },
            { type: "mrkdwn", text: `*Provider:*\n\`${a.provider}\`` },
            { type: "mrkdwn", text: `*Valor:*\n${valueLabel}` },
            { type: "mrkdwn", text: `*Threshold:*\n${thresholdLabel}` },
            { type: "mrkdwn", text: `*Amostras:*\n${a.sampleSize}` },
            { type: "mrkdwn", text: `*Janela:*\n${a.windowSeconds}s` },
          ],
        },
        {
          type: "section",
          text: { type: "mrkdwn", text: `*Detalhes:* ${a.message}` },
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "Abrir dashboard" },
              url: link,
              style: a.severity === "critical" ? "danger" : "primary",
            },
          ],
        },
        {
          type: "context",
          elements: [
            { type: "mrkdwn", text: `request_id: \`${requestId}\`` },
          ],
        },
      ],
    };

    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.warn(
          `[webhookSecurity] slack_notify_failed ${JSON.stringify({
            request_id: requestId,
            tenant_id: a.tenantId,
            provider: a.provider,
            alert_type: a.alertType,
            status: res.status,
            body: body.slice(0, 300),
          })}`,
        );
      }
    } catch (err) {
      console.warn(
        `[webhookSecurity] slack_notify_error ${JSON.stringify({
          request_id: requestId,
          tenant_id: a.tenantId,
          provider: a.provider,
          alert_type: a.alertType,
          error: err instanceof Error ? err.message : String(err),
        })}`,
      );
    }
  }
}


export type SecretsSource = "local" | "remote" | "db";

async function loadActiveSecrets(
  supabase: SupabaseClient,
  tenantId: string,
  provider: string,
): Promise<{ secrets: CachedSecret[]; error: unknown; fromCache: boolean; source: SecretsSource }> {
  const key = secretsCacheKey(tenantId, provider);
  const now = Date.now();

  // 1) Cache LOCAL (isolate atual) — mais rápido.
  const cached = secretsCache.get(key);
  if (cached && now - cached.fetchedAt < SECRETS_CACHE_TTL_MS) {
    return { secrets: cached.secrets, error: null, fromCache: true, source: "local" };
  }

  // 2) Cache REMOTO (Redis) — compartilhado entre isolates/instâncias.
  const remote = getRemoteCache();
  if (remote) {
    try {
      const remoteEntry = await remote.get(key);
      if (remoteEntry && now - remoteEntry.fetchedAt < SECRETS_CACHE_TTL_MS) {
        // Popula local para próximas requisições deste isolate.
        if (secretsCache.size >= SECRETS_CACHE_MAX_ENTRIES) {
          const oldest = secretsCache.keys().next().value;
          if (oldest) secretsCache.delete(oldest);
        }
        secretsCache.set(key, remoteEntry);
        return { secrets: remoteEntry.secrets, error: null, fromCache: true, source: "remote" };
      }
    } catch (e) {
      // Nunca deixamos falha do Redis interromper a validação.
      console.warn("[webhookSecurity] remote cache indisponível:", (e as Error).message);
    }
  }

  // 3) Fonte da verdade — DB.
  const { data, error } = await supabase
    .from("webhook_secrets")
    .select("id, secret, ativo, version, expires_at")
    .eq("imobiliaria_id", tenantId)
    .eq("provider", provider)
    .eq("ativo", true)
    .order("version", { ascending: false });

  if (error) return { secrets: [], error, fromCache: false, source: "db" };

  const secrets: CachedSecret[] = (data ?? [])
    .filter((r) => r && r.secret)
    .map((r) => ({
      id: r.id as string,
      secret: r.secret as string,
      version: (r.version as number | null) ?? null,
      expires_at: (r.expires_at as string | null) ?? null,
    }));

  // Proteção simples contra crescimento ilimitado do cache local.
  if (secretsCache.size >= SECRETS_CACHE_MAX_ENTRIES) {
    const oldest = secretsCache.keys().next().value;
    if (oldest) secretsCache.delete(oldest);
  }
  const entry: SecretsCacheEntry = { fetchedAt: now, secrets };
  secretsCache.set(key, entry);
  // Fire-and-forget: propaga para o Redis sem bloquear a resposta.
  if (remote) {
    remote.set(key, entry, SECRETS_CACHE_TTL_MS).catch(() => {});
  }
  return { secrets, error: null, fromCache: false, source: "db" };
}


export interface WebhookVerifyOptions {
  imobiliariaId: string;
  provider: string;
  /** Aceita segredo estático como fallback (ex.: DEFAULT_WEBHOOK_SECRET). */
  fallbackSecretEnv?: string;
  /** Se true, exige tenant match com header X-Tenant-Id caso presente. */
  requireTenantHeaderMatch?: boolean;
  /**
   * Cliente Supabase injetado (usado nos testes para evitar rede/DB reais).
   * Em produção, deixe indefinido para usar SERVICE_ROLE.
   */
  supabaseOverride?: SupabaseClient;
}

export interface WebhookVerifyResult {
  ok: boolean;
  response?: Response;
  supabase: SupabaseClient;
  secretRowId?: string;
  /** ID único da tentativa; propague em respostas/erros para correlação. */
  requestId: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-signature, x-timestamp, x-nonce, x-tenant-id",
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
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

function parseSignatureHeader(raw: string | null): string | null {
  if (!raw) return null;
  const clean = raw.trim();
  if (clean.startsWith("sha256=")) return clean.slice(7).trim();
  return clean;
}

export { corsHeaders };

export async function verifyWebhook(
  req: Request,
  rawBody: string,
  opts: WebhookVerifyOptions,
): Promise<WebhookVerifyResult> {
  const supabase = opts.supabaseOverride ?? createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // ---- Instrumentação da requisição ----
  // request_id correlaciona: métricas, RPC audit log, resposta HTTP (via header
  // X-Request-Id / body.request_id) e o log estruturado emitido no console.
  // Preferimos um ID vindo do cliente/proxy (X-Request-Id) para preservar a
  // cadeia de correlação end-to-end; caso ausente, geramos um UUID.
  const requestId = (req.headers.get("x-request-id") ?? "").trim() || crypto.randomUUID();
  const startedAt = performance.now();
  let cacheHit = false;
  let keysLoaded = 0;      // chaves ativas retornadas pelo storage
  let keysTested = 0;      // chaves de fato submetidas ao HMAC
  let secretsSourceObserved: SecretsSource | null = null;

  const recordMetric = (outcome: "allowed" | "denied", reason: string) => {
    if (!isValidUUID(opts.imobiliariaId) || !opts.provider) return;
    const b = metricsBucket(opts.imobiliariaId, opts.provider);
    const elapsed = performance.now() - startedAt;
    b.validations_total += 1;
    if (outcome === "allowed") b.allowed += 1;
    else {
      b.denied += 1;
      b.denied_by_reason.set(reason, (b.denied_by_reason.get(reason) ?? 0) + 1);
    }
    if (cacheHit) b.cache_hits += 1;
    else b.cache_misses += 1;
    b.keys_loaded_total += keysLoaded;
    if (keysLoaded > b.keys_loaded_max) b.keys_loaded_max = keysLoaded;
    b.keys_tested_total += keysTested;
    if (keysTested > b.keys_tested_max) b.keys_tested_max = keysTested;
    b.validation_ms_total += elapsed;
    if (elapsed > b.validation_ms_max) b.validation_ms_max = elapsed;
    b.last_updated_at = Date.now();
    // Avalia thresholds e dispara alertas (respeita cooldown por tenant/provider/tipo).
    // Warmup async do cache de overrides por tenant/provider — não bloqueia.
    try { prefetchOverrides(supabase, opts.imobiliariaId, opts.provider); } catch { /* noop */ }
    try {
      const alerts = checkWebhookThresholds(opts.imobiliariaId, opts.provider);
      if (alerts.length) persistWebhookAlerts(supabase, alerts, requestId);
    } catch { /* alertas nunca quebram validação */ }
    return elapsed;
  };

  // Log estruturado por request — 1 linha JSON por validação. Fácil de
  // ingerir em observabilidade (Logflare/Datadog) e correlacionar via request_id.
  const emitStructuredLog = (
    outcome: "allowed" | "denied",
    reason: string,
    elapsedMs: number,
    extra?: Record<string, unknown>,
  ) => {
    try {
      const line = JSON.stringify({
        evt: "webhook_verify",
        request_id: requestId,
        tenant_id: isValidUUID(opts.imobiliariaId) ? opts.imobiliariaId : null,
        provider: opts.provider ?? null,
        outcome,
        reason,
        cache_hit: cacheHit,
        secrets_source: secretsSourceObserved,
        keys_loaded: keysLoaded,
        keys_tested: keysTested,
        validation_ms: Math.round(elapsedMs * 1000) / 1000,
        ...(extra ?? {}),
      });
      (outcome === "allowed" ? console.log : console.warn)(`[webhookSecurity] ${line}`);
    } catch { /* nunca falha por log */ }
  };

  // Persistência best-effort de 1 linha por validação em `webhook_metrics`.
  // Gated por WEBHOOK_METRICS_PERSIST (default: on) para permitir desligar em
  // benchmarks/testes. Nunca bloqueia a resposta e nunca lança.
  const persistMetric = (
    outcome: "allowed" | "denied",
    reason: string,
    elapsedMs: number,
    matched?: { id?: string; version?: number } | null,
  ) => {
    const flag = (Deno.env.get("WEBHOOK_METRICS_PERSIST") ?? "1").toLowerCase();
    if (flag === "0" || flag === "false" || flag === "off") return;
    if (!opts.provider) return;
    try {
      supabase.from("webhook_metrics").insert({
        request_id: requestId,
        imobiliaria_id: isValidUUID(opts.imobiliariaId) ? opts.imobiliariaId : null,
        provider: opts.provider,
        outcome,
        reason,
        cache_hit: cacheHit,
        secrets_source: secretsSourceObserved,
        keys_loaded: keysLoaded,
        keys_tested: keysTested,
        validation_ms: Math.round(elapsedMs * 1000) / 1000,
        secret_id: matched?.id ?? null,
        secret_version: matched?.version ?? null,
      }).then(() => {}, () => {});
    } catch { /* fire-and-forget */ }
  };

  const denied = (reason: string, status = 401, extra?: Record<string, unknown>) => {
    const elapsed = recordMetric("denied", reason) ?? (performance.now() - startedAt);
    emitStructuredLog("denied", reason, elapsed, extra);
    persistMetric("denied", reason, elapsed, null);
    supabase.rpc("log_service_role_call", {
      _edge_function: opts.provider,
      _action: "webhook_verify",
      _tenant_id: isValidUUID(opts.imobiliariaId) ? opts.imobiliariaId : null,
      _outcome: "denied",
      _reason: reason,
      _request_ip: req.headers.get("x-forwarded-for"),
      _user_agent: req.headers.get("user-agent"),
      _metadata: {
        request_id: requestId,
        provider: opts.provider,
        validation_ms: Math.round(elapsed * 1000) / 1000,
        keys_loaded: keysLoaded,
        keys_tested: keysTested,
        cache_hit: cacheHit,
        secrets_source: secretsSourceObserved,
        ...(extra ?? {}),
      },
    }).then(() => {}, () => {});
    const body = JSON.stringify({ error: "webhook rejeitado", reason, request_id: requestId });
    return {
      ok: false as const,
      supabase,
      requestId,
      response: new Response(body, {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json", "X-Request-Id": requestId },
      }),
    };
  };

  if (!isValidUUID(opts.imobiliariaId)) {
    return denied("tenant_invalido", 400);
  }

  // 1) Tenant header cruzado (se enviado)
  const headerTenant = req.headers.get("x-tenant-id");
  if (headerTenant && headerTenant !== opts.imobiliariaId) {
    return denied("tenant_mismatch", 403, { headerTenant });
  }

  // 2) Timestamp / janela de replay
  const tsRaw = req.headers.get("x-timestamp");
  const ts = tsRaw ? parseInt(tsRaw, 10) : NaN;
  if (!Number.isFinite(ts)) return denied("timestamp_ausente", 400);
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - ts) > REPLAY_WINDOW_SECONDS) {
    return denied("timestamp_fora_da_janela", 401, { ts, nowSec });
  }

  // 3) Nonce obrigatório
  const nonce = req.headers.get("x-nonce");
  if (!nonce || nonce.length < 8 || nonce.length > 200) {
    return denied("nonce_invalido", 400);
  }

  // 3.1) Pré-checagem anti-replay em memória (rejeita reenvios óbvios em O(1)
  //      antes de qualquer trabalho criptográfico ou round-trip ao banco).
  //      A tabela webhook_nonces continua sendo a fonte da verdade em cluster.
  const nkey = nonceCacheKey(opts.imobiliariaId, opts.provider, nonce);
  const cachedNonce = nonceCacheGet(nkey);
  if (cachedNonce) {
    return denied("replay_detectado_cache", 409, {
      nonce_prefix: nonce.slice(0, 8),
      previous_ts: cachedNonce.timestamp,
      window_seconds: REPLAY_WINDOW_SECONDS,
    });
  }

  // 4) Assinatura
  const provided = parseSignatureHeader(req.headers.get("x-signature"));
  if (!provided || !/^[0-9a-f]{64}$/i.test(provided)) {
    return denied("assinatura_ausente_ou_malformada", 401);
  }


  // 5) Buscar TODAS as chaves ativas do tenant/provider (suporte a rotação/versionamento).
  //    Usa cache curto (30s) para reduzir consultas sob alta carga; entradas expiradas
  //    são filtradas mesmo dentro do TTL via `expires_at`.
  const { secrets: cachedSecrets, error: secretErr, fromCache, source: secretsSource } = await loadActiveSecrets(
    supabase,
    opts.imobiliariaId,
    opts.provider,
  );
  cacheHit = fromCache;
  keysLoaded = cachedSecrets.length;
  secretsSourceObserved = secretsSource;
  if (secretErr) return denied("erro_lookup_segredo", 500);

  const nowMs = Date.now();
  const candidates: Array<{ id?: string; secret: string; version?: number }> = [];
  for (const row of cachedSecrets) {
    if (row.expires_at && new Date(row.expires_at).getTime() < nowMs) continue;
    candidates.push({ id: row.id, secret: row.secret, version: row.version ?? undefined });
  }
  if (candidates.length === 0 && opts.fallbackSecretEnv) {
    const envSecret = Deno.env.get(opts.fallbackSecretEnv);
    if (envSecret) candidates.push({ secret: envSecret });
  }
  if (candidates.length === 0) return denied("segredo_nao_configurado", 401);

  // 6) Recalcular HMAC e comparar contra cada versão ativa em tempo constante.
  const base = `${ts}.${nonce}.${rawBody}`;
  const providedLower = provided.toLowerCase();
  let matched: { id?: string; version?: number } | null = null;
  for (const cand of candidates) {
    keysTested += 1;
    const expected = (await hmacSha256Hex(cand.secret, base)).toLowerCase();
    if (timingSafeEqualHex(expected, providedLower)) {
      matched = { id: cand.id, version: cand.version };
      break;
    }
  }
  if (!matched) return denied("assinatura_invalida", 401);

  // 7) Replay protection (DB é a fonte da verdade; o cache é 1ª linha de defesa)
  const { error: nonceErr } = await supabase.from("webhook_nonces").insert({
    imobiliaria_id: opts.imobiliariaId,
    provider: opts.provider,
    nonce,
  });
  if (nonceErr) {
    const code = (nonceErr as { code?: string }).code;
    if (code === "23505") {
      // Registra também no cache in-memory para acelerar futuras tentativas.
      nonceCacheSet(nkey, ts);
      return denied("replay_detectado", 409, { nonce_prefix: nonce.slice(0, 8) });
    }
    return denied("erro_registro_nonce", 500);
  }
  // Sucesso no DB → memoriza no cache dentro da janela de replay.
  nonceCacheSet(nkey, ts);


  // 8) last_used_at (best-effort)
  const usedAt = new Date().toISOString();
  if (matched.id) {
    supabase
      .from("webhook_secrets")
      .update({ last_used_at: usedAt })
      .eq("id", matched.id)
      .then(() => {}, () => {});
  }

  const elapsedMs = recordMetric("allowed", "assinatura_valida") ?? (performance.now() - startedAt);
  emitStructuredLog("allowed", "assinatura_valida", elapsedMs, {
    secret_id: matched.id ?? null,
    secret_version: matched.version ?? null,
    nonce_prefix: nonce.slice(0, 8),
  });
  persistMetric("allowed", "assinatura_valida", elapsedMs, matched);

  // 9) Trilha de auditoria detalhada (com métricas por requisição)
  supabase.rpc("log_service_role_call", {
    _edge_function: opts.provider,
    _action: "webhook_verify",
    _tenant_id: opts.imobiliariaId,
    _table_name: "webhook_secrets",
    _record_id: matched.id ?? null,
    _outcome: "allowed",
    _reason: "assinatura_valida",
    _request_ip: req.headers.get("x-forwarded-for"),
    _user_agent: req.headers.get("user-agent"),
    _metadata: {
      request_id: requestId,
      provider: opts.provider,
      tenant_id: opts.imobiliariaId,
      secret_id: matched.id ?? null,
      secret_version: matched.version ?? null,
      secret_source: matched.id ? "db" : "env_fallback",
      nonce_prefix: nonce.slice(0, 8),
      timestamp: ts,
      used_at: usedAt,
      secrets_from_cache: fromCache,
      secrets_source: secretsSource,
      validation_ms: Math.round(elapsedMs * 1000) / 1000,
      keys_loaded: keysLoaded,
      keys_tested: keysTested,
      cache_hit: cacheHit,
      replay_window_seconds: REPLAY_WINDOW_SECONDS,
    },
  }).then(() => {}, () => {});

  return { ok: true, supabase, secretRowId: matched.id, requestId };
}
