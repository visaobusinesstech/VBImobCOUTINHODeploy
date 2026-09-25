import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PipelineSkeleton } from "@/components/shared/PageSkeletons";
import { SectionHeader } from "@/components/shared/MetricCard";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useGlobalSearch } from "@/contexts/GlobalSearchContext";
import { Plus, Loader2, Download, Filter, X, CalendarClock, AlertTriangle, Upload, FileSpreadsheet, Search, Zap, History, ArrowRightLeft, ContactRound, Bell } from "lucide-react";
import { exportToPDF } from "@/lib/exportPDF";
import { exportToExcel } from "@/lib/exportExcel";
import { hasPlanoAccess } from "@/lib/planoAccess";

import {
  PIPELINE_PDF_COLUMNS,
  PIPELINE_CSV_COLUMNS,
  buildPipelinePdfSummary,
  buildPipelinePdfRows,
  buildPipelineCsvRows,
  buildPipelineExportSubtitle,
  buildPipelineExportFileName,
  type PipelineExportFilters,
} from "@/lib/pipelineLeadsExport";
import { useLeads, ESTAGIOS as ESTAGIOS_FALLBACK, type Lead } from "@/hooks/useLeads";
import { usePipelineEstagios } from "@/hooks/usePipelineEstagios";
import { PipelineEstagiosDialog } from "@/components/pipeline/PipelineEstagiosDialog";
import { Settings2, Target, Activity } from "lucide-react";
import { useFollowups } from "@/hooks/useFollowups";
import { useCompromissos } from "@/hooks/useCompromissos";
import { usePropostas } from "@/hooks/usePropostas";
import { useImoveis } from "@/hooks/useImoveis";
import { useImobiliariaConfig } from "@/hooks/useImobiliariaConfig";
import { useContratos } from "@/hooks/useContratos";
import { useTransacoes } from "@/hooks/useTransacoes";
import { useToast } from "@/hooks/use-toast";
import { LeadCard } from "@/components/pipeline/LeadCard";
import { PipelineThemeSelector, usePipelineTheme } from "@/components/pipeline/PipelineThemeSelector";
import { LeadFormDialog } from "@/components/pipeline/LeadFormDialog";
import { FollowupFormDialog } from "@/components/pipeline/FollowupFormDialog";
import { FollowupPanel } from "@/components/pipeline/FollowupPanel";
import { LeadsContatoPanel } from "@/components/pipeline/LeadsContatoPanel";
import { LeadNotificacoesPanel } from "@/components/pipeline/LeadNotificacoesPanel";
import { CruzamentoDemandaPanel } from "@/components/pipeline/CruzamentoDemandaPanel";
import { AcoesTempoRealPanel } from "@/components/pipeline/AcoesTempoRealPanel";
import { useLeadContatoAlertas } from "@/hooks/useLeadContatoAlertas";
import { CompromissoFormDialog } from "@/components/agenda/CompromissoFormDialog";
import { PropostaFormDialog } from "@/components/propostas/PropostaFormDialog";
import { ImportExportLeadsDialog } from "@/components/pipeline/ImportLeadsDialog";
import { TransferLeadsDialog } from "@/components/pipeline/TransferLeadsDialog";
import { LeadHistoryDialog } from "@/components/pipeline/LeadHistoryDialog";
import { WebResearchDialog } from "@/components/shared/WebResearchDialog";
import { useAuth } from "@/contexts/AuthContext";

import { FechamentoLeadDialog } from "@/components/pipeline/FechamentoLeadDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const PIPELINE_DIALOG_KEY = "pipeline_dialog_state";

const MOTIVOS_PERDA = [
  { id: "desistiu", label: "Desistiu da compra/aluguel" },
  { id: "concorrente", label: "Comprou com concorrente" },
  { id: "sem_resposta", label: "Sem resposta / Não retornou" },
  { id: "financeiro", label: "Problema financeiro" },
  { id: "outro", label: "Outro motivo" },
];

const getStorage = () => (typeof window === "undefined" ? null : window.localStorage);

