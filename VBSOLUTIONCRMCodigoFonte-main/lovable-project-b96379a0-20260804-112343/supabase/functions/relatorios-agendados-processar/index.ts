// Processa relatórios agendados: gera CSV/PDF por período e envia por e-mail
// aos destinatários configurados (manuais, corretores e usuários com permissão).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Tipo = "leads" | "imoveis" | "financeiro" | "contratos" | "captacao";

const FONTES: Record<Tipo, { tabela: string; campoData: string; colunas: string[]; titulo: string }> = {
  leads: {
    tabela: "leads",
    campoData: "created_at",
    colunas: ["nome", "telefone", "email", "estagio", "canal_origem", "tipo_operacao", "valor", "created_at"],
    titulo: "Leads",
  },
  imoveis: {
    tabela: "imoveis",
    campoData: "created_at",
    colunas: ["titulo", "tipo", "operacao", "preco", "cidade", "bairro", "status", "created_at"],
    titulo: "Imóveis",
  },
  financeiro: {
    tabela: "transacoes",
    campoData: "data",
    colunas: ["descricao", "tipo", "categoria", "valor", "status", "data", "corretor_nome"],
    titulo: "Financeiro",
  },
  contratos: {
    tabela: "contratos",
    campoData: "created_at",
    colunas: ["titulo", "cliente", "tipo", "valor", "status", "data_inicio", "data_fim"],
    titulo: "Contratos",
  },
  captacao: {
    tabela: "captacao_pipeline",
    campoData: "created_at",
    colunas: ["nome", "telefone", "imovel_cidade", "imovel_bairro", "operacao", "estagio", "valor_estimado", "created_at"],
    titulo: "Captação",
  },
};

function periodoRange(periodo: string): { inicio: Date; fim: Date } {
  const fim = new Date();
  const inicio = new Date(fim);
  if (periodo === "mes_anterior") {
    const i = new Date(fim.getFullYear(), fim.getMonth() - 1, 1);
    const f = new Date(fim.getFullYear(), fim.getMonth(), 0, 23, 59, 59);
    return { inicio: i, fim: f };
  }
  const dias = periodo === "7d" ? 7 : periodo === "90d" ? 90 : 30;
  inicio.setDate(inicio.getDate() - dias);
  return { inicio, fim };
}

