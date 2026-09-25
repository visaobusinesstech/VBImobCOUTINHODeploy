import { useMemo, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTabPersistence } from "@/hooks/useTabPersistence";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useImoveis } from "@/hooks/useImoveis";
import { useAuth } from "@/contexts/AuthContext";
import { useImobiliariaConfig } from "@/hooks/useImobiliariaConfig";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie,
} from "recharts";
import {
  Brain, TrendingDown, TrendingUp, Clock, AlertTriangle, Target, Building2, MapPin,
  ArrowDown, ArrowUp, DollarSign, BarChart3, Flame, Snowflake, Zap, Loader2, Sparkles, ShieldCheck, Droplets, FileDown, Globe, Home, Megaphone, Lightbulb, Search
} from "lucide-react";
import { exportPrevisaoPDF } from "@/lib/exportPrevisaoPDF";
import { toast } from "sonner";
import { VacanciaBSBPanel } from "@/components/inteligencia/VacanciaBSBPanel";
import { WebResearchDialog } from "@/components/shared/WebResearchDialog";

const formatBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Inteligencia() {
  const { imoveis, loading } = useImoveis();
  const navigate = useNavigate();
  const { imobiliariaId } = useAuth();
  const [intTab, setIntTab] = useTabPersistence("inteligencia_active_tab", "acima");
  const { nome_empresa } = useImobiliariaConfig();
  const [analyzing, setAnalyzing] = useState(false);
  const [predicting, setPredicting] = useState(false);
  const [predictions, setPredictions] = useState<any[]>([]);

  // Portal Analysis data
  const { data: leadsData } = useQuery({
    queryKey: ["portal-leads", imobiliariaId],
    queryFn: async () => {
      const { data } = await supabase.from("leads").select("canal_origem, estagio, bairro_interesse, tipo_imovel_interesse, tipo_operacao");
      return (data ?? []) as { canal_origem: string | null; estagio: string; bairro_interesse: string | null; tipo_imovel_interesse: string | null; tipo_operacao: string }[];
    },
    enabled: !!imobiliariaId,
  });

  const { data: compromissosData } = useQuery({
    queryKey: ["portal-compromissos", imobiliariaId],
    queryFn: async () => {
      const { data } = await supabase.from("compromissos").select("tipo, lead_id, status");
      return (data ?? []) as { tipo: string; lead_id: string | null; status: string }[];
    },
    enabled: !!imobiliariaId,
  });

  const { data: contratosData } = useQuery({
    queryKey: ["portal-contratos", imobiliariaId],
    queryFn: async () => {
      const { data } = await supabase.from("contratos").select("canal_origem, status, valor, tipo, comissao_valor, corretor_nome");
      return (data ?? []) as { canal_origem: string | null; status: string; valor: number; tipo: string; comissao_valor: number | null; corretor_nome: string | null }[];
    },
    enabled: !!imobiliariaId,
  });

  const { data: clientesData } = useQuery({
    queryKey: ["portal-clientes", imobiliariaId],
    queryFn: async () => {
      const { data } = await supabase.from("clientes_relacionamento").select("id, ativo");
      return (data ?? []) as { id: string; ativo: boolean }[];
    },
    enabled: !!imobiliariaId,
  });

  const portalAnalysis = useMemo(() => {
    const portals = ["DF Imóveis", "W Imóveis", "Chave na Mão", "ZAP Imóveis", "OLX", "Viva Real", "Instagram", "Facebook", "Google Ads", "Indicação", "WhatsApp", "Placa"];
    const leads = leadsData ?? [];
    const contratos = contratosData ?? [];
    const visitas = (compromissosData ?? []).filter(c => c.tipo === "visita");

    // Map leads to portals
    const leadsPerCanal: Record<string, number> = {};
    const closedPerCanal: Record<string, number> = {};
    leads.forEach(l => {
      const canal = l.canal_origem || "Não informado";
      leadsPerCanal[canal] = (leadsPerCanal[canal] || 0) + 1;
      if (l.estagio === "fechado") closedPerCanal[canal] = (closedPerCanal[canal] || 0) + 1;
    });

    const contratosPerCanal: Record<string, { count: number; valor: number }> = {};
    contratos.forEach(c => {
      const canal = c.canal_origem || "Não informado";
      if (!contratosPerCanal[canal]) contratosPerCanal[canal] = { count: 0, valor: 0 };
      contratosPerCanal[canal].count++;
      contratosPerCanal[canal].valor += c.valor || 0;
    });

    const totalVisitas = visitas.length;

    // Build combined data for all portals that have any activity
    const allCanais = new Set([...Object.keys(leadsPerCanal), ...Object.keys(contratosPerCanal)]);
    const result = Array.from(allCanais).map(canal => ({
      canal,
      leads: leadsPerCanal[canal] || 0,
      fechados: closedPerCanal[canal] || 0,
      contratos: contratosPerCanal[canal]?.count || 0,
      valorContratos: contratosPerCanal[canal]?.valor || 0,
      conversao: leadsPerCanal[canal] ? Math.round(((closedPerCanal[canal] || 0) / leadsPerCanal[canal]) * 100) : 0,
    })).sort((a, b) => b.leads - a.leads);

    const totalLeads = leads.length;
    const totalContratos = contratos.length;
    const totalFechados = leads.filter(l => l.estagio === "fechado").length;

    return { result, totalLeads, totalVisitas, totalContratos, totalFechados };
  }, [leadsData, compromissosData, contratosData]);

  // Demand analysis: bairros and property types
  const demandAnalysis = useMemo(() => {
    const leads = leadsData ?? [];
    const bairroCount: Record<string, { total: number; venda: number; aluguel: number }> = {};
    const tipoCount: Record<string, { total: number; venda: number; aluguel: number }> = {};

    leads.forEach(l => {
      const bairro = l.bairro_interesse?.trim();
      if (bairro) {
        if (!bairroCount[bairro]) bairroCount[bairro] = { total: 0, venda: 0, aluguel: 0 };
        bairroCount[bairro].total++;
        if (l.tipo_operacao === "aluguel") bairroCount[bairro].aluguel++;
        else bairroCount[bairro].venda++;
      }
      const tipo = l.tipo_imovel_interesse?.trim();
      if (tipo) {
        if (!tipoCount[tipo]) tipoCount[tipo] = { total: 0, venda: 0, aluguel: 0 };
        tipoCount[tipo].total++;
        if (l.tipo_operacao === "aluguel") tipoCount[tipo].aluguel++;
        else tipoCount[tipo].venda++;
      }
    });

    const bairros = Object.entries(bairroCount)
      .map(([name, c]) => ({ name, ...c }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 15);

    const tipos = Object.entries(tipoCount)
      .map(([name, c]) => ({ name, ...c }))
      .sort((a, b) => b.total - a.total);

    const totalComBairro = leads.filter(l => l.bairro_interesse?.trim()).length;
    const totalComTipo = leads.filter(l => l.tipo_imovel_interesse?.trim()).length;

    return { bairros, tipos, totalComBairro, totalComTipo, totalLeads: leads.length };
  }, [leadsData]);

  const runAlertasManual = async () => {
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("alertas-imoveis");
      if (error) throw error;
      const count = data?.alerts ?? 0;
      toast.success(`Análise concluída: ${count} alerta(s) gerado(s)`);
    } catch (err: any) {
      toast.error("Erro ao executar análise: " + (err.message || err));
    } finally {
      setAnalyzing(false);
    }
  };

  const runPrevisao = async () => {
    setPredicting(true);
    try {
      const { data, error } = await supabase.functions.invoke("previsao-valorizacao");
      if (error) throw error;
      if (data?.predictions) {
        setPredictions(data.predictions);
        toast.success(`Previsão gerada para ${data.predictions.length} bairro(s)`);
      } else {
        toast.info(data?.message || "Sem dados suficientes para previsão.");
      }
    } catch (err: any) {
      toast.error("Erro na previsão: " + (err.message || err));
    } finally {
      setPredicting(false);
    }
  };

  // Fetch imoveis_mercado for regional pricing
  const { data: mercado } = useQuery({
    queryKey: ["imoveis_mercado_inteligencia", imobiliariaId],
    queryFn: async () => {
      const { data } = await supabase.from("imoveis_mercado").select("*").limit(500);
      return data ?? [];
    },
    enabled: !!imobiliariaId,
  });

  const ativos = useMemo(() => imoveis.filter((i) => i.status === "Ativo"), [imoveis]);

  // Preço médio por m² por bairro (mercado)
  const mediaM2PorBairro = useMemo(() => {
    const map: Record<string, { soma: number; count: number }> = {};
    (mercado ?? []).forEach((m: any) => {
      if (m.bairro && m.preco && m.area && m.area > 0) {
        if (!map[m.bairro]) map[m.bairro] = { soma: 0, count: 0 };
        map[m.bairro].soma += m.preco / m.area;
        map[m.bairro].count += 1;
      }
    });
    // Also include internal portfolio
    ativos.forEach((i) => {
      if (i.bairro && i.preco && i.area && i.area > 0) {
        if (!map[i.bairro]) map[i.bairro] = { soma: 0, count: 0 };
        map[i.bairro].soma += i.preco / i.area;
        map[i.bairro].count += 1;
      }
    });
    const result: Record<string, number> = {};
    Object.entries(map).forEach(([b, v]) => { result[b] = v.soma / v.count; });
    return result;
  }, [mercado, ativos]);

  // Imóveis acima do mercado
  const acimaMercado = useMemo(() => {
    return ativos
      .filter((i) => i.bairro && i.area > 0 && mediaM2PorBairro[i.bairro])
      .map((i) => {
        const m2Imovel = i.preco / i.area;
        const m2Regiao = mediaM2PorBairro[i.bairro!];
        const diff = ((m2Imovel - m2Regiao) / m2Regiao) * 100;
        return { ...i, m2Imovel, m2Regiao, diff };
      })
      .filter((i) => i.diff > 10)
      .sort((a, b) => b.diff - a.diff);
  }, [ativos, mediaM2PorBairro]);

  // Imóveis parados há 60+ dias
  const agora = new Date();
  const parados60 = useMemo(() => {
    return ativos
      .map((i) => {
        const dias = Math.floor((agora.getTime() - new Date(i.created_at).getTime()) / (1000 * 60 * 60 * 24));
        return { ...i, dias };
      })
      .filter((i) => i.dias >= 60)
      .sort((a, b) => b.dias - a.dias);
  }, [ativos]);

  // Sugestões de redução
  const sugestoesReducao = useMemo(() => {
    return acimaMercado.map((i) => {
      const precoSugerido = i.m2Regiao * i.area;
      const reducao = i.preco - precoSugerido;
      return { ...i, precoSugerido, reducao };
    });
  }, [acimaMercado]);

  // Regiões com maior procura (by count of mercado listings)
  const regioesProcura = useMemo(() => {
    const map: Record<string, number> = {};
    (mercado ?? []).forEach((m: any) => {
      if (m.bairro) map[m.bairro] = (map[m.bairro] || 0) + 1;
    });
    return Object.entries(map)
      .map(([bairro, count]) => ({ bairro, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [mercado]);

  // Chart data: preço m² por bairro
  const chartBairros = useMemo(() => {
    return Object.entries(mediaM2PorBairro)
      .map(([bairro, m2]) => ({ bairro: bairro.slice(0, 15), m2: Math.round(m2) }))
      .sort((a, b) => b.m2 - a.m2)
      .slice(0, 12);
  }, [mediaM2PorBairro]);

  // Stats
  const totalAtivos = ativos.length;
  const totalAcima = acimaMercado.length;
  const totalParados = parados60.length;
  const pctAcima = totalAtivos > 0 ? Math.round((totalAcima / totalAtivos) * 100) : 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Brain className="w-6 h-6 text-primary" />
              Inteligência Imobiliária
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Análise de mercado, oportunidades e alertas estratégicos da sua carteira
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              onClick={() => navigate("/configurar-ia")} 
              className="gap-2 border-primary/20 hover:bg-primary/5"
            >
              <Sparkles className="w-4 h-4 text-primary" />
              Configurar IA
            </Button>
            <Button 
              variant="outline"
              onClick={() => {
                const event = new CustomEvent("open-market-research", { detail: { query: "tendências mercado imobiliário " + (nome_empresa || "Brasil") } });
                window.dispatchEvent(event);
              }}
              className="gap-2 border-primary/20 hover:bg-primary/5"
            >
              <Search className="w-4 h-4 text-primary" />
              Notícias do Mercado
            </Button>
            <Button onClick={runAlertasManual} disabled={analyzing} className="gap-2">
              {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              {analyzing ? "Analisando..." : "Analisar Carteira"}
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="pt-5 text-center">
              <Building2 className="w-5 h-5 mx-auto text-primary mb-1" />
              <p className="text-2xl font-bold text-foreground">{totalAtivos}</p>
              <p className="text-xs text-muted-foreground">Imóveis Ativos</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-5 text-center">
              <ArrowUp className="w-5 h-5 mx-auto text-warning mb-1" />
              <p className="text-2xl font-bold text-warning">{totalAcima}</p>
              <p className="text-xs text-muted-foreground">Acima do Mercado</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-5 text-center">
              <Clock className="w-5 h-5 mx-auto text-destructive mb-1" />
              <p className="text-2xl font-bold text-destructive">{totalParados}</p>
              <p className="text-xs text-muted-foreground">Parados 60+ dias</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-5 text-center">
              <Target className="w-5 h-5 mx-auto text-primary mb-1" />
              <p className="text-2xl font-bold text-foreground">{portalAnalysis.totalLeads}</p>
              <p className="text-xs text-muted-foreground">Leads Captados</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-5 text-center">
              <DollarSign className="w-5 h-5 mx-auto text-success mb-1" />
              <p className="text-2xl font-bold text-success">{(contratosData ?? []).filter(c => c.status === "ativo" || c.status === "assinado").length}</p>
              <p className="text-xs text-muted-foreground">Contratos Ativos</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-5 text-center">
              <Building2 className="w-5 h-5 mx-auto text-info mb-1" />
              <p className="text-2xl font-bold text-info">{(clientesData ?? []).filter(c => c.ativo).length}</p>
              <p className="text-xs text-muted-foreground">Clientes Ativos</p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={intTab} onValueChange={setIntTab} className="w-full">
          <TabsList className="flex-wrap">
            <TabsTrigger value="acima">Acima do Mercado ({totalAcima})</TabsTrigger>
            <TabsTrigger value="parados">Parados 60+ ({totalParados})</TabsTrigger>
            <TabsTrigger value="reducao">Sugestões de Preço</TabsTrigger>
            <TabsTrigger value="regioes">Regiões</TabsTrigger>
            <TabsTrigger value="portais" className="gap-1">
              <Globe className="w-3 h-3" /> Análise de Portais
            </TabsTrigger>
            <TabsTrigger value="previsao" className="gap-1">
              <Sparkles className="w-3 h-3" /> Previsão IA
            </TabsTrigger>
            <TabsTrigger value="demanda" className="gap-1">
              <Target className="w-3 h-3" /> Demanda
            </TabsTrigger>
            <TabsTrigger value="vacancia" className="gap-1">
              <Home className="w-3 h-3" /> Vacância BSB
            </TabsTrigger>
          </TabsList>

          {/* Acima do Mercado */}
          <TabsContent value="acima" className="space-y-3 mt-4">
            {acimaMercado.length === 0 ? (
              <Card className="bg-card border-border">
                <CardContent className="py-8 text-center text-muted-foreground text-sm">
                  Nenhum imóvel acima do preço médio de mercado. Boa precificação! 🎉
                </CardContent>
              </Card>
            ) : (
              acimaMercado.map((i) => (
                <Card key={i.id} className="bg-card border-border">
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{i.titulo}</p>
                        <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                          {i.bairro && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{i.bairro}</span>}
                          <span>{i.area}m²</span>
                          <span>{i.quartos}q</span>
                        </div>
                        <div className="flex gap-4 mt-2 text-xs">
                          <span className="text-muted-foreground">Seu m²: <strong className="text-foreground">R$ {i.m2Imovel.toFixed(0)}</strong></span>
                          <span className="text-muted-foreground">Média: <strong className="text-foreground">R$ {i.m2Regiao.toFixed(0)}</strong></span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-foreground">{formatBRL(i.preco)}</p>
                        <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/30 mt-1">
                          <ArrowUp className="w-3 h-3 mr-1" />
                          +{i.diff.toFixed(0)}% acima
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Parados 60+ dias */}
          <TabsContent value="parados" className="space-y-3 mt-4">
            {parados60.length === 0 ? (
              <Card className="bg-card border-border">
                <CardContent className="py-8 text-center text-muted-foreground text-sm">
                  Nenhum imóvel parado há mais de 60 dias. Carteira dinâmica! 🚀
                </CardContent>
              </Card>
            ) : (
              parados60.map((i) => (
                <Card key={i.id} className="bg-card border-border">
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{i.titulo}</p>
                        <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                          {i.bairro && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{i.bairro}</span>}
                          <span>{i.area}m²</span>
                          <span>{formatBRL(i.preco)}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="flex items-center gap-1 text-red-500">
                          {i.dias >= 120 ? <Snowflake className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                          <span className="text-lg font-bold">{i.dias}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">dias no ar</p>
                        {i.dias >= 120 && (
                          <Badge variant="destructive" className="mt-1 text-[10px]">Crítico</Badge>
                        )}
                        {i.dias >= 60 && i.dias < 120 && (
                          <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/30 mt-1 text-[10px]">Atenção</Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Sugestões de Redução */}
          <TabsContent value="reducao" className="space-y-3 mt-4">
            {sugestoesReducao.length === 0 ? (
              <Card className="bg-card border-border">
                <CardContent className="py-8 text-center text-muted-foreground text-sm">
                  Sem sugestões de redução no momento.
                </CardContent>
              </Card>
            ) : (
              sugestoesReducao.map((i) => (
                <Card key={i.id} className="bg-card border-border">
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{i.titulo}</p>
                        <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                          {i.bairro && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{i.bairro}</span>}
                          <span>{i.area}m²</span>
                        </div>
                        <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <p className="text-muted-foreground">Preço Atual</p>
                            <p className="font-bold text-foreground">{formatBRL(i.preco)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Sugerido</p>
                            <p className="font-bold text-primary">{formatBRL(i.precoSugerido)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Redução</p>
                            <p className="font-bold text-red-500">
                              <ArrowDown className="w-3 h-3 inline mr-0.5" />
                              {formatBRL(i.reducao)}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/30">
                          +{i.diff.toFixed(0)}%
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Regiões */}
          <TabsContent value="regioes" className="space-y-4 mt-4">
            {/* Gráfico m² por bairro */}
            {chartBairros.length > 0 && (
              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-primary" /> Preço Médio m² por Bairro
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartBairros} margin={{ top: 5, right: 10, left: 0, bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="bairro" tick={{ fontSize: 10 }} angle={-40} textAnchor="end" interval={0} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${v}`} />
                      <Tooltip formatter={(v: number) => [`R$ ${v.toLocaleString("pt-BR")}/m²`, "Preço/m²"]} />
                      <Bar dataKey="m2" radius={[4, 4, 0, 0]} fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Top regiões por volume */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Flame className="w-4 h-4 text-primary" /> Regiões com Maior Oferta
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {regioesProcura.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Sem dados de mercado capturados.</p>
                ) : (
                  regioesProcura.map((r, i) => (
                    <div key={r.bairro} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}.</span>
                        <span className="text-sm text-foreground">{r.bairro}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress value={Math.min((r.count / (regioesProcura[0]?.count || 1)) * 100, 100)} className="h-2 w-20" />
                        <span className="text-xs font-semibold text-muted-foreground w-8 text-right">{r.count}</span>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>
          {/* Previsão IA */}
          <TabsContent value="previsao" className="space-y-4 mt-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-sm text-muted-foreground">
                Previsão de valorização para 6-12 meses gerada por IA com base nos dados capturados.
              </p>
              <div className="flex gap-2">
                {predictions.length > 0 && (
                  <Button onClick={() => exportPrevisaoPDF(predictions, nome_empresa)} size="sm" variant="outline" className="gap-2">
                    <FileDown className="w-4 h-4" /> Exportar PDF
                  </Button>
                )}
                <Button onClick={runPrevisao} disabled={predicting} size="sm" className="gap-2">
                  {predicting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {predicting ? "Gerando..." : "Gerar Previsão"}
                </Button>
              </div>
            </div>

            {predictions.length === 0 && !predicting && (
              <Card className="bg-card border-border">
                <CardContent className="py-12 text-center">
                  <Sparkles className="w-8 h-8 mx-auto mb-3 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">Clique em "Gerar Previsão" para analisar as tendências de mercado com IA.</p>
                </CardContent>
              </Card>
            )}

            {predicting && (
              <Card className="bg-card border-border">
                <CardContent className="py-12 text-center">
                  <Loader2 className="w-8 h-8 mx-auto mb-3 text-primary animate-spin" />
                  <p className="text-sm text-muted-foreground">Analisando tendências de mercado com IA...</p>
                </CardContent>
              </Card>
            )}

            {predictions.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2">
                {predictions.map((p: any) => {
                  const tendenciaColor = p.tendencia === "alta"
                    ? "text-emerald-600"
                    : p.tendencia === "queda"
                    ? "text-destructive"
                    : "text-muted-foreground";
                  const TendenciaIcon = p.tendencia === "alta" ? TrendingUp : p.tendencia === "queda" ? TrendingDown : ArrowUp;
                  const confiancaColor = p.confianca === "alta"
                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                    : p.confianca === "media"
                    ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                    : "bg-muted text-muted-foreground border-border";
                  const liquidezColor = p.liquidez === "alta"
                    ? "bg-primary/10 text-primary border-primary/30"
                    : p.liquidez === "media"
                    ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                    : "bg-muted text-muted-foreground border-border";

                  return (
                    <Card key={p.bairro} className="bg-card border-border">
                      <CardContent className="pt-5 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-primary shrink-0" />
                            <h3 className="text-sm font-semibold text-foreground">{p.bairro}</h3>
                          </div>
                          <div className={`flex items-center gap-1 ${tendenciaColor}`}>
                            <TendenciaIcon className="w-4 h-4" />
                            <span className="text-lg font-bold">
                              {p.variacao_percentual > 0 ? "+" : ""}{p.variacao_percentual?.toFixed(1)}%
                            </span>
                          </div>
                        </div>

                        {p.dados && (
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div>
                              <p className="text-muted-foreground">R$/m² médio</p>
                              <p className="font-bold text-foreground">R$ {p.dados.precoM2Medio?.toLocaleString("pt-BR")}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Anúncios</p>
                              <p className="font-bold text-foreground">{p.dados.totalAnuncios}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Dias médio</p>
                              <p className="font-bold text-foreground">{p.dados.diasMedioAnuncio ?? "—"}</p>
                            </div>
                          </div>
                        )}

                        <div className="flex gap-2">
                          <Badge className={confiancaColor}>
                            <ShieldCheck className="w-3 h-3 mr-1" />
                            Confiança {p.confianca}
                          </Badge>
                          <Badge className={liquidezColor}>
                            <Droplets className="w-3 h-3 mr-1" />
                            Liquidez {p.liquidez}
                          </Badge>
                        </div>

                        <p className="text-xs text-muted-foreground">{p.resumo}</p>

                        <div className="bg-secondary/50 rounded-lg px-3 py-2">
                          <p className="text-xs font-medium text-foreground flex items-center gap-1">
                            <Target className="w-3 h-3 text-primary" />
                            {p.recomendacao}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Análise de Portais */}
          <TabsContent value="portais" className="space-y-4 mt-4">
            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card className="bg-card border-border">
                <CardContent className="pt-4 text-center">
                  <p className="text-2xl font-bold text-foreground">{portalAnalysis.totalLeads}</p>
                  <p className="text-xs text-muted-foreground">Total de Leads</p>
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardContent className="pt-4 text-center">
                  <p className="text-2xl font-bold text-foreground">{portalAnalysis.totalVisitas}</p>
                  <p className="text-xs text-muted-foreground">Total de Visitas</p>
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardContent className="pt-4 text-center">
                  <p className="text-2xl font-bold text-primary">{portalAnalysis.totalFechados}</p>
                  <p className="text-xs text-muted-foreground">Leads Fechados</p>
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardContent className="pt-4 text-center">
                  <p className="text-2xl font-bold text-foreground">{portalAnalysis.totalContratos}</p>
                  <p className="text-xs text-muted-foreground">Contratos Gerados</p>
                </CardContent>
              </Card>
            </div>

            {/* Chart */}
            {portalAnalysis.result.length > 0 && (
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold text-foreground">Leads vs Fechados por Canal</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={portalAnalysis.result.slice(0, 10)} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="canal" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} angle={-30} textAnchor="end" height={60} />
                        <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "12px",
                            color: "hsl(var(--foreground))",
                            padding: "10px 14px",
                            fontSize: "13px",
                          }}
                        />
                        <Bar dataKey="leads" name="Leads" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="fechados" name="Fechados" fill="hsl(var(--chart-2, 142 71% 45%))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Rankings table */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-foreground">Ranking Comparativo por Canal</CardTitle>
              </CardHeader>
              <CardContent>
                {portalAnalysis.result.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-8">Nenhum dado de canal de origem encontrado. Registre a origem dos seus leads para ver a análise.</p>
                ) : (
                  <div className="space-y-3">
                    {portalAnalysis.result.map((item, i) => {
                      const maxLeads = portalAnalysis.result[0]?.leads || 1;
                      return (
                        <div key={item.canal} className="flex items-center gap-3 group">
                          <span className="text-xs font-bold text-muted-foreground w-5 text-right">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-foreground truncate">{item.canal}</span>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground flex-shrink-0">
                                <span>{item.leads} leads</span>
                                <span>{item.fechados} fechados</span>
                                <span>{item.contratos} contratos</span>
                                <Badge variant="outline" className="text-[10px]">{item.conversao}%</Badge>
                              </div>
                            </div>
                            <Progress value={(item.leads / maxLeads) * 100} className="h-2" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>


          {/* Demanda */}
          <TabsContent value="demanda" className="space-y-6 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-card border-border">
                <CardContent className="pt-4 text-center">
                  <p className="text-2xl font-bold text-primary">{demandAnalysis.totalComBairro}</p>
                  <p className="text-xs text-muted-foreground">Leads com bairro informado</p>
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardContent className="pt-4 text-center">
                  <p className="text-2xl font-bold text-primary">{demandAnalysis.totalComTipo}</p>
                  <p className="text-xs text-muted-foreground">Leads com tipo informado</p>
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardContent className="pt-4 text-center">
                  <p className="text-2xl font-bold text-foreground">{demandAnalysis.totalLeads}</p>
                  <p className="text-xs text-muted-foreground">Total de leads</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Bairros mais buscados */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <MapPin className="w-4 h-4 text-primary" /> Bairros Mais Buscados
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {demandAnalysis.bairros.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Nenhum lead com bairro de interesse preenchido.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={Math.max(250, demandAnalysis.bairros.length * 32)}>
                      <BarChart data={demandAnalysis.bairros} layout="vertical" margin={{ left: 10, right: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                        <Tooltip
                          contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                          formatter={(value: number, name: string) => [value, name === "venda" ? "Venda" : "Aluguel"]}
                        />
                        <Bar dataKey="venda" stackId="a" fill="hsl(var(--primary))" name="Venda" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="aluguel" stackId="a" fill="hsl(var(--accent))" name="Aluguel" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Tipos de imóvel mais buscados */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Building2 className="w-4 h-4 text-primary" /> Tipos de Imóvel Mais Buscados
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {demandAnalysis.tipos.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Nenhum lead com tipo de imóvel preenchido.</p>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height={280}>
                        <PieChart>
                          <Pie
                            data={demandAnalysis.tipos}
                            dataKey="total"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          >
                            {demandAnalysis.tipos.map((_, i) => (
                              <Cell key={i} fill={["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--secondary))", "hsl(38, 92%, 50%)", "hsl(262, 83%, 58%)", "hsl(142, 71%, 45%)", "hsl(0, 72%, 51%)", "hsl(199, 89%, 48%)", "hsl(45, 93%, 47%)"][i % 9]} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="mt-4 space-y-2">
                        {demandAnalysis.tipos.map((t, i) => (
                          <div key={t.name} className="flex items-center justify-between text-sm">
                            <span className="text-foreground font-medium">{t.name}</span>
                            <div className="flex items-center gap-3 text-muted-foreground text-xs">
                              <span>{t.venda} venda</span>
                              <span>{t.aluguel} aluguel</span>
                              <Badge variant="secondary">{t.total}</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Vacância Brasília */}
          <TabsContent value="vacancia" className="space-y-6 mt-4">
            <VacanciaBSBPanel imoveis={imoveis} />
          </TabsContent>

        </Tabs>
      </div>
      <WebResearchDialog />
    </DashboardLayout>
  );
}
