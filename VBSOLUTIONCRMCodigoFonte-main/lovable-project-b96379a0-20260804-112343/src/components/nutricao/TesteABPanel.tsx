import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Crown, FlaskConical, RotateCcw, Trophy } from "lucide-react";
import { calcularResultadosAB, type ResultadoAB, type EstatisticaVariante } from "@/lib/nutricaoAbTest";
import type { NutricaoEnvio, NutricaoEtapa, NutricaoFluxo } from "@/hooks/useNutricao";
import type { NutricaoEvento } from "@/hooks/useNutricaoMetricas";

interface Props {
  fluxos: NutricaoFluxo[];
  etapas: NutricaoEtapa[];
  envios: NutricaoEnvio[];
  eventos: NutricaoEvento[];
  onAplicarVencedor: (etapaId: string, vencedor: "A" | "B") => void;
  onReabrir: (etapaId: string) => void;
}

const perc = (v: number) => `${v.toFixed(1)}%`;

function ColunaVariante({
  stats,
  destaque,
  onAplicar,
}: {
  stats: EstatisticaVariante;
  destaque: boolean;
  onAplicar?: () => void;
}) {
  return (
    <div className={`space-y-2 rounded-md border p-3 ${destaque ? "border-primary bg-primary/5" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant={destaque ? "default" : "outline"}>Variante {stats.variante}</Badge>
          {destaque && <Trophy className="h-4 w-4 text-primary" />}
        </div>
        <span className="text-xs text-muted-foreground">{stats.enviados || stats.envios} envios</span>
      </div>
      <p className="text-sm font-medium">{stats.titulo || "Sem título"}</p>
      <p className="line-clamp-3 text-xs text-muted-foreground">{stats.mensagem || "Mensagem não definida"}</p>
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Taxa de resposta</span>
          <span className="font-semibold">{perc(stats.taxaResposta)}</span>
        </div>
        <Progress value={Math.min(100, stats.taxaResposta)} className="h-1.5" />
      </div>
      <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
        <span>Respostas: {stats.respostas}</span>
        <span>Cliques: {stats.cliques}</span>
        <span>Agendamentos: {stats.agendamentos}</span>
        <span>Fechamentos: {stats.fechamentos}</span>
      </div>
      {onAplicar && (
        <Button size="sm" variant="outline" className="w-full" onClick={onAplicar}>
          <Crown className="mr-1 h-4 w-4" /> Usar variante {stats.variante}
        </Button>
      )}
    </div>
  );
}

export function TesteABPanel({ fluxos, etapas, envios, eventos, onAplicarVencedor, onReabrir }: Props) {
  const resultados = useMemo(
    () => calcularResultadosAB(etapas, envios, eventos),
    [etapas, envios, eventos],
  );

  const porFluxo = useMemo(() => {
    const map = new Map<string, ResultadoAB[]>();
    resultados.forEach((r) => {
      map.set(r.fluxo_id, [...(map.get(r.fluxo_id) ?? []), r]);
    });
    return map;
  }, [resultados]);

  if (resultados.length === 0) {
    return (
      <Card>
        <CardContent className="space-y-2 p-6 text-sm text-muted-foreground">
          <p className="flex items-center gap-2 font-medium text-foreground">
            <FlaskConical className="h-4 w-4" /> Nenhum teste A/B configurado
          </p>
          <p>
            Edite um fluxo, abra uma etapa e ative "Teste A/B" para criar a variante B. As mensagens serão sorteadas
            entre os leads e a variante com melhor taxa de resposta pode ser escolhida automaticamente.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {[...porFluxo.entries()].map(([fluxoId, lista]) => {
        const fluxo = fluxos.find((f) => f.id === fluxoId);
        return (
          <Card key={fluxoId}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{fluxo?.nome ?? "Fluxo"}</CardTitle>
              <CardDescription>{lista.length} etapa(s) em teste A/B</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {lista.map((r) => {
                const vencedor = r.vencedorSalvo ?? r.vencedorSugerido;
                return (
                  <div key={r.etapa_id} className="space-y-3 rounded-md border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">Etapa {r.ordem}</Badge>
                        <Badge variant="outline">{r.canal === "email" ? "E-mail" : "WhatsApp"}</Badge>
                        {r.ativo ? (
                          <Badge variant="outline">Teste em andamento</Badge>
                        ) : (
                          <Badge>Encerrado{r.vencedorSalvo ? ` · vencedora ${r.vencedorSalvo}` : ""}</Badge>
                        )}
                        {!r.amostraSuficiente && r.ativo && (
                          <span className="text-xs text-muted-foreground">
                            Amostra insuficiente (mín. {r.minEnvios} envios por variante)
                          </span>
                        )}
                      </div>
                      {!r.ativo && (
                        <Button size="sm" variant="ghost" onClick={() => onReabrir(r.etapa_id)}>
                          <RotateCcw className="mr-1 h-4 w-4" /> Reabrir teste
                        </Button>
                      )}
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <ColunaVariante
                        stats={r.a}
                        destaque={vencedor === "A"}
                        onAplicar={r.ativo ? () => onAplicarVencedor(r.etapa_id, "A") : undefined}
                      />
                      <ColunaVariante
                        stats={r.b}
                        destaque={vencedor === "B"}
                        onAplicar={r.ativo ? () => onAplicarVencedor(r.etapa_id, "B") : undefined}
                      />
                    </div>

                    {r.ativo && r.vencedorSugerido && (
                      <p className="text-xs text-muted-foreground">
                        Sugestão: variante <strong>{r.vencedorSugerido}</strong> está{" "}
                        {r.diferencaPontos.toFixed(1)} pontos à frente.
                        {r.autoEscolher
                          ? " A escolha automática será aplicada no próximo processamento."
                          : " Escolha automática desativada — aplique manualmente."}
                      </p>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
