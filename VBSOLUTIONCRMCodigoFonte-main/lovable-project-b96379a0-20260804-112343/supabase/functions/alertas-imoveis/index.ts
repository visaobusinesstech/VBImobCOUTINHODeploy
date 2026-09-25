import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date();
    const results: string[] = [];

    // 1. Imóveis parados há 60+ dias
    const cutoff60 = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();
    const cutoff120 = new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000).toISOString();

    const { data: imoveisAtivos, error: errImoveis } = await supabase
      .from("imoveis")
      .select("id, titulo, bairro, cidade, preco, area, created_at, imobiliaria_id")
      .eq("status", "Ativo")
      .lte("created_at", cutoff60);

    if (errImoveis) throw errImoveis;

    for (const im of imoveisAtivos || []) {
      const dias = Math.floor((now.getTime() - new Date(im.created_at).getTime()) / (1000 * 60 * 60 * 24));
      const critico = new Date(im.created_at) <= new Date(cutoff120);
      const icon = critico ? "🚨" : "⚠️";
      const urgencia = critico ? "CRÍTICO" : "Atenção";

      // Check if we already sent this alert today
      const todayStr = now.toISOString().split("T")[0];
      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", im.imobiliaria_id)
        .like("title", `%Parado ${dias}d%`)
        .gte("created_at", todayStr)
        .limit(1);

      if (existing && existing.length > 0) continue;

      await supabase.from("notifications").insert({
        user_id: im.imobiliaria_id,
        title: `${icon} ${urgencia} — "${im.titulo}" Parado ${dias}d`,
        description: `Imóvel em ${im.bairro || im.cidade || "—"} está há ${dias} dias sem movimentação. Considere revisar preço ou estratégia de divulgação.`,
      });

      results.push(`stale:${im.id}:${dias}d`);
    }

    // 2. Imóveis acima do mercado (comparar preço/m² com média do bairro)
    const { data: todosImoveis } = await supabase
      .from("imoveis")
      .select("id, titulo, bairro, cidade, preco, area, imobiliaria_id")
      .eq("status", "Ativo")
      .gt("area", 0)
      .gt("preco", 0);

    const { data: mercado } = await supabase
      .from("imoveis_mercado")
      .select("bairro, preco, area, preco_m2")
      .gt("preco", 0)
      .gt("area", 0);

    if (todosImoveis && mercado && mercado.length > 0) {
      // Calculate average price/m² per bairro from market data
      const bairroMap = new Map<string, { total: number; count: number }>();
      for (const m of mercado) {
        const b = (m.bairro || "").toLowerCase().trim();
        if (!b) continue;
        const pm2 = m.preco_m2 || (m.area > 0 ? m.preco / m.area : 0);
        if (pm2 <= 0) continue;
        const entry = bairroMap.get(b) || { total: 0, count: 0 };
        entry.total += pm2;
        entry.count += 1;
        bairroMap.set(b, entry);
      }

      const todayStr = now.toISOString().split("T")[0];

      for (const im of todosImoveis) {
        const bairro = (im.bairro || "").toLowerCase().trim();
        const entry = bairroMap.get(bairro);
        if (!entry || entry.count < 3) continue; // need at least 3 comparables

        const avgM2 = entry.total / entry.count;
        const imM2 = im.preco / im.area;
        const pctAbove = ((imM2 - avgM2) / avgM2) * 100;

        if (pctAbove < 15) continue; // only alert if 15%+ above market

        // Deduplicate
        const { data: existing } = await supabase
          .from("notifications")
          .select("id")
          .eq("user_id", im.imobiliaria_id)
          .like("title", `%acima do mercado%${im.titulo}%`)
          .gte("created_at", todayStr)
          .limit(1);

        if (existing && existing.length > 0) continue;

        const icon = pctAbove >= 30 ? "🔴" : "🟡";
        const sugestao = Math.round(avgM2 * im.area);

        await supabase.from("notifications").insert({
          user_id: im.imobiliaria_id,
          title: `${icon} ${Math.round(pctAbove)}% acima do mercado — "${im.titulo}"`,
          description: `Preço/m² R$${Math.round(imM2).toLocaleString()} vs média R$${Math.round(avgM2).toLocaleString()} no bairro ${im.bairro || "—"}. Sugestão: R$${sugestao.toLocaleString()}.`,
        });

        results.push(`overpriced:${im.id}:${Math.round(pctAbove)}%`);
      }
    }

    return new Response(
      JSON.stringify({ success: true, alerts: results.length, details: results, timestamp: now.toISOString() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Erro nos alertas:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
