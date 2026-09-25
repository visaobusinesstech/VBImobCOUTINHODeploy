import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { SectionHeader } from "@/components/shared/MetricCard";
import { useSearchParams } from "react-router-dom";
import { Share2 } from "lucide-react";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  Plus, Loader2, Filter, X, Phone, MessageCircle, Mail, Home, Handshake, Pin,
  Check, Trash2, AlertTriangle, Clock, CalendarDays, Users, TrendingUp,
  BarChart3, Edit2, Send, ChevronDown, Search, RotateCcw
} from "lucide-react";
import { useFollowups, type Followup, isFollowupAlvoInativo } from "@/hooks/useFollowups";
import { useFollowupCounts } from "@/hooks/useFollowupCounts";
import { useLeads } from "@/hooks/useLeads";
import { useContratos } from "@/hooks/useContratos";
import { useImoveis } from "@/hooks/useImoveis";
import { FollowupFormDialog } from "@/components/pipeline/FollowupFormDialog";
import { useDialogPersistence } from "@/hooks/useDialogPersistence";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { formatDistanceToNow, isToday, isPast, parseISO, format, differenceInDays, startOfWeek, endOfWeek, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const TIPO_ICONS: Record<string, React.ReactNode> = {
  ligacao: <Phone className="w-3.5 h-3.5" />,
  whatsapp: <MessageCircle className="w-3.5 h-3.5" />,
  email: <Mail className="w-3.5 h-3.5" />,
  visita: <Home className="w-3.5 h-3.5" />,
  reuniao: <Handshake className="w-3.5 h-3.5" />,
  outro: <Pin className="w-3.5 h-3.5" />,
};

const TIPO_LABELS: Record<string, string> = {
  ligacao: "Ligação",
  whatsapp: "WhatsApp",
  email: "E-mail",
  visita: "Visita",
  reuniao: "Reunião",
  outro: "Outro",
};

const STATUS_OPTIONS = [
  { id: "pendente", label: "Novo lead", color: "bg-blue-500" },
  { id: "aguardando", label: "Aguardando resposta", color: "bg-yellow-500" },
  { id: "visita_realizada", label: "Visita realizada", color: "bg-purple-500" },
  { id: "proposta", label: "Proposta enviada", color: "bg-orange-500" },
  { id: "negociacao", label: "Negociação", color: "bg-cyan-500" },
  { id: "concluido", label: "Fechado", color: "bg-green-500" },
  { id: "perdido", label: "Perdido", color: "bg-destructive" },
];

const MENSAGENS_PRONTAS = [
  "Olá, estou passando para saber se você ainda tem interesse no imóvel que visitamos.",
  "Gostaria de saber se você teve tempo de analisar a proposta enviada.",
  "Olá! Temos novidades sobre imóveis que podem te interessar. Podemos conversar?",
  "Boa tarde! Gostaria de agendar uma visita ao imóvel? Tenho horários disponíveis.",
];

const Followups = () => {
  const { user, imobiliariaId } = useAuth();
  const { followups, loading, createFollowup, updateFollowup, deleteFollowup, concluirFollowupsInativos, refetch, patchFollowups } = useFollowups();
  const { leads, updateLead } = useLeads();
  const { contratos, updateContrato } = useContratos();
  const { imoveis } = useImoveis();
  const [searchParams, setSearchParams] = useSearchParams();
  const STORAGE_KEY = "followups:filters:v1";
  const URL_KEYS = ["filterAlvo","search","filterStatus","filterTipo","filterPrazo","semContatoDias","sortKey","sortDir","pageSize","page"] as const;
  const savedFilters = (() => {
    const fromUrl: Record<string, any> = {};
    URL_KEYS.forEach(k => {
      const v = searchParams.get(k);
      if (v !== null) fromUrl[k] = v;
    });
    let fromStorage: Record<string, any> = {};
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
      fromStorage = raw ? JSON.parse(raw) : {};
    } catch { /* ignore */ }
    return { ...fromStorage, ...fromUrl };
  })();
  const [filterAlvo, setFilterAlvo] = useState<"todos" | "leads" | "contratos">(savedFilters.filterAlvo ?? "todos");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState(savedFilters.search ?? "");
  const [filterStatus, setFilterStatus] = useState(savedFilters.filterStatus ?? "todos");
  const [filterTipo, setFilterTipo] = useState(savedFilters.filterTipo ?? "todos");
  const [filterPrazo, setFilterPrazo] = useState(savedFilters.filterPrazo ?? "todos");
  const [showFilters, setShowFilters] = useState(false);
  const SEM_CONTATO_OPCOES = [3, 5, 7, 14, 30];
  const urlSemContatoOverride = searchParams.get("semContatoDias") !== null;
  const [semContatoDias, setSemContatoDiasState] = useState<number>(() => {
    const v = Number(savedFilters.semContatoDias);
    return SEM_CONTATO_OPCOES.includes(v) ? v : 7;
  });

  // Sincroniza com imobiliaria_config.sem_contato_days (fonte de verdade por conta).
  // A URL tem prioridade máxima (link compartilhado). Sem override, o valor do banco
  // sobrescreve o localStorage no primeiro carregamento e alimenta a mesma RPC.
  useEffect(() => {
    if (!imobiliariaId || urlSemContatoOverride) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("imobiliaria_config")
        .select("sem_contato_days")
        .eq("user_id", imobiliariaId)
        .maybeSingle();
      const v = Number((data as any)?.sem_contato_days);
      if (!cancelled && Number.isFinite(v) && v >= 1 && v <= 90) {
        setSemContatoDiasState(v);
      }
    })();
    return () => { cancelled = true; };
  }, [imobiliariaId, urlSemContatoOverride]);

  // Wrapper: atualiza estado local (otimista) e persiste no banco, se a
  // imobiliária existir. Falhas silenciam (o valor continua válido em memória).
  const setSemContatoDias = useCallback((value: number) => {
    const v = Math.max(1, Math.min(90, Math.round(Number(value) || 7)));
    setSemContatoDiasState(v);
    if (!imobiliariaId) return;
    void supabase
      .from("imobiliaria_config")
      .update({ sem_contato_days: v } as any)
      .eq("user_id", imobiliariaId);
  }, [imobiliariaId]);

  type SortKey = "cliente" | "tipo" | "data" | "status";
  const SORT_KEYS: SortKey[] = ["cliente", "tipo", "data", "status"];
  const PAGE_SIZE_OPCOES = [10, 25, 50, 100];
  const [sortKey, setSortKey] = useState<SortKey>(
    SORT_KEYS.includes(savedFilters.sortKey) ? savedFilters.sortKey : "data"
  );
  const [sortDir, setSortDir] = useState<"asc" | "desc">(
    savedFilters.sortDir === "desc" ? "desc" : "asc"
  );
  const [pageSize, setPageSize] = useState<number>(() => {
    const v = Number(savedFilters.pageSize);
    return PAGE_SIZE_OPCOES.includes(v) ? v : 25;
  });
  const [page, setPage] = useState<number>(() => {
    const v = Number(savedFilters.page);
    return Number.isFinite(v) && v >= 1 ? v : 1;
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ filterAlvo, search, filterStatus, filterTipo, filterPrazo, semContatoDias, sortKey, sortDir, pageSize, page })
      );
    } catch {
      /* ignore */
    }
    // Sincroniza com query params (para URL compartilhável)
    const defaults: Record<string, any> = {
      filterAlvo: "todos", search: "", filterStatus: "todos", filterTipo: "todos",
      filterPrazo: "todos", semContatoDias: 7, sortKey: "data", sortDir: "asc", pageSize: 25, page: 1,
    };
    const current: Record<string, any> = { filterAlvo, search, filterStatus, filterTipo, filterPrazo, semContatoDias, sortKey, sortDir, pageSize, page };
    const next = new URLSearchParams(searchParams);
    Object.entries(current).forEach(([k, v]) => {
      if (v === undefined || v === null || v === "" || String(v) === String(defaults[k])) {
        next.delete(k);
      } else {
        next.set(k, String(v));
      }
    });
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [filterAlvo, search, filterStatus, filterTipo, filterPrazo, semContatoDias, sortKey, sortDir, pageSize, page]);

  // Reset página ao mudar filtros/ordenação (mas preserva no reload)
  const firstRunRef = useRef(true);
  useEffect(() => {
    if (firstRunRef.current) {
      firstRunRef.current = false;
      return;
    }
    setPage(1);
  }, [filterAlvo, search, filterStatus, filterTipo, filterPrazo, sortKey, sortDir, pageSize]);



  const [quickMsgOpen, setQuickMsgOpen] = useState(false);
  const [selectedFollowup, setSelectedFollowup] = useState<Followup | null>(null);
  const [concluirOpen, setConcluirOpen] = useState(false);
  const [concluirFollowup, setConcluirFollowup] = useState<Followup | null>(null);
  const [resultadoText, setResultadoText] = useState("");
  const [encerrarInativosOpen, setEncerrarInativosOpen] = useState(false);
  const [encerrandoInativos, setEncerrandoInativos] = useState(false);
  const [reativarTarget, setReativarTarget] = useState<Followup | null>(null);
  const [reativando, setReativando] = useState(false);

  const reativarInfo = useMemo(() => {
    if (!reativarTarget) return null;
    if (reativarTarget.contrato_id) {
      const contrato = contratos.find(c => c.id === reativarTarget.contrato_id);
      return {
        tipo: "contrato" as const,
        nome: reativarTarget.contrato_cliente || reativarTarget.contrato_titulo || "Contrato",
        statusAtual: contrato?.status || reativarTarget.contrato_status || "inativo",
        novoStatus: "ativo",
      };
    }
    const lead = leads.find(l => l.id === reativarTarget.lead_id);
    return {
      tipo: "lead" as const,
      nome: reativarTarget.lead_nome || "Lead",
      statusAtual: lead?.estagio || reativarTarget.lead_estagio || "inativo",
      novoStatus: "novos",
    };
  }, [reativarTarget, leads, contratos]);

  const handleReativar = async () => {
    if (!reativarTarget || !reativarInfo) return;
    setReativando(true);
    const quandoISO = new Date().toISOString();
    const quandoBR = new Date().toLocaleString("pt-BR");
    const quemNome = (user?.user_metadata as any)?.nome || user?.email || "Usuário";
    try {
      if (reativarInfo.tipo === "contrato" && reativarTarget.contrato_id) {
        // Optimistic: flip contrato_status locally so the pending counts include it right away.
        const contratoId = reativarTarget.contrato_id;
        patchFollowups(prev => prev.map(f => f.contrato_id === contratoId ? { ...f, contrato_status: "ativo" } : f));
        await updateContrato(contratoId, { status: "ativo" } as any);
        // Log em notifications (não há contrato_atividades)
        if (imobiliariaId) {
          await supabase.from("notifications").insert({
            user_id: imobiliariaId,
            title: "🔄 Contrato reativado",
            description: `${quemNome} reativou o contrato "${reativarInfo.nome}" em ${quandoBR}. Status: ${reativarInfo.statusAtual} → ${reativarInfo.novoStatus}.`,
          } as any);
        }
      } else if (reativarTarget.lead_id && imobiliariaId) {
        const leadId = reativarTarget.lead_id;
        patchFollowups(prev => prev.map(f => f.lead_id === leadId ? { ...f, lead_estagio: "novos" } : f));
        await updateLead(leadId, { estagio: "novos", motivo_perda: null } as any);
        await supabase.from("lead_atividades").insert({
          lead_id: leadId,
          imobiliaria_id: imobiliariaId,
          tipo: "reativacao",
          titulo: "Lead reativado",
          descricao: `${quemNome} reabriu o lead em ${quandoBR}. Estágio: ${reativarInfo.statusAtual} → ${reativarInfo.novoStatus}. (via Follow-ups)`,
        } as any);
      }
      toast.success(
        reativarInfo.tipo === "contrato"
          ? `Contrato reativado (status: ativo). Follow-up voltou ao fluxo.`
          : `Lead reaberto (estágio: novos). Follow-up voltou ao pipeline.`,
        { description: `Registrado em ${quandoBR} por ${quemNome}` }
      );
      setReativarTarget(null);
      await refetch();
      invalidateCounts();
    } catch (err: any) {
      toast.error("Erro ao reativar", { description: err?.message || "Tente novamente." });
    } finally {
      setReativando(false);
    }
    void quandoISO;
  };
  const {
    open: formOpen,
    selectedItem: editingFollowup,
    openCreate,
    openEdit,
    handleOpenChange,
  } = useDialogPersistence<Followup>({
    storageKey: "followups_dialog_state",
    items: followups,
    getId: (item) => item.id,
  });

  // Derived data — exclui leads inativos (fechado/perdido) das contagens
  const pendentes = useMemo(
    () => followups.filter(f => f.status === "pendente" && !isFollowupAlvoInativo(f)),
    [followups]
  );
  const inativosPendentes = useMemo(
    () => followups.filter(f => f.status === "pendente" && isFollowupAlvoInativo(f)),
    [followups]
  );
  const inativosBreakdown = useMemo(() => {
    const leadsIds = new Set<string>();
    const contratosIds = new Set<string>();
    let orfaos = 0;
    for (const f of inativosPendentes) {
      if (f.contrato_id) contratosIds.add(f.contrato_id);
      else if (f.lead_id) leadsIds.add(f.lead_id);
      else orfaos += 1;
    }
    return {
      total: inativosPendentes.length,
      leadsCount: leadsIds.size,
      contratosCount: contratosIds.size,
      orfaos,
      followupsLeads: inativosPendentes.filter(f => f.lead_id && !f.contrato_id).length,
      followupsContratos: inativosPendentes.filter(f => f.contrato_id).length,
    };
  }, [inativosPendentes]);
  
  // Se o usuário selecionou explicitamente ver inativos, as contagens passam a considerá-los
  const incluirInativosNasContagens =
    filterPrazo === "inativos" ||
    filterStatus === "concluido" ||
    filterStatus === "perdido";

  // Consulta agregada no servidor (uma única RPC devolve as 4 contagens)
  const { counts: serverCounts, loading: countsLoading, refetch: refetchCounts } = useFollowupCounts({
    includeInactive: incluirInativosNasContagens,
    semContatoDays: semContatoDias,
  });

  // Invalidação coalescida: múltiplas mutações próximas viram um único refetch.
  const invalidateTimer = useRef<number | null>(null);
  const invalidateCounts = useCallback(() => {
    if (invalidateTimer.current) window.clearTimeout(invalidateTimer.current);
    invalidateTimer.current = window.setTimeout(() => {
      invalidateTimer.current = null;
      refetchCounts();
    }, 150);
  }, [refetchCounts]);
  useEffect(() => () => {
    if (invalidateTimer.current) window.clearTimeout(invalidateTimer.current);
  }, []);

  const basePendentes = useMemo(
    () => (incluirInativosNasContagens ? [...pendentes, ...inativosPendentes] : pendentes),
    [pendentes, inativosPendentes, incluirInativosNasContagens]
  );

  const hojeList = useMemo(() =>
    basePendentes.filter(f => isToday(parseISO(f.data_followup))), [basePendentes]);

  const atrasados = useMemo(() =>
    basePendentes.filter(f => isPast(parseISO(f.data_followup)) && !isToday(parseISO(f.data_followup))), [basePendentes]);

  const semanaList = useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeek(now, { locale: ptBR });
    const weekEnd = endOfWeek(now, { locale: ptBR });
    return basePendentes.filter(f => {
      const d = parseISO(f.data_followup);
      return isWithinInterval(d, { start: weekStart, end: weekEnd });
    });
  }, [basePendentes]);

  const semContato7dias = useMemo(() => {
    const now = new Date();
    return leads.filter(l => {
      if (!incluirInativosNasContagens && (l.estagio === "perdido" || l.estagio === "fechado")) return false;
      const lastFollowup = followups
        .filter(f => f.lead_id === l.id)
        .sort((a, b) => b.data_followup.localeCompare(a.data_followup))[0];
      if (!lastFollowup) return differenceInDays(now, parseISO(l.created_at)) > semContatoDias;
      return differenceInDays(now, parseISO(lastFollowup.data_followup)) > semContatoDias;
    });
  }, [leads, followups, incluirInativosNasContagens, semContatoDias]);


  // Filter logic
  const filtered = useMemo(() => {
    let result = followups;
    // Por padrão, esconde follow-ups de leads inativos (fechado/perdido) — só aparecem quando o usuário busca por eles
    const querendoInativos =
      filterPrazo === "inativos" ||
      filterStatus === "concluido" ||
      filterStatus === "perdido" ||
      (search && "inativo fechado perdido".includes(search.toLowerCase()));
    if (!querendoInativos) {
      result = result.filter(f => !isFollowupAlvoInativo(f));
    }
    if (filterAlvo === "leads") result = result.filter(f => !!f.lead_id);
    if (filterAlvo === "contratos") result = result.filter(f => !!f.contrato_id);
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(f =>
        f.lead_nome?.toLowerCase().includes(s) ||
        f.lead_telefone?.includes(s) ||
        f.contrato_titulo?.toLowerCase().includes(s) ||
        f.contrato_cliente?.toLowerCase().includes(s) ||
        f.descricao?.toLowerCase().includes(s)
      );
    }
    if (filterStatus !== "todos") result = result.filter(f => f.status === filterStatus);
    if (filterTipo !== "todos") result = result.filter(f => f.tipo === filterTipo);
    if (filterPrazo === "hoje") result = result.filter(f => isToday(parseISO(f.data_followup)));
    if (filterPrazo === "atrasados") result = result.filter(f => isPast(parseISO(f.data_followup)) && !isToday(parseISO(f.data_followup)) && f.status === "pendente");
    if (filterPrazo === "semana") {
      const now = new Date();
      const weekStart = startOfWeek(now, { locale: ptBR });
      const weekEnd = endOfWeek(now, { locale: ptBR });
      result = result.filter(f => isWithinInterval(parseISO(f.data_followup), { start: weekStart, end: weekEnd }));
    }
    if (filterPrazo === "inativos") {
      result = result.filter(f => isFollowupAlvoInativo(f));
    }
    const nomeDe = (f: Followup) => (f.contrato_id ? (f.contrato_cliente || f.contrato_titulo || "") : (f.lead_nome || "")).toLowerCase();
    const dir = sortDir === "asc" ? 1 : -1;
    return [...result].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "cliente") cmp = nomeDe(a).localeCompare(nomeDe(b));
      else if (sortKey === "tipo") cmp = (a.tipo || "").localeCompare(b.tipo || "");
      else if (sortKey === "status") cmp = (a.status || "").localeCompare(b.status || "");
      else cmp = a.data_followup.localeCompare(b.data_followup);
      if (cmp === 0) cmp = a.data_followup.localeCompare(b.data_followup);
      return cmp * dir;
    });
  }, [followups, search, filterStatus, filterTipo, filterPrazo, filterAlvo, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedFollowups = useMemo(
    () => filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filtered, currentPage, pageSize]
  );
  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };
  const sortArrow = (key: SortKey) => (sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : "");


  const hasActiveFilters = filterStatus !== "todos" || filterTipo !== "todos" || filterPrazo !== "todos" || filterAlvo !== "todos" || search !== "";

  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  const doClearFilters = () => {
    setFilterStatus("todos");
    setFilterTipo("todos");
    setFilterPrazo("todos");
    setFilterAlvo("todos");
    setSearch("");
    setSortKey("data");
    setSortDir("asc");
    setPageSize(25);
    setPage(1);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    toast.success("Filtros limpos");
  };

  const clearFilters = () => {
    if (!hasActiveFilters) return;
    setConfirmClearOpen(true);
  };

  const handleSave = async (data: { id?: string; lead_id?: string | null; contrato_id?: string | null; data_followup: string; tipo: string; descricao?: string; resultado?: string }) => {
    setSaving(true);
    try {
      if (data.id) {
        await updateFollowup(data.id, { data_followup: data.data_followup, tipo: data.tipo, descricao: data.descricao, resultado: data.resultado });
      } else {
        await createFollowup({
          lead_id: data.lead_id ?? null,
          contrato_id: data.contrato_id ?? null,
          data_followup: data.data_followup,
          tipo: data.tipo,
          descricao: data.descricao,
        });
      }
      handleOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const handleConcluir = (f: Followup) => {
    setConcluirFollowup(f);
    setResultadoText(f.resultado || "");
    setConcluirOpen(true);
  };

  const confirmConcluir = async () => {
    if (!concluirFollowup) return;
    await updateFollowup(concluirFollowup.id, { status: "concluido", resultado: resultadoText || null } as any);
    setConcluirOpen(false);
    setConcluirFollowup(null);
    setResultadoText("");
    invalidateCounts();
    toast.success("Follow-up concluído!");
  };

  const handleQuickMsg = (followup: Followup) => {
    setSelectedFollowup(followup);
    setQuickMsgOpen(true);
  };

  const sendViaWhatsApp = (phone: string | null, msg: string) => {
    if (!phone) { toast.error("Telefone não cadastrado"); return; }
    const clean = phone.replace(/\D/g, "");
    window.open(`https://wa.me/55${clean}?text=${encodeURIComponent(msg)}`, "_blank");
    setQuickMsgOpen(false);
  };

  const sendViaEmail = (email: string | null, msg: string) => {
    if (!email) { toast.error("E-mail não cadastrado"); return; }
    window.open(`mailto:${email}?subject=Follow-up Imobiliário&body=${encodeURIComponent(msg)}`, "_blank");
    setQuickMsgOpen(false);
  };

  const callPhone = (phone: string | null) => {
    if (!phone) { toast.error("Telefone não cadastrado"); return; }
    window.open(`tel:+55${phone.replace(/\D/g, "")}`, "_blank");
    setQuickMsgOpen(false);
  };

  const getStatusBadge = (status: string) => {
    const s = STATUS_OPTIONS.find(o => o.id === status);
    return (
      <Badge variant="outline" className="text-[10px] gap-1">
        <span className={`w-1.5 h-1.5 rounded-full ${s?.color || "bg-muted"}`} />
        {s?.label || status}
      </Badge>
    );
  };

  const getPriorityBadge = (f: Followup) => {
    const d = parseISO(f.data_followup);
    if (f.status !== "pendente") return null;
    if (isPast(d) && !isToday(d)) return <Badge className="bg-destructive/10 text-destructive border-destructive/30 text-[10px]">🔴 Atrasado</Badge>;
    if (isToday(d)) return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30 text-[10px]">🟡 Hoje</Badge>;
    const days = differenceInDays(d, new Date());
    if (days <= 3) return <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/30 text-[10px]">🟠 Próximo</Badge>;
    return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/30 text-[10px]">🔵 Agendado</Badge>;
  };

  // Performance metrics
  const totalFollowups = followups.length;
  const concluidos = followups.filter(f => f.status === "concluido").length;
  const taxaConclusao = totalFollowups > 0 ? ((concluidos / totalFollowups) * 100).toFixed(0) : "0";

  return (
    <DashboardLayout>
      <SectionHeader
        title="Follow-up"
        subtitle="Gerencie todos os retornos e acompanhamentos de clientes"
        action={
          <div className="flex items-center gap-2 flex-wrap">
            {inativosPendentes.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEncerrarInativosOpen(true)}
                title="Encerra os follow-ups pendentes cujo lead ou contrato já foi fechado, perdido ou desativado"
              >
                <Check className="w-4 h-4 mr-1" />Encerrar inativos ({inativosPendentes.length})
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setFilterPrazo("inativos"); setShowFilters(true); }}
              title="Ver follow-ups de leads inativos"
            >
              Ver inativos
            </Button>
            <Button variant={showFilters ? "default" : "outline"} size="sm" onClick={() => setShowFilters(!showFilters)}>
              <Filter className="w-4 h-4 mr-1" />Filtros{hasActiveFilters && " ●"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const url = window.location.href;
                try {
                  await navigator.clipboard.writeText(url);
                  toast.success("Link copiado", { description: "URL da visualização atual copiada para a área de transferência." });
                } catch {
                  toast.error("Não foi possível copiar", { description: url });
                }
              }}
              title="Copiar link com os filtros atuais"
            >
              <Share2 className="w-4 h-4 mr-1" />Compartilhar
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="w-4 h-4 mr-1" />Adicionar Follow-up
            </Button>
          </div>
        }
      />

      {/* 1. PAINEL DE PRIORIDADE */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => { setFilterPrazo("hoje"); setShowFilters(true); }}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-yellow-500" />
              <span className="text-xs font-medium text-muted-foreground">Hoje</span>
            </div>
            {(loading || countsLoading) && !serverCounts ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-2xl font-bold text-foreground flex items-center gap-2">
                {serverCounts?.hoje ?? hojeList.length}
                {countsLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
              </p>
            )}
            <p className="text-[11px] text-muted-foreground">follow-ups para hoje</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-destructive/50 transition-colors" onClick={() => { setFilterPrazo("atrasados"); setShowFilters(true); }}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              <span className="text-xs font-medium text-muted-foreground">Atrasados</span>
            </div>
            {(loading || countsLoading) && !serverCounts ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-2xl font-bold text-destructive flex items-center gap-2">
                {serverCounts?.atrasados ?? atrasados.length}
                {countsLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-destructive/70" />}
              </p>
            )}
            <p className="text-[11px] text-muted-foreground">precisam de atenção</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => { setFilterPrazo("semana"); setShowFilters(true); }}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <CalendarDays className="w-4 h-4 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">Esta Semana</span>
            </div>
            {(loading || countsLoading) && !serverCounts ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-2xl font-bold text-foreground flex items-center gap-2">
                {serverCounts?.semana ?? semanaList.length}
                {countsLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary/70" />}
              </p>
            )}
            <p className="text-[11px] text-muted-foreground">agendados na semana</p>
          </CardContent>
        </Card>

        <Card className="hover:border-orange-500/50 transition-colors">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-orange-500" />
              <span className="text-xs font-medium text-muted-foreground">Sem Contato {semContatoDias}d+</span>
              <Select value={String(semContatoDias)} onValueChange={(v) => setSemContatoDias(Number(v))}>
                <SelectTrigger className="h-6 w-[70px] ml-auto text-[11px] px-2" onClick={(e) => e.stopPropagation()}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEM_CONTATO_OPCOES.map(d => (
                    <SelectItem key={d} value={String(d)} className="text-xs">{d} dias</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <button
              type="button"
              onClick={() => toast.info(`${semContato7dias.length} clientes sem contato há mais de ${semContatoDias} dias`)}
              className="text-left w-full"
            >
              {(loading || countsLoading) && !serverCounts ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <p className="text-2xl font-bold text-orange-500 flex items-center gap-2">
                  {serverCounts?.sem_contato ?? semContato7dias.length}
                  {countsLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-500/70" />}
                </p>
              )}
              <p className="text-[11px] text-muted-foreground">clientes esquecidos</p>
            </button>
          </CardContent>
        </Card>
      </div>

      {/* FILTROS */}
      {showFilters && (
        <div className="flex flex-wrap items-end gap-3 mb-4 p-3 rounded-xl bg-muted/30 border border-border">
          <div className="flex-1 min-w-[180px]">
            <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Buscar</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nome, telefone..." className="pl-8 h-8 text-sm" />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Status</label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-8 w-[150px] text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {STATUS_OPTIONS.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Tipo</label>
            <Select value={filterTipo} onValueChange={setFilterTipo}>
              <SelectTrigger className="h-8 w-[130px] text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {Object.entries(TIPO_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Prazo</label>
            <Select value={filterPrazo} onValueChange={setFilterPrazo}>
              <SelectTrigger className="h-8 w-[130px] text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="hoje">Hoje</SelectItem>
                <SelectItem value="atrasados">Atrasados</SelectItem>
                <SelectItem value="semana">Esta semana</SelectItem>
                <SelectItem value="inativos">Alvos inativos (fechado/cancelado)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Vínculo</label>
            <Select value={filterAlvo} onValueChange={(v) => setFilterAlvo(v as any)}>
              <SelectTrigger className="h-8 w-[130px] text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Leads e Contratos</SelectItem>
                <SelectItem value="leads">Somente Leads</SelectItem>
                <SelectItem value="contratos">Somente Contratos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            variant={hasActiveFilters ? "default" : "outline"}
            size="sm"
            onClick={clearFilters}
            disabled={!hasActiveFilters}
            className="h-8"
          >
            <X className="w-3 h-3 mr-1" />Limpar filtros
          </Button>
        </div>
      )}

      {/* 2. LISTA / TABELA DE FOLLOW-UPS */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          {hasActiveFilters ? (
            <>
              <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhum follow-up encontrado com esses filtros.</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={clearFilters}>
                Limpar filtros
              </Button>
            </>
          ) : (
            <>
              <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Parabéns! Você não tem follow-ups pendentes no momento.</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={openCreate}>
                <Plus className="w-4 h-4 mr-1" />Criar primeiro follow-up
              </Button>
            </>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden mb-6">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>
                  <button type="button" onClick={() => toggleSort("cliente")} className="hover:text-foreground transition-colors">Cliente{sortArrow("cliente")}</button>
                </TableHead>
                <TableHead className="hidden md:table-cell">Telefone</TableHead>
                <TableHead>
                  <button type="button" onClick={() => toggleSort("tipo")} className="hover:text-foreground transition-colors">Tipo{sortArrow("tipo")}</button>
                </TableHead>
                <TableHead className="hidden lg:table-cell">Imóvel</TableHead>
                <TableHead className="hidden md:table-cell">Último Contato</TableHead>
                <TableHead>
                  <button type="button" onClick={() => toggleSort("data")} className="hover:text-foreground transition-colors">Próximo Contato{sortArrow("data")}</button>
                </TableHead>
                <TableHead>
                  <button type="button" onClick={() => toggleSort("status")} className="hover:text-foreground transition-colors">Status{sortArrow("status")}</button>
                </TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead className="hidden lg:table-cell">Resultado</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedFollowups.map(f => {
                const lead = leads.find(l => l.id === f.lead_id);
                const imovel = lead?.interesse ? imoveis.find(i => i.titulo?.toLowerCase().includes(lead.interesse!.toLowerCase())) : null;
                return (
                  <TableRow key={f.id} className="group">
                    <TableCell>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium text-sm text-foreground">
                            {f.contrato_id ? (f.contrato_cliente || f.contrato_titulo || "Contrato") : (f.lead_nome || "—")}
                          </p>
                          {f.contrato_id && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 border-primary/40 text-primary">
                              📄 {f.contrato_tipo || "Contrato"}
                            </Badge>
                          )}
                        </div>
                        {f.contrato_id
                          ? <p className="text-[11px] text-muted-foreground">{f.contrato_titulo}</p>
                          : (f.lead_email && <p className="text-[11px] text-muted-foreground">{f.lead_email}</p>)}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {f.lead_telefone || "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-sm text-foreground">
                        {TIPO_ICONS[f.tipo] || TIPO_ICONS.outro}
                        <span className="hidden sm:inline">{TIPO_LABELS[f.tipo] || f.tipo}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {f.contrato_id ? (f.contrato_titulo || "—") : (lead?.interesse || imovel?.titulo || "—")}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-[12px] text-muted-foreground">
                      {format(parseISO(f.created_at), "dd/MM/yy")}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p className="font-medium">{format(parseISO(f.data_followup), "dd/MM/yy")}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(parseISO(f.data_followup), { addSuffix: true, locale: ptBR })}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(f.status)}</TableCell>
                    <TableCell>{getPriorityBadge(f)}</TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {f.resultado ? (
                        <span className="text-xs text-muted-foreground line-clamp-2">{f.resultado}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground/50 italic">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleQuickMsg(f)} title="Enviar Follow-up">
                          <Send className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(f)} title="Editar">
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                         {f.status === "pendente" && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={() => handleConcluir(f)} title="Concluir">
                            <Check className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        {isFollowupAlvoInativo(f) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-emerald-600 hover:text-emerald-700"
                            onClick={() => setReativarTarget(f)}
                            title={f.contrato_id ? "Reativar contrato" : "Reabrir lead"}
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteFollowup(f.id)} title="Excluir">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 border-t border-border bg-muted/20 text-xs">
            <div className="text-muted-foreground">
              {filtered.length === 0
                ? "Nenhum resultado"
                : `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filtered.length)} de ${filtered.length}`}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Por página:</span>
              <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                <SelectTrigger className="h-7 w-[70px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPCOES.map(n => <SelectItem key={n} value={String(n)} className="text-xs">{n}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" className="h-7 px-2" disabled={currentPage <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Anterior</Button>
              <span className="text-muted-foreground">Pág. {currentPage}/{totalPages}</span>
              <Button variant="outline" size="sm" className="h-7 px-2" disabled={currentPage >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Próxima</Button>
            </div>
          </div>
        </div>
      )}

      {/* 6. ALERTA CLIENTES ESQUECIDOS */}
      {semContato7dias.length > 0 && (
        <Card className="mb-6 border-orange-500/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-500" />
              Follow-up Urgente — Clientes sem contato há {semContatoDias}+ dias
              <Badge variant="outline" className="ml-auto text-orange-500 border-orange-500/30">{semContato7dias.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {semContato7dias.slice(0, 9).map(lead => {
                const lastFu = followups
                  .filter(f => f.lead_id === lead.id)
                  .sort((a, b) => b.data_followup.localeCompare(a.data_followup))[0];
                const diasSem = lastFu
                  ? differenceInDays(new Date(), parseISO(lastFu.data_followup))
                  : differenceInDays(new Date(), parseISO(lead.created_at));
                return (
                  <div key={lead.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/20">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{lead.nome}</p>
                      <p className="text-[11px] text-muted-foreground">{lead.telefone || lead.email || "Sem contato"}</p>
                    </div>
                    <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/30 text-[10px] shrink-0">
                      {diasSem}d sem contato
                    </Badge>
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7 shrink-0"
                      onClick={openCreate}
                      title="Criar follow-up"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>
            {semContato7dias.length > 9 && (
              <p className="text-xs text-muted-foreground mt-3 text-center">
                e mais {semContato7dias.length - 9} clientes...
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* 8. DASHBOARD DE PERFORMANCE */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Follow-ups Feitos</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{totalFollowups}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Check className="w-4 h-4 text-green-500" />
              <span className="text-xs text-muted-foreground">Concluídos</span>
            </div>
            <p className="text-2xl font-bold text-green-500">{concluidos}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Taxa Conclusão</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{taxaConclusao}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              <span className="text-xs text-muted-foreground">Pendentes</span>
            </div>
            <p className="text-2xl font-bold text-destructive">{pendentes.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* CONFIRMAÇÃO ENCERRAR INATIVOS */}
      <AlertDialog open={encerrarInativosOpen} onOpenChange={setEncerrarInativosOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Encerrar follow-ups de alvos inativos?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>
                  Esta ação vai marcar como <strong>concluído</strong> todos os follow-ups pendentes vinculados a leads
                  ou contratos que já estão fechados, perdidos, cancelados ou inativos.
                </p>
                <div className="rounded-md border border-border bg-muted/40 p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Total de follow-ups a encerrar</span>
                    <Badge variant="secondary" className="font-semibold">{inativosBreakdown.total}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">De leads inativos</span>
                    <span className="font-medium">
                      {inativosBreakdown.followupsLeads} follow-up(s) · {inativosBreakdown.leadsCount} lead(s)
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">De contratos inativos</span>
                    <span className="font-medium">
                      {inativosBreakdown.followupsContratos} follow-up(s) · {inativosBreakdown.contratosCount} contrato(s)
                    </span>
                  </div>
                  {inativosBreakdown.orfaos > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Órfãos (sem vínculo)</span>
                      <span className="font-medium">{inativosBreakdown.orfaos}</span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Você poderá reabrir manualmente qualquer follow-up depois, se necessário.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={encerrandoInativos}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={encerrandoInativos || inativosBreakdown.total === 0}
              onClick={async (e) => {
                e.preventDefault();
                setEncerrandoInativos(true);
                try {
                  await concluirFollowupsInativos();
                  invalidateCounts();
                  setEncerrarInativosOpen(false);
                } finally {
                  setEncerrandoInativos(false);
                }
              }}
            >
              {encerrandoInativos ? "Encerrando..." : `Encerrar ${inativosBreakdown.total}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmar limpeza de filtros */}
      <AlertDialog open={confirmClearOpen} onOpenChange={setConfirmClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limpar todos os filtros?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso vai redefinir status, tipo, prazo, alvo, busca, ordenação e paginação para os valores padrão. A ação não pode ser desfeita, mas você pode reaplicar os filtros manualmente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                doClearFilters();
                setConfirmClearOpen(false);
              }}
            >
              Limpar filtros
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      {/* Reabrir lead / Reativar contrato */}
      <AlertDialog open={!!reativarTarget} onOpenChange={(open) => !open && setReativarTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-emerald-600" />
              {reativarInfo?.tipo === "contrato" ? "Reativar contrato?" : "Reabrir lead?"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>
                  {reativarInfo?.tipo === "contrato"
                    ? "O contrato voltará ao status ativo e seus follow-ups voltarão a aparecer no fluxo padrão."
                    : "O lead voltará ao pipeline (estágio inicial) e seus follow-ups voltarão a aparecer no fluxo padrão. O motivo de perda será removido."}
                </p>
                {reativarInfo && (
                  <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Alvo</span>
                      <span className="font-medium">{reativarInfo.nome}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Status atual</span>
                      <Badge variant="outline" className="text-[10px] border-destructive/40 text-destructive">
                        {reativarInfo.statusAtual}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Novo status</span>
                      <Badge className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                        {reativarInfo.novoStatus}
                      </Badge>
                    </div>
                  </div>
                )}
                <p className="text-[11px] text-amber-600 flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  Esta ação altera o status do {reativarInfo?.tipo === "contrato" ? "contrato" : "lead"} e pode disparar automações vinculadas.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reativando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleReativar(); }}
              disabled={reativando}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {reativando ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Reativando...</>
              ) : (
                <><RotateCcw className="w-4 h-4 mr-2" />Confirmar reativação</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* FORM DIALOG */}
      <FollowupFormDialog
        open={formOpen}
        onOpenChange={handleOpenChange}
        leads={leads.filter(l => l.estagio !== "perdido" && l.estagio !== "fechado")}
        contratos={contratos}
        onSave={handleSave}
        saving={saving}
        editingFollowup={editingFollowup}
      />

      {/* 3. QUICK MESSAGE DIALOG */}
      <Dialog open={quickMsgOpen} onOpenChange={setQuickMsgOpen}>
        <DialogContent className="bg-card border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-4 h-4" />
              Enviar Follow-up — {selectedFollowup?.lead_nome}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Escolha uma mensagem e o canal de envio:</p>
            {MENSAGENS_PRONTAS.map((msg, i) => (
              <div key={i} className="p-3 rounded-lg border border-border bg-muted/20 space-y-2">
                <p className="text-sm text-foreground">{msg}</p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => sendViaWhatsApp(selectedFollowup?.lead_telefone ?? null, msg)}>
                    <MessageCircle className="w-3 h-3 mr-1" />WhatsApp
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => sendViaEmail(selectedFollowup?.lead_email ?? null, msg)}>
                    <Mail className="w-3 h-3 mr-1" />E-mail
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => callPhone(selectedFollowup?.lead_telefone ?? null)}>
                    <Phone className="w-3 h-3 mr-1" />Ligar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* CONCLUIR FOLLOW-UP DIALOG */}
      <Dialog open={concluirOpen} onOpenChange={setConcluirOpen}>
        <DialogContent className="bg-card border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="w-4 h-4 text-primary" />
              Concluir Follow-up — {concluirFollowup?.lead_nome}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Descreva o que foi realizado neste follow-up:</p>
            <Textarea
              value={resultadoText}
              onChange={e => setResultadoText(e.target.value)}
              placeholder="Ex: Cliente demonstrou interesse, agendou visita para sexta-feira..."
              rows={4}
              className="border-primary/30"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConcluirOpen(false)}>Cancelar</Button>
            <Button onClick={confirmConcluir}>
              <Check className="w-4 h-4 mr-1" /> Concluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Followups;
