import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await anonClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is approved
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: profile } = await supabase
      .from("profiles")
      .select("approved")
      .eq("id", caller.id)
      .single();

    if (!profile?.approved) {
      return new Response(JSON.stringify({ error: "Acesso negado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    const mesAtual = now.getMonth();
    const anoAtual = now.getFullYear();
    const primeiroDiaMes = `${anoAtual}-${String(mesAtual + 1).padStart(2, "0")}-01`;

    const { data: recorrentes, error: fetchError } = await supabase
      .from("transacoes")
      .select("*")
      .not("recorrencia", "is", null)
      .neq("recorrencia", "nenhuma")
      .neq("status", "cancelado");

    if (fetchError) throw fetchError;

    if (!recorrentes || recorrentes.length === 0) {
      return new Response(
        JSON.stringify({ message: "Nenhuma transação recorrente encontrada", created: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let created = 0;
    const errors: string[] = [];

    for (const tx of recorrentes) {
      const txDate = new Date(tx.data);
      const txMes = txDate.getMonth();
      const txAno = txDate.getFullYear();

      if (txMes === mesAtual && txAno === anoAtual) continue;

      const monthsDiff = (anoAtual - txAno) * 12 + (mesAtual - txMes);
      if (monthsDiff <= 0) continue;

      let shouldGenerate = false;
      switch (tx.recorrencia) {
        case "mensal":
          shouldGenerate = true;
          break;
        case "trimestral":
          shouldGenerate = monthsDiff % 3 === 0;
          break;
        case "semestral":
          shouldGenerate = monthsDiff % 6 === 0;
          break;
        case "anual":
          shouldGenerate = monthsDiff % 12 === 0;
          break;
      }

      if (!shouldGenerate) continue;

      const { data: existing } = await supabase
        .from("transacoes")
        .select("id")
        .eq("imobiliaria_id", tx.imobiliaria_id)
        .eq("descricao", tx.descricao)
        .eq("categoria", tx.categoria)
        .eq("tipo", tx.tipo)
        .eq("recorrencia", tx.recorrencia)
        .gte("data", primeiroDiaMes)
        .lt(
          "data",
          `${anoAtual}-${String(mesAtual + 2 > 12 ? 1 : mesAtual + 2).padStart(2, "0")}-01`
        )
        .limit(1);

      if (existing && existing.length > 0) continue;

      const dia = Math.min(txDate.getDate(), new Date(anoAtual, mesAtual + 1, 0).getDate());
      const novaData = `${anoAtual}-${String(mesAtual + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;

      const { error: insertError } = await supabase.from("transacoes").insert({
        imobiliaria_id: tx.imobiliaria_id,
        descricao: tx.descricao,
        tipo: tx.tipo,
        categoria: tx.categoria,
        valor: tx.valor,
        data: novaData,
        status: "pendente",
        imovel_id: tx.imovel_id,
        corretor_id: tx.corretor_id,
        observacoes: tx.observacoes,
        canal_origem: tx.canal_origem,
        recorrencia: tx.recorrencia,
      });

      if (insertError) {
        errors.push(`Erro tx ${tx.id}: ${insertError.message}`);
      } else {
        created++;
      }
    }

    return new Response(
      JSON.stringify({ message: `${created} transações recorrentes geradas`, created, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[gerar-transacoes-recorrentes] Error:", err.message);
    return new Response(
      JSON.stringify({ error: "Erro ao gerar transações recorrentes" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
