import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { MetricCard } from "@/components/shared/MetricCard";
import { motion } from "framer-motion";
import { FileText, Handshake, XCircle, CheckCircle, Plus, Edit, Trash2, Loader2, AlertTriangle, Search, Download, FileDown } from "lucide-react";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { usePropostas, STATUS_PROPOSTA, FORMAS_PAGAMENTO, type Proposta } from "@/hooks/usePropostas";
import { useImoveis } from "@/hooks/useImoveis";
import { useLeads } from "@/hooks/useLeads";
import { PropostaFormDialog } from "@/components/propostas/PropostaFormDialog";
import { exportPropostasPDF } from "@/lib/exportPropostaPDF";
import { exportPropostaIndividualPDF } from "@/lib/exportPropostaIndividualPDF";
import { useImobiliariaConfig } from "@/hooks/useImobiliariaConfig";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const formatDate = (d: string) => new Date(d).toLocaleDateString("pt-BR");

const statusBadge: Record<string, { color: string; label: string }> = {
  em_negociacao: { color: "bg-warning/10 text-warning border-warning/30", label: "Em Negociação" },
  aceita: { color: "bg-success/10 text-success border-success/30", label: "Aceita" },
  recusada: { color: "bg-destructive/10 text-destructive border-destructive/30", label: "Recusada" },
  cancelada: { color: "bg-muted text-muted-foreground border-border", label: "Cancelada" },
};

const formaPgtoLabel = (id: string) => FORMAS_PAGAMENTO.find(f => f.id === id)?.label || id;

const PROPOSTAS_DIALOG_KEY = "propostas_dialog_state";

