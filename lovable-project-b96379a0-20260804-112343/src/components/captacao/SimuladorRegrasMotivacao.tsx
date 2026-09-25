import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  SlidersHorizontal,
  RotateCcw,
  Save,
  RefreshCw,
  Loader2,
  ArrowRight,
} from "lucide-react";
import {
  useMotivacaoConfig,
  useSalvarMotivacaoConfig,
  MOTIVACAO_CONFIG_PADRAO,
  type MotivacaoConfig,
} from "@/hooks/useMotivacaoConfig";
import { useRecalcularMotivacao } from "@/hooks/useProprietariosQuentes";
import {
  simulateMotivacao,
  type MotivacaoInputs,
} from "@/lib/motivacaoSimulacao";

interface Props {
  input: MotivacaoInputs;
  scoreAtual?: number | null;
  nivelAtual?: string | null;
}

const NIVEL_STYLE: Record<string, string> = {
  fervendo: "bg-red-500 text-white",
  quente: "bg-orange-500 text-white",
  morno: "bg-yellow-500 text-white",
  frio: "bg-slate-400 text-white",
};

type NumKey = keyof Omit<MotivacaoConfig, "imobiliaria_id">;

const CAMPOS: {
  grupo: string;
  itens: { key: NumKey; label: string; hint?: string; min?: number; max?: number; step?: number }[];
}[] = [
  {
    grupo: "Tempo no mercado (dias → pontos)",
    itens: [
      { key: "dias_tier1", label: "Tier 1 (dias)", min: 1, max: 365 },
      { key: "bonus_tempo_tier1", label: "Pontos Tier 1", min: 0, max: 60 },
      { key: "dias_tier2", label: "Tier 2 (dias)", min: 1, max: 365 },
      { key: "bonus_tempo_tier2", label: "Pontos Tier 2", min: 0, max: 60 },
      { key: "dias_tier3", label: "Tier 3 (dias)", min: 1, max: 730 },
      { key: "bonus_tempo_tier3", label: "Pontos Tier 3", min: 0, max: 60 },
    ],
  },
  {
    grupo: "Queda de preço (% → pontos)",
    itens: [
      { key: "queda_tier1", label: "Queda Tier 1 (%)", min: 0, max: 50, step: 0.5 },
      { key: "bonus_queda_tier1", label: "Pontos Tier 1", min: 0, max: 60 },
      { key: "queda_tier2", label: "Queda Tier 2 (%)", min: 0, max: 60, step: 0.5 },
      { key: "bonus_queda_tier2", label: "Pontos Tier 2", min: 0, max: 60 },
    ],
  },
  {
    grupo: "Outros sinais",
    itens: [
      { key: "bonus_republicacao", label: "Pontos por republicação", min: 0, max: 40 },
      { key: "bonus_fsbo", label: "Pontos FSBO (direto do dono)", min: 0, max: 40 },
    ],
  },
  {
    grupo: "Limiares de nível",
    itens: [
      { key: "nivel_morno_min", label: "Morno ≥", min: 1, max: 99 },
      { key: "nivel_quente_min", label: "Quente ≥", min: 1, max: 99 },
      { key: "nivel_fervendo_min", label: "Fervendo ≥", min: 1, max: 100 },
    ],
  },
];

