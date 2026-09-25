// Registra uma ou várias fontes públicas para os campos de um lead de captação.
// Valida cada URL contra a allowlist (global ou da imobiliária) antes de gravar.
// Base legal padrão: Art. 7º, IV da LGPD (dados manifestamente públicos).
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3.23.8';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CAMPOS_ACEITOS = [
  'nome','telefone','email','endereco','bairro','cidade','uf',
  'preco','tipo_imovel','operacao','foto','descricao','area','quartos',
] as const;

const FonteSchema = z.object({
  lead_tipo: z.enum(['lista_proprietarios','pipeline']),
  lead_id: z.string().uuid(),
  campo: z.enum(CAMPOS_ACEITOS),
  valor_capturado: z.string().max(2000).nullish(),
  fonte_url: z.string().url().max(2048),
  fonte_titulo: z.string().max(500).nullish(),
  fonte_snippet: z.string().max(500).nullish(),
  base_legal: z.enum(['art7_iv_publico','art7_ix_legitimo_interesse']).default('art7_iv_publico'),
  metodo_coleta: z.enum(['firecrawl','radarzap','manual','import','portal_scraper']).default('manual'),
});
const BodySchema = z.object({ fontes: z.array(FonteSchema).min(1).max(50) });

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

function matchAllowlist(host: string, url: string, regras: Array<{ dominio_pattern: string; fonte_tipo: string }>) {
  const hay = url.toLowerCase();
  for (const r of regras) {
    const pat = r.dominio_pattern.toLowerCase().replace(/%/g, '');
    if (hay.includes(pat) || host.includes(pat)) return r;
  }
  return null;
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

    // Carrega allowlist global + do tenant
    const { data: regras } = await admin
      .from('captacao_fontes_allowlist')
      .select('dominio_pattern, fonte_tipo, imobiliaria_id, ativo')
      .eq('ativo', true)
      .or(`imobiliaria_id.is.null,imobiliaria_id.eq.${user.id}`);
    const ativas = (regras ?? []).filter(r => r.ativo);

    const registradas: any[] = [];
    const rejeitadas: any[] = [];
    const leadsAfetados = new Set<string>();

    for (const f of parsed.data.fontes) {
      let host = '';
      try { host = new URL(f.fonte_url).host.toLowerCase(); } catch { host = ''; }
      const regra = matchAllowlist(host, f.fonte_url, ativas as any);
      if (!regra) {
        rejeitadas.push({ campo: f.campo, url: f.fonte_url, motivo: 'fora_da_allowlist' });
        continue;
      }
      const hash = await sha256(`${f.fonte_url}|${f.campo}|${f.valor_capturado ?? ''}|${f.fonte_snippet ?? ''}`);
      const { data: ins, error } = await admin.from('captacao_fontes_dados').insert({
        imobiliaria_id: user.id,
        lead_tipo: f.lead_tipo,
        lead_id: f.lead_id,
        campo: f.campo,
        valor_capturado: f.valor_capturado ?? null,
        fonte_url: f.fonte_url,
        fonte_tipo: regra.fonte_tipo, // sempre o tipo canônico da regra
        fonte_titulo: f.fonte_titulo ?? null,
        fonte_snippet: f.fonte_snippet ?? null,
        base_legal: f.base_legal,
        metodo_coleta: f.metodo_coleta,
        coletado_por: user.id,
        hash_conteudo: hash,
      }).select('id').single();
      if (error) {
        rejeitadas.push({ campo: f.campo, url: f.fonte_url, motivo: error.message });
      } else {
        registradas.push({ id: ins.id, campo: f.campo });
        leadsAfetados.add(`${f.lead_tipo}:${f.lead_id}`);
      }
    }

    return json({ ok: true, registradas, rejeitadas, leads_afetados: [...leadsAfetados] });
  } catch (e) {
    console.error('captacao-fonte-registrar erro:', e);
    return jerr(500, String((e as any)?.message ?? e));
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
function jerr(status: number, error: string, details?: unknown) {
  return json({ ok: false, error, details }, status);
}
