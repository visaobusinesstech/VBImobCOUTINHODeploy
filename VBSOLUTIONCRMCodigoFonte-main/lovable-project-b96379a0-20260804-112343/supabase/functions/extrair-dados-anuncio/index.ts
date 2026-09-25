import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireUserAi, callUserAi, tryParseJson } from "../_shared/ai-config.ts";
import {
  extractPhotosFromHtml,
  detectBlockPage,
  checkRateLimit,
  BROWSER_HEADERS,
  type PhotoExtractionResult,
} from "../_shared/photoExtractor.ts";
import { hashPhotoCacheKey, readPhotoCache, writePhotoCache } from "../_shared/photoCache.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ExtractedPropertyData {
  titulo: string | null;
  tipo: string | null;
  operacao: string | null;
  area: number | null;
  quartos: number | null;
  suites: number | null;
  banheiros: number | null;
  vagas: number | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  preco: number | null;
  valor_condominio: number | null;
  valor_iptu: number | null;
  andar: string | null;
  descricao: string | null;
  fotos: string[];
  endereco: string | null;
  caracteristicas: string[];
}

interface ViaCepAddress {
  cep?: string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
}

type ExtractionStage =
  | "init"
  | "auth"
  | "validation"
  | "firecrawl"
  | "direct-fetch"
  | "ai-gateway"
  | "post-processing"
  | "persistence";

