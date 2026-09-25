// RadarZAP — Entra em grupo público via convite (Evolution API) e registra na radarzap_grupos.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { ensureRadarZapAccess } from '../_shared/radarzapAuth.ts';

const EVO_URL = (Deno.env.get('EVOLUTION_API_URL') ?? '').replace(/\/$/, '');
const EVO_KEY = Deno.env.get('EVOLUTION_API_KEY') ?? '';
const EVO_INSTANCE = Deno.env.get('EVOLUTION_INSTANCE') ?? '';

function extractInviteCode(url: string): string | null {
  const m = url.match(/chat\.whatsapp\.com\/(?:invite\/)?([A-Za-z0-9_-]{10,})/);
  return m ? m[1] : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const gate = await ensureRadarZapAccess(req, { requiredPermission: 'radarzap_config' });
  if (!gate.ok) return gate.response;
  const { user, supabase } = gate;


  if (!EVO_URL || !EVO_KEY || !EVO_INSTANCE) {
    return new Response(JSON.stringify({
      error: 'Evolution API não configurado. Configure EVOLUTION_API_URL, EVOLUTION_API_KEY e EVOLUTION_INSTANCE nos secrets.',
    }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const body = await req.json().catch(() => ({}));
  const grupos: Array<{ invite_url: string; categoria?: string; cidade?: string; uf?: string; bairro?: string }> =
    Array.isArray(body?.grupos) ? body.grupos : [];

  if (grupos.length === 0) {
    return new Response(JSON.stringify({ error: 'Envie grupos[]' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const results: any[] = [];
  for (const g of grupos.slice(0, 100)) {
    const code = extractInviteCode(g.invite_url ?? '');
    if (!code) { results.push({ invite_url: g.invite_url, ok: false, error: 'Link inválido' }); continue; }

    try {
      // Aceitar convite
      const r = await fetch(`${EVO_URL}/group/acceptInviteCode/${EVO_INSTANCE}?inviteCode=${code}`, {
        method: 'GET',
        headers: { apikey: EVO_KEY },
      });
      const data = await r.json().catch(() => ({}));
      const jid: string | null = data?.groupJid ?? data?.id ?? null;

      // Buscar metadata
      let nome = null, descricao = null;
      if (jid) {
        const meta = await fetch(`${EVO_URL}/group/findGroupInfos/${EVO_INSTANCE}?groupJid=${jid}`, {
          headers: { apikey: EVO_KEY },
        }).then(x => x.json()).catch(() => null);
        nome = meta?.subject ?? null;
        descricao = meta?.desc ?? null;
      }

      const { data: ins, error: insErr } = await supabase
        .from('radarzap_grupos')
        .upsert({
          imobiliaria_id: user.id,
          invite_url: g.invite_url,
          nome,
          descricao,
          categoria: g.categoria ?? null,
          cidade: g.cidade ?? null,
          uf: g.uf ?? 'DF',
          bairro: g.bairro ?? null,
          origem: 'manual',
          status: r.ok ? 'ativo' : 'erro',
          evolution_instance: EVO_INSTANCE,
          evolution_group_jid: jid,
          evolution_join_status: r.ok ? 'joined' : `error_${r.status}`,
          evolution_last_seen_at: r.ok ? new Date().toISOString() : null,
        }, { onConflict: 'imobiliaria_id,invite_url' })
        .select('id')
        .single();

      results.push({
        invite_url: g.invite_url, ok: r.ok, jid, nome,
        grupo_id: ins?.id ?? null,
        error: r.ok ? null : (data?.message ?? `HTTP ${r.status}`),
        db_error: insErr?.message ?? null,
      });
    } catch (e) {
      results.push({ invite_url: g.invite_url, ok: false, error: String(e) });
    }
  }

  return new Response(JSON.stringify({ ok: true, results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
