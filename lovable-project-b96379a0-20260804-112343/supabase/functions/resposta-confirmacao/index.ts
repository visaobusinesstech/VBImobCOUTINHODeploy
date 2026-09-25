import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function escapeHtml(str: string | null | undefined): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function htmlPage(title: string, body: string) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .card { background: white; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); max-width: 480px; width: 100%; padding: 32px; }
    h1 { font-size: 20px; color: #1e293b; margin-bottom: 8px; }
    .subtitle { color: #64748b; font-size: 14px; margin-bottom: 24px; }
    .info { background: #f1f5f9; border-radius: 12px; padding: 16px; margin-bottom: 24px; }
    .info-row { display: flex; align-items: center; gap: 8px; padding: 6px 0; font-size: 14px; color: #334155; }
    .info-row .icon { font-size: 16px; }
    .buttons { display: flex; flex-direction: column; gap: 12px; }
    .btn { display: block; width: 100%; padding: 14px; border: none; border-radius: 12px; font-size: 15px; font-weight: 600; cursor: pointer; text-align: center; text-decoration: none; transition: all 0.2s; }
    .btn-confirm { background: #22c55e; color: white; }
    .btn-confirm:hover { background: #16a34a; }
    .btn-cancel { background: #fee2e2; color: #dc2626; }
    .btn-cancel:hover { background: #fecaca; }
    .btn-reschedule { background: #dbeafe; color: #2563eb; }
    .btn-reschedule:hover { background: #bfdbfe; }
    .form-group { margin-top: 16px; }
    .form-group label { display: block; font-size: 13px; font-weight: 500; color: #475569; margin-bottom: 6px; }
    .form-group textarea, .form-group input { width: 100%; padding: 10px 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; font-family: inherit; }
    .form-group textarea { min-height: 80px; resize: vertical; }
    .hidden { display: none; }
    .success { text-align: center; padding: 40px 20px; }
    .success .emoji { font-size: 48px; margin-bottom: 16px; }
    .success h2 { color: #1e293b; margin-bottom: 8px; }
    .success p { color: #64748b; font-size: 14px; }
  </style>
</head>
<body>${body}</body>
</html>`;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // GET: Show confirmation page
  if (req.method === "GET") {
    const token = url.searchParams.get("token");
    if (!token) {
      return new Response(htmlPage("Erro", '<div class="card"><h1>Link inválido</h1><p class="subtitle">Este link de confirmação não é válido.</p></div>'), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    const { data: comp, error } = await supabase
      .from("compromissos")
      .select("id, titulo, tipo, local, data_inicio, data_fim, google_maps_link, confirmacao_status, imobiliaria_id")
      .eq("confirmacao_token", token)
      .single();

    if (error || !comp) {
      return new Response(htmlPage("Não encontrado", '<div class="card"><h1>Compromisso não encontrado</h1><p class="subtitle">Este link pode ter expirado ou ser inválido.</p></div>'), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    if (comp.confirmacao_status === "confirmado") {
      return new Response(htmlPage("Confirmado", '<div class="card success"><div class="emoji">✅</div><h2>Presença confirmada!</h2><p>Obrigado pela confirmação. Nos vemos em breve!</p></div>'), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
    if (comp.confirmacao_status === "cancelado") {
      return new Response(htmlPage("Cancelado", '<div class="card success"><div class="emoji">❌</div><h2>Compromisso cancelado</h2><p>Seu cancelamento foi registrado. Obrigado por nos informar.</p></div>'), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
    if (comp.confirmacao_status === "reagendar") {
      return new Response(htmlPage("Reagendamento", '<div class="card success"><div class="emoji">📅</div><h2>Reagendamento solicitado</h2><p>Recebemos sua solicitação. Entraremos em contato em breve.</p></div>'), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    const { data: config } = await supabase
      .from("imobiliaria_config")
      .select("nome_empresa, logo_url")
      .eq("user_id", comp.imobiliaria_id)
      .single();

    const empresaNome = config?.nome_empresa || "Imobiliária";
    const dataObj = new Date(comp.data_inicio);
    const dataFormatada = dataObj.toLocaleDateString("pt-BR", {
      weekday: "long", day: "2-digit", month: "long", timeZone: "America/Sao_Paulo"
    });
    const horaFormatada = dataObj.toLocaleTimeString("pt-BR", {
      hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo"
    });

    const tipoLabel = comp.tipo === "visita" ? "🏠 Visita a Imóvel" : comp.tipo === "reuniao" ? "🤝 Reunião" : comp.tipo === "assinatura" ? "✍️ Assinatura" : "📌 Compromisso";
    const functionUrl = `${supabaseUrl}/functions/v1/resposta-confirmacao`;

    const body = `
    <div class="card">
      <h1>${escapeHtml(empresaNome)}</h1>
      <p class="subtitle">Confirme sua presença no compromisso abaixo</p>
      <div class="info">
        <div class="info-row"><span class="icon">📋</span> <strong>${escapeHtml(comp.titulo)}</strong></div>
        <div class="info-row"><span class="icon">🏷️</span> ${tipoLabel}</div>
        <div class="info-row"><span class="icon">📅</span> ${dataFormatada}</div>
        <div class="info-row"><span class="icon">🕐</span> ${horaFormatada}</div>
        ${comp.local ? `<div class="info-row"><span class="icon">📍</span> ${escapeHtml(comp.local)}</div>` : ""}
        ${comp.google_maps_link ? `<div class="info-row"><a href="${escapeHtml(comp.google_maps_link)}" target="_blank" rel="noopener noreferrer" style="color:#2563eb;text-decoration:none;">🗺️ Ver no Google Maps</a></div>` : ""}
      </div>
      <div class="buttons">
        <form method="POST" action="${functionUrl}">
          <input type="hidden" name="token" value="${token}">
          <input type="hidden" name="acao" value="confirmar">
          <button type="submit" class="btn btn-confirm">✅ Confirmar presença</button>
        </form>
        <button class="btn btn-reschedule" onclick="document.getElementById('reschedule-form').classList.toggle('hidden')">📅 Solicitar reagendamento</button>
        <div id="reschedule-form" class="hidden">
          <form method="POST" action="${functionUrl}">
            <input type="hidden" name="token" value="${token}">
            <input type="hidden" name="acao" value="reagendar">
            <div class="form-group">
              <label>Sugestão de nova data/horário</label>
              <input type="datetime-local" name="nova_data" required>
            </div>
            <div class="form-group">
              <label>Observação (opcional)</label>
              <textarea name="resposta" placeholder="Explique o motivo do reagendamento..."></textarea>
            </div>
            <button type="submit" class="btn btn-reschedule" style="margin-top:12px;">Enviar solicitação</button>
          </form>
        </div>
        <button class="btn btn-cancel" onclick="document.getElementById('cancel-form').classList.toggle('hidden')">❌ Cancelar compromisso</button>
        <div id="cancel-form" class="hidden">
          <form method="POST" action="${functionUrl}">
            <input type="hidden" name="token" value="${token}">
            <input type="hidden" name="acao" value="cancelar">
            <div class="form-group">
              <label>Motivo do cancelamento (opcional)</label>
              <textarea name="resposta" placeholder="Informe o motivo..."></textarea>
            </div>
            <button type="submit" class="btn btn-cancel" style="margin-top:12px;">Confirmar cancelamento</button>
          </form>
        </div>
      </div>
    </div>`;

    return new Response(htmlPage(`Confirmação - ${empresaNome}`, body), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  // POST: Handle client response
  if (req.method === "POST") {
    const contentType = req.headers.get("content-type") || "";
    let token = "", acao = "", resposta = "", novaData = "";

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      token = formData.get("token")?.toString() || "";
      acao = formData.get("acao")?.toString() || "";
      resposta = formData.get("resposta")?.toString() || "";
      novaData = formData.get("nova_data")?.toString() || "";
    } else {
      const body = await req.json();
      token = body.token || "";
      acao = body.acao || "";
      resposta = body.resposta || "";
      novaData = body.nova_data || "";
    }

    if (!token || !acao) {
      return new Response(htmlPage("Erro", '<div class="card"><h1>Dados inválidos</h1></div>'), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    const { data: comp, error } = await supabase
      .from("compromissos")
      .select("id, titulo, imobiliaria_id, lead_id, leads(nome)")
      .eq("confirmacao_token", token)
      .single();

    if (error || !comp) {
      return new Response(htmlPage("Erro", '<div class="card"><h1>Compromisso não encontrado</h1></div>'), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    const leadNome = (comp as any).leads?.nome || "Cliente";
    const updates: Record<string, any> = { cliente_resposta: resposta || null };

    let emoji = "", statusLabel = "", notifTitle = "", notifDesc = "";

    if (acao === "confirmar") {
      updates.confirmacao_status = "confirmado";
      updates.confirmado = true;
      emoji = "✅"; statusLabel = "Presença confirmada!";
      notifTitle = `✅ Confirmado: ${comp.titulo}`;
      notifDesc = `${leadNome} confirmou presença.`;
    } else if (acao === "cancelar") {
      updates.confirmacao_status = "cancelado";
      updates.status = "cancelado";
      emoji = "❌"; statusLabel = "Compromisso cancelado";
      notifTitle = `❌ Cancelado: ${comp.titulo}`;
      notifDesc = `${leadNome} cancelou. ${resposta ? `Motivo: ${resposta}` : ""}`;
    } else if (acao === "reagendar") {
      updates.confirmacao_status = "reagendar";
      if (novaData) updates.data_reagendamento_sugerida = new Date(novaData).toISOString();
      emoji = "📅"; statusLabel = "Reagendamento solicitado";
      notifTitle = `📅 Reagendamento: ${comp.titulo}`;
      notifDesc = `${leadNome} solicitou reagendamento. ${novaData ? `Sugestão: ${new Date(novaData).toLocaleDateString("pt-BR")}` : ""} ${resposta ? `Obs: ${resposta}` : ""}`;
    }

    await supabase.from("compromissos").update(updates).eq("id", comp.id);

    // Notify the agent
    await supabase.from("notifications").insert({
      user_id: comp.imobiliaria_id,
      title: notifTitle,
      description: notifDesc.trim(),
    });

    return new Response(
      htmlPage(statusLabel, `<div class="card success"><div class="emoji">${emoji}</div><h2>${statusLabel}</h2><p>Obrigado por nos informar. ${acao === "reagendar" ? "Entraremos em contato em breve com a nova data." : ""}</p></div>`),
      { headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  return new Response("Method not allowed", { status: 405 });
});
