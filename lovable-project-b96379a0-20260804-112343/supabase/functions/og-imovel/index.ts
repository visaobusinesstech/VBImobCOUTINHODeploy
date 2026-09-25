import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function escapeHtml(str: string | null | undefined): string {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function formatPreco(preco: number, operacao: string): string {
  const formatted = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(preco);
  return operacao === "Aluguel" ? `${formatted}/mês` : formatted;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return new Response("ID inválido", { status: 400, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: imovel, error } = await supabase
      .from("imoveis")
      .select("id, titulo, tipo, operacao, preco, bairro, cidade, estado, quartos, area, fotos, foto_capa_index, descricao")
      .eq("id", id)
      .eq("status", "Ativo")
      .single();

    if (error || !imovel) {
      return new Response("Imóvel não encontrado", { status: 404, headers: corsHeaders });
    }

    const fotos: string[] = imovel.fotos ?? [];
    const capaIndex = imovel.foto_capa_index ?? 0;
    const coverImage = fotos.length > 0 ? fotos[capaIndex] || fotos[0] : "";

    const local = [imovel.bairro, imovel.cidade].filter(Boolean).join(", ");
    const operacaoLabel = imovel.operacao === "Aluguel" ? "para alugar" : "à venda";

    // Clean titulo: remove portal sources like "- DFimoveis.com", "- OLX", etc.
    let cleanTitulo = (imovel.titulo || imovel.tipo || "Imóvel")
      .replace(/\s*-\s*(DFimoveis\.com|OLX|ZAP\s*Im[oó]veis|Viva\s*Real|W\s*Im[oó]veis|Chave\s*na\s*M[aã]o|Im[oó]veis\s*Web|Netimóveis|imovelweb).*$/i, "")
      .replace(/\s*(à venda|para alugar|para venda|para locação|com \d+ quartos?|em [A-ZÀ-Ú][a-zà-ú]+.*$)/gi, "")
      .trim();
    // If cleaning removed everything, fallback to tipo
    if (!cleanTitulo) cleanTitulo = imovel.tipo || "Imóvel";

    const title = `🏠 ${cleanTitulo} ${operacaoLabel}${imovel.quartos > 0 ? ` com ${imovel.quartos} quartos` : ""}${local ? ` em ${local}` : ""}`;
    const description = [
      `💰 ${formatPreco(imovel.preco, imovel.operacao)}`,
      imovel.quartos > 0 ? `🛏 ${imovel.quartos} quartos` : null,
      imovel.area > 0 ? `📐 ${imovel.area}m²` : null,
      local ? `📍 ${local.toUpperCase()}` : null,
    ].filter(Boolean).join(" | ");

    const publicUrl = `https://www.radarimobtech.shop/imovel/${imovel.id}?share=social`;

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${escapeHtml(publicUrl)}" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:site_name" content="radarimobtech" />
  ${coverImage ? `<meta property="og:image" content="${escapeHtml(coverImage)}" />
  <meta property="og:image:secure_url" content="${escapeHtml(coverImage)}" />
  <meta property="og:image:alt" content="${escapeHtml(title)}" />
  <meta property="og:image:width" content="800" />
  <meta property="og:image:height" content="600" />` : ""}
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  ${coverImage ? `<meta name="twitter:image" content="${escapeHtml(coverImage)}" />
  <meta name="twitter:image:alt" content="${escapeHtml(title)}" />` : ""}
  <meta http-equiv="refresh" content="0;url=${escapeHtml(publicUrl)}" />
</head>
<body>
  <p>Redirecionando para <a href="${escapeHtml(publicUrl)}">${escapeHtml(cleanTitulo)}</a>...</p>
</body>
</html>`;

    return new Response(html, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (err) {
    console.error("Erro OG imovel:", err);
    return new Response("Erro interno", { status: 500, headers: corsHeaders });
  }
});
