// Edge function: otimizar-avaliacao-ia
// Reescreve a "descrição do imóvel" do formulário SAS com apoio da IA (ChatGPT via Lovable AI Gateway),
// enriquecendo o texto com dados estruturados do imóvel (tipo, área, cômodos, endereço, preço, etc.).
// Nunca inventa fatos: usa apenas o que veio no payload.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

interface Imovel {
  tipo?: string;
  operacao?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  endereco?: string;
  area_privativa?: string | number;
  area_total?: string | number;
  area_util?: string | number;
  area_construida?: string | number;
  area_terreno?: string | number;
  quartos?: string | number;
  suites?: string | number;
  banheiros?: string | number;
  lavabos?: string | number;
  vagas?: string | number;
  andar?: string | number;
  ano_construcao?: string | number;
  estado_conservacao?: string;
  posicao_solar?: string;
  elevador?: boolean;
  vista_livre?: boolean;
  vista_permanente?: boolean;
  mobiliado?: boolean;
  reformado?: boolean;
  preco?: string | number;
  valor_condominio?: string | number;
  valor_iptu?: string | number;
  valor_taxa_extra?: string | number;
  taxa_extra_descricao?: string;
}

interface Payload {
  descricao_original: string;
  imovel: Imovel;
  tom?: "profissional" | "acolhedor" | "tecnico" | "publicitario";
  imagens?: string[]; // URLs públicas ou legendas (opcional — máx. 4)
}

const SYSTEM = `Você é um redator especialista em anúncios imobiliários brasileiros (pt-BR).
Sua tarefa é REESCREVER a descrição de um imóvel para um laudo/anúncio de avaliação, com base em:
- o texto original do corretor;
- as informações estruturadas do imóvel (tipo, área, cômodos, endereço, preço, etc.).

REGRAS ABSOLUTAS:
1. NUNCA invente fatos. Só use dados presentes no payload. Se algo faltar, omita — não presuma.
2. Preserve todos os números e valores oficiais (metragens, preços, quantidades) exatamente como recebidos.
3. Corrija gramática, ortografia, pontuação e fluidez. Prefira frases curtas e claras.
4. Enriqueça a redação incorporando os dados estruturados que fizerem sentido (ex.: se há "elevador=true", mencione elevador).
5. Estruture em 3 a 5 parágrafos curtos: (a) visão geral do imóvel, (b) ambientes/áreas, (c) diferenciais e conservação, (d) localização e entorno (se houver dados), (e) fechamento objetivo.
6. Tom padrão: profissional, informativo, sem exageros comerciais ("imperdível", "único", "melhor da cidade" — proibido).
7. Não use emojis, não use listas com bullet, apenas texto corrido.
8. Comprimento: entre 600 e 1.400 caracteres.
9. Idioma: português do Brasil.

Retorne APENAS um JSON válido no formato:
{
  "descricao_otimizada": string,
  "resumo_mudancas": string[],          // 3-6 bullets curtos do que foi melhorado
  "topicos_adicionados": string[],      // termos vindos dos dados estruturados que entraram no texto
  "avisos": string[]                    // ex: "faltou informar ano de construção" — opcional
}`;

function fmtBool(v: unknown, yes: string, no?: string) {
  if (v === true) return yes;
  if (v === false && no) return no;
  return "";
}

