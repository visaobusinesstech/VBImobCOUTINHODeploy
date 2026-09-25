import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TableSkeleton } from "@/components/shared/PageSkeletons";
import { SectionHeader } from "@/components/shared/MetricCard";
import { motion } from "framer-motion";
import { FileSignature, Clock, CheckCircle, AlertTriangle, Plus, Edit, Trash2, Loader2, Camera, Video, Shield, XCircle, Download, Filter, X, FileText, AlertCircle, CalendarClock, Search, TrendingUp, Megaphone, Power, PowerOff, Pen, FileSpreadsheet, ShieldAlert, ClipboardCheck, Upload, Receipt, Brain, Bell } from "lucide-react";
import { ContratoFileViewerDialog } from "@/components/contratos/ContratoFileViewerDialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { exportToPDF } from "@/lib/exportPDF";
import { exportContratoPDF } from "@/lib/exportContratoPDF";
import { exportToExcel } from "@/lib/exportExcel";
import { exportRecibosRepasseBatch } from "@/lib/exportReciboRepassePDF";
import { exportInformeRendimentosBatch } from "@/lib/exportInformeRendimentosPDF";
import { useContratoFileViewer } from "@/hooks/useContratoFileViewer";
import { CONTRATO_EXPORT_COLUMNS, buildContratoExportRows } from "@/lib/contratosSpreadsheet";
import { useState, useMemo, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useContratos, type Contrato } from "@/hooks/useContratos";
import { useTransacoes } from "@/hooks/useTransacoes";
import { useProprietarios } from "@/hooks/useProprietarios";
import { useImobiliariaConfig } from "@/hooks/useImobiliariaConfig";
import { ContratoFormDialog } from "@/components/contratos/ContratoFormDialog";
import { ContratoServicesPanel } from "@/components/contratos/ContratoServicesPanel";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { getCanalLabel, CANAIS_ORIGEM } from "@/lib/canaisOrigem";
import { ImportContratosDialog } from "@/components/contratos/ImportContratosDialog";
import { AnaliseInquilinoDialog } from "@/components/contratos/AnaliseInquilinoDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const formatDate = (d: string | null) => {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("pt-BR");
};

const statusConfig: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  assinado: { icon: CheckCircle, color: "text-success", bg: "bg-success/10", label: "Assinado" },
  ativo: { icon: Power, color: "text-success", bg: "bg-success/10", label: "Ativo" },
  inativo: { icon: PowerOff, color: "text-muted-foreground", bg: "bg-muted/10", label: "Inativo" },
  aguardando: { icon: Clock, color: "text-warning", bg: "bg-warning/10", label: "Aguardando" },
  rascunho: { icon: FileSignature, color: "text-info", bg: "bg-info/10", label: "Rascunho" },
  vencendo: { icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10", label: "Vencendo" },
  cancelado: { icon: XCircle, color: "text-muted-foreground", bg: "bg-muted/10", label: "Cancelado" },
};

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - now.getTime()) / 86400000);
}

function getDocCompleteness(c: Contrato): { done: number; total: number; missing: string[] } {
  const check = (val: any, type: "file" | "data" | "bool") => {
    if (type === "bool") return val === true;
    if (type === "file") return typeof val === "string" && val.length > 5;
    if (typeof val === "number") return val > 0;
    return typeof val === "string" && val.trim().length > 0;
  };
  type Item = { label: string; val: any; type: "file" | "data" | "bool" };
  let items: Item[] = [];
  if (c.tipo === "Locação") {
    items = [
      { label: "Contrato PDF", val: c.contrato_anexo_url, type: "file" },
      { label: "Vistoria entrada", val: c.vistoria_entrada, type: "bool" },
      { label: "Laudo vistoria", val: c.vistoria_anexo_url, type: "file" },
      { label: "Apólice seguro", val: c.apolice_seguro, type: "bool" },
      { label: "Apólice PDF", val: c.apolice_anexo_url, type: "file" },
      { label: "Seguro incêndio", val: c.seguro_incendio_anexo_url, type: "file" },
      { label: "CPF inquilino", val: c.inquilino_cpf, type: "data" },
      { label: "Tel inquilino", val: c.inquilino_telefone, type: "data" },
      { label: "CPF proprietário", val: c.proprietario_cpf, type: "data" },
      { label: "Tel proprietário", val: c.proprietario_telefone, type: "data" },
      { label: "Matrícula", val: c.matricula, type: "data" },
    ];
  } else if (c.tipo === "Venda" || c.tipo === "Exclusividade") {
    items = [
      { label: "Contrato PDF", val: c.contrato_anexo_url, type: "file" },
      { label: "CPF comprador", val: c.cliente_cpf, type: "data" },
      { label: "Tel comprador", val: c.cliente_telefone, type: "data" },
      { label: "E-mail comprador", val: c.cliente_email, type: "data" },
      { label: "CPF proprietário", val: c.proprietario_cpf, type: "data" },
      { label: "Tel proprietário", val: c.proprietario_telefone, type: "data" },
      { label: "Matrícula", val: c.matricula, type: "data" },
      { label: "Comissão", val: c.comissao_percentual || c.comissao_valor, type: "data" },
    ];
  } else {
    items = [
      { label: "Contrato PDF", val: c.contrato_anexo_url, type: "file" },
      { label: "CPF proprietário", val: c.proprietario_cpf, type: "data" },
      { label: "Tel proprietário", val: c.proprietario_telefone, type: "data" },
      { label: "Matrícula", val: c.matricula, type: "data" },
      { label: "Comissão", val: c.comissao_percentual || c.comissao_valor, type: "data" },
    ];
  }
  const done = items.filter(i => check(i.val, i.type)).length;
  const missing = items.filter(i => !check(i.val, i.type)).map(i => i.label);
  return { done, total: items.length, missing };
}

