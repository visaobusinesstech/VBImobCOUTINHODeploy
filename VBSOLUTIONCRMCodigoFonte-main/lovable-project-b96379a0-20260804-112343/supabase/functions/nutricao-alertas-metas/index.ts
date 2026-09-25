import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Config {
  imobiliaria_id: string;
  fluxo_id: string | null;
  ativo: boolean;
  janela_dias: number;
  min_envios: number;
  meta_abertura: number;
  meta_resposta: number;
  meta_agendamento: number;
  meta_fechamento: number;
  alertar_zero_agendamento: boolean;
  alertar_zero_resposta: boolean;
  frequencia_horas: number;
  notificar_app: boolean;
}

const DEFAULT_CONFIG: Omit<Config, "imobiliaria_id" | "fluxo_id"> = {
  ativo: true,
  janela_dias: 14,
  min_envios: 10,
  meta_abertura: 25,
  meta_resposta: 10,
  meta_agendamento: 5,
  meta_fechamento: 1,
  alertar_zero_agendamento: true,
  alertar_zero_resposta: true,
  frequencia_horas: 24,
  notificar_app: true,
};

const pct = (p: number, t: number) => (t > 0 ? (p / t) * 100 : 0);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let apenasImobiliaria: string | null = null;
    try {
      const body = await req.json();
      if (typeof body?.imobiliaria_id === "string") apenasImobiliaria = body.imobiliaria_id;
    } catch (_) {
      // sem body
    }

    let fluxosQuery = supabase
      .from("nutricao_fluxos")
      .select("id, nome, imobiliaria_id, ativo")
      .eq("ativo", true);
    if (apenasImobiliaria) fluxosQuery = fluxosQuery.eq("imobiliaria_id", apenasImobiliaria);
    const { data: fluxos, error: fluxosErr } = await fluxosQuery;
    if (fluxosErr) throw fluxosErr;
    if (!fluxos?.length) {
      return new Response(JSON.stringify({ alertas: 0, message: "Nenhum fluxo ativo" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const imobIds = [...new Set(fluxos.map((f) => f.imobiliaria_id))];
    const { data: configs } = await supabase
      .from("nutricao_metas_config")
      .select("*")
      .in("imobiliaria_id", imobIds);

    const configFor = (imobId: string, fluxoId: string): Config => {
      const lista = (configs ?? []) as Config[];
      const especifica = lista.find((c) => c.imobiliaria_id === imobId && c.fluxo_id === fluxoId);
      const global = lista.find((c) => c.imobiliaria_id === imobId && !c.fluxo_id);
      return { ...DEFAULT_CONFIG, ...(global ?? {}), ...(especifica ?? {}), imobiliaria_id: imobId, fluxo_id: fluxoId };
    };

    let criados = 0;

    for (const fluxo of fluxos) {
      const cfg = configFor(fluxo.imobiliaria_id, fluxo.id);
      if (!cfg.ativo) continue;

      const desde = new Date(Date.now() - cfg.janela_dias * 86400000).toISOString();

      const { data: inscricoes } = await supabase
        .from("nutricao_inscricoes")
        .select("id")
        .eq("fluxo_id", fluxo.id);
      const inscricaoIds = (inscricoes ?? []).map((i) => i.id);
      if (!inscricaoIds.length) continue;

      const { data: envios } = await supabase
        .from("nutricao_envios")
        .select("id, status, created_at")
        .in("inscricao_id", inscricaoIds)
        .gte("created_at", desde);

      const enviados = (envios ?? []).filter((e) => e.status === "enviado").length;
      if (enviados < cfg.min_envios) continue;

      const { data: eventos } = await supabase
        .from("nutricao_eventos")
        .select("tipo")
        .eq("fluxo_id", fluxo.id)
        .gte("ocorrido_em", desde);

      const conta = (tipo: string) => (eventos ?? []).filter((e) => e.tipo === tipo).length;
      const aberturas = conta("abertura");
      const respostas = conta("resposta");
      const agendamentos = conta("agendamento");
      const fechamentos = conta("fechamento");

      const candidatos: {
        tipo: string;
        metrica: string;
        valor: number;
        meta: number;
        severidade: string;
        mensagem: string;
      }[] = [];

      const add = (
        tipo: string,
        metrica: string,
        valor: number,
        meta: number,
        severidade: string,
        mensagem: string,
      ) => candidatos.push({ tipo, metrica, valor, meta, severidade, mensagem });

      const taxaAbertura = pct(aberturas, enviados);
      const taxaResposta = pct(respostas, enviados);
      const taxaAgendamento = pct(agendamentos, enviados);
      const taxaFechamento = pct(fechamentos, enviados);

      if (cfg.alertar_zero_agendamento && agendamentos === 0) {
        add(
          "zero_agendamento",
          "agendamento",
          0,
          cfg.meta_agendamento,
          "critico",
          `O fluxo "${fluxo.nome}" não gerou nenhum agendamento nos últimos ${cfg.janela_dias} dias (${enviados} mensagens enviadas).`,
        );
      } else if (taxaAgendamento < cfg.meta_agendamento) {
        add(
          "abaixo_meta",
          "agendamento",
          taxaAgendamento,
          cfg.meta_agendamento,
          "alerta",
          `Taxa de agendamento do fluxo "${fluxo.nome}" está em ${taxaAgendamento.toFixed(1)}% (meta ${cfg.meta_agendamento}%).`,
        );
      }

      if (cfg.alertar_zero_resposta && respostas === 0) {
        add(
          "zero_resposta",
          "resposta",
          0,
          cfg.meta_resposta,
          "critico",
          `O fluxo "${fluxo.nome}" não recebeu nenhuma resposta nos últimos ${cfg.janela_dias} dias.`,
        );
      } else if (taxaResposta < cfg.meta_resposta) {
        add(
          "abaixo_meta",
          "resposta",
          taxaResposta,
          cfg.meta_resposta,
          "alerta",
          `Taxa de resposta do fluxo "${fluxo.nome}" está em ${taxaResposta.toFixed(1)}% (meta ${cfg.meta_resposta}%).`,
        );
      }

      if (taxaAbertura < cfg.meta_abertura) {
        add(
          "abaixo_meta",
          "abertura",
          taxaAbertura,
          cfg.meta_abertura,
          "alerta",
          `Taxa de abertura do fluxo "${fluxo.nome}" está em ${taxaAbertura.toFixed(1)}% (meta ${cfg.meta_abertura}%).`,
        );
      }

      if (taxaFechamento < cfg.meta_fechamento) {
        add(
          "abaixo_meta",
          "fechamento",
          taxaFechamento,
          cfg.meta_fechamento,
          "alerta",
          `Taxa de fechamento do fluxo "${fluxo.nome}" está em ${taxaFechamento.toFixed(1)}% (meta ${cfg.meta_fechamento}%).`,
        );
      }

      if (!candidatos.length) continue;

      const desdeDedup = new Date(Date.now() - cfg.frequencia_horas * 3600000).toISOString();
      const { data: recentes } = await supabase
        .from("nutricao_metas_alertas")
        .select("tipo, metrica")
        .eq("fluxo_id", fluxo.id)
        .gte("created_at", desdeDedup);

      const jaExiste = (tipo: string, metrica: string) =>
        (recentes ?? []).some((r) => r.tipo === tipo && r.metrica === metrica);

      const novos = candidatos.filter((c) => !jaExiste(c.tipo, c.metrica));
      if (!novos.length) continue;

      const { error: insErr } = await supabase.from("nutricao_metas_alertas").insert(
        novos.map((c) => ({
          imobiliaria_id: fluxo.imobiliaria_id,
          fluxo_id: fluxo.id,
          fluxo_nome: fluxo.nome,
          tipo: c.tipo,
          severidade: c.severidade,
          mensagem: c.mensagem,
          metrica: c.metrica,
          valor: Number(c.valor.toFixed(2)),
          meta: c.meta,
          envios: enviados,
          janela_dias: cfg.janela_dias,
        })),
      );
      if (insErr) {
        console.error("Erro ao inserir alertas:", insErr.message);
        continue;
      }
      criados += novos.length;

      if (cfg.notificar_app) {
        await supabase.from("notifications").insert({
          user_id: fluxo.imobiliaria_id,
          title: `Nutrição abaixo da meta: ${fluxo.nome}`,
          description: novos.map((n) => n.mensagem).join(" "),
        });
      }
    }

    return new Response(JSON.stringify({ alertas: criados }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("nutricao-alertas-metas erro:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
