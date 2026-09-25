import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { SectionHeader, MetricCard } from "@/components/shared/MetricCard";
import { motion } from "framer-motion";
import {
  Users, CalendarCheck, Handshake, FileSignature, TrendingUp,
  BarChart3, Target, Clock, Award, Filter
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, RadarChart, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Radar, LineChart, Line
} from "recharts";

interface CorretorStats {
  id: string;
  nome: string;
  visitas: number;
  reunioes: number;
  assinaturas: number;
  leadsAtribuidos: number;
  leadsFechados: number;
  taxaConversao: number;
  contratosAtivos: number;
  valorContratos: number;
  compromissosConcluidos: number;
  compromissosCancelados: number;
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "#8b5cf6",
  "#f59e0b",
  "#10b981",
];

const RelatorioProdutividade = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [corretoresStats, setCorretoresStats] = useState<CorretorStats[]>([]);
  const [periodo, setPeriodo] = useState("30");
  const [corretorSelecionado, setCorretorSelecionado] = useState("todos");

  useEffect(() => {
    if (user) fetchData();
  }, [user, periodo]);

  const fetchData = async () => {
    setLoading(true);
    const dias = parseInt(periodo);
    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - dias);
    const dataInicioStr = dataInicio.toISOString();

    const [corretoresRes, compromissosRes, leadsRes, contratosRes] = await Promise.all([
      supabase.from("corretores").select("id, nome").eq("imobiliaria_id", user!.id).eq("status", "ativo"),
      supabase.from("compromissos").select("id, tipo, status, corretor_id, data_inicio, confirmado")
        .eq("imobiliaria_id", user!.id).gte("data_inicio", dataInicioStr),
      supabase.from("leads").select("id, estagio, corretor_id, created_at, valor")
        .eq("imobiliaria_id", user!.id).gte("created_at", dataInicioStr),
      supabase.from("contratos").select("id, corretor_id, status, valor, created_at")
        .eq("imobiliaria_id", user!.id).gte("created_at", dataInicioStr),
    ]);

    const corretores = corretoresRes.data || [];
    const compromissos = compromissosRes.data || [];
    const leads = leadsRes.data || [];
    const contratos = contratosRes.data || [];

    const stats: CorretorStats[] = corretores.map((c) => {
      const meus = compromissos.filter((comp) => comp.corretor_id === c.id);
      const visitas = meus.filter((comp) => comp.tipo === "visita").length;
      const reunioes = meus.filter((comp) => comp.tipo === "reuniao").length;
      const assinaturas = meus.filter((comp) => comp.tipo === "assinatura").length;
      const concluidos = meus.filter((comp) => comp.status === "concluido").length;
      const cancelados = meus.filter((comp) => comp.status === "cancelado").length;

      const meusLeads = leads.filter((l) => l.corretor_id === c.id);
      const leadsAtribuidos = meusLeads.length;
      const leadsFechados = meusLeads.filter((l) => l.estagio === "fechados").length;
      const taxaConversao = leadsAtribuidos > 0 ? (leadsFechados / leadsAtribuidos) * 100 : 0;

      const meusContratos = contratos.filter((ct) => ct.corretor_id === c.id);
      const contratosAtivos = meusContratos.filter((ct) => ct.status === "ativo").length;
      const valorContratos = meusContratos.reduce((sum, ct) => sum + Number(ct.valor || 0), 0);

      return {
        id: c.id,
        nome: c.nome,
        visitas,
        reunioes,
        assinaturas,
        leadsAtribuidos,
        leadsFechados,
        taxaConversao,
        contratosAtivos,
        valorContratos,
        compromissosConcluidos: concluidos,
        compromissosCancelados: cancelados,
      };
    });

    // Add "Sem corretor" for unassigned
    const semCorretor = {
      id: "sem-corretor",
      nome: "Sem corretor",
      visitas: compromissos.filter((c) => !c.corretor_id && c.tipo === "visita").length,
      reunioes: compromissos.filter((c) => !c.corretor_id && c.tipo === "reuniao").length,
      assinaturas: compromissos.filter((c) => !c.corretor_id && c.tipo === "assinatura").length,
      leadsAtribuidos: leads.filter((l) => !l.corretor_id).length,
      leadsFechados: leads.filter((l) => !l.corretor_id && l.estagio === "fechados").length,
      taxaConversao: 0,
      contratosAtivos: contratos.filter((c) => !c.corretor_id && c.status === "ativo").length,
      valorContratos: contratos.filter((c) => !c.corretor_id).reduce((s, c) => s + Number(c.valor || 0), 0),
      compromissosConcluidos: compromissos.filter((c) => !c.corretor_id && c.status === "concluido").length,
      compromissosCancelados: compromissos.filter((c) => !c.corretor_id && c.status === "cancelado").length,
    };
    semCorretor.taxaConversao = semCorretor.leadsAtribuidos > 0
      ? (semCorretor.leadsFechados / semCorretor.leadsAtribuidos) * 100 : 0;

    setCorretoresStats([...stats, semCorretor]);
    setLoading(false);
  };

  const filteredStats = useMemo(() => {
    if (corretorSelecionado === "todos") return corretoresStats;
    return corretoresStats.filter((c) => c.id === corretorSelecionado);
  }, [corretoresStats, corretorSelecionado]);

  const totals = useMemo(() => {
    return filteredStats.reduce(
      (acc, c) => ({
        visitas: acc.visitas + c.visitas,
        reunioes: acc.reunioes + c.reunioes,
        assinaturas: acc.assinaturas + c.assinaturas,
        leadsAtribuidos: acc.leadsAtribuidos + c.leadsAtribuidos,
        leadsFechados: acc.leadsFechados + c.leadsFechados,
        contratosAtivos: acc.contratosAtivos + c.contratosAtivos,
        valorContratos: acc.valorContratos + c.valorContratos,
      }),
      { visitas: 0, reunioes: 0, assinaturas: 0, leadsAtribuidos: 0, leadsFechados: 0, contratosAtivos: 0, valorContratos: 0 }
    );
  }, [filteredStats]);

  const taxaGeral = totals.leadsAtribuidos > 0
    ? ((totals.leadsFechados / totals.leadsAtribuidos) * 100).toFixed(1)
    : "0";

  // Chart data
  const barData = filteredStats
    .filter((c) => c.id !== "sem-corretor" || c.visitas + c.reunioes + c.assinaturas > 0)
    .map((c) => ({
      nome: c.nome.split(" ")[0],
      Visitas: c.visitas,
      Reuniões: c.reunioes,
      Assinaturas: c.assinaturas,
    }));

  const pieData = [
    { name: "Visitas", value: totals.visitas },
    { name: "Reuniões", value: totals.reunioes },
    { name: "Assinaturas", value: totals.assinaturas },
  ].filter((d) => d.value > 0);

  const conversionData = filteredStats
    .filter((c) => c.id !== "sem-corretor" || c.leadsAtribuidos > 0)
    .map((c) => ({
      nome: c.nome.split(" ")[0],
      "Taxa de Conversão": parseFloat(c.taxaConversao.toFixed(1)),
      "Leads Atribuídos": c.leadsAtribuidos,
      "Leads Fechados": c.leadsFechados,
    }));

  const radarData = filteredStats
    .filter((c) => c.id !== "sem-corretor")
    .slice(0, 5)
    .map((c) => ({
      corretor: c.nome.split(" ")[0],
      Visitas: c.visitas,
      Reuniões: c.reunioes,
      Contratos: c.contratosAtivos,
      Conversão: parseFloat(c.taxaConversao.toFixed(0)),
      Leads: c.leadsAtribuidos,
    }));

  const topCorretor = [...corretoresStats]
    .filter((c) => c.id !== "sem-corretor")
    .sort((a, b) => b.taxaConversao - a.taxaConversao)[0];

  return (
    <DashboardLayout>
      <SectionHeader
        title="Relatório de Produtividade"
        subtitle="Métricas de desempenho da equipe de corretores"
        action={
          <div className="flex gap-2">
            <Select value={periodo} onValueChange={setPeriodo}>
              <SelectTrigger className="w-[140px] bg-card border-border">
                <Filter className="w-4 h-4 mr-1 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
                <SelectItem value="365">Último ano</SelectItem>
              </SelectContent>
            </Select>
            <Select value={corretorSelecionado} onValueChange={setCorretorSelecionado}>
              <SelectTrigger className="w-[160px] bg-card border-border">
                <Users className="w-4 h-4 mr-1 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {corretoresStats.filter((c) => c.id !== "sem-corretor").map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard title="Visitas" value={String(totals.visitas)} icon={CalendarCheck} delay={0} />
            <MetricCard title="Reuniões" value={String(totals.reunioes)} icon={Handshake} delay={0.1} />
            <MetricCard title="Contratos" value={String(totals.contratosAtivos)} icon={FileSignature} delay={0.2} />
            <MetricCard
              title="Taxa Conversão"
              value={`${taxaGeral}%`}
              icon={Target}
              delay={0.3}
              change={topCorretor ? `🏆 ${topCorretor.nome.split(" ")[0]}: ${topCorretor.taxaConversao.toFixed(0)}%` : undefined}
              changeType="positive"
            />
          </div>

          {/* Secondary KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard title="Leads Atribuídos" value={String(totals.leadsAtribuidos)} icon={Users} delay={0.1} />
            <MetricCard title="Leads Fechados" value={String(totals.leadsFechados)} icon={Award} delay={0.15} />
            <MetricCard title="Assinaturas" value={String(totals.assinaturas)} icon={FileSignature} delay={0.2} />
            <MetricCard
              title="Valor Contratos"
              value={totals.valorContratos.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
              icon={TrendingUp}
              delay={0.25}
            />
          </div>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bar Chart - Atividades por Corretor */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-primary" />
                    Atividades por Corretor
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {barData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={barData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="nome" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                        <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                            color: "hsl(var(--foreground))",
                          }}
                        />
                        <Legend />
                        <Bar dataKey="Visitas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Reuniões" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Assinaturas" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
                      Nenhuma atividade no período selecionado
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Pie Chart - Distribuição */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Target className="w-4 h-4 text-primary" />
                    Distribuição de Atividades
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {pieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={4}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {pieData.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
                      Nenhuma atividade no período selecionado
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Radar Chart */}
          {radarData.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="col-span-1 lg:col-span-2">
              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Target className="w-4 h-4 text-primary" />
                    Perfil de Competências dos Corretores
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={350}>
                    <RadarChart data={[
                      { subject: "Visitas", ...Object.fromEntries(radarData.map(r => [r.corretor, r.Visitas])) },
                      { subject: "Reuniões", ...Object.fromEntries(radarData.map(r => [r.corretor, r.Reuniões])) },
                      { subject: "Contratos", ...Object.fromEntries(radarData.map(r => [r.corretor, r.Contratos])) },
                      { subject: "Conversão", ...Object.fromEntries(radarData.map(r => [r.corretor, r.Conversão])) },
                      { subject: "Leads", ...Object.fromEntries(radarData.map(r => [r.corretor, r.Leads])) },
                    ]}>
                      <PolarGrid stroke="hsl(var(--border))" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                      <PolarRadiusAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                      {radarData.map((r, i) => (
                        <Radar key={r.corretor} name={r.corretor} dataKey={r.corretor} stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.15} strokeWidth={2} />
                      ))}
                      <Legend />
                      <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--foreground))" }} />
                    </RadarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </motion.div>
          )}


          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Conversion Chart */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    Taxa de Conversão por Corretor
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {conversionData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={conversionData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="nome" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                        <YAxis yAxisId="left" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                        <YAxis yAxisId="right" orientation="right" unit="%" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                            color: "hsl(var(--foreground))",
                          }}
                        />
                        <Legend />
                        <Bar yAxisId="left" dataKey="Leads Atribuídos" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
                        <Bar yAxisId="left" dataKey="Leads Fechados" fill="hsl(var(--chart-5))" radius={[4, 4, 0, 0]} />
                        <Line yAxisId="right" type="monotone" dataKey="Taxa de Conversão" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
                      Nenhum lead no período selecionado
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Ranking */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Award className="w-4 h-4 text-primary" />
                    Ranking de Produtividade
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[...filteredStats]
                      .filter((c) => c.id !== "sem-corretor")
                      .sort((a, b) => {
                        const scoreA = a.visitas + a.reunioes * 2 + a.assinaturas * 5 + a.leadsFechados * 10;
                        const scoreB = b.visitas + b.reunioes * 2 + b.assinaturas * 5 + b.leadsFechados * 10;
                        return scoreB - scoreA;
                      })
                      .map((c, i) => {
                        const score = c.visitas + c.reunioes * 2 + c.assinaturas * 5 + c.leadsFechados * 10;
                        const medals = ["🥇", "🥈", "🥉"];
                        return (
                          <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
                            <div className="flex items-center gap-3">
                              <span className="text-lg">{medals[i] || `${i + 1}º`}</span>
                              <div>
                                <p className="text-sm font-medium text-foreground">{c.nome}</p>
                                <p className="text-xs text-muted-foreground">
                                  {c.visitas}V · {c.reunioes}R · {c.assinaturas}A · {c.leadsFechados}F
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <Badge variant="outline" className="text-xs">
                                {score} pts
                              </Badge>
                              <p className="text-xs text-muted-foreground mt-1">
                                {c.taxaConversao.toFixed(0)}% conv.
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    {filteredStats.filter((c) => c.id !== "sem-corretor").length === 0 && (
                      <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                        Nenhum corretor cadastrado
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default RelatorioProdutividade;
