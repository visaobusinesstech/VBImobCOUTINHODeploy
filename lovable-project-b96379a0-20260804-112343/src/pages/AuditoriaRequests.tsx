import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Copy, RefreshCw, Search, Download, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, ArrowUpDown, Bookmark, BookmarkPlus, Trash2, Link2 } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Navigate, useSearchParams } from "react-router-dom";

interface Row {
  id: string;
  request_id: string;
  function_name: string;
  user_id: string | null;
  status: string;
  http_status: number | null;
  duration_ms: number | null;
  error_message: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
}

const STATUS_COLOR: Record<string, string> = {
  ok: "bg-emerald-600",
  error: "bg-destructive",
  started: "bg-muted-foreground",
};

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];

function csvEscape(value: any): string {
  if (value === null || value === undefined) return "";
  const str = typeof value === "object" ? JSON.stringify(value) : String(value);
  if (/[",\n;]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

type SortKey = "created_at" | "function_name" | "status" | "request_id";

function SortableTh({
  label, sortKey, current, dir, onSort,
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  dir: "asc" | "desc";
  onSort: (k: SortKey) => void;
}) {
  const active = current === sortKey;
  const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th className="text-left p-2">
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${active ? "text-foreground font-semibold" : ""}`}
        aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
      >
        {label}
        <Icon className={`w-3 h-3 ${active ? "opacity-100" : "opacity-50"}`} />
      </button>
    </th>
  );
}

export default function AuditoriaRequests() {
  const { isMaster, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // Strict whitelist validation for URL params (prevents inconsistent state from shared links)
  const VALID_SORT_KEYS = ["created_at", "function_name", "status", "request_id"] as const;
  const VALID_SORT_DIRS = ["asc", "desc"] as const;
  const VALID_STATUS = ["all", "ok", "error", "started"] as const;
  const FN_NAME_RE = /^[a-zA-Z0-9_-]{1,80}$/;
  const droppedParams: string[] = [];

  const safeRaw = (key: string): string | null => {
    try { return searchParams.get(key); } catch { return null; }
  };
  const pickEnum = <T extends string>(key: string, allowed: readonly T[], fallback: T): T => {
    const v = safeRaw(key);
    if (v === null) return fallback;
    if ((allowed as readonly string[]).includes(v)) return v as T;
    droppedParams.push(key);
    return fallback;
  };
  const pickInt = (key: string, allowed: readonly number[] | null, fallback: number, min = 1, max = 1e6): number => {
    const raw = safeRaw(key);
    if (raw === null) return fallback;
    const n = Number(raw);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < min || n > max) {
      droppedParams.push(key); return fallback;
    }
    if (allowed && !allowed.includes(n)) { droppedParams.push(key); return fallback; }
    return n;
  };
  const pickString = (key: string, maxLen: number, pattern?: RegExp): string => {
    const raw = safeRaw(key);
    if (raw === null || raw === "") return "";
    const trimmed = raw.trim().slice(0, maxLen);
    if (pattern && !pattern.test(trimmed)) { droppedParams.push(key); return ""; }
    return trimmed;
  };

  const initialSortKey: SortKey = pickEnum("sort", VALID_SORT_KEYS, "created_at");
  const initialSortDir: "asc" | "desc" = pickEnum("dir", VALID_SORT_DIRS, "desc");
  const initialPageSize = pickInt("size", PAGE_SIZE_OPTIONS, 50);
  const initialPage = pickInt("page", null, 1, 1, 100000);
  const initialSearch = pickString("q", 200);
  const initialStatus = pickEnum("status", VALID_STATUS, "all");
  const initialFn = (() => {
    const raw = safeRaw("fn");
    if (raw === null || raw === "all" || raw === "") return "all";
    if (!FN_NAME_RE.test(raw)) { droppedParams.push("fn"); return "all"; }
    return raw;
  })();

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
  const [fnFilter, setFnFilter] = useState<string>(initialFn);
  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [sortKey, setSortKey] = useState<SortKey>(initialSortKey);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(initialSortDir);
  const [invalidParamsOnLoad] = useState<string[]>(droppedParams);

  // Sync state -> URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (fnFilter !== "all") params.set("fn", fnFilter);
    if (sortKey !== "created_at") params.set("sort", sortKey);
    if (sortDir !== "desc") params.set("dir", sortDir);
    if (pageSize !== 50) params.set("size", String(pageSize));
    if (page !== 1) params.set("page", String(page));
    const currentView = searchParams.get("view");
    if (currentView) params.set("view", currentView);
    setSearchParams(params, { replace: true });
  }, [search, statusFilter, fnFilter, sortKey, sortDir, pageSize, page, setSearchParams]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "created_at" ? "desc" : "asc");
    }
  };

  // Saved views (localStorage)
  type SavedView = {
    id: string;
    name: string;
    q: string;
    status: string;
    fn: string;
    sort: SortKey;
    dir: "asc" | "desc";
    size: number;
    page: number;
  };
  const VIEWS_STORAGE_KEY = "auditoria-requests:saved-views:v1";
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [newViewName, setNewViewName] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(VIEWS_STORAGE_KEY);
      if (raw) setSavedViews(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  const persistViews = (views: SavedView[]) => {
    setSavedViews(views);
    try { localStorage.setItem(VIEWS_STORAGE_KEY, JSON.stringify(views)); } catch { /* ignore */ }
  };

  const saveCurrentView = () => {
    const name = newViewName.trim();
    if (!name) {
      toast({ title: "Informe um nome", variant: "destructive" });
      return;
    }
    const view: SavedView = {
      id: crypto.randomUUID(),
      name,
      q: search,
      status: statusFilter,
      fn: fnFilter,
      sort: sortKey,
      dir: sortDir,
      size: pageSize,
      page,
    };
    persistViews([view, ...savedViews.filter((v) => v.name !== name)]);
    setSaveDialogOpen(false);
    setNewViewName("");
    toast({ title: "Visualização salva", description: name });
  };

  const loadView = (v: SavedView) => {
    setSearch(v.q);
    setStatusFilter(v.status);
    setFnFilter(v.fn);
    setSortKey(v.sort);
    setSortDir(v.dir);
    setPageSize(v.size);
    setPage(v.page);
    toast({ title: "Visualização carregada", description: v.name });
  };

  const deleteView = (id: string) => {
    persistViews(savedViews.filter((v) => v.id !== id));
  };

  const buildViewUrl = (v: SavedView) => {
    const params = new URLSearchParams();
    if (v.q) params.set("q", v.q);
    if (v.status !== "all") params.set("status", v.status);
    if (v.fn !== "all") params.set("fn", v.fn);
    if (v.sort !== "created_at") params.set("sort", v.sort);
    if (v.dir !== "desc") params.set("dir", v.dir);
    if (v.size !== 50) params.set("size", String(v.size));
    if (v.page !== 1) params.set("page", String(v.page));
    params.set("view", v.name);
    return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
  };

  const copyViewLink = async (v: SavedView) => {
    const url = buildViewUrl(v);
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copiado", description: v.name });
    } catch {
      toast({ title: "Não foi possível copiar o link", variant: "destructive" });
    }
  };

  const copyCurrentViewLink = async () => {
    const name = (searchParams.get("view") || "Visualização atual").trim();
    const tempView: SavedView = {
      id: "current", name,
      q: search, status: statusFilter, fn: fnFilter,
      sort: sortKey, dir: sortDir, size: pageSize, page,
    };
    await copyViewLink(tempView);
  };

  // Notify when opening a shared link (with or without "view" name)
  useEffect(() => {
    const v = searchParams.get("view");
    const sharedKeys = ["q", "status", "fn", "sort", "dir", "size", "page"];
    const hasState = sharedKeys.some((k) => searchParams.get(k));
    if (v) {
      toast({ title: "Visualização carregada", description: v });
    } else if (hasState) {
      const summary: string[] = [];
      if (search) summary.push(`busca "${search}"`);
      if (statusFilter !== "all") summary.push(`status=${statusFilter}`);
      if (fnFilter !== "all") summary.push(`função=${fnFilter}`);
      if (sortKey !== "created_at" || sortDir !== "desc") summary.push(`ordem=${sortKey}:${sortDir}`);
      toast({
        title: "Configuração compartilhada aplicada",
        description: summary.join(" · ") || "Filtros restaurados da URL",
      });
    }
    if (invalidParamsOnLoad.length > 0) {
      toast({
        title: "Parâmetros inválidos ignorados",
        description: invalidParamsOnLoad.join(", "),
        variant: "destructive",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const fetchRows = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("edge_function_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      toast({ title: "Falha ao carregar", description: error.message, variant: "destructive" });
    } else {
      setRows((data || []) as Row[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isMaster) fetchRows();
  }, [isMaster]);

  const functions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.function_name))).sort(),
    [rows],
  );

  // Reconcile fn filter against actual functions once data loads
  useEffect(() => {
    if (!loading && fnFilter !== "all" && functions.length > 0 && !functions.includes(fnFilter)) {
      const dropped = fnFilter;
      setFnFilter("all");
      toast({
        title: "Função desconhecida ignorada",
        description: `"${dropped}" não existe nos registros carregados.`,
        variant: "destructive",
      });
    }
  }, [loading, functions, fnFilter, toast]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (fnFilter !== "all" && r.function_name !== fnFilter) return false;
      if (!q) return true;
      return (
        r.request_id.toLowerCase().includes(q) ||
        (r.user_id ?? "").toLowerCase().includes(q) ||
        (r.error_message ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, statusFilter, fnFilter]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [search, statusFilter, fnFilter, pageSize]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      const av = (a[sortKey] ?? "") as string;
      const bv = (b[sortKey] ?? "") as string;
      if (sortKey === "created_at") {
        return (new Date(av).getTime() - new Date(bv).getTime()) * dir;
      }
      return av.localeCompare(bv, "pt-BR", { sensitivity: "base" }) * dir;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const paginated = sorted.slice(pageStart, pageStart + pageSize);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copiado", description: text });
    } catch {
      toast({ title: "Não foi possível copiar", variant: "destructive" });
    }
  };

  const exportCsv = () => {
    if (filtered.length === 0) {
      toast({ title: "Nada para exportar", description: "Ajuste os filtros e tente novamente.", variant: "destructive" });
      return;
    }
    const headers = [
      "created_at", "function_name", "status", "http_status",
      "duration_ms", "request_id", "user_id", "error_message", "metadata",
    ];
    const lines = [headers.join(",")];
    for (const r of sorted) {
      lines.push([
        new Date(r.created_at).toISOString(),
        r.function_name,
        r.status,
        r.http_status ?? "",
        r.duration_ms ?? "",
        r.request_id,
        r.user_id ?? "",
        r.error_message ?? "",
        r.metadata ? JSON.stringify(r.metadata) : "",
      ].map(csvEscape).join(","));
    }
    const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `auditoria-requests-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Exportado", description: `${filtered.length} registro(s) exportado(s).` });
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }
  if (!isMaster) return <Navigate to="/dashboard" replace />;

  return (
    <div className="space-y-4 p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Auditoria de requisições</h1>
          <p className="text-sm text-muted-foreground">
            Histórico de chamadas das edge functions — use o <code>request_id</code> para correlacionar com logs.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Bookmark className="w-4 h-4" />
                Visualizações
                {savedViews.length > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center rounded-full bg-muted px-1.5 text-[10px] font-semibold">
                    {savedViews.length}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel>Salvas</DropdownMenuLabel>
              {savedViews.length === 0 && (
                <div className="px-2 py-3 text-xs text-muted-foreground">
                  Nenhuma visualização salva ainda.
                </div>
              )}
              {savedViews.map((v) => (
                <DropdownMenuItem
                  key={v.id}
                  className="flex items-center justify-between gap-2"
                  onSelect={(e) => { e.preventDefault(); loadView(v); }}
                >
                  <span className="truncate">{v.name}</span>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Button
                      size="icon" variant="ghost" className="h-6 w-6"
                      onClick={(e) => { e.stopPropagation(); copyViewLink(v); }}
                      aria-label={`Copiar link de ${v.name}`}
                      title="Copiar link compartilhável"
                    >
                      <Link2 className="w-3 h-3" />
                    </Button>
                    <Button
                      size="icon" variant="ghost" className="h-6 w-6"
                      onClick={(e) => { e.stopPropagation(); deleteView(v.id); }}
                      aria-label={`Excluir ${v.name}`}
                    >
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </Button>
                  </div>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setSaveDialogOpen(true); }}>
                <BookmarkPlus className="w-4 h-4 mr-2" /> Salvar visualização atual
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); copyCurrentViewLink(); }}>
                <Link2 className="w-4 h-4 mr-2" /> Copiar link da visualização atual
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={exportCsv} variant="outline" size="sm" className="gap-2" disabled={loading || filtered.length === 0}>
            <Download className="w-4 h-4" /> Exportar CSV
          </Button>
          <Button onClick={fetchRows} variant="outline" size="sm" className="gap-2" disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </div>
      </div>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Salvar visualização</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="view-name">Nome</Label>
            <Input
              id="view-name"
              value={newViewName}
              onChange={(e) => setNewViewName(e.target.value)}
              placeholder="Ex.: Erros das últimas 24h"
              onKeyDown={(e) => { if (e.key === "Enter") saveCurrentView(); }}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Salva filtros, busca, ordenação e paginação atuais.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveCurrentView}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2 top-2.5 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Buscar por request_id, user_id ou erro..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="ok">Sucesso</SelectItem>
              <SelectItem value="error">Erro</SelectItem>
              <SelectItem value="started">Iniciado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={fnFilter} onValueChange={setFnFilter}>
            <SelectTrigger><SelectValue placeholder="Função" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas funções</SelectItem>
              {functions.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <SortableTh label="Quando" sortKey="created_at" current={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortableTh label="Função" sortKey="function_name" current={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortableTh label="Status" sortKey="status" current={sortKey} dir={sortDir} onSort={toggleSort} />
                <th className="text-left p-2">HTTP</th>
                <th className="text-left p-2">Duração</th>
                <SortableTh label="Request ID" sortKey="request_id" current={sortKey} dir={sortDir} onSort={toggleSort} />
                <th className="text-left p-2">Usuário</th>
                <th className="text-left p-2">Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Carregando...
                </td></tr>
              )}
              {!loading && paginated.length === 0 && (
                <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">
                  Nenhuma requisição encontrada.
                </td></tr>
              )}
              {paginated.map((r) => (
                <tr key={r.id} className="border-t hover:bg-muted/20">
                  <td className="p-2 whitespace-nowrap">
                    {new Date(r.created_at).toLocaleString("pt-BR")}
                  </td>
                  <td className="p-2 font-mono">{r.function_name}</td>
                  <td className="p-2">
                    <Badge className={`${STATUS_COLOR[r.status] || "bg-muted"} text-white`}>
                      {r.status}
                    </Badge>
                  </td>
                  <td className="p-2">{r.http_status ?? "—"}</td>
                  <td className="p-2">{r.duration_ms != null ? `${r.duration_ms} ms` : "—"}</td>
                  <td className="p-2">
                    <div className="flex items-center gap-1">
                      <code className="font-mono text-[11px] break-all">{r.request_id}</code>
                      <Button
                        size="icon" variant="ghost" className="h-6 w-6 shrink-0"
                        onClick={() => copy(r.request_id)}
                        aria-label="Copiar request_id"
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  </td>
                  <td className="p-2 font-mono text-[11px]">
                    {r.user_id ? r.user_id.slice(0, 8) + "…" : "—"}
                  </td>
                  <td className="p-2 max-w-xs">
                    {r.error_message && (
                      <div className="text-destructive truncate" title={r.error_message}>
                        {r.error_message}
                      </div>
                    )}
                    {r.metadata && (
                      <details className="text-muted-foreground">
                        <summary className="cursor-pointer">payload (input/output)</summary>
                        {(r.metadata as any).input !== undefined && (
                          <div className="mt-1">
                            <div className="text-[10px] font-semibold text-foreground">▸ input</div>
                            <pre className="text-[10px] whitespace-pre-wrap bg-muted/40 p-1 rounded">
                              {JSON.stringify((r.metadata as any).input, null, 2)}
                            </pre>
                          </div>
                        )}
                        {(r.metadata as any).output !== undefined && (
                          <div className="mt-1">
                            <div className="text-[10px] font-semibold text-foreground">▸ output</div>
                            <pre className="text-[10px] whitespace-pre-wrap bg-muted/40 p-1 rounded">
                              {JSON.stringify((r.metadata as any).output, null, 2)}
                            </pre>
                          </div>
                        )}
                        <div className="mt-1">
                          <div className="text-[10px] font-semibold text-foreground">▸ metadata completo</div>
                          <pre className="text-[10px] whitespace-pre-wrap">
                            {JSON.stringify(r.metadata, null, 2)}
                          </pre>
                        </div>
                      </details>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!loading && filtered.length > 0 && (
            <div className="flex items-center justify-between flex-wrap gap-3 p-3 border-t bg-muted/20 text-xs">
              <div className="text-muted-foreground">
                Mostrando <strong>{pageStart + 1}</strong>–<strong>{Math.min(pageStart + pageSize, filtered.length)}</strong> de <strong>{filtered.length}</strong>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Por página:</span>
                <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                  <SelectTrigger className="h-8 w-[80px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZE_OPTIONS.map((s) => (
                      <SelectItem key={s} value={String(s)}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm" variant="outline" className="h-8 gap-1"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                >
                  <ChevronLeft className="w-3 h-3" /> Anterior
                </Button>
                <span className="px-2">
                  Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong>
                </span>
                <Button
                  size="sm" variant="outline" className="h-8 gap-1"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                >
                  Próxima <ChevronRight className="w-3 h-3" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
