import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { MetricCard } from "@/components/shared/MetricCard";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy, Medal, Star, Flame, Target, ChevronDown, ChevronUp,
  DollarSign, MapPin, Users, CalendarCheck, FileSignature, TrendingUp,
  BarChart3, Eye, Zap, Award
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend,
  AreaChart, Area
} from "recharts";

interface CorretorDesempenho {
  id: string;
  nome: string;
  leadsAtribuidos: number;
  leadsFechados: number;
  leadsNovos: number;
  visitas: number;
  reunioes: number;
  contratos: number;
  valorContratos: number;
  comissaoAcumulada: number;
  taxaConversao: number;
  pontuacao: number;
}

const PONTOS = { fechamento: 10, contrato: 8, visita: 3, reuniao: 2, lead: 1 };

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

const fmtCur = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

const RANK_CONFIGS = [
  { icon: Trophy, color: "text-yellow-500", bg: "bg-yellow-500/5 border-yellow-500/20", gradient: "linear-gradient(90deg, hsl(45,93%,47%), hsl(38,92%,50%))" },
  { icon: Medal, color: "text-gray-400", bg: "bg-gray-400/5 border-gray-400/20", gradient: "linear-gradient(90deg, hsl(0,0%,65%), hsl(0,0%,55%))" },
  { icon: Medal, color: "text-amber-700", bg: "bg-amber-700/5 border-amber-700/20", gradient: "linear-gradient(90deg, hsl(25,80%,40%), hsl(20,70%,35%))" },
];