function fmtValor(v: unknown) {
  if (v === null || v === undefined || v === "") return "";
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtCelula(col: string, v: unknown) {
  if (v === null || v === undefined) return "";
  if (/valor|preco|comissao/.test(col)) return fmtValor(v);
  if (/(_at|^data|_em$|data_)/.test(col) && typeof v === "string" && v.length >= 10) {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toLocaleDateString("pt-BR");
  }
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function toCSV(colunas: string[], rows: any[]): string {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const head = colunas.map((c) => esc(c.replace(/_/g, " "))).join(";");
  const body = rows.map((r) => colunas.map((c) => esc(fmtCelula(c, r[c]))).join(";")).join("\n");
  return "\uFEFF" + head + "\n" + body;
}

async function toPDF(titulo: string, subtitulo: string, colunas: string[], rows: any[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const navy = rgb(0.05, 0.13, 0.29);
  const gold = rgb(0.72, 0.57, 0.24);
  const width = 842, height = 595; // paisagem A4
  const margin = 32;
  const colW = (width - margin * 2) / colunas.length;
  let page = doc.addPage([width, height]);
  let y = height - margin;

  const header = () => {
    page.drawRectangle({ x: 0, y: height - 60, width, height: 60, color: navy });
    page.drawText(titulo, { x: margin, y: height - 34, size: 16, font: bold, color: rgb(1, 1, 1) });
    page.drawText(subtitulo, { x: margin, y: height - 50, size: 9, font, color: gold });
    y = height - 78;
    colunas.forEach((c, i) => {
      page.drawText(c.replace(/_/g, " ").slice(0, 18), {
        x: margin + i * colW, y, size: 8, font: bold, color: navy,
      });
    });
    y -= 12;
  };
  header();

  const clean = (s: string) => s.replace(/[^\x20-\x7E]/g, (ch) => ({ "á":"a","à":"a","ã":"a","â":"a","é":"e","ê":"e","í":"i","ó":"o","ô":"o","õ":"o","ú":"u","ç":"c","Á":"A","Ã":"A","É":"E","Í":"I","Ó":"O","Õ":"O","Ú":"U","Ç":"C" } as Record<string,string>)[ch] ?? "");

  for (const r of rows) {
    if (y < margin + 20) { page = doc.addPage([width, height]); header(); }
    colunas.forEach((c, i) => {
      page.drawText(clean(fmtCelula(c, r[c])).slice(0, 22), {
        x: margin + i * colW, y, size: 7.5, font, color: rgb(0.2, 0.2, 0.2),
      });
    });
    y -= 11;
  }
  if (rows.length === 0) {
    page.drawText("Nenhum registro no periodo.", { x: margin, y, size: 10, font, color: rgb(0.4, 0.4, 0.4) });
  }
  return await doc.save();
}

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

async function enviarEmail(to: string[], subject: string, html: string, filename: string, contentB64: string) {
  if (!RESEND_API_KEY || !LOVABLE_API_KEY) throw new Error("E-mail não configurado (RESEND_API_KEY ausente)");
  const res = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": RESEND_API_KEY,
    },
    body: JSON.stringify({
      from: "radarimobtech <onboarding@resend.dev>",
      to,
      subject,
      html,
      attachments: [{ filename, content: contentB64 }],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`resend [${res.status}]: ${body}`);
  }
}

async function resolverDestinatarios(sb: any, cfg: any): Promise<string[]> {
  const set = new Set<string>();
  for (const e of cfg.destinatarios ?? []) {
    if (typeof e === "string" && e.includes("@")) set.add(e.trim().toLowerCase());
  }

  const { data: corretores } = await sb
    .from("corretores")
    .select("id,email,status")
    .eq("imobiliaria_id", cfg.imobiliaria_id)
    .eq("status", "ativo");
  const ativos = (corretores ?? []).filter((c: any) => (c.email || "").trim());

  if (cfg.incluir_corretores) {
    ativos.forEach((c: any) => set.add(String(c.email).trim().toLowerCase()));
  }

  if (cfg.enviar_para_permissao) {
    // Corretores da imobiliária com o módulo liberado
    const ids = ativos.map((c: any) => c.id);
    if (ids.length) {
      const { data: perms } = await sb
        .from("corretor_permissoes")
        .select("corretor_id")
        .eq("modulo", cfg.enviar_para_permissao)
        .eq("ativo", true)
        .in("corretor_id", ids);
      const permitidos = new Set((perms ?? []).map((p: any) => p.corretor_id));
      ativos
        .filter((c: any) => permitidos.has(c.id))
        .forEach((c: any) => set.add(String(c.email).trim().toLowerCase()));
    }
    // Titular da conta (sempre tem acesso total aos módulos)
    const { data: titular } = await sb.from("profiles").select("email").eq("id", cfg.imobiliaria_id).maybeSingle();
    if (titular?.email) set.add(String(titular.email).trim().toLowerCase());
  }
  return [...set];
}


function proximaExecucao(cfg: any, base = new Date()): Date {
  const d = new Date(base);
  d.setSeconds(0, 0);
  d.setMinutes(0);
  d.setHours(cfg.hora ?? 8);
  if (cfg.frequencia === "diaria") {
    d.setDate(d.getDate() + 1);
  } else if (cfg.frequencia === "mensal") {
    d.setMonth(d.getMonth() + 1);
    d.setDate(Math.min(cfg.dia_mes ?? 1, 28));
  } else {
    const alvo = cfg.dia_semana ?? 1;
    d.setDate(d.getDate() + 1);
    while (d.getDay() !== alvo) d.setDate(d.getDate() + 1);
  }
  return d;
}

async function processarUm(sb: any, cfg: any) {
  const fonte = FONTES[cfg.tipo_relatorio as Tipo];
  if (!fonte) throw new Error(`Tipo de relatório inválido: ${cfg.tipo_relatorio}`);
  const { inicio, fim } = periodoRange(cfg.periodo);

  const { data: rows, error } = await sb
    .from(fonte.tabela)
    .select(fonte.colunas.join(","))
    .eq("imobiliaria_id", cfg.imobiliaria_id)
    .gte(fonte.campoData, inicio.toISOString())
    .lte(fonte.campoData, fim.toISOString())
    .order(fonte.campoData, { ascending: false })
    .limit(5000);
  if (error) throw new Error(`consulta: ${error.message}`);

  const destinatarios = await resolverDestinatarios(sb, cfg);
  if (!destinatarios.length) throw new Error("Nenhum destinatário com e-mail válido");

  const periodoLabel = `${inicio.toLocaleDateString("pt-BR")} a ${fim.toLocaleDateString("pt-BR")}`;
  const isPdf = cfg.formato === "pdf";
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `${fonte.titulo.toLowerCase()}-${stamp}.${isPdf ? "pdf" : "csv"}`;
  const content = isPdf
    ? toBase64(await toPDF(`Relatório de ${fonte.titulo}`, `Período: ${periodoLabel}`, fonte.colunas, rows ?? []))
    : toBase64(new TextEncoder().encode(toCSV(fonte.colunas, rows ?? [])));

  const html = `<div style="font-family:Arial,sans-serif;max-width:560px">
    <h2 style="color:#0d2149;margin:0 0 8px">${cfg.nome}</h2>
    <p style="margin:0 0 4px"><strong>Relatório:</strong> ${fonte.titulo}</p>
    <p style="margin:0 0 4px"><strong>Período:</strong> ${periodoLabel}</p>
    <p style="margin:0 0 12px"><strong>Registros:</strong> ${rows?.length ?? 0}</p>
    <p style="color:#555">O arquivo ${isPdf ? "PDF" : "CSV"} está em anexo.</p>
    <hr/><small>radarimobtech — relatórios automáticos</small>
  </div>`;

  await enviarEmail(destinatarios, `[Relatório] ${cfg.nome} — ${periodoLabel}`, html, filename, content);

  await sb.from("relatorios_agendados_execucoes").insert({
    relatorio_id: cfg.id,
    imobiliaria_id: cfg.imobiliaria_id,
    status: "sucesso",
    formato: cfg.formato,
    total_registros: rows?.length ?? 0,
    destinatarios,
  });

  await sb
    .from("relatorios_agendados")
    .update({ ultima_execucao: new Date().toISOString(), proxima_execucao: proximaExecucao(cfg).toISOString() })
    .eq("id", cfg.id);

  return { total: rows?.length ?? 0, destinatarios };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  try {
    const body = await req.json().catch(() => ({}));
    const relatorioId = typeof body?.relatorio_id === "string" ? body.relatorio_id : null;

    if (relatorioId) {
      if (!UUID_RE.test(relatorioId)) {
        return new Response(JSON.stringify({ error: "relatorio_id inválido" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // execução manual: exige usuário autenticado dono do agendamento
      const authHeader = req.headers.get("Authorization") ?? "";
      const token = authHeader.replace(/^Bearer\s+/i, "");
      const { data: userData } = await sb.auth.getUser(token);
      const user = userData?.user;
      if (!user) {
        return new Response(JSON.stringify({ error: "Não autorizado" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: cfg } = await sb.from("relatorios_agendados").select("*").eq("id", relatorioId).maybeSingle();
      if (!cfg || cfg.imobiliaria_id !== user.id) {
        return new Response(JSON.stringify({ error: "Relatório não encontrado" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      try {
        const r = await processarUm(sb, cfg);
        return new Response(JSON.stringify({ ok: true, ...r }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await sb.from("relatorios_agendados_execucoes").insert({
          relatorio_id: cfg.id, imobiliaria_id: cfg.imobiliaria_id, status: "erro", formato: cfg.formato, erro: msg,
        });
        return new Response(JSON.stringify({ error: msg }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // execução automática (cron): todos os agendamentos vencidos
    const { data: pendentes } = await sb
      .from("relatorios_agendados")
      .select("*")
      .eq("ativo", true)
      .lte("proxima_execucao", new Date().toISOString())
      .limit(50);

    let ok = 0, falhas = 0;
    for (const cfg of pendentes ?? []) {
      try {
        await processarUm(sb, cfg);
        ok++;
      } catch (e) {
        falhas++;
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`relatorio ${cfg.id}: ${msg}`);
        await sb.from("relatorios_agendados_execucoes").insert({
          relatorio_id: cfg.id, imobiliaria_id: cfg.imobiliaria_id, status: "erro", formato: cfg.formato, erro: msg,
        });
        await sb.from("relatorios_agendados").update({
          ultima_execucao: new Date().toISOString(),
          proxima_execucao: proximaExecucao(cfg).toISOString(),
        }).eq("id", cfg.id);
      }
    }
    return new Response(JSON.stringify({ processados: (pendentes ?? []).length, ok, falhas }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
