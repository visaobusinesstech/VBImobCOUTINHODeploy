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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date();
    const hoje = now.toISOString().split("T")[0];
    const results: string[] = [];

    // 1. ANIVERSÁRIOS - Clientes de relacionamento com aniversário hoje
    const mesdia = `${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const { data: aniversariantes } = await supabase
      .from("clientes_relacionamento")
      .select("id, nome, telefone, imobiliaria_id")
      .eq("ativo", true)
      .not("aniversario", "is", null);

    const anivHoje = (aniversariantes ?? []).filter((c: any) => {
      if (!c.aniversario) return false;
      const d = c.aniversario as string;
      return d.endsWith(mesdia) || d.slice(5) === mesdia;
    });

    for (const cliente of anivHoje) {
      // Check if notification already sent today
      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", cliente.imobiliaria_id)
        .eq("title", "🎂 Aniversário")
        .gte("created_at", `${hoje}T00:00:00`)
        .limit(1);

      if (!existing || existing.length === 0) {
        await supabase.from("notifications").insert({
          user_id: cliente.imobiliaria_id,
          title: "🎂 Aniversário",
          description: `Hoje é aniversário de ${cliente.nome}! ${cliente.telefone ? "Envie uma mensagem de parabéns." : ""}`,
        });
        results.push(`Aniversário: ${cliente.nome}`);
      }
    }

    // 2. CONTRATOS VENCENDO em 30 dias
    const em30dias = new Date(now);
    em30dias.setDate(em30dias.getDate() + 30);
    const data30 = em30dias.toISOString().split("T")[0];

    const { data: contratosVencendo } = await supabase
      .from("contratos")
      .select("id, titulo, cliente, data_fim, imobiliaria_id")
      .eq("status", "ativo")
      .not("data_fim", "is", null)
      .lte("data_fim", data30)
      .gte("data_fim", hoje);

    for (const contrato of contratosVencendo ?? []) {
      const diasRestantes = Math.ceil((new Date(contrato.data_fim!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      // Only notify at 30, 15, 7, and 1 day marks
      if (![30, 15, 7, 1].includes(diasRestantes)) continue;

      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", contrato.imobiliaria_id)
        .eq("title", "📋 Contrato vencendo")
        .ilike("description", `%${contrato.titulo}%`)
        .gte("created_at", `${hoje}T00:00:00`)
        .limit(1);

      if (!existing || existing.length === 0) {
        await supabase.from("notifications").insert({
          user_id: contrato.imobiliaria_id,
          title: "📋 Contrato vencendo",
          description: `O contrato "${contrato.titulo}" (${contrato.cliente}) vence em ${diasRestantes} dia${diasRestantes > 1 ? "s" : ""}!`,
        });
        results.push(`Contrato vencendo: ${contrato.titulo} (${diasRestantes}d)`);
      }
    }

    // 3. LEADS FRIOS - Sem contato há 15+ dias (sem follow-up recente)
    const ha15dias = new Date(now);
    ha15dias.setDate(ha15dias.getDate() - 15);
    const data15 = ha15dias.toISOString();

    const { data: leadsFrios } = await supabase
      .from("leads")
      .select("id, nome, imobiliaria_id, updated_at, estagio")
      .not("estagio", "in", '("fechado","perdido")')
      .lte("updated_at", data15);

    for (const lead of leadsFrios ?? []) {
      // Check if there's a pending followup already
      const { data: followupExistente } = await supabase
        .from("followups")
        .select("id")
        .eq("lead_id", lead.id)
        .eq("status", "pendente")
        .limit(1);

      if (followupExistente && followupExistente.length > 0) continue;

      // Check if reengagement notification already sent this week
      const ha7dias = new Date(now);
      ha7dias.setDate(ha7dias.getDate() - 7);
      const { data: notifExist } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", lead.imobiliaria_id)
        .eq("title", "❄️ Lead esfriando")
        .ilike("description", `%${lead.nome}%`)
        .gte("created_at", ha7dias.toISOString())
        .limit(1);

      if (notifExist && notifExist.length > 0) continue;

      // Create auto follow-up
      await supabase.from("followups").insert({
        lead_id: lead.id,
        imobiliaria_id: lead.imobiliaria_id,
        data_followup: hoje,
        tipo: "whatsapp",
        descricao: `Reengajamento automático - Lead sem contato há ${Math.ceil((now.getTime() - new Date(lead.updated_at).getTime()) / (1000 * 60 * 60 * 24))} dias`,
        status: "pendente",
      });

      await supabase.from("notifications").insert({
        user_id: lead.imobiliaria_id,
        title: "❄️ Lead esfriando",
        description: `"${lead.nome}" está sem contato há mais de 15 dias. Follow-up de reengajamento criado automaticamente.`,
      });

      results.push(`Reengajamento: ${lead.nome}`);
    }

    return new Response(
      JSON.stringify({ success: true, processed: results.length, details: results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
