import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Smartphone, Monitor } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Alerta {
  id: string;
  path: string;
  strategy: "mobile" | "desktop";
  metric: "performance" | "seo" | "accessibility" | "best_practices";
  previous_score: number;
  current_score: number;
  delta: number;
  threshold: number;
  status: "open" | "resolved";
  resolved_at: string | null;
  created_at: string;
}

const METRIC_LABEL: Record<Alerta["metric"], string> = {
  performance: "Performance",
  seo: "SEO",
  accessibility: "Acessibilidade",
  best_practices: "Best Practices",
};

export function SeoLighthouseAlertasPanel() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Alerta[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"open" | "resolved" | "all">("open");
  const [metricFilter, setMetricFilter] = useState<Alerta["metric"] | "all">("all");
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("lighthouse_regression_alertas")
      .select("id,path,strategy,metric,previous_score,current_score,delta,threshold,status,resolved_at,created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) toast.error("Falha ao carregar alertas: " + error.message);
    setRows((data ?? []) as Alerta[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => rows.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (metricFilter !== "all" && r.metric !== metricFilter) return false;
    return true;
  }), [rows, statusFilter, metricFilter]);

  const kpis = useMemo(() => ({
    open: rows.filter((r) => r.status === "open").length,
    resolved: rows.filter((r) => r.status === "resolved").length,
    critical: rows.filter((r) => r.status === "open" && r.delta >= 20).length,
  }), [rows]);

  async function resolve(id: string) {
    setResolvingId(id);
    const { error } = await supabase
      .from("lighthouse_regression_alertas")
      .update({ status: "resolved", resolved_at: new Date().toISOString(), resolved_by: user?.id ?? null })
      .eq("id", id);
    setResolvingId(null);
    if (error) {
      toast.error("Falha ao resolver: " + error.message);
      return;
    }
    toast.success("Alerta marcado como resolvido");
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            Alertas de regressão
          </h3>
          <p className="text-xs text-muted-foreground">
            Gerados automaticamente quando a queda entre auditorias for maior ou igual ao limite configurado.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <MiniKpi label="Abertos" value={kpis.open} tone={kpis.open > 0 ? "warn" : "ok"} />
        <MiniKpi label="Críticos (≥20pts)" value={kpis.critical} tone={kpis.critical > 0 ? "err" : "ok"} />
        <MiniKpi label="Resolvidos" value={kpis.resolved} tone="ok" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Abertos</SelectItem>
            <SelectItem value="resolved">Resolvidos</SelectItem>
            <SelectItem value="all">Todos</SelectItem>
          </SelectContent>
        </Select>
        <Select value={metricFilter} onValueChange={(v) => setMetricFilter(v as typeof metricFilter)}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as métricas</SelectItem>
            <SelectItem value="performance">Performance</SelectItem>
            <SelectItem value="seo">SEO</SelectItem>
            <SelectItem value="accessibility">Acessibilidade</SelectItem>
            <SelectItem value="best_practices">Best Practices</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">
          {filtered.length} de {rows.length}
        </span>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rota</TableHead>
                <TableHead className="w-[90px]">Device</TableHead>
                <TableHead>Métrica</TableHead>
                <TableHead className="text-center">Antes</TableHead>
                <TableHead className="text-center">Depois</TableHead>
                <TableHead className="text-center">Queda</TableHead>
                <TableHead className="w-[140px]">Quando</TableHead>
                <TableHead className="w-[110px] text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">
                    {loading ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> carregando…
                      </span>
                    ) : "Nenhum alerta no filtro atual."}
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.path}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] gap-1">
                      {r.strategy === "mobile" ? <Smartphone className="h-3 w-3" /> : <Monitor className="h-3 w-3" />}
                      {r.strategy}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{METRIC_LABEL[r.metric]}</TableCell>
                  <TableCell className="text-center text-xs">{r.previous_score}</TableCell>
                  <TableCell className="text-center text-xs font-semibold text-red-600">{r.current_score}</TableCell>
                  <TableCell className="text-center">
                    <Badge className={`text-[10px] ${r.delta >= 20 ? "bg-red-600 hover:bg-red-600" : "bg-amber-600 hover:bg-amber-600"}`}>
                      −{r.delta} pts
                    </Badge>
                    <div className="text-[10px] text-muted-foreground mt-0.5">limite {r.threshold}</div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(r.created_at), { addSuffix: true, locale: ptBR })}
                  </TableCell>
                  <TableCell className="text-right">
                    {r.status === "open" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => resolve(r.id)}
                        disabled={resolvingId === r.id}
                      >
                        {resolvingId === r.id ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                        Resolver
                      </Button>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">resolvido</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function MiniKpi({ label, value, tone }: { label: string; value: number; tone: "ok" | "warn" | "err" }) {
  const cls = tone === "err" ? "text-red-600" : tone === "warn" ? "text-amber-600" : "text-emerald-600";
  return (
    <Card>
      <CardContent className="p-3">
        <div className="text-[11px] text-muted-foreground">{label}</div>
        <div className={`text-xl font-semibold mt-0.5 ${cls}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
