// RadarZAP — Monitor de métricas. Para cada imobiliária com config ativa,
// calcula taxa de geração (leads/mensagens) e taxa de aprovação (aprovados/leads)
// na janela definida. Se alguma cair abaixo do mínimo, cria notificação e log,
// respeitando cooldown para evitar spam.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

type Config = {
  imobiliaria_id: string;
  ativo: boolean;
  min_taxa_geracao: number;
  min_taxa_aprovacao: number;
  min_mensagens_avaliacao: number;
  min_leads_avaliacao: number;
  janela_horas: number;
  cooldown_horas: number;
};

const STATUS_APROVADOS = ['aprovado', 'convertido', 'novo', 'contato'];

async function processarImobiliaria(supa: ReturnType<typeof createClient>, cfg: Config) {
  const now = new Date();
  const desde = new Date(now.getTime() - cfg.janela_horas * 3600_000).toISOString();

  const [msgsRes, leadsRes] = await Promise.all([
    supa.from('radarzap_mensagens').select('id', { count: 'exact', head: true })
      .eq('imobiliaria_id', cfg.imobiliaria_id).gte('created_at', desde),
    supa.from('radarzap_leads').select('status', { count: 'exact' })
      .eq('imobiliaria_id', cfg.imobiliaria_id).gte('created_at', desde),
  ]);

  const totalMensagens = msgsRes.count ?? 0;
  const leads = (leadsRes.data ?? []) as { status: string }[];
  const totalLeads = leadsRes.count ?? leads.length;
  const totalAprovados = leads.filter(l => STATUS_APROVADOS.includes(l.status)).length;

  const taxaGeracao = totalMensagens > 0 ? (totalLeads / totalMensagens) * 100 : 0;
  const taxaAprovacao = totalLeads > 0 ? (totalAprovados / totalLeads) * 100 : 0;

  const cooldownDesde = new Date(now.getTime() - cfg.cooldown_horas * 3600_000).toISOString();
  const disparos: Array<{ tipo: 'taxa_geracao' | 'taxa_aprovacao'; taxa: number; min: number; motivo: string }> = [];

  if (totalMensagens >= cfg.min_mensagens_avaliacao && taxaGeracao < cfg.min_taxa_geracao) {
    disparos.push({
      tipo: 'taxa_geracao', taxa: +taxaGeracao.toFixed(2), min: cfg.min_taxa_geracao,
      motivo: `Apenas ${totalLeads} lead(s) gerados em ${totalMensagens} mensagens (${taxaGeracao.toFixed(1)}% < ${cfg.min_taxa_geracao}%)`,
    });
  }
  if (totalLeads >= cfg.min_leads_avaliacao && taxaAprovacao < cfg.min_taxa_aprovacao) {
    disparos.push({
      tipo: 'taxa_aprovacao', taxa: +taxaAprovacao.toFixed(2), min: cfg.min_taxa_aprovacao,
      motivo: `Apenas ${totalAprovados} de ${totalLeads} leads aprovados (${taxaAprovacao.toFixed(1)}% < ${cfg.min_taxa_aprovacao}%)`,
    });
  }

  const alertasDisparados: string[] = [];
  for (const d of disparos) {
    // cooldown por tipo
    const { data: recente } = await supa
      .from('radarzap_metricas_alertas_log')
      .select('id')
      .eq('imobiliaria_id', cfg.imobiliaria_id)
      .eq('tipo', d.tipo)
      .gte('created_at', cooldownDesde)
      .limit(1);
    if (recente && recente.length > 0) continue;

    await supa.from('radarzap_metricas_alertas_log').insert({
      imobiliaria_id: cfg.imobiliaria_id,
      tipo: d.tipo,
      taxa_observada: d.taxa,
      taxa_minima: d.min,
      total_mensagens: totalMensagens,
      total_leads: totalLeads,
      total_aprovados: totalAprovados,
      janela_horas: cfg.janela_horas,
      detalhes: { motivo: d.motivo },
    });

    const titulo = d.tipo === 'taxa_geracao'
      ? '⚠️ RadarZAP: taxa de geração baixa'
      : '⚠️ RadarZAP: taxa de aprovação baixa';
    await supa.from('notifications').insert({
      user_id: cfg.imobiliaria_id,
      title: titulo,
      description: `${d.motivo} nas últimas ${cfg.janela_horas}h.`,
    });
    alertasDisparados.push(d.tipo);
  }

  await supa.from('radarzap_metricas_alertas_config')
    .update({ ultimo_check_em: now.toISOString() })
    .eq('imobiliaria_id', cfg.imobiliaria_id);

  return {
    imobiliaria_id: cfg.imobiliaria_id,
    total_mensagens: totalMensagens,
    total_leads: totalLeads,
    total_aprovados: totalAprovados,
    taxa_geracao: +taxaGeracao.toFixed(2),
    taxa_aprovacao: +taxaAprovacao.toFixed(2),
    alertas: alertasDisparados,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supa = createClient(SUPABASE_URL, SERVICE_KEY);

    // Suporta execução manual de uma imobiliária específica (para "testar agora")
    let filtroImob: string | null = null;
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        if (body?.imobiliaria_id && typeof body.imobiliaria_id === 'string') {
          filtroImob = body.imobiliaria_id;
        }
      } catch { /* body opcional */ }
    }

    let q = supa.from('radarzap_metricas_alertas_config').select('*').eq('ativo', true);
    if (filtroImob) q = q.eq('imobiliaria_id', filtroImob);
    const { data: configs, error } = await q;
    if (error) throw error;

    const resultados: unknown[] = [];
    for (const cfg of (configs ?? []) as Config[]) {
      try {
        resultados.push(await processarImobiliaria(supa, cfg));
      } catch (e) {
        console.error('erro processando', cfg.imobiliaria_id, e);
        resultados.push({ imobiliaria_id: cfg.imobiliaria_id, erro: String(e) });
      }
    }

    return new Response(JSON.stringify({ ok: true, total: resultados.length, resultados }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('monitor falhou', e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