const normalizeSearchText = (value: string | null | undefined) =>
  (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const Pipeline = () => {
  const { isMaster, user, plano } = useAuth();
  const canImportExport = isMaster || hasPlanoAccess(plano ?? "", "profissional");

  const [propostaOpen, setPropostaOpen] = useState(false);
  const [propostaLead, setPropostaLead] = useState<Lead | null>(null);
  const [propostaSaving, setPropostaSaving] = useState(false);
  const { leads, loading, corretores, createLead, updateLead, deleteLead, moveLead, getLeadsByEstagio, refetch: refetchLeads } = useLeads();
  const { estagios: estagiosDinamicos } = usePipelineEstagios();
  const ESTAGIOS = useMemo(
    () => (estagiosDinamicos.length > 0
      ? estagiosDinamicos.map((e) => ({ id: e.slug, title: e.title, color: e.color }))
      : ESTAGIOS_FALLBACK),
    [estagiosDinamicos],
  );
  const [editarPipelineOpen, setEditarPipelineOpen] = useState(false);
  const { followups, atrasados, hoje, createFollowup, updateFollowup, deleteFollowup, refetch: refetchFollowups } = useFollowups();
  const { createCompromisso } = useCompromissos({ enabled: false });
  const { propostas, createProposta } = usePropostas();
  const { imoveis } = useImoveis({ suppressFetchErrors: true, enabled: propostaOpen });
  const { nome_empresa, sla_primeiro_contato_horas, sla_recontato_dias, pipeline_tema_default } = useImobiliariaConfig();
  const { theme, setTheme, themeClass, hasOverride, tenantDefault, resetToTenantDefault } = usePipelineTheme(pipeline_tema_default);

  const { createContrato } = useContratos({ enabled: false });
  const { createTransacao } = useTransacoes({ enabled: false });
  const { toast: pipelineToast } = useToast();
  const [followupOpen, setFollowupOpen] = useState(false);
  const [followupLeadId, setFollowupLeadId] = useState<string | undefined>();
  const [showFollowups, setShowFollowups] = useState(false);
  const [showContatos, setShowContatos] = useState(false);
  const [showNotificacoes, setShowNotificacoes] = useState(false);
  const [showCruzamento, setShowCruzamento] = useState(false);
  const [showAcoes, setShowAcoes] = useState(false);
  const [followupSaving, setFollowupSaving] = useState(false);
  const [compromissoOpen, setCompromissoOpen] = useState(false);
  const [compromissoLeadId, setCompromissoLeadId] = useState<string | undefined>();
  const [compromissoSaving, setCompromissoSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<Lead | null>(null);
  const [deleteItem, setDeleteItem] = useState<Lead | null>(null);
  const [saving, setSaving] = useState(false);
  const [defaultEstagio, setDefaultEstagio] = useState("novos");
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filterEstagio, setFilterEstagio] = useState("todos");
  const [filterCorretor, setFilterCorretor] = useState("todos");
  const [filterValorMin, setFilterValorMin] = useState("");
  const [filterValorMax, setFilterValorMax] = useState("");
  const [pendingPerdido, setPendingPerdido] = useState<{ leadId: string; posicao: number } | null>(null);
  const [motivoPerda, setMotivoPerda] = useState("");
  const [motivoDetalhe, setMotivoDetalhe] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [pendingFechado, setPendingFechado] = useState<{ leadId: string; posicao: number } | null>(null);
  const [visibleCount, setVisibleCount] = useState<Record<string, number>>({});
  const [fechadoSaving, setFechadoSaving] = useState(false);
  const { globalSearch, setGlobalSearch } = useGlobalSearch();
  const [searchQuery, setSearchQuery] = useState(globalSearch);
  const [leadScores, setLeadScores] = useState<Record<string, { score: number; classification: string; emoji: string }>>({});
  const [scoringLoading, setScoringLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLead, setHistoryLead] = useState<Lead | null>(null);

  // Sync global search → local search
  useEffect(() => {
    setSearchQuery(globalSearch);
  }, [globalSearch]);

  // Sync local search → global search
  useEffect(() => {
    setGlobalSearch(searchQuery);
  }, [searchQuery, setGlobalSearch]);

  const propostasCountByLead = useMemo(() => {
    const map = new Map<string, number>();
    propostas.forEach(p => {
      if (p.lead_id) map.set(p.lead_id, (map.get(p.lead_id) || 0) + 1);
    });
    return map;
  }, [propostas]);

  const handleLeadScoring = useCallback(async () => {
    setScoringLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("lead-scoring", {
        body: { imobiliaria_id: leads[0]?.imobiliaria_id },
      });
      if (error) throw error;
      const scores: Record<string, any> = {};
      (data?.scores || []).forEach((s: any) => {
        scores[s.lead_id] = { score: s.score, classification: s.classification, emoji: s.emoji };
      });
      setLeadScores(scores);
      pipelineToast({ title: "Lead Scoring concluído!", description: `${Object.keys(scores).length} leads classificados` });
    } catch (err: any) {
      pipelineToast({ title: "Erro no scoring", description: err.message, variant: "destructive" });
    } finally {
      setScoringLoading(false);
    }
  }, [leads, pipelineToast]);

  const hasActiveFilters = filterEstagio !== "todos" || filterCorretor !== "todos" || filterValorMin !== "" || filterValorMax !== "" || searchQuery !== "";

  const clearFilters = () => {
    setFilterEstagio("todos");
    setFilterCorretor("todos");
    setFilterValorMin("");
    setFilterValorMax("");
    setSearchQuery("");
  };

  const filteredLeads = useMemo(() => {
    let result = leads;

    const rawQuery = searchQuery.trim();
    if (rawQuery) {
      const q = normalizeSearchText(rawQuery);
      const qDigits = rawQuery.replace(/\D/g, "");

      result = result.filter((l) => {
        const nomeMatch = normalizeSearchText(l.nome).includes(q);
        const emailMatch = normalizeSearchText(l.email).includes(q);
        const interesseMatch = normalizeSearchText(l.interesse).includes(q);
        const observacoesMatch = normalizeSearchText(l.observacoes).includes(q);
        const telefoneTextMatch = normalizeSearchText(l.telefone).includes(q);
        const telefoneDigits = (l.telefone || "").replace(/\D/g, "");
        const telefoneDigitsMatch = qDigits ? telefoneDigits.includes(qDigits) : false;
        const canalOrigemMatch = normalizeSearchText(l.canal_origem).includes(q);
        const corretorMatch = normalizeSearchText(l.corretor_nome).includes(q);
        const tipoOperacaoMatch = normalizeSearchText(l.tipo_operacao === "venda" ? "venda" : "aluguel").includes(q);
        const estagioMatch = normalizeSearchText(ESTAGIOS.find((e) => e.id === l.estagio)?.title || l.estagio).includes(q);
        const valorDigits = String(Math.round(Number(l.valor || 0))).replace(/\D/g, "");
        const valorMatch = qDigits ? valorDigits.includes(qDigits) : normalizeSearchText(String(l.valor || "")).includes(q);

        return (
          nomeMatch ||
          telefoneTextMatch ||
          telefoneDigitsMatch ||
          emailMatch ||
          interesseMatch ||
          observacoesMatch ||
          canalOrigemMatch ||
          corretorMatch ||
          tipoOperacaoMatch ||
          estagioMatch ||
          valorMatch
        );
      });
    }

    if (filterEstagio !== "todos") result = result.filter(l => l.estagio === filterEstagio);
    if (filterCorretor !== "todos") {
      if (filterCorretor === "__none__") {
        result = result.filter(l => !l.corretor_id);
      } else {
        result = result.filter(l => l.corretor_id === filterCorretor);
      }
    }

    const min = parseFloat(filterValorMin);
    const max = parseFloat(filterValorMax);
    if (!isNaN(min)) result = result.filter(l => l.valor >= min);
    if (!isNaN(max)) result = result.filter(l => l.valor <= max);

    return result;
  }, [leads, searchQuery, filterEstagio, filterCorretor, filterValorMin, filterValorMax]);

  // Alertas automáticos: dispara toast + notificação quando um lead do
  // usuário entra em "Atrasados" ou está prestes a estourar o SLA de contato.
  useLeadContatoAlertas({
    leads: filteredLeads,
    followups,
    slaPrimeiroContatoHoras: sla_primeiro_contato_horas,
    slaRecontatoDias: sla_recontato_dias,
  });

  // Group filtered leads by estagio once (avoids N x cols filtering)
  const leadsByEstagio = useMemo(() => {
    const map = new Map<string, Lead[]>();
    for (const l of filteredLeads) {
      const arr = map.get(l.estagio);
      if (arr) arr.push(l);
      else map.set(l.estagio, [l]);
    }
    map.forEach((arr) => arr.sort((a, b) => a.posicao - b.posicao));
    return map;
  }, [filteredLeads]);

  const getFilteredLeadsByEstagio = useCallback(
    (estagio: string) => leadsByEstagio.get(estagio) ?? [],
    [leadsByEstagio],
  );

  // Fast lookup for overdue followups (avoids O(N*M) .some per card)
  const atrasadosSet = useMemo(
    () => new Set(atrasados.map((f) => f.lead_id)),
    [atrasados],
  );

  // When filtering by estagio, only show that column
  const visibleEstagios = filterEstagio !== "todos" ? ESTAGIOS.filter(e => e.id === filterEstagio) : ESTAGIOS;

  // Persist dialog state
  const persistDialogState = useCallback((isOpen: boolean, editId?: string | null) => {
    const storage = getStorage();
    if (!storage) return;
    if (isOpen) {
      storage.setItem(PIPELINE_DIALOG_KEY, JSON.stringify({ open: true, editId: editId || null }));
    } else {
      storage.removeItem(PIPELINE_DIALOG_KEY);
    }
  }, []);

  // Restore dialog state on mount
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    const storage = getStorage();
    if (!storage) return;
    try {
      const saved = storage.getItem(PIPELINE_DIALOG_KEY);
      if (!saved) return;
      const state = JSON.parse(saved);
      if (!state?.open) return;

      if (state.editId) {
        if (leads.length === 0) return;
        const found = leads.find(l => l.id === state.editId);
        if (!found) return;
        setEditItem(found);
      } else {
        setEditItem(null);
      }
      setFormOpen(true);
      restoredRef.current = true;
    } catch { /* ignore */ }
  }, [leads]);

  const handleFormOpenChange = useCallback((open: boolean) => {
    setFormOpen(open);
    if (!open) {
      persistDialogState(false);
    }
  }, [persistDialogState]);

  const openCreate = (estagio?: string) => {
    setEditItem(null);
    setDefaultEstagio(estagio || "novos");
    persistDialogState(true, null);
    setFormOpen(true);
  };

  const handleSave = async (data: Partial<Lead>) => {
    setSaving(true);
    try {
      if (editItem) {
        const observacoesChanged = data.observacoes && data.observacoes !== editItem.observacoes;
        await updateLead(editItem.id, data);
        // Auto-create follow-up when observações are edited
        if (observacoesChanged) {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          await createFollowup({
            lead_id: editItem.id,
            data_followup: tomorrow.toISOString().split("T")[0],
            tipo: "ligacao",
            descricao: data.observacoes!,
          });
        }
      } else {
        const newLead = await createLead(data);
        // Auto-create follow-up for manually added leads
        if (newLead) {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          await createFollowup({
            lead_id: newLead.id,
            data_followup: tomorrow.toISOString().split("T")[0],
            tipo: "ligacao",
            descricao: data.observacoes || "Primeiro contato — lead adicionado manualmente",
          });
        }
      }
      persistDialogState(false);
      setFormOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    await deleteLead(deleteItem.id);
    setDeleteItem(null);
  };

  const handleDragStart = useCallback((e: React.DragEvent, lead: Lead) => {
    e.dataTransfer.setData("text/plain", lead.id);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, estagioId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverColumn(estagioId);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverColumn(null);
  }, []);

   const handleDrop = useCallback((e: React.DragEvent, estagioId: string) => {
    e.preventDefault();
    setDragOverColumn(null);
    const leadId = e.dataTransfer.getData("text/plain");
    if (!leadId) return;
    const columnLeads = leads.filter(l => l.estagio === estagioId);
    if (estagioId === "perdido") {
      setPendingPerdido({ leadId, posicao: columnLeads.length });
      setMotivoPerda("");
      setMotivoDetalhe("");
      return;
    }

    if (estagioId === "fechado") {
      setPendingFechado({ leadId, posicao: columnLeads.length });
      return;
    }

    moveLead(leadId, estagioId, columnLeads.length);
  }, [leads, moveLead]);

  // Stable card callbacks (so React.memo on LeadCard can skip re-renders)
  const handleCardEdit = useCallback((l: Lead) => {
    setEditItem(l);
    persistDialogState(true, l.id);
    setFormOpen(true);
  }, [persistDialogState]);
  const handleCardFollowup = useCallback((l: Lead) => {
    setFollowupLeadId(l.id);
    setFollowupOpen(true);
  }, []);
  const handleCardSchedule = useCallback((l: Lead) => {
    setCompromissoLeadId(l.id);
    setCompromissoOpen(true);
  }, []);
  const handleCardProposta = useCallback((l: Lead) => {
    setPropostaLead(l);
    setPropostaOpen(true);
  }, []);
  const handleCardFechar = useCallback((l: Lead) => {
    const count = leads.reduce((n, ld) => (ld.estagio === "fechado" ? n + 1 : n), 0);
    setPendingFechado({ leadId: l.id, posicao: count });
  }, [leads]);
  const handleCardShowHistory = useCallback((l: Lead) => {
    setHistoryLead(l);
    setHistoryOpen(true);
  }, []);
  const handleAssignCorretor = useCallback(async (l: Lead, corretorId: string | null) => {
    await updateLead(l.id, { corretor_id: corretorId } as any);
  }, [updateLead]);

  const moveByOffset = useCallback((l: Lead, offset: number) => {
    const idx = ESTAGIOS.findIndex((e) => e.id === l.estagio);
    if (idx === -1) return;
    const target = ESTAGIOS[idx + offset];
    if (!target) return;
    const posicao = leads.reduce((n, ld) => (ld.estagio === target.id ? n + 1 : n), 0);
    if (target.id === "perdido") {
      setPendingPerdido({ leadId: l.id, posicao });
      setMotivoPerda("");
      setMotivoDetalhe("");
      return;
    }
    if (target.id === "fechado") {
      setPendingFechado({ leadId: l.id, posicao });
      return;
    }
    moveLead(l.id, target.id, posicao);
  }, [ESTAGIOS, leads, moveLead]);

  const handleCardAdvance = useCallback((l: Lead) => moveByOffset(l, 1), [moveByOffset]);
  const handleCardBack = useCallback((l: Lead) => moveByOffset(l, -1), [moveByOffset]);


  const handleConfirmPerdido = async () => {
    if (!pendingPerdido || !motivoPerda) return;
    const motivo = motivoPerda === "outro" && motivoDetalhe.trim() ? motivoDetalhe.trim() : MOTIVOS_PERDA.find(m => m.id === motivoPerda)?.label || motivoPerda;
    await updateLead(pendingPerdido.leadId, { motivo_perda: motivo } as any);
    await moveLead(pendingPerdido.leadId, "perdido", pendingPerdido.posicao);
    setPendingPerdido(null);
  };

  const leadsPerdidos = useMemo(() => leads.filter(l => l.estagio === "perdido"), [leads]);
  const perdidosPorMotivo = useMemo(() => {
    const map: Record<string, number> = {};
    leadsPerdidos.forEach(l => {
      const motivo = l.motivo_perda || "Sem motivo informado";
      map[motivo] = (map[motivo] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([motivo, count]) => ({ motivo, count }));
  }, [leadsPerdidos]);

  const totalValor = filteredLeads.reduce((sum, l) => sum + l.valor, 0);
  const formatTotal = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalValor);
  const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const handleExportPerdidos = () => {
    exportToPDF({
      brandName: nome_empresa || undefined,
      title: "Relatório de Leads Perdidos",
      subtitle: `${leadsPerdidos.length} leads perdidos · ${fmt(leadsPerdidos.reduce((s, l) => s + l.valor, 0))} em valor perdido`,
      summary: perdidosPorMotivo.map(p => ({ label: p.motivo, value: String(p.count) })),
      columns: [
        { header: "Nome", dataKey: "nome" },
        { header: "Motivo", dataKey: "motivo" },
        { header: "Valor", dataKey: "valorFmt" },
        { header: "Corretor", dataKey: "corretor" },
        { header: "Telefone", dataKey: "telefone" },
        { header: "Email", dataKey: "email" },
      ],
      data: leadsPerdidos.map(l => ({
        nome: l.nome,
        motivo: l.motivo_perda || "—",
        valorFmt: fmt(l.valor),
        corretor: l.corretor_nome || "—",
        telefone: l.telefone || "—",
        email: l.email || "—",
      })),
    });
  };

  return (
    <DashboardLayout>
      <div className="pipeline-premium">
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="flex flex-col gap-2">
            <div>
              <h2 className="text-xl font-bold text-foreground">Pipeline CRM</h2>
              <p className="text-sm text-muted-foreground mt-0.5">{filteredLeads.length} leads · {formatTotal} em pipeline</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => openCreate()} className="pp-btn pp-btn-primary">
                <Plus className="w-4 h-4" />Novo Lead
              </button>
              {canImportExport && (
                <button onClick={() => setImportOpen(true)} className="pp-btn">
                  <FileSpreadsheet className="w-4 h-4" />Importar / Exportar
                </button>
              )}
              {isMaster && (
                <button onClick={() => setTransferOpen(true)} className="pp-btn">
                  <ArrowRightLeft className="w-4 h-4" />Transferência de Leads
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {canImportExport && (
              <>
            <button
              onClick={() => {
                const exportFilters: PipelineExportFilters = {
                  estagio: filterEstagio,
                  corretorId: filterCorretor,
                  corretorNome: corretores.find(c => c.id === filterCorretor)?.nome,
                  valorMin: filterValorMin,
                  valorMax: filterValorMax,
                  searchQuery,
                };
                exportToPDF({
                  brandName: nome_empresa || undefined,
                  title: "Relatório de Leads",
                  subtitle: buildPipelineExportSubtitle(filteredLeads, exportFilters),
                  summary: buildPipelinePdfSummary(filteredLeads, exportFilters),
                  columns: PIPELINE_PDF_COLUMNS as any,
                  data: buildPipelinePdfRows(filteredLeads),
                });
              }}
              className="pp-btn"
            >
              <Download className="w-4 h-4" />PDF
            </button>
            <button
              onClick={() => {
                const exportFilters: PipelineExportFilters = {
                  estagio: filterEstagio,
                  corretorId: filterCorretor,
                  corretorNome: corretores.find(c => c.id === filterCorretor)?.nome,
                  valorMin: filterValorMin,
                  valorMax: filterValorMax,
                  searchQuery,
                };
                exportToExcel({
                  fileName: buildPipelineExportFileName("Leads", exportFilters),
                  sheetName: "Leads",
                  columns: PIPELINE_CSV_COLUMNS as any,
                  data: buildPipelineCsvRows(filteredLeads),
                });
              }}
              className="pp-btn"
            >
              <FileSpreadsheet className="w-4 h-4" />Excel
            </button>
              </>
            )}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`pp-btn ${hasActiveFilters ? "pp-btn-active" : ""}`}
            >
              <Filter className="w-4 h-4" />Filtros{hasActiveFilters && " ●"}
            </button>
            <button
              onClick={() => setShowFollowups(!showFollowups)}
              className={`pp-btn relative ${showFollowups ? "pp-btn-active" : ""}`}
            >
              <CalendarClock className="w-4 h-4" />Follow-ups
              {(atrasados.length + hoje.length) > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                  {atrasados.length + hoje.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setEditarPipelineOpen(true)}
              className="pp-btn"
              title="Editar colunas do pipeline"
            >
              <Settings2 className="w-4 h-4" />Editar pipeline
            </button>
            <button
              onClick={() => setShowContatos(!showContatos)}
              className={`pp-btn relative ${showContatos ? "pp-btn-active" : ""}`}
              title="Acompanhar contatos com leads"
            >
              <ContactRound className="w-4 h-4" />Contatos
            </button>
            <button
              onClick={() => setShowNotificacoes(!showNotificacoes)}
              className={`pp-btn relative ${showNotificacoes ? "pp-btn-active" : ""}`}
              title="Notificações de atrasos e prazos"
            >
              <Bell className="w-4 h-4" />Notificações
            </button>
            <button
              onClick={() => setShowCruzamento(!showCruzamento)}
              className={`pp-btn relative ${showCruzamento ? "pp-btn-active" : ""}`}
              title="Cruzar perfil dos leads com imóveis da carteira"
            >
              <Target className="w-4 h-4" />Demanda × Carteira
            </button>
            <button
              onClick={() => setShowAcoes(!showAcoes)}
              className={`pp-btn relative ${showAcoes ? "pp-btn-active" : ""}`}
              title="Ações da equipe em tempo real"
            >
              <Activity className="w-4 h-4" />Ações em tempo real
            </button>

            <button
              onClick={handleLeadScoring}
              disabled={scoringLoading || leads.length === 0}
              className="pp-btn disabled:opacity-50"
            >
              {scoringLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              Scoring
            </button>
          </div>
        </div>
      </div>


      {/* Search bar - always visible */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Buscar lead por nome, telefone ou e-mail..."
          className="w-full h-10 pl-10 pr-10 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {showFilters && (
        <div className="flex flex-wrap items-center gap-3 mb-4 p-3 rounded-xl bg-muted/30 border border-border">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-muted-foreground">Estágio</label>
            <select value={filterEstagio} onChange={e => setFilterEstagio(e.target.value)} className="h-8 px-2 rounded-md bg-background border border-border text-sm text-foreground">
              <option value="todos">Todos</option>
              {ESTAGIOS.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-muted-foreground">Corretor</label>
            <select value={filterCorretor} onChange={e => setFilterCorretor(e.target.value)} className="h-8 px-2 rounded-md bg-background border border-border text-sm text-foreground">
              <option value="todos">Todos</option>
              <option value="__none__">Sem corretor</option>
              {corretores.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-muted-foreground">Valor mín.</label>
            <input type="number" value={filterValorMin} onChange={e => setFilterValorMin(e.target.value)} placeholder="0" className="h-8 w-28 px-2 rounded-md bg-background border border-border text-sm text-foreground" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-muted-foreground">Valor máx.</label>
            <input type="number" value={filterValorMax} onChange={e => setFilterValorMax(e.target.value)} placeholder="∞" className="h-8 w-28 px-2 rounded-md bg-background border border-border text-sm text-foreground" />
          </div>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="mt-4 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-3 h-3" />Limpar
            </button>
          )}
        </div>
      )}

      {showFollowups && (
        <div className="mb-4 p-4 rounded-xl bg-muted/30 border border-border">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Follow-ups Pendentes</h3>
              {atrasados.length > 0 && (
                <span className="flex items-center gap-1 text-[11px] text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
                  <AlertTriangle className="w-3 h-3" />{atrasados.length} atrasado{atrasados.length > 1 ? "s" : ""}
                </span>
              )}
            </div>
            <button
              onClick={() => { setFollowupLeadId(undefined); setFollowupOpen(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity"
            >
              <Plus className="w-3.5 h-3.5" />Agendar
            </button>
          </div>
          <FollowupPanel
            followups={followups}
            onComplete={async (id) => { await updateFollowup(id, { status: "concluido" } as any); }}
            onDelete={deleteFollowup}
          />
        </div>
      )}

      {showContatos && (
        <LeadsContatoPanel
          leads={filteredLeads}
          followups={followups}
          onFollowup={(leadId) => { setFollowupLeadId(leadId); setFollowupOpen(true); }}
          onRegistrarContato={async (leadId, tipo) => {
            const lead = leads.find((l) => l.id === leadId);
            if (!lead) return;
            const hojeStr = new Date().toISOString().split("T")[0];
            const proxima = new Date();
            proxima.setDate(proxima.getDate() + Math.max(1, sla_recontato_dias));
            const proximaStr = proxima.toISOString().split("T")[0];

            // 1) Conclui follow-ups pendentes vencidos ou de hoje do lead
            const pendentesDoLead = followups.filter(
              (f) => f.lead_id === leadId && f.status === "pendente" && f.data_followup <= hojeStr,
            );
            for (const f of pendentesDoLead) {
              await updateFollowup(f.id, {
                status: "concluido",
                resultado: "Contato registrado via painel Contatos",
              } as any);
            }

            // 2) Se não havia pendente hoje/atrasado, insere registro histórico do contato
            if (pendentesDoLead.length === 0) {
              await supabase.from("followups").insert({
                lead_id: leadId,
                imobiliaria_id: lead.imobiliaria_id,
                data_followup: hojeStr,
                tipo,
                descricao: "Contato registrado via painel Contatos",
                resultado: "Contato realizado",
                status: "concluido",
              } as any);
            }

            // 3) Agenda automaticamente a próxima ação baseada no SLA de recontato
            await createFollowup({
              lead_id: leadId,
              data_followup: proximaStr,
              tipo,
              descricao: `Próximo contato automático (SLA ${sla_recontato_dias}d)`,
            });

            await refetchFollowups();
            pipelineToast({
              title: "Contato registrado",
              description: `Próximo follow-up agendado para ${proxima.toLocaleDateString("pt-BR")}.`,
            });
          }}
          onOpenLead={(l) => { setEditItem(l); persistDialogState(true, l.id); setFormOpen(true); }}
          slaPrimeiroContatoHoras={sla_primeiro_contato_horas}
          slaRecontatoDias={sla_recontato_dias}
        />
      )}
      {showNotificacoes && <LeadNotificacoesPanel />}
      {showAcoes && <AcoesTempoRealPanel leads={leads} />}
      {showCruzamento && (
        <CruzamentoDemandaPanel
          leads={filteredLeads}
          onOpenLead={(l) => { setEditItem(l); persistDialogState(true, l.id); setFormOpen(true); }}
          onLeadUpdated={() => refetchLeads()}
        />
      )}




      {loading ? (
        <PipelineSkeleton />
      ) : (
        <div className="pipeline-premium relative">
          {/* Barra de rolagem superior */}
          <div 
            className="hidden md:block overflow-x-auto h-2 mb-2 px-2 scrollbar-thin scrollbar-thumb-primary/20 hover:scrollbar-thumb-primary/40 scrollbar-track-transparent"
            onScroll={(e) => {
              const target = e.currentTarget;
              const content = target.nextElementSibling as HTMLDivElement;
              if (content) content.scrollLeft = target.scrollLeft;
            }}
          >
            <div style={{ width: `${visibleEstagios.length * 322}px`, height: '1px' }} />
          </div>

          <div 
            className="flex gap-3 overflow-x-auto pb-4 px-2 snap-x scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent hover:scrollbar-thumb-primary/40"
            onScroll={(e) => {
              const target = e.currentTarget;
              const topScroll = target.previousElementSibling as HTMLDivElement;
              if (topScroll && topScroll.classList.contains('overflow-x-auto')) {
                topScroll.scrollLeft = target.scrollLeft;
              }
            }}
          >
            {visibleEstagios.map((col) => {
              const columnLeads = getFilteredLeadsByEstagio(col.id);
              const colValor = columnLeads.reduce((s, l) => s + l.valor, 0);
              const isDropTarget = dragOverColumn === col.id;
              return (
                <div key={col.id} className="flex-shrink-0 w-[310px] snap-start flex flex-col">
                  {/* Column header - uniform */}
                  <div className="sticky top-0 z-10 rounded-t-xl pp-column-header">
                    <div className="px-3.5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="pp-kicker">Etapa</span>
                        <span className="ml-auto pp-count text-[10px] px-2 py-0.5 rounded-md">
                          {columnLeads.length}
                        </span>
                      </div>
                      <h3 className="pp-title text-[15px] mt-0.5 truncate">{col.title}</h3>
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-[11px] text-muted-foreground font-medium">
                          {colValor > 0
                            ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(colValor)
                            : "—"}
                        </p>
                        <button
                          onClick={() => openCreate(col.id)}
                          className="pp-newbtn flex items-center gap-1"
                          aria-label="Adicionar lead"
                        >
                          <Plus className="w-3 h-3" />
                          Novo
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Column body */}
                  <div
                    onDragOver={(e) => handleDragOver(e, col.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, col.id)}
                    className={`flex-1 space-y-2.5 p-2.5 rounded-b-xl pp-column-body min-h-[520px] transition-all ${
                      isDropTarget ? "pp-drop" : ""
                    }`}
                  >
                    {columnLeads.length === 0 && !isDropTarget && (
                      <div className="flex flex-col items-center justify-center py-12 px-3 text-center">
                        <div className="w-11 h-11 rounded-full flex items-center justify-center mb-3 bg-muted border border-border">
                          <ContactRound className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <p className="text-[13px] text-foreground">Nenhum lead nesta etapa</p>
                        <p className="text-[11px] text-muted-foreground mt-1">Arraste ou clique em "Novo"</p>
                      </div>
                    )}
                    {columnLeads.slice(0, visibleCount[col.id] || 20).map((lead) => (
                      <LeadCard
                        key={lead.id}
                        lead={lead}
                        stageColor={col.color}
                        onEdit={handleCardEdit}
                        onDelete={setDeleteItem}
                        onFollowup={handleCardFollowup}
                        onSchedule={handleCardSchedule}
                        onProposta={handleCardProposta}
                        onFechar={handleCardFechar}
                        propostasCount={propostasCountByLead.get(lead.id)}
                        leadScore={leadScores[lead.id] || null}
                        followupAtrasado={atrasadosSet.has(lead.id)}
                        onDragStart={handleDragStart}
                        onShowHistory={handleCardShowHistory}
                        isMaster={isMaster}
                        corretores={corretores}
                        onAssignCorretor={handleAssignCorretor}
                        onAdvance={handleCardAdvance}
                        onBack={handleCardBack}
                        nextStageTitle={ESTAGIOS[ESTAGIOS.findIndex((e) => e.id === lead.estagio) + 1]?.title ?? null}
                        prevStageTitle={ESTAGIOS.findIndex((e) => e.id === lead.estagio) > 0 ? ESTAGIOS[ESTAGIOS.findIndex((e) => e.id === lead.estagio) - 1].title : null}
                      />
                    ))}

                    {columnLeads.length > (visibleCount[col.id] || 20) && (
                      <button
                        onClick={() => setVisibleCount(prev => ({ ...prev, [col.id]: (prev[col.id] || 20) + 20 }))}
                        className="w-full py-2 text-[10px] font-bold tracking-[0.2em] uppercase text-[color:var(--pp-gold-2)] hover:text-[color:var(--pp-navy)] border border-dashed border-[color:var(--pp-gold)]/40 hover:border-[color:var(--pp-gold)] rounded-lg transition-colors bg-white/40"
                      >
                        Mostrar mais ({columnLeads.length - (visibleCount[col.id] || 20)} restantes)
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      )}

      {/* Relatório de Leads Perdidos */}
      {leadsPerdidos.length > 0 && (
        <div className="mt-6 p-4 rounded-xl bg-muted/30 border border-border">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Leads Perdidos</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {leadsPerdidos.length} leads · {fmt(leadsPerdidos.reduce((s, l) => s + l.valor, 0))} em valor perdido
              </p>
            </div>
            <button onClick={handleExportPerdidos} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-foreground text-xs font-medium hover:bg-secondary/80 transition-colors">
              <Download className="w-3.5 h-3.5" />PDF Perdidos
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {perdidosPorMotivo.map(({ motivo, count }) => {
              const pct = leadsPerdidos.length > 0 ? ((count / leadsPerdidos.length) * 100).toFixed(0) : "0";
              return (
                <div key={motivo} className="p-3 rounded-lg bg-background border border-border">
                  <p className="text-lg font-bold text-foreground">{count}</p>
                  <p className="text-[11px] text-muted-foreground truncate" title={motivo}>{motivo}</p>
                  <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-destructive/70" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">{pct}%</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <LeadFormDialog
        open={formOpen}
        onOpenChange={handleFormOpenChange}
        lead={editItem}
        onSave={handleSave}
        saving={saving}
        defaultEstagio={defaultEstagio}
        corretores={corretores}
        canAssignCorretor={isMaster}
      />

      <AlertDialog open={!!deleteItem} onOpenChange={(open) => !open && setDeleteItem(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lead?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{deleteItem?.nome}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!pendingPerdido} onOpenChange={(open) => !open && setPendingPerdido(null)}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-destructive">Motivo da Perda</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Por que este lead foi perdido?</Label>
            <div className="space-y-2">
              {MOTIVOS_PERDA.map(m => (
                <label key={m.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${motivoPerda === m.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"}`}>
                  <input type="radio" name="motivo" value={m.id} checked={motivoPerda === m.id} onChange={() => setMotivoPerda(m.id)} className="accent-primary" />
                  <span className="text-sm text-foreground">{m.label}</span>
                </label>
              ))}
            </div>
            {motivoPerda === "outro" && (
              <Textarea value={motivoDetalhe} onChange={e => setMotivoDetalhe(e.target.value)} placeholder="Descreva o motivo..." rows={2} />
            )}
            <div className="flex gap-2 pt-2">
              <button onClick={() => setPendingPerdido(null)} className="flex-1 px-4 py-2 rounded-lg bg-secondary text-foreground text-sm font-medium hover:bg-secondary/80 transition-colors">
                Cancelar
              </button>
              <button onClick={handleConfirmPerdido} disabled={!motivoPerda || (motivoPerda === "outro" && !motivoDetalhe.trim())} className="flex-1 px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 transition-colors disabled:opacity-50">
                Confirmar Perda
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <FollowupFormDialog
        open={followupOpen}
        onOpenChange={setFollowupOpen}
        leads={leads.filter(l => l.estagio !== "perdido" && l.estagio !== "fechado")}
        defaultLeadId={followupLeadId}
        onSave={async (data) => {
          setFollowupSaving(true);
          try { await createFollowup(data); } finally { setFollowupSaving(false); }
        }}
        saving={followupSaving}
      />

      <CompromissoFormDialog
        open={compromissoOpen}
        onOpenChange={setCompromissoOpen}
        leads={leads.filter(l => l.estagio !== "perdido" && l.estagio !== "fechado")}
        corretores={corretores}
        onSave={async (data) => {
          setCompromissoSaving(true);
          try {
            const leadId = compromissoLeadId || data.lead_id;
            await createCompromisso({ ...data, lead_id: leadId });
            setCompromissoOpen(false);
          } finally { setCompromissoSaving(false); }
        }}
        saving={compromissoSaving}
      />

      <PropostaFormDialog
        open={propostaOpen}
        onOpenChange={setPropostaOpen}
        imoveis={imoveis}
        leadDefaults={propostaLead ? {
          lead_id: propostaLead.id,
          cliente_nome: propostaLead.nome,
          cliente_telefone: propostaLead.telefone || undefined,
          cliente_email: propostaLead.email || undefined,
        } : null}
        onSave={async (data) => {
          setPropostaSaving(true);
          try {
            await createProposta(data);
            setPropostaOpen(false);
          } finally { setPropostaSaving(false); }
        }}
        saving={propostaSaving}
      />

      <ImportExportLeadsDialog open={importOpen} onOpenChange={setImportOpen} leads={filteredLeads} />

      <TransferLeadsDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        leads={leads}
        corretores={corretores}
        loading={loading}
        onRetry={() => refetchLeads()}
        onDone={() => refetchLeads()}
      />



      {pendingFechado && (
        <FechamentoLeadDialog
          open={!!pendingFechado}
          onOpenChange={(open) => { if (!open) setPendingFechado(null); }}
          lead={leads.find(l => l.id === pendingFechado.leadId) || null}
          corretores={corretores}
          onConfirm={async (contratoData) => {
            setFechadoSaving(true);
            try {
              const leadObj = leads.find(l => l.id === pendingFechado.leadId);
              const leadNome = leadObj?.nome || "Lead";
              
              const result = await createContrato(contratoData);
              if (!result) {
                pipelineToast({
                  title: "Erro ao gerar contrato",
                  description: "O contrato não foi criado. O lead não foi movido para Fechado. Tente novamente.",
                  variant: "destructive",
                });
                return;
              }

              // Record closure activity
              await supabase.from("lead_atividades").insert({
                lead_id: pendingFechado.leadId,
                imobiliaria_id: result.imobiliaria_id,
                tipo: "fechamento",
                titulo: "Venda/Aluguel concretizado",
                descricao: `Lead fechado com contrato: ${contratoData.titulo}. Valor: ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(contratoData.valor || 0)}`,
              });

              // Auto-generate financial transactions
              const today = new Date().toISOString().split("T")[0];
              const comissaoValor = contratoData.comissao_valor || 0;
              const canalOrigem = contratoData.canal_origem || null;

              // 1. Revenue: Commission received
              if (comissaoValor > 0) {
                await createTransacao({
                  descricao: `Comissão - ${contratoData.titulo}`,
                  tipo: "entrada",
                  categoria: "comissao",
                  valor: comissaoValor,
                  data: today,
                  status: "pendente",
                  canal_origem: canalOrigem,
                  observacoes: `Gerado automaticamente pelo fechamento do lead "${leadNome}"`,
                });
              }

              // 2. Expense: Broker commission
              const corretorValor = contratoData.corretor_comissao_valor || 0;
              if (corretorValor > 0) {
                await createTransacao({
                  descricao: `Comissão Corretor ${contratoData.corretor_nome || ""} - ${leadNome}`,
                  tipo: "saida",
                  categoria: "comissao",
                  valor: corretorValor,
                  data: today,
                  status: "pendente",
                  canal_origem: canalOrigem,
                  observacoes: `Corretor: ${contratoData.corretor_nome || "—"}`,
                });
              }

              // 3. Expense: Partner split
              const parceiroValor = contratoData.parceiro_comissao_valor || 0;
              if (parceiroValor > 0 && contratoData.tem_parceria) {
                await createTransacao({
                  descricao: `Parceria ${contratoData.parceiro_nome || ""} - ${leadNome}`,
                  tipo: "saida",
                  categoria: "repasse",
                  valor: parceiroValor,
                  data: today,
                  status: "pendente",
                  canal_origem: canalOrigem,
                  observacoes: `Parceiro: ${contratoData.parceiro_nome || "—"}`,
                });
              }

              // 4. Expense: Captador commission
              const captadorValor = contratoData.captador_comissao_valor || 0;
              if (captadorValor > 0) {
                await createTransacao({
                  descricao: `Captador ${contratoData.captador_nome || ""} - ${leadNome}`,
                  tipo: "saida",
                  categoria: "repasse",
                  valor: captadorValor,
                  data: today,
                  status: "pendente",
                  canal_origem: canalOrigem,
                  observacoes: `Captador: ${contratoData.captador_nome || "—"} | Tel: ${contratoData.captador_telefone || "—"}`,
                });
              }

              // 5. Expense: Tax
              const impostoValor = contratoData.imposto_valor || 0;
              if (impostoValor > 0) {
                await createTransacao({
                  descricao: `${contratoData.imposto_tipo || "Imposto"} - ${leadNome}`,
                  tipo: "saida",
                  categoria: "despesa",
                  valor: impostoValor,
                  data: today,
                  status: "pendente",
                  canal_origem: canalOrigem,
                  observacoes: `Tipo: ${contratoData.imposto_tipo || "—"} | ${contratoData.imposto_percentual || 0}%${contratoData.tem_parceria ? " (÷2 parceria)" : ""}`,
                });
              }

              await moveLead(pendingFechado.leadId, "fechado", pendingFechado.posicao);
              pipelineToast({
                title: "Lead fechado, contrato e financeiro gerados!",
                description: `Contrato e transações criados para "${leadNome}" automaticamente.`,
              });
              setPendingFechado(null);
            } finally {
              setFechadoSaving(false);
            }
          }}
          saving={fechadoSaving}
        />
      )}

      <LeadHistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        lead={historyLead}
      />
      <WebResearchDialog />
      <PipelineEstagiosDialog open={editarPipelineOpen} onOpenChange={setEditarPipelineOpen} />
      </div>
    </DashboardLayout>

  );
};

export default Pipeline;
