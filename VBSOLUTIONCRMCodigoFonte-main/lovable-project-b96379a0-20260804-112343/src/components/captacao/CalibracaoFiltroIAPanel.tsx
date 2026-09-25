import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, FlaskConical, Save, TrendingUp, Target, Percent, Activity, History, Database, Camera, Trash2, Timer, GitCompare } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine, Area, AreaChart,
} from "recharts";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { CalibracaoErrorAlert } from "./CalibracaoErrorAlert";

interface RunResult {
  run_id?: string | null;
  dataset?: { id: string; nome: string } | null;
  amostra_total: number;
  janela_dias: number;
  threshold_ai: number;
  positivos_reais: number;
  positivos_preditos: number;
  tp: number; fp: number; tn: number; fn: number;
  precision: number; recall: number; f1: number; accuracy: number;
  fpr: number; fnr: number; auc: number;
  conversao_preditos: number; conversao_geral: number; lift: number;
  threshold_sweep: { threshold: number; precision: number; recall: number; f1: number; fpr: number; fnr: number }[];
  roc_curve: { threshold: number; tpr: number; fpr: number }[];
  resultados_amostra: any[];
  latency_ms_avg: number; latency_ms_p50: number; latency_ms_p95: number; latency_ms_p99: number;
  latency_ms_total: number; latency_batches: number; batch_size?: number;
  modelo?: string; provider?: string;
}

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

