import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireUserAi, callUserAi, aiErrorResponse } from "../_shared/ai-config.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
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

    const _iaGate = await requireUserAi(_sbAdmin, _aiUser?.id, corsHeaders);
    if (_iaGate.response) return _iaGate.response;
    if (!_aiUser) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: _usageCount } = await _sbAdmin.rpc("get_ai_usage_count", {
      _user_id: _aiUser.id, _function_name: "feedback-visita-ia"
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
    await _sbAdmin.from("ai_usage_log").insert({ user_id: _aiUser.id, function_name: "feedback-visita-ia" });


    const { compromisso_id, feedback_visita } = await req.json();

    if (!compromisso_id || !feedback_visita) {
      return new Response(
        JSON.stringify({ error: "compromisso_id e feedback_visita são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch compromisso details
    const { data: comp, error: compError } = await supabase
      .from("compromissos")
      .select("titulo, tipo, local, data_inicio, data_fim, checkin_at, checkout_at, descricao, lead_id, leads(nome)")
      .eq("id", compromisso_id)
      .single();

    if (compError || !comp) {
      return new Response(
        JSON.stringify({ error: "Compromisso não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const leadNome = (comp as any).leads?.nome || "Cliente";
    const duracao = comp.checkin_at && comp.checkout_at
      ? `${Math.round((new Date(comp.checkout_at).getTime() - new Date(comp.checkin_at).getTime()) / 60000)} minutos`
      : "não registrada";

    const prompt = `Você é um assistente especializado em mercado imobiliário brasileiro. 
Analise o feedback de uma visita a imóvel e gere:
1. Um resumo profissional da visita (2-3 frases)
2. Próximos passos sugeridos (2-3 ações concretas)
3. Nível de interesse do cliente (Alto/Médio/Baixo) baseado no feedback
4. Dica para o corretor melhorar a próxima abordagem

Dados da visita:
- Tipo: ${comp.tipo}
- Título: ${comp.titulo}
- Local: ${comp.local || "Não informado"}
- Cliente: ${leadNome}
- Duração da visita: ${duracao}
- Descrição prévia: ${comp.descricao || "Nenhuma"}
- Feedback do corretor: ${feedback_visita}

Responda em português brasileiro, de forma objetiva e profissional.`;

    const aiResult = await callUserAi(_iaGate.config, {
      systemPrompt: "Você é um consultor imobiliário experiente que analisa visitas e gera insights acionáveis.",
      userPrompt: prompt,
      temperature: 0.5,
    });
    if (!aiResult.ok) return aiErrorResponse(aiResult, corsHeaders);
    const feedbackIA = aiResult.text || "Não foi possível gerar análise.";

    // Save both feedbacks
    const { error: updateError } = await supabase
      .from("compromissos")
      .update({ feedback_visita, feedback_ia: feedbackIA })
      .eq("id", compromisso_id);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ success: true, feedback_ia: feedbackIA }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Erro feedback-visita-ia:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
