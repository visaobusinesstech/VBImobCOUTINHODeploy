import { verifyWebhook, corsHeaders } from "../_shared/webhookSecurity.ts";

function sanitize(str: string | null | undefined): string {
  if (!str) return "";
  return String(str).replace(/[<>]/g, "").trim();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

const LEGACY_ALLOW = (Deno.env.get("WEBHOOK_LEADS_ALLOW_UNSIGNED") ?? "").toLowerCase() === "true";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const imobiliariaId = url.searchParams.get("id") ?? "";
    const portal = url.searchParams.get("portal") || "desconhecido";

    const allowedPortals = [
      "zap", "vivareal", "olx", "imovelweb", "wimoveis",
      "netimoveis", "dfimoveis", "chavenaomao", "vrsync", "desconhecido",
    ];
    const cleanPortal = allowedPortals.includes(portal) ? portal : "desconhecido";

    const rawBody = await req.text();
    if (rawBody.length > 50000) {
      return new Response(JSON.stringify({ error: "Payload muito grande" }), {
        status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verificação de assinatura + replay + tenant.
    // O modo legado (sem assinatura) só existe se explicitamente habilitado por env,
    // para permitir migração dos portais em campo.
    const hasSignatureHeader = !!req.headers.get("x-signature");
    let supabase;
    if (hasSignatureHeader || !LEGACY_ALLOW) {
      const check = await verifyWebhook(req, rawBody, {
        imobiliariaId,
        provider: `portal:${cleanPortal}`,
      });
      if (!check.ok) return check.response!;
      supabase = check.supabase;
    } else {
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
    }

    // Parse payload
    const contentType = req.headers.get("content-type") || "";
    let leadData: Record<string, unknown> = {};
    if (contentType.includes("application/json")) {
      try { leadData = JSON.parse(rawBody); } catch { leadData = { observacoes: rawBody.substring(0, 5000) }; }
    } else if (contentType.includes("application/xml") || contentType.includes("text/xml")) {
      leadData = parseXmlLead(rawBody);
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      leadData = Object.fromEntries(new URLSearchParams(rawBody).entries());
    } else {
      try { leadData = JSON.parse(rawBody); } catch { leadData = { observacoes: rawBody.substring(0, 5000) }; }
    }

    const nome = sanitize((leadData as any).nome || (leadData as any).name || (leadData as any).client_name || (leadData as any).leadName || (leadData as any).NomeCliente || "Lead sem nome").substring(0, 200);
    const telefone = sanitize((leadData as any).telefone || (leadData as any).phone || (leadData as any).tel || (leadData as any).client_phone || (leadData as any).TelefoneCliente).substring(0, 30) || null;
    const rawEmail = sanitize((leadData as any).email || (leadData as any).client_email || (leadData as any).EmailCliente);
    const email = rawEmail && isValidEmail(rawEmail) ? rawEmail : null;
    const mensagem = sanitize((leadData as any).mensagem || (leadData as any).message || (leadData as any).msg || (leadData as any).Mensagem).substring(0, 5000) || null;
    const interesse = sanitize((leadData as any).interesse || (leadData as any).property_title || (leadData as any).TituloImovel || (leadData as any).imovel).substring(0, 500) || null;

    const portalLabels: Record<string, string> = {
      zap: "ZAP Imóveis", vivareal: "VivaReal", olx: "OLX", imovelweb: "Imovelweb",
      wimoveis: "WImóveis", netimoveis: "NetImóveis", dfimoveis: "DFImóveis", chavenaomao: "Chave na Mão",
    };
    const canalOrigem = portalLabels[cleanPortal] || cleanPortal;
    const obsText = [`[Lead via ${canalOrigem}]`, mensagem ? `Mensagem: ${mensagem}` : null].filter(Boolean).join("\n");

    const { error } = await supabase.from("leads").insert({
      imobiliaria_id: imobiliariaId,
      nome, telefone, email,
      interesse: interesse || `Lead recebido via ${canalOrigem}`,
      observacoes: obsText,
      estagio: "novos", posicao: 0, valor: 0,
      canal_origem: canalOrigem,
    });

    if (error) {
      console.error("Erro ao inserir lead:", error);
      return new Response(JSON.stringify({ success: false, error: "Erro ao processar lead" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, message: "Lead recebido com sucesso" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Erro no webhook:", err);
    return new Response(JSON.stringify({ success: false, error: "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function parseXmlLead(xml: string): Record<string, string> {
  const result: Record<string, string> = {};
  const fields = ["nome", "name", "telefone", "phone", "email", "mensagem", "message", "NomeCliente", "TelefoneCliente", "EmailCliente", "Mensagem", "TituloImovel", "CodigoImovel"];
  for (const field of fields) {
    const m = xml.match(new RegExp(`<${field}[^>]*>([^<]*)</${field}>`, "i"));
    if (m) result[field] = m[1].trim();
    const cd = xml.match(new RegExp(`<${field}[^>]*><!\\[CDATA\\[([^\\]]*?)\\]\\]></${field}>`, "i"));
    if (cd) result[field] = cd[1].trim();
  }
  return result;
}
