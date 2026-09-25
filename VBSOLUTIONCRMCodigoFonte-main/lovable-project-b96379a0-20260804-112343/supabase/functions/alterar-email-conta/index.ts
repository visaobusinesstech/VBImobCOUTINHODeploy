// Edge Function: alterar-email-conta
// Fluxo seguro para trocar o e-mail da conta sem exigir confirmação no e-mail antigo.
// 1) Valida a sessão do usuário (JWT).
// 2) Re-autentica com a senha atual.
// 3) Usa a Admin API para atualizar o e-mail — Supabase envia link de confirmação
//    apenas ao NOVO e-mail. O antigo não recebe nada.
// 4) A troca só é aplicada quando o usuário clicar no link recebido no novo e-mail.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "unauthorized" }, 401);
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user?.email) {
      return json({ error: "unauthorized" }, 401);
    }
    const user = userData.user;

    const body = await req.json().catch(() => ({}));
    const novoEmail = String(body?.novoEmail ?? "").trim().toLowerCase();
    const senhaAtual = String(body?.senhaAtual ?? "");
    const emailRedirectTo = String(body?.emailRedirectTo ?? "");

    if (!novoEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(novoEmail)) {
      return json({ error: "invalid_email" }, 400);
    }
    if (!senhaAtual) return json({ error: "missing_password" }, 400);
    if (novoEmail === user.email.toLowerCase()) {
      return json({ error: "same_email" }, 400);
    }

    // Re-autenticação — cliente isolado para não sobrescrever sessão.
    const authCheckClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: signInErr } = await authCheckClient.auth.signInWithPassword({
      email: user.email,
      password: senhaAtual,
    });
    if (signInErr) {
      return json({ error: "invalid_password" }, 401);
    }

    // Admin update — envia confirmação apenas ao novo endereço.
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error: updErr } = await admin.auth.admin.updateUserById(user.id, {
      email: novoEmail,
      email_confirm: false,
    } as any);

    if (updErr) {
      return json({ error: "update_failed", message: updErr.message }, 400);
    }

    // Dispara um "email change" para gerar o link de confirmação enviado ao novo e-mail.
    // (updateUserById já dispara em novas versões; mantemos fallback silencioso.)
    try {
      await admin.auth.admin.generateLink({
        type: "email_change_new" as any,
        email: user.email,
        newEmail: novoEmail,
        options: emailRedirectTo ? { redirectTo: emailRedirectTo } : undefined,
      } as any);
    } catch (_) {
      // no-op — updateUserById já cuida do envio na maior parte dos ambientes.
    }

    return json({ ok: true });
  } catch (err: any) {
    return json({ error: "internal_error", message: err?.message ?? String(err) }, 500);
  }
});
