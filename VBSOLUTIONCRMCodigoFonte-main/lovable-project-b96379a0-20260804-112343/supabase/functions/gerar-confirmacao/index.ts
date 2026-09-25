import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireUserAi, callUserAi } from "../_shared/ai-config.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // === AI Usage Limit Check ===
    const _authHeader = req.headers.get("Authorization");
    if (!_authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const _sbUrl = Deno.env.get("SUPABASE_URL")!;
    const _sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const { createClient: _createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const _sbAdmin = _createClient(_sbUrl, _sbKey);
    const _token = _authHeader.replace("Bearer ", "");
    const { data: { user: _aiUser } } = await _sbAdmin.auth.getUser(_token);

    const _iaGate = await requireUserAi(_sbAdmin, _aiUser?.id, corsHeaders);
    if (_iaGate.response) return _iaGate.response;
    if (!_aiUser) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: _usageCount } = await _sbAdmin.rpc("get_ai_usage_count", {
      _user_id: _aiUser.id, _function_name: "gerar-confirmacao"
    });
    if (_usageCount && _usageCount >= 500) {
      return new Response(JSON.stringify({ 
        error: "Limite de uso da IA atingido para esta funcionalidade. Faça upgrade do seu plano para continuar usando.",
        limit_reached: true
      }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // === End AI Usage Limit Check ===
    // Log AI usage
    await _sbAdmin.from("ai_usage_log").insert({ user_id: _aiUser.id, function_name: "gerar-confirmacao" });


    const { compromisso_id } = await req.json();
    if (!compromisso_id) {
      return new Response(
        JSON.stringify({ error: "compromisso_id obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: comp, error: compError } = await supabase
      .from("compromissos")
      .select("id, titulo, tipo, local, data_inicio, data_fim, email_cliente, telefone_lembrete, confirmacao_token, lead_id, imobiliaria_id, leads(nome)")
      .eq("id", compromisso_id)
      .single();

    if (compError || !comp) {
      return new Response(
        JSON.stringify({ error: "Compromisso não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get imobiliaria name
    const { data: config } = await supabase
      .from("imobiliaria_config")
      .select("nome_empresa")
      .eq("user_id", comp.imobiliaria_id)
      .single();

    const empresaNome = config?.nome_empresa || "Imobiliária";
    const leadNome = (comp as any).leads?.nome || "Cliente";

    const dataObj = new Date(comp.data_inicio);
    const dataFormatada = dataObj.toLocaleDateString("pt-BR", {
      weekday: "long", day: "2-digit", month: "long", year: "numeric", timeZone: "America/Sao_Paulo"
    });
    const horaFormatada = dataObj.toLocaleTimeString("pt-BR", {
      hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo"
    });

    const tipoLabel = comp.tipo === "visita" ? "visita ao imóvel" : comp.tipo === "reuniao" ? "reunião" : comp.tipo === "assinatura" ? "assinatura de contrato" : "compromisso";

    // Generate AI message via user's BYOK provider
    let mensagem = "";

    const prompt = `Gere uma mensagem profissional e cordial de confirmação de ${tipoLabel} para um cliente do mercado imobiliário brasileiro.

Dados:
- Nome do cliente: ${leadNome}
- Empresa: ${empresaNome}
- Tipo: ${tipoLabel}
- Data: ${dataFormatada}
- Horário: ${horaFormatada}
- Local: ${comp.local || "A definir"}
- Título: ${comp.titulo}

A mensagem deve:
- Ser em português brasileiro
- Começar com saudação usando o nome do cliente
- Informar data, hora e local
- Ser profissional mas acolhedora
- Ter no máximo 4 parágrafos curtos
- NÃO incluir links (serão adicionados separadamente)
- Terminar com assinatura da empresa`;

    const aiResult = await callUserAi(_iaGate.config, {
      systemPrompt: "Você é um assistente de comunicação imobiliária profissional.",
      userPrompt: prompt,
      temperature: 0.6,
    });
    if (aiResult.ok) mensagem = aiResult.text || "";

    // Fallback template (used only if user's provider fails; NO system AI key involved)
    if (!mensagem) {
      mensagem = `Olá ${leadNome}!\n\nGostaríamos de confirmar sua ${tipoLabel} agendada para ${dataFormatada} às ${horaFormatada}.\n\n${comp.local ? `📍 Local: ${comp.local}\n\n` : ""}Contamos com sua presença!\n\nAtenciosamente,\n${empresaNome}`;
    }

    // Build confirmation link
    const confirmationLink = `${supabaseUrl}/functions/v1/resposta-confirmacao?token=${comp.confirmacao_token}`;

    // Update compromisso
    await supabase
      .from("compromissos")
      .update({
        confirmacao_status: "enviado",
        confirmacao_mensagem: mensagem,
      })
      .eq("id", compromisso_id);

    // Build WhatsApp link if phone available
    let whatsappLink = null;
    if (comp.telefone_lembrete) {
      const phone = comp.telefone_lembrete.replace(/\D/g, "");
      const whatsMsg = encodeURIComponent(
        `${mensagem}\n\n📋 *Confirme sua presença:*\nClique no link abaixo para confirmar, cancelar ou reagendar:\n${confirmationLink}`
      );
      whatsappLink = `https://wa.me/55${phone}?text=${whatsMsg}`;
    }

    // Create notification
    await supabase.from("notifications").insert({
      user_id: comp.imobiliaria_id,
      title: `📨 Confirmação enviada: ${comp.titulo}`,
      description: `Mensagem de confirmação gerada para ${leadNome}. ${whatsappLink ? "Link WhatsApp disponível." : "Copie a mensagem para enviar."}`,
    });

    return new Response(
      JSON.stringify({
        success: true,
        mensagem,
        confirmationLink,
        whatsappLink,
        token: comp.confirmacao_token,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Erro gerar-confirmacao:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno ao gerar confirmação. Tente novamente." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
