import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Dev-only: mints a valid Supabase session for a pre-approved email.
// Protected by DEV_PREVIEW_SECRET (shared secret set via add_secret).
// If the secret is not configured, the endpoint refuses to run.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const previewSecret = Deno.env.get("DEV_PREVIEW_SECRET");
  if (!previewSecret) {
    return json({ error: "preview_disabled", hint: "DEV_PREVIEW_SECRET não configurado" }, 403);
  }

  const provided = req.headers.get("x-preview-secret");
  if (!provided || provided !== previewSecret) {
    return json({ error: "invalid_preview_secret" }, 401);
  }

  let body: { email?: string } = {};
  try { body = await req.json(); } catch { /* optional */ }

  const email = (body.email || Deno.env.get("DEV_PREVIEW_EMAIL") || "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "invalid_email", hint: "informe { email } no body ou defina DEV_PREVIEW_EMAIL" }, 400);
  }

  // Optional allow-list. If DEV_PREVIEW_ALLOWED_EMAILS is set (comma-separated),
  // only those emails may be minted a session — defense-in-depth on top of the secret.
  const allow = (Deno.env.get("DEV_PREVIEW_ALLOWED_EMAILS") || "")
    .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (allow.length > 0 && !allow.includes(email)) {
    return json({ error: "email_not_allowed" }, 403);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // Ensure the user exists (no-op if already present).
  try {
    await admin.auth.admin.createUser({ email, email_confirm: true });
  } catch { /* ignore duplicate */ }

  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data?.properties?.hashed_token) {
    return json({ error: "generate_link_failed", detail: error?.message ?? null }, 500);
  }

  return json({
    email,
    token_hash: data.properties.hashed_token,
    verification_type: "magiclink",
    expires_in_seconds: 3600,
  });
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
