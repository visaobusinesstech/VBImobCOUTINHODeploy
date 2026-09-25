import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireUserAi, callUserAi, tryParseJson, mapAiErrorPayload } from "../_shared/ai-config.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function extractJsonFromText(text: string) {
  let cleaned = text
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  const jsonStart = cleaned.search(/[\[{]/);
  if (jsonStart === -1) {
    throw new Error("Nenhum JSON válido foi retornado pela IA.");
  }

  const openingChar = cleaned[jsonStart];
  const closingChar = openingChar === "[" ? "]" : "}";
  const jsonEnd = cleaned.lastIndexOf(closingChar);

  if (jsonEnd === -1) {
    throw new Error("A resposta da IA foi interrompida antes de terminar.");
  }

  cleaned = cleaned.slice(jsonStart, jsonEnd + 1);

  try {
    return JSON.parse(cleaned);
  } catch {
    return JSON.parse(
      cleaned
        .replace(/,\s*}/g, "}")
        .replace(/,\s*]/g, "]"),
    );
  }
}

function parseStructuredResult(data: any) {
  const choice = data?.choices?.[0];
  const toolArgs = choice?.message?.tool_calls?.[0]?.function?.arguments;

  if (typeof toolArgs === "string" && toolArgs.trim()) {
    try {
      return JSON.parse(toolArgs);
    } catch {
      return extractJsonFromText(toolArgs);
    }
  }

  const content = choice?.message?.content;
  if (typeof content === "string" && content.trim()) {
    return extractJsonFromText(content);
  }

  if (choice?.finish_reason === "length") {
    throw new Error("A resposta da IA foi interrompida antes de terminar.");
  }

  throw new Error("Resposta IA inválida");
}

// ============================================================
// Helper reutilizável: busca anúncios públicos reais (link_anuncio)
// Usado por buscar_proprietario e sugestoes_canal para garantir
// que TODA busca de proprietário retorne link de referência.
// ============================================================
type QuickAd = {
  url: string;
  title: string;
  description: string;
  portal: string;
  match_type?: "exact" | "partial" | "fallback";
  similarity?: number; // 0..1 vs nome_predio
  source?: "allowlist" | "open_search"; // origem da busca (com site: ou sem)
};

// Tokeniza removendo acentos, stopwords e termos curtos.
function tokenizePredio(s: string): string[] {
  const STOP = new Set(["de","da","do","das","dos","e","a","o","edificio","edifício","ed","residencial","res","cond","condominio","condomínio"]);
  return String(s || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/).filter((t) => t.length >= 3 && !STOP.has(t));
}

function computeSimilarity(nomePredio: string, ad: { title: string; description: string }): number {
  const target = tokenizePredio(nomePredio);
  if (!target.length) return 0;
  const hay = `${ad.title} ${ad.description}`
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const hits = target.filter((t) => hay.includes(t)).length;
  return hits / target.length;
}

async function firecrawlSearchOnce(query: string, apiKey: string): Promise<{ items: any[]; error: string | null }> {
  try {
    const r = await fetch("https://api.firecrawl.dev/v2/search", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, limit: 15, lang: "pt", country: "br", tbs: "qdr:y" }),
    });
    if (!r.ok) {
      const text = await r.text();
      return { items: [], error: `Firecrawl ${r.status}: ${text.slice(0, 200)}` };
    }
    const j = await r.json();
    const items = Array.isArray(j?.data) ? j.data : (Array.isArray(j?.web) ? j.web : []);
    return { items, error: null };
  } catch (e) {
    return { items: [], error: `Firecrawl erro: ${String(e).slice(0, 200)}` };
  }
}

