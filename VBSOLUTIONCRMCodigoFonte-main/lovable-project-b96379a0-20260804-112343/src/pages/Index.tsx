import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { DashboardSkeleton } from "@/components/shared/PageSkeletons";
import { MetasWidget } from "@/components/dashboard/MetasWidget";
import { LeadsLandingWidget } from "@/components/dashboard/LeadsLandingWidget";
import { AlertasContratosWidget } from "@/components/dashboard/AlertasContratosWidget";
import { PrevisaoReceitaWidget } from "@/components/dashboard/PrevisaoReceitaWidget";
import { VisitasPorBairroWidget } from "@/components/dashboard/VisitasPorBairroWidget";
import { SaudeCarteiraWidget } from "@/components/dashboard/SaudeCarteiraWidget";
import { ROICanalOrigemWidget } from "@/components/dashboard/ROICanalOrigemWidget";
import { MetasCorretorWidget } from "@/components/dashboard/MetasCorretorWidget";
import { ComparativoPeriodoWidget } from "@/components/dashboard/ComparativoPeriodoWidget";
import { GraficoEstagiosLeadsWidget } from "@/components/dashboard/GraficoEstagiosLeadsWidget";
import { MetricCard, SectionHeader, MaskProvider, MaskToggle } from "@/components/shared/MetricCard";
import { motion } from "framer-motion";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentCorretor } from "@/hooks/useCurrentCorretor";

import { useImobiliariaConfig } from "@/hooks/useImobiliariaConfig";
import { Home, Key, ExternalLink, Share2, Globe, MessageCircle, Crown, Clock, ArrowRight, Shield, Calendar, CalendarClock, Phone, User, Sparkles } from "lucide-react";
import {
  DollarSign,
  Users,
  Target,
  FileText,
  Loader2,
  CalendarDays,
  Download,
  ArrowUpRight,
  AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  ComposedChart,
  PieChart,
  Pie,
} from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
const loadExportToPDF = () => import("@/lib/exportPDF").then((m) => m.exportToPDF);
const loadExportRelatorioMensalPDF = () => import("@/lib/exportRelatorioMensalPDF").then((m) => m.exportRelatorioMensalPDF);

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const ESTAGIO_LABELS: Record<string, string> = {
  novos: "Novos",
  qualificados: "Qualificados",
  visita: "Visita",
  proposta: "Proposta",
  pediu_tempo: "Pediu Tempo",
  quer_alugar: "Quer Alugar",
  nao_responde: "Não Responde",
  fechado: "Fechado",
  perdido: "Perdido",
};

const ESTAGIO_COLORS: Record<string, string> = {
  novos: "hsl(199, 89%, 48%)",
  qualificados: "hsl(38, 92%, 50%)",
  visita: "hsl(262, 83%, 58%)",
  proposta: "hsl(142, 71%, 45%)",
  pediu_tempo: "hsl(25, 95%, 53%)",
  quer_alugar: "hsl(180, 70%, 45%)",
  nao_responde: "hsl(0, 0%, 55%)",
  fechado: "hsl(45, 93%, 47%)",
  perdido: "hsl(0, 72%, 51%)",
};

const chartTooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "12px",
  color: "hsl(var(--foreground))",
  boxShadow: "0 8px 32px -8px rgba(0,0,0,0.12)",
  padding: "12px 16px",
  fontSize: "13px",
};

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const formatCompact = (v: number) => {
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(0)}k`;
  return String(v);
};

type Periodo = "mes" | "trimestre" | "semestre" | "ano";
const DASHBOARD_HISTORY_MONTHS = 12;

function getDateRange(periodo: Periodo): { start: Date; monthsBack: number } {
  const now = new Date();
  switch (periodo) {
    case "mes": return { start: new Date(now.getFullYear(), now.getMonth(), 1), monthsBack: 1 };
    case "trimestre": return { start: new Date(now.getFullYear(), now.getMonth() - 2, 1), monthsBack: 3 };
    case "semestre": return { start: new Date(now.getFullYear(), now.getMonth() - 5, 1), monthsBack: 6 };
    case "ano": return { start: new Date(now.getFullYear(), now.getMonth() - 11, 1), monthsBack: 12 };
  }
}

const PERIODO_LABELS: Record<Periodo, string> = {
  mes: "Este mês",
  trimestre: "Trimestre",
  semestre: "Semestre",
  ano: "Ano",
};

function getDashboardHistoryStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - (DASHBOARD_HISTORY_MONTHS - 1), 1);
}

const Dashboard = () => {
  const { user, plano, trialDaysLeft, trialExpired, isMaster } = useAuth();
  const { corretorId, isBroker, ready: brokerReady } = useCurrentCorretor();

  const { nome_empresa } = useImobiliariaConfig();
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<Periodo>("semestre");
  const [corretoresCount, setCorretoresCount] = useState(0);
  const [corretoresAtivos, setCorretoresAtivos] = useState<{ nome: string; email: string | null }[]>([]);
  const [leads, setLeads] = useState<{ estagio: string; valor: number; created_at: string; updated_at: string }[]>([]);
  const [transacoes, setTransacoes] = useState<{ tipo: string; valor: number; data: string; status: string; categoria: string; comissao_valor: number; parceiro_comissao_valor: number; captador_comissao_valor: number; corretor_nome: string | null; parceiro_nome: string | null; captador_nome: string | null }[]>([]);
  const [contratos, setContratos] = useState<{ tipo: string; valor: number; data_inicio: string | null; created_at: string; comissao_valor: number | null; corretor_comissao_valor: number | null; parceiro_comissao_valor: number | null; captador_comissao_valor: number | null; imposto_valor: number | null; status: string }[]>([]);
  const [contratosCount, setContratosCount] = useState(0);
  const [contratosVendaCount, setContratosVendaCount] = useState(0);
  const [contratosAluguelCount, setContratosAluguelCount] = useState(0);
  const [compromissosHoje, setCompromissosHoje] = useState<{ titulo: string; tipo: string; data_inicio: string; status: string; lead_nome?: string }[]>([]);
  const [followupsPendentes, setFollowupsPendentes] = useState(0);
  const [followupsLista, setFollowupsLista] = useState<{ id: string; data_followup: string; tipo: string; descricao: string | null; lead_nome: string; lead_telefone: string | null }[]>([]);
  const [compromissosPendentes, setCompromissosPendentes] = useState(0);
  const [resumoDiario, setResumoDiario] = useState<string | null>(null);
  const [resumoLoading, setResumoLoading] = useState(false);
  const [showResumo, setShowResumo] = useState(false);

  useEffect(() => {
    if (!user) return;
    // Aguarda a resolução do papel do corretor para não disparar consultas
    // não filtradas antes de sabermos se é broker.
    if (!brokerReady) return;

    let isActive = true;
    const historyStart = getDashboardHistoryStart();
    const historyStartDateTime = historyStart.toISOString();
    const historyStartDate = historyStartDateTime.split("T")[0];

    const fetchData = async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);

      try {
        
        setLoading(true);
        const hoje = new Date().toISOString().split("T")[0];

        // Helper: aplica filtro por corretor quando o usuário é broker.
        const scopeCorretor = <T,>(q: T, column = "corretor_id"): T => {
          if (isBroker && corretorId) {
            return (q as any).eq(column, corretorId);
          }
          return q;
        };

        // Followups: filtro via inner join no lead (não há corretor_id direto).
        const followupsSelect = isBroker && corretorId
          ? "id, data_followup, tipo, descricao, leads!inner(nome, telefone, corretor_id)"
          : "id, data_followup, tipo, descricao, leads(nome, telefone)";
        const followupsCountSelect = isBroker && corretorId ? "id, leads!inner(corretor_id)" : "id";

        let leadsQ = supabase.from("leads").select("id, estagio, valor, created_at, updated_at, corretor_id").gte("created_at", historyStartDateTime).order("created_at", { ascending: false }).abortSignal(controller.signal);
        leadsQ = scopeCorretor(leadsQ);

        let transacoesQ = supabase.from("transacoes").select("id, tipo, valor, data, status, categoria, comissao_valor, parceiro_comissao_valor, captador_comissao_valor, corretor_nome, parceiro_nome, captador_nome, corretor_id").gte("data", historyStartDate).order("data", { ascending: false }).abortSignal(controller.signal);
        transacoesQ = scopeCorretor(transacoesQ);

        let contratosQ = supabase.from("contratos").select("id, tipo, valor, data_inicio, created_at, status, comissao_valor, corretor_comissao_valor, parceiro_comissao_valor, captador_comissao_valor, imposto_valor, corretor_id").order("created_at", { ascending: false }).abortSignal(controller.signal);
        contratosQ = scopeCorretor(contratosQ);

        let compromissosQ = supabase.from("compromissos").select("titulo, tipo, data_inicio, status, corretor_id, leads(nome)").gte("data_inicio", `${hoje}T00:00:00`).lte("data_inicio", `${hoje}T23:59:59`).order("data_inicio").abortSignal(controller.signal);
        compromissosQ = scopeCorretor(compromissosQ);

        let followupsCountQ = supabase.from("followups").select(followupsCountSelect, { count: "exact", head: true }).eq("status", "pendente").abortSignal(controller.signal);
        if (isBroker && corretorId) {
          followupsCountQ = (followupsCountQ as any).eq("leads.corretor_id", corretorId);
        }

        let followupsListaQ = supabase.from("followups").select(followupsSelect).eq("status", "pendente").order("data_followup", { ascending: true }).limit(10).abortSignal(controller.signal);
        if (isBroker && corretorId) {
          followupsListaQ = (followupsListaQ as any).eq("leads.corretor_id", corretorId);
        }

        const [corretoresRes, topRes, leadsRes, transacoesRes, contratosRes, compromissosRes, followupsRes, followupsListaRes] = await Promise.all([
          supabase.from("corretores").select("id", { count: "exact", head: true }).abortSignal(controller.signal),
          supabase.from("corretores").select("nome, email").eq("status", "ativo").limit(4).abortSignal(controller.signal),
          leadsQ,
          transacoesQ,
          contratosQ,
          compromissosQ,
          followupsCountQ,
          followupsListaQ,
        ]);

        clearTimeout(timeout);

        if (!isActive) return;

        const contratosData = (contratosRes.data ?? []) as any[];
        setCorretoresCount(corretoresRes.count ?? 0);
        setCorretoresAtivos(topRes.data ?? []);
        setLeads((leadsRes.data ?? []) as any);
        setTransacoes((transacoesRes.data ?? []) as any);
        setContratos(contratosData as any);
        setContratosCount(contratosData.length);
        setContratosVendaCount(contratosData.filter((c) => c.tipo === "Venda").length);
        setContratosAluguelCount(contratosData.filter((c) => c.tipo === "Locação").length);
        setCompromissosHoje((compromissosRes.data ?? []).map((c: any) => ({ ...c, lead_nome: c.leads?.nome })));
        setCompromissosPendentes((compromissosRes.data ?? []).filter((c: any) => c.status === "pendente").length);
        setFollowupsPendentes(followupsRes.count ?? 0);
        setFollowupsLista((followupsListaRes.data ?? []).map((f: any) => ({
          id: f.id,
          data_followup: f.data_followup,
          tipo: f.tipo,
          descricao: f.descricao,
          lead_nome: f.leads?.nome ?? "Lead removido",
          lead_telefone: f.leads?.telefone ?? null,
        })));
      } finally {
        if (isActive) {
          setLoading(false);
          
        }
      }
    };

    fetchData();

    return () => {
      isActive = false;
    };
  }, [user, brokerReady, isBroker, corretorId]);


  const { start, monthsBack } = getDateRange(periodo);

  const filteredTransacoes = useMemo(() =>
    transacoes.filter(t => new Date(t.data) >= start),
    [transacoes, start]
  );

  const filteredLeads = useMemo(() =>
    leads.filter(l => new Date(l.created_at) >= start),
    [leads, start]
  );

  // Revenue chart: Receita Bruta, Aluguel Bruto, Aluguel Líquido, Vendas Bruta, Comissão Líquida
  const revenueData = useMemo(() => {
    const now = new Date();
    const data: { month: string; receitaBruta: number; aluguelBruto: number; aluguelLiquido: number; vendasBruta: number; comissaoLiquida: number }[] = [];
    for (let i = monthsBack - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const m = d.getMonth();
      const y = d.getFullYear();
      const monthTx = transacoes.filter(t => {
        const td = new Date(t.data);
        return td.getMonth() === m && td.getFullYear() === y && t.tipo === "entrada" && t.status === "confirmado";
      });
      const receitaBruta = monthTx.reduce((s, t) => s + t.valor, 0);
      const aluguelTx = monthTx.filter(t => t.categoria === "aluguel");
      const aluguelBruto = aluguelTx.reduce((s, t) => s + t.valor, 0);
      const aluguelLiquido = aluguelTx.reduce((s, t) => s + t.valor - (t.comissao_valor || 0) - (t.parceiro_comissao_valor || 0) - (t.captador_comissao_valor || 0), 0);
      const vendasBruta = monthTx.filter(t => t.categoria === "comissao" || t.categoria === "repasse").reduce((s, t) => s + t.valor, 0);
      const comissaoLiquida = monthTx.reduce((s, t) => s + t.valor - (t.comissao_valor || 0) - (t.parceiro_comissao_valor || 0) - (t.captador_comissao_valor || 0), 0);
      data.push({ month: MESES[m], receitaBruta, aluguelBruto, aluguelLiquido, vendasBruta, comissaoLiquida });
    }
    return data;
  }, [transacoes, monthsBack]);

  // Pipeline funnel
  const funnelStages = ["novos", "qualificados", "visita", "proposta", "pediu_tempo", "quer_alugar", "nao_responde", "fechado"];
  const pipelineData = useMemo(() => {
    return funnelStages.map(s => ({
      id: s,
      name: ESTAGIO_LABELS[s] || s,
      value: filteredLeads.filter(l => l.estagio === s).length,
      color: ESTAGIO_COLORS[s] || "hsl(var(--muted-foreground))",
    }));
  }, [filteredLeads]);

  const perdidosCount = useMemo(() => filteredLeads.filter(l => l.estagio === "perdido").length, [filteredLeads]);
  const maxFunnelValue = useMemo(() => Math.max(...pipelineData.map(d => d.value), 1), [pipelineData]);

  // Metrics
  const metrics = useMemo(() => {
    const entradasConfirmadas = filteredTransacoes.filter(t => t.tipo === "entrada" && t.status === "confirmado");
    const receita = entradasConfirmadas.reduce((s, t) => s + t.valor, 0);
    // Total Vendas e Aluguel = valor dos CONTRATOS (valor total do negócio)
    const contratosAtivos = contratos.filter(c => c.status !== "cancelado");
    const vendas = contratosAtivos.filter(c => c.tipo === "Venda");
    const locacoes = contratosAtivos.filter(c => c.tipo === "Locação");
    const receitaVendas = vendas.reduce((s, c) => s + (Number(c.valor) || 0), 0);
    const receitaAluguel = locacoes.reduce((s, c) => s + (Number(c.valor) || 0), 0);

    const statusRecebido = ["ativo", "assinado"];

    // Comissão bruta dos contratos
    const comissaoLiquidaVenda = vendas.reduce((s, c) => s + (Number(c.comissao_valor) || 0), 0);
    const receitaAluguelLiquida = locacoes.reduce((s, c) => s + (Number(c.comissao_valor) || 0), 0);

    // Comissão recebida (contratos ativos/assinados)
    const comissaoRecebidaVenda = vendas.filter(c => statusRecebido.includes(c.status)).reduce((s, c) => s + (Number(c.comissao_valor) || 0), 0);
    const comissaoRecebidaAluguel = locacoes.filter(c => statusRecebido.includes(c.status)).reduce((s, c) => s + (Number(c.comissao_valor) || 0), 0);

    // Deduções separadas
    const totalCorretor = contratosAtivos.reduce((s, c) => s + (Number(c.corretor_comissao_valor) || 0), 0);
    const totalParceiro = contratosAtivos.reduce((s, c) => s + (Number(c.parceiro_comissao_valor) || 0), 0);
    const totalCaptador = contratosAtivos.reduce((s, c) => s + (Number(c.captador_comissao_valor) || 0), 0);
    const despesaTotal = filteredTransacoes.filter(t => t.tipo === "saida" && t.status === "confirmado").reduce((s, t) => s + t.valor, 0);
    const totalLeads = filteredLeads.length;
    const fechados = filteredLeads.filter(l => l.estagio === "fechado").length;
    const conversao = totalLeads > 0 ? ((fechados / totalLeads) * 100).toFixed(1) : "0";
    return { receita, receitaVendas, comissaoLiquidaVenda, receitaAluguel, receitaAluguelLiquida, comissaoRecebidaVenda, comissaoRecebidaAluguel, totalCorretor, totalParceiro, totalCaptador, despesaTotal, totalLeads, fechados, conversao, novos: filteredLeads.filter(l => l.estagio === "novos").length };
  }, [filteredTransacoes, filteredLeads, contratos]);

  // Current month metrics for goals
  const metasCurrentValues = useMemo(() => {
    const now = new Date();
    const mesAtual = now.getMonth();
    const anoAtual = now.getFullYear();
    const leadsMes = leads.filter(l => {
      const d = new Date(l.created_at);
      return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
    });
    const txMes = transacoes.filter(t => {
      const d = new Date(t.data);
      return d.getMonth() === mesAtual && d.getFullYear() === anoAtual && t.tipo === "entrada" && t.status === "confirmado";
    });
    const receitaMes = txMes.reduce((s, t) => s + t.valor, 0);
    const fechadosMes = leadsMes.filter(l => l.estagio === "fechado").length;
    const conversaoMes = leadsMes.length > 0 ? Math.round((fechadosMes / leadsMes.length) * 100) : 0;
    return { leadsMes: leadsMes.length, receitaMes, contratosMes: fechadosMes, conversaoMes };
  }, [leads, transacoes]);

  // Comparativo período atual vs anterior
  const comparativoData = useMemo(() => {
    const now = new Date();
    const mesAtual = now.getMonth();
    const anoAtual = now.getFullYear();
    const mesAnterior = mesAtual === 0 ? 11 : mesAtual - 1;
    const anoAnterior = mesAtual === 0 ? anoAtual - 1 : anoAtual;

    const filterByMonth = <T extends { data?: string; created_at?: string }>(arr: T[], m: number, y: number, dateKey: "data" | "created_at") =>
      arr.filter(item => {
        const d = new Date((item as any)[dateKey]);
        return d.getMonth() === m && d.getFullYear() === y;
      });

    const txAtual = filterByMonth(transacoes, mesAtual, anoAtual, "data");
    const txAnterior = filterByMonth(transacoes, mesAnterior, anoAnterior, "data");
    const leadsAtual = filterByMonth(leads as any[], mesAtual, anoAtual, "created_at");
    const leadsAnterior = filterByMonth(leads as any[], mesAnterior, anoAnterior, "created_at");
    const contratosAtual = filterByMonth(contratos as any[], mesAtual, anoAtual, "created_at");
    const contratosAnterior = filterByMonth(contratos as any[], mesAnterior, anoAnterior, "created_at");

    const calcReceita = (tx: typeof transacoes) => tx.filter(t => t.tipo === "entrada" && t.status === "confirmado").reduce((s, t) => s + t.valor, 0);
    const calcDespesas = (tx: typeof transacoes) => tx.filter(t => t.tipo === "saida" && t.status === "confirmado").reduce((s, t) => s + t.valor, 0);

    return {
      current: { label: `${MESES[mesAtual]}/${anoAtual}`, receita: calcReceita(txAtual), despesas: calcDespesas(txAtual), leads: leadsAtual.length, contratos: contratosAtual.length },
      previous: { label: `${MESES[mesAnterior]}/${anoAnterior}`, receita: calcReceita(txAnterior), despesas: calcDespesas(txAnterior), leads: leadsAnterior.length, contratos: contratosAnterior.length },
    };
  }, [transacoes, leads, contratos]);

  // Sparkline data & MoM trends for metric cards
  const sparklines = useMemo(() => {
    const now = new Date();
    const months = 6;
    const vendasSpark: number[] = [];
    const aluguelSpark: number[] = [];
    const despesaSpark: number[] = [];
    const leadsSpark: number[] = [];

    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const m = d.getMonth();
      const y = d.getFullYear();
      const monthTx = transacoes.filter(t => {
        const td = new Date(t.data);
        return td.getMonth() === m && td.getFullYear() === y && t.status === "confirmado";
      });
      vendasSpark.push(monthTx.filter(t => t.tipo === "entrada" && (t.categoria === "comissao" || t.categoria === "repasse")).reduce((s, t) => s + t.valor, 0));
      aluguelSpark.push(monthTx.filter(t => t.tipo === "entrada" && t.categoria === "aluguel").reduce((s, t) => s + t.valor, 0));
      despesaSpark.push(monthTx.filter(t => t.tipo === "saida").reduce((s, t) => s + t.valor, 0));
      leadsSpark.push(leads.filter(l => {
        const ld = new Date(l.created_at);
        return ld.getMonth() === m && ld.getFullYear() === y;
      }).length);
    }

    const calcTrend = (arr: number[]) => {
      if (arr.length < 2) return 0;
      const curr = arr[arr.length - 1];
      const prev = arr[arr.length - 2];
      if (prev === 0) return curr > 0 ? 100 : 0;
      return ((curr - prev) / prev) * 100;
    };

    return {
      vendasSpark, aluguelSpark, despesaSpark, leadsSpark,
      vendasTrend: calcTrend(vendasSpark),
      aluguelTrend: calcTrend(aluguelSpark),
      despesaTrend: calcTrend(despesaSpark),
      leadsTrend: calcTrend(leadsSpark),
    };
  }, [transacoes, leads]);

  // Despesas por categoria
  const despesasPorCategoria = useMemo(() => {
    const catMap = new Map<string, number>();
    const CATEGORIAS_LABEL: Record<string, string> = {
      combustivel: "Combustível", manutencao_carro: "Manutenção Carro", pagamento_imobiliaria: "Pag. Imobiliária",
      pagamento_estagiaria: "Pag. Estagiária", facebook_ads: "Facebook Ads", google_ads: "Google Ads",
      faixa: "Faixa", material_marketing: "Marketing", plataformas: "Plataformas", outros: "Outros",
      despesa: "Despesa Geral", comissao: "Comissão", aluguel: "Aluguel", repasse: "Repasse",
    };
    const COLORS = ["hsl(199, 89%, 48%)", "hsl(262, 83%, 58%)", "hsl(38, 92%, 50%)", "hsl(142, 71%, 45%)", "hsl(0, 72%, 51%)", "hsl(25, 95%, 53%)", "hsl(180, 70%, 45%)", "hsl(340, 82%, 52%)"];
    filteredTransacoes.filter(t => t.tipo === "saida" && t.status === "confirmado").forEach(t => {
      catMap.set(t.categoria, (catMap.get(t.categoria) || 0) + t.valor);
    });
    return Array.from(catMap.entries())
      .map(([cat, valor], i) => ({ name: CATEGORIAS_LABEL[cat] || cat, value: valor, fill: COLORS[i % COLORS.length] }))
      .sort((a, b) => b.value - a.value);
  }, [filteredTransacoes]);

  // Monthly leads performance (captured vs closed)
  const leadsPerformanceData = useMemo(() => {
    const now = new Date();
    const data: { month: string; captados: number; fechados: number; conversao: number }[] = [];
    for (let i = monthsBack - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const m = d.getMonth();
      const y = d.getFullYear();
      const monthLeads = leads.filter(l => {
        const ld = new Date(l.created_at);
        return ld.getMonth() === m && ld.getFullYear() === y;
      });
      const captados = monthLeads.length;
      const fechados = monthLeads.filter(l => l.estagio === "fechado").length;
      const conversao = captados > 0 ? Math.round((fechados / captados) * 100) : 0;
      data.push({ month: MESES[m], captados, fechados, conversao });
    }
    return data;
  }, [leads, monthsBack]);

  // Financial comparison (receita vs despesa vs saldo)
  const financeComparisonData = useMemo(() => {
    const now = new Date();
    const data: { month: string; receita: number; despesa: number; saldo: number }[] = [];
    for (let i = monthsBack - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const m = d.getMonth();
      const y = d.getFullYear();
      const monthTx = transacoes.filter(t => {
        const td = new Date(t.data);
        return td.getMonth() === m && td.getFullYear() === y && t.status === "confirmado";
      });
      const receita = monthTx.filter(t => t.tipo === "entrada").reduce((s, t) => s + t.valor, 0);
      const despesa = monthTx.filter(t => t.tipo === "saida").reduce((s, t) => s + t.valor, 0);
      data.push({ month: MESES[m], receita, despesa, saldo: receita - despesa });
    }
    return data;
  }, [transacoes, monthsBack]);

  // Average conversion time per stage (days from created_at to updated_at)
  const conversionTimeData = useMemo(() => {
    const stages = ["novos", "qualificados", "visita", "proposta", "pediu_tempo", "fechado"];
    return stages.map(stage => {
      const stageLeads = leads.filter(l => l.estagio === stage);
      if (stageLeads.length === 0) return { stage: ESTAGIO_LABELS[stage] || stage, dias: 0, color: ESTAGIO_COLORS[stage] };
      const totalDays = stageLeads.reduce((sum, l) => {
        const created = new Date(l.created_at).getTime();
        const updated = new Date(l.updated_at).getTime();
        return sum + Math.max(0, (updated - created) / (1000 * 60 * 60 * 24));
      }, 0);
      return {
        stage: ESTAGIO_LABELS[stage] || stage,
        dias: Math.round((totalDays / stageLeads.length) * 10) / 10,
        color: ESTAGIO_COLORS[stage],
      };
    });
  }, [leads]);

  const handleExportDashboard = async () => {
    const exportToPDF = await loadExportToPDF();

    exportToPDF({
      brandName: nome_empresa || undefined,
      title: `Relatório Dashboard - ${PERIODO_LABELS[periodo]}`,
      subtitle: `Gerado em ${new Date().toLocaleDateString("pt-BR")}`,
      columns: [
        { header: "Métrica", dataKey: "metrica" },
        { header: "Valor", dataKey: "valor" },
      ],
      data: [
        { metrica: "Receita (confirmada)", valor: formatCurrency(metrics.receita) },
        { metrica: "Total de Leads", valor: String(metrics.totalLeads) },
        { metrica: "Leads Novos", valor: String(metrics.novos) },
        { metrica: "Leads Fechados", valor: String(metrics.fechados) },
        { metrica: "Taxa de Conversão", valor: `${metrics.conversao}%` },
        { metrica: "Contratos", valor: String(contratosCount) },
        { metrica: "Corretores", valor: String(corretoresCount) },
        { metrica: "Compromissos Hoje", valor: String(compromissosHoje.length) },
        { metrica: "Follow-ups Pendentes", valor: String(followupsPendentes) },
      ],
      summary: [
        { label: "Receita", value: formatCurrency(metrics.receita) },
        { label: "Leads", value: String(metrics.totalLeads) },
        { label: "Conversão", value: `${metrics.conversao}%` },
        { label: "Contratos", value: String(contratosCount) },
        { label: "Agenda Hoje", value: String(compromissosHoje.length) },
      ],
    });
  };

  const handleExportUnified = async () => {
    const exportToPDF = await loadExportToPDF();
    const estagioMap: Record<string, string> = {
      novos: "Novos", qualificados: "Qualificados", visita: "Visita",
      proposta: "Proposta", fechado: "Fechado", perdido: "Perdido"
    };
    const leadsByStage = ["novos", "qualificados", "visita", "proposta", "fechado", "perdido"].map(s => ({
      estagio: estagioMap[s] || s,
      quantidade: String(filteredLeads.filter(l => l.estagio === s).length),
      valor: formatCurrency(filteredLeads.filter(l => l.estagio === s).reduce((sum, l) => sum + l.valor, 0)),
    }));

    const receitaConfirmada = filteredTransacoes.filter(t => t.tipo === "entrada" && t.status === "confirmado").reduce((s, t) => s + t.valor, 0);
    const despesaConfirmada = filteredTransacoes.filter(t => t.tipo === "saida" && t.status === "confirmado").reduce((s, t) => s + t.valor, 0);

    exportToPDF({
      brandName: nome_empresa || undefined,
      title: `Relatório Unificado - ${PERIODO_LABELS[periodo]}`,
      subtitle: `Gerado em ${new Date().toLocaleDateString("pt-BR")} • Leads + Financeiro + Agenda`,
      columns: [
        { header: "Estágio", dataKey: "estagio" },
        { header: "Qtd", dataKey: "quantidade" },
        { header: "Valor", dataKey: "valor" },
      ],
      data: leadsByStage,
      summary: [
        { label: "Receita Total", value: formatCurrency(receitaConfirmada) },
        { label: "Despesa Total", value: formatCurrency(despesaConfirmada) },
        { label: "Saldo Líquido", value: formatCurrency(receitaConfirmada - despesaConfirmada) },
        { label: "Total Leads", value: String(filteredLeads.length) },
        { label: "Conversão", value: `${metrics.conversao}%` },
        { label: "Contratos", value: String(contratosCount) },
        { label: "Compromissos Hoje", value: String(compromissosHoje.length) },
        { label: "Follow-ups Pendentes", value: String(followupsPendentes) },
      ],
    });
  };

  const handleExportMensal = async () => {
    const exportRelatorioMensalPDF = await loadExportRelatorioMensalPDF();
    const ESTAGIO_MAP: Record<string, string> = { novos: "Novos", qualificados: "Qualificados", visita: "Visita", proposta: "Proposta", pediu_tempo: "Pediu Tempo", fechado: "Fechado", perdido: "Perdido" };
    const now = new Date();
    const mesLabel = `${MESES[now.getMonth()]} ${now.getFullYear()}`;
    const receitaTotal = filteredTransacoes.filter(t => t.tipo === "entrada" && t.status === "confirmado").reduce((s, t) => s + t.valor, 0);
    const receitaVendas = filteredTransacoes.filter(t => t.tipo === "entrada" && t.status === "confirmado" && (t.categoria === "comissao" || t.categoria === "repasse")).reduce((s, t) => s + t.valor, 0);
    const receitaAluguel = filteredTransacoes.filter(t => t.tipo === "entrada" && t.status === "confirmado" && t.categoria === "aluguel").reduce((s, t) => s + t.valor, 0);
    const despesas = filteredTransacoes.filter(t => t.tipo === "saida" && t.status === "confirmado").reduce((s, t) => s + t.valor, 0);

    exportRelatorioMensalPDF({
      periodo: mesLabel,
      nomeEmpresa: nome_empresa || "",
      leads: {
        total: metrics.totalLeads,
        novos: metrics.novos,
        fechados: metrics.fechados,
        perdidos: filteredLeads.filter(l => l.estagio === "perdido").length,
        conversao: String(metrics.conversao),
      },
      receita: { total: receitaTotal, vendas: receitaVendas, aluguel: receitaAluguel, despesas, saldo: receitaTotal - despesas },
      contratos: contratosCount,
      corretores: corretoresCount,
      followupsPendentes,
      compromissosRealizados: compromissosHoje.length,
      topEstagios: ["novos", "qualificados", "visita", "proposta", "pediu_tempo", "fechado", "perdido"].map(s => ({
        nome: ESTAGIO_MAP[s] || s,
        qtd: filteredLeads.filter(l => l.estagio === s).length,
      })).filter(e => e.qtd > 0),
    });
  };

  const podeUsarResumoIA = isMaster || ["profissional", "premium"].includes(plano);

  const handleResumoDiario = async () => {
    if (!podeUsarResumoIA) {
      setResumoDiario("Funcionalidade exclusiva do plano Corretor PRO. Solicite o upgrade ao administrador.");
      setShowResumo(true);
      return;
    }
    setResumoLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("resumo-diario", {
        body: { imobiliaria_id: user?.id },
      });
      if (error) throw error;
      setResumoDiario(data?.resumo_ia || "Resumo não disponível.");
      setShowResumo(true);
    } catch (err: any) {
      console.error("Erro resumo:", err);
    } finally {
      setResumoLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <MaskProvider>
      <div className="space-y-6">
        <SectionHeader
          title="Dashboard"
          subtitle="Visão geral da sua imobiliária"
          action={
            <div className="flex items-center gap-2 flex-wrap">
              <MaskToggle />
              <button onClick={handleExportMensal} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Relatório Mensal</span>
              </button>
              <button onClick={handleExportUnified} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary text-foreground text-sm font-medium hover:bg-secondary/80 transition-colors border border-border">
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Unificado</span>
              </button>
              <button onClick={handleResumoDiario} disabled={resumoLoading} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/80 transition-colors border border-border">
                {resumoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                <span className="hidden sm:inline">Resumo IA</span>
              </button>
              <CalendarDays className="w-4 h-4 text-muted-foreground" />
              <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
                <SelectTrigger className="w-[140px] h-9 bg-secondary border-border text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PERIODO_LABELS) as Periodo[]).map(p => (
                    <SelectItem key={p} value={p}>{PERIODO_LABELS[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          }
        />

        {loading ? (
          <DashboardSkeleton />
        ) : (
          <>
            {/* Plan & Trial Card */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="glass-card p-4 glow-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isMaster ? "bg-primary/15" : plano === "gratuito" ? "bg-amber-500/15" : "bg-primary/15"}`}>
                  {isMaster ? <Shield className="w-5 h-5 text-primary" /> : plano === "gratuito" ? <Clock className="w-5 h-5 text-amber-500" /> : <Crown className="w-5 h-5 text-primary" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {isMaster ? "Plano Master" : plano === "gratuito" ? "Plano Gratuito (Trial)" : `Plano ${plano.charAt(0).toUpperCase() + plano.slice(1)}`}
                    </span>
                    <Badge variant="default" className="text-[10px] px-2 py-0">
                      {isMaster ? "Master" : plano === "gratuito" ? "Trial" : "Ativo"}
                    </Badge>
                  </div>
                  {isMaster && (
                    <p className="text-xs text-muted-foreground mt-0.5">Acesso ilimitado a todas as funcionalidades</p>
                  )}
                  {!isMaster && plano === "gratuito" && trialDaysLeft !== null && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {trialExpired
                        ? "Seu período de teste expirou"
                        : `${trialDaysLeft} ${trialDaysLeft === 1 ? "dia restante" : "dias restantes"} do teste grátis`}
                    </p>
                  )}
                  {!isMaster && plano !== "gratuito" && (
                    <p className="text-xs text-muted-foreground mt-0.5">Acesso completo a todas as funcionalidades</p>
                  )}
                </div>
              </div>
              {!isMaster && plano === "gratuito" && trialDaysLeft !== null && !trialExpired && (
                <div className="flex items-center gap-3">
                  <div className="w-full sm:w-48">
                    <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                      <span>Trial</span>
                      <span>{trialDaysLeft}/7 dias</span>
                    </div>
                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${trialDaysLeft <= 5 ? "bg-amber-500" : "bg-primary"}`}
                        style={{ width: `${(trialDaysLeft / 7) * 100}%` }}
                      />
                    </div>
                  </div>
                  {trialDaysLeft <= 10 && (
                    <Button asChild size="sm" className="shrink-0 bg-gradient-to-r from-primary to-blue-600 text-primary-foreground">
                      <Link to="/landing#planos">
                        Fazer Upgrade <ArrowRight className="w-3.5 h-3.5 ml-1" />
                      </Link>
                    </Button>
                  )}
                </div>
              )}
              {!isMaster && plano === "gratuito" && trialExpired && (
                <Button asChild size="sm" className="shrink-0 bg-gradient-to-r from-primary to-blue-600 text-primary-foreground">
                  <Link to="/landing#planos">
                    Escolher Plano <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Link>
                </Button>
              )}
            </motion.div>


            {/* Premium Metric Cards */}
            <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
              <MetricCard title="Total Vendas" value={formatCurrency(metrics.receitaVendas)} change={`${contratosVendaCount} contratos venda`} changeType="positive" icon={Home} delay={0} trend={sparklines.vendasTrend} sparkData={sparklines.vendasSpark} />
              <MetricCard title="Total Aluguel" value={formatCurrency(metrics.receitaAluguel)} change={`${contratosAluguelCount} contratos aluguel`} changeType="positive" icon={Key} delay={0.05} trend={sparklines.aluguelTrend} sparkData={sparklines.aluguelSpark} />
              <MetricCard title="Despesa Total" value={formatCurrency(metrics.despesaTotal)} change="Confirmadas" changeType="negative" icon={ArrowUpRight} delay={0.1} trend={sparklines.despesaTrend} sparkData={sparklines.despesaSpark} />
            </div>
            <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              <MetricCard title="Comissão Venda" value={formatCurrency(metrics.comissaoLiquidaVenda)} change="Total bruto" changeType="positive" icon={DollarSign} delay={0.12} sparkData={sparklines.vendasSpark} />
              <MetricCard title="Recebida Venda" value={formatCurrency(metrics.comissaoRecebidaVenda)} change="Recebido" changeType="positive" icon={DollarSign} delay={0.14} />
              <MetricCard title="Comissão Aluguel" value={formatCurrency(metrics.receitaAluguelLiquida)} change="Total bruto" changeType="positive" icon={DollarSign} delay={0.16} sparkData={sparklines.aluguelSpark} />
              <MetricCard title="Recebida Aluguel" value={formatCurrency(metrics.comissaoRecebidaAluguel)} change="Recebido" changeType="positive" icon={DollarSign} delay={0.18} />
            </div>
            <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              <MetricCard title="Leads" value={String(metrics.totalLeads)} change={`${metrics.novos} novos`} changeType="neutral" icon={Users} delay={0.22} trend={sparklines.leadsTrend} sparkData={sparklines.leadsSpark} />
              <MetricCard title="Contratos Venda" value={String(contratosVendaCount)} change={`de ${contratosCount} total`} changeType="neutral" icon={FileText} delay={0.24} />
              <MetricCard title="Contratos Aluguel" value={String(contratosAluguelCount)} change={`de ${contratosCount} total`} changeType="neutral" icon={FileText} delay={0.26} />
              <MetricCard title="Conversão" value={`${metrics.conversao}%`} change={`${metrics.fechados} fechados`} changeType="positive" icon={Target} delay={0.28} />
            </div>
            <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              <MetricCard title="Corretor" value={formatCurrency(metrics.totalCorretor)} change="Total comissões corretor" changeType="neutral" icon={Users} delay={0.3} />
              <MetricCard title="Agenda Hoje" value={String(compromissosHoje.length)} change={`${compromissosPendentes} pendentes`} changeType={compromissosPendentes > 0 ? "negative" : "neutral"} icon={Calendar} delay={0.32} />
              <MetricCard title="Follow-ups" value={String(followupsPendentes)} change="Pendentes" changeType={followupsPendentes > 0 ? "negative" : "neutral"} icon={CalendarClock} delay={0.34} />
            </div>

            <AlertasContratosWidget />

            <PrevisaoReceitaWidget />

            {/* Metas do Mês */}
            <MetasWidget
              currentLeads={metasCurrentValues.leadsMes}
              currentReceita={metasCurrentValues.receitaMes}
              currentContratos={metasCurrentValues.contratosMes}
              currentConversao={metasCurrentValues.conversaoMes}
            />

            {compromissosHoje.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38 }} className="glass-card p-5 md:p-6 glow-border">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-primary" />
                    <div>
                      <h3 className="text-base font-semibold text-foreground">Agenda de Hoje</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{compromissosHoje.length} compromisso{compromissosHoje.length > 1 ? "s" : ""}</p>
                    </div>
                  </div>
                  <Link to="/agenda" className="text-xs font-medium text-primary hover:underline flex items-center gap-1">
                    Ver agenda <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {compromissosHoje.slice(0, 6).map((c, i) => {
                    const hora = new Date(c.data_inicio).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
                    return (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50 hover:bg-secondary/80 transition-all">
                        <div className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded-lg">{hora}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{c.titulo}</p>
                          {c.lead_nome && <p className="text-[11px] text-muted-foreground truncate">{c.lead_nome}</p>}
                        </div>
                        <div className={`w-2 h-2 rounded-full ${c.status === "concluido" ? "bg-primary" : c.status === "pendente" ? "bg-amber-500" : "bg-muted-foreground"}`} />
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* Lembretes de Follow-up */}
            {followupsLista.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.39 }} className="glass-card p-5 md:p-6 glow-border">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <CalendarClock className="w-5 h-5 text-amber-500" />
                    <div>
                      <h3 className="text-base font-semibold text-foreground">Lembretes de Follow-up</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{followupsPendentes} pendente{followupsPendentes > 1 ? "s" : ""}</p>
                    </div>
                  </div>
                  <Link to="/followups" className="text-xs font-medium text-primary hover:underline flex items-center gap-1">
                    Ver todos <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {followupsLista.slice(0, 6).map((f, i) => {
                    const dataFollowup = new Date(f.data_followup + "T12:00:00");
                    const hoje = new Date();
                    hoje.setHours(0, 0, 0, 0);
                    const isAtrasado = dataFollowup < hoje;
                    const isHoje = dataFollowup.toDateString() === hoje.toDateString();
                    const dataFormatada = dataFollowup.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
                    
                    const TIPO_ICONS_MAP: Record<string, string> = {
                      ligacao: "📞", whatsapp: "💬", email: "📧", visita: "🏠", reuniao: "🤝", outro: "📌",
                    };
                    const TIPO_LABELS_MAP: Record<string, string> = {
                      ligacao: "Ligação", whatsapp: "WhatsApp", email: "E-mail", visita: "Visita", reuniao: "Reunião", outro: "Outro",
                    };

                    return (
                      <div
                        key={f.id}
                        className={`flex items-center gap-3 p-3 rounded-xl transition-all border ${
                          isAtrasado
                            ? "bg-destructive/5 border-destructive/20 hover:bg-destructive/10"
                            : isHoje
                            ? "bg-amber-500/5 border-amber-500/20 hover:bg-amber-500/10"
                            : "bg-secondary/50 border-border hover:bg-secondary/80"
                        }`}
                      >
                        <div className={`text-lg flex-shrink-0`}>{TIPO_ICONS_MAP[f.tipo] || "📌"}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <User className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                            <p className="text-sm font-medium text-foreground truncate">{f.lead_nome}</p>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                              isAtrasado ? "bg-destructive/10 text-destructive" : isHoje ? "bg-amber-500/10 text-amber-600" : "bg-muted text-muted-foreground"
                            }`}>
                              {isAtrasado ? `⚠️ ${dataFormatada}` : isHoje ? `🔔 Hoje` : dataFormatada}
                            </span>
                            <span className="text-[10px] text-muted-foreground">{TIPO_LABELS_MAP[f.tipo] || f.tipo}</span>
                          </div>
                          {f.descricao && <p className="text-[11px] text-muted-foreground mt-1 truncate">{f.descricao}</p>}
                        </div>
                        {f.lead_telefone && (
                          <a
                            href={`https://wa.me/55${f.lead_telefone.replace(/\D/g, "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg bg-green-500/10 text-green-600 hover:bg-green-500/20 transition-colors flex-shrink-0"
                            title="WhatsApp"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
                {followupsPendentes > 6 && (
                  <div className="mt-3 text-center">
                    <Link to="/followups" className="text-xs font-medium text-primary hover:underline">
                      + {followupsPendentes - 6} follow-ups pendentes
                    </Link>
                  </div>
                )}
              </motion.div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass-card p-5 md:p-6 glow-border lg:col-span-2">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-base font-semibold text-foreground">Receita Detalhada</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{PERIODO_LABELS[periodo]} • Bruta, Vendas, Aluguel, Líquido</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-primary" /><span className="text-[10px] text-muted-foreground">Bruta</span></div>
                    <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full" style={{ background: "hsl(220, 70%, 50%)" }} /><span className="text-[10px] text-muted-foreground">Vendas</span></div>
                    <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full" style={{ background: "hsl(38, 92%, 50%)" }} /><span className="text-[10px] text-muted-foreground">Aluguel</span></div>
                    <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full" style={{ background: "hsl(142, 71%, 45%)" }} /><span className="text-[10px] text-muted-foreground">Alug.Líq</span></div>
                    <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full" style={{ background: "hsl(262, 83%, 58%)" }} /><span className="text-[10px] text-muted-foreground">Com.Líq</span></div>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={revenueData}>
                    <defs>
                      <linearGradient id="gradBruta" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" opacity={0.5} />
                    <XAxis dataKey="month" className="fill-muted-foreground" fontSize={12} axisLine={false} tickLine={false} />
                    <YAxis className="fill-muted-foreground" fontSize={11} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompact(v)} />
                    <Tooltip contentStyle={chartTooltipStyle} formatter={(value: number, name: string) => {
                      const labels: Record<string, string> = { receitaBruta: "Receita Bruta", vendasBruta: "Vendas Bruta", aluguelBruto: "Aluguel Bruto", aluguelLiquido: "Aluguel Líquido", comissaoLiquida: "Comissão Líquida" };
                      return [formatCurrency(value), labels[name] || name];
                    }} />
                    <Area type="monotone" dataKey="receitaBruta" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#gradBruta)" dot={false} activeDot={{ r: 5, strokeWidth: 2, fill: "hsl(var(--card))" }} />
                    <Area type="monotone" dataKey="vendasBruta" stroke="hsl(220, 70%, 50%)" strokeWidth={2} fill="none" dot={false} strokeDasharray="5 3" />
                    <Area type="monotone" dataKey="aluguelBruto" stroke="hsl(38, 92%, 50%)" strokeWidth={2} fill="none" dot={false} />
                    <Area type="monotone" dataKey="aluguelLiquido" stroke="hsl(142, 71%, 45%)" strokeWidth={2} fill="none" dot={false} />
                    <Area type="monotone" dataKey="comissaoLiquida" stroke="hsl(262, 83%, 58%)" strokeWidth={2} fill="none" dot={false} strokeDasharray="3 3" />
                  </ComposedChart>
                </ResponsiveContainer>
              </motion.div>

              {/* Pie Chart - Proporção Vendas vs Aluguel */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="glass-card p-5 md:p-6 glow-border flex flex-col">
                <div className="mb-4">
                  <h3 className="text-base font-semibold text-foreground">Distribuição de Receita</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Bruta vs Líquida vs Deduções</p>
                </div>
                {metrics.receita === 0 ? (
                  <div className="flex-1 flex items-center justify-center">
                    <p className="text-sm text-muted-foreground">Sem dados no período</p>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center">
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: "Com. Líq. Venda", value: Math.max(0, metrics.comissaoLiquidaVenda), fill: "hsl(220, 70%, 50%)" },
                            { name: "Aluguel Líquido", value: Math.max(0, metrics.receitaAluguelLiquida), fill: "hsl(142, 71%, 45%)" },
                            { name: "Corretor", value: metrics.totalCorretor, fill: "hsl(199, 89%, 48%)" },
                            { name: "Parceiro", value: metrics.totalParceiro, fill: "hsl(38, 92%, 50%)" },
                            { name: "Captador", value: metrics.totalCaptador, fill: "hsl(262, 83%, 58%)" },
                          ].filter(d => d.value > 0)}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={3}
                          dataKey="value"
                          strokeWidth={0}
                        >
                          {[
                            { name: "Com. Líq. Venda", value: Math.max(0, metrics.comissaoLiquidaVenda), fill: "hsl(220, 70%, 50%)" },
                            { name: "Aluguel Líquido", value: Math.max(0, metrics.receitaAluguelLiquida), fill: "hsl(142, 71%, 45%)" },
                            { name: "Corretor", value: metrics.totalCorretor, fill: "hsl(199, 89%, 48%)" },
                            { name: "Parceiro", value: metrics.totalParceiro, fill: "hsl(38, 92%, 50%)" },
                            { name: "Captador", value: metrics.totalCaptador, fill: "hsl(262, 83%, 58%)" },
                          ].filter(d => d.value > 0).map((entry, index) => (
                            <Cell key={index} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={chartTooltipStyle} formatter={(value: number) => [formatCurrency(value)]} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex items-center gap-3 flex-wrap justify-center mt-2">
                      {[
                        { label: "Líq.Venda", color: "hsl(220, 70%, 50%)", value: metrics.comissaoLiquidaVenda },
                        { label: "Alug.Líq", color: "hsl(142, 71%, 45%)", value: metrics.receitaAluguelLiquida },
                        { label: "Corretor", color: "hsl(199, 89%, 48%)", value: metrics.totalCorretor },
                        { label: "Parceiro", color: "hsl(38, 92%, 50%)", value: metrics.totalParceiro },
                        { label: "Captador", color: "hsl(262, 83%, 58%)", value: metrics.totalCaptador },
                      ].filter(d => d.value > 0).map(d => (
                        <div key={d.label} className="text-center">
                          <div className="flex items-center gap-1 mb-0.5">
                            <div className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                            <span className="text-[10px] text-muted-foreground">{d.label}</span>
                          </div>
                          <span className="text-xs font-semibold text-foreground">{formatCurrency(d.value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            </div>

            {/* Funnel Section - Full Width */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="glass-card p-4 md:p-5 glow-border">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-3">
                <div>
                  <h3 className="text-base font-semibold text-foreground">Funil de Vendas</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{filteredLeads.length} leads no período • Conversão: {metrics.conversao}%</p>
                </div>
                <div className="flex items-center gap-2">
                  {perdidosCount > 0 && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-destructive/10">
                      <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                      <span className="text-xs font-medium text-destructive">{perdidosCount} perdidos</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10">
                    <Target className="w-3.5 h-3.5 text-primary" />
                    <span className="text-xs font-semibold text-primary">{metrics.conversao}%</span>
                  </div>
                </div>
              </div>

              {pipelineData.every(d => d.value === 0) && perdidosCount === 0 ? (
                <p className="text-sm text-muted-foreground py-12 text-center">Nenhum lead no período.</p>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left: Visual SVG Funnel - Compact */}
                  <div className="flex flex-col items-center gap-0 max-w-sm mx-auto w-full">
                    {pipelineData.map((item, i) => {
                      const totalStages = pipelineData.length;
                      const topWidth = 100 - (i * (55 / totalStages));
                      const bottomWidth = 100 - ((i + 1) * (55 / totalStages));
                      const pct = filteredLeads.length > 0 ? Math.round((item.value / filteredLeads.length) * 100) : 0;
                      const convFromPrev = i > 0 && pipelineData[i - 1].value > 0
                        ? Math.round((item.value / pipelineData[i - 1].value) * 100)
                        : null;

                      return (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, scaleY: 0 }}
                          animate={{ opacity: 1, scaleY: 1 }}
                          transition={{ delay: 0.6 + i * 0.12, duration: 0.4, ease: "easeOut" }}
                          className="w-full relative group"
                          style={{ originY: 0 }}
                        >
                          {convFromPrev !== null && (
                            <div className="absolute -top-1 right-2 sm:right-4 z-10">
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-background/80 border border-border text-muted-foreground shadow-sm">
                                ↓ {convFromPrev}%
                              </span>
                            </div>
                          )}
                          <svg viewBox="0 0 200 38" className="w-full" style={{ display: "block", marginBottom: "-1px" }}>
                            <defs>
                              <linearGradient id={`funnel-grad-${item.id}`} x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor={item.color} stopOpacity={0.9} />
                                <stop offset="50%" stopColor={item.color} stopOpacity={1} />
                                <stop offset="100%" stopColor={item.color} stopOpacity={0.9} />
                              </linearGradient>
                              <filter id={`funnel-shadow-${i}`}>
                                <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor={item.color} floodOpacity="0.3" />
                              </filter>
                            </defs>
                            <polygon
                              points={`${100 - topWidth} 0, ${100 + topWidth} 0, ${100 + bottomWidth} 38, ${100 - bottomWidth} 38`}
                              fill={`url(#funnel-grad-${item.id})`}
                              filter={`url(#funnel-shadow-${i})`}
                              className="transition-all duration-300 group-hover:brightness-110"
                            />
                            <text x="100" y="17" textAnchor="middle" className="fill-white text-[10px] font-semibold" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.3)" }}>
                              {item.name}
                            </text>
                            <text x="100" y="30" textAnchor="middle" className="fill-white/80 text-[9px] font-medium">
                              {item.value} leads ({pct}%)
                            </text>
                          </svg>
                        </motion.div>
                      );
                    })}
                    {perdidosCount > 0 && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1.2 }}
                        className="flex items-center gap-2 mt-4 px-4 py-2 rounded-full bg-destructive/10 border border-destructive/20"
                      >
                        <div className="w-2.5 h-2.5 rounded-full bg-destructive animate-pulse" />
                        <span className="text-xs font-semibold text-destructive">
                          {perdidosCount} perdidos ({filteredLeads.length > 0 ? Math.round((perdidosCount / filteredLeads.length) * 100) : 0}%)
                        </span>
                      </motion.div>
                    )}
                  </div>

                  {/* Right: Horizontal bar funnel with conversion rates */}
                  <div className="space-y-3">
                    {pipelineData.map((item, i) => {
                      const widthPct = maxFunnelValue > 0 ? Math.max((item.value / maxFunnelValue) * 100, 8) : 8;
                      const pct = filteredLeads.length > 0 ? Math.round((item.value / filteredLeads.length) * 100) : 0;
                      const convFromPrev = i > 0 && pipelineData[i - 1].value > 0
                        ? Math.round((item.value / pipelineData[i - 1].value) * 100)
                        : null;
                      return (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.6 + i * 0.08 }}
                          className="group"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-semibold text-foreground">{item.name}</span>
                            <div className="flex items-center gap-2">
                              {convFromPrev !== null && (
                                <span className="text-[10px] text-muted-foreground">↓ {convFromPrev}%</span>
                              )}
                              <span className="text-xs font-bold" style={{ color: item.color }}>{item.value}</span>
                            </div>
                          </div>
                          <div className="relative h-8 rounded-lg bg-secondary/50 overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${widthPct}%` }}
                              transition={{ duration: 0.8, delay: 0.7 + i * 0.08, ease: "easeOut" }}
                              className="absolute inset-y-0 left-0 rounded-lg flex items-center justify-end px-3 transition-shadow group-hover:shadow-lg"
                              style={{
                                background: `linear-gradient(135deg, ${item.color}, ${item.color}cc)`,
                                minWidth: "32px",
                              }}
                            >
                              <span className="text-[10px] font-bold text-white drop-shadow-sm">{pct}%</span>
                            </motion.div>
                          </div>
                        </motion.div>
                      );
                    })}
                    {perdidosCount > 0 && (
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 1 }}
                        className="group"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] font-semibold text-destructive">Perdidos</span>
                          <span className="text-xs font-bold text-destructive">{perdidosCount}</span>
                        </div>
                        <div className="relative h-8 rounded-lg bg-secondary/50 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.max((perdidosCount / maxFunnelValue) * 100, 8)}%` }}
                            transition={{ duration: 0.8, delay: 1, ease: "easeOut" }}
                            className="absolute inset-y-0 left-0 rounded-lg flex items-center justify-end px-3"
                            style={{
                              background: "linear-gradient(135deg, hsl(0, 72%, 51%), hsl(0, 72%, 41%))",
                              minWidth: "32px",
                            }}
                          >
                            <span className="text-[10px] font-bold text-white drop-shadow-sm">
                              {filteredLeads.length > 0 ? Math.round((perdidosCount / filteredLeads.length) * 100) : 0}%
                            </span>
                          </motion.div>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>

            {/* Gráfico de Distribuição por Estágio */}
            <GraficoEstagiosLeadsWidget leads={filteredLeads} />

            {/* Desempenho Mensal de Leads + Comparativo Financeiro */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Desempenho Mensal */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }} className="glass-card p-5 md:p-6 glow-border">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h3 className="text-base font-semibold text-foreground">Desempenho Mensal</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Leads captados vs fechados por mês</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full" style={{ background: "hsl(199, 89%, 48%)" }} />
                      <span className="text-xs text-muted-foreground">Captados</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full" style={{ background: "hsl(142, 71%, 45%)" }} />
                      <span className="text-xs text-muted-foreground">Fechados</span>
                    </div>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={260}>
                  <ComposedChart data={leadsPerformanceData}>
                    <defs>
                      <linearGradient id="gradCaptados" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(199, 89%, 48%)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="hsl(199, 89%, 48%)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" opacity={0.5} />
                    <XAxis dataKey="month" className="fill-muted-foreground" fontSize={12} axisLine={false} tickLine={false} />
                    <YAxis className="fill-muted-foreground" fontSize={11} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={chartTooltipStyle}
                      formatter={(value: number, name: string) => [
                        value,
                        name === "captados" ? "Captados" : name === "fechados" ? "Fechados" : "Conversão %",
                      ]}
                    />
                    <Area type="monotone" dataKey="captados" stroke="hsl(199, 89%, 48%)" strokeWidth={2} fill="url(#gradCaptados)" dot={false} />
                    <Bar dataKey="fechados" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} barSize={20} opacity={0.85} name="fechados" />
                  </ComposedChart>
                </ResponsiveContainer>
                {/* Conversion rate badges */}
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  {leadsPerformanceData.filter(d => d.captados > 0).slice(-4).map((d, i) => (
                    <span
                      key={i}
                      className={`text-[10px] font-semibold px-2 py-1 rounded-full ${
                        d.conversao >= 30 ? "bg-primary/10 text-primary" :
                        d.conversao >= 15 ? "bg-amber-500/10 text-amber-600" :
                        "bg-destructive/10 text-destructive"
                      }`}
                    >
                      {d.month}: {d.conversao}% conv.
                    </span>
                  ))}
                </div>
              </motion.div>

              {/* Comparativo Financeiro */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="glass-card p-5 md:p-6 glow-border">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h3 className="text-base font-semibold text-foreground">Comparativo Financeiro</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Receita vs Despesa • Saldo líquido</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full" style={{ background: "hsl(142, 71%, 45%)" }} />
                      <span className="text-xs text-muted-foreground">Receita</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full" style={{ background: "hsl(0, 72%, 51%)" }} />
                      <span className="text-xs text-muted-foreground">Despesa</span>
                    </div>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={260}>
                  <ComposedChart data={financeComparisonData}>
                    <defs>
                      <linearGradient id="gradReceita" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="gradDespesa" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" opacity={0.5} />
                    <XAxis dataKey="month" className="fill-muted-foreground" fontSize={12} axisLine={false} tickLine={false} />
                    <YAxis className="fill-muted-foreground" fontSize={11} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompact(v)} />
                    <Tooltip
                      contentStyle={chartTooltipStyle}
                      formatter={(value: number, name: string) => [
                        formatCurrency(value),
                        name === "receita" ? "Receita" : name === "despesa" ? "Despesa" : "Saldo",
                      ]}
                    />
                    <Area type="monotone" dataKey="receita" stroke="hsl(142, 71%, 45%)" strokeWidth={2.5} fill="url(#gradReceita)" dot={false} activeDot={{ r: 5, strokeWidth: 2, fill: "hsl(var(--card))" }} />
                    <Area type="monotone" dataKey="despesa" stroke="hsl(0, 72%, 51%)" strokeWidth={2} fill="url(#gradDespesa)" dot={false} activeDot={{ r: 5, strokeWidth: 2, fill: "hsl(var(--card))" }} />
                    <Bar dataKey="saldo" radius={[4, 4, 0, 0]} barSize={16} name="saldo">
                      {financeComparisonData.map((entry, index) => (
                        <Cell
                          key={index}
                          fill={entry.saldo >= 0 ? "hsl(142, 71%, 45%)" : "hsl(0, 72%, 51%)"}
                          opacity={0.6}
                        />
                      ))}
                    </Bar>
                  </ComposedChart>
                </ResponsiveContainer>
                {/* Saldo summary */}
                <div className="flex items-center justify-between mt-3 px-1">
                  <div className="text-center">
                    <p className="text-[10px] text-muted-foreground">Total Receita</p>
                    <p className="text-sm font-bold text-primary">{formatCurrency(metrics.receita)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-muted-foreground">Total Despesa</p>
                    <p className="text-sm font-bold text-destructive">{formatCurrency(metrics.despesaTotal)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-muted-foreground">Saldo Líquido</p>
                    <p className={`text-sm font-bold ${metrics.receita - metrics.despesaTotal >= 0 ? "text-primary" : "text-destructive"}`}>
                      {formatCurrency(metrics.receita - metrics.despesaTotal)}
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Despesas por Categoria */}
            {despesasPorCategoria.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.62 }} className="glass-card p-5 md:p-6 glow-border">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h3 className="text-base font-semibold text-foreground">Despesas por Categoria</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{despesasPorCategoria.length} categorias no período</p>
                  </div>
                  <span className="text-sm font-bold text-destructive">{formatCurrency(metrics.despesaTotal)}</span>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={despesasPorCategoria}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                        strokeWidth={0}
                      >
                        {despesasPorCategoria.map((entry, index) => (
                          <Cell key={index} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={chartTooltipStyle} formatter={(value: number) => [formatCurrency(value)]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 flex flex-col justify-center">
                    {despesasPorCategoria.slice(0, 8).map((cat, i) => {
                      const pct = metrics.despesaTotal > 0 ? Math.round((cat.value / metrics.despesaTotal) * 100) : 0;
                      return (
                        <div key={i} className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: cat.fill }} />
                          <span className="text-xs text-foreground flex-1 truncate">{cat.name}</span>
                          <span className="text-xs font-semibold text-foreground">{formatCurrency(cat.value)}</span>
                          <span className="text-[10px] text-muted-foreground w-8 text-right">{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Tempo Médio de Conversão por Estágio */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }} className="glass-card p-5 md:p-6 glow-border">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-base font-semibold text-foreground">Tempo Médio por Estágio</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Dias médios que leads permanecem em cada estágio</p>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10">
                  <Clock className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-semibold text-primary">
                    {conversionTimeData.reduce((s, d) => s + d.dias, 0).toFixed(0)}d total
                  </span>
                </div>
              </div>
              {conversionTimeData.every(d => d.dias === 0) ? (
                <p className="text-sm text-muted-foreground py-12 text-center">Sem dados suficientes para calcular.</p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={conversionTimeData} layout="vertical" barGap={0}>
                      <defs>
                        {conversionTimeData.map((d, i) => (
                          <linearGradient key={i} id={`convGrad-${i}`} x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor={d.color} stopOpacity={0.85} />
                            <stop offset="100%" stopColor={d.color} stopOpacity={1} />
                          </linearGradient>
                        ))}
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} opacity={0.5} />
                      <XAxis type="number" className="fill-muted-foreground" fontSize={11} axisLine={false} tickLine={false} unit="d" />
                      <YAxis dataKey="stage" type="category" className="fill-muted-foreground" fontSize={11} width={85} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={chartTooltipStyle}
                        formatter={(value: number) => [`${value} dias`, "Tempo médio"]}
                      />
                      <Bar dataKey="dias" name="Dias" radius={[0, 6, 6, 0]} barSize={22}>
                        {conversionTimeData.map((_, i) => (
                          <Cell key={i} fill={`url(#convGrad-${i})`} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    {conversionTimeData.filter(d => d.dias > 0).map((d, i) => (
                      <span
                        key={i}
                        className="text-[10px] font-semibold px-2 py-1 rounded-full"
                        style={{ background: `${d.color}15`, color: d.color }}
                      >
                        {d.stage}: {d.dias}d
                      </span>
                    ))}
                  </div>
                </>
              )}
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }} className="glass-card p-5 md:p-6 glow-border">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-semibold text-foreground">Leads por Estágio</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Visão detalhada</p>
                  </div>
                  <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10">
                    <ArrowUpRight className="w-3.5 h-3.5 text-primary" />
                    <span className="text-xs font-semibold text-primary">{filteredLeads.length} total</span>
                  </div>
                </div>
                {pipelineData.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-12 text-center">Sem dados.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={pipelineData} layout="vertical" barGap={0}>
                      <defs>
                        {funnelStages.map(s => (
                          <linearGradient key={s} id={`barGrad-${s}`} x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor={ESTAGIO_COLORS[s]} stopOpacity={0.85} />
                            <stop offset="100%" stopColor={ESTAGIO_COLORS[s]} stopOpacity={1} />
                          </linearGradient>
                        ))}
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} opacity={0.5} />
                      <XAxis type="number" className="fill-muted-foreground" fontSize={11} axisLine={false} tickLine={false} />
                      <YAxis dataKey="name" type="category" className="fill-muted-foreground" fontSize={11} width={85} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={chartTooltipStyle} />
                      <Bar dataKey="value" name="Leads" radius={[0, 6, 6, 0]} barSize={22}>
                        {pipelineData.map((entry) => (
                          <Cell key={entry.id} fill={`url(#barGrad-${entry.id})`} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }} className="glass-card p-5 md:p-6 glow-border">
                <div className="mb-4">
                  <h3 className="text-base font-semibold text-foreground">Corretores Ativos</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{corretoresCount} no total</p>
                </div>
                <div className="space-y-3">
                  {corretoresAtivos.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">Nenhum corretor cadastrado ainda.</p>
                  ) : (
                    corretoresAtivos.map((corretor, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.9 + i * 0.1 }}
                        className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50 hover:bg-secondary/80 transition-all group"
                      >
                        <span className="text-xs font-bold text-muted-foreground w-5">#{i + 1}</span>
                        <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center text-xs font-bold text-primary group-hover:bg-primary/20 transition-colors">
                          {corretor.nome.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{corretor.nome}</p>
                          <p className="text-xs text-muted-foreground truncate">{corretor.email ?? "—"}</p>
                        </div>
                        <div className="w-2 h-2 rounded-full bg-success" title="Ativo" />
                      </motion.div>
                    ))
                  )}
                </div>
              </motion.div>
            </div>

            {/* Comparativo Período a Período */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.83 }}>
              <ComparativoPeriodoWidget current={comparativoData.current} previous={comparativoData.previous} />
            </motion.div>

            {/* Novos Widgets de Inteligência */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.85 }}>
                <SaudeCarteiraWidget />
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.88 }}>
                <ROICanalOrigemWidget />
              </motion.div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.91 }}>
                <VisitasPorBairroWidget />
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.94 }}>
                <MetasCorretorWidget />
              </motion.div>
            </div>

            {/* Atalhos: Redes Sociais & Portais Imobiliários */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }} className="glass-card p-5 md:p-6 glow-border">
                <div className="flex items-center gap-2 mb-4">
                  <Share2 className="w-5 h-5 text-primary" />
                  <div>
                    <h3 className="text-base font-semibold text-foreground">Redes Sociais</h3>
                    <p className="text-xs text-muted-foreground">Publique seus imóveis nas redes</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { nome: "WhatsApp", url: "https://business.whatsapp.com", cor: "text-green-500" },
                    { nome: "Instagram", url: "https://www.instagram.com", cor: "text-pink-500" },
                    { nome: "Facebook", url: "https://www.facebook.com", cor: "text-blue-500" },
                    { nome: "TikTok", url: "https://www.tiktok.com", cor: "text-foreground" },
                    { nome: "Twitter / X", url: "https://twitter.com", cor: "text-foreground" },
                    { nome: "LinkedIn", url: "https://www.linkedin.com", cor: "text-blue-400" },
                    { nome: "Telegram", url: "https://web.telegram.org", cor: "text-sky-500" },
                  ].map((rede, i) => (
                    <a key={i} href={rede.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-3 rounded-xl bg-secondary/50 hover:bg-secondary/80 transition-all group">
                      <MessageCircle className={`w-4 h-4 ${rede.cor} flex-shrink-0`} />
                      <span className="text-sm font-medium text-foreground truncate">{rede.nome}</span>
                      <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-auto flex-shrink-0" />
                    </a>
                  ))}
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.0 }} className="glass-card p-5 md:p-6 glow-border">
                <div className="flex items-center gap-2 mb-4">
                  <Globe className="w-5 h-5 text-primary" />
                  <div>
                    <h3 className="text-base font-semibold text-foreground">Portais Imobiliários</h3>
                    <p className="text-xs text-muted-foreground">Anuncie nos principais portais</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { nome: "OLX", url: "https://www.olx.com.br/anunciar" },
                    { nome: "ZAP Imóveis", url: "https://www.zapimoveis.com.br/anunciar/" },
                    { nome: "Viva Real", url: "https://www.vivareal.com.br/anunciar/" },
                    { nome: "DF Imóveis", url: "https://www.dfimoveis.com.br/" },
                    { nome: "W Imóveis", url: "https://www.wimoveis.com.br/publicar" },
                    { nome: "Chave na Mão", url: "https://www.chavenamao.com.br/" },
                  ].map((portal, i) => (
                    <a key={i} href={portal.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-3 rounded-xl bg-secondary/50 hover:bg-secondary/80 transition-all group">
                      <Globe className="w-4 h-4 text-primary flex-shrink-0" />
                      <span className="text-sm font-medium text-foreground truncate">{portal.nome}</span>
                      <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-auto flex-shrink-0" />
                    </a>
                  ))}
                </div>
              </motion.div>
            </div>
          </>
        )}

        {/* Leads da Landing Page — apenas master */}
        {isMaster && <LeadsLandingWidget />}

        {/* Resumo Diário IA Modal */}
        {showResumo && resumoDiario && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowResumo(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} onClick={e => e.stopPropagation()} className="bg-card border border-border rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2"><Sparkles className="w-5 h-5 text-primary" />Resumo Diário — IA</h3>
                <button onClick={() => setShowResumo(false)} className="text-muted-foreground hover:text-foreground"><span className="text-xl">×</span></button>
              </div>
              <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-sm text-foreground">{resumoDiario}</div>
            </motion.div>
          </motion.div>
        )}
      </div>
      </MaskProvider>
    </DashboardLayout>
  );
};

export default Dashboard;
