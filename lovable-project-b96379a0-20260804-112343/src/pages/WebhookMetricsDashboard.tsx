import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Activity, Timer, KeyRound, Percent, Download } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

type MetricRow = {
  id: string;
  imobiliaria_id: string | null;
  provider: string;
  outcome: "allowed" | "denied";
  cache_hit: boolean;
  keys_loaded: number;
  keys_tested: number;
  validation_ms: number;
  created_at: string;
};

type PeriodKey = "1h" | "24h" | "7d" | "30d" | "custom";

const PERIODS: { key: PeriodKey; label: string; hours?: number }[] = [
  { key: "1h", label: "Última hora", hours: 1 },
  { key: "24h", label: "Últimas 24h", hours: 24 },
  { key: "7d", label: "Últimos 7 dias", hours: 24 * 7 },
  { key: "30d", label: "Últimos 30 dias", hours: 24 * 30 },
  { key: "custom", label: "Personalizado" },
];

function fmtPct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}
function fmtMs(n: number) {
  return `${n.toFixed(1)} ms`;
}
function bucketKey(iso: string, hours: number) {
  const d = new Date(iso);
  if (hours <= 24) {
    d.setMinutes(0, 0, 0);
    return d.toISOString();
  }
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export default function WebhookMetricsDashboard() {
  const { imobiliariaId } = useAuth();
  const [period, setPeriod] = useState<PeriodKey>("24h");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");
  const [provider, setProvider] = useState<string>("__all__");
  const [rows, setRows] = useState<MetricRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { fromIso, toIso, bucketHours } = useMemo(() => {
    const now = new Date();
    if (period === "custom" && customFrom && customTo) {
      const from = new Date(customFrom);
      const to = new Date(customTo);
      const hours = Math.max(1, (to.getTime() - from.getTime()) / 3_600_000);
      return { fromIso: from.toISOString(), toIso: to.toISOString(), bucketHours: hours };
    }
    const p = PERIODS.find((x) => x.key === period) ?? PERIODS[1];
    const hours = p.hours ?? 24;
    const from = new Date(now.getTime() - hours * 3_600_000);
    return { fromIso: from.toISOString(), toIso: now.toISOString(), bucketHours: hours };
  }, [period, customFrom, customTo]);

  const load = async () => {
    if (!imobiliariaId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("webhook_metrics")
        .select("id,imobiliaria_id,provider,outcome,cache_hit,keys_loaded,keys_tested,validation_ms,created_at")
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
        .order("created_at", { ascending: true })
        .limit(10000);
      if (error) throw error;
      setRows((data as unknown as MetricRow[]) ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Erro ao carregar métricas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imobiliariaId, fromIso, toIso]);

  const providers = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => s.add(r.provider));
    return Array.from(s).sort();
  }, [rows]);

  const filtered = useMemo(
    () => (provider === "__all__" ? rows : rows.filter((r) => r.provider === provider)),
    [rows, provider],
  );

  const totals = useMemo(() => {
    const total = filtered.length;
    const hits = filtered.filter((r) => r.cache_hit).length;
    const allowed = filtered.filter((r) => r.outcome === "allowed").length;
    const denied = total - allowed;
    const avgMs = total ? filtered.reduce((s, r) => s + Number(r.validation_ms || 0), 0) / total : 0;
    const p95Ms = (() => {
      if (!total) return 0;
      const arr = [...filtered.map((r) => Number(r.validation_ms || 0))].sort((a, b) => a - b);
      return arr[Math.min(arr.length - 1, Math.floor(arr.length * 0.95))];
    })();
    const avgKeysTested = total ? filtered.reduce((s, r) => s + (r.keys_tested || 0), 0) / total : 0;
    const avgKeysLoaded = total ? filtered.reduce((s, r) => s + (r.keys_loaded || 0), 0) / total : 0;
    return {
      total,
      hits,
      hitRate: total ? hits / total : 0,
      allowed,
      denied,
      avgMs,
      p95Ms,
      avgKeysTested,
      avgKeysLoaded,
    };
  }, [filtered]);

  const timeSeries = useMemo(() => {
    const buckets = new Map<
      string,
      { t: string; total: number; hits: number; msSum: number; keysSum: number; testedSum: number }
    >();
    for (const r of filtered) {
      const k = bucketKey(r.created_at, bucketHours);
      const b = buckets.get(k) ?? { t: k, total: 0, hits: 0, msSum: 0, keysSum: 0, testedSum: 0 };
      b.total += 1;
      b.hits += r.cache_hit ? 1 : 0;
      b.msSum += Number(r.validation_ms || 0);
      b.keysSum += r.keys_loaded || 0;
      b.testedSum += r.keys_tested || 0;
      buckets.set(k, b);
    }
    return Array.from(buckets.values())
      .sort((a, b) => a.t.localeCompare(b.t))
      .map((b) => ({
        t: new Date(b.t).toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        }),
        cache_hit_rate: b.total ? +((b.hits / b.total) * 100).toFixed(2) : 0,
        validation_ms: b.total ? +(b.msSum / b.total).toFixed(2) : 0,
        keys_tested: b.total ? +(b.testedSum / b.total).toFixed(2) : 0,
        keys_loaded: b.total ? +(b.keysSum / b.total).toFixed(2) : 0,
        total: b.total,
      }));
  }, [filtered, bucketHours]);

  const byProvider = useMemo(() => {
    const map = new Map<string, { provider: string; total: number; hits: number; msSum: number; testedSum: number }>();
    for (const r of rows) {
      const k = r.provider;
      const b = map.get(k) ?? { provider: k, total: 0, hits: 0, msSum: 0, testedSum: 0 };
      b.total += 1;
      b.hits += r.cache_hit ? 1 : 0;
      b.msSum += Number(r.validation_ms || 0);
      b.testedSum += r.keys_tested || 0;
      map.set(k, b);
    }
    return Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .map((b) => ({
        provider: b.provider,
        cache_hit_rate: b.total ? +((b.hits / b.total) * 100).toFixed(2) : 0,
        validation_ms: b.total ? +(b.msSum / b.total).toFixed(2) : 0,
        keys_tested: b.total ? +(b.testedSum / b.total).toFixed(2) : 0,
        total: b.total,
      }));
  }, [rows]);

  const downloadCsv = (filename: string, headers: string[], data: (string | number)[][]) => {
    const escape = (v: string | number) => {
      const s = String(v ?? "");
      return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [headers, ...data].map((r) => r.map(escape).join(",")).join("\n");
    const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const rangeSuffix = () => {
    const f = new Date(fromIso).toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const t = new Date(toIso).toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const prov = provider === "__all__" ? "all" : provider;
    return `${prov}_${f}_${t}`;
  };

  const exportRawCsv = () => {
    downloadCsv(
      `webhook_metrics_raw_${rangeSuffix()}.csv`,
      [
        "id",
        "created_at",
        "imobiliaria_id",
        "provider",
        "outcome",
        "cache_hit",
        "keys_loaded",
        "keys_tested",
        "validation_ms",
      ],
      filtered.map((r) => [
        r.id,
        r.created_at,
        r.imobiliaria_id ?? "",
        r.provider,
        r.outcome,
        r.cache_hit ? "true" : "false",
        r.keys_loaded ?? 0,
        r.keys_tested ?? 0,
        Number(r.validation_ms ?? 0),
      ]),
    );
  };

  const exportSummaryCsv = () => {
    downloadCsv(
      `webhook_metrics_summary_${rangeSuffix()}.csv`,
      ["provider", "total", "cache_hit_rate_pct", "validation_ms_avg", "keys_tested_avg"],
      byProvider.map((b) => [b.provider, b.total, b.cache_hit_rate, b.validation_ms, b.keys_tested]),
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Métricas de Webhook</h1>
          <p className="text-sm text-muted-foreground">
            Cache hit rate, latência de validação e chaves testadas por tenant e provider.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportRawCsv} variant="outline" size="sm" disabled={loading || filtered.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            CSV (bruto)
          </Button>
          <Button onClick={exportSummaryCsv} variant="outline" size="sm" disabled={loading || byProvider.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            CSV (resumo)
          </Button>
          <Button onClick={load} variant="outline" size="sm" disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Atualizar
          </Button>
        </div>
      </div>


      <Card>
        <CardContent className="p-4 flex flex-wrap gap-4 items-end">
          <div className="min-w-[200px]">
            <Label>Período</Label>
            <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PERIODS.map((p) => (
                  <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {period === "custom" && (
            <>
              <div>
                <Label>De</Label>
                <Input type="datetime-local" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
              </div>
              <div>
                <Label>Até</Label>
                <Input type="datetime-local" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
              </div>
            </>
          )}
          <div className="min-w-[220px]">
            <Label>Provider</Label>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos os providers</SelectItem>
                {providers.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto flex gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary">{totals.total} eventos</Badge>
            <Badge variant="secondary">{totals.allowed} allowed</Badge>
            <Badge variant="destructive">{totals.denied} denied</Badge>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={<Percent className="w-4 h-4" />} label="Cache hit rate" value={fmtPct(totals.hitRate)} sub={`${totals.hits}/${totals.total}`} />
        <KpiCard icon={<Timer className="w-4 h-4" />} label="Validação média" value={fmtMs(totals.avgMs)} sub={`p95 ${fmtMs(totals.p95Ms)}`} />
        <KpiCard icon={<KeyRound className="w-4 h-4" />} label="Keys testadas (média)" value={totals.avgKeysTested.toFixed(2)} sub={`carregadas ${totals.avgKeysLoaded.toFixed(2)}`} />
        <KpiCard icon={<Activity className="w-4 h-4" />} label="Volume" value={String(totals.total)} sub={`${totals.allowed} ok · ${totals.denied} denied`} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Cache hit rate (%) ao longo do tempo</CardTitle></CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer>
            <LineChart data={timeSeries}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="t" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="cache_hit_rate" name="Cache hit %" stroke="hsl(var(--primary))" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Validation ms (média)</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer>
              <LineChart data={timeSeries}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="t" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="validation_ms" name="ms" stroke="hsl(var(--primary))" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Keys testadas (média)</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer>
              <LineChart data={timeSeries}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="t" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="keys_tested" name="testadas" stroke="hsl(var(--primary))" dot={false} />
                <Line type="monotone" dataKey="keys_loaded" name="carregadas" stroke="hsl(var(--muted-foreground))" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Por provider (todo o período)</CardTitle></CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer>
            <BarChart data={byProvider}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="provider" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="cache_hit_rate" name="Hit %" fill="hsl(var(--primary))" />
              <Bar dataKey="validation_ms" name="ms médio" fill="hsl(var(--muted-foreground))" />
              <Bar dataKey="keys_tested" name="keys testadas" fill="hsl(var(--accent-foreground))" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Resumo por provider</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2">Provider</th>
                <th>Eventos</th>
                <th>Hit rate</th>
                <th>Validation ms</th>
                <th>Keys testadas</th>
              </tr>
            </thead>
            <tbody>
              {byProvider.length === 0 && (
                <tr><td colSpan={5} className="py-4 text-center text-muted-foreground">Sem dados no período</td></tr>
              )}
              {byProvider.map((r) => (
                <tr key={r.provider} className="border-b last:border-0">
                  <td className="py-2 font-medium">{r.provider}</td>
                  <td>{r.total}</td>
                  <td>{r.cache_hit_rate.toFixed(1)}%</td>
                  <td>{r.validation_ms.toFixed(1)} ms</td>
                  <td>{r.keys_tested.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
        <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}
