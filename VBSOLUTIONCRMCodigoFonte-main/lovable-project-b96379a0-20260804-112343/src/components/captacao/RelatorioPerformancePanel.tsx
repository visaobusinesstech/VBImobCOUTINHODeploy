import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Download, TrendingUp, Clock, Target, Activity } from "lucide-react";
import { motion } from "framer-motion";
import { useCaptacoes, type Captacao } from "@/hooks/useCaptacoes";
import { useAuth } from "@/contexts/AuthContext";
import { buildRelatorioCaptacaoCsv, TIPO_LABELS } from "@/lib/relatorioCaptacaoCsv";

type Metric = {
  canal: string;
  total: number;
  concluidas: number;
  canceladas: number;
  emAndamento: number;
  pendentes: number;
  taxaConversao: number;
  tempoRespostaHoras: number | null;
  tempoFechamentoDias: number | null;
};

const formatHours = (h: number | null) => {
  if (h === null) return "—";
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h < 24) return `${h.toFixed(1)} h`;
  return `${(h / 24).toFixed(1)} d`;
};

const formatDays = (d: number | null) => (d === null ? "—" : `${d.toFixed(1)} d`);

export function RelatorioPerformancePanel() {
  const { captacoes, loading } = useCaptacoes();
  const { isMaster } = useAuth();
  const hoje = new Date();
  const trintaDiasAtras = new Date(hoje.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [dataInicio, setDataInicio] = useState(trintaDiasAtras.toISOString().slice(0, 10));
  const [dataFim, setDataFim] = useState(hoje.toISOString().slice(0, 10));
  const [operacaoFilter, setOperacaoFilter] = useState<string>("todas");

  const filtered = useMemo(() => {
    const ini = new Date(dataInicio + "T00:00:00").getTime();
    const fim = new Date(dataFim + "T23:59:59").getTime();
    return captacoes.filter((c) => {
      const t = new Date(c.created_at).getTime();
      if (t < ini || t > fim) return false;
      if (operacaoFilter !== "todas" && c.operacao !== operacaoFilter) return false;
      return true;
    });
  }, [captacoes, dataInicio, dataFim, operacaoFilter]);

  const metrics: Metric[] = useMemo(() => {
    const map = new Map<string, Captacao[]>();
    filtered.forEach((c) => {
      const key = c.tipo || "outro";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    });

    return Array.from(map.entries())
      .map(([canal, items]) => {
        const total = items.length;
        const concluidas = items.filter((i) => i.status === "concluida").length;
        const canceladas = items.filter((i) => i.status === "cancelada").length;
        const emAndamento = items.filter((i) => i.status === "em_andamento").length;
        const pendentes = items.filter((i) => i.status === "pendente").length;

        // Tempo de resposta: created_at → updated_at (quando saiu de pendente)
        const respondidos = items.filter(
          (i) => i.status !== "pendente" && i.updated_at && i.created_at,
        );
        const tempoRespostaHoras =
          respondidos.length > 0
            ? respondidos.reduce((sum, i) => {
                const diff =
                  new Date(i.updated_at).getTime() - new Date(i.created_at).getTime();
                return sum + diff / 1000 / 60 / 60;
              }, 0) / respondidos.length
            : null;

        // Tempo de fechamento (criação → concluída)
        const fechadas = items.filter((i) => i.status === "concluida");
        const tempoFechamentoDias =
          fechadas.length > 0
            ? fechadas.reduce((sum, i) => {
                const diff =
                  new Date(i.updated_at).getTime() - new Date(i.created_at).getTime();
                return sum + diff / 1000 / 60 / 60 / 24;
              }, 0) / fechadas.length
            : null;

        return {
          canal: TIPO_LABELS[canal] || canal,
          total,
          concluidas,
          canceladas,
          emAndamento,
          pendentes,
          taxaConversao: total > 0 ? (concluidas / total) * 100 : 0,
          tempoRespostaHoras,
          tempoFechamentoDias,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [filtered]);

  const totais = useMemo(() => {
    const total = filtered.length;
    const concluidas = filtered.filter((i) => i.status === "concluida").length;
    const conv = total > 0 ? (concluidas / total) * 100 : 0;
    const respHoras = metrics
      .map((m) => m.tempoRespostaHoras)
      .filter((v): v is number => v !== null);
    const fechDias = metrics
      .map((m) => m.tempoFechamentoDias)
      .filter((v): v is number => v !== null);
    return {
      total,
      concluidas,
      conv,
      respMedia:
        respHoras.length > 0 ? respHoras.reduce((a, b) => a + b, 0) / respHoras.length : null,
      fechMedio:
        fechDias.length > 0 ? fechDias.reduce((a, b) => a + b, 0) / fechDias.length : null,
    };
  }, [filtered, metrics]);

  const exportCSV = () => {
    const csv = buildRelatorioCaptacaoCsv(metrics, filtered);
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-captacao-${dataInicio}_${dataFim}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const maxTotal = Math.max(...metrics.map((m) => m.total), 1);

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Filtros do Relatório
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">Data inicial</Label>
              <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Data final</Label>
              <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Operação</Label>
              <Select value={operacaoFilter} onValueChange={setOperacaoFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  <SelectItem value="Venda">Venda</SelectItem>
                  <SelectItem value="Locação">Locação</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={exportCSV} variant="outline" className="w-full gap-2" disabled={metrics.length === 0}>
                <Download className="w-4 h-4" /> Exportar CSV
              </Button>
            </div>
          </div>
          {isMaster && (
            <p className="text-xs text-muted-foreground mt-2">
              👑 Visão Master — dados consolidados de todas as captações da imobiliária.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total no Período</p>
            <p className="text-2xl font-bold text-foreground mt-1">{totais.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Target className="w-3.5 h-3.5" /> Taxa de Conversão
            </div>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
              {totais.conv.toFixed(1)}%
            </p>
            <p className="text-[10px] text-muted-foreground">{totais.concluidas} concluídas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="w-3.5 h-3.5" /> Tempo Médio Resposta
            </div>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
              {formatHours(totais.respMedia)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <TrendingUp className="w-3.5 h-3.5" /> Tempo Médio Fechamento
            </div>
            <p className="text-2xl font-bold text-primary mt-1">{formatDays(totais.fechMedio)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela detalhada */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Performance por Canal</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
          ) : metrics.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Sem captações no período selecionado.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Canal</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                    <TableHead className="text-center">Concluídas</TableHead>
                    <TableHead className="text-center">Em Andamento</TableHead>
                    <TableHead className="text-center">Pendentes</TableHead>
                    <TableHead className="text-center">Canceladas</TableHead>
                    <TableHead className="text-center">Conversão</TableHead>
                    <TableHead className="text-center">Resposta</TableHead>
                    <TableHead className="text-center">Fechamento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metrics.map((m, i) => (
                    <TableRow key={m.canal}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium text-sm">{m.canal}</div>
                          <div className="h-1.5 bg-secondary rounded-full overflow-hidden w-32">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${(m.total / maxTotal) * 100}%` }}
                              transition={{ delay: i * 0.05 }}
                              className="h-full bg-primary rounded-full"
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-bold">{m.total}</TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-0">
                          {m.concluidas}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-0">
                          {m.emAndamento}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-0">
                          {m.pendentes}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{m.canceladas}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <span
                          className={`font-bold ${
                            m.taxaConversao >= 50
                              ? "text-green-600 dark:text-green-400"
                              : m.taxaConversao >= 25
                              ? "text-yellow-600 dark:text-yellow-400"
                              : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {m.taxaConversao.toFixed(1)}%
                        </span>
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        {formatHours(m.tempoRespostaHoras)}
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        {formatDays(m.tempoFechamentoDias)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
