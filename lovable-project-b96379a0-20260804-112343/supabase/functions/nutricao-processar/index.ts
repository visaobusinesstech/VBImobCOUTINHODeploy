import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Etapa {
  id: string;
  ordem: number;
  dias_apos: number;
  canal: string;
  titulo: string;
  mensagem: string;
  ativo: boolean;
  ab_ativo?: boolean | null;
  ab_titulo_b?: string | null;
  ab_mensagem_b?: string | null;
  ab_split?: number | null;
  ab_auto_escolher?: boolean | null;
  ab_min_envios?: number | null;
  ab_vencedor?: string | null;
}

const PERFIL_MATCHERS: Record<string, RegExp> = {
  comprador: /(compra|comprar|venda|aquisic)/i,
  locatario: /(loca|alug|rent)/i,
  investidor: /(investi|renda|rentab)/i,
  moradia: /(moradia|residenc|morar|propria|própria)/i,
  proprietario: /(propriet|captac|captaç|anunciar)/i,
};

const norm = (v: unknown) =>
  String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

function combinaSegmentacao(lead: Record<string, unknown>, perfis: string[], motivos: string[]) {
  if (perfis.length > 0) {
    const alvo = `${lead.tipo_operacao ?? ""} ${lead.finalidade ?? ""} ${lead.interesse ?? ""}`;
    const ok = perfis.some((p) => {
      const re = PERFIL_MATCHERS[p];
      return re ? re.test(alvo) : true;
    });
    if (!ok) return false;
  }
  if (motivos.length > 0 && !motivos.map(norm).includes(norm(lead.motivo_perda))) return false;
  return true;
}

function aplicarVariaveis(texto: string, ctx: Record<string, string | null | undefined>) {
  return texto
    .replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key) => (ctx[key] ?? "").toString())
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +([,.!?;:])/g, "$1")
    .trimStart();
}

/** Variáveis que não podem sair vazias/inválidas na mensagem enviada. */
const VARIAVEIS_ESSENCIAIS = [
  "imovel_link",
  "imovel_endereco",
  "imovel_titulo",
  "imovel_resumo",
  "imovel_preco",
];
const VARIAVEIS_URL = ["imovel_link"];

function urlValida(valor: string) {
  try {
    const u = new URL(valor.trim());
    return (u.protocol === "http:" || u.protocol === "https:") && u.hostname.includes(".");
  } catch {
    return false;
  }
}

/** Retorna as variáveis essenciais usadas no texto que estão vazias ou inconsistentes. */
function essenciaisPendentes(texto: string, ctx: Record<string, string | null | undefined>) {
  const usadas = [...texto.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]);
  return [...new Set(usadas)].filter((k) => {
    if (!VARIAVEIS_ESSENCIAIS.includes(k)) return false;
    const valor = (ctx[k] ?? "").toString().trim();
    if (!valor) return true;
    return VARIAVEIS_URL.includes(k) && !urlValida(valor);
  });
}

const brl = (v: unknown) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return "";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
};

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

