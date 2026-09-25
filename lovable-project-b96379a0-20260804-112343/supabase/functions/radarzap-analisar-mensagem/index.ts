// RadarZAP — Analisa mensagem colada pelo usuário usando Lovable AI Gateway.
// Extrai sinais de venda/aluguel, tipo, bairro, preço, contato.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { ensureRadarZapAccess } from '../_shared/radarzapAuth.ts';


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
    const mensagens: Array<{ texto: string; grupo_id?: string | null; autor_contato?: string | null }> =
      Array.isArray(body?.mensagens) ? body.mensagens :
      (body?.texto ? [{ texto: String(body.texto), grupo_id: body?.grupo_id ?? null, autor_contato: body?.autor_contato ?? null }] : []);

    if (mensagens.length === 0) {
      return new Response(JSON.stringify({ error: 'Envie texto ou mensagens[]' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const resultados: any[] = [];
    for (const m of mensagens.slice(0, 20)) {
      const texto = String(m.texto ?? '').trim().slice(0, 4000);
      if (!texto) continue;

      let analise: any = {};
      try {
        analise = await callAI(texto, LOVABLE_API_KEY);
      } catch (e) {
        resultados.push({ ok: false, error: String(e) });
        continue;
      }

      const { data: msgIns, error: msgErr } = await supabase
        .from('radarzap_mensagens')
        .insert({
          imobiliaria_id: user.id,
          grupo_id: m.grupo_id ?? null,
          texto,
          autor_contato: m.autor_contato ?? analise?.contato ?? null,
          analisado: true,
          tem_imovel: !!analise?.tem_imovel,
          intencao: analise?.intencao ?? null,
          score_intencao: Number(analise?.score_intencao ?? 0) | 0,
          extraido: analise ?? {},
        })
        .select('id')
        .single();

      if (msgErr) {
        resultados.push({ ok: false, error: msgErr.message });
        continue;
      }

      let leadId: string | null = null;
      if (analise?.tem_imovel && ['venda', 'aluguel', 'temporada'].includes(analise?.intencao)) {
        const { data: leadIns } = await supabase.from('radarzap_leads').insert({
          imobiliaria_id: user.id,
          mensagem_id: msgIns!.id,
          grupo_id: m.grupo_id ?? null,
          tipo_imovel: analise?.tipo_imovel ?? null,
          operacao: analise?.operacao ?? analise?.intencao ?? null,
          bairro: analise?.bairro ?? null,
          cidade: analise?.cidade ?? null,
          preco: analise?.preco ?? null,
          contato: analise?.contato ?? m.autor_contato ?? null,
          proprietario_nome: analise?.proprietario_nome ?? null,
          resumo: analise?.resumo ?? null,
          status: 'novo',
        }).select('id').single();
        leadId = leadIns?.id ?? null;
      }

      resultados.push({ ok: true, mensagem_id: msgIns!.id, lead_id: leadId, analise });
    }

    return new Response(JSON.stringify({ ok: true, resultados }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
