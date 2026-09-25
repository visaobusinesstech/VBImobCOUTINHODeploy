import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

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
    const { data: { user: caller }, error: authError } = await anonClient.auth.getUser();
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: "Sessão expirada. Faça login novamente." }), {
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
      return new Response(JSON.stringify({ error: "Conta não aprovada." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const {
      proprietario_nome,
      proprietario_email,
      contratos,
      brand_name,
      brand_email,
      brand_phone,
      data_relatorio,
    } = body;

    if (!proprietario_nome || !contratos) {
      return new Response(JSON.stringify({ error: "proprietario_nome e contratos são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build HTML email content with escaped values
    const contractRows = (contratos || [])
      .slice(0, 100)
      .map(
        (c: any) => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(String(c.imovel || ""))}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(String(c.inquilino || "—"))}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${escapeHtml(String(c.aluguel || ""))}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #16a34a;">${escapeHtml(String(c.recebido || ""))}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #ea580c;">${escapeHtml(String(c.pendente || ""))}</td>
        </tr>`
      )
      .join("");

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
        <div style="background: #2563eb; padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">${escapeHtml(String(brand_name || "ImobPro"))}</h1>
          <p style="color: #bfdbfe; margin: 4px 0 0; font-size: 14px;">Relatório de Aluguéis</p>
        </div>
        
        <div style="padding: 24px;">
          <p style="color: #374151; font-size: 14px;">
            Olá <strong>${escapeHtml(String(proprietario_nome))}</strong>,
          </p>
          <p style="color: #6b7280; font-size: 14px;">
            Segue o relatório de aluguéis dos seus imóveis referente a <strong>${escapeHtml(String(data_relatorio || ""))}</strong>.
          </p>
          
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px;">
            <thead>
              <tr style="background: #f3f4f6;">
                <th style="padding: 8px; text-align: left;">Imóvel</th>
                <th style="padding: 8px; text-align: left;">Inquilino</th>
                <th style="padding: 8px; text-align: right;">Aluguel</th>
                <th style="padding: 8px; text-align: right;">Recebido</th>
                <th style="padding: 8px; text-align: right;">Pendente</th>
              </tr>
            </thead>
            <tbody>
              ${contractRows}
            </tbody>
          </table>
          
          <p style="color: #6b7280; font-size: 12px; margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
            Este relatório foi gerado automaticamente. Para mais detalhes, entre em contato conosco.
            ${brand_phone ? `<br/>📞 ${escapeHtml(String(brand_phone))}` : ""}
            ${brand_email ? `<br/>📧 ${escapeHtml(String(brand_email))}` : ""}
          </p>
        </div>
      </div>
    `;

    console.log("Relatório preparado para:", proprietario_nome);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Relatório preparado para ${proprietario_nome}`,
        email_prepared: !!proprietario_email,
        html_preview: htmlContent,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Erro:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno ao gerar relatório." }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
