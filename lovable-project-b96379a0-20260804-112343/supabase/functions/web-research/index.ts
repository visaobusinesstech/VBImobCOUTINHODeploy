import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { getAiConfig, legacyCallAi, requireUserAi } from "../_shared/ai-config.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autorizado");

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) throw new Error("Usuário não encontrado");

    const { query, refresh, source = 'general' } = await req.json();
    if (!query) throw new Error("Query é necessária");

    // 0. Usage Limit Check
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data: usageCount, error: usageError } = await supabase
      .from("serper_audit_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", startOfMonth.toISOString());

    const { data: limitConfig } = await supabase
      .from("serper_usage_limits")
      .select("monthly_limit")
      .eq("user_id", user.id)
      .maybeSingle();

    const monthlyLimit = limitConfig?.monthly_limit || 100;

    if (!usageError && usageCount !== null && usageCount >= monthlyLimit) {
      return new Response(JSON.stringify({ 
        error: `Limite mensal de pesquisas Serper atingido (${monthlyLimit}). Entre em contato com o suporte ou aumente seu plano.`,
        limitReached: true 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    // 0.1 Audit Log
    try {
      await supabase.from("serper_audit_logs").insert({
        user_id: user.id,
        query: query,
        source: source
      });
    } catch (auditError) {
      console.error("Failed to log audit trail:", auditError);
    }

    // 1. Check Cache
    if (!refresh) {
      const yesterday = new Date();
      yesterday.setHours(yesterday.getHours() - 24);

      const { data: cachedData, error: cacheError } = await supabase
        .from("serper_search_cache")
        .select("*")
        .eq("user_id", user.id)
        .eq("query", query)
        .gt("created_at", yesterday.toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!cacheError && cachedData) {
        return new Response(JSON.stringify({ 
          summary: cachedData.summary, 
          results: cachedData.results,
          cached: true 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
    }

    // 2. Fetch user AI config
    const _iaGate = await requireUserAi(supabase, user.id, corsHeaders);
    if (_iaGate.response) return _iaGate.response;
    const { apiKey, aiUrl, model: activeModel, authHeaderAi, provider, isByok } = await getAiConfig(supabase, user.id);

    const { data: config } = await supabase
      .from("user_ai_config")
      .select("serper_key_encrypted, serper_config")
      .eq("user_id", user.id)
      .maybeSingle();

    const serperKey = config?.serper_key_encrypted;
    if (!serperKey) {
      return new Response(JSON.stringify({ 
        error: "Chave Serper não configurada. Vá em Configurações > IA para configurar.",
        needsConfig: true 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // 3. Call Serper API
    let finalQuery = query;
    const serperConfig = config?.serper_config;
    
    if (serperConfig) {
      if (source === 'property' && serperConfig.real_estate?.enabled !== false) {
        const portals = serperConfig.real_estate?.portals;
        if (portals?.length) finalQuery = `${query} (${portals.map((p: string) => `site:${p}`).join(" OR ")})`;
      } else if (source === 'owner' && serperConfig.owner_diligence?.enabled !== false) {
        const portals = serperConfig.owner_diligence?.portals;
        if (portals?.length) finalQuery = `${query} (${portals.map((p: string) => `site:${p}`).join(" OR ")})`;
      }
    }

    const serperResponse = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": serperKey, "Content-Type": "application/json" },
      body: JSON.stringify({ q: finalQuery, gl: "br", hl: "pt-br" }),
    });

    const searchData = await serperResponse.json();
    if (searchData.error) throw new Error("Serper API Error: " + searchData.error);

    // 4. Summarize with AI
    let summary = "";
    const results = searchData.organic?.slice(0, 5) || [];

    if (apiKey && results.length > 0) {
      const resultsText = results.map((r: any) => `${r.title}: ${r.snippet}`).join("\n");
      const prompt = source === 'lead' 
        ? `Você é um especialista em enriquecimento de dados. Analise os resultados de pesquisa para "${query}" e extraia informações para um lead de CRM imobiliário. Retorne um JSON com: "contexto", "redes_sociais" (URLs), "empresa", "cargo", "site". APENAS o JSON.`
        : `Resuma os seguintes resultados de pesquisa sobre "${query}" para um corretor de imóveis. Destaque informações relevantes. Seja conciso. Português.\n\nResultados:\n${resultsText}`;

      try {
        summary = await legacyCallAi(
          { apiKey, aiUrl, model: activeModel, authHeaderAi, provider },
          undefined,
          prompt,
          { temperature: 0.5 },
        );
      } catch (e: any) {
        console.error("web-research AI error:", e?.message || e);
        summary = "";
      }
    }

    // 5. Save to Cache
    let parsedEnrichment = null;
    if (source === 'lead' && summary) {
      const jsonMatch = summary.match(/\{[\s\S]*\}/);
      if (jsonMatch) try { parsedEnrichment = JSON.parse(jsonMatch[0]); } catch (e) {}
    }

    await supabase.from("serper_search_cache").insert({
      user_id: user.id, query: query, results: results, summary: summary
    });

    return new Response(JSON.stringify({ summary, results, enrichment: parsedEnrichment, cached: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: any) {
    console.error("Web research error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
