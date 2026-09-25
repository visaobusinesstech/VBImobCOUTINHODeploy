import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { firstModel } from "../_shared/ai-models.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // 1. Authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("[TestAI] Authorization header missing");
      throw new Error("Não autorizado: Header de autorização ausente.");
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) {
      console.error("[TestAI] Auth error or user not found:", authError);
      throw new Error("Sessão expirada ou usuário não encontrado.");
    }

    // 2. Request parsing
    const rawBody = await req.json();
    const provider = rawBody?.provider;
    // Sempre aplicar trim() — copiar/colar frequentemente traz espaços,
    // tabs ou quebras de linha invisíveis que quebrariam a autenticação.
    const apiKey = typeof rawBody?.apiKey === "string" ? rawBody.apiKey.trim() : "";
    const model = rawBody?.model;
    console.log(`[TestAI] User: ${user.id}, Provider: ${provider}, Model: ${model}`);

    if (!apiKey) {
      throw new Error("Por favor, informe a chave para testar.");
    }

    // Reject the deprecated "lovable" system-key provider — BYOK only.
    if (provider === "lovable") {
      throw new Error("O provedor 'lovable' foi descontinuado. Cadastre a chave da sua própria conta de IA (OpenAI, Anthropic, Google, Groq, DeepSeek ou OpenRouter).");
    }

    let aiResponse = "";

    // Helper: extrai a mensagem de erro real retornada pelo provedor
    const extractProviderError = (resData: any, status: number, prov: string): string => {
      const msg =
        resData?.error?.message ||
        resData?.error?.error?.message ||
        resData?.message ||
        (typeof resData?.error === "string" ? resData.error : null) ||
        resData?.error_description ||
        resData?.detail;
      if (msg) return `${prov} (${status}): ${msg}`;
      try { return `${prov} (${status}): ${JSON.stringify(resData).slice(0, 300)}`; }
      catch { return `${prov} (${status}): erro desconhecido`; }
    };

    if (provider === "serper") {
      console.log("[TestAI] Testing Serper API...");
      const response = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ q: "teste", num: 1 })
      });
      const resText = await response.text();
      let resData: any;
      try { resData = JSON.parse(resText); } catch { resData = { error: resText }; }
      if (!response.ok) {
        console.error("[TestAI] Serper failed:", resData);
        throw new Error(extractProviderError(resData, response.status, "Serper"));
      }
      aiResponse = "Serper OK - Conexão estabelecida com sucesso!";
    } else {
      // Validação real: chamada leve ao endpoint de listagem de modelos
      // (ou equivalente de baixo custo). Sempre GET quando possível.
      let url = "";
      let method: "GET" | "POST" = "GET";
      let headers: Record<string, string> = {};
      let body: string | undefined;

      if (provider === "openai") {
        url = "https://api.openai.com/v1/models";
        headers["Authorization"] = `Bearer ${apiKey}`;
      } else if (provider === "groq") {
        url = "https://api.groq.com/openai/v1/models";
        headers["Authorization"] = `Bearer ${apiKey}`;
      } else if (provider === "deepseek") {
        url = "https://api.deepseek.com/v1/models";
        headers["Authorization"] = `Bearer ${apiKey}`;
      } else if (provider === "openrouter") {
        url = "https://openrouter.ai/api/v1/models";
        headers["Authorization"] = `Bearer ${apiKey}`;
        headers["HTTP-Referer"] = "https://radarimobtech.shop";
        headers["X-Title"] = "radarimobtech";
      } else if (provider === "google") {
        url = `https://generativelanguage.googleapis.com/v1/models?key=${encodeURIComponent(apiKey)}`;
      } else if (provider === "anthropic") {
        // Anthropic não tem GET /models público estável; um POST /messages
        // mínimo com max_tokens=1 valida a chave com custo insignificante.
        url = "https://api.anthropic.com/v1/messages";
        method = "POST";
        headers = {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        };
        body = JSON.stringify({
          model: model || firstModel("anthropic"),
          max_tokens: 1,
          messages: [{ role: "user", content: "ok" }],
        });
      } else {
        throw new Error(`Provedor desconhecido: ${provider}`);
      }

      console.log(`[TestAI] Validating ${provider} via ${method} ${url.split("?")[0]}`);
      const response = await fetch(url, { method, headers, body });
      const resText = await response.text();
      let resData: any;
      try { resData = JSON.parse(resText); } catch { resData = { error: resText }; }

      if (!response.ok) {
        console.error(`[TestAI] Provider ${provider} failed:`, resData);
        throw new Error(extractProviderError(resData, response.status, provider));
      }

      aiResponse = `${provider} OK — chave validada com sucesso.`;
    }


    // 4. Usage logging
    try {
      await supabase.from("ai_usage_logs").insert({
        user_id: user.id,
        provider,
        model: model || "default",
        status: "success"
      });
    } catch (logErr) {
      console.warn("[TestAI] Failed to log usage:", logErr.message);
    }

    console.log(`[TestAI] Success for ${provider}`);
    return new Response(JSON.stringify({ success: true, message: aiResponse }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e: any) {
    console.error("[TestAI] Fatal Error:", e.message);
    // Retornar 200 com payload de erro para o frontend conseguir ler a mensagem
    // (supabase.functions.invoke descarta o body em respostas não-2xx)
    return new Response(JSON.stringify({ success: false, error: e.message, message: e.message }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});