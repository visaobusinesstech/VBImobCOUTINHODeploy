import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireUserAi, callUserAi, tryParseJson, aiErrorResponse } from "../_shared/ai-config.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("approved")
      .eq("id", user.id)
      .single();

    if (!profile?.approved) {
      return new Response(JSON.stringify({ error: "Conta não aprovada" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    const _iaGate = await requireUserAi(supabase, user.id, corsHeaders);
    if (_iaGate.response) return _iaGate.response;
    const body = await req.json();
    const {
      inquilino_nome,
      inquilino_cpf,
      inquilino_renda,
      inquilino_profissao,
      tipo_garantia,
      fiador_nome,
      fiador_cpf,
      fiador_renda,
      fiador_profissao,
      fiador_imovel_proprio,
      seguradora_nome,
      seguradora_apolice,
      caucao_valor,
      valor_aluguel,
      valor_condominio,
      valor_iptu,
    } = body;

    if (!inquilino_nome || typeof inquilino_nome !== "string" || inquilino_nome.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Nome do inquilino é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!valor_aluguel || typeof valor_aluguel !== "number" || valor_aluguel <= 0) {
      return new Response(JSON.stringify({ error: "Valor do aluguel é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const custoTotal = (valor_aluguel || 0) + (valor_condominio || 0) + (valor_iptu || 0);

    const garantiaDesc = tipo_garantia === "fiador"
      ? `Fiador: ${fiador_nome || "N/I"}, CPF: ${fiador_cpf || "N/I"}, Renda: R$${fiador_renda || 0}, Profissão: ${fiador_profissao || "N/I"}, Imóvel próprio: ${fiador_imovel_proprio ? "Sim" : "Não"}`
      : tipo_garantia === "seguro_fianca"
      ? `Seguro Fiança: ${seguradora_nome || "N/I"}, Apólice: ${seguradora_apolice || "N/I"}`
      : tipo_garantia === "caucao"
      ? `Caução: R$${caucao_valor || 0} (${Math.round(((caucao_valor || 0) / valor_aluguel) * 100) / 100} meses)`
      : "Sem garantia informada";

    const prompt = `Você é um analista de crédito imobiliário especializado em locação residencial no Brasil.

Analise o perfil do inquilino abaixo e forneça uma avaliação detalhada no formato JSON.

DADOS DO INQUILINO:
- Nome: ${inquilino_nome}
- CPF: ${inquilino_cpf || "Não informado"}
- Renda declarada: R$ ${inquilino_renda || 0}
- Profissão: ${inquilino_profissao || "Não informada"}

VALORES DO IMÓVEL:
- Aluguel: R$ ${valor_aluguel}
- Condomínio: R$ ${valor_condominio || 0}
- IPTU: R$ ${valor_iptu || 0}
- Custo total mensal: R$ ${custoTotal}

GARANTIA:
- Tipo: ${tipo_garantia || "Não informada"}
- ${garantiaDesc}

REGRAS DE ANÁLISE:
1. A renda deve ser no mínimo 3x o custo total mensal
2. Fiador com imóvel próprio aumenta a segurança
3. Seguro fiança é a garantia mais segura
4. Caução deve ser de pelo menos 3 meses de aluguel
5. Profissão estável (CLT, servidor público) é mais segura que autônomo

Responda EXCLUSIVAMENTE com um JSON válido (sem markdown, sem explicações fora do JSON):
{
  "score": <número de 0 a 1000>,
  "risco": "<baixo|medio|alto|critico>",
  "capacidade_pagamento_pct": <percentual da renda comprometido>,
  "resumo": "<resumo em 2-3 frases>",
  "recomendacao": "<recomendação clara: APROVADO, APROVADO COM RESSALVAS, ou REPROVADO, com justificativa>",
  "pontos_positivos": ["<ponto 1>", "<ponto 2>"],
  "pontos_negativos": ["<ponto 1>", "<ponto 2>"],
  "analise_detalhada": {
    "renda_vs_custo": "<análise>",
    "garantia": "<análise da garantia>",
    "perfil_profissional": "<análise>",
    "recomendacoes_extras": "<sugestões>"
  }
}`;

    const aiResult = await callUserAi(_iaGate.config, {
      systemPrompt: "Você é um analista de crédito imobiliário. Responda apenas com JSON válido.",
      userPrompt: prompt,
      wantJson: true,
      temperature: 0.2,
    });

    if (!aiResult.ok) return aiErrorResponse(aiResult, corsHeaders);

    const analysis = tryParseJson(aiResult.text);
    if (!analysis) {
      console.error("Failed to parse AI response");
      return new Response(JSON.stringify({ error: "Erro ao interpretar resposta da IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log AI usage
    await supabase.from("ai_usage_log").insert({
      user_id: user.id,
      function_name: "analise-inquilino",
    });

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analise-inquilino error:", e);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});