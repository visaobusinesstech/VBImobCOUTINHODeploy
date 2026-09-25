// Coleta semiautomática de candidatos a proprietários usando apenas fontes públicas permitidas.
// - Busca via Firecrawl restrita a domínios da allowlist (fonte_tipo=portal_imobiliario).
// - Cria linhas em lista_proprietarios_captacao com status_revisao='pendente' (revisão humana).
// - Registra automaticamente cada campo derivado em captacao_fontes_dados com URL + snippet (dossiê LGPD).
// Base legal: Art. 7º, IV LGPD (dados manifestamente públicos).
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3.23.8';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');

const BodySchema = z.object({
  cidade: z.string().trim().min(2).max(100),
  bairro: z.string().trim().max(120).optional().nullable(),
  operacao: z.enum(['venda', 'aluguel']),
  tipo_imovel: z.string().trim().max(60).optional().nullable(),
  max_candidatos: z.number().int().min(1).max(30).default(10),
  dry_run: z.boolean().optional().default(false),
});

type FireResult = { url: string; title?: string; description?: string; markdown?: string };

const PHONE_RE = /(?:\+?55\s*)?\(?\b0?([1-9]{2})\)?[\s.-]?9?\d{4}[\s.-]?\d{4}\b/g;
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const PRICE_RE = /R\$\s*([\d.]+(?:,\d{2})?)/i;

