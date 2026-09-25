// Enfileira um item para reprocessamento de fotos (chamado da UI).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

function isUrl(s: unknown): s is string {
  if (typeof s !== "string") return false;
  try { new URL(s); return true; } catch { return false; }
}
function portalFromUrl(u: string): string | null {
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: userRes } = await userClient.auth.getUser();
  const user = userRes?.user;
  if (!user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: any = {};
  try { body = await req.json(); } catch {}
  const { source_url, imovel_id = null, priority = 5, max_attempts = 5, origin = "manual" } = body || {};

  if (!isUrl(source_url)) {
    return new Response(JSON.stringify({ error: "invalid_url" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (imovel_id !== null && typeof imovel_id !== "string") {
    return new Response(JSON.stringify({ error: "invalid_imovel_id" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  // Dedup: don't re-enqueue if a pending/processing item exists for the same user+url
  const { data: existing } = await admin
    .from("photo_extraction_queue")
    .select("id,status,next_run_at")
    .eq("user_id", user.id)
    .eq("source_url", source_url)
    .in("status", ["pending", "processing"])
    .maybeSingle();

  if (existing) {
    return new Response(JSON.stringify({ ok: true, id: existing.id, deduped: true, status: existing.status }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data, error } = await admin.from("photo_extraction_queue").insert({
    user_id: user.id,
    imovel_id,
    source_url,
    portal: portalFromUrl(source_url),
    priority: Math.min(Math.max(Number(priority) || 5, 1), 9),
    max_attempts: Math.min(Math.max(Number(max_attempts) || 5, 1), 10),
    origin,
  }).select("id").single();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, id: data!.id, deduped: false }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