const HINTS_BY_STAGE: Record<ExtractionStage, string> = {
  init: "Tente novamente em alguns segundos. Se persistir, recarregue a página.",
  auth: "Sua sessão pode ter expirado. Faça login novamente e repita a operação.",
  validation: "Confira se a URL está completa, começa com https:// e aponta para um único anúncio.",
  firecrawl: "O serviço de coleta da página não respondeu. Verifique se o link abre no navegador comum, ou tente outro portal.",
  "direct-fetch": "Não foi possível baixar a página diretamente. O site pode estar bloqueando robôs — tente outro link.",
  "ai-gateway": "A IA não conseguiu interpretar o anúncio agora. Aguarde alguns segundos e tente novamente, ou preencha manualmente.",
  "post-processing": "Os dados extraídos vieram incompletos. Tente outro link do mesmo imóvel ou preencha manualmente.",
  persistence: "Não foi possível registrar o resultado. Tente novamente em instantes.",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let correlationId: string = crypto.randomUUID();
  let stage: ExtractionStage = "init";

  const buildErrorBody = (params: {
    message: string;
    httpStatus: number;
    hint?: string;
    upstreamStatus?: number;
    extra?: Record<string, unknown>;
  }) => ({
    error: params.message,
    stage,
    correlation_id: correlationId,
    http_status: params.httpStatus,
    upstream_status: params.upstreamStatus ?? null,
    hint: params.hint ?? HINTS_BY_STAGE[stage],
    ...(params.extra ?? {}),
  });

  const errorResponse = (params: {
    message: string;
    httpStatus: number;
    hint?: string;
    upstreamStatus?: number;
    extra?: Record<string, unknown>;
    soft?: boolean;
  }) => {
    // Erros esperados de negócio (validação, IA sem crédito, sem dados suficientes)
    // são devolvidos com HTTP 200 para que supabase.functions.invoke NÃO gere
    // FunctionsHttpError ("non-2xx status code") e o front-end consiga ler o
    // payload de erro em `data`. Apenas 401 (auth) e 500 (crash) mantêm status HTTP.
    const softStatuses = new Set([400, 402, 403, 422, 429, 502]);
    const useSoft = params.soft ?? softStatuses.has(params.httpStatus);
    return new Response(JSON.stringify({ success: false, error_code: `stage_${stage}_${params.httpStatus}`, ...buildErrorBody(params) }), {
      status: useSoft ? 200 : params.httpStatus,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "x-correlation-id": correlationId,
        "x-extraction-stage": stage,
      },
    });
  };

  try {
    stage = "auth";

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return errorResponse({ message: "Não autorizado", httpStatus: 401 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sbAdmin = createClient(supabaseUrl, serviceKey);
    const token = authHeader.replace("Bearer ", "");

    // Worker mode: called by photo-extraction-worker with service-role token and x-worker-user-id
    const workerUserId = req.headers.get("x-worker-user-id");
    const isWorkerCall = !!workerUserId && token === serviceKey;

    let user: { id: string } | null = null;
    if (isWorkerCall) {
      user = { id: workerUserId! };
    } else {
      const { data: { user: authUser } } = await sbAdmin.auth.getUser(token);
      user = authUser ?? null;
    }

    const _iaGate = await requireUserAi(sbAdmin, user?.id, corsHeaders);
    if (_iaGate.response) return _iaGate.response;
    if (!user) {
      return errorResponse({ message: "Não autorizado", httpStatus: 401 });
    }


    const { data: profile } = await sbAdmin.from("profiles").select("approved, plano, is_master").eq("id", user.id).single();
    if (!profile?.approved && !profile?.is_master) {
      return errorResponse({
        message: "Conta não aprovada.",
        httpStatus: 403,
        hint: "Aguarde aprovação do administrador para usar a extração por link.",
      });
    }


    const { data: usageCount } = await sbAdmin.rpc("get_ai_usage_count", {
      _user_id: user.id, _function_name: "extrair-dados-anuncio"
    });
    const limit = profile.plano === "gratuito" ? 50 : 500;
    if (usageCount && usageCount >= limit) {
      return errorResponse({
        message: "Limite de uso atingido. Faça upgrade do seu plano para continuar.",
        httpStatus: 403,
        hint: "Você atingiu o limite diário do seu plano. Faça upgrade ou aguarde o próximo ciclo.",
        extra: { limit_reached: true },
      });
    }

    // Rate limit: 20 extractions/minute per user (per edge instance)
    const rl = checkRateLimit(`extract:${user.id}`, 20, 60_000);
    if (!rl.ok) {
      return errorResponse({
        message: "Muitas extrações em pouco tempo. Aguarde alguns segundos antes de tentar novamente.",
        httpStatus: 429,
        hint: `Tente novamente em ~${Math.ceil(rl.retryAfterMs / 1000)}s.`,
        extra: { retry_after_ms: rl.retryAfterMs, error_code: "RATE_LIMITED" },
      });
    }



    stage = "validation";
    const body = await req.json();
    if (body?.correlation_id && typeof body.correlation_id === "string") {
      correlationId = body.correlation_id;
    }
    const rawUrl = body?.url;

    // Log start of process
    await sbAdmin.from("system_logs").insert({
      user_id: user.id,
      module: "ExtrairDadosAnuncio",
      action: "edge-function-start",
      level: "info",
      message: `Iniciando extração via Edge Function para URL: ${rawUrl}`,
      correlation_id: correlationId,
      metadata: { url: rawUrl, mode: body?.mode }
    });

    
    if (!rawUrl || typeof rawUrl !== "string") {
      return errorResponse({ message: "URL é obrigatória", httpStatus: 400 });
    }

    let url = rawUrl.trim().replace(/([^:])\/\//g, "$1/");
    try {
      const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Invalid protocol");
      
      const paramsToRemove = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid"];
      paramsToRemove.forEach(p => parsed.searchParams.delete(p));
      url = parsed.toString();
    } catch {
      return errorResponse({
        message: "URL inválida",
        httpStatus: 400,
        hint: "Cole o link completo do anúncio começando com https://",
      });
    }



    const mode = body?.mode || "auto"; // "auto" | "single" | "list"
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");

    let pageContent = "";
    let htmlContent = "";
    let rawHtmlContent = "";
    let pageLinks: string[] = [];
    let extractedImages: string[] = [];
    let firecrawlError: { status?: number; message: string } | null = null;

    // === Photo cache lookup (per-URL, 7-day TTL) ===
    const cacheKeyInfo = await hashPhotoCacheKey(url);
    const cachedPhotos = cacheKeyInfo ? await readPhotoCache(sbAdmin, cacheKeyInfo.key) : null;
    if (cachedPhotos && cachedPhotos.fotos.length > 0) {
      console.log(`[photo-cache] HIT url_hash=${cacheKeyInfo!.key.slice(0, 12)} photos=${cachedPhotos.fotos.length} hits=${cachedPhotos.hits}`);
    } else if (cacheKeyInfo) {
      console.log(`[photo-cache] MISS url_hash=${cacheKeyInfo.key.slice(0, 12)}`);
    }

    if (FIRECRAWL_API_KEY) {
      stage = "firecrawl";
      try {
        const fcRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url,
            formats: ["markdown", "html", "rawHtml", "links"],
            onlyMainContent: false,
            waitFor: 1500,
          }),
          signal: AbortSignal.timeout(45000),
        });

        if (fcRes.ok) {
          const fcData = await fcRes.json();
          pageContent = fcData?.data?.markdown || "";
          htmlContent = fcData?.data?.html || "";
          rawHtmlContent = fcData?.data?.rawHtml || "";
          pageLinks = Array.isArray(fcData?.data?.links) ? fcData.data.links : [];
          
          console.log(`Fetched page content. Markdown: ${pageContent.length}, HTML: ${htmlContent.length}, Raw HTML: ${rawHtmlContent.length}, Links: ${pageLinks.length}`);
        } else {
          const errText = await fcRes.text();
          console.error("Firecrawl failed:", fcRes.status, errText);
          firecrawlError = { status: fcRes.status, message: errText.slice(0, 300) };
        }
      } catch (e) {
        console.error("Firecrawl error:", e);
        firecrawlError = { message: e instanceof Error ? e.message : String(e) };
      }
    }

    if (rawHtmlContent.length < 1500 || pageContent.length < 600) {
      stage = "direct-fetch";
      const directPage = await fetchPageDirectly(url);
      if (directPage.html) {
        if (directPage.html.length > rawHtmlContent.length) {
          rawHtmlContent = directPage.html;
          htmlContent = directPage.html;
        }
        if (directPage.text.length > pageContent.length) {
          pageContent = directPage.text;
        }
        pageLinks = uniqueUrls([...pageLinks, ...directPage.links]);
        console.log(`Direct fetch fallback succeeded. Text: ${pageContent.length}, HTML: ${htmlContent.length}, Links: ${pageLinks.length}`);
      } else {
        console.warn("Direct fetch fallback returned no usable HTML");
      }
    }

    // If we have basically nothing to work with, surface the firecrawl error
    if (!rawHtmlContent && !htmlContent && !pageContent) {
      stage = "firecrawl";
      return errorResponse({
        message: "Não foi possível baixar a página do anúncio.",
        httpStatus: 502,
        upstreamStatus: firecrawlError?.status,
        hint: "O portal pode estar fora do ar ou bloqueando coleta. Verifique se o link abre no navegador comum, ou tente outro anúncio.",
        extra: { firecrawl_error: firecrawlError?.message },
      });
    }


    // ======= LISTING PAGE DETECTION =======
    if (mode !== "single") {
      const sourceLooksLikeProperty = isLikelyPropertyDetailUrl(url);
      const propertyLinks = extractPropertyLinksFromPage(url, pageLinks, (rawHtmlContent || htmlContent) + "\n" + pageContent);
      console.log(`Listing detection: found ${propertyLinks.length} property links from ${pageLinks.length} page links (sourceLooksLikeProperty=${sourceLooksLikeProperty})`);
      if (!sourceLooksLikeProperty && propertyLinks.length > 1) {
        console.log(`Detected listing page with ${propertyLinks.length} property links`);
        return new Response(JSON.stringify({ 
          success: true, 
          is_listing: true, 
          property_urls: propertyLinks.slice(0, 100),
          total_found: propertyLinks.length,
          url_original: url 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (!pageContent && htmlContent) {
      pageContent = htmlToText(htmlContent);
    }

    const focusedPageContent = stripRelatedListingsText(pageContent);
    const regexFallbackData = extractFromMarkdown(focusedPageContent);
    const structuredData = extractStructuredPropertyData(rawHtmlContent || htmlContent, focusedPageContent, pageLinks, url);
    // === Cascade photo extraction (shared) ===
    const photoHtml = rawHtmlContent || htmlContent;
    const seedFromCache = cachedPhotos?.fotos ?? [];
    const photoResult: PhotoExtractionResult = extractPhotosFromHtml(photoHtml, {
      sourceUrl: url,
      maxPhotos: 20,
      seedPhotos: [
        ...(Array.isArray(structuredData.fotos) ? structuredData.fotos : []),
        ...seedFromCache,
      ],
    });
    // Also try legacy scorer as a safety net; merge results
    const legacyImages = extractRelevantPropertyImages(photoHtml, focusedPageContent, url, structuredData.fotos);
    extractedImages = Array.from(new Set([...photoResult.photos, ...legacyImages])).slice(0, 20);

    // Fallback: if the fresh extraction returned nothing but cache has photos, reuse them
    let usedCacheFallback = false;
    if (extractedImages.length === 0 && seedFromCache.length > 0) {
      extractedImages = seedFromCache.slice(0, 20);
      usedCacheFallback = true;
      console.log(`[photo-cache] FALLBACK reusing ${extractedImages.length} cached photos (fresh extraction empty)`);
    }

    console.log(
      `[photo-extractor] url=${url} strategies=${JSON.stringify(photoResult.strategy_stats)} ` +
      `raw=${photoResult.total_candidates} filtered=${photoResult.after_filter} dedup=${photoResult.after_dedup} ` +
      `blocked=${photoResult.blocked} reason=${photoResult.block_reason ?? "-"} legacy=${legacyImages.length} ` +
      `cache_seed=${seedFromCache.length} cache_fallback=${usedCacheFallback} final=${extractedImages.length}`,
    );

    // Structured block detection — surface to caller if page is captcha/blocked AND we got nothing
    const blockCheck = detectBlockPage(photoHtml);
    if (extractedImages.length === 0 && blockCheck.blocked) {
      // Cache the block signal so subsequent calls skip the retry churn (short TTL)
      if (cacheKeyInfo) {
        await writePhotoCache(sbAdmin, cacheKeyInfo.key, cacheKeyInfo.normalized, {
          fotos: [],
          strategy_stats: photoResult.strategy_stats,
          blocked: true,
          block_reason: blockCheck.reason ?? photoResult.block_reason ?? null,
          total_candidates: photoResult.total_candidates,
          ttlDays: 1,
        });
      }

      // Auto-enqueue for asynchronous retry with backoff (skip if this is already a worker call)
      let queuedJobId: string | null = null;
      if (!isWorkerCall) {
        try {
          // Dedup: only enqueue if no pending/processing job for same user+url exists
          const { data: existingJob } = await sbAdmin
            .from("photo_extraction_queue")
            .select("id")
            .eq("user_id", user.id)
            .eq("source_url", url)
            .in("status", ["pending", "processing"])
            .maybeSingle();

          if (existingJob) {
            queuedJobId = existingJob.id;
          } else {
            const { data: newJob } = await sbAdmin
              .from("photo_extraction_queue")
              .insert({
                user_id: user.id,
                imovel_id: (typeof body?.imovel_id === "string" ? body.imovel_id : null),
                source_url: url,
                portal: (() => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return null; } })(),
                origin: "auto_block",
                priority: 5,
                max_attempts: 5,
                // First retry in 5 min — gives portal cool-down before the worker retries
                next_run_at: new Date(Date.now() + 5 * 60_000).toISOString(),
                last_error: "Portal bloqueou coleta automática (captcha/anti-bot).",
                last_error_code: "PORTAL_BLOCKED_TRY_MANUAL_UPLOAD",
                last_block_reason: blockCheck.reason ?? photoResult.block_reason ?? null,
              })
              .select("id")
              .single();
            queuedJobId = newJob?.id ?? null;
          }
        } catch (qErr) {
          console.warn("[queue] auto-enqueue on block failed", qErr);
        }
      }

      return errorResponse({
        message: "O portal bloqueou a coleta automática (captcha ou proteção anti-bot).",
        httpStatus: 200,
        soft: true,
        hint: queuedJobId
          ? "Reprocessamento automático agendado — as fotos serão coletadas em segundo plano assim que o bloqueio passar. Enquanto isso, você pode fazer upload manual."
          : "Faça o upload manual das fotos ou tente novamente em alguns minutos.",
        extra: {
          error_code: "PORTAL_BLOCKED_TRY_MANUAL_UPLOAD",
          block_reason: blockCheck.reason,
          photo_strategy_stats: photoResult.strategy_stats,
          queued_job_id: queuedJobId,
          auto_retry_scheduled: !!queuedJobId,
        },
      });
    }



    const fallbackDescription =
      sanitizeDescription(structuredData.descricao) ??
      sanitizeDescription(extractStructuredDescription(rawHtmlContent || htmlContent)) ??
      extractDescriptionFromContent(focusedPageContent);
    const structuredHints = buildStructuredHints(structuredData);

    const imageListForAI = extractedImages.length > 0 
      ? `\n\nIMAGENS FILTRADAS DO ANÚNCIO (já removidas propaganda, banners e imóveis similares):\n${extractedImages.map((u, i) => `${i+1}. ${u}`).join("\n")}`
      : "";

    let parsed: any = null;
    let aiError: { status?: number; message: string } | null = null;

    stage = "ai-gateway";
    try {
      const contentForAI = focusedPageContent ? focusedPageContent.substring(0, 12000) : "Sem conteúdo textual extraído.";
      const userPrompt = `Extraia TODOS os dados do imóvel deste anúncio. Seja extremamente meticuloso — preencha cada campo que puder ser inferido do conteúdo. Não deixe campos vazios se a informação estiver disponível:\n\n${contentForAI}${imageListForAI}${structuredHints}\n\nRetorne JSON com esta estrutura (use null APENAS se realmente não encontrar a informação):\n{\n  "titulo": "título descritivo e profissional",\n  "tipo": "Apartamento|Casa|Terreno|Comercial|Cobertura|Kitnet|Sala|Loja|Galpão|Prédio|Sobrado",\n  "operacao": "Venda|Aluguel",\n  "area": número em m²,\n  "quartos": número,\n  "suites": número,\n  "banheiros": número,\n  "vagas": número,\n  "bairro": "OBRIGATÓRIO",\n  "cidade": "OBRIGATÓRIO",\n  "estado": "sigla UF",\n  "cep": "00000-000",\n  "preco": número,\n  "valor_condominio": número,\n  "valor_iptu": número,\n  "andar": "string",\n  "descricao": "texto descritivo profissional, mínimo 100 caracteres",\n  "fotos": ["URLs somente da seção IMAGENS FILTRADAS DO ANÚNCIO"],\n  "endereco": "endereço completo",\n  "caracteristicas": ["piscina", "portaria 24h", ...]\n}`;

      const aiRes = await callUserAi(_iaGate.config, {
        systemPrompt: "Você é um especialista em extrair dados completos e precisos de anúncios imobiliários brasileiros. Responda SOMENTE em JSON válido.",
        userPrompt,
        wantJson: true,
        temperature: 0.05,
        maxTokens: 4096,
        timeoutMs: 60000,
      });

      if (aiRes.ok) {
        parsed = tryParseJson(aiRes.text);
        if (!parsed) {
          aiError = { message: "Resposta da IA não pôde ser interpretada como JSON." };
        } else {
          console.log(`AI extracted: quartos=${parsed.quartos}, area=${parsed.area}, preco=${parsed.preco}, bairro=${parsed.bairro}, cidade=${parsed.cidade}`);
        }
      } else {
        aiError = { status: aiRes.status, message: aiRes.error };
        if (aiRes.status === 401) {
          return errorResponse({
            message: aiRes.error,
            httpStatus: 400,
            upstreamStatus: 401,
            hint: "Sua chave de IA foi rejeitada. Vá em Configurações → IA, valide/atualize a chave e tente novamente.",
            extra: { code: "IA_CHAVE_INVALIDA", config_url: "/configurar-ia" },
          });
        }
        if (aiRes.status === 429) {
          return errorResponse({
            message: aiRes.error,
            httpStatus: 429,
            upstreamStatus: 429,
            hint: "Aguarde alguns segundos e tente novamente. O provedor da sua chave limitou a frequência de chamadas.",
          });
        }
        if (aiRes.status === 402) {
          return errorResponse({
            message: aiRes.error,
            httpStatus: 402,
            upstreamStatus: 402,
            hint: "Recarregue o saldo/créditos no painel do seu provedor de IA e tente novamente.",
          });
        }
      }
    } catch (aiErr) {
      console.error("AI call failed:", aiErr);
      aiError = { message: aiErr instanceof Error ? aiErr.message : String(aiErr) };
    }



    if (!parsed) {
      console.log("Using regex fallback extraction");
      parsed = extractFromMarkdown(focusedPageContent);
    }

    let mergedData = mergePropertyData(parsed, structuredData, regexFallbackData);

    // Post-merge validation and enrichment
    mergedData = validateAndEnrichData(mergedData, focusedPageContent, url);

    const sanitizedAiDescription = sanitizeDescription(parsed?.descricao);
    mergedData.descricao = sanitizedAiDescription ?? fallbackDescription ?? regexFallbackData.descricao ?? null;

    if (!mergedData.cep) {
      mergedData.cep = extractCepFromText(`${focusedPageContent}\n${rawHtmlContent || htmlContent}`);
    }

    if (!mergedData.cep && mergedData.endereco && mergedData.cidade && mergedData.estado) {
      const viaCepAddress = await lookupCepByAddress(mergedData);
      if (viaCepAddress) {
        mergedData = mergePropertyData(mergedData, {
          cep: viaCepAddress.cep ?? null,
          endereco: viaCepAddress.logradouro ?? null,
          bairro: viaCepAddress.bairro ?? null,
          cidade: viaCepAddress.localidade ?? null,
          estado: viaCepAddress.uf ?? null,
        });
      }
    }

    mergedData.fotos = buildFinalPropertyPhotoList({
      structuredPhotos: structuredData.fotos,
      curatedPhotos: extractedImages,
      aiPhotos: parsed?.fotos,
    });
    
    console.log(`Final photo count: ${mergedData.fotos.length}`);

    stage = "post-processing";
    const missingFields = computeMissingFields(mergedData);
    const useful = hasUsefulExtractedData(mergedData);
    const viable = hasMinimumViableData(mergedData);

    if (!useful && !viable) {
      console.warn("Extraction returned insufficient property data", {
        area: mergedData.area,
        preco: mergedData.preco,
        bairro: mergedData.bairro,
        cidade: mergedData.cidade,
        endereco: mergedData.endereco,
        fotos: Array.isArray(mergedData.fotos) ? mergedData.fotos.length : 0,
      });

      return errorResponse({
        message: "Não foi possível extrair dados suficientes deste anúncio. Tente outro link do imóvel ou preencha os dados manualmente.",
        httpStatus: 422,
        hint: aiError
          ? "A IA respondeu com erro durante a leitura. Tente novamente em alguns segundos ou use outro link."
          : "Tente abrir o link diretamente em outro anúncio do mesmo imóvel, ou preencha os campos manualmente.",
        extra: { ai_error: aiError?.message ?? null, firecrawl_error: firecrawlError?.message ?? null, missing_fields: missingFields },
      });
    }

    stage = "persistence";
    await sbAdmin.from("ai_usage_log").insert({ user_id: user.id, function_name: "extrair-dados-anuncio" });

    const partial = !useful && viable;
    if (partial) {
      console.warn("Returning PARTIAL extraction", { missing_fields: missingFields });
    }

    // Persist photo cache when we have real photos (skip pure cache-fallback reuse — nothing new to store)
    const finalPhotos = Array.isArray(mergedData.fotos) ? mergedData.fotos : [];
    if (cacheKeyInfo && finalPhotos.length > 0 && !usedCacheFallback) {
      await writePhotoCache(sbAdmin, cacheKeyInfo.key, cacheKeyInfo.normalized, {
        fotos: finalPhotos,
        strategy_stats: photoResult.strategy_stats,
        blocked: photoResult.blocked,
        block_reason: photoResult.block_reason ?? null,
        total_candidates: photoResult.total_candidates,
      });
    }

    return new Response(JSON.stringify({
      success: true,
      partial,
      missing_fields: missingFields,
      dados: mergedData,
      url_original: url,
      correlation_id: correlationId,
      photo_extraction: {
        count: finalPhotos.length,
        strategy_stats: photoResult.strategy_stats,
        blocked: photoResult.blocked,
        block_reason: photoResult.block_reason ?? null,
        total_candidates: photoResult.total_candidates,
        needs_manual_upload: finalPhotos.length === 0,
        cache_hit: !!(cachedPhotos && cachedPhotos.fotos.length > 0),
        cache_fallback: usedCacheFallback,
        cache_seed_count: seedFromCache.length,
      },
      ...(partial ? {
        warning: "Extração parcial: alguns campos não puderam ser obtidos. Complete manualmente se necessário.",
        recovered_fields: listPresentFields(mergedData),
      } : {}),
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "x-correlation-id": correlationId,
        "x-extraction-stage": stage,
        "x-extraction-partial": partial ? "true" : "false",
      },
    });
  } catch (e) {
    console.error("extrair-dados-anuncio error:", e);
    const sbUrl = Deno.env.get("SUPABASE_URL")!;
    const sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sbAdmin = createClient(sbUrl, sbKey);
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    let userId = null;
    if (token) {
      const { data: { user } } = await sbAdmin.auth.getUser(token);
      userId = user?.id;
    }

    if (userId) {
      await sbAdmin.from("system_logs").insert({
        user_id: userId,
        module: "ExtrairDadosAnuncio",
        action: "edge-function-error",
        level: "fatal",
        message: e instanceof Error ? e.message : String(e),
        correlation_id: correlationId,
        metadata: { 
          url: req.url, 
          stack: e instanceof Error ? e.stack : undefined,
          alert_required: true,
          environment: Deno.env.get("ENVIRONMENT") || "production"
        }
      });
    }

    return errorResponse({
      message: `Erro ao extrair dados do anúncio: ${e instanceof Error ? e.message : "Erro desconhecido"}`,
      httpStatus: 500,
      hint: `Falha inesperada na etapa "${stage}". Tente novamente; se persistir, copie o ID ${correlationId} e contate o suporte.`,
      extra: { exception: e instanceof Error ? e.message : String(e) },
    });
  }
});

