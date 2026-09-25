import { useState, useMemo } from "react";
import { useTabPersistence } from "@/hooks/useTabPersistence";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useContratos } from "@/hooks/useContratos";
import { useTransacoes } from "@/hooks/useTransacoes";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertTriangle,
  DollarSign,
  Clock,
  TrendingDown,
  Loader2,
  RefreshCw,
  FileText,
  Phone,
  Mail,
  MessageCircle,
  Download,
} from "lucide-react";
import { exportInadimplenciaPDF } from "@/lib/exportInadimplenciaPDF";
import { useImobiliariaConfig } from "@/hooks/useImobiliariaConfig";
import { format, differenceInDays, subMonths, startOfMonth, endOfMonth, parseISO, isAfter, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

interface InadimplenciaItem {
  contrato_id: string;
  titulo: string;
  inquilino: string;
  inquilino_telefone: string | null;
  proprietario: string | null;
  valor_aluguel: number;
  dia_vencimento: number;
  meses_atrasados: number;
  valor_total_divida: number;
  dias_atraso: number;
  status_gravidade: "leve" | "moderado" | "grave" | "critico";
  ultimo_pagamento: string | null;
}

const GRAVIDADE_CONFIG = {
  leve: { label: "Leve", color: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400", days: "1-15 dias" },
  moderado: { label: "Moderado", color: "bg-orange-500/20 text-orange-700 dark:text-orange-400", days: "16-30 dias" },
  grave: { label: "Grave", color: "bg-red-500/20 text-red-700 dark:text-red-400", days: "31-60 dias" },
  critico: { label: "Crítico", color: "bg-red-700/20 text-red-800 dark:text-red-300", days: "60+ dias" },
};

const PIE_COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))"];

