import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const GATEWAY_VERIFY = 'https://connector-gateway.lovable.dev/api/v1/verify_credentials';

type Result = {
  connector: string;
  env_var: string;
  configured: boolean;
  outcome: 'verified' | 'skipped' | 'failed' | 'not_configured' | 'error';
  latency_ms?: number;
  status?: number;
  error?: string;
};

async function verify(connector: string, envVar: string): Promise<Result> {
  const lovableKey = Deno.env.get('LOVABLE_API_KEY');
  const connKey = Deno.env.get(envVar);
  if (!lovableKey) {
    return { connector, env_var: envVar, configured: false, outcome: 'error', error: 'LOVABLE_API_KEY ausente' };
  }
  if (!connKey) {
    return {
      connector,
      env_var: envVar,
      configured: false,
      outcome: 'not_configured',
      error: `Conector ${connector} não linkado ao projeto`,
    };
  }
  try {
    const r = await fetch(GATEWAY_VERIFY, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        'X-Connection-Api-Key': connKey,
        'Content-Type': 'application/json',
      },
    });
    const body = await r.text();
    let parsed: any = {};
    try { parsed = JSON.parse(body); } catch { /* ignore */ }
    if (!r.ok) {
      return { connector, env_var: envVar, configured: true, outcome: 'failed', status: r.status, error: parsed?.error ?? body.slice(0, 200) };
    }
    return {
      connector,
      env_var: envVar,
      configured: true,
      outcome: parsed.outcome ?? 'verified',
      latency_ms: parsed.latency_ms,
      status: r.status,
      error: parsed.error,
    };
  } catch (e: any) {
    return { connector, env_var: envVar, configured: true, outcome: 'error', error: e?.message ?? String(e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data, error } = await supabase.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (error || !data?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const [telegram, apify] = await Promise.all([
      verify('telegram', 'TELEGRAM_API_KEY'),
      verify('apify', 'APIFY_API_KEY'),
    ]);

    return new Response(JSON.stringify({ results: [telegram, apify], checked_at: new Date().toISOString() }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
