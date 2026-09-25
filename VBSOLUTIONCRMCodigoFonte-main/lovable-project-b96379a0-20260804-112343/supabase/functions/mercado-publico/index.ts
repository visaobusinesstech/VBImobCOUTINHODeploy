// Edge function pública: agregados de mercado por cidade/bairro para páginas SEO.
// Sem PII, sem links de anúncio individual. Apenas contagens, preço médio, tempo médio.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function normalize(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const cidade = url.searchParams.get("cidade") ?? "";
    const bairro = url.searchParams.get("bairro") ?? "";
    if (!cidade) {
      return new Response(JSON.stringify({ error: "cidade obrigatória" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const cidadeN = normalize(cidade);
    const bairroN = bairro ? normalize(bairro) : null;

    // Agrega de imoveis_mercado (dados públicos coletados)
    let q = admin
      .from("imoveis_mercado")
      .select("preco, area, tipo, operacao, bairro, cidade, created_at")
      .limit(2000);
    const { data: mercadoRaw } = await q;
    const mercado = (mercadoRaw ?? []).filter((r: any) => {
      const c = normalize(r.cidade ?? "");
      if (c !== cidadeN && !c.includes(cidadeN)) return false;
      if (bairroN) {
        const b = normalize(r.bairro ?? "");
        return b === bairroN || b.includes(bairroN);
      }
      return true;
    });

    const precos = mercado.map((r: any) => Number(r.preco)).filter((n) => n > 0);
    const m2s = mercado
      .map((r: any) => (Number(r.preco) > 0 && Number(r.area) > 0 ? Number(r.preco) / Number(r.area) : 0))
      .filter((n) => n > 0);
    const mediana = (arr: number[]) => {
      if (!arr.length) return 0;
      const s = [...arr].sort((a, b) => a - b);
      return s[Math.floor(s.length / 2)];
    };
    const media = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

    const bairrosMap = new Map<string, number>();
    for (const r of mercado) {
      const b = (r.bairro ?? "").trim();
      if (b) bairrosMap.set(b, (bairrosMap.get(b) ?? 0) + 1);
    }
    const bairrosTop = [...bairrosMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([nome, total]) => ({ nome, total }));

    // Contagem de proprietários captados na cidade
    const { count: propCount } = await admin
      .from("lista_proprietarios_captacao")
      .select("id", { count: "exact", head: true })
      .ilike("cidade", `%${cidade}%`);

    const now = Date.now();
    const idadesDias = mercado
      .map((r: any) => (r.created_at ? Math.floor((now - new Date(r.created_at).getTime()) / 86400000) : 0))
      .filter((n) => n > 0 && n < 365);

    const body = {
      cidade,
      bairro: bairro || null,
      total_ativos: mercado.length,
      preco_medio: Math.round(media(precos)),
      preco_mediano: Math.round(mediana(precos)),
      preco_m2_medio: Math.round(media(m2s)),
      preco_m2_mediano: Math.round(mediana(m2s)),
      tempo_medio_dias: Math.round(media(idadesDias)),
      proprietarios_captados: propCount ?? 0,
      bairros_top: bairrosTop,
      atualizado_em: new Date().toISOString(),
    };

    return new Response(JSON.stringify(body), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=1800, s-maxage=3600",
      },
    });
  } catch (err: any) {
    console.error("[mercado-publico] erro:", err?.message ?? err);
    return new Response(JSON.stringify({ error: "internal" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
