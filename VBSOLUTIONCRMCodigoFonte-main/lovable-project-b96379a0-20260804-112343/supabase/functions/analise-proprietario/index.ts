import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireUserAi, callUserAi, tryParseJson, aiErrorResponse } from "../_shared/ai-config.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DIRECT_OWNER_PORTALS = ["olx", "mercado livre", "mercadolivre", "quintoandar", "alude", "imovel do proprietario"];
const BROKERAGE_PORTALS = ["zap", "vivareal", "imovelweb", "wimoveis", "dfimoveis"];

function fallbackAnalise(imovel: any, index: number) {
  const titulo = String(imovel?.titulo || "").toLowerCase();
  const portal = String(imovel?.portal || "").toLowerCase();
  const url = String(imovel?.url_anuncio || "").toLowerCase();
  const sinais = new Set<string>();

  const hasOwnerSignal = ["proprietario", "proprietário", "direto", "dono", "particular", "meu apartamento"].some((term) => titulo.includes(term));
  const hasBrokerSignal = ["creci", "ref:", "referencia", "referência", "imobiliaria", "imobiliária", "corretor", "exclusividade"].some((term) => titulo.includes(term));
  const isDirectPortal = DIRECT_OWNER_PORTALS.some((term) => portal.includes(term) || url.includes(term));
  const isBrokerPortal = BROKERAGE_PORTALS.some((term) => portal.includes(term) || url.includes(term));

  if (hasOwnerSignal) sinais.add("Título com linguagem de proprietário direto");
  if (hasBrokerSignal) sinais.add("Título com sinais de imobiliária/corretor");
  if (isDirectPortal) sinais.add("Portal com maior incidência de anúncios diretos");
  if (isBrokerPortal) sinais.add("Portal com forte presença de imobiliárias");

  if ((hasOwnerSignal && !hasBrokerSignal) || (isDirectPortal && !isBrokerPortal)) {
    return {
      index,
      classificacao: "proprietario",
      confianca: hasOwnerSignal ? 82 : 72,
      motivo: "Classificação automática aplicada por sinais do título e do portal do anúncio.",
      sinais: Array.from(sinais).slice(0, 3),
    };
  }

  if ((hasBrokerSignal && !hasOwnerSignal) || (isBrokerPortal && !isDirectPortal)) {
    return {
      index,
      classificacao: "imobiliaria",
      confianca: hasBrokerSignal ? 82 : 72,
      motivo: "Classificação automática aplicada por sinais comerciais típicos de imobiliária/corretor.",
      sinais: Array.from(sinais).slice(0, 3),
    };
  }

  return {
    index,
    classificacao: "incerto",
    confianca: 55,
    motivo: "A IA não retornou um resultado confiável e os sinais automáticos foram inconclusivos.",
    sinais: Array.from(sinais).slice(0, 3),
  };
}