function parseAds(items: any[], portais: string[]): QuickAd[] {
  const AD_PATH_HINT = /\/(imovel|imoveis|anuncio|anuncios|detalhe|apartamento|casa|prop|listing|property|residencial|comercial|terreno|kitnet|sobrado|cobertura|flat|sala|loja|galpao)([-_/]|\?)/i;
  const AD_ID_HINT = /[-_/](\d{5,})(?:$|[/?#])/;
  const unwrap = (raw: string) => {
    try {
      const u = new URL(raw);
      if (/(^|\.)google\./i.test(u.hostname) && u.pathname === "/url") {
        return u.searchParams.get("q") || u.searchParams.get("url") || raw;
      }
      return raw;
    } catch { return raw; }
  };
  const clean = (raw: string) => {
    try {
      const u = new URL(raw);
      ["utm_source","utm_medium","utm_campaign","utm_term","utm_content","gclid","fbclid"].forEach((k) => u.searchParams.delete(k));
      u.hash = "";
      return u.toString();
    } catch { return raw; }
  };
  const ads: QuickAd[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    const url = clean(unwrap(String(it?.url || it?.link || "")));
    if (!/^https?:\/\//i.test(url)) continue;
    try {
      const path = new URL(url).pathname || "/";
      if (path === "/" || !(AD_PATH_HINT.test(path) || AD_ID_HINT.test(path))) continue;
    } catch { continue; }
    if (seen.has(url)) continue;
    seen.add(url);
    const portal = portais.find((p) => url.includes(p)) || (() => {
      try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "portal"; }
    })();
    ads.push({
      url,
      title: String(it?.title || "").slice(0, 200),
      description: String(it?.description || it?.snippet || "").slice(0, 400),
      portal,
    });
  }
  return ads;
}

// ============================================================
// Allowlist dinâmico gerenciado via UI (tabela captacao_portais_allowlist)
// Cacheado em memória por 60s para evitar consulta em toda chamada.
// ============================================================
const ALLOWLIST_FALLBACK = [
  "zapimoveis.com.br","vivareal.com.br","olx.com.br","quintoandar.com.br",
  "imovelweb.com.br","chavesnamao.com.br","mercadolivre.com.br",
  "dfimoveis.com.br","wimoveis.com.br","brasiliaimoveis.com.br","imovelguide.com.br",
  "netimoveis.com.br","simovel.com.br","62imoveis.com.br","mgfimoveis.com.br",
  "casamineira.com.br","trovit.com.br","imoveis.trovit.com.br","properati.com.br",
  "buscaimoveis.com.br","imovelk.com.br","apolar.com.br","lopes.com.br",
  "creci.org.br",
];
let _allowlistCache: { list: string[]; ts: number } | null = null;
async function loadAllowlist(): Promise<string[]> {
  const now = Date.now();
  if (_allowlistCache && now - _allowlistCache.ts < 60_000) return _allowlistCache.list;
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return ALLOWLIST_FALLBACK;
    const sb = createClient(url, key);
    const { data, error } = await sb
      .from("captacao_portais_allowlist")
      .select("dominio")
      .eq("ativo", true);
    if (error || !Array.isArray(data) || data.length === 0) {
      return ALLOWLIST_FALLBACK;
    }
    const list = data.map((r: any) => String(r.dominio || "").trim().toLowerCase()).filter(Boolean);
    _allowlistCache = { list, ts: now };
    return list;
  } catch (_) {
    return ALLOWLIST_FALLBACK;
  }
}


async function fetchPublicAdsQuick(opts: {
  bairro?: string; cidade?: string; estado?: string;
  tipo_imovel?: string; operacao?: string; nome_predio?: string;
}): Promise<{
  ads: QuickAd[];
  error: string | null;
  match_type: "exact" | "partial" | "fallback" | "none";
  fallback_used: boolean;
  suggestions: QuickAd[];
}> {
  const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
  if (!FIRECRAWL_API_KEY) {
    return {
      ads: [], suggestions: [], match_type: "none", fallback_used: false,
      error: "FIRECRAWL_API_KEY não configurada — links de referência indisponíveis.",
    };
  }
  const portais = await loadAllowlist();
  const opTerm = (opts.operacao || "").toLowerCase().includes("loca") ? "aluguel" : "venda";
  const buildQuery = (predioTerm: string, opts_: { withSiteFilter?: boolean } = {}) => {
    const withSite = opts_.withSiteFilter !== false;
    const termos = [
      predioTerm,
      opts.tipo_imovel && opts.tipo_imovel !== "Todos" ? opts.tipo_imovel : "",
      opTerm,
      opts.bairro || "",
      opts.cidade || "",
      opts.estado || "",
    ].filter(Boolean).join(" ");
    if (!withSite) return termos.trim();
    return `${termos} (${portais.map((p) => `site:${p}`).join(" OR ")})`.trim();
  };

  // === Variações automáticas para aumentar recall quando a primeira query vier vazia ===
  // Ex.: "condomínio X", "setor Y", "cidade DF", "só o nome do prédio", etc.
  const buildVariants = (): { tag: string; query: string }[] => {
    const variants: { tag: string; query: string }[] = [];
    const predio = (opts.nome_predio || "").trim();
    const bairro = (opts.bairro || "").trim();
    const cidade = (opts.cidade || "").trim();
    const estado = (opts.estado || "").trim();
    const tipo = opts.tipo_imovel && opts.tipo_imovel !== "Todos" ? opts.tipo_imovel : "";
    const siteFilter = `(${portais.map((p) => `site:${p}`).join(" OR ")})`;
    const push = (tag: string, parts: string[], withSite = true) => {
      const q = parts.filter(Boolean).join(" ").trim();
      if (!q) return;
      variants.push({ tag, query: withSite ? `${q} ${siteFilter}` : q });
    };
    if (predio) {
      push("predio+condominio", [`"${predio}"`, "condomínio", opTerm, cidade]);
      push("predio+edificio", [`"${predio}"`, "edifício", opTerm, cidade]);
      push("predio+só", [`"${predio}"`, opTerm], false);
      push("predio+cidade-estado", [`"${predio}"`, cidade, estado]);
    }
    if (bairro) {
      push("setor+bairro", ["setor", bairro, tipo, opTerm, cidade]);
      push("bairro+estado", [bairro, tipo, opTerm, cidade, estado]);
      push("bairro-df", [bairro, tipo, opTerm, cidade, "df"], false);
    }
    if (cidade) {
      push("cidade-uf-open", [tipo, opTerm, cidade, estado].filter(Boolean), false);
    }
    // dedup por query
    const seen = new Set<string>();
    return variants.filter((v) => {
      const k = v.query.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  };

  const runVariants = async (): Promise<QuickAd[]> => {
    const variants = buildVariants();
    const out: QuickAd[] = [];
    for (const v of variants) {
      const r = await firecrawlSearchOnce(v.query, FIRECRAWL_API_KEY);
      if (r.error) error = r.error || error;
      const isOpen = !v.query.includes("site:");
      const parsed = parseAds(r.items, portais)
        .map((a) => ({ ...a, source: (isOpen ? "open_search" : "allowlist") as "open_search" | "allowlist" }));
      out.push(...parsed);
      if (out.length >= 20) break; // suficiente para ranquear
    }
    // dedup por url
    const seen = new Set<string>();
    return out.filter((a) => {
      if (!a.url || seen.has(a.url)) return false;
      seen.add(a.url);
      return true;
    });
  };

  const hasPredio = !!(opts.nome_predio && opts.nome_predio.trim());

  // === PASS 1: match estrito com aspas ===
  const strictTerm = hasPredio ? `"${opts.nome_predio}"` : "";
  const p1 = await firecrawlSearchOnce(buildQuery(strictTerm), FIRECRAWL_API_KEY);
  let error = p1.error;
  let ads = parseAds(p1.items, portais).map((a) => ({ ...a, source: "allowlist" as const }));

  if (ads.length > 0) {
    if (hasPredio) {
      ads = ads.map((a) => ({ ...a, match_type: "exact" as const, similarity: computeSimilarity(opts.nome_predio!, a) }));
    }
    return { ads: ads.slice(0, 12), error, match_type: hasPredio ? "exact" : "fallback", fallback_used: false, suggestions: [] };
  }
  // === PASS 1b: match estrito, busca ABERTA (sem site:) — captura portais fora do allowlist ===
  if (hasPredio) {
    const p1open = await firecrawlSearchOnce(buildQuery(strictTerm, { withSiteFilter: false }), FIRECRAWL_API_KEY);
    error = p1open.error || error;
    const openAds = parseAds(p1open.items, portais)
      .map((a) => ({ ...a, similarity: computeSimilarity(opts.nome_predio!, a), source: "open_search" as const }))
      .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));
    const exactOpen = openAds.filter((a) => (a.similarity ?? 0) >= 0.7)
      .map((a) => ({ ...a, match_type: "exact" as const }));
    if (exactOpen.length > 0) {
      return { ads: exactOpen.slice(0, 12), error, match_type: "exact", fallback_used: false, suggestions: [] };
    }
  }

  // === FALLBACK: sem aspas (partial match) — só faz sentido quando nome_predio foi informado ===
  if (hasPredio) {
    // Passo 2a: allowlist sem aspas
    const p2 = await firecrawlSearchOnce(buildQuery(opts.nome_predio!), FIRECRAWL_API_KEY);
    error = p2.error || error;
    // Passo 2b: busca aberta sem aspas — combina resultados
    const p2open = await firecrawlSearchOnce(buildQuery(opts.nome_predio!, { withSiteFilter: false }), FIRECRAWL_API_KEY);
    error = p2open.error || error;
    const p2Ads = parseAds(p2.items, portais).map((a) => ({ ...a, source: "allowlist" as const }));
    const p2OpenAds = parseAds(p2open.items, portais).map((a) => ({ ...a, source: "open_search" as const }));
    const parsed = [...p2Ads, ...p2OpenAds]
      .map((a) => ({ ...a, similarity: computeSimilarity(opts.nome_predio!, a) }))
      .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));

    // Considera "partial" quando similaridade >= 0.5 (metade dos tokens do prédio aparecem)
    const partial = parsed.filter((a) => (a.similarity ?? 0) >= 0.5)
      .map((a) => ({ ...a, match_type: "partial" as const }));

    if (partial.length > 0) {
      return {
        ads: partial.slice(0, 12),
        error,
        match_type: "partial",
        fallback_used: true,
        suggestions: [],
      };
    }

    // === ÚLTIMO RECURSO: sugestões (mesmo sem match do prédio, preserva link_anuncio do bairro) ===
    const suggestions = parsed.slice(0, 6).map((a) => ({ ...a, match_type: "fallback" as const }));
    if (suggestions.length > 0) {
      return {
        ads: [],
        error,
        match_type: "fallback",
        fallback_used: true,
        suggestions,
      };
    }

    // === PASS 3: query genérica (sem prédio) — última tentativa de manter link_anuncio ===
    const p3 = await firecrawlSearchOnce(buildQuery(""), FIRECRAWL_API_KEY);
    error = p3.error || error;
    const generic = parseAds(p3.items, portais)
      .map((a) => ({ ...a, match_type: "fallback" as const, similarity: computeSimilarity(opts.nome_predio!, a), source: "allowlist" as const }));

    // === PASS 4: variações automáticas de consulta (condomínio, setor, cidade+DF, etc.) ===
    const variantAds = await runVariants();
    const variantScored = variantAds
      .map((a) => ({ ...a, similarity: computeSimilarity(opts.nome_predio!, a) }))
      .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));
    const variantPartial = variantScored.filter((a) => (a.similarity ?? 0) >= 0.5)
      .map((a) => ({ ...a, match_type: "partial" as const }));
    if (variantPartial.length > 0) {
      return {
        ads: variantPartial.slice(0, 12), error,
        match_type: "partial", fallback_used: true, suggestions: [],
      };
    }
    const variantSuggestions = variantScored.slice(0, 6)
      .map((a) => ({ ...a, match_type: "fallback" as const }));

    const combinedSuggestions = [...generic, ...variantSuggestions].slice(0, 6);
    return {
      ads: [], error,
      match_type: combinedSuggestions.length ? "fallback" : "none",
      fallback_used: true,
      suggestions: combinedSuggestions,
    };
  }

  // === Sem nome_predio: se PASS 1 vazio, tenta variações por bairro/cidade ===
  const variantAds = await runVariants();
  if (variantAds.length > 0) {
    return {
      ads: variantAds.slice(0, 12).map((a) => ({ ...a, match_type: "fallback" as const })),
      error, match_type: "fallback", fallback_used: true, suggestions: [],
    };
  }

  return { ads: [], error, match_type: "none", fallback_used: false, suggestions: [] };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const errorResponse = (msg: string, status: number) =>
    new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const successResponse = (data: any) =>
    new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return errorResponse("Não autorizado", 401);
    }

    const sbUrl = Deno.env.get("SUPABASE_URL");
    const sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!sbUrl || !sbKey) {
      return errorResponse("Configuração do backend incompleta.", 500);
    }

    const sbAdmin = createClient(sbUrl, sbKey);
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user: aiUser },
      error: authError,
    } = await sbAdmin.auth.getUser(token);

    if (authError || !aiUser) {
      return errorResponse("Não autorizado", 401);
    }

    const _iaGate = await requireUserAi(sbAdmin, aiUser.id, corsHeaders);
    if (_iaGate.response) return _iaGate.response;

    const body = await req.json();
    const action = typeof body?.action === "string" ? body.action : "";
    const params = body?.params ?? {};

    if (!action) {
      return errorResponse("Ação inválida", 400);
    }

    const { error: usageLogError } = await sbAdmin
      .from("ai_usage_log")
      .insert({ user_id: aiUser.id, function_name: "captacao-inteligente" });

    if (usageLogError) {
      console.error("captacao-inteligente usage log error:", usageLogError);
    }

    const TIPOS_IMOVEL = [
      "Apartamento", "Casa", "Cobertura", "Kitnet/Studio", "Loft",
      "Terreno", "Lote", "Chácara", "Fazenda",
      "Sala Comercial", "Loja", "Galpão", "Prédio Comercial",
      "Flat/Apart-Hotel", "Casa de Condomínio", "Sobrado",
    ];

    // Build a JSON-schema hint string from the tool's parameters shape (used to guide the user's own AI provider)
    const describeSchema = (params: any): string => {
      try { return JSON.stringify(params, null, 2); } catch { return ""; }
    };

    const aiCall = async (messages: any[], tools: any[], toolChoice: any) => {
      const toolName = toolChoice?.function?.name || tools?.[0]?.function?.name;
      const targetTool = tools.find((t: any) => t?.function?.name === toolName) || tools[0];
      const schemaText = targetTool?.function?.parameters ? describeSchema(targetTool.function.parameters) : "";

      // Merge system + user messages into a single userPrompt with an explicit JSON schema instruction.
      const systemMessages = messages.filter((m: any) => m.role === "system").map((m: any) => m.content).join("\n\n");
      const userMessages = messages.filter((m: any) => m.role !== "system").map((m: any) => m.content).join("\n\n");

      const jsonPrompt = `${userMessages}

Retorne EXCLUSIVAMENTE um JSON válido (sem markdown, sem texto fora do JSON) obedecendo ESTE JSON Schema:
${schemaText}`;

      const res = await callUserAi(_iaGate.config, {
        systemPrompt: systemMessages || undefined,
        userPrompt: jsonPrompt,
        wantJson: true,
        temperature: 0.2,
      });

      if (!res.ok) {
        const payload = mapAiErrorPayload(res);
        console.error(`[captacao-inteligente] Falha na IA action=${action} code=${res.code} status=${res.status} raw=${res.error}`);
        return { aiError: new Response(JSON.stringify(payload), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }) };
      }
      const parsed = tryParseJson(res.text);
      if (!parsed) {
        return { aiError: new Response(JSON.stringify({ success: false, error_code: "unknown_error", message: "A IA não retornou um JSON válido. Tente novamente.", error: "A IA não retornou um JSON válido. Tente novamente." }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }) };
      }
      return { result: parsed };
    };

    if (action === "buscar_oportunidades") {
      const { bairro, cidade, estado, tipo_imovel, operacao, faixa_preco, apenas_proprietarios, nome_predio, batch_id, ra_nome, batch_index, batch_total } = params;

      // === HISTÓRICO DE EXECUÇÃO: cria registro "executando" ===
      const execStart = Date.now();
      let execId: string | null = null;
      let execImobiliariaId: string | null = null;
      try {
        const { data: ma } = await sbAdmin
          .from("master_autorizacoes")
          .select("master_id")
          .eq("user_id", aiUser.id)
          .eq("ativo", true)
          .maybeSingle();
        execImobiliariaId = (ma?.master_id as string) || aiUser.id;
        const { data: execRow } = await sbAdmin
          .from("captacao_execucoes_historico")
          .insert({
            imobiliaria_id: execImobiliariaId,
            user_id: aiUser.id,
            action,
            cidades_alvo: [cidade, estado].filter(Boolean),
            parametros: { bairro, cidade, estado, tipo_imovel, operacao, faixa_preco, apenas_proprietarios, nome_predio, batch_id: batch_id ?? null, ra_nome: ra_nome ?? bairro ?? null, batch_index: batch_index ?? null, batch_total: batch_total ?? null },
            status: "executando",
          })
          .select("id")
          .single();
        execId = (execRow?.id as string) ?? null;
      } catch (e) {
        console.warn("[captacao-inteligente] failed to create exec history row:", String(e).slice(0, 200));
      }

      const finalizeExec = async (
        status: "sucesso" | "falha" | "concluido_com_erros" | "parcial",
        extras: { resultados_encontrados?: number; itens_processados?: number; portais_consultados?: string[]; erro?: string | null } = {},
      ) => {
        if (!execId) return;
        try {
          await sbAdmin
            .from("captacao_execucoes_historico")
            .update({
              status,
              resultados_encontrados: extras.resultados_encontrados ?? 0,
              itens_processados: extras.itens_processados ?? 0,
              portais_consultados: extras.portais_consultados ?? [],
              erro: extras.erro ?? null,
              duracao_ms: Date.now() - execStart,
              finalizado_em: new Date().toISOString(),
            })
            .eq("id", execId);
        } catch (e) {
          console.warn("[captacao-inteligente] failed to finalize exec history:", String(e).slice(0, 200));
        }
      };


      // === ETAPA 1: buscar anúncios REAIS em portais públicos via Firecrawl (LGPD-safe: dados públicos) ===
      const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
      // Portais imobiliários públicos cobrindo Brasília (Plano Piloto) e cidades satélites do DF
      // (Taguatinga, Ceilândia, Águas Claras, Guará, Sobradinho, Gama, Samambaia, Riacho Fundo,
      // Recanto das Emas, Núcleo Bandeirante, Cruzeiro, Lago Sul/Norte, Sudoeste, Noroeste,
      // Vicente Pires, Park Way, Jardim Botânico, São Sebastião, Planaltina, Brazlândia,
      // Paranoá, Itapoã, Santa Maria, Candangolândia, Estrutural).
      const portais = [
        // Nacionais de grande cobertura
        "zapimoveis.com.br",
        "vivareal.com.br",
        "olx.com.br",
        "quintoandar.com.br",
        "imovelweb.com.br",
        "chavesnamao.com.br",
        "netimoveis.com.br",
        "imovelguide.com.br",
        "lugarcerto.com.br",
        "moradaweb.com.br",
        "123i.com.br",
        "alude.com.br",
        "casamineira.com.br",
        "mercadolivre.com.br",
        // Específicos / fortes no DF e satélites
        "dfimoveis.com.br",
        "wimoveis.com.br",
        "brasiliaimoveis.com.br",
        "classificados.correiobraziliense.com.br",
        "portalcorretor.com.br",
        "imoveisbrasilia.com.br",
        "casanovadf.com.br",
      ];
      const cidadesSateletesCobertas = [
        "Brasília","Plano Piloto","Águas Claras","Taguatinga","Ceilândia","Guará","Samambaia",
        "Sobradinho","Sobradinho II","Gama","Recanto das Emas","Riacho Fundo","Riacho Fundo II",
        "Núcleo Bandeirante","Cruzeiro","Lago Sul","Lago Norte","Sudoeste","Noroeste",
        "Vicente Pires","Park Way","Jardim Botânico","São Sebastião","Planaltina","Brazlândia",
        "Paranoá","Itapoã","Santa Maria","Candangolândia","Estrutural","Arniqueira","Octogonal",
      ];
      const opTerm = (operacao || "").toLowerCase().includes("loca") ? "aluguel" : "venda";
      const termos = [
        tipo_imovel && tipo_imovel !== "Todos" ? tipo_imovel : "",
        opTerm,
        bairro || "",
        cidade || "",
        estado || "",
        nome_predio ? `"${nome_predio}"` : "",
      ].filter(Boolean).join(" ");
      // Divide os portais em lotes para evitar query grande demais no Google/Firecrawl
      const portalBatches: string[][] = [];
      const BATCH_SIZE = 8;
      for (let i = 0; i < portais.length; i += BATCH_SIZE) {
        portalBatches.push(portais.slice(i, i + BATCH_SIZE));
      }
      const buildQuery = (batch: string[]) => `${termos} (${batch.map((p) => `site:${p}`).join(" OR ")})`.trim();

      type PublicAd = {
        url: string;
        title: string;
        description: string;
        portal: string;
        idade_estimada_dias?: number; // >=30 quando ausente da janela recente
        tempo_mercado_label?: "recente" | "medio" | "prolongado";
        sinais_dificuldade?: string[]; // "preço reduzido", "aceita proposta", etc.
      };
      const publicAds: PublicAd[] = [];
      let firecrawlError: string | null = null;
      let cacheStatus: "hit" | "miss" | "disabled" = "miss";

      // === CACHE 24h: chave normalizada por cidade+bairro+tipo+operacao (+nome_predio quando informado) ===
      // IMPORTANTE: buscas com nome_predio (prédio/condomínio específico) ou CEP resolvido
      // DEVEM ter chave própria — do contrário o cache genérico do bairro é reutilizado e
      // a IA não encontra o link_anuncio real do prédio pedido.
      const norm = (s: any) => String(s || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const cacheKey = [norm(cidade), norm(bairro), norm(tipo_imovel), opTerm, norm(nome_predio)].filter(Boolean).join("|");

      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      );

      // 1) tenta ler do cache
      try {
        const { data: cached } = await supabaseAdmin
          .from("firecrawl_captacao_cache")
          .select("payload, expires_at")
          .eq("cache_key", cacheKey)
          .gt("expires_at", new Date().toISOString())
          .maybeSingle();
        if (cached?.payload?.ads && Array.isArray(cached.payload.ads)) {
          publicAds.push(...cached.payload.ads);
          cacheStatus = "hit";
          // incrementa hits (best-effort)
          supabaseAdmin.rpc("increment_firecrawl_cache_hit", { p_cache_key: cacheKey })
            .then(() => {}, () => {});
        }
      } catch (e) {
        console.warn("[captacao-inteligente] cache read error:", String(e).slice(0, 200));
      }

      const queriesExecutadas: { query: string; google_url: string; portais: string[] }[] = [];
      if (cacheStatus !== "hit" && FIRECRAWL_API_KEY) {
        try {
          // Duas passadas: (A) ampla=qdr:y para capturar anúncios ANTIGOS/prolongados
          //                (B) recente=qdr:w para saber quais URLs estão "frescos" no índice
          // Anúncio presente só em A e ausente em B => provavelmente ONLINE HÁ >7 DIAS (prolongado).
          const passes: { tag: "ampla" | "recente"; tbs: string }[] = [
            { tag: "ampla", tbs: "qdr:y" },
            { tag: "recente", tbs: "qdr:w" },
          ];
          const seenUrls = new Set<string>();
          const recentUrls = new Set<string>();
          const allBatchCalls: Promise<any>[] = [];
          // Query dedicada por nome do prédio (obriga o Firecrawl a devolver anúncios do imóvel exato)
          const buildQueryPredio = (batch: string[]) =>
            `"${nome_predio}" ${opTerm} ${bairro || ""} ${cidade || ""} (${batch.map((p) => `site:${p}`).join(" OR ")})`.trim();
          const queryBuilders: ((batch: string[]) => string)[] = nome_predio
            ? [buildQueryPredio, buildQuery]
            : [buildQuery];
          for (const p of passes) {
            for (const buildQ of queryBuilders) {
              for (const batch of portalBatches) {
                const q = buildQ(batch);
                queriesExecutadas.push({
                  query: `[${p.tag}] ${q}`,
                  google_url: `https://www.google.com/search?q=${encodeURIComponent(q)}&tbs=${encodeURIComponent(p.tbs)}`,
                  portais: batch,
                });
              allBatchCalls.push(
                fetch("https://api.firecrawl.dev/v2/search", {
                  method: "POST",
                  headers: {
                    "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    query: q,
                    limit: 10,
                    lang: "pt",
                    country: "br",
                    tbs: p.tbs,
                  }),
                })
                  .then(async (r) => ({ pass: p.tag, ok: r.ok, status: r.status, json: r.ok ? await r.json() : null, text: r.ok ? null : await r.text() }))
                  .catch((e) => ({ pass: p.tag, ok: false, status: 0, json: null, text: String(e).slice(0, 200) })),
              );
              }
            }
          }
          const batchResults = await Promise.allSettled(allBatchCalls);
          // Utilitários de sanitização de URL — evitam salvar links que caem em 404
          const unwrapGoogleRedirect = (raw: string): string => {
            try {
              const u = new URL(raw);
              if (/(^|\.)google\./i.test(u.hostname) && u.pathname === "/url") {
                const inner = u.searchParams.get("q") || u.searchParams.get("url");
                if (inner) return inner;
              }
              return raw;
            } catch { return raw; }
          };
          const cleanTracking = (raw: string): string => {
            try {
              const u = new URL(raw);
              const junk = ["utm_source","utm_medium","utm_campaign","utm_term","utm_content","gclid","fbclid","mc_cid","mc_eid","_ga"];
              junk.forEach((k) => u.searchParams.delete(k));
              u.hash = "";
              return u.toString();
            } catch { return raw; }
          };
          // Um URL é considerado "anúncio individual" apenas se tiver caminho relevante
          // (portais listam ads em /imovel/, /imoveis/, /anuncio/, /detalhe/, /prop-<id>, etc.)
          const AD_PATH_HINT = /\/(imovel|imoveis|imovel-para|anuncio|anuncios|detalhe|detalhes|apartamento|casa|prop|listing|property|realestate|residencial|comercial|terreno|kitnet|sobrado|cobertura|flat|sala|loja|galpao|chacara|fazenda)([-_/]|\?)/i;
          // ID numérico longo no final é forte indício de página de anúncio
          const AD_ID_HINT = /[-_/](\d{5,})(?:$|[/?#])/;
          const isLikelyAdUrl = (raw: string): boolean => {
            try {
              const u = new URL(raw);
              const path = u.pathname || "/";
              if (path === "/" || path === "") return false;
              if (/\/(busca|buscar|search|resultado|resultados|categoria|blog|artigo|noticia|noticias|sobre|contato|ajuda|termos|privacidade|politica|financiamento|simulador|calculadora|corretores|imobiliarias|anunciar)(\/|$|\?)/i.test(path)) return false;
              return AD_PATH_HINT.test(path) || AD_ID_HINT.test(path);
            } catch { return false; }
          };

          // Padrões textuais que sinalizam dificuldade de venda / anunciante motivado
          const dificuldadePatterns: { rx: RegExp; label: string }[] = [
            { rx: /pre[çc]o\s+(reduzido|abaixado|baixou|novo|especial)|abaixamos|reduzimos|de\s+r?\$?\s*[\d.]+\s+por\s+r?\$?\s*[\d.]+/i, label: "preço reduzido" },
            { rx: /aceita\s+(proposta|permuta|financiamento|fgts)/i, label: "aceita proposta/permuta" },
            { rx: /urg[êe]nte|precisa\s+vender|liquidar|desocupado|vazio|pronto\s+para\s+morar/i, label: "urgência" },
            { rx: /oportunidade|abaixo\s+do\s+mercado|barganha|imperd[íi]vel/i, label: "abaixo do mercado" },
            { rx: /direto\s+com\s+propriet[áa]rio|sem\s+imobili[áa]ria|sem\s+corretor|dono\s+vende/i, label: "proprietário direto" },
          ];

          for (const brWrap of batchResults) {
            if (brWrap.status !== "fulfilled") continue;
            const br: any = brWrap.value;
            if (!br?.ok || !br?.json) {
              if (br && !br.ok) {
                firecrawlError = `Firecrawl [${br.pass}] ${br.status}: ${(br.text || "").slice(0, 200)}`;
                console.error("[captacao-inteligente]", firecrawlError);
              }
              continue;
            }
            const passTag: "ampla" | "recente" = br.pass;
            const fcJson = br.json;
            const items = Array.isArray(fcJson?.data) ? fcJson.data : (Array.isArray(fcJson?.web) ? fcJson.web : []);
            for (const it of items) {
              let url: string = it?.url || it?.link || "";
              if (!url) continue;
              url = cleanTracking(unwrapGoogleRedirect(url));
              if (!/^https?:\/\//i.test(url)) continue;
              if (!isLikelyAdUrl(url)) continue;
              if (passTag === "recente") recentUrls.add(url);
              if (seenUrls.has(url)) continue;
              seenUrls.add(url);
              const portal = portais.find((p) => url.includes(p)) || (() => {
                try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "portal"; }
              })();
              const title = String(it?.title || "").slice(0, 200);
              const description = String(it?.description || it?.snippet || "").slice(0, 400);
              const haystack = `${title}\n${description}`;
              const sinais = dificuldadePatterns.filter((p) => p.rx.test(haystack)).map((p) => p.label);
              publicAds.push({ url, title, description, portal, sinais_dificuldade: sinais });
            }
          }
          // Classifica idade: presente em "recente" => <=7d; ausente => >=30d (prolongado)
          for (const ad of publicAds) {
            if (recentUrls.has(ad.url)) {
              ad.idade_estimada_dias = 7;
              ad.tempo_mercado_label = "recente";
            } else {
              ad.idade_estimada_dias = 45; // conservador: entre 30 e 60d
              ad.tempo_mercado_label = "prolongado";
            }
          }
          // Ordena: prolongados primeiro, depois com sinais de dificuldade
          publicAds.sort((a, b) => {
            const ageA = a.idade_estimada_dias || 0;
            const ageB = b.idade_estimada_dias || 0;
            if (ageB !== ageA) return ageB - ageA;
            return (b.sinais_dificuldade?.length || 0) - (a.sinais_dificuldade?.length || 0);
          });
          // grava no cache (upsert) se houver resultados
          if (publicAds.length > 0) {
            try {
              await supabaseAdmin
                .from("firecrawl_captacao_cache")
                .upsert({
                  cache_key: cacheKey,
                  cidade: cidade || null,
                  bairro: bairro || null,
                  tipo_imovel: tipo_imovel || null,
                  operacao: opTerm,
                  payload: { ads: publicAds },
                  expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                  hits: 0,
                }, { onConflict: "cache_key" });
            } catch (e) {
              console.warn("[captacao-inteligente] cache write error:", String(e).slice(0, 200));
            }
          }
        } catch (e) {
          firecrawlError = `Firecrawl fetch error: ${String(e).slice(0, 200)}`;
          console.error("[captacao-inteligente]", firecrawlError);
        }
      } else if (cacheStatus !== "hit" && !FIRECRAWL_API_KEY) {
        firecrawlError = "FIRECRAWL_API_KEY não configurada — retornando apenas análise IA sem link real.";
        cacheStatus = "disabled";
        console.warn("[captacao-inteligente]", firecrawlError);
      }

      const filtroProprietario = apenas_proprietarios
        ? "\n- IMPORTANTE: Priorize apenas anúncios em que o anunciante seja PROPRIETÁRIO DIRETO (não imobiliária/corretor). Marque tipo_anunciante = 'proprietario'."
        : "";

      const filtroPredio = nome_predio
        ? `\n- Nome do Prédio/Condomínio: "${nome_predio}".`
        : "";

      const anunciosBloco = publicAds.length > 0
        ? `\n\nANÚNCIOS PÚBLICOS REAIS ENCONTRADOS (use estes exatos link_anuncio, nunca invente URLs):\n${publicAds.map((a, i) => {
            const tag = a.tempo_mercado_label === "prolongado" ? "🔥 PROLONGADO (~45d+)" : "⏱ recente (<=7d)";
            const sig = a.sinais_dificuldade && a.sinais_dificuldade.length ? ` [sinais: ${a.sinais_dificuldade.join(", ")}]` : "";
            return `#${i + 1} [${a.portal}] ${tag}${sig} ${a.title}\nURL: ${a.url}\n${a.description}`;
          }).join("\n\n")}`
        : "\n\n(Nenhum anúncio público real foi encontrado — retorne no máximo 6 sugestões de captação SEM link_anuncio, deixando o campo vazio.)";

      const prompt = `Você é um consultor imobiliário especialista em ${cidade || "Brasília"}, ${estado || "DF"}.

