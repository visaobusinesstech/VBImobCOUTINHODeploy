// Cron-invoked: sends payment reminders for pending transacoes
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const PUBLIC_BASE = Deno.env.get("PUBLIC_APP_URL") || "https://radarimobtech.shop";

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + "T00:00:00");
  return Math.floor((d.getTime() - today.getTime()) / 86400000);
}

function formatBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function formatDate(d: string) {
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("pt-BR");
}

function renderTemplate(tpl: string, vars: Record<string, string>) {
  return Object.entries(vars).reduce((acc, [k, v]) => acc.replaceAll(`{{${k}}}`, v), tpl);
}

async function sendWhatsApp(supabase: any, imobiliariaId: string, telefone: string, mensagem: string) {
  const { data: config } = await supabase
    .from("whatsapp_config")
    .select("*")
    .eq("imobiliaria_id", imobiliariaId)
    .maybeSingle();
  if (!config?.ativo) return { skipped: "whatsapp_not_active" };

  const numero = telefone.replace(/\D/g, "");
  const formatted = numero.startsWith("55") ? numero : `55${numero}`;

  if (config.provider === "evolution" && config.api_url && config.api_key && config.instance_name) {
    const baseUrl = config.api_url.replace(/\/$/, "");
    const res = await fetch(`${baseUrl}/message/sendText/${config.instance_name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: config.api_key },
      body: JSON.stringify({ number: formatted, text: mensagem }),
    });
    return { provider: "evolution", ok: res.ok, status: res.status };
  }
  if (config.provider === "zapi" && config.instance_id_zapi && config.token_zapi) {
    const res = await fetch(
      `https://api.z-api.io/instances/${config.instance_id_zapi}/token/${config.token_zapi}/send-text`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: formatted, message: mensagem }) },
    );
    return { provider: "zapi", ok: res.ok, status: res.status };
  }
  return { skipped: "provider_not_configured" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  try {
    const { data: configs } = await supabase
      .from("cobrancas_lembretes_config")
      .select("*")
      .eq("ativo", true);

    if (!configs?.length) return json({ ok: true, processed: 0, note: "no active configs" });

    let sent = 0;
    let skipped = 0;
    const details: any[] = [];

    for (const cfg of configs) {
      const { data: txs } = await supabase
        .from("transacoes")
        .select("id, descricao, valor, data, categoria, proprietario_nome, proprietario_telefone, link_pagamento, token_pagamento, lembrete_ultimo_envio")
        .eq("imobiliaria_id", cfg.imobiliaria_id)
        .eq("status", "pendente")
        .in("categoria", cfg.categorias ?? ["aluguel", "comissao", "despesa"])
        .is("pago_confirmado_em", null);

      for (const tx of txs ?? []) {
        const dias = daysUntil(tx.data);
        // dias > 0 => antes do venc; dias < 0 => atraso
        const matchAntes = dias >= 0 && (cfg.dias_antes ?? []).includes(dias);
        const matchApos = dias < 0 && (cfg.dias_apos ?? []).includes(Math.abs(dias));
        if (!matchAntes && !matchApos) continue;

        // dedupe: só envia se último lembrete > 20h
        if (tx.lembrete_ultimo_envio) {
          const diff = Date.now() - new Date(tx.lembrete_ultimo_envio).getTime();
          if (diff < 20 * 3600 * 1000) { skipped++; continue; }
        }

        const publicLink = `${PUBLIC_BASE}/pagamento/${tx.token_pagamento}`;
        const mensagem = renderTemplate(cfg.mensagem_template, {
          nome: tx.proprietario_nome ?? "cliente",
          descricao: tx.descricao,
          valor: formatBRL(Number(tx.valor)),
          data: formatDate(tx.data),
          link: tx.link_pagamento ? `${tx.link_pagamento}\n${publicLink}` : publicLink,
          dias: String(Math.abs(dias)),
          status: dias < 0 ? "atrasada" : "a vencer",
        });

        const results: any = { tx_id: tx.id, categoria: tx.categoria, dias };

        if (cfg.canal_notificacao) {
          await supabase.from("notifications").insert({
            user_id: cfg.imobiliaria_id,
            titulo: dias < 0 ? "Cobrança em atraso" : "Lembrete de cobrança",
            mensagem: `${tx.descricao} — ${formatBRL(Number(tx.valor))} — vence ${formatDate(tx.data)}`,
            tipo: dias < 0 ? "alerta" : "info",
          });
          results.notificacao = true;
        }

        if (cfg.canal_whatsapp && tx.proprietario_telefone) {
          results.whatsapp = await sendWhatsApp(supabase, cfg.imobiliaria_id, tx.proprietario_telefone, mensagem);
        }

        await supabase.from("transacoes").update({
          lembrete_ultimo_envio: new Date().toISOString(),
          lembrete_enviado_count: (tx as any).lembrete_enviado_count ? (tx as any).lembrete_enviado_count + 1 : 1,
        }).eq("id", tx.id);

        sent++;
        details.push(results);
      }
    }

    return json({ ok: true, sent, skipped, details });
  } catch (err) {
    console.error("enviar-lembretes-cobranca error", err);
    return json({ error: (err as Error).message }, 500);
  }
});
