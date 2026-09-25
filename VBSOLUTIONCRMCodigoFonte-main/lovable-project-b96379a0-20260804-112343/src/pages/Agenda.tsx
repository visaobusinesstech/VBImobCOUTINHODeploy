import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { SectionHeader } from "@/components/shared/MetricCard";
import { useState, useMemo } from "react";
import { Plus, Loader2, CalendarDays, List, CalendarRange, Filter, X, Home, Users, LayoutList } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCompromissos, TIPOS_COMPROMISSO } from "@/hooks/useCompromissos";
import { useFollowups } from "@/hooks/useFollowups";
import { useLeads } from "@/hooks/useLeads";
import { CompromissoFormDialog } from "@/components/agenda/CompromissoFormDialog";
import { FollowupFormDialog } from "@/components/pipeline/FollowupFormDialog";
import { AgendaCalendar, type AgendaItem } from "@/components/agenda/AgendaCalendar";
import { PainelDoDia } from "@/components/agenda/PainelDoDia";
import { AgendaList } from "@/components/agenda/AgendaList";
import { AgendaWeek } from "@/components/agenda/AgendaWeek";
import { RegistrarVisitaDialog } from "@/components/agenda/RegistrarVisitaDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { isPast, parseISO } from "date-fns";
import { useDialogPersistence } from "@/hooks/useDialogPersistence";

const FOLLOWUP_COLORS: Record<string, string> = {
  ligacao: "hsl(142, 71%, 45%)",
  whatsapp: "hsl(142, 71%, 45%)",
  email: "hsl(199, 89%, 48%)",
  visita: "hsl(262, 83%, 58%)",
  reuniao: "hsl(199, 89%, 48%)",
  outro: "hsl(220, 9%, 46%)",
};

