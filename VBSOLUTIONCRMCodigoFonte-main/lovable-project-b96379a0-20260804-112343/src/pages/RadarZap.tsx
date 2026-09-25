import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Radar, MessageSquare, Users, ExternalLink, Sparkles, Search, Trash2, Clock, BarChart3, Merge, Gauge, Bell, ShieldCheck, RefreshCw, Wifi, Upload, Home, History } from "lucide-react";
import RadarZapAgendamentoPanel from "@/components/radarzap/RadarZapAgendamentoPanel";
import AprovacaoPendentesPanel from "@/components/radarzap/AprovacaoPendentesPanel";
import RadarZapMetricasPanel from "@/components/radarzap/RadarZapMetricasPanel";
import DedupRevisaoPanel from "@/components/radarzap/DedupRevisaoPanel";
import ScoreAuditoriaPanel from "@/components/radarzap/ScoreAuditoriaPanel";
import RadarZapAlertasMetricasPanel from "@/components/radarzap/RadarZapAlertasMetricasPanel";
import AuditoriaAprovacoesPanel from "@/components/radarzap/AuditoriaAprovacoesPanel";
import DedupLogPanel from "@/components/radarzap/DedupLogPanel";
import ConexaoEvolutionPanel from "@/components/radarzap/ConexaoEvolutionPanel";
import ImportarGruposPanel from "@/components/radarzap/ImportarGruposPanel";
import ImoveisCaptadosPanel from "@/components/radarzap/ImoveisCaptadosPanel";
import BuscaVaziaDiagnostico from "@/components/radarzap/BuscaVaziaDiagnostico";
import ExecucaoErrosPanel from "@/components/radarzap/ExecucaoErrosPanel";
import DescartadosDedupPanel from "@/components/radarzap/DescartadosDedupPanel";
import HistoricoDescobertaPanel from "@/components/radarzap/HistoricoDescobertaPanel";
import ExportarPorRunIdPanel from "@/components/radarzap/ExportarPorRunIdPanel";
import ProgressoExecucoesPanel from "@/components/radarzap/ProgressoExecucoesPanel";
import AlertasRealtimeConfigPopover from "@/components/radarzap/AlertasRealtimeConfigPopover";
import SincronizacaoCrmPanel from "@/components/radarzap/SincronizacaoCrmPanel";
import { useRadarZapAlertas } from "@/hooks/useRadarZapAlertas";
import ExplicacaoScorePanel from "@/components/radarzap/ExplicacaoScorePanel";
import PreviewConsultasPanel from "@/components/radarzap/PreviewConsultasPanel";
import NormalizacaoTokensPanel from "@/components/radarzap/NormalizacaoTokensPanel";
import ImportarAlvosDialog from "@/components/radarzap/ImportarAlvosDialog";
import CorrigirLoteDialog from "@/components/radarzap/CorrigirLoteDialog";
import SimuladorScorePanel from "@/components/radarzap/SimuladorScorePanel";
import { Activity, Lightbulb, FlaskConical } from "lucide-react";

const CONDOMINIOS_BSB_PRESET = [
  "Alphaville Brasília", "Jardins Mangueiral", "Reserva do Paranoá", "Setor Noroeste",
  "Riacho Fundo II", "Vicente Pires", "Park Sul", "Sudoeste", "Águas Claras Norte",
  "Águas Claras Sul", "Jardim Botânico", "Lago Sul QI", "Lago Norte QI", "Guará Park",
  "Life Park", "Reserva Aldeia do Bosque", "Grand Park Águas Claras", "Alto da Boa Vista Sobradinho",
];

const CEP_MAX = 30;
const CONDO_MIN = 3;
const CONDO_MAX = 80;
const CONDO_REGEX = /^[\p{L}\p{N}\s\-'.&/º°ª]+$/u;

type ItemDiag = { raw: string; ok: boolean; motivo?: string; duplicado?: boolean };

type ValidacaoAlvos = {
  ceps_validos: string[];       // já formatados "CEP 70000-000"
  ceps_invalidos: string[];
  ceps_duplicados: string[];
  ceps_itens: ItemDiag[];       // diagnóstico por item na ordem digitada
  condos_validos: string[];
  condos_invalidos: string[];
  condos_duplicados: string[];
  condos_itens: ItemDiag[];
  cidades: string[];
  alvos: string[];              // deduplicado final
  erros: string[];              // mensagens exibíveis
};

function parseCsv(s: string): string[] {
  return s.split(",").map(x => x.trim()).filter(Boolean);
}

function motivoCep(raw: string): string | null {
  if (raw.length > CEP_MAX) return `Texto muito longo (máx ${CEP_MAX} caracteres)`;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 0) return "Informe apenas números ou formato 00000-000";
  if (digits.length < 8) return `Faltam ${8 - digits.length} dígito(s) — CEP tem 8 números`;
  if (digits.length > 8) return `Sobram ${digits.length - 8} dígito(s) — CEP tem 8 números`;
  return null;
}

function motivoCondo(raw: string): string | null {
  if (raw.length < CONDO_MIN) return `Muito curto (mín ${CONDO_MIN} caracteres)`;
  if (raw.length > CONDO_MAX) return `Muito longo (máx ${CONDO_MAX} caracteres)`;
  if (!CONDO_REGEX.test(raw)) return "Contém símbolos não permitidos (use letras, números, espaço e - ' . & /)";
  return null;
}

