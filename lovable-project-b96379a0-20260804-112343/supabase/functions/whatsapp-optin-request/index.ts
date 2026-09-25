// Cria consentimento pendente + envia mensagem de confirmação (double opt-in)
// Público (sem JWT) — chamado pela landing/formulários
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function normalizePhone(p: string): string {
  return (p || "").replace(/\D/g, "").slice(-13);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const body = await req.json();
    const {
      imobiliaria_id,
      telefone,
      nome_contato,
      email,
      canal_origem = "landing_page",
      origem_referencia,
      finalidades = ["comunicacao_transacional", "marketing_imobiliario"],
      termo_versao,
      termo_texto,
    } = body || {};

    if (!imobiliaria_id || !telefone) {
      return new Response(JSON.stringify({ error: "campos_obrigatorios", detalhe: "imobiliaria_id e telefone são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const tel = normalizePhone(telefone);
    if (tel.length < 10) {
      return new Response(JSON.stringify({ error: "telefone_invalido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || null;
    const ua = req.headers.get("user-agent") || null;

    // Termo ativo (opcional — usa fornecido ou busca padrão)
    let termoId: string | null = null;
    let termoVersaoFinal = termo_versao || "1.0";
    if (!termo_versao) {
      const { data: termo } = await admin
        .from("whatsapp_termos_consentimento")
        .select("id, versao")
        .eq("imobiliaria_id", imobiliaria_id)
        .eq("ativo", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (termo) {
        termoId = termo.id;
        termoVersaoFinal = termo.versao;
      }
    }

    // Upsert do consentimento
    const { data: existing } = await admin
      .from("whatsapp_consentimentos")
      .select("id, status, double_optin_token")
      .eq("imobiliaria_id", imobiliaria_id)
      .eq("telefone_norm", tel)
      .maybeSingle();

    let consentId: string;
    let optinToken: string;

    if (existing) {
      if (existing.status === "ativo") {
        return new Response(JSON.stringify({
          ok: true,
          status: "ativo",
          mensagem: "Consentimento já ativo",
          consentimento_id: existing.id,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: upd, error: updErr } = await admin
        .from("whatsapp_consentimentos")
        .update({
          status: "pendente",
          nome_contato: nome_contato || null,
          email: email || null,
          canal_origem: "double_optin",
          origem_referencia: origem_referencia || canal_origem,
          termo_id: termoId,
          termo_versao: termoVersaoFinal,
          finalidades,
          ip_origem: ip,
          user_agent: ua,
          double_optin_enviado_em: new Date().toISOString(),
          revogado_em: null,
          revogado_por: null,
          motivo_revogacao: null,
        })
        .eq("id", existing.id)
        .select("id, double_optin_token")
        .single();
      if (updErr) throw updErr;
      consentId = upd!.id;
      optinToken = upd!.double_optin_token!;
    } else {
      const { data: ins, error: insErr } = await admin
        .from("whatsapp_consentimentos")
        .insert({
          imobiliaria_id,
          telefone,
          nome_contato: nome_contato || null,
          email: email || null,
          status: "pendente",
          canal_origem: "double_optin",
          origem_referencia: origem_referencia || canal_origem,
          termo_id: termoId,
          termo_versao: termoVersaoFinal,
          finalidades,
          ip_origem: ip,
          user_agent: ua,
          double_optin_enviado_em: new Date().toISOString(),
          observacoes: termo_texto ? `Termo aceito: ${termo_texto.slice(0, 500)}` : null,
        })
        .select("id, double_optin_token")
        .single();
      if (insErr) throw insErr;
      consentId = ins!.id;
      optinToken = ins!.double_optin_token!;
    }

    // Envia mensagem de confirmação usando SDK (marca is_double_optin=true no metadata para bypassar o trigger)
    const origin = req.headers.get("origin") || `https://${req.headers.get("host")}`;
    const confirmUrl = `${origin.replace(/\/$/, "")}/consentimento/confirmar/${optinToken}`;

    const msgTexto = `Olá${nome_contato ? " " + nome_contato : ""}! 👋\n\nRecebemos sua solicitação para receber comunicações via WhatsApp.\n\nPara confirmar seu opt-in, acesse:\n${confirmUrl}\n\nSe você não solicitou isso, ignore esta mensagem. Você poderá cancelar a qualquer momento respondendo *SAIR*.`;

    let envioResultado: any = { enviado: false };
    try {
      const { data: cfg } = await admin
        .from("whatsapp_config")
        .select("provider, api_url, api_key, instance_name, token_zapi, instance_id_zapi, ativo")
        .eq("imobiliaria_id", imobiliaria_id)
        .maybeSingle();

      if (cfg?.ativo) {
        // Inserir com metadata para bypassar trigger
        await admin.from("mensagens_whatsapp").insert({
          imobiliaria_id,
          telefone_destino: tel,
          nome_contato: nome_contato || "Novo contato",
          mensagem: msgTexto,
          direcao: "saida",
          contexto: "double_optin",
          metadata: { is_double_optin: true, consentimento_id: consentId },
        });

        // Envia efetivamente
        const numero = tel.startsWith("55") ? tel : `55${tel}`;
        if (cfg.provider === "evolution" && cfg.api_url && cfg.api_key && cfg.instance_name) {
          const r = await fetch(`${cfg.api_url.replace(/\/$/, "")}/message/sendText/${cfg.instance_name}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: cfg.api_key },
            body: JSON.stringify({ number: numero, text: msgTexto }),
          });
          envioResultado = { enviado: r.ok, status: r.status };
        } else if (cfg.provider === "zapi" && cfg.instance_id_zapi && cfg.token_zapi) {
          const r = await fetch(`https://api.z-api.io/instances/${cfg.instance_id_zapi}/token/${cfg.token_zapi}/send-text`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone: numero, message: msgTexto }),
          });
          envioResultado = { enviado: r.ok, status: r.status };
        } else {
          envioResultado = { enviado: false, motivo: "provider_nao_configurado" };
        }
      } else {
        envioResultado = { enviado: false, motivo: "whatsapp_config_inativa" };
      }
    } catch (err) {
      console.error("Falha ao enviar double opt-in:", err);
      envioResultado = { enviado: false, erro: String(err) };
    }

    // Log evento
    await admin.from("whatsapp_consentimento_eventos").insert({
      consentimento_id: consentId,
      imobiliaria_id,
      tipo_evento: "optin_solicitado",
      descricao: `Solicitação double opt-in via ${canal_origem}`,
      metadata: { envio: envioResultado, confirm_url: confirmUrl },
      ip_origem: ip,
      user_agent: ua,
      ator_tipo: "titular",
    });

    return new Response(JSON.stringify({
      ok: true,
      status: "pendente",
      consentimento_id: consentId,
      confirm_url: confirmUrl,
      envio: envioResultado,
      mensagem: "Enviamos uma mensagem no seu WhatsApp para confirmar. Verifique também o link enviado.",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("whatsapp-optin-request erro:", err);
    return new Response(JSON.stringify({ error: "erro_interno", detalhe: String(err?.message || err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
