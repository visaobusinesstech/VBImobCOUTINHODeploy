// Webhook de pagamentos/assinaturas.
// Aceita eventos genéricos de gateway (Stripe/Paddle/Asaas/etc.) desde que enviados
// com HMAC + timestamp + nonce (ver `../_shared/webhookSecurity.ts`).
//
// Payload esperado (JSON):
// {
//   "event": "payment.confirmed" | "subscription.updated" | "subscription.cancelled" | ...,
//   "plan": "profissional",              // opcional
//   "status": "active" | "canceled" | "trialing" | "unpaid" | ...,
//   "external_id": "sub_123",            // id do gateway
//   "amount": 9900,                      // centavos
//   "currency": "BRL",
//   "occurred_at": "2026-07-13T12:00:00Z"
// }

import { verifyWebhook, corsHeaders } from "../_shared/webhookSecurity.ts";

const ALLOWED_EVENTS = new Set([
  "payment.confirmed",
  "payment.failed",
  "payment.refunded",
  "subscription.created",
  "subscription.updated",
  "subscription.cancelled",
  "subscription.trial_end",
]);

const ALLOWED_STATUS = new Set(["active", "trialing", "canceled", "unpaid", "past_due", "incomplete"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const url = new URL(req.url);
    const imobiliariaId = url.searchParams.get("id") ?? "";
    const provider = (url.searchParams.get("provider") || "pagamentos").replace(/[^a-z0-9_-]/gi, "").slice(0, 40);

    const rawBody = await req.text();
    if (rawBody.length > 20000) {
      return new Response(JSON.stringify({ error: "payload_muito_grande" }), {
        status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const check = await verifyWebhook(req, rawBody, {
      imobiliariaId,
      provider: `pagamentos:${provider}`,
      requireTenantHeaderMatch: true,
    });
    if (!check.ok) return check.response!;
    const supabase = check.supabase;

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return new Response(JSON.stringify({ error: "payload_invalido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const event = String(payload.event ?? "").trim();
    const status = String(payload.status ?? "").trim().toLowerCase();
    const externalId = String(payload.external_id ?? "").trim().slice(0, 120) || null;
    const plan = payload.plan ? String(payload.plan).trim().toLowerCase().slice(0, 40) : null;
    const amount = Number.isFinite(Number(payload.amount)) ? Number(payload.amount) : null;

    if (!ALLOWED_EVENTS.has(event)) {
      return new Response(JSON.stringify({ error: "evento_desconhecido", event }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (status && !ALLOWED_STATUS.has(status)) {
      return new Response(JSON.stringify({ error: "status_desconhecido", status }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Efeitos por tipo de evento
    if (event.startsWith("subscription.") && (status || plan)) {
      const patch: Record<string, unknown> = { user_id: imobiliariaId, updated_at: new Date().toISOString() };
      if (status) patch.status = status;
      if (plan) patch.plan_type = plan;

      const { error } = await supabase.from("subscriptions").upsert(patch, { onConflict: "user_id" });
      if (error) {
        console.error("subscriptions upsert error:", error);
        return new Response(JSON.stringify({ error: "erro_persistencia" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Auditoria (service_role) — sucesso
    await supabase.rpc("log_service_role_call", {
      _edge_function: "webhook-pagamentos",
      _action: event,
      _tenant_id: imobiliariaId,
      _outcome: "allowed",
      _reason: null,
      _request_ip: req.headers.get("x-forwarded-for"),
      _user_agent: req.headers.get("user-agent"),
      _metadata: { provider, event, status, plan, amount, external_id: externalId },
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("webhook-pagamentos erro:", err);
    return new Response(JSON.stringify({ error: "erro_interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
