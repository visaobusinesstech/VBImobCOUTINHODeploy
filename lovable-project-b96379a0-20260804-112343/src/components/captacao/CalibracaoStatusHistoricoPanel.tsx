import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, RefreshCw, CheckCircle2, XCircle, Timer, Activity, AlertTriangle, History } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface Run {
  id: string;
  nome: string | null;
  status: "success" | "failure" | "partial";
  erro: string | null;
  duracao_ms: number | null;
  finalizado_em: string | null;
  criado_em: string;
  janela_dias: number;
  threshold_ai: number;
  amostra_total: number;
  positivos_reais: number;
  positivos_preditos: number;
  precision_v: number | null;
  recall_v: number | null;
  f1_v: number | null;
  accuracy_v: number | null;
  auc: number | null;
  lift: number | null;
  latency_ms_avg: number | null;
  latency_ms_p95: number | null;
  latency_batches: number | null;
  modelo: string | null;
  provider: string | null;
}

interface Stats {
  total: number; success: number; failure: number; success_rate: number;
  last_run_at: string | null; last_status: string | null; last_erro: string | null;
  duracao_ms_avg: number; duracao_ms_p50: number; duracao_ms_p95: number;
  f1_avg: number; precision_avg: number; recall_avg: number; auc_avg: number;
  amostra_total: number;
}

interface Timeline { dia: string; total: number; success: number; failure: number; f1_avg: number | null }

interface Falha {
  id: string; run_id: string | null; fingerprint: string; erro: string;
  stack: string | null; http_status: number | null; duracao_ms: number | null;
  payload: any; query_context: any; ai_provider: string | null; ai_modelo: string | null;
  ocorrencias_24h: number; notificado: boolean; criado_em: string;
}
interface Recorrencia { fingerprint: string; ocorrencias: number; ultimo_erro: string; ultimo_em: string; notificado: boolean }

interface Payload { runs: Run[]; stats: Stats; timeline: Timeline[]; falhas?: Falha[]; recorrencias?: Recorrencia[] }

const fmtDur = (ms: number | null) => {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  return s < 60 ? `${s.toFixed(1)}s` : `${Math.floor(s / 60)}m${Math.round(s % 60)}s`;
};
const fmtPct = (v: number | null | undefined, digits = 1) =>
  v == null ? "—" : `${(Number(v) * 100).toFixed(digits)}%`;
const fmtDateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";

