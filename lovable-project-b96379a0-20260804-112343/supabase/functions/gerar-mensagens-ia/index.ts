import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getAiConfig, legacyCallAi, requireUserAi } from "../_shared/ai-config.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // === AI Usage Limit Check ===
    const _authHeader = req.headers.get("Authorization");
    if (!_authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const _sbUrl = Deno.env.get("SUPABASE_URL")!;
    const _sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const { createClient: _createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const _sbAdmin = _createClient(_sbUrl, _sbKey);
    const _token = _authHeader.replace("Bearer ", "");
    const { data: { user: _aiUser } } = await _sbAdmin.auth.getUser(_token);
    if (!_aiUser) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: _usageCount } = await _sbAdmin.rpc("get_ai_usage_count", {
      _user_id: _aiUser.id, _function_name: "gerar-mensagens-ia"
    });
    if (_usageCount && _usageCount >= 1) {
      return new Response(JSON.stringify({ 
        error: "Limite de uso da IA atingido para esta funcionalidade. Faça upgrade do seu plano para continuar usando.",
        limit_reached: true
      }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // === End AI Usage Limit Check ===
    // Log AI usage
    await _sbAdmin.from("ai_usage_log").insert({ user_id: _aiUser.id, function_name: "gerar-mensagens-ia" });

    const { tipo, contexto } = await req.json();

    const _iaGate = await requireUserAi(_sbAdmin, _aiUser.id, corsHeaders);

    if (_iaGate.response) return _iaGate.response;

    const { apiKey, aiUrl, model, authHeaderAi, provider, isByok } = await getAiConfig(_sbAdmin, _aiUser.id);
    if (!apiKey) throw new Error("Configuração de IA não encontrada.");

    const tipoLabels: Record<string, string> = {
      aniversario: "aniversário do cliente",
      casamento: "aniversário de casamento do cliente",
      profissao: "dia da profissão do cliente",
      filho_aniversario: "aniversário do filho do cliente",
    };

    const variaveis: Record<string, string> = {
      aniversario: "{nome} = primeiro nome do cliente",
      casamento: "{nome} = primeiro nome do cliente",
      profissao: "{nome} = primeiro nome do cliente, {profissao} = profissão do cliente",
      filho_aniversario: "{nome} = primeiro nome do cliente, {filho} = nome do filho",
    };

    const systemPrompt = `Você é um especialista em marketing de relacionamento para imobiliárias brasileiras. 
Gere exatamente 5 mensagens curtas e carinhosas para ${tipoLabels[tipo] || "evento especial"}.
Cada mensagem deve usar as variáveis: ${variaveis[tipo] || "{nome}"}.
Use emojis relevantes no início de cada mensagem.
Responda APENAS com as 5 mensagens, uma por linha, sem numeração.
${contexto ? `Contexto adicional do usuário: ${contexto}` : ""}`;

    const prompt = `Gere 5 mensagens para ${tipoLabels[tipo] || tipo}. Sejam criativas e únicas.`;
    let content = "";
    try {
      content = await legacyCallAi(
        { apiKey, aiUrl, model, authHeaderAi, provider },
        systemPrompt,
        prompt,
        { temperature: 0.8 },
      );
    } catch (e: any) {
      console.error("AI error:", e?.message || e);
      return new Response(JSON.stringify({ error: e?.message || "Erro na IA" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const mensagens = (content || "")
      .split("\n")
      .map((l: string) => l.trim())
      .filter((l: string) => l.length > 5);

    return new Response(JSON.stringify({ mensagens }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("gerar-mensagens error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
