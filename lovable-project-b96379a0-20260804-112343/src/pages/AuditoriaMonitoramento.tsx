import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious,
} from "@/components/ui/pagination";
import { Activity, Database, Download, RefreshCw, ArrowUpDown, Search, FlaskConical, ShieldCheck, AlertTriangle, ShieldAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";

// ---------- helpers ----------
type CronRow = {
  id: string;
  job_name: string;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  status: "sucesso" | "falha" | "executando" | "skipped";
  message: string | null;
  servidor: string | null;
  metadata: any;
};

type RetRow = {
  id: string;
  deleted_at: string;
  entidade: string;
  quantidade: number;
  politica: string;
  criterio: string | null;
  mecanismo: string;
  metadata: any;
};

const RANGE_OPTIONS = [
  { value: "1h", label: "Última hora" },
  { value: "24h", label: "Últimas 24h" },
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "all", label: "Tudo" },
];

function rangeToDate(value: string): Date | null {
  const now = Date.now();
  switch (value) {
    case "1h": return new Date(now - 60 * 60 * 1000);
    case "24h": return new Date(now - 24 * 60 * 60 * 1000);
    case "7d": return new Date(now - 7 * 24 * 60 * 60 * 1000);
    case "30d": return new Date(now - 30 * 24 * 60 * 60 * 1000);
    default: return null;
  }
}

function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR");
}

function fmtDuration(ms: number | null | undefined) {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  return `${m}min ${rs}s`;
}

