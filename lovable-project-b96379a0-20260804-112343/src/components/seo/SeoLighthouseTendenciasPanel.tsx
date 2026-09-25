import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Smartphone, Monitor, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { toast } from "sonner";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";

interface AuditPoint {
  id: string;
  path: string;
  strategy: "mobile" | "desktop";
  lcp_ms: number | null;
  fcp_ms: number | null;
  cls: number | null;
  tbt_ms: number | null;
  created_at: string;
}

type MetricKey = "lcp_ms" | "fcp_ms" | "tbt_ms" | "cls";

const METRICS: Record<MetricKey, { label: string; unit: string; good: number; poor: number; color: string; format: (v: number) => string }> = {
  lcp_ms: { label: "LCP", unit: "ms", good: 2500, poor: 4000, color: "#2563eb", format: (v) => `${(v / 1000).toFixed(2)}s` },
  fcp_ms: { label: "FCP", unit: "ms", good: 1800, poor: 3000, color: "#0891b2", format: (v) => `${(v / 1000).toFixed(2)}s` },
  tbt_ms: { label: "TBT", unit: "ms", good: 200,  poor: 600,  color: "#d97706", format: (v) => `${Math.round(v)}ms` },
  cls:    { label: "CLS", unit: "",   good: 0.1,  poor: 0.25, color: "#7c3aed", format: (v) => v.toFixed(3) },
};

export function SeoLighthouseTendenciasPanel() {
  const [rows, setRows] = useState<AuditPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [path, setPath] = useState<string>("__all__");
  const [strategy, setStrategy] = useState<"mobile" | "desktop">("mobile");
  const [limit, setLimit] = useState<number>(20);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("lighthouse_audits")
      .select("id,path,strategy,lcp_ms,fcp_ms,cls,tbt_ms,created_at,status")
      .eq("status", "ok")
      .order("created_at", { ascending: false })
      .limit(2000);
    if (error) toast.error("Falha ao carregar auditorias: " + error.message);
    setRows((data ?? []) as AuditPoint[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const paths = useMemo(
    () => Array.from(new Set(rows.map((r) => r.path))).sort(),
    [rows],
  );

  useEffect(() => {
    if (path !== "__all__" && !paths.includes(path) && paths.length > 0) {
      setPath(paths[0]);
    }
  }, [paths, path]);

  const filtered = useMemo(() => {
    const scoped = rows
      .filter((r) => r.strategy === strategy)
      .filter((r) => path === "__all__" || r.path === path);
    // asc para o gráfico
    return scoped.slice(0, limit).reverse();
  }, [rows, path, strategy, limit]);

  const series = useMemo(() => {
    return filtered.map((r, i) => ({
      idx: i + 1,
      label: new Date(r.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }),
      lcp_ms: r.lcp_ms,
      fcp_ms: r.fcp_ms,
      tbt_ms: r.tbt_ms,
      cls: r.cls,
      path: r.path,
    }));
  }, [filtered]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-base font-semibold">Tendências de Core Web Vitals</h3>
          <p className="text-xs text-muted-foreground">
            Evolução de LCP, CLS, TBT e FCP ao longo das últimas execuções, por rota e dispositivo.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={path} onValueChange={setPath}>
          <SelectTrigger className="w-[280px]">
            <SelectValue placeholder="Rota" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas as rotas (média)</SelectItem>
            {paths.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={strategy} onValueChange={(v) => setStrategy(v as "mobile" | "desktop")}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="mobile"><span className="inline-flex items-center gap-2"><Smartphone className="h-3 w-3" /> Mobile</span></SelectItem>
            <SelectItem value="desktop"><span className="inline-flex items-center gap-2"><Monitor className="h-3 w-3" /> Desktop</span></SelectItem>
          </SelectContent>
        </Select>

        <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="10">Últimas 10</SelectItem>
            <SelectItem value="20">Últimas 20</SelectItem>
            <SelectItem value="50">Últimas 50</SelectItem>
            <SelectItem value="100">Últimas 100</SelectItem>
          </SelectContent>
        </Select>

        <span className="text-xs text-muted-foreground ml-auto">
          {loading ? "carregando…" : `${series.length} ponto(s) plotado(s)`}
        </span>
      </div>

      {series.length === 0 && !loading && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhuma auditoria encontrada para os filtros atuais.
          </CardContent>
        </Card>
      )}

      {series.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {(Object.keys(METRICS) as MetricKey[]).map((k) => (
            <MetricChart key={k} metric={k} data={series} />
          ))}
        </div>
      )}
    </div>
  );
}

function MetricChart({ metric, data }: { metric: MetricKey; data: Array<Record<string, unknown>> }) {
  const m = METRICS[metric];
  const values = data.map((d) => d[metric] as number | null).filter((v): v is number => v !== null && Number.isFinite(v));
  const first = values[0];
  const last = values[values.length - 1];
  const delta = first !== undefined && last !== undefined ? last - first : null;
  const trendUp = delta !== null && delta > 0; // subir = piorar em CWV
  const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;

  const trendIcon = delta === null
    ? <Minus className="h-3.5 w-3.5" />
    : trendUp
      ? <TrendingUp className="h-3.5 w-3.5 text-red-600" />
      : delta < 0
        ? <TrendingDown className="h-3.5 w-3.5 text-emerald-600" />
        : <Minus className="h-3.5 w-3.5 text-muted-foreground" />;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-sm flex items-center gap-2">
            {m.label}
            <span className="text-[11px] font-normal text-muted-foreground">
              (alvo ≤ {m.format(m.good)} · ruim &gt; {m.format(m.poor)})
            </span>
          </CardTitle>
          <div className="flex items-center gap-2 text-[11px]">
            {avg !== null && <Badge variant="secondary">média {m.format(avg)}</Badge>}
            {last !== undefined && (
              <Badge variant="outline" className="gap-1">
                {trendIcon}
                atual {m.format(last)}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div style={{ width: "100%", height: 220 }}>
          <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis
                tick={{ fontSize: 10 }}
                tickFormatter={(v: number) => (metric === "cls" ? v.toFixed(2) : String(Math.round(v)))}
                domain={["auto", "auto"]}
              />
              <Tooltip
                formatter={(v) => (typeof v === "number" ? m.format(v) : v)}
                labelClassName="text-xs"
                contentStyle={{ fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine y={m.good} stroke="#10b981" strokeDasharray="4 4" label={{ value: "alvo", position: "insideTopRight", fontSize: 10, fill: "#10b981" }} />
              <ReferenceLine y={m.poor} stroke="#ef4444" strokeDasharray="4 4" label={{ value: "ruim", position: "insideTopRight", fontSize: 10, fill: "#ef4444" }} />
              <Line
                type="monotone"
                dataKey={metric}
                name={m.label}
                stroke={m.color}
                strokeWidth={2}
                dot={{ r: 2 }}
                activeDot={{ r: 4 }}
                connectNulls
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
