// Processa a fila de notificações de prospecção de condomínios.
// Envia WhatsApp (via edge whatsapp-send) e e-mail (via Resend, se configurado).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const TIPO_LABEL: Record<string, string> = {
  etapa_avancada: "✅ Etapa avançada",
  resposta_recebida: "💬 Resposta recebida",
  sem_contato_max: "⚠️ Sem contato — limite atingido",
};

function buildMessage(ev: any): { subject: string; text: string; html: string } {
  const cond = ev.condominio_nome || "Condomínio";
  const p = ev.payload || {};
  const header = TIPO_LABEL[ev.tipo] || ev.tipo;
  let body = "";
  if (ev.tipo === "etapa_avancada") {
    body = `Nova etapa concluída: *${p.etapa ?? "-"}*\nProgresso: ${p.progresso ?? 0}%\nStatus: ${p.status ?? "-"}`;
  } else if (ev.tipo === "resposta_recebida") {
    body = `Etapa: *${p.etapa ?? "-"}* (tentativa ${p.tentativa ?? "-"})\n${p.observacao ? `Obs.: ${p.observacao}` : ""}`;
  } else {
    body = `Etapa: *${p.etapa ?? "-"}*\nTentativas: ${p.tentativas}/${p.max_tentativas}\nPausado até: ${p.pausado_ate ? new Date(p.pausado_ate).toLocaleDateString("pt-BR") : "-"}`;
  }
  const text = `${header}\n\n🏢 ${cond}\n${body}\n\n— radarimobtech`;
  const subject = `[${header}] ${cond}`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:520px"><h2 style="margin:0 0 8px">${header}</h2><p style="margin:0 0 4px"><strong>🏢 ${cond}</strong></p><pre style="white-space:pre-wrap;font-family:inherit;color:#333">${body}</pre><hr/><small>radarimobtech</small></div>`;
  return { subject, text, html };
}

async function sendWhatsappTo(sb: any, imobiliariaId: string, telefone: string, mensagem: string) {
  const { data, error } = await sb.functions.invoke("whatsapp-send", {
    body: { telefone, mensagem, imobiliaria_id: imobiliariaId },
  });
  if (error) throw new Error(`whatsapp-send: ${error.message}`);
  return data;
}

async function sendEmailResend(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY || !LOVABLE_API_KEY) {
    throw new Error("email não configurado (RESEND_API_KEY ausente)");
  }
  const res = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": RESEND_API_KEY,
    },
    body: JSON.stringify({
      from: "radarimobtech <onboarding@resend.dev>",
      to: [to],
      subject,
      html,
    }),
  });
  if (!res.ok) throw new Error(`resend ${res.status}: ${await res.text()}`);
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 20), 100);

  const { data: pendentes, error } = await sb
    .from("condominio_notificacoes_eventos")
    .select("*")
    .in("status", ["pending", "failed"])
    .lt("tentativas", 5)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const processed: any[] = [];

  for (const ev of pendentes ?? []) {
    await sb
      .from("condominio_notificacoes_eventos")
      .update({ status: "processing", tentativas: (ev.tentativas ?? 0) + 1 })
      .eq("id", ev.id);

    const { data: cfg } = await sb
      .from("condominio_notificacoes_config")
      .select("*")
      .eq("imobiliaria_id", ev.imobiliaria_id)
      .maybeSingle();

    if (!cfg || !cfg.tipos_habilitados?.includes(ev.tipo)) {
      await sb
        .from("condominio_notificacoes_eventos")
        .update({ status: "skipped", processed_at: new Date().toISOString(), ultimo_erro: cfg ? "tipo desabilitado" : "sem configuração" })
        .eq("id", ev.id);
      processed.push({ id: ev.id, status: "skipped" });
      continue;
    }

    const msg = buildMessage(ev);
    const resultado: any = { wa: [], email: [] };
    const erros: string[] = [];

    if (cfg.wa_enabled && Array.isArray(cfg.destinatarios_wa)) {
      for (const tel of cfg.destinatarios_wa) {
        try {
          await sendWhatsappTo(sb, ev.imobiliaria_id, tel, msg.text);
          resultado.wa.push({ to: tel, ok: true });
        } catch (e: any) {
          resultado.wa.push({ to: tel, ok: false, err: e.message });
          erros.push(`wa:${tel} ${e.message}`);
        }
      }
    }

    if (cfg.email_enabled && Array.isArray(cfg.destinatarios_email)) {
      for (const email of cfg.destinatarios_email) {
        try {
          await sendEmailResend(email, msg.subject, msg.html);
          resultado.email.push({ to: email, ok: true });
        } catch (e: any) {
          resultado.email.push({ to: email, ok: false, err: e.message });
          erros.push(`email:${email} ${e.message}`);
        }
      }
    }

    const anySent = [...resultado.wa, ...resultado.email].some((r: any) => r.ok);
    const anyAttempt = (resultado.wa.length + resultado.email.length) > 0;

    await sb
      .from("condominio_notificacoes_eventos")
      .update({
        status: !anyAttempt ? "skipped" : anySent ? "sent" : "failed",
        processed_at: new Date().toISOString(),
        resultado,
        ultimo_erro: erros.join(" | ") || null,
      })
      .eq("id", ev.id);

    processed.push({ id: ev.id, wa: resultado.wa.length, email: resultado.email.length, ok: anySent });
  }

  return new Response(JSON.stringify({ processed: processed.length, items: processed }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
