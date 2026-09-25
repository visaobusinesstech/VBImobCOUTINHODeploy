// Telegram webhook — valida assinatura (X-Telegram-Bot-Api-Secret-Token derivada
// do TELEGRAM_API_KEY) e registra a mensagem em monitoramento_capturas com
// rastreabilidade LGPD (fonte, URL pública, base legal, trecho original).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

async function deriveWebhookSecret(apiKey: string): Promise<string> {
  const data = new TextEncoder().encode(`telegram-webhook:${apiKey}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function safeEqual(a: string | null, b: string): boolean {
  if (!a || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function publicUrl(msg: any): string | null {
  const chat = msg?.chat;
  if (!chat) return null;
  if (chat.username) return `https://t.me/${chat.username}/${msg.message_id}`;
  // canais privados / grupos supergrupo (id começa com -100)
  const raw = String(chat.id ?? '');
  if (raw.startsWith('-100')) {
    return `https://t.me/c/${raw.slice(4)}/${msg.message_id}`;
  }
  return null;
}

function collectMedia(msg: any): string[] {
  const ids: string[] = [];
  if (Array.isArray(msg?.photo)) {
    const best = msg.photo[msg.photo.length - 1];
    if (best?.file_id) ids.push(best.file_id);
  }
  if (msg?.document?.file_id) ids.push(msg.document.file_id);
  if (msg?.video?.file_id) ids.push(msg.video.file_id);
  return ids;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const TELEGRAM_API_KEY = Deno.env.get('TELEGRAM_API_KEY');
  if (!TELEGRAM_API_KEY) {
    console.error('TELEGRAM_API_KEY não configurado');
    return new Response(JSON.stringify({ error: 'telegram_not_configured' }), {
      status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // 1. Validação de assinatura (constant-time)
  const expected = await deriveWebhookSecret(TELEGRAM_API_KEY);
  const provided = req.headers.get('X-Telegram-Bot-Api-Secret-Token');
  if (!safeEqual(provided, expected)) {
    console.warn('assinatura telegram inválida');
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  let update: any;
  try {
    update = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const msg = update?.message ?? update?.edited_message ?? update?.channel_post;
  if (!msg?.chat?.id || typeof update.update_id !== 'number') {
    return new Response(JSON.stringify({ ok: true, ignored: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const chatIdStr = String(msg.chat.id);
  const texto: string = msg.text ?? msg.caption ?? '';

  // 2. Localiza a fonte cadastrada (config.chat_id === chat.id) — LGPD: só
  // registra se a imobiliária opt-in explicitamente naquele grupo/canal público.
  const { data: fonte, error: fonteErr } = await supabase
    .from('monitoramento_fontes')
    .select('id, imobiliaria_id, ativo, fonte_url_publica, base_legal, cidades_alvo, bairros_alvo')
    .eq('tipo', 'telegram')
    .eq('ativo', true)
    .filter('config->>chat_id', 'eq', chatIdStr)
    .maybeSingle();

  if (fonteErr) {
    console.error('erro buscando fonte', fonteErr);
    return new Response(JSON.stringify({ error: 'fonte_lookup_failed' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (!fonte) {
    // Chat não autorizado → nada é persistido (privacy by default)
    console.log('chat não autorizado, descartando update', chatIdStr);
    return new Response(JSON.stringify({ ok: true, ignored: 'chat_not_registered' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const external_id = `${chatIdStr}:${msg.message_id}`;
  const url_origem = publicUrl(msg) ?? fonte.fonte_url_publica ?? null;

  // 3. Insere captura (idempotente via external_id + fonte_id)
  const { data: inserted, error: insErr } = await supabase
    .from('monitoramento_capturas')
    .upsert({
      imobiliaria_id: fonte.imobiliaria_id,
      fonte_id: fonte.id,
      tipo_fonte: 'telegram',
      external_id,
      url_origem,
      titulo: msg?.chat?.title ?? null,
      texto,
      nome_contato: [msg?.from?.first_name, msg?.from?.last_name].filter(Boolean).join(' ') || null,
      media_urls: collectMedia(msg),
      payload_raw: {
        update_id: update.update_id,
        chat: { id: msg.chat.id, type: msg.chat.type, title: msg.chat.title, username: msg.chat.username },
        from: msg.from ? { id: msg.from.id, username: msg.from.username } : null,
        message_id: msg.message_id,
        date: msg.date,
        lgpd: {
          base_legal: fonte.base_legal ?? 'legitimo_interesse_art_7_ix',
          fonte_publica: true,
          coletado_em: new Date().toISOString(),
          trecho: texto?.slice(0, 500) ?? null,
        },
      },
      status: 'pendente',
      captado_em: new Date(((msg.date ?? Math.floor(Date.now() / 1000))) * 1000).toISOString(),
    }, { onConflict: 'fonte_id,external_id', ignoreDuplicates: false })
    .select('id')
    .maybeSingle();

  if (insErr) {
    console.error('erro upsert captura', insErr);
    return new Response(JSON.stringify({ error: 'insert_failed', details: insErr.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // 4. Atualiza métricas da fonte (best-effort)
  await supabase.from('monitoramento_fontes')
    .update({ ultima_captura_em: new Date().toISOString() })
    .eq('id', fonte.id);

  return new Response(JSON.stringify({ ok: true, captura_id: inserted?.id }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