export function CalibracaoStatusHistoricoPanel() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [dias, setDias] = useState("30");
  const [statusFiltro, setStatusFiltro] = useState<string>("all");
  const [data, setData] = useState<Payload | null>(null);
  const [runSelecionada, setRunSelecionada] = useState<Run | null>(null);

  const carregar = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const params = new URLSearchParams({ dias, limit: "50" });
      if (statusFiltro !== "all") params.set("status", statusFiltro);
      const url = `https://ugxnxztecfsklijmhhmo.supabase.co/functions/v1/calibracao-historico?${params}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Falha ao carregar histórico");
      setData(json);
    } catch (e: any) {
      toast({ title: "Erro ao carregar histórico", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user, dias, statusFiltro, toast]);

  useEffect(() => { carregar(); }, [carregar]);

  const stats = data?.stats;
  const runs = data?.runs ?? [];
  const timeline = data?.timeline ?? [];

  const successColor = "hsl(var(--primary))";
  const failureColor = "hsl(var(--destructive))";

  const badgeStatus = (s: string) => {
    if (s === "success") return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200"><CheckCircle2 className="h-3 w-3 mr-1" />Sucesso</Badge>;
    if (s === "failure") return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Falha</Badge>;
    return <Badge variant="secondary">Parcial</Badge>;
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Status & Histórico das Calibrações IA</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Select value={dias} onValueChange={setDias}>
                <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Últimos 7d</SelectItem>
                  <SelectItem value="30">Últimos 30d</SelectItem>
                  <SelectItem value="90">Últimos 90d</SelectItem>
                  <SelectItem value="180">Últimos 180d</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFiltro} onValueChange={setStatusFiltro}>
                <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="success">Sucesso</SelectItem>
                  <SelectItem value="failure">Falha</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={carregar} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <Kpi label="Execuções" value={String(stats?.total ?? 0)} icon={<Activity className="h-4 w-4" />} />
            <Kpi label="Taxa de sucesso" value={fmtPct(stats?.success_rate, 0)}
                 tone={(stats?.success_rate ?? 1) < 0.8 ? "warn" : "ok"} />
            <Kpi label="Falhas" value={String(stats?.failure ?? 0)}
                 tone={(stats?.failure ?? 0) > 0 ? "warn" : "muted"} icon={<XCircle className="h-4 w-4" />} />
            <Kpi label="Duração média" value={fmtDur(stats?.duracao_ms_avg ?? 0)} icon={<Timer className="h-4 w-4" />} />
            <Kpi label="F1 médio" value={fmtPct(stats?.f1_avg, 1)} />
            <Kpi label="AUC médio" value={fmtPct(stats?.auc_avg, 1)} />
          </div>

          {stats?.last_status === "failure" && stats?.last_erro && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
              <div>
                <div className="font-medium text-destructive">Última execução falhou</div>
                <div className="text-muted-foreground text-xs mt-0.5">
                  {fmtDateTime(stats.last_run_at)} — {stats.last_erro}
                </div>
              </div>
            </div>
          )}

          {/* Timeline */}
          {timeline.length > 0 && (
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeline}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="dia" fontSize={11} />
                  <YAxis fontSize={11} allowDecimals={false} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="success" name="Sucesso" stackId="1"
                        stroke={successColor} fill={successColor} fillOpacity={0.3} />
                  <Area type="monotone" dataKey="failure" name="Falha" stackId="1"
                        stroke={failureColor} fill={failureColor} fillOpacity={0.3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Tabela */}
          <ScrollArea className="max-h-[420px] w-full rounded-md border">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead className="text-right">Duração</TableHead>
                  <TableHead className="text-right">Amostra</TableHead>
                  <TableHead className="text-right">F1</TableHead>
                  <TableHead className="text-right">AUC</TableHead>
                  <TableHead>Modelo</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.length === 0 && !loading && (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground text-sm">
                    Nenhuma calibração no período. Execute uma calibração na aba acima para popular o histórico.
                  </TableCell></TableRow>
                )}
                {runs.map((r) => (
                  <TableRow key={r.id} className={runSelecionada?.id === r.id ? "bg-muted/50" : ""}>
                    <TableCell className="text-xs">{fmtDateTime(r.criado_em)}</TableCell>
                    <TableCell>{badgeStatus(r.status)}</TableCell>
                    <TableCell className="text-sm">{r.nome ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-right text-sm">{fmtDur(r.duracao_ms)}</TableCell>
                    <TableCell className="text-right text-sm">{r.amostra_total || "—"}</TableCell>
                    <TableCell className="text-right text-sm">{fmtPct(r.f1_v)}</TableCell>
                    <TableCell className="text-right text-sm">{fmtPct(r.auc)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground truncate max-w-[140px]">
                      {r.provider ? `${r.provider}` : "—"}{r.modelo ? ` · ${r.modelo}` : ""}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm"
                              onClick={() => setRunSelecionada(runSelecionada?.id === r.id ? null : r)}>
                        {runSelecionada?.id === r.id ? "Fechar" : "Detalhes"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>

          {runSelecionada && (
            <Card className="border-primary/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  {badgeStatus(runSelecionada.status)}
                  {runSelecionada.nome || "Execução"}
                  <span className="text-xs text-muted-foreground font-normal">
                    {fmtDateTime(runSelecionada.criado_em)}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <Detail label="Duração total" value={fmtDur(runSelecionada.duracao_ms)} />
                <Detail label="Latência média IA" value={fmtDur(runSelecionada.latency_ms_avg)} />
                <Detail label="Latência p95" value={fmtDur(runSelecionada.latency_ms_p95)} />
                <Detail label="Batches" value={String(runSelecionada.latency_batches ?? "—")} />
                <Detail label="Janela" value={`${runSelecionada.janela_dias}d`} />
                <Detail label="Threshold" value={String(runSelecionada.threshold_ai)} />
                <Detail label="Amostra" value={String(runSelecionada.amostra_total)} />
                <Detail label="Positivos reais" value={String(runSelecionada.positivos_reais)} />
                <Detail label="Precision" value={fmtPct(runSelecionada.precision_v)} />
                <Detail label="Recall" value={fmtPct(runSelecionada.recall_v)} />
                <Detail label="F1" value={fmtPct(runSelecionada.f1_v)} />
                <Detail label="AUC" value={fmtPct(runSelecionada.auc)} />
                {runSelecionada.status === "failure" && runSelecionada.erro && (
                  <div className="col-span-full rounded-md bg-destructive/5 border border-destructive/40 p-2 text-xs text-destructive">
                    <div className="font-medium">Erro:</div>
                    <div className="mt-1 whitespace-pre-wrap break-words">{runSelecionada.erro}</div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Falhas estruturadas & recorrências */}
          <FalhasSection falhas={data?.falhas ?? []} recorrencias={data?.recorrencias ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}

function FalhasSection({ falhas, recorrencias }: { falhas: Falha[]; recorrencias: Recorrencia[] }) {
  const [expandido, setExpandido] = useState<string | null>(null);
  if (falhas.length === 0 && recorrencias.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-destructive" />
        <h3 className="text-sm font-semibold">Falhas & recorrências</h3>
        <Badge variant="outline" className="text-xs">{falhas.length} log(s)</Badge>
      </div>

      {recorrencias.length > 0 && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Padrão do erro (fingerprint)</TableHead>
                <TableHead className="text-right">Ocorrências</TableHead>
                <TableHead>Última em</TableHead>
                <TableHead>Alerta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recorrencias.map((r) => (
                <TableRow key={r.fingerprint}>
                  <TableCell className="text-xs font-mono truncate max-w-[420px]" title={r.ultimo_erro}>
                    {r.ultimo_erro}
                  </TableCell>
                  <TableCell className="text-right text-sm font-semibold">
                    <Badge variant={r.ocorrencias >= 3 ? "destructive" : "secondary"}>{r.ocorrencias}x</Badge>
                  </TableCell>
                  <TableCell className="text-xs">{fmtDateTime(r.ultimo_em)}</TableCell>
                  <TableCell>
                    {r.notificado
                      ? <Badge className="bg-amber-100 text-amber-800 border-amber-200">Notificado</Badge>
                      : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {falhas.length > 0 && (
        <ScrollArea className="max-h-[360px] w-full rounded-md border">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Erro</TableHead>
                <TableHead className="text-right">Duração</TableHead>
                <TableHead className="text-right">24h</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {falhas.map((f) => (
                <FalhaRow
                  key={f.id}
                  f={f}
                  aberto={expandido === f.id}
                  onToggle={() => setExpandido(expandido === f.id ? null : f.id)}
                />
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      )}
    </div>
  );
}

function FalhaRow({ f, aberto, onToggle }: { f: Falha; aberto: boolean; onToggle: () => void }) {
  return (
    <>
      <TableRow>
        <TableCell className="text-xs">{fmtDateTime(f.criado_em)}</TableCell>
        <TableCell className="text-xs max-w-[380px] truncate" title={f.erro}>{f.erro}</TableCell>
        <TableCell className="text-right text-xs">{fmtDur(f.duracao_ms)}</TableCell>
        <TableCell className="text-right text-xs">
          <Badge variant={f.ocorrencias_24h >= 3 ? "destructive" : "outline"}>{f.ocorrencias_24h}x</Badge>
        </TableCell>
        <TableCell className="text-xs text-muted-foreground">
          {f.ai_provider ?? "—"}{f.ai_modelo ? ` · ${f.ai_modelo}` : ""}
        </TableCell>
        <TableCell>
          <Button variant="ghost" size="sm" onClick={onToggle}>
            {aberto ? "Fechar" : "Payload"}
          </Button>
        </TableCell>
      </TableRow>
      {aberto && (
        <TableRow>
          <TableCell colSpan={6} className="bg-muted/30">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-2">
              <div>
                <div className="text-xs font-semibold mb-1">Query context</div>
                <pre className="text-[11px] bg-background border rounded p-2 overflow-auto max-h-40">
{JSON.stringify(f.query_context, null, 2)}
                </pre>
              </div>
              <div>
                <div className="text-xs font-semibold mb-1">Payload (sanitizado)</div>
                <pre className="text-[11px] bg-background border rounded p-2 overflow-auto max-h-40">
{JSON.stringify(f.payload, null, 2)}
                </pre>
              </div>
              {f.stack && (
                <div className="md:col-span-2">
                  <div className="text-xs font-semibold mb-1">Stack</div>
                  <pre className="text-[11px] bg-background border rounded p-2 overflow-auto max-h-40 whitespace-pre-wrap">
{f.stack}
                  </pre>
                </div>
              )}
              <div className="md:col-span-2 text-[11px] text-muted-foreground">
                fingerprint: <span className="font-mono">{f.fingerprint}</span>
                {f.run_id ? <> · run: <span className="font-mono">{f.run_id}</span></> : null}
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function Kpi({ label, value, icon, tone = "default" }: {
  label: string; value: string; icon?: React.ReactNode;
  tone?: "default" | "ok" | "warn" | "muted";
}) {
  const toneCls =
    tone === "ok" ? "border-emerald-200 bg-emerald-50/40" :
    tone === "warn" ? "border-amber-200 bg-amber-50/40" :
    tone === "muted" ? "opacity-70" : "";
  return (
    <div className={`rounded-md border p-3 ${toneCls}`}>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-lg font-semibold mt-1">{value}</div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
