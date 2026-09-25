// Edge function: blog-estrategia-ia
// Actions: "analisar" | "sugerir"
// Uses Lovable AI Gateway (openai/gpt-5.5) to produce JSON payloads.

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

interface Payload {
  action: 'analisar' | 'sugerir';
  nichos?: string[];
  topicos?: string;
  quantidade?: number; // p/ sugerir
  analise_id?: string; // opcional p/ vincular sugestões
  contexto?: string;   // texto livre extra
}

async function callAI(system: string, user: string) {
  const key = Deno.env.get('LOVABLE_API_KEY');
  if (!key) throw new Error('LOVABLE_API_KEY não configurada');

  const res = await fetch(GATEWAY_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'openai/gpt-5.5',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`AI ${res.status}: ${body}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content ?? '{}';
  try {
    return JSON.parse(content);
  } catch {
    return { raw: content };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const imobiliariaId = userData.user.id;

    const body = (await req.json()) as Payload;
    const nichos = (body.nichos ?? []).filter(Boolean).slice(0, 20);
    const topicos = (body.topicos ?? '').trim().slice(0, 2000);

    if (!nichos.length && !topicos) {
      return new Response(
        JSON.stringify({ error: 'Informe ao menos um nicho ou tópicos.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const contextoBase = `Nichos: ${nichos.join(', ') || '—'}\nTópicos livres: ${topicos || '—'}\nContexto do negócio: mercado imobiliário brasileiro (foco em DF, sudeste e capitais). Público: proprietários, investidores e compradores.\n${body.contexto ? `Extra: ${body.contexto}` : ''}`;

    if (body.action === 'analisar') {
      const system = `Você é um estrategista sênior de SEO e conteúdo para o mercado imobiliário no Brasil.
Responda SEMPRE em JSON válido com o schema:
{
  "resumo": string,
  "tendencias": [{ "titulo": string, "descricao": string, "urgencia": "alta"|"media"|"baixa" }],
  "concorrentes": [{ "nome": string, "abordagem": string, "gap_oportunidade": string }],
  "keywords": [{ "termo": string, "volume_estimado": "alto"|"medio"|"baixo", "concorrencia": "alta"|"media"|"baixa", "intencao": "informacional"|"comercial"|"transacional"|"navegacional" }],
  "temas_prioritarios": [{ "tema": string, "potencial_seo": "alto"|"medio"|"baixo", "potencial_engajamento": "alto"|"medio"|"baixo", "por_que": string }],
  "riscos": [string],
  "proximos_passos": [string]
}
Seja específico, evite genéricos, foque em oportunidades de baixa concorrência e alta intenção.`;

      const user = `Analise o(s) nicho(s) abaixo e produza o JSON pedido.\n\n${contextoBase}\n\nGere pelo menos 5 tendências, 5 concorrentes/abordagens típicas, 12 keywords e 6 temas prioritários.`;

      const resultado = await callAI(system, user);

      const { data: inserted, error: insErr } = await supabase
        .from('blog_analises_ia')
        .insert({
          imobiliaria_id: imobiliariaId,
          nichos,
          topicos,
          resultado,
          modelo: 'openai/gpt-5.5',
        })
        .select('id, created_at')
        .single();

      if (insErr) throw new Error(`db insert analise: ${insErr.message}`);

      return new Response(
        JSON.stringify({ ok: true, analise_id: inserted.id, resultado }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (body.action === 'sugerir') {
      const quantidade = Math.min(Math.max(body.quantidade ?? 8, 1), 20);

      // opcional: enriquecer com última análise
      let analiseResumo = '';
      if (body.analise_id) {
        const { data: a } = await supabase
          .from('blog_analises_ia')
          .select('resultado')
          .eq('id', body.analise_id)
          .maybeSingle();
        if (a?.resultado) {
          analiseResumo = `\n\nAnálise anterior (resumida): ${JSON.stringify(a.resultado).slice(0, 3500)}`;
        }
      }

      const system = `Você é editor-chefe de um blog imobiliário premium. Gere pautas prontas para produção.
Responda SEMPRE em JSON válido com o schema:
{
  "sugestoes": [
    {
      "titulo": string,                  // otimizado para CTR
      "angulo": string,                  // proposta única de valor
      "formato": "guia"|"tutorial"|"estudo_de_caso"|"lista"|"infografico"|"comparativo"|"opiniao"|"noticia",
      "keyword_primaria": string,
      "keywords_secundarias": [string],
      "estrutura": [{ "h2": string, "bullets": [string] }],
      "publico_alvo": string,
      "potencial_seo": "alto"|"medio"|"baixo",
      "potencial_engajamento": "alto"|"medio"|"baixo"
    }
  ]
}
Regras: títulos com 50-65 caracteres, 3-6 keywords secundárias, 5-8 seções H2 com 2-4 bullets cada.`;

      const user = `Gere ${quantidade} sugestões originais e acionáveis.\n\n${contextoBase}${analiseResumo}\n\nEvite temas genéricos como "dicas para vender imóvel" — busque ângulos novos, baseados nas tendências e gaps identificados.`;

      const out = await callAI(system, user);
      const sugestoesArr: any[] = Array.isArray(out?.sugestoes) ? out.sugestoes : [];

      if (!sugestoesArr.length) {
        return new Response(
          JSON.stringify({ ok: false, error: 'IA não retornou sugestões válidas', raw: out }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const rows = sugestoesArr.slice(0, quantidade).map((s) => ({
        imobiliaria_id: imobiliariaId,
        analise_id: body.analise_id ?? null,
        titulo: String(s.titulo ?? '').slice(0, 300),
        angulo: s.angulo ?? null,
        formato: s.formato ?? null,
        keyword_primaria: s.keyword_primaria ?? null,
        keywords_secundarias: Array.isArray(s.keywords_secundarias) ? s.keywords_secundarias : [],
        estrutura: Array.isArray(s.estrutura) ? s.estrutura : [],
        publico_alvo: s.publico_alvo ?? null,
        potencial_seo: s.potencial_seo ?? null,
        potencial_engajamento: s.potencial_engajamento ?? null,
      }));

      const { data: inserted, error: insErr } = await supabase
        .from('blog_sugestoes_ia')
        .insert(rows)
        .select('*');

      if (insErr) throw new Error(`db insert sugestoes: ${insErr.message}`);

      return new Response(
        JSON.stringify({ ok: true, sugestoes: inserted }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(JSON.stringify({ error: 'action inválida' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('blog-estrategia-ia error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
