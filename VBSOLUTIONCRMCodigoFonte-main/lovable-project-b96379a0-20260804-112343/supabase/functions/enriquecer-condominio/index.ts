import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2.45.0';

const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

type ContatoTipo = 'administradora' | 'sindico' | 'portaria' | 'imobiliaria' | 'outro';

interface ExtraidoContato {
  tipo: ContatoTipo;
  nome?: string;
  cargo?: string;
  telefone?: string;
  email?: string;
  url_fonte: string;
  trecho_fonte?: string;
  confianca: number;
}

// Regex públicas
const RE_TEL = /(?:\+?55\s?)?(?:\(?\d{2}\)?[\s.-]?)?(?:9?\d{4}[\s.-]?\d{4})/g;
const RE_EMAIL = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

function limparTel(t: string): string | null {
  const d = t.replace(/\D/g, '');
  if (d.length < 10 || d.length > 13) return null;
  // Remove country code duplicado
  const nat = d.length >= 12 ? d.slice(-11) : d;
  return nat;
}

function extrairContatos(texto: string, url: string, tipoHint: ContatoTipo): ExtraidoContato[] {
  if (!texto) return [];
  const clean = texto.replace(/\s+/g, ' ').trim().slice(0, 20000);
  const telefones = new Set<string>();
  const emails = new Set<string>();

  for (const m of clean.matchAll(RE_TEL)) {
    const t = limparTel(m[0]);
    if (t) telefones.add(t);
  }
  for (const m of clean.matchAll(RE_EMAIL)) {
    const e = m[0].toLowerCase();
    // ignore images/tracking pixels
    if (!/\.(png|jpg|jpeg|gif|svg|webp)$/.test(e)) emails.add(e);
  }

  const contatos: ExtraidoContato[] = [];
  const trecho = clean.slice(0, 400);

  for (const tel of telefones) {
    contatos.push({
      tipo: tipoHint,
      telefone: tel,
      url_fonte: url,
      trecho_fonte: trecho,
      confianca: tipoHint === 'administradora' ? 70 : 55,
    });
  }
  for (const em of emails) {
    contatos.push({
      tipo: tipoHint,
      email: em,
      url_fonte: url,
      trecho_fonte: trecho,
      confianca: tipoHint === 'administradora' ? 75 : 55,
    });
  }
  return contatos;
}

async function firecrawlSearch(query: string, limit = 5) {
  if (!FIRECRAWL_API_KEY) throw new Error('FIRECRAWL_API_KEY não configurada');
  const r = await fetch('https://api.firecrawl.dev/v2/search', {
    method: 'POST',
    headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      limit,
      country: 'br',
      lang: 'pt',
      scrapeOptions: { formats: ['markdown'] },
    }),
  });
  if (!r.ok) throw new Error(`Firecrawl search ${r.status}: ${await r.text()}`);
  const j = await r.json();
  const items = (j?.data ?? j?.results ?? []) as any[];
  return items;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const t0 = Date.now();
  try {
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    if (!token) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const body = await req.json().catch(() => ({}));
    const condominio_nome: string = (body?.condominio_nome ?? '').trim();
    const bairro: string = (body?.bairro ?? '').trim();
    const cep: string = (body?.cep ?? '').trim();
    const condominio_id: string | null = body?.condominio_id ?? null;
    const cidade = bairro ? `${bairro} Brasília DF` : 'Brasília DF';

    if (!condominio_nome || condominio_nome.length < 3) {
      return new Response(JSON.stringify({ error: 'condominio_nome inválido' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const consultas = [
      { q: `"${condominio_nome}" administradora ${cidade} contato`, tipo: 'administradora' as ContatoTipo },
      { q: `"${condominio_nome}" síndico ${cidade} contato telefone`, tipo: 'sindico' as ContatoTipo },
      { q: `"${condominio_nome}" portaria ${cidade} telefone`, tipo: 'portaria' as ContatoTipo },
      { q: `condomínio "${condominio_nome}" ${cidade} imobiliária responsável`, tipo: 'imobiliaria' as ContatoTipo },
    ];

    const todosContatos: ExtraidoContato[] = [];
    const fontesVistas: string[] = [];
    const erros: string[] = [];

    for (const c of consultas) {
      try {
        const items = await firecrawlSearch(c.q, 4);
        for (const it of items) {
          const url = it?.url || it?.metadata?.sourceURL;
          const md = it?.markdown || it?.description || it?.snippet || '';
          if (!url) continue;
          fontesVistas.push(url);
          const contatos = extrairContatos(md, url, c.tipo);
          if (it?.title) {
            contatos.forEach((x) => { if (!x.nome) x.nome = String(it.title).slice(0, 120); });
          }
          todosContatos.push(...contatos);
        }
      } catch (e) {
        erros.push(`${c.tipo}: ${(e as Error).message}`);
      }
    }

    // Dedup em memória por (tipo, tel, email)
    const seen = new Set<string>();
    const unicos = todosContatos.filter((c) => {
      const k = `${c.tipo}|${c.telefone ?? ''}|${c.email ?? ''}`;
      if (seen.has(k)) return false;
      if (!c.telefone && !c.email) return false;
      seen.add(k);
      return true;
    });

    let inseridos = 0;
    if (unicos.length > 0) {
      const rows = unicos.map((c) => ({
        imobiliaria_id: user.id,
        condominio_id,
        condominio_nome,
        tipo: c.tipo,
        nome: c.nome ?? null,
        cargo: c.cargo ?? null,
        telefone: c.telefone ?? null,
        email: c.email ?? null,
        url_fonte: c.url_fonte,
        trecho_fonte: c.trecho_fonte ?? null,
        confianca: c.confianca,
        status: 'pendente',
        metadata: { origem: 'firecrawl_search', bairro, cep },
      }));
      // Upsert manual: tenta inserir, ignora conflitos via dedup unique index
      const { error, count } = await supabase
        .from('condominio_contatos')
        .upsert(rows, { onConflict: 'imobiliaria_id,condominio_nome,telefone,email,tipo', ignoreDuplicates: true, count: 'exact' });
      if (error) erros.push(`insert: ${error.message}`);
      inseridos = count ?? rows.length;
    }

    const status = erros.length > 0 && unicos.length === 0 ? 'erro' : unicos.length === 0 ? 'sem_resultados' : erros.length > 0 ? 'parcial' : 'sucesso';

    await supabase.from('condominio_enriquecimento_runs').insert({
      imobiliaria_id: user.id,
      condominio_nome,
      bairro: bairro || null,
      cep: cep || null,
      consultas: consultas.map((c) => c.q),
      fontes: [...new Set(fontesVistas)],
      contatos_encontrados: inseridos,
      status,
      erro: erros.length > 0 ? erros.join(' | ').slice(0, 500) : null,
      duracao_ms: Date.now() - t0,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        status,
        contatos_encontrados: inseridos,
        fontes: [...new Set(fontesVistas)].length,
        erros,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error('enriquecer-condominio error', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
