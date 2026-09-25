import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WhatsappConfig {
  provider: string;
  api_url: string | null;
  api_key: string | null;
  instance_name: string | null;
  token_zapi: string | null;
  instance_id_zapi: string | null;
  ativo: boolean;
}

async function sendViaEvolution(config: WhatsappConfig, telefone: string, mensagem: string) {
  const baseUrl = config.api_url?.replace(/\/$/, "");
  if (!baseUrl || !config.api_key || !config.instance_name) {
    throw new Error("Configuração incompleta da Evolution API");
  }

  const numero = telefone.replace(/\D/g, "");
  const formattedNumber = numero.startsWith("55") ? numero : `55${numero}`;

  const response = await fetch(`${baseUrl}/message/sendText/${config.instance_name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: config.api_key,
    },
    body: JSON.stringify({
      number: formattedNumber,
      text: mensagem,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Evolution API error [${response.status}]: ${body}`);
  }

  return await response.json();
}

async function sendViaZAPI(config: WhatsappConfig, telefone: string, mensagem: string) {
  if (!config.instance_id_zapi || !config.token_zapi) {
    throw new Error("Configuração incompleta da Z-API");
  }

  const numero = telefone.replace(/\D/g, "");
  const formattedNumber = numero.startsWith("55") ? numero : `55${numero}`;

  const response = await fetch(
    `https://api.z-api.io/instances/${config.instance_id_zapi}/token/${config.token_zapi}/send-text`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: formattedNumber,
        message: mensagem,
      }),
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Z-API error [${response.status}]: ${body}`);
  }

  return await response.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { telefone, mensagem, imobiliaria_id } = await req.json();

    if (!telefone || !mensagem || !imobiliaria_id) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch WhatsApp config
    const { data: config, error: configError } = await supabase
      .from("whatsapp_config")
      .select("*")
      .eq("imobiliaria_id", imobiliaria_id)
      .maybeSingle();

    if (configError || !config) {
      return new Response(JSON.stringify({ error: "WhatsApp não configurado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!config.ativo) {
      return new Response(JSON.stringify({ error: "WhatsApp API desativada" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let result;
    switch (config.provider) {
      case "evolution":
        result = await sendViaEvolution(config as WhatsappConfig, telefone, mensagem);
        break;
      case "zapi":
        result = await sendViaZAPI(config as WhatsappConfig, telefone, mensagem);
        break;
      default:
        return new Response(JSON.stringify({ error: "Provider não suportado para envio via API" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify({ success: true, provider: config.provider, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("WhatsApp send error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