Analise o mercado imobiliário e gere uma lista de oportunidades de captação para a região com base APENAS em dados públicos (anúncios em portais).

Parâmetros de busca:
- Bairro/Região: ${bairro || "Todos"}
- Tipo de imóvel: ${tipo_imovel || "Todos"}
- Operação: ${operacao || "Venda e Locação"}
- Faixa de preço: ${faixa_preco || "Todas"}${filtroProprietario}${filtroPredio}
${anunciosBloco}

REGRAS OBRIGATÓRIAS:
1. Para cada oportunidade que corresponda a um anúncio real acima, use EXATAMENTE a URL fornecida no campo "link_anuncio". Nunca invente URLs.
2. Se nenhum anúncio real corresponder, deixe link_anuncio como string vazia ("") — NÃO fabrique links.
3. Extraia bairro, tipo, preço e área a partir do título/descrição do anúncio. Se ausente, estime com base em mercado e marque motivo_oportunidade indicando que é estimativa.
4. Varie canais sugeridos (porteiro, construtor, construtora, sindico, portal, indicacao).
5. Identifique tipo_anunciante analisando o texto do anúncio (proprietário direto vs imobiliária).
6. PRIORIZE ABSOLUTAMENTE anúncios marcados 🔥 PROLONGADO ou com sinais de dificuldade (preço reduzido, aceita proposta, urgência) — proprietários com anúncio há mais de 30 dias são os leads QUENTES desta busca. Boost de +15 no score_oportunidade para prolongados; +10 adicional se houver sinais de dificuldade.
7. Copie tempo_mercado_label, idade_estimada_dias e sinais_dificuldade EXATAMENTE do anúncio correspondente.
8. Retorne no máximo 12 oportunidades priorizando: (a) prolongados com sinais, (b) prolongados, (c) recentes com sinais, (d) recentes.`;

      const res = await aiCall(
        [
          { role: "system", content: "Responda APENAS via tool call. Nunca invente URLs — use somente as fornecidas ou string vazia." },
          { role: "user", content: prompt },
        ],
        [{
          type: "function",
          function: {
            name: "listar_oportunidades",
            description: "Lista oportunidades de captação imobiliária a partir de anúncios públicos reais",
            parameters: {
              type: "object",
              properties: {
                oportunidades: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      titulo: { type: "string", description: "Título descritivo do imóvel" },
                      endereco: { type: "string", description: "Endereço (bairro/quadra público, sem dado sensível)" },
                      bairro: { type: "string" },
                      tipo_imovel: { type: "string", enum: TIPOS_IMOVEL },
                      operacao: { type: "string", enum: ["Venda", "Locação"] },
                      preco_estimado: { type: "number" },
                      area_estimada: { type: "number" },
                      quartos: { type: "number" },
                      score_oportunidade: { type: "number" },
                      motivo_oportunidade: { type: "string" },
                      canal_sugerido: { type: "string", enum: ["porteiro", "construtor", "construtora", "sindico", "portal", "indicacao"] },
                      acao_recomendada: { type: "string" },
                      link_anuncio: { type: "string", description: "URL REAL do anúncio público (obtida do bloco de anúncios) ou string vazia" },
                      tipo_anunciante: { type: "string", enum: ["proprietario", "imobiliaria", "corretor"] },
                      nome_predio: { type: "string" },
                      portal_origem: { type: "string", description: "Nome do portal de origem (ex: zapimoveis.com.br)" },
                      tempo_mercado_label: { type: "string", enum: ["recente", "medio", "prolongado"], description: "Copie do anúncio correspondente" },
                      idade_estimada_dias: { type: "number", description: "Copie do anúncio correspondente" },
                      sinais_dificuldade: { type: "array", items: { type: "string" }, description: "Copie do anúncio correspondente" },
                    },
                    required: ["titulo", "endereco", "bairro", "tipo_imovel", "operacao", "preco_estimado", "area_estimada", "quartos", "score_oportunidade", "motivo_oportunidade", "canal_sugerido", "acao_recomendada", "link_anuncio", "tipo_anunciante"],
                  },
                },
                resumo_mercado: { type: "string" },
                tendencia: { type: "string", enum: ["alta", "estavel", "queda"] },
                melhor_bairro: { type: "string" },
                preco_m2_medio: { type: "number" },
              },
              required: ["oportunidades", "resumo_mercado", "tendencia", "melhor_bairro", "preco_m2_medio"],
            },
          },
        }],
        { type: "function", function: { name: "listar_oportunidades" } },
      );

      if (res.aiError) {
        await finalizeExec("falha", {
          resultados_encontrados: publicAds.length,
          itens_processados: 0,
          portais_consultados: portais,
          erro: "AI error / invalid JSON",
        });
        return res.aiError;
      }

      // Guard: remove qualquer link_anuncio que a IA tenha inventado (não presente na lista real do Firecrawl)
      const realUrls = new Set(publicAds.map((a) => a.url));
      const opsSanitizadas = Array.isArray(res.result?.oportunidades) ? res.result.oportunidades.map((op: any) => {
        if (op?.link_anuncio && !realUrls.has(op.link_anuncio)) {
          op.link_anuncio = "";
        }
        if (op?.link_anuncio) {
          const match = publicAds.find((a) => a.url === op.link_anuncio);
          if (match) {
            if (!op.portal_origem) op.portal_origem = match.portal;
            // sobrescreve com verdade do backend
            op.tempo_mercado_label = match.tempo_mercado_label;
            op.idade_estimada_dias = match.idade_estimada_dias;
            op.sinais_dificuldade = match.sinais_dificuldade || [];
            // Boost de score conforme regra
            if (typeof op.score_oportunidade === "number") {
              if (match.tempo_mercado_label === "prolongado") op.score_oportunidade = Math.min(100, op.score_oportunidade + 15);
              if ((match.sinais_dificuldade?.length || 0) > 0) op.score_oportunidade = Math.min(100, op.score_oportunidade + 10);
            }
          }
        }
        return op;
      }) : [];

      // Distribuição por portal (para painel de transparência)
      const distribuicaoPortais: Record<string, number> = {};
      for (const a of publicAds) {
        distribuicaoPortais[a.portal] = (distribuicaoPortais[a.portal] || 0) + 1;
      }

      const finalStatus: "sucesso" | "concluido_com_erros" | "parcial" =
        firecrawlError ? "concluido_com_erros"
        : publicAds.length === 0 ? "parcial"
        : "sucesso";
      await finalizeExec(finalStatus, {
        resultados_encontrados: publicAds.length,
        itens_processados: opsSanitizadas.length,
        portais_consultados: portais,
        erro: firecrawlError,
      });

      return successResponse({
        ...res.result,
        oportunidades: opsSanitizadas,
        fonte_dados: publicAds.length > 0 ? "anuncios_publicos_firecrawl" : "estimativa_ia",
        total_anuncios_reais: publicAds.length,
        portais_pesquisados: portais,
        distribuicao_portais: distribuicaoPortais,
        cidades_satelites_cobertas: cidadesSateletesCobertas,
        aviso_lgpd:
          "Base legal LGPD (Art. 7º, IV e §4º): tratamento de dados tornados manifestamente públicos pelo próprio titular em portais imobiliários abertos. Coletamos apenas título, URL e portal de origem — nenhum dado pessoal (nome, CPF, telefone, e-mail) do proprietário é armazenado nesta etapa. O contato futuro seguirá princípios de finalidade, adequação, necessidade e transparência.",
        firecrawl_error: firecrawlError,
        cache_status: cacheStatus,
        queries_executadas: queriesExecutadas,
        urls_publicas: publicAds.map((a) => ({ url: a.url, portal: a.portal, title: a.title })),
        execucao_id: execId,
      });

    }


    if (action === "analisar_imovel") {
      const { endereco, bairro, cidade, estado, tipo_imovel, area } = params;

      const prompt = `Analise esta oportunidade de captação imobiliária:
