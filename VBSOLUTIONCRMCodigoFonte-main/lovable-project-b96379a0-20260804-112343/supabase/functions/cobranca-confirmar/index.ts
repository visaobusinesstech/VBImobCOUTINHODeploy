// Public endpoint - clients confirm payment via unique token
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

const isUuid = (s: unknown): s is string =>
  typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  try {
    const url = new URL(req.url);
    const token = req.method === "GET"
      ? url.searchParams.get("token")
      : (await req.clone().json().catch(() => ({}))).token;

    if (!isUuid(token)) return json({ error: "Token inválido" }, 400);

    const { data: tx, error } = await supabase
      .from("transacoes")
      .select("id, imobiliaria_id, descricao, valor, data, status, categoria, link_pagamento, pago_confirmado_em, proprietario_nome")
      .eq("token_pagamento", token)
      .maybeSingle();

    if (error || !tx) return json({ error: "Cobrança não encontrada" }, 404);

    // Fetch imobiliaria name/logo
    const { data: cfg } = await supabase
      .from("imobiliaria_config")
      .select("nome_imobiliaria, logo_url, telefone")
      .eq("imobiliaria_id", tx.imobiliaria_id)
      .maybeSingle();

    if (req.method === "GET") {
      return json({
        cobranca: {
          descricao: tx.descricao,
          valor: Number(tx.valor),
          data_vencimento: tx.data,
          status: tx.status,
          categoria: tx.categoria,
          link_pagamento: tx.link_pagamento,
          confirmado_em: tx.pago_confirmado_em,
          destinatario: tx.proprietario_nome,
        },
        imobiliaria: cfg ?? null,
      });
    }

    // POST → mark as paid
    const body = await req.json().catch(() => ({}));
    const pagoPor = typeof body.pago_por === "string" ? body.pago_por.slice(0, 200) : null;
    const comprovanteUrl = typeof body.comprovante_url === "string"
      ? body.comprovante_url.slice(0, 500)
      : null;

    if (tx.pago_confirmado_em) {
      return json({ error: "Pagamento já confirmado", confirmado_em: tx.pago_confirmado_em }, 409);
    }

    const { error: upErr } = await supabase
      .from("transacoes")
      .update({
        status: "confirmado",
        pago_confirmado_em: new Date().toISOString(),
        pago_confirmado_por: pagoPor,
        comprovante_url: comprovanteUrl,
        data_recebimento: new Date().toISOString().slice(0, 10),
      })
      .eq("id", tx.id);

    if (upErr) {
      console.error("update error", upErr);
      return json({ error: "Falha ao registrar pagamento" }, 500);
    }

    // Notificação in-app para a imobiliária
    await supabase.from("notifications").insert({
      user_id: tx.imobiliaria_id,
      titulo: "Pagamento confirmado",
      mensagem: `${tx.descricao} — R$ ${Number(tx.valor).toFixed(2)} confirmado por ${pagoPor ?? "cliente"}`,
      tipo: "sucesso",
    });

    return json({ ok: true });
  } catch (err) {
    console.error("cobranca-confirmar error", err);
    return json({ error: (err as Error).message }, 500);
  }
});
