import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireUserAi, callUserAi, tryParseJson, aiErrorResponse } from "../_shared/ai-config.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sbAdmin = createClient(supabaseUrl, serviceKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await sbAdmin.auth.getUser(token);

    const _iaGate = await requireUserAi(sbAdmin, user?.id, corsHeaders);
    if (_iaGate.response) return _iaGate.response;
    if (!user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await sbAdmin.from("profiles").select("approved, is_master").eq("id", user.id).single();
    if (!profile?.approved || !profile?.is_master) {
      return new Response(JSON.stringify({ error: "Apenas o administrador pode importar carteiras." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const url = body?.url;
    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ error: "URL é obrigatória" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    try {
      const parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("bad");
    } catch {
      return new Response(JSON.stringify({ error: "URL inválida" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (!FIRECRAWL_API_KEY) {
      return new Response(JSON.stringify({ error: "Firecrawl não configurado." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Starting bulk import from:", url);

    // Scrape with markdown + html + links to get all content and images
    const fcRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown", "html", "links"],
        onlyMainContent: false,
      }),
    });

    if (!fcRes.ok) {
      const errText = await fcRes.text();
      console.error("Firecrawl scrape failed:", fcRes.status, errText);
      return new Response(JSON.stringify({ error: "Erro ao acessar o portal. Tente novamente." }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fcData = await fcRes.json();
    const pageMarkdown = fcData?.data?.markdown || "";
    const pageHtml = fcData?.data?.html || "";
    const pageLinks: string[] = fcData?.data?.links || [];

    // Extract all images from HTML
    const allPageImages = extractImagesFromHtml(pageHtml);
    const mdImages = extractImagesFromMarkdown(pageMarkdown);
    for (const img of mdImages) {
      if (!allPageImages.includes(img)) allPageImages.push(img);
    }

    console.log(`Page scraped. Markdown: ${pageMarkdown.length}, HTML: ${pageHtml.length}, Images found: ${allPageImages.length}, Links: ${pageLinks.length}`);

    // Build image list for AI
    const imageListText = allPageImages.length > 0
      ? `\n\nTODAS AS IMAGENS ENCONTRADAS NA PÁGINA:\n${allPageImages.map((u, i) => `${i+1}. ${u}`).join("\n")}`
      : "";

    const userPrompt = `Extraia TODOS os imóveis listados nesta página de portal imobiliário.

Conteúdo da página:
${pageMarkdown.substring(0, 12000)}${imageListText}

Links encontrados na página:
${pageLinks.slice(0, 100).join("\n")}

Retorne um JSON com esta estrutura:
{
  "imoveis": [
    { "titulo": "", "tipo": "Apartamento|Casa|Terreno|Comercial|Cobertura|Kitnet|Sala|Loja|Galpão|Sobrado",
      "operacao": "Venda|Aluguel", "area": number|null, "quartos": number|null, "suites": number|null,
      "banheiros": number|null, "vagas": number|null, "bairro": string|null, "cidade": string|null,
      "estado": string|null, "cep": string|null, "preco": number|null, "valor_condominio": number|null,
      "valor_iptu": number|null, "endereco": string|null, "andar": string|null,
      "descricao": "texto descritivo próprio do imóvel, sem URLs/links",
      "url_anuncio": string|null, "fotos": ["urls das fotos deste imóvel"] }
  ],
  "total_encontrados": number,
  "portal": "nome do portal"
}

IMPORTANTE: extraia TODOS os imóveis; associe fotos corretas; a descrição NÃO deve conter URLs.`;

    const aiRes = await callUserAi(_iaGate.config, {
      systemPrompt: "Você é um especialista em extrair dados de páginas de portais imobiliários. Responda SOMENTE em JSON válido.",
      userPrompt,
      wantJson: true,
      temperature: 0.1,
      maxTokens: 8000,
      timeoutMs: 120000,
    });

    if (!aiRes.ok) return aiErrorResponse(aiRes, corsHeaders);

    const parsed: any = tryParseJson(aiRes.text);
    if (!parsed) {
      return new Response(JSON.stringify({ error: "Não foi possível interpretar os dados do portal." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const imoveis = parsed?.imoveis || [];
    if (imoveis.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        importados: 0, 
        message: "Nenhum imóvel encontrado na página. Tente uma página de listagem com múltiplos anúncios." 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`AI extracted ${imoveis.length} properties`);

    const records = imoveis.map((im: any) => {
      // Get photos from AI + ensure they're valid URLs
      const fotos = Array.isArray(im.fotos) 
        ? im.fotos.filter((f: any) => typeof f === "string" && f.startsWith("http")).slice(0, 30) 
        : [];
      
      return {
        imobiliaria_id: user.id,
        titulo: sanitize(im.titulo) || "Imóvel importado",
        tipo: sanitize(im.tipo) || "Apartamento",
        operacao: sanitize(im.operacao) || "Venda",
        area: toNum(im.area) || 0,
        quartos: toInt(im.quartos) || 0,
        suites: toInt(im.suites) || 0,
        banheiros: toInt(im.banheiros) || 0,
        vagas: toInt(im.vagas) || 0,
        bairro: sanitize(im.bairro) || null,
        cidade: sanitize(im.cidade) || null,
        estado: sanitize(im.estado) || null,
        cep: sanitize(im.cep) || null,
        preco: toNum(im.preco) || 0,
        valor_condominio: toNum(im.valor_condominio) || 0,
        valor_iptu: toNum(im.valor_iptu) || 0,
        endereco: sanitize(im.endereco) || null,
        andar: sanitize(im.andar) || null,
        descricao: sanitizeDescription(im.descricao) || null,
        status: "Ativo",
        fotos,
        exclusivo: false,
        destaque: false,
        aceita_permuta: false,
        aceita_financiamento: false,
        aceita_fgts: false,
        tem_escritura: false,
      };
    });

    const { data: inserted, error: insertError } = await sbAdmin
      .from("imoveis")
      .insert(records)
      .select("id");

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(JSON.stringify({ error: "Erro ao salvar imóveis no banco de dados." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const count = inserted?.length || 0;
    console.log(`Successfully imported ${count} properties`);

    await sbAdmin.from("ai_usage_log").insert({ user_id: user.id, function_name: "importar-carteira-portal" });

    return new Response(JSON.stringify({
      success: true,
      importados: count,
      total_encontrados: imoveis.length,
      portal: sanitize(parsed.portal) || "Portal",
      message: `${count} imóveis importados com sucesso!`,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("importar-carteira-portal error:", e);
    return new Response(JSON.stringify({ error: "Erro interno ao processar importação." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function extractImagesFromHtml(html: string): string[] {
  const images: string[] = [];
  if (!html) return images;
  
  const imgTagRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = imgTagRegex.exec(html)) !== null) {
    if (isPropertyImage(match[1])) images.push(match[1]);
  }
  
  const dataSrcRegex = /data-src=["']([^"']+)["']/gi;
  while ((match = dataSrcRegex.exec(html)) !== null) {
    if (isPropertyImage(match[1]) && !images.includes(match[1])) images.push(match[1]);
  }
  
  const srcsetRegex = /srcset=["']([^"']+)["']/gi;
  while ((match = srcsetRegex.exec(html)) !== null) {
    const urls = match[1].split(",").map(s => s.trim().split(/\s+/)[0]);
    for (const u of urls) {
      if (isPropertyImage(u) && !images.includes(u)) images.push(u);
    }
  }
  
  const bgRegex = /background-image:\s*url\(['"]?([^'")]+)['"]?\)/gi;
  while ((match = bgRegex.exec(html)) !== null) {
    if (isPropertyImage(match[1]) && !images.includes(match[1])) images.push(match[1]);
  }
  
  return images;
}

function extractImagesFromMarkdown(md: string): string[] {
  const images: string[] = [];
  if (!md) return images;
  const imgRegex = /!\[.*?\]\((https?:\/\/[^\s)]+)\)/g;
  let match;
  while ((match = imgRegex.exec(md)) !== null) {
    if (isPropertyImage(match[1])) images.push(match[1]);
  }
  const plainUrlRegex = /(https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp)(?:\?[^\s"'<>]*)?)/gi;
  while ((match = plainUrlRegex.exec(md)) !== null) {
    if (isPropertyImage(match[1]) && !images.includes(match[1])) images.push(match[1]);
  }
  return images;
}

function isPropertyImage(url: string): boolean {
  if (!url || !url.startsWith("http")) return false;
  if (/logo|icon|sprite|favicon|banner-ad|pixel|tracking|analytics|badge|button|arrow|widget/i.test(url)) return false;
  if (/\.(jpg|jpeg|png|webp|avif)/i.test(url)) return true;
  if (/resizedimgs|img\.zap|photos\.zap|vivareal|olx|imgzap|cloudinary|amazonaws|imgix|akamai/i.test(url)) return true;
  return false;
}

function sanitize(val: any): string | null {
  if (val === null || val === undefined) return null;
  return String(val).replace(/<[^>]*>/g, "").trim().substring(0, 500);
}

function sanitizeDescription(val: any): string | null {
  if (val === null || val === undefined) return null;
  return String(val).replace(/<[^>]*>/g, "").replace(/https?:\/\/[^\s]+/g, "").trim().substring(0, 500);
}

function toNum(val: any): number | null {
  if (val === null || val === undefined) return null;
  const n = typeof val === "string" ? parseFloat(val.replace(/\./g, "").replace(",", ".")) : Number(val);
  return isNaN(n) ? null : n;
}

function toInt(val: any): number | null {
  const n = toNum(val);
  return n !== null ? Math.round(n) : null;
}
