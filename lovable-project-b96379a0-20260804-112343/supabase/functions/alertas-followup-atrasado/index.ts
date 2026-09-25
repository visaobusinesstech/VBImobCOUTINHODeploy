import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find follow-ups that are overdue by more than 24 hours and still pending
    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);
    const ontemStr = ontem.toISOString().split("T")[0];

    const { data: atrasados, error: fError } = await supabase
      .from("followups")
      .select("id, lead_id, imobiliaria_id, data_followup, tipo, descricao, leads(nome)")
      .eq("status", "pendente")
      .lte("data_followup", ontemStr);

    if (fError) throw fError;

    if (!atrasados || atrasados.length === 0) {
      return new Response(JSON.stringify({ message: "Nenhum follow-up atrasado encontrado", count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Group by imobiliaria_id to send one notification per user
    const byImob = new Map<string, typeof atrasados>();
    for (const f of atrasados) {
      const arr = byImob.get(f.imobiliaria_id) || [];
      arr.push(f);
      byImob.set(f.imobiliaria_id, arr);
    }

    let notificacoesEnviadas = 0;

    for (const [imobId, followups] of byImob) {
      // Check if we already sent a notification today for this user
      const hoje = new Date().toISOString().split("T")[0];
      const { data: existente } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", imobId)
        .like("title", "%follow-up%atrasado%")
        .gte("created_at", `${hoje}T00:00:00`)
        .limit(1);

      if (existente && existente.length > 0) continue;

      const nomes = followups
        .slice(0, 5)
        .map((f: any) => f.leads?.nome || "Lead")
        .join(", ");

      const desc = followups.length <= 5
        ? `Leads: ${nomes}`
        : `Leads: ${nomes} e mais ${followups.length - 5}`;

      const { error: nError } = await supabase.from("notifications").insert({
        user_id: imobId,
        title: `⚠️ ${followups.length} follow-up${followups.length > 1 ? "s" : ""} atrasado${followups.length > 1 ? "s" : ""}`,
        description: desc,
      });

      if (!nError) notificacoesEnviadas++;
    }

    return new Response(
      JSON.stringify({ message: "Alertas processados", atrasados: atrasados.length, notificacoes: notificacoesEnviadas }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