- Endereço: ${endereco}
- Bairro: ${bairro}
- Cidade: ${cidade || "Brasília"}, ${estado || "DF"}
- Tipo: ${tipo_imovel}
- Área: ${area || "Não informada"} m²

Forneça uma análise detalhada do potencial de captação.`;

      const res = await aiCall(
        [
          { role: "system", content: "Você é um consultor imobiliário experiente. Responda APENAS via tool call." },
          { role: "user", content: prompt },
        ],
        [{
          type: "function",
          function: {
            name: "analise_imovel",
            description: "Análise detalhada de oportunidade imobiliária",
            parameters: {
              type: "object",
              properties: {
                score: { type: "number", description: "Score de 0 a 100" },
                preco_estimado_min: { type: "number" },
                preco_estimado_max: { type: "number" },
                preco_m2_regiao: { type: "number" },
                liquidez: { type: "string", enum: ["alta", "media", "baixa"] },
                pontos_fortes: { type: "array", items: { type: "string" } },
                pontos_atencao: { type: "array", items: { type: "string" } },
                estrategia_captacao: { type: "string" },
                tempo_estimado_venda: { type: "string" },
                publico_alvo: { type: "string" },
              },
              required: ["score", "preco_estimado_min", "preco_estimado_max", "preco_m2_regiao", "liquidez", "pontos_fortes", "pontos_atencao", "estrategia_captacao", "tempo_estimado_venda", "publico_alvo"],
            },
          },
        }],
        { type: "function", function: { name: "analise_imovel" } },
      );

      if (res.aiError) return res.aiError;
      return successResponse(res.result);
    }

    if (action === "buscar_proprietario") {
      const { endereco, bairro, cidade, estado, tipo_imovel, nome_predio, operacao } = params;

      const prompt = `Você é um investigador imobiliário especialista em localizar proprietários de imóveis em ${cidade || "Brasília"}, ${estado || "DF"}.

