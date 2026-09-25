import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import {
  Home, Building2, TrendingUp, MapPin, Target, Megaphone, Lightbulb, DollarSign, Zap,
  MessageCircle, Phone, UserPlus, Send, Copy, Handshake,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

// Dados estimados de mercado imobiliário de Brasília/DF — fontes SECOVI-DF, SINDUSCON, portais
const DADOS_MERCADO_BSB = {
  totalEstimadoVenda: 48500,
  totalEstimadoAluguel: 32000,
  taxaVacanciaVenda: 14.2,
  taxaVacanciaAluguel: 8.7,
  regioes: [
    { regiao: "Asa Sul", venda: 4200, aluguel: 3100, vacancia: 6.5, precoM2Venda: 14500, precoM2Aluguel: 55 },
    { regiao: "Asa Norte", venda: 3800, aluguel: 2900, vacancia: 7.2, precoM2Venda: 13200, precoM2Aluguel: 50 },
    { regiao: "Águas Claras", venda: 6500, aluguel: 4800, vacancia: 12.1, precoM2Venda: 8500, precoM2Aluguel: 35 },
    { regiao: "Sudoeste/Oct.", venda: 2100, aluguel: 1600, vacancia: 5.8, precoM2Venda: 15800, precoM2Aluguel: 60 },
    { regiao: "Noroeste", venda: 3200, aluguel: 1800, vacancia: 9.4, precoM2Venda: 16500, precoM2Aluguel: 62 },
    { regiao: "Guará I/II", venda: 2800, aluguel: 2200, vacancia: 10.3, precoM2Venda: 7800, precoM2Aluguel: 32 },
    { regiao: "Taguatinga", venda: 4500, aluguel: 3500, vacancia: 11.5, precoM2Venda: 6200, precoM2Aluguel: 28 },
    { regiao: "Samambaia", venda: 3200, aluguel: 2800, vacancia: 13.8, precoM2Venda: 4500, precoM2Aluguel: 22 },
    { regiao: "Ceilândia", venda: 4800, aluguel: 3600, vacancia: 15.2, precoM2Venda: 3800, precoM2Aluguel: 18 },
    { regiao: "Vicente Pires", venda: 2500, aluguel: 1500, vacancia: 8.9, precoM2Venda: 7200, precoM2Aluguel: 30 },
    { regiao: "Lago Sul/Norte", venda: 1800, aluguel: 800, vacancia: 4.2, precoM2Venda: 18000, precoM2Aluguel: 70 },
    { regiao: "Park Way", venda: 900, aluguel: 400, vacancia: 6.1, precoM2Venda: 9500, precoM2Aluguel: 40 },
  ],
  tipos: [
    { tipo: "Apartamento", venda: 22000, aluguel: 18000, pct: 50 },
    { tipo: "Casa", venda: 12000, aluguel: 6000, pct: 22 },
    { tipo: "Sala Comercial", venda: 6500, aluguel: 4500, pct: 14 },
    { tipo: "Lote/Terreno", venda: 5000, aluguel: 500, pct: 7 },
    { tipo: "Kitnet/Studio", venda: 3000, aluguel: 3000, pct: 7 },
  ],
  faixasPreco: [
    { faixa: "Até 300k", qtd: 12000, pctMercado: 15 },
    { faixa: "300k–600k", qtd: 18500, pctMercado: 23 },
    { faixa: "600k–1M", qtd: 14000, pctMercado: 17 },
    { faixa: "1M–2M", qtd: 8500, pctMercado: 11 },
    { faixa: "Acima 2M", qtd: 4500, pctMercado: 6 },
    { faixa: "Aluguel até 2k", qtd: 14000, pctMercado: 17 },
    { faixa: "Aluguel 2k–5k", qtd: 6500, pctMercado: 8 },
    { faixa: "Aluguel 5k+", qtd: 2500, pctMercado: 3 },
  ],
};

const SUGESTOES_CAPTACAO = [
  {
    titulo: "Tráfego Pago — Google Ads (Intenção de Compra)",
    desc: "Foque em palavras-chave como 'apartamento à venda Águas Claras' e 'aluguel Asa Norte'. Regiões com alta vacância como Ceilândia e Samambaia têm menor CPC e potencial de captar proprietários que precisam vender.",
    icon: Megaphone,
    badge: "Alto ROI",
    badgeColor: "bg-success/20 text-success",
  },
  {
    titulo: "Tráfego Pago — Meta/Instagram (Captação de Proprietários)",
    desc: "Crie campanhas segmentadas para proprietários em regiões com alta vacância (>10%). Anúncios como 'Seu imóvel parado? Venda em 60 dias' geram leads qualificados de proprietários.",
    icon: Target,
    badge: "Captação",
    badgeColor: "bg-primary/20 text-primary",
  },
  {
    titulo: "IA para Prospecção Diária",
    desc: "Use o módulo QCapture e Prospecção Diária para monitorar anúncios de proprietários diretos em OLX, Chave na Mão e QuintoAndar. Foco em imóveis listados há +30 dias — proprietários mais dispostos a trabalhar com imobiliária.",
    icon: Zap,
    badge: "Automação",
    badgeColor: "bg-info/20 text-info",
  },
  {
    titulo: "Captação por Faixa de Preço",
    desc: "A faixa de 300k–600k concentra 23% do mercado. Foque esforços de captação nessa faixa para maximizar volume. Para alto valor (>1M), invista em marketing premium e relacionamento com proprietários.",
    icon: DollarSign,
    badge: "Estratégia",
    badgeColor: "bg-warning/20 text-warning",
  },
  {
    titulo: "Conteúdo SEO + Landing Pages por Região",
    desc: "Crie landing pages otimizadas por bairro (ex: 'Imóveis à Venda em Noroeste'). Regiões com alta demanda e baixa vacância (Sudoeste, Lago Sul) geram leads orgânicos de alta qualidade.",
    icon: Lightbulb,
    badge: "Orgânico",
    badgeColor: "bg-accent/20 text-accent-foreground",
  },
];

const PIE_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--success))",
  "hsl(var(--warning))",
  "hsl(var(--info))",
  "hsl(var(--destructive))",
];

