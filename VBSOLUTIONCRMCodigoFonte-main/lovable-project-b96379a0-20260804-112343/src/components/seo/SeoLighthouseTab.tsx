import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, Play, RefreshCw, Smartphone, Monitor } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { SeoLighthouseAlertasPanel } from "./SeoLighthouseAlertasPanel";
import { SeoLighthouseTendenciasPanel } from "./SeoLighthouseTendenciasPanel";

interface AuditRow {
  id: string;
  url: string;
  path: string;
  strategy: "mobile" | "desktop";
  performance_score: number | null;
  seo_score: number | null;
  accessibility_score: number | null;
  best_practices_score: number | null;
  lcp_ms: number | null;
  cls: number | null;
  tbt_ms: number | null;
  status: "ok" | "error";
  error_message: string | null;
  created_at: string;
}

function scoreColor(s: number | null): string {
  if (s === null) return "text-muted-foreground";
  if (s >= 90) return "text-emerald-600";
  if (s >= 50) return "text-amber-600";
  return "text-red-600";
}

function ScoreCell({ value }: { value: number | null }) {
  return <span className={`font-semibold ${scoreColor(value)}`}>{value ?? "—"}</span>;
}

export function SeoLighthouseTab() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("lighthouse_audits")
      .select("id,url,path,strategy,performance_score,seo_score,accessibility_score,best_practices_score,lcp_ms,cls,tbt_ms,status,error_message,created_at")
      .order("created_at", { ascending: false })
      .limit(60);
    if (error) toast.error("Falha ao carregar auditorias: " + error.message);
    setRows((data ?? []) as AuditRow[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function runNow() {
    setRunning(true);
    const t0 = Date.now();
    toast.info("Executando Lighthouse nas rotas críticas… (pode levar 1–2 min)");
    const { data, error } = await supabase.functions.invoke("lighthouse-audit", { body: {} });
    setRunning(false);
    if (error) {
      toast.error("Falha ao executar: " + error.message);
      return;
    }
    const s = (data as { summary?: { total: number; ok: number; errors: number; avgPerformance: number | null } })?.summary;
    toast.success(
      `Concluído em ${Math.round((Date.now() - t0) / 1000)}s · ${s?.ok ?? 0}/${s?.total ?? 0} OK · Perf média: ${s?.avgPerformance ?? "—"}`,
    );
    await load();
  }

  // Última auditoria por (path, strategy)
  const latestByKey = new Map<string, AuditRow>();
  for (const r of rows) {
    const key = `${r.path}::${r.strategy}`;
    if (!latestByKey.has(key)) latestByKey.set(key, r);
  }
  const latest = Array.from(latestByKey.values());

  const okLatest = latest.filter((r) => r.status === "ok");
  const avg = (arr: (number | null)[]) => {
    const v = arr.filter((x): x is number => x !== null);
    return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
  };
  const kpis = {
    perf: avg(okLatest.map((r) => r.performance_score)),
    seo: avg(okLatest.map((r) => r.seo_score)),
    a11y: avg(okLatest.map((r) => r.accessibility_score)),
    bp: avg(okLatest.map((r) => r.best_practices_score)),
    errors: latest.filter((r) => r.status === "error").length,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">Lighthouse — rotas críticas</h2>
          <p className="text-xs text-muted-foreground">
            Auditoria automática via PageSpeed Insights. Últimos resultados por rota/estratégia.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button size="sm" onClick={runNow} disabled={running}>
            {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
            Executar agora
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KPI label="Performance méd." value={kpis.perf} />
        <KPI label="SEO méd." value={kpis.seo} />
        <KPI label="Acessibilidade méd." value={kpis.a11y} />
        <KPI label="Best Practices méd." value={kpis.bp} />
        <KPI label="Erros" value={kpis.errors} tone={kpis.errors > 0 ? "warn" : "ok"} raw />
      </div>

      <SeoLighthouseAlertasPanel />

      <Card>
        <CardContent className="pt-6">
          <SeoLighthouseTendenciasPanel />
        </CardContent>
      </Card>


      <Card>
        <CardHeader>
          <CardTitle className="text-base">Últimas auditorias por rota</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rota</TableHead>
                <TableHead className="w-[90px]">Device</TableHead>
                <TableHead className="text-center">Perf</TableHead>
                <TableHead className="text-center">SEO</TableHead>
                <TableHead className="text-center">A11y</TableHead>
                <TableHead className="text-center">BP</TableHead>
                <TableHead className="text-right">LCP</TableHead>
                <TableHead className="text-right">CLS</TableHead>
                <TableHead className="text-right">TBT</TableHead>
                <TableHead className="w-[140px]">Quando</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {latest.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-sm text-muted-foreground py-8">
                    Nenhuma auditoria ainda — clique em <b>Executar agora</b>.
                  </TableCell>
                </TableRow>
              )}
              {latest.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.path}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] gap-1">
                      {r.strategy === "mobile" ? <Smartphone className="h-3 w-3" /> : <Monitor className="h-3 w-3" />}
                      {r.strategy}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center"><ScoreCell value={r.performance_score} /></TableCell>
                  <TableCell className="text-center"><ScoreCell value={r.seo_score} /></TableCell>
                  <TableCell className="text-center"><ScoreCell value={r.accessibility_score} /></TableCell>
                  <TableCell className="text-center"><ScoreCell value={r.best_practices_score} /></TableCell>
                  <TableCell className="text-right text-xs">{r.lcp_ms ? `${(r.lcp_ms / 1000).toFixed(2)}s` : "—"}</TableCell>
                  <TableCell className="text-right text-xs">{r.cls ?? "—"}</TableCell>
                  <TableCell className="text-right text-xs">{r.tbt_ms ? `${r.tbt_ms}ms` : "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.status === "error"
                      ? <span className="text-red-600" title={r.error_message ?? ""}>erro</span>
                      : formatDistanceToNow(new Date(r.created_at), { addSuffix: true, locale: ptBR })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico completo</CardTitle>
          <p className="text-xs text-muted-foreground">Últimas {rows.length} execuções.</p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[360px] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  <TableHead>Quando</TableHead>
                  <TableHead>Rota</TableHead>
                  <TableHead>Device</TableHead>
                  <TableHead className="text-center">Perf</TableHead>
                  <TableHead className="text-center">SEO</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">{new Date(r.created_at).toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="font-mono text-xs">{r.path}</TableCell>
                    <TableCell className="text-xs">{r.strategy}</TableCell>
                    <TableCell className="text-center"><ScoreCell value={r.performance_score} /></TableCell>
                    <TableCell className="text-center"><ScoreCell value={r.seo_score} /></TableCell>
                    <TableCell>
                      {r.status === "ok"
                        ? <Badge variant="secondary" className="text-[10px]">ok</Badge>
                        : <Badge className="text-[10px] bg-red-600 hover:bg-red-600" title={r.error_message ?? ""}>erro</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KPI({ label, value, tone, raw }: { label: string; value: number | null; tone?: "ok" | "warn"; raw?: boolean }) {
  const cls = raw
    ? tone === "warn" ? "text-amber-600" : "text-foreground"
    : scoreColor(value);
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-2xl font-semibold mt-1 ${cls}`}>{value ?? "—"}</div>
      </CardContent>
    </Card>
  );
}