export function CorretorDesempenhoTab() {
  const { user, imobiliariaId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState("30");
  const [corretorSelecionado, setCorretorSelecionado] = useState("todos");
  const [expanded, setExpanded] = useState(false);
  const [corretoresDesempenho, setCorretoresDesempenho] = useState<CorretorDesempenho[]>([]);

  useEffect(() => {
    if (!user) return;
    fetchData();
  }, [user, periodo]);

  const fetchData = async () => {
    setLoading(true);
    const dias = parseInt(periodo);
    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - dias);
    const dataInicioStr = dataInicio.toISOString();
    const resolvedId = imobiliariaId || user!.id;

    const [corretoresRes, leadsRes, compromissosRes, contratosRes, transacoesRes] = await Promise.all([
      supabase.from("corretores").select("id, nome").eq("imobiliaria_id", resolvedId).eq("status", "ativo"),
      supabase.from("leads").select("id, corretor_id, estagio, created_at").gte("created_at", dataInicioStr),
      supabase.from("compromissos").select("id, corretor_id, tipo, status, data_inicio").gte("data_inicio", dataInicioStr),
      supabase.from("contratos").select("id, corretor_id, corretor_nome, valor, comissao_valor, corretor_comissao_valor, status, created_at").gte("created_at", dataInicioStr),
      supabase.from("transacoes").select("id, corretor_nome, corretor_id, comissao_valor, tipo, categoria, status, data").eq("tipo", "saida").eq("categoria", "comissao").gte("data", dataInicioStr.split("T")[0]),
    ]);

    const corretores = corretoresRes.data || [];
    const leads = leadsRes.data || [];
    const compromissos = compromissosRes.data || [];
    const contratos = contratosRes.data || [];
    const transacoes = transacoesRes.data || [];

    const stats: CorretorDesempenho[] = corretores.map((c) => {
      const meusLeads = leads.filter((l) => l.corretor_id === c.id);
      const leadsFechados = meusLeads.filter((l) => l.estagio === "fechado").length;
      const leadsNovos = meusLeads.filter((l) => l.estagio === "novos").length;

      const meusComp = compromissos.filter((comp) => comp.corretor_id === c.id);
      const visitas = meusComp.filter((comp) => comp.tipo === "visita" && comp.status === "concluido").length;
      const reunioes = meusComp.filter((comp) => comp.tipo === "reuniao" && comp.status === "concluido").length;

      const meusContratos = contratos.filter((ct) => ct.corretor_id === c.id);
      const valorContratos = meusContratos.reduce((s, ct) => s + Number(ct.valor || 0), 0);

      // Comissão: from contratos + transações
      const comissaoContratos = meusContratos.reduce((s, ct) => s + Number(ct.corretor_comissao_valor || 0), 0);
      const comissaoTransacoes = transacoes
        .filter((t) => t.corretor_id === c.id || (t.corretor_nome && t.corretor_nome.toLowerCase() === c.nome.toLowerCase()))
        .reduce((s, t) => s + Number(t.comissao_valor || 0), 0);
      const comissaoAcumulada = Math.max(comissaoContratos, comissaoTransacoes);

      const taxaConversao = meusLeads.length > 0 ? (leadsFechados / meusLeads.length) * 100 : 0;

      const pontuacao =
        leadsFechados * PONTOS.fechamento +
        meusContratos.length * PONTOS.contrato +
        visitas * PONTOS.visita +
        reunioes * PONTOS.reuniao +
        meusLeads.length * PONTOS.lead;

      return {
        id: c.id,
        nome: c.nome,
        leadsAtribuidos: meusLeads.length,
        leadsFechados,
        leadsNovos,
        visitas,
        reunioes,
        contratos: meusContratos.length,
        valorContratos,
        comissaoAcumulada,
        taxaConversao,
        pontuacao,
      };
    });

    setCorretoresDesempenho(stats.sort((a, b) => b.pontuacao - a.pontuacao));
    setLoading(false);
  };

  const filtered = useMemo(() => {
    if (corretorSelecionado === "todos") return corretoresDesempenho;
    return corretoresDesempenho.filter((c) => c.id === corretorSelecionado);
  }, [corretoresDesempenho, corretorSelecionado]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, c) => ({
        visitas: acc.visitas + c.visitas,
        reunioes: acc.reunioes + c.reunioes,
        leads: acc.leads + c.leadsAtribuidos,
        fechados: acc.fechados + c.leadsFechados,
        contratos: acc.contratos + c.contratos,
        valorContratos: acc.valorContratos + c.valorContratos,
        comissao: acc.comissao + c.comissaoAcumulada,
      }),
      { visitas: 0, reunioes: 0, leads: 0, fechados: 0, contratos: 0, valorContratos: 0, comissao: 0 }
    );
  }, [filtered]);

  const taxaGeral = totals.leads > 0 ? ((totals.fechados / totals.leads) * 100).toFixed(1) : "0";
  const maxPts = Math.max(...corretoresDesempenho.map((r) => r.pontuacao), 1);
  const visible = expanded ? corretoresDesempenho : corretoresDesempenho.slice(0, 5);

  // Chart data
  const barData = filtered.map((c) => ({
    nome: c.nome.split(" ")[0],
    Visitas: c.visitas,
    Reuniões: c.reunioes,
    Fechamentos: c.leadsFechados,
    Contratos: c.contratos,
  }));

  const comissaoData = filtered.map((c) => ({
    nome: c.nome.split(" ")[0],
    "Comissão": c.comissaoAcumulada,
    "Valor Contratos": c.valorContratos,
  }));

  const radarData = corretoresDesempenho.slice(0, 5);
  const radarChartData = [
    { subject: "Visitas", ...Object.fromEntries(radarData.map((r) => [r.nome.split(" ")[0], r.visitas])) },
    { subject: "Reuniões", ...Object.fromEntries(radarData.map((r) => [r.nome.split(" ")[0], r.reunioes])) },
    { subject: "Contratos", ...Object.fromEntries(radarData.map((r) => [r.nome.split(" ")[0], r.contratos])) },
    { subject: "Conversão", ...Object.fromEntries(radarData.map((r) => [r.nome.split(" ")[0], Math.round(r.taxaConversao)])) },
    { subject: "Leads", ...Object.fromEntries(radarData.map((r) => [r.nome.split(" ")[0], r.leadsAtribuidos])) },
  ];

  const tooltipStyle = {
    backgroundColor: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
    color: "hsl(var(--foreground))",
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (corretoresDesempenho.length === 0) {
    return (
      <div className="glass-card p-12 text-center">
        <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground">Nenhum corretor ativo encontrado.</p>
        <p className="text-xs text-muted-foreground mt-1">Cadastre corretores na aba "Equipe" para ver o desempenho.</p>
      </div>
    );
  }

  const selectedCorretor = corretorSelecionado !== "todos"
    ? corretoresDesempenho.find((c) => c.id === corretorSelecionado)
    : null;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Select value={periodo} onValueChange={setPeriodo}>
          <SelectTrigger className="w-[140px] bg-card border-border">
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
          <SelectTrigger className="w-[180px] bg-card border-border">
            <Users className="w-4 h-4 mr-1 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os corretores</SelectItem>
            {corretoresDesempenho.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard title="Visitas Realizadas" value={String(totals.visitas)} icon={MapPin} delay={0} />
        <MetricCard title="Leads Convertidos" value={String(totals.fechados)} icon={Zap} delay={0.05} />
        <MetricCard title="Contratos Fechados" value={String(totals.contratos)} icon={FileSignature} delay={0.1} />
        <MetricCard title="Taxa Conversão" value={`${taxaGeral}%`} icon={Target} delay={0.15} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <MetricCard title="Comissão Acumulada" value={fmtCur(totals.comissao)} icon={DollarSign} delay={0.2} />
        <MetricCard title="Valor em Contratos" value={fmtCur(totals.valorContratos)} icon={TrendingUp} delay={0.25} />
        <MetricCard title="Total de Leads" value={String(totals.leads)} icon={Users} delay={0.3} />
      </div>

      {/* Individual Corretor Detail Card */}
      {selectedCorretor && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="glass-card glow-border">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Eye className="h-5 w-5 text-primary" />
                Detalhes — {selectedCorretor.nome}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Leads Atribuídos", value: selectedCorretor.leadsAtribuidos, emoji: "📋" },
                  { label: "Leads Novos", value: selectedCorretor.leadsNovos, emoji: "🆕" },
                  { label: "Leads Convertidos", value: selectedCorretor.leadsFechados, emoji: "✅" },
                  { label: "Taxa de Conversão", value: `${selectedCorretor.taxaConversao.toFixed(1)}%`, emoji: "📊" },
                  { label: "Visitas", value: selectedCorretor.visitas, emoji: "🏠" },
                  { label: "Reuniões", value: selectedCorretor.reunioes, emoji: "🤝" },
                  { label: "Contratos", value: selectedCorretor.contratos, emoji: "📝" },
                  { label: "Comissão", value: fmtCur(selectedCorretor.comissaoAcumulada), emoji: "💰" },
                ].map((item) => (
                  <div key={item.label} className="bg-muted/30 rounded-xl p-3 text-center">
                    <p className="text-lg mb-0.5">{item.emoji}</p>
                    <p className="text-lg font-bold text-foreground">{item.value}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{item.label}</p>
                  </div>
                ))}
              </div>

              {/* Meta progress bars */}
              <div className="mt-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Progresso de Metas</p>
                {[
                  { label: "Visitas", current: selectedCorretor.visitas, goal: 20 },
                  { label: "Conversões", current: selectedCorretor.leadsFechados, goal: 5 },
                  { label: "Contratos", current: selectedCorretor.contratos, goal: 3 },
                ].map((meta) => {
                  const pct = Math.min(100, Math.round((meta.current / meta.goal) * 100));
                  return (
                    <div key={meta.label} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{meta.label}</span>
                        <span className={`font-medium ${pct >= 100 ? "text-success" : pct >= 60 ? "text-warning" : "text-muted-foreground"}`}>
                          {meta.current}/{meta.goal} ({pct}%)
                        </span>
                      </div>
                      <Progress value={pct} className="h-2" />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Ranking */}
      <Card className="glass-card glow-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Flame className="h-5 w-5 text-orange-500" />
              Ranking de Desempenho
              <Badge variant="outline" className="text-[10px] ml-1">
                {periodo === "30" ? "Este mês" : periodo === "7" ? "7 dias" : periodo === "90" ? "90 dias" : "Ano"}
              </Badge>
            </CardTitle>
            <p className="text-[10px] text-muted-foreground">
              Fech={PONTOS.fechamento}pt • Contr={PONTOS.contrato}pt • Visita={PONTOS.visita}pt
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <AnimatePresence>
            {visible.map((corretor, i) => {
              const progressPct = Math.max((corretor.pontuacao / maxPts) * 100, 5);
              const rankCfg = RANK_CONFIGS[i] || null;
              const RankIcon = rankCfg?.icon || Star;
              return (
                <motion.div
                  key={corretor.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ delay: i * 0.06 }}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    rankCfg?.bg || "bg-secondary/50 border-border"
                  } ${corretorSelecionado === corretor.id ? "ring-2 ring-primary" : ""}`}
                  onClick={() => setCorretorSelecionado(
                    corretorSelecionado === corretor.id ? "todos" : corretor.id
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      <RankIcon className={`w-5 h-5 ${rankCfg?.color || "text-muted-foreground"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-foreground truncate">{corretor.nome}</span>
                        <span className="text-sm font-bold text-primary">{corretor.pontuacao}pts</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="text-[10px] text-muted-foreground">🏠 {corretor.visitas} visitas</span>
                        <span className="text-[10px] text-muted-foreground">✅ {corretor.leadsFechados} conv.</span>
                        <span className="text-[10px] text-muted-foreground">📝 {corretor.contratos} contr.</span>
                        {corretor.comissaoAcumulada > 0 && (
                          <span className="text-[10px] font-medium text-success">💰 {fmtCur(corretor.comissaoAcumulada)}</span>
                        )}
                        <span className="text-[10px] text-muted-foreground">📊 {corretor.taxaConversao.toFixed(0)}%</span>
                      </div>
                      <div className="relative h-2 rounded-full bg-secondary/50 mt-2 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${progressPct}%` }}
                          transition={{ duration: 0.8, delay: 0.1 + i * 0.08 }}
                          className="absolute inset-y-0 left-0 rounded-full"
                          style={{
                            background: rankCfg?.gradient || "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary)))",
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {corretoresDesempenho.length > 5 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full flex items-center justify-center gap-1 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {expanded ? "Ver menos" : `Ver todos (${corretoresDesempenho.length})`}
            </button>
          )}
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Atividades por Corretor */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
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
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend />
                    <Bar dataKey="Visitas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Reuniões" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Fechamentos" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Contratos" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
                  Nenhuma atividade no período
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Comissões */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-success" />
                Comissões Acumuladas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {comissaoData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={comissaoData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="nome" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtCur(v)} />
                    <Legend />
                    <Bar dataKey="Comissão" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Valor Contratos" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} opacity={0.5} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
                  Nenhuma comissão no período
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Radar Chart */}
      {radarData.length > 1 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Award className="w-4 h-4 text-primary" />
                Comparativo de Competências
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <RadarChart data={radarChartData}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                  <PolarRadiusAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                  {radarData.map((r, i) => (
                    <Radar
                      key={r.id}
                      name={r.nome.split(" ")[0]}
                      dataKey={r.nome.split(" ")[0]}
                      stroke={COLORS[i % COLORS.length]}
                      fill={COLORS[i % COLORS.length]}
                      fillOpacity={0.12}
                      strokeWidth={2}
                    />
                  ))}
                  <Legend />
                  <Tooltip contentStyle={tooltipStyle} />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Individual cards grid */}
      {corretorSelecionado === "todos" && corretoresDesempenho.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Fichas Individuais
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {corretoresDesempenho.map((c, i) => {
              const initials = c.nome.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
              const rankPos = i + 1;
              return (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className="glass-card p-4 space-y-3 cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all"
                  onClick={() => setCorretorSelecionado(c.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-semibold text-primary">
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground truncate">{c.nome}</p>
                        <Badge variant="outline" className="text-[10px]">{rankPos}º</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{c.pontuacao} pts</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-muted/30 rounded-lg p-2 text-center">
                      <p className="text-xs font-bold text-foreground">{c.visitas}</p>
                      <p className="text-[9px] text-muted-foreground">Visitas</p>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-2 text-center">
                      <p className="text-xs font-bold text-foreground">{c.leadsFechados}</p>
                      <p className="text-[9px] text-muted-foreground">Convertidos</p>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-2 text-center">
                      <p className="text-xs font-bold text-foreground">{c.contratos}</p>
                      <p className="text-[9px] text-muted-foreground">Contratos</p>
                    </div>
                    <div className="bg-success/5 rounded-lg p-2 text-center">
                      <p className="text-xs font-bold text-success">{fmtCur(c.comissaoAcumulada)}</p>
                      <p className="text-[9px] text-muted-foreground">Comissão</p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-muted-foreground">Conversão</span>
                      <span className="font-medium text-foreground">{c.taxaConversao.toFixed(0)}%</span>
                    </div>
                    <Progress value={Math.min(c.taxaConversao, 100)} className="h-1.5" />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
