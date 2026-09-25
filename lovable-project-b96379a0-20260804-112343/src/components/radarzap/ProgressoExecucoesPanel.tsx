import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Download,
  FileJson,
  FileSpreadsheet,
  MessageSquare,
  RefreshCw,
  Rocket,
  Timer,
  Users,
  Zap,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

type ExecRow = {
  id: string;
  run_id: string;
  imobiliaria_id: string;
  cidades: string[] | null;
  termo: string | null;
  modo: string | null;
  retry_of_run_id: string | null;
  queries: number;
  encontrados: number;
  inseridos: number;
  total_raw_items: number;
  total_invites_validos: number;
  total_ms: number;
  erros: unknown;
  telemetria: unknown;
  created_at: string;
};

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  });

const isoStartOf = (d: string) => new Date(d + "T00:00:00").toISOString();
const isoEndOf = (d: string) => {
  const end = new Date(d + "T00:00:00");
  end.setHours(23, 59, 59, 999);
  return end.toISOString();
};

const defaultDe = () => {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
};
const defaultAte = () => new Date().toISOString().slice(0, 10);

type Totais = {
  execs: number;
  grupos_encontrados: number;
  grupos_inseridos: number;
  mensagens_analisadas: number;
  leads_gerados: number;
  erros: number;
};

type StatusExec = "sucesso" | "parcial" | "erro" | "vazio";

function computeStatus(row: ExecRow): StatusExec {
  const erros = Array.isArray(row.erros) ? (row.erros as unknown[]).length : 0;
  if (erros > 0) return row.encontrados > 0 ? "parcial" : "erro";
  return row.encontrados > 0 ? "sucesso" : "vazio";
}

