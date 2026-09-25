import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { lead_id, imobiliaria_id } = body;

    // Fetch lead data
    let query = supabase.from("leads").select("*");
    if (lead_id) {
      query = query.eq("id", lead_id);
    } else if (imobiliaria_id) {
      query = query.eq("imobiliaria_id", imobiliaria_id);
    } else {
      throw new Error("lead_id ou imobiliaria_id é obrigatório");
    }

    const { data: leads, error } = await query;
    if (error) throw error;
    if (!leads || leads.length === 0) {
      return new Response(JSON.stringify({ scores: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch followups and activities for scoring
    const leadIds = leads.map((l: any) => l.id);

    const [followupsRes, atividadesRes, compromissosRes] = await Promise.all([
      supabase.from("followups").select("lead_id, status, data_followup").in("lead_id", leadIds),
      supabase.from("lead_atividades").select("lead_id, tipo, created_at").in("lead_id", leadIds),
      supabase.from("compromissos").select("lead_id, status, tipo").in("lead_id", leadIds.filter(Boolean)),
    ]);

    const followups = followupsRes.data || [];
    const atividades = atividadesRes.data || [];
    const compromissos = compromissosRes.data || [];

    const scores = leads.map((lead: any) => {
      let score = 0;
      const signals: string[] = [];

      // 1. Stage scoring (0-30 pts)
      const stageScores: Record<string, number> = {
        novos: 10, qualificados: 20, visita: 25, proposta: 28,
        pediu_tempo: 15, quer_alugar: 22, nao_responde: 5,
        fechado: 30, perdido: 0,
      };
      score += stageScores[lead.estagio] || 5;
      if (lead.estagio === "proposta") signals.push("Em fase de proposta");
      if (lead.estagio === "visita") signals.push("Já realizou visita");

      // 2. Contact info completeness (0-15 pts)
      if (lead.telefone) { score += 5; signals.push("Tem telefone"); }
      if (lead.email) { score += 5; signals.push("Tem e-mail"); }
      if (lead.interesse) { score += 5; signals.push("Interesse definido"); }

      // 3. Financial qualification (0-15 pts)
      if (lead.valor > 0) {
        score += 10;
        if (lead.valor >= 500000) { score += 5; signals.push("Alto valor de interesse"); }
      }

      // 4. Engagement (followups & atividades) (0-20 pts)
      const leadFollowups = followups.filter((f: any) => f.lead_id === lead.id);
      const leadAtividades = atividades.filter((a: any) => a.lead_id === lead.id);
      const leadCompromissos = compromissos.filter((c: any) => c.lead_id === lead.id);

      if (leadFollowups.length > 0) { score += 5; signals.push(`${leadFollowups.length} follow-ups`); }
      if (leadFollowups.filter((f: any) => f.status === "concluido").length > 0) { score += 5; signals.push("Follow-ups concluídos"); }
      if (leadAtividades.length >= 3) { score += 5; signals.push("Múltiplas interações"); }
      if (leadCompromissos.length > 0) { score += 5; signals.push("Compromissos agendados"); }

      // 5. Recency (0-20 pts)
      const daysSinceUpdate = Math.floor((Date.now() - new Date(lead.updated_at).getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceUpdate <= 1) { score += 20; signals.push("Atualizado hoje"); }
      else if (daysSinceUpdate <= 3) { score += 15; signals.push("Atualizado recentemente"); }
      else if (daysSinceUpdate <= 7) { score += 10; }
      else if (daysSinceUpdate <= 14) { score += 5; }
      else { signals.push(`${daysSinceUpdate} dias sem atualização`); }

      // Classify
      const classification = score >= 70 ? "quente" : score >= 40 ? "morno" : "frio";
      const emoji = classification === "quente" ? "🔥" : classification === "morno" ? "🌤️" : "❄️";

      return {
        lead_id: lead.id,
        nome: lead.nome,
        score: Math.min(score, 100),
        classification,
        emoji,
        signals,
      };
    });

    return new Response(JSON.stringify({ scores }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Lead scoring error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
