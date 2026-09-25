import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, AlertTriangle, CheckCircle2, Copy, Check } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Scatter, ScatterChart, ZAxis, Cell,
} from "recharts";
import { calcularAvaliacao, type ResultadoAvaliacao } from "@/lib/avaliacao/engine";
import type { WizardState } from "./types";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { parseIaResponse } from "@/lib/avaliacao/iaSchema";
import { newRequestId, readRequestId, logClientEvent } from "@/lib/requestId";

interface Props {
  state: WizardState;
  onResult: (r: ResultadoAvaliacao) => void;
  onIA: (ia: NonNullable<WizardState["iaAnalise"]>) => void;
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const fmtM2 = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

export function Step4Resultado({ state, onResult, onIA }: Props) {
  const { toast } = useToast();
  const [analisando, setAnalisando] = useState(false);
  const [lastRequestId, setLastRequestId] = useState<string | null>(null);
  const [lastStatus, setLastStatus] = useState<"ok" | "error" | null>(null);
  const [copied, setCopied] = useState(false);

  const copyRequestId = async () => {
    if (!lastRequestId) return;
    try {
      await navigator.clipboard.writeText(lastRequestId);
      setCopied(true);
      toast({ title: "ID copiado", description: lastRequestId });
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: "Não foi possível copiar", variant: "destructive" });
    }
  };

  const area = Number(state.imovel.area_construida) || Number(state.imovel.area_terreno) || 0;

  const resultado = useMemo(
    () => calcularAvaliacao(state.comparaveis, state.fatores, area),
    [state.comparaveis, state.fatores, area],
  );

  useMemo(() => onResult(resultado), [resultado]); // eslint-disable-line react-hooks/exhaustive-deps

  const chartData = resultado.comparaveis.map((c, i) => ({
    name: `#${i + 1}`,
    bruto: Math.round(c.preco_m2_bruto),
    homogeneizado: Math.round(c.preco_m2_homogeneizado),
  }));

  const scatterData = resultado.comparaveis.map((c, i) => ({
    x: i + 1,
    y: Math.round(c.preco_m2_homogeneizado),
  }));

  const qualidadeColor =
    resultado.qualidade.nivel === "rigoroso" ? "bg-emerald-600" :
    resultado.qualidade.nivel === "normal" ? "bg-blue-600" :
    resultado.qualidade.nivel === "expedito" ? "bg-amber-600" : "bg-destructive";

  const analisarIA = async () => {
    if (resultado.amostraValida < 1) {
      toast({ title: "Sem dados", description: "Adicione comparáveis para usar a IA.", variant: "destructive" });
      return;
    }
    const requestId = newRequestId("aval");
    const startedAt = performance.now();
    const FN = "avaliacao-wizard-ia";
    setLastRequestId(requestId);
    setLastStatus(null);
    logClientEvent(requestId, "info", FN, "invoke_started", {
      comparaveis: resultado.comparaveis.length,
      area,
    });
    setAnalisando(true);
    try {
      const { data, error, response } = (await supabase.functions.invoke(FN, {
        headers: { "x-request-id": requestId },
        body: {
          imovel: state.imovel,
          comparaveis: resultado.comparaveis,
          estatisticas: resultado.precoM2,
          valor_sugerido: resultado.valorFinal.sugerido,
          qualidade: resultado.qualidade,
          area,
        },
      })) as { data: any; error: any; response?: Response };
      const serverRequestId = readRequestId(response ?? null, requestId);
      setLastRequestId(serverRequestId);
      const duration_ms = Math.round(performance.now() - startedAt);
      if (error) {
        logClientEvent(serverRequestId, "error", FN, "invoke_failed", {
          duration_ms,
          error_name: error?.name,
          error: error?.message,
        });
        throw error;
      }

      const validation = parseIaResponse(data);
      if (!validation.ok) {
        logClientEvent(serverRequestId, "warn", FN, "invalid_response", {
          duration_ms,
          issues: validation.issues.slice(0, 3),
        });
        setLastStatus("error");
        toast({
          title: "Resposta da IA inválida",
          description:
            (validation.issues.slice(0, 2).join(" · ") ||
              "Formato inesperado — tente novamente.") +
            ` · ID: ${serverRequestId}`,
          variant: "destructive",
        });
        return;
      }

      const ia = {
        inconsistencias: validation.data.inconsistencias,
        suficiencia: validation.data.suficiencia,
        valor_sugerido_ia: validation.data.valor_sugerido_ia,
        fundamentacao: validation.data.fundamentacao,
        conclusao: validation.data.conclusao,
        gerado_em: new Date().toISOString(),
      };
      onIA(ia);
      logClientEvent(serverRequestId, "info", FN, "invoke_succeeded", {
        duration_ms,
        inconsistencias: ia.inconsistencias.length,
        has_valor_ia: typeof ia.valor_sugerido_ia === "number",
      });
      setLastStatus("ok");
      toast({ title: "Análise pronta", description: "Fundamentação e conclusão geradas pela IA." });
    } catch (e: any) {
      const duration_ms = Math.round(performance.now() - startedAt);
      logClientEvent(requestId, "error", FN, "invoke_exception", {
        duration_ms,
        error_name: e?.name,
        error: e?.message,
      });
      setLastStatus("error");
      toast({
        title: "Falha ao analisar",
        description: (e?.message || "Tente novamente em instantes.") + ` · ID: ${requestId}`,
        variant: "destructive",
      });
    } finally {
      setAnalisando(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Resumo de qualidade */}
      <div className={`rounded-md p-3 text-white ${qualidadeColor} flex items-start gap-3`}>
        {resultado.qualidade.nivel === "insuficiente" ? (
          <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
        ) : (
          <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0" />
        )}
        <div className="text-sm">
          <div className="font-semibold">{resultado.qualidade.mensagem}</div>
          {resultado.qualidade.alertas.length > 0 && (
            <ul className="mt-1 list-disc list-inside text-xs opacity-90">
              {resultado.qualidade.alertas.map((a, i) => <li key={i}>{a}</li>)}
            </ul>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Amostra válida" value={`${resultado.amostraValida} imóveis`} />
        <Kpi label="Preço médio /m²" value={fmtM2(resultado.precoM2.media)} />
        <Kpi label="Mediana /m²" value={fmtM2(resultado.precoM2.mediana)} accent />
        <Kpi label="Coef. variação" value={`${resultado.precoM2.coeficienteVariacao.toFixed(1)}%`} />
        <Kpi label="Mínimo /m²" value={fmtM2(resultado.precoM2.min)} />
        <Kpi label="Máximo /m²" value={fmtM2(resultado.precoM2.max)} />
        <Kpi label="Desvio padrão" value={fmtM2(resultado.precoM2.desvioPadrao)} />
        <Kpi label="IC 95% /m²" value={`${fmtM2(resultado.precoM2.intervaloConfianca.inferior)} — ${fmtM2(resultado.precoM2.intervaloConfianca.superior)}`} />
      </div>

      {/* Valor final */}
      <Card className="border-primary/50 bg-primary/5">
        <CardContent className="pt-5">
          <div className="text-xs text-muted-foreground uppercase">Valor final sugerido</div>
          <div className="text-3xl font-bold text-primary">{fmt(resultado.valorFinal.sugerido)}</div>
          <div className="text-xs text-muted-foreground mt-1">
            Intervalo IC 95%: <strong>{fmt(resultado.valorFinal.minimo)}</strong> — <strong>{fmt(resultado.valorFinal.maximo)}</strong>
          </div>
          <div className="text-xs text-muted-foreground">
            Área considerada: {area} m² · Preço de referência: {fmtM2(resultado.precoM2.mediana || resultado.precoM2.media)}/m²
          </div>
        </CardContent>
      </Card>

      {/* Gráficos */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs font-semibold mb-2">Preço /m² — bruto vs. homogeneizado</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(v: any) => fmtM2(Number(v))} />
                <Bar dataKey="bruto" fill="hsl(var(--muted-foreground))" />
                <Bar dataKey="homogeneizado" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs font-semibold mb-2">Dispersão dos comparáveis homogeneizados</div>
            <ResponsiveContainer width="100%" height={220}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="x" name="Comparável" />
                <YAxis dataKey="y" name="R$/m²" />
                <ZAxis range={[80, 80]} />
                <Tooltip formatter={(v: any) => fmtM2(Number(v))} />
                <ReferenceLine y={Math.round(resultado.precoM2.mediana)} stroke="hsl(var(--primary))" strokeDasharray="3 3" label="Mediana" />
                <Scatter data={scatterData} fill="hsl(var(--primary))">
                  {scatterData.map((_, i) => <Cell key={i} />)}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* IA */}
      <Card className="border-primary/30">
        <CardContent className="pt-5 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="font-semibold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" /> Assistente IA
              </div>
              <div className="text-xs text-muted-foreground">
                Análise da amostra + fundamentação técnica + conclusão para o laudo.
              </div>
            </div>
            <Button onClick={analisarIA} disabled={analisando} className="gap-2">
              {analisando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {analisando ? "Analisando..." : "Analisar com IA"}
            </Button>
          </div>

          {lastRequestId && (
            <div
              className={`flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs ${
                lastStatus === "error"
                  ? "border-destructive/40 bg-destructive/5"
                  : "border-muted bg-muted/30"
              }`}
            >
              <div className="min-w-0">
                <div className="text-[10px] uppercase text-muted-foreground">
                  ID da requisição (suporte)
                </div>
                <code className="font-mono text-xs break-all">{lastRequestId}</code>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={copyRequestId}
                className="gap-1 shrink-0"
                aria-label="Copiar ID da requisição"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copiado" : "Copiar"}
              </Button>
            </div>
          )}

          {state.iaAnalise && (
            <div className="space-y-3 text-sm">
              {state.iaAnalise.inconsistencias.length > 0 && (
                <div>
                  <Badge variant="destructive" className="mb-1">Inconsistências</Badge>
                  <ul className="list-disc list-inside text-xs space-y-0.5">
                    {state.iaAnalise.inconsistencias.map((i, idx) => <li key={idx}>{i}</li>)}
                  </ul>
                </div>
              )}
              {state.iaAnalise.suficiencia && (
                <div>
                  <Badge variant="outline" className="mb-1">Suficiência da amostra</Badge>
                  <p className="text-xs">{state.iaAnalise.suficiencia}</p>
                </div>
              )}
              {state.iaAnalise.valor_sugerido_ia ? (
                <div className="text-xs">
                  <Badge>Valor IA</Badge> <strong>{fmt(state.iaAnalise.valor_sugerido_ia)}</strong>
                </div>
              ) : null}
              {state.iaAnalise.fundamentacao && (
                <div>
                  <div className="text-xs font-semibold mb-1">Fundamentação técnica</div>
                  <p className="text-xs whitespace-pre-wrap text-muted-foreground">{state.iaAnalise.fundamentacao}</p>
                </div>
              )}
              {state.iaAnalise.conclusao && (
                <div>
                  <div className="text-xs font-semibold mb-1">Conclusão</div>
                  <p className="text-xs whitespace-pre-wrap text-muted-foreground">{state.iaAnalise.conclusao}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-md border p-3 ${accent ? "border-primary/40 bg-primary/5" : ""}`}>
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className={`font-semibold ${accent ? "text-primary" : ""}`}>{value}</div>
    </div>
  );
}