// ==================== HELPER FUNCTIONS ====================

function uniqueUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  return urls.filter(u => {
    if (!u || seen.has(u)) return false;
    seen.add(u);
    return true;
  });
}

function stripRelatedListingsText(content: string): string {
  if (!content) return "";

  const markers = [
    /im[oó]veis?\s+(?:similares?|semelhantes?|relacionados?|recomendados?)/i,
    /an[uú]ncios?\s+(?:similares?|semelhantes?|relacionados?|recomendados?)/i,
    /veja\s+tamb[eé]m/i,
    /outros?\s+im[oó]veis/i,
    /mais\s+im[oó]veis/i,
    /im[oó]veis?\s+pr[oó]ximos/i,
    /voc[eê]\s+tamb[eé]m\s+pode\s+gostar/i,
  ];

  let cutIndex = content.length;
  for (const marker of markers) {
    const match = marker.exec(content);
    if (match && typeof match.index === "number" && match.index > 400) {
      cutIndex = Math.min(cutIndex, match.index);
    }
  }

  return content.slice(0, cutIndex).trim();
}

function hasUsefulExtractedData(data: any): boolean {
  const qualityScore = [
    Number(data?.area) > 0 ? 2 : 0,
    Number(data?.preco) > 0 ? 2 : 0,
    typeof data?.bairro === "string" && data.bairro.trim() ? 1 : 0,
    typeof data?.cidade === "string" && data.cidade.trim() ? 1 : 0,
    typeof data?.endereco === "string" && data.endereco.trim() ? 1 : 0,
    Array.isArray(data?.fotos) && data.fotos.length > 0 ? 2 : 0,
    typeof data?.descricao === "string" && data.descricao.trim().length >= 60 ? 1 : 0,
    Number(data?.quartos) > 0 || Number(data?.banheiros) > 0 || Number(data?.vagas) > 0 ? 1 : 0,
  ].reduce((sum, value) => sum + value, 0);

  return qualityScore >= 3;
}

/**
 * Modo parcial: aceita retornar dados mesmo com qualidade baixa, desde que
 * exista pelo menos um identificador mínimo do imóvel (título/preço/área/endereço).
 * Isso reduz o impacto na automação quando fotos/descrição não puderam ser obtidas.
 */
function hasMinimumViableData(data: any): boolean {
  const hasTitulo = typeof data?.titulo === "string" && data.titulo.trim().length >= 5;
  const hasPreco = Number(data?.preco) > 0;
  const hasArea = Number(data?.area) > 0;
  const hasEndereco =
    (typeof data?.endereco === "string" && data.endereco.trim().length > 0) ||
    (typeof data?.bairro === "string" && data.bairro.trim().length > 0 &&
     typeof data?.cidade === "string" && data.cidade.trim().length > 0);
  const hasTipologia = Number(data?.quartos) > 0 || Number(data?.banheiros) > 0;

  // precisa de ao menos 2 sinais mínimos para o parcial valer a pena
  const signals = [hasTitulo, hasPreco, hasArea, hasEndereco, hasTipologia].filter(Boolean).length;
  return signals >= 2;
}

