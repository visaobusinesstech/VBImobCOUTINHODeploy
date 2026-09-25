import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2, XCircle, AlertTriangle, MinusCircle, Loader2, PlayCircle, Download } from "lucide-react";
import PreviewAuthPanel from "@/components/dev/PreviewAuthPanel";
import VerifyCaptacaoSlaPanel from "@/components/dev/VerifyCaptacaoSlaPanel";
import VerifySlaScheduleHistoryPanel from "@/components/dev/VerifySlaScheduleHistoryPanel";
import MatchingFallbackAuditPanel from "@/components/dev/MatchingFallbackAuditPanel";

type Step = {
  id: string; label: string; fase: string;
  status: "ok" | "warn" | "fail" | "skip";
  duracao_ms: number; detalhe?: string; erro?: string; hint?: string;
};
type Report = {
  executado_em: string; duracao_total_ms: number;
  resumo: { total: number; ok: number; warn: number; fail: number; skip: number };
  fases: Record<string, Step[]>;
  falhas_detalhadas: { id: string; label: string; fase: string; erro?: string; hint?: string; detalhe?: string }[];
  alertas: { id: string; label: string; erro?: string; hint?: string }[];
  passou: boolean;
  erro_fatal?: string;
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const statusIcon = (s: Step["status"]) => {
  if (s === "ok") return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  if (s === "fail") return <XCircle className="h-4 w-4 text-red-600" />;
  if (s === "warn") return <AlertTriangle className="h-4 w-4 text-amber-600" />;
  return <MinusCircle className="h-4 w-4 text-slate-400" />;
};

const faseLabel: Record<string, string> = {
  infra: "Infraestrutura & Schema",
  busca: "1. Busca (Firecrawl)",
  filtro_ia: "2. Filtro IA",
  analise_proprietario: "3. Análise do Proprietário",
};

export default function DiagnosticoCaptacao() {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const run = async () => {
    setLoading(true); setErrorMsg(null); setReport(null);
    try {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/e2e-captacao-diagnostico`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${ANON}` },
      });
      const json = (await r.json()) as Report;
      setReport(json);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const downloadJson = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `diagnostico-captacao-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Diagnóstico E2E · Captação</h1>
        <p className="text-slate-600">
          Executa uma verificação de ponta a ponta do fluxo{" "}
          <strong>busca → filtro IA → análise do proprietário</strong>, incluindo secrets, schema
          do banco, deploy das edge functions e conectividade Firecrawl/AI Gateway. Não requer login.
        </p>
      </header>

      <PreviewAuthPanel />
      <VerifyCaptacaoSlaPanel />
      <VerifySlaScheduleHistoryPanel />
      <MatchingFallbackAuditPanel />





      <div className="flex gap-3">
        <Button onClick={run} disabled={loading} size="lg">
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
          {loading ? "Executando testes..." : "Executar diagnóstico E2E"}
        </Button>
        {report && (
          <Button variant="outline" onClick={downloadJson}>
            <Download className="mr-2 h-4 w-4" /> Baixar relatório
          </Button>
        )}
      </div>

      {errorMsg && (
        <Alert variant="destructive">
          <AlertTitle>Erro ao chamar a função</AlertTitle>
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      {report?.erro_fatal && (
        <Alert variant="destructive">
          <AlertTitle>Erro fatal no diagnóstico</AlertTitle>
          <AlertDescription>{report.erro_fatal}</AlertDescription>
        </Alert>
      )}

      {report && !report.erro_fatal && (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between">
                <span>Resumo</span>
                <Badge variant={report.passou ? "default" : "destructive"}>
                  {report.passou ? "PASSOU" : "FALHOU"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-3 text-center">
                <Stat n={report.resumo.total} label="Total" />
                <Stat n={report.resumo.ok} label="OK" tone="emerald" />
                <Stat n={report.resumo.warn} label="Alertas" tone="amber" />
                <Stat n={report.resumo.fail} label="Falhas" tone="red" />
                <Stat n={report.resumo.skip} label="Skip" tone="slate" />
              </div>
              <p className="mt-3 text-sm text-slate-500">
                Executado em {new Date(report.executado_em).toLocaleString("pt-BR")} · {report.duracao_total_ms} ms
              </p>
            </CardContent>
          </Card>

          {report.falhas_detalhadas.length > 0 && (
            <Card className="border-red-200">
              <CardHeader><CardTitle className="text-red-700">Falhas detalhadas</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {report.falhas_detalhadas.map((f) => (
                  <div key={f.id} className="rounded-md border border-red-200 bg-red-50 p-3">
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-red-800">{f.label}</div>
                      <Badge variant="outline" className="text-xs">{f.fase}</Badge>
                    </div>
                    {f.detalhe && <div className="mt-1 text-xs text-red-700">{f.detalhe}</div>}
                    {f.erro && (
                      <pre className="mt-2 max-h-40 overflow-auto rounded bg-red-100 p-2 text-xs text-red-900">
                        {f.erro}
                      </pre>
                    )}
                    {f.hint && <div className="mt-2 text-sm text-red-900"><strong>Como corrigir:</strong> {f.hint}</div>}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {Object.entries(report.fases).map(([fase, steps]) => (
            <Card key={fase}>
              <CardHeader className="pb-3"><CardTitle className="text-base">{faseLabel[fase] ?? fase}</CardTitle></CardHeader>
              <CardContent className="divide-y">
                {steps.map((s) => (
                  <div key={s.id} className="flex items-start gap-3 py-2.5">
                    <div className="mt-0.5">{statusIcon(s.status)}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium truncate">{s.label}</span>
                        <span className="shrink-0 text-xs text-slate-500">{s.duracao_ms} ms</span>
                      </div>
                      {s.detalhe && <div className="text-xs text-slate-600">{s.detalhe}</div>}
                      {s.erro && <div className="mt-1 text-xs text-red-700">{s.erro}</div>}
                      {s.hint && <div className="mt-1 text-xs text-slate-500">💡 {s.hint}</div>}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}

function Stat({ n, label, tone = "slate" }: { n: number; label: string; tone?: "slate" | "emerald" | "amber" | "red" }) {
  const map = {
    slate: "text-slate-700", emerald: "text-emerald-700",
    amber: "text-amber-700", red: "text-red-700",
  } as const;
  return (
    <div className="rounded-md border p-3">
      <div className={`text-2xl font-semibold ${map[tone]}`}>{n}</div>
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  );
}
