// Edge function: monitora idade das chaves BYOK e emite alertas / notificações.
// Modo de operação:
//  - Sem body: cron diário. Percorre todos os user_ai_config e gera alertas.
//  - body { user_id }: checa apenas um usuário (chamado do painel).
//
// Alertas emitidos (severity):
//  - warning : dentro do limiar (interval - alert_days) até interval-1
//  - expired : dias >= interval
//  - invalid : last_health_check_status = 'invalid'
//
// Dedup: UNIQUE(user_id, key_kind, severity, provider, alert_day) na tabela.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface Cfg {
  user_id: string;
  provider: string | null;
  byok_active: boolean | null;
  api_key_encrypted: string | null;
  serper_key_encrypted: string | null;
  api_key_rotated_at: string | null;
  serper_key_rotated_at: string | null;
  rotation_interval_days: number;
  rotation_alert_days: number;
  rotation_notifications_enabled: boolean;
  last_health_check_status: string | null;
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.floor(ms / 86400000);
}

async function evaluateUser(admin: ReturnType<typeof createClient>, cfg: Cfg) {
  if (!cfg.rotation_notifications_enabled) return { skipped: true };
  const interval = cfg.rotation_interval_days || 90;
  const threshold = cfg.rotation_alert_days ?? 15;
  const alertsCreated: any[] = [];

  const push = async (
    key_kind: "ai" | "serper",
    severity: "warning" | "expired" | "invalid",
    days: number | null,
    provider: string | null,
    message: string,
  ) => {
    const { error } = await admin.from("ai_key_rotation_alerts").insert({
      user_id: cfg.user_id,
      key_kind,
      severity,
      provider,
      days_since_rotation: days,
      interval_days: interval,
      message,
    });
    // 23505 = unique violation (já alertado hoje). Ignorar.
    if (error && !String(error.message || "").includes("duplicate")) throw error;
    if (!error) alertsCreated.push({ key_kind, severity, message });

    // Cria notificação in-app somente se o registro foi novo (não duplicado)
    if (!error) {
      await admin.from("notifications").insert({
        user_id: cfg.user_id,
        titulo: severity === "expired"
          ? "🔴 Chave de IA vencida"
          : severity === "invalid"
          ? "❌ Chave de IA inválida"
          : "⚠️ Chave de IA prestes a vencer",
        mensagem: message,
        tipo: severity === "warning" ? "warning" : "error",
        lida: false,
      }).then(() => {}, () => {}); // ignora falha silenciosa
    }
  };

  // Chave de IA
  if (cfg.byok_active && cfg.api_key_encrypted) {
    const d = daysSince(cfg.api_key_rotated_at);
    if (cfg.last_health_check_status === "invalid") {
      await push("ai", "invalid", d, cfg.provider,
        `Sua chave ${cfg.provider ?? "IA"} falhou na última verificação de saúde. Refaça o teste em /configurar-ia.`);
    } else if (d !== null && d >= interval) {
      await push("ai", "expired", d, cfg.provider,
        `Sua chave ${cfg.provider ?? "IA"} não é rotacionada há ${d} dias (limite: ${interval}). Gere uma nova no provedor e atualize em /configurar-ia.`);
    } else if (d !== null && d >= interval - threshold) {
      await push("ai", "warning", d, cfg.provider,
        `Sua chave ${cfg.provider ?? "IA"} completa ${interval} dias em ${interval - d} dia(s). Planeje a rotação em /configurar-ia.`);
    }
  }

  // Chave Serper
  if (cfg.serper_key_encrypted) {
    const d = daysSince(cfg.serper_key_rotated_at);
    if (d !== null && d >= interval) {
      await push("serper", "expired", d, "serper",
        `Sua chave Serper não é rotacionada há ${d} dias. Gere uma nova em serper.dev.`);
    } else if (d !== null && d >= interval - threshold) {
      await push("serper", "warning", d, "serper",
        `Sua chave Serper completa ${interval} dias em ${interval - d} dia(s).`);
    }
  }

  return { alertsCreated };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    let targetUserId: string | null = null;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (body?.user_id && typeof body.user_id === "string") targetUserId = body.user_id;
      } catch { /* body opcional */ }
    }

    const query = admin.from("user_ai_config").select(
      "user_id, provider, byok_active, api_key_encrypted, serper_key_encrypted, api_key_rotated_at, serper_key_rotated_at, rotation_interval_days, rotation_alert_days, rotation_notifications_enabled, last_health_check_status"
    );
    if (targetUserId) query.eq("user_id", targetUserId);

    const { data: configs, error } = await query;
    if (error) throw error;

    const results: any[] = [];
    for (const cfg of (configs ?? []) as unknown as Cfg[]) {
      try {
        const r = await evaluateUser(admin, cfg);
        results.push({ user_id: cfg.user_id, ...r });
      } catch (e: any) {
        results.push({ user_id: cfg.user_id, error: e.message });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      checked: results.length,
      results,
      checked_at: new Date().toISOString(),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("check-ai-keys-rotation error:", e);
    return new Response(JSON.stringify({ success: false, error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
