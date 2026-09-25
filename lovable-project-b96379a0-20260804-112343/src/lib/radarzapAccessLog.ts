import { supabase } from "@/integrations/supabase/client";

const RADARZAP_PREFIX = "/radarzap";

export function isRadarZapRoute(path: string): boolean {
  return path === RADARZAP_PREFIX || path.startsWith(`${RADARZAP_PREFIX}/`) || path.startsWith(`${RADARZAP_PREFIX}?`);
}

export type RadarZapAccessStatus = "allowed" | "blocked";

interface LogParams {
  route: string;
  status: RadarZapAccessStatus;
  motivo?: string | null;
}

export async function logRadarZapAccess({ route, status, motivo }: LogParams) {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) return;

    // Dedup: avoid spamming the same (route,status,motivo) within 60s per tab.
    const key = `rz_access_log:${user.id}:${route}:${status}:${motivo ?? ""}`;
    try {
      const last = Number(sessionStorage.getItem(key) || "0");
      if (Date.now() - last < 60_000) return;
      sessionStorage.setItem(key, String(Date.now()));
    } catch {
      // ignore storage errors (private mode etc.)
    }

    await supabase.from("radarzap_access_log" as any).insert({
      user_id: user.id,
      user_email: user.email ?? null,
      route,
      status,
      motivo: motivo ?? null,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    } as any);
  } catch (err) {
    console.warn("radarzap access log failed", err);
  }
}
