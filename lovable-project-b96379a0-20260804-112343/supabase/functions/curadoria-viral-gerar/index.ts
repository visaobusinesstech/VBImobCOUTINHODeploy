import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { getUserAiConfig, callUserAi, tryParseJson, mapAiErrorPayload } from "../_shared/ai-config.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const FIRECRAWL_V2 = "https://api.firecrawl.dev/v2";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sbUrl = Deno.env.get("SUPABASE_URL")!;
    const sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(sbUrl, sbKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Sessão expirada" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { descoberta_id } = await req.json();
    if (!descoberta_id || typeof descoberta_id !== "string") {
      return new Response(JSON.stringify({ error: "descoberta_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch descoberta (RLS aplica)
    const { data: desc, error: dErr } = await supabase
      .from("curadoria_descobertas")
      .select("*")
      .eq("id", descoberta_id)
      .eq("imobiliaria_id", user.id)
      .maybeSingle();
    if (dErr) throw dErr;
    if (!desc) {
      return new Response(JSON.stringify({ error: "Descoberta não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Enrich with Firecrawl scrape (markdown) — opcional
    let materialOriginal = desc.resumo || "";
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (FIRECRAWL_API_KEY) {
      try {
        const scrapeRes = await fetch(`${FIRECRAWL_V2}/scrape`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: desc.url,
            formats: ["markdown"],
            onlyMainContent: true,
          }),
        });
        if (scrapeRes.ok) {
          const scrapeData = await scrapeRes.json();
          const md = scrapeData?.data?.markdown || scrapeData?.markdown || "";
          if (md) materialOriginal = String(md).slice(0, 8000);
        }
      } catch (err) {
        console.warn("[curadoria-viral-gerar] scrape falhou:", err);
      }
    }

    const aiCfg = await getUserAiConfig(supabase, user.id);
    if (!aiCfg) {
      return new Response(
        JSON.stringify({
          success: false,
          error_code: "no_ai_connected",
          message: "Nenhuma IA configurada. Acesse Configurações → IA.",
          config_url: "/configurar-ia",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const systemPrompt = `Você é um redator especializado em curadoria e reinterpretação de conteúdo viral, com integridade editorial rigorosa.

REGRAS OBRIGATÓRIAS:
1. NUNCA copie parágrafos ou trechos literais do material original — sempre parafraseie com voz própria.
2. Cite a fonte original inline usando markdown [texto](URL) próximo a dados/afirmações extraídas dela.
3. Retorne SEMPRE ao menos 1 item em "fontes" (a fonte original vinda da descoberta é obrigatória).
4. Inclua um bloco final "Fontes e Créditos" listando cada referência.
5. Respeite direitos autorais (Lei 9.610/98) e LGPD — não reproduza dados pessoais.
6. Ao começar o artigo, deixe explícito que o conteúdo se baseia em uma fonte externa (ex.: "Conforme reportagem de X publicada em Y…").`;

    const userPrompt = `Reescreva o conteúdo abaixo como um artigo original de blog imobiliário em pt-BR, mantendo o valor informativo e a essência, mas com narrativa própria.

TÍTULO ORIGINAL: ${desc.titulo}
URL ORIGINAL: ${desc.url}
FONTE: ${desc.fonte_nome || desc.fonte_dominio}
AUTOR: ${desc.autor || "não informado"}
RESUMO: ${desc.resumo || "—"}

MATERIAL ORIGINAL (para referência, NÃO copie literalmente):
${materialOriginal || "(sem material extraído — trabalhe a partir do título/resumo)"}

Alvo: 800–1200 palavras, tom informativo e acessível, otimizado para SEO local imobiliário quando aplicável.

RETORNE APENAS JSON válido:
{
  "titulo": "Título SEO reescrito (≤65 char)",
  "meta_description": "Meta description ≤160 char",
  "slug": "url-do-post",
  "introducao": "Parágrafo de abertura citando a fonte inline",
  "secoes": [{"subtitulo": "H2", "conteudo": "Markdown com citações [texto](URL) quando referenciar fatos externos"}],
  "conclusao": "Encerramento com call-to-action",
  "palavras_chave": ["tag1","tag2","tag3","tag4","tag5"],
  "fontes": [{"nome":"${desc.fonte_nome || desc.fonte_dominio}","autor":"${desc.autor || ""}","url":"${desc.url}","tipo":"artigo","licenca":"uso jornalístico com atribuição"}],
  "creditos_imagens": []
}`;

    const aiResult = await callUserAi(aiCfg, {
      systemPrompt,
      userPrompt,
      wantJson: true,
      temperature: 0.7,
    });

    if (!aiResult.ok) {
      return new Response(JSON.stringify(mapAiErrorPayload(aiResult)), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = tryParseJson(aiResult.text) as any;
    if (!parsed) {
      return new Response(
        JSON.stringify({ success: false, error_code: "invalid_response", message: "IA retornou formato inválido." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Garantir a fonte original no array de fontes
    parsed.fontes = Array.isArray(parsed.fontes) ? parsed.fontes : [];
    const jaTem = parsed.fontes.some((f: any) => (f?.url || "").includes(desc.url));
    if (!jaTem) {
      parsed.fontes.unshift({
        nome: desc.fonte_nome || desc.fonte_dominio,
        autor: desc.autor || "",
        url: desc.url,
        tipo: "artigo",
        licenca: "uso jornalístico com atribuição",
      });
    }

    const slug = parsed.slug ? slugify(parsed.slug) : slugify(parsed.titulo || desc.titulo);
    const finalSlug = `${slug}-${Date.now().toString(36)}`.slice(0, 90);

    // Insert em conteudos_seo como rascunho
    const { data: post, error: postErr } = await supabase
      .from("conteudos_seo")
      .insert({
        imobiliaria_id: user.id,
        tipo: "post_blog",
        titulo: parsed.titulo || desc.titulo,
        slug: finalSlug,
        tema: desc.titulo,
        conteudo: parsed,
        status: "rascunho",
        origem: "curadoria_viral",
        meta_description: parsed.meta_description || null,
        tags: Array.isArray(parsed.palavras_chave) ? parsed.palavras_chave : [],
      })
      .select()
      .single();
    if (postErr) throw postErr;

    // Atualiza descoberta
    await supabase
      .from("curadoria_descobertas")
      .update({ status: "rascunho_gerado", conteudo_seo_id: post.id })
      .eq("id", desc.id);

    await supabase.from("curadoria_execucoes_log").insert({
      imobiliaria_id: user.id,
      tema_id: desc.tema_id,
      tipo: "geracao",
      status: "sucesso",
      posts_gerados: 1,
      detalhes: { descoberta_id: desc.id, conteudo_seo_id: post.id },
    });

    return new Response(
      JSON.stringify({ success: true, conteudo_seo_id: post.id, slug: finalSlug }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[curadoria-viral-gerar] erro:", e);
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
