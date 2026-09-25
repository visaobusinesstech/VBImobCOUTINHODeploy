import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Roda distribuição para todas as imobiliárias que tenham fila pendente.
// Chamado via pg_cron a cada 5 min OU manualmente (com body { imobiliaria_id }).
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sbUrl = Deno.env.get("SUPABASE_URL")!;
  const sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(sbUrl, sbKey);

  try {
    let alvos: string[] = [];
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({} as any));
      if (body?.imobiliaria_id) alvos = [body.imobiliaria_id];
    }

    if (alvos.length === 0) {
      const { data } = await admin
        .from("lead_distribution_queue")
        .select("imobiliaria_id")
        .eq("status", "pending");
      alvos = Array.from(new Set((data ?? []).map((r: any) => r.imobiliaria_id)));
    }

    const relatorio: any[] = [];
    for (const id of alvos) {
      const { data, error } = await admin.rpc("distribuir_fila_leads", {
        _imobiliaria_id: id, _max_iteracoes: 200,
      });
      relatorio.push({ imobiliaria_id: id, resultado: data?.[0] ?? null, error: error?.message ?? null });
    }

    return new Response(JSON.stringify({ success: true, total_imobiliarias: alvos.length, relatorio }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("distribuir-fila-leads error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
