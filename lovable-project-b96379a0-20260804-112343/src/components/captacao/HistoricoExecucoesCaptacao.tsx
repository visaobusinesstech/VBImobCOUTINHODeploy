import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, RefreshCcw, Download, History, Search, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type ExecRow = {
  id: string;
  action: string;
  portais_consultados: string[];
  cidades_alvo: string[];
  parametros: Record<string, any>;
  status: string;
  resultados_encontrados: number;
  itens_processados: number;
  duracao_ms: number | null;
  erro: string | null;
  iniciado_em: string;
  finalizado_em: string | null;
};

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  executando: { label: "Executando", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  sucesso: { label: "Sucesso", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  falha: { label: "Falha", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
  concluido_com_erros: { label: "Concluído com erros", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  parcial: { label: "Parcialmente concluído", className: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200" },
};

const formatDuracao = (ms: number | null) => {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)} s`;
  const m = Math.floor(s / 60);
  const rest = Math.round(s % 60);
  return `${m}m ${rest}s`;
};

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const DEFAULT_PAGE_SIZE = 25;

export function HistoricoExecucoesCaptacao() {
  const [rows, setRows] = useState<ExecRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>("todos");
  const [q, setQ] = useState("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [detalhe, setDetalhe] = useState<ExecRow | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("captacao_execucoes_historico")
      .select("*")
      .order("iniciado_em", { ascending: false })
      .limit(1000);
    if (!error && data) setRows(data as any);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const from = dateFrom ? new Date(dateFrom).getTime() : null;
    // include the whole "to" day
    const to = dateTo ? new Date(dateTo).getTime() + 24 * 60 * 60 * 1000 - 1 : null;
    return rows.filter((r) => {
      if (status !== "todos" && r.status !== status) return false;
      const t = new Date(r.iniciado_em).getTime();
      if (from != null && t < from) return false;
      if (to != null && t > to) return false;
      if (!term) return true;
      const hay = [
        r.id,
        r.action,
        r.status,
        (r.cidades_alvo || []).join(" "),
        (r.portais_consultados || []).join(" "),
        JSON.stringify(r.parametros || {}),
      ].join(" ").toLowerCase();
      return hay.includes(term);
    });
  }, [rows, q, status, dateFrom, dateTo]);

  // Reset to page 1 whenever filters change
  useEffect(() => { setPage(1); }, [q, status, dateFrom, dateTo, pageSize]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIdx = total === 0 ? 0 : (currentPage - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, total);
  const pageRows = filtered.slice(startIdx, endIdx);

  // Compact page-number window
  const pageNumbers = useMemo(() => {
    const nums: (number | "…")[] = [];
    const push = (n: number | "…") => nums.push(n);
    const window = 1;
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - window && i <= currentPage + window)) {
        push(i);
      } else if (nums[nums.length - 1] !== "…") {
        push("…");
      }
    }
    return nums;
  }, [currentPage, totalPages]);

  const activeFilters: { key: string; label: string; clear: () => void }[] = [];
  if (q) activeFilters.push({ key: "q", label: `Busca: "${q}"`, clear: () => setQ("") });
  if (status !== "todos") activeFilters.push({ key: "status", label: `Status: ${STATUS_LABEL[status]?.label ?? status}`, clear: () => setStatus("todos") });
  if (dateFrom) activeFilters.push({ key: "from", label: `De: ${dateFrom}`, clear: () => setDateFrom("") });
  if (dateTo) activeFilters.push({ key: "to", label: `Até: ${dateTo}`, clear: () => setDateTo("") });

  const clearAll = () => {
    setQ(""); setStatus("todos"); setDateFrom(""); setDateTo("");
  };

  const exportCSV = () => {
    const headers = [
      "id","iniciado_em","action","portais_consultados","cidades_alvo","parametros",
      "status","resultados_encontrados","itens_processados","duracao_ms","erro",
    ];
    const escape = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [
      headers.join(","),
      ...filtered.map((r) => [
        r.id,
        r.iniciado_em,
        r.action,
        (r.portais_consultados || []).join("|"),
        (r.cidades_alvo || []).join("|"),
        JSON.stringify(r.parametros || {}),
        r.status,
        r.resultados_encontrados,
        r.itens_processados,
        r.duracao_ms ?? "",
        r.erro ?? "",
      ].map(escape).join(",")),
    ].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const ts = format(new Date(), "yyyyMMdd_HHmmss");
    const a = document.createElement("a");
    a.href = url;
    a.download = `lovable_historico_execucoes_${ts}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="w-4 h-4" />
              Histórico de Execuções da Captação Inteligente
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={load} className="h-8">
                <RefreshCcw className="w-3.5 h-3.5 mr-1.5" />
                Atualizar
              </Button>
              <Button variant="outline" size="sm" onClick={exportCSV} className="h-8" disabled={filtered.length === 0}>
                <Download className="w-3.5 h-3.5 mr-1.5" />
                CSV
              </Button>
            </div>
          </div>

          {/* Filters row */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="ID, cidade, portal, ação, parâmetro..."
                className="h-8 pl-8 w-72 text-sm"
              />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-8 w-48 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="sucesso">Sucesso</SelectItem>
                <SelectItem value="concluido_com_erros">Concluído com erros</SelectItem>
                <SelectItem value="parcial">Parcialmente concluído</SelectItem>
                <SelectItem value="falha">Falha</SelectItem>
                <SelectItem value="executando">Executando</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">De</span>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-8 w-[150px] text-sm"
              />
              <span className="text-xs text-muted-foreground">até</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-8 w-[150px] text-sm"
              />
            </div>
            {activeFilters.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearAll} className="h-8 text-xs">
                Limpar filtros
              </Button>
            )}
          </div>

          {/* Active filter chips */}
          {activeFilters.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {activeFilters.map((f) => (
                <Badge key={f.key} variant="secondary" className="gap-1 pl-2 pr-1 text-xs font-normal">
                  {f.label}
                  <button
                    onClick={f.clear}
                    className="ml-0.5 rounded-sm hover:bg-muted-foreground/20 p-0.5"
                    aria-label={`Remover filtro ${f.label}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground gap-2 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando histórico...
          </div>
        ) : total === 0 ? (
          <div className="text-center py-10 text-sm text-muted-foreground">
            Nenhuma execução registrada com os filtros atuais.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[110px]">ID</TableHead>
                    <TableHead>Início</TableHead>
                    <TableHead>Cidades alvo</TableHead>
                    <TableHead>Portais</TableHead>
                    <TableHead>Parâmetros</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Encontrados</TableHead>
                    <TableHead className="text-right">Processados</TableHead>
                    <TableHead className="text-right">Duração</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.map((r) => {
                    const s = STATUS_LABEL[r.status] || { label: r.status, className: "bg-muted text-foreground" };
                    const params = r.parametros || {};
                    const paramSummary = [
                      params.tipo_imovel && `Tipo: ${params.tipo_imovel}`,
                      params.operacao && `Op: ${params.operacao}`,
                      params.bairro && `Bairro: ${params.bairro}`,
                      params.faixa_preco?.min != null && `Min: ${params.faixa_preco.min}`,
                      params.faixa_preco?.max != null && `Max: ${params.faixa_preco.max}`,
                      params.nome_predio && `Prédio: ${params.nome_predio}`,
                    ].filter(Boolean).join(" • ") || "—";
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-[11px]">{r.id.slice(0, 8)}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {format(new Date(r.iniciado_em), "dd/MM/yy HH:mm:ss", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-xs max-w-[180px] truncate">
                          {(r.cidades_alvo || []).join(", ") || "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          <span title={(r.portais_consultados || []).join(", ")}>
                            {r.portais_consultados?.length || 0} portais
                          </span>
                        </TableCell>
                        <TableCell className="text-xs max-w-[260px] truncate" title={paramSummary}>
                          {paramSummary}
                        </TableCell>
                        <TableCell>
                          <Badge className={s.className}>{s.label}</Badge>
                        </TableCell>
                        <TableCell className="text-right text-xs">{r.resultados_encontrados}</TableCell>
                        <TableCell className="text-right text-xs">{r.itens_processados}</TableCell>
                        <TableCell className="text-right text-xs whitespace-nowrap">{formatDuracao(r.duracao_ms)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setDetalhe(r)}>
                            Ver
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Pagination footer */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mt-3">
              <div className="text-xs text-muted-foreground">
                Exibindo <strong>{startIdx + 1}</strong>–<strong>{endIdx}</strong> de{" "}
                <strong>{total.toLocaleString("pt-BR")}</strong> execuç{total === 1 ? "ão" : "ões"}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Itens por página</span>
                  <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                    <SelectTrigger className="h-8 w-[72px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_SIZE_OPTIONS.map((n) => (
                        <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(1)} disabled={currentPage === 1} aria-label="Primeira página">
                    <ChevronsLeft className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} aria-label="Página anterior">
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  {pageNumbers.map((n, i) =>
                    n === "…" ? (
                      <span key={`e-${i}`} className="px-1.5 text-xs text-muted-foreground">…</span>
                    ) : (
                      <Button
                        key={n}
                        variant={n === currentPage ? "default" : "outline"}
                        size="sm"
                        className="h-8 min-w-8 px-2 text-xs"
                        onClick={() => setPage(n)}
                      >
                        {n}
                      </Button>
                    )
                  )}
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} aria-label="Próxima página">
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(totalPages)} disabled={currentPage === totalPages} aria-label="Última página">
                    <ChevronsRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>

      <Dialog open={!!detalhe} onOpenChange={(o) => !o && setDetalhe(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes da execução</DialogTitle>
          </DialogHeader>
          {detalhe && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">ID:</span> <span className="font-mono text-xs">{detalhe.id}</span></div>
                <div><span className="text-muted-foreground">Ação:</span> {detalhe.action}</div>
                <div><span className="text-muted-foreground">Início:</span> {format(new Date(detalhe.iniciado_em), "dd/MM/yyyy HH:mm:ss")}</div>
                <div><span className="text-muted-foreground">Fim:</span> {detalhe.finalizado_em ? format(new Date(detalhe.finalizado_em), "dd/MM/yyyy HH:mm:ss") : "—"}</div>
                <div><span className="text-muted-foreground">Duração:</span> {formatDuracao(detalhe.duracao_ms)}</div>
                <div><span className="text-muted-foreground">Status:</span> {STATUS_LABEL[detalhe.status]?.label || detalhe.status}</div>
                <div><span className="text-muted-foreground">Encontrados:</span> {detalhe.resultados_encontrados}</div>
                <div><span className="text-muted-foreground">Processados:</span> {detalhe.itens_processados}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Cidades alvo</div>
                <div className="text-xs">{(detalhe.cidades_alvo || []).join(", ") || "—"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Portais consultados ({detalhe.portais_consultados?.length || 0})</div>
                <div className="text-xs break-words">{(detalhe.portais_consultados || []).join(", ") || "—"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Parâmetros</div>
                <pre className="text-[11px] bg-muted p-2 rounded overflow-x-auto max-h-56">
{JSON.stringify(detalhe.parametros, null, 2)}
                </pre>
              </div>
              {detalhe.erro && (
                <div>
                  <div className="text-xs text-red-600 mb-1">Erro</div>
                  <div className="text-xs whitespace-pre-wrap">{detalhe.erro}</div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
