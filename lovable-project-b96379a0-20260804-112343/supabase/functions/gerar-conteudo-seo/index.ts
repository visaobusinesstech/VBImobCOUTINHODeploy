import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { getUserAiConfig, callUserAi, tryParseJson, mapAiErrorPayload } from "../_shared/ai-config.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sbUrl = Deno.env.get("SUPABASE_URL")!;
    const sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(sbUrl, sbKey);
    
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Sessão expirada" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { tipo, dados } = await req.json();
    
    // Buscar configurações do usuário
    const { data: config } = await supabase
      .from("user_ai_config")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    let systemPrompt = "";
    let userPrompt = "";
    let searchResults = "";
    let internalLinks = "";

    // === Serper Integration ===
    const serperKey = config?.serper_key_encrypted;
    if (tipo === "post_blog" && serperKey && (dados.use_serper || dados.options?.citarFontes || dados.options?.listaFontes)) {
      try {
        const serperRes = await fetch("https://google.serper.dev/search", {
          method: "POST",
          headers: { "X-API-KEY": serperKey, "Content-Type": "application/json" },
          body: JSON.stringify({ q: dados.tema, gl: "br", hl: "pt" })
        });
        
        if (serperRes.ok) {
          const searchData = await serperRes.json();
          searchResults = JSON.stringify(searchData.organic?.slice(0, 8).map((r: any) => ({
            title: r.title,
            snippet: r.snippet,
            link: r.link
          })));
          
          // Log usage
          await supabase.from("serper_audit_logs").insert({
            user_id: user.id,
            search_query: dados.tema,
            results_count: searchData.organic?.length || 0
          });
        }
      } catch (e) { console.error("Serper error:", e); }
    }

    // === Internal Links Search ===
    if (tipo === "post_blog" && dados.options?.buscarLinksInternos && dados.options?.siteId) {
       const { data: site } = await supabase.from("wordpress_sites").select("*").eq("id", dados.options.siteId).single();
       if (site) {
          try {
             let apiUrl = site.base_url.replace(/\/$/, "");
             if (!apiUrl.startsWith("http")) apiUrl = "https://" + apiUrl;
             const wpRes = await fetch(`${apiUrl}/wp-json/wp/v2/posts?search=${encodeURIComponent(dados.tema)}&per_page=5`);
             if (wpRes.ok) {
                const posts = await wpRes.json();
                internalLinks = JSON.stringify(posts.map((p: any) => ({ title: p.title.rendered, link: p.link })));
             }
          } catch (e) { console.error("WP internal search error:", e); }
       }
    }

    // === Article Type Integration ===
    let customInstructions = "";
    if (tipo === "post_blog" && dados.article_type_id && dados.article_type_id !== "default") {
      const { data: articleType } = await supabase.from("article_types").select("prompt_template").eq("id", dados.article_type_id).maybeSingle();
      if (articleType?.prompt_template) customInstructions = articleType.prompt_template;
    }

    // === Build Prompts ===
    switch (tipo) {
      case "descricao_imovel":
        systemPrompt = "Você é um copywriter imobiliário experiente focado em SEO e conversão.";
        userPrompt = `Gere conteúdo otimizado para este imóvel: ${JSON.stringify(dados)}. JSON: {titulo_seo, meta_description, descricao_curta, descricao_completa, palavras_chave, hashtags, headline_anuncio}`;
        break;

      case "post_blog":
        systemPrompt = `Você é um especialista em marketing de conteúdo imobiliário e SEO técnico, comprometido com integridade editorial, LGPD e direitos autorais.

REGRAS OBRIGATÓRIAS DE ATRIBUIÇÃO (não negociáveis):
1. TODO dado, estatística, citação, imagem ou trecho de terceiros DEVE ter fonte identificável (nome do veículo/portal, autor quando disponível, URL direta ao material original).
2. Cite fontes inline no corpo do texto usando markdown [Texto âncora](URL) próximo à afirmação que apoiam. Não invente URLs — se não houver fonte verificável, reformule como conhecimento geral SEM número/estatística específica.
3. Ao referenciar material de outros portais, cite explicitamente o nome do veículo e o autor no próprio parágrafo (ex.: "Segundo reportagem de FULANO no Portal X...").
4. Nunca copie parágrafos literais de terceiros — sempre parafraseie e credite. Respeite direitos autorais e a Lei 9.610/98.
5. Para cada imagem sugerida, forneça crédito (autor/fotógrafo, plataforma, licença — ex.: Unsplash, CC-BY, Getty).
6. Inclua sempre uma seção final "Fontes e Créditos" listando cada referência utilizada, com objetos completos.`;
        const sizeInfo = dados.options?.tamanho === "curto" ? "aproximadamente 500 palavras" : dados.options?.tamanho === "longo" ? "mínimo de 2000 palavras" : "aproximadamente 1200 palavras";
        const povInfo = dados.options?.pontoDeVista === "primeira_pessoa" ? "Primeira Pessoa (Eu/Nós)" : "Terceira Pessoa (Ele/Ela)";
        userPrompt = `Crie um artigo completo sobre: "${dados.tema}".
        Tamanho: ${sizeInfo}.
        POV: ${povInfo}.
        Tom: ${dados.options?.tom || "Informativo"}.
        Idioma: ${dados.idioma || "pt-BR"}.
        ${searchResults ? `Baseie-se nestas informações atualizadas da web (use como fontes e cite-as):\n${searchResults}` : ""}
        ${internalLinks ? `Sugira onde inserir estes links internos do site:\n${internalLinks}` : ""}
        ${customInstructions ? `Siga estas instruções específicas de estilo:\n${customInstructions}` : ""}

        ATRIBUIÇÃO É OBRIGATÓRIA: cite fontes inline no texto com [Texto](URL) e preencha o array "fontes" com TODAS as referências utilizadas. Se o artigo não tiver fontes externas verificáveis, retorne "fontes": [] e evite estatísticas/dados específicos que exijam citação.

        RETORNE APENAS JSON: {
          "titulo": "Título do artigo",
          "meta_description": "Descrição SEO",
          "slug": "url-do-post",
          "introducao": "Texto introdutório",
          "secoes": [{"subtitulo": "H2", "conteudo": "Markdown com citações inline [Texto](URL)"}],
          "conclusao": "Encerramento",
          "palavras_chave": ["tag1", "tag2"],
          "fontes": [{"nome": "Nome do veículo/portal", "autor": "Autor quando disponível", "url": "https://link-direto", "tipo": "artigo|dado|imagem|estudo", "licenca": "Ex.: CC-BY, © portal, uso jornalístico"}],
          "creditos_imagens": [{"descricao": "Imagem sugerida para seção X", "autor": "Fotógrafo/artista", "fonte": "Unsplash/Getty/etc", "url": "https://...", "licenca": "CC0/CC-BY/Royalty-free/©"}]
        }`;
        break;

      default:
        systemPrompt = "Assistente de IA.";
        userPrompt = `Processar: ${JSON.stringify(dados)}`;
    }

    // === AI Execution (BYOK obrigatório) ===
    const isByok = config?.byok_active;

    if (!config || !isByok) {
      return new Response(
        JSON.stringify({
          error: "IA_NAO_CONFIGURADA",
          message: "Nenhuma IA configurada. Acesse Configurações → IA e informe seu provedor e chave para usar este recurso.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const provider = config.provider;
    let apiKey = config.provider_keys?.[provider] || config.api_key_encrypted;
    const model = config.model_article || config.model;

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: "IA_NAO_CONFIGURADA",
          message: `Chave para o provedor ${provider} não encontrada. Insira sua chave nas Configurações de IA.`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // === AI Execution via callUserAi (fallback chain automático) ===
    const aiCfg = await getUserAiConfig(supabase, user.id);
    if (!aiCfg) {
      return new Response(JSON.stringify({
        success: false, error_code: "no_ai_connected",
        message: "Nenhuma IA configurada. Acesse Configurações → IA.",
        config_url: "/configurar-ia",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiResult = await callUserAi(aiCfg, {
      systemPrompt,
      userPrompt,
      wantJson: true,
      temperature: 0.7,
    });

    if (!aiResult.ok) {
      return new Response(JSON.stringify(mapAiErrorPayload(aiResult)), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = tryParseJson(aiResult.text);
    if (!parsed) {
      return new Response(JSON.stringify({
        success: false, error_code: "invalid_response",
        message: "A IA respondeu em formato inválido. Tente novamente.",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    await supabase.from("ai_usage_logs").insert({
      user_id: user.id,
      provider: aiResult.provider,
      model: aiResult.model,
      tokens_used: 0,
      status: "success",
    });

    return new Response(JSON.stringify({ success: true, conteudo: parsed, active_model: aiResult.model }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });


  } catch (e) {
    console.error("Fatal error in gerar-conteudo-seo:", e);
    return new Response(JSON.stringify({ error: e.message }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});