Dados do imóvel alvo:
- Endereço: ${endereco || "Não informado"}
- Bairro: ${bairro || "Não informado"}
- Tipo: ${tipo_imovel || "Não informado"}
- Edifício/Condomínio: ${nome_predio || "Não informado"}
- Operação desejada: ${operacao || "Venda"}

Realize uma investigação minuciosa e forneça:
1. Estratégias detalhadas para localizar o proprietário deste imóvel
2. Canais específicos de investigação (cartório, registro de imóveis, IPTU, síndico, porteiro)
3. Dados públicos que podem ajudar na identificação (matrícula do imóvel, IPTU, etc.)
4. Scripts de abordagem para cada canal (telefone, WhatsApp, presencial)
5. Sinais que indicam se o proprietário tem intenção de vender/alugar
6. Estimativa de dificuldade e tempo para localização
7. Dicas para abordagem persuasiva e ética

Seja realista e detalhado, usando informações específicas da região de ${cidade || "Brasília"}.`;

      const res = await aiCall(
        [
          { role: "system", content: "Você é um especialista em inteligência imobiliária e localização de proprietários. Responda APENAS via tool call com dados detalhados e realistas." },
          { role: "user", content: prompt },
        ],
        [{
          type: "function",
          function: {
            name: "resultado_busca_proprietario",
            description: "Resultado da investigação para localizar o proprietário do imóvel",
            parameters: {
              type: "object",
              properties: {
                probabilidade_sucesso: { type: "number", description: "Probabilidade de encontrar o proprietário (0-100)" },
                tempo_estimado: { type: "string", description: "Tempo estimado para localização (ex: 2-5 dias úteis)" },
                dificuldade: { type: "string", enum: ["baixa", "media", "alta", "muito_alta"] },
                canais_investigacao: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      canal: { type: "string", description: "Nome do canal (ex: Cartório de Registro, Porteiro, Síndico)" },
                      descricao: { type: "string", description: "Como utilizar este canal" },
                      custo_estimado: { type: "string", description: "Custo estimado (ex: Gratuito, R$ 50-100)" },
                      eficacia: { type: "number", description: "Eficácia estimada 0-100" },
                      tempo: { type: "string", description: "Tempo estimado neste canal" },
                    },
                    required: ["canal", "descricao", "custo_estimado", "eficacia", "tempo"],
                  },
                },
                dados_publicos: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      fonte: { type: "string", description: "Nome da fonte (ex: Cartório 1º Ofício, AGEFIS)" },
                      tipo_dado: { type: "string", description: "Tipo de dado disponível" },
                      como_acessar: { type: "string", description: "Como acessar esta informação" },
                      url_referencia: { type: "string", description: "URL ou endereço para acessar" },
                    },
                    required: ["fonte", "tipo_dado", "como_acessar"],
                  },
                },
                scripts_abordagem: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      canal_contato: { type: "string", enum: ["telefone", "whatsapp", "presencial", "email", "carta"] },
                      destinatario: { type: "string", description: "Para quem é dirigido (ex: Porteiro, Síndico, Proprietário)" },
                      script: { type: "string", description: "Texto completo do script de abordagem" },
                      dica: { type: "string", description: "Dica para maximizar resultado" },
                    },
                    required: ["canal_contato", "destinatario", "script", "dica"],
                  },
                },
                sinais_intencao: {
                  type: "array",
                  items: { type: "string", description: "Sinais que indicam intenção de vender/alugar" },
                },
                plano_acao: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      passo: { type: "number" },
                      acao: { type: "string" },
                      prazo: { type: "string" },
                    },
                    required: ["passo", "acao", "prazo"],
                  },
                },
                resumo_estrategia: { type: "string", description: "Resumo geral da estratégia recomendada" },
              },
              required: ["probabilidade_sucesso", "tempo_estimado", "dificuldade", "canais_investigacao", "dados_publicos", "scripts_abordagem", "sinais_intencao", "plano_acao", "resumo_estrategia"],
            },
          },
        }],
        { type: "function", function: { name: "resultado_busca_proprietario" } },
      );

      if (res.aiError) return res.aiError;

      // Anexa anúncios públicos reais (link de referência do imóvel) — LGPD-safe
      // Com fallback: se nome_predio não bate, tenta partial match e retorna sugestões preservando link_anuncio.
      const matchStart = Date.now();
      const fc = await fetchPublicAdsQuick({
        bairro, cidade, estado, tipo_imovel, operacao, nome_predio,
      });
      const matchDuracao = Date.now() - matchStart;

      // === AUDITORIA MATCHING/FALLBACK — só registra quando há nome_predio na consulta ===
      if (nome_predio && String(nome_predio).trim()) {
        try {
          let imobId: string = aiUser.id;
          try {
            const { data: ma } = await sbAdmin
              .from("master_autorizacoes")
              .select("master_id")
              .eq("user_id", aiUser.id)
              .eq("ativo", true)
              .maybeSingle();
            if (ma?.master_id) imobId = ma.master_id as string;
          } catch (_) { /* ignore */ }

          const summarize = (arr: any[]) => (Array.isArray(arr) ? arr : []).slice(0, 10).map((a: any) => ({
            url: a?.url ?? null,
            title: a?.title ?? null,
            portal: a?.portal ?? null,
            match_type: a?.match_type ?? null,
            source: a?.source ?? null,
            similarity: typeof a?.similarity === "number" ? Number(a.similarity.toFixed(3)) : null,
          }));
          const suggestionsPayload = [
            ...summarize(fc.ads).map((s) => ({ ...s, kind: "ad" })),
            ...summarize(fc.suggestions).map((s) => ({ ...s, kind: "suggestion" })),
          ];

          await sbAdmin.from("matching_fallback_log").insert({
            imobiliaria_id: imobId,
            user_id: aiUser.id,
            action: "buscar_proprietario",
            nome_predio: String(nome_predio).trim(),
            cidade: cidade ?? null,
            bairro: bairro ?? null,
            tipo_imovel: tipo_imovel ?? null,
            operacao: operacao ?? null,
            match_type: fc.match_type,
            fallback_used: !!fc.fallback_used,
            ads_count: fc.ads.length,
            suggestions_count: (fc.suggestions ?? []).length,
            suggestions: suggestionsPayload,
            firecrawl_error: fc.error ?? null,
            duracao_ms: matchDuracao,
          });
        } catch (e) {
          console.warn("[captacao-inteligente] matching_fallback_log insert failed:", String(e).slice(0, 200));
        }
      }

      return successResponse({
        ...res.result,
        anuncios_publicos: fc.ads,
        total_anuncios_reais: fc.ads.length,
        anuncios_sugestoes: fc.suggestions,
        anuncios_match_type: fc.match_type,
        anuncios_fallback_usado: fc.fallback_used,
        firecrawl_error: fc.error,
      });
    }

    if (action === "sugestoes_canal") {
      const { canal, cidade, estado, captacoes_existentes } = params;

      const canalDescricoes: Record<string, string> = {
        porteiro: "porteiros de edifícios residenciais que podem indicar apartamentos à venda ou para alugar no prédio",
        construtor: "construtores individuais que estão construindo casas ou reformando imóveis que podem entrar no mercado",
        construtora: "construtoras com empreendimentos novos ou lançamentos em construção na região",
        sindico: "síndicos de condomínios que sabem de unidades disponíveis e podem facilitar o contato com proprietários",
      };

      const descricaoCanal = canalDescricoes[canal] || canal;
      const canalLabel = canal === "porteiro" ? "Porteiro" : canal === "construtor" ? "Construtor" : canal === "construtora" ? "Construtora" : "Síndico";

      const prompt = `Você é um consultor imobiliário especialista em captação de imóveis em ${cidade || "Brasília"}, ${estado || "DF"}.