export function SimuladorRegrasMotivacao({ input, scoreAtual, nivelAtual }: Props) {
  const { data: cfgAtual } = useMotivacaoConfig();
  const salvar = useSalvarMotivacaoConfig();
  const recalcular = useRecalcularMotivacao();
  const [rascunho, setRascunho] = useState<MotivacaoConfig | null>(null);

  const cfgBase: MotivacaoConfig | null = cfgAtual ?? null;
  const cfgEdit: MotivacaoConfig | null = rascunho ?? cfgBase;

  const previa = useMemo(() => {
    if (!cfgEdit) return null;
    return simulateMotivacao(input, cfgEdit);
  }, [input, cfgEdit]);

  const previaAtual = useMemo(() => {
    if (!cfgBase) return null;
    return simulateMotivacao(input, cfgBase);
  }, [input, cfgBase]);

  const dirty = useMemo(() => {
    if (!rascunho || !cfgBase) return false;
    return (Object.keys(MOTIVACAO_CONFIG_PADRAO) as NumKey[]).some(
      (k) => Number(rascunho[k]) !== Number(cfgBase[k]),
    );
  }, [rascunho, cfgBase]);

  if (!cfgEdit || !previa) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-muted-foreground text-center">
          Carregando configuração de motivação…
        </CardContent>
      </Card>
    );
  }

  const setCampo = (k: NumKey, v: number) => {
    setRascunho({ ...cfgEdit, [k]: v } as MotivacaoConfig);
  };

  const restaurarPadrao = () =>
    setRascunho({ ...cfgEdit, ...MOTIVACAO_CONFIG_PADRAO } as MotivacaoConfig);
  const descartar = () => setRascunho(null);

  const scoreBase = scoreAtual ?? previaAtual?.score ?? 0;
  const nivelBase = (nivelAtual ?? previaAtual?.nivel ?? "frio").toLowerCase();
  const delta = previa.score - scoreBase;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4" /> Simulador de regras
          {dirty && (
            <Badge variant="outline" className="ml-1 text-[10px]">
              editado (não salvo)
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Prévia */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border p-3">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Regras atuais
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-2xl font-bold">{scoreBase}</span>
              <Badge className={`${NIVEL_STYLE[nivelBase]} text-[10px]`}>
                {nivelBase.toUpperCase()}
              </Badge>
            </div>
          </div>
          <div className="rounded-lg border-2 border-primary/40 bg-primary/5 p-3">
            <div className="text-[11px] uppercase tracking-wide text-primary flex items-center gap-1">
              <ArrowRight className="h-3 w-3" /> Com regras simuladas
            </div>
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              <span className="text-2xl font-bold">{previa.score}</span>
              <Badge className={`${NIVEL_STYLE[previa.nivel]} text-[10px]`}>
                {previa.nivel.toUpperCase()}
              </Badge>
              {delta !== 0 && (
                <Badge
                  variant="secondary"
                  className={`text-[10px] ${
                    delta > 0 ? "text-emerald-700" : "text-red-700"
                  }`}
                >
                  {delta > 0 ? "+" : ""}
                  {delta} pts
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="text-xs text-muted-foreground grid grid-cols-4 gap-2">
          {(["tempo", "queda", "republicacao", "fsbo"] as const).map((k) => (
            <div key={k} className="rounded border p-2">
              <div className="capitalize text-[10px] text-muted-foreground">
                {k}
              </div>
              <div className="font-semibold">
                +{previa.sinais.bonus[k]} pts
              </div>
            </div>
          ))}
        </div>

        <Separator />

        {/* Editor */}
        <div className="space-y-4">
          {CAMPOS.map((g) => (
            <div key={g.grupo}>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                {g.grupo}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {g.itens.map((it) => (
                  <div key={it.key} className="space-y-1">
                    <Label htmlFor={`cfg-${it.key}`} className="text-xs">
                      {it.label}
                    </Label>
                    <Input
                      id={`cfg-${it.key}`}
                      type="number"
                      inputMode="decimal"
                      min={it.min}
                      max={it.max}
                      step={it.step ?? 1}
                      value={Number(cfgEdit[it.key] ?? 0)}
                      onChange={(e) =>
                        setCampo(it.key, Number(e.target.value) || 0)
                      }
                      className="h-8"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <Alert>
          <AlertDescription className="text-xs">
            A prévia acima é calculada localmente no navegador (mesma fórmula do
            banco). Ela <b>não</b> altera nada até você aplicar. "Aplicar a toda
            base" salva os parâmetros e recalcula o score de todos os
            proprietários da sua conta.
          </AlertDescription>
        </Alert>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={descartar}
            disabled={!dirty}
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Descartar edição
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={restaurarPadrao}
          >
            Restaurar padrões
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => recalcular.mutate()}
            disabled={recalcular.isPending}
          >
            {recalcular.isPending ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            )}
            Recalcular com regras atuais
          </Button>
          <Button
            size="sm"
            onClick={() => rascunho && salvar.mutate(rascunho)}
            disabled={!dirty || salvar.isPending}
          >
            {salvar.isPending ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5 mr-1.5" />
            )}
            Aplicar a toda base
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
