import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Loader2, Rocket, RefreshCw, AlertTriangle, CheckCircle2, Wrench, ClipboardList, ShieldCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Run {
  id: string;
  trigger_source: string;
  release_tag: string | null;
  paths: string[];
  strategies: string[];
  status: "running" | "completed" | "failed";
  total_routes: number;
  ok_routes: number;
  regressions_count: number;
  avg_performance: number | null;
  avg_seo: number | null;
  avg_lcp_ms: number | null;
  avg_cls: number | null;
  avg_tbt_ms: number | null;
  summary: {
    critical?: number; warn?: number; info?: number; auto_fixable?: number;
    routes_with_regression?: number; baseline_available?: number;
  } | null;
  duration_ms: number | null;
  created_at: string;
  completed_at: string | null;
  error_message: string | null;
}

interface Action {
  id: string;
  run_id: string;
  path: string;
  strategy: "mobile" | "desktop";
  metric: string;
  severity: "info" | "warn" | "critical";
  previous_value: number | null;
  current_value: number | null;
  delta: number | null;
  threshold: number | null;
  probable_cause: string;
  recommendation: string;
  category: string;
  auto_fixable: boolean;
  applied: boolean;
  applied_at: string | null;
  notes: string | null;
}

const SEVERITY_STYLES: Record<Action["severity"], string> = {
  info: "bg-slate-100 text-slate-700",
  warn: "bg-amber-100 text-amber-800",
  critical: "bg-red-100 text-red-800",
};

const CATEGORY_LABELS: Record<string, string> = {
  image: "Imagens", javascript: "JavaScript", css: "CSS", fonts: "Fontes",
  cache: "Cache/CDN", cdn: "CDN", html: "HTML/A11y", seo: "SEO", other: "Outros",
};

