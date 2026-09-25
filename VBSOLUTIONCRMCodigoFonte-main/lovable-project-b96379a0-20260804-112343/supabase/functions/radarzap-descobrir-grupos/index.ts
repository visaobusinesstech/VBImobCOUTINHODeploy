// RadarZAP — Descoberta de grupos públicos de WhatsApp via Firecrawl
// Busca links chat.whatsapp.com em consultas focadas em Brasília/cidades satélites.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { ensureRadarZapAccess } from '../_shared/radarzapAuth.ts';
import { normalizarInvite, normalizarNomeGrupo, parseFirecrawlSearch } from '../_shared/firecrawlParser.ts';

const CIDADES_DEFAULT = [
  'Brasília', 'Águas Claras', 'Taguatinga', 'Ceilândia', 'Guará',
  'Sobradinho', 'Samambaia', 'Gama', 'Vicente Pires', 'Lago Sul',
  'Lago Norte', 'Noroeste', 'Sudoeste', 'Plano Piloto', 'Núcleo Bandeirante',
];

const CATEGORIAS = [
  { termo: 'condomínio', cat: 'condominio' },
  { termo: 'imóveis', cat: 'bairro' },
  { termo: 'aluguel', cat: 'bairro' },
  { termo: 'venda de imóveis', cat: 'bairro' },
  { termo: 'moradores', cat: 'bairro' },
];


type RetryAttempt = {
  tentativa: number;
  status: number | null;
  duration_ms: number;
  error: string | null;
  backoff_ms: number; // atraso aplicado ANTES desta tentativa (0 na 1ª)
  retryable: boolean;
};

type QueryTelemetry = {
  cidade: string;
  termo: string;
  query: string;
  status: number | null;
  duration_ms: number;
  response_shape: string[];      // ex.: ['data.web:12','data.news:0']
  raw_items: number;
  invites_validos: number;
  invites_novos: number;
  duplicados_local: number;
  duplicados_nome_local: number;
  duplicados_nome_db: number;
  duplicados_invite_db: number;
  descartados_sem_url: number;
  descartados_host_invalido: number;
  // Detalhamento por item descartado por deduplicação (para explicar ao usuário)
  descartados_dedup: Array<{
    invite_url: string;
    nome: string | null;
    criterio: 'invite_local' | 'invite_db' | 'nome_local' | 'nome_db';
    cidade: string;
    termo: string;
  }>;
  error: string | null;
  sample_urls: string[];         // até 3 URLs cruas para inspeção
  body_preview: string | null;   // amostra do body quando não-2xx
  // Política de retry
  tentativas: number;            // total de tentativas efetuadas (>=1)
  retries: number;               // tentativas extras (tentativas - 1)
  retry_total_ms: number;        // soma de backoff + duração de todas as tentativas
  retry_attempts: RetryAttempt[];
  retry_esgotado: boolean;       // true se todas as tentativas falharam
};

// Política de retry — status/erros classificados como transitórios
const RETRY_MAX_ATTEMPTS = 3;       // 1 chamada + 2 retries
const RETRY_BASE_MS = 500;          // backoff exponencial base
const RETRY_MAX_BACKOFF_MS = 4000;  // teto por espera
const RETRY_JITTER_MS = 250;        // jitter aleatório
const RETRY_BUDGET_MS = 12000;      // orçamento total por query (todas tentativas)

const isRetryableStatus = (s: number | null) =>
  s !== null && (s === 408 || s === 425 || s === 429 || s === 500 || s === 502 || s === 503 || s === 504);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function firecrawlSearchOnce(query: string, apiKey: string) {
  const t0 = performance.now();
  let status: number | null = null;
  try {
    const r = await fetch('https://api.firecrawl.dev/v2/search', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, limit: 20, lang: 'pt', country: 'br' }),
    });
    status = r.status;
    const raw = await r.text();
    const duration = Math.round(performance.now() - t0);
    if (!r.ok) {
      return {
        items: [] as any[],
        error: `Firecrawl HTTP ${r.status}`,
        status, duration, shape: [] as string[],
        bodyPreview: raw.slice(0, 300),
        retryable: isRetryableStatus(status),
      };
    }
    let j: any = null;
    try { j = JSON.parse(raw); } catch {
      return {
        items: [], error: 'JSON inválido do Firecrawl',
        status, duration, shape: [], bodyPreview: raw.slice(0, 300),
        retryable: false,
      };
    }
    const { items, shape } = parseFirecrawlSearch(j);
    return { items, error: null as string | null, status, duration, shape, bodyPreview: null as string | null, retryable: false };
  } catch (e) {
    return {
      items: [], error: `fetch falhou: ${String(e)}`,
      status, duration: Math.round(performance.now() - t0),
      shape: [], bodyPreview: null,
      retryable: true, // erros de rede são transitórios
    };
  }
}

