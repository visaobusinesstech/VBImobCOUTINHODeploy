// Executa em lote as buscas de captação agendadas (diária/semanal),
// com dupla passada (histórica + recente) e notifica novas oportunidades.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type Agendamento = {
  id: string;
  imobiliaria_id: string;
  user_id: string;
  nome: string;
  params: Record<string, unknown>;
  frequencia: "diaria" | "semanal";
  fingerprints_conhecidos: string[];
};

function fingerprintOp(op: any): string {
  const link = (op?.link_anuncio || "").toString().trim().toLowerCase();
  if (link) return `l:${link}`;
  const key = [op?.titulo, op?.endereco, op?.bairro, op?.nome_predio, op?.preco_estimado]
    .map((v) => (v ?? "").toString().trim().toLowerCase())
    .join("|");
  return `k:${key}`;
}

async function runOne(admin: ReturnType<typeof createClient>, ag: Agendamento) {
  const started = Date.now();
  const collected = new Map<string, any>();

  // Dupla passada: (1) janela histórica ampla, (2) janela recente
  const passes = [
    { pass_id: "historica", qdr: "y" },
    { pass_id: "recente", qdr: "w" },
  ];

  for (const p of passes) {
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/captacao-inteligente`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SERVICE_KEY}`,
          apikey: SERVICE_KEY,
          // Sinaliza execução em nome do usuário dono do agendamento
          "x-scheduled-user-id": ag.user_id,
        },
        body: JSON.stringify({
          action: "buscar_oportunidades",
          params: {
            ...ag.params,
            _agendamento_id: ag.id,
            _pass: p.pass_id,
            _qdr: p.qdr,
          },
        }),
      });
      const json = await resp.json().catch(() => ({}));
      const ops = json?.data?.oportunidades || [];
      for (const op of ops) {
        const fp = fingerprintOp(op);
        if (!collected.has(fp)) collected.set(fp, op);
      }
    } catch (e) {
      console.error(`[executar-buscas-agendadas] ag=${ag.id} pass=${p.pass_id} err=`, String(e).slice(0, 300));
    }
  }

  const conhecidos = new Set(ag.fingerprints_conhecidos || []);
  const novos: { fp: string; op: any }[] = [];
  for (const [fp, op] of collected) {
    if (!conhecidos.has(fp)) novos.push({ fp, op });
  }

  // Cria notificação se houver novidades
  if (novos.length > 0) {
    const top = [...novos]
      .sort((a, b) => (b.op?.score_oportunidade || 0) - (a.op?.score_oportunidade || 0))
      .slice(0, 3);
    const preview = top
      .map((n) => `• ${n.op?.titulo?.slice(0, 60) || "Oportunidade"} — score ${n.op?.score_oportunidade ?? "-"}`)
      .join("\n");
    await admin.from("notifications").insert({
      user_id: ag.user_id,
      title: `🔔 ${novos.length} nova(s) oportunidade(s) — ${ag.nome}`,
      description: `Busca agendada (${ag.frequencia}) encontrou ${novos.length} de ${collected.size} resultados.\n${preview}`,
    });
  }

  // Calcula próxima execução
  const proxima = new Date();
  if (ag.frequencia === "semanal") proxima.setDate(proxima.getDate() + 7);
  else proxima.setDate(proxima.getDate() + 1);

  // Atualiza agendamento (mantém no máx 2000 fingerprints)
  const merged = Array.from(new Set([...conhecidos, ...collected.keys()])).slice(-2000);
  await admin
    .from("captacao_buscas_agendadas")
    .update({
      ultima_execucao: new Date().toISOString(),
      proxima_execucao: proxima.toISOString(),
      ultimo_total: collected.size,
      ultimo_novos: novos.length,
      fingerprints_conhecidos: merged,
    })
    .eq("id", ag.id);

  return { id: ag.id, total: collected.size, novos: novos.length, ms: Date.now() - started };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: pend, error } = await admin
      .from("captacao_buscas_agendadas")
      .select("id,imobiliaria_id,user_id,nome,params,frequencia,fingerprints_conhecidos")
      .eq("ativo", true)
      .lte("proxima_execucao", new Date().toISOString())
      .limit(25);
    if (error) throw error;

    const results = [];
    for (const ag of (pend as Agendamento[] | null) || []) {
      results.push(await runOne(admin, ag));
    }
    return new Response(JSON.stringify({ success: true, processados: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[executar-buscas-agendadas]", e);
    return new Response(JSON.stringify({ success: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