function validarAlvos(cidadesCsv: string, cepsCsv: string, condominiosCsv: string): ValidacaoAlvos {
  const erros: string[] = [];

  // Cidades: aceita como está (dedup case-insensitive)
  const cidadesSeen = new Set<string>();
  const cidades = parseCsv(cidadesCsv).filter(c => {
    const k = c.toLowerCase();
    if (cidadesSeen.has(k)) return false;
    cidadesSeen.add(k);
    return true;
  });

  // CEPs
  const ceps_validos: string[] = [];
  const ceps_invalidos: string[] = [];
  const ceps_duplicados: string[] = [];
  const ceps_itens: ItemDiag[] = [];
  const cepSeen = new Set<string>();
  for (const raw of parseCsv(cepsCsv)) {
    const motivo = motivoCep(raw);
    if (motivo) {
      ceps_invalidos.push(raw);
      ceps_itens.push({ raw, ok: false, motivo });
      continue;
    }
    const digits = raw.replace(/\D/g, "");
    const fmt = `CEP ${digits.slice(0, 5)}-${digits.slice(5)}`;
    if (cepSeen.has(digits)) {
      ceps_duplicados.push(fmt);
      ceps_itens.push({ raw, ok: false, duplicado: true, motivo: "CEP repetido" });
      continue;
    }
    cepSeen.add(digits);
    ceps_validos.push(fmt);
    ceps_itens.push({ raw: fmt, ok: true });
  }
  if (ceps_invalidos.length) erros.push(`CEPs inválidos (formato 00000-000): ${ceps_invalidos.join(", ")}`);
  if (ceps_duplicados.length) erros.push(`CEPs duplicados ignorados: ${ceps_duplicados.join(", ")}`);

  // Condomínios
  const condos_validos: string[] = [];
  const condos_invalidos: string[] = [];
  const condos_duplicados: string[] = [];
  const condos_itens: ItemDiag[] = [];
  const condoSeen = new Set<string>();
  for (const raw of parseCsv(condominiosCsv)) {
    const motivo = motivoCondo(raw);
    if (motivo) {
      condos_invalidos.push(raw);
      condos_itens.push({ raw, ok: false, motivo });
      continue;
    }
    const k = raw.toLowerCase();
    if (condoSeen.has(k)) {
      condos_duplicados.push(raw);
      condos_itens.push({ raw, ok: false, duplicado: true, motivo: "Condomínio repetido" });
      continue;
    }
    condoSeen.add(k);
    condos_validos.push(raw);
    condos_itens.push({ raw, ok: true });
  }
  if (condos_invalidos.length) erros.push(`Condomínios inválidos (3–80 caracteres, sem símbolos estranhos): ${condos_invalidos.join(", ")}`);
  if (condos_duplicados.length) erros.push(`Condomínios duplicados ignorados: ${condos_duplicados.join(", ")}`);

  // Merge dedup final (cidade x cep x condo)
  const alvosSeen = new Set<string>();
  const alvos = [...cidades, ...ceps_validos, ...condos_validos].filter(v => {
    const k = v.toLowerCase();
    if (alvosSeen.has(k)) return false;
    alvosSeen.add(k);
    return true;
  });

  return {
    ceps_validos, ceps_invalidos, ceps_duplicados, ceps_itens,
    condos_validos, condos_invalidos, condos_duplicados, condos_itens,
    cidades, alvos, erros,
  };
}

// Normaliza o CSV de CEPs ao salvar: remove espaços/caracteres não numéricos,
// preenche zeros à esquerda quando faltar (ex.: "1310100" -> "01310-100"),
// formata como "00000-000" e remove duplicados. Mantém tokens irrecuperáveis
// como estão para o validador destacar o erro.
function normalizarCepsCsv(csv: string): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of csv.split(",").map(s => s.trim()).filter(Boolean)) {
    const digits = raw.replace(/\D/g, "");
    if (digits.length >= 1 && digits.length <= 8) {
      const padded = digits.padStart(8, "0");
      if (seen.has(padded)) continue;
      seen.add(padded);
      out.push(`${padded.slice(0, 5)}-${padded.slice(5)}`);
    } else {
      // >8 dígitos ou 0 dígitos -> mantém raw para o validador reportar
      out.push(raw);
    }
  }
  return out.join(", ");
}





type Grupo = {
  id: string;
  invite_url: string;
  nome: string | null;
  descricao: string | null;
  categoria: string | null;
  cidade: string | null;
  bairro: string | null;
  status: string;
  origem: string;
  total_mensagens: number;
  total_leads: number;
  created_at: string;
};

type Mensagem = {
  id: string;
  grupo_id: string | null;
  texto: string;
  intencao: string | null;
  score_intencao: number;
  tem_imovel: boolean;
  extraido: any;
  created_at: string;
};

type Lead = {
  id: string;
  grupo_id: string | null;
  tipo_imovel: string | null;
  operacao: string | null;
  bairro: string | null;
  cidade: string | null;
  preco: number | null;
  contato: string | null;
  proprietario_nome: string | null;
  resumo: string | null;
  status: string;
  created_at: string;
  score?: number | null;
  score_detalhes?: Record<string, number> | null;
  is_principal?: boolean | null;
  dedup_group_id?: string | null;
};

