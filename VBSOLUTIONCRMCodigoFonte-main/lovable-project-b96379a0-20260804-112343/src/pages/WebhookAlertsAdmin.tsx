import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Loader2,
  RefreshCw,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  Timer,
  Percent,
  ExternalLink,
  Eye,
  CheckCheck,
} from "lucide-react";
import { format, formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "react-router-dom";
import { toast } from "sonner";

type AlertRow = {
  id: string;
  imobiliaria_id: string | null;
  provider: string;
  alert_type: string;
  severity: "info" | "warning" | "critical";
  metric_value: number;
  threshold: number;
  sample_size: number;
  window_seconds: number;
  message: string | null;
  details: Record<string, unknown> | null;
  request_id: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_note: string | null;
  resolution_source: "manual" | "auto" | null;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  created_at: string;
};

type PeriodKey = "24h" | "7d" | "30d" | "all";

const PERIODS: { key: PeriodKey; label: string; hours?: number }[] = [
  { key: "24h", label: "Últimas 24h", hours: 24 },
  { key: "7d", label: "Últimos 7 dias", hours: 24 * 7 },
  { key: "30d", label: "Últimos 30 dias", hours: 24 * 30 },
  { key: "all", label: "Tudo" },
];

const ALERT_TYPE_LABEL: Record<string, string> = {
  cache_hit_rate_low: "Cache hit rate baixo",
  validation_latency_high: "Latência de validação alta",
};

const SEVERITY_META = {
  critical: { label: "Crítico", cls: "bg-red-500/10 text-red-600 border-red-500/30", Icon: AlertTriangle },
  warning: { label: "Aviso", cls: "bg-amber-500/10 text-amber-600 border-amber-500/30", Icon: AlertCircle },
  info: { label: "Info", cls: "bg-sky-500/10 text-sky-600 border-sky-500/30", Icon: Info },
} as const;

function formatMetric(row: AlertRow) {
  if (row.alert_type === "cache_hit_rate_low") {
    return {
      value: `${(row.metric_value * 100).toFixed(1)}%`,
      threshold: `${(row.threshold * 100).toFixed(0)}%`,
      icon: Percent,
    };
  }
  if (row.alert_type === "validation_latency_high") {
    return {
      value: `${row.metric_value.toFixed(0)} ms`,
      threshold: `${row.threshold.toFixed(0)} ms`,
      icon: Timer,
    };
  }
  return { value: String(row.metric_value), threshold: String(row.threshold), icon: Info };
}

export default function WebhookAlertsAdmin() {
  const [rows, setRows] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [period, setPeriod] = useState<PeriodKey>("7d");
  const [tenantFilter, setTenantFilter] = useState<string>("all");
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "acked" | "resolved">("all");
  const [search, setSearch] = useState("");

  const [busyId, setBusyId] = useState<string | null>(null);
  const [resolveTarget, setResolveTarget] = useState<AlertRow | null>(null);
  const [resolveNote, setResolveNote] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      let q = supabase
        .from("webhook_alerts")
        .select(
          "id, imobiliaria_id, provider, alert_type, severity, metric_value, threshold, sample_size, window_seconds, message, details, request_id, resolved_at, resolved_by, resolution_note, resolution_source, acknowledged_at, acknowledged_by, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(500);

      const p = PERIODS.find((x) => x.key === period);
      if (p?.hours) {
        const since = new Date(Date.now() - p.hours * 3600 * 1000).toISOString();
        q = q.gte("created_at", since);
      }
      const { data, error } = await q;
      if (error) throw error;
      setRows((data ?? []) as unknown as AlertRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  async function handleAck(row: AlertRow) {
    setBusyId(row.id);
    try {
      const { data, error } = await (supabase as any).rpc("ack_webhook_alert", {
        _alert_id: row.id,
      });
      if (error) throw error;
      const updated = (Array.isArray(data) ? data[0] : data) as AlertRow | null;
      if (updated) {
        setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...updated } : r)));
      }
      toast.success("Alerta reconhecido");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao reconhecer alerta");
    } finally {
      setBusyId(null);
    }
  }

  async function handleResolve() {
    if (!resolveTarget) return;
    setBusyId(resolveTarget.id);
    try {
      const { data, error } = await (supabase as any).rpc("resolve_webhook_alert", {
        _alert_id: resolveTarget.id,
        _note: resolveNote.trim() || null,
      });
      if (error) throw error;
      const updated = (Array.isArray(data) ? data[0] : data) as AlertRow | null;
      if (updated) {
        setRows((prev) => prev.map((r) => (r.id === resolveTarget.id ? { ...r, ...updated } : r)));
      }
      toast.success("Alerta resolvido");
      setResolveTarget(null);
      setResolveNote("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao resolver alerta");
    } finally {
      setBusyId(null);
    }
  }

  const tenants = useMemo(
    () => Array.from(new Set(rows.map((r) => r.imobiliaria_id).filter(Boolean) as string[])),
    [rows],
  );
  const providers = useMemo(() => Array.from(new Set(rows.map((r) => r.provider))), [rows]);
  const alertTypes = useMemo(() => Array.from(new Set(rows.map((r) => r.alert_type))), [rows]);


  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (tenantFilter !== "all" && r.imobiliaria_id !== tenantFilter) return false;
      if (providerFilter !== "all" && r.provider !== providerFilter) return false;
      if (typeFilter !== "all" && r.alert_type !== typeFilter) return false;
      if (severityFilter !== "all" && r.severity !== severityFilter) return false;
      if (statusFilter === "open" && r.resolved_at) return false;
      if (statusFilter === "acked" && (r.resolved_at || !r.acknowledged_at)) return false;
      if (statusFilter === "resolved" && !r.resolved_at) return false;
      if (s) {
        const hay = `${r.message ?? ""} ${r.provider} ${r.alert_type} ${r.request_id ?? ""}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [rows, tenantFilter, providerFilter, typeFilter, severityFilter, statusFilter, search]);

  const kpis = useMemo(() => {
    const total = filtered.length;
    const open = filtered.filter((r) => !r.resolved_at).length;
    const critical = filtered.filter((r) => r.severity === "critical").length;
    const resolved = filtered.filter((r) => r.resolved_at).length;
    return { total, open, critical, resolved };
  }, [filtered]);

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <header className="flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Alertas de Webhook</h1>
          <p className="text-sm text-muted-foreground">
            Histórico de alertas de segurança/qualidade dos webhooks com filtros e timeline.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/webhook-metrics">
              <ExternalLink className="w-4 h-4 mr-2" />
              Métricas
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Atualizar
          </Button>
        </div>
      </header>

      {/* Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">Período</Label>
            <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PERIODS.map((p) => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Tenant</Label>
            <Select value={tenantFilter} onValueChange={setTenantFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {tenants.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t.slice(0, 8)}…{t.slice(-4)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Provider</Label>
            <Select value={providerFilter} onValueChange={setProviderFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {providers.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Tipo de alerta</Label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {alertTypes.map((t) => (
                  <SelectItem key={t} value={t}>{ALERT_TYPE_LABEL[t] ?? t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Severidade</Label>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="critical">Crítico</SelectItem>
                <SelectItem value="warning">Aviso</SelectItem>
                <SelectItem value="info">Info</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="open">Abertos (não reconhecidos)</SelectItem>
                <SelectItem value="acked">Reconhecidos (não resolvidos)</SelectItem>
                <SelectItem value="resolved">Resolvidos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Busca (mensagem, request_id)</Label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ex: portal, req_abc..." />
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Total (filtrado)" value={kpis.total} />
        <KPI label="Abertos" value={kpis.open} accent="text-amber-600" />
        <KPI label="Críticos" value={kpis.critical} accent="text-red-600" />
        <KPI label="Resolvidos" value={kpis.resolved} accent="text-emerald-600" />
      </div>

      {error && (
        <div className="text-sm rounded-md border border-destructive/40 bg-destructive/5 text-destructive p-3">
          {error}
        </div>
      )}

      {/* Timeline */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando…
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">
              Nenhum alerta para os filtros selecionados.
            </div>
          ) : (
            <ol className="relative border-s border-border ms-3 space-y-6">
              {filtered.map((r) => {
                const sev = SEVERITY_META[r.severity];
                const m = formatMetric(r);
                const MIcon = m.icon;
                const SIcon = sev.Icon;
                return (
                  <li key={r.id} className="ms-6">
                    <span className={`absolute -start-3 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-background ${sev.cls}`}>
                      <SIcon className="w-3.5 h-3.5" />
                    </span>
                    <div className="rounded-lg border bg-card p-4">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <Badge variant="outline" className={sev.cls}>{sev.label}</Badge>
                        <Badge variant="secondary">{ALERT_TYPE_LABEL[r.alert_type] ?? r.alert_type}</Badge>
                        <Badge variant="outline">{r.provider}</Badge>
                        {r.resolved_at ? (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Resolvido{r.resolution_source === "auto" ? " (auto)" : ""}
                          </Badge>
                        ) : r.acknowledged_at ? (
                          <Badge variant="outline" className="bg-sky-500/10 text-sky-600 border-sky-500/30">
                            <Eye className="w-3 h-3 mr-1" /> Reconhecido
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
                            Aberto
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground ms-auto">
                          {format(new Date(r.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                          {" · há "}
                          {formatDistanceToNowStrict(new Date(r.created_at), { locale: ptBR })}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <Field label="Valor">
                          <span className="inline-flex items-center gap-1 font-medium">
                            <MIcon className="w-3.5 h-3.5 text-muted-foreground" />
                            {m.value}
                          </span>
                        </Field>
                        <Field label="Threshold">{m.threshold}</Field>
                        <Field label="Amostras">{r.sample_size}</Field>
                        <Field label="Janela">{r.window_seconds}s</Field>
                        <Field label="Tenant" mono>
                          {r.imobiliaria_id ? `${r.imobiliaria_id.slice(0, 8)}…` : "—"}
                        </Field>
                        <Field label="Request ID" mono>{r.request_id ?? "—"}</Field>
                        <Field label="Reconhecido em">
                          {r.acknowledged_at
                            ? format(new Date(r.acknowledged_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                            : "—"}
                        </Field>
                        <Field label="Reconhecido por" mono>
                          {r.acknowledged_by ? `${r.acknowledged_by.slice(0, 8)}…` : "—"}
                        </Field>
                        <Field label="Resolvido em">
                          {r.resolved_at
                            ? format(new Date(r.resolved_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                            : "—"}
                        </Field>
                        <Field label="Resolvido por" mono>
                          {r.resolved_by
                            ? `${r.resolved_by.slice(0, 8)}… (${r.resolution_source ?? "manual"})`
                            : r.resolution_source === "auto"
                              ? "sistema (auto)"
                              : "—"}
                        </Field>
                        <Field label="Duração aberto">
                          {formatDistanceToNowStrict(new Date(r.created_at), { locale: ptBR })}
                        </Field>
                      </div>

                      {r.resolution_note && (
                        <div className="mt-3 rounded-md bg-muted/40 border p-2 text-sm">
                          <span className="text-xs font-medium text-muted-foreground">Nota de resolução: </span>
                          {r.resolution_note}
                        </div>
                      )}
                      {r.message && (
                        <p className="mt-3 text-sm text-muted-foreground">{r.message}</p>
                      )}

                      <div className="mt-3 flex flex-wrap gap-2">
                        {!r.acknowledged_at && !r.resolved_at && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busyId === r.id}
                            onClick={() => void handleAck(r)}
                          >
                            {busyId === r.id ? (
                              <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                            ) : (
                              <Eye className="w-3.5 h-3.5 mr-1" />
                            )}
                            Reconhecer
                          </Button>
                        )}
                        {!r.resolved_at && (
                          <Button
                            size="sm"
                            disabled={busyId === r.id}
                            onClick={() => {
                              setResolveTarget(r);
                              setResolveNote("");
                            }}
                          >
                            <CheckCheck className="w-3.5 h-3.5 mr-1" />
                            Resolver
                          </Button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!resolveTarget} onOpenChange={(o) => !o && setResolveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolver alerta</DialogTitle>
            <DialogDescription>
              Registrar resolução manual. Ficará gravado quem resolveu e quando.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">Nota (opcional)</Label>
            <Textarea
              rows={4}
              placeholder="Ex.: cache aquecido após deploy; latência normalizou."
              value={resolveNote}
              onChange={(e) => setResolveNote(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveTarget(null)}>Cancelar</Button>
            <Button onClick={() => void handleResolve()} disabled={!!busyId}>
              {busyId ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCheck className="w-4 h-4 mr-2" />}
              Confirmar resolução
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KPI({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-2xl font-semibold tracking-tight ${accent ?? ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  children,
  mono,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={mono ? "font-mono text-xs break-all" : ""}>{children}</div>
    </div>
  );
}
