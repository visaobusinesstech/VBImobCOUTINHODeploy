import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { z } from "https://esm.sh/zod@3.23.8";
import { getAiConfig, legacyCallAi, requireUserAi } from "../_shared/ai-config.ts";

const iaSchema = z.object({
  inconsistencias: z.array(z.string().trim().min(1).max(500)).max(50).catch([]).default([]),
  suficiencia: z.string().trim().max(2000).catch("").default(""),
  valor_sugerido_ia: z
    .union([z.number().finite().positive(), z.string()])
    .transform((v) => {
      const n = typeof v === "number" ? v : Number(String(v).replace(/[^\d.,-]/g, "").replace(",", "."));
      return Number.isFinite(n) && n > 0 ? n : undefined;
    })
    .optional()
    .catch(undefined),
  fundamentacao: z.string().trim().max(8000).catch("").default(""),
  conclusao: z.string().trim().max(4000).catch("").default(""),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Expose-Headers": "x-request-id",
};

const SYSTEM = `Você é um perito avaliador imobiliário sênior, especialista na ABNT NBR 14.653.
Analisa amostras comparáveis de mercado, identifica inconsistências, julga a suficiência amostral
e produz fundamentação técnica clara e juridicamente robusta. Responde SEMPRE em JSON válido em pt-BR.`;

// ---------- Structured logging ----------

type LogLevel = "info" | "warn" | "error";
function log(requestId: string, level: LogLevel, event: string, fields: Record<string, unknown> = {}) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    fn: "avaliacao-wizard-ia",
    request_id: requestId,
    event,
    ...fields,
  };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

function newRequestId(req: Request): string {
  return (
    req.headers.get("x-request-id") ||
    req.headers.get("x-correlation-id") ||
    (globalThis.crypto?.randomUUID?.() ?? `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`)
  );
}

function jsonResponse(requestId: string, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "x-request-id": requestId,
    },
  });
}

// ---------- Helpers ----------

function buildPrompt(input: any) {
  return `Dados do imóvel avaliando:
${JSON.stringify(input.imovel, null, 2)}

Área de referência: ${input.area} m²
Estatísticas R$/m² (após homogeneização):
${JSON.stringify(input.estatisticas, null, 2)}

Qualidade da amostra: ${JSON.stringify(input.qualidade)}
Valor sugerido pelo motor de cálculo: R$ ${input.valor_sugerido}

Comparáveis homogeneizados:
${JSON.stringify(input.comparaveis?.slice(0, 12), null, 2)}

Responda APENAS com JSON no formato:
{
  "inconsistencias": ["..."],
  "suficiencia": "texto explicando se a amostra é suficiente (mínimo 5 elementos, CV < 30% etc.)",
  "valor_sugerido_ia": numero_em_reais,
  "fundamentacao": "fundamentação técnica de 2-4 parágrafos citando NBR 14.653, método comparativo, fatores aplicados",
  "conclusao": "conclusão objetiva indicando o valor final e a faixa de variação"
}`;
}

function safeJson(text: string): any {
  try { return JSON.parse(text); } catch { /* try fence */ }
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) { try { return JSON.parse(m[1]); } catch { /* ignore */ } }
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) {
    try { return JSON.parse(text.slice(first, last + 1)); } catch { /* ignore */ }
  }
  return null;
}

