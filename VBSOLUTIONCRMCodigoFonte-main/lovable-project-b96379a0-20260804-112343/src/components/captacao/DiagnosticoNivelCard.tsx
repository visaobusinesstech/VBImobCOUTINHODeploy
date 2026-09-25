import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, XCircle, TrendingUp } from "lucide-react";
import type { MotivacaoConfig } from "@/hooks/useMotivacaoConfig";
import {
  diagnosticarSinais,
  simulateMotivacao,
  type MotivacaoInputs,
} from "@/lib/motivacaoSimulacao";

interface Props {
  input: MotivacaoInputs;
  config: MotivacaoConfig;
  scoreAtual?: number | null;
  nivelAtual?: string | null;
}

const NIVEL_STYLE: Record<string, string> = {
  fervendo: "bg-red-500 text-white",
  quente: "bg-orange-500 text-white",
  morno: "bg-yellow-500 text-white",
  frio: "bg-slate-400 text-white",
};

export function DiagnosticoNivelCard({
  input,
  config,
  scoreAtual,
  nivelAtual,
}: Props) {
  const sim = simulateMotivacao(input, config);
  const { diag, proxNivel, pontosFaltantes } = diagnosticarSinais(sim, config);
  const nivel = (nivelAtual ?? sim.nivel) as
    | "frio"
    | "morno"
    | "quente"
    | "fervendo";
  const score = scoreAtual ?? sim.score;

  const faltantes = diag.filter((d) => !d.presente);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          Por que este proprietário está{" "}
          <Badge className={`${NIVEL_STYLE[nivel]} text-xs px-2`}>
            {nivel.toUpperCase()}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {proxNivel ? (
          <div className="rounded-md border bg-muted/40 p-3 flex items-start gap-2">
            <TrendingUp className="h-4 w-4 mt-0.5 text-primary shrink-0" />
            <div>
              <b>{score} pts</b> hoje. Faltam{" "}
              <b className="text-primary">{pontosFaltantes} pts</b> para virar{" "}
              <Badge className={`${NIVEL_STYLE[proxNivel.nome]} text-[10px]`}>
                {proxNivel.nome.toUpperCase()}
              </Badge>{" "}
              (limite: {proxNivel.min} pts).
            </div>
          </div>
        ) : (
          <div className="rounded-md border bg-emerald-50 text-emerald-900 p-3 flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 mt-0.5" />
            Este proprietário já está no nível máximo.
          </div>
        )}

        {faltantes.length === 0 ? (
          <p className="text-muted-foreground">
            Todos os sinais monitorados estão presentes — score é limitado
            apenas pelos pesos configurados.
          </p>
        ) : (
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Sinais ausentes ou fracos
            </div>
            {faltantes.map((f) => (
              <div
                key={f.key}
                className="rounded-md border p-2.5 flex items-start gap-2"
              >
                <XCircle className="h-4 w-4 mt-0.5 text-red-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="font-medium">{f.label}</div>
                    <span className="text-xs text-muted-foreground">
                      atual: <b className="text-foreground">{f.valorAtual}</b>
                    </span>
                  </div>
                  {f.motivo && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {f.motivo}
                    </div>
                  )}
                  {f.proximoPatamar && f.ganhoAdicional ? (
                    <div className="text-xs mt-1">
                      💡 Ao atingir <b>{f.proximoPatamar}</b>, ganha{" "}
                      <b className="text-emerald-600">
                        +{f.ganhoAdicional} pts
                      </b>
                      .
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="pt-1">
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
            Sinais presentes
          </div>
          <div className="flex flex-wrap gap-1.5">
            {diag
              .filter((d) => d.presente)
              .map((d) => (
                <Badge
                  key={d.key}
                  variant="secondary"
                  className="text-[11px] gap-1"
                >
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                  {d.label}: {d.valorAtual}
                </Badge>
              ))}
            {diag.filter((d) => d.presente).length === 0 && (
              <span className="text-xs text-muted-foreground">
                Nenhum sinal contribuindo ainda.
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