function normalizarResultados(resultados: any, batch: any[]) {
  const byIndex = new Map<number, any>();

  if (Array.isArray(resultados)) {
    resultados.forEach((item) => {
      if (typeof item?.index === "number") {
        byIndex.set(item.index, item);
      }
    });
  }

  return batch.map((imovel, index) => {
    const item = byIndex.get(index);
    if (!item) return fallbackAnalise(imovel, index);

    return {
      index,
      classificacao: item.classificacao === "proprietario" || item.classificacao === "imobiliaria" || item.classificacao === "incerto"
        ? item.classificacao
        : fallbackAnalise(imovel, index).classificacao,
      confianca: typeof item.confianca === "number" ? Math.max(0, Math.min(100, Math.round(item.confianca))) : fallbackAnalise(imovel, index).confianca,
      motivo: typeof item.motivo === "string" && item.motivo.trim() ? item.motivo.trim() : fallbackAnalise(imovel, index).motivo,
      sinais: Array.isArray(item.sinais) ? item.sinais.filter((signal: unknown) => typeof signal === "string" && signal.trim()).slice(0, 3) : fallbackAnalise(imovel, index).sinais,
    };
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sbUrl = Deno.env.get("SUPABASE_URL")!;
    const sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Validate caller JWT
    const anonClient = createClient(sbUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Sessão expirada. Faça login novamente." }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sbAdmin = createClient(sbUrl, sbKey);

    // Verify caller is approved + check plan
    const { data: profile } = await sbAdmin
      .from("profiles")
      .select("approved, is_master, plano")
      .eq("id", user.id)
      .single();

    if (!profile?.approved) {
      return new Response(JSON.stringify({ error: "Conta não aprovada." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isUnlimited = profile.is_master === true
      || profile.plano === "premium_plus"
      || profile.plano === "imobiliaria";

    // AI usage limit (skipped for unlimited plans)
    if (!isUnlimited) {
      const { data: usageCount } = await sbAdmin.rpc("get_ai_usage_count", {
        _user_id: user.id, _function_name: "analise-proprietario"
      });
      const planLimit = profile.plano === "premium" ? 50 : profile.plano === "profissional" ? 30 : 10;
      if (usageCount && usageCount >= planLimit) {
        return new Response(JSON.stringify({ 
          error: "Limite de uso da IA atingido para esta funcionalidade. Faça upgrade do seu plano para continuar usando.",
          limit_reached: true
        }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Log AI usage
    await sbAdmin.from("ai_usage_log").insert({ user_id: user.id, function_name: "analise-proprietario" });

    const _iaGate = await requireUserAi(sbAdmin, user.id, corsHeaders);
    if (_iaGate.response) return _iaGate.response;

    const { imoveis } = await req.json();
    
    if (!imoveis || !Array.isArray(imoveis) || imoveis.length === 0) {
      return new Response(JSON.stringify({ error: "Lista de imóveis vazia" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Batch up to 50 at a time (unlimited plans get bigger batches)
    const batchSize = isUnlimited ? 50 : 20;
    const batch = imoveis.slice(0, batchSize);

    const listFormatted = batch.map((im: any, i: number) => 
      `${i + 1}. Título: "${im.titulo}" | Portal: ${im.portal} | Preço: R$${im.preco?.toLocaleString("pt-BR")} | Área: ${im.area}m² | Bairro: ${im.bairro || "N/A"} | URL: ${im.url_anuncio || "N/A"}`
    ).join("\n");

    const systemPrompt = `Você é um especialista em mercado imobiliário brasileiro. Analise anúncios e classifique cada um como PROPRIETÁRIO DIRETO ou IMOBILIÁRIA/CORRETOR.

PROPRIETÁRIO: portais como OLX/Mercado Livre/QuintoAndar; títulos informais ("Vendo meu apartamento", "Direto com proprietário"); preços quebrados; sem CRECI.
IMOBILIÁRIA: portais como ZAP/VivaReal/Imovelweb; títulos com CRECI, "Ref:", código de referência; linguagem profissional.

Responda EXCLUSIVAMENTE com um JSON válido (sem markdown, sem explicações fora do JSON).`;

    const userPrompt = `Analise os seguintes ${batch.length} anúncios. Para cada um, retorne "classificacao" ("proprietario"|"imobiliaria"|"incerto"), "confianca" (0-100), "motivo" (1-2 frases), "sinais" (2-3 strings).

Retorne EXATAMENTE neste formato JSON:
{ "resultados": [ { "index": 0, "classificacao": "...", "confianca": 85, "motivo": "...", "sinais": ["..."] } ] }

Anúncios:
${listFormatted}`;

    const aiResult = await callUserAi(_iaGate.config, {
      systemPrompt, userPrompt, wantJson: true, temperature: 0.2,
    });
    if (!aiResult.ok) return aiErrorResponse(aiResult, corsHeaders);

    const parsed = tryParseJson<{ resultados?: unknown[] }>(aiResult.text);
    const resultadosExtraidos: unknown[] = Array.isArray(parsed?.resultados) ? parsed!.resultados! : [];

    const resultados = normalizarResultados(resultadosExtraidos, batch);

    return new Response(JSON.stringify({ success: true, resultados }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analise-proprietario error:", e);
    return new Response(JSON.stringify({ error: "Erro ao processar análise. Tente novamente." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
