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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get all active rental contracts
    const { data: contratos, error: errContratos } = await supabase
      .from("contratos")
      .select("*")
      .eq("tipo", "Locação")
      .eq("status", "ativo");

    if (errContratos) throw errContratos;
    if (!contratos || contratos.length === 0) {
      return new Response(
        JSON.stringify({ alertas_gerados: 0, message: "Nenhum contrato de locação ativo" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const hoje = new Date();
    const mesAtual = hoje.getMonth();
    const anoAtual = hoje.getFullYear();
    let alertasGerados = 0;

    // Get master user for notifications
    const { data: masterProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("is_master", true)
      .limit(1)
      .single();

    if (!masterProfile) {
      throw new Error("Usuário master não encontrado");
    }

    for (const contrato of contratos) {
      const diaVenc = contrato.dia_vencimento_aluguel || 10;
      const dataVencimento = new Date(anoAtual, mesAtual, diaVenc);

      // Only check if due date has passed
      if (hoje <= dataVencimento) continue;

      const diasAtraso = Math.floor(
        (hoje.getTime() - dataVencimento.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Check if there's a paid transaction for this month
      const inicioMes = `${anoAtual}-${String(mesAtual + 1).padStart(2, "0")}-01`;
      const fimMes = new Date(anoAtual, mesAtual + 1, 0);
      const fimMesStr = `${anoAtual}-${String(mesAtual + 1).padStart(2, "0")}-${String(fimMes.getDate()).padStart(2, "0")}`;

      const { data: pagamentos } = await supabase
        .from("transacoes")
        .select("id")
        .eq("imobiliaria_id", contrato.imobiliaria_id)
        .eq("tipo", "entrada")
        .eq("categoria", "aluguel")
        .eq("status", "pago")
        .ilike("descricao", `%${contrato.titulo}%`)
        .gte("data", inicioMes)
        .lte("data", fimMesStr)
        .limit(1);

      if (pagamentos && pagamentos.length > 0) continue;

      // Determine severity
      let gravidade = "🟡 Leve";
      if (diasAtraso > 60) gravidade = "⚫ Crítico";
      else if (diasAtraso > 30) gravidade = "🔴 Grave";
      else if (diasAtraso > 15) gravidade = "🟠 Moderado";

      // Check for existing notification today to avoid duplicates
      const hojeStr = hoje.toISOString().split("T")[0];
      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", masterProfile.id)
        .ilike("title", "%Inadimplência%")
        .ilike("description", `%${contrato.titulo}%`)
        .gte("created_at", `${hojeStr}T00:00:00`)
        .limit(1);

      if (existing && existing.length > 0) continue;

      // Create notification
      const inquilino = contrato.inquilino || contrato.cliente;
      const valor = Number(contrato.valor || 0).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });

      await supabase.from("notifications").insert({
        user_id: masterProfile.id,
        title: `${gravidade} Inadimplência - ${diasAtraso} dias`,
        description: `Contrato "${contrato.titulo}" - Inquilino: ${inquilino} - Aluguel ${valor} vencido em ${String(diaVenc).padStart(2, "0")}/${String(mesAtual + 1).padStart(2, "0")}/${anoAtual}`,
      });

      alertasGerados++;
    }

    return new Response(
      JSON.stringify({ alertas_gerados: alertasGerados }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("alertas-inadimplencia error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
