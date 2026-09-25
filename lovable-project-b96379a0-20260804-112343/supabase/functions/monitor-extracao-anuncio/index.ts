import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const windowMin = Number(url.searchParams.get("window") ?? 15);
    const t429 = Number(url.searchParams.get("t429") ?? 5);
    const t502 = Number(url.searchParams.get("t502") ?? 5);
    const tTotal = Number(url.searchParams.get("tTotal") ?? 15);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase.rpc("check_extracao_anuncio_spikes", {
      _window_minutes: windowMin,
      _threshold_429: t429,
      _threshold_502: t502,
      _threshold_total: tTotal,
    });

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, result: data }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[monitor-extracao-anuncio]", err);
    return new Response(JSON.stringify({ success: false, error: err?.message ?? String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