const TRACKED_FIELDS: Array<{ key: string; check: (d: any) => boolean }> = [
  { key: "titulo", check: (d) => typeof d?.titulo === "string" && d.titulo.trim().length >= 5 },
  { key: "preco", check: (d) => Number(d?.preco) > 0 },
  { key: "area", check: (d) => Number(d?.area) > 0 },
  { key: "quartos", check: (d) => Number(d?.quartos) > 0 },
  { key: "banheiros", check: (d) => Number(d?.banheiros) > 0 },
  { key: "vagas", check: (d) => Number(d?.vagas) > 0 },
  { key: "endereco", check: (d) => typeof d?.endereco === "string" && d.endereco.trim().length > 0 },
  { key: "bairro", check: (d) => typeof d?.bairro === "string" && d.bairro.trim().length > 0 },
  { key: "cidade", check: (d) => typeof d?.cidade === "string" && d.cidade.trim().length > 0 },
  { key: "estado", check: (d) => typeof d?.estado === "string" && d.estado.trim().length > 0 },
  { key: "cep", check: (d) => typeof d?.cep === "string" && d.cep.trim().length > 0 },
  { key: "descricao", check: (d) => typeof d?.descricao === "string" && d.descricao.trim().length >= 60 },
  { key: "fotos", check: (d) => Array.isArray(d?.fotos) && d.fotos.length > 0 },
];

function computeMissingFields(data: any): string[] {
  return TRACKED_FIELDS.filter(({ check }) => !check(data)).map(({ key }) => key);
}

function listPresentFields(data: any): string[] {
  return TRACKED_FIELDS.filter(({ check }) => check(data)).map(({ key }) => key);
}