function statusBadge(status: CronRow["status"]) {
  const map: Record<CronRow["status"], { label: string; className: string }> = {
    sucesso:    { label: "Sucesso",     className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
    falha:      { label: "Falha",       className: "bg-red-100 text-red-800 border-red-200" },
    executando: { label: "Em execução", className: "bg-amber-100 text-amber-900 border-amber-200" },
    skipped:    { label: "Ignorado",    className: "bg-slate-100 text-slate-700 border-slate-200" },
  };
  const s = map[status] ?? map.skipped;
  return <Badge variant="outline" className={s.className}>{s.label}</Badge>;
}

function toCSV(rows: Record<string, any>[], columns: { key: string; label: string }[]) {
  const escape = (v: any) => {
    if (v == null) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  const header = columns.map(c => escape(c.label)).join(",");
  const body = rows.map(r => columns.map(c => escape(r[c.key])).join(",")).join("\n");
  return `${header}\n${body}`;
}

function downloadCSV(filename: string, csv: string) {
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ---------- component ----------
export default function AuditoriaMonitoramento() {
  const { isMaster, loading: authLoading } = useAuth();

  // Cron tab state
  const [cronRows, setCronRows] = useState<CronRow[]>([]);
  const [cronLoading, setCronLoading] = useState(false);
  const [cronSearch, setCronSearch] = useState("");
  const [cronJobFilter, setCronJobFilter] = useState<string>("all");
  const [cronStatusFilter, setCronStatusFilter] = useState<string>("all");
  const [cronRange, setCronRange] = useState("7d");
  const [cronSort, setCronSort] = useState<"started_desc" | "started_asc" | "duration_desc" | "status">("started_desc");
  const [cronPage, setCronPage] = useState(1);
  const [cronPageSize, setCronPageSize] = useState(25);
  const [selected, setSelected] = useState<CronRow | null>(null);

  // Retention tab state
  const [retRows, setRetRows] = useState<RetRow[]>([]);
  const [retLoading, setRetLoading] = useState(false);
  const [retEntidadeFilter, setRetEntidadeFilter] = useState("all");
  const [retPoliticaFilter, setRetPoliticaFilter] = useState("all");
  const [retRange, setRetRange] = useState("30d");
  const [retSort, setRetSort] = useState<"deleted_desc" | "deleted_asc" | "quantidade_desc">("deleted_desc");
  const [retPage, setRetPage] = useState(1);
  const [retPageSize, setRetPageSize] = useState(25);

  async function fetchCron() {
    setCronLoading(true);
    try {
      let q = supabase.from("cron_execucoes_log").select("*").order("started_at", { ascending: false }).limit(1000);
      const from = rangeToDate(cronRange);
      if (from) q = q.gte("started_at", from.toISOString());
      const { data, error } = await q;
      if (error) throw error;
      setCronRows((data as CronRow[]) ?? []);
    } catch (e: any) {
      toast.error("Falha ao carregar execuções: " + (e.message ?? "erro"));
    } finally {
      setCronLoading(false);
    }
  }

  async function fetchRet() {
    setRetLoading(true);
    try {
      let q = supabase.from("retention_deletion_log").select("*").order("deleted_at", { ascending: false }).limit(1000);
      const from = rangeToDate(retRange);
      if (from) q = q.gte("deleted_at", from.toISOString());
      const { data, error } = await q;
      if (error) throw error;
      setRetRows((data as RetRow[]) ?? []);
    } catch (e: any) {
      toast.error("Falha ao carregar auditoria: " + (e.message ?? "erro"));
    } finally {
      setRetLoading(false);
    }
  }

  useEffect(() => { if (isMaster) fetchCron(); /* eslint-disable-next-line */ }, [isMaster, cronRange]);
  useEffect(() => { if (isMaster) fetchRet(); /* eslint-disable-next-line */ }, [isMaster, retRange]);

  const jobNames = useMemo(() => Array.from(new Set(cronRows.map(r => r.job_name))).sort(), [cronRows]);
  const entidades = useMemo(() => Array.from(new Set(retRows.map(r => r.entidade))).sort(), [retRows]);
  const politicas = useMemo(() => Array.from(new Set(retRows.map(r => r.politica))).sort(), [retRows]);

  const cronFiltered = useMemo(() => {
    const s = cronSearch.trim().toLowerCase();
    let arr = cronRows.filter(r => {
      if (cronJobFilter !== "all" && r.job_name !== cronJobFilter) return false;
      if (cronStatusFilter !== "all" && r.status !== cronStatusFilter) return false;
      if (s && !(`${r.job_name} ${r.message ?? ""}`.toLowerCase().includes(s))) return false;
      return true;
    });
    arr = [...arr].sort((a, b) => {
      switch (cronSort) {
        case "started_asc": return +new Date(a.started_at) - +new Date(b.started_at);
        case "duration_desc": return (b.duration_ms ?? 0) - (a.duration_ms ?? 0);
        case "status": return a.status.localeCompare(b.status);
        default: return +new Date(b.started_at) - +new Date(a.started_at);
      }
    });
    return arr;
  }, [cronRows, cronSearch, cronJobFilter, cronStatusFilter, cronSort]);

  const retFiltered = useMemo(() => {
    let arr = retRows.filter(r => {
      if (retEntidadeFilter !== "all" && r.entidade !== retEntidadeFilter) return false;
      if (retPoliticaFilter !== "all" && r.politica !== retPoliticaFilter) return false;
      return true;
    });
    arr = [...arr].sort((a, b) => {
      switch (retSort) {
        case "deleted_asc": return +new Date(a.deleted_at) - +new Date(b.deleted_at);
        case "quantidade_desc": return b.quantidade - a.quantidade;
        default: return +new Date(b.deleted_at) - +new Date(a.deleted_at);
      }
    });
    return arr;
  }, [retRows, retEntidadeFilter, retPoliticaFilter, retSort]);

  const cronPageRows = useMemo(() => {
    const start = (cronPage - 1) * cronPageSize;
    return cronFiltered.slice(start, start + cronPageSize);
  }, [cronFiltered, cronPage, cronPageSize]);

  const retPageRows = useMemo(() => {
    const start = (retPage - 1) * retPageSize;
    return retFiltered.slice(start, start + retPageSize);
  }, [retFiltered, retPage, retPageSize]);

  const cronPageCount = Math.max(1, Math.ceil(cronFiltered.length / cronPageSize));
  const retPageCount = Math.max(1, Math.ceil(retFiltered.length / retPageSize));

  function exportCron() {
    const csv = toCSV(
      cronFiltered.map(r => ({
        job_name: r.job_name,
        started_at: fmtDateTime(r.started_at),
        finished_at: fmtDateTime(r.finished_at),
        duration: fmtDuration(r.duration_ms),
        status: r.status,
        servidor: r.servidor ?? "",
        message: r.message ?? "",
      })),
      [
        { key: "job_name", label: "Nome do Job" },
        { key: "started_at", label: "Início" },
        { key: "finished_at", label: "Fim" },
        { key: "duration", label: "Duração" },
        { key: "status", label: "Status" },
        { key: "servidor", label: "Servidor" },
        { key: "message", label: "Mensagem" },
      ],
    );
    downloadCSV(`cron-execucoes-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }

  function exportRet() {
    const csv = toCSV(
      retFiltered.map(r => ({
        deleted_at: fmtDateTime(r.deleted_at),
        entidade: r.entidade,
        quantidade: r.quantidade,
        politica: r.politica,
        criterio: r.criterio ?? "",
        mecanismo: r.mecanismo,
      })),
      [
        { key: "deleted_at", label: "Data/Hora" },
        { key: "entidade", label: "Entidade" },
        { key: "quantidade", label: "Quantidade" },
        { key: "politica", label: "Política" },
        { key: "criterio", label: "Critério" },
        { key: "mecanismo", label: "Mecanismo" },
      ],
    );
    downloadCSV(`retencao-exclusoes-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }

  // ---- Simulation state ----
  type SimRow = {
    politica: string; entidade: string; tenant_id: string | null;
    criterio: string; quantidade: number; protegidos?: number;
    exemplos: any; simulated_at: string;
  };
  type SimHistoryRow = {
    id: string; executed_at: string; executed_by: string | null;
    executed_by_email: string | null; parametros: any;
    total_removidos: number; total_protegidos: number;
    politicas_count: number; tenants_impactados: number;
    duracao_ms: number | null; resultados: SimRow[];
  };
  const [simRows, setSimRows] = useState<SimRow[] | null>(null);
  const [simLoading, setSimLoading] = useState(false);
  const [simAt, setSimAt] = useState<string | null>(null);
  const [simDetail, setSimDetail] = useState<SimRow | null>(null);
  const [simHistory, setSimHistory] = useState<SimHistoryRow[]>([]);
  const [simHistoryLoading, setSimHistoryLoading] = useState(false);
  const [simHistoryQuery, setSimHistoryQuery] = useState("");
  const [simHistoryDetail, setSimHistoryDetail] = useState<SimHistoryRow | null>(null);

  async function loadSimHistory() {
    setSimHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from("retention_simulation_history" as any)
        .select("*")
        .order("executed_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      setSimHistory((data as unknown as SimHistoryRow[]) ?? []);
    } catch (e: any) {
      toast.error("Falha ao carregar histórico de simulações: " + (e.message ?? "erro"));
    } finally {
      setSimHistoryLoading(false);
    }
  }

  useEffect(() => { if (isMaster) loadSimHistory(); }, [isMaster]);

  async function runSimulation() {
    setSimLoading(true);
    const t0 = performance.now();
    try {
      const { data, error } = await supabase.rpc("simulate_data_retention_policies" as any, {});
      if (error) throw error;
      const rows = (data as SimRow[]) ?? [];
      const duracaoMs = Math.round(performance.now() - t0);
      setSimRows(rows);
      setSimAt(new Date().toISOString());
      const totalRemov = rows.reduce((a, r) => a + (r.quantidade || 0), 0);
      const totalProt = rows.reduce((a, r) => a + (r.protegidos || 0), 0);
      const tenantsImp = new Set(rows.map(r => r.tenant_id).filter(Boolean)).size;

      // Persistência do histórico da simulação
      try {
        const { error: recErr } = await supabase.rpc("record_retention_simulation" as any, {
          _parametros: {},
          _total_removidos: totalRemov,
          _total_protegidos: totalProt,
          _politicas_count: rows.length,
          _tenants_impactados: tenantsImp,
          _duracao_ms: duracaoMs,
          _resultados: rows,
        });
        if (recErr) throw recErr;
        loadSimHistory();
      } catch (persistErr: any) {
        console.error("[simulation] falha ao persistir histórico:", persistErr);
        toast.error("Simulação executada, mas falhou ao registrar no histórico.");
      }

      toast.success(`Simulação: ${totalRemov.toLocaleString("pt-BR")} removidos · ${totalProt.toLocaleString("pt-BR")} protegidos por exceção.`);
    } catch (e: any) {
      toast.error("Falha na simulação: " + (e.message ?? "erro"));
    } finally {
      setSimLoading(false);
    }
  }

  const simTotal = useMemo(() => (simRows ?? []).reduce((a, r) => a + (r.quantidade || 0), 0), [simRows]);
  const simProtegidos = useMemo(() => (simRows ?? []).reduce((a, r) => a + (r.protegidos || 0), 0), [simRows]);

  const simHistoryFiltered = useMemo(() => {
    const q = simHistoryQuery.trim().toLowerCase();
    if (!q) return simHistory;
    return simHistory.filter(h =>
      h.id.toLowerCase().includes(q) ||
      (h.executed_by_email ?? "").toLowerCase().includes(q) ||
      (h.executed_by ?? "").toLowerCase().includes(q) ||
      fmtDateTime(h.executed_at).toLowerCase().includes(q));
  }, [simHistory, simHistoryQuery]);

  function exportSimHistory() {
    const csv = toCSV(
      simHistoryFiltered.map(h => ({
        id: h.id,
        executed_at: fmtDateTime(h.executed_at),
        executed_by_email: h.executed_by_email ?? h.executed_by ?? "—",
        total_removidos: h.total_removidos,
        total_protegidos: h.total_protegidos,
        politicas_count: h.politicas_count,
        tenants_impactados: h.tenants_impactados,
        duracao_ms: h.duracao_ms ?? "",
      })),
      [
        { key: "id", label: "ID da Simulação" },
        { key: "executed_at", label: "Timestamp" },
        { key: "executed_by_email", label: "Usuário" },
        { key: "total_removidos", label: "Removidos (estim.)" },
        { key: "total_protegidos", label: "Protegidos" },
        { key: "politicas_count", label: "Políticas" },
        { key: "tenants_impactados", label: "Tenants" },
        { key: "duracao_ms", label: "Duração (ms)" },
      ],
    );
    downloadCSV(`simulacao-historico-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }

  // ---- Exceções state ----
  type ExcecaoRow = {
    nome: string; entidade: string; criterio: string;
    justificativa: string; acao: string; exemplo: any;
  };
  const [excecoes, setExcecoes] = useState<ExcecaoRow[]>([]);
  const [excecoesLoading, setExcecoesLoading] = useState(false);
  const [excecoesQuery, setExcecoesQuery] = useState("");
  const [excecaoDetail, setExcecaoDetail] = useState<ExcecaoRow | null>(null);

  async function loadExcecoes() {
    setExcecoesLoading(true);
    try {
      const { data, error } = await supabase.rpc("list_retention_exceptions" as any);
      if (error) throw error;
      setExcecoes((data as ExcecaoRow[]) ?? []);
    } catch (e: any) {
      toast.error("Falha ao carregar exceções: " + (e.message ?? "erro"));
    } finally {
      setExcecoesLoading(false);
    }
  }

  useEffect(() => { if (isMaster) loadExcecoes(); }, [isMaster]);

  const excecoesFiltradas = useMemo(() => {
    const q = excecoesQuery.trim().toLowerCase();
    if (!q) return excecoes;
    return excecoes.filter(e =>
      e.nome.toLowerCase().includes(q) ||
      e.entidade.toLowerCase().includes(q) ||
      e.justificativa.toLowerCase().includes(q));
  }, [excecoes, excecoesQuery]);

  function exportExcecoes() {
    const csv = toCSV(
      excecoesFiltradas.map(e => ({
        nome: e.nome, entidade: e.entidade,
        criterio: e.criterio, justificativa: e.justificativa, acao: e.acao,
      })),
      [
        { key: "nome", label: "Exceção" },
        { key: "entidade", label: "Entidade" },
        { key: "criterio", label: "Critério" },
        { key: "justificativa", label: "Justificativa" },
        { key: "acao", label: "Ação" },
      ],
    );
    downloadCSV(`retencao-excecoes-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }


  function exportSim() {
    if (!simRows) return;
    const csv = toCSV(
      simRows.map(r => ({
        politica: r.politica, entidade: r.entidade,
        tenant_id: r.tenant_id ?? "global",
        criterio: r.criterio, quantidade: r.quantidade,
      })),
      [
        { key: "politica", label: "Política" },
        { key: "entidade", label: "Entidade" },
        { key: "tenant_id", label: "Tenant" },
        { key: "criterio", label: "Critério" },
        { key: "quantidade", label: "Registros estimados" },
      ],
    );
    downloadCSV(`simulacao-retencao-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }

  if (authLoading) return <div className="p-8 text-slate-500">Carregando…</div>;
  if (!isMaster) return <Navigate to="/dashboard" replace />;

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Auditoria e Monitoramento</h1>
          <p className="text-sm text-slate-500">Visibilidade sobre execuções automáticas e exclusão de dados por política.</p>
        </div>
      </div>

      <Tabs defaultValue="cron" className="w-full">
        <TabsList>
          <TabsTrigger value="cron"><Activity className="w-4 h-4 mr-2" />Cron Jobs</TabsTrigger>
          <TabsTrigger value="retencao"><Database className="w-4 h-4 mr-2" />Retenção de Dados</TabsTrigger>
          <TabsTrigger value="simulacao"><FlaskConical className="w-4 h-4 mr-2" />Simulação</TabsTrigger>
          <TabsTrigger value="excecoes"><ShieldAlert className="w-4 h-4 mr-2" />Exceções</TabsTrigger>
        </TabsList>

        {/* ==================== CRON TAB ==================== */}
        <TabsContent value="cron" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
              <CardTitle className="text-base">Execuções de Cron Jobs</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={fetchCron} disabled={cronLoading}>
                  <RefreshCw className={`w-4 h-4 mr-2 ${cronLoading ? "animate-spin" : ""}`} />
                  Atualizar
                </Button>
                <Button variant="outline" size="sm" onClick={exportCron} disabled={!cronFiltered.length}>
                  <Download className="w-4 h-4 mr-2" />CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <div className="relative md:col-span-2">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    className="pl-9"
                    placeholder="Buscar por job ou mensagem…"
                    value={cronSearch}
                    onChange={e => { setCronSearch(e.target.value); setCronPage(1); }}
                  />
                </div>
                <Select value={cronJobFilter} onValueChange={v => { setCronJobFilter(v); setCronPage(1); }}>
                  <SelectTrigger><SelectValue placeholder="Job" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os jobs</SelectItem>
                    {jobNames.map(j => <SelectItem key={j} value={j}>{j}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={cronStatusFilter} onValueChange={v => { setCronStatusFilter(v); setCronPage(1); }}>
                  <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    <SelectItem value="sucesso">Sucesso</SelectItem>
                    <SelectItem value="falha">Falha</SelectItem>
                    <SelectItem value="executando">Em execução</SelectItem>
                    <SelectItem value="skipped">Ignorado</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={cronRange} onValueChange={setCronRange}>
                  <SelectTrigger><SelectValue placeholder="Período" /></SelectTrigger>
                  <SelectContent>
                    {RANGE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between text-sm text-slate-500">
                <div>{cronFiltered.length} execuç{cronFiltered.length === 1 ? "ão" : "ões"}</div>
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="w-4 h-4" />
                  <Select value={cronSort} onValueChange={v => setCronSort(v as any)}>
                    <SelectTrigger className="h-8 w-[200px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="started_desc">Início (mais recente)</SelectItem>
                      <SelectItem value="started_asc">Início (mais antigo)</SelectItem>
                      <SelectItem value="duration_desc">Duração (maior)</SelectItem>
                      <SelectItem value="status">Status</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={String(cronPageSize)} onValueChange={v => { setCronPageSize(Number(v)); setCronPage(1); }}>
                    <SelectTrigger className="h-8 w-[110px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[10, 25, 50, 100].map(n => <SelectItem key={n} value={String(n)}>{n}/página</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome do Job</TableHead>
                      <TableHead>Início</TableHead>
                      <TableHead>Fim</TableHead>
                      <TableHead>Duração</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Mensagem</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cronPageRows.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center text-slate-500 py-8">
                        {cronLoading ? "Carregando…" : "Nenhuma execução encontrada."}
                      </TableCell></TableRow>
                    )}
                    {cronPageRows.map(r => (
                      <TableRow key={r.id} className="cursor-pointer" onClick={() => setSelected(r)}>
                        <TableCell className="font-medium">{r.job_name}</TableCell>
                        <TableCell>{fmtDateTime(r.started_at)}</TableCell>
                        <TableCell>{fmtDateTime(r.finished_at)}</TableCell>
                        <TableCell>{fmtDuration(r.duration_ms)}</TableCell>
                        <TableCell>{statusBadge(r.status)}</TableCell>
                        <TableCell className="max-w-[380px] truncate text-slate-600">{r.message ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious href="#" onClick={e => { e.preventDefault(); setCronPage(p => Math.max(1, p - 1)); }} />
                  </PaginationItem>
                  <PaginationItem className="text-sm px-3">Página {cronPage} de {cronPageCount}</PaginationItem>
                  <PaginationItem>
                    <PaginationNext href="#" onClick={e => { e.preventDefault(); setCronPage(p => Math.min(cronPageCount, p + 1)); }} />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== RETENTION TAB ==================== */}
        <TabsContent value="retencao" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
              <CardTitle className="text-base">Exclusões por Política de Retenção</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={fetchRet} disabled={retLoading}>
                  <RefreshCw className={`w-4 h-4 mr-2 ${retLoading ? "animate-spin" : ""}`} />
                  Atualizar
                </Button>
                <Button variant="outline" size="sm" onClick={exportRet} disabled={!retFiltered.length}>
                  <Download className="w-4 h-4 mr-2" />CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <Select value={retEntidadeFilter} onValueChange={v => { setRetEntidadeFilter(v); setRetPage(1); }}>
                  <SelectTrigger><SelectValue placeholder="Entidade" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as entidades</SelectItem>
                    {entidades.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={retPoliticaFilter} onValueChange={v => { setRetPoliticaFilter(v); setRetPage(1); }}>
                  <SelectTrigger><SelectValue placeholder="Política" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as políticas</SelectItem>
                    {politicas.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={retRange} onValueChange={setRetRange}>
                  <SelectTrigger><SelectValue placeholder="Período" /></SelectTrigger>
                  <SelectContent>
                    {RANGE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={retSort} onValueChange={v => setRetSort(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="deleted_desc">Data (mais recente)</SelectItem>
                    <SelectItem value="deleted_asc">Data (mais antiga)</SelectItem>
                    <SelectItem value="quantidade_desc">Quantidade (maior)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between text-sm text-slate-500">
                <div>{retFiltered.length} evento{retFiltered.length === 1 ? "" : "s"}</div>
                <Select value={String(retPageSize)} onValueChange={v => { setRetPageSize(Number(v)); setRetPage(1); }}>
                  <SelectTrigger className="h-8 w-[110px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[10, 25, 50, 100].map(n => <SelectItem key={n} value={String(n)}>{n}/página</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Entidade</TableHead>
                      <TableHead>Quantidade</TableHead>
                      <TableHead>Política</TableHead>
                      <TableHead>Critério</TableHead>
                      <TableHead>Mecanismo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {retPageRows.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center text-slate-500 py-8">
                        {retLoading ? "Carregando…" : "Nenhum evento de exclusão encontrado."}
                      </TableCell></TableRow>
                    )}
                    {retPageRows.map(r => (
                      <TableRow key={r.id}>
                        <TableCell>{fmtDateTime(r.deleted_at)}</TableCell>
                        <TableCell className="font-medium">{r.entidade}</TableCell>
                        <TableCell><Badge variant="outline">{r.quantidade.toLocaleString("pt-BR")}</Badge></TableCell>
                        <TableCell>{r.politica}</TableCell>
                        <TableCell className="text-slate-600">{r.criterio ?? "—"}</TableCell>
                        <TableCell className="text-slate-600">{r.mecanismo}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious href="#" onClick={e => { e.preventDefault(); setRetPage(p => Math.max(1, p - 1)); }} />
                  </PaginationItem>
                  <PaginationItem className="text-sm px-3">Página {retPage} de {retPageCount}</PaginationItem>
                  <PaginationItem>
                    <PaginationNext href="#" onClick={e => { e.preventDefault(); setRetPage(p => Math.min(retPageCount, p + 1)); }} />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== SIMULAÇÃO TAB ==================== */}
        <TabsContent value="simulacao" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <FlaskConical className="w-4 h-4" />Simulação de Exclusão Automática
                </CardTitle>
                <p className="text-xs text-slate-500 mt-1">
                  Estima o impacto das políticas de retenção sem executar qualquer exclusão.
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={runSimulation} disabled={simLoading}>
                  <FlaskConical className={`w-4 h-4 mr-2 ${simLoading ? "animate-pulse" : ""}`} />
                  {simLoading ? "Simulando…" : "Executar Simulação"}
                </Button>
                <Button variant="outline" size="sm" onClick={exportSim} disabled={!simRows?.length}>
                  <Download className="w-4 h-4 mr-2" />CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="border-amber-200 bg-amber-50">
                <ShieldCheck className="h-4 w-4 text-amber-700" />
                <AlertTitle className="text-amber-900">Modo simulação (dry-run)</AlertTitle>
                <AlertDescription className="text-amber-800">
                  Os números abaixo são <strong>estimativas</strong> baseadas nas políticas atuais. Nenhum registro
                  foi ou será excluído por esta operação. Use para validar impacto antes de ajustar prazos em
                  <em> Configurações → Retenção de Dados</em>.
                </AlertDescription>
              </Alert>

              {simRows === null ? (
                <div className="text-center py-10 text-slate-500">
                  Clique em <strong>Executar Simulação</strong> para calcular o impacto das políticas ativas.
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <Card className="p-4">
                      <div className="text-xs text-slate-500">Seriam removidos</div>
                      <div className="text-2xl font-semibold text-amber-700">
                        {simTotal.toLocaleString("pt-BR")}
                        <span className="text-sm font-normal text-slate-500 ml-1">registros</span>
                      </div>
                    </Card>
                    <Card className="p-4">
                      <div className="text-xs text-slate-500 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" /> Protegidos por exceção
                      </div>
                      <div className="text-2xl font-semibold text-emerald-700">
                        {simProtegidos.toLocaleString("pt-BR")}
                      </div>
                    </Card>
                    <Card className="p-4">
                      <div className="text-xs text-slate-500">Políticas simuladas</div>
                      <div className="text-2xl font-semibold">{simRows.length}</div>
                    </Card>
                    <Card className="p-4">
                      <div className="text-xs text-slate-500">Executada em</div>
                      <div className="text-sm font-medium">{fmtDateTime(simAt)}</div>
                    </Card>
                  </div>


                  {simTotal === 0 && (
                    <Alert className="border-emerald-200 bg-emerald-50">
                      <ShieldCheck className="h-4 w-4 text-emerald-700" />
                      <AlertDescription className="text-emerald-800">
                        Nenhum registro seria removido pelas políticas atuais.
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="border rounded-md overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Política</TableHead>
                          <TableHead>Entidade</TableHead>
                          <TableHead>Tenant</TableHead>
                          <TableHead>Critério</TableHead>
                          <TableHead className="text-right">Removidos</TableHead>
                          <TableHead className="text-right">Protegidos</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {simRows.map((r, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{r.politica}</TableCell>
                            <TableCell className="text-slate-600">{r.entidade}</TableCell>
                            <TableCell className="text-slate-600 text-xs">
                              {r.tenant_id ? r.tenant_id.slice(0, 8) + "…" : <Badge variant="outline">global</Badge>}
                            </TableCell>
                            <TableCell className="text-slate-600 text-xs">{r.criterio}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant="outline" className={r.quantidade > 0
                                ? "bg-amber-50 text-amber-900 border-amber-200"
                                : "bg-slate-50 text-slate-600"}>
                                {r.quantidade > 0 && <AlertTriangle className="w-3 h-3 mr-1 inline" />}
                                {r.quantidade.toLocaleString("pt-BR")}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant="outline" className={(r.protegidos ?? 0) > 0
                                ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                                : "bg-slate-50 text-slate-500"}>
                                {(r.protegidos ?? 0) > 0 && <ShieldCheck className="w-3 h-3 mr-1 inline" />}
                                {(r.protegidos ?? 0).toLocaleString("pt-BR")}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {Array.isArray(r.exemplos) && r.exemplos.length > 0 && (
                                <Button variant="ghost" size="sm" onClick={() => setSimDetail(r)}>
                                  Detalhar
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* ---- Histórico de Simulações ---- */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="w-4 h-4" />Histórico de Simulações
                </CardTitle>
                <p className="text-xs text-slate-500 mt-1">
                  Registro completo de cada execução de simulação — com ID, timestamp, usuário, parâmetros e resultados.
                </p>
              </div>
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Buscar por ID, usuário, data…"
                    value={simHistoryQuery}
                    onChange={(e) => setSimHistoryQuery(e.target.value)}
                    className="pl-8 w-64"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={loadSimHistory} disabled={simHistoryLoading}>
                  <RefreshCw className={`w-4 h-4 mr-2 ${simHistoryLoading ? "animate-spin" : ""}`} />
                  Atualizar
                </Button>
                <Button variant="outline" size="sm" onClick={exportSimHistory} disabled={!simHistoryFiltered.length}>
                  <Download className="w-4 h-4 mr-2" />CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Usuário</TableHead>
                      <TableHead className="text-right">Removidos</TableHead>
                      <TableHead className="text-right">Protegidos</TableHead>
                      <TableHead className="text-right">Políticas</TableHead>
                      <TableHead className="text-right">Tenants</TableHead>
                      <TableHead className="text-right">Duração</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {simHistoryFiltered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-slate-500 py-6">
                          {simHistoryLoading ? "Carregando…" : "Nenhuma simulação registrada ainda."}
                        </TableCell>
                      </TableRow>
                    ) : simHistoryFiltered.map((h) => (
                      <TableRow key={h.id}>
                        <TableCell className="font-mono text-xs">{h.id.slice(0, 8)}…</TableCell>
                        <TableCell className="text-xs">{fmtDateTime(h.executed_at)}</TableCell>
                        <TableCell className="text-xs">{h.executed_by_email ?? h.executed_by?.slice(0, 8) ?? "—"}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline" className={h.total_removidos > 0
                            ? "bg-amber-50 text-amber-900 border-amber-200"
                            : "bg-slate-50 text-slate-600"}>
                            {h.total_removidos.toLocaleString("pt-BR")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline" className={h.total_protegidos > 0
                            ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                            : "bg-slate-50 text-slate-500"}>
                            {h.total_protegidos.toLocaleString("pt-BR")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-slate-600">{h.politicas_count}</TableCell>
                        <TableCell className="text-right text-slate-600">{h.tenants_impactados}</TableCell>
                        <TableCell className="text-right text-slate-500 text-xs">
                          {h.duracao_ms != null ? `${h.duracao_ms} ms` : "—"}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => setSimHistoryDetail(h)}>
                            Detalhar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>


        {/* ==================== EXCEÇÕES TAB ==================== */}
        <TabsContent value="excecoes" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4" />Exceções da Política de Retenção
                </CardTitle>
                <p className="text-xs text-slate-500 mt-1">
                  Registros que <strong>não são excluídos</strong> mesmo após atingir o prazo — por obrigação legal, contratual ou valor comercial contínuo.
                </p>
              </div>
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Buscar exceção…"
                    value={excecoesQuery}
                    onChange={(e) => setExcecoesQuery(e.target.value)}
                    className="pl-8 w-56"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={loadExcecoes} disabled={excecoesLoading}>
                  <RefreshCw className={`w-4 h-4 mr-2 ${excecoesLoading ? "animate-spin" : ""}`} />
                  Atualizar
                </Button>
                <Button variant="outline" size="sm" onClick={exportExcecoes} disabled={!excecoesFiltradas.length}>
                  <Download className="w-4 h-4 mr-2" />CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="border-sky-200 bg-sky-50">
                <ShieldCheck className="h-4 w-4 text-sky-700" />
                <AlertTitle className="text-sky-900">Como as exceções funcionam</AlertTitle>
                <AlertDescription className="text-sky-800">
                  Antes de excluir qualquer registro, a rotina de retenção verifica se ele atende a alguma
                  exceção abaixo. Se atender, o registro é <strong>preservado</strong> e contabilizado no campo
                  <em> "Protegidos por exceção"</em> da aba Simulação e nos logs de auditoria.
                </AlertDescription>
              </Alert>

              <div className="border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome da Exceção</TableHead>
                      <TableHead>Entidade</TableHead>
                      <TableHead>Justificativa</TableHead>
                      <TableHead>Ação</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {excecoesFiltradas.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-slate-500 py-8">
                          {excecoesLoading ? "Carregando…" : "Nenhuma exceção encontrada."}
                        </TableCell>
                      </TableRow>
                    ) : excecoesFiltradas.map((e, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{e.nome}</TableCell>
                        <TableCell className="text-slate-600 text-xs">
                          <Badge variant="outline" className="font-mono">{e.entidade}</Badge>
                        </TableCell>
                        <TableCell className="text-slate-600 text-xs max-w-md">{e.justificativa}</TableCell>
                        <TableCell className="text-slate-600 text-xs">{e.acao}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => setExcecaoDetail(e)}>
                            Ver critério
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Exceção detail dialog */}
      <Dialog open={!!excecaoDetail} onOpenChange={(o) => !o && setExcecaoDetail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              {excecaoDetail?.nome}
            </DialogTitle>
          </DialogHeader>
          {excecaoDetail && (
            <div className="space-y-3 text-sm">
              <div>
                <div className="text-slate-500 text-xs mb-1">Entidade afetada</div>
                <Badge variant="outline" className="font-mono">{excecaoDetail.entidade}</Badge>
              </div>
              <div>
                <div className="text-slate-500 text-xs mb-1">Critério de identificação</div>
                <pre className="bg-slate-50 border rounded p-3 text-xs whitespace-pre-wrap break-words">{excecaoDetail.criterio}</pre>
              </div>
              <div>
                <div className="text-slate-500 text-xs mb-1">Justificativa</div>
                <div className="text-slate-700">{excecaoDetail.justificativa}</div>
              </div>
              <div>
                <div className="text-slate-500 text-xs mb-1">Ação de retenção</div>
                <div className="text-slate-700">{excecaoDetail.acao}</div>
              </div>
              <div>
                <div className="text-slate-500 text-xs mb-1">Exemplo de registro</div>
                <pre className="bg-slate-900 text-slate-100 rounded p-3 text-xs overflow-auto max-h-64">
{JSON.stringify(excecaoDetail.exemplo ?? {}, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>


      {/* Simulation detail dialog */}
      <Dialog open={!!simDetail} onOpenChange={(o) => !o && setSimDetail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{simDetail?.politica}</DialogTitle>
          </DialogHeader>
          {simDetail && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><div className="text-slate-500">Entidade</div><div>{simDetail.entidade}</div></div>
                <div><div className="text-slate-500">Registros estimados</div><div>{simDetail.quantidade.toLocaleString("pt-BR")}</div></div>
                <div className="col-span-2"><div className="text-slate-500">Critério</div><div>{simDetail.criterio}</div></div>
              </div>
              <div>
                <div className="text-slate-500 mb-1">Exemplos (até 5)</div>
                <pre className="bg-slate-900 text-slate-100 rounded p-3 text-xs overflow-auto max-h-72">
{JSON.stringify(simDetail.exemplos ?? [], null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Simulation history detail dialog */}
      <Dialog open={!!simHistoryDetail} onOpenChange={(o) => !o && setSimHistoryDetail(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Simulação {simHistoryDetail?.id.slice(0, 8)}…</DialogTitle>
          </DialogHeader>
          {simHistoryDetail && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div><div className="text-slate-500 text-xs">Timestamp</div><div>{fmtDateTime(simHistoryDetail.executed_at)}</div></div>
                <div><div className="text-slate-500 text-xs">Usuário</div><div className="truncate">{simHistoryDetail.executed_by_email ?? simHistoryDetail.executed_by ?? "—"}</div></div>
                <div><div className="text-slate-500 text-xs">Duração</div><div>{simHistoryDetail.duracao_ms != null ? `${simHistoryDetail.duracao_ms} ms` : "—"}</div></div>
                <div><div className="text-slate-500 text-xs">Políticas</div><div>{simHistoryDetail.politicas_count}</div></div>
                <div><div className="text-slate-500 text-xs">Tenants</div><div>{simHistoryDetail.tenants_impactados}</div></div>
                <div><div className="text-slate-500 text-xs">Removidos (estim.)</div><div className="text-amber-700 font-semibold">{simHistoryDetail.total_removidos.toLocaleString("pt-BR")}</div></div>
                <div><div className="text-slate-500 text-xs">Protegidos</div><div className="text-emerald-700 font-semibold">{simHistoryDetail.total_protegidos.toLocaleString("pt-BR")}</div></div>
                <div><div className="text-slate-500 text-xs">ID completo</div><div className="font-mono text-xs break-all">{simHistoryDetail.id}</div></div>
              </div>
              <div>
                <div className="text-slate-500 mb-1 text-xs">Parâmetros</div>
                <pre className="bg-slate-50 border rounded p-3 text-xs overflow-auto max-h-32">
{JSON.stringify(simHistoryDetail.parametros ?? {}, null, 2)}
                </pre>
              </div>
              <div>
                <div className="text-slate-500 mb-1 text-xs">Resultados por política</div>
                <pre className="bg-slate-900 text-slate-100 rounded p-3 text-xs overflow-auto max-h-96">
{JSON.stringify(simHistoryDetail.resultados ?? [], null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>


      {/* Detail dialog for cron log */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selected?.job_name}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><div className="text-slate-500">Início</div><div>{fmtDateTime(selected.started_at)}</div></div>
                <div><div className="text-slate-500">Fim</div><div>{fmtDateTime(selected.finished_at)}</div></div>
                <div><div className="text-slate-500">Duração</div><div>{fmtDuration(selected.duration_ms)}</div></div>
                <div><div className="text-slate-500">Status</div><div>{statusBadge(selected.status)}</div></div>
                <div className="col-span-2"><div className="text-slate-500">Servidor</div><div>{selected.servidor ?? "—"}</div></div>
              </div>
              <div>
                <div className="text-slate-500 mb-1">Mensagem</div>
                <div className="bg-slate-50 border rounded p-3 whitespace-pre-wrap break-words">
                  {selected.message ?? "—"}
                </div>
              </div>
              <div>
                <div className="text-slate-500 mb-1">Metadata</div>
                <pre className="bg-slate-900 text-slate-100 rounded p-3 text-xs overflow-auto max-h-72">
{JSON.stringify(selected.metadata ?? {}, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