interface Props {
  imoveis: any[];
}

export function VacanciaBSBPanel({ imoveis }: Props) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [telefoneCustom, setTelefoneCustom] = useState("");

  const carteira = useMemo(() => {
    const listaImoveis = Array.isArray(imoveis) ? imoveis : [];
    const ativos = listaImoveis.filter(i => i.status === "Ativo");
    const venda = ativos.filter(i => i.operacao === "Venda").length;
    const aluguel = ativos.filter(i => i.operacao === "Aluguel").length;
    return { total: ativos.length, venda, aluguel };
  }, [imoveis]);

  const d = DADOS_MERCADO_BSB;

  const regiaoChartData = [...d.regioes]
    .sort((a, b) => b.vacancia - a.vacancia)
    .map(r => ({
      regiao: r.regiao,
      vacancia: r.vacancia,
      total: r.venda + r.aluguel,
    }));

  const TEMPLATES_MSG = {
    venda: (regiao: string) => `Olá! 👋 Sou corretor especializado em ${regiao} e percebi que muitos imóveis na região estão há mais de 60 dias anunciados.\n\nTrabalho com estratégia ativa de venda e tenho compradores qualificados na minha base. Posso fazer uma avaliação gratuita do seu imóvel e apresentar um plano de venda em até 90 dias.\n\nPodemos conversar?`,
    aluguel: (regiao: string) => `Olá! 👋 Vi que você tem um imóvel em ${regiao}.\n\nSou corretor especializado em locação na região. Tenho inquilinos qualificados aguardando e ofereço administração completa: análise de crédito, contrato, vistoria e cobrança garantida.\n\nGostaria de saber mais sobre seu imóvel. Podemos conversar?`,
  };

  const REGIOES_PRIORITARIAS = [...d.regioes].filter(r => r.vacancia >= 8).sort((a, b) => b.vacancia - a.vacancia);

  const abrirCaptacao = (aba: "proprietario_direto" | "qcapture") => {
    try {
      localStorage.setItem("captacao_active_tab", aba);
    } catch {
      // ignore persistence failures and still navigate
    }
    navigate("/captacao");
  };

  const enviarWhatsApp = (regiao: string, tipo: "venda" | "aluguel") => {
    const msg = TEMPLATES_MSG[tipo](regiao);
    const tel = telefoneCustom.replace(/\D/g, "");
    const url = tel
      ? `https://wa.me/55${tel}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  const copiarMensagem = (regiao: string, tipo: "venda" | "aluguel") => {
    navigator.clipboard.writeText(TEMPLATES_MSG[tipo](regiao));
    toast({ title: "Mensagem copiada!", description: `Template de ${tipo === "venda" ? "Venda" : "Aluguel"} para ${regiao}` });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Home className="w-5 h-5 text-primary" />
            Painel de Vacância — Brasília/DF
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Dados estimados de mercado baseados em portais e SECOVI-DF. Última atualização: Abril/2026.
          </p>
        </CardHeader>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-card border-border">
          <CardContent className="pt-4 text-center">
            <Building2 className="w-5 h-5 mx-auto text-primary mb-1" />
            <p className="text-xl font-bold text-foreground">{d.totalEstimadoVenda.toLocaleString("pt-BR")}</p>
            <p className="text-xs text-muted-foreground">Imóveis à Venda</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-4 text-center">
            <Home className="w-5 h-5 mx-auto text-info mb-1" />
            <p className="text-xl font-bold text-info">{d.totalEstimadoAluguel.toLocaleString("pt-BR")}</p>
            <p className="text-xs text-muted-foreground">Imóveis p/ Aluguel</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-4 text-center">
            <TrendingUp className="w-5 h-5 mx-auto text-warning mb-1" />
            <p className="text-xl font-bold text-warning">{d.taxaVacanciaVenda}%</p>
            <p className="text-xs text-muted-foreground">Vacância Venda</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-4 text-center">
            <TrendingUp className="w-5 h-5 mx-auto text-destructive mb-1" />
            <p className="text-xl font-bold text-destructive">{d.taxaVacanciaAluguel}%</p>
            <p className="text-xs text-muted-foreground">Vacância Aluguel</p>
          </CardContent>
        </Card>
      </div>

      {/* Sua carteira vs mercado */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Sua Carteira vs Mercado</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Seus imóveis ativos</span>
            <span className="font-bold text-foreground">{carteira.total}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Participação Venda</span>
            <span className="font-bold text-primary">
              {d.totalEstimadoVenda > 0 ? ((carteira.venda / d.totalEstimadoVenda) * 100).toFixed(3) : 0}%
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Participação Aluguel</span>
            <span className="font-bold text-info">
              {d.totalEstimadoAluguel > 0 ? ((carteira.aluguel / d.totalEstimadoAluguel) * 100).toFixed(3) : 0}%
            </span>
          </div>
          <p className="text-xs text-muted-foreground pt-1">
            💡 Aumente sua participação focando nas regiões com alta vacância listadas abaixo.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vacância por Região */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              Vacância por Região
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={regiaoChartData} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} unit="%" />
                <YAxis type="category" dataKey="regiao" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={90} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12, color: "hsl(var(--foreground))" }}
                  formatter={(v: number) => [`${v}%`, "Vacância"]}
                />
                <Bar dataKey="vacancia" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Distribuição por Tipo */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Building2 className="w-4 h-4 text-info" />
              Distribuição por Tipo de Imóvel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={d.tipos} dataKey="pct" nameKey="tipo" cx="50%" cy="50%" outerRadius={100} label={({ tipo, pct }) => `${tipo} ${pct}%`}>
                  {d.tipos.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12, color: "hsl(var(--foreground))" }}
                  formatter={(v: number, name: string) => [`${v}%`, name]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 mt-2">
              {d.tipos.map((t, i) => (
                <div key={t.tipo} className="flex items-center gap-2 text-xs">
                  <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="text-muted-foreground flex-1">{t.tipo}</span>
                  <span className="font-medium text-foreground">{t.venda.toLocaleString("pt-BR")} venda</span>
                  <span className="text-info">{t.aluguel.toLocaleString("pt-BR")} aluguel</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Regiões detalhada */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Detalhamento por Região — Preço/m² e Volume</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left py-2 px-2">Região</th>
                <th className="text-right py-2 px-2">Venda</th>
                <th className="text-right py-2 px-2">Aluguel</th>
                <th className="text-right py-2 px-2">Vacância</th>
                <th className="text-right py-2 px-2">R$/m² Venda</th>
                <th className="text-right py-2 px-2">R$/m² Aluguel</th>
              </tr>
            </thead>
            <tbody>
              {d.regioes.map(r => (
                <tr key={r.regiao} className="border-b border-border/50 hover:bg-secondary/30">
                  <td className="py-2 px-2 font-medium text-foreground">{r.regiao}</td>
                  <td className="py-2 px-2 text-right text-foreground">{r.venda.toLocaleString("pt-BR")}</td>
                  <td className="py-2 px-2 text-right text-info">{r.aluguel.toLocaleString("pt-BR")}</td>
                  <td className="py-2 px-2 text-right">
                    <Badge variant={r.vacancia > 10 ? "destructive" : r.vacancia > 7 ? "secondary" : "outline"} className="text-[10px]">
                      {r.vacancia}%
                    </Badge>
                  </td>
                  <td className="py-2 px-2 text-right text-foreground">R$ {r.precoM2Venda.toLocaleString("pt-BR")}</td>
                  <td className="py-2 px-2 text-right text-foreground">R$ {r.precoM2Aluguel.toLocaleString("pt-BR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Faixas de Preço */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-success" />
            Distribuição por Faixa de Preço
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {d.faixasPreco.map(f => (
              <div key={f.faixa} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{f.faixa}</span>
                  <span className="font-medium text-foreground">{f.qtd.toLocaleString("pt-BR")} imóveis ({f.pctMercado}%)</span>
                </div>
                <Progress value={f.pctMercado * 4} className="h-2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 🆕 Captação Direta com Proprietário */}
      <Card className="bg-card border-border border-primary/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Handshake className="w-4 h-4 text-primary" />
            Captação Direta com Proprietário
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Aborde proprietários em regiões de alta vacância — Venda ou Aluguel — com mensagens prontas
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Telefone opcional */}
          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">Telefone do proprietário (opcional)</label>
              <Input
                type="tel"
                placeholder="(61) 99999-9999"
                value={telefoneCustom}
                onChange={(e) => setTelefoneCustom(e.target.value)}
                className="h-9"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/captacao")}
              className="gap-1.5"
            >
              <UserPlus className="w-4 h-4" />
              Ir para Captação
            </Button>
          </div>

          <Tabs defaultValue="venda" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="venda" className="gap-1.5">
                <DollarSign className="w-3.5 h-3.5" /> Venda
              </TabsTrigger>
              <TabsTrigger value="aluguel" className="gap-1.5">
                <Home className="w-3.5 h-3.5" /> Aluguel
              </TabsTrigger>
            </TabsList>

            {(["venda", "aluguel"] as const).map((tipo) => (
              <TabsContent key={tipo} value={tipo} className="space-y-3 mt-3">
                <div className="p-3 rounded-lg bg-secondary/40 border border-border/50">
                  <p className="text-xs font-medium text-foreground mb-1">📝 Template de mensagem ({tipo === "venda" ? "Venda" : "Aluguel"})</p>
                  <p className="text-xs text-muted-foreground whitespace-pre-line leading-relaxed">
                    {TEMPLATES_MSG[tipo]("[REGIÃO]")}
                  </p>
                </div>

                <p className="text-xs font-medium text-foreground">🎯 Regiões prioritárias (vacância ≥ 8%)</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[320px] overflow-y-auto pr-1">
                  {REGIOES_PRIORITARIAS.map((r) => {
                    const qtd = tipo === "venda" ? r.venda : r.aluguel;
                    return (
                      <div
                        key={r.regiao}
                        className="flex items-center gap-2 p-2.5 rounded-lg bg-background border border-border hover:border-primary/40 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3 h-3 text-primary shrink-0" />
                            <p className="text-xs font-medium text-foreground truncate">{r.regiao}</p>
                            <Badge
                              variant={r.vacancia > 12 ? "destructive" : "secondary"}
                              className="text-[9px] h-4 px-1.5"
                            >
                              {r.vacancia}%
                            </Badge>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {qtd.toLocaleString("pt-BR")} imóveis · R$ {tipo === "venda" ? r.precoM2Venda.toLocaleString("pt-BR") : r.precoM2Aluguel.toLocaleString("pt-BR")}/m²
                          </p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => copiarMensagem(r.regiao, tipo)}
                            title="Copiar mensagem"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            className="h-7 w-7 bg-success hover:bg-success/90 text-success-foreground"
                            onClick={() => enviarWhatsApp(r.regiao, tipo)}
                            title="Enviar via WhatsApp"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-border/50">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-1.5"
                    onClick={() => abrirCaptacao("qcapture")}
                  >
                    <Target className="w-3.5 h-3.5" />
                    QCapture: buscar proprietários diretos
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-1.5"
                    onClick={() => navigate("/prospeccao")}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    Prospecção Diária
                  </Button>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>


      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-warning" />
            Sugestões de Captação e Estratégias
          </CardTitle>
          <p className="text-xs text-muted-foreground">Recomendações baseadas nos dados de vacância e mercado</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {SUGESTOES_CAPTACAO.map((s, i) => (
            <div key={i} className="flex gap-3 p-3 rounded-lg bg-secondary/30 border border-border/50">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-secondary shrink-0">
                <s.icon className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-medium text-foreground">{s.titulo}</p>
                  <Badge className={`text-[10px] ${s.badgeColor}`}>{s.badge}</Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
