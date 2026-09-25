// RadarZAP — Reprocessa uma mensagem existente pelo ID:
// - Re-executa análise IA a partir do texto atual;
// - Atualiza radarzap_mensagens (intencao, score, extraido, tem_imovel);
// - Cria/atualiza radarzap_leads (upsert por mensagem_id) quando aplicável.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SYSTEM = `Você é um analista imobiliário. Recebe UMA mensagem de grupo público de WhatsApp e responde SOMENTE JSON válido no schema:
{
 "tem_imovel": boolean,
 "intencao": "venda"|"aluguel"|"temporada"|"busca"|"duvida"|"nao_imovel",
 "score_intencao": 0-100,
 "tipo_imovel": string|null,
 "operacao": "venda"|"aluguel"|"temporada"|null,
 "bairro": string|null,
 "cidade": string|null,
 "preco": number|null,
 "contato": string|null,
 "proprietario_nome": string|null,
 "resumo": string
}
Considere gírias BR-DF. Preço em BRL (converta "500 mil"→500000). Se for pessoa PROCURANDO, intencao="busca". Se não for sobre imóvel, tem_imovel=false e intencao="nao_imovel".`;

async function callAI(text: string, apiKey: string) {
  const r = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: text },
      ],
      response_format: { type: 'json_object' },
    }),
  });
  if (!r.ok) throw new Error(`AI ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const j = await r.json();
  const content = j?.choices?.[0]?.message?.content ?? '{}';
  try { return JSON.parse(content); } catch { return {}; }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const gate = await ensureRadarZapAccess(req);
    if (!gate.ok) return gate.response;
    const { user, supabase } = gate;


    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY ausente' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const raw = String(body?.mensagem_id ?? body?.radarzap_mensagem_id ?? '').trim();
    const textoOverride = typeof body?.texto === 'string' ? body.texto : null;
    const force = !!body?.force;

    if (!UUID_RE.test(raw)) {
      return new Response(JSON.stringify({ error: 'mensagem_id inválido (UUID esperado)' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: msg, error: msgSelErr } = await supabase
      .from('radarzap_mensagens')
      .select('id,imobiliaria_id,texto,grupo_id,autor_contato')
      .eq('id', raw)
      .maybeSingle();

    if (msgSelErr) throw new Error(msgSelErr.message);
    if (!msg) return new Response(JSON.stringify({ error: 'Mensagem não encontrada' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

    const texto = String(textoOverride ?? msg.texto ?? '').trim().slice(0, 4000);
    if (!texto) {
      return new Response(JSON.stringify({ error: 'Mensagem sem texto para reprocessar' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const analise = await callAI(texto, LOVABLE_API_KEY);

    const updates: Record<string, unknown> = {
      analisado: true,
      tem_imovel: !!analise?.tem_imovel,
      intencao: analise?.intencao ?? null,
      score_intencao: Number(analise?.score_intencao ?? 0) | 0,
      extraido: analise ?? {},
      autor_contato: msg.autor_contato ?? analise?.contato ?? null,
    };
    if (textoOverride) updates.texto = texto;

    const { error: updErr } = await supabase
      .from('radarzap_mensagens')
      .update(updates)
      .eq('id', msg.id);
    if (updErr) throw new Error('Update mensagem: ' + updErr.message);

    const criarLead = force || (analise?.tem_imovel && ['venda', 'aluguel', 'temporada'].includes(analise?.intencao));
    let leadOp: 'created' | 'updated' | 'skipped' = 'skipped';
    let leadId: string | null = null;

    if (criarLead) {
      const leadPayload = {
        imobiliaria_id: msg.imobiliaria_id,
        mensagem_id: msg.id,
        grupo_id: msg.grupo_id ?? null,
        tipo_imovel: analise?.tipo_imovel ?? null,
        operacao: analise?.operacao ?? analise?.intencao ?? null,
        bairro: analise?.bairro ?? null,
        cidade: analise?.cidade ?? null,
        preco: analise?.preco ?? null,
        contato: analise?.contato ?? msg.autor_contato ?? null,
        proprietario_nome: analise?.proprietario_nome ?? null,
        resumo: analise?.resumo ?? null,
      };

      const { data: existing } = await supabase
        .from('radarzap_leads')
        .select('id,status')
        .eq('mensagem_id', msg.id)
        .maybeSingle();

      if (existing?.id) {
        const { error: e } = await supabase
          .from('radarzap_leads')
          .update(leadPayload)
          .eq('id', existing.id);
        if (e) throw new Error('Update lead: ' + e.message);
        leadOp = 'updated';
        leadId = existing.id;
      } else {
        const { data: ins, error: e } = await supabase
          .from('radarzap_leads')
          .insert({ ...leadPayload, status: 'novo' })
          .select('id')
          .single();
        if (e) throw new Error('Insert lead: ' + e.message);
        leadOp = 'created';
        leadId = ins?.id ?? null;
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      mensagem_id: msg.id,
      lead_id: leadId,
      lead_op: leadOp,
      analise,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e instanceof Error ? e.message : e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