async function firecrawlSearch(query: string, apiKey: string) {
  const attempts: RetryAttempt[] = [];
  const tStart = performance.now();
  let last: Awaited<ReturnType<typeof firecrawlSearchOnce>> | null = null;

  for (let i = 1; i <= RETRY_MAX_ATTEMPTS; i++) {
    let backoff = 0;
    if (i > 1) {
      backoff = Math.min(RETRY_BASE_MS * 2 ** (i - 2), RETRY_MAX_BACKOFF_MS)
        + Math.floor(Math.random() * RETRY_JITTER_MS);
      const gasto = Math.round(performance.now() - tStart);
      if (gasto + backoff > RETRY_BUDGET_MS) break;
      await sleep(backoff);
    }
    const res = await firecrawlSearchOnce(query, apiKey);
    attempts.push({
      tentativa: i,
      status: res.status,
      duration_ms: res.duration,
      error: res.error,
      backoff_ms: backoff,
      retryable: res.retryable,
    });
    last = res;
    if (!res.error) break;                // sucesso
    if (!res.retryable) break;             // falha permanente
    if (i >= RETRY_MAX_ATTEMPTS) break;
    const gasto = Math.round(performance.now() - tStart);
    if (gasto >= RETRY_BUDGET_MS) break;
  }

  const retryTotalMs = Math.round(performance.now() - tStart);
  const esgotado = !!(last?.error) && attempts.length > 1;
  return {
    ...(last as NonNullable<typeof last>),
    tentativas: attempts.length,
    retries: Math.max(0, attempts.length - 1),
    retry_total_ms: retryTotalMs,
    retry_attempts: attempts,
    retry_esgotado: esgotado,
  };
}

// ---------- Fase 2: scrape de agregadores públicos de grupos ----------
// Muitos convites `chat.whatsapp.com` NÃO são indexados pelo Google, mas ficam
// listados em sites agregadores. Esta fase busca esses agregadores via Firecrawl
// e extrai os invites direto do HTML/links da página.

const AGREGADORES: Array<{ id: string; build: (q: string) => string }> = [
  { id: 'gruposwhats.app',      build: (q) => `https://gruposwhats.app/pesquisar/${encodeURIComponent(q)}` },
  { id: 'linksdegrupos.com.br', build: (q) => `https://linksdegrupos.com.br/?s=${encodeURIComponent(q)}` },
  { id: 'gruposdozap.net.br',   build: (q) => `https://gruposdozap.net.br/?s=${encodeURIComponent(q)}` },
  { id: 'gruposwpp.net',        build: (q) => `https://gruposwpp.net/?s=${encodeURIComponent(q)}` },
];

const AGG_MAX_PAGES = 12;          // teto de scrapes por execução
const AGG_MAX_LINKS_PER_PAGE = 30; // teto de invites extraídos por página

type AggScrape = {
  agregador: string;
  page_url: string;
  status: number | null;
  duration_ms: number;
  invites_encontrados: number;
  invites_novos: number;
  duplicados_local: number;
  duplicados_invite_db: number;
  descartados_dedup: Array<{ invite_url: string; nome: string | null; criterio: 'invite_local' | 'invite_db'; agregador: string; termo: string }>;
  sample_invites: string[];
  error: string | null;
  body_preview: string | null;
  termo: string;
};

async function firecrawlScrapePage(url: string, apiKey: string) {
  const t0 = performance.now();
  try {
    const r = await fetch('https://api.firecrawl.dev/v2/scrape', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        formats: ['links', 'html'],
        onlyMainContent: false,
        waitFor: 1500,
      }),
    });
    const status = r.status;
    const raw = await r.text();
    const duration = Math.round(performance.now() - t0);
    if (!r.ok) {
      return { links: [] as string[], html: '', error: `HTTP ${status}`, status, duration, bodyPreview: raw.slice(0, 300) };
    }
    let j: any = null;
    try { j = JSON.parse(raw); } catch {
      return { links: [], html: '', error: 'JSON inválido', status, duration, bodyPreview: raw.slice(0, 300) };
    }
    const data = j?.data ?? j;
    const links: string[] = Array.isArray(data?.links) ? data.links : [];
    const html: string = typeof data?.html === 'string' ? data.html : (typeof data?.rawHtml === 'string' ? data.rawHtml : '');
    return { links, html, error: null as string | null, status, duration, bodyPreview: null as string | null };
  } catch (e) {
    return { links: [], html: '', error: `fetch falhou: ${String(e)}`, status: null as number | null, duration: Math.round(performance.now() - t0), bodyPreview: null };
  }
}

