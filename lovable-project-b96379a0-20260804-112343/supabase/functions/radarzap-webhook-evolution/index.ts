// RadarZAP — Webhook para eventos do Evolution API (messages.upsert, groups.upsert).
// Valida HMAC + secret compartilhado, grava em radarzap_mensagens/grupos e dispara análise IA.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { tenantRadarZapAtivo } from '../_shared/radarzapAuth.ts';

const SECRET = Deno.env.get('EVOLUTION_WEBHOOK_SECRET') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

async function hmacHex(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function safeEq(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const raw = await req.text();
  const sigHeader =
    req.headers.get('x-evolution-signature') ??
    req.headers.get('x-webhook-signature') ??
    '';
  const tokenHeader = req.headers.get('x-webhook-token') ?? '';

  // Aceita HMAC OR bearer token (Evolution suporta os dois modos)
  let authOk = false;
  if (SECRET) {
    if (tokenHeader && safeEq(tokenHeader, SECRET)) authOk = true;
    if (sigHeader) {
      const expected = await hmacHex(SECRET, raw);
      const provided = sigHeader.replace(/^sha256=/, '').toLowerCase();
      if (safeEq(provided, expected)) authOk = true;
    }
  }
  if (!authOk) {
    return new Response(JSON.stringify({ error: 'invalid signature' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let evt: any = {};
  try { evt = JSON.parse(raw); } catch { return new Response('bad json', { status: 400 }); }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const event = evt?.event ?? evt?.type ?? '';
  const instance = evt?.instance ?? evt?.instanceName ?? null;
  const data = evt?.data ?? evt;

  try {
    if (event.includes('messages.upsert') || event === 'message.upsert') {
      const messages = Array.isArray(data?.messages) ? data.messages : (data ? [data] : []);
      const results: any[] = [];
      for (const m of messages) {
        const key = m?.key ?? {};
        const remoteJid: string = key?.remoteJid ?? '';
        if (!remoteJid.endsWith('@g.us')) continue; // só grupos
        const messageId: string = key?.id ?? crypto.randomUUID();
        const fromMe: boolean = !!key?.fromMe;
        if (fromMe) continue;

        // Extrair texto e mídias
        const msg = m?.message ?? {};
        const texto: string =
          msg?.conversation ??
          msg?.extendedTextMessage?.text ??
          msg?.imageMessage?.caption ??
          msg?.videoMessage?.caption ??
          '';
        const midias: any[] = [];
        if (msg?.imageMessage) midias.push({ tipo: 'imagem', url: msg.imageMessage.url ?? null, mimetype: msg.imageMessage.mimetype ?? null });
        if (msg?.videoMessage) midias.push({ tipo: 'video', url: msg.videoMessage.url ?? null, mimetype: msg.videoMessage.mimetype ?? null });
        if (msg?.documentMessage) midias.push({ tipo: 'documento', url: msg.documentMessage.url ?? null, mimetype: msg.documentMessage.mimetype ?? null });

        if (!texto.trim() && midias.length === 0) continue;

        // Achar grupo pelo evolution_instance + evolution_group_jid
        const { data: grupo } = await supabase
          .from('radarzap_grupos')
          .select('id, imobiliaria_id')
          .eq('evolution_instance', instance)
          .eq('evolution_group_jid', remoteJid)
          .maybeSingle();

        if (!grupo) {
          results.push({ skipped: 'grupo_nao_registrado', jid: remoteJid });
          continue;
        }

        // Backend permission check: só grava se o tenant tiver o módulo
        // RadarZAP ativo. Isso evita ingestão silenciosa após um master
        // desativar o módulo para uma imobiliária.
        if (!(await tenantRadarZapAtivo(supabase, grupo.imobiliaria_id))) {
          results.push({ skipped: 'radarzap_desativado', imobiliaria_id: grupo.imobiliaria_id });
          continue;
        }


        const autor = key?.participant ?? null;
        const timestamp = m?.messageTimestamp
          ? new Date(Number(m.messageTimestamp) * 1000).toISOString()
          : new Date().toISOString();

        const { data: msgIns, error: msgErr } = await supabase
          .from('radarzap_mensagens')
          .upsert({
            imobiliaria_id: grupo.imobiliaria_id,
            grupo_id: grupo.id,
            texto: (texto || '(mídia sem legenda)').slice(0, 4000),
            autor_contato: autor,
            data_mensagem: timestamp,
            evolution_message_id: messageId,
            midias,
            analisado: false,
          }, { onConflict: 'imobiliaria_id,evolution_message_id', ignoreDuplicates: false })
          .select('id')
          .single();

        if (msgErr) { results.push({ error: msgErr.message }); continue; }

        // Marca grupo como ativo
        await supabase
          .from('radarzap_grupos')
          .update({ evolution_last_seen_at: new Date().toISOString(), total_mensagens: undefined })
          .eq('id', grupo.id);

        // Dispara análise IA em background (não bloqueia webhook)
        const analiseUrl = `${SUPABASE_URL}/functions/v1/radarzap-reprocessar-mensagem`;
        fetch(analiseUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SERVICE_KEY}`,
            'x-internal-call': '1',
          },
          body: JSON.stringify({ mensagem_id: msgIns!.id, imobiliaria_id: grupo.imobiliaria_id }),
        }).catch(() => {});

        results.push({ ok: true, mensagem_id: msgIns!.id });
      }
      return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (event.includes('groups.upsert') || event.includes('group.upsert')) {
      // Atualiza metadados do grupo se já existir
      const groups = Array.isArray(data) ? data : (data?.groups ?? [data]);
      for (const g of groups) {
        const jid = g?.id ?? g?.jid;
        if (!jid) continue;
        await supabase
          .from('radarzap_grupos')
          .update({
            nome: g?.subject ?? undefined,
            descricao: g?.desc ?? undefined,
            evolution_last_seen_at: new Date().toISOString(),
          })
          .eq('evolution_instance', instance)
          .eq('evolution_group_jid', jid);
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true, ignored: event }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('webhook error:', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
