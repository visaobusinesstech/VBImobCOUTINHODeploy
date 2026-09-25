// Edge function: envia alertas de captação (WhatsApp) para corretor responsável + grupo central.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface WaCfg {
  provider: string | null;
  api_url: string | null;
  api_key: string | null;
  instance_name: string | null;
  token_zapi: string | null;
  instance_id_zapi: string | null;
  ativo: boolean | null;
}

function normPhone(p?: string | null): string | null {
  if (!p) return null;
  const digits = p.replace(/\D/g, "");
  if (!digits) return null;
  return digits.startsWith("55") ? digits : `55${digits}`;
}

async function sendWhatsapp(cfg: WaCfg, to: string, message: string) {
  const target = normPhone(to);
  if (!target) throw new Error("telefone inválido");
  const provider = (cfg.provider || "evolution").toLowerCase();

  if (provider === "zapi" || provider === "z-api") {
    if (!cfg.instance_id_zapi || !cfg.token_zapi) throw new Error("Z-API não configurada");
    const base = cfg.api_url || "https://api.z-api.io";
    const url = `${base}/instances/${cfg.instance_id_zapi}/token/${cfg.token_zapi}/send-text`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: target, message }),
    });
    if (!r.ok) throw new Error(`Z-API ${r.status}: ${await r.text()}`);
    return;
  }

  // default: Evolution API
  if (!cfg.api_url || !cfg.api_key || !cfg.instance_name)
    throw new Error("Evolution não configurada");
  const url = `${cfg.api_url.replace(/\/$/, "")}/message/sendText/${cfg.instance_name}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: cfg.api_key },
    body: JSON.stringify({ number: target, text: message }),
  });
  if (!r.ok) throw new Error(`Evolution ${r.status}: ${await r.text()}`);
}

function buildMessage(alert: any, baseUrl: string): string {
  const d = alert.detalhes ?? {};
  const nivel = (alert.nivel_novo || "").toUpperCase();
  const tipo =
    alert.tipo_evento === "upgrade_nivel"
      ? "🔥 *Alteração de Prioridade*"
      : "🎯 *Score mínimo atingido*";
  const linhas = [
    tipo,
    ``,
    `👤 *${alert.proprietario_nome ?? "Proprietário"}*`,
    alert.imovel_ref ? `🏷️ Ref: ${alert.imovel_ref}` : null,
    d.titulo ? `🏠 ${d.titulo}` : null,
    (d.cidade || d.bairro) ? `📍 ${[d.bairro, d.cidade].filter(Boolean).join(" - ")}` : null,
    d.operacao ? `💼 Operação: ${d.operacao}` : null,
    d.preco ? `💰 R$ ${Number(d.preco).toLocaleString("pt-BR")}` : null,
    ``,
    `📈 Prioridade: *${nivel}*` +
      (alert.nivel_anterior ? ` (antes: ${alert.nivel_anterior})` : ""),
    `⭐ Score: *${alert.score_novo ?? 0}*` +
      (alert.score_anterior != null ? ` (antes: ${alert.score_anterior})` : ""),
    ``,
    `🔗 Abrir no CRM:`,
    `${baseUrl}${alert.link ?? ""}`,
  ].filter(Boolean);
  return linhas.join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { alert_id } = await req.json();
    if (!alert_id) throw new Error("alert_id ausente");

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: alert, error: aerr } = await admin
      .from("alertas_captacao_log")
      .select("*")
      .eq("id", alert_id)
      .maybeSingle();
    if (aerr || !alert) throw new Error("alerta não encontrado");

    const { data: cfg } = await admin
      .from("alertas_captacao_config")
      .select("*")
      .eq("imobiliaria_id", alert.imobiliaria_id)
      .maybeSingle();
    const enabled = cfg?.enabled_whatsapp ?? true;
    if (!enabled) {
      return new Response(JSON.stringify({ skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: waCfg } = await admin
      .from("whatsapp_config")
      .select("provider, api_url, api_key, instance_name, token_zapi, instance_id_zapi, ativo")
      .eq("imobiliaria_id", alert.imobiliaria_id)
      .maybeSingle();
    if (!waCfg || waCfg.ativo === false) {
      await admin
        .from("alertas_captacao_log")
        .update({ whatsapp_error: "whatsapp desativado ou não configurado" })
        .eq("id", alert_id);
      return new Response(JSON.stringify({ skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const baseUrl =
      Deno.env.get("APP_PUBLIC_URL") || "https://www.radarimobtech.shop";
    const message = buildMessage(alert, baseUrl);

    const destinos: { to: string; label: string }[] = [];
    if (alert.corretor_id) {
      const { data: c } = await admin
        .from("corretores")
        .select("telefone,nome")
        .eq("id", alert.corretor_id)
        .maybeSingle();
      if (c?.telefone) destinos.push({ to: c.telefone, label: `corretor:${c.nome ?? ""}` });
    }
    if (cfg?.whatsapp_grupo_numero) {
      destinos.push({ to: cfg.whatsapp_grupo_numero, label: "grupo_central" });
    }

    const results: any[] = [];
    for (const d of destinos) {
      try {
        await sendWhatsapp(waCfg, d.to, message);
        results.push({ ...d, ok: true });
      } catch (e) {
        results.push({ ...d, ok: false, error: String(e) });
      }
    }

    const allOk = results.length > 0 && results.every((r) => r.ok);
    await admin
      .from("alertas_captacao_log")
      .update({
        delivered_whatsapp: allOk,
        whatsapp_error: allOk
          ? null
          : results.filter((r) => !r.ok).map((r) => r.error).join(" | ") || null,
      })
      .eq("id", alert_id);

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