/** Extrai convites chat.whatsapp.com de uma lista de links + HTML bruto. */
function extrairInvitesDe(links: string[], html: string): string[] {
  const set = new Set<string>();
  for (const l of links) {
    const inv = normalizarInvite(String(l));
    if (inv) set.add(inv);
  }
  if (html) {
    const re = /https?:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]+/g;
    for (const m of html.match(re) ?? []) {
      const inv = normalizarInvite(m);
      if (inv) set.add(inv);
    }
  }
  return Array.from(set);
}




Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const runId = crypto.randomUUID();
  const tStart = performance.now();
  console.log(`[radarzap-descobrir-grupos ${runId}] start`);

  try {
    const gate = await ensureRadarZapAccess(req, { requiredPermission: 'radarzap_config' });
    if (!gate.ok) {
      console.warn(`[${runId}] gate FAIL reason=${gate.reason}`);
      return gate.response;
    }
    const { user, supabase } = gate;

    const body = await req.json().catch(() => ({}));
    const cidades: string[] = Array.isArray(body?.cidades) && body.cidades.length ? body.cidades : CIDADES_DEFAULT;
    const termoExtra: string = String(body?.termo ?? '').trim();
    const retryOfRunId: string | null = typeof body?.retry_of_run_id === 'string' ? body.retry_of_run_id : null;
    const retryQueriesRaw: Array<{ cidade?: unknown; termo?: unknown; cat?: unknown }> =
      Array.isArray(body?.retry_queries) ? body.retry_queries : [];
    const retryQueries = retryQueriesRaw
      .map((q) => ({
        cidade: String(q?.cidade ?? '').trim(),
        termo: String(q?.termo ?? '').trim(),
        cat: String(q?.cat ?? q?.termo ?? '').trim(),
      }))
      .filter((q) => q.cidade && q.termo);

    // Reprocessamento: ignorar deduplicação para invites específicos ou todos.
    const ignorarDedupAll: boolean = body?.ignorar_dedup_all === true;
    const reprocessarInvitesRaw: unknown[] = Array.isArray(body?.reprocessar_invites) ? body.reprocessar_invites : [];
    const reprocessarInvites = new Set<string>(
      reprocessarInvitesRaw
        .map((u) => normalizarInvite(String(u ?? '')) ?? '')
        .filter((s) => !!s),
    );
    const somenteAgregadores: boolean = body?.somente_agregadores === true;
    const motivoReprocessamento: string | null = typeof body?.motivo_reprocessamento === 'string'
      ? body.motivo_reprocessamento.trim().slice(0, 500) || null
      : null;
    const modo = retryQueries.length > 0
      ? 'retry_erros'
      : (somenteAgregadores ? 'somente_agregadores'
        : (reprocessarInvites.size > 0 || ignorarDedupAll ? 'reprocessar' : 'completo'));
    console.log(
      `[${runId}] user=${user.id} modo=${modo} cidades=${cidades.length} termo="${termoExtra}"` +
      (retryQueries.length ? ` retry_queries=${retryQueries.length} parent=${retryOfRunId ?? '-'}` : '') +
      (reprocessarInvites.size ? ` reprocessar_invites=${reprocessarInvites.size}` : '') +
      (ignorarDedupAll ? ' ignorar_dedup_all=1' : ''),
    );

    // ---- Validação server-side dos alvos (defesa contra bypass da UI) ----
    // Cada item de `cidades` pode ser: "CEP 00000-000", uma cidade ou um condomínio livre.
    const CIDADES_MAX = 200;
    const ALVO_MIN = 2;
    const ALVO_MAX = 80;
    const ALVO_REGEX = /^[\p{L}\p{N}\s\-'.&/º°ª]+$/u;
    const invalidos: Array<{ valor: string; motivo: string }> = [];
    const cidadesLimpas: string[] = [];
    const seenCidades = new Set<string>();

    if (!Array.isArray(cidades) || cidades.length === 0) {
      return new Response(JSON.stringify({
        error: 'Nenhum alvo informado (cidades/CEPs/condomínios).',
        run_id: runId,
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (cidades.length > CIDADES_MAX) {
      return new Response(JSON.stringify({
        error: `Excedeu o limite de ${CIDADES_MAX} alvos por execução (recebidos ${cidades.length}).`,
        run_id: runId,
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    for (const raw0 of cidades) {
      const raw = String(raw0 ?? '').trim();
      if (!raw) { invalidos.push({ valor: '', motivo: 'vazio' }); continue; }

      // Caso 1: rótulo "CEP xxxxx-xxx"
      if (/^cep\s+/i.test(raw)) {
        const digits = raw.replace(/\D/g, '');
        if (digits.length !== 8) {
          invalidos.push({ valor: raw, motivo: `CEP deve ter 8 dígitos (recebeu ${digits.length})` });
          continue;
        }
        const fmt = `CEP ${digits.slice(0, 5)}-${digits.slice(5)}`;
        const k = fmt.toLowerCase();
        if (seenCidades.has(k)) continue;
        seenCidades.add(k);
        cidadesLimpas.push(fmt);
        continue;
      }

      // Caso 2: token puramente numérico (CEP sem rótulo)
      if (/^[\d\s\-.]+$/.test(raw)) {
        const digits = raw.replace(/\D/g, '');
        if (digits.length !== 8) {
          invalidos.push({ valor: raw, motivo: `CEP deve ter 8 dígitos (recebeu ${digits.length})` });
          continue;
        }
        const fmt = `CEP ${digits.slice(0, 5)}-${digits.slice(5)}`;
        const k = fmt.toLowerCase();
        if (seenCidades.has(k)) continue;
        seenCidades.add(k);
        cidadesLimpas.push(fmt);
        continue;
      }

      // Caso 3: cidade ou condomínio livre
      if (raw.length < ALVO_MIN || raw.length > ALVO_MAX) {
        invalidos.push({ valor: raw, motivo: `tamanho inválido (${ALVO_MIN}-${ALVO_MAX} caracteres)` });
        continue;
      }
      if (!ALVO_REGEX.test(raw)) {
        invalidos.push({ valor: raw, motivo: 'contém caracteres não permitidos' });
        continue;
      }
      const k = raw.toLowerCase();
      if (seenCidades.has(k)) continue;
      seenCidades.add(k);
      cidadesLimpas.push(raw);
    }

    if (termoExtra && (termoExtra.length > 60 || !ALVO_REGEX.test(termoExtra))) {
      invalidos.push({ valor: termoExtra, motivo: 'termo adicional inválido (máx 60 caracteres, sem símbolos)' });
    }

    if (invalidos.length > 0) {
      console.warn(`[${runId}] validação FAIL invalidos=${invalidos.length}`);
      return new Response(JSON.stringify({
        error: 'Alvos inválidos rejeitados pelo backend.',
        invalidos,
        aceitos: cidadesLimpas.length,
        run_id: runId,
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (cidadesLimpas.length === 0) {
      return new Response(JSON.stringify({
        error: 'Nenhum alvo válido após validação.',
        run_id: runId,
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    // Substitui a lista original pela sanitizada; o restante do código usa `cidades`.
    (cidades as string[]).length = 0;
    (cidades as string[]).push(...cidadesLimpas);
    // ---- fim validação ----




    const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
    if (!FIRECRAWL_API_KEY) {
      console.error(`[${runId}] FIRECRAWL_API_KEY ausente`);
      return new Response(JSON.stringify({ error: 'FIRECRAWL_API_KEY não configurada', run_id: runId }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const keyKind = FIRECRAWL_API_KEY.startsWith('fc-')
      ? 'direct(fc-)'
      : FIRECRAWL_API_KEY.startsWith('lovc_')
      ? 'gateway(lovc_) — INCOMPATÍVEL com api.firecrawl.dev'
      : 'desconhecido';
    console.log(`[${runId}] firecrawl_key=${keyKind}`);

    const encontrados = new Map<string, any>();
    const nomesNormEncontrados = new Set<string>();
    const erros: string[] = [];
    const telemetria: QueryTelemetry[] = [];
    let queriesExec = 0;

    // Carrega configuração de normalização por imobiliária (tokens ruidosos + min_length).
    // Se não houver linha configurada, usa os defaults do parser.
    let normOpts: { tokens?: string[]; minLength?: number } | undefined;
    {
      const { data: cfg } = await supabase
        .from('radarzap_normalizacao_config')
        .select('tokens_ruidosos, min_length')
        .eq('imobiliaria_id', user.id)
        .maybeSingle();
      if (cfg) {
        normOpts = {
          tokens: Array.isArray(cfg.tokens_ruidosos) ? cfg.tokens_ruidosos : undefined,
          minLength: typeof cfg.min_length === 'number' ? cfg.min_length : undefined,
        };
        console.log(`[${runId}] normalizacao_cfg: tokens=${normOpts.tokens?.length ?? 0} min=${normOpts.minLength ?? 3}`);
      }
    }

    // Pré-carrega deduplicação a partir do que já existe no banco para este tenant
    // (invite_url canônico + nome normalizado). Evita gravar duplicatas por variação
    // de nome ou por invites conhecidos.
    const invitesDb = new Set<string>();
    const nomesNormDb = new Set<string>();
    {
      const { data: existentes, error: exErr } = await supabase
        .from('radarzap_grupos')
        .select('invite_url, nome')
        .eq('imobiliaria_id', user.id);
      if (exErr) {
        console.warn(`[${runId}] preload dedup falhou: ${exErr.message}`);
      } else {
        for (const g of existentes ?? []) {
          if (g.invite_url) invitesDb.add(String(g.invite_url));
          const nn = normalizarNomeGrupo(g.nome as string | null, normOpts);
          if (nn) nomesNormDb.add(nn);
        }
        console.log(`[${runId}] preload dedup: invites=${invitesDb.size} nomes=${nomesNormDb.size}`);
      }
    }

    // Plano de queries: em modo retry, executa APENAS os pares informados
    // (mesmos parâmetros de cidade/termo/termoExtra da execução original).
    type Plano = { cidade: string; termo: string; cat: string };
    const plano: Plano[] = modo === 'retry_erros'
      ? retryQueries.map((q) => ({ cidade: q.cidade, termo: q.termo, cat: q.cat || q.termo }))
      : cidades.flatMap((cidade) => CATEGORIAS.map(({ termo, cat }) => ({ cidade, termo, cat })));

    outer:
    for (const { cidade, termo, cat } of plano) {
      if (modo === 'somente_agregadores') break outer;
      const q = `site:chat.whatsapp.com ${termo} ${cidade}${termoExtra ? ' ' + termoExtra : ''}`;
      queriesExec++;
      const t = await firecrawlSearch(q, FIRECRAWL_API_KEY);

      let invitesValidos = 0;
      let invitesNovos = 0;
      let duplicadosLocal = 0;
      let duplicadosNomeLocal = 0;
      let duplicadosNomeDb = 0;
      let duplicadosInviteDb = 0;
      let descartadosSemUrl = 0;
      let descartadosHost = 0;
      const sampleUrls: string[] = [];
      const descartadosDedup: QueryTelemetry['descartados_dedup'] = [];

      for (const it of t.items) {
        const url = it?.url || it?.link;
        if (!url) { descartadosSemUrl++; continue; }
        if (sampleUrls.length < 3) sampleUrls.push(String(url));
        const invite = normalizarInvite(url);
        if (!invite) { descartadosHost++; continue; }
        invitesValidos++;
        const nome = (it?.title as string | null) ?? null;
        const forcado = ignorarDedupAll || reprocessarInvites.has(invite);
        if (!forcado) {
          if (encontrados.has(invite)) {
            duplicadosLocal++;
            descartadosDedup.push({ invite_url: invite, nome, criterio: 'invite_local', cidade, termo });
            continue;
          }
          if (invitesDb.has(invite)) {
            duplicadosInviteDb++;
            descartadosDedup.push({ invite_url: invite, nome, criterio: 'invite_db', cidade, termo });
            continue;
          }
        }
        const nomeNorm = normalizarNomeGrupo(nome, normOpts);
        if (!forcado && nomeNorm) {
          if (nomesNormEncontrados.has(nomeNorm)) {
            duplicadosNomeLocal++;
            descartadosDedup.push({ invite_url: invite, nome, criterio: 'nome_local', cidade, termo });
            continue;
          }
          if (nomesNormDb.has(nomeNorm)) {
            duplicadosNomeDb++;
            descartadosDedup.push({ invite_url: invite, nome, criterio: 'nome_db', cidade, termo });
            continue;
          }
        }
        invitesNovos++;
        if (nomeNorm) nomesNormEncontrados.add(nomeNorm);
        encontrados.set(invite, {
          invite_url: invite,
          nome,
          descricao: it?.description ?? it?.snippet ?? null,
          categoria: cat,
          cidade,
          uf: 'DF',
          origem: 'busca',
          status: 'novo',
          _forcado: forcado,
        });
      }

      const linha: QueryTelemetry = {
        cidade,
        termo,
        query: q,
        status: t.status,
        duration_ms: t.duration,
        response_shape: t.shape,
        raw_items: t.items.length,
        invites_validos: invitesValidos,
        invites_novos: invitesNovos,
        duplicados_local: duplicadosLocal,
        duplicados_nome_local: duplicadosNomeLocal,
        duplicados_nome_db: duplicadosNomeDb,
        duplicados_invite_db: duplicadosInviteDb,
        descartados_sem_url: descartadosSemUrl,
        descartados_host_invalido: descartadosHost,
        descartados_dedup: descartadosDedup,
        error: t.error,
        sample_urls: sampleUrls,
        body_preview: t.bodyPreview,
        tentativas: t.tentativas,
        retries: t.retries,
        retry_total_ms: t.retry_total_ms,
        retry_attempts: t.retry_attempts,
        retry_esgotado: t.retry_esgotado,
      };
      telemetria.push(linha);

      console.log(
        `[${runId}] q#${queriesExec} "${cidade}/${termo}" http=${t.status} ${t.duration}ms ` +
        `tentativas=${t.tentativas} retries=${t.retries} retry_ms=${t.retry_total_ms} ` +
        `raw=${t.items.length} validos=${invitesValidos} novos=${invitesNovos} ` +
        `dedup(local=${duplicadosLocal} nomeLoc=${duplicadosNomeLocal} nomeDb=${duplicadosNomeDb} inviteDb=${duplicadosInviteDb}) ` +
        `shape=${t.shape.join(',') || '-'}${t.error ? ` ERR=${t.error}${t.retry_esgotado ? ' (retry esgotado)' : ''}` : ''}`,
      );

      if (t.bodyPreview) console.warn(`[${runId}] body_preview: ${t.bodyPreview}`);
      if (t.error) erros.push(`${cidade}/${termo}: ${t.error}`);

      // Em modo retry não aplicamos o teto de 20 queries — o usuário escolheu quais rodar.
      if (modo === 'completo' && (queriesExec >= 20 || encontrados.size >= 60)) break outer;
    }


    // ================== FASE 2: agregadores públicos ==================
    // Só executa em modo "completo" (não em retry_erros nem reprocessar).
    // Pode ser desligada com body.agregadores_ativo=false.
    const agregadoresAtivo: boolean = body?.agregadores_ativo !== false;
    const aggScrapes: AggScrape[] = [];
    let aggPagesExec = 0;
    let aggInvitesNovos = 0;

    if ((modo === 'completo' || modo === 'somente_agregadores') && agregadoresAtivo) {
      // Monta pares (agregador, query) — uma query por cidade + termoExtra.
      // Queries curtas (2-3 palavras) rendem mais em busca on-site desses portais.
      const termosBase = ['imóveis', 'aluguel', 'venda'];
      const paresAgg: Array<{ agg: typeof AGREGADORES[number]; termo: string; cidade: string }> = [];
      for (const cidade of cidades.slice(0, 6)) {
        for (const t of (termoExtra ? [termoExtra] : termosBase)) {
          for (const agg of AGREGADORES) {
            paresAgg.push({ agg, termo: t, cidade });
          }
        }
      }

      aggOuter:
      for (const { agg, termo: tAgg, cidade } of paresAgg) {
        if (aggPagesExec >= AGG_MAX_PAGES) break;
        if (encontrados.size >= 120) break;
        const pageUrl = agg.build(`${tAgg} ${cidade}`);
        aggPagesExec++;
        const res = await firecrawlScrapePage(pageUrl, FIRECRAWL_API_KEY);

        let invitesNovos = 0;
        let dupLocal = 0;
        let dupDb = 0;
        const descartados: AggScrape['descartados_dedup'] = [];
        const sample: string[] = [];

        if (!res.error) {
          const invites = extrairInvitesDe(res.links, res.html).slice(0, AGG_MAX_LINKS_PER_PAGE);
          for (const invite of invites) {
            if (sample.length < 3) sample.push(invite);
            const forcado = ignorarDedupAll || reprocessarInvites.has(invite);
            if (!forcado) {
              if (encontrados.has(invite)) { dupLocal++; descartados.push({ invite_url: invite, nome: null, criterio: 'invite_local', agregador: agg.id, termo: tAgg }); continue; }
              if (invitesDb.has(invite))   { dupDb++;    descartados.push({ invite_url: invite, nome: null, criterio: 'invite_db',    agregador: agg.id, termo: tAgg }); continue; }
            }
            invitesNovos++;
            encontrados.set(invite, {
              invite_url: invite,
              nome: null,
              descricao: `Descoberto via agregador ${agg.id} (busca "${tAgg} ${cidade}")`,
              categoria: 'agregador',
              cidade,
              uf: 'DF',
              origem: `agregador:${agg.id}`,
              status: 'novo',
              _forcado: forcado,
            });
          }
        }
        aggInvitesNovos += invitesNovos;

        const linhaAgg: AggScrape = {
          agregador: agg.id,
          page_url: pageUrl,
          status: res.status,
          duration_ms: res.duration,
          invites_encontrados: (res.error ? 0 : (extrairInvitesDe(res.links, res.html).length)),
          invites_novos: invitesNovos,
          duplicados_local: dupLocal,
          duplicados_invite_db: dupDb,
          descartados_dedup: descartados,
          sample_invites: sample,
          error: res.error,
          body_preview: res.bodyPreview,
          termo: tAgg,
        };
        aggScrapes.push(linhaAgg);

        console.log(
          `[${runId}] agg#${aggPagesExec} ${agg.id} "${tAgg}/${cidade}" http=${res.status} ${res.duration}ms ` +
          `invites=${linhaAgg.invites_encontrados} novos=${invitesNovos} dedup(local=${dupLocal} db=${dupDb})` +
          (res.error ? ` ERR=${res.error}` : ''),
        );
        if (res.bodyPreview) console.warn(`[${runId}] agg body_preview: ${res.bodyPreview}`);
        if (res.error) erros.push(`agg ${agg.id}/${cidade}: ${res.error}`);
      }
    }
    // ================== FIM FASE 2 ==================




    // Insere ignorando conflitos por (imobiliaria_id, invite_url).
    // Para invites forçados (reprocessamento), faz upsert com merge para atualizar dados.
    let inseridos = 0;
    let reprocessadosAtualizados = 0;
    if (encontrados.size > 0) {
      const todos = Array.from(encontrados.values());
      const forcadosRows = todos.filter((r: any) => r._forcado).map(({ _forcado, ...r }: any) => ({ ...r, imobiliaria_id: user.id, updated_at: new Date().toISOString() }));
      const normaisRows = todos.filter((r: any) => !r._forcado).map(({ _forcado, ...r }: any) => ({ ...r, imobiliaria_id: user.id }));

      if (normaisRows.length) {
        const { data: ins, error: insErr } = await supabase
          .from('radarzap_grupos')
          .upsert(normaisRows, { onConflict: 'imobiliaria_id,invite_url', ignoreDuplicates: true })
          .select('id');
        if (insErr) {
          console.error(`[${runId}] insert error: ${insErr.message}`);
          erros.push(`Insert: ${insErr.message}`);
        }
        inseridos = ins?.length ?? 0;
      }
      if (forcadosRows.length) {
        const { data: upd, error: updErr } = await supabase
          .from('radarzap_grupos')
          .upsert(forcadosRows, { onConflict: 'imobiliaria_id,invite_url', ignoreDuplicates: false })
          .select('id');
        if (updErr) {
          console.error(`[${runId}] reprocessar upsert error: ${updErr.message}`);
          erros.push(`Reprocessar: ${updErr.message}`);
        }
        reprocessadosAtualizados = upd?.length ?? 0;
      }
    }

    const totalMs = Math.round(performance.now() - tStart);
    const totalRaw = telemetria.reduce((s, l) => s + l.raw_items, 0);
    const totalValidos = telemetria.reduce((s, l) => s + l.invites_validos, 0);
    const totalRetries = telemetria.reduce((s, l) => s + l.retries, 0);
    const totalRetryEsgotado = telemetria.filter((l) => l.retry_esgotado).length;
    console.log(
      `[${runId}] done ${totalMs}ms queries=${queriesExec} raw=${totalRaw} validos=${totalValidos} ` +
      `unicos=${encontrados.size} inseridos=${inseridos} erros=${erros.length} ` +
      `retries=${totalRetries} retry_esgotado=${totalRetryEsgotado} ` +
      `agg_pages=${aggPagesExec} agg_novos=${aggInvitesNovos}`,
    );


    // Persistir histórico da execução (best-effort; falha não bloqueia resposta)
    try {
      await supabase.from('radarzap_descoberta_execucoes').insert({
        run_id: runId,
        imobiliaria_id: user.id,
        cidades,
        termo: termoExtra || null,
        firecrawl_key_kind: keyKind,
        queries: queriesExec,
        encontrados: encontrados.size,
        inseridos,
        total_raw_items: totalRaw,
        total_invites_validos: totalValidos,
        total_ms: totalMs,
        erros,
        telemetria,
        modo,
        retry_of_run_id: retryOfRunId,
        ignorar_dedup_all: ignorarDedupAll,
        reprocessar_invites: Array.from(reprocessarInvites),
        agregadores: { pages: aggPagesExec, invites_novos: aggInvitesNovos, scrapes: aggScrapes },
        motivo_reprocessamento: motivoReprocessamento,
      });


    } catch (persistErr) {
      console.error(`[${runId}] persist historico falhou: ${String(persistErr)}`);
    }

    // Alertas: zero resultados / erros Firecrawl / timeout
    try {
      const { data: cfg } = await supabase
        .from('radarzap_metricas_alertas_config')
        .select('ativo, descoberta_alertar_zero, descoberta_alertar_erro, descoberta_alertar_timeout, descoberta_timeout_ms, descoberta_min_erros, janela_horas')
        .eq('imobiliaria_id', user.id)
        .maybeSingle();

      if (cfg?.ativo !== false) {
        const alertas: Array<{ tipo: string; motivo: string; detalhes: Record<string, unknown> }> = [];
        const errosFirecrawl = telemetria.filter((t) => t.error).length;
        const timeoutMs = Number(cfg?.descoberta_timeout_ms ?? 60000);
        const minErros = Number(cfg?.descoberta_min_erros ?? 1);

        if ((cfg?.descoberta_alertar_zero ?? true) && queriesExec > 0 && encontrados.size === 0) {
          alertas.push({
            tipo: 'descoberta_zero',
            motivo: `Busca retornou 0 grupos em ${queriesExec} consultas (${totalRaw} itens brutos).`,
            detalhes: { run_id: runId, queries: queriesExec, total_raw_items: totalRaw, cidades, termo: termoExtra },
          });
        }
        if ((cfg?.descoberta_alertar_erro ?? true) && errosFirecrawl >= minErros) {
          alertas.push({
            tipo: 'descoberta_erro',
            motivo: `${errosFirecrawl} consulta(s) ao Firecrawl com erro (mín. ${minErros}).`,
            detalhes: {
              run_id: runId,
              erros_firecrawl: errosFirecrawl,
              amostras: telemetria.filter((t) => t.error).slice(0, 3).map((t) => ({
                cidade: t.cidade, termo: t.termo, status: t.status, error: t.error,
              })),
            },
          });
        }
        if ((cfg?.descoberta_alertar_timeout ?? true) && totalMs > timeoutMs) {
          alertas.push({
            tipo: 'descoberta_timeout',
            motivo: `Execução levou ${totalMs}ms (limite ${timeoutMs}ms).`,
            detalhes: { run_id: runId, total_ms: totalMs, timeout_ms: timeoutMs, queries: queriesExec },
          });
        }

        for (const a of alertas) {
          await supabase.from('radarzap_metricas_alertas_log').insert({
            imobiliaria_id: user.id,
            tipo: a.tipo,
            taxa_observada: 0,
            taxa_minima: 0,
            total_mensagens: 0,
            total_leads: 0,
            total_aprovados: 0,
            janela_horas: cfg?.janela_horas ?? 24,
            detalhes: { motivo: a.motivo, ...a.detalhes },
          });
          await supabase.from('notifications').insert({
            user_id: user.id,
            title: 'RadarZAP · alerta na descoberta de grupos',
            description: a.motivo,
          });

          console.warn(`[${runId}] alerta ${a.tipo}: ${a.motivo}`);
        }
      }
    } catch (alertErr) {
      console.error(`[${runId}] alertas falhou: ${String(alertErr)}`);
    }


    return new Response(JSON.stringify({
      ok: true,
      run_id: runId,
      modo,
      retry_of_run_id: retryOfRunId,
      firecrawl_key_kind: keyKind,

      queries: queriesExec,
      encontrados: encontrados.size,
      inseridos,
      reprocessados_atualizados: reprocessadosAtualizados,
      total_ms: totalMs,
      total_raw_items: totalRaw,
      total_invites_validos: totalValidos,
      total_retries: totalRetries,
      total_retry_esgotado: totalRetryEsgotado,
      retry_policy: {
        max_attempts: RETRY_MAX_ATTEMPTS,
        base_ms: RETRY_BASE_MS,
        max_backoff_ms: RETRY_MAX_BACKOFF_MS,
        jitter_ms: RETRY_JITTER_MS,
        budget_ms: RETRY_BUDGET_MS,
        retryable_status: [408, 425, 429, 500, 502, 503, 504],
      },
      erros,
      telemetria,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });


  } catch (e) {
    console.error(`[${runId}] fatal: ${String(e)}`);
    return new Response(JSON.stringify({ error: String(e), run_id: runId }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
