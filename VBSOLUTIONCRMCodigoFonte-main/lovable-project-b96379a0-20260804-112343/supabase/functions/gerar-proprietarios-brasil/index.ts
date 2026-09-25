import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

// Esta função foi desativada por conformidade LGPD.
// A geração de proprietários "por IA" criava leads sem fonte pública verificável
// (url_anuncio ausente), o que viola a base legal Art. 7º IV (dados manifestamente
// tornados públicos pelo titular). Use os fluxos que registram fonte:
//  - Coleta LGPD (Firecrawl em portais da allowlist)
//  - RadarZAP (mensagens públicas com link do grupo/canal)
//  - Monitoramento de portais
Deno.serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  return new Response(
    JSON.stringify({
      success: false,
      code: "LGPD_SOURCE_REQUIRED",
      error:
        "Geração de proprietários por IA foi desativada para cumprir a LGPD: todo lead precisa de fonte pública verificável (url_anuncio). Use Coleta LGPD, RadarZAP ou Monitoramento de portais para trazer proprietários com origem registrada.",
    }),
    { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
