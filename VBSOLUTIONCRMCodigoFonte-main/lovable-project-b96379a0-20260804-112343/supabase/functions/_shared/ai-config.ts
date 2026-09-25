import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { AI_MODELS, buildAiUrl, fallbackChain, firstModel } from "./ai-models.ts";

// Payload canônico para "usuário sem IA conectada". Retornamos com HTTP 200
// para que `supabase.functions.invoke` não jogue FunctionsHttpError e o
// front-end consiga ler `error_code` e mostrar CTA amigável.
export const AI_NAO_CONFIGURADA = {
  success: false,
  error_code: "no_ai_connected",
  message: "Você ainda não conectou sua IA.",
  // Mensagem legada mantida para call-sites antigos que leem `data.error`.
  error: "Você ainda não conectou sua IA.",
  hint: "Acesse Configurações → IA e cadastre uma chave de OpenAI, Google Gemini, Anthropic, Groq, DeepSeek ou OpenRouter.",
  config_url: "/configurar-ia",
};

export const AI_TOKEN_INVALIDO = {
  success: false,
  error_code: "invalid_provider_token",
  message: "O token salvo parece inválido. Verifique e reconecte em Configurações.",
  error: "O token salvo parece inválido. Verifique e reconecte em Configurações.",
  config_url: "/configurar-ia",
};

// Validação leve: apenas verifica que a chave está presente e não é curta
// demais. Prefixo/comprimento exato NÃO são validados — provedores mudam
// formato de chave sem aviso, e a validação de verdade acontece na chamada
// real ao provedor.
function isProviderTokenShapeValid(_provider: string, key: string): boolean {
  if (!key || typeof key !== "string") return false;
  return key.trim().length >= 8;
}

function defaultModel(provider: string) {
  return firstModel(provider);
}

/**
 * Retorna a config de IA do usuário se ele configurou (BYOK ativo + chave presente).
 * Retorna null caso contrário — a IA NÃO deve funcionar sem configuração do usuário.
 */
export async function getUserAiConfig(supabase: any, userId: string) {
  if (!userId) return null;
  const { data: config } = await supabase
    .from("user_ai_config")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!config) return null;
  if (config.byok_active === false) return null;

  const provider = config.provider || "google";
  const providerKeys = config.provider_keys || {};
  const apiKey = providerKeys[provider] || config.api_key_encrypted;
  if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length < 8) return null;

  const model = config.model || defaultModel(provider);

  let aiUrl = "";
  let authHeaderAi = `Bearer ${apiKey}`;
  if (provider === "google") {
    aiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    authHeaderAi = "";
  } else if (provider === "openai") aiUrl = "https://api.openai.com/v1/chat/completions";
  else if (provider === "groq") aiUrl = "https://api.groq.com/openai/v1/chat/completions";
  else if (provider === "deepseek") aiUrl = "https://api.deepseek.com/chat/completions";
  else if (provider === "openrouter") aiUrl = "https://openrouter.ai/api/v1/chat/completions";
  else if (provider === "anthropic") aiUrl = "https://api.anthropic.com/v1/messages";
  else aiUrl = "https://api.openai.com/v1/chat/completions";

  const shapeOk = isProviderTokenShapeValid(provider, apiKey);
  return { apiKey, aiUrl, model, authHeaderAi, provider, isByok: true, shapeOk };
}

/**
 * Gate: retorna { config } se o usuário conectou uma IA com token de formato válido,
 * ou { response } (HTTP 200 + { success:false, error_code }) caso contrário.
 *
 * IMPORTANTE: retornamos SEMPRE HTTP 200 nos erros de gate para que
 * `supabase.functions.invoke` no front-end receba o payload em `data` em vez de
 * lançar FunctionsHttpError com mensagem genérica "non-2xx status code".
 */