Canal de captação: ${canalLabel} — ${descricaoCanal}

O corretor já tem ${captacoes_existentes} captações registradas via ${canalLabel.toLowerCase()}.

Gere exatamente 10 sugestões realistas, variadas e detalhadas de oportunidades de captação específicas para o canal "${canalLabel}" em ${cidade || "Brasília"}/${estado || "DF"}.
Distribua as sugestões por diferentes bairros e tipos de imóveis para diversificar a estratégia.
Use endereços, nomes de condomínios e bairros reais da região.
Para cada sugestão, forneça o nome de contato sugerido (ex: "Porteiro do Ed. Solar", "Síndico do Cond. Águas Claras").
Inclua uma dica estratégica específica para maximizar resultados neste canal.`;

      const res = await aiCall(
        [
          { role: "system", content: "Responda APENAS via tool call com dados realistas." },
          { role: "user", content: prompt },
        ],
        [{
          type: "function",
          function: {
            name: "sugestoes_captacao",
            description: "Lista sugestões de captação para um canal específico",
            parameters: {
              type: "object",
              properties: {
                sugestoes: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      nome_contato: { type: "string", description: "Nome do contato sugerido" },
                      endereco: { type: "string", description: "Endereço real" },
                      bairro: { type: "string", description: "Bairro real" },
                      tipo_imovel: { type: "string", enum: TIPOS_IMOVEL },
                      operacao: { type: "string", enum: ["Venda", "Locação"] },
                      motivo: { type: "string", description: "Por que é uma boa oportunidade neste canal" },
                      acao_recomendada: { type: "string", description: "Próxima ação para o corretor" },
                      score: { type: "number", description: "Score de 0 a 100" },
                      link_anuncio: { type: "string", description: "URL do anúncio público (será preenchida pelo backend)" },
                      portal_origem: { type: "string", description: "Portal de origem (será preenchido pelo backend)" },
                    },
                    required: ["nome_contato", "endereco", "bairro", "tipo_imovel", "operacao", "motivo", "acao_recomendada", "score"],
                  },
                },
                dica_canal: { type: "string", description: "Dica estratégica para melhorar captação via este canal" },
              },
              required: ["sugestoes", "dica_canal"],
            },
          },
        }],
        { type: "function", function: { name: "sugestoes_captacao" } },
      );

      if (res.aiError) return res.aiError;

      // Enriquecimento: para cada sugestão, buscar 1 anúncio público real do bairro/tipo
      // e anexar link_anuncio + portal_origem. Cachea por bairro+tipo+operacao para reduzir chamadas.
      const sugestoes = Array.isArray(res.result?.sugestoes) ? res.result.sugestoes : [];
      const adsCache = new Map<string, QuickAd[]>();
      const norm = (s: any) => String(s || "").trim().toLowerCase();
      for (const s of sugestoes) {
        const key = `${norm(s.bairro)}|${norm(s.tipo_imovel)}|${norm(s.operacao)}`;
        let ads = adsCache.get(key);
        if (!ads) {
          const r = await fetchPublicAdsQuick({
            bairro: s.bairro, cidade, estado,
            tipo_imovel: s.tipo_imovel, operacao: s.operacao,
          });
          ads = r.ads;
          adsCache.set(key, ads);
        }
        const chosen = ads[0];
        if (chosen) {
          s.link_anuncio = chosen.url;
          s.portal_origem = chosen.portal;
          s.source = chosen.source ?? null;
          s.match_type = chosen.match_type ?? null;
          s.similarity = typeof chosen.similarity === "number" ? chosen.similarity : null;
        } else {
          s.link_anuncio = "";
        }
      }
      return successResponse({ ...res.result, sugestoes });
    }

    return errorResponse("Ação inválida", 400);
  } catch (e) {
    console.error("captacao-inteligente error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
