import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Tiered reminder thresholds (in minutes before the event)
const REMINDER_TIERS = [
  { nivel: 1, label: "1 dia antes", minutesBefore: 24 * 60, icon: "📅" },
  { nivel: 2, label: "6 horas antes", minutesBefore: 6 * 60, icon: "⏰" },
  { nivel: 3, label: "3 horas antes", minutesBefore: 3 * 60, icon: "⚠️" },
  { nivel: 4, label: "1 hora antes", minutesBefore: 60, icon: "🔴" },
  { nivel: 5, label: "15 minutos antes", minutesBefore: 15, icon: "🚨" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date();
    const oneDayFromNow = new Date(now.getTime() + 25 * 60 * 60 * 1000); // slightly over 1 day

    // Fetch all pending compromissos within the next ~25 hours that haven't reached max tier
    const { data: compromissos, error } = await supabase
      .from("compromissos")
      .select("id, titulo, data_inicio, data_fim, telefone_lembrete, local, imobiliaria_id, tipo, lembrete_whatsapp, lembrete_nivel, lead_id, prioridade, google_maps_link, email_cliente")
      .eq("status", "pendente")
      .lt("lembrete_nivel", 5)
      .gte("data_inicio", now.toISOString())
      .lte("data_inicio", oneDayFromNow.toISOString());

    if (error) throw error;

    const results: { id: string; status: string; tier: number; label: string }[] = [];

    for (const c of compromissos || []) {
      const dataInicio = new Date(c.data_inicio);
      const minutesUntil = (dataInicio.getTime() - now.getTime()) / (1000 * 60);

      // Find the highest tier we should be at
      let targetTier = 0;
      let targetLabel = "";
      let targetIcon = "";
      for (const tier of REMINDER_TIERS) {
        if (minutesUntil <= tier.minutesBefore && c.lembrete_nivel < tier.nivel) {
          targetTier = tier.nivel;
          targetLabel = tier.label;
          targetIcon = tier.icon;
        }
      }

      if (targetTier === 0) continue; // No new tier to trigger

      const hora = dataInicio.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Sao_Paulo",
      });
      const data = dataInicio.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        timeZone: "America/Sao_Paulo",
      });

      const prioLabel = c.prioridade === "alta" ? "🔴 ALTA" : c.prioridade === "media" ? "🟡 Média" : "🟢 Baixa";

      // Escalation message based on tier
      let urgency = "";
      if (targetTier >= 5) urgency = "⚡ URGENTE! ";
      else if (targetTier >= 4) urgency = "⏳ Em breve! ";
      else if (targetTier >= 3) urgency = "📢 Atenção! ";

      // CRM notification
      await supabase.from("notifications").insert({
        user_id: c.imobiliaria_id,
        title: `${targetIcon} ${urgency}${c.titulo}`,
        description: `${targetLabel} — ${data} às ${hora} | Prioridade: ${prioLabel}${c.local ? ` | 📍 ${c.local}` : ""}`,
      });

      // WhatsApp link notification (if enabled and phone available)
      if (c.lembrete_whatsapp && c.telefone_lembrete) {
        const phone = c.telefone_lembrete.replace(/\D/g, "");
        if (phone) {
          const mensagem = encodeURIComponent(
            `${targetIcon} *Lembrete de Compromisso* (${targetLabel})\n\n` +
            `📋 *${c.titulo}*\n` +
            `📅 ${data} às ${hora}\n` +
            `🎯 Prioridade: ${prioLabel}\n` +
            (c.local ? `📍 ${c.local}\n` : "") +
            (c.google_maps_link ? `🗺️ ${c.google_maps_link}\n` : "") +
            `\nEste é um lembrete automático escalonado.`
          );

          // Create a WhatsApp notification with the link
          await supabase.from("notifications").insert({
            user_id: c.imobiliaria_id,
            title: `📲 Enviar lembrete WhatsApp: ${c.titulo}`,
            description: `Clique para enviar: https://wa.me/55${phone}?text=${mensagem}`,
          });
        }
      }

      // Update the tier level
      await supabase
        .from("compromissos")
        .update({ lembrete_nivel: targetTier })
        .eq("id", c.id);

      results.push({ id: c.id, status: "notified", tier: targetTier, label: targetLabel });
      console.log(`Lembrete tier ${targetTier} (${targetLabel}): ${c.titulo}`);
    }

    // ===== Follow-ups vencendo hoje =====
    const todayStr = now.toISOString().split("T")[0];

    const { data: followups, error: fuError } = await supabase
      .from("followups")
      .select("id, tipo, descricao, data_followup, lead_id, imobiliaria_id, status")
      .eq("status", "pendente")
      .eq("data_followup", todayStr);

    if (fuError) throw fuError;

    const leadIds = [...new Set((followups || []).map((f) => f.lead_id))];
    const { data: leads } = leadIds.length
      ? await supabase.from("leads").select("id, nome").in("id", leadIds)
      : { data: [] };
    const leadMap = new Map((leads || []).map((l: any) => [l.id, l.nome]));

    for (const fu of followups || []) {
      const leadNome = leadMap.get(fu.lead_id) || "Lead";
      const tipoLabel = fu.tipo === "ligacao" ? "Ligação" : fu.tipo === "whatsapp" ? "WhatsApp" : fu.tipo === "reuniao" ? "Reunião" : fu.tipo;

      await supabase.from("notifications").insert({
        user_id: fu.imobiliaria_id,
        title: `⏰ Follow-up hoje: ${leadNome}`,
        description: `${tipoLabel} pendente para ${leadNome}. ${fu.descricao || ""}`.trim(),
      });

      results.push({ id: fu.id, status: "notified", tier: 0, label: "follow-up" });
      console.log(`Follow-up lembrete: ${tipoLabel} para ${leadNome}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        results,
        timestamp: now.toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Erro no lembrete:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
