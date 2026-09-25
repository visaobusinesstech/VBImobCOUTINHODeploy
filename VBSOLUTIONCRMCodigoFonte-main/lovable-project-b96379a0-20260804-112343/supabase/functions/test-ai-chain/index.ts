import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { requireUserAi, callUserAi } from "../_shared/ai-config.ts";
import { fallbackChain } from "../_shared/ai-models.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autorizado");

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: { user } } = await sb.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) throw new Error("Sessão expirada");

    const gate = await requireUserAi(sb, user.id, corsHeaders);
    if (gate.response) return gate.response;

    const cfg = gate.config!;
    const chain = fallbackChain(cfg.provider, cfg.model);
    const started = Date.now();
    const result = await callUserAi(cfg, {
      userPrompt: "ping",
      maxTokens: 8,
      timeoutMs: 20000,
    });
    const durationMs = Date.now() - started;

    if (result.ok) {
      return new Response(JSON.stringify({
        success: true,
        provider: cfg.provider,
        preferred_model: cfg.model,
        active_model: result.model,
        chain,
        fallback_used: result.model !== cfg.model,
        duration_ms: durationMs,
        checked_at: new Date().toISOString(),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({
      success: false,
      provider: cfg.provider,
      preferred_model: cfg.model,
      chain,
      error_code: result.code,
      http_status: result.status,
      message: result.error,
      checked_at: new Date().toISOString(),
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, message: e.message || String(e) }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
