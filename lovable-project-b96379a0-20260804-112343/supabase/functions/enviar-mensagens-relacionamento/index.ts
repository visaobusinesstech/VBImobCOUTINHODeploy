import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Filho {
  nome: string;
  data_nascimento: string;
}

interface Cliente {
  id: string;
  imobiliaria_id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  aniversario: string | null;
  data_casamento: string | null;
  profissao: string | null;
  data_profissao: string | null;
  filhos: Filho[];
}

interface Template {
  tipo: string;
  mensagem: string;
}

const DEFAULT_TEMPLATES: Record<string, string> = {
  aniversario: "🎂 Feliz Aniversário, {nome}! Desejamos muitas felicidades e realizações!",
  casamento: "💍 Feliz Aniversário de Casamento, {nome}! Que o amor continue florescendo!",
  profissao: "🎉 Feliz Dia do(a) {profissao}, {nome}! Parabéns pela dedicação à sua profissão!",
  filho_aniversario: "🎈 Hoje é aniversário de {filho}! Parabéns, {nome}! Desejamos muitas alegrias em família!",
};

function isSameDay(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const today = new Date();
  const d = new Date(dateStr);
  return d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
}

function applyTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value);
  }
  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: clientes, error } = await supabase
      .from("clientes_relacionamento")
      .select("*")
      .eq("ativo", true);

    if (error) throw error;

    const mensagensEnviadas: string[] = [];

    // Group clients by imobiliaria to fetch templates per owner
    const byOwner = new Map<string, Cliente[]>();
    for (const c of (clientes || []) as Cliente[]) {
      const list = byOwner.get(c.imobiliaria_id) || [];
      list.push(c);
      byOwner.set(c.imobiliaria_id, list);
    }

    for (const [ownerId, ownerClientes] of byOwner) {
      // Fetch custom templates for this owner
      const { data: tplData } = await supabase
        .from("mensagem_templates")
        .select("tipo, mensagem")
        .eq("imobiliaria_id", ownerId);

      const customTemplates: Record<string, string> = {};
      for (const t of (tplData || []) as Template[]) {
        customTemplates[t.tipo] = t.mensagem;
      }

      const getMsg = (tipo: string) => customTemplates[tipo] || DEFAULT_TEMPLATES[tipo] || "";

      for (const cliente of ownerClientes) {
        const msgs: string[] = [];
        const primeiroNome = cliente.nome.split(" ")[0];

        if (isSameDay(cliente.aniversario)) {
          msgs.push(applyTemplate(getMsg("aniversario"), { nome: primeiroNome }));
        }

        if (isSameDay(cliente.data_casamento)) {
          msgs.push(applyTemplate(getMsg("casamento"), { nome: primeiroNome }));
        }

        if (isSameDay(cliente.data_profissao) && cliente.profissao) {
          msgs.push(applyTemplate(getMsg("profissao"), { nome: primeiroNome, profissao: cliente.profissao }));
        }

        if (cliente.filhos && Array.isArray(cliente.filhos)) {
          for (const filho of cliente.filhos) {
            if (isSameDay(filho.data_nascimento)) {
              msgs.push(applyTemplate(getMsg("filho_aniversario"), { nome: primeiroNome, filho: filho.nome }));
            }
          }
        }

        if (msgs.length === 0) continue;

        const mensagemCompleta = msgs.join("\n\n");

        if (cliente.email) {
          await supabase.from("notifications").insert({
            user_id: cliente.imobiliaria_id,
            title: `📬 Mensagem automática para ${cliente.nome}`,
            description: `Email para ${cliente.email}: ${mensagemCompleta}`,
          });
        }

        if (cliente.telefone) {
          const num = cliente.telefone.replace(/\D/g, "");
          const waLink = `https://wa.me/55${num}?text=${encodeURIComponent(mensagemCompleta)}`;
          await supabase.from("notifications").insert({
            user_id: cliente.imobiliaria_id,
            title: `📱 WhatsApp para ${cliente.nome}`,
            description: `Enviar via WhatsApp: ${waLink}`,
          });
        }

        mensagensEnviadas.push(cliente.nome);
      }
    }

    return new Response(
      JSON.stringify({ success: true, mensagens_enviadas: mensagensEnviadas.length, clientes: mensagensEnviadas }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