function extractPhoneE164(text: string): string | null {
  const m = text.match(PHONE_RE);
  if (!m?.length) return null;
  const digits = m[0].replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 13) return null;
  const withCountry = digits.startsWith('55') ? digits : `55${digits}`;
  return `+${withCountry}`;
}
function extractPrice(text: string): number | null {
  const m = text.match(PRICE_RE);
  if (!m) return null;
  const n = Number(m[1].replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
function extractNome(title?: string, snippet?: string): string {
  const src = (title ?? snippet ?? '').split(/[|\-–—]/)[0].trim();
  return (src || 'Proprietário não identificado').slice(0, 120);
}
async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function firecrawlSearch(query: string, limit = 10): Promise<FireResult[]> {
  if (!FIRECRAWL_API_KEY) return [];
  const r = await fetch('https://api.firecrawl.dev/v2/search', {
    method: 'POST',
    headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, limit, lang: 'pt', country: 'br' }),
  });
  if (!r.ok) return [];
  const j = await r.json().catch(() => ({}));
  const arr: any[] = j?.data ?? [];
  return arr.map((x) => ({ url: x.url, title: x.title, description: x.description, markdown: x.markdown }))
            .filter((x) => x.url);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    if (!token) return jerr(401, 'Não autenticado');
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    const { data: userData } = await supabase.auth.getUser(token);
    const user = userData?.user;
    if (!user) return jerr(401, 'Não autenticado');

    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return jerr(400, 'Payload inválido', parsed.error.flatten());
    const p = parsed.data;

    if (!FIRECRAWL_API_KEY) return jerr(503, 'FIRECRAWL_API_KEY não configurada');

    // Carrega portais imobiliários da allowlist (globais + do tenant)
    const { data: regras } = await admin
      .from('captacao_fontes_allowlist')
      .select('dominio_pattern, fonte_tipo, ativo, imobiliaria_id')
      .eq('ativo', true)
      .eq('fonte_tipo', 'portal_imobiliario')
      .or(`imobiliaria_id.is.null,imobiliaria_id.eq.${user.id}`);
    const portais = Array.from(new Set(
      (regras ?? []).map(r => String(r.dominio_pattern).toLowerCase().replace(/%/g, '').replace(/^\./, ''))
    )).filter(Boolean);
    if (!portais.length) return jerr(400, 'Nenhum portal imobiliário na allowlist');

    const termoOp = p.operacao === 'venda' ? '"vende" OR "à venda"' : '"aluga" OR "para alugar"';
    const tipo = p.tipo_imovel ? `"${p.tipo_imovel}"` : '"apartamento" OR "casa"';
    const local = [p.bairro, p.cidade].filter(Boolean).join(' ');
    const sitesFilter = portais.slice(0, 6).map(d => `site:${d}`).join(' OR ');

    // Multi-pass: (1) proprietário direto, (2) genérico com filtro site:
    const queries = [
      `"proprietário" ${termoOp} ${tipo} ${local} (${sitesFilter})`,
      `${termoOp} ${tipo} ${local} "proprietário direto" (${sitesFilter})`,
    ];

    const seen = new Set<string>();
    const results: FireResult[] = [];
    for (const q of queries) {
      const batch = await firecrawlSearch(q, p.max_candidatos);
      for (const r of batch) {
        const host = safeHost(r.url);
        if (!portais.some(dom => host.includes(dom))) continue;
        if (seen.has(r.url)) continue;
        seen.add(r.url);
        results.push(r);
        if (results.length >= p.max_candidatos) break;
      }
      if (results.length >= p.max_candidatos) break;
    }

    if (p.dry_run) return json({ ok: true, dry_run: true, candidatos: results });

    const criados: Array<{ id: string; url: string; nome: string; fontes: number }> = [];
    const erros: any[] = [];

    for (const r of results) {
      const snippet = (r.description ?? r.markdown ?? '').slice(0, 500);
      const nome = extractNome(r.title, snippet);
      const telefone = extractPhoneE164(`${r.title ?? ''} ${snippet}`);
      const email = (snippet.match(EMAIL_RE)?.[0] ?? null)?.toLowerCase() ?? null;
      const preco = extractPrice(snippet);
      const host = safeHost(r.url);

      // Dedup por url_anuncio (idempotente por tenant)
      const { data: existente } = await admin
        .from('lista_proprietarios_captacao')
        .select('id')
        .eq('imobiliaria_id', user.id)
        .eq('url_anuncio', r.url)
        .maybeSingle();
      if (existente?.id) continue;

      const { data: ins, error: eIns } = await admin
        .from('lista_proprietarios_captacao')
        .insert({
          imobiliaria_id: user.id,
          nome_proprietario: nome,
          telefone: telefone,
          telefone_e164: telefone,
          email: email,
          operacao: p.operacao,
          titulo_imovel: (r.title ?? '').slice(0, 200) || null,
          bairro: p.bairro ?? null,
          cidade: p.cidade,
          preco: preco,
          ultimo_preco: preco,
          origem: `coleta_semiautomatica:${host}`,
          url_anuncio: r.url,
          status_revisao: 'pendente',
          motivo_revisao: 'Coleta semiautomática — revisar antes de contatar',
          dados_extraidos_raw: { title: r.title, description: r.description, host },
          lgpd_status: 'com_fontes',
        })
        .select('id')
        .single();
      if (eIns || !ins) { erros.push({ url: r.url, motivo: eIns?.message ?? 'insert_falhou' }); continue; }

      // Registra fontes por campo (dossiê LGPD)
      const camposParaFontear: Array<[string, string | null]> = [
        ['nome', nome],
        ['cidade', p.cidade],
        ['operacao', p.operacao],
        ['bairro', p.bairro ?? null],
        ['telefone', telefone],
        ['email', email],
        ['preco', preco != null ? String(preco) : null],
        ['tipo_imovel', p.tipo_imovel ?? null],
      ].filter(([, v]) => v != null && String(v).length > 0);

      const fontesRows = await Promise.all(camposParaFontear.map(async ([campo, valor]) => ({
        imobiliaria_id: user.id,
        lead_tipo: 'lista_proprietarios',
        lead_id: ins.id,
        campo,
        valor_capturado: String(valor).slice(0, 2000),
        fonte_url: r.url,
        fonte_tipo: 'portal_imobiliario',
        fonte_titulo: (r.title ?? '').slice(0, 500) || null,
        fonte_snippet: snippet || null,
        base_legal: 'art7_iv_publico',
        metodo_coleta: 'firecrawl',
        coletado_por: user.id,
        hash_conteudo: await sha256(`${r.url}|${campo}|${valor}|${snippet}`),
      })));

      const { error: eFontes } = await admin.from('captacao_fontes_dados').insert(fontesRows);
      if (eFontes) erros.push({ url: r.url, motivo: `fontes: ${eFontes.message}` });

      criados.push({ id: ins.id, url: r.url, nome, fontes: fontesRows.length });
    }

    return json({
      ok: true,
      total_resultados: results.length,
      total_criados: criados.length,
      criados,
      erros,
      portais_consultados: portais,
    });
  } catch (e) {
    console.error('captacao-coletar-candidatos erro:', e);
    return jerr(500, String((e as any)?.message ?? e));
  }
});

function safeHost(u: string): string {
  try { return new URL(u).host.toLowerCase(); } catch { return ''; }
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
function jerr(status: number, error: string, details?: unknown) {
  return json({ ok: false, error, details }, status);
}
