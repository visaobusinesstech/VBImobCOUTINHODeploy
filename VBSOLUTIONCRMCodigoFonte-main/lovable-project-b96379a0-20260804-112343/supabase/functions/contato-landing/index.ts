import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function sanitize(str: string): string {
  return str.replace(/[<>]/g, "").trim();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { nome, email, telefone, mensagem } = await req.json();

    if (!nome || !email || !mensagem) {
      return new Response(
        JSON.stringify({ error: "Nome, email e mensagem são obrigatórios." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate and sanitize inputs
    const cleanNome = sanitize(String(nome)).substring(0, 200);
    const cleanEmail = sanitize(String(email)).substring(0, 254);
    const cleanTelefone = telefone ? sanitize(String(telefone)).substring(0, 30) : null;
    const cleanMensagem = sanitize(String(mensagem)).substring(0, 5000);

    if (!cleanNome || !cleanMensagem) {
      return new Response(
        JSON.stringify({ error: "Nome e mensagem não podem estar vazios." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!isValidEmail(cleanEmail)) {
      return new Response(
        JSON.stringify({ error: "E-mail inválido." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error } = await supabase.from("contatos_landing").insert({
      nome: cleanNome,
      email: cleanEmail,
      telefone: cleanTelefone,
      mensagem: cleanMensagem,
    });

    if (error) {
      console.error("Error inserting contact:", error);
      return new Response(
        JSON.stringify({ error: "Erro ao salvar mensagem." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const [{ data: masterProfile, error: masterProfileError }, { data: imobiliariaConfig, error: imobiliariaConfigError }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id")
        .eq("is_master", true)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("imobiliaria_config")
        .select("user_id")
        .limit(1)
        .maybeSingle(),
    ]);

    if (masterProfileError) {
      console.error("Error fetching master profile:", masterProfileError);
    }

    if (imobiliariaConfigError) {
      console.error("Error fetching imobiliaria config:", imobiliariaConfigError);
    }

    const targetUserId = masterProfile?.id ?? imobiliariaConfig?.user_id ?? null;

    if (targetUserId) {
      const [leadResult, notificationResult] = await Promise.allSettled([
        supabase.from("leads").insert({
          imobiliaria_id: targetUserId,
          nome: cleanNome,
          email: cleanEmail,
          telefone: cleanTelefone,
          interesse: "Contato pela landing page",
          observacoes: [
            "[Landing Page]",
            `Mensagem: ${cleanMensagem}`,
            `E-mail: ${cleanEmail}`,
            cleanTelefone ? `Telefone: ${cleanTelefone}` : null,
          ].filter(Boolean).join("\n"),
          estagio: "novos",
          posicao: 0,
          valor: 0,
          canal_origem: "Landing Page",
          tipo_operacao: "venda",
        }),
        supabase.from("notifications").insert({
          user_id: targetUserId,
          title: "Nova mensagem de contato",
          description: `${cleanNome} enviou uma mensagem pelo formulário de contato.`,
        }),
      ]);

      if (leadResult.status === "rejected") {
        console.error("Unexpected error inserting landing lead:", leadResult.reason);
      } else if (leadResult.value.error) {
        console.error("Error inserting landing lead:", leadResult.value.error);
      }

      if (notificationResult.status === "rejected") {
        console.error("Unexpected error creating notification:", notificationResult.reason);
      } else if (notificationResult.value.error) {
        console.error("Error creating notification:", notificationResult.value.error);
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
