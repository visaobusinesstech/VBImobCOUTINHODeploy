import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireUserAi } from "../_shared/ai-config.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
      _user_id: _aiUser.id, _function_name: "previsao-valorizacao"
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
    await _sbAdmin.from("ai_usage_log").insert({ user_id: _aiUser.id, function_name: "previsao-valorizacao" });


    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch market data grouped by bairro
    const { data: mercado } = await supabase
      .from("imoveis_mercado")
      .select("bairro, preco, area, preco_m2, tipo, operacao, data_scraping, dias_anuncio")
      .gt("preco", 0)
      .gt("area", 0)
      .limit(1000);

    // Fetch internal portfolio
    const { data: carteira } = await supabase
      .from("imoveis")
      .select("bairro, preco, area, tipo, operacao, created_at, status")
      .eq("status", "Ativo")
      .gt("preco", 0)
      .gt("area", 0);

    // Aggregate data by bairro
    const bairroStats: Record<string, {
      totalImoveis: number;
      precoM2List: number[];
      diasAnuncioList: number[];
      tipos: Record<string, number>;
      carteiraPropria: number;
    }> = {};

    for (const m of mercado || []) {
      const b = (m.bairro || "").trim();
      if (!b) continue;
      if (!bairroStats[b]) bairroStats[b] = { totalImoveis: 0, precoM2List: [], diasAnuncioList: [], tipos: {}, carteiraPropria: 0 };
      const pm2 = m.preco_m2 || (m.area > 0 ? m.preco / m.area : 0);
      if (pm2 > 0) bairroStats[b].precoM2List.push(pm2);
      if (m.dias_anuncio) bairroStats[b].diasAnuncioList.push(m.dias_anuncio);
      bairroStats[b].totalImoveis++;
      const tipo = m.tipo || "Outro";
      bairroStats[b].tipos[tipo] = (bairroStats[b].tipos[tipo] || 0) + 1;
    }

    for (const i of carteira || []) {
      const b = (i.bairro || "").trim();
      if (!b) continue;
      if (!bairroStats[b]) bairroStats[b] = { totalImoveis: 0, precoM2List: [], diasAnuncioList: [], tipos: {}, carteiraPropria: 0 };
      const pm2 = i.area > 0 ? i.preco / i.area : 0;
      if (pm2 > 0) bairroStats[b].precoM2List.push(pm2);
      bairroStats[b].carteiraPropria++;
    }

    // Filter bairros with enough data (at least 3 listings)
    const bairrosComDados = Object.entries(bairroStats)
      .filter(([_, s]) => s.precoM2List.length >= 3)
      .map(([bairro, s]) => {
        const avg = s.precoM2List.reduce((a, b) => a + b, 0) / s.precoM2List.length;
        const min = Math.min(...s.precoM2List);
        const max = Math.max(...s.precoM2List);
        const avgDias = s.diasAnuncioList.length > 0
          ? s.diasAnuncioList.reduce((a, b) => a + b, 0) / s.diasAnuncioList.length
          : null;
        const tipoMaisComum = Object.entries(s.tipos).sort((a, b) => b[1] - a[1])[0]?.[0] || "Variado";
        return {
          bairro,
          precoM2Medio: Math.round(avg),
          precoM2Min: Math.round(min),
          precoM2Max: Math.round(max),
          totalAnuncios: s.totalImoveis,
          diasMedioAnuncio: avgDias ? Math.round(avgDias) : null,
          tipoMaisComum,
          carteiraPropria: s.carteiraPropria,
        };
      })
      .sort((a, b) => b.totalAnuncios - a.totalAnuncios)
      .slice(0, 15);

    if (bairrosComDados.length === 0) {
      return new Response(
        JSON.stringify({ success: true, predictions: [], message: "Dados insuficientes para previsão." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build prompt for AI
    const dataResume = bairrosComDados.map(b =>
      `- ${b.bairro}: R$${b.precoM2Medio}/m² (min R$${b.precoM2Min}, max R$${b.precoM2Max}), ${b.totalAnuncios} anúncios, tipo predominante: ${b.tipoMaisComum}${b.diasMedioAnuncio ? `, média ${b.diasMedioAnuncio} dias no ar` : ""}${b.carteiraPropria > 0 ? `, ${b.carteiraPropria} na carteira própria` : ""}`
    ).join("\n");

    const systemPrompt = `Você é um analista imobiliário especialista no mercado brasileiro, focado em Brasília/DF e regiões satélites. Sua tarefa é analisar dados de mercado e prever tendências de valorização para os próximos 6 a 12 meses.`;

    const userPrompt = `Analise os seguintes dados de mercado imobiliário por bairro e forneça previsões de valorização:

${dataResume}

Para cada bairro, forneça sua análise usando a tool suggest_predictions.

Considere:
- Preço médio por m² e amplitude (min/max) indicam estabilidade ou volatilidade
- Tempo médio de anúncio indica liquidez (menos dias = mais demanda)
- Volume de anúncios indica oferta disponível
- Tipo predominante define o perfil do mercado local`;

    const jsonSchemaPrompt = `${userPrompt}

Retorne EXATAMENTE um JSON com esta estrutura (sem texto fora do JSON):
{
  "predictions": [
    {
      "bairro": "string",
      "tendencia": "alta" | "estavel" | "queda",
      "variacao_percentual": number,
      "confianca": "alta" | "media" | "baixa",
      "liquidez": "alta" | "media" | "baixa",
      "resumo": "string (1-2 frases)",
      "recomendacao": "string (1 frase)"
    }
  ]
}`;

    const aiResult = await callUserAi(_iaGate.config, {
      systemPrompt, userPrompt: jsonSchemaPrompt, wantJson: true, temperature: 0.3,
    });
    if (!aiResult.ok) return aiErrorResponse(aiResult, corsHeaders);
    const parsed = tryParseJson<{ predictions?: any[] }>(aiResult.text);
    const predictions: any[] = Array.isArray(parsed?.predictions) ? parsed!.predictions! : [];

    // Enrich predictions with raw data
    const enriched = predictions.map((p: any) => {
      const raw = bairrosComDados.find(b => b.bairro.toLowerCase() === p.bairro.toLowerCase());
      return { ...p, dados: raw || null };
    });

    return new Response(
      JSON.stringify({ success: true, predictions: enriched, totalBairros: bairrosComDados.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Erro previsão:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
