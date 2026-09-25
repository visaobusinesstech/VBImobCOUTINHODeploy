import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Download, TrendingUp } from "lucide-react";
import {
  calcularMetricas,
  TIPOS_EVENTO,
  type NutricaoEvento,
  type MetricasFluxo,
} from "@/hooks/useNutricaoMetricas";

interface Props {
  fluxos: { id: string; nome: string; ativo: boolean }[];
  inscricoes: { id: string; fluxo_id: string }[];
  envios: { id: string; inscricao_id: string; status: string }[];
  eventos: NutricaoEvento[];
  dias: number;
  onDiasChange: (d: number) => void;
  loading?: boolean;
}

const PERIODOS = [7, 30, 90, 180];

const moeda = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const perc = (v: number) => `${v.toFixed(1)}%`;

function LinhaFunil({ label, valor, total }: { label: string; valor: number; total: number }) {
  const p = total > 0 ? (valor / total) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">
          {valor} <span className="text-muted-foreground">({perc(p)})</span>
        </span>
      </div>
      <Progress value={p} className="h-1.5" />
    </div>
  );
}

export function MetricasFluxosPanel({
  fluxos,
  inscricoes,
  envios,
  eventos,
  dias,
  onDiasChange,
  loading,
}: Props) {
  const [ordem, setOrdem] = useState<keyof MetricasFluxo>("fechamentos");

  const metricas = useMemo(
    () => calcularMetricas(fluxos, inscricoes, envios, eventos),
    [fluxos, inscricoes, envios, eventos],
  );

  const ordenadas = useMemo(
    () => [...metricas].sort((a, b) => Number(b[ordem] ?? 0) - Number(a[ordem] ?? 0)),
    [metricas, ordem],
  );

  const totais = useMemo(
    () =>
      metricas.reduce(
        (acc, m) => ({
          enviados: acc.enviados + (m.enviados || m.envios),
          aberturas: acc.aberturas + m.aberturas,
          cliques: acc.cliques + m.cliques,
          respostas: acc.respostas + m.respostas,
          agendamentos: acc.agendamentos + m.agendamentos,
          fechamentos: acc.fechamentos + m.fechamentos,
          valor: acc.valor + m.valorFechado,
          reativados: acc.reativados + m.reativados,
        }),
        { enviados: 0, aberturas: 0, cliques: 0, respostas: 0, agendamentos: 0, fechamentos: 0, valor: 0, reativados: 0 },
      ),
    [metricas],
  );

  const exportarCsv = () => {
    const head = [
      "Fluxo", "Ativo", "Inscritos", "Mensagens", "Enviadas",
      "Aberturas", "% Abertura", "Cliques", "% Clique",
      "Respostas", "% Resposta", "Agendamentos", "% Agendamento",
      "Fechamentos", "% Fechamento", "Valor fechado", "Leads reativados", "% Reativação",
    ];
    const linhas = ordenadas.map((m) => [
      m.nome, m.ativo ? "Sim" : "Não", m.inscritos, m.envios, m.enviados,
      m.aberturas, perc(m.taxaAbertura), m.cliques, perc(m.taxaClique),
      m.respostas, perc(m.taxaResposta), m.agendamentos, perc(m.taxaAgendamento),
      m.fechamentos, perc(m.taxaFechamento), m.valorFechado, m.reativados, perc(m.taxaReativacao),
    ]);
    const csv = [head, ...linhas]
      .map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `nutricao-metricas-${dias}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const melhor = ordenadas.find((m) => m.fechamentos > 0 || m.respostas > 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={exportarCsv}>
          <Download className="mr-2 h-4 w-4" /> Exportar CSV
        </Button>
        {PERIODOS.map((d) => (
          <Button key={d} size="sm" variant={dias === d ? "default" : "outline"} onClick={() => onDiasChange(d)}>
            {d} dias
          </Button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Enviadas", v: totais.enviados },
          { label: "Aberturas", v: totais.aberturas },
          { label: "Cliques", v: totais.cliques },
          { label: "Respostas", v: totais.respostas },
          { label: "Agendamentos", v: totais.agendamentos },
          { label: "Fechamentos", v: totais.fechamentos },
        ].map((c) => (
          <Card key={c.label}>
            <CardHeader className="pb-1"><CardDescription>{c.label}</CardDescription></CardHeader>
            <CardContent className="text-xl font-bold">{c.v}</CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Funil geral da nutrição</CardTitle>
            <CardDescription>Base: mensagens enviadas nos últimos {dias} dias</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <LinhaFunil label="Enviadas" valor={totais.enviados} total={totais.enviados} />
            <LinhaFunil label="Aberturas" valor={totais.aberturas} total={totais.enviados} />
            <LinhaFunil label="Cliques" valor={totais.cliques} total={totais.enviados} />
            <LinhaFunil label="Respostas" valor={totais.respostas} total={totais.enviados} />
            <LinhaFunil label="Agendamentos" valor={totais.agendamentos} total={totais.enviados} />
            <LinhaFunil label="Fechamentos" valor={totais.fechamentos} total={totais.enviados} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Campanha que mais reativa</CardTitle>
            <CardDescription>Leads que responderam, agendaram ou fecharam após a nutrição</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {melhor ? (
              <>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <span className="font-medium">{melhor.nome}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">Reativados: </span>{melhor.reativados}</div>
                  <div><span className="text-muted-foreground">Taxa: </span>{perc(melhor.taxaReativacao)}</div>
                  <div><span className="text-muted-foreground">Agendamentos: </span>{melhor.agendamentos}</div>
                  <div><span className="text-muted-foreground">Fechamentos: </span>{melhor.fechamentos}</div>
                </div>
                <p className="text-sm">
                  <span className="text-muted-foreground">Valor fechado no período: </span>
                  <span className="font-semibold">{moeda(totais.valor)}</span>
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhum evento registrado ainda. Marque abertura, clique, resposta, agendamento ou fechamento na aba
                Mensagens para alimentar os relatórios.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Desempenho por fluxo</CardTitle>
          <CardDescription>Ordenar por:</CardDescription>
          <div className="flex flex-wrap gap-2 pt-1">
            {(["fechamentos", "agendamentos", "respostas", "cliques", "aberturas", "reativados"] as const).map((k) => (
              <Button key={k} size="sm" variant={ordem === k ? "default" : "outline"} onClick={() => setOrdem(k)}>
                {k.charAt(0).toUpperCase() + k.slice(1)}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {!loading && ordenadas.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum fluxo cadastrado.</p>
          )}
          {ordenadas.length > 0 && (
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3">Fluxo</th>
                  <th className="py-2 pr-3">Inscritos</th>
                  <th className="py-2 pr-3">Enviadas</th>
                  {TIPOS_EVENTO.map((t) => (
                    <th key={t.tipo} className="py-2 pr-3">{t.label}</th>
                  ))}
                  <th className="py-2 pr-3">Reativação</th>
                  <th className="py-2">Valor</th>
                </tr>
              </thead>
              <tbody>
                {ordenadas.map((m) => (
                  <tr key={m.fluxo_id} className="border-b last:border-0">
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{m.nome}</span>
                        {!m.ativo && <Badge variant="secondary">pausado</Badge>}
                      </div>
                    </td>
                    <td className="py-2 pr-3">{m.inscritos}</td>
                    <td className="py-2 pr-3">{m.enviados}</td>
                    <td className="py-2 pr-3">{m.aberturas} <span className="text-xs text-muted-foreground">{perc(m.taxaAbertura)}</span></td>
                    <td className="py-2 pr-3">{m.cliques} <span className="text-xs text-muted-foreground">{perc(m.taxaClique)}</span></td>
                    <td className="py-2 pr-3">{m.respostas} <span className="text-xs text-muted-foreground">{perc(m.taxaResposta)}</span></td>
                    <td className="py-2 pr-3">{m.agendamentos} <span className="text-xs text-muted-foreground">{perc(m.taxaAgendamento)}</span></td>
                    <td className="py-2 pr-3">{m.fechamentos} <span className="text-xs text-muted-foreground">{perc(m.taxaFechamento)}</span></td>
                    <td className="py-2 pr-3">{m.reativados} <span className="text-xs text-muted-foreground">{perc(m.taxaReativacao)}</span></td>
                    <td className="py-2">{moeda(m.valorFechado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
