import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Loader2, PlayCircle } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type Assertion = { name: string; pass: boolean; detail?: unknown };
type Report = {
  ok: boolean;
  started_at: string;
  finished_at?: string;
  scenarios?: Record<string, { status: number; body: any; ms: number }>;
  deltas?: { notified: number; escalated: number };
  assertions: Assertion[];
  cleanup?: string;
  error?: string;
};

export default function VerifyCaptacaoSlaPanel() {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    setLoading(true); setErr(null); setReport(null);
    try {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/verify-captacao-sla`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${ANON}` },
      });
      setReport(await r.json());
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const passed = report?.assertions.filter((a) => a.pass).length ?? 0;
  const total = report?.assertions.length ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Verificação SLA · captacao-pipeline-sla</span>
          {report && (
            <Badge variant={report.ok ? "default" : "destructive"}>
              {passed}/{total} checks
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-600">
          Executa dois cenários (sem dados e com dados semeados), valida os contadores
          <strong> notified/escalated</strong>, confirma inserção em <code>notifications</code>,
          gravação de <code>escalonado_em</code> e ausência de duplo escalonamento em reruns.
          Ao final os dados de teste são removidos.
        </p>

        <Button onClick={run} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
          {loading ? "Verificando..." : "Rodar verificação"}
        </Button>

        {err && <p className="text-sm text-red-600">{err}</p>}

        {report && (
          <div className="space-y-3">
            {report.deltas && (
              <div className="flex gap-4 text-sm">
                <span>Δ notified: <strong>{report.deltas.notified}</strong></span>
                <span>Δ escalated: <strong>{report.deltas.escalated}</strong></span>
                <span className="text-slate-500">cleanup: {report.cleanup}</span>
              </div>
            )}
            <ul className="space-y-1 text-sm">
              {report.assertions.map((a) => (
                <li key={a.name} className="flex items-start gap-2">
                  {a.pass
                    ? <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5" />
                    : <XCircle className="h-4 w-4 text-red-600 mt-0.5" />}
                  <div className="flex-1">
                    <div className="font-mono text-xs">{a.name}</div>
                    {a.detail != null && (
                      <div className="text-xs text-slate-500 font-mono">
                        {typeof a.detail === "string" ? a.detail : JSON.stringify(a.detail)}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {report.error && <p className="text-sm text-red-600">Erro: {report.error}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
