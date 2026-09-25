// Monitoramento: crawler recorrente de portais imobiliários públicos.
// Para cada fonte 'portal_crawler' ativa, roda uma busca no Firecrawl
// (site:portal query='cidade bairro particular') e materializa as URLs
// como itens em monitoramento_capturas. Deduplica por (fonte_id, external_id).
// Extração real dos dados do anúncio fica com o normalizador (turno seguinte).
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const FIRECRAWL_V2 = 'https://api.firecrawl.dev/v2';

async function fcSearch(query: string, limit = 20): Promise<any[]> {
  if (!FIRECRAWL_API_KEY) throw new Error('FIRECRAWL_API_KEY ausente');
  const r = await fetch(`${FIRECRAWL_V2}/search`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, limit, lang: 'pt', country: 'br' }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error ?? `Firecrawl ${r.status}`);
  const arr = Array.isArray(j?.data) ? j.data : (Array.isArray(j?.web) ? j.web : []);
  return arr;
}

function buildQueries(fonte: any): string[] {
  const cidades = Array.isArray(fonte.cidades_alvo) ? fonte.cidades_alvo : [];
  const bairros = Array.isArray(fonte.bairros_alvo) ? fonte.bairros_alvo : [];
  const ops = Array.isArray(fonte.operacao_alvo) && fonte.operacao_alvo.length
    ? fonte.operacao_alvo : ['venda','locacao'];
  const portais: string[] = fonte?.config?.portais ?? [];
  const termos = fonte?.config?.termos_particular ?? ['particular','proprietario','sem imobiliaria','direto do dono'];
  const qs: string[] = [];
  const cids = cidades.length ? cidades : [''];
  const brs = bairros.length ? bairros : [''];
  for (const portal of portais) {
    for (const op of ops) {
      for (const c of cids) {
        for (const b of brs) {
          for (const t of termos) {
            const q = [`site:${portal}`, op, c, b, t].filter(Boolean).join(' ');
            qs.push(q.trim());
          }
        }
      }
    }
  }
  return qs.slice(0, 30); // limita custo
}

async function processarFonte(fonte: any) {
  const started = Date.now();
  const queries = buildQueries(fonte);
  let capturados = 0, novos = 0, duplicados = 0;
  const erros: string[] = [];

  for (const q of queries) {
    try {
      const items = await fcSearch(q, 20);
      for (const it of items) {
        const url = it?.url ?? it?.link;
        if (!url) continue;
        capturados++;
        const externalId = url.split('#')[0].split('?')[0];
        const row = {
          imobiliaria_id: fonte.imobiliaria_id,
          fonte_id: fonte.id,
          tipo_fonte: 'portal_crawler',
          external_id: externalId,
          url_origem: url,
          titulo: it?.title ?? null,
          texto: it?.description ?? it?.snippet ?? null,
          payload_raw: { query: q, item: it },
          status: 'pendente',
        };
        const { error } = await admin
          .from('monitoramento_capturas')
          .insert(row);
        if (error) {
          if (String(error.code) === '23505') duplicados++;
          else erros.push(`${externalId}: ${error.message}`);
        } else novos++;
      }
    } catch (e) {
      erros.push(`query "${q}": ${String((e as any)?.message ?? e)}`);
    }
  }

  await admin.from('monitoramento_fontes').update({
    ultima_execucao_em: new Date().toISOString(),
    ultima_captura_em: novos > 0 ? new Date().toISOString() : fonte.ultima_captura_em,
    total_capturas: (fonte.total_capturas ?? 0) + novos,
  }).eq('id', fonte.id);

  await admin.from('monitoramento_execucoes_log').insert({
    imobiliaria_id: fonte.imobiliaria_id,
    fonte_id: fonte.id,
    tipo_fonte: 'portal_crawler',
    finalizado_em: new Date().toISOString(),
    duracao_ms: Date.now() - started,
    itens_capturados: capturados,
    itens_novos: novos,
    itens_duplicados: duplicados,
    itens_descartados: 0,
    status: erros.length === 0 ? 'ok' : (novos > 0 ? 'parcial' : 'erro'),
    erro: erros.length ? erros.slice(0, 5).join(' | ') : null,
    detalhes: { queries_executadas: queries.length, erros_count: erros.length },
  });

  return { fonte_id: fonte.id, capturados, novos, duplicados, erros: erros.length };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const fonteId = body?.fonte_id as string | undefined;

    let query = admin.from('monitoramento_fontes').select('*')
      .eq('tipo', 'portal_crawler').eq('ativo', true);
    if (fonteId) query = query.eq('id', fonteId);
    const { data: fontes, error } = await query;
    if (error) throw error;

    const resultados = [];
    for (const f of fontes ?? []) resultados.push(await processarFonte(f));

    return new Response(JSON.stringify({ ok: true, fontes_processadas: resultados.length, resultados }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('monitor-portais-crawl erro:', e);
    return new Response(JSON.stringify({ ok: false, error: String((e as any)?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
