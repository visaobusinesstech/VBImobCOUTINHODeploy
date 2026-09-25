import { useState, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Rocket, Loader2, CheckCircle2, XCircle, Clock, Copy, StopCircle } from "lucide-react";
import { handleAiError } from "@/lib/ai/aiErrorHandler";
import { useNavigate } from "react-router-dom";

// Ordem alfabética das 33 Regiões Administrativas do DF
const REGIOES_ADMINISTRATIVAS_DF = [
  "Águas Claras", "Arniqueira", "Asa Norte", "Asa Sul", "Brazlândia",
  "Candangolândia", "Ceilândia", "Cruzeiro", "Estrutural", "Fercal",
  "Gama", "Guará", "Itapoã", "Jardim Botânico", "Lago Norte", "Lago Sul",
  "Noroeste", "Núcleo Bandeirante", "Octogonal", "Paranoá", "Park Way",
  "Planaltina", "Recanto das Emas", "Riacho Fundo", "Riacho Fundo II",
  "Samambaia", "Santa Maria", "São Sebastião", "Sobradinho", "Sobradinho II",
  "Sudoeste", "Taguatinga", "Varjão", "Vicente Pires",
] as const;

const OPERACOES = ["Venda", "Aluguel"] as const;

type SubExecStatus = "pendente" | "executando" | "sucesso" | "falha" | "cancelado";

type SubExecucao = {
  ra: string;
  operacao: (typeof OPERACOES)[number];
  status: SubExecStatus;
  inicio?: number;
  fim?: number;
  resultados?: number;
  erro?: string;
};

function statusIcon(s: SubExecStatus) {
  if (s === "executando") return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
  if (s === "sucesso") return <CheckCircle2 className="w-4 h-4 text-green-600" />;
  if (s === "falha") return <XCircle className="w-4 h-4 text-red-600" />;
  if (s === "cancelado") return <StopCircle className="w-4 h-4 text-orange-500" />;
  return <Clock className="w-4 h-4 text-muted-foreground" />;
}

function statusBadge(s: SubExecStatus) {
  const map: Record<SubExecStatus, string> = {
    pendente: "bg-muted text-muted-foreground",
    executando: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    sucesso: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    falha: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    cancelado: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  };
  return <Badge className={`text-[10px] ${map[s]}`}>{s}</Badge>;
}

