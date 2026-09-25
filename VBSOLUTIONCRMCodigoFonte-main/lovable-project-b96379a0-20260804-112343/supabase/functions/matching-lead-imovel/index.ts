import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireUserAi, callUserAi, tryParseJson, aiErrorResponse } from "../_shared/ai-config.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    const _iaGate = await requireUserAi(_sbAdmin, _aiUser?.id, corsHeaders);
    if (_iaGate.response) return _iaGate.response;
    if (!_aiUser) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: _usageCount } = await _sbAdmin.rpc("get_ai_usage_count", {
      _user_id: _aiUser.id, _function_name: "matching-lead-imovel"
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
    await _sbAdmin.from("ai_usage_log").insert({ user_id: _aiUser.id, function_name: "matching-lead-imovel" });


    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { lead_id, imobiliaria_id, bairro, tipo_imovel, valor, tipo_operacao } = await req.json();

    if (!imobiliaria_id) {
      return new Response(JSON.stringify({ error: "imobiliaria_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch active properties for this agency
    let query = supabase
      .from("imoveis")
      .select("id, titulo, tipo, operacao, preco, area, quartos, banheiros, vagas, bairro, cidade, endereco, fotos, status")
      .eq("imobiliaria_id", imobiliaria_id)
      .eq("status", "ativo")
      .limit(50);

    // Filter by operation type
    if (tipo_operacao) {
      const opMap: Record<string, string> = { venda: "Venda", aluguel: "Aluguel" };
      const op = opMap[tipo_operacao] || tipo_operacao;
      query = query.eq("operacao", op);
    }

    const { data: imoveis, error: dbError } = await query;

    if (dbError) {
      console.error("DB error:", dbError);
      return new Response(JSON.stringify({ error: "Erro ao buscar imóveis" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!imoveis || imoveis.length === 0) {
      return new Response(JSON.stringify({ matches: [], message: "Nenhum imóvel ativo encontrado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build AI prompt
    const imoveisResumo = imoveis.map((im: any) => ({
      id: im.id,
      titulo: im.titulo,
      tipo: im.tipo,
      operacao: im.operacao,
      preco: im.preco,
      area: im.area,
      quartos: im.quartos,
      bairro: im.bairro,
      cidade: im.cidade,
    }));

    const prompt = `Você é um corretor de imóveis experiente. Analise o perfil do lead e os imóveis disponíveis, retornando os melhores matches.

PERFIL DO LEAD:
- Bairro de interesse: ${bairro || "Não informado"}
- Tipo de imóvel: ${tipo_imovel || "Não informado"}
- Valor máximo: R$ ${valor ? Number(valor).toLocaleString("pt-BR") : "Não informado"}
- Operação: ${tipo_operacao || "Não informado"}

IMÓVEIS DISPONÍVEIS:
${JSON.stringify(imoveisResumo, null, 2)}

Retorne os 5 melhores matches ordenados por compatibilidade.`;

    const jsonPrompt = `${prompt}

Retorne EXATAMENTE um JSON válido nesta estrutura (sem texto fora do JSON):
{
  "matches": [
    { "imovel_id": "string (id do imóvel da lista)", "score": number (0-100), "motivo": "string (1 frase)" }
  ]
}`;

    const aiResult = await callUserAi(_iaGate.config, {
      systemPrompt: "Você é um assistente especialista em matching imobiliário. Responda APENAS com JSON válido.",
      userPrompt: jsonPrompt,
      wantJson: true,
      temperature: 0.3,
    });
    if (!aiResult.ok) return aiErrorResponse(aiResult, corsHeaders);

    const parsed = tryParseJson<{ matches?: any[] }>(aiResult.text);
    const aiMatches = Array.isArray(parsed?.matches) ? parsed!.matches! : [];

    // Enrich with full property data
    const enriched = aiMatches
      .map((m: any) => {
        const imovel = imoveis.find((im: any) => im.id === m.imovel_id);
        if (!imovel) return null;
        return {
          ...m,
          imovel: {
            id: imovel.id,
            titulo: imovel.titulo,
            tipo: imovel.tipo,
            operacao: imovel.operacao,
            preco: imovel.preco,
            area: imovel.area,
            quartos: imovel.quartos,
            bairro: imovel.bairro,
            cidade: imovel.cidade,
            foto: imovel.fotos?.[0] || null,
          },
        };
      })
      .filter(Boolean);

    return new Response(JSON.stringify({ matches: enriched }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("matching error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});