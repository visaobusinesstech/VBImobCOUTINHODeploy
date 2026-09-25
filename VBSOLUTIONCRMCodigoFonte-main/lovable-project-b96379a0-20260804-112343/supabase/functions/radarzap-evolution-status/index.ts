// RadarZAP — Retorna status da conexão Evolution API (instância, QR/conexão, contagem de grupos).
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { ensureRadarZapAccess } from '../_shared/radarzapAuth.ts';

const EVO_URL = (Deno.env.get('EVOLUTION_API_URL') ?? '').replace(/\/$/, '');
const EVO_KEY = Deno.env.get('EVOLUTION_API_KEY') ?? '';
const EVO_INSTANCE = Deno.env.get('EVOLUTION_INSTANCE') ?? '';
const WEBHOOK_SECRET_SET = !!Deno.env.get('EVOLUTION_WEBHOOK_SECRET');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const gate = await ensureRadarZapAccess(req, { requiredPermission: 'radarzap_config' });
  if (!gate.ok) return gate.response;
  const { user, supabase } = gate;



  const configured = !!(EVO_URL && EVO_KEY && EVO_INSTANCE);
  const out: any = {
    configured,
    webhook_secret_set: WEBHOOK_SECRET_SET,
    instance: EVO_INSTANCE || null,
    webhook_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/radarzap-webhook-evolution`,
    state: null,
    qrcode: null,
    error: null,
  };

  if (!configured) {
    return new Response(JSON.stringify(out), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const r = await fetch(`${EVO_URL}/instance/connectionState/${EVO_INSTANCE}`, {
      headers: { apikey: EVO_KEY },
    });
    const j = await r.json().catch(() => ({}));
    out.state = j?.instance?.state ?? j?.state ?? null;

    if (out.state !== 'open') {
      const qr = await fetch(`${EVO_URL}/instance/connect/${EVO_INSTANCE}`, {
        headers: { apikey: EVO_KEY },
      }).then(x => x.json()).catch(() => null);
      out.qrcode = qr?.base64 ?? qr?.qrcode?.base64 ?? qr?.code ?? null;
    }
  } catch (e) {
    out.error = String(e);
  }

  const { count } = await supabase
    .from('radarzap_grupos')
    .select('id', { count: 'exact', head: true })
    .eq('imobiliaria_id', user.id)
    .not('evolution_group_jid', 'is', null);
  out.grupos_conectados = count ?? 0;

  return new Response(JSON.stringify(out), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