export function ProcessamentoCompletoDFPanel({
  tipoImovel = "Apartamento",
}: {
  tipoImovel?: string;
}) {
  const { toast } = useToast();
  const navigate = useNavigate();

  const inicial: SubExecucao[] = useMemo(
    () =>
      REGIOES_ADMINISTRATIVAS_DF.flatMap((ra) =>
        OPERACOES.map((op) => ({ ra, operacao: op, status: "pendente" as SubExecStatus })),
      ),
    [],
  );

  const [subExecs, setSubExecs] = useState<SubExecucao[]>(inicial);
  const [rodando, setRodando] = useState(false);
  const [batchId, setBatchId] = useState<string | null>(null);
  const cancelarRef = useRef(false);

  const total = subExecs.length;
  const concluidas = subExecs.filter((s) => s.status !== "pendente" && s.status !== "executando").length;
  const sucessos = subExecs.filter((s) => s.status === "sucesso").length;
  const falhas = subExecs.filter((s) => s.status === "falha").length;
  const emAndamento = subExecs.find((s) => s.status === "executando");
  const progresso = total > 0 ? Math.round((concluidas / total) * 100) : 0;

  const iniciar = async () => {
    const novoBatch = crypto.randomUUID();
    setBatchId(novoBatch);
    setSubExecs(inicial);
    setRodando(true);
    cancelarRef.current = false;

    toast({
      title: "🚀 Processamento iniciado",
      description: `Batch ${novoBatch.slice(0, 8)} — ${total} execuções (${REGIOES_ADMINISTRATIVAS_DF.length} RAs × Venda/Aluguel)`,
    });

    let localSucessos = 0;
    let localFalhas = 0;
    let cancelado = false;

    for (let i = 0; i < inicial.length; i++) {
      if (cancelarRef.current) {
        cancelado = true;
        break;
      }

      const item = inicial[i];
      const inicio = Date.now();

      setSubExecs((prev) => {
        const next = [...prev];
        next[i] = { ...next[i], status: "executando", inicio };
        return next;
      });

      try {
        const { data, error } = await supabase.functions.invoke("captacao-inteligente", {
          body: {
            action: "buscar_oportunidades",
            params: {
              bairro: item.ra,
              cidade: "Brasília",
              estado: "DF",
              tipo_imovel: tipoImovel,
              operacao: item.operacao,
              apenas_proprietarios: true,
              batch_id: novoBatch,
              ra_nome: item.ra,
              batch_index: i + 1,
              batch_total: inicial.length,
            },
          },
        });

        const fim = Date.now();

        if (handleAiError(data, error, navigate)) {
          setRodando(false);
          return;
        }
        if (error) throw error;
        if (data?.error && !data?.error_code) throw new Error(data.error);

        const resultados = data?.data?.oportunidades?.length ?? 0;
        localSucessos++;
        setSubExecs((prev) => {
          const next = [...prev];
          next[i] = { ...next[i], status: "sucesso", inicio, fim, resultados };
          return next;
        });
      } catch (e: any) {
        const fim = Date.now();
        localFalhas++;
        setSubExecs((prev) => {
          const next = [...prev];
          next[i] = {
            ...next[i],
            status: "falha",
            inicio,
            fim,
            erro: e?.message?.slice(0, 240) || "Erro desconhecido",
          };
          return next;
        });
      }
    }

    if (cancelado) {
      setSubExecs((prev) =>
        prev.map((s) => (s.status === "pendente" ? { ...s, status: "cancelado" } : s)),
      );
      toast({ title: "Processamento cancelado", variant: "destructive" });
    } else {
      toast({
        title: "✅ Processamento completo",
        description: `${localSucessos} sucessos, ${localFalhas} falhas em ${total} execuções`,
      });
    }
    setRodando(false);
  };

  const copiarBatchId = () => {
    if (!batchId) return;
    navigator.clipboard.writeText(batchId);
    toast({ title: "Batch ID copiado" });
  };

  const fmtDur = (ini?: number, fim?: number) => {
    if (!ini || !fim) return "—";
    const s = Math.round((fim - ini) / 1000);
    return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
  };

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-transparent to-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Rocket className="w-5 h-5 text-primary" />
          Processamento Completo DF
          <Badge variant="outline" className="text-[10px] ml-2">
            {REGIOES_ADMINISTRATIVAS_DF.length} RAs × Venda/Aluguel = {total} execuções
          </Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Varre sequencialmente todas as Regiões Administrativas do DF em ordem alfabética,
          executando Venda e depois Aluguel para cada RA. Cada sub-execução é registrada no
          <strong> Histórico de Execuções</strong> agrupada por Batch ID.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {!rodando ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Rocket className="w-4 h-4" />
                  Iniciar Processamento Completo DF
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Iniciar processamento completo?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Serão feitas <strong>{total} chamadas</strong> à IA de captação
                    ({REGIOES_ADMINISTRATIVAS_DF.length} RAs × 2 operações). Isso pode consumir
                    créditos e levar vários minutos. O processo é sequencial e pode ser cancelado
                    a qualquer momento — sub-execuções pendentes ficam marcadas como
                    "cancelado".
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={iniciar}>Confirmar e iniciar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <Button size="sm" variant="destructive" onClick={() => { cancelarRef.current = true; }} className="gap-2">
              <StopCircle className="w-4 h-4" />
              Cancelar após a atual
            </Button>
          )}

          {batchId && (
            <Button size="sm" variant="outline" onClick={copiarBatchId} className="gap-2 text-xs">
              <Copy className="w-3 h-3" />
              Batch {batchId.slice(0, 8)}…
            </Button>
          )}
        </div>

        {(rodando || concluidas > 0) && (
          <>
            <div className="flex items-center gap-3">
              <Progress value={progresso} className="flex-1 h-2" />
              <span className="text-xs font-medium tabular-nums min-w-[3ch]">
                {concluidas}/{total}
              </span>
              <div className="flex gap-1">
                <Badge className="text-[10px] bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                  ✓ {sucessos}
                </Badge>
                {falhas > 0 && (
                  <Badge className="text-[10px] bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                    ✗ {falhas}
                  </Badge>
                )}
              </div>
            </div>

            {emAndamento && (
              <p className="text-xs text-muted-foreground animate-pulse">
                Executando: <strong>{emAndamento.ra}</strong> — {emAndamento.operacao}…
              </p>
            )}

            <ScrollArea className="h-72 rounded border bg-background/50">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                  <tr className="text-left">
                    <th className="px-2 py-1.5 w-8">#</th>
                    <th className="px-2 py-1.5">RA</th>
                    <th className="px-2 py-1.5">Operação</th>
                    <th className="px-2 py-1.5 w-24">Status</th>
                    <th className="px-2 py-1.5 w-20 text-right">Result.</th>
                    <th className="px-2 py-1.5 w-20 text-right">Duração</th>
                  </tr>
                </thead>
                <tbody>
                  {subExecs.map((s, i) => (
                    <tr key={`${s.ra}-${s.operacao}`} className="border-t hover:bg-muted/30">
                      <td className="px-2 py-1 text-muted-foreground tabular-nums">{i + 1}</td>
                      <td className="px-2 py-1 font-medium">{s.ra}</td>
                      <td className="px-2 py-1">
                        <Badge variant="outline" className="text-[10px]">
                          {s.operacao}
                        </Badge>
                      </td>
                      <td className="px-2 py-1">
                        <div className="flex items-center gap-1.5">
                          {statusIcon(s.status)}
                          {statusBadge(s.status)}
                        </div>
                        {s.erro && (
                          <div
                            className="text-[10px] text-red-600 dark:text-red-400 mt-0.5 truncate max-w-[240px]"
                            title={s.erro}
                          >
                            {s.erro}
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-1 text-right tabular-nums">
                        {s.resultados ?? (s.status === "sucesso" ? 0 : "—")}
                      </td>
                      <td className="px-2 py-1 text-right tabular-nums text-muted-foreground">
                        {fmtDur(s.inicio, s.fim)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>

            <p className="text-[10px] text-muted-foreground">
              Detalhes completos (parâmetros, portais consultados, timestamps do servidor) ficam
              disponíveis em <strong>Captação → Histórico de Execuções</strong>, filtrando por Batch ID.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