async function fetchPageDirectly(url: string): Promise<{ html: string; text: string; links: string[] }> {
  try {
    const response = await fetch(url, {
      headers: BROWSER_HEADERS,
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.warn("Direct fetch failed:", response.status, response.statusText);
      return { html: "", text: "", links: [] };
    }

    const html = await response.text();
    if (!html || html.length < 200) {
      return { html: "", text: "", links: [] };
    }


    return {
      html,
      text: htmlToText(html),
      links: extractLinksFromHtml(html, url),
    };
  } catch (error) {
    console.error("Direct fetch fallback failed:", error);
    return { html: "", text: "", links: [] };
  }
}

function extractLinksFromHtml(html: string, sourceUrl: string): string[] {
  if (!html) return [];

  const links: string[] = [];
  const hrefRegex = /href=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;

  while ((match = hrefRegex.exec(html)) !== null) {
    const normalized = normalizeLinkUrl(match[1], sourceUrl);
    if (normalized) links.push(normalized);
  }

  return uniqueUrls(links);
}

function normalizeLinkUrl(value: string, sourceUrl: string): string | null {
  if (!value) return null;
  const cleaned = decodeHtmlEntities(value).trim();
  if (!cleaned || /^(javascript:|mailto:|tel:|#)/i.test(cleaned)) return null;

  try {
    return new URL(cleaned, sourceUrl).toString();
  } catch {
    return null;
  }
}

function extractRelevantPropertyImages(
  html: string,
  markdown: string,
  sourceUrl: string,
  structuredPhotos: string[] = [],
): string[] {
  const candidates = [
    ...toValidPhotoArray(structuredPhotos, sourceUrl).map((url) => ({
      url,
      score: 30 + scoreImageSourceAffinity(url, sourceUrl),
    })),
    ...extractImagesFromHtml(html).map((url) => {
      const normalizedUrl = normalizeImageUrl(url, sourceUrl);
      return {
        url: normalizedUrl,
        score: normalizedUrl
          ? getBestImageContextScore(html, normalizedUrl) + scoreImageSourceAffinity(normalizedUrl, sourceUrl)
          : Number.NEGATIVE_INFINITY,
      };
    }),
    ...extractImagesFromMarkdown(markdown).map((url) => {
      const normalizedUrl = normalizeImageUrl(url, sourceUrl);
      return {
        url: normalizedUrl,
        score: normalizedUrl
          ? getBestImageContextScore(markdown, normalizedUrl) + scoreImageSourceAffinity(normalizedUrl, sourceUrl)
          : Number.NEGATIVE_INFINITY,
      };
    }),
  ].filter((candidate): candidate is { url: string; score: number } => Boolean(candidate.url));

  const bestByKey = new Map<string, { url: string; score: number }>();

  for (const candidate of candidates) {
    if (!isPropertyImage(candidate.url)) continue;
    const key = getPhotoIdentityKey(candidate.url);
    const existing = bestByKey.get(key);
    if (!existing || candidate.score > existing.score || (candidate.score === existing.score && candidate.url.length > existing.url.length)) {
      bestByKey.set(key, candidate);
    }
  }

  const scored = Array.from(bestByKey.values())
    .filter((candidate) => candidate.score >= 5)
    .sort((a, b) => b.score - a.score)
    .map((candidate) => candidate.url)
    .slice(0, 30);

  if (scored.length > 0) return scored;

  // Fallback 1: og:image + Twitter card (praticamente todo portal usa)
  const ogFallback: string[] = [];
  const ogRegex = /<meta[^>]+(?:property|name)=["'](?:og:image(?::secure_url)?|twitter:image(?::src)?)["'][^>]+content=["']([^"']+)["']/gi;
  let ogMatch: RegExpExecArray | null;
  while ((ogMatch = ogRegex.exec(html)) !== null) {
    const normalized = normalizeImageUrl(ogMatch[1], sourceUrl);
    if (normalized && !ogFallback.includes(normalized)) ogFallback.push(normalized);
  }
  const ogRegex2 = /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image(?::secure_url)?|twitter:image(?::src)?)["']/gi;
  while ((ogMatch = ogRegex2.exec(html)) !== null) {
    const normalized = normalizeImageUrl(ogMatch[1], sourceUrl);
    if (normalized && !ogFallback.includes(normalized)) ogFallback.push(normalized);
  }

  // Fallback 2: todas as imagens que passam pelo whitelist isPropertyImage,
  // sem exigir contexto de "galeria/carousel" (portais SPA modernos não marcam isso)
  const relaxed = Array.from(bestByKey.values())
    .sort((a, b) => b.score - a.score)
    .map((c) => c.url);

  const merged = uniqueUrls([...ogFallback, ...relaxed]).slice(0, 30);
  console.log(`[fallback-images] scored=0 og=${ogFallback.length} relaxed=${relaxed.length} merged=${merged.length}`);
  return merged;
}

function extractPropertyIdToken(value: string): string | null {
  if (!value) return null;
  const match = value.match(/(?:^|[/?&=_-])(\d{6,})(?=$|[/?&._-])/);
  return match?.[1] ?? null;
}

function scoreImageSourceAffinity(imageUrl: string, sourceUrl: string): number {
  const sourceId = extractPropertyIdToken(sourceUrl);
  const imageId = extractPropertyIdToken(imageUrl);

  if (!sourceId || !imageId) return 0;
  return sourceId === imageId ? 8 : -8;
}

function buildFinalPropertyPhotoList({
  structuredPhotos,
  curatedPhotos,
  aiPhotos,
}: {
  structuredPhotos?: unknown;
  curatedPhotos?: unknown;
  aiPhotos?: unknown;
}): string[] {
  const curated = deduplicatePhotos(uniqueUrls(toValidPhotoArray(curatedPhotos)));
  const structured = deduplicatePhotos(uniqueUrls(toValidPhotoArray(structuredPhotos)));
  const ai = deduplicatePhotos(uniqueUrls(toValidPhotoArray(aiPhotos)));

  if (structured.length > 0) return structured.slice(0, 30);
  if (curated.length > 0) return curated.slice(0, 30);
  if (ai.length > 0) return ai.slice(0, 30);
  return [];
}

function toValidPhotoArray(value: unknown, sourceUrl?: string): string[] {
  if (!Array.isArray(value)) return [];

  const normalized = value
    .map((item) => normalizeImageUrl(item, sourceUrl))
    .filter((url): url is string => typeof url === "string" && isPropertyImage(url));

  return uniqueUrls(normalized);
}

function normalizeImageUrl(value: unknown, sourceUrl?: string): string | null {
  if (typeof value !== "string") return null;
  const cleaned = decodeHtmlEntities(value).trim();
  if (!cleaned) return null;

  try {
    const normalized = cleaned.startsWith("//")
      ? new URL(`https:${cleaned}`)
      : new URL(cleaned, sourceUrl || "https://example.com");

    if (!["http:", "https:"].includes(normalized.protocol)) return null;
    return normalized.toString();
  } catch {
    return null;
  }
}

function getBestImageContextScore(content: string, imageUrl: string): number {
  if (!content || !imageUrl) return 0;

  const searchTerms = uniqueUrls([
    imageUrl,
    imageUrl.replace(/&/g, "&amp;"),
    decodeHtmlEntities(imageUrl),
  ]);

  let bestScore = Number.NEGATIVE_INFINITY;

  for (const term of searchTerms) {
    let fromIndex = 0;
    let matches = 0;

    while (matches < 4) {
      const index = content.indexOf(term, fromIndex);
      if (index === -1) break;

      const snippet = content.slice(Math.max(0, index - 260), Math.min(content.length, index + term.length + 260)).toLowerCase();
      bestScore = Math.max(bestScore, scoreImageContext(snippet));
      fromIndex = index + term.length;
      matches += 1;
    }
  }

  return bestScore === Number.NEGATIVE_INFINITY ? 0 : bestScore;
}

function scoreImageContext(context: string): number {
  let score = 0;

  if (/(galeria|gallery|carousel|carrossel|slider|swiper|swiper-slide|fotos?|imagens?|media|hero|principal|capa|destaque)/i.test(context)) score += 4;
  if (/(im[oó]vel|property|listing|detalhes|descri[cç][aã]o|itemprop=["'](?:image|photo)|og:image)/i.test(context)) score += 2;
  if (/(data-testid|class)=.[^>\n]*(gallery|galeria|carousel|slider|swiper|photo|image|media)/i.test(context)) score += 3;
  if (/(data-qa|data-testid|class)=.[^>\n]*(property|listing|detail|gallery)/i.test(context)) score += 2;

  if (/(similares?|semelhantes?|relacionad[oa]s?|veja tamb[eé]m|outros? im[oó]veis|mais im[oó]veis|recomendad[oa]s?|sugest(?:ão|oes)?|patrocinad[oa]s?|publicidade|banner|promo[cç][aã]o|parceir[oa]s?|corretor(?:es)?|imobili[aá]ria|newsletter|footer|header|menu|nav|ads?|sponsored|recommended|related|listing-card|property-card|card-grid)/i.test(context)) score -= 12;
  if (/(logo|avatar|icon|placeholder|watermark|marca d[’']?agua|loading|spinner)/i.test(context)) score -= 8;

  return score;
}

function getPhotoIdentityKey(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname
      .replace(/[-_]\d+x\d+/g, "")
      .replace(/[-_](?:thumb|small|medium|large|original|hd|full|crop|fit)/gi, "")
      .toLowerCase()}`;
  } catch {
    return url;
  }
}

function deduplicatePhotos(urls: string[]): string[] {
  // Group by a normalized base path to avoid CDN size variants of the same image
  const baseMap = new Map<string, string>();
  for (const url of urls) {
    const key = getPhotoIdentityKey(url);
    if (!baseMap.has(key) || url.length > (baseMap.get(key)?.length || 0)) {
      baseMap.set(key, url);
    }
  }
  return Array.from(baseMap.values());
}

function extractCepFromText(text: string): string | null {
  if (!text) return null;
  const match = text.match(/\b(\d{5})-?(\d{3})\b/);
  if (match) return `${match[1]}-${match[2]}`;
  return null;
}

async function lookupCepByAddress(data: any): Promise<ViaCepAddress | null> {
  try {
    const endereco = data.endereco?.split(",")[0]?.trim();
    if (!endereco || !data.cidade || !data.estado) return null;
    const query = encodeURIComponent(`${data.estado}/${data.cidade}/${endereco}`);
    const res = await fetch(`https://viacep.com.br/ws/${query}/json/`);
    if (!res.ok) return null;
    const results = await res.json();
    if (Array.isArray(results) && results.length > 0) return results[0];
    return null;
  } catch {
    return null;
  }
}

function extractStructuredPropertyData(html: string, markdown: string, links: string[], sourceUrl: string): any {
  const data: any = {
    titulo: null, tipo: null, operacao: null, area: null, quartos: null,
    suites: null, banheiros: null, vagas: null, bairro: null, cidade: null,
    estado: null, cep: null, preco: null, valor_condominio: null, valor_iptu: null,
    andar: null, descricao: null, fotos: [], endereco: null, caracteristicas: [],
  };

  if (!html) return data;

  const structuredCandidates = extractStructuredPropertyItems(html);
  const bestStructuredItem = structuredCandidates
    .map((item) => ({ item, score: scoreStructuredPropertyItem(item, sourceUrl) }))
    .sort((a, b) => b.score - a.score)[0]?.item;

  if (bestStructuredItem) {
    applyStructuredPropertyItem(data, bestStructuredItem, sourceUrl);
  }

  const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  if (ogTitle && !data.titulo) data.titulo = ogTitle[1];

  const ogPrice = html.match(/<meta[^>]+(?:property|name)=["'](?:product:price:amount|og:price:amount)["'][^>]+content=["']([^"']+)["']/i);
  if (ogPrice && !data.preco) data.preco = parseFloat(ogPrice[1].replace(/[^\d.]/g, ""));

  const areaMatch = html.match(/itemprop=["']floorSize["'][^>]*content=["']?(\d+)/i) ||
                     html.match(/(?:Área|Area)\s*(?:útil|total|privativa)?\s*:?\s*(\d+(?:[.,]\d+)?)\s*m/i);
  if (areaMatch) data.area = data.area || parseFloat(areaMatch[1].replace(",", "."));

  const roomMatch = html.match(/itemprop=["']numberOfRooms["'][^>]*content=["']?(\d+)/i) ||
                    html.match(/(\d+)\s*(?:quarto|dorm)/i);
  if (roomMatch) data.quartos = data.quartos || parseInt(roomMatch[1]);

  const bathMatch = html.match(/(\d+)\s*banheiro/i);
  if (bathMatch) data.banheiros = data.banheiros || parseInt(bathMatch[1]);

  const suiteMatch = html.match(/(\d+)\s*su[ií]te/i);
  if (suiteMatch) data.suites = data.suites || parseInt(suiteMatch[1]);

  const parkingMatch = html.match(/(\d+)\s*vaga/i);
  if (parkingMatch) data.vagas = data.vagas || parseInt(parkingMatch[1]);

  const condMatch = html.match(/cond[oô]m[ií]nio[:\s]*R?\$?\s*([\d.,]+)/i) ||
                    html.match(/(?:taxa\s+de\s+)?condom[ií]nio[:\s]*R?\$?\s*([\d.,]+)/i);
  if (condMatch) data.valor_condominio = data.valor_condominio || parseFloat(condMatch[1].replace(/\./g, "").replace(",", "."));

  const iptuMatch = html.match(/iptu[:\s]*R?\$?\s*([\d.,]+)/i);
  if (iptuMatch) data.valor_iptu = data.valor_iptu || parseFloat(iptuMatch[1].replace(/\./g, "").replace(",", "."));

  const andarMatch = html.match(/(\d+)[ºª°]?\s*andar/i) || html.match(/andar[:\s]*(\d+)/i);
  if (andarMatch) data.andar = data.andar || andarMatch[1];

  const addrMatch = html.match(/data-address=["']([^"']+)["']/i) ||
                    html.match(/class=["'][^"']*address[^"']*["'][^>]*>([^<]+)</i);
  if (addrMatch) data.endereco = data.endereco || addrMatch[1].trim();

  const charRegex = /<li[^>]*class=["'][^"']*(?:amenity|feature|characteristic|comodidade|diferencial)[^"']*["'][^>]*>([^<]+)</gi;
  let charMatch;
  while ((charMatch = charRegex.exec(html)) !== null) {
    const char = charMatch[1].trim();
    if (char.length > 2 && char.length < 60 && !data.caracteristicas.includes(char)) {
      data.caracteristicas.push(char);
    }
  }

  if (markdown) {
    const charSection = markdown.match(/(?:caracter[ií]sticas|comodidades|diferenciais|infraestrutura)[:\s]*\n((?:[-*•]\s*.+\n?)+)/i);
    if (charSection) {
      const items = charSection[1].split("\n").map(l => l.replace(/^[-*•]\s*/, "").trim()).filter(l => l.length > 2 && l.length < 60);
      for (const item of items) {
        if (!data.caracteristicas.includes(item)) data.caracteristicas.push(item);
      }
    }
  }

  return data;
}

function extractStructuredPropertyItems(html: string): Record<string, any>[] {
  const items: Record<string, any>[] = [];
  const jsonLdRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let scriptMatch: RegExpExecArray | null;

  while ((scriptMatch = jsonLdRegex.exec(html)) !== null) {
    const raw = scriptMatch[1]?.trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      collectStructuredPropertyItems(parsed, items);
    } catch {
      // ignore malformed json-ld
    }
  }

  return items;
}

function collectStructuredPropertyItems(value: unknown, output: Record<string, any>[]) {
  if (!value) return;
  if (Array.isArray(value)) {
    for (const item of value) collectStructuredPropertyItems(item, output);
    return;
  }
  if (typeof value !== "object") return;

  const record = value as Record<string, any>;
  if (isStructuredPropertyType(record)) {
    output.push(record);
  }

  for (const key of Object.keys(record)) {
    collectStructuredPropertyItems(record[key], output);
  }
}

function isStructuredPropertyType(record: Record<string, any>): boolean {
  const rawType = record?.["@type"];
  const types = Array.isArray(rawType) ? rawType : [rawType];
  return types.some((type) => typeof type === "string" && /^(Product|RealEstateListing|Residence|Apartment|House|SingleFamilyResidence)$/i.test(type));
}

function scoreStructuredPropertyItem(item: Record<string, any>, sourceUrl: string): number {
  const sourceKey = normalizeStructuredComparableUrl(sourceUrl, sourceUrl);
  const sourceId = extractPropertyIdToken(sourceUrl);
  const candidateUrls = getStructuredItemUrls(item, sourceUrl);
  const candidateImages = getStructuredItemImages(item, sourceUrl);

  let score = 0;

  if (sourceKey && candidateUrls.some((url) => normalizeStructuredComparableUrl(url, sourceUrl) === sourceKey)) {
    score += 120;
  } else if (sourceId && candidateUrls.some((url) => extractPropertyIdToken(url) === sourceId)) {
    score += 80;
  }

  if (item.name) score += 8;
  if (item.description) score += 6;
  if (item.offers?.price) score += 8;
  if (item.address) score += 8;
  if (item.floorSize?.value) score += 6;
  if (item.numberOfRooms) score += 4;
  if (item.numberOfBathroomsTotal) score += 4;
  score += Math.min(candidateImages.length, 6);

  return score;
}

function getStructuredItemUrls(item: Record<string, any>, sourceUrl: string): string[] {
  const urlCandidates: unknown[] = [
    item.url,
    item["@id"],
    item.sameAs,
    item.mainEntityOfPage,
    item.offers?.url,
    item.subjectOf,
  ];

  const urls: string[] = [];

  const collect = (value: unknown) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(collect);
      return;
    }
    if (typeof value === "string") {
      const normalized = normalizeLinkUrl(value, sourceUrl);
      if (normalized) urls.push(normalized);
      return;
    }
    if (typeof value === "object") {
      const record = value as Record<string, unknown>;
      collect(record.url);
      collect(record["@id"]);
      collect(record.sameAs);
    }
  };

  urlCandidates.forEach(collect);
  return uniqueUrls(urls);
}

function getStructuredItemImages(item: Record<string, any>, sourceUrl: string): string[] {
  const images: string[] = [];

  const collect = (value: unknown) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(collect);
      return;
    }
    if (typeof value === "string") {
      const normalized = normalizeImageUrl(value, sourceUrl);
      if (normalized && isPropertyImage(normalized)) images.push(normalized);
      return;
    }
    if (typeof value === "object") {
      const record = value as Record<string, unknown>;
      collect(record.url);
      collect(record.contentUrl);
      collect(record["@id"]);
    }
  };

  collect(item.image);
  collect(item.photo);
  return uniqueUrls(images);
}

function normalizeStructuredComparableUrl(value: string, sourceUrl: string): string | null {
  const normalized = normalizeLinkUrl(value, sourceUrl);
  if (!normalized) return null;

  try {
    const parsed = new URL(normalized);
    return `${parsed.origin}${normalizePathname(parsed.pathname)}`;
  } catch {
    return null;
  }
}

function applyStructuredPropertyItem(data: any, item: Record<string, any>, sourceUrl: string) {
  const offers = Array.isArray(item.offers) ? item.offers[0] : item.offers;
  const address = typeof item.address === "object" && item.address ? item.address as Record<string, any> : {};
  const floorSize = typeof item.floorSize === "object" && item.floorSize ? item.floorSize : null;

  data.titulo = data.titulo || item.name || null;
  data.descricao = data.descricao || item.description || null;
  if (offers?.price) data.preco = data.preco || parseFloat(String(offers.price));
  if (item.numberOfRooms) data.quartos = data.quartos || parseInt(String(item.numberOfRooms));
  if (item.numberOfBathroomsTotal) data.banheiros = data.banheiros || parseInt(String(item.numberOfBathroomsTotal));
  if (floorSize?.value) data.area = data.area || parseFloat(String(floorSize.value));

  data.endereco = data.endereco || address.streetAddress || (typeof item.address === "string" ? item.address : null) || null;
  data.bairro = data.bairro || address.neighborhood || null;
  data.cidade = data.cidade || address.addressLocality || address.city || null;
  data.estado = data.estado || normalizeStructuredState(address.addressRegion || address.state || null);
  data.cep = data.cep || address.postalCode || null;

  const images = getStructuredItemImages(item, sourceUrl);
  for (const image of images) {
    if (!data.fotos.includes(image)) data.fotos.push(image);
  }
}

function normalizeStructuredState(value: unknown): string | null {
  if (!value) return null;
  const cleaned = String(value).trim().replace(/^BR-/, "").toUpperCase();
  if (/^[A-Z]{2}$/.test(cleaned)) return cleaned;
  return null;
}

function buildStructuredHints(structuredData: any): string {
  const hints: string[] = [];
  if (structuredData.titulo) hints.push(`Título extraído: ${structuredData.titulo}`);
  if (structuredData.area) hints.push(`Área: ${structuredData.area}m²`);
  if (structuredData.quartos) hints.push(`Quartos: ${structuredData.quartos}`);
  if (structuredData.banheiros) hints.push(`Banheiros: ${structuredData.banheiros}`);
  if (structuredData.suites) hints.push(`Suítes: ${structuredData.suites}`);
  if (structuredData.vagas) hints.push(`Vagas: ${structuredData.vagas}`);
  if (structuredData.preco) hints.push(`Preço: R$ ${structuredData.preco}`);
  if (structuredData.bairro) hints.push(`Bairro: ${structuredData.bairro}`);
  if (structuredData.cidade) hints.push(`Cidade: ${structuredData.cidade}`);
  if (structuredData.estado) hints.push(`Estado: ${structuredData.estado}`);
  if (structuredData.cep) hints.push(`CEP: ${structuredData.cep}`);
  if (structuredData.endereco) hints.push(`Endereço: ${structuredData.endereco}`);
  if (hints.length === 0) return "";
  return `\n\nDADOS ESTRUTURADOS EXTRAÍDOS DA PÁGINA:\n${hints.join("\n")}`;
}

function mergePropertyData(...sources: any[]): any {
  const result: any = {
    titulo: null, tipo: null, operacao: null, area: null, quartos: null,
    suites: null, banheiros: null, vagas: null, bairro: null, cidade: null,
    estado: null, cep: null, preco: null, valor_condominio: null, valor_iptu: null,
    andar: null, descricao: null, fotos: [], endereco: null, caracteristicas: [],
  };
  
  for (const source of sources) {
    if (!source) continue;
    for (const key of Object.keys(result)) {
      if (key === "fotos") {
        const srcPhotos = Array.isArray(source.fotos) ? source.fotos : [];
        for (const p of srcPhotos) {
          if (p && typeof p === "string" && p.startsWith("http") && !result.fotos.includes(p)) {
            result.fotos.push(p);
          }
        }
      } else if (key === "caracteristicas") {
        const srcChars = Array.isArray(source.caracteristicas) ? source.caracteristicas : [];
        for (const c of srcChars) {
          if (c && !result.caracteristicas.includes(c)) result.caracteristicas.push(c);
        }
      } else {
        if (result[key] === null || result[key] === undefined || result[key] === 0 || result[key] === "") {
          if (source[key] !== null && source[key] !== undefined && source[key] !== "" && source[key] !== 0) {
            result[key] = source[key];
          }
        }
      }
    }
  }
  return result;
}

function validateAndEnrichData(data: any, pageContent: string, sourceUrl: string): any {
  // Validate numeric fields are reasonable
  if (data.preco && (data.preco < 100 || data.preco > 500000000)) {
    console.warn(`Suspicious price: ${data.preco}, attempting re-extraction`);
    const priceMatch = pageContent.match(/R\$\s*([\d.]+(?:,\d{2})?)/);
    if (priceMatch) {
      const rePrice = parseFloat(priceMatch[1].replace(/\./g, "").replace(",", "."));
      if (rePrice >= 100 && rePrice <= 500000000) data.preco = rePrice;
    }
  }
  
  if (data.area && data.area > 100000) data.area = null;
  if (data.quartos && data.quartos > 50) data.quartos = null;
  if (data.banheiros && data.banheiros > 50) data.banheiros = null;
  if (data.vagas && data.vagas > 50) data.vagas = null;
  if (data.suites && data.suites > data.quartos) data.suites = data.quartos;
  
  // Ensure título is descriptive, not generic
  if (!data.titulo || data.titulo.length < 10 || /^im[oó]vel\s*(extra[ií]do|importado|à venda)?$/i.test(data.titulo)) {
    const parts: string[] = [];
    if (data.tipo) parts.push(data.tipo);
    if (data.quartos) parts.push(`${data.quartos} Quartos`);
    if (data.area) parts.push(`${data.area}m²`);
    if (data.bairro) parts.push(`em ${data.bairro}`);
    if (data.cidade && data.cidade !== data.bairro) parts.push(`- ${data.cidade}`);
    if (data.operacao) parts.push(`- ${data.operacao}`);
    data.titulo = parts.length > 0 ? parts.join(" ") : "Imóvel importado";
  }
  
  // Infer estado from URL domain if missing
  if (!data.estado) {
    try {
      const host = new URL(sourceUrl).hostname.toLowerCase();
      if (host.includes("dfimoveis")) data.estado = "DF";
    } catch {}
    // Try to infer from city
    if (!data.estado && data.cidade) {
      const cityStateMap: Record<string, string> = {
        "brasília": "DF", "brasilia": "DF", "taguatinga": "DF", "ceilândia": "DF",
        "samambaia": "DF", "águas claras": "DF", "gama": "DF", "sobradinho": "DF",
        "são paulo": "SP", "rio de janeiro": "RJ", "belo horizonte": "MG",
        "curitiba": "PR", "porto alegre": "RS", "salvador": "BA", "recife": "PE",
        "fortaleza": "CE", "goiânia": "GO", "manaus": "AM", "belém": "PA",
      };
      const cityLower = data.cidade.toLowerCase().trim();
      if (cityStateMap[cityLower]) data.estado = cityStateMap[cityLower];
    }
  }
  
  // Default cidade for DF
  if (data.estado === "DF" && !data.cidade) data.cidade = "Brasília";
  
  // Ensure valor_condominio and valor_iptu are 0 instead of null for better UX
  if (data.valor_condominio === null) data.valor_condominio = 0;
  if (data.valor_iptu === null) data.valor_iptu = 0;
  
  return data;
}

function extractImagesFromHtml(html: string): string[] {
  const images: string[] = [];
  if (!html) return images;
  
  const imgTagRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = imgTagRegex.exec(html)) !== null) {
    const src = match[1];
    if (isPropertyImage(src)) images.push(src);
  }
  
  const srcsetRegex = /srcset=["']([^"']+)["']/gi;
  while ((match = srcsetRegex.exec(html)) !== null) {
    const srcset = match[1];
    const urls = srcset.split(",").map(s => s.trim().split(/\s+/)[0]);
    for (const u of urls) {
      if (isPropertyImage(u) && !images.includes(u)) images.push(u);
    }
  }
  
  const dataSrcRegex = /data-src=["']([^"']+)["']/gi;
  while ((match = dataSrcRegex.exec(html)) !== null) {
    const src = match[1];
    if (isPropertyImage(src) && !images.includes(src)) images.push(src);
  }
  
  const bgRegex = /background-image:\s*url\(['"]?([^'")]+)['"]?\)/gi;
  while ((match = bgRegex.exec(html)) !== null) {
    const src = match[1];
    if (isPropertyImage(src) && !images.includes(src)) images.push(src);
  }
  
  const metaRegex = /<meta[^>]+(?:content=["']([^"']+)["'][^>]*property=["']og:image["']|property=["']og:image["'][^>]*content=["']([^"']+)["'])[^>]*>/gi;
  while ((match = metaRegex.exec(html)) !== null) {
    const src = match[1] || match[2];
    if (src && src.startsWith("http") && !images.includes(src)) images.push(src);
  }
  
  return images;
}

function extractImagesFromMarkdown(md: string): string[] {
  const images: string[] = [];
  if (!md) return images;
  const imgRegex = /!\[.*?\]\((https?:\/\/[^\s)]+)\)/g;
  let match;
  while ((match = imgRegex.exec(md)) !== null) {
    const src = match[1];
    if (isPropertyImage(src)) images.push(src);
  }
  const plainUrlRegex = /(https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp)(?:\?[^\s"'<>]*)?)/gi;
  while ((match = plainUrlRegex.exec(md)) !== null) {
    const src = match[1];
    if (isPropertyImage(src) && !images.includes(src)) images.push(src);
  }
  return images;
}

function isPropertyImage(url: string): boolean {
  if (!url || !url.startsWith("http")) return false;
  
  // Reject known non-property images: logos, icons, UI elements, tracking pixels, avatars, ads, promo banners, etc.
  if (/logo|icon|sprite|favicon|banner[-_]?ad|pixel|tracking|analytics|badge|button|arrow|widget|avatar|profile|selo|stamp|certified|verificado|placeholder|loading|spinner|thumb(?:nail)?_(?:small|mini|xs)|user[-_]?(?:pic|photo|img)|agency[-_]?(?:logo|img)|imobiliaria[-_]?logo|corretor[-_]?(?:foto|img)|watermark|marca[-_]?dagua/i.test(url)) return false;

  // Reject promotional / advertising images
  if (/promo|propaganda|anuncio[-_]?banner|ad[-_]?banner|publicidade|patrocinado|sponsored|campaign|cta[-_]|call[-_]to[-_]action|destaque[-_]banner|oferta|desconto|cashback|financ(?:iamento|e)[-_]?banner|consorcio[-_]?banner|simulador|credito[-_]?banner|parceiro[-_]?logo|parceria|selo[-_]?(?:garantia|qualidade|confiavel)|rating|estrela|star[-_]?rating|award|premio|certificado|similar(?:es)?|related|recommended|recommendation|recomendad[oa]s?|sugest(?:ao|oes)?|listing-card|property-card/i.test(url)) return false;

  // Reject portal branding and navigation images (apenas quando o path indica logo/brand/nav — NÃO bloquear fotos reais hospedadas no CDN do portal)
  if (/(?:olx|zap|vivareal|imovelweb|quintoandar|netimov|chavenamao|wimoveis|dfimoveis)[^/]*\/(?:logo|brand|header|footer|nav|menu|ui|assets\/(?:logo|brand|icon))/i.test(url)) return false;

  // Reject very small image indicators in URL (e.g., 50x50, 100x75, etc.)
  if (/[/_-](?:\d{1,2}x\d{1,2}|(?:50|60|70|80|90|100|120)x)[\._/-]/i.test(url)) return false;

  // Reject common portal/ad UI image paths (removido /assets/ e /static/ — muitos portais servem fotos reais nesses caminhos)
  if (/\/(?:icons|ui|components|ads|banners|partners|selo|stamps|agencies|corretores|profiles|avatars|promo|campaigns|marketing)\//i.test(url)) return false;

  // Reject SVG files (usually UI elements)
  if (/\.svg(\?|$)/i.test(url)) return false;

  // Reject GIF files (usually ads or animations)
  if (/\.gif(\?|$)/i.test(url)) return false;

  // Accept known image extensions with reasonable size indicators
  if (/\.(jpg|jpeg|png|webp|avif)/i.test(url)) return true;
  
  // Accept known real estate image CDNs
  if (/resizedimgs|img\.zap|photos\.zap|vivareal|imgzap|cloudinary|amazonaws|imgix|akamai/i.test(url)) return true;
  
  return false;
}

function extractFromMarkdown(content: string): any {
  const extract = (patterns: RegExp[]): string | null => {
    for (const p of patterns) {
      const m = content.match(p);
      if (m && m[1]) return m[1].trim();
    }
    return null;
  };
  const extractNum = (patterns: RegExp[]): number | null => {
    const v = extract(patterns);
    if (!v) return null;
    const n = parseFloat(v.replace(/\./g, "").replace(",", "."));
    return isNaN(n) ? null : n;
  };

  const preco = extractNum([/R\$\s*([\d.,]+)/i, /preço[:\s]*([\d.,]+)/i, /valor[:\s]*R?\$?\s*([\d.,]+)/i]);
  const area = extractNum([/([\d.,]+)\s*m²/i, /área[:\s]*([\d.,]+)/i, /(?:Área|Area)\s*(?:útil|total|privativa)?\s*:?\s*([\d.,]+)/i]);
  const quartos = extractNum([/(\d+)\s*quarto/i, /(\d+)\s*dorm/i]);
  const suites = extractNum([/(\d+)\s*su[ií]te/i]);
  const banheiros = extractNum([/(\d+)\s*banheiro/i, /(\d+)\s*wc/i, /(\d+)\s*lavabo/i]);
  const vagas = extractNum([/(\d+)\s*vaga/i, /(\d+)\s*garagem/i]);
  const condominio = extractNum([/cond[oô]m[ií]nio[:\s]*R?\$?\s*([\d.,]+)/i, /(?:taxa\s+de\s+)?condom[ií]nio[:\s]*R?\$?\s*([\d.,]+)/i]);
  const iptu = extractNum([/iptu[:\s]*R?\$?\s*([\d.,]+)/i]);
  const tipo = extract([/\b(apartamento|casa|terreno|cobertura|kitnet|sala comercial|sala|loja|galpão|sobrado|prédio|studio|flat)\b/i]);
  const operacao = extract([/\b(venda|aluguel|locação|alugar|comprar)\b/i]);
  const bairro = extract([/bairro[:\s]*([^\n,|]+)/i, /setor[:\s]*([^\n,|]+)/i, /(?:localizado\s+(?:no|na|em)\s+)([^\n,.|]+)/i]);
  const cidade = extract([/cidade[:\s]*([^\n,|]+)/i, /(?:em\s+)([A-Z][a-záéíóúãõâêôç]+(?:\s+[A-Z][a-záéíóúãõâêôç]+)*)\s*[-–]\s*[A-Z]{2}/i]);
  const estado = extract([/\b([A-Z]{2})\s*$/m, /[-–]\s*([A-Z]{2})\b/, /estado[:\s]*([A-Z]{2})/i]);
  const endereco = extract([/endereço[:\s]*([^\n]+)/i, /(?:rua|avenida|quadra|sqn|sqs|sqsw|sqnw|shcgn|shcgs|scln|scls|smdb|shin|shis|smpw)\s+[^\n,]{3,60}/i]);
  const andar = extract([/(\d+)[ºª°]?\s*andar/i, /andar[:\s]*(\d+)/i]);
  const titleMatch = content.match(/^#\s*(.+)$/m) || content.match(/^(.{10,80})$/m);
  const titulo = titleMatch ? titleMatch[1].trim() : "Imóvel extraído";

  // Extract characteristics from bullet points
  const caracteristicas: string[] = [];
  const charPatterns = [
    /[-*•]\s*(piscina|academia|playground|churrasqueira|portaria\s*24h?|elevador|varanda|sacada|armários?\s*planejados?|closet|lavabo|despensa|dep[oó]sito|ar[- ]condicionado|aquecimento|piso\s*(?:laminado|porcelanato|vinílico)|vista\s*(?:livre|mar|panorâmica)|área\s*gourmet|espaço\s*gourmet|salão\s*de\s*festas|brinquedoteca|quadra|sauna|spa|jardim|horta|pet\s*(?:place|care|friendly)|coworking|bicicletário|lavanderia)/gi,
  ];
  for (const p of charPatterns) {
    let m;
    while ((m = p.exec(content)) !== null) {
      const c = m[1].trim();
      if (!caracteristicas.includes(c)) caracteristicas.push(c);
    }
  }

  return {
    titulo,
    tipo: tipo ? (tipo.charAt(0).toUpperCase() + tipo.slice(1).toLowerCase()).replace("Studio", "Kitnet").replace("Flat", "Kitnet") : "Apartamento",
    operacao: operacao ? (operacao.toLowerCase().includes("alug") || operacao.toLowerCase().includes("locação") || operacao.toLowerCase().includes("alugar") ? "Aluguel" : "Venda") : "Venda",
    area, quartos: quartos ? Math.round(quartos) : null,
    suites: suites ? Math.round(suites) : null,
    banheiros: banheiros ? Math.round(banheiros) : null,
    vagas: vagas ? Math.round(vagas) : null,
    bairro, cidade, estado, preco,
    valor_condominio: condominio, valor_iptu: iptu,
    andar, descricao: extractDescriptionFromContent(content),
    fotos: [], endereco, caracteristicas,
  };
}

function extractDescriptionFromContent(content: string): string | null {
  if (!content) return null;

  const normalized = content.replace(/\r/g, "\n");
  const sectionMatch = normalized.match(
    /(?:^|\n)(?:#{1,6}\s*)?(?:descri(?:ç|c)[aã]o(?:\s+do\s+im[oó]vel)?|sobre\s+o\s+im[oó]vel|detalhes\s+do\s+im[oó]vel|apresenta[cç][aã]o)\s*:?\s*\n+([\s\S]{40,2200}?)(?=\n(?:#{1,6}\s*)?(?:caracter[ií]sticas|comodidades|informa[cç][oõ]es|detalhes|localiza[cç][aã]o|endere[cç]o|pre[cç]o|valor|bairro|cidade|condom[ií]nio|iptu|fotos?)\b|$)/i,
  );

  if (sectionMatch?.[1]) {
    return sanitizeDescription(sectionMatch[1]);
  }

  const inlineMatch = normalized.match(/(?:descri(?:ç|c)[aã]o|sobre\s+o\s+im[oó]vel)\s*:\s*([^\n]{40,1200})/i);
  if (inlineMatch?.[1]) {
    return sanitizeDescription(inlineMatch[1]);
  }

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((paragraph) => sanitizeDescription(paragraph))
    .filter((paragraph): paragraph is string => Boolean(paragraph));

  return paragraphs.find((paragraph) => paragraph.length >= 60) ?? null;
}

function extractStructuredDescription(html: string): string | null {
  if (!html) return null;

  const candidates: string[] = [];

  const metaPatterns = [
    /<meta[^>]+(?:name|property)=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/gi,
    /<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']description["'][^>]*>/gi,
    /<meta[^>]+(?:name|property)=["']og:description["'][^>]+content=["']([^"']+)["'][^>]*>/gi,
    /<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']og:description["'][^>]*>/gi,
    /<meta[^>]+(?:name|property)=["']twitter:description["'][^>]+content=["']([^"']+)["'][^>]*>/gi,
  ];

  for (const pattern of metaPatterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(html)) !== null) {
      if (match[1]) candidates.push(match[1]);
    }
  }

  const jsonLdRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let scriptMatch: RegExpExecArray | null;
  while ((scriptMatch = jsonLdRegex.exec(html)) !== null) {
    const raw = scriptMatch[1]?.trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      collectDescriptions(parsed, candidates);
    } catch { /* ignore */ }
  }

  const sanitizedCandidates = candidates
    .map((candidate) => sanitizeDescription(candidate))
    .filter((candidate): candidate is string => Boolean(candidate))
    .sort((a, b) => b.length - a.length);

  return sanitizedCandidates[0] ?? null;
}

function collectDescriptions(value: unknown, output: string[]) {
  if (!value) return;
  if (Array.isArray(value)) {
    for (const item of value) collectDescriptions(item, output);
    return;
  }
  if (typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  if (typeof record.description === "string") output.push(record.description);
  for (const nested of Object.values(record)) collectDescriptions(nested, output);
}

function sanitizeDescription(val: unknown): string | null {
  if (val === null || val === undefined) return null;

  const text = decodeHtmlEntities(
    String(val)
      .replace(/<[^>]*>/g, " ")
      .replace(/!\[[^\]]*\]\(([^)]+)\)/g, " ")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gi, "$1")
      .replace(/https?:\/\/[^\s)]+/gi, " ")
      .replace(/\bwww\.[^\s]+/gi, " ")
      .replace(/[>*#`_~]+/g, " "),
  );

  const seen = new Set<string>();
  const cleaned = text
    .split(/\n+/)
    .map((line) =>
      line
        .replace(/^(?:descri(?:ç|c)[aã]o(?:\s+do\s+im[oó]vel)?|sobre\s+o\s+im[oó]vel|detalhes\s+do\s+im[oó]vel)\s*:?\s*/i, "")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter((line) => isUsefulDescriptionLine(line))
    .filter((line) => {
      const normalized = line.toLowerCase();
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned || cleaned.length < 30) return null;
  if (/^(url do an[uú]ncio|link do im[oó]vel|n[aã]o foi poss[ií]vel extrair)/i.test(cleaned)) return null;

  return cleaned.substring(0, 1200);
}

function isUsefulDescriptionLine(line: string): boolean {
  if (!line) return false;
  if (line.length < 8) return false;
  if (/https?:\/\//i.test(line)) return false;
  if (/\b(?:www\.|olx|zapimoveis|vivareal|imovelweb|wimoveis|quintoandar|chavenamao|chavenaomao|netimoveis)\b/i.test(line)) return false;
  if (/\b(?:url do an[uú]ncio|url do anuncio|link do im[oó]vel|copiar link|compartilhar|ver telefone|fale conosco|c[oó]digo do an[uú]ncio|c[oó]digo do im[oó]vel|n[aã]o foi poss[ií]vel extrair|breadcrumb|menu)\b/i.test(line)) return false;
  if (/^(?:fotos?|mapa|localiza[cç][aã]o|endere[cç]o|caracter[ií]sticas|detalhes|informa[cç][oõ]es|contato)$/i.test(line)) return false;
  return /[a-zà-ú]/i.test(line);
}

function htmlToText(html: string): string {
  if (!html) return "";
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

// ==================== LISTING PAGE DETECTION ====================

const PORTAL_PROPERTY_PATTERNS: { domain: RegExp; pathPattern: RegExp }[] = [
  // OLX - property URLs are /d/<category>/<slug>-<id> with numeric ID at end
  { domain: /olx\.com\.br/i, pathPattern: /\/d\/[^/]+\/[^/]+-\d{8,}/i },
  // ZAP Imóveis
  { domain: /zapimoveis\.com\.br/i, pathPattern: /\/imovel\/[^?#]+/i },
  // VivaReal
  { domain: /vivareal\.com\.br/i, pathPattern: /\/imovel\/[^?#]+/i },
  // Imovelweb
  { domain: /imovelweb\.com\.br/i, pathPattern: /\/propriedades\/[^?#]+/i },
  // W Imóveis
  { domain: /wimoveis\.com\.br/i, pathPattern: /\/propriedades\/[^?#]+/i },
  // QuintoAndar
  { domain: /quintoandar\.com\.br/i, pathPattern: /\/imovel\/[^?#]+/i },
  // DF Imóveis
  { domain: /dfimoveis\.com\.br/i, pathPattern: /\/imovel\/[^?#]+/i },
  // Chaves na Mão
  { domain: /chavenamao\.com\.br/i, pathPattern: /\/imovel\/[^?#]+/i },
  // Netimóveis
  { domain: /netimoveis\.com/i, pathPattern: /\/imovel\/[^?#]+/i },
  // Mercado Livre
  { domain: /mercadolivre\.com\.br/i, pathPattern: /\/MLB-\d+/i },
  // Generic: paths with property-like slugs
  { domain: /./i, pathPattern: /\/(?:imovel|imoveis|property|anuncio|detalhe)\/[a-zA-Z0-9_-]{4,}/i },
];

const PORTAL_DETAIL_PATTERNS: { domain: RegExp; pathPattern: RegExp }[] = [
  { domain: /olx\.com\.br/i, pathPattern: /\/d\/[^/]+\/[^/]+-\d{8,}/i },
  { domain: /zapimoveis\.com\.br/i, pathPattern: /\/imovel\/[^?#]+/i },
  { domain: /vivareal\.com\.br/i, pathPattern: /\/imovel\/[^?#]+/i },
  { domain: /imovelweb\.com\.br/i, pathPattern: /\/propriedades\/[^?#]+/i },
  { domain: /wimoveis\.com\.br/i, pathPattern: /\/propriedades\/[^?#]+/i },
  { domain: /quintoandar\.com\.br/i, pathPattern: /\/imovel\/[^?#]+/i },
  { domain: /dfimoveis\.com\.br/i, pathPattern: /\/imovel\/[^?#]+/i },
  { domain: /chavenamao\.com\.br/i, pathPattern: /\/imovel\/[^?#]+/i },
  { domain: /netimoveis\.com/i, pathPattern: /\/imovel\/[^?#]+/i },
  { domain: /mercadolivre\.com\.br/i, pathPattern: /\/MLB-\d+/i },
];

function normalizePathname(pathname: string): string {
  const normalized = pathname.replace(/\/+$/, "");
  return normalized || "/";
}

function isLikelyPropertyDetailUrl(targetUrl: string): boolean {
  try {
    const parsed = new URL(targetUrl);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    const path = normalizePathname(parsed.pathname);

    if (PORTAL_DETAIL_PATTERNS.some((pattern) => pattern.domain.test(host) && pattern.pathPattern.test(path))) {
      return true;
    }

    if (/\/(?:imovel|property|anuncio|detalhe|propriedade)\/[^/?#]{4,}/i.test(path)) {
      return true;
    }

    return /-[0-9]{6,}(?:\/)?$/i.test(path);
  } catch {
    return false;
  }
}

function extractPropertyLinksFromPage(sourceUrl: string, pageLinks: string[], html: string): string[] {
  const sourceParsedUrl = new URL(sourceUrl);
  const sourceHost = sourceParsedUrl.hostname.toLowerCase().replace(/^www\./, "");
  const sourceCanonicalUrl = `${sourceParsedUrl.origin}${normalizePathname(sourceParsedUrl.pathname)}`;
  const propertyUrls = new Set<string>();

  // Combine pageLinks from Firecrawl + extract from HTML href attributes
  const allLinks = [...pageLinks];
  if (html) {
    const hrefRegex = /href=["']([^"']+)["']/gi;
    let m: RegExpExecArray | null;
    while ((m = hrefRegex.exec(html)) !== null) {
      let href = m[1];
      if (href.startsWith("/")) {
        try { href = new URL(href, sourceUrl).toString(); } catch { continue; }
      }
      if (href.startsWith("http")) allLinks.push(href);
    }
  }

  // Also extract from markdown-style links [text](url)
  if (html) {
    const mdLinkRegex = /\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g;
    let m: RegExpExecArray | null;
    while ((m = mdLinkRegex.exec(html)) !== null) {
      allLinks.push(m[2]);
    }
  }

  for (const link of allLinks) {
    try {
      const linkUrl = new URL(link);
      const linkHost = linkUrl.hostname.toLowerCase().replace(/^www\./, "");
      const normalizedLinkPath = normalizePathname(linkUrl.pathname);
      const normalizedLinkUrl = `${linkUrl.origin}${normalizedLinkPath}`;
      
      // Only consider links on the same domain
      if (linkHost !== sourceHost && !linkHost.includes(sourceHost) && !sourceHost.includes(linkHost)) continue;
      
      // Skip the source URL itself
      if (normalizedLinkUrl === sourceCanonicalUrl) continue;
      
      // Skip pagination, filters, login, etc
      if (/\/(login|cadastro|anunciar|ajuda|contato|termos|politica|sobre|faq)\b/i.test(normalizedLinkPath)) continue;
      
      // Check against known property URL patterns
      for (const pattern of PORTAL_PROPERTY_PATTERNS) {
        if (pattern.domain.test(linkHost) && pattern.pathPattern.test(normalizedLinkPath)) {
          const clean = normalizedLinkUrl;
          propertyUrls.add(clean);
          break;
        }
      }
    } catch { /* ignore invalid URLs */ }
  }

  return Array.from(propertyUrls);
}
