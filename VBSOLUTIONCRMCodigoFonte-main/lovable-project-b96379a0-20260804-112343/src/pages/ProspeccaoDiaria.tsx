import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { SectionHeader } from "@/components/shared/MetricCard";
import { useState, useMemo } from "react";
import { useProspeccaoDiaria } from "@/hooks/useProspeccaoDiaria";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Save, Trash2, TrendingUp, Home, Users, MessageCircle, Building2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { motion } from "framer-motion";

const ProspeccaoDiaria = () => {
  const { registros, isLoading, upsert, remove } = useProspeccaoDiaria();
  const [tab, setTab] = useState("registrar");
  const [data, setData] = useState(format(new Date(), "yyyy-MM-dd"));
  const [aluguel, setAluguel] = useState(0);
  const [venda, setVenda] = useState(0);
  const [proprietarios, setProprietarios] = useState(0);
  const [leads, setLeads] = useState(0);
  const [obs, setObs] = useState("");

  // Load existing data when date changes
  const existing = registros.find((r) => r.data === data);
  const loadExisting = () => {
    if (existing) {
      setAluguel(existing.prospeccoes_aluguel);
      setVenda(existing.prospeccoes_venda);
      setProprietarios(existing.proprietarios_contatados);
      setLeads(existing.leads_conversados);
      setObs(existing.observacoes || "");
    }
  };

  const handleSave = () => {
    upsert.mutate({
      data,
      prospeccoes_aluguel: aluguel,
      prospeccoes_venda: venda,
      proprietarios_contatados: proprietarios,
      leads_conversados: leads,
      observacoes: obs,
    });
  };

  const chartData = useMemo(() => {
    return [...registros]
      .sort((a, b) => a.data.localeCompare(b.data))
      .slice(-14)
      .map((r) => ({
        data: format(new Date(r.data + "T12:00:00"), "dd/MM", { locale: ptBR }),
        Aluguel: r.prospeccoes_aluguel,
        Venda: r.prospeccoes_venda,
        Proprietários: r.proprietarios_contatados,
        Leads: r.leads_conversados,
      }));
  }, [registros]);

  const totals = useMemo(() => {
    const last30 = registros.filter((r) => {
      const d = new Date(r.data);
      const now = new Date();
      return (now.getTime() - d.getTime()) / 86400000 <= 30;
    });
    return {
      aluguel: last30.reduce((s, r) => s + r.prospeccoes_aluguel, 0),
      venda: last30.reduce((s, r) => s + r.prospeccoes_venda, 0),
      proprietarios: last30.reduce((s, r) => s + r.proprietarios_contatados, 0),
      leads: last30.reduce((s, r) => s + r.leads_conversados, 0),
      dias: last30.length,
    };
  }, [registros]);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <SectionHeader title="Prospecção Diária" subtitle="Registre e acompanhe suas atividades de prospecção" />

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Prospecções Aluguel", value: totals.aluguel, icon: Home, color: "text-blue-500" },
            { label: "Prospecções Venda", value: totals.venda, icon: Building2, color: "text-emerald-500" },
            { label: "Proprietários", value: totals.proprietarios, icon: Users, color: "text-amber-500" },
            { label: "Leads Conversados", value: totals.leads, icon: MessageCircle, color: "text-purple-500" },
          ].map((item) => (
            <motion.div key={item.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="glass-card glow-border">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <item.icon className={`w-4 h-4 ${item.color}`} />
                    <span className="text-xs text-muted-foreground">{item.label}</span>
                  </div>
                  <p className="text-2xl font-bold">{item.value}</p>
                  <p className="text-[10px] text-muted-foreground">últimos 30 dias ({totals.dias} registros)</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="registrar">Registrar</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
            <TabsTrigger value="rendimento">Rendimento</TabsTrigger>
          </TabsList>

          <TabsContent value="registrar" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Registro do Dia</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <Label>Data</Label>
                    <Input
                      type="date"
                      value={data}
                      onChange={(e) => setData(e.target.value)}
                      onBlur={loadExisting}
                    />
                  </div>
                  {existing && (
                    <Badge variant="secondary" className="mb-1">Já registrado — editar</Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <Label>Prospecções Aluguel</Label>
                    <Input type="number" min={0} value={aluguel} onChange={(e) => setAluguel(+e.target.value)} />
                  </div>
                  <div>
                    <Label>Prospecções Venda</Label>
                    <Input type="number" min={0} value={venda} onChange={(e) => setVenda(+e.target.value)} />
                  </div>
                  <div>
                    <Label>Proprietários Contatados</Label>
                    <Input type="number" min={0} value={proprietarios} onChange={(e) => setProprietarios(+e.target.value)} />
                  </div>
                  <div>
                    <Label>Leads Conversados</Label>
                    <Input type="number" min={0} value={leads} onChange={(e) => setLeads(+e.target.value)} />
                  </div>
                </div>

                <div>
                  <Label>Observações</Label>
                  <Textarea value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Anotações do dia..." />
                </div>

                <Button onClick={handleSave} disabled={upsert.isPending}>
                  {upsert.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  Salvar
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="historico" className="mt-4">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-center">Aluguel</TableHead>
                      <TableHead className="text-center">Venda</TableHead>
                      <TableHead className="text-center">Proprietários</TableHead>
                      <TableHead className="text-center">Leads</TableHead>
                      <TableHead className="text-center">Total</TableHead>
                      <TableHead>Obs</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {registros.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          Nenhum registro ainda
                        </TableCell>
                      </TableRow>
                    )}
                    {registros.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">
                          {format(new Date(r.data + "T12:00:00"), "dd/MM/yyyy")}
                        </TableCell>
                        <TableCell className="text-center">{r.prospeccoes_aluguel}</TableCell>
                        <TableCell className="text-center">{r.prospeccoes_venda}</TableCell>
                        <TableCell className="text-center">{r.proprietarios_contatados}</TableCell>
                        <TableCell className="text-center">{r.leads_conversados}</TableCell>
                        <TableCell className="text-center font-bold">
                          {r.prospeccoes_aluguel + r.prospeccoes_venda + r.proprietarios_contatados + r.leads_conversados}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                          {r.observacoes || "—"}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => remove.mutate(r.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rendimento" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  Rendimento — Últimos 14 dias
                </CardTitle>
              </CardHeader>
              <CardContent>
                {chartData.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Registre prospecções para ver o gráfico</p>
                ) : (
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="data" fontSize={11} />
                      <YAxis allowDecimals={false} fontSize={11} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="Aluguel" fill="hsl(199, 89%, 48%)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Venda" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Proprietários" fill="hsl(38, 92%, 50%)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Leads" fill="hsl(270, 70%, 60%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default ProspeccaoDiaria;