export default function ProgressoExecucoesPanel() {
  const { user, isMaster } = useAuth();
  const [de, setDe] = useState(defaultDe);
  const [ate, setAte] = useState(defaultAte);
  const [execs, setExecs] = useState<ExecRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [mensagensAnalisadas, setMensagensAnalisadas] = useState(0);
  const [leadsGerados, setLeadsGerados] = useState(0);

  // Filtros avançados
  const [filtroCidade, setFiltroCidade] = useState("");
  const [filtroTermo, setFiltroTermo] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<"todos" | StatusExec>("todos");
  const [httpMin, setHttpMin] = useState("");
  const [httpMax, setHttpMax] = useState("");

  const carregar = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const gte = isoStartOf(de);
    const lte = isoEndOf(ate);

    const execQ = supabase
      .from("radarzap_descoberta_execucoes")
      .select("*")
      .gte("created_at", gte)
      .lte("created_at", lte)
      .order("created_at", { ascending: false })
      .limit(200);

    const msgQ = supabase
      .from("radarzap_mensagens")
      .select("*", { count: "exact", head: true })
      .eq("analisado", true)
      .gte("created_at", gte)
      .lte("created_at", lte);

    const leadQ = supabase
      .from("radarzap_leads")
      .select("*", { count: "exact", head: true })
      .gte("created_at", gte)
      .lte("created_at", lte);

    const [execRes, msgRes, leadRes] = await Promise.all([execQ, msgQ, leadQ]);

    if (execRes.error) {
      toast.error("Falha ao carregar execuções", {
        description: execRes.error.message,
      });
      setExecs([]);
    } else {
      setExecs((execRes.data ?? []) as ExecRow[]);
    }
    setMensagensAnalisadas(msgRes.count ?? 0);
    setLeadsGerados(leadRes.count ?? 0);
    setLoading(false);
  }, [user?.id, de, ate]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Realtime — atualiza automaticamente quando novas execuções são registradas
  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel(`radarzap-progresso-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "radarzap_descoberta_execucoes",
          filter: isMaster ? undefined : `imobiliaria_id=eq.${user.id}`,
        },
        () => carregar(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user?.id, isMaster, carregar]);

  const totais: Totais = useMemo(() => {
    const erros = execs.reduce(
      (s, r) => s + (Array.isArray(r.erros) ? (r.erros as unknown[]).length : 0),
      0,
    );
    const grupos_encontrados = execs.reduce((s, r) => s + (r.encontrados ?? 0), 0);
    const grupos_inseridos = execs.reduce((s, r) => s + (r.inseridos ?? 0), 0);
    return {
      execs: execs.length,
      grupos_encontrados,
      grupos_inseridos,
      mensagens_analisadas: mensagensAnalisadas,
      leads_gerados: leadsGerados,
      erros,
    };
  }, [execs, mensagensAnalisadas, leadsGerados]);

  const cidadeQ = filtroCidade.trim().toLowerCase();
  const termoQ = filtroTermo.trim().toLowerCase();
  const httpMinN = httpMin.trim() ? Number(httpMin) : null;
  const httpMaxN = httpMax.trim() ? Number(httpMax) : null;
  const temFiltroTel = !!cidadeQ || !!termoQ || httpMinN !== null || httpMaxN !== null;

  const matchTel = useCallback(
    (t: any) => {
      if (cidadeQ && !String(t?.cidade ?? "").toLowerCase().includes(cidadeQ)) return false;
      if (termoQ && !String(t?.termo ?? "").toLowerCase().includes(termoQ)) return false;
      const st = Number(t?.status);
      if (httpMinN !== null && !(Number.isFinite(st) && st >= httpMinN)) return false;
      if (httpMaxN !== null && !(Number.isFinite(st) && st <= httpMaxN)) return false;
      return true;
    },
    [cidadeQ, termoQ, httpMinN, httpMaxN],
  );

  const execsFiltrados = useMemo(() => {
    return execs
      .map((r) => {
        const tel = Array.isArray(r.telemetria) ? (r.telemetria as any[]) : [];
        const telFiltrada = temFiltroTel ? tel.filter(matchTel) : tel;
        return { row: r, telFiltrada, status: computeStatus(r) };
      })
      .filter(({ row, telFiltrada, status }) => {
        if (filtroStatus !== "todos" && status !== filtroStatus) return false;
        // filtro cidade também casa contra cidades da execução
        if (cidadeQ) {
          const cidades = (row.cidades ?? []).map((c) => c.toLowerCase());
          const casaExec = cidades.some((c) => c.includes(cidadeQ));
          if (!casaExec && telFiltrada.length === 0) return false;
        }
        if (termoQ) {
          const casaExec = String(row.termo ?? "").toLowerCase().includes(termoQ);
          if (!casaExec && telFiltrada.length === 0) return false;
        }
        if ((httpMinN !== null || httpMaxN !== null) && telFiltrada.length === 0) return false;
        return true;
      });
  }, [execs, temFiltroTel, matchTel, filtroStatus, cidadeQ, termoQ, httpMinN, httpMaxN]);

  const execsParaExport: ExecRow[] = useMemo(
    () =>
      execsFiltrados.map(({ row, telFiltrada }) =>
        temFiltroTel ? ({ ...row, telemetria: telFiltrada } as ExecRow) : row,
      ),
    [execsFiltrados, temFiltroTel],
  );

  const limparFiltros = () => {
    setFiltroCidade("");
    setFiltroTermo("");
    setFiltroStatus("todos");
    setHttpMin("");
    setHttpMax("");
  };
  const temFiltroAtivo = temFiltroTel || filtroStatus !== "todos";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Progresso das execuções
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4 items-end">
          <div>
            <Label className="text-xs">De</Label>
            <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Até</Label>
            <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
          </div>
          <div className="md:col-span-2 flex justify-end gap-2">
            <Button onClick={carregar} disabled={loading} variant="outline">
              {loading ? (
                <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-1" />
              )}
              Atualizar
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  disabled={loading || execsParaExport.length === 0}
                >
                  <Download className="h-4 w-4 mr-1" />
                  Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="text-xs">
                  Período: {de} → {ate} ({execsParaExport.length} exec.
                  {temFiltroAtivo ? " · filtrado" : ""})
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => exportarExecucoesCSV(execsParaExport, de, ate)}
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Execuções (CSV)
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => exportarQueriesCSV(execsParaExport, de, ate)}
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Queries/telemetria (CSV)
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => exportarErrosCSV(execsParaExport, de, ate)}
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Erros (CSV)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() =>
                    exportarJSON(execsParaExport, de, ate, {
                      mensagens_analisadas: mensagensAnalisadas,
                      leads_gerados: leadsGerados,
                    })
                  }
                >
                  <FileJson className="h-4 w-4 mr-2" />
                  Completo (JSON)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Filtros avançados */}
        <div className="grid gap-3 md:grid-cols-6 items-end rounded-md border bg-muted/20 p-3">
          <div className="md:col-span-2">
            <Label className="text-xs">Cidade</Label>
            <Input
              placeholder="ex.: brasilia"
              value={filtroCidade}
              onChange={(e) => setFiltroCidade(e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Termo</Label>
            <Input
              placeholder="ex.: chat.whatsapp"
              value={filtroTermo}
              onChange={(e) => setFiltroTermo(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value as typeof filtroStatus)}
            >
              <option value="todos">Todos</option>
              <option value="sucesso">Sucesso</option>
              <option value="parcial">Parcial</option>
              <option value="erro">Erro</option>
              <option value="vazio">0 resultados</option>
            </select>
          </div>
          <div>
            <Label className="text-xs">HTTP code</Label>
            <div className="flex gap-1">
              <Input
                type="number"
                placeholder="min"
                value={httpMin}
                onChange={(e) => setHttpMin(e.target.value)}
              />
              <Input
                type="number"
                placeholder="max"
                value={httpMax}
                onChange={(e) => setHttpMax(e.target.value)}
              />
            </div>
          </div>
          <div className="md:col-span-6 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {execsFiltrados.length} de {execs.length} execuções
              {temFiltroAtivo ? " (filtrado)" : ""}
            </span>
            {temFiltroAtivo && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={limparFiltros}
              >
                Limpar filtros
              </Button>
            )}
          </div>
        </div>

        {/* Cards de totais */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <MetricCard
            icon={<Rocket className="h-4 w-4" />}
            label="Execuções"
            value={execsFiltrados.length}
            hint={temFiltroAtivo ? `de ${totais.execs}` : undefined}
          />
          <MetricCard
            icon={<Users className="h-4 w-4" />}
            label="Grupos encontrados"
            value={totais.grupos_encontrados}
            hint={`${totais.grupos_inseridos} inseridos`}
          />
          <MetricCard
            icon={<MessageSquare className="h-4 w-4" />}
            label="Mensagens analisadas"
            value={totais.mensagens_analisadas}
            hint="no período"
          />
          <MetricCard
            icon={<Zap className="h-4 w-4" />}
            label="Leads gerados"
            value={totais.leads_gerados}
            hint="no período"
          />
          <MetricCard
            icon={<AlertCircle className="h-4 w-4" />}
            label="Erros"
            value={totais.erros}
            tone={totais.erros > 0 ? "warn" : "ok"}
          />
        </div>

        {/* Linha do tempo */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : execsFiltrados.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            {execs.length === 0
              ? "Nenhuma execução registrada no período selecionado."
              : "Nenhuma execução corresponde aos filtros aplicados."}
          </p>
        ) : (
          <div className="space-y-2">
            {execsFiltrados.map(({ row, telFiltrada }) => (
              <ExecucaoItem
                key={row.id}
                row={row}
                telemetriaFiltrada={temFiltroTel ? telFiltrada : undefined}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MetricCard({
  icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  hint?: string;
  tone?: "default" | "ok" | "warn";
}) {
  const toneClass =
    tone === "warn"
      ? "border-destructive/40 bg-destructive/5"
      : tone === "ok"
      ? "border-emerald-200/60 bg-emerald-50/40"
      : "";
  return (
    <div className={`rounded-md border p-3 ${toneClass}`}>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-2xl font-semibold tabular-nums mt-1">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}

function ExecucaoItem({
  row,
  telemetriaFiltrada,
}: {
  row: ExecRow;
  telemetriaFiltrada?: any[];
}) {
  const [open, setOpen] = useState(false);
  const errosArr = Array.isArray(row.erros) ? (row.erros as unknown[]) : [];
  const telFull = Array.isArray(row.telemetria) ? (row.telemetria as any[]) : [];
  const tel = telemetriaFiltrada ?? telFull;
  const retries = tel.reduce((s, t) => s + (t?.retries ?? 0), 0);

  const isRetry = row.modo === "retry_erros" || !!row.retry_of_run_id;
  const hasErros = errosArr.length > 0;
  const status = hasErros
    ? row.encontrados > 0
      ? "parcial"
      : "erro"
    : row.encontrados > 0
    ? "sucesso"
    : "vazio";

  const conv =
    row.total_invites_validos > 0
      ? Math.round((row.inseridos / row.total_invites_validos) * 100)
      : 0;

  return (
    <div className="rounded-md border p-3 hover:bg-muted/40 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-muted-foreground">
          {row.run_id.slice(0, 8)}
        </span>
        <Badge variant="outline">{fmtDateTime(row.created_at)}</Badge>
        <StatusBadge status={status} />
        <Badge variant={isRetry ? "secondary" : "outline"}>
          {isRetry ? "Reexecução" : "Descoberta"}
        </Badge>
        {retries > 0 && (
          <Badge variant="outline" className="gap-1">
            <RefreshCw className="h-3 w-3" /> {retries} retry
          </Badge>
        )}
        <Badge variant="outline" className="gap-1">
          <Timer className="h-3 w-3" /> {row.total_ms}ms
        </Badge>
        {row.retry_of_run_id && (
          <span className="text-[11px] text-muted-foreground font-mono">
            ↩ pai {row.retry_of_run_id.slice(0, 8)}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
        <Stat label="Queries" value={row.queries} />
        <Stat label="Raw itens" value={row.total_raw_items} />
        <Stat label="Invites válidos" value={row.total_invites_validos} />
        <Stat label="Grupos encontrados" value={row.encontrados} strong />
        <Stat label="Inseridos" value={row.inseridos} strong />
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Conversão invites → inseridos</span>
          <span className="tabular-nums">{conv}%</span>
        </div>
        <Progress value={conv} className="h-1.5" />
      </div>

      {(hasErros || tel.length > 0) && (
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
              <ChevronDown
                className={`h-3 w-3 mr-1 transition-transform ${
                  open ? "rotate-180" : ""
                }`}
              />
              Ver logs ({tel.length} queries · {errosArr.length} erros)
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-1 text-[11px]">
            {tel.slice(0, 30).map((t: any, idx: number) => (
              <div
                key={idx}
                className="flex flex-wrap items-center gap-2 rounded border bg-muted/30 px-2 py-1"
              >
                {t?.error ? (
                  <AlertCircle className="h-3 w-3 text-destructive" />
                ) : (
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                )}
                <span className="font-mono">
                  {t?.cidade ?? "?"}/{t?.termo ?? "?"}
                </span>
                <span className="text-muted-foreground">
                  http {t?.status ?? "-"} · {t?.duration_ms ?? 0}ms · raw{" "}
                  {t?.raw_items ?? 0} · novos {t?.invites_novos ?? 0}
                </span>
                {(t?.retries ?? 0) > 0 && (
                  <Badge variant="outline" className="h-4 text-[10px] px-1">
                    {t.retries} retry
                  </Badge>
                )}
                {t?.error && (
                  <span className="text-destructive truncate max-w-full">
                    {String(t.error)}
                  </span>
                )}
              </div>
            ))}
            {tel.length > 30 && (
              <div className="text-muted-foreground text-center">
                … +{tel.length - 30} queries (use exportação para ver tudo)
              </div>
            )}
            {errosArr.length > 0 && (
              <div className="mt-2 rounded border border-destructive/40 bg-destructive/5 p-2">
                <div className="font-medium text-destructive mb-1">
                  Erros ({errosArr.length})
                </div>
                <ul className="list-disc pl-4 space-y-0.5">
                  {errosArr.slice(0, 10).map((e, i) => (
                    <li key={i} className="break-all">
                      {typeof e === "string" ? e : JSON.stringify(e)}
                    </li>
                  ))}
                  {errosArr.length > 10 && (
                    <li className="text-muted-foreground">
                      … +{errosArr.length - 10}
                    </li>
                  )}
                </ul>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  strong,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <div className="rounded border px-2 py-1 bg-background">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={`tabular-nums ${strong ? "font-semibold" : ""}`}>
        {value}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: "sucesso" | "parcial" | "erro" | "vazio" }) {
  const map = {
    sucesso: { label: "Sucesso", cls: "bg-emerald-100 text-emerald-800 border-emerald-200" },
    parcial: { label: "Parcial", cls: "bg-amber-100 text-amber-800 border-amber-200" },
    erro: { label: "Erro", cls: "bg-destructive/10 text-destructive border-destructive/30" },
    vazio: { label: "0 resultados", cls: "bg-muted text-muted-foreground" },
  } as const;
  const it = map[status];
  return (
    <Badge variant="outline" className={it.cls}>
      {it.label}
    </Badge>
  );
}

// ---------------- Exportação CSV / JSON ----------------

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "string" ? v : typeof v === "object" ? JSON.stringify(v) : String(v);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function csvLine(row: unknown[]): string {
  return row.map(csvCell).join(",");
}

function toCSV(headers: string[], rows: unknown[][]): string {
  return [csvLine(headers), ...rows.map(csvLine)].join("\n");
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast.success(`${filename} exportado`);
}

function stampName(kind: string, de: string, ate: string, ext: string) {
  return `progresso-radarzap_${kind}_${de}_a_${ate}.${ext}`;
}

function exportarExecucoesCSV(execs: ExecRow[], de: string, ate: string) {
  const headers = [
    "run_id",
    "created_at",
    "modo",
    "retry_of_run_id",
    "cidades",
    "termo",
    "queries",
    "encontrados",
    "inseridos",
    "total_raw_items",
    "total_invites_validos",
    "total_ms",
    "erros_count",
  ];
  const rows = execs.map((r) => [
    r.run_id,
    r.created_at,
    r.modo ?? "",
    r.retry_of_run_id ?? "",
    Array.isArray(r.cidades) ? r.cidades.join("|") : "",
    r.termo ?? "",
    r.queries,
    r.encontrados,
    r.inseridos,
    r.total_raw_items,
    r.total_invites_validos,
    r.total_ms,
    Array.isArray(r.erros) ? (r.erros as unknown[]).length : 0,
  ]);
  download(stampName("execucoes", de, ate, "csv"), toCSV(headers, rows), "text/csv");
}

function exportarQueriesCSV(execs: ExecRow[], de: string, ate: string) {
  const headers = [
    "run_id",
    "created_at",
    "cidade",
    "termo",
    "query",
    "status",
    "duration_ms",
    "response_shape",
    "raw_items",
    "invites_validos",
    "invites_novos",
    "duplicados_local",
    "duplicados_nome_local",
    "duplicados_nome_db",
    "duplicados_invite_db",
    "descartados_sem_url",
    "descartados_host_invalido",
    "tentativas",
    "retries",
    "retry_total_ms",
    "retry_esgotado",
    "error",
  ];
  const rows: unknown[][] = [];
  for (const r of execs) {
    const tel = Array.isArray(r.telemetria) ? (r.telemetria as any[]) : [];
    for (const t of tel) {
      rows.push([
        r.run_id,
        r.created_at,
        t?.cidade ?? "",
        t?.termo ?? "",
        t?.query ?? "",
        t?.status ?? "",
        t?.duration_ms ?? "",
        Array.isArray(t?.response_shape) ? t.response_shape.join("|") : "",
        t?.raw_items ?? 0,
        t?.invites_validos ?? 0,
        t?.invites_novos ?? 0,
        t?.duplicados_local ?? 0,
        t?.duplicados_nome_local ?? 0,
        t?.duplicados_nome_db ?? 0,
        t?.duplicados_invite_db ?? 0,
        t?.descartados_sem_url ?? 0,
        t?.descartados_host_invalido ?? 0,
        t?.tentativas ?? 1,
        t?.retries ?? 0,
        t?.retry_total_ms ?? 0,
        t?.retry_esgotado ?? false,
        t?.error ?? "",
      ]);
    }
  }
  if (rows.length === 0) {
    toast.info("Nenhuma query com telemetria no período");
    return;
  }
  download(stampName("queries", de, ate, "csv"), toCSV(headers, rows), "text/csv");
}

function exportarErrosCSV(execs: ExecRow[], de: string, ate: string) {
  const headers = ["run_id", "created_at", "indice", "erro"];
  const rows: unknown[][] = [];
  for (const r of execs) {
    const errs = Array.isArray(r.erros) ? (r.erros as unknown[]) : [];
    errs.forEach((e, i) => {
      rows.push([
        r.run_id,
        r.created_at,
        i,
        typeof e === "string" ? e : JSON.stringify(e),
      ]);
    });
  }
  if (rows.length === 0) {
    toast.info("Nenhum erro no período");
    return;
  }
  download(stampName("erros", de, ate, "csv"), toCSV(headers, rows), "text/csv");
}

function exportarJSON(
  execs: ExecRow[],
  de: string,
  ate: string,
  extras: { mensagens_analisadas: number; leads_gerados: number },
) {
  const payload = {
    exportado_em: new Date().toISOString(),
    periodo: { de, ate },
    totais: {
      execucoes: execs.length,
      grupos_encontrados: execs.reduce((s, r) => s + (r.encontrados ?? 0), 0),
      grupos_inseridos: execs.reduce((s, r) => s + (r.inseridos ?? 0), 0),
      erros: execs.reduce(
        (s, r) => s + (Array.isArray(r.erros) ? (r.erros as unknown[]).length : 0),
        0,
      ),
      ...extras,
    },
    execucoes: execs,
  };
  download(
    stampName("completo", de, ate, "json"),
    JSON.stringify(payload, null, 2),
    "application/json",
  );
}