function saudacaoAgora(d = new Date()) {
  const h = Number(
    new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" }).format(d),
  );
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function melhorImovel(lead: Record<string, unknown> | null, imoveis: Record<string, unknown>[]) {
  if (!lead || imoveis.length === 0) return null;
  const alvoTipo = norm(lead.tipo_imovel_interesse);
  const alvoBairro = norm(lead.bairro_interesse);
  const teto = Number(lead.valor_maximo ?? lead.valor ?? 0);
  const quartos = Number(lead.quartos_minimo ?? 0);

  let melhor: Record<string, unknown> | null = null;
  let melhorScore = -1;
  for (const im of imoveis) {
    let score = 0;
    if (alvoTipo && norm(im.tipo).includes(alvoTipo)) score += 3;
    if (alvoBairro && norm(im.bairro).includes(alvoBairro)) score += 3;
    const preco = Number(im.preco ?? 0);
    if (teto > 0 && preco > 0 && preco <= teto) score += 2;
    if (quartos > 0 && Number(im.quartos ?? 0) >= quartos) score += 1;
    if (score > melhorScore) {
      melhorScore = score;
      melhor = im;
    }
  }
  return melhorScore > 0 ? melhor : null;
}

function montarContexto(
  insc: { nome?: string | null; telefone?: string | null; email?: string | null },
  lead: Record<string, unknown> | null,
  imovel: Record<string, unknown> | null,
  config: Record<string, unknown> | null,
  corretor: string,
  siteBase: string,
): Record<string, string> {
  const nome = str(insc.nome ?? lead?.nome);
  const area = Number(imovel?.area);
  const areaTxt = Number.isFinite(area) && area > 0 ? `${area} m²` : "";
  const resumo = [
    str(imovel?.tipo),
    imovel?.quartos ? `${imovel.quartos} quartos` : "",
    areaTxt,
    str(imovel?.bairro),
    brl(imovel?.preco),
  ].filter(Boolean).join(" • ");

  return {
    nome,
    primeiro_nome: nome.split(" ")[0] ?? "",
    telefone: str(insc.telefone ?? lead?.telefone),
    email: str(insc.email ?? lead?.email),
    interesse: str(lead?.interesse),
    tipo_operacao: str(lead?.tipo_operacao),
    tipo_imovel_interesse: str(lead?.tipo_imovel_interesse),
    bairro_interesse: str(lead?.bairro_interesse),
    valor_maximo: brl(lead?.valor_maximo) || brl(lead?.valor),
    quartos_minimo: str(lead?.quartos_minimo),
    vagas_minimo: str(lead?.vagas_minimo),
    urgencia: str(lead?.urgencia),
    estagio: str(lead?.estagio),
    corretor,
    imovel_titulo: str(imovel?.titulo),
    imovel_tipo: str(imovel?.tipo),
    imovel_operacao: str(imovel?.operacao),
    imovel_preco: brl(imovel?.preco),
    imovel_bairro: str(imovel?.bairro),
    imovel_cidade: str(imovel?.cidade),
    imovel_endereco: str(imovel?.endereco),
    imovel_quartos: str(imovel?.quartos),
    imovel_suites: str(imovel?.suites),
    imovel_banheiros: str(imovel?.banheiros),
    imovel_vagas: str(imovel?.vagas),
    imovel_area: areaTxt,
    imovel_condominio: brl(imovel?.valor_condominio),
    imovel_iptu: brl(imovel?.valor_iptu),
    imovel_resumo: resumo,
    imovel_link: imovel?.id ? `${siteBase}/imovel/${imovel.id}` : str(imovel?.url_anuncio),
    imobiliaria: str(config?.nome_empresa),
    imobiliaria_telefone: str(config?.telefone),
    imobiliaria_email: str(config?.email),
    creci: str(config?.creci),
    hoje: new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }),
    saudacao: saudacaoAgora(),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch (_) {
      body = {};
    }
    const imobiliariaFiltro = typeof body.imobiliaria_id === "string" && UUID_RE.test(body.imobiliaria_id)
      ? body.imobiliaria_id
      : null;

    const siteBase = Deno.env.get("SITE_URL") ?? "https://radarimobtech.shop";

    const imoveisPorImob = new Map<string, Record<string, unknown>[]>();
    const configPorImob = new Map<string, Record<string, unknown> | null>();

    const carteiraCache = async (imobId: string) => {
      if (!imoveisPorImob.has(imobId)) {
        const { data } = await supabase
          .from("imoveis")
          .select(
            "id, titulo, tipo, operacao, preco, endereco, cidade, bairro, quartos, suites, banheiros, vagas, area, valor_condominio, valor_iptu, url_anuncio, status",
          )
          .eq("imobiliaria_id", imobId)
          .limit(300);
        const ativos = (data ?? []).filter(
          (i: Record<string, unknown>) => !i.status || norm(i.status).startsWith("dispon"),
        );
        imoveisPorImob.set(imobId, ativos as Record<string, unknown>[]);
      }
      return imoveisPorImob.get(imobId)!;
    };

    const configCache = async (imobId: string) => {
      if (!configPorImob.has(imobId)) {
        const { data } = await supabase
          .from("imobiliaria_config")
          .select("nome_empresa, telefone, email, creci")
          .eq("user_id", imobId)
          .maybeSingle();
        configPorImob.set(imobId, (data as Record<string, unknown>) ?? null);
      }
      return configPorImob.get(imobId) ?? null;
    };

    const agora = new Date();
    const resumo = { inscritos: 0, envios: 0, encerrados: 0, concluidos: 0 };

    let fluxosQuery = supabase
      .from("nutricao_fluxos")
      .select("id, imobiliaria_id, nome, publico_alvo, dias_inatividade, canal, encerrar_ao_responder, segmento_estagios, segmento_perfis, segmento_motivos_perda")
      .eq("ativo", true);
    if (imobiliariaFiltro) fluxosQuery = fluxosQuery.eq("imobiliaria_id", imobiliariaFiltro);
    const { data: fluxos, error: fluxosErr } = await fluxosQuery;
    if (fluxosErr) throw fluxosErr;

    for (const fluxo of fluxos ?? []) {
      const { data: etapasData } = await supabase
        .from("nutricao_etapas")
        .select(
          "id, ordem, dias_apos, canal, titulo, mensagem, ativo, ab_ativo, ab_titulo_b, ab_mensagem_b, ab_split, ab_auto_escolher, ab_min_envios, ab_vencedor",
        )
        .eq("fluxo_id", fluxo.id)
        .eq("ativo", true)
        .order("ordem");
      const etapas = (etapasData ?? []) as Etapa[];
      if (etapas.length === 0) continue;

      // 0) TESTE A/B — decidir vencedor automaticamente quando houver amostra suficiente
      for (const etapa of etapas) {
        if (!etapa.ab_ativo || etapa.ab_auto_escolher === false || etapa.ab_vencedor) continue;
        const minEnvios = Number(etapa.ab_min_envios ?? 20);

        const { data: enviosEtapa } = await supabase
          .from("nutricao_envios")
          .select("id, status, variante")
          .eq("etapa_id", etapa.id)
          .limit(2000);
        const lista = (enviosEtapa ?? []) as { id: string; status: string; variante: string | null }[];
        const grupo = (v: string) => lista.filter((e) => (e.variante ?? "A") === v);
        const enviadosA = grupo("A").filter((e) => e.status === "enviado");
        const enviadosB = grupo("B").filter((e) => e.status === "enviado");
        if (enviadosA.length < minEnvios || enviadosB.length < minEnvios) continue;

        const { data: eventosEtapa } = await supabase
          .from("nutricao_eventos")
          .select("envio_id, tipo")
          .eq("etapa_id", etapa.id)
          .limit(4000);
        const eventos = (eventosEtapa ?? []) as { envio_id: string | null; tipo: string }[];
        const score = (ids: Set<string>, total: number) => {
          const evs = eventos.filter((e) => e.envio_id && ids.has(e.envio_id));
          const resposta = evs.filter((e) => e.tipo === "resposta").length;
          const conv = evs.filter((e) => e.tipo === "agendamento" || e.tipo === "fechamento").length;
          return total > 0 ? ((resposta + conv) / total) * 100 : 0;
        };
        const sA = score(new Set(enviadosA.map((e) => e.id)), enviadosA.length);
        const sB = score(new Set(enviadosB.map((e) => e.id)), enviadosB.length);
        if (sA === sB) continue;

        const vencedor = sA > sB ? "A" : "B";
        const patch: Record<string, unknown> = {
          ab_ativo: false,
          ab_vencedor: vencedor,
          ab_decidido_em: agora.toISOString(),
        };
        if (vencedor === "B") {
          patch.titulo = etapa.ab_titulo_b || etapa.titulo;
          patch.mensagem = etapa.ab_mensagem_b || etapa.mensagem;
          etapa.titulo = String(patch.titulo);
          etapa.mensagem = String(patch.mensagem);
        }
        etapa.ab_ativo = false;
        etapa.ab_vencedor = vencedor;
        await supabase.from("nutricao_etapas").update(patch).eq("id", etapa.id);
        await supabase.from("notifications").insert({
          user_id: fluxo.imobiliaria_id,
          title: "🧪 Teste A/B concluído",
          description: `Etapa "${etapa.titulo}" do fluxo "${fluxo.nome}": variante ${vencedor} venceu (${Math.max(sA, sB).toFixed(1)}% vs ${Math.min(sA, sB).toFixed(1)}%) e virou a mensagem oficial.`,
        });
      }

      // 1) INSCRIÇÃO AUTOMÁTICA de leads elegíveis
      const corte = new Date(agora);
      corte.setDate(corte.getDate() - (fluxo.dias_inatividade ?? 30));

      const segEstagios: string[] = (fluxo as any).segmento_estagios ?? [];
      const segPerfis: string[] = (fluxo as any).segmento_perfis ?? [];
      const segMotivos: string[] = (fluxo as any).segmento_motivos_perda ?? [];

      let leadsQuery = supabase
        .from("leads")
        .select("id, nome, telefone, email, estagio, updated_at, tipo_operacao, finalidade, interesse, motivo_perda")
        .eq("imobiliaria_id", fluxo.imobiliaria_id)
        .lte("updated_at", corte.toISOString())
        .limit(200);

      if (segEstagios.length > 0) {
        leadsQuery = leadsQuery.in("estagio", segEstagios);
      } else if (fluxo.publico_alvo === "lead_sem_resposta") {
        leadsQuery = leadsQuery.in("estagio", ["novo", "contato", "contatado"]);
      } else if (segMotivos.length > 0) {
        leadsQuery = leadsQuery.not("estagio", "in", '("fechado")');
      } else {
        leadsQuery = leadsQuery.not("estagio", "in", '("fechado","perdido")');
      }

      const { data: leadsBrutos } = await leadsQuery;
      const leads = (leadsBrutos ?? []).filter((l: Record<string, unknown>) =>
        combinaSegmentacao(l, segPerfis, segMotivos));

      const { data: jaInscritos } = await supabase
        .from("nutricao_inscricoes")
        .select("lead_id")
        .eq("fluxo_id", fluxo.id);
      const inscritosSet = new Set((jaInscritos ?? []).map((i: { lead_id: string | null }) => i.lead_id));

      const novos = (leads ?? [])
        .filter((l: { id: string; telefone?: string | null; email?: string | null }) =>
          !inscritosSet.has(l.id) && (l.telefone || l.email))
        .map((l: { id: string; nome: string; telefone?: string | null; email?: string | null }) => ({
          imobiliaria_id: fluxo.imobiliaria_id,
          fluxo_id: fluxo.id,
          lead_id: l.id,
          nome: l.nome,
          telefone: l.telefone ?? null,
          email: l.email ?? null,
          status: "ativa",
          etapa_atual: 0,
          proxima_execucao: new Date(agora.getTime() + etapas[0].dias_apos * 86400000).toISOString(),
        }));

      if (novos.length > 0) {
        const { error: insErr } = await supabase.from("nutricao_inscricoes").insert(novos);
        if (!insErr) resumo.inscritos += novos.length;
      }

      // 2) PROCESSAR inscrições vencidas
      const { data: pendentes } = await supabase
        .from("nutricao_inscricoes")
        .select("*")
        .eq("fluxo_id", fluxo.id)
        .eq("status", "ativa")
        .lte("proxima_execucao", agora.toISOString())
        .limit(300);

      for (const insc of pendentes ?? []) {
        // Encerrar se o lead respondeu / avançou desde a inscrição
        if (fluxo.encerrar_ao_responder && insc.lead_id) {
          const { data: lead } = await supabase
            .from("leads")
            .select("updated_at, estagio")
            .eq("id", insc.lead_id)
            .maybeSingle();
          const encerraEstagios = segMotivos.length > 0 ? ["fechado"] : ["fechado", "perdido"];
          const respondeu = lead && (
            encerraEstagios.includes((lead.estagio ?? "").toLowerCase()) ||
            new Date(lead.updated_at).getTime() > new Date(insc.created_at).getTime() + 60000
          );
          if (respondeu) {
            await supabase
              .from("nutricao_inscricoes")
              .update({ status: "encerrada", motivo_encerramento: "Lead voltou a interagir" })
              .eq("id", insc.id);
            resumo.encerrados++;
            continue;
          }
        }

        const etapa = etapas[insc.etapa_atual];
        if (!etapa) {
          await supabase
            .from("nutricao_inscricoes")
            .update({ status: "concluida", motivo_encerramento: "Fluxo finalizado" })
            .eq("id", insc.id);
          resumo.concluidos++;
          continue;
        }

        const canal = etapa.canal === "heranca" ? fluxo.canal : etapa.canal;
        const destino = canal === "email" ? insc.email : insc.telefone;

        let leadCtx: Record<string, unknown> | null = null;
        let corretorNome = "";
        if (insc.lead_id) {
          const { data: leadFull } = await supabase
            .from("leads")
            .select(
              "id, nome, telefone, email, interesse, tipo_operacao, tipo_imovel_interesse, bairro_interesse, valor, valor_maximo, quartos_minimo, vagas_minimo, urgencia, estagio, corretor_id",
            )
            .eq("id", insc.lead_id)
            .maybeSingle();
          leadCtx = (leadFull as Record<string, unknown>) ?? null;
          if (leadCtx?.corretor_id) {
            const { data: c } = await supabase
              .from("corretores")
              .select("nome")
              .eq("id", leadCtx.corretor_id as string)
              .maybeSingle();
            corretorNome = str(c?.nome);
          }
        }

        const carteira = await carteiraCache(fluxo.imobiliaria_id);
        const imovelCtx = melhorImovel(leadCtx, carteira);
        const configCtx = await configCache(fluxo.imobiliaria_id);
        const ctx = montarContexto(insc, leadCtx, imovelCtx, configCtx, corretorNome, siteBase);

        const usaAB = !!etapa.ab_ativo && !!(etapa.ab_mensagem_b ?? "").trim();
        const splitA = Math.min(95, Math.max(5, Number(etapa.ab_split ?? 50)));
        const variante = usaAB ? (Math.random() * 100 < splitA ? "A" : "B") : "A";
        const tituloBase = variante === "B" ? (etapa.ab_titulo_b || etapa.titulo) : etapa.titulo;
        const mensagemBase = variante === "B" ? (etapa.ab_mensagem_b || etapa.mensagem) : etapa.mensagem;

        const pendentes = essenciaisPendentes(`${tituloBase} ${mensagemBase}`, ctx);
        const bloqueado = pendentes.length > 0;

        await supabase.from("nutricao_envios").insert({
          imobiliaria_id: fluxo.imobiliaria_id,
          inscricao_id: insc.id,
          etapa_id: etapa.id,
          lead_id: insc.lead_id,
          canal,
          destino: destino ?? null,
          variante: usaAB ? variante : null,
          titulo: aplicarVariaveis(tituloBase, ctx),
          mensagem: aplicarVariaveis(mensagemBase, ctx),
          status: !destino || bloqueado ? "falha" : "pendente",
          erro: !destino
            ? "Contato sem telefone/e-mail para o canal escolhido"
            : bloqueado
              ? `Envio bloqueado: variáveis essenciais vazias ou inválidas (${pendentes.join(", ")})`
              : null,
        });
        resumo.envios++;

        const proximaEtapa = etapas[insc.etapa_atual + 1];
        await supabase
          .from("nutricao_inscricoes")
          .update({
            etapa_atual: insc.etapa_atual + 1,
            ultima_execucao: agora.toISOString(),
            status: proximaEtapa ? "ativa" : "concluida",
            motivo_encerramento: proximaEtapa ? null : "Fluxo finalizado",
            proxima_execucao: proximaEtapa
              ? new Date(agora.getTime() + proximaEtapa.dias_apos * 86400000).toISOString()
              : agora.toISOString(),
          })
          .eq("id", insc.id);
        if (!proximaEtapa) resumo.concluidos++;

        await supabase.from("notifications").insert({
          user_id: fluxo.imobiliaria_id,
          title: "🌱 Nutrição de leads",
          description: `${insc.nome ?? "Contato"} — etapa "${etapa.titulo}" do fluxo "${fluxo.nome}" pronta para envio.`,
        });
      }
    }

    return new Response(JSON.stringify({ success: true, ...resumo }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("nutricao-processar error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
