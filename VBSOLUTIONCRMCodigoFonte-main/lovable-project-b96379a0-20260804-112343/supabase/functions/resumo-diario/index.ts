import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireUserAi, callUserAi } from "../_shared/ai-config.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const _iaGate = await requireUserAi(_sbAdmin, _aiUser?.id, corsHeaders);
    if (_iaGate.response) return _iaGate.response;
    if (!_aiUser) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: _usageCount } = await _sbAdmin.rpc("get_ai_usage_count", {
      _user_id: _aiUser.id, _function_name: "resumo-diario"
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
    await _sbAdmin.from("ai_usage_log").insert({ user_id: _aiUser.id, function_name: "resumo-diario" });


    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { imobiliaria_id } = body;

    if (!imobiliaria_id) {
      return new Response(
        JSON.stringify({ error: "imobiliaria_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const hoje = new Date();
    const hojeStr = hoje.toISOString().split("T")[0];
    const mesAtual = hoje.getMonth();
    const anoAtual = hoje.getFullYear();
    const inicioMes = new Date(anoAtual, mesAtual, 1).toISOString();

    // Fetch data in parallel
    const [leadsRes, transacoesRes, contratosRes, followupsRes, compromissosRes] = await Promise.all([
      supabase.from("leads").select("id, estagio, valor, created_at").eq("imobiliaria_id", imobiliaria_id).gte("created_at", inicioMes),
      supabase.from("transacoes").select("id, tipo, valor, data, status, categoria").eq("imobiliaria_id", imobiliaria_id).gte("data", `${anoAtual}-${String(mesAtual + 1).padStart(2, "0")}-01`),
      supabase.from("contratos").select("id, tipo, valor, status, created_at").eq("imobiliaria_id", imobiliaria_id).gte("created_at", inicioMes),
      supabase.from("followups").select("id, status").eq("imobiliaria_id", imobiliaria_id).eq("status", "pendente"),
      supabase.from("compromissos").select("id, status, data_inicio").eq("imobiliaria_id", imobiliaria_id).gte("data_inicio", `${hojeStr}T00:00:00`).lte("data_inicio", `${hojeStr}T23:59:59`),
    ]);

    const leads = leadsRes.data || [];
    const transacoes = transacoesRes.data || [];
    const contratos = contratosRes.data || [];
    const followups = followupsRes.data || [];
    const compromissos = compromissosRes.data || [];

    // Calculate KPIs
    const totalLeadsMes = leads.length;
    const leadsFechados = leads.filter((l: any) => l.estagio === "fechado").length;
    const leadsPerdidos = leads.filter((l: any) => l.estagio === "perdido").length;
    const conversao = totalLeadsMes > 0 ? ((leadsFechados / totalLeadsMes) * 100).toFixed(1) : "0";

    const receitaConfirmada = transacoes.filter((t: any) => t.tipo === "entrada" && t.status === "confirmado").reduce((s: number, t: any) => s + t.valor, 0);
    const despesaTotal = transacoes.filter((t: any) => t.tipo === "saida" && t.status === "confirmado").reduce((s: number, t: any) => s + t.valor, 0);
    const aReceber = transacoes.filter((t: any) => t.tipo === "entrada" && t.status === "pendente").reduce((s: number, t: any) => s + t.valor, 0);
    const inadimplente = transacoes.filter((t: any) => t.tipo === "entrada" && t.status === "atrasado").reduce((s: number, t: any) => s + t.valor, 0);

    const contratosVenda = contratos.filter((c: any) => c.tipo === "Venda").length;
    const contratosAluguel = contratos.filter((c: any) => c.tipo === "Locação").length;

    const followupsPendentes = followups.length;
    const compromissosHoje = compromissos.length;

    const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

    // Build AI prompt (uses user's BYOK provider — never a system key)
    const prompt = `Você é um analista de negócios imobiliário. Gere um resumo executivo diário baseado nos KPIs abaixo.
Use linguagem profissional, direta e otimista, mas realista. Inclua recomendações práticas.
Formate o resultado em markdown com emojis.

## KPIs do Mês (${hoje.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })})

- **Leads captados**: ${totalLeadsMes}
- **Leads fechados**: ${leadsFechados}
- **Leads perdidos**: ${leadsPerdidos}
- **Taxa de conversão**: ${conversao}%
- **Receita confirmada**: ${fmt(receitaConfirmada)}
- **Despesas**: ${fmt(despesaTotal)}
- **Resultado**: ${fmt(receitaConfirmada - despesaTotal)}
- **A receber (pendente)**: ${fmt(aReceber)}
- **Inadimplência**: ${fmt(inadimplente)}
- **Contratos de venda**: ${contratosVenda}
- **Contratos de aluguel**: ${contratosAluguel}
- **Follow-ups pendentes**: ${followupsPendentes}
- **Compromissos hoje**: ${compromissosHoje}

Gere:
1. Um resumo de 3 linhas do desempenho geral
2. 3 destaques positivos
3. 3 pontos de atenção
4. 3 recomendações de ação imediata`;

    const aiResult = await callUserAi(_iaGate.config, {
      systemPrompt: "Você é um analista de negócios imobiliário brasileiro. Responda em português.",
      userPrompt: prompt,
      maxTokens: 1500,
      temperature: 0.5,
    });
    const resumoIA = aiResult.ok ? (aiResult.text || "Não foi possível gerar o resumo.") : `⚠️ ${aiResult.error}`;

    return new Response(
      JSON.stringify({
        success: true,
        data: hoje.toLocaleDateString("pt-BR"),
        kpis: {
          totalLeadsMes,
          leadsFechados,
          leadsPerdidos,
          conversao: `${conversao}%`,
          receitaConfirmada: fmt(receitaConfirmada),
          despesaTotal: fmt(despesaTotal),
          resultado: fmt(receitaConfirmada - despesaTotal),
          aReceber: fmt(aReceber),
          inadimplente: fmt(inadimplente),
          contratosVenda,
          contratosAluguel,
          followupsPendentes,
          compromissosHoje,
        },
        resumo_ia: resumoIA,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Resumo diário error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
