// Webhook público para mensagens recebidas (Evolution/Z-API)
// Detecta palavras-chave de opt-out e registra revogação automática.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function pickText(payload: any): string {
  return (
    payload?.data?.message?.conversation ||
    payload?.data?.message?.extendedTextMessage?.text ||
    payload?.message?.text ||
    payload?.text ||
    payload?.body ||
    ""
  );
}

function pickPhone(payload: any): string {
  const raw =
    payload?.data?.key?.remoteJid ||
    payload?.data?.from ||
    payload?.phone ||
    payload?.from ||
    "";
  return String(raw).split("@")[0].replace(/\D/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const payload = await req.json().catch(() => ({}));
    const url = new URL(req.url);
    const imobiliaria_id = url.searchParams.get("imobiliaria_id") || payload?.imobiliaria_id;

    if (!imobiliaria_id) {
      return new Response(JSON.stringify({ ok: false, motivo: "imobiliaria_id ausente" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const telefone = pickPhone(payload);
    const texto = pickText(payload);

    if (!telefone || !texto) {
      return new Response(JSON.stringify({ ok: true, ignorado: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Log da mensagem recebida (não passa pelo trigger de bloqueio pois direcao=entrada)
    await admin.from("mensagens_whatsapp").insert({
      imobiliaria_id,
      telefone_destino: telefone,
      nome_contato: "Entrada",
      mensagem: texto.slice(0, 4000),
      direcao: "entrada",
      contexto: "webhook_inbound",
      metadata: { raw_source: "webhook" },
    }).catch(() => {});

    // Processa opt-out por palavra-chave (função SECURITY DEFINER no BD)
    const { data: optoutResult } = await admin.rpc("wa_processar_optout_keyword", {
      p_imobiliaria_id: imobiliaria_id,
      p_telefone: telefone,
      p_mensagem: texto,
    });

    return new Response(JSON.stringify({
      ok: true,
      telefone,
      optout_processado: optoutResult === true,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("whatsapp-inbound-webhook erro:", err);
    return new Response(JSON.stringify({ ok: false, erro: String(err?.message || err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
