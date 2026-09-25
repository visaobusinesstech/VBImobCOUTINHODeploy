// Confirma double opt-in via token público
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const { token } = await req.json();
    if (!token || typeof token !== "string" || token.length < 16) {
      return new Response(JSON.stringify({ error: "token_invalido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || null;
    const ua = req.headers.get("user-agent") || null;

    const { data: cons, error } = await admin
      .from("whatsapp_consentimentos")
      .select("id, imobiliaria_id, status, telefone_norm, nome_contato, double_optin_enviado_em")
      .eq("double_optin_token", token)
      .maybeSingle();

    if (error || !cons) {
      return new Response(JSON.stringify({ error: "token_nao_encontrado" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (cons.status === "ativo") {
      return new Response(JSON.stringify({ ok: true, ja_ativo: true, mensagem: "Opt-in já confirmado" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (cons.status === "revogado" || cons.status === "bloqueado") {
      return new Response(JSON.stringify({ error: "consentimento_revogado", status: cons.status }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Ativa
    const { error: updErr } = await admin
      .from("whatsapp_consentimentos")
      .update({
        status: "ativo",
        aceito_em: new Date().toISOString(),
        double_optin_confirmado_em: new Date().toISOString(),
      })
      .eq("id", cons.id);

    if (updErr) throw updErr;

    await admin.from("whatsapp_consentimento_eventos").insert({
      consentimento_id: cons.id,
      imobiliaria_id: cons.imobiliaria_id,
      tipo_evento: "optin_confirmado",
      descricao: "Confirmação via link público",
      ip_origem: ip,
      user_agent: ua,
      ator_tipo: "titular",
    });

    return new Response(JSON.stringify({
      ok: true,
      status: "ativo",
      mensagem: "Consentimento confirmado com sucesso",
      nome_contato: cons.nome_contato,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("whatsapp-optin-confirm erro:", err);
    return new Response(JSON.stringify({ error: "erro_interno", detalhe: String(err?.message || err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