function buildImovelBrief(im: Imovel): string {
  const linhas: string[] = [];
  if (im.tipo) linhas.push(`Tipo: ${im.tipo}${im.operacao ? ` — ${im.operacao}` : ""}`);
  const local = [im.endereco, im.bairro, im.cidade, im.estado].filter(Boolean).join(", ");
  if (local) linhas.push(`Localização: ${local}`);
  const areas: string[] = [];
  if (im.area_privativa) areas.push(`privativa ${im.area_privativa} m²`);
  if (im.area_util) areas.push(`útil ${im.area_util} m²`);
  if (im.area_construida) areas.push(`construída ${im.area_construida} m²`);
  if (im.area_total) areas.push(`total ${im.area_total} m²`);
  if (im.area_terreno) areas.push(`terreno ${im.area_terreno} m²`);
  if (areas.length) linhas.push(`Áreas: ${areas.join(" · ")}`);
  const comodos: string[] = [];
  if (im.quartos) comodos.push(`${im.quartos} quarto(s)`);
  if (im.suites) comodos.push(`${im.suites} suíte(s)`);
  if (im.banheiros) comodos.push(`${im.banheiros} banheiro(s)`);
  if (im.lavabos) comodos.push(`${im.lavabos} lavabo(s)`);
  if (im.vagas) comodos.push(`${im.vagas} vaga(s)`);
  if (comodos.length) linhas.push(`Cômodos: ${comodos.join(", ")}`);
  const feats: string[] = [];
  if (im.andar) feats.push(`${im.andar}º andar`);
  if (im.posicao_solar) feats.push(`sol da ${im.posicao_solar}`);
  const flags = [
    fmtBool(im.elevador, "com elevador"),
    fmtBool(im.vista_livre, "vista livre"),
    fmtBool(im.vista_permanente, "vista permanente"),
    fmtBool(im.mobiliado, "mobiliado"),
    fmtBool(im.reformado, "reformado"),
  ].filter(Boolean);
  if (flags.length) feats.push(...flags);
  if (im.ano_construcao) feats.push(`construído em ${im.ano_construcao}`);
  if (im.estado_conservacao) feats.push(`conservação: ${im.estado_conservacao}`);
  if (feats.length) linhas.push(`Características: ${feats.join(", ")}`);
  const val: string[] = [];
  if (im.preco) val.push(`preço R$ ${im.preco}`);
  if (im.valor_condominio) val.push(`condomínio R$ ${im.valor_condominio}`);
  if (im.valor_iptu) val.push(`IPTU R$ ${im.valor_iptu}`);
  if (im.valor_taxa_extra) val.push(`taxa extra R$ ${im.valor_taxa_extra}${im.taxa_extra_descricao ? ` (${im.taxa_extra_descricao})` : ""}`);
  if (val.length) linhas.push(`Valores: ${val.join(" · ")}`);
  return linhas.join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método não permitido" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) throw new Error("LOVABLE_API_KEY não configurada");

    const payload = (await req.json()) as Payload;
    const original = (payload?.descricao_original || "").trim();
    if (original.length < 10) {
      return new Response(JSON.stringify({ error: "Escreva ao menos 10 caracteres na descrição antes de otimizar." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (original.length > 4000) {
      return new Response(JSON.stringify({ error: "Descrição muito longa (máx. 4000 caracteres)." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const imovel = payload?.imovel ?? {};
    const brief = buildImovelBrief(imovel);
    const tom = payload?.tom || "profissional";

    // Suporte multimodal opcional: até 4 imagens (URLs públicas).
    const imagens = Array.isArray(payload.imagens) ? payload.imagens.filter((u) => typeof u === "string").slice(0, 4) : [];
    const userContent: Array<Record<string, unknown>> = [
      {
        type: "text",
        text: [
          `Tom desejado: ${tom}.`,
          "",
          "DADOS ESTRUTURADOS DO IMÓVEL:",
          brief || "(nenhum dado estruturado informado)",
          "",
          "DESCRIÇÃO ORIGINAL DO CORRETOR:",
          original,
          "",
          imagens.length
            ? `Considere também as imagens anexadas (${imagens.length}). Se identificar detalhes visuais (acabamento, iluminação, mobília), mencione apenas o que for consistente com os dados estruturados. Não invente.`
            : "",
          "Reescreva agora seguindo todas as regras.",
        ].filter(Boolean).join("\n"),
      },
    ];
    for (const url of imagens) {
      userContent.push({ type: "image_url", image_url: { url } });
    }

    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5.5",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (res.status === 429) {
      return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em instantes." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (res.status === 402) {
      return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos no workspace." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`AI ${res.status}: ${body.slice(0, 300)}`);
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content ?? "{}";
    let parsed: {
      descricao_otimizada?: string;
      resumo_mudancas?: string[];
      topicos_adicionados?: string[];
      avisos?: string[];
    };
    try { parsed = JSON.parse(content); } catch { parsed = {}; }

    const otimizada = (parsed.descricao_otimizada || "").trim();
    if (!otimizada || otimizada.length < 60) {
      return new Response(JSON.stringify({ error: "A IA não retornou uma descrição válida. Tente novamente." }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      descricao_otimizada: otimizada.slice(0, 2000),
      resumo_mudancas: Array.isArray(parsed.resumo_mudancas) ? parsed.resumo_mudancas.slice(0, 8) : [],
      topicos_adicionados: Array.isArray(parsed.topicos_adicionados) ? parsed.topicos_adicionados.slice(0, 15) : [],
      avisos: Array.isArray(parsed.avisos) ? parsed.avisos.slice(0, 6) : [],
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("otimizar-avaliacao-ia error", e);
    return new Response(JSON.stringify({ error: (e as Error)?.message || "Falha inesperada" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
