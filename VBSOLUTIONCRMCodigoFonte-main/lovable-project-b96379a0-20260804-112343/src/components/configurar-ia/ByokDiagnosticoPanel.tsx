import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertTriangle, Activity, Clock, Cpu, Search, ShieldCheck, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";

export type LastTestResult = {
  status: "success" | "error";
  message?: string;
  model?: string;
  checkedAt: string;
} | null;

export interface ByokDiagnosticoPanelProps {
  provider: string;
  providerLabel: string;
  model?: string;
  apiKeyPresent: boolean;
  serperKeyPresent: boolean;
  isByokActive: boolean;
  hasSaved: boolean;
  updatedAt?: string | null;
  lastTest: LastTestResult;
  lastSerperTest: LastTestResult;
  chainStatus: null | {
    ok: boolean;
    activeModel?: string;
    preferredModel?: string;
    fallbackUsed?: boolean;
    chain?: string[];
    message?: string;
    checkedAt?: string;
  };
  byokInvalidFlag?: boolean;
}

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR");
  } catch {
    return "—";
  }
}

function StatusPill({ tone, label }: { tone: "ok" | "warn" | "err" | "neutral"; label: string }) {
  const styles = {
    ok: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-400",
    warn: "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400",
    err: "bg-destructive/10 text-destructive border-destructive/30",
    neutral: "bg-muted text-muted-foreground border-border/60",
  }[tone];
  return (
    <Badge variant="outline" className={cn("gap-1 font-semibold text-[11px]", styles)}>
      {tone === "ok" && <CheckCircle2 className="w-3 h-3" />}
      {tone === "warn" && <AlertTriangle className="w-3 h-3" />}
      {tone === "err" && <XCircle className="w-3 h-3" />}
      {label}
    </Badge>
  );
}

export function ByokDiagnosticoPanel(props: ByokDiagnosticoPanelProps) {
  const {
    providerLabel, model, apiKeyPresent, serperKeyPresent, isByokActive,
    hasSaved, updatedAt, lastTest, lastSerperTest, chainStatus, byokInvalidFlag,
  } = props;

  // Overall status
  let overall: { tone: "ok" | "warn" | "err"; label: string; detail: string };
  if (!hasSaved) {
    overall = { tone: "warn", label: "Não configurado", detail: "Salve suas chaves para ativar a IA." };
  } else if (!isByokActive) {
    overall = { tone: "warn", label: "Usando créditos da plataforma", detail: "Modo BYOK desligado — Lovable AI Gateway em uso." };
  } else if (!apiKeyPresent) {
    overall = { tone: "err", label: "Chave ausente", detail: `Nenhuma chave cadastrada para ${providerLabel}.` };
  } else if (byokInvalidFlag) {
    overall = { tone: "err", label: "Chave inválida ou expirada", detail: "A última chamada de IA falhou por autenticação. Refaça o teste." };
  } else if (lastTest?.status === "error") {
    overall = { tone: "err", label: "Último teste falhou", detail: lastTest.message || "Falha na chamada." };
  } else if (lastTest?.status === "success") {
    overall = { tone: "ok", label: "Conectado", detail: `Chave validada em ${formatDate(lastTest.checkedAt)}.` };
  } else {
    overall = { tone: "warn", label: "Nunca testado", detail: 'Clique em "Testar" ao lado da chave para validar.' };
  }

  const rows: Array<{ icon: React.ReactNode; title: string; value: React.ReactNode; sub?: string }> = [
    {
      icon: <Cpu className="w-4 h-4 text-primary" />,
      title: "Provedor ativo",
      value: <span className="font-semibold">{providerLabel}</span>,
      sub: isByokActive ? "Modo BYOK ativo" : "BYOK desativado (usando plataforma)",
    },
    {
      icon: <KeyRound className="w-4 h-4 text-primary" />,
      title: "Chave da IA",
      value: apiKeyPresent
        ? <StatusPill tone={byokInvalidFlag ? "err" : "ok"} label={byokInvalidFlag ? "Inválida" : "Presente"} />
        : <StatusPill tone="err" label="Ausente" />,
      sub: `Modelo: ${model || "—"}`,
    },
    {
      icon: <Search className="w-4 h-4 text-primary" />,
      title: "Chave Serper",
      value: serperKeyPresent
        ? <StatusPill tone={lastSerperTest?.status === "error" ? "err" : "ok"} label={lastSerperTest?.status === "error" ? "Falha no teste" : "Presente"} />
        : <StatusPill tone="warn" label="Opcional" />,
      sub: lastSerperTest ? `Último teste: ${formatDate(lastSerperTest.checkedAt)}` : "Sem testes recentes",
    },
    {
      icon: <Activity className="w-4 h-4 text-primary" />,
      title: "Último teste (IA)",
      value: lastTest
        ? <StatusPill tone={lastTest.status === "success" ? "ok" : "err"} label={lastTest.status === "success" ? "OK" : "Falhou"} />
        : <StatusPill tone="neutral" label="Nunca" />,
      sub: lastTest ? (lastTest.message || "").slice(0, 90) || formatDate(lastTest.checkedAt) : "—",
    },
    {
      icon: <ShieldCheck className="w-4 h-4 text-primary" />,
      title: "Cadeia de modelos",
      value: chainStatus
        ? <StatusPill
            tone={chainStatus.ok ? (chainStatus.fallbackUsed ? "warn" : "ok") : "err"}
            label={chainStatus.ok ? (chainStatus.fallbackUsed ? "Fallback ativo" : "Preferido OK") : "Indisponível"}
          />
        : <StatusPill tone="neutral" label="Não testada" />,
      sub: chainStatus?.activeModel ? `Ativo: ${chainStatus.activeModel}` : "—",
    },
    {
      icon: <Clock className="w-4 h-4 text-primary" />,
      title: "Última atualização",
      value: <span className="text-sm">{formatDate(updatedAt)}</span>,
      sub: hasSaved ? "Configuração salva" : "Nunca salva",
    },
  ];

  return (
    <Card className="border-border/60 shadow-sm overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Diagnóstico da configuração
          </CardTitle>
          <StatusPill tone={overall.tone} label={overall.label} />
        </div>
        <p className="text-xs text-muted-foreground mt-1">{overall.detail}</p>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {rows.map((r, i) => (
            <div key={i} className="rounded-lg border border-border/60 bg-muted/20 p-3">
              <div className="flex items-center gap-2 mb-1">
                {r.icon}
                <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{r.title}</span>
              </div>
              <div className="flex items-center gap-2 mb-1">{r.value}</div>
              {r.sub && <p className="text-[11px] text-muted-foreground line-clamp-2">{r.sub}</p>}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