const fmtBRL = (n: number | null) => n == null ? "—" :
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export default function RadarZap() {
  const { user } = useAuth();
  const [tab, setTab] = useState("grupos");
  useRadarZapAlertas();
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [buscando, setBuscando] = useState(false);
  const [analisando, setAnalisando] = useState(false);
  const [ultimaBusca, setUltimaBusca] = useState<any | null>(null);
  const [reexecutandoErros, setReexecutandoErros] = useState(false);

  // Filtros e seleção da lista de grupos
  const [filtroOrigem, setFiltroOrigem] = useState<string>("todos"); // todos | busca | agregadores | agregador:<host>
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todas");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [reprocessandoSel, setReprocessandoSel] = useState(false);


  // Descoberta
  const [termo, setTermo] = useState("");
  const [cidadesCsv, setCidadesCsv] = useState("Brasília, Águas Claras, Taguatinga");
  const [cepsCsv, setCepsCsv] = useState("");
  const [condominiosCsv, setCondominiosCsv] = useState("");
  const validacaoAlvos = useMemo(
    () => validarAlvos(cidadesCsv, cepsCsv, condominiosCsv),
    [cidadesCsv, cepsCsv, condominiosCsv],
  );

  // Análise
  const [textoMsg, setTextoMsg] = useState("");
  const [grupoSel, setGrupoSel] = useState<string>("_none");
  const [contatoMsg, setContatoMsg] = useState("");

  // Reprocessamento manual
  const [reprocId, setReprocId] = useState("");
  const [reprocForce, setReprocForce] = useState(false);
  const [reprocessando, setReprocessando] = useState<string | null>(null);

  // Filtros da aba Histórico (mensagens)
  const [msgBusca, setMsgBusca] = useState("");
  const [msgIntencao, setMsgIntencao] = useState<string>("_todas");
  const [msgStatus, setMsgStatus] = useState<string>("_todos");

  const reprocessarMensagem = async (mensagemId: string, opts?: { force?: boolean }) => {
    if (!mensagemId) { toast.error("Informe o mensagem_id"); return; }
    setReprocessando(mensagemId);
    try {
      const { data, error } = await supabase.functions.invoke("radarzap-reprocessar-mensagem", {
        body: { mensagem_id: mensagemId, force: !!opts?.force },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      const op = (data as { lead_op?: string })?.lead_op ?? "skipped";
      const map: Record<string, string> = { created: "lead criado", updated: "lead atualizado", skipped: "sem lead (intenção fora do escopo)" };
      toast.success(`Reprocessado — ${map[op] ?? op}`);
      await carregar();
    } catch (e) {
      toast.error("Falha ao reprocessar: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setReprocessando(null);
    }
  };

  const carregar = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [g, m, l] = await Promise.all([
      supabase.from("radarzap_grupos").select("*").order("created_at", { ascending: false }).limit(300),
      supabase.from("radarzap_mensagens").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("radarzap_leads").select("*").order("created_at", { ascending: false }).limit(100),
    ]);
    if (g.error) toast.error("Erro grupos: " + g.error.message);
    else setGrupos((g.data ?? []) as Grupo[]);
    if (!m.error) setMensagens((m.data ?? []) as Mensagem[]);
    if (!l.error) setLeads((l.data ?? []) as Lead[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { carregar(); }, [carregar]);

  const descobrirGrupos = async (opts?: { somenteAgregadores?: boolean }) => {
    const somenteAgregadores = opts?.somenteAgregadores === true;
    setBuscando(true);
    try {
      // Normaliza CEPs antes de validar/enviar (remove espaços, ajusta zeros à esquerda, formata 00000-000)
      const cepsNormalizados = normalizarCepsCsv(cepsCsv);
      if (cepsNormalizados !== cepsCsv) setCepsCsv(cepsNormalizados);
      const v = validarAlvos(cidadesCsv, cepsNormalizados, condominiosCsv);

      const cidades = v.alvos;
      if (v.erros.length) {
        toast.warning(v.erros.join(" • "));
      }
      if (!cidades.length) {
        toast.error("Informe ao menos uma cidade, CEP ou condomínio válidos.");
        return;
      }
      const { data, error } = await supabase.functions.invoke("radarzap-descobrir-grupos", {
        body: {
          cidades,
          termo: termo.trim() || undefined,
          ...(somenteAgregadores ? { somente_agregadores: true } : {}),
        },
      });
      if (error) throw error;
      setUltimaBusca({ ...data, _cidades: cidades, _termo: termo.trim() });
      const prefixo = somenteAgregadores ? "Somente agregadores" : "Descoberta";
      toast.success(`${prefixo}: ${data?.encontrados ?? 0} grupos (${data?.inseridos ?? 0} novos) em ${data?.total_ms ?? "?"}ms`);
      console.group(`[RadarZAP] run ${data?.run_id ?? "-"}${somenteAgregadores ? " (somente agregadores)" : ""}`);
      console.log("Chave Firecrawl:", data?.firecrawl_key_kind);
      console.log("Queries:", data?.queries, "| itens crus:", data?.total_raw_items, "| válidos:", data?.total_invites_validos);
      if (data?.telemetria?.length) console.table(data.telemetria.map((t: any) => ({
        cidade: t.cidade, termo: t.termo, http: t.status, ms: t.duration_ms,
        raw: t.raw_items, validos: t.invites_validos, novos: t.invites_novos,
        shape: t.response_shape?.join(","), erro: t.error ?? "",
      })));
      if (data?.erros?.length) console.warn("Erros:", data.erros);
      console.groupEnd();
      carregar();
    } catch (e: any) {
      toast.error("Falha na busca: " + (e?.message ?? e));
    } finally {
      setBuscando(false);
    }
  };


  const reexecutarErros = async (
    queries: Array<{ cidade: string; termo: string; cat?: string }>,
  ) => {
    if (!queries.length) return;
    const parentRunId = ultimaBusca?.run_id ?? null;
    const parentCidades = ultimaBusca?._cidades ?? validarAlvos(cidadesCsv, cepsCsv, condominiosCsv).alvos;
    const parentTermo = ultimaBusca?._termo ?? termo.trim();
    setReexecutandoErros(true);
    try {
      const { data, error } = await supabase.functions.invoke("radarzap-descobrir-grupos", {
        body: {
          cidades: parentCidades,
          termo: parentTermo || undefined,
          retry_of_run_id: parentRunId,
          retry_queries: queries,
        },
      });
      if (error) throw error;
      setUltimaBusca({ ...data, _cidades: parentCidades, _termo: parentTermo });
      const restantes = (data?.telemetria ?? []).filter((t: any) => t?.error).length;
      toast.success(
        `Reexecução: ${queries.length} consulta(s) reprocessada(s), ${restantes} ainda com erro. ${data?.encontrados ?? 0} grupos (${data?.inseridos ?? 0} novos).`,
      );
      console.group(`[RadarZAP] retry ${data?.run_id ?? "-"} (parent ${parentRunId ?? "-"})`);
      console.log("Queries reexecutadas:", queries);
      if (data?.telemetria?.length) console.table(data.telemetria.map((t: any) => ({
        cidade: t.cidade, termo: t.termo, http: t.status, ms: t.duration_ms,
        tentativas: t.tentativas, retries: t.retries, erro: t.error ?? "",
      })));
      console.groupEnd();
      carregar();
    } catch (e: any) {
      toast.error("Falha ao reexecutar: " + (e?.message ?? e));
    } finally {
      setReexecutandoErros(false);
    }
  };


  const analisarMensagem = async () => {
    if (!textoMsg.trim()) { toast.error("Cole o texto da mensagem"); return; }
    setAnalisando(true);
    try {
      const { data, error } = await supabase.functions.invoke("radarzap-analisar-mensagem", {
        body: {
          texto: textoMsg.trim(),
          grupo_id: grupoSel === "_none" ? null : grupoSel,
          autor_contato: contatoMsg.trim() || null,
        },
      });
      if (error) throw error;
      const r = data?.resultados?.[0];
      if (r?.ok) {
        toast.success(r.lead_id ? "Lead gerado 🎯" : "Mensagem analisada");
        setTextoMsg("");
        setContatoMsg("");
        carregar();
      } else {
        toast.error("Falha: " + (r?.error ?? "desconhecida"));
      }
    } catch (e: any) {
      toast.error("Erro: " + (e?.message ?? e));
    } finally {
      setAnalisando(false);
    }
  };

  const alterarStatusGrupo = async (id: string, status: string) => {
    const { error } = await supabase.from("radarzap_grupos").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    setGrupos(gs => gs.map(g => g.id === id ? { ...g, status } : g));
  };

  const excluirGrupo = async (id: string) => {
    if (!confirm("Excluir grupo?")) return;
    const { error } = await supabase.from("radarzap_grupos").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setGrupos(gs => gs.filter(g => g.id !== id));
  };

  const alterarStatusLead = async (id: string, status: string) => {
    const { error } = await supabase.from("radarzap_leads").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    setLeads(ls => ls.map(l => l.id === id ? { ...l, status } : l));
  };

  const stats = useMemo(() => ({
    grupos: grupos.length,
    monitorando: grupos.filter(g => g.status === "monitorando").length,
    mensagens: mensagens.length,
    leads: leads.length,
    leadsNovos: leads.filter(l => l.status === "novo").length,
  }), [grupos, mensagens, leads]);

  // Hosts de agregadores presentes nos grupos carregados (para o filtro por host)
  const hostsAgregadores = useMemo(() => {
    const set = new Set<string>();
    for (const g of grupos) {
      if (typeof g.origem === "string" && g.origem.startsWith("agregador:")) {
        set.add(g.origem.slice("agregador:".length));
      }
    }
    return Array.from(set).sort();
  }, [grupos]);

  // Categorias presentes (para o filtro por categoria)
  const categoriasDisponiveis = useMemo(() => {
    const set = new Set<string>();
    for (const g of grupos) if (g.categoria) set.add(g.categoria);
    return Array.from(set).sort();
  }, [grupos]);

  // Lista filtrada
  const gruposFiltrados = useMemo(() => {
    return grupos.filter((g) => {
      const origem = g.origem ?? "";
      if (filtroOrigem === "busca" && origem !== "busca") return false;
      if (filtroOrigem === "agregadores" && !origem.startsWith("agregador:")) return false;
      if (filtroOrigem.startsWith("agregador:") && origem !== filtroOrigem) return false;
      if (filtroCategoria !== "todas" && g.categoria !== filtroCategoria) return false;
      return true;
    });
  }, [grupos, filtroOrigem, filtroCategoria]);

  const toggleSelecionado = (id: string) => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleTodosVisiveis = () => {
    setSelecionados((prev) => {
      const ids = gruposFiltrados.map((g) => g.id);
      const allSelected = ids.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allSelected) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  };

  const reprocessarSelecionados = async () => {
    const alvos = grupos.filter((g) => selecionados.has(g.id));
    if (!alvos.length) return;
    const invites = Array.from(new Set(alvos.map((g) => g.invite_url).filter(Boolean))) as string[];
    const cidades = Array.from(new Set(alvos.map((g) => g.cidade).filter(Boolean))) as string[];
    const motivo = window.prompt(
      `Motivo do reprocessamento (${invites.length} grupo(s)) — ficará registrado no histórico:`,
      "Reprocessamento manual dos grupos selecionados",
    );
    if (motivo === null) return; // cancelado
    setReprocessandoSel(true);
    try {
      const { data, error } = await supabase.functions.invoke("radarzap-descobrir-grupos", {
        body: {
          cidades: cidades.length ? cidades : ["Brasília"],
          reprocessar_invites: invites,
          motivo_reprocessamento: motivo.trim() || "Reprocessamento manual dos grupos selecionados",
        },
      });
      if (error) throw error;
      const atualizados = (data as any)?.reprocessados_atualizados ?? 0;
      const inseridos = (data as any)?.inseridos ?? 0;
      toast.success(`Reprocessados ${invites.length} grupo(s): ${atualizados} atualizado(s)${inseridos ? ` · ${inseridos} novo(s)` : ""}`);
      setSelecionados(new Set());
      carregar();
    } catch (e: any) {
      toast.error("Falha ao reprocessar: " + (e?.message ?? String(e)));
    } finally {
      setReprocessandoSel(false);
    }
  };

  const reprocessarInvitesAgregadores = async () => {
    // Seleciona todos os grupos vindos de agregadores dentro do filtro atual (ou de todos, se filtro=todas)
    const base = gruposFiltrados.length ? gruposFiltrados : grupos;
    const alvos = base.filter((g) => typeof g.origem === "string" && g.origem.startsWith("agregador:"));
    if (!alvos.length) {
      toast.info("Nenhum grupo de agregador encontrado no filtro atual.");
      return;
    }
    const invites = Array.from(new Set(alvos.map((g) => g.invite_url).filter(Boolean))) as string[];
    const cidades = Array.from(new Set(alvos.map((g) => g.cidade).filter(Boolean))) as string[];
    const motivo = window.prompt(
      `Reprocessar ${invites.length} invite(s) vindos de agregadores ignorando a deduplicação.\n\nInforme o motivo (ficará registrado no histórico):`,
      "Reprocessamento de invites de agregadores (ignorar dedup)",
    );
    if (motivo === null) return;
    setReprocessandoSel(true);
    try {
      const { data, error } = await supabase.functions.invoke("radarzap-descobrir-grupos", {
        body: {
          cidades: cidades.length ? cidades : ["Brasília"],
          reprocessar_invites: invites,
          motivo_reprocessamento: motivo.trim() || "Reprocessamento de invites de agregadores (ignorar dedup)",
        },
      });
      if (error) throw error;
      const atualizados = (data as any)?.reprocessados_atualizados ?? 0;
      const inseridos = (data as any)?.inseridos ?? 0;
      toast.success(`Agregadores reprocessados: ${invites.length} invite(s) · ${atualizados} atualizado(s)${inseridos ? ` · ${inseridos} novo(s)` : ""}`);
      carregar();
    } catch (e: any) {
      toast.error("Falha ao reprocessar agregadores: " + (e?.message ?? String(e)));
    } finally {
      setReprocessandoSel(false);
    }
  };



  // Índice de leads por mensagem_id (para status "mesclada" / "incompleto" / "sem_lead")
  const leadsPorMsg = useMemo(() => {
    const map = new Map<string, Lead & { mensagem_id?: string }>();
    for (const l of leads as (Lead & { mensagem_id?: string })[]) {
      const mid = (l as any).mensagem_id as string | undefined;
      if (mid) map.set(mid, l);
    }
    return map;
  }, [leads]);

  const intencoesDisponiveis = useMemo(() => {
    const s = new Set<string>();
    mensagens.forEach(m => { if (m.intencao) s.add(m.intencao); });
    return Array.from(s).sort();
  }, [mensagens]);

  const statusMensagem = (m: Mensagem): "mesclada" | "incompleto" | "completo" | "sem_lead" => {
    const l = leadsPorMsg.get(m.id);
    if (!l) return "sem_lead";
    if (l.dedup_group_id && l.is_principal === false) return "mesclada";
    const camposFalta = !l.contato || !l.tipo_imovel || !l.operacao || (!l.bairro && !l.cidade);
    return camposFalta ? "incompleto" : "completo";
  };

  const mensagensFiltradas = useMemo(() => {
    const q = msgBusca.trim().toLowerCase();
    return mensagens.filter(m => {
      if (q) {
        const hay = `${m.id} ${m.texto ?? ""} ${(m.extraido && JSON.stringify(m.extraido)) || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (msgIntencao !== "_todas" && (m.intencao ?? "") !== msgIntencao) return false;
      if (msgStatus !== "_todos" && statusMensagem(m) !== msgStatus) return false;
      return true;
    });
  }, [mensagens, msgBusca, msgIntencao, msgStatus, leadsPorMsg]);


  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Radar className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">RadarZAP</h1>
          <p className="text-sm text-muted-foreground">
            Descubra grupos públicos de WhatsApp e transforme mensagens em leads qualificados.
          </p>
        </div>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium">Como acessar o RadarZAP</p>
                <ul className="list-disc pl-4 mt-1 text-muted-foreground space-y-0.5">
                  <li>Se a opção não aparecer no menu lateral, verifique se seu perfil tem a permissão <b>RadarZAP</b> em <a href="/corretores" className="text-primary hover:underline">/corretores</a> (aba Permissões) — apenas o Master libera módulos.</li>
                  <li>Confira também o módulo em <a href="/configuracoes" className="text-primary hover:underline">/configuracoes</a> → Módulos ativos. Ele precisa estar habilitado para a imobiliária.</li>
                  <li>Rotas disponíveis: <code>/radarzap</code>, <code>/radarzap/onboarding</code>, <code>/radarzap/scoring</code>, <code>/radarzap/status</code>.</li>
                  <li>Se o menu não atualizar, faça logout/login para recarregar as permissões.</li>
                </ul>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const url = typeof window !== "undefined" ? window.location.href : "";
                navigator.clipboard?.writeText(url)
                  .then(() => toast.success("Rota copiada", { description: url }))
                  .catch(() => toast.error("Não foi possível copiar"));
              }}
            >
              <ExternalLink className="h-3.5 w-3.5 mr-1" /> Copiar rota atual
            </Button>
          </div>
        </CardContent>
      </Card>


      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          Alertas em tempo real ativos para novas execuções.
        </div>
        <AlertasRealtimeConfigPopover />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">

        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Grupos</div><div className="text-2xl font-bold">{stats.grupos}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Monitorando</div><div className="text-2xl font-bold">{stats.monitorando}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Mensagens</div><div className="text-2xl font-bold">{stats.mensagens}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Leads</div><div className="text-2xl font-bold">{stats.leads}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Novos</div><div className="text-2xl font-bold text-primary">{stats.leadsNovos}</div></CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="conexao"><Wifi className="h-4 w-4 mr-1" />Conexão</TabsTrigger>
          <TabsTrigger value="importar"><Upload className="h-4 w-4 mr-1" />Importar grupos</TabsTrigger>
          <TabsTrigger value="imoveis"><Home className="h-4 w-4 mr-1" />Imóveis captados</TabsTrigger>
          <TabsTrigger value="grupos"><Users className="h-4 w-4 mr-1" />Grupos</TabsTrigger>
          <TabsTrigger value="analisar"><Sparkles className="h-4 w-4 mr-1" />Analisar mensagem</TabsTrigger>
          <TabsTrigger value="mensagens"><MessageSquare className="h-4 w-4 mr-1" />Histórico</TabsTrigger>
          <TabsTrigger value="aprovacao">
            <ShieldCheck className="h-4 w-4 mr-1" />
            Aprovações
          </TabsTrigger>

          <TabsTrigger value="leads">Leads ({stats.leads})</TabsTrigger>
          <TabsTrigger value="dedup"><Merge className="h-4 w-4 mr-1" />Deduplicação</TabsTrigger>
          <TabsTrigger value="dedup_log"><ShieldCheck className="h-4 w-4 mr-1" />Log dedup</TabsTrigger>
          <TabsTrigger value="auditoria"><Gauge className="h-4 w-4 mr-1" />Auditoria Score</TabsTrigger>
          <TabsTrigger value="explicacao"><Lightbulb className="h-4 w-4 mr-1" />Explicação Score</TabsTrigger>
          <TabsTrigger value="simulador"><FlaskConical className="h-4 w-4 mr-1" />Simulador Score</TabsTrigger>
          <TabsTrigger value="metricas"><BarChart3 className="h-4 w-4 mr-1" />Métricas</TabsTrigger>
          <TabsTrigger value="alertas"><Bell className="h-4 w-4 mr-1" />Alertas</TabsTrigger>
          <TabsTrigger value="auditoria_aprov"><ShieldCheck className="h-4 w-4 mr-1" />Auditoria aprov.</TabsTrigger>
          <TabsTrigger value="sync_crm"><RefreshCw className="h-4 w-4 mr-1" />Sync CRM</TabsTrigger>
          <TabsTrigger value="agendamento"><Clock className="h-4 w-4 mr-1" />Agendamento</TabsTrigger>
          <TabsTrigger value="historico_busca"><History className="h-4 w-4 mr-1" />Histórico buscas</TabsTrigger>
          <TabsTrigger value="progresso"><Activity className="h-4 w-4 mr-1" />Progresso</TabsTrigger>
          <TabsTrigger value="normalizacao"><Merge className="h-4 w-4 mr-1" />Normalização</TabsTrigger>
        </TabsList>



        <TabsContent value="conexao"><ConexaoEvolutionPanel /></TabsContent>
        <TabsContent value="importar"><ImportarGruposPanel /></TabsContent>
        <TabsContent value="imoveis"><ImoveisCaptadosPanel /></TabsContent>
        <TabsContent value="aprovacao"><AprovacaoPendentesPanel onChange={carregar} /></TabsContent>


        <TabsContent value="dedup"><DedupRevisaoPanel /></TabsContent>
        <TabsContent value="dedup_log"><DedupLogPanel /></TabsContent>

        <TabsContent value="auditoria"><ScoreAuditoriaPanel /></TabsContent>
        <TabsContent value="explicacao"><ExplicacaoScorePanel /></TabsContent>
        <TabsContent value="simulador"><SimuladorScorePanel /></TabsContent>


        <TabsContent value="metricas"><RadarZapMetricasPanel /></TabsContent>

        <TabsContent value="alertas"><RadarZapAlertasMetricasPanel /></TabsContent>

        <TabsContent value="auditoria_aprov"><AuditoriaAprovacoesPanel /></TabsContent>
        <TabsContent value="sync_crm"><SincronizacaoCrmPanel /></TabsContent>

        <TabsContent value="agendamento"><RadarZapAgendamentoPanel /></TabsContent>
        <TabsContent value="historico_busca" className="space-y-4">
          <ExportarPorRunIdPanel />
          <HistoricoDescobertaPanel
            onClonarParametros={(p) => {
              setCidadesCsv(p.cidades.join(", "));
              setCepsCsv(p.ceps.join(", "));
              setCondominiosCsv(p.condominios.join(", "));
              setTermo(p.termo ?? "");
              setTab("grupos");
            }}
            onReexecutar={async (p) => {
              const alvos = [...p.cidades, ...p.ceps.map((c) => `CEP ${c}`), ...p.condominios];
              const { data, error } = await supabase.functions.invoke("radarzap-descobrir-grupos", {
                body: {
                  cidades: alvos,
                  termo: p.termo ?? undefined,
                  ignorar_dedup_all: p.ignorar_dedup_all ?? false,
                  reprocessar_invites: p.reprocessar_invites ?? [],
                },
              });
              if (error) throw error;
              setUltimaBusca({ ...data, _cidades: alvos, _termo: p.termo ?? "" });
              toast.success(
                `Reexecução: ${(data as any)?.encontrados ?? 0} grupo(s) · ${(data as any)?.inseridos ?? 0} novo(s)`,
                {
                  description: (p.ignorar_dedup_all || (p.reprocessar_invites?.length ?? 0) > 0)
                    ? "Estratégia de deduplicação clonada da execução original."
                    : "Deduplicação padrão preservada.",
                },
              );
              carregar();
            }}
          />

        </TabsContent>
        <TabsContent value="progresso" className="space-y-4">
          <ProgressoExecucoesPanel />
        </TabsContent>
        <TabsContent value="normalizacao" className="space-y-4">
          <NormalizacaoTokensPanel />
        </TabsContent>




        {/* GRUPOS */}
        <TabsContent value="grupos" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Search className="h-4 w-4" />Descobrir grupos públicos</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Cidades (separadas por vírgula)</label>
                  <Input value={cidadesCsv} onChange={e => setCidadesCsv(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Termo adicional (opcional)</label>
                  <Input value={termo} onChange={e => setTermo(e.target.value)} placeholder="ex.: aluguel, comercial, apartamento" />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-muted-foreground">CEPs (separados por vírgula)</label>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-[11px]"
                        onClick={() => {
                          const n = normalizarCepsCsv(cepsCsv);
                          if (n !== cepsCsv) {
                            setCepsCsv(n);
                            toast.success("CEPs formatados");
                          }
                        }}
                        disabled={!cepsCsv.trim()}
                      >
                        Formatar
                      </Button>
                      <CorrigirLoteDialog tipo="cep" atuaisCsv={cepsCsv} onAplicar={(csv) => setCepsCsv(normalizarCepsCsv(csv))} />
                      <ImportarAlvosDialog tipo="cep" atuaisCsv={cepsCsv} onImportar={(csv) => setCepsCsv(normalizarCepsCsv(csv))} />
                    </div>
                  </div>
                  <Input
                    value={cepsCsv}
                    onChange={e => setCepsCsv(e.target.value)}
                    onBlur={() => {
                      const n = normalizarCepsCsv(cepsCsv);
                      if (n !== cepsCsv) setCepsCsv(n);
                    }}
                    placeholder="ex.: 70000-000, 71900-100"
                    aria-invalid={validacaoAlvos.ceps_invalidos.length > 0 || undefined}
                    className={validacaoAlvos.ceps_invalidos.length > 0
                      ? "border-destructive focus-visible:ring-destructive/40"
                      : validacaoAlvos.ceps_duplicados.length > 0 ? "border-amber-400" : ""}
                  />

                  {validacaoAlvos.ceps_itens.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {validacaoAlvos.ceps_itens.map((it, i) => (
                        <span
                          key={`cep-${i}-${it.raw}`}
                          title={it.motivo || (it.ok ? "Válido" : "")}
                          className={
                            "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] " +
                            (it.ok
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : it.duplicado
                                ? "border-amber-300 bg-amber-50 text-amber-700"
                                : "border-destructive/40 bg-destructive/10 text-destructive")
                          }
                        >
                          {it.raw || "(vazio)"}
                          {!it.ok && it.motivo && (
                            <span className="opacity-80">— {it.motivo}</span>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-muted-foreground">Condomínios (separados por vírgula)</label>
                    <div className="flex items-center gap-1">
                    <CorrigirLoteDialog tipo="condominio" atuaisCsv={condominiosCsv} onAplicar={setCondominiosCsv} />
                    <ImportarAlvosDialog tipo="condominio" atuaisCsv={condominiosCsv} onImportar={setCondominiosCsv} />
                    </div>
                  </div>
                  <Input
                    value={condominiosCsv}
                    onChange={e => setCondominiosCsv(e.target.value)}
                    placeholder="ex.: Alphaville Brasília, Jardins Mangueiral"
                    aria-invalid={validacaoAlvos.condos_invalidos.length > 0 || undefined}
                    className={validacaoAlvos.condos_invalidos.length > 0
                      ? "border-destructive focus-visible:ring-destructive/40"
                      : validacaoAlvos.condos_duplicados.length > 0 ? "border-amber-400" : ""}
                  />
                  {validacaoAlvos.condos_itens.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {validacaoAlvos.condos_itens.map((it, i) => (
                        <span
                          key={`condo-${i}-${it.raw}`}
                          title={it.motivo || (it.ok ? "Válido" : "")}
                          className={
                            "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] " +
                            (it.ok
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : it.duplicado
                                ? "border-amber-300 bg-amber-50 text-amber-700"
                                : "border-destructive/40 bg-destructive/10 text-destructive")
                          }
                        >
                          {it.raw || "(vazio)"}
                          {!it.ok && it.motivo && (
                            <span className="opacity-80">— {it.motivo}</span>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Condomínios populares de Brasília — clique para adicionar</div>
                <div className="flex flex-wrap gap-1.5">
                  {CONDOMINIOS_BSB_PRESET.map(nome => {
                    const atuais = condominiosCsv.split(",").map(s => s.trim()).filter(Boolean);
                    const ativo = atuais.some(a => a.toLowerCase() === nome.toLowerCase());
                    return (
                      <Badge
                        key={nome}
                        variant={ativo ? "default" : "outline"}
                        className="cursor-pointer text-xs"
                        onClick={() => {
                          const set = new Set(atuais.map(a => a.toLowerCase()));
                          const next = ativo
                            ? atuais.filter(a => a.toLowerCase() !== nome.toLowerCase())
                            : [...atuais, nome];
                          setCondominiosCsv(next.join(", "));
                          void set;
                        }}
                      >
                        {nome}
                      </Badge>
                    );
                  })}
                </div>
              </div>
              <PreviewConsultasPanel
                cidades={validacaoAlvos.cidades}
                ceps={validacaoAlvos.ceps_validos}
                condominios={validacaoAlvos.condos_validos}
                termoExtra={termo}
              />
              {(() => {
                const problemas: string[] = [];
                if (validacaoAlvos.ceps_invalidos.length)
                  problemas.push(`${validacaoAlvos.ceps_invalidos.length} CEP(s) inválido(s): ${validacaoAlvos.ceps_invalidos.join(", ")}`);
                if (validacaoAlvos.condos_invalidos.length)
                  problemas.push(`${validacaoAlvos.condos_invalidos.length} condomínio(s) inválido(s): ${validacaoAlvos.condos_invalidos.join(", ")}`);
                const bloqueado = problemas.length > 0;
                return (
                  <>
                    {bloqueado && (
                      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs space-y-1">
                        <p className="font-semibold text-destructive">Corrija os itens abaixo para iniciar a descoberta:</p>
                        <ul className="list-disc pl-5 text-destructive/90">
                          {problemas.map((p, i) => <li key={i}>{p}</li>)}
                        </ul>
                        <p className="text-muted-foreground pt-1">
                          CEPs devem ter 8 dígitos (00000-000). Condomínios: 3–80 caracteres, sem símbolos estranhos.
                        </p>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={() => descobrirGrupos()}
                        disabled={buscando || bloqueado}
                        title={bloqueado ? "Corrija os CEPs/condomínios inválidos antes de buscar" : undefined}
                      >
                        {buscando ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Search className="h-4 w-4 mr-1" />}
                        Buscar grupos públicos
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => descobrirGrupos({ somenteAgregadores: true })}
                        disabled={buscando || bloqueado}
                        title="Pula a busca no Google e consulta apenas os agregadores públicos (Fase 2)"
                      >
                        {buscando ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Search className="h-4 w-4 mr-1" />}
                        Somente agregadores (Fase 2)
                      </Button>
                    </div>
                  </>
                );
              })()}
              <p className="text-xs text-muted-foreground">
                Cada cidade, CEP e condomínio vira uma consulta separada em <code>site:chat.whatsapp.com</code>. Somente links públicos indexados — sem violar políticas do WhatsApp.
              </p>
            </CardContent>
          </Card>
          <ExecucaoErrosPanel
            ultimaBusca={ultimaBusca}
            onReexecutarErros={reexecutarErros}
            reexecutando={reexecutandoErros}
          />
          <DescartadosDedupPanel ultimaBusca={ultimaBusca} />


          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando…</div>
          ) : grupos.length === 0 ? (
            <BuscaVaziaDiagnostico
              ultimaBusca={ultimaBusca}
              cidadesCsv={cidadesCsv}
              termo={termo}
              onAplicarSugestao={(c, t) => { setCidadesCsv(c); setTermo(t); }}
              onTentarNovamente={descobrirGrupos}
              buscando={buscando}
            />
          ) : (
            <div className="space-y-3">
              {/* Barra de filtros e seleção */}
              <Card>
                <CardContent className="p-3 flex flex-col md:flex-row md:items-end gap-3">
                  <div className="flex-1 min-w-[180px]">
                    <label className="text-xs text-muted-foreground">Origem</label>
                    <Select value={filtroOrigem} onValueChange={(v) => { setFiltroOrigem(v); setSelecionados(new Set()); }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todas as origens</SelectItem>
                        <SelectItem value="busca">Busca (Google)</SelectItem>
                        <SelectItem value="agregadores">Todos os agregadores (Fase 2)</SelectItem>
                        {hostsAgregadores.map((h) => (
                          <SelectItem key={h} value={`agregador:${h}`}>Agregador · {h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1 min-w-[180px]">
                    <label className="text-xs text-muted-foreground">Categoria</label>
                    <Select value={filtroCategoria} onValueChange={(v) => { setFiltroCategoria(v); setSelecionados(new Set()); }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todas">Todas as categorias</SelectItem>
                        {categoriasDisponiveis.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="outline" onClick={toggleTodosVisiveis} disabled={!gruposFiltrados.length}>
                      {gruposFiltrados.every((g) => selecionados.has(g.id)) && gruposFiltrados.length > 0
                        ? "Desmarcar visíveis"
                        : "Selecionar visíveis"}
                    </Button>
                    <Button
                      size="sm"
                      onClick={reprocessarSelecionados}
                      disabled={reprocessandoSel || selecionados.size === 0}
                      title="Reprocessa os grupos selecionados ignorando a deduplicação"
                    >
                      {reprocessandoSel ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                      Reprocessar selecionados ({selecionados.size})
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={reprocessarInvitesAgregadores}
                      disabled={reprocessandoSel}
                      title="Reprocessa todos os invites vindos de agregadores no filtro atual, ignorando dedup e registrando motivo no histórico"
                    >
                      {reprocessandoSel ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                      Reprocessar agregadores (ignorar dedup)
                    </Button>

                  </div>
                  <div className="text-xs text-muted-foreground md:ml-auto">
                    {gruposFiltrados.length} de {grupos.length} grupo(s)
                  </div>
                </CardContent>
              </Card>

              {gruposFiltrados.length === 0 ? (
                <div className="text-sm text-muted-foreground p-4 text-center border border-dashed rounded">
                  Nenhum grupo corresponde aos filtros atuais.
                </div>
              ) : (
                <div className="grid gap-3">
                  {gruposFiltrados.map(g => {
                    const origemHost = typeof g.origem === "string" && g.origem.startsWith("agregador:")
                      ? g.origem.slice("agregador:".length)
                      : null;
                    return (
                      <Card key={g.id}>
                        <CardContent className="p-4 flex flex-col md:flex-row md:items-center gap-3">
                          <div className="pt-1">
                            <Checkbox
                              checked={selecionados.has(g.id)}
                              onCheckedChange={() => toggleSelecionado(g.id)}
                              aria-label="Selecionar grupo"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <a href={g.invite_url} target="_blank" rel="noreferrer" className="font-medium hover:underline truncate flex items-center gap-1">
                                {g.nome || g.invite_url} <ExternalLink className="h-3 w-3" />
                              </a>
                              {g.categoria && <Badge variant="secondary">{g.categoria}</Badge>}
                              {g.cidade && <Badge variant="outline">{g.cidade}</Badge>}
                              {origemHost ? (
                                <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700">
                                  Agregador · {origemHost}
                                </Badge>
                              ) : g.origem === "busca" ? (
                                <Badge variant="outline">Busca</Badge>
                              ) : g.origem ? (
                                <Badge variant="outline">{g.origem}</Badge>
                              ) : null}
                              <Badge variant={g.status === "monitorando" ? "default" : g.status === "ignorado" ? "destructive" : "outline"}>
                                {g.status}
                              </Badge>
                            </div>
                            {g.descricao && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{g.descricao}</p>}
                          </div>
                          <div className="flex gap-2">
                            <Select value={g.status} onValueChange={v => alterarStatusGrupo(g.id, v)}>
                              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="novo">Novo</SelectItem>
                                <SelectItem value="monitorando">Monitorando</SelectItem>
                                <SelectItem value="ignorado">Ignorado</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button size="icon" variant="ghost" onClick={() => excluirGrupo(g.id)}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* ANALISAR */}
        <TabsContent value="analisar" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" />Analisar mensagem com IA</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Grupo de origem (opcional)</label>
                  <Select value={grupoSel} onValueChange={setGrupoSel}>
                    <SelectTrigger><SelectValue placeholder="Sem grupo" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Sem grupo</SelectItem>
                      {grupos.slice(0, 100).map(g => (
                        <SelectItem key={g.id} value={g.id}>{g.nome || g.invite_url}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Contato do autor (opcional)</label>
                  <Input value={contatoMsg} onChange={e => setContatoMsg(e.target.value)} placeholder="ex.: (61) 9xxxx-xxxx" />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Texto da mensagem</label>
                <Textarea rows={6} value={textoMsg} onChange={e => setTextoMsg(e.target.value)} placeholder="Cole aqui a mensagem do grupo (ex.: 'Vendo apto 2q Sudoeste, R$ 850 mil, aceita financiamento. Contato (61) 9...')" />
              </div>
              <Button onClick={analisarMensagem} disabled={analisando}>
                {analisando ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
                Analisar e gerar lead
              </Button>
              <p className="text-xs text-muted-foreground">
                A IA classifica intenção (venda/aluguel/busca), extrai bairro, preço e contato. Se detectar oferta de imóvel, cria um lead automaticamente.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* MENSAGENS */}
        <TabsContent value="mensagens" className="space-y-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><RefreshCw className="h-4 w-4" />Reprocessar mensagem por ID</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  placeholder="radarzap_mensagem_id (UUID)"
                  value={reprocId}
                  onChange={e => setReprocId(e.target.value.trim())}
                  className="font-mono text-xs"
                />
                <Button
                  onClick={() => reprocessarMensagem(reprocId, { force: reprocForce })}
                  disabled={!reprocId || reprocessando === reprocId}
                >
                  {reprocessando === reprocId ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                  Reprocessar
                </Button>
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={reprocForce} onChange={e => setReprocForce(e.target.checked)} />
                Forçar criação/atualização de lead mesmo se a intenção não for venda/aluguel/temporada
              </label>
              <p className="text-[11px] text-muted-foreground">
                Útil quando o card não foi criado ou está com dados incompletos. Re-executa a IA sobre o texto atual e atualiza a mensagem e o lead vinculado (upsert por mensagem_id).
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><Search className="h-4 w-4" />Filtros avançados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid gap-2 md:grid-cols-[2fr_1fr_1fr_auto]">
                <Input
                  placeholder="Buscar por radarzap_mensagem_id, texto ou dados extraídos…"
                  value={msgBusca}
                  onChange={e => setMsgBusca(e.target.value)}
                />
                <Select value={msgIntencao} onValueChange={setMsgIntencao}>
                  <SelectTrigger><SelectValue placeholder="Intenção" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_todas">Todas as intenções</SelectItem>
                    {intencoesDisponiveis.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={msgStatus} onValueChange={setMsgStatus}>
                  <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_todos">Todos os status</SelectItem>
                    <SelectItem value="completo">Completo</SelectItem>
                    <SelectItem value="incompleto">Dados incompletos</SelectItem>
                    <SelectItem value="mesclada">Mesclada</SelectItem>
                    <SelectItem value="sem_lead">Sem lead</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  onClick={() => { setMsgBusca(""); setMsgIntencao("_todas"); setMsgStatus("_todos"); }}
                >
                  Limpar
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {mensagensFiltradas.length} de {mensagens.length} mensagens.
              </p>
            </CardContent>
          </Card>

          {mensagensFiltradas.length === 0 ? (
            <Card><CardContent className="p-6 text-center text-muted-foreground">
              {mensagens.length === 0 ? "Sem mensagens analisadas." : "Nenhuma mensagem corresponde aos filtros."}
            </CardContent></Card>
          ) : mensagensFiltradas.map(m => {
            const st = statusMensagem(m);
            const stMap: Record<string, { label: string; variant: "default" | "outline" | "secondary" | "destructive"; cls?: string }> = {
              completo: { label: "Completo", variant: "default", cls: "bg-emerald-600 hover:bg-emerald-600" },
              incompleto: { label: "Dados incompletos", variant: "destructive" },
              mesclada: { label: "Mesclada", variant: "secondary" },
              sem_lead: { label: "Sem lead", variant: "outline" },
            };
            const s = stMap[st];
            return (
            <Card key={m.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={m.tem_imovel ? "default" : "outline"}>{m.intencao ?? "—"}</Badge>
                  <Badge variant="secondary">score {m.score_intencao}</Badge>
                  <Badge variant={s.variant} className={s.cls}>{s.label}</Badge>
                  <span className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString("pt-BR")}</span>
                  <button
                    type="button"
                    title="Copiar mensagem_id"
                    onClick={() => { navigator.clipboard?.writeText(m.id); toast.success("ID copiado"); }}
                    className="text-[10px] font-mono text-muted-foreground ml-auto hover:text-primary"
                  >
                    {m.id.slice(0, 8)}…
                  </button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => reprocessarMensagem(m.id)}
                    disabled={reprocessando === m.id}
                    title="Reprocessar com IA"
                  >
                    {reprocessando === m.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <RefreshCw className="h-3.5 w-3.5" />}
                    <span className="ml-1 hidden sm:inline">Reprocessar</span>
                  </Button>
                </div>
                <p className="text-sm whitespace-pre-wrap line-clamp-4">{m.texto}</p>
                {m.extraido?.resumo && <p className="text-xs text-primary">→ {m.extraido.resumo}</p>}
              </CardContent>
            </Card>
          );})}
        </TabsContent>


        {/* LEADS */}
        <TabsContent value="leads" className="space-y-3">
          {leads.length === 0 ? (
            <Card><CardContent className="p-6 text-center text-muted-foreground">Nenhum lead capturado ainda.</CardContent></Card>
          ) : (() => {
            const dupCount: Record<string, number> = {};
            leads.forEach(l => {
              const g = l.dedup_group_id ?? l.id;
              dupCount[g] = (dupCount[g] || 0) + 1;
            });
            const ordenados = [...leads].sort((a, b) => {
              const pa = a.is_principal ? 1 : 0;
              const pb = b.is_principal ? 1 : 0;
              if (pa !== pb) return pb - pa;
              return (b.score ?? 0) - (a.score ?? 0);
            });
            const scoreColor = (s: number) =>
              s >= 70 ? "bg-emerald-600 text-white" :
              s >= 40 ? "bg-amber-500 text-white" :
              "bg-slate-400 text-white";
            return ordenados.map(l => {
              const s = l.score ?? 0;
              const grupo = l.dedup_group_id ?? l.id;
              const dups = (dupCount[grupo] ?? 1) - 1;
              return (
                <Card key={l.id} className={l.is_principal === false ? "opacity-70 border-dashed" : ""}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={scoreColor(s)}>Score {s}</Badge>
                      {l.is_principal === false
                        ? <Badge variant="outline">Duplicata</Badge>
                        : dups > 0 && <Badge variant="secondary">Principal · +{dups} duplicata{dups > 1 ? "s" : ""}</Badge>}
                      {l.operacao && <Badge>{l.operacao}</Badge>}
                      {l.tipo_imovel && <Badge variant="secondary">{l.tipo_imovel}</Badge>}
                      {l.bairro && <Badge variant="outline">{l.bairro}{l.cidade ? ` · ${l.cidade}` : ""}</Badge>}
                      <Badge variant="outline">{fmtBRL(l.preco)}</Badge>
                      <Badge variant={l.status === "novo" ? "default" : l.status === "convertido" ? "secondary" : "outline"}>{l.status}</Badge>
                    </div>
                    {l.resumo && <p className="text-sm">{l.resumo}</p>}
                    {l.score_detalhes && Object.keys(l.score_detalhes).length > 0 && (
                      <div className="flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                        {Object.entries(l.score_detalhes).map(([k, v]) => (
                          <span key={k} className="rounded bg-muted px-1.5 py-0.5">{k} +{v}</span>
                        ))}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      {l.proprietario_nome && <>Proprietário: <b>{l.proprietario_nome}</b> · </>}
                      {l.contato && <>Contato: <b>{l.contato}</b> · </>}
                      {new Date(l.created_at).toLocaleString("pt-BR")}
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Select value={l.status} onValueChange={v => alterarStatusLead(l.id, v)}>
                        <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="novo">Novo</SelectItem>
                          <SelectItem value="contato">Em contato</SelectItem>
                          <SelectItem value="convertido">Convertido</SelectItem>
                          <SelectItem value="descartado">Descartado</SelectItem>
                        </SelectContent>
                      </Select>
                      {l.contato && (
                        <Button asChild size="sm" variant="outline">
                          <a href={`https://wa.me/${l.contato.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
                            WhatsApp
                          </a>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            });
          })()}
        </TabsContent>
      </Tabs>
    </div>
  );
}