export default function Propostas() {
  const { propostas, loading, createProposta, updateProposta, deleteProposta, hasPropostaAtiva } = usePropostas();
  const { imoveis } = useImoveis();
  const { leads } = useLeads();
  const config = useImobiliariaConfig();
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<Proposta | null>(null);
  const [deleteItem, setDeleteItem] = useState<Proposta | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");

  // Persist dialog state
  const persistDialogState = useCallback((isOpen: boolean, editId?: string | null) => {
    try {
      if (isOpen) {
        localStorage.setItem(PROPOSTAS_DIALOG_KEY, JSON.stringify({ open: true, editId: editId || null }));
      } else {
        localStorage.removeItem(PROPOSTAS_DIALOG_KEY);
      }
    } catch { /* ignore */ }
  }, []);

  // Restore dialog state on mount
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    try {
      const saved = localStorage.getItem(PROPOSTAS_DIALOG_KEY);
      if (!saved) return;
      const state = JSON.parse(saved);
      if (!state?.open) return;

      if (state.editId) {
        if (propostas.length === 0) return;
        const found = propostas.find(p => p.id === state.editId);
        if (!found) return;
        setEditItem(found);
      } else {
        setEditItem(null);
      }
      setFormOpen(true);
      restoredRef.current = true;
    } catch { /* ignore */ }
  }, [propostas]);

  const filtered = useMemo(() => {
    let list = propostas;
    if (filterStatus !== "todos") list = list.filter(p => p.status === filterStatus);
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(p =>
        p.cliente_nome.toLowerCase().includes(s) ||
        (p.cliente_telefone && p.cliente_telefone.toLowerCase().includes(s)) ||
        (p.cliente_email && p.cliente_email.toLowerCase().includes(s)) ||
        imoveis.find(i => i.id === p.imovel_id)?.titulo.toLowerCase().includes(s)
      );
    }
    return list;
  }, [propostas, filterStatus, search, imoveis]);

  const metrics = useMemo(() => ({
    total: propostas.length,
    emNegociacao: propostas.filter(p => p.status === "em_negociacao").length,
    aceitas: propostas.filter(p => p.status === "aceita").length,
    recusadas: propostas.filter(p => p.status === "recusada").length,
    valorTotal: propostas.filter(p => p.status === "em_negociacao").reduce((s, p) => s + p.valor, 0),
  }), [propostas]);

  const handleSave = async (data: Partial<Proposta>) => {
    setSaving(true);
    try {
      if (editItem) {
        await updateProposta(editItem.id, data);
      } else {
        await createProposta(data);
      }
      setFormOpen(false);
      persistDialogState(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    await deleteProposta(deleteItem.id);
    setDeleteItem(null);
  };

  const getImovelTitulo = (id: string | null) => {
    if (!id) return "—";
    return imoveis.find(i => i.id === id)?.titulo || "—";
  };

  const getLeadNome = (id: string | null) => {
    if (!id) return null;
    return leads.find(l => l.id === id)?.nome || null;
  };

  // Check for active proposals alert
  const imoveisComPropostaAtiva = useMemo(() => {
    const ids = new Set<string>();
    propostas.filter(p => p.status === "em_negociacao" && p.imovel_id).forEach(p => ids.add(p.imovel_id!));
    return ids;
  }, [propostas]);

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-bold text-foreground">Propostas</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Controle de propostas e negociações</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => exportPropostasPDF({ propostas: filtered, imoveis, brandName: config.nome_empresa || undefined, filterLabel: filterStatus !== "todos" ? `Filtro: ${STATUS_PROPOSTA.find(s => s.id === filterStatus)?.label}` : undefined })} disabled={filtered.length === 0} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-secondary text-foreground text-sm font-medium hover:bg-secondary/80 transition-colors border border-border disabled:opacity-50">
              <Download className="w-4 h-4" />PDF
            </button>
            <button onClick={() => { setEditItem(null); persistDialogState(true, null); setFormOpen(true); }} className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm">
              <Plus className="w-4 h-4" />Nova Proposta
            </button>
          </div>
        </div>
      </div>

      {/* Alert for active proposals */}
      {imoveisComPropostaAtiva.size > 0 && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/30 mb-4">
          <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />
          <p className="text-sm text-warning font-medium">
            ⚠️ {imoveisComPropostaAtiva.size} imóve{imoveisComPropostaAtiva.size > 1 ? "is" : "l"} com proposta em negociação ativa
          </p>
        </motion.div>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <MetricCard title="Total" value={String(metrics.total)} icon={FileText} delay={0} />
        <MetricCard title="Em Negociação" value={String(metrics.emNegociacao)} icon={Handshake} delay={0.1} />
        <MetricCard title="Aceitas" value={String(metrics.aceitas)} icon={CheckCircle} delay={0.2} />
        <MetricCard title="Recusadas" value={String(metrics.recusadas)} icon={XCircle} delay={0.3} />
        <MetricCard title="Valor em Negociação" value={formatCurrency(metrics.valorTotal)} icon={FileText} delay={0.4} />
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por cliente ou imóvel..." className="pl-9 bg-secondary border-border" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px] bg-secondary border-border"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {STATUS_PROPOSTA.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Nenhuma proposta encontrada.</p>
          <button onClick={() => { setEditItem(null); persistDialogState(true, null); setFormOpen(true); }} className="mt-3 text-sm text-primary hover:underline">Registrar primeira proposta</button>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5">
          <div className="space-y-2">
            {filtered.map(p => {
              const badge = statusBadge[p.status] || statusBadge.em_negociacao;
              return (
                <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 group hover:bg-secondary/50 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary font-bold text-xs">
                    P{p.numero_proposta}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{p.cliente_nome}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                      <span>{getImovelTitulo(p.imovel_id)}</span>
                      {getLeadNome(p.lead_id) && (
                        <>
                          <span>·</span>
                          <span className="text-primary/80">Lead: {getLeadNome(p.lead_id)}</span>
                        </>
                      )}
                      <span>·</span>
                      <span>{formaPgtoLabel(p.forma_pagamento)}</span>
                      <span>·</span>
                      <span>{formatDate(p.created_at)}</span>
                    </div>
                  </div>
                  <Badge variant="outline" className={`text-[10px] ${badge.color}`}>{badge.label}</Badge>
                  <p className="text-sm font-semibold text-foreground">{formatCurrency(p.valor)}</p>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => exportPropostaIndividualPDF({ proposta: p, imovelTitulo: getImovelTitulo(p.imovel_id) || undefined, leadNome: getLeadNome(p.lead_id) || undefined, brandName: config.nome_empresa || undefined })} className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-primary transition-colors" title="Exportar PDF">
                      <FileDown className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => { setEditItem(p); persistDialogState(true, p.id); setFormOpen(true); }} className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-primary transition-colors">
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setDeleteItem(p)} className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      <PropostaFormDialog
        open={formOpen}
        onOpenChange={(open) => { setFormOpen(open); if (!open) persistDialogState(false); }}
        proposta={editItem}
        imoveis={imoveis}
        onSave={handleSave}
        saving={saving}
      />

      <AlertDialog open={!!deleteItem} onOpenChange={open => !open && setDeleteItem(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir proposta?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a proposta de "{deleteItem?.cliente_nome}"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