export function SeoPostDeployPanel() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [selectedRun, setSelectedRun] = useState<Run | null>(null);
  const [actions, setActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [paths, setPaths] = useState("/\n/portal\n/anunciar-imovel");
  const [releaseTag, setReleaseTag] = useState("");
  const [strategy, setStrategy] = useState<"mobile" | "desktop" | "both">("mobile");
  const [pendingApproval, setPendingApproval] = useState<Action[] | null>(null);
  const [approvalNote, setApprovalNote] = useState("");
  const [approving, setApproving] = useState(false);

  async function loadRuns() {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("post_deploy_audit_runs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) toast.error("Falha ao carregar execuções: " + error.message);
    const list = (data ?? []) as Run[];
    setRuns(list);
    if (list.length && !selectedRun) setSelectedRun(list[0]);
    setLoading(false);
  }

  async function loadActions(runId: string) {
    const { data, error } = await (supabase as any)
      .from("post_deploy_audit_actions")
      .select("*")
      .eq("run_id", runId)
      .order("severity", { ascending: false })
      .order("created_at", { ascending: true });
    if (error) return toast.error("Falha ao carregar ações: " + error.message);
    setActions((data ?? []) as Action[]);
  }

  useEffect(() => { loadRuns(); }, []);
  useEffect(() => { if (selectedRun) loadActions(selectedRun.id); }, [selectedRun]);

  async function runAudit() {
    const list = paths.split("\n").map((p) => p.trim()).filter((p) => p.startsWith("/"));
    if (!list.length) return toast.error("Informe ao menos uma rota (começando com /).");
    setRunning(true);
    const strategies = strategy === "both" ? ["mobile", "desktop"] : [strategy];
    toast.info(`Executando auditoria pós-deploy em ${list.length} rota(s)…`);
    const { data, error } = await supabase.functions.invoke("post-deploy-audit", {
      body: {
        paths: list,
        strategies,
        release_tag: releaseTag || null,
        trigger_source: "publish",
      },
    });
    setRunning(false);
    if (error) return toast.error("Falha: " + error.message);
    const s = (data as { summary?: { total_actions: number; critical: number } })?.summary;
    toast.success(
      `Auditoria concluída · ${s?.total_actions ?? 0} ação(ões) sugerida(s) · ${s?.critical ?? 0} crítica(s)`,
    );
    await loadRuns();
  }

  async function toggleApplied(a: Action) {
    // Reverter marcação não exige aprovação — apenas registrar
    if (a.applied) {
      const { error } = await (supabase as any)
        .from("post_deploy_audit_actions")
        .update({ applied: false, applied_at: null })
        .eq("id", a.id);
      if (error) return toast.error(error.message);
      setActions((prev) => prev.map((x) => x.id === a.id ? { ...x, applied: false, applied_at: null } : x));
      toast.info("Aplicação revertida.");
      return;
    }
    // Aplicar exige confirmação explícita do usuário
    setApprovalNote("");
    setPendingApproval([a]);
  }

  function requestBulkApproval() {
    const pend = actions.filter((a) => a.auto_fixable && !a.applied);
    if (!pend.length) return toast.info("Nenhuma ação auto-fix pendente.");
    setApprovalNote("");
    setPendingApproval(pend);
  }

  async function confirmApproval() {
    if (!pendingApproval || pendingApproval.length === 0) return;
    setApproving(true);
    const now = new Date().toISOString();
    const ids = pendingApproval.map((a) => a.id);
    const notePatch = approvalNote.trim() ? { notes: approvalNote.trim() } : {};
    const { error } = await (supabase as any)
      .from("post_deploy_audit_actions")
      .update({ applied: true, applied_at: now, ...notePatch })
      .in("id", ids);
    setApproving(false);
    if (error) return toast.error(error.message);
    setActions((prev) => prev.map((x) => ids.includes(x.id)
      ? { ...x, applied: true, applied_at: now, notes: approvalNote.trim() || x.notes }
      : x));
    toast.success(`${ids.length} ação(ões) aprovada(s) e marcada(s) como aplicada(s).`);
    setPendingApproval(null);
    setApprovalNote("");
  }

  async function saveNotes(a: Action, notes: string) {
    const { error } = await (supabase as any)
      .from("post_deploy_audit_actions")
      .update({ notes })
      .eq("id", a.id);
    if (error) return toast.error(error.message);
    setActions((prev) => prev.map((x) => x.id === a.id ? { ...x, notes } : x));
    toast.success("Observações salvas.");
  }

  const stats = useMemo(() => {
    const critical = actions.filter((a) => a.severity === "critical").length;
    const warn = actions.filter((a) => a.severity === "warn").length;
    const info = actions.filter((a) => a.severity === "info").length;
    const applied = actions.filter((a) => a.applied).length;
    const autoFixable = actions.filter((a) => a.auto_fixable && !a.applied).length;
    return { critical, warn, info, applied, autoFixable, total: actions.length };
  }, [actions]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Rocket className="h-4 w-4" /> Auditoria pós-publicação
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Rode uma auditoria Lighthouse completa após publicar/atualizar rotas. Compara com o baseline
            anterior, detecta regressões em Core Web Vitals (LCP, CLS, TBT/INP, FCP, SI) e monta um
            relatório de ações corretivas (automáticas quando possível).
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="md:col-span-2 space-y-2">
              <Label>Rotas (uma por linha)</Label>
              <Textarea rows={4} value={paths} onChange={(e) => setPaths(e.target.value)} className="font-mono text-xs" />
            </div>
            <div className="space-y-2">
              <div className="space-y-1">
                <Label>Tag da release (opcional)</Label>
                <Input value={releaseTag} onChange={(e) => setReleaseTag(e.target.value)} placeholder="v2026.07.20" />
              </div>
              <div className="space-y-1">
                <Label>Dispositivo</Label>
                <div className="flex gap-1">
                  {(["mobile", "desktop", "both"] as const).map((s) => (
                    <Button
                      key={s} size="sm"
                      variant={strategy === s ? "default" : "outline"}
                      onClick={() => setStrategy(s)}
                    >{s === "both" ? "Ambos" : s}</Button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <Button onClick={runAudit} disabled={running}>
              {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Rocket className="h-4 w-4 mr-2" />}
              Executar auditoria pós-deploy
            </Button>
            <Button variant="outline" size="sm" onClick={loadRuns} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Recarregar histórico
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader><CardTitle className="text-sm">Últimas execuções</CardTitle></CardHeader>
          <CardContent className="p-0 max-h-[380px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quando</TableHead>
                  <TableHead className="text-center">Rotas</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.length === 0 && (
                  <TableRow><TableCell colSpan={3} className="text-center text-xs text-muted-foreground py-6">
                    Nenhuma execução registrada.
                  </TableCell></TableRow>
                )}
                {runs.map((r) => (
                  <TableRow key={r.id} className={`cursor-pointer ${selectedRun?.id === r.id ? "bg-muted/40" : ""}`}
                    onClick={() => setSelectedRun(r)}>
                    <TableCell className="text-xs">
                      <div>{formatDistanceToNow(new Date(r.created_at), { addSuffix: true, locale: ptBR })}</div>
                      <div className="text-[10px] text-muted-foreground">{r.release_tag ?? r.trigger_source}</div>
                    </TableCell>
                    <TableCell className="text-center text-xs">
                      {r.ok_routes}/{r.total_routes}
                    </TableCell>
                    <TableCell className="text-center">
                      {r.regressions_count > 0
                        ? <Badge className="bg-amber-500 hover:bg-amber-500 text-white">{r.regressions_count}</Badge>
                        : <Badge variant="secondary">0</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="text-sm flex items-center gap-2">
                <ClipboardList className="h-4 w-4" /> Relatório de ações corretivas
              </CardTitle>
              {selectedRun && stats.autoFixable > 0 && (
                <Button size="sm" variant="outline" onClick={requestBulkApproval} className="gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  Aprovar {stats.autoFixable} auto-fix{stats.autoFixable > 1 ? "es" : ""}
                </Button>
              )}
            </div>
            {selectedRun && (
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-xs mt-2">
                <Kpi label="Perf" value={selectedRun.avg_performance ?? "—"} />
                <Kpi label="SEO" value={selectedRun.avg_seo ?? "—"} />
                <Kpi label="LCP" value={selectedRun.avg_lcp_ms ? `${(selectedRun.avg_lcp_ms/1000).toFixed(2)}s` : "—"} />
                <Kpi label="CLS" value={selectedRun.avg_cls ?? "—"} />
                <Kpi label="TBT" value={selectedRun.avg_tbt_ms ? `${selectedRun.avg_tbt_ms}ms` : "—"} />
                <Kpi label="Auto-fix" value={stats.autoFixable} tone={stats.autoFixable > 0 ? "warn" : "ok"} />
              </div>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {!selectedRun && (
              <div className="text-center text-xs text-muted-foreground py-8">Selecione uma execução para ver o relatório.</div>
            )}
            {selectedRun && actions.length === 0 && (
              <div className="text-center text-sm text-emerald-700 py-8 flex flex-col items-center gap-2">
                <CheckCircle2 className="h-6 w-6" />
                Nenhuma regressão detectada — todas as métricas dentro dos limites de excelência.
              </div>
            )}
            {selectedRun && actions.length > 0 && (
              <div className="divide-y">
                {actions.map((a) => (
                  <div key={a.id} className="p-3 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={SEVERITY_STYLES[a.severity]}>{a.severity.toUpperCase()}</Badge>
                      <Badge variant="outline" className="text-[10px]">{CATEGORY_LABELS[a.category] ?? a.category}</Badge>
                      <span className="font-mono text-xs">{a.path}</span>
                      <span className="text-[10px] text-muted-foreground">· {a.strategy} · {a.metric}</span>
                      {a.auto_fixable && (
                        <Badge className="bg-emerald-100 text-emerald-800 text-[10px] gap-1">
                          <Wrench className="h-3 w-3" /> auto-fix
                        </Badge>
                      )}
                      {a.applied && <Badge className="bg-emerald-600 text-white text-[10px]">aplicado</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">Anterior:</span> {a.previous_value ?? "—"}{" "}
                      <span className="mx-1">→</span>
                      <span className="font-semibold text-foreground">Atual:</span> {a.current_value ?? "—"}{" "}
                      {a.threshold !== null && <span>· limite {a.threshold}</span>}
                      {a.delta !== null && <span> · Δ {a.delta > 0 ? `+${a.delta}` : a.delta}</span>}
                    </div>
                    <div className="text-xs">
                      <div className="flex gap-2"><AlertTriangle className="h-3 w-3 mt-[3px] text-amber-600 shrink-0" /><span><b>Causa provável:</b> {a.probable_cause}</span></div>
                      <div className="flex gap-2 mt-1"><Wrench className="h-3 w-3 mt-[3px] text-emerald-700 shrink-0" /><span><b>Ação recomendada:</b> {a.recommendation}</span></div>
                    </div>
                    <NoteEditor a={a} onSave={saveNotes} />
                    <div className="flex items-center gap-2 pt-1 flex-wrap">
                      {a.applied ? (
                        <>
                          <Badge className="bg-emerald-600 text-white text-[10px] gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Aplicado
                            {a.applied_at ? ` · ${new Date(a.applied_at).toLocaleString("pt-BR")}` : ""}
                          </Badge>
                          <Button size="sm" variant="ghost" className="h-6 text-[11px]" onClick={() => toggleApplied(a)}>
                            Reverter
                          </Button>
                        </>
                      ) : (
                        <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={() => toggleApplied(a)}>
                          <ShieldCheck className="h-3 w-3" />
                          Aprovar & marcar como aplicada
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!pendingApproval} onOpenChange={(o) => !o && !approving && setPendingApproval(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-700" />
              Confirmar aplicação {pendingApproval && pendingApproval.length > 1 ? `de ${pendingApproval.length} ações` : "da ação"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-xs">
                <p>
                  Você está prestes a registrar {pendingApproval && pendingApproval.length > 1
                    ? `${pendingApproval.length} ações corretivas como aplicadas`
                    : "esta ação corretiva como aplicada"}. Este passo é apenas registrado após a sua confirmação explícita.
                </p>
                {pendingApproval && (
                  <div className="max-h-40 overflow-auto border rounded p-2 space-y-1 bg-muted/30">
                    {pendingApproval.slice(0, 8).map((a) => (
                      <div key={a.id} className="text-[11px] flex gap-2">
                        <Badge className={SEVERITY_STYLES[a.severity]}>{a.severity}</Badge>
                        <span className="font-mono">{a.path}</span>
                        <span className="text-muted-foreground">· {a.metric}</span>
                      </div>
                    ))}
                    {pendingApproval.length > 8 && (
                      <div className="text-[11px] text-muted-foreground">
                        + {pendingApproval.length - 8} adicionais…
                      </div>
                    )}
                  </div>
                )}
                <div className="space-y-1">
                  <Label className="text-[11px]">Observação da aprovação (opcional)</Label>
                  <Textarea
                    rows={2}
                    value={approvalNote}
                    onChange={(e) => setApprovalNote(e.target.value)}
                    placeholder="Ex.: correção validada em staging antes do deploy"
                    className="text-xs"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={approving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); confirmApproval(); }} disabled={approving}>
              {approving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
              Confirmar aprovação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string | number; tone?: "ok" | "warn" }) {
  const cls = tone === "warn" ? "text-amber-700" : "text-foreground";
  return (
    <div className="border rounded p-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={`font-semibold text-sm ${cls}`}>{value}</div>
    </div>
  );
}

function NoteEditor({ a, onSave }: { a: Action; onSave: (a: Action, notes: string) => void }) {
  const [val, setVal] = useState(a.notes ?? "");
  const [editing, setEditing] = useState(false);
  if (!editing && !val) {
    return <Button variant="ghost" size="sm" className="h-6 px-1 text-[11px]" onClick={() => setEditing(true)}>+ adicionar observação</Button>;
  }
  return (
    <div className="space-y-1">
      <Textarea rows={2} value={val} onChange={(e) => setVal(e.target.value)} className="text-xs"
        placeholder="Observações da correção (opcional)" />
      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="h-6 text-[11px]" onClick={() => { onSave(a, val); setEditing(false); }}>Salvar</Button>
        {editing && <Button size="sm" variant="ghost" className="h-6 text-[11px]" onClick={() => { setVal(a.notes ?? ""); setEditing(false); }}>Cancelar</Button>}
      </div>
    </div>
  );
}
