import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const results: string[] = [];

    // Helper: check if alert already sent today
    async function alreadySentToday(userId: string, titlePattern: string) {
      const { data } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", userId)
        .like("title", titlePattern)
        .gte("created_at", todayStr)
        .limit(1);
      return data && data.length > 0;
    }

    // Helper: format BRL
    function brl(v: number) {
      return `R$${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
    }

    // Helper: format date
    function fmtDate(d: string) {
      return new Date(d + "T00:00:00").toLocaleDateString("pt-BR");
    }

    // Helper: urgency icon
    function urgencia(dias: number) {
      if (dias <= 0) return { icon: "🔴", label: "VENCIDO" };
      if (dias <= 5) return { icon: "🔴", label: "CRÍTICO" };
      if (dias <= 10) return { icon: "🚨", label: "URGENTE" };
      if (dias <= 20) return { icon: "⚠️", label: "Importante" };
      if (dias <= 30) return { icon: "📅", label: "Atenção" };
      return { icon: "📋", label: "Info" };
    }

    // Helper: should alert at threshold
    function shouldAlert(dias: number, thresholds: number[]) {
      if (dias <= 0) return true;
      for (const t of thresholds) {
        if (dias <= t) return true;
        break; // only check smallest threshold above dias
      }
      // Alert at specific thresholds
      return thresholds.includes(dias) || dias <= thresholds[thresholds.length - 1];
    }

    // ========================================================
    // BUSCAR TODOS OS CONTRATOS DE LOCAÇÃO ATIVOS
    // ========================================================
    const { data: contratosLocacao, error: errLocacao } = await supabase
      .from("contratos")
      .select("id, titulo, cliente, inquilino, tipo, valor, indice_correcao, percentual_correcao, data_proxima_correcao, data_fim, data_inicio, imobiliaria_id, status, dia_vencimento_aluguel, data_vencimento_apolice, valor_iptu, iptu_parcelado, proprietario")
      .in("status", ["ativo", "rascunho", "assinado"])
      .ilike("tipo", "%Loca%");

    if (errLocacao) throw errLocacao;

    for (const c of contratosLocacao || []) {
      const pessoa = c.inquilino || c.cliente;

      // -------------------------------------------------------
      // 1. ALERTA DE VENCIMENTO ALUGUEL MENSAL
      // -------------------------------------------------------
      if (c.dia_vencimento_aluguel) {
        const diaVenc = c.dia_vencimento_aluguel;
        const mesAtual = now.getMonth();
        const anoAtual = now.getFullYear();

        // Calcular próxima data de vencimento do aluguel
        let proxVenc = new Date(anoAtual, mesAtual, diaVenc);
        if (proxVenc.getTime() < now.getTime() - 86400000) {
          // já passou este mês, pegar próximo mês
          proxVenc = new Date(anoAtual, mesAtual + 1, diaVenc);
        }

        const diffDias = Math.ceil((proxVenc.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        // Alertar 5, 3, 1 dia antes e no dia do vencimento
        if (diffDias >= -5 && diffDias <= 5) {
          const titlePattern = `%Aluguel Mensal%${c.titulo}%`;
          if (!(await alreadySentToday(c.imobiliaria_id, titlePattern))) {
            const u = urgencia(diffDias);
            const statusText = diffDias <= 0
              ? `Aluguel VENCIDO há ${Math.abs(diffDias)} dia(s)!`
              : `Aluguel vence em ${diffDias} dia(s) (dia ${diaVenc}).`;

            await supabase.from("notifications").insert({
              user_id: c.imobiliaria_id,
              title: `${u.icon} ${u.label} — Aluguel Mensal "${c.titulo}"`,
              description: `${statusText} Inquilino: ${pessoa}. Valor: ${brl(c.valor)}.`,
            });
            results.push(`aluguel_mensal:${c.id}:${diffDias}d`);
          }
        }
      }

      // -------------------------------------------------------
      // 2. ALERTA DE VENCIMENTO DO CONTRATO DE ALUGUEL
      // -------------------------------------------------------
      if (c.data_fim) {
        const fimDate = new Date(c.data_fim + "T00:00:00");
        const diffDias = Math.ceil((fimDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDias <= 60 && diffDias >= -30) {
          // Alertar em 60, 30, 20, 10, 5 dias e quando vencido
          const thresholds = [60, 30, 20, 10, 5];
          const inThreshold = diffDias <= 0 || thresholds.some(t => diffDias === t) || diffDias <= 5;

          if (inThreshold) {
            const titlePattern = `%Vencimento Contrato%${c.titulo}%`;
            if (!(await alreadySentToday(c.imobiliaria_id, titlePattern))) {
              const u = urgencia(diffDias);
              const statusText = diffDias <= 0
                ? `Contrato de locação VENCIDO há ${Math.abs(diffDias)} dia(s)!`
                : `Contrato de locação vence em ${diffDias} dia(s) (${fmtDate(c.data_fim)}).`;

              await supabase.from("notifications").insert({
                user_id: c.imobiliaria_id,
                title: `${u.icon} ${u.label} — Vencimento Contrato "${c.titulo}"`,
                description: `${statusText} Inquilino: ${pessoa}. Valor: ${brl(c.valor)}.`,
              });
              results.push(`vencimento_contrato:${c.id}:${diffDias}d`);
            }
          }
        }
      }

      // -------------------------------------------------------
      // 3. ALERTA DE REAJUSTE DE ALUGUEL
      // -------------------------------------------------------
      if (c.data_proxima_correcao) {
        const correcaoDate = new Date(c.data_proxima_correcao + "T00:00:00");
        const diffDias = Math.ceil((correcaoDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDias <= 30 && diffDias >= -5) {
          const thresholds = [30, 20, 10, 5];
          const inThreshold = diffDias <= 0 || thresholds.some(t => diffDias === t) || diffDias <= 5;

          if (inThreshold) {
            const titlePattern = `%Reajuste Aluguel%${c.titulo}%`;
            if (!(await alreadySentToday(c.imobiliaria_id, titlePattern))) {
              const u = urgencia(diffDias);
              const indice = c.indice_correcao || "IGPM";
              const pct = c.percentual_correcao || 0;
              const statusText = diffDias <= 0
                ? `Reajuste ATRASADO há ${Math.abs(diffDias)} dia(s)!`
                : `Reajuste em ${diffDias} dia(s) (${fmtDate(c.data_proxima_correcao)}).`;

              await supabase.from("notifications").insert({
                user_id: c.imobiliaria_id,
                title: `${u.icon} ${u.label} — Reajuste Aluguel "${c.titulo}"`,
                description: `${statusText} Índice: ${indice} (${pct}%). Inquilino: ${pessoa}. Valor atual: ${brl(c.valor)}.`,
              });
              results.push(`reajuste:${c.id}:${diffDias}d`);
            }
          }
        }
      }

      // -------------------------------------------------------
      // 4. ALERTA DE VENCIMENTO APÓLICE SEGURO DE INCÊNDIO ANUAL
      // -------------------------------------------------------
      if (c.data_vencimento_apolice) {
        const apoliceDate = new Date(c.data_vencimento_apolice + "T00:00:00");
        const diffDias = Math.ceil((apoliceDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDias <= 30 && diffDias >= -15) {
          const thresholds = [30, 15, 10, 5];
          const inThreshold = diffDias <= 0 || thresholds.some(t => diffDias === t) || diffDias <= 5;

          if (inThreshold) {
            const titlePattern = `%Seguro Incêndio%${c.titulo}%`;
            if (!(await alreadySentToday(c.imobiliaria_id, titlePattern))) {
              const u = urgencia(diffDias);
              const statusText = diffDias <= 0
                ? `Apólice de seguro incêndio VENCIDA há ${Math.abs(diffDias)} dia(s)!`
                : `Apólice de seguro incêndio vence em ${diffDias} dia(s) (${fmtDate(c.data_vencimento_apolice)}).`;

              await supabase.from("notifications").insert({
                user_id: c.imobiliaria_id,
                title: `${u.icon} ${u.label} — Seguro Incêndio "${c.titulo}"`,
                description: `${statusText} Inquilino: ${pessoa}. Contrato: ${c.titulo}.`,
              });
              results.push(`seguro_incendio:${c.id}:${diffDias}d`);
            }
          }
        }
      }

      // -------------------------------------------------------
      // 5. ALERTA DE VENCIMENTO IPTU
      // -------------------------------------------------------
      // IPTU vence anualmente em janeiro. Se parcelado, alertar mensalmente.
      if (c.valor_iptu && Number(c.valor_iptu) > 0) {
        // IPTU geralmente vence em janeiro para cota única ou mensalmente se parcelado
        const anoAtual = now.getFullYear();

        if (c.iptu_parcelado) {
          // IPTU parcelado: alertar todo mês, dia 10 (padrão de prefeituras)
          const diaVencIPTU = 10;
          const mesAtual = now.getMonth();
          let proxVencIPTU = new Date(anoAtual, mesAtual, diaVencIPTU);
          if (proxVencIPTU.getTime() < now.getTime() - 86400000) {
            proxVencIPTU = new Date(anoAtual, mesAtual + 1, diaVencIPTU);
          }
          const diffDias = Math.ceil((proxVencIPTU.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

          if (diffDias >= -5 && diffDias <= 5) {
            const titlePattern = `%IPTU Parcela%${c.titulo}%`;
            if (!(await alreadySentToday(c.imobiliaria_id, titlePattern))) {
              const u = urgencia(diffDias);
              const statusText = diffDias <= 0
                ? `Parcela IPTU VENCIDA há ${Math.abs(diffDias)} dia(s)!`
                : `Parcela IPTU vence em ${diffDias} dia(s).`;

              await supabase.from("notifications").insert({
                user_id: c.imobiliaria_id,
                title: `${u.icon} ${u.label} — IPTU Parcela "${c.titulo}"`,
                description: `${statusText} Valor IPTU total: ${brl(c.valor_iptu)}. Imóvel: ${c.titulo}. Inquilino: ${pessoa}.`,
              });
              results.push(`iptu_parcela:${c.id}:${diffDias}d`);
            }
          }
        } else {
          // IPTU cota única: alertar em janeiro (vencimento geralmente fev/mar)
          // Alertar em 30, 15, 10, 5 dias antes de fevereiro
          const vencIPTU = new Date(anoAtual, 1, 10); // 10 de fevereiro
          if (vencIPTU.getTime() < now.getTime() - 30 * 86400000) {
            // Se já passou muito, pular
          } else {
            const diffDias = Math.ceil((vencIPTU.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDias <= 30 && diffDias >= -10) {
              const titlePattern = `%IPTU Anual%${c.titulo}%`;
              if (!(await alreadySentToday(c.imobiliaria_id, titlePattern))) {
                const u = urgencia(diffDias);
                const statusText = diffDias <= 0
                  ? `IPTU cota única VENCIDO há ${Math.abs(diffDias)} dia(s)!`
                  : `IPTU cota única vence em ${diffDias} dia(s).`;

                await supabase.from("notifications").insert({
                  user_id: c.imobiliaria_id,
                  title: `${u.icon} ${u.label} — IPTU Anual "${c.titulo}"`,
                  description: `${statusText} Valor: ${brl(c.valor_iptu)}. Imóvel: ${c.titulo}. Inquilino: ${pessoa}.`,
                });
                results.push(`iptu_anual:${c.id}:${diffDias}d`);
              }
            }
          }
        }
      }
    }

    // ========================================================
    // INADIMPLÊNCIA — transações com status "atrasado" (mantido)
    // ========================================================
    const { data: atrasadas, error: errAtrasadas } = await supabase
      .from("transacoes")
      .select("id, descricao, valor, data, categoria, imobiliaria_id, corretor_nome")
      .eq("status", "atrasado")
      .eq("tipo", "entrada");

    if (errAtrasadas) throw errAtrasadas;

    for (const t of atrasadas || []) {
      const dataVenc = new Date(t.data + "T00:00:00");
      const diasAtraso = Math.floor((now.getTime() - dataVenc.getTime()) / (1000 * 60 * 60 * 24));
      if (diasAtraso < 1) continue;

      const titlePattern = `%Inadimplência%${t.descricao.substring(0, 30)}%`;
      if (await alreadySentToday(t.imobiliaria_id, titlePattern)) continue;

      const u = urgencia(-diasAtraso);
      await supabase.from("notifications").insert({
        user_id: t.imobiliaria_id,
        title: `${u.icon} ${u.label} — Inadimplência "${t.descricao.substring(0, 40)}"`,
        description: `Pagamento de ${brl(t.valor)} (${t.categoria}) atrasado há ${diasAtraso} dias. Vencimento: ${dataVenc.toLocaleDateString("pt-BR")}.`,
      });
      results.push(`inadimplencia:${t.id}:${diasAtraso}d`);
    }

    return new Response(
      JSON.stringify({ success: true, alerts: results.length, details: results, timestamp: now.toISOString() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[alertas-contratos] Erro:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