const DocStatusBadge = ({ contrato }: { contrato: Contrato }) => {
  const { done, total, missing } = getDocCompleteness(contrato);
  const allDone = missing.length === 0;
  const pct = Math.round((done / total) * 100);
  return (
    <span
      title={allDone ? "Documentação completa" : `Pendente: ${missing.join(", ")}`}
      className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full cursor-help ${
        allDone ? "bg-success/10 text-success" : pct >= 60 ? "bg-warning/10 text-warning" : "bg-destructive/10 text-destructive"
      }`}
    >
      <ClipboardCheck className="w-3 h-3" />
      {done}/{total}
    </span>
  );
};

const MetricsSummary = ({ items }: { items: Contrato[] }) => {
  if (items.length === 0) return null;
  const total = items.length;
  const ativos = items.filter(c => c.status === "ativo" || c.status === "assinado").length;
  const inativos = items.filter(c => c.status === "inativo").length;
  const aguardando = items.filter(c => c.status === "aguardando").length;
  const rascunhos = items.filter(c => c.status === "rascunho").length;
  const contratosVendaList = items.filter(c => c.tipo === "Venda" || c.tipo === "Exclusividade (Venda)");
  const contratosAluguelList = items.filter(c => c.tipo === "Locação" || c.tipo === "Administração de Imóveis");
  const contratosVenda = contratosVendaList.length;
  const contratosAluguel = contratosAluguelList.length;
  const valorVenda = contratosVendaList.reduce((s, c) => s + c.valor, 0);
  const comissaoVenda = contratosVendaList.reduce((s, c) => s + (c.comissao_valor || 0), 0);
  const valorAluguel = contratosAluguelList.reduce((s, c) => s + c.valor, 0);
  const comissaoAluguel = contratosAluguelList.reduce((s, c) => s + (c.comissao_valor || 0), 0);
  const comissaoTotal = items.reduce((s, c) => s + (c.comissao_valor || 0), 0);
  const corretorTotal = items.reduce((s, c) => s + (c.corretor_comissao_valor || 0), 0);
  const liquidoImob = comissaoTotal - corretorTotal - items.reduce((s, c) => s + (c.parceiro_comissao_valor || 0) + (c.captador_comissao_valor || 0), 0);

  // Chart data: Valor vs Comissão por tipo
  const chartData = [
    ...(valorVenda > 0 || comissaoVenda > 0 ? [{ name: "Venda", valor: valorVenda, comissao: comissaoVenda }] : []),
    ...(valorAluguel > 0 || comissaoAluguel > 0 ? [{ name: "Aluguel", valor: valorAluguel, comissao: comissaoAluguel }] : []),
  ];

  // Per-contract chart for venda contracts
  const chartVendaContratos = contratosVendaList
    .filter(c => c.valor > 0 || (c.comissao_valor || 0) > 0)
    .slice(0, 10)
    .map(c => ({
      name: c.titulo.length > 15 ? c.titulo.slice(0, 15) + "…" : c.titulo,
      valor: c.valor,
      comissao: c.comissao_valor || 0,
    }));

  const fmtTooltip = (v: number) => formatCurrency(v);

  return (
    <div className="space-y-4 mb-4">
      {/* Alertas Críticos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        {items.filter(c => {
          const d = daysUntil(c.data_fim);
          return d !== null && d >= 0 && d <= 30;
        }).length > 0 && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardHeader className="p-3 pb-0">
              <CardTitle className="text-xs font-bold text-destructive flex items-center gap-2">
                <Bell className="w-3 h-3" /> CONTRATOS VENCENDO (PRÓXIMOS 30 DIAS)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3">
              <div className="space-y-1">
                {items.filter(c => {
                  const d = daysUntil(c.data_fim);
                  return d !== null && d >= 0 && d <= 30;
                }).slice(0, 3).map(c => (
                  <div key={c.id} className="text-[11px] flex justify-between items-center text-destructive-foreground font-medium bg-destructive/10 px-2 py-1 rounded">
                    <span className="truncate max-w-[150px]">{c.titulo}</span>
                    <span>{daysUntil(c.data_fim)} dias restantes</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {items.filter(c => {
          const d = daysUntil(c.data_vencimento_apolice);
          return d !== null && d >= 0 && d <= 30;
        }).length > 0 && (
          <Card className="border-warning/30 bg-warning/5">
            <CardHeader className="p-3 pb-0">
              <CardTitle className="text-xs font-bold text-warning-foreground flex items-center gap-2">
                <ShieldAlert className="w-3 h-3" /> APÓLICES VENCENDO (PRÓXIMOS 30 DIAS)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3">
              <div className="space-y-1">
                {items.filter(c => {
                  const d = daysUntil(c.data_vencimento_apolice);
                  return d !== null && d >= 0 && d <= 30;
                }).slice(0, 3).map(c => (
                  <div key={c.id} className="text-[11px] flex justify-between items-center text-warning-foreground font-medium bg-warning/10 px-2 py-1 rounded">
                    <span className="truncate max-w-[150px]">{c.titulo}</span>
                    <span>{daysUntil(c.data_vencimento_apolice)} dias restantes</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {[
          { label: "Total", value: String(total), color: "text-foreground", bg: "bg-secondary" },
          { label: "Contratos Venda", value: String(contratosVenda), color: "text-primary", bg: "bg-primary/10" },
          { label: "Contratos Aluguel", value: String(contratosAluguel), color: "text-info", bg: "bg-info/10" },
          { label: "Ativos", value: String(ativos), color: "text-success", bg: "bg-success/10" },
          { label: "Inativos", value: String(inativos), color: "text-muted-foreground", bg: "bg-muted/10" },
          { label: "Aguardando", value: String(aguardando), color: "text-warning", bg: "bg-warning/10" },
          { label: "Rascunhos", value: String(rascunhos), color: "text-info", bg: "bg-info/10" },
          { label: "Valor Venda", value: formatCurrency(valorVenda), color: "text-primary", bg: "bg-primary/10" },
          { label: "Comissão Venda", value: formatCurrency(comissaoVenda), color: "text-success", bg: "bg-success/10" },
          { label: "Valor Aluguel", value: formatCurrency(valorAluguel), color: "text-info", bg: "bg-info/10" },
          { label: "Comissão Aluguel", value: formatCurrency(comissaoAluguel), color: "text-success", bg: "bg-success/10" },
          { label: "Comissão Total", value: formatCurrency(comissaoTotal), color: "text-success", bg: "bg-success/10" },
          { label: "Líquido Imob.", value: formatCurrency(liquidoImob), color: liquidoImob >= 0 ? "text-success" : "text-destructive", bg: "bg-secondary" },
        ].map(m => (
          <div key={m.label} className={`${m.bg} rounded-xl p-3 text-center`}>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{m.label}</p>
            <p className={`text-lg font-bold ${m.color}`}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* Gráfico: Valor vs Comissão */}
      {chartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Resumo por tipo */}
          <div className="glass-card p-4">
            <h4 className="text-sm font-semibold text-foreground mb-3">📊 Valor vs Comissão por Tipo</h4>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} barGap={8}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} className="fill-muted-foreground" />
                <Tooltip formatter={fmtTooltip} labelClassName="text-foreground" />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="valor" name="Valor Total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="comissao" name="Comissão" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Detalhamento por contrato de venda */}
          {chartVendaContratos.length > 0 && (
            <div className="glass-card p-4">
              <h4 className="text-sm font-semibold text-foreground mb-3">📈 Valor vs Comissão por Contrato (Venda)</h4>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartVendaContratos} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-20} textAnchor="end" height={50} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} className="fill-muted-foreground" />
                  <Tooltip formatter={fmtTooltip} labelClassName="text-foreground" />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="valor" name="Valor Venda" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="comissao" name="Comissão" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const CONTRATO_DIALOG_KEY = "contratos_dialog_state";
const CONTRATO_FORM_BACKUP_PREFIX = "contrato_form_backup_v2_";

const getContratoDialogRestoreState = (): { open: boolean; editId: string | null } | null => {
  try {
    const saved = localStorage.getItem(CONTRATO_DIALOG_KEY);
    if (saved) {
      const state = JSON.parse(saved);
      if (state?.open) {
        return { open: true, editId: state.editId || null };
      }
    }

    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith(CONTRATO_FORM_BACKUP_PREFIX)) continue;

      const persistedId = key.slice(CONTRATO_FORM_BACKUP_PREFIX.length);
      return {
        open: true,
        editId: persistedId && persistedId !== "novo" ? persistedId : null,
      };
    }
  } catch {
    // ignore
  }

  return null;
};

const persistContratoDialogState = (isOpen: boolean, editId?: string | null) => {
  try {
    if (isOpen) {
      localStorage.setItem(CONTRATO_DIALOG_KEY, JSON.stringify({ open: true, editId: editId || null }));
    } else {
      localStorage.removeItem(CONTRATO_DIALOG_KEY);
    }
  } catch {
    // ignore
  }
};

const Contratos = () => {
  const { contratos, loading, createContrato, updateContrato, deleteContrato, refetch } = useContratos();
  const { transacoes: allTransacoes, createTransacao } = useTransacoes();
  const { proprietarios } = useProprietarios();
  const imobiliariaConfig = useImobiliariaConfig();
  const { toast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<Contrato | null>(null);
  const [deleteItem, setDeleteItem] = useState<Contrato | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState("todos");
  const [filterTipo, setFilterTipo] = useState("todos");
  const [filterPeriodo, setFilterPeriodo] = useState("todos");
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedServiceId, setExpandedServiceId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [analiseOpen, setAnaliseOpen] = useState(false);
  const [analiseContrato, setAnaliseContrato] = useState<Contrato | null>(null);
  const { viewerState, openContratoFileViewer, closeContratoFileViewer } = useContratoFileViewer();

  // Restore dialog state on mount
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;

    const state = getContratoDialogRestoreState();
    if (!state?.open) return;

    if (state.editId) {
      if (contratos.length === 0) return;

      const found = contratos.find(c => c.id === state.editId);
      if (!found) return;

      setEditItem(found);
      setFormOpen(true);
      restoredRef.current = true;
      return;
    }

    setEditItem(null);
    setFormOpen(true);
    restoredRef.current = true;
  }, [contratos]);

  // Persist dialog state
  useEffect(() => {
    persistContratoDialogState(formOpen, editItem?.id || null);
  }, [formOpen, editItem]);
  const [activeTab, setActiveTab] = useState(() => {
    try { return sessionStorage.getItem("contratos_active_tab") || "todos"; } catch { return "todos"; }
  });
  const didInitialRenderRef = useRef(false);

  useEffect(() => {
    didInitialRenderRef.current = true;
  }, []);

  const hasActiveFilters = filterStatus !== "todos" || filterTipo !== "todos" || filterPeriodo !== "todos";

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    try { sessionStorage.setItem("contratos_active_tab", tab); } catch {}
  };

  // Alertas de vencimento
  const alertas = useMemo(() => {
    const items: { contrato: Contrato; tipo: string; dias: number; mensagem: string }[] = [];
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    contratos.forEach(c => {
      if (c.status === "cancelado") return;

      // Vencimento de contrato
      const diasContrato = daysUntil(c.data_fim);
      if (diasContrato !== null && diasContrato >= 0 && diasContrato <= 30) {
        items.push({ contrato: c, tipo: "contrato", dias: diasContrato, mensagem: `Contrato "${c.titulo}" vence em ${diasContrato} dias (${formatDate(c.data_fim)})` });
      }

      // Vencimento de apólice
      const diasApolice = daysUntil(c.data_vencimento_apolice);
      if (diasApolice !== null && diasApolice >= 0 && diasApolice <= 30) {
        items.push({ contrato: c, tipo: "apolice", dias: diasApolice, mensagem: `Apólice de "${c.titulo}" vence em ${diasApolice} dias` });
      }

      // Vencimento de aluguel (dia do mês atual)
      if (c.tipo === "Locação" && c.status === "assinado") {
        const diaVenc = c.dia_vencimento_aluguel || 10;
        const today = now.getDate();
        const daysLeft = diaVenc - today;
        if (daysLeft >= 0 && daysLeft <= 5) {
          items.push({ contrato: c, tipo: "aluguel", dias: daysLeft, mensagem: `Aluguel de "${c.titulo}" vence em ${daysLeft} dias (dia ${diaVenc})` });
        }
      }

      // Correção anual
      const diasCorrecao = daysUntil(c.data_proxima_correcao);
      if (diasCorrecao !== null && diasCorrecao >= 0 && diasCorrecao <= 30) {
        items.push({ contrato: c, tipo: "correcao", dias: diasCorrecao, mensagem: `Correção anual de "${c.titulo}" em ${diasCorrecao} dias` });
      }
    });

    return items.sort((a, b) => a.dias - b.dias);
  }, [contratos]);

  const filtered = useMemo(() => {
    let result = contratos;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const qDigits = q.replace(/\D/g, "");
      result = result.filter(c => {
        const norm = (s: string | null | undefined) => s ? s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";
        return (
          norm(c.titulo).includes(q) ||
          norm(c.cliente).includes(q) ||
          norm(c.inquilino).includes(q) ||
          norm(c.proprietario).includes(q) ||
          norm(c.corretor_nome).includes(q) ||
          norm(c.fiador_nome).includes(q) ||
          norm(c.parceiro_nome).includes(q) ||
          norm(c.captador_nome).includes(q) ||
          norm(c.observacoes).includes(q) ||
          norm(c.matricula).includes(q) ||
          norm(c.numero_agua).includes(q) ||
          norm(c.numero_luz).includes(q) ||
          norm(c.inscricao_iptu).includes(q) ||
          norm(c.numero_unidade).includes(q) ||
          (c.proprietario_telefone && c.proprietario_telefone.replace(/\D/g, "").includes(qDigits) && qDigits.length > 0) ||
          (c.inquilino_telefone && c.inquilino_telefone.replace(/\D/g, "").includes(qDigits) && qDigits.length > 0) ||
          (c.proprietario_cpf && c.proprietario_cpf.replace(/\D/g, "").includes(qDigits) && qDigits.length > 0) ||
          (c.inquilino_cpf && c.inquilino_cpf.replace(/\D/g, "").includes(qDigits) && qDigits.length > 0) ||
          (c.fiador_email && norm(c.fiador_email).includes(q)) ||
          (c.fiador_telefone && c.fiador_telefone.replace(/\D/g, "").includes(qDigits) && qDigits.length > 0)
        );
      });
    }
    if (filterStatus !== "todos") result = result.filter(c => c.status === filterStatus);
    if (filterTipo !== "todos") result = result.filter(c => c.tipo === filterTipo);
    if (filterPeriodo !== "todos") {
      const now = new Date();
      result = result.filter(c => {
        if (!c.data_inicio) return false;
        const d = new Date(c.data_inicio + "T00:00:00");
        if (filterPeriodo === "30d") return now.getTime() - d.getTime() <= 30 * 86400000;
        if (filterPeriodo === "90d") return now.getTime() - d.getTime() <= 90 * 86400000;
        if (filterPeriodo === "ano") return d.getFullYear() === now.getFullYear();
        return true;
      });
    }
    return result;
  }, [contratos, filterStatus, filterTipo, filterPeriodo, searchQuery]);

  const vendas = useMemo(() => filtered.filter(c => c.tipo === "Venda"), [filtered]);
  const locacoes = useMemo(() => filtered.filter(c => c.tipo === "Locação"), [filtered]);

  // Ranking por canal de origem
  const rankingCanais = useMemo(() => {
    const map = new Map<string, { count: number; valor: number }>();
    contratos.forEach(c => {
      const canal = c.canal_origem || "nao_informado";
      const existing = map.get(canal) || { count: 0, valor: 0 };
      map.set(canal, { count: existing.count + 1, valor: existing.valor + c.valor });
    });
    return Array.from(map.entries())
      .map(([canal, data]) => ({ canal, label: canal === "nao_informado" ? "Não informado" : getCanalLabel(canal), ...data }))
      .sort((a, b) => b.count - a.count);
  }, [contratos]);

  const handleFormOpenChange = (open: boolean) => {
    setFormOpen(open);
    if (!open) {
      persistContratoDialogState(false);
    }
  };

  const openCreate = () => {
    setEditItem(null);
    persistContratoDialogState(true, null);
    setFormOpen(true);
  };

  const openEdit = (contrato: Contrato) => {
    setEditItem(contrato);
    persistContratoDialogState(true, contrato.id);
    setFormOpen(true);
  };

  const handleSave = async (data: Partial<Contrato>) => {
    setSaving(true);
    try {
      if (editItem) {
        await updateContrato(editItem.id, data);
      } else {
        const newContrato = await createContrato(data);
        // Auto-create financial transactions for new contracts
        if (newContrato && data.valor && data.comissao_valor) {
          const isLocacao = data.tipo === "Locação";
          const categoria = isLocacao ? "aluguel" : "comissao";
          const dataHoje = new Date().toISOString().split("T")[0];

          // Common fields: commission + property + owner + tenant data
          const commonFields = {
            canal_origem: data.canal_origem || null,
            numero_unidade: data.numero_unidade || null,
            imovel_id: data.imovel_id || null,
            proprietario_nome: data.proprietario || null,
            proprietario_telefone: data.proprietario_telefone || null,
            proprietario_cpf: data.proprietario_cpf || null,
            observacoes: [
              data.inquilino ? `Inquilino: ${data.inquilino}` : null,
              data.inquilino_cpf ? `CPF Inq: ${data.inquilino_cpf}` : null,
              data.inquilino_telefone ? `Tel Inq: ${data.inquilino_telefone}` : null,
            ].filter(Boolean).join(" | ") || null,
          };

          // Main revenue transaction (commission only)
          await createTransacao({
            descricao: `${isLocacao ? "Comissão Aluguel" : "Comissão Venda"} - ${data.titulo}`,
            tipo: "entrada",
            categoria,
            valor: data.comissao_valor,
            data: dataHoje,
            status: "pendente",
            recorrencia: isLocacao ? (data.comissao_tipo === "anual" ? "anual" : "mensal") : null,
            corretor_nome: data.corretor_nome || null,
            comissao_percentual: data.comissao_percentual || 0,
            comissao_valor: data.comissao_valor || 0,
            parceiro_nome: data.parceiro_nome || null,
            parceiro_comissao_percentual: data.parceiro_comissao_percentual || 0,
            parceiro_comissao_valor: data.parceiro_comissao_valor || 0,
            captador_nome: data.captador_nome || null,
            captador_comissao_percentual: data.captador_comissao_percentual || 0,
            captador_comissao_valor: data.captador_comissao_valor || 0,
            imposto_tipo: data.imposto_tipo || null,
            imposto_percentual: data.imposto_percentual || 0,
            imposto_valor: data.imposto_valor || 0,
            ...commonFields,
          } as any);

          // Corretor commission transaction
          if (data.corretor_comissao_valor && data.corretor_comissao_valor > 0) {
            await createTransacao({
              descricao: `Comissão Corretor ${data.corretor_nome || ""} - ${data.titulo}`,
              tipo: "saida",
              categoria: "comissao",
              valor: data.corretor_comissao_valor,
              data: dataHoje,
              status: "pendente",
              corretor_nome: data.corretor_nome || null,
              ...commonFields,
            } as any);
          }

          // Partner commission
          if (data.parceiro_comissao_valor && data.parceiro_comissao_valor > 0) {
            await createTransacao({
              descricao: `Comissão Parceiro ${data.parceiro_nome || ""} - ${data.titulo}`,
              tipo: "saida",
              categoria: "comissao",
              valor: data.parceiro_comissao_valor,
              data: dataHoje,
              status: "pendente",
              parceiro_nome: data.parceiro_nome || null,
              ...commonFields,
            } as any);
          }

          // Captador commission
          if (data.captador_comissao_valor && data.captador_comissao_valor > 0) {
            await createTransacao({
              descricao: `Comissão Captador ${data.captador_nome || ""} - ${data.titulo}`,
              tipo: "saida",
              categoria: "comissao",
              valor: data.captador_comissao_valor,
              data: dataHoje,
              status: "pendente",
              captador_nome: data.captador_nome || null,
              ...commonFields,
            } as any);
          }

          // Tax transaction
          if (data.imposto_valor && data.imposto_valor > 0) {
            await createTransacao({
              descricao: `Imposto ${data.imposto_tipo || ""} - ${data.titulo}`,
              tipo: "saida",
              categoria: "despesa",
              valor: data.imposto_valor,
              data: dataHoje,
              status: "pendente",
              ...commonFields,
            } as any);
          }
        }
      }
      setFormOpen(false);
      try { localStorage.removeItem(CONTRATO_DIALOG_KEY); } catch { /* ignore */ }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    await deleteContrato(deleteItem.id);
    setDeleteItem(null);
  };

  const handleExportContratoPDF = (c: Contrato) => {
    try {
      const prop = c.proprietario_id ? proprietarios.find(p => p.id === c.proprietario_id) : null;
      const safeContrato = {
        ...c,
        titulo: c.titulo || "Sem título",
        cliente: c.cliente || "—",
        tipo: c.tipo || "—",
        valor: c.valor ?? 0,
        status: c.status || "—",
      };
      exportContratoPDF(safeContrato, prop || null, imobiliariaConfig.nome_empresa || undefined);
    } catch (err: any) {
      console.error("Falha ao exportar PDF do contrato:", err);
      toast({ title: "Erro ao exportar PDF", description: err?.message || "Erro desconhecido ao gerar o relatório.", variant: "destructive" });
    }
  };

  const handleOpenContratoArquivo = async (
    pathOrUrl: string,
    fileName?: string,
    contractId?: string,
    sourceField?: string,
  ) => {
    await openContratoFileViewer(
      pathOrUrl,
      fileName,
      contractId
        ? {
            contractId,
            sourceTable: "contratos",
            sourceField,
            recordId: contractId,
          }
        : undefined,
    );
  };

  const handleExportExcel = () => {
    if (filtered.length === 0) {
      toast({ title: "Nenhum contrato para exportar", variant: "destructive" });
      return;
    }

    try {
      const exported = exportToExcel({
        fileName: `Contratos_${new Date().toISOString().split("T")[0]}`,
        sheetName: "Contratos",
        columns: CONTRATO_EXPORT_COLUMNS,
        data: buildContratoExportRows(filtered),
      });

      if (!exported) {
        toast({ title: "Erro ao exportar contratos", description: "Não foi possível gerar o arquivo Excel.", variant: "destructive" });
        return;
      }

      toast({ title: `${filtered.length} contrato${filtered.length > 1 ? "s" : ""} exportado${filtered.length > 1 ? "s" : ""}!` });
    } catch (err: any) {
      toast({ title: "Erro ao exportar contratos", description: err?.message || "Falha inesperada ao gerar o Excel.", variant: "destructive" });
    }
  };

  const getTabItemMotion = (i: number, axis: "x" | "y") => {
    if (didInitialRenderRef.current) {
      return {
        initial: false as const,
        animate: { opacity: 1, x: 0, y: 0 },
        transition: { duration: 0 },
      };
    }

    return {
      initial: { opacity: 0, [axis]: axis === "x" ? -20 : 20 },
      animate: { opacity: 1, x: 0, y: 0 },
      transition: { delay: i * 0.03 },
    };
  };

  const renderContratoRow = (c: Contrato, i: number) => {
    const config = statusConfig[c.status] || statusConfig.rascunho;
    const StatusIcon = config.icon;
    const hasAnexo = c.contrato_anexo_url || c.apolice_anexo_url || c.vistoria_anexo_url;
    return (
      <motion.div key={c.id} {...getTabItemMotion(i, "x")}
        className="glass-card p-4 flex items-center gap-4 group"
      >
        <div className={`w-10 h-10 rounded-lg ${config.bg} flex items-center justify-center ${config.color} flex-shrink-0`}>
          <StatusIcon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground truncate">{c.titulo}{c.numero_unidade ? ` · Unid. ${c.numero_unidade}` : ""}</h3>
            {c.codigo_contrato && <Badge variant="outline" className="text-[10px] flex-shrink-0">{c.codigo_contrato}</Badge>}
            {hasAnexo && <FileText className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
            <DocStatusBadge contrato={c} />
          </div>
          <p className="text-xs text-muted-foreground">
            {c.cliente} · {formatDate(c.data_inicio)}
            {c.corretor_nome ? ` · 👤 ${c.corretor_nome}` : ""}
            {c.canal_origem ? ` · ${getCanalLabel(c.canal_origem)}` : ""}
          </p>
          {(c.comissao_valor || 0) > 0 && (
            <p className="text-[10px] text-success mt-0.5">
              💰 Comissão: {formatCurrency(c.comissao_valor || 0)} ({c.comissao_percentual || 0}%)
              {(c.corretor_comissao_valor || 0) > 0 ? ` · Corretor: ${formatCurrency(c.corretor_comissao_valor || 0)}` : ""}
            </p>
          )}
          {(c.valor_iptu || c.valor_condominio) && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {c.valor_iptu ? `IPTU: ${formatCurrency(c.valor_iptu)}${c.iptu_parcelado ? " (6x)" : ""}` : ""}
              {c.valor_iptu && c.valor_condominio ? " · " : ""}
              {c.valor_condominio ? `Cond: ${formatCurrency(c.valor_condominio)}` : ""}
            </p>
          )}
          {(c.numero_agua || c.numero_luz || c.inscricao_iptu) && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {c.numero_agua ? `Água: ${c.numero_agua}` : ""}{c.numero_agua && (c.numero_luz || c.inscricao_iptu) ? " · " : ""}
              {c.numero_luz ? `Luz: ${c.numero_luz}` : ""}{c.numero_luz && c.inscricao_iptu ? " · " : ""}
              {c.inscricao_iptu ? `IPTU: ${c.inscricao_iptu}` : ""}
            </p>
          )}
        </div>
        <span className="text-sm font-semibold text-foreground hidden md:block">{formatCurrency(c.valor)}</span>
        <span className={`text-xs font-medium px-2 py-1 rounded ${config.bg} ${config.color} hidden sm:block`}>{config.label}</span>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={async () => {
              const newStatus = c.status === "inativo" ? "ativo" : "inativo";
              await updateContrato(c.id, { status: newStatus });
            }}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
              c.status === "inativo"
                ? "bg-muted/20 text-muted-foreground hover:bg-success/10 hover:text-success"
                : "bg-success/10 text-success hover:bg-muted/20 hover:text-muted-foreground"
            }`}
            title={c.status === "inativo" ? "Ativar contrato" : "Inativar contrato"}
          >
            {c.status === "inativo" ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
          </button>
          <button onClick={() => handleExportContratoPDF(c)} className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground hover:text-primary transition-colors" title="Exportar PDF">
            <Download className="w-4 h-4" />
          </button>
          <button onClick={() => openEdit(c)} className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground hover:text-primary transition-colors">
            <Edit className="w-4 h-4" />
          </button>
          <button onClick={() => setDeleteItem(c)} className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    );
  };

  const renderLocacaoCard = (c: Contrato, i: number) => {
    const config = statusConfig[c.status] || statusConfig.rascunho;
    return (
      <motion.div key={c.id} {...getTabItemMotion(i, "y")} className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">{c.titulo}</h3>
            {c.codigo_contrato && <Badge variant="outline" className="text-[10px] mt-0.5">{c.codigo_contrato}</Badge>}
            <DocStatusBadge contrato={c} />
            <p className="text-xs text-muted-foreground">
              {c.inquilino || c.cliente} · {formatCurrency(c.valor)}/mês · Venc. dia {c.dia_vencimento_aluguel || 10} · {formatDate(c.data_inicio)} a {formatDate(c.data_fim)}
              {c.corretor_nome ? ` · 👤 ${c.corretor_nome}` : ""}
            </p>
            {/* Líquido do contrato de locação */}
            {(c.comissao_valor || 0) > 0 && (() => {
              const liquido = c.valor - (c.comissao_valor || 0);
              return (
                <p className="text-[10px] mt-0.5">
                  <span className="text-success font-medium">💰 Líquido: {formatCurrency(liquido)}</span>
                  <span className="text-muted-foreground"> · Comissão: {formatCurrency(c.comissao_valor || 0)} ({c.comissao_percentual || 0}%)</span>
                  {(c.corretor_comissao_valor || 0) > 0 && <span className="text-muted-foreground"> · Corretor: {formatCurrency(c.corretor_comissao_valor || 0)}</span>}
                </p>
              );
            })()}
            {c.matricula && <p className="text-[10px] text-muted-foreground mt-0.5">Matrícula: {c.matricula} · Correção: {c.indice_correcao || "IGP-M"} {c.percentual_correcao || 0}%</p>}
            {(c.valor_iptu || c.valor_condominio) && (
              <p className="text-[10px] font-medium text-muted-foreground mt-0.5">
                {c.valor_iptu ? `IPTU: ${formatCurrency(c.valor_iptu)}${c.iptu_parcelado ? " (6x)" : ""}` : ""}
                {c.valor_iptu && c.valor_condominio ? " · " : ""}
                {c.valor_condominio ? `Cond: ${formatCurrency(c.valor_condominio)}${c.condominio_inclui ? ` — ${c.condominio_inclui}` : ""}` : ""}
              </p>
            )}
            {(c.numero_agua || c.numero_luz || c.inscricao_iptu) && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {c.numero_agua ? `Água: ${c.numero_agua}` : ""}{c.numero_agua && (c.numero_luz || c.inscricao_iptu) ? " · " : ""}
                {c.numero_luz ? `Luz: ${c.numero_luz}` : ""}{c.numero_luz && c.inscricao_iptu ? " · " : ""}
                {c.inscricao_iptu ? `IPTU: ${c.inscricao_iptu}` : ""}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium px-2 py-1 rounded ${config.bg} ${config.color}`}>{config.label}</span>
            <button
              onClick={async () => {
                const newStatus = c.status === "inativo" ? "ativo" : "inativo";
                await updateContrato(c.id, { status: newStatus });
              }}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                c.status === "inativo"
                  ? "bg-muted/20 text-muted-foreground hover:bg-success/10 hover:text-success"
                  : "bg-success/10 text-success hover:bg-muted/20 hover:text-muted-foreground"
              }`}
              title={c.status === "inativo" ? "Ativar contrato" : "Inativar contrato"}
            >
              {c.status === "inativo" ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
            </button>
            <button onClick={() => handleExportContratoPDF(c)} className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground hover:text-primary" title="PDF Proprietário">
              <Download className="w-4 h-4" />
            </button>
            <button onClick={() => openEdit(c)} className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground">
              <Edit className="w-4 h-4" />
            </button>
            <button onClick={() => setDeleteItem(c)} className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground hover:text-destructive">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className={`p-3 rounded-lg border border-dashed ${c.vistoria_entrada ? "border-success/50 bg-success/5" : "border-border"} flex flex-col items-center gap-2`}>
            <Camera className={`w-5 h-5 ${c.vistoria_entrada ? "text-success" : "text-muted-foreground"}`} />
            <span className="text-xs font-medium text-foreground">Vistoria</span>
            <span className={`text-[10px] ${c.vistoria_entrada ? "text-success" : "text-muted-foreground"}`}>
              {c.vistoria_entrada ? "✓ Realizada" : "Pendente"}
            </span>
          </div>
          <div className={`p-3 rounded-lg border border-dashed ${c.vistoria_video ? "border-success/50 bg-success/5" : "border-border"} flex flex-col items-center gap-2`}>
            <Video className={`w-5 h-5 ${c.vistoria_video ? "text-success" : "text-muted-foreground"}`} />
            <span className="text-xs font-medium text-foreground">Vídeo</span>
            <span className={`text-[10px] ${c.vistoria_video ? "text-success" : "text-muted-foreground"}`}>
              {c.vistoria_video ? "✓ Enviado" : "Pendente"}
            </span>
          </div>
          <div className={`p-3 rounded-lg border border-dashed ${c.apolice_seguro ? "border-success/50 bg-success/5" : "border-border"} flex flex-col items-center gap-2`}>
            <Shield className={`w-5 h-5 ${c.apolice_seguro ? "text-success" : "text-muted-foreground"}`} />
            <span className="text-xs font-medium text-foreground">Seguro</span>
            <span className={`text-[10px] ${c.apolice_seguro ? "text-success" : "text-muted-foreground"}`}>
              {c.apolice_seguro ? "✓ Ativa" : "Pendente"}
            </span>
          </div>
        </div>
        {(c.contrato_anexo_url || c.apolice_anexo_url || c.vistoria_anexo_url) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {c.contrato_anexo_url && (
              <button type="button" onClick={() => void handleOpenContratoArquivo(c.contrato_anexo_url!, `${c.titulo} - contrato`, c.id, "contrato_anexo_url")} className="flex items-center gap-1 text-[10px] text-primary hover:underline bg-primary/5 px-2 py-1 rounded">
                <FileText className="w-3 h-3" />Contrato
              </button>
            )}
            {c.apolice_anexo_url && (
              <button type="button" onClick={() => void handleOpenContratoArquivo(c.apolice_anexo_url!, `${c.titulo} - apólice`, c.id, "apolice_anexo_url")} className="flex items-center gap-1 text-[10px] text-primary hover:underline bg-primary/5 px-2 py-1 rounded">
                <FileText className="w-3 h-3" />Apólice
              </button>
            )}
            {c.vistoria_anexo_url && (
              <button type="button" onClick={() => void handleOpenContratoArquivo(c.vistoria_anexo_url!, `${c.titulo} - vistoria`, c.id, "vistoria_anexo_url")} className="flex items-center gap-1 text-[10px] text-primary hover:underline bg-primary/5 px-2 py-1 rounded">
                <FileText className="w-3 h-3" />Vistoria
              </button>
            )}
          </div>
        )}
      </motion.div>
    );
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="flex flex-col gap-2">
            <div>
              <h2 className="text-xl font-bold text-foreground">Contratos</h2>
              <p className="text-sm text-muted-foreground mt-0.5">{contratos.length} contratos</p>
            </div>
            <button onClick={openCreate} className="self-start flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm">
              <Plus className="w-4 h-4" />Novo Contrato
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
                const fmtDate = (d: string | null) => { if (!d) return "—"; return new Date(d + "T00:00:00").toLocaleDateString("pt-BR"); };
                const totalValor = filtered.reduce((s, c) => s + c.valor, 0);
                const assinados = filtered.filter(c => c.status === "assinado").length;
                const aguardando = filtered.filter(c => c.status === "aguardando").length;
                exportToPDF({
                  brandName: imobiliariaConfig.nome_empresa || undefined,
                  title: "Relatório de Contratos",
                  subtitle: `${filtered.length} contratos · Gerado em ${new Date().toLocaleDateString("pt-BR")}`,
                  summary: [
                    { label: "Total", value: String(filtered.length) },
                    { label: "Assinados", value: String(assinados) },
                    { label: "Aguardando", value: String(aguardando) },
                    { label: "Valor Total", value: fmt(totalValor) },
                  ],
                  columns: [
                    { header: "Título", dataKey: "titulo" },
                    { header: "Cliente", dataKey: "cliente" },
                    { header: "Tipo", dataKey: "tipo" },
                    { header: "Status", dataKey: "statusLabel" },
                    { header: "Valor", dataKey: "valorFmt" },
                    { header: "Início", dataKey: "inicio" },
                    { header: "Fim", dataKey: "fim" },
                  ],
                  data: filtered.map(c => ({
                    titulo: c.titulo,
                    cliente: c.cliente,
                    tipo: c.tipo,
                    statusLabel: (statusConfig[c.status] || statusConfig.rascunho).label,
                    valorFmt: fmt(c.valor),
                    inicio: fmtDate(c.data_inicio),
                    fim: fmtDate(c.data_fim),
                  })),
                });
              }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary text-foreground text-sm font-medium hover:bg-secondary/80 transition-colors"
            >
              <Download className="w-4 h-4" />PDF
            </button>
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary text-foreground text-sm font-medium hover:bg-secondary/80 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" />Excel
            </button>
            <button
              onClick={() => {
                const gerados = exportRecibosRepasseBatch({
                  contratos,
                  mesReferencia: new Date(),
                  brandName: imobiliariaConfig.nome_empresa || undefined,
                  brandCnpj: imobiliariaConfig.cnpj || undefined,
                  brandPhone: imobiliariaConfig.telefone || undefined,
                  brandEmail: imobiliariaConfig.email || undefined,
                  taxaAdministracao: 10,
                });
                if (gerados > 0) {
                  toast({ title: `${gerados} recibo(s) de repasse gerado(s)` });
                } else {
                  toast({ title: "Nenhum contrato de locação ativo encontrado", variant: "destructive" });
                }
              }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary text-foreground text-sm font-medium hover:bg-secondary/80 transition-colors"
            >
              <Receipt className="w-4 h-4" />Recibos Repasse
            </button>
            <button
              onClick={() => {
                const anoAtual = new Date().getFullYear() - 1;
                const gerados = exportInformeRendimentosBatch({
                  contratos,
                  transacoes: allTransacoes,
                  anoReferencia: anoAtual,
                  brandName: imobiliariaConfig.nome_empresa || undefined,
                  brandCnpj: imobiliariaConfig.cnpj || undefined,
                  brandPhone: imobiliariaConfig.telefone || undefined,
                  brandEmail: imobiliariaConfig.email || undefined,
                  brandCreci: imobiliariaConfig.creci || undefined,
                });
                if (gerados > 0) {
                  toast({ title: `${gerados} informe(s) de rendimentos gerado(s) — Ano ${anoAtual}` });
                } else {
                  toast({ title: "Nenhum contrato elegível encontrado", variant: "destructive" });
                }
              }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary text-foreground text-sm font-medium hover:bg-secondary/80 transition-colors"
            >
              <FileText className="w-4 h-4" />Informe Rendimentos
            </button>
            <button
              onClick={() => setImportOpen(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary text-foreground text-sm font-medium hover:bg-secondary/80 transition-colors"
            >
              <Upload className="w-4 h-4" />Importar
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${hasActiveFilters ? "bg-primary/10 text-primary border border-primary/30" : "bg-secondary text-foreground hover:bg-secondary/80"}`}
            >
              <Filter className="w-4 h-4" />Filtros{hasActiveFilters && " ●"}
            </button>
          </div>
        </div>
      </div>

      {/* Busca por texto */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Buscar por título, cliente, inquilino, proprietário ou telefone..."
          className="pl-9"
        />
      </div>

      {/* Alertas de vencimento */}
      {alertas.length > 0 && (
        <div className="mb-4 space-y-2">
          {alertas.slice(0, 5).map((a, i) => (
            <motion.div key={i} {...getTabItemMotion(i, "y")}
              className={`flex items-center gap-3 p-3 rounded-lg border ${a.dias <= 3 ? "bg-destructive/5 border-destructive/20" : "bg-warning/5 border-warning/20"}`}
            >
              <CalendarClock className={`w-4 h-4 flex-shrink-0 ${a.dias <= 3 ? "text-destructive" : "text-warning"}`} />
              <span className={`text-xs font-medium ${a.dias <= 3 ? "text-destructive" : "text-warning"}`}>{a.mensagem}</span>
              <button onClick={() => openEdit(a.contrato)} className="ml-auto text-[10px] text-primary hover:underline">
                Ver
              </button>
            </motion.div>
          ))}
        </div>
      )}

      {showFilters && (
        <div className="flex flex-wrap items-center gap-3 mb-4 p-3 rounded-xl bg-muted/30 border border-border">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-muted-foreground">Status</label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-8 w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="assinado">Assinado</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
                <SelectItem value="aguardando">Aguardando</SelectItem>
                <SelectItem value="rascunho">Rascunho</SelectItem>
                <SelectItem value="vencendo">Vencendo</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-muted-foreground">Tipo</label>
            <Select value={filterTipo} onValueChange={setFilterTipo}>
              <SelectTrigger className="h-8 w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="Venda">Venda</SelectItem>
                <SelectItem value="Locação">Locação</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-muted-foreground">Período</label>
            <Select value={filterPeriodo} onValueChange={setFilterPeriodo}>
              <SelectTrigger className="h-8 w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="30d">Últimos 30 dias</SelectItem>
                <SelectItem value="90d">Últimos 90 dias</SelectItem>
                <SelectItem value="ano">Este ano</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {hasActiveFilters && (
            <button onClick={() => { setFilterStatus("todos"); setFilterTipo("todos"); setFilterPeriodo("todos"); }} className="mt-4 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-3 h-3" />Limpar
            </button>
          )}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="mb-4 bg-secondary flex-wrap">
          <TabsTrigger value="todos" className="gap-1.5"><FileSignature className="w-3.5 h-3.5" />Todos ({filtered.length})</TabsTrigger>
          <TabsTrigger value="venda" className="gap-1.5"><FileSignature className="w-3.5 h-3.5" />Venda ({vendas.length})</TabsTrigger>
          <TabsTrigger value="locacao" className="gap-1.5"><Shield className="w-3.5 h-3.5" />Locação ({locacoes.length})</TabsTrigger>
          <TabsTrigger value="credito" className="gap-1.5"><ShieldAlert className="w-3.5 h-3.5" />Restrição CPF</TabsTrigger>
          <TabsTrigger value="assinatura" className="gap-1.5"><Pen className="w-3.5 h-3.5" />Assinatura Digital</TabsTrigger>
          <TabsTrigger value="ranking" className="gap-1.5"><TrendingUp className="w-3.5 h-3.5" />Ranking Canais</TabsTrigger>
          <TabsTrigger value="analise_inquilino" className="gap-1.5"><Brain className="w-3.5 h-3.5" />Análise Inquilino</TabsTrigger>
        </TabsList>

        {loading ? (
          <TableSkeleton />
        ) : (
          <>
            <TabsContent value="todos">
              <MetricsSummary items={filtered} />
              {filtered.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground">
                  <FileSignature className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  <p className="text-sm">{hasActiveFilters ? "Nenhum contrato encontrado com esses filtros." : "Nenhum contrato cadastrado ainda."}</p>
                  {hasActiveFilters ? (
                    <button onClick={() => { setFilterStatus("todos"); setFilterTipo("todos"); setFilterPeriodo("todos"); }} className="mt-3 text-sm text-primary hover:underline">Limpar filtros</button>
                  ) : (
                    <button onClick={openCreate} className="mt-3 text-sm text-primary hover:underline">Criar primeiro contrato</button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {filtered.map((c, i) => renderContratoRow(c, i))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="venda">
              <MetricsSummary items={vendas} />
              {vendas.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground">
                  <FileSignature className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  <p className="text-sm">Nenhum contrato de venda.</p>
                  <button onClick={openCreate} className="mt-3 text-sm text-primary hover:underline">Criar contrato de venda</button>
                </div>
              ) : (
                <div className="space-y-3">
                  {vendas.map((c, i) => renderContratoRow(c, i))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="locacao">
              <MetricsSummary items={locacoes} />
              {locacoes.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground">
                  <Shield className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  <p className="text-sm">Nenhum contrato de locação.</p>
                  <button onClick={openCreate} className="mt-3 text-sm text-primary hover:underline">Criar contrato de locação</button>
                </div>
              ) : (
                <div className="space-y-4">
                  {locacoes.map((c, i) => renderLocacaoCard(c, i))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="credito">
              {filtered.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground">
                  <ShieldAlert className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  <p className="text-sm">Nenhum contrato para consulta de restrição do CPF.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs text-muted-foreground">Abra um contrato abaixo para verificar claramente se o CPF tem restrição e visualizar score, risco e pendências.</p>
                  {filtered.filter(c => c.status !== "cancelado").map((c, i) => {
                    const config = statusConfig[c.status] || statusConfig.rascunho;
                    const isExpanded = expandedServiceId === c.id;
                    return (
                      <motion.div key={c.id} {...getTabItemMotion(i, "y")}
                        className="glass-card p-4 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-sm font-semibold text-foreground">{c.titulo}</h3>
                            <p className="text-xs text-muted-foreground">{c.cliente} · {c.tipo} · {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(c.valor)}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-medium px-2 py-1 rounded ${config.bg} ${config.color}`}>{config.label}</span>
                            <button
                              onClick={() => setExpandedServiceId(isExpanded ? null : c.id)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                isExpanded ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-primary/10"
                              }`}
                            >
                              <ShieldAlert className="w-3.5 h-3.5" />
                              {isExpanded ? "Fechar" : "Ver restrição do CPF"}
                            </button>
                          </div>
                        </div>
                        {isExpanded && <ContratoServicesPanel contrato={c} />}
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="assinatura">
              {filtered.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground">
                  <Pen className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  <p className="text-sm">Nenhum contrato para assinatura digital.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs text-muted-foreground">Selecione um contrato para enviar para assinatura digital com validade jurídica.</p>
                  {filtered.filter(c => c.status !== "cancelado").map((c, i) => {
                    const config = statusConfig[c.status] || statusConfig.rascunho;
                    const isExpanded = expandedServiceId === c.id;
                    return (
                      <motion.div key={c.id} {...getTabItemMotion(i, "y")}
                        className="glass-card p-4 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-sm font-semibold text-foreground">{c.titulo}</h3>
                            <p className="text-xs text-muted-foreground">{c.cliente} · {c.tipo} · {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(c.valor)}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-medium px-2 py-1 rounded ${config.bg} ${config.color}`}>{config.label}</span>
                            <button
                              onClick={() => setExpandedServiceId(isExpanded ? null : c.id)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                isExpanded ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-primary/10"
                              }`}
                            >
                              <Pen className="w-3.5 h-3.5" />
                              {isExpanded ? "Fechar" : "Assinatura Digital"}
                            </button>
                          </div>
                        </div>
                        {isExpanded && <ContratoServicesPanel contrato={c} />}
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </TabsContent>


            <TabsContent value="ranking">
              {rankingCanais.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground">
                  <Megaphone className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  <p className="text-sm">Nenhum contrato cadastrado para gerar ranking.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground mb-2">Ranking de contratos por canal de origem</p>
                  {rankingCanais.map((item, i) => {
                    const maxCount = rankingCanais[0]?.count || 1;
                    const pct = Math.round((item.count / maxCount) * 100);
                    return (
                      <motion.div key={item.canal} {...getTabItemMotion(i, "x")}
                        className="glass-card p-4"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <span className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                              {i + 1}º
                            </span>
                            <div>
                              <p className="text-sm font-semibold text-foreground">{item.label}</p>
                              <p className="text-xs text-muted-foreground">{item.count} contrato{item.count !== 1 ? "s" : ""} · {formatCurrency(item.valor)}</p>
                            </div>
                          </div>
                          <span className="text-lg font-bold text-primary">{item.count}</span>
                        </div>
                        <div className="w-full bg-secondary rounded-full h-2">
                          <motion.div
                            className="bg-primary h-2 rounded-full"
                            initial={didInitialRenderRef.current ? false : { width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={didInitialRenderRef.current ? { duration: 0 } : { duration: 0.6, delay: i * 0.05 }}
                          />
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="analise_inquilino">
              {locacoes.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground">
                  <Brain className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  <p className="text-sm">Nenhum contrato de locação para análise.</p>
                  <button onClick={openCreate} className="mt-3 text-sm text-primary hover:underline">Criar contrato de locação</button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs text-muted-foreground">Selecione um contrato de locação para analisar o perfil do inquilino com inteligência artificial. A análise verifica score, capacidade de pagamento e avalia a garantia específica (fiador, seguro fiança ou caução).</p>
                  {locacoes.filter(c => c.status !== "cancelado").map((c, i) => {
                    const config = statusConfig[c.status] || statusConfig.rascunho;
                    return (
                      <motion.div key={c.id} {...getTabItemMotion(i, "y")}
                        className="glass-card p-4 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-sm font-semibold text-foreground">{c.titulo}</h3>
                            <p className="text-xs text-muted-foreground">
                              {c.inquilino || c.cliente} · {formatCurrency(c.valor)}/mês
                              {c.tipo_garantia ? ` · ${c.tipo_garantia === "seguro_fianca" ? "Seguro Fiança" : c.tipo_garantia === "caucao" ? "Caução" : c.tipo_garantia === "fiador" ? "Fiador" : c.tipo_garantia}` : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-medium px-2 py-1 rounded ${config.bg} ${config.color}`}>{config.label}</span>
                            <button
                              onClick={() => { setAnaliseContrato(c); setAnaliseOpen(true); }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground"
                            >
                              <Brain className="w-3.5 h-3.5" />
                              Analisar Inquilino
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </>
        )}
      </Tabs>

      <ContratoFormDialog
        open={formOpen}
        onOpenChange={handleFormOpenChange}
        contrato={editItem}
        onSave={handleSave}
        saving={saving}
      />

      <AlertDialog open={!!deleteItem} onOpenChange={(open) => !open && setDeleteItem(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir contrato?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{deleteItem?.titulo}"? Esta ação não pode ser desfeita.
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

      <ContratoFileViewerDialog
        open={viewerState.open}
        loading={viewerState.loading}
        file={viewerState.file}
        onOpenChange={(open) => {
          if (!open) closeContratoFileViewer();
        }}
      />

      <ImportContratosDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImport={async (items) => {
          let success = 0;
          let errors = 0;
          const BATCH_SIZE = 10;

          for (let index = 0; index < items.length; index += BATCH_SIZE) {
            const batch = items.slice(index, index + BATCH_SIZE);
            const results = await Promise.allSettled(
              batch.map((item) =>
                createContrato(item, {
                  skipRefresh: true,
                  suppressErrorToast: true,
                  suppressSuccessToast: true,
                }),
              ),
            );

            results.forEach((result) => {
              if (result.status === "fulfilled" && result.value) success++;
              else errors++;
            });
          }

          if (success > 0) {
            await refetch();
          }

          return { success, errors };
        }}
      />

      <AnaliseInquilinoDialog
        open={analiseOpen}
        onOpenChange={setAnaliseOpen}
        contrato={analiseContrato}
      />
    </DashboardLayout>
  );
};

export default Contratos;