const Agenda = () => {
  const { toast } = useToast();
  const { compromissos, loading: loadingC, createCompromisso, updateCompromisso, deleteCompromisso } = useCompromissos();
  const { followups, loading: loadingF, updateFollowup, deleteFollowup, createFollowup } = useFollowups();
  const { leads, corretores } = useLeads();

  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; source: "compromisso" | "followup"; titulo: string } | null>(null);
  const [view, setView] = useState<"list" | "week" | "calendar">("list");
  const [tab, setTab] = useState<"todos" | "visitas" | "followups">("todos");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | undefined>();
  const [filterTipo, setFilterTipo] = useState("all");
  const [filterCorretor, setFilterCorretor] = useState("all");
  const [filterLead, setFilterLead] = useState("all");
  const [visitaDialogOpen, setVisitaDialogOpen] = useState(false);
  const [visitaTarget, setVisitaTarget] = useState<any>(null);
  const compromissoDialog = useDialogPersistence<any>({
    storageKey: "agenda_compromisso_dialog_state",
    items: compromissos,
    getId: (item) => item.id,
  });
  const followupDialog = useDialogPersistence<any>({
    storageKey: "agenda_followup_dialog_state",
    items: followups,
    getId: (item) => item.id,
  });

  const loading = loadingC || loadingF;

  const hasActiveFilters = filterTipo !== "all" || filterCorretor !== "all" || filterLead !== "all";

  // All unique tipos (compromissos + followups)
  const allTipos = useMemo(() => {
    const tipos = new Set<string>();
    compromissos.forEach(c => tipos.add(c.tipo));
    followups.forEach(f => tipos.add(f.tipo));
    return Array.from(tipos);
  }, [compromissos, followups]);

  // Unique leads from both sources
  const allLeads = useMemo(() => {
    const map = new Map<string, string>();
    compromissos.forEach(c => { if (c.lead_id && c.lead_nome) map.set(c.lead_id, c.lead_nome); });
    followups.forEach(f => { if (f.lead_id && f.lead_nome) map.set(f.lead_id, f.lead_nome); });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [compromissos, followups]);

  // Apply filters + tab
  const filteredCompromissos = useMemo(() => {
    return compromissos.filter(c => {
      // Tab filter
      if (tab === "visitas" && c.tipo !== "visita") return false;
      if (tab === "followups") return false; // followups tab shows only followups
      if (filterTipo !== "all" && c.tipo !== filterTipo) return false;
      if (filterCorretor !== "all" && c.corretor_id !== filterCorretor) return false;
      if (filterLead !== "all" && c.lead_id !== filterLead) return false;
      return true;
    });
  }, [compromissos, filterTipo, filterCorretor, filterLead, tab]);

  const filteredFollowups = useMemo(() => {
    return followups.filter(f => {
      // Tab filter
      if (tab === "visitas") return false; // visitas tab shows only visit compromissos
      if (filterTipo !== "all" && f.tipo !== filterTipo) return false;
      if (filterCorretor !== "all") return false; // followups don't have corretor
      if (filterLead !== "all" && f.lead_id !== filterLead) return false;
      return true;
    });
  }, [followups, filterTipo, filterCorretor, filterLead, tab]);

  const handleSave = async (data: any) => {
    setSaving(true);
    try {
      if (data.lead_id === "__none__") data.lead_id = null;
      if (data.corretor_id === "__none__") data.corretor_id = null;
      if (data.id) {
        const { id, ...updates } = data;
        await updateCompromisso(id, updates);
      } else {
        await createCompromisso(data);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (id: string, source: "compromisso" | "followup") => {
    if (source === "compromisso") {
      const c = compromissos.find(x => x.id === id);
      if (c) {
        compromissoDialog.openEdit(c);
      }
    } else {
      const f = followups.find(x => x.id === id);
      if (f) {
        followupDialog.openEdit(f);
      }
    }
  };

  const handleFollowupSave = async (data: any) => {
    setSaving(true);
    try {
      if (data.id) {
        const { id, ...updates } = data;
        await updateFollowup(id, updates);
      } else {
        await createFollowup(data);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async (id: string, source: "compromisso" | "followup") => {
    if (source === "compromisso") {
      await updateCompromisso(id, { status: "concluido" } as any);
    } else {
      await updateFollowup(id, { status: "concluido" });
    }
  };

  const handleRegistrarVisita = (c: any) => {
    setVisitaTarget(c);
    setVisitaDialogOpen(true);
  };

  const handleVisitaConfirm = async (data: { feedback_visita: string; resultado_cliente: string }) => {
    if (!visitaTarget) return;
    await updateCompromisso(visitaTarget.id, {
      status: "concluido",
      feedback_visita: data.feedback_visita,
      resultado_cliente: data.resultado_cliente,
    } as any);
    toast({ title: "Visita registrada com sucesso!" });
    setVisitaTarget(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.source === "compromisso") {
      await deleteCompromisso(deleteTarget.id);
    } else {
      await deleteFollowup(deleteTarget.id);
    }
    setDeleteTarget(null);
  };

  const handleDropItem = async (itemId: string, source: "compromisso" | "followup", newDate: string, newHour: number) => {
    if (source === "compromisso") {
      const c = compromissos.find(x => x.id === itemId);
      if (!c) return;
      // Build new data_inicio preserving minutes
      const oldMinutes = c.data_inicio.slice(14, 16) || "00";
      const newDataInicio = `${newDate}T${String(newHour).padStart(2, "0")}:${oldMinutes}:00`;
      const ok = await updateCompromisso(itemId, { data_inicio: newDataInicio } as any);
      if (ok) toast({ title: "Compromisso reagendado!", description: `Movido para ${newDate} às ${String(newHour).padStart(2, "0")}:${oldMinutes}` });
    } else {
      // Follow-up only has date (no time)
      const ok = await updateFollowup(itemId, { data_followup: newDate });
      if (ok) toast({ title: "Follow-up reagendado!", description: `Movido para ${newDate}` });
    }
  };

  const onRequestDelete = (id: string, source: "compromisso" | "followup") => {
    if (source === "compromisso") {
      const c = compromissos.find(x => x.id === id);
      setDeleteTarget({ id, source, titulo: c?.titulo || "Item" });
    } else {
      const f = followups.find(x => x.id === id);
      setDeleteTarget({ id, source, titulo: `Follow-up: ${f?.lead_nome || "Item"}` });
    }
  };

  // Build calendar items from filtered data
  const calendarItems: AgendaItem[] = useMemo(() => {
    const cItems: AgendaItem[] = filteredCompromissos.map(c => {
      const info = TIPOS_COMPROMISSO.find(t => t.id === c.tipo) || TIPOS_COMPROMISSO[5];
      return { id: `c-${c.id}`, titulo: c.titulo, tipo: c.tipo, data: c.data_inicio, color: info.color, source: "compromisso" as const };
    });
    const fItems: AgendaItem[] = filteredFollowups.map(f => ({
      id: `f-${f.id}`, titulo: `FU: ${f.lead_nome}`, tipo: f.tipo, data: f.data_followup, color: FOLLOWUP_COLORS[f.tipo] || FOLLOWUP_COLORS.outro, source: "followup" as const,
    }));
    return [...cItems, ...fItems];
  }, [filteredCompromissos, filteredFollowups]);

  // Stats use filtered data
  const hoje = new Date().toISOString().split("T")[0];
  const pendentesC = filteredCompromissos.filter(c => c.status === "pendente");
  const pendentesF = filteredFollowups.filter(f => f.status === "pendente");
  const hojeTotalC = pendentesC.filter(c => c.data_inicio.startsWith(hoje)).length;
  const hojeTotalF = pendentesF.filter(f => f.data_followup === hoje).length;
  const hojeTotal = hojeTotalC + hojeTotalF;
  const atrasadosC = pendentesC.filter(c => isPast(parseISO(c.data_inicio)) && !c.data_inicio.startsWith(hoje)).length;
  const atrasadosF = pendentesF.filter(f => new Date(f.data_followup) < new Date(hoje)).length;
  const atrasadosTotal = atrasadosC + atrasadosF;

  // Tab counts (from unfiltered data)
  const visitasPendentes = compromissos.filter(c => c.tipo === "visita" && c.status === "pendente").length;
  const followupsPendentes = followups.filter(f => f.status === "pendente").length;

  const tipoLabel = (tipo: string) => {
    const t = TIPOS_COMPROMISSO.find(t => t.id === tipo);
    if (t) return t.label;
    const map: Record<string, string> = { ligacao: "📞 Ligação", whatsapp: "💬 WhatsApp", email: "📧 E-mail", visita: "🏠 Visita", reuniao: "🤝 Reunião", outro: "📌 Outro" };
    return map[tipo] || tipo;
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="flex flex-col gap-2">
            <div>
              <h2 className="text-xl font-bold text-foreground">Agenda</h2>
              <p className="text-sm text-muted-foreground mt-0.5">{hojeTotal} hoje · {atrasadosTotal} atrasado{atrasadosTotal !== 1 ? "s" : ""} · {pendentesF.length} follow-up{pendentesF.length !== 1 ? "s" : ""}</p>
            </div>
            <button onClick={() => { setSelectedDate(undefined); compromissoDialog.openCreate(); }} className="self-start flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm">
              <Plus className="w-4 h-4" />Novo
            </button>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg overflow-hidden border border-border">
              <button onClick={() => setView("list")} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${view === "list" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-secondary/80"}`}>
                <List className="w-3.5 h-3.5" />Lista
              </button>
              <button onClick={() => setView("week")} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${view === "week" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-secondary/80"}`}>
                <CalendarRange className="w-3.5 h-3.5" />Semana
              </button>
              <button onClick={() => setView("calendar")} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${view === "calendar" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-secondary/80"}`}>
                <CalendarDays className="w-3.5 h-3.5" />Mês
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 mb-4 border-b border-border">
        <button
          onClick={() => setTab("todos")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === "todos" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <LayoutList className="w-4 h-4" />
          Todos
        </button>
        <button
          onClick={() => setTab("visitas")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === "visitas" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Home className="w-4 h-4" />
          Visitas Agendadas
          {visitasPendentes > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">{visitasPendentes}</span>
          )}
        </button>
        <button
          onClick={() => setTab("followups")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === "followups" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Users className="w-4 h-4" />
          Follow-ups
          {followupsPendentes > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">{followupsPendentes}</span>
          )}
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Filter className="w-3.5 h-3.5" />Filtros:
        </div>
        <Select value={filterTipo} onValueChange={setFilterTipo}>
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {allTipos.map(t => (
              <SelectItem key={t} value={t}>{tipoLabel(t)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterCorretor} onValueChange={setFilterCorretor}>
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue placeholder="Corretor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os corretores</SelectItem>
            {corretores.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterLead} onValueChange={setFilterLead}>
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue placeholder="Lead" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os leads</SelectItem>
            {allLeads.map(([id, nome]) => (
              <SelectItem key={id} value={id}>{nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasActiveFilters && (
          <button
            onClick={() => { setFilterTipo("all"); setFilterCorretor("all"); setFilterLead("all"); }}
            className="flex items-center gap-1 text-xs text-destructive hover:underline"
          >
            <X className="w-3 h-3" />Limpar
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {view === "list" && !selectedDate && (
            <PainelDoDia
              compromissos={filteredCompromissos}
              followups={filteredFollowups}
              onComplete={handleComplete}
              onEdit={handleEdit}
              onRefetch={() => { /* realtime handles refetch */ }}
            />
          )}
          {view === "calendar" ? (
        <AgendaCalendar
          items={calendarItems}
          currentMonth={currentMonth}
          setCurrentMonth={setCurrentMonth}
          selectedDate={selectedDate}
          onSelectDate={(d) => { setSelectedDate(d); setView("list"); }}
        />
      ) : view === "week" ? (
        <AgendaWeek
          items={calendarItems}
          currentWeek={currentWeek}
          setCurrentWeek={setCurrentWeek}
          onSelectDate={(d) => { setSelectedDate(d); setView("list"); }}
          onDropItem={handleDropItem}
        />
      ) : (
        <AgendaList
          compromissos={selectedDate ? filteredCompromissos.filter(c => c.data_inicio.startsWith(selectedDate)) : pendentesC}
          followups={selectedDate ? filteredFollowups.filter(f => f.data_followup.startsWith(selectedDate)) : pendentesF}
          selectedDate={selectedDate}
          onClearDate={() => setSelectedDate(undefined)}
          onComplete={handleComplete}
          onDelete={onRequestDelete}
           onEdit={handleEdit}
           onNewItem={compromissoDialog.openCreate}
           onRegistrarVisita={handleRegistrarVisita}
         />
      )}
        </>
      )}

      <CompromissoFormDialog
        open={compromissoDialog.open}
        onOpenChange={compromissoDialog.handleOpenChange}
        leads={leads}
        corretores={corretores}
        defaultDate={selectedDate}
        onSave={handleSave}
        saving={saving}
        editingCompromisso={compromissoDialog.selectedItem}
      />

      <FollowupFormDialog
        open={followupDialog.open}
        onOpenChange={followupDialog.handleOpenChange}
        leads={leads}
        onSave={handleFollowupSave}
        saving={saving}
        editingFollowup={followupDialog.selectedItem}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir item?</AlertDialogTitle>
            <AlertDialogDescription>"{deleteTarget?.titulo}" será removido permanentemente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <RegistrarVisitaDialog
        open={visitaDialogOpen}
        onOpenChange={setVisitaDialogOpen}
        titulo={visitaTarget?.titulo || ""}
        leadNome={visitaTarget?.lead_nome}
        onConfirm={handleVisitaConfirm}
      />
    </DashboardLayout>
  );
};

export default Agenda;
