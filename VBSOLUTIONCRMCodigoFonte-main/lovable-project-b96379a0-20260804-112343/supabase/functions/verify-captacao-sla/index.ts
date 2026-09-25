// Public verifier for captacao-pipeline-sla.
// Runs two scenarios (empty + seeded) and reports delta counters
// plus DB-side effects (notifications inserted, escalonado_em set).
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

type SlaResp = { ok?: boolean; notified?: number; escalated?: number; checked?: number; error?: string };

async function callSla(): Promise<{ status: number; body: SlaResp; ms: number }> {
  const t0 = Date.now();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/captacao-pipeline-sla`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SERVICE_KEY,
    },
  });
  const body = (await res.json().catch(() => ({}))) as SlaResp;
  return { status: res.status, body, ms: Date.now() - t0 };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const report: any = {
    started_at: new Date().toISOString(),
    scenarios: {},
    assertions: [],
    ok: true,
  };
  const push = (name: string, pass: boolean, detail?: unknown) => {
    report.assertions.push({ name, pass, detail });
    if (!pass) report.ok = false;
  };

  const tenantId = crypto.randomUUID();
  const seededIds: string[] = [];

  try {
    // ---------- Scenario A: empty (no seeded data) ----------
    const empty = await callSla();
    report.scenarios.empty = empty;
    push('empty_status_200', empty.status === 200, empty);
    push('empty_response_ok', empty.body?.ok === true);
    push('empty_returns_counters', typeof empty.body?.notified === 'number' && typeof empty.body?.escalated === 'number');

    const baseNotified = empty.body?.notified ?? 0;
    const baseEscalated = empty.body?.escalated ?? 0;

    // ---------- Seed: config + 2 rows for synthetic tenant ----------
    const { error: cfgErr } = await sb.from('captacao_pipeline_config').insert({
      imobiliaria_id: tenantId,
      sla_prospectado_horas: 1,
      sla_escalonamento_horas_extra: 1,
      sla_inatividade_horas: 999,
    });
    push('seed_config_inserted', !cfgErr, cfgErr?.message);
    if (cfgErr) throw new Error(`seed cfg failed: ${cfgErr.message}`);

    const now = Date.now();
    const hoursAgo = (h: number) => new Date(now - h * 3_600_000).toISOString();

    // Row 1: overdue stage (>1h) but not past escalation window (<1+1h) → notify only
    // Row 2: overdue >> slaH + extra → notify + escalate
    const { data: seeded, error: seedErr } = await sb
      .from('captacao_pipeline')
      .insert([
        {
          imobiliaria_id: tenantId,
          nome: `__verify_notify_${tenantId.slice(0, 8)}`,
          estagio: 'Prospectado',
          estagio_desde: hoursAgo(1.5),
        },
        {
          imobiliaria_id: tenantId,
          nome: `__verify_escalate_${tenantId.slice(0, 8)}`,
          estagio: 'Prospectado',
          estagio_desde: hoursAgo(10),
        },
      ])
      .select('id, nome');
    push('seed_rows_inserted', !seedErr && (seeded?.length ?? 0) === 2, seedErr?.message);
    if (seedErr || !seeded) throw new Error(`seed rows failed: ${seedErr?.message}`);
    seeded.forEach((r) => seededIds.push(r.id));

    // ---------- Scenario B: with data ----------
    const seededRun = await callSla();
    report.scenarios.seeded = seededRun;
    push('seeded_status_200', seededRun.status === 200);
    push('seeded_response_ok', seededRun.body?.ok === true);

    const deltaNotified = (seededRun.body?.notified ?? 0) - baseNotified;
    const deltaEscalated = (seededRun.body?.escalated ?? 0) - baseEscalated;
    report.deltas = { notified: deltaNotified, escalated: deltaEscalated };
    push('delta_notified_ge_2', deltaNotified >= 2, { deltaNotified });
    push('delta_escalated_ge_1', deltaEscalated >= 1, { deltaEscalated });

    // ---------- DB side-effects ----------
    const { data: notifs } = await sb
      .from('notifications')
      .select('id, title, description')
      .eq('user_id', tenantId);
    push('notifications_persisted_ge_2', (notifs?.length ?? 0) >= 2, { count: notifs?.length });

    const { data: escRow } = await sb
      .from('captacao_pipeline')
      .select('id, escalonado_em')
      .eq('id', seededIds[1])
      .maybeSingle();
    push('escalonado_em_set_on_row2', !!escRow?.escalonado_em, escRow);

    const { data: notEscRow } = await sb
      .from('captacao_pipeline')
      .select('id, escalonado_em')
      .eq('id', seededIds[0])
      .maybeSingle();
    push('escalonado_em_null_on_row1', notEscRow?.escalonado_em == null, notEscRow);

    // ---------- Idempotency: second call must not re-escalate row2 ----------
    const rerun = await callSla();
    report.scenarios.rerun = rerun;
    // Row 2 already carries escalonado_em, so rerun must NOT re-escalate it.
    // We assert rerun.escalated dropped vs seeded run (our +1 is gone).
    const rerunEsc = rerun.body?.escalated ?? 0;
    const seededEsc = seededRun.body?.escalated ?? 0;
    push('rerun_no_double_escalation', rerunEsc <= Math.max(0, seededEsc - 1), { rerunEsc, seededEsc });
  } catch (e: any) {
    report.ok = false;
    report.error = e?.message ?? String(e);
  } finally {
    // ---------- Cleanup ----------
    try {
      if (seededIds.length) {
        await sb.from('captacao_pipeline').delete().in('id', seededIds);
      }
      await sb.from('captacao_pipeline_config').delete().eq('imobiliaria_id', tenantId);
      await sb.from('notifications').delete().eq('user_id', tenantId);
      report.cleanup = 'ok';
    } catch (e: any) {
      report.cleanup = `failed: ${e?.message}`;
      report.ok = false;
    }
  }

  report.finished_at = new Date().toISOString();
  return new Response(JSON.stringify(report, null, 2), {
    status: report.ok ? 200 : 500,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