export default function Inadimplencia() {
  const { contratos, loading: loadingContratos } = useContratos();
  const { transacoes, loading: loadingTransacoes } = useTransacoes();
  const [inadTab, setInadTab] = useTabPersistence("inadimplencia_active_tab", "lista");
  const imobConfig = useImobiliariaConfig();
  const [filtroGravidade, setFiltroGravidade] = useState<string>("todos");
  const [gerandoAlertas, setGerandoAlertas] = useState(false);

  const inadimplentes = useMemo(() => {
    if (!contratos || !transacoes) return [];

    const contratosLocacao = contratos.filter(
      (c) => c.tipo === "Locação" && c.status === "ativo"
    );

    const hoje = new Date();
    const items: InadimplenciaItem[] = [];

    contratosLocacao.forEach((contrato) => {
      const diaVenc = contrato.dia_vencimento_aluguel || 10;
      const valorAluguel = contrato.valor || 0;

      // Get transactions for this contract
      const transacoesContrato = transacoes.filter(
        (t) =>
          t.descricao?.includes(contrato.titulo) &&
          t.tipo === "entrada" &&
          t.categoria === "aluguel"
      );

      // Check last 3 months for missing payments
      let mesesAtrasados = 0;
      let ultimoPagamento: string | null = null;

      for (let i = 0; i < 3; i++) {
        const mesRef = subMonths(hoje, i);
        const inicio = startOfMonth(mesRef);
        const fim = endOfMonth(mesRef);

        const pagamentoMes = transacoesContrato.find((t) => {
          const dataT = parseISO(t.data);
          return (
            (isAfter(dataT, inicio) || dataT.getTime() === inicio.getTime()) &&
            (isBefore(dataT, fim) || dataT.getTime() === fim.getTime()) &&
            t.status === "pago"
          );
        });

        if (!pagamentoMes) {
          // Check if the due date has passed
          const dataVenc = new Date(mesRef.getFullYear(), mesRef.getMonth(), diaVenc);
          if (isBefore(dataVenc, hoje)) {
            mesesAtrasados++;
          }
        } else if (!ultimoPagamento) {
          ultimoPagamento = pagamentoMes.data;
        }
      }

      if (mesesAtrasados > 0) {
        const mesAtrasadoMaisAntigo = subMonths(hoje, mesesAtrasados);
        const dataVencMaisAntiga = new Date(
          mesAtrasadoMaisAntigo.getFullYear(),
          mesAtrasadoMaisAntigo.getMonth(),
          diaVenc
        );
        const diasAtraso = differenceInDays(hoje, dataVencMaisAntiga);

        let gravidade: InadimplenciaItem["status_gravidade"] = "leve";
        if (diasAtraso > 60) gravidade = "critico";
        else if (diasAtraso > 30) gravidade = "grave";
        else if (diasAtraso > 15) gravidade = "moderado";

        items.push({
          contrato_id: contrato.id,
          titulo: contrato.titulo,
          inquilino: contrato.inquilino || contrato.cliente,
          inquilino_telefone: contrato.inquilino_telefone || null,
          proprietario: contrato.proprietario,
          valor_aluguel: valorAluguel,
          dia_vencimento: diaVenc,
          meses_atrasados: mesesAtrasados,
          valor_total_divida: valorAluguel * mesesAtrasados,
          dias_atraso: diasAtraso,
          status_gravidade: gravidade,
          ultimo_pagamento: ultimoPagamento,
        });
      }
    });

    return items.sort((a, b) => b.dias_atraso - a.dias_atraso);
  }, [contratos, transacoes]);

  const filtrados = useMemo(() => {
    if (filtroGravidade === "todos") return inadimplentes;
    return inadimplentes.filter((i) => i.status_gravidade === filtroGravidade);
  }, [inadimplentes, filtroGravidade]);

  // Metrics
  const totalDivida = inadimplentes.reduce((s, i) => s + i.valor_total_divida, 0);
  const totalInadimplentes = inadimplentes.length;
  const contratosAtivos = contratos?.filter((c) => c.tipo === "Locação" && c.status === "ativo").length || 0;
  const taxaInadimplencia = contratosAtivos > 0 ? ((totalInadimplentes / contratosAtivos) * 100).toFixed(1) : "0";
  const mediaAtraso = totalInadimplentes > 0
    ? Math.round(inadimplentes.reduce((s, i) => s + i.dias_atraso, 0) / totalInadimplentes)
    : 0;

  // Charts data
  const gravidadeData = [
    { name: "Leve", value: inadimplentes.filter((i) => i.status_gravidade === "leve").length },
    { name: "Moderado", value: inadimplentes.filter((i) => i.status_gravidade === "moderado").length },
    { name: "Grave", value: inadimplentes.filter((i) => i.status_gravidade === "grave").length },
    { name: "Crítico", value: inadimplentes.filter((i) => i.status_gravidade === "critico").length },
  ].filter((d) => d.value > 0);

  const valorPorGravidade = [
    { name: "Leve", valor: inadimplentes.filter((i) => i.status_gravidade === "leve").reduce((s, i) => s + i.valor_total_divida, 0) },
    { name: "Moderado", valor: inadimplentes.filter((i) => i.status_gravidade === "moderado").reduce((s, i) => s + i.valor_total_divida, 0) },
    { name: "Grave", valor: inadimplentes.filter((i) => i.status_gravidade === "grave").reduce((s, i) => s + i.valor_total_divida, 0) },
    { name: "Crítico", valor: inadimplentes.filter((i) => i.status_gravidade === "critico").reduce((s, i) => s + i.valor_total_divida, 0) },
  ].filter((d) => d.valor > 0);

  const handleGerarAlertas = async () => {
    setGerandoAlertas(true);
    try {
      const { data, error } = await supabase.functions.invoke("alertas-inadimplencia", {
        body: {},
      });
      if (error) throw error;
      toast.success(`${data?.alertas_gerados ?? 0} alerta(s) de inadimplência gerado(s)!`);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao gerar alertas");
    } finally {
      setGerandoAlertas(false);
    }
  };

  const formatCurrency = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const loading = loadingContratos || loadingTransacoes;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-destructive" />
              Relatório de Inadimplência
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Monitoramento de aluguéis atrasados e gestão de cobranças
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => {
                const result = exportInadimplenciaPDF({
                  inadimplentes,
                  contratosAtivos,
                  brandName: imobConfig.nome_empresa,
                  brandCreci: imobConfig.creci,
                  brandTelefone: imobConfig.telefone,
                });
                if (!result) toast.error("Nenhum contrato inadimplente para exportar");
              }}
              variant="outline"
              className="gap-2"
              disabled={inadimplentes.length === 0}
            >
              <Download className="h-4 w-4" />
              Exportar PDF
            </Button>
            <Button
              onClick={handleGerarAlertas}
              disabled={gerandoAlertas}
              variant="destructive"
              className="gap-2"
            >
              {gerandoAlertas ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Gerar Alertas Automáticos
            </Button>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <DollarSign className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total em Atraso</p>
                  <p className="text-xl font-bold text-foreground">{formatCurrency(totalDivida)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/10">
                  <FileText className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Contratos Inadimplentes</p>
                  <p className="text-xl font-bold text-foreground">{totalInadimplentes} <span className="text-sm font-normal text-muted-foreground">de {contratosAtivos}</span></p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-500/10">
                  <TrendingDown className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Taxa de Inadimplência</p>
                  <p className="text-xl font-bold text-foreground">{taxaInadimplencia}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/10">
                  <Clock className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Média de Atraso</p>
                  <p className="text-xl font-bold text-foreground">{mediaAtraso} <span className="text-sm font-normal text-muted-foreground">dias</span></p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={inadTab} onValueChange={setInadTab} className="w-full">
          <TabsList>
            <TabsTrigger value="lista">Lista Detalhada</TabsTrigger>
            <TabsTrigger value="graficos">Gráficos</TabsTrigger>
          </TabsList>

          {/* Lista Tab */}
          <TabsContent value="lista" className="space-y-4 mt-4">
            <div className="flex items-center gap-3">
              <Select value={filtroGravidade} onValueChange={setFiltroGravidade}>
                <SelectTrigger className="w-48 bg-secondary border-border">
                  <SelectValue placeholder="Filtrar gravidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="leve">🟡 Leve (1-15 dias)</SelectItem>
                  <SelectItem value="moderado">🟠 Moderado (16-30 dias)</SelectItem>
                  <SelectItem value="grave">🔴 Grave (31-60 dias)</SelectItem>
                  <SelectItem value="critico">⚫ Crítico (60+ dias)</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">
                {filtrados.length} registro(s)
              </span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filtrados.length === 0 ? (
              <Card className="bg-card border-border">
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="p-4 rounded-full bg-green-500/10 mb-4">
                    <DollarSign className="h-8 w-8 text-green-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">Tudo em dia! 🎉</h3>
                  <p className="text-muted-foreground text-sm mt-1">
                    Nenhum contrato de locação com atraso detectado.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-card border-border overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border">
                        <TableHead>Gravidade</TableHead>
                        <TableHead>Contrato</TableHead>
                        <TableHead>Inquilino</TableHead>
                        <TableHead>Proprietário</TableHead>
                        <TableHead className="text-right">Aluguel</TableHead>
                        <TableHead className="text-center">Meses</TableHead>
                        <TableHead className="text-right">Dívida Total</TableHead>
                        <TableHead className="text-center">Dias Atraso</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtrados.map((item) => {
                        const cfg = GRAVIDADE_CONFIG[item.status_gravidade];
                        return (
                          <TableRow key={item.contrato_id} className="border-border">
                            <TableCell>
                              <Badge variant="secondary" className={cfg.color}>
                                {cfg.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium text-foreground max-w-[180px] truncate">
                              {item.titulo}
                            </TableCell>
                            <TableCell className="text-foreground">{item.inquilino}</TableCell>
                            <TableCell className="text-muted-foreground">{item.proprietario || "—"}</TableCell>
                            <TableCell className="text-right text-foreground font-medium">
                              {formatCurrency(item.valor_aluguel)}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className="border-destructive/50 text-destructive">
                                {item.meses_atrasados}x
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-bold text-destructive">
                              {formatCurrency(item.valor_total_divida)}
                            </TableCell>
                            <TableCell className="text-center font-bold text-foreground">
                              {item.dias_atraso}d
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                {item.inquilino_telefone && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() =>
                                        window.open(
                                          `https://wa.me/55${item.inquilino_telefone?.replace(/\D/g, "")}?text=${encodeURIComponent(
                                            `Olá ${item.inquilino}, identificamos que o aluguel referente ao contrato "${item.titulo}" encontra-se em atraso de ${item.dias_atraso} dia(s). Valor pendente: ${formatCurrency(item.valor_total_divida)}. Por favor, entre em contato para regularizar.`
                                          )}`,
                                          "_blank"
                                        )
                                      }
                                    >
                                      <MessageCircle className="h-4 w-4 text-green-600" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() =>
                                        window.open(`tel:${item.inquilino_telefone}`, "_blank")
                                      }
                                    >
                                      <Phone className="h-4 w-4 text-blue-500" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            )}
          </TabsContent>

          {/* Gráficos Tab */}
          <TabsContent value="graficos" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-base text-foreground">Distribuição por Gravidade</CardTitle>
                </CardHeader>
                <CardContent>
                  {gravidadeData.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-10">Sem dados</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie
                          data={gravidadeData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={4}
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value}`}
                        >
                          {gravidadeData.map((_, idx) => (
                            <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-base text-foreground">Valor em Atraso por Gravidade</CardTitle>
                </CardHeader>
                <CardContent>
                  {valorPorGravidade.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-10">Sem dados</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={valorPorGravidade}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="name" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                        <YAxis
                          tick={{ fill: "hsl(var(--muted-foreground))" }}
                          tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                        />
                        <Tooltip
                          formatter={(value: number) => [formatCurrency(value), "Valor"]}
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                        />
                        <Bar dataKey="valor" fill="hsl(var(--destructive))" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
