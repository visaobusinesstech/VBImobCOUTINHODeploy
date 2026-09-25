import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireUserAi, callUserAi, tryParseJson, aiErrorResponse } from "../_shared/ai-config.ts";
import { inferTipoImovel, validateRawSchema } from "../_shared/tipoImovel.ts";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Criterio = "probabilidade" | "investimento" | "urgencia" | "portfolio";

interface Body {
  dataset_id?: string | null;
  config?: {
    operacao?: "Venda" | "Aluguel" | null;
    cidade?: string | null;
    bairro?: string | null;
    tipo_imovel?: string | null;
    score_min?: number;
    criterios?: Record<Criterio, number>;
    portfolio_hint?: string | null;
  };
  amostra?: number;
  janela_dias?: number;
  threshold_ai?: number;
  batch_size?: number;
  salvar?: boolean;
  nome?: string;
  notas?: string;
  // ações auxiliares
  action?: "snapshot_dataset";
  dataset_nome?: string;
  dataset_descricao?: string;
}

const CRITERIOS_DEFAULT: Record<Criterio, number> = {
  probabilidade: 40, urgencia: 30, investimento: 15, portfolio: 15,
};

const last8 = (s?: string | null) => {
  if (!s) return null;
  const d = String(s).replace(/\D/g, "");
  return d.length >= 8 ? d.slice(-8) : null;
};

const percentile = (arr: number[], p: number) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1));
  return s[idx];
};

function metricsAt(scoresLabels: { score: number; label: number }[], threshold: number) {
  let tp = 0, fp = 0, tn = 0, fn = 0;
  for (const r of scoresLabels) {
    const pred = r.score >= threshold ? 1 : 0;
    if (pred === 1 && r.label === 1) tp++;
    else if (pred === 1 && r.label === 0) fp++;
    else if (pred === 0 && r.label === 0) tn++;
    else fn++;
  }
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  const accuracy = scoresLabels.length ? (tp + tn) / scoresLabels.length : 0;
  const fpr = fp + tn > 0 ? fp / (fp + tn) : 0;
  const fnr = fn + tp > 0 ? fn / (fn + tp) : 0;
  return { tp, fp, tn, fn, precision, recall, f1, accuracy, fpr, fnr };
}

function rocAndAuc(scoresLabels: { score: number; label: number }[]) {
  const points: { threshold: number; tpr: number; fpr: number }[] = [];
  for (let t = 100; t >= 0; t -= 2) {
    const m = metricsAt(scoresLabels, t);
    points.push({ threshold: t, tpr: +m.recall.toFixed(4), fpr: +m.fpr.toFixed(4) });
  }
  // AUC por trapézios (ordenar por FPR crescente)
  const sorted = [...points].sort((a, b) => a.fpr - b.fpr || a.tpr - b.tpr);
  // adiciona (0,0) e (1,1) se faltarem
  if (sorted[0]?.fpr > 0 || sorted[0]?.tpr > 0) sorted.unshift({ threshold: 100, tpr: 0, fpr: 0 });
  if (sorted[sorted.length - 1]?.fpr < 1 || sorted[sorted.length - 1]?.tpr < 1) sorted.push({ threshold: 0, tpr: 1, fpr: 1 });
  let auc = 0;
  for (let i = 1; i < sorted.length; i++) {
    const dx = sorted[i].fpr - sorted[i - 1].fpr;
    const avgY = (sorted[i].tpr + sorted[i - 1].tpr) / 2;
    auc += dx * avgY;
  }
  return { roc_curve: sorted, auc: Math.max(0, Math.min(1, auc)) };
}

