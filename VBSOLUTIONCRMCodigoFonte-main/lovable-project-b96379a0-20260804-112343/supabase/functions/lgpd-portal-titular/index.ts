// Portal público do titular (LGPD). Fluxo em 2 passos:
//   1) POST /solicitar-token  { contato: telefone|email }  -> gera token efêmero
//      (registrado em captacao_lgpd_solicitacoes.token_verificacao) e devolve
//      apenas confirmação (não envia mensagem — front instrui o titular).
//   2) POST /consultar        { token }                    -> devolve dados + fontes
//   3) POST /solicitar        { token, tipo, descricao }   -> registra pedido
// Não usa JWT: é público por definição. Rate limit simples por IP (memória).
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3.23.8';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const RATE = new Map<string, { count: number; resetAt: number }>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const cur = RATE.get(ip);
  if (!cur || cur.resetAt < now) { RATE.set(ip, { count: 1, resetAt: now + 60_000 }); return false; }
  cur.count++;
  return cur.count > 20;
}

function normalizePhone(s: string) { return s.replace(/\D/g, ''); }

const TokenSchema = z.object({ contato: z.string().min(4).max(120) });
const ConsultarSchema = z.object({ token: z.string().min(16).max(128) });
const SolicitarSchema = z.object({
  token: z.string().min(16),
  tipo: z.enum(['remocao','retificacao','acesso','oposicao']),
  descricao: z.string().max(2000).optional(),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anon';
  if (rateLimited(ip)) return json({ error: 'Muitas requisições' }, 429);

  const url = new URL(req.url);
  const action = url.pathname.split('/').pop();

  try {
    if (action === 'solicitar-token') {
      const b = TokenSchema.safeParse(await req.json().catch(() => ({})));
      if (!b.success) return json({ error: 'contato inválido' }, 400);
      const raw = b.data.contato.trim();
      const digits = normalizePhone(raw);
      const looksPhone = digits.length >= 8;

      // Procura leads por telefone (dígitos) ou email
      let leads: any[] = [];
      if (looksPhone) {
        const { data } = await admin
          .from('lista_proprietarios_captacao')
          .select('id,imobiliaria_id')
          .filter('telefone', 'ilike', `%${digits.slice(-8)}%`)
          .limit(20);
        leads = data ?? [];
      } else {
        const { data } = await admin
          .from('lista_proprietarios_captacao')
          .select('id,imobiliaria_id')
          .ilike('email', raw.toLowerCase())
          .limit(20);
        leads = data ?? [];
      }
      if (leads.length === 0) {
        // resposta genérica para não vazar existência
        return json({ ok: true, entregue: true });
      }

      const token = crypto.randomUUID().replace(/-/g,'') + crypto.randomUUID().replace(/-/g,'').slice(0,16);
      const rows = leads.map(l => ({
        imobiliaria_id: l.imobiliaria_id,
        lead_tipo: 'lista_proprietarios',
        lead_id: l.id,
        tipo_solicitacao: 'acesso',
        contato_titular: raw,
        token_verificacao: token,
        ip_origem: ip,
        status: 'pendente',
      }));
      await admin.from('captacao_lgpd_solicitacoes').insert(rows);
      // O token é devolvido no corpo — o front instrui o titular a copiar.
      // Em produção, enviar por SMS/e-mail via edge separada.
      return json({ ok: true, entregue: true, token });
    }

    if (action === 'consultar') {
      const b = ConsultarSchema.safeParse(await req.json().catch(() => ({})));
      if (!b.success) return json({ error: 'token inválido' }, 400);
      const { data: sols } = await admin
        .from('captacao_lgpd_solicitacoes')
        .select('lead_tipo,lead_id,imobiliaria_id')
        .eq('token_verificacao', b.data.token)
        .gte('created_at', new Date(Date.now() - 24*3600*1000).toISOString());
      if (!sols || sols.length === 0) return json({ error: 'token expirado ou inválido' }, 404);

      const results: any[] = [];
      for (const s of sols) {
        const { data: fontes } = await admin
          .from('captacao_fontes_dados')
          .select('campo,valor_capturado,fonte_url,fonte_tipo,fonte_titulo,coletado_em,base_legal')
          .eq('lead_tipo', s.lead_tipo).eq('lead_id', s.lead_id)
          .eq('imobiliaria_id', s.imobiliaria_id).eq('ativo', true);
        results.push({ lead_id: s.lead_id, fontes: fontes ?? [] });
      }
      return json({ ok: true, resultados: results });
    }

    if (action === 'solicitar') {
      const b = SolicitarSchema.safeParse(await req.json().catch(() => ({})));
      if (!b.success) return json({ error: 'payload inválido' }, 400);
      const { data: sols } = await admin
        .from('captacao_lgpd_solicitacoes')
        .select('id,lead_tipo,lead_id,imobiliaria_id,contato_titular')
        .eq('token_verificacao', b.data.token);
      if (!sols || sols.length === 0) return json({ error: 'token inválido' }, 404);
      const rows = sols.map(s => ({
        imobiliaria_id: s.imobiliaria_id,
        lead_tipo: s.lead_tipo,
        lead_id: s.lead_id,
        tipo_solicitacao: b.data.tipo,
        contato_titular: s.contato_titular,
        descricao: b.data.descricao ?? null,
        ip_origem: ip,
        status: 'pendente',
      }));
      await admin.from('captacao_lgpd_solicitacoes').insert(rows);

      if (b.data.tipo === 'remocao') {
        for (const s of sols) {
          const table = s.lead_tipo === 'pipeline' ? 'captacao_pipeline' : 'lista_proprietarios_captacao';
          await admin.from(table).update({ lgpd_status: 'remocao_solicitada' })
            .eq('id', s.lead_id).eq('imobiliaria_id', s.imobiliaria_id);
        }
      }
      return json({ ok: true, registradas: rows.length });
    }

    return json({ error: 'ação desconhecida' }, 404);
  } catch (e) {
    console.error('lgpd-portal-titular erro:', e);
    return json({ error: String((e as any)?.message ?? e) }, 500);
  }
});
