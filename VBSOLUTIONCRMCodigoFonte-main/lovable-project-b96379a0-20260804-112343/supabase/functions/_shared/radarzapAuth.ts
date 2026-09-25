// Shared backend authorization for RadarZAP edge functions.
// Verifies: (1) valid JWT, (2) module `radarzap` (or a specific sub-module)
// active for the tenant, (3) optional granular permission via user_permissoes.
// Master users (profiles.is_master = true) bypass all checks.
//
// Usage:
//   const gate = await ensureRadarZapAccess(req, { requiredModule: 'radarzap' });
//   if (!gate.ok) return gate.response;
//   const { user, supabase, admin } = gate;

import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

export type RadarZapModule =
  | 'radarzap'
  | 'radarzap_aprovar'
  | 'radarzap_editar_sensivel'
  | 'radarzap_config';

export type RadarZapGateOk = {
  ok: true;
  user: { id: string; email?: string | null };
  isMaster: boolean;
  supabase: SupabaseClient; // JWT-scoped client (respects RLS)
  admin: SupabaseClient;    // service-role client for privileged reads/writes
};

export type RadarZapGateFail = {
  ok: false;
  response: Response;
  reason: 'unauthenticated' | 'modulo_desativado' | 'sem_permissao' | 'config_error';
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export async function ensureRadarZapAccess(
  req: Request,
  opts: {
    requiredModule?: RadarZapModule;
    requiredPermission?: RadarZapModule;
  } = {},
): Promise<RadarZapGateOk | RadarZapGateFail> {
  const requiredModule = opts.requiredModule ?? 'radarzap';
  const requiredPermission = opts.requiredPermission;

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_ANON = Deno.env.get('SUPABASE_ANON_KEY');
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !SUPABASE_ANON || !SERVICE_KEY) {
    return {
      ok: false,
      reason: 'config_error',
      response: jsonResponse(500, { error: 'Configuração do servidor ausente' }),
    };
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) {
    return {
      ok: false,
      reason: 'unauthenticated',
      response: jsonResponse(401, { error: 'Não autenticado' }),
    };
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  const user = userData?.user;
  if (userErr || !user) {
    return {
      ok: false,
      reason: 'unauthenticated',
      response: jsonResponse(401, { error: 'Não autenticado' }),
    };
  }

  // Master bypass.
  const { data: prof } = await admin
    .from('profiles')
    .select('is_master')
    .eq('id', user.id)
    .maybeSingle();
  const isMaster = !!prof?.is_master;

  const identity = { id: user.id, email: user.email ?? null };

  if (isMaster) {
    return { ok: true, user: identity, isMaster: true, supabase, admin };
  }

  // Module active check (default true when no row present).
  const { data: modRow } = await admin
    .from('modulo_config')
    .select('ativo')
    .eq('imobiliaria_id', user.id)
    .eq('modulo', requiredModule)
    .maybeSingle();
  if (modRow && modRow.ativo === false) {
    return {
      ok: false,
      reason: 'modulo_desativado',
      response: jsonResponse(403, {
        error: 'Módulo RadarZAP desativado para este usuário',
        reason: 'modulo_desativado',
        modulo: requiredModule,
      }),
    };
  }

  // Granular permission (opt-in). Absent row => allowed by default; explicit
  // ativo=false denies.
  if (requiredPermission) {
    const { data: permRow } = await admin
      .from('user_permissoes')
      .select('ativo')
      .eq('user_id', user.id)
      .eq('modulo', requiredPermission)
      .maybeSingle();
    if (permRow && permRow.ativo === false) {
      return {
        ok: false,
        reason: 'sem_permissao',
        response: jsonResponse(403, {
          error: 'Sem permissão para esta ação do RadarZAP',
          reason: 'sem_permissao',
          permission: requiredPermission,
        }),
      };
    }
  }

  return { ok: true, user: identity, isMaster: false, supabase, admin };
}

// Server-side check for the webhook path: after we resolve the tenant from
// the incoming Evolution event, confirm the tenant still has the RadarZAP
// module active. Returns true when writes should proceed.
export async function tenantRadarZapAtivo(
  admin: SupabaseClient,
  imobiliariaId: string,
): Promise<boolean> {
  const { data: prof } = await admin
    .from('profiles')
    .select('is_master')
    .eq('id', imobiliariaId)
    .maybeSingle();
  if (prof?.is_master) return true;
  const { data: modRow } = await admin
    .from('modulo_config')
    .select('ativo')
    .eq('imobiliaria_id', imobiliariaId)
    .eq('modulo', 'radarzap')
    .maybeSingle();
  if (!modRow) return true; // default active
  return modRow.ativo !== false;
}
