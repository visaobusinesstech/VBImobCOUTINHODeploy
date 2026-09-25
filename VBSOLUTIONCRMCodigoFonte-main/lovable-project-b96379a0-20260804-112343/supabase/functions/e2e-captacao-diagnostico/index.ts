// Public E2E diagnostic for the Captação pipeline.
// Runs without auth. Returns a structured report of every step with pass/fail,
// duration, and detailed error diagnostics so the operator can pinpoint
// broken plumbing (secrets, schema, function deployment, external APIs).
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

type Step = {
  id: string;
  label: string;
  fase: "busca" | "filtro_ia" | "analise_proprietario" | "infra";
  status: "ok" | "warn" | "fail" | "skip";
  duracao_ms: number;
  detalhe?: string;
  erro?: string;
  hint?: string;
  meta?: Record<string, unknown>;
};

async function timed<T>(fn: () => Promise<T>): Promise<{ ms: number; value?: T; err?: Error }> {
  const t0 = performance.now();
  try {
    const value = await fn();
    return { ms: Math.round(performance.now() - t0), value };
  } catch (e) {
    return { ms: Math.round(performance.now() - t0), err: e instanceof Error ? e : new Error(String(e)) };
  }
}

async function checkFunctionDeployed(name: string): Promise<Step> {
  const url = `${SUPABASE_URL}/functions/v1/${name}`;
  const r = await timed(() =>
    fetch(url, { method: "OPTIONS", headers: { "Access-Control-Request-Method": "POST" } })
  );
  if (r.err) {
    return {
      id: `deploy:${name}`, label: `Edge function ${name} respondendo`, fase: "infra",
      status: "fail", duracao_ms: r.ms, erro: r.err.message,
      hint: "Verifique se a função foi implantada com sucesso.",
    };
  }
  const ok = r.value!.status >= 200 && r.value!.status < 500;
  return {
    id: `deploy:${name}`, label: `Edge function ${name} respondendo`, fase: "infra",
    status: ok ? "ok" : "fail", duracao_ms: r.ms,
    detalhe: `HTTP ${r.value!.status}`,
    ...(ok ? {} : { hint: "Função não responde. Reimplante e cheque logs." }),
  };
}

async function checkTableColumns(
  client: ReturnType<typeof createClient>,
  table: string,
  required: string[],
): Promise<Step> {
  const r = await timed(async () => {
    const { data, error } = await client.rpc("introspect_table_columns", { _table: table });
    if (error) throw new Error(error.message ?? JSON.stringify(error));
    return (data ?? []) as { column_name: string }[];
  });
  if (r.err) {
    return {
      id: `schema:${table}`, label: `Schema de ${table}`, fase: "infra",
      status: "fail", duracao_ms: r.ms, erro: r.err.message,
      hint: "Verifique se a RPC introspect_table_columns existe e tem GRANT para anon.",
    };
  }
  const cols = new Set(r.value!.map((c) => c.column_name));
  const missing = required.filter((c) => !cols.has(c));
  return {
    id: `schema:${table}`, label: `Schema de ${table}`, fase: "infra",
    status: missing.length ? "fail" : "ok", duracao_ms: r.ms,
    detalhe: `${cols.size} colunas`,
    ...(missing.length
      ? { erro: `Colunas ausentes: ${missing.join(", ")}`, hint: "Rode a migração pendente." }
      : {}),
    meta: { required, missing },
  };
}

function checkSecret(name: string, value: string | undefined, fatal: boolean): Step {
  return {
    id: `secret:${name}`, label: `Secret ${name} configurada`, fase: "infra",
    status: value ? "ok" : (fatal ? "fail" : "warn"),
    duracao_ms: 0,
    detalhe: value ? `presente (len=${value.length})` : "ausente",
    ...(value
      ? {}
      : {
          erro: `${name} não configurada`,
          hint: fatal
            ? `Adicione ${name} nas secrets do backend antes de rodar buscas.`
            : `${name} é opcional; algumas rotas usam BYOK do próprio usuário.`,
        }),
  };
}