export async function requireUserAi(
  supabase: any,
  userId: string | undefined | null,
  corsHeaders: Record<string, string>,
) {
  const cfg = userId ? await getUserAiConfig(supabase, userId) : null;
  if (!cfg) {
    return {
      config: null as any,
      response: new Response(JSON.stringify(AI_NAO_CONFIGURADA), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
    };
  }
  if (cfg.shapeOk === false) {
    console.warn(`[requireUserAi] token com formato inválido para provider=${cfg.provider} user=${userId}`);
    return {
      config: null as any,
      response: new Response(JSON.stringify(AI_TOKEN_INVALIDO), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
    };
  }
  return { config: cfg, response: null as Response | null };
}

/**
 * Compat: mantém a assinatura antiga, porém agora exige BYOK.
 * Lança erro "IA_NAO_CONFIGURADA" se o usuário não configurou.
 */
export async function getAiConfig(supabase: any, userId: string) {
  const cfg = await getUserAiConfig(supabase, userId);
  if (!cfg) throw new Error("IA_NAO_CONFIGURADA");
  return cfg;
}

export function formatAiResponse(data: any, provider: string, _isByok: boolean = true) {
  if (provider === "google") {
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  }
  if (provider === "anthropic") {
    return data.content?.[0]?.text || "";
  }
  return data.choices?.[0]?.message?.content || "";
}

export function formatAiBody(
  prompt: string,
  model: string,
  provider: string,
  _isByok: boolean = true,
  systemPrompt?: string,
) {
  if (provider === "google") {
    return {
      contents: [
        { parts: [{ text: (systemPrompt ? systemPrompt + "\n\n" : "") + prompt }] },
      ],
    };
  }
  if (provider === "anthropic") {
    return {
      model,
      max_tokens: 4096,
      ...(systemPrompt ? { system: systemPrompt } : {}),
      messages: [{ role: "user", content: prompt }],
    };
  }
  return {
    model,
    messages: [
      ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
      { role: "user", content: prompt },
    ],
  };
}

/**
 * Legacy-compat helper: substitui o padrão antigo
 *   const body = formatAiBody(...); const res = await fetch(aiUrl, ...);
 *   const text = formatAiResponse(await res.json(), ...);
 * por uma chamada única que usa callUserAi (com fallback automático de modelo).
 * Retorna o texto bruto. Lança Error com a mensagem real do provedor em caso de falha.
 */
export async function legacyCallAi(
  cfg: { apiKey: string; aiUrl: string; model: string; authHeaderAi: string; provider: string },
  systemPrompt: string | undefined,
  userPrompt: string,
  opts?: { wantJson?: boolean; temperature?: number; maxTokens?: number; timeoutMs?: number },
): Promise<string> {
  const r = await callUserAi(cfg, { systemPrompt, userPrompt, ...(opts || {}) });
  if (!r.ok) throw new Error(r.error);
  return r.text;
}

// ============================================================================
// callUserAi — universal chat helper using the user's own BYOK provider.
// Never falls back to a system key. Every AI edge function should route through here.
// ============================================================================

export type CallUserAiOptions = {
  systemPrompt?: string;
  userPrompt: string;
  wantJson?: boolean;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
};

export type CallUserAiResult =
  | { ok: true; text: string; provider: string; model: string }
  | { ok: false; status: number; error: string; code?: string };

/**
 * Executes a chat completion using the user's BYOK config (never a system key).
 * Handles provider-specific request/response shapes. When wantJson=true, adds
 * JSON-mode hints per provider so the response is a valid JSON string.
 */
export async function callUserAi(
  cfg: {
    apiKey: string;
    aiUrl: string;
    model: string;
    authHeaderAi: string;
    provider: string;
  },
  opts: CallUserAiOptions,
): Promise<CallUserAiResult> {
  const { provider, apiKey } = cfg;
  const { systemPrompt, userPrompt, wantJson, temperature, maxTokens, timeoutMs } = opts;

  const chain = fallbackChain(provider, cfg.model);
  let lastError: Exclude<CallUserAiResult, { ok: true }> | null = null;
  const attempted: string[] = [];

  for (const model of chain) {
    attempted.push(model);
    const aiUrl = buildAiUrl(provider, model, apiKey);
    const authHeaderAi = provider === "google" || provider === "anthropic"
      ? ""
      : `Bearer ${apiKey}`;

    const controller = new AbortController();
    const timer = timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : null;

    try {
      let body: any;
      const headers: Record<string, string> = { "Content-Type": "application/json" };

      if (provider === "google") {
        const text = (systemPrompt ? systemPrompt + "\n\n" : "") + userPrompt;
        body = {
          contents: [{ parts: [{ text }] }],
          ...(temperature !== undefined || maxTokens || wantJson
            ? {
                generationConfig: {
                  ...(temperature !== undefined ? { temperature } : {}),
                  ...(maxTokens ? { maxOutputTokens: maxTokens } : {}),
                  ...(wantJson ? { responseMimeType: "application/json" } : {}),
                },
              }
            : {}),
        };
      } else if (provider === "anthropic") {
        headers["x-api-key"] = apiKey;
        headers["anthropic-version"] = "2023-06-01";
        body = {
          model,
          max_tokens: maxTokens || 4096,
          ...(temperature !== undefined ? { temperature } : {}),
          ...(systemPrompt ? { system: systemPrompt } : {}),
          messages: [{ role: "user", content: userPrompt }],
        };
      } else {
        if (authHeaderAi) headers["Authorization"] = authHeaderAi;
        if (provider === "openrouter") {
          headers["HTTP-Referer"] = "https://radarimobtech.shop";
          headers["X-Title"] = "radarimobtech";
        }
        body = {
          model,
          messages: [
            ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
            { role: "user", content: userPrompt },
          ],
          ...(temperature !== undefined ? { temperature } : {}),
          ...(maxTokens ? { max_tokens: maxTokens } : {}),
          ...(wantJson ? { response_format: { type: "json_object" } } : {}),
        };
      }

      const resp = await fetch(aiUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!resp.ok) {
        const status = resp.status;
        const detail = await resp.text().catch(() => "");
        let providerMessage = "";
        let providerStatus = "";
        try {
          const parsed = JSON.parse(detail);
          providerMessage =
            parsed?.error?.message ||
            parsed?.error?.error?.message ||
            parsed?.message ||
            (typeof parsed?.error === "string" ? parsed.error : "") ||
            "";
          providerStatus = parsed?.error?.status || "";
        } catch { /* not JSON */ }
        const providerDetail = providerMessage || detail.slice(0, 500);
        console.error(
          `[callUserAi] ${provider} model=${model} status=${status} providerStatus=${providerStatus} body=${detail.slice(0, 500)}`,
        );

        const isModelUnavailable = status === 404
          || /not\s*found|is not supported|does not exist|unsupported|no longer|deprecated|has been retired|invalid model|model_not_found/i.test(providerDetail);

        if (isModelUnavailable) {
          lastError = {
            ok: false,
            status: 404,
            code: "MODEL_UNAVAILABLE",
            error: `Modelo "${model}" indisponível no provedor ${provider}: ${providerDetail || "modelo não encontrado"}.`,
          };
          console.warn(`[callUserAi] fallback: modelo ${model} indisponível, tentando próximo...`);
          continue; // try next model in the chain
        }

        // Non-model errors: return immediately (auth/rate/credits/etc are per-key, not per-model)
        if (status === 429) {
          return { ok: false, status: 429, code: "RATE_LIMITED", error: `Limite de requisições da sua conta ${provider} foi atingido (${providerDetail || "429"}). Aguarde alguns instantes.` };
        }
        if (status === 401 || status === 403) {
          return { ok: false, status: 401, code: "INVALID_KEY", error: `Sua chave ${provider} foi rejeitada (${status}): ${providerDetail || "sem detalhes"}` };
        }
        if (status === 402 || /insufficient|quota|billing|credit/i.test(detail)) {
          return { ok: false, status: 402, code: "NO_CREDITS", error: `Sua conta ${provider} está sem créditos/quota (${providerDetail || "402"}).` };
        }
        return { ok: false, status: 502, code: "PROVIDER_ERROR", error: `Erro do provedor ${provider} (HTTP ${status}${providerStatus ? " / " + providerStatus : ""}): ${providerDetail || "sem detalhes"}` };
      }

      const data = await resp.json();
      let text = "";
      if (provider === "google") {
        text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      } else if (provider === "anthropic") {
        text = data?.content?.[0]?.text || "";
      } else {
        text = data?.choices?.[0]?.message?.content || "";
      }
      if (attempted.length > 1) {
        console.log(`[callUserAi] fallback OK — provider=${provider} activeModel=${model} tried=${attempted.join(" -> ")}`);
      } else {
        console.log(`[callUserAi] OK provider=${provider} model=${model}`);
      }
      return { ok: true, text: String(text || ""), provider, model };
    } catch (e: any) {
      if (e?.name === "AbortError") {
        return { ok: false, status: 504, code: "TIMEOUT", error: `O provedor ${provider} demorou demais para responder.` };
      }
      lastError = { ok: false, status: 500, code: "FETCH_ERROR", error: `Falha ao contatar o provedor ${provider}: ${e?.message || e}` };
      // network errors: don't blindly retry all models
      break;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  console.error(`[callUserAi] TODOS os modelos falharam. provider=${provider} tried=${attempted.join(" -> ")}`);
  return lastError || {
    ok: false,
    status: 502,
    code: "PROVIDER_ERROR",
    error: `Nenhum modelo do provedor ${provider} respondeu (tentados: ${attempted.join(", ")}).`,
  };
}


/**
 * Parse the raw text returned by a model as JSON, tolerating markdown code fences
 * and surrounding narrative. Returns null when nothing parseable is present.
 */
export function tryParseJson<T = any>(text: string): T | null {
  if (!text) return null;
  let cleaned = String(text).replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch { /* fallthrough */ }
  const objStart = cleaned.indexOf("{");
  const objEnd = cleaned.lastIndexOf("}");
  if (objStart !== -1 && objEnd > objStart) {
    try {
      return JSON.parse(cleaned.slice(objStart, objEnd + 1)) as T;
    } catch { /* fallthrough */ }
  }
  const arrStart = cleaned.indexOf("[");
  const arrEnd = cleaned.lastIndexOf("]");
  if (arrStart !== -1 && arrEnd > arrStart) {
    try {
      return JSON.parse(cleaned.slice(arrStart, arrEnd + 1)) as T;
    } catch { /* fallthrough */ }
  }
  return null;
}

/**
 * Mapeia códigos internos do callUserAi para o contrato canônico esperado pelo
 * front-end: { success:false, error_code, message }.
 *
 * INVALID_KEY   -> invalid_token
 * NO_CREDITS    -> no_credits
 * RATE_LIMITED  -> rate_limited
 * TIMEOUT       -> network_error
 * FETCH_ERROR   -> network_error
 * PROVIDER_ERROR (5xx/desconhecido) -> unknown_error
 */
export function mapAiErrorPayload(err: Exclude<CallUserAiResult, { ok: true }>) {
  const code = err.code || "UNKNOWN";
  const rawProviderMessage = err.error || "";
  let error_code = "unknown_error";
  let message = "Erro ao processar com a IA. Tente novamente.";
  let config_url: string | undefined;
  switch (code) {
    case "INVALID_KEY":
      error_code = "invalid_token";
      message = rawProviderMessage || "Sua conexão com a IA expirou ou o token é inválido. Reconecte em Configurações.";
      config_url = "/configurar-ia";
      break;
    case "NO_CREDITS":
      error_code = "no_credits";
      message = rawProviderMessage || "Sua conta de IA está sem créditos/saldo disponível.";
      break;
    case "RATE_LIMITED":
      error_code = "rate_limited";
      message = rawProviderMessage || "Muitas requisições na sua conta de IA agora. Tente novamente em instantes.";
      break;
    case "MODEL_UNAVAILABLE":
      error_code = "model_unavailable";
      message = rawProviderMessage || "Modelo indisponível para a sua chave. Troque em Configurações → IA.";
      config_url = "/configurar-ia";
      break;
    case "TIMEOUT":
    case "FETCH_ERROR":
      error_code = "network_error";
      message = rawProviderMessage || "Não foi possível se conectar à IA. Tente novamente.";
      break;
    case "PROVIDER_ERROR":
      // Antes retornava mensagem genérica; agora propaga o erro real do provedor.
      error_code = "provider_error";
      message = rawProviderMessage || "Erro do provedor de IA. Tente novamente.";
      break;
    default:
      console.error(`[mapAiErrorPayload] erro não mapeado code=${code} status=${err.status} raw=${err.error}`);
      if (rawProviderMessage) message = rawProviderMessage;
  }
  return {
    success: false,
    error_code,
    message,
    error: message,
    provider_detail: rawProviderMessage || undefined,
    http_status: err.status,
    ...(config_url ? { config_url } : {}),
  };
}

/**
 * Response JSON padronizado para falhas de IA — SEMPRE HTTP 200 para que o
 * front-end receba o payload via `supabase.functions.invoke` (evita o
 * "non-2xx status code" genérico).
 */
export function aiErrorResponse(
  err: Exclude<CallUserAiResult, { ok: true }>,
  corsHeaders: Record<string, string>,
) {
  return new Response(
    JSON.stringify(mapAiErrorPayload(err)),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
