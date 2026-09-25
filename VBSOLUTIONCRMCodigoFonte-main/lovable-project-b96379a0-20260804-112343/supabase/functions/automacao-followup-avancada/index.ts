import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date();
    const nowIso = now.toISOString();
    const results = { agendamentos_expirados: 0, escalonamentos: 0 };

    // === BLOCO A: Agendamentos expirados sem status de fechamento ===
    const { data: expirados } = await supabase
      .from("compromissos")
      .select("id, imobiliaria_id, titulo, tipo, data_inicio, lead_id, corretor_id, status")
      .lt("data_inicio", nowIso)
      .not("status", "in", '("concluido","reagendado","cancelado","cancelada","realizado")');

    for (const c of expirados ?? []) {
      // dedupe: já processado?
      const { data: existente } = await supabase
        .from("automacao_followup_execucoes")
        .select("id")
        .eq("compromisso_id", c.id)
        .eq("tipo", "agendamento_expirado")
        .limit(1);
      if (existente && existente.length > 0) continue;

      // busca regra
      const { data: regras } = await supabase
        .from("automacao_followup_regras")
        .select("*")
        .eq("imobiliaria_id", c.imobiliaria_id)
        .eq("tipo", "agendamento_expirado")
        .eq("ativo", true)
        .limit(1);
      const regra = regras?.[0];
      if (!regra) continue;

      const nomeLead = c.titulo || "cliente";
      const desc = String(regra.acao_descricao)
        .replaceAll("{lead}", nomeLead)
        .replaceAll("{prazo}", `${regra.prazo_tarefa_horas}h`);
      const dataFu = new Date(now.getTime() + regra.prazo_tarefa_horas * 3600 * 1000)
        .toISOString().split("T")[0];

      const { data: fu } = await supabase.from("followups").insert({
        lead_id: c.lead_id,
        imobiliaria_id: c.imobiliaria_id,
        data_followup: dataFu,
        tipo: regra.tipo_followup || "ligacao",
        descricao: `[ALTA][AUTO] ${regra.acao_titulo} — ${desc}`,
        status: "pendente",
      }).select("id").single();

      // Notifica vendedor + gerente
      if (c.corretor_id) {
        const { data: corr } = await supabase.from("corretores")
          .select("imobiliaria_id").eq("id", c.corretor_id).maybeSingle();
        if (corr?.imobiliaria_id) {
          await supabase.from("notifications").insert({
            user_id: corr.imobiliaria_id,
            title: "⚠️ Agendamento expirado",
            description: `Agendamento "${c.titulo}" expirou sem conclusão. Tarefa de recuperação criada.`,
          });
        }
      }
      if (regra.notificar_gerente) {
        await supabase.from("notifications").insert({
          user_id: c.imobiliaria_id,
          title: "⚠️ Agendamento expirado",
          description: `"${c.titulo}" (${c.tipo || "compromisso"}) expirou. Recuperação criada com prazo em ${regra.prazo_tarefa_horas}h.`,
        });
      }

      await supabase.from("automacao_followup_execucoes").insert({
        imobiliaria_id: c.imobiliaria_id,
        regra_id: regra.id,
        tipo: "agendamento_expirado",
        compromisso_id: c.id,
        lead_id: c.lead_id,
        followup_id: fu?.id,
      });
      results.agendamentos_expirados++;
    }

    // === BLOCO B: Escalonamento ===
    const { data: pendentes } = await supabase
      .from("automacao_followup_execucoes")
      .select("id, imobiliaria_id, regra_id, followup_id, tipo, lead_id, compromisso_id, created_at, escalado, automacao_followup_regras(escalonamento_horas, acao_titulo)")
      .eq("escalado", false)
      .not("followup_id", "is", null);

    for (const e of pendentes ?? []) {
      const regra: any = (e as any).automacao_followup_regras;
      const horas = regra?.escalonamento_horas ?? 4;
      const criado = new Date(e.created_at).getTime();
      if (now.getTime() - criado < horas * 3600 * 1000) continue;

      const { data: fu } = await supabase.from("followups")
        .select("status, descricao").eq("id", e.followup_id).maybeSingle();
      if (!fu || fu.status !== "pendente") {
        await supabase.from("automacao_followup_execucoes")
          .update({ escalado: true, escalado_em: nowIso }).eq("id", e.id);
        continue;
      }

      await supabase.from("notifications").insert({
        user_id: e.imobiliaria_id,
        title: "🚨 Escalonamento — tarefa sem ação",
        description: `Tarefa "${regra?.acao_titulo || "automação"}" está pendente há mais de ${horas}h. Intervenção do gerente necessária.`,
      });
      await supabase.from("automacao_followup_execucoes")
        .update({ escalado: true, escalado_em: nowIso }).eq("id", e.id);
      results.escalonamentos++;
    }

    return new Response(JSON.stringify({ success: true, ...results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
