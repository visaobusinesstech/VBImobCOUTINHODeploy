import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Play,
  RefreshCw,
  TrendingDown,
  Zap,
} from "lucide-react";

interface Snapshot {
  id: string;
  created_at: string;
  total_urls: number;
  ok_count: number;
  error_count: number;
  new_urls_count: number;
  removed_urls_count: number;
  avg_ms: number;
  p95_ms: number;
  duration_ms: number;
}

interface Alerta {
  id: string;
  created_at: string;
  tipo: string;
  severity: string;
  url: string;
  status_code: number | null;
  response_ms: number | null;
  message: string;
  resolved_at: string | null;
}

const TIPO_LABELS: Record<string, string> = {
  http_error: "HTTP erro",
  timeout: "Timeout",
  slow: "Lento",
  new_route: "Rota nova",
  removed_route: "Rota removida",
  missing_seo: "Sem SEO",
};

function fmtDate(s: string) {
  const d = new Date(s);
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function SeoMonitoramentoTab() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [showResolved, setShowResolved] = useState(false);

  async function load() {
    setLoading(true);
    const [snapRes, alertRes] = await Promise.all([
      supabase
        .from("seo_monitor_snapshots" as never)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("seo_monitor_alertas" as never)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    setSnapshots(((snapRes.data as unknown as Snapshot[]) || []));
    setAlertas(((alertRes.data as unknown as Alerta[]) || []));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function runNow() {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("seo-monitor", { body: {} });
      if (error) throw error;
      const d = data as {
        total?: number;
        ok_count?: number;
        error_count?: number;
        alertas_criados?: number;
      };
      toast.success(
        `Scan concluído: ${d.ok_count}/${d.total} OK, ${d.error_count} erros, ${d.alertas_criados} alertas`,
      );
      await load();
    } catch (e) {
      toast.error(`Falha ao executar scan: ${(e as Error).message}`);
    } finally {
      setRunning(false);
    }
  }

  async function resolver(id: string) {
    const { error } = await supabase
      .from("seo_monitor_alertas" as never)
      .update({ resolved_at: new Date().toISOString() } as never)
      .eq("id", id);
    if (error) {
      toast.error("Falha ao resolver alerta");
      return;
    }
    setAlertas((prev) =>
      prev.map((a) => (a.id === id ? { ...a, resolved_at: new Date().toISOString() } : a)),
    );
  }

  const last = snapshots[0];
  const openAlerts = useMemo(() => alertas.filter((a) => !a.resolved_at), [alertas]);
  const displayAlerts = showResolved ? alertas : openAlerts;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-semibold">Monitoramento periódico</h2>
          <p className="text-xs text-muted-foreground">
            Cron diário 01:00 (BRT) varre o sitemap, checa status/tempo e emite alertas.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Recarregar
          </Button>
          <Button size="sm" onClick={runNow} disabled={running}>
            <Play className={`h-4 w-4 mr-1.5 ${running ? "animate-pulse" : ""}`} />
            {running ? "Executando…" : "Executar agora"}
          </Button>
        </div>
      </div>

      {last ? (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <MetricCard icon={<CheckCircle2 className="h-4 w-4" />} label="OK" value={`${last.ok_count}/${last.total_urls}`} tone={last.error_count === 0 ? "ok" : undefined} />
          <MetricCard icon={<AlertTriangle className="h-4 w-4" />} label="Erros" value={last.error_count} tone={last.error_count > 0 ? "error" : "ok"} />
          <MetricCard icon={<Zap className="h-4 w-4" />} label="Média" value={`${last.avg_ms}ms`} />
          <MetricCard icon={<Clock className="h-4 w-4" />} label="P95" value={`${last.p95_ms}ms`} tone={last.p95_ms > 4000 ? "warn" : undefined} />
          <MetricCard icon={<TrendingDown className="h-4 w-4" />} label="Rotas novas" value={last.new_urls_count} />
          <MetricCard icon={<AlertTriangle className="h-4 w-4" />} label="Alertas abertos" value={openAlerts.length} tone={openAlerts.length > 0 ? "warn" : "ok"} />
        </div>
      ) : (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Nenhum snapshot ainda. Clique em <b>Executar agora</b> para iniciar o primeiro scan.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">
            Alertas {showResolved ? `(${alertas.length})` : `abertos (${openAlerts.length})`}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowResolved((v) => !v)}
          >
            {showResolved ? "Ver só abertos" : "Ver resolvidos"}
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {displayAlerts.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground text-center">
              {showResolved ? "Nenhum alerta registrado." : "Sem alertas abertos ✓"}
            </div>
          ) : (
            <div className="max-h-[420px] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead className="w-[120px]">Quando</TableHead>
                    <TableHead className="w-[110px]">Tipo</TableHead>
                    <TableHead>Mensagem</TableHead>
                    <TableHead className="w-[80px]">Status</TableHead>
                    <TableHead className="w-[80px]">Tempo</TableHead>
                    <TableHead className="w-[110px] text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayAlerts.map((a) => (
                    <TableRow key={a.id} className={a.resolved_at ? "opacity-60" : ""}>
                      <TableCell className="text-xs">{fmtDate(a.created_at)}</TableCell>
                      <TableCell>
                        <SeverityBadge tipo={a.tipo} severity={a.severity} />
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{a.message}</div>
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mt-0.5 break-all"
                        >
                          {a.url}
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      </TableCell>
                      <TableCell className="text-xs">
                        {a.status_code ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {a.response_ms ? `${a.response_ms}ms` : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {a.resolved_at ? (
                          <span className="text-[10px] text-emerald-700">resolvido</span>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => resolver(a.id)}>
                            Resolver
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Histórico de execuções</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">Quando</TableHead>
                <TableHead>OK / Total</TableHead>
                <TableHead>Erros</TableHead>
                <TableHead>Novas / Removidas</TableHead>
                <TableHead>Média</TableHead>
                <TableHead>P95</TableHead>
                <TableHead>Duração</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {snapshots.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="text-xs">{fmtDate(s.created_at)}</TableCell>
                  <TableCell className="text-xs">{s.ok_count}/{s.total_urls}</TableCell>
                  <TableCell className="text-xs">
                    {s.error_count > 0 ? (
                      <Badge variant="destructive" className="text-[10px]">{s.error_count}</Badge>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    +{s.new_urls_count} / −{s.removed_urls_count}
                  </TableCell>
                  <TableCell className="text-xs">{s.avg_ms}ms</TableCell>
                  <TableCell className="text-xs">{s.p95_ms}ms</TableCell>
                  <TableCell className="text-xs">{(s.duration_ms / 1000).toFixed(1)}s</TableCell>
                </TableRow>
              ))}
              {snapshots.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">
                    Sem histórico.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  tone?: "ok" | "warn" | "error";
}) {
  const c =
    tone === "ok"
      ? "text-emerald-600"
      : tone === "warn"
      ? "text-amber-600"
      : tone === "error"
      ? "text-red-600"
      : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {icon}
          {label}
        </div>
        <div className={`text-xl font-semibold mt-1 ${c}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function SeverityBadge({ tipo, severity }: { tipo: string; severity: string }) {
  const cls =
    severity === "error"
      ? "bg-red-600 hover:bg-red-600"
      : severity === "warn"
      ? "bg-amber-600 hover:bg-amber-600"
      : "bg-slate-500 hover:bg-slate-500";
  return <Badge className={`text-[10px] ${cls}`}>{TIPO_LABELS[tipo] || tipo}</Badge>;
}
