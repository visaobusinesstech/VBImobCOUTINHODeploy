// RadarZAP — Job agendado. Roda descoberta de grupos para cada imobiliária
// com config ativa cuja `proxima_execucao` já venceu. Registra log detalhado.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { normalizarInvite, parseFirecrawlSearch } from '../_shared/firecrawlParser.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');

const CIDADES_DEFAULT = [
  'Brasília', 'Águas Claras', 'Taguatinga', 'Ceilândia', 'Guará',
  'Sobradinho', 'Samambaia', 'Gama', 'Vicente Pires',
];
const CATEGORIAS = [
  { termo: 'condomínio', cat: 'condominio' },
  { termo: 'imóveis', cat: 'bairro' },
  { termo: 'aluguel', cat: 'bairro' },
  { termo: 'venda de imóveis', cat: 'bairro' },
];


async function firecrawlSearch(query: string) {
  const r = await fetch('https://api.firecrawl.dev/v2/search', {
    method: 'POST',
    headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, limit: 20, lang: 'pt', country: 'br' }),
  });
  if (!r.ok) return { items: [] as any[], error: `Firecrawl ${r.status}` };
  const j = await r.json();
  const { items } = parseFirecrawlSearch(j);
  return { items, error: null as string | null };
}

async function executarConfig(admin: ReturnType<typeof createClient>, cfg: any) {
  const started = Date.now();
  const { data: logIns } = await admin.from('radarzap_execucoes_log').insert({
    imobiliaria_id: cfg.imobiliaria_id,
    config_id: cfg.id,
    status: 'em_execucao',
  }).select('id').single();
  const logId = logIns?.id;

  const encontrados = new Map<string, any>();
  const erros: string[] = [];
  let queriesExec = 0;
  const maxGrupos = cfg.max_grupos_por_execucao ?? 20;
  const cidades: string[] = (cfg.cidades?.length ? cfg.cidades : CIDADES_DEFAULT);
  const termoExtra: string = (cfg.termo_extra ?? '').trim();

  outer:
  for (const cidade of cidades) {
    for (const { termo, cat } of CATEGORIAS) {
      const q = `site:chat.whatsapp.com ${termo} ${cidade}${termoExtra ? ' ' + termoExtra : ''}`;
      queriesExec++;
      const { items, error } = await firecrawlSearch(q);
      if (error) erros.push(`${cidade}/${termo}: ${error}`);
      for (const it of items) {
        const url = it?.url || it?.link;
        const invite = url ? normalizarInvite(url) : null;
        if (!invite || encontrados.has(invite)) continue;
        encontrados.set(invite, {
          imobiliaria_id: cfg.imobiliaria_id,
          invite_url: invite,
          nome: it?.title ?? null,
          descricao: it?.description ?? it?.snippet ?? null,
          categoria: cat,
          cidade,
          uf: 'DF',
          origem: 'agendado',
          status: 'novo',
        });
      }
      if (queriesExec >= 20 || encontrados.size >= maxGrupos) break outer;
    }
  }

  let novos = 0;
  if (encontrados.size > 0) {
    const rows = Array.from(encontrados.values()).slice(0, maxGrupos);
    const { data: ins, error: insErr } = await admin
      .from('radarzap_grupos')
      .upsert(rows, { onConflict: 'imobiliaria_id,invite_url', ignoreDuplicates: true })
      .select('id');
    if (insErr) erros.push(`Insert: ${insErr.message}`);
    novos = ins?.length ?? 0;
  }

  const finalizadoEm = new Date();
  const proxima = new Date(Date.now() + (cfg.frequencia_horas ?? 24) * 3600_000);
  const status = erros.length && encontrados.size === 0 ? 'erro' : (erros.length ? 'parcial' : 'sucesso');

  await admin.from('radarzap_execucoes_log').update({
    finalizado_em: finalizadoEm.toISOString(),
    duracao_ms: Date.now() - started,
    status,
    queries_executadas: queriesExec,
    grupos_encontrados: encontrados.size,
    grupos_novos: novos,
    erros,
    detalhes: { cidades, termo_extra: termoExtra, max_grupos: maxGrupos },
  }).eq('id', logId);

  await admin.from('radarzap_agendamento_config').update({
    ultima_execucao: finalizadoEm.toISOString(),
    proxima_execucao: proxima.toISOString(),
  }).eq('id', cfg.id);

  return { config_id: cfg.id, status, encontrados: encontrados.size, novos };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    if (!FIRECRAWL_API_KEY) {
      return new Response(JSON.stringify({ error: 'FIRECRAWL_API_KEY ausente' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = await req.json().catch(() => ({} as any));
    const forceImob: string | null = body?.imobiliaria_id ?? null;

    let query = admin.from('radarzap_agendamento_config').select('*').eq('ativo', true);
    if (forceImob) {
      query = admin.from('radarzap_agendamento_config').select('*').eq('imobiliaria_id', forceImob);
    } else {
      query = query.lte('proxima_execucao', new Date().toISOString());
    }

    const { data: configs, error } = await query.limit(25);
    if (error) throw error;

    const resultados: any[] = [];
    for (const cfg of configs ?? []) {
      try { resultados.push(await executarConfig(admin, cfg)); }
      catch (e) { resultados.push({ config_id: cfg.id, status: 'erro', error: String(e) }); }
    }

    return new Response(JSON.stringify({ ok: true, processados: resultados.length, resultados }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
