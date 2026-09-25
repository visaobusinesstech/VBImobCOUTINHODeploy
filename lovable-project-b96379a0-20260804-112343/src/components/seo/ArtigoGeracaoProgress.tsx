import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, AlertTriangle, FileText, Search, PenLine, Sparkles, Save } from "lucide-react";

export type StageKey = "preparando" | "pesquisando" | "redigindo" | "otimizando" | "salvando" | "concluido";

export interface GeracaoState {
  open: boolean;
  stage: StageKey;
  startedAt: number | null;
  error: string | null;
  titulo?: string;
}

const STAGES: { key: StageKey; label: string; icon: any; etaSec: number }[] = [
  { key: "preparando", label: "Preparando contexto", icon: FileText, etaSec: 3 },
  { key: "pesquisando", label: "Pesquisando referências", icon: Search, etaSec: 15 },
  { key: "redigindo", label: "Redigindo o artigo", icon: PenLine, etaSec: 45 },
  { key: "otimizando", label: "Otimizando SEO", icon: Sparkles, etaSec: 8 },
  { key: "salvando", label: "Salvando rascunho", icon: Save, etaSec: 4 },
];
const TOTAL_ETA = STAGES.reduce((a, s) => a + s.etaSec, 0);

export function friendlyError(msg: string): { title: string; hint: string } {
  const m = (msg || "").toLowerCase();
  if (m.includes("429") || m.includes("rate") || m.includes("limit")) {
    return { title: "Limite de uso da IA atingido", hint: "Aguarde alguns minutos e tente novamente, ou conecte sua própria chave em Configurar IA." };
  }
  if (m.includes("timeout") || m.includes("time out") || m.includes("aborted")) {
    return { title: "A geração demorou demais", hint: "A IA levou mais tempo que o esperado. Tente novamente — geralmente resolve." };
  }
  if (m.includes("network") || m.includes("failed to fetch")) {
    return { title: "Falha de conexão", hint: "Verifique sua internet e tente novamente." };
  }
  if (m.includes("401") || m.includes("unauthor")) {
    return { title: "Sessão expirada", hint: "Faça login novamente para continuar." };
  }
  if (m.includes("quota") || m.includes("credit")) {
    return { title: "Créditos de IA insuficientes", hint: "Recarregue seus créditos ou conecte sua chave própria em Configurar IA." };
  }
  if (m.includes("json") || m.includes("parse")) {
    return { title: "Resposta da IA em formato inesperado", hint: "Tente novamente. Se persistir, reduza o escopo do tema." };
  }
  return { title: "Não foi possível gerar o artigo", hint: msg || "Tente novamente em instantes." };
}

interface Props {
  state: GeracaoState;
  onClose: () => void;
  onRetry?: () => void;
}

export default function ArtigoGeracaoProgress({ state, onClose, onRetry }: Props) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!state.open || !state.startedAt || state.error || state.stage === "concluido") return;
    const t = setInterval(() => {
      setElapsed(Math.floor((Date.now() - (state.startedAt as number)) / 1000));
    }, 500);
    return () => clearInterval(t);
  }, [state.open, state.startedAt, state.error, state.stage]);

  useEffect(() => {
    if (state.open && state.startedAt) setElapsed(Math.floor((Date.now() - state.startedAt) / 1000));
  }, [state.open, state.startedAt]);

  const currentIdx = STAGES.findIndex((s) => s.key === state.stage);
  const isDone = state.stage === "concluido";
  const progress = isDone
    ? 100
    : state.error
    ? Math.max(5, ((currentIdx + 1) / STAGES.length) * 100 - 10)
    : Math.min(95, ((currentIdx + 0.5) / STAGES.length) * 100);
  const etaRestante = Math.max(0, TOTAL_ETA - elapsed);

  return (
    <Dialog open={state.open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {state.error ? (
              <><AlertTriangle className="w-5 h-5 text-destructive" /> Ops, algo deu errado</>
            ) : isDone ? (
              <><CheckCircle2 className="w-5 h-5 text-green-600" /> Artigo salvo como rascunho</>
            ) : (
              <><Loader2 className="w-5 h-5 animate-spin" /> Gerando artigo completo</>
            )}
          </DialogTitle>
          <DialogDescription className="line-clamp-2">
            {state.titulo || "Pipeline de geração de conteúdo com IA"}
          </DialogDescription>
        </DialogHeader>

        {state.error ? (
          <div className="space-y-3">
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
              <p className="font-medium text-sm">{friendlyError(state.error).title}</p>
              <p className="text-xs text-muted-foreground mt-1">{friendlyError(state.error).hint}</p>
            </div>
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">Detalhes técnicos</summary>
              <pre className="mt-2 whitespace-pre-wrap break-words bg-muted p-2 rounded">{state.error}</pre>
            </details>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Progress value={progress} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
                <span>{elapsed}s decorridos</span>
                <span>{isDone ? "Concluído" : `~${etaRestante}s restantes`}</span>
              </div>
            </div>

            <ol className="space-y-2">
              {STAGES.map((s, i) => {
                const done = isDone || i < currentIdx;
                const active = !isDone && i === currentIdx;
                const Icon = s.icon;
                return (
                  <li key={s.key} className="flex items-center gap-2.5 text-sm">
                    <span className={`inline-flex w-6 h-6 items-center justify-center rounded-full border ${done ? "bg-green-600 border-green-600 text-white" : active ? "border-primary text-primary" : "border-muted text-muted-foreground"}`}>
                      {done ? <CheckCircle2 className="w-4 h-4" /> : active ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />}
                    </span>
                    <span className={active ? "font-medium" : done ? "text-muted-foreground line-through" : "text-muted-foreground"}>
                      {s.label}
                    </span>
                  </li>
                );
              })}
            </ol>

            {!isDone && (
              <p className="text-xs text-muted-foreground">
                Você pode fechar esta janela — o processo continua em segundo plano.
              </p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {state.error && onRetry && (
            <Button variant="default" onClick={onRetry}>Tentar novamente</Button>
          )}
          <Button variant={state.error || isDone ? "default" : "outline"} onClick={onClose}>
            {isDone ? "Fechar" : state.error ? "Fechar" : "Ocultar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