function anonymizeInput(c: any, i: number) {
  const validated = validateRawSchema(c.dados_extraidos_raw);
  const tipoInfo = inferTipoImovel({
    dados_extraidos_raw: c.dados_extraidos_raw,
    tipo_imovel: c.tipo_imovel,
    titulo_imovel: c.titulo_imovel,
    observacoes: c.observacoes,
    descricao: c.descricao,
    url_anuncio: c.url_anuncio,
  });
  return {
    i,
    op: c.operacao,
    tipo: tipoInfo.tipo,
    tipo_source: tipoInfo.source,
    tipo_fallback: tipoInfo.fallback,
    raw_schema_ok: validated.ok,
    bairro: c.bairro,
    cidade: c.cidade,
    preco: c.ultimo_preco ?? c.preco,
    preco_inicial: Array.isArray(c.historico_precos) && c.historico_precos[0]?.preco,
    dias_mercado: c.motivacao_sinais?.dias_no_mercado ?? c.dias_mercado ?? null,
    queda_pct: c.motivacao_sinais?.queda_pct ?? c.queda_pct ?? 0,
    republicacoes: c.motivacao_sinais?.republicacoes ?? c.republicacoes ?? 0,
    fsbo: !!(c.motivacao_sinais?.fsbo ?? c.fsbo),
    score_dor: c.motivacao_score ?? c.score_dor,
    origem: c.origem,
    titulo: (c.titulo_imovel ?? c.titulo ?? "").slice(0, 120),
    descricao: (c.descricao ?? validated.data.descricao ?? "").slice(0, 300),
  };
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const tStart = performance.now();
  let userIdForLog: string | null = null;
  let sbAdminForLog: any = null;
  let bodyForLog: Body = {} as Body;

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

    const anonClient = createClient(sbUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await anonClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sbAdmin = createClient(sbUrl, sbKey);
    sbAdminForLog = sbAdmin;
    userIdForLog = user.id;

    const body: Body = await req.json().catch(() => ({}));
    bodyForLog = body;

    const cfg = body.config || {};
    const criterios = { ...CRITERIOS_DEFAULT, ...(cfg.criterios || {}) };
    const scoreMin = Math.max(0, Math.min(100, cfg.score_min ?? 0));
    const amostra = Math.max(5, Math.min(200, body.amostra ?? 40));
    const janelaDias = Math.max(15, Math.min(180, body.janela_dias ?? 60));
    const thresholdAi = Math.max(0, Math.min(100, body.threshold_ai ?? 60));

    // === 1) Carregar candidatos + labels ===
    let inputs: any[] = [];   // {input, label, meta}
    let datasetInfo: any = null;

    if (body.dataset_id) {
      const { data: ds, error: dsErr } = await sbAdmin
        .from("calibracao_datasets")
        .select("id,nome,total_itens,positivos,janela_dias,itens")
        .eq("id", body.dataset_id)
        .eq("imobiliaria_id", user.id)
        .single();
      if (dsErr || !ds) {
        return new Response(JSON.stringify({ success: false, error_code: "dataset_nao_encontrado", message: "Dataset inexistente ou sem acesso." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      datasetInfo = { id: ds.id, nome: ds.nome };
      const arr = Array.isArray(ds.itens) ? ds.itens : [];
      inputs = arr.slice(0, amostra).map((it: any, i: number) => ({
        input: { ...it.input, i },
        label: it.label ? 1 : 0,
        meta: it.meta || {},
      }));
    } else {
      // Histórico live
      let q = sbAdmin
        .from("lista_proprietarios_captacao")
        .select("id,nome_proprietario,telefone,cidade,bairro,titulo_imovel,operacao,preco,ultimo_preco,origem,url_anuncio,motivacao_score,motivacao_sinais,primeiro_visto_em,ultimo_visto_em,historico_precos,observacoes,dados_extraidos_raw")
        .eq("imobiliaria_id", user.id)
        .gte("motivacao_score", scoreMin)
        .lt("primeiro_visto_em", new Date(Date.now() - janelaDias * 86400_000).toISOString())
        .order("primeiro_visto_em", { ascending: false })
        .limit(amostra);
      if (cfg.operacao) q = q.eq("operacao", cfg.operacao);
      if (cfg.cidade) q = q.ilike("cidade", `%${cfg.cidade}%`);
      if (cfg.bairro) q = q.ilike("bairro", `%${cfg.bairro}%`);
      if (cfg.tipo_imovel) q = q.ilike("titulo_imovel", `%${cfg.tipo_imovel}%`);


      const { data: candidatos, error: dbErr } = await q;
      if (dbErr) {
        console.error("db err", dbErr);
        return new Response(JSON.stringify({ error: "Falha ao carregar amostra" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (!candidatos || candidatos.length < 5) {
        return new Response(JSON.stringify({
          success: false, error_code: "amostra_insuficiente",
          message: `Amostra insuficiente (${candidatos?.length ?? 0}). Precisa de pelo menos 5 proprietários históricos.`,
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: caps } = await sbAdmin
        .from("captacoes")
        .select("telefone_contato,bairro,cidade,tipo_imovel,operacao,created_at")
        .eq("imobiliaria_id", user.id);

      const capsByPhone = new Map<string, string[]>();
      const capsByLocal = new Map<string, string[]>();
      for (const c of caps || []) {
        const p = last8(c.telefone_contato);
        if (p) { const a = capsByPhone.get(p) || []; a.push(c.created_at); capsByPhone.set(p, a); }
        const k = `${(c.cidade || "").toLowerCase()}|${(c.bairro || "").toLowerCase()}|${(c.tipo_imovel || "").toLowerCase()}|${(c.operacao || "").toLowerCase()}`;
        const a2 = capsByLocal.get(k) || []; a2.push(c.created_at); capsByLocal.set(k, a2);
      }

      inputs = candidatos.map((c: any, i: number) => {
        const first = c.primeiro_visto_em ? new Date(c.primeiro_visto_em).getTime() : 0;
        const janelaMs = janelaDias * 86400_000;
        let label = 0;
        const pk = last8(c.telefone);
        if (pk && capsByPhone.has(pk)) {
          for (const t of capsByPhone.get(pk)!) {
            const dt = new Date(t).getTime();
            if (dt >= first && dt <= first + janelaMs) { label = 1; break; }
          }
        }
        if (!label) {
          const tipoInfoLbl = inferTipoImovel({
            dados_extraidos_raw: c.dados_extraidos_raw,
            tipo_imovel: c.tipo_imovel,
            titulo_imovel: c.titulo_imovel,
            observacoes: c.observacoes,
            descricao: c.descricao,
            url_anuncio: c.url_anuncio,
          });
          const tipoC = tipoInfoLbl.tipo;
          const k = `${(c.cidade || "").toLowerCase()}|${(c.bairro || "").toLowerCase()}|${tipoC.toLowerCase()}|${(c.operacao || "").toLowerCase()}`;

          if (capsByLocal.has(k)) {
            for (const t of capsByLocal.get(k)!) {
              const dt = new Date(t).getTime();
              if (dt >= first && dt <= first + janelaMs) { label = 1; break; }
            }
          }
        }

        return {
          input: anonymizeInput(c, i),
          label,
          meta: { id: c.id, nome: c.nome_proprietario },
        };
      });

      // Ação auxiliar: salvar snapshot como dataset e sair
      if (body.action === "snapshot_dataset") {
        const positivos = inputs.reduce((a, b) => a + b.label, 0);
        const { data: ins, error: dsInsErr } = await sbAdmin
          .from("calibracao_datasets")
          .insert({
            imobiliaria_id: user.id,
            criado_por: user.id,
            nome: body.dataset_nome || `Snapshot ${new Date().toISOString().slice(0, 10)}`,
            descricao: body.dataset_descricao || null,
            origem: "snapshot",
            janela_dias: janelaDias,
            periodo_inicio: null,
            periodo_fim: new Date(Date.now() - janelaDias * 86400_000).toISOString(),
            total_itens: inputs.length,
            positivos,
            itens: inputs.map((r) => ({ input: r.input, label: r.label, meta: { nome: r.meta?.nome } })),
          })
          .select("id,nome,total_itens,positivos,criado_em").single();
        if (dsInsErr) {
          return new Response(JSON.stringify({ error: dsInsErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        return new Response(JSON.stringify({ success: true, dataset: ins }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    if (inputs.length < 5) {
      return new Response(JSON.stringify({ success: false, error_code: "amostra_insuficiente", message: "Precisa de pelo menos 5 itens." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // === 2) Preparar chamada IA em batches (para medir latência p95/p99) ===
    const gate = await requireUserAi(sbAdmin, user.id, corsHeaders);
    if (gate.response) return gate.response;
    await sbAdmin.from("ai_usage_log").insert({ user_id: user.id, function_name: "calibrar-filtro-ia" });

    const batchSize = Math.max(3, Math.min(20, body.batch_size ?? Math.max(4, Math.ceil(Math.sqrt(inputs.length)))));
    const batches: any[][] = [];
    for (let i = 0; i < inputs.length; i += batchSize) batches.push(inputs.slice(i, i + batchSize));

    const systemPrompt = `Você é um analista sênior de captação imobiliária. Priorize proprietários com maior potencial de conversão.
Retorne EXCLUSIVAMENTE JSON válido, sem markdown.`;

    const scoreByGlobalIdx = new Map<number, number>();
    const latencias: number[] = [];
    const t0Total = performance.now();
    let modelo: string | undefined; let provider: string | undefined;

    for (let b = 0; b < batches.length; b++) {
      const batch = batches[b];
      const compact = batch.map((r) => r.input);
      const userPrompt = `Pesos (0-100): probabilidade=${criterios.probabilidade}, urgencia=${criterios.urgencia}, investimento=${criterios.investimento}, portfolio=${criterios.portfolio}.
Foco do corretor: ${cfg.portfolio_hint || "sem preferência"}.
Para cada item retorne { i, ai_score } (0-100).
Formato: {"resultados":[{"i":0,"ai_score":85}]}
Candidatos (${compact.length}): ${JSON.stringify(compact)}`;

      const t0 = performance.now();
      const ai = await callUserAi(gate.config, {
        systemPrompt, userPrompt, wantJson: true, temperature: 0.1, maxTokens: 1500, timeoutMs: 45000,
      });
      const dt = performance.now() - t0;
      if (!ai.ok) return aiErrorResponse(ai, corsHeaders);
      latencias.push(dt);
      modelo = ai.model; provider = ai.provider;

      const parsed = tryParseJson<{ resultados?: any[] }>(ai.text);
      const raw = Array.isArray(parsed?.resultados) ? parsed!.resultados! : [];
      const localByI = new Map<number, number>();
      for (const r of raw) {
        if (typeof r?.i === "number") {
          localByI.set(r.i, Math.max(0, Math.min(100, Math.round(Number(r.ai_score) || 0))));
        }
      }
      for (const item of batch) {
        const localI = item.input.i;
        const s = localByI.get(localI) ?? 0;
        // localI é o índice global (atribuído na construção do input)
        scoreByGlobalIdx.set(localI, s);
      }
    }
    const totalLatency = performance.now() - t0Total;

    // === 3) Métricas ===
    const scoresLabels = inputs.map((r) => ({ score: scoreByGlobalIdx.get(r.input.i) ?? 0, label: r.label }));
    const positivosReais = scoresLabels.reduce((a, r) => a + r.label, 0);
    const m = metricsAt(scoresLabels, thresholdAi);
    const positivosPreditos = m.tp + m.fp;
    const conversaoPreditos = positivosPreditos > 0 ? m.tp / positivosPreditos : 0;
    const conversaoGeral = scoresLabels.length ? positivosReais / scoresLabels.length : 0;
    const lift = conversaoGeral > 0 ? conversaoPreditos / conversaoGeral : 0;

    const sweep: any[] = [];
    for (let t = 0; t <= 100; t += 5) {
      const mm = metricsAt(scoresLabels, t);
      sweep.push({ threshold: t, precision: +mm.precision.toFixed(4), recall: +mm.recall.toFixed(4), f1: +mm.f1.toFixed(4), fpr: +mm.fpr.toFixed(4), fnr: +mm.fnr.toFixed(4) });
    }
    const { roc_curve, auc } = rocAndAuc(scoresLabels);

    const latencyAvg = Math.round(latencias.reduce((a, b) => a + b, 0) / Math.max(1, latencias.length));
    const latencyP50 = Math.round(percentile(latencias, 50));
    const latencyP95 = Math.round(percentile(latencias, 95));
    const latencyP99 = Math.round(percentile(latencias, 99));

    const resultadosAmostra = inputs.map((r) => ({
      id: r.meta?.id ?? null,
      nome: r.meta?.nome ?? "—",
      cidade: r.input.cidade,
      bairro: r.input.bairro,
      operacao: r.input.op,
      score_dor: r.input.score_dor ?? 0,
      ai_score: scoreByGlobalIdx.get(r.input.i) ?? 0,
      predito: (scoreByGlobalIdx.get(r.input.i) ?? 0) >= thresholdAi ? 1 : 0,
      real: r.label,
    }));

    let runId: string | null = null;
    if (body.salvar) {
      const { data: ins, error: insErr } = await sbAdmin.from("calibracao_filtro_ia_runs").insert({
        imobiliaria_id: user.id, criado_por: user.id,
        nome: body.nome || null, notas: body.notas || null,
        dataset_id: body.dataset_id || null,
        config: { ...cfg, criterios, batch_size: batchSize },
        janela_dias: janelaDias, threshold_ai: thresholdAi,
        amostra_total: scoresLabels.length, positivos_reais: positivosReais,
        positivos_preditos: positivosPreditos,
        tp: m.tp, fp: m.fp, tn: m.tn, fn: m.fn,
        precision_v: +m.precision.toFixed(4), recall_v: +m.recall.toFixed(4),
        f1_v: +m.f1.toFixed(4), accuracy_v: +m.accuracy.toFixed(4),
        fpr: +m.fpr.toFixed(4), fnr: +m.fnr.toFixed(4), auc: +auc.toFixed(4),
        conversao_preditos: +conversaoPreditos.toFixed(4),
        conversao_geral: +conversaoGeral.toFixed(4),
        lift: +lift.toFixed(3),
        threshold_sweep: sweep, roc_curve, resultados_amostra: resultadosAmostra,
        latency_ms_avg: latencyAvg, latency_ms_p50: latencyP50, latency_ms_p95: latencyP95, latency_ms_p99: latencyP99,
        latency_ms_total: Math.round(totalLatency), latency_batches: batches.length,
        modelo, provider,
        status: "success",
        duracao_ms: Math.round(performance.now() - tStart),
        finalizado_em: new Date().toISOString(),

      }).select("id").single();
      if (insErr) console.error("save calibracao err", insErr);
      runId = ins?.id ?? null;
    }

    // Diagnóstico de qualidade do schema (para o painel de calibração exibir aviso)
    const schemaDiag = {
      total: inputs.length,
      raw_ok: inputs.filter((r: any) => r.input.raw_schema_ok).length,
      tipo_fallback: inputs.filter((r: any) => r.input.tipo_fallback).length,
      tipo_default: inputs.filter((r: any) => r.input.tipo === "imovel" && r.input.tipo_source === "default").length,
      fontes_tipo: inputs.reduce((acc: Record<string, number>, r: any) => {
        const s = r.input.tipo_source || "unknown";
        acc[s] = (acc[s] ?? 0) + 1;
        return acc;
      }, {}),
    };

    return new Response(JSON.stringify({
      success: true, run_id: runId, dataset: datasetInfo,
      amostra_total: scoresLabels.length, janela_dias: janelaDias, threshold_ai: thresholdAi,
      positivos_reais: positivosReais, positivos_preditos: positivosPreditos,
      tp: m.tp, fp: m.fp, tn: m.tn, fn: m.fn,
      precision: +m.precision.toFixed(4), recall: +m.recall.toFixed(4),
      f1: +m.f1.toFixed(4), accuracy: +m.accuracy.toFixed(4),
      fpr: +m.fpr.toFixed(4), fnr: +m.fnr.toFixed(4), auc: +auc.toFixed(4),
      conversao_preditos: +conversaoPreditos.toFixed(4),
      conversao_geral: +conversaoGeral.toFixed(4), lift: +lift.toFixed(3),
      threshold_sweep: sweep, roc_curve, resultados_amostra: resultadosAmostra,
      latency_ms_avg: latencyAvg, latency_ms_p50: latencyP50, latency_ms_p95: latencyP95, latency_ms_p99: latencyP99,
      latency_ms_total: Math.round(totalLatency), latency_batches: batches.length, batch_size: batchSize,
      modelo, provider,
      schema_diag: schemaDiag,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    const err = e as Error;
    const msg = err?.message?.slice(0, 500) || "Erro desconhecido";
    const stack = (err?.stack || "").slice(0, 2000);
    const duracao = Math.round(performance.now() - tStart);
    // fingerprint estável (ignora IDs/números)
    const fingerprint = msg
      .toLowerCase()
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "#uuid")
      .replace(/\d+/g, "#")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 160);

    // Log estruturado (JSON linha única) para agregadores
    console.error(JSON.stringify({
      level: "error", fn: "calibrar-filtro-ia",
      imobiliaria_id: userIdForLog, fingerprint, msg, duracao_ms: duracao,
      dataset_id: bodyForLog?.dataset_id ?? null,
      janela_dias: bodyForLog?.janela_dias ?? null,
      threshold_ai: bodyForLog?.threshold_ai ?? null,
      amostra: bodyForLog?.amostra ?? null,
      ts: new Date().toISOString(),
    }));

    if (sbAdminForLog && userIdForLog) {
      let runId: string | null = null;
      try {
        const { data: runIns } = await sbAdminForLog
          .from("calibracao_filtro_ia_runs")
          .insert({
            imobiliaria_id: userIdForLog,
            criado_por: userIdForLog,
            nome: bodyForLog?.nome || null,
            notas: bodyForLog?.notas || null,
            dataset_id: bodyForLog?.dataset_id || null,
            config: bodyForLog?.config || {},
            janela_dias: Math.max(15, Math.min(180, bodyForLog?.janela_dias ?? 60)),
            threshold_ai: Math.max(0, Math.min(100, bodyForLog?.threshold_ai ?? 60)),
            status: "failure",
            erro: msg,
            duracao_ms: duracao,
            finalizado_em: new Date().toISOString(),
          })
          .select("id")
          .single();
        runId = runIns?.id ?? null;
      } catch (logErr) {
        console.error("failed to persist failure run row:", logErr);
      }

      // Conta recorrências nas últimas 24h e cria notificação se >= 3
      let ocorrencias = 1;
      try {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { count } = await sbAdminForLog
          .from("calibracao_falhas_log")
          .select("id", { count: "exact", head: true })
          .eq("imobiliaria_id", userIdForLog)
          .eq("fingerprint", fingerprint)
          .gte("criado_em", since);
        ocorrencias = (count ?? 0) + 1;
      } catch (_) { /* noop */ }

      // Sanitiza payload — nunca gravar auth/tokens
      const safePayload = {
        nome: bodyForLog?.nome ?? null,
        notas: bodyForLog?.notas ?? null,
        dataset_id: bodyForLog?.dataset_id ?? null,
        janela_dias: bodyForLog?.janela_dias ?? null,
        threshold_ai: bodyForLog?.threshold_ai ?? null,
        amostra: bodyForLog?.amostra ?? null,
        config: bodyForLog?.config ?? {},
      };
      const queryContext = {
        janela_dias: bodyForLog?.janela_dias ?? null,
        dataset_id: bodyForLog?.dataset_id ?? null,
        filtro: bodyForLog?.config?.criterios ?? null,
        score_min: bodyForLog?.config?.score_min ?? null,
        threshold_ai: bodyForLog?.threshold_ai ?? null,
      };

      let shouldNotify = ocorrencias >= 3;
      try {
        await sbAdminForLog.from("calibracao_falhas_log").insert({
          imobiliaria_id: userIdForLog,
          run_id: runId,
          fingerprint,
          erro: msg,
          stack,
          http_status: 500,
          duracao_ms: duracao,
          payload: safePayload,
          query_context: queryContext,
          ai_provider: (bodyForLog?.config as any)?.provider ?? null,
          ai_modelo: (bodyForLog?.config as any)?.modelo ?? null,
          ocorrencias_24h: ocorrencias,
          notificado: shouldNotify,
        });
      } catch (logErr) {
        console.error("failed to persist calibracao_falhas_log:", logErr);
        shouldNotify = false;
      }

      if (shouldNotify) {
        try {
          await sbAdminForLog.from("notifications").insert({
            user_id: userIdForLog,
            title: `Calibração IA falhando (${ocorrencias}x em 24h)`,
            description: `Erro recorrente: ${msg.slice(0, 180)}`,
          });
        } catch (nErr) {
          console.error("failed to create notification:", nErr);
        }
      }
    }

    return new Response(
      JSON.stringify({ error: "Erro ao processar calibração", detalhe: msg, fingerprint }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

});
