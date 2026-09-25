import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { SectionHeader, MetricCard } from "@/components/shared/MetricCard";
import { motion } from "framer-motion";
import { Shield, Eye, Lock, Clock, AlertTriangle, Users, FileSignature, Building2, Loader2, BarChart3, TrendingUp } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow, startOfMonth, subMonths, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { SwCleanupTogglePanel } from "@/components/seguranca/SwCleanupTogglePanel";

const Seguranca = () => {
  const { user, imobiliariaId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalUsuarios: 0, contratosAtivos: 0, leadsTotal: 0, imoveisAtivos: 0 });
  const [monthlyData, setMonthlyData] = useState<{ leads: any[]; contratos: any[] }>({ leads: [], contratos: [] });

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      setLoading(true);
      const sixMonthsAgo = subMonths(new Date(), 5);
      const fromDate = startOfMonth(sixMonthsAgo).toISOString();

      const [logsRes, usersRes, contratosRes, leadsRes, imoveisRes, leadsMonthly, contratosMonthly] = await Promise.all([
        supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(30),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("contratos").select("id", { count: "exact", head: true }).in("status", ["ativo", "assinado"]),
        supabase.from("leads").select("id", { count: "exact", head: true }),
        supabase.from("imoveis").select("id", { count: "exact", head: true }).eq("status", "Ativo"),
        supabase.from("leads").select("created_at").gte("created_at", fromDate),
        supabase.from("contratos").select("created_at, tipo").gte("created_at", fromDate),
      ]);
      setAuditLogs(logsRes.data ?? []);
      setStats({
        totalUsuarios: usersRes.count ?? 0,
        contratosAtivos: contratosRes.count ?? 0,
        leadsTotal: leadsRes.count ?? 0,
        imoveisAtivos: imoveisRes.count ?? 0,
      });
      setMonthlyData({ leads: leadsMonthly.data ?? [], contratos: contratosMonthly.data ?? [] });
      setLoading(false);
    };
    fetchData();
  }, [user]);

  const growthChartData = useMemo(() => {
    const months: Record<string, { mes: string; leads: number; vendas: number; alugueis: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      const key = format(d, "yyyy-MM");
      months[key] = { mes: format(d, "MMM/yy", { locale: ptBR }), leads: 0, vendas: 0, alugueis: 0 };
    }
    monthlyData.leads.forEach(l => {
      const key = l.created_at?.slice(0, 7);
      if (key && months[key]) months[key].leads++;
    });
    monthlyData.contratos.forEach(c => {
      const key = c.created_at?.slice(0, 7);
      if (key && months[key]) {
        if (c.tipo === "Venda") months[key].vendas++;
        else months[key].alugueis++;
      }
    });
    return Object.values(months);
  }, [monthlyData]);

  const getLogIcon = (acao: string) => {
    if (acao.includes("permiss") || acao.includes("segur")) return <Shield className="w-4 h-4 text-warning" />;
    if (acao.includes("aprov") || acao.includes("bloq")) return <AlertTriangle className="w-4 h-4 text-destructive" />;
    return <Clock className="w-4 h-4 text-muted-foreground" />;
  };

  return (
    <DashboardLayout>
      <SectionHeader title="Segurança" subtitle="Controle de acesso, logs de atividade e métricas de negócio" />

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : (
        <>
          {/* Métricas de negócios — somente quantidades */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <MetricCard title="Usuários" value={String(stats.totalUsuarios)} icon={Users} delay={0} />
            <MetricCard title="Negociações Ativas" value={String(stats.contratosAtivos)} icon={FileSignature} delay={0.05} />
            <MetricCard title="Leads Total" value={String(stats.leadsTotal)} icon={BarChart3} delay={0.1} />
            <MetricCard title="Imóveis Ativos" value={String(stats.imoveisAtivos)} icon={Building2} delay={0.15} />
          </div>

          {/* Gráfico de crescimento */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Crescimento — Últimos 6 Meses</h3>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={growthChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12, color: "hsl(var(--foreground))" }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="leads" name="Leads" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="vendas" name="Vendas" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="alugueis" name="Aluguéis" fill="hsl(var(--info))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Resumo de acesso */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Lock className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Resumo de Acessos</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30">
                  <Shield className="w-5 h-5 text-primary" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">Usuários Cadastrados</p>
                    <p className="text-xs text-muted-foreground">Total de perfis no sistema</p>
                  </div>
                  <Badge variant="secondary" className="text-lg font-bold">{stats.totalUsuarios}</Badge>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30">
                  <FileSignature className="w-5 h-5 text-success" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">Negociações Ativas</p>
                    <p className="text-xs text-muted-foreground">Contratos assinados/ativos</p>
                  </div>
                  <Badge variant="secondary" className="text-lg font-bold">{stats.contratosAtivos}</Badge>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30">
                  <Building2 className="w-5 h-5 text-info" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">Imóveis Ativos</p>
                    <p className="text-xs text-muted-foreground">Carteira de imóveis disponíveis</p>
                  </div>
                  <Badge variant="secondary" className="text-lg font-bold">{stats.imoveisAtivos}</Badge>
                </div>
              </div>
            </motion.div>

            {/* Logs reais do audit_log */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Eye className="w-4 h-4 text-info" />
                <h3 className="text-sm font-semibold text-foreground">Log de Atividades</h3>
                <Badge variant="outline" className="ml-auto text-xs">{auditLogs.length} registros</Badge>
              </div>
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {auditLogs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhum log de atividade registrado.</p>
                ) : auditLogs.map((l) => (
                  <div key={l.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-secondary">
                      {getLogIcon(l.acao)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">
                        <span className="font-medium">{l.acao}</span>
                        {l.detalhes && <span className="text-muted-foreground"> · {l.detalhes}</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {l.modulo && <Badge variant="outline" className="text-[10px] mr-1">{l.modulo}</Badge>}
                        {formatDistanceToNow(new Date(l.created_at), { addSuffix: true, locale: ptBR })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          <div className="mt-6">
            <SwCleanupTogglePanel />
          </div>
        </>
      )}
    </DashboardLayout>
  );
};

export default Seguranca;