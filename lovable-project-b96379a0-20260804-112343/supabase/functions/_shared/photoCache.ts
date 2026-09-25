// Shared photo-extraction cache (per-URL, 7-day TTL).
// Backed by public.photo_extraction_cache. Service-role access only.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface CachedPhotoRecord {
  url: string;
  fotos: string[];
  strategy_stats: Record<string, number> | null;
  blocked: boolean;
  block_reason: string | null;
  total_candidates: number;
  hits: number;
  created_at: string;
  updated_at: string;
  expires_at: string;
}

/** Normalizes URL for stable cache key (strip trackers, hash-encode). */
export async function hashPhotoCacheKey(rawUrl: string): Promise<{ key: string; normalized: string } | null> {
  try {
    const u = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`);
    if (!["http:", "https:"].includes(u.protocol)) return null;
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid", "ref", "referrer"].forEach((p) => u.searchParams.delete(p));
    u.hash = "";
    // Lowercase host, keep pathname/search as-is (portals are path-sensitive)
    const normalized = `${u.protocol}//${u.host.toLowerCase()}${u.pathname}${u.search}`;
    const buf = new TextEncoder().encode(normalized);
    const digest = await crypto.subtle.digest("SHA-256", buf);
    const key = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
    return { key, normalized };
  } catch {
    return null;
  }
}

/** Returns cached photos for a URL if fresh; also bumps hit counter. */
export async function readPhotoCache(
  sb: SupabaseClient,
  urlHash: string,
): Promise<CachedPhotoRecord | null> {
  try {
    const { data, error } = await sb
      .from("photo_extraction_cache")
      .select("*")
      .eq("url_hash", urlHash)
      .maybeSingle();
    if (error || !data) return null;
    if (new Date(data.expires_at).getTime() < Date.now()) return null;
    // Fire-and-forget hit increment
    sb.from("photo_extraction_cache")
      .update({ hits: (data.hits ?? 0) + 1 })
      .eq("url_hash", urlHash)
      .then(() => {}, () => {});
    return data as CachedPhotoRecord;
  } catch (e) {
    console.warn("[photoCache] read failed", e);
    return null;
  }
}

/** Upserts extraction result. Only writes when photos>0 OR block=true (to avoid caching transient empties). */
export async function writePhotoCache(
  sb: SupabaseClient,
  urlHash: string,
  url: string,
  payload: {
    fotos: string[];
    strategy_stats?: Record<string, number> | null;
    blocked?: boolean;
    block_reason?: string | null;
    total_candidates?: number;
    /** Override TTL in days (default 7 for hits, 1 for blocked results). */
    ttlDays?: number;
  },
): Promise<void> {
  const hasPhotos = Array.isArray(payload.fotos) && payload.fotos.length > 0;
  if (!hasPhotos && !payload.blocked) return; // skip transient empties
  const ttl = payload.ttlDays ?? (payload.blocked && !hasPhotos ? 1 : 7);
  const expires = new Date(Date.now() + ttl * 24 * 60 * 60 * 1000).toISOString();
  try {
    await sb.from("photo_extraction_cache").upsert(
      {
        url_hash: urlHash,
        url,
        fotos: payload.fotos ?? [],
        strategy_stats: payload.strategy_stats ?? null,
        blocked: !!payload.blocked,
        block_reason: payload.block_reason ?? null,
        total_candidates: payload.total_candidates ?? 0,
        updated_at: new Date().toISOString(),
        expires_at: expires,
      },
      { onConflict: "url_hash" },
    );
  } catch (e) {
    console.warn("[photoCache] write failed", e);
  }
}
