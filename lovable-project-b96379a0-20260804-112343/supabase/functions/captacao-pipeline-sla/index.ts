import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    // Fetch all active pipeline cards with tenant config
    const { data: cfgs, error: cfgErr } = await supabase
      .from('captacao_pipeline_config')
      .select('*');
    if (cfgErr) throw cfgErr;
    const cfgMap = new Map<string, any>();
    (cfgs ?? []).forEach((c: any) => cfgMap.set(c.imobiliaria_id, c));

    const { data: rows, error: rowsErr } = await supabase
      .from('captacao_pipeline')
      .select('id, imobiliaria_id, corretor_id, nome, estagio, estagio_desde, ultima_atividade_em, escalonado_em')
      .not('estagio', 'in', '("Contrato Assinado","Perdido")');
    if (rowsErr) throw rowsErr;

    const now = Date.now();
    let notified = 0;
    let escalated = 0;

    const slaByStage = (c: any, e: string) => {
      const d = c ?? {};
      switch (e) {
        case 'Prospectado': return d.sla_prospectado_horas ?? 24;
        case 'Contactado': return d.sla_contactado_horas ?? 48;
        case 'Interessado': return d.sla_interessado_horas ?? 72;
        case 'Avaliacao Enviada': return d.sla_avaliacao_horas ?? 120;
        case 'Autorizacao': return d.sla_autorizacao_horas ?? 168;
        default: return 0;
      }
    };

    for (const r of rows ?? []) {
      const cfg = cfgMap.get(r.imobiliaria_id) ?? {};
      const slaH = slaByStage(cfg, r.estagio);
      const horasEstagio = (now - new Date(r.estagio_desde).getTime()) / 3_600_000;
      const inatividadeH = cfg.sla_inatividade_horas ?? 168;
      const horasInat = r.ultima_atividade_em
        ? (now - new Date(r.ultima_atividade_em).getTime()) / 3_600_000
        : null;
      const escalonaExtra = cfg.sla_escalonamento_horas_extra ?? 24;

      const stageOverdue = slaH > 0 && horasEstagio > slaH;
      const inatividadeOverdue = horasInat !== null && horasInat > inatividadeH;

      if (!stageOverdue && !inatividadeOverdue) continue;

      const tipo = stageOverdue ? 'estagio' : 'inatividade';
      const title = tipo === 'estagio'
        ? `⏰ SLA vencido: ${r.nome}`
        : `⚠️ Lead sem atividade: ${r.nome}`;
      const desc = tipo === 'estagio'
        ? `${r.estagio} há ${horasEstagio.toFixed(0)}h (SLA ${slaH}h)`
        : `Sem contato há ${Math.floor((horasInat ?? 0) / 24)}d`;

      // Notify tenant (master)
      await supabase.from('notifications').insert({
        user_id: r.imobiliaria_id,
        title,
        description: desc,
      });
      notified++;

      // Escalation: overdue by SLA + extra hours and not yet escalated
      const shouldEscalate =
        (stageOverdue && horasEstagio > slaH + escalonaExtra) &&
        !r.escalonado_em;

      if (shouldEscalate) {
        // Look up master profile
        const { data: master } = await supabase
          .from('profiles')
          .select('id')
          .eq('is_master', true)
          .limit(1)
          .maybeSingle();
        if (master?.id && master.id !== r.imobiliaria_id) {
          await supabase.from('notifications').insert({
            user_id: master.id,
            title: `🚨 Escalonamento: ${r.nome}`,
            description: `SLA excedido +${escalonaExtra}h em ${r.estagio}`,
          });
        }
        await supabase
          .from('captacao_pipeline')
          .update({ escalonado_em: new Date().toISOString() })
          .eq('id', r.id);
        escalated++;
      }
    }

    return new Response(
      JSON.stringify({ ok: true, notified, escalated, checked: rows?.length ?? 0 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e: any) {
    console.error('captacao-pipeline-sla error', e);
    return new Response(
      JSON.stringify({ error: e?.message ?? 'unknown' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