async function firecrawlDryRun(): Promise<Step> {
  if (!FIRECRAWL_API_KEY) {
    return {
      id: "busca:firecrawl", label: "Firecrawl Search (dry-run)", fase: "busca",
      status: "skip", duracao_ms: 0, detalhe: "sem FIRECRAWL_API_KEY", hint: "Configure a secret para habilitar buscas reais.",
    };
  }
  const r = await timed(() =>
    fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: "apartamento venda proprietário direto brasília", limit: 1 }),
    })
  );
  if (r.err) {
    return {
      id: "busca:firecrawl", label: "Firecrawl Search (dry-run)", fase: "busca",
      status: "fail", duracao_ms: r.ms, erro: r.err.message,
      hint: "Rede/API Firecrawl indisponível ou chave inválida.",
    };
  }
  const status = r.value!.status;
  let sample: unknown = undefined;
  try { sample = await r.value!.json(); } catch { /* ignore */ }
  const ok = status >= 200 && status < 300;
  const count = (sample as { data?: unknown[] })?.data?.length ?? 0;
  return {
    id: "busca:firecrawl", label: "Firecrawl Search (dry-run)", fase: "busca",
    status: ok ? "ok" : "fail", duracao_ms: r.ms,
    detalhe: `HTTP ${status} · ${count} resultado(s)`,
    ...(ok ? {} : {
      erro: JSON.stringify(sample).slice(0, 300),
      hint: status === 401 ? "Chave Firecrawl rejeitada. Rotacione e atualize a secret." : "Verifique quota/plano.",
    }),
  };
}

async function lovableAiDryRun(): Promise<Step> {
  if (!LOVABLE_API_KEY) {
    return {
      id: "filtro:ai-gateway", label: "Lovable AI Gateway (fallback)", fase: "filtro_ia",
      status: "warn", duracao_ms: 0, detalhe: "sem LOVABLE_API_KEY",
      hint: "IA Filtra pode operar apenas com BYOK do usuário logado.",
    };
  }
  const r = await timed(() =>
    fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: "responda apenas: ok" }],
        max_tokens: 4,
      }),
    })
  );
  if (r.err) {
    return {
      id: "filtro:ai-gateway", label: "Lovable AI Gateway (fallback)", fase: "filtro_ia",
      status: "fail", duracao_ms: r.ms, erro: r.err.message,
    };
  }
  const status = r.value!.status;
  const ok = status >= 200 && status < 300;
  return {
    id: "filtro:ai-gateway", label: "Lovable AI Gateway (fallback)", fase: "filtro_ia",
    status: ok ? "ok" : (status === 402 ? "warn" : "fail"),
    duracao_ms: r.ms, detalhe: `HTTP ${status}`,
    ...(status === 402 ? { hint: "Créditos esgotados no workspace do backend." } : {}),
  };
}

async function runReport() {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  const infra: Step[] = [
    checkSecret("SUPABASE_SERVICE_ROLE_KEY", SERVICE_KEY, true),
    checkSecret("SUPABASE_ANON_KEY", ANON_KEY, true),
    checkSecret("FIRECRAWL_API_KEY", FIRECRAWL_API_KEY, false),
    checkSecret("LOVABLE_API_KEY", LOVABLE_API_KEY, false),
  ];

  const parallel = await Promise.all([
    checkFunctionDeployed("captacao-inteligente"),
    checkFunctionDeployed("filtrar-proprietarios-ia"),
    checkFunctionDeployed("analise-proprietario"),
    checkTableColumns(admin, "lista_proprietarios_captacao", [
      "id", "imobiliaria_id", "titulo_imovel", "url_anuncio",
      "motivacao_score", "motivacao_nivel", "cidade", "bairro",
    ]),
    checkTableColumns(admin, "captacoes", ["id", "tipo_imovel", "cidade"]),
    firecrawlDryRun(),
    lovableAiDryRun(),
  ]);

  const steps: Step[] = [...infra, ...parallel];

  const fase = (f: Step["fase"]) => steps.filter((s) => s.fase === f);
  const falhas = steps.filter((s) => s.status === "fail");
  const alertas = steps.filter((s) => s.status === "warn");

  return {
    executado_em: new Date().toISOString(),
    duracao_total_ms: steps.reduce((a, s) => a + s.duracao_ms, 0),
    resumo: {
      total: steps.length,
      ok: steps.filter((s) => s.status === "ok").length,
      warn: alertas.length,
      fail: falhas.length,
      skip: steps.filter((s) => s.status === "skip").length,
    },
    fases: {
      infra: fase("infra"),
      busca: fase("busca"),
      filtro_ia: fase("filtro_ia"),
      analise_proprietario: fase("analise_proprietario"),
    },
    falhas_detalhadas: falhas.map((s) => ({
      id: s.id, label: s.label, fase: s.fase, erro: s.erro, hint: s.hint, detalhe: s.detalhe,
    })),
    alertas: alertas.map((s) => ({ id: s.id, label: s.label, erro: s.erro, hint: s.hint })),
    passou: falhas.length === 0,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const report = await runReport();
    return new Response(JSON.stringify(report, null, 2), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ passou: false, erro_fatal: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
