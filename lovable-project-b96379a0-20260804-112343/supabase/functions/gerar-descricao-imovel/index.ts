import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getAiConfig, legacyCallAi, requireUserAi } from "../_shared/ai-config.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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
      _user_id: _aiUser.id, _function_name: "gerar-descricao-imovel"
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
    await _sbAdmin.from("ai_usage_log").insert({ user_id: _aiUser.id, function_name: "gerar-descricao-imovel" });


    const { imovel } = await req.json();

    const _iaGate = await requireUserAi(_sbAdmin, _aiUser.id, corsHeaders);

    if (_iaGate.response) return _iaGate.response;

    const { apiKey, aiUrl, model, authHeaderAi, provider, isByok } = await getAiConfig(_sbAdmin, _aiUser.id);
    if (!apiKey) throw new Error("Configuração de IA não encontrada.");

    const detalhes = [
      imovel.tipo && `Tipo: ${imovel.tipo}`,
      imovel.operacao && `Operação: ${imovel.operacao}`,
      imovel.area && `Área: ${imovel.area}m²`,
      imovel.quartos && `${imovel.quartos} quarto(s)`,
      imovel.suites && `${imovel.suites} suíte(s)`,
      imovel.banheiros && `${imovel.banheiros} banheiro(s)`,
      imovel.vagas && `${imovel.vagas} vaga(s)`,
      imovel.andar && `Andar: ${imovel.andar}`,
      imovel.posicao_solar && `Posição solar: ${imovel.posicao_solar}`,
      imovel.bairro && `Bairro: ${imovel.bairro}`,
      imovel.cidade && `Cidade: ${imovel.cidade}`,
      imovel.estado && `Estado: ${imovel.estado}`,
      imovel.valor_condominio && `Condomínio: R$ ${imovel.valor_condominio}`,
      imovel.valor_iptu && `IPTU: R$ ${imovel.valor_iptu}`,
      imovel.aceita_financiamento && "Aceita financiamento",
      imovel.aceita_fgts && "Aceita FGTS",
      imovel.aceita_permuta && "Aceita permuta",
      imovel.tem_escritura && "Possui escritura",
      imovel.exclusivo && "Imóvel exclusivo",
    ]
      .filter(Boolean)
      .join("\n- ");

    const prompt = `Você é um copywriter especialista em mercado imobiliário brasileiro. Gere uma descrição profissional, atrativa e otimizada para portais imobiliários (ZAP, Viva Real, OLX) para o seguinte imóvel:

Título: ${imovel.titulo || "Não informado"}
- ${detalhes}

Regras:
1. Escreva em português brasileiro, tom profissional e persuasivo.
2. Destaque os diferenciais do imóvel (localização, acabamento, facilidades).
3. Use parágrafos curtos e diretos.
4. Inclua call-to-action ao final convidando o interessado a agendar uma visita.
5. Não invente informações que não foram fornecidas.
6. Retorne APENAS o texto da descrição, sem títulos, sem markdown.
7. Entre 150 e 300 palavras.`;

    const systemPrompt = "Você é um copywriter imobiliário profissional brasileiro. Gere descrições atrativas e persuasivas para anúncios de imóveis.";
    let descricao = "";
    try {
      descricao = (await legacyCallAi(
        { apiKey, aiUrl, model, authHeaderAi, provider },
        systemPrompt,
        prompt,
        { temperature: 0.7 },
      )).trim();
    } catch (e: any) {
      console.error("AI error:", e?.message || e);
      return new Response(JSON.stringify({ error: e?.message || "Erro na IA" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ descricao }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("gerar-descricao-imovel error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