export function CalibracaoFiltroIAPanel() {
  const { toast } = useToast();
  const { imobiliariaId } = useAuth();

  const [datasets, setDatasets] = useState<any[]>([]);
  const [datasetId, setDatasetId] = useState<string>("live");

  const [amostra, setAmostra] = useState(40);
  const [janela, setJanela] = useState(60);
  const [threshold, setThreshold] = useState(60);
  const [batchSize, setBatchSize] = useState(8);
  const [operacao, setOperacao] = useState<string>("todas");
  const [cidade, setCidade] = useState("");
  const [bairro, setBairro] = useState("");
  const [portfolio, setPortfolio] = useState("");
  const [pProb, setPProb] = useState(40);
  const [pUrg, setPUrg] = useState(30);
  const [pInv, setPInv] = useState(15);
  const [pPort, setPPort] = useState(15);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [snapping, setSnapping] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [erroAmigavel, setErroAmigavel] = useState<import("@/lib/calibracaoErrorGuide").CalibracaoFriendlyError | null>(null);
  const [historico, setHistorico] = useState<any[]>([]);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareData, setCompareData] = useState<any[]>([]);
  const [nomeRun, setNomeRun] = useState("");
  const [nomeDataset, setNomeDataset] = useState("");

  const carregarDatasets = async () => {
    if (!imobiliariaId) return;
    const { data } = await supabase
      .from("calibracao_datasets")
      .select("id,nome,total_itens,positivos,criado_em,origem,janela_dias")
      .eq("imobiliaria_id", imobiliariaId)
      .order("criado_em", { ascending: false });
    setDatasets(data || []);
  };

  const carregarHistorico = async () => {
    if (!imobiliariaId) return;
    const { data } = await supabase
      .from("calibracao_filtro_ia_runs")
      .select("id,nome,criado_em,dataset_id,amostra_total,threshold_ai,precision_v,recall_v,f1_v,fpr,fnr,auc,conversao_preditos,lift,latency_ms_avg,latency_ms_p95")
      .eq("imobiliaria_id", imobiliariaId)
      .order("criado_em", { ascending: false })
      .limit(30);
    setHistorico(data || []);
  };

  useEffect(() => { carregarDatasets(); carregarHistorico(); }, [imobiliariaId]);

  const runTeste = async (salvar = false) => {
    setLoading(!salvar); setSaving(salvar);
    setErroAmigavel(null);
    try {
      const { data, error } = await supabase.functions.invoke("calibrar-filtro-ia", {
        body: {
          dataset_id: datasetId === "live" ? null : datasetId,
          config: {
            operacao: operacao === "todas" ? null : operacao,
            cidade: cidade || null, bairro: bairro || null,
            criterios: { probabilidade: pProb, urgencia: pUrg, investimento: pInv, portfolio: pPort },
            portfolio_hint: portfolio || null,
          },
          amostra, janela_dias: janela, threshold_ai: threshold, batch_size: batchSize,
          salvar, nome: nomeRun || null,
        },
      });
      const { resolveCalibracaoError } = await import("@/lib/calibracaoErrorGuide");
      if (error) {
        const friendly = resolveCalibracaoError({
          error_code: (error as any)?.error_code ?? null,
          message: error.message,
          detalhe: (error as any)?.detalhe ?? null,
        });
        setErroAmigavel(friendly);
        return;
      }
      if (data?.success === false || data?.error_code) {
        const friendly = resolveCalibracaoError({
          error_code: data?.error_code ?? null,
          message: data?.message ?? data?.error ?? null,
          detalhe: data?.detalhe ?? null,
        });
        setErroAmigavel(friendly);
        return;
      }
      setResult(data as RunResult);
      if (salvar) { toast({ title: "Calibração salva" }); carregarHistorico(); }
    } catch (e: any) {
      const { resolveCalibracaoError } = await import("@/lib/calibracaoErrorGuide");
      setErroAmigavel(resolveCalibracaoError({
        error_code: e?.error_code ?? null,
        message: e?.message,
        detalhe: e?.detalhe ?? null,
      }));
    } finally { setLoading(false); setSaving(false); }
  };

  const snapshotDataset = async () => {
    if (!nomeDataset.trim()) {
      toast({ title: "Dê um nome ao dataset", variant: "destructive" });
      return;
    }
    setSnapping(true);
    try {
      const { data, error } = await supabase.functions.invoke("calibrar-filtro-ia", {
        body: {
          action: "snapshot_dataset",
          dataset_nome: nomeDataset,
          config: {
            operacao: operacao === "todas" ? null : operacao,
            cidade: cidade || null, bairro: bairro || null,
          },
          amostra, janela_dias: janela,
        },
      });
      if (error) throw error;
      if (data?.success === false) {
        toast({ title: "Falha ao criar snapshot", description: data.message, variant: "destructive" });
        return;
      }
      toast({ title: "Dataset criado", description: `${data.dataset.total_itens} itens (${data.dataset.positivos} positivos)` });
      setNomeDataset("");
      await carregarDatasets();
      setDatasetId(data.dataset.id);
    } catch (e: any) {
      toast({ title: "Erro", description: e?.message, variant: "destructive" });
    } finally { setSnapping(false); }
  };

  const removerDataset = async (id: string) => {
    if (!confirm("Excluir este dataset? Runs vinculadas continuarão existindo.")) return;
    const { error } = await supabase.from("calibracao_datasets").delete().eq("id", id);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    if (datasetId === id) setDatasetId("live");
    carregarDatasets();
  };

  const carregarComparacao = async () => {
    if (compareIds.length < 2) {
      toast({ title: "Selecione ao menos 2 runs no histórico" });
      return;
    }
    const { data } = await supabase
      .from("calibracao_filtro_ia_runs")
      .select("id,nome,criado_em,threshold_ai,amostra_total,precision_v,recall_v,f1_v,accuracy_v,fpr,fnr,auc,conversao_preditos,conversao_geral,lift,latency_ms_avg,latency_ms_p95,latency_ms_p99,roc_curve,threshold_sweep")
      .in("id", compareIds);
    setCompareData(data || []);
  };

  const bestThreshold = useMemo(() => {
    if (!result?.threshold_sweep?.length) return null;
    return result.threshold_sweep.reduce((a, b) => (b.f1 > a.f1 ? b : a));
  }, [result]);

  const rocOverlay = useMemo(() => {
    if (compareData.length < 2) return [];
    // Junta pontos por fpr aproximado
    const merged: any[] = [];
    const buckets = 21;
    for (let i = 0; i <= buckets; i++) {
      const fpr = i / buckets;
      const row: any = { fpr: +fpr.toFixed(2) };
      for (const run of compareData) {
        const curve = (run.roc_curve || []).slice().sort((a: any, b: any) => a.fpr - b.fpr);
        // interpolação linear
        let tpr = 0;
        for (let j = 1; j < curve.length; j++) {
          if (curve[j].fpr >= fpr) {
            const a = curve[j - 1], b = curve[j];
            const t = b.fpr === a.fpr ? 0 : (fpr - a.fpr) / (b.fpr - a.fpr);
            tpr = a.tpr + t * (b.tpr - a.tpr);
            break;
          }
        }
        row[run.nome || run.id.slice(0, 6)] = +tpr.toFixed(4);
      }
      merged.push(row);
    }
    return merged;
  }, [compareData]);

  return (
    <Tabs defaultValue="rodar" className="space-y-4">
      <TabsList>
        <TabsTrigger value="rodar"><FlaskConical className="w-4 h-4 mr-1.5" />Rodar teste</TabsTrigger>
        <TabsTrigger value="datasets"><Database className="w-4 h-4 mr-1.5" />Datasets ({datasets.length})</TabsTrigger>
        <TabsTrigger value="comparar"><GitCompare className="w-4 h-4 mr-1.5" />Comparação</TabsTrigger>
      </TabsList>

      {/* ===================== RODAR TESTE ===================== */}
      <TabsContent value="rodar" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-primary" />
              Modo de teste – Calibração da IA
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Compara a saída da IA com o resultado esperado (ground truth) e mede precision, recall, F1, FPR, FNR,
              AUC, taxa de conversão simulada e latência (avg / p95 / p99).
            </p>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <div>
                <Label>Fonte de dados</Label>
                <Select value={datasetId} onValueChange={setDatasetId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="live">Histórico ao vivo (com conversões reais)</SelectItem>
                    {datasets.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        📦 {d.nome} — {d.total_itens} itens ({d.positivos}+)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tamanho da amostra: <b>{amostra}</b></Label>
                <Slider value={[amostra]} min={10} max={100} step={5} onValueChange={([v]) => setAmostra(v)} />
              </div>
              <div>
                <Label>Janela de observação (dias): <b>{janela}</b></Label>
                <Slider value={[janela]} min={15} max={180} step={15} onValueChange={([v]) => setJanela(v)} />
              </div>
              <div>
                <Label>Threshold de decisão (ai_score ≥): <b>{threshold}</b></Label>
                <Slider value={[threshold]} min={0} max={100} step={5} onValueChange={([v]) => setThreshold(v)} />
              </div>
              <div>
                <Label>Batch size (afeta amostras de latência): <b>{batchSize}</b></Label>
                <Slider value={[batchSize]} min={3} max={20} step={1} onValueChange={([v]) => setBatchSize(v)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Operação</Label>
                  <Select value={operacao} onValueChange={setOperacao}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas</SelectItem>
                      <SelectItem value="Venda">Venda</SelectItem>
                      <SelectItem value="Aluguel">Aluguel</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Cidade</Label><Input value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Ex.: Brasília" /></div>
                <div><Label>Bairro</Label><Input value={bairro} onChange={(e) => setBairro(e.target.value)} /></div>
                <div><Label>Foco do corretor</Label><Input value={portfolio} onChange={(e) => setPortfolio(e.target.value)} placeholder="Ex.: 3q em Águas Claras" /></div>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium">Pesos dos critérios da IA (0–100)</p>
              <div><Label>Probabilidade: <b>{pProb}</b></Label><Slider value={[pProb]} min={0} max={100} step={5} onValueChange={([v]) => setPProb(v)} /></div>
              <div><Label>Urgência: <b>{pUrg}</b></Label><Slider value={[pUrg]} min={0} max={100} step={5} onValueChange={([v]) => setPUrg(v)} /></div>
              <div><Label>Perfil investidor: <b>{pInv}</b></Label><Slider value={[pInv]} min={0} max={100} step={5} onValueChange={([v]) => setPInv(v)} /></div>
              <div><Label>Ajuste de portfólio: <b>{pPort}</b></Label><Slider value={[pPort]} min={0} max={100} step={5} onValueChange={([v]) => setPPort(v)} /></div>

              <div className="flex flex-wrap items-end gap-2 pt-2">
                <div className="flex-1 min-w-[180px]">
                  <Label>Nome (para salvar)</Label>
                  <Input value={nomeRun} onChange={(e) => setNomeRun(e.target.value)} placeholder="Ex.: baseline v1" />
                </div>
                <Button onClick={() => runTeste(false)} disabled={loading || saving}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FlaskConical className="w-4 h-4 mr-2" />}
                  Rodar teste
                </Button>
                <Button variant="secondary" onClick={() => runTeste(true)} disabled={loading || saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  Rodar e salvar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {erroAmigavel && (
          <CalibracaoErrorAlert
            error={erroAmigavel}
            onRetry={() => runTeste(false)}
            onDismiss={() => setErroAmigavel(null)}
          />
        )}

        {result && (
          <>
            <div className="grid gap-3 md:grid-cols-4">
              <MetricCard icon={<Target className="w-4 h-4" />} label="Precision" value={pct(result.precision)} sub={`${result.tp}/${result.tp + result.fp} preditos certos`} />
              <MetricCard icon={<Activity className="w-4 h-4" />} label="Recall" value={pct(result.recall)} sub={`FNR ${pct(result.fnr)}`} />
              <MetricCard icon={<TrendingUp className="w-4 h-4" />} label="F1" value={pct(result.f1)} sub={`Accuracy ${pct(result.accuracy)}`} />
              <MetricCard icon={<Percent className="w-4 h-4" />} label="AUC (ROC)" value={result.auc.toFixed(3)} sub={`FPR ${pct(result.fpr)}`} />
              <MetricCard icon={<Target className="w-4 h-4" />} label="Conversão preditos" value={pct(result.conversao_preditos)} sub={`Geral ${pct(result.conversao_geral)} • Lift ${result.lift.toFixed(2)}x`} />
              <MetricCard icon={<Timer className="w-4 h-4" />} label="Latência média" value={`${result.latency_ms_avg} ms`} sub={`p50 ${result.latency_ms_p50} • total ${result.latency_ms_total} ms`} />
              <MetricCard icon={<Timer className="w-4 h-4" />} label="Latência p95" value={`${result.latency_ms_p95} ms`} sub={`em ${result.latency_batches} batches`} />
              <MetricCard icon={<Timer className="w-4 h-4" />} label="Latência p99" value={`${result.latency_ms_p99} ms`} sub={`batch size ${result.batch_size}`} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Curva por threshold</CardTitle>
                  {bestThreshold && <Badge variant="secondary">Melhor F1: {pct(bestThreshold.f1)} @ thr {bestThreshold.threshold}</Badge>}
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={result.threshold_sweep}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="threshold" />
                        <YAxis domain={[0, 1]} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
                        <Tooltip formatter={(v: any) => pct(Number(v))} />
                        <Legend />
                        <ReferenceLine x={result.threshold_ai} stroke="hsl(var(--primary))" strokeDasharray="3 3" label="atual" />
                        <Line type="monotone" dataKey="precision" stroke="#2563eb" dot={false} />
                        <Line type="monotone" dataKey="recall" stroke="#f97316" dot={false} />
                        <Line type="monotone" dataKey="f1" stroke="#16a34a" dot={false} />
                        <Line type="monotone" dataKey="fpr" stroke="#dc2626" dot={false} strokeDasharray="4 4" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Curva ROC</CardTitle>
                  <Badge variant="secondary">AUC {result.auc.toFixed(3)}</Badge>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={result.roc_curve}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" dataKey="fpr" domain={[0, 1]} tickFormatter={(v) => v.toFixed(1)} label={{ value: "FPR", position: "insideBottom", offset: -4 }} />
                        <YAxis type="number" domain={[0, 1]} tickFormatter={(v) => v.toFixed(1)} label={{ value: "TPR", angle: -90, position: "insideLeft" }} />
                        <Tooltip formatter={(v: any) => Number(v).toFixed(3)} />
                        <Area type="monotone" dataKey="tpr" stroke="#16a34a" fill="#16a34a" fillOpacity={0.15} />
                        <Line type="linear" data={[{ fpr: 0, tpr: 0 }, { fpr: 1, tpr: 1 }]} dataKey="tpr" stroke="#94a3b8" strokeDasharray="4 4" dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader><CardTitle className="text-base">Matriz de confusão (threshold {result.threshold_ai})</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2 max-w-md text-sm">
                  <div />
                  <div className="text-center font-medium">Real +</div>
                  <div className="text-center font-medium">Real −</div>
                  <div className="font-medium">Predito +</div>
                  <div className="bg-green-100 dark:bg-green-900/30 text-center rounded p-2">TP: {result.tp}</div>
                  <div className="bg-red-100 dark:bg-red-900/30 text-center rounded p-2">FP: {result.fp}</div>
                  <div className="font-medium">Predito −</div>
                  <div className="bg-amber-100 dark:bg-amber-900/30 text-center rounded p-2">FN: {result.fn}</div>
                  <div className="bg-slate-100 dark:bg-slate-800 text-center rounded p-2">TN: {result.tn}</div>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  Amostra: {result.amostra_total} • Modelo: {result.modelo || "-"} ({result.provider || "-"}) • Janela: {result.janela_dias} dias
                  {result.dataset ? ` • Dataset: ${result.dataset.nome}` : " • Fonte: histórico ao vivo"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Amostra avaliada</CardTitle></CardHeader>
              <CardContent className="overflow-auto max-h-[420px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Proprietário</TableHead>
                      <TableHead>Local</TableHead>
                      <TableHead>Op.</TableHead>
                      <TableHead className="text-right">Dor</TableHead>
                      <TableHead className="text-right">AI</TableHead>
                      <TableHead>Predito</TableHead>
                      <TableHead>Real</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.resultados_amostra.map((r, i) => (
                      <TableRow key={r.id || i}>
                        <TableCell className="max-w-[180px] truncate">{r.nome || "—"}</TableCell>
                        <TableCell className="text-xs">{[r.bairro, r.cidade].filter(Boolean).join(", ") || "—"}</TableCell>
                        <TableCell><Badge variant="outline">{r.operacao || "—"}</Badge></TableCell>
                        <TableCell className="text-right">{r.score_dor ?? 0}</TableCell>
                        <TableCell className="text-right font-medium">{r.ai_score ?? 0}</TableCell>
                        <TableCell><Badge variant={r.predito ? "default" : "secondary"}>{r.predito ? "SIM" : "não"}</Badge></TableCell>
                        <TableCell><Badge variant={r.real ? "default" : "outline"} className={r.real ? "bg-green-600" : ""}>{r.real ? "SIM" : "não"}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><History className="w-4 h-4" /> Histórico de calibrações</CardTitle>
            <p className="text-xs text-muted-foreground">Marque 2+ para comparar na aba Comparação.</p>
          </CardHeader>
          <CardContent>
            {historico.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma calibração salva ainda.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead className="text-right">N</TableHead>
                    <TableHead className="text-right">Thr</TableHead>
                    <TableHead className="text-right">Prec</TableHead>
                    <TableHead className="text-right">Rec</TableHead>
                    <TableHead className="text-right">F1</TableHead>
                    <TableHead className="text-right">FPR</TableHead>
                    <TableHead className="text-right">AUC</TableHead>
                    <TableHead className="text-right">Conv</TableHead>
                    <TableHead className="text-right">p95</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historico.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell><Checkbox checked={compareIds.includes(h.id)} onCheckedChange={(v) => {
                        setCompareIds((prev) => v ? [...prev, h.id] : prev.filter((x) => x !== h.id));
                      }} /></TableCell>
                      <TableCell className="text-xs">{new Date(h.criado_em).toLocaleString("pt-BR")}</TableCell>
                      <TableCell>{h.nome || "—"}</TableCell>
                      <TableCell className="text-right">{h.amostra_total}</TableCell>
                      <TableCell className="text-right">{h.threshold_ai}</TableCell>
                      <TableCell className="text-right">{pct(Number(h.precision_v || 0))}</TableCell>
                      <TableCell className="text-right">{pct(Number(h.recall_v || 0))}</TableCell>
                      <TableCell className="text-right font-medium">{pct(Number(h.f1_v || 0))}</TableCell>
                      <TableCell className="text-right">{pct(Number(h.fpr || 0))}</TableCell>
                      <TableCell className="text-right">{Number(h.auc || 0).toFixed(3)}</TableCell>
                      <TableCell className="text-right">{pct(Number(h.conversao_preditos || 0))}</TableCell>
                      <TableCell className="text-right">{h.latency_ms_p95 || "-"} ms</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* ===================== DATASETS ===================== */}
      <TabsContent value="datasets" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Camera className="w-5 h-5 text-primary" /> Novo dataset (snapshot do histórico)</CardTitle>
            <p className="text-sm text-muted-foreground">
              Captura {amostra} proprietários (janela de {janela} dias) e os respectivos labels reais em uma versão imutável.
              Depois é possível re-rodar a calibração no mesmo conjunto para comparar configurações.
            </p>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[240px]">
              <Label>Nome do dataset</Label>
              <Input value={nomeDataset} onChange={(e) => setNomeDataset(e.target.value)} placeholder="Ex.: DF Vendas Q3-2026" />
            </div>
            <Button onClick={snapshotDataset} disabled={snapping}>
              {snapping ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Camera className="w-4 h-4 mr-2" />}
              Criar snapshot
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Datasets salvos</CardTitle></CardHeader>
          <CardContent>
            {datasets.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum dataset ainda.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead className="text-right">Itens</TableHead>
                    <TableHead className="text-right">Positivos</TableHead>
                    <TableHead className="text-right">Base rate</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {datasets.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.nome}</TableCell>
                      <TableCell><Badge variant="outline">{d.origem}</Badge></TableCell>
                      <TableCell className="text-right">{d.total_itens}</TableCell>
                      <TableCell className="text-right">{d.positivos}</TableCell>
                      <TableCell className="text-right">{d.total_itens ? pct(d.positivos / d.total_itens) : "-"}</TableCell>
                      <TableCell className="text-xs">{new Date(d.criado_em).toLocaleString("pt-BR")}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => removerDataset(d.id)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* ===================== COMPARAÇÃO ===================== */}
      <TabsContent value="comparar" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><GitCompare className="w-5 h-5 text-primary" /> Comparação de runs</CardTitle>
            <p className="text-sm text-muted-foreground">
              Selecione runs no histórico (aba "Rodar teste") e clique em carregar para comparar métricas e ROC lado a lado.
            </p>
          </CardHeader>
          <CardContent>
            <Button onClick={carregarComparacao} disabled={compareIds.length < 2}>
              <GitCompare className="w-4 h-4 mr-2" /> Carregar {compareIds.length} runs
            </Button>
          </CardContent>
        </Card>

        {compareData.length >= 2 && (
          <>
            <Card>
              <CardHeader><CardTitle className="text-base">Métricas lado a lado</CardTitle></CardHeader>
              <CardContent className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Métrica</TableHead>
                      {compareData.map((r) => <TableHead key={r.id}>{r.nome || r.id.slice(0, 8)}</TableHead>)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[
                      ["Amostra", (r: any) => r.amostra_total],
                      ["Threshold", (r: any) => r.threshold_ai],
                      ["Precision", (r: any) => pct(Number(r.precision_v || 0))],
                      ["Recall", (r: any) => pct(Number(r.recall_v || 0))],
                      ["F1", (r: any) => pct(Number(r.f1_v || 0))],
                      ["Accuracy", (r: any) => pct(Number(r.accuracy_v || 0))],
                      ["FPR", (r: any) => pct(Number(r.fpr || 0))],
                      ["FNR", (r: any) => pct(Number(r.fnr || 0))],
                      ["AUC", (r: any) => Number(r.auc || 0).toFixed(3)],
                      ["Conv. preditos", (r: any) => pct(Number(r.conversao_preditos || 0))],
                      ["Lift", (r: any) => `${Number(r.lift || 0).toFixed(2)}x`],
                      ["Latência avg", (r: any) => `${r.latency_ms_avg || 0} ms`],
                      ["Latência p95", (r: any) => `${r.latency_ms_p95 || 0} ms`],
                      ["Latência p99", (r: any) => `${r.latency_ms_p99 || 0} ms`],
                    ].map(([label, fn]: any) => (
                      <TableRow key={label}>
                        <TableCell className="font-medium">{label}</TableCell>
                        {compareData.map((r) => <TableCell key={r.id}>{fn(r)}</TableCell>)}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Curvas ROC sobrepostas</CardTitle></CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={rocOverlay}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" dataKey="fpr" domain={[0, 1]} tickFormatter={(v) => v.toFixed(1)} label={{ value: "FPR", position: "insideBottom", offset: -4 }} />
                      <YAxis type="number" domain={[0, 1]} tickFormatter={(v) => v.toFixed(1)} label={{ value: "TPR", angle: -90, position: "insideLeft" }} />
                      <Tooltip formatter={(v: any) => Number(v).toFixed(3)} />
                      <Legend />
                      {compareData.map((r, i) => (
                        <Line key={r.id} type="monotone" dataKey={r.nome || r.id.slice(0, 6)} stroke={["#2563eb", "#16a34a", "#f97316", "#dc2626", "#a855f7", "#0891b2"][i % 6]} dot={false} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </TabsContent>
    </Tabs>
  );
}

function MetricCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
        <div className="text-2xl font-semibold mt-1">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}