serve(async (req) => {
  const requestId = newRequestId(req);
  const startedAt = performance.now();

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const ctx: {
    userId: string | null;
    provider?: string;
    model?: string;
    upstream_status?: number;
  } = { userId: null };

  const persistAudit = async (
    status: "ok" | "error",
    httpStatus: number,
    extra: Record<string, unknown>,
    errorMessage?: string,
  ) => {
    try {
      await supabase.from("edge_function_requests").insert({
        request_id: requestId,
        function_name: "avaliacao-wizard-ia",
        user_id: ctx.userId,
        status,
        http_status: httpStatus,
        duration_ms: Math.round(performance.now() - startedAt),
        error_message: errorMessage ?? null,
        metadata: {
          provider: ctx.provider ?? null,
          model: ctx.model ?? null,
          upstream_status: ctx.upstream_status ?? null,
          user_agent: req.headers.get("user-agent") ?? null,
          ...extra,
        },
      });
    } catch (e: any) {
      log(requestId, "warn", "audit_persist_failed", { error: e?.message });
    }
  };

  const finish = (status: number, extra: Record<string, unknown> = {}) => {
    const duration_ms = Math.round(performance.now() - startedAt);
    log(requestId, status >= 500 ? "error" : status >= 400 ? "warn" : "info", "request_finished", {
      status,
      duration_ms,
      ...extra,
    });
    void persistAudit(
      status >= 400 ? "error" : "ok",
      status,
      extra,
      status >= 400 ? (extra.reason as string | undefined) : undefined,
    );
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { ...corsHeaders, "x-request-id": requestId } });
  }

  log(requestId, "info", "request_started", {
    method: req.method,
    user_agent: req.headers.get("user-agent") || null,
  });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace("Bearer ", "");

    const tAuth = performance.now();
    const { data: userData, error: authError } = await supabase.auth.getUser(jwt);
    const userId = userData.user?.id;
    ctx.userId = userId ?? null;
    log(requestId, userId ? "info" : "warn", "auth_resolved", {
      duration_ms: Math.round(performance.now() - tAuth),
      authenticated: !!userId,
      user_id: userId || null,
      error: authError?.message || null,
    });
    if (!userId) {
      finish(401, { reason: "unauthenticated" });
      return jsonResponse(requestId, { error: "Não autenticado", request_id: requestId }, 401);
    }

    let input: any;
    try {
      input = await req.json();
    } catch (e: any) {
      log(requestId, "warn", "invalid_body", { error: e?.message });
      finish(400, { reason: "invalid_json_body" });
      return jsonResponse(requestId, { error: "Corpo inválido", request_id: requestId }, 400);
    }

    log(requestId, "info", "input_received", {
      comparaveis_count: Array.isArray(input?.comparaveis) ? input.comparaveis.length : 0,
      area: input?.area ?? null,
      valor_sugerido: input?.valor_sugerido ?? null,
      qualidade_nivel: input?.qualidade?.nivel ?? null,
    });

    const tCfg = performance.now();
    const _iaGate = await requireUserAi(supabase, userId, corsHeaders);
    if (_iaGate.response) return _iaGate.response;
    const { apiKey, aiUrl, model, authHeaderAi, provider, isByok } = await getAiConfig(supabase, userId);
    ctx.provider = provider;
    ctx.model = model;
    log(requestId, "info", "ai_config_loaded", {
      duration_ms: Math.round(performance.now() - tCfg),
      provider,
      model,
      byok: isByok,
    });

    const tAi = performance.now();
    let text = "";
    try {
      text = await legacyCallAi(
        { apiKey, aiUrl, model, authHeaderAi, provider },
        SYSTEM,
        buildPrompt(input),
        { temperature: 0.4, wantJson: true },
      );
    } catch (e: any) {
      const duration_ms = Math.round(performance.now() - tAi);
      log(requestId, "error", "ai_fetch_failed", {
        duration_ms, provider, model,
        error: e?.message || String(e),
      });
      finish(502, { reason: "ai_fetch_failed", provider });
      return jsonResponse(
        requestId,
        { error: e?.message || "Falha ao chamar IA", request_id: requestId },
        200,
      );
    }
    const aiDuration = Math.round(performance.now() - tAi);
    log(requestId, "info", "ai_response_ok", {
      duration_ms: aiDuration,
      provider,
      model,
      response_chars: text?.length ?? 0,
    });

    const rawParsed = safeJson(text);
    if (!rawParsed) {
      log(requestId, "warn", "ai_response_unparseable", {
        snippet: (text || "").slice(0, 200),
      });
    }
    const baseParsed = rawParsed || {
      inconsistencias: [],
      suficiencia: text.slice(0, 400),
      fundamentacao: text,
      conclusao: `Valor sugerido: R$ ${input.valor_sugerido}`,
    };

    // Validação de schema antes de devolver ao cliente (defesa em profundidade)
    const validated = iaSchema.safeParse(baseParsed);
    const payload = validated.success
      ? validated.data
      : {
          inconsistencias: [],
          suficiencia: "",
          fundamentacao: typeof baseParsed?.fundamentacao === "string" ? baseParsed.fundamentacao : "",
          conclusao: typeof baseParsed?.conclusao === "string" ? baseParsed.conclusao : "",
        };

    if (!validated.success) {
      log(requestId, "warn", "schema_validation_failed", {
        issues: validated.error.issues.slice(0, 5).map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      });
    } else {
      log(requestId, "info", "schema_validated", {
        inconsistencias_count: payload.inconsistencias.length,
        has_valor_ia: typeof (payload as any).valor_sugerido_ia === "number",
        fundamentacao_chars: payload.fundamentacao.length,
        conclusao_chars: payload.conclusao.length,
      });
    }

    finish(200, { provider, model, upstream_duration_ms: aiDuration });
    return jsonResponse(requestId, payload, 200);
  } catch (e: any) {
    log(requestId, "error", "unhandled_exception", {
      error_name: e?.name || "Error",
      error: e?.message || String(e),
      stack: (e?.stack || "").split("\n").slice(0, 5).join(" | "),
    });
    finish(500, { reason: "unhandled_exception" });
    return jsonResponse(
      requestId,
      { error: e?.message || "Erro desconhecido", request_id: requestId },
      500,
    );
  }
});
