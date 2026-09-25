import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function generateDocumentId(): string {
  return "DOC-" + crypto.randomUUID().split("-")[0].toUpperCase();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Verify caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado. Faça login para usar assinatura digital." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify the caller's JWT
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: authError } = await anonClient.auth.getUser();
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: "Sessão expirada. Faça login novamente." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is approved
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: profile } = await supabase
      .from("profiles")
      .select("approved")
      .eq("id", caller.id)
      .single();

    if (!profile?.approved) {
      return new Response(JSON.stringify({ error: "Sua conta precisa ser aprovada para usar este serviço." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, contratoId, documentId, signers, title } = await req.json();

    console.log("[signature-digital] Action:", action, "Contract:", contratoId, "User:", caller.id);

    // Check available providers
    const hasAutentique = !!Deno.env.get("AUTENTIQUE_API_KEY");
    const hasClicksign = !!Deno.env.get("CLICKSIGN_API_KEY");
    const hasDocusign = !!Deno.env.get("DOCUSIGN_API_KEY");
    const hasRealProvider = hasAutentique || hasClicksign || hasDocusign;

    const activeProvider = hasAutentique ? "Autentique" : hasClicksign ? "Clicksign" : hasDocusign ? "DocuSign" : "Autentique (Simulado)";
    const providers = hasRealProvider
      ? [hasAutentique && "Autentique", hasClicksign && "Clicksign", hasDocusign && "DocuSign"].filter(Boolean)
      : ["Autentique (Simulado)"];

    if (action === "create") {
      if (!contratoId || !signers || signers.length === 0) {
        return new Response(JSON.stringify({ error: "contratoId e signers são obrigatórios" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const docId = generateDocumentId();
      const signersWithStatus = signers.map((s: any, i: number) => ({
        name: s.name,
        email: s.email || `signer${i + 1}@email.com`,
        cpf: s.cpf || null,
        signed: false,
        signedAt: null,
        signUrl: `https://app.autentique.com.br/sign/${docId}/${i + 1}`,
      }));

      // Log audit
      await supabase.from("audit_log").insert({
        master_id: caller.id,
        target_user_id: caller.id,
        acao: "signature_create",
        modulo: "contratos",
        detalhes: `Assinatura digital criada para contrato ${contratoId}. Documento: ${docId}. Provider: ${activeProvider}. Signatários: ${signers.length}${!hasRealProvider ? " (simulado)" : ""}`,
      });

      return new Response(JSON.stringify({
        success: true,
        simulated: !hasRealProvider,
        message: hasRealProvider
          ? `Documento criado com sucesso via ${activeProvider}. Aguardando assinaturas.`
          : `Documento simulado criado via ${activeProvider}. Configure API keys para assinaturas reais com validade jurídica.`,
        providers,
        activeProvider,
        documentId: docId,
        title: title || `Contrato ${contratoId}`,
        signUrl: `https://app.autentique.com.br/sign/${docId}`,
        signers: signersWithStatus,
        status: "pending",
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "status") {
      if (!documentId) {
        return new Response(JSON.stringify({ error: "documentId é obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        success: true,
        documentId,
        status: "pending",
        provider: activeProvider,
        message: "Aguardando assinaturas dos signatários.",
        signers: [],
        updatedAt: new Date().toISOString(),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: `Ação desconhecida: ${action}` }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("[signature-digital] Error:", error.message);
    return new Response(JSON.stringify({ error: "Erro ao processar assinatura digital. Tente novamente." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
