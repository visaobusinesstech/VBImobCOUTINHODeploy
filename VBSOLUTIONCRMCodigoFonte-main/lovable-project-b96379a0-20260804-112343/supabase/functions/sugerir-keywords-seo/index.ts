// Edge function: sugerir-keywords-seo
// Analisa título + conteúdo e retorna palavras-chave secundárias, long-tail e LSI
// agrupadas por intenção/tipo, com sugestão de aplicação.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

interface Payload {
  titulo: string;
  meta_description?: string;
  tags?: string[];
  introducao?: string;
  conclusao?: string;
  secoes?: Array<{ titulo?: string; conteudo?: string }>;
  contexto_extra?: string;
  idioma?: string; // default pt-BR
  nicho?: string;  // opcional, ex "imobiliário DF"
}

function buildUserPrompt(p: Payload) {
  const secoes = (p.secoes || [])
    .map((s, i) => `## Seção ${i + 1}: ${s.titulo || ''}\n${(s.conteudo || '').slice(0, 800)}`)
    .join('\n\n');
  return [
    `Idioma: ${p.idioma || 'pt-BR'}`,
    p.nicho ? `Nicho/contexto: ${p.nicho}` : '',
    `TÍTULO: ${p.titulo}`,
    p.meta_description ? `META: ${p.meta_description}` : '',
    p.tags?.length ? `TAGS ATUAIS: ${p.tags.join(', ')}` : '',
    p.introducao ? `INTRODUÇÃO:\n${p.introducao.slice(0, 1200)}` : '',
    secoes ? `CONTEÚDO:\n${secoes}` : '',
    p.conclusao ? `CONCLUSÃO:\n${p.conclusao.slice(0, 800)}` : '',
    p.contexto_extra ? `EXTRA:\n${p.contexto_extra}` : '',
  ].filter(Boolean).join('\n\n');
}

const SYSTEM = `Você é especialista em SEO on-page e semântica de busca (Brasil/pt-BR).
Analise o artigo fornecido e produza sugestões de vocabulário SEO para ENRIQUECER o texto
antes da publicação — sem sugerir keyword stuffing. Foque em relevância contextual, cauda
longa (long-tail) e variações semânticas (LSI / termos relacionados).

Retorne APENAS um objeto JSON válido com este schema exato:

{
  "keyword_principal": { "termo": string, "justificativa": string },
  "grupos": [
    {
      "id": string,                // slug curto: "secundarias" | "long_tail_informacional" | "long_tail_transacional" | "lsi_semanticas" | "perguntas_paa" | "entidades_relacionadas" | "modificadores_locais" | "modificadores_comerciais"
      "titulo": string,            // rótulo humano em pt-BR
      "descricao": string,         // 1 frase explicando o grupo
      "intencao": "informacional" | "navegacional" | "comercial" | "transacional" | "misto",
      "estagio_jornada": "descoberta" | "consideracao" | "decisao" | "retencao",
      "aplicacao": string,         // onde/como usar (H2, meta, intro, FAQ, etc.)
      "keywords": [
        {
          "termo": string,
          "prioridade": "alta" | "media" | "baixa",
          "onde_usar": string,     // sugestão específica: "H2", "primeiro parágrafo", "meta description", "alt de imagem", "FAQ", "âncora interna", etc.
          "exemplo_frase": string  // uma frase natural de 8-18 palavras usando o termo
        }
      ]
    }
  ],
  "tags_sugeridas": string[],      // 5-10 tags curtas para o campo tags do post
  "meta_description_sugerida": string, // 120-158 chars, natural, com keyword principal
  "recomendacoes_gerais": string[] // 3-6 dicas objetivas (headings, links internos, schema, etc.)
}

Regras:
- Mínimo de 5 grupos distintos e no total 25-40 keywords únicas (sem repetir termos entre grupos).
- Não repita literalmente palavras já dominantes no título; explore sinônimos e conceitos adjacentes.
- Cobrir múltiplos estágios da jornada (descoberta → decisão).
- Cauda longa deve ter 4+ palavras e refletir busca real (não frases artificiais).
- Se o nicho for imobiliário BR, considere termos como "aluguel", "financiamento", "documentação", "ITBI", "condomínio", quando fizerem sentido.
- Nunca invente estatísticas; foque em vocabulário.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método não permitido' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const key = Deno.env.get('LOVABLE_API_KEY');
    if (!key) throw new Error('LOVABLE_API_KEY não configurada');

    const payload = (await req.json()) as Payload;
    if (!payload?.titulo || payload.titulo.trim().length < 3) {
      return new Response(JSON.stringify({ error: 'Título é obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const res = await fetch(GATEWAY_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-5.5',
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: buildUserPrompt(payload) },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (res.status === 429) {
      return new Response(JSON.stringify({ error: 'Limite de requisições atingido. Tente novamente em instantes.' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (res.status === 402) {
      return new Response(JSON.stringify({ error: 'Créditos de IA esgotados. Adicione créditos no workspace.' }), {
        status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`AI ${res.status}: ${body.slice(0, 300)}`);
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content ?? '{}';
    let parsed: any;
    try { parsed = JSON.parse(content); } catch { parsed = { raw: content }; }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('sugerir-keywords-seo error', e);
    return new Response(JSON.stringify({ error: e?.message || 'Falha inesperada' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
