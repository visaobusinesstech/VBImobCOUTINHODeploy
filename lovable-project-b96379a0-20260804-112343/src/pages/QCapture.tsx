import { useState, useMemo, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useImoveis } from "@/hooks/useImoveis";
import { useImobiliariaConfig } from "@/hooks/useImobiliariaConfig";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { ScoreGauge } from "@/components/qcapture/ScoreGauge";
import { HeatMap } from "@/components/qcapture/HeatMap";
import { analisarRegioes, gerarOportunidades, gerarScriptAbordagem, type OportunidadeCaptacao, type AnaliseRegional, type ImovelMercadoInput } from "@/lib/qcaptureEngine";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from "recharts";
import { Crosshair, TrendingUp, MapPin, AlertTriangle, Target, MessageCircle, Phone, Copy, Shield, Globe, Database, ExternalLink, Users, Radio, Sparkles, FileText, CalendarClock, Bell } from "lucide-react";
import { NotificacoesCondominioPanel } from "@/components/qcapture/NotificacoesCondominioPanel";

import { useToast } from "@/hooks/use-toast";
import { PortalScraperPanel } from "@/components/qcapture/PortalScraperPanel";
import { GruposImoveisPanel } from "@/components/qcapture/GruposImoveisPanel";
import { ProspeccaoCondominioPanel } from "@/components/qcapture/ProspeccaoCondominioPanel";
import { OrquestracaoMulticanalPanel } from "@/components/qcapture/OrquestracaoMulticanalPanel";
import { EnriquecimentoContatosPanel } from "@/components/qcapture/EnriquecimentoContatosPanel";
import { RoteirosMensagensPanel } from "@/components/qcapture/RoteirosMensagensPanel";
import { AgendamentosProspeccaoPanel } from "@/components/qcapture/AgendamentosProspeccaoPanel";
import { ImportarImovelButton } from "@/components/qcapture/ImportarImovelButton";

const riskColors: Record<string, string> = {
  baixo: "hsl(142 71% 45%)",
  moderado: "hsl(45 93% 47%)",
  alto: "hsl(25 95% 53%)",
  critico: "hsl(0 84% 60%)",
};

const opColors: Record<string, string> = {
  alta: "hsl(142 71% 45%)",
  moderada: "hsl(45 93% 47%)",
  baixa: "hsl(0 84% 60%)",
};

export default function QCapture() {
  const { imoveis, loading } = useImoveis();
  const { nome_empresa } = useImobiliariaConfig();
  const { user } = useAuth();
  const { toast } = useToast();
  const [modo, setModo] = useState<string>("todos");
  const [selectedOp, setSelectedOp] = useState<OportunidadeCaptacao | null>(null);
  const [scriptDialog, setScriptDialog] = useState(false);
  const [dadosMercado, setDadosMercado] = useState<ImovelMercadoInput[]>([]);
  const [loadingMercado, setLoadingMercado] = useState(true);

  // Fetch dados reais de mercado
  useEffect(() => {
    if (!user) return;
    const fetchMercado = async () => {
      setLoadingMercado(true);
      const { data, error } = await supabase
        .from("imoveis_mercado")
        .select("id, titulo, tipo, operacao, bairro, cidade, preco, area, preco_m2, quartos, dias_anuncio, portal, data_scraping, url_anuncio")
        .order("data_scraping", { ascending: false })
        .limit(1000);
      if (!error && data) {
        setDadosMercado(data as ImovelMercadoInput[]);
      }
      setLoadingMercado(false);
    };
    fetchMercado();
  }, [user]);

  const operacaoFiltro = modo === "todos" ? undefined : modo === "venda" ? "Venda" : "Aluguel";

  const regioes = useMemo(() => analisarRegioes(imoveis as any[], operacaoFiltro, dadosMercado), [imoveis, operacaoFiltro, dadosMercado]);
  const oportunidades = useMemo(() => gerarOportunidades(imoveis as any[], regioes), [imoveis, regioes]);

  const totalOportunidades = oportunidades.length;
  const mediaqScore = totalOportunidades > 0 ? Math.round(oportunidades.reduce((a, b) => a + b.qScore, 0) / totalOportunidades) : 0;
  const mediaLiquidez = regioes.length > 0 ? Math.round(regioes.reduce((a, b) => a + b.indiceLiquidez, 0) / regioes.length) : 0;
  const mediaVacancia = regioes.length > 0 ? Math.round(regioes.reduce((a, b) => a + b.indiceVacancia, 0) / regioes.length) : 0;
  const superprecoCount = oportunidades.filter(o => o.riscoSuperpreco === "alto" || o.riscoSuperpreco === "critico").length;
  const topOportunidades = oportunidades.slice(0, 10);
  const topBairros = regioes.slice(0, 8);

  const scripts = selectedOp ? gerarScriptAbordagem(selectedOp, nome_empresa || "Consultor") : null;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado!" });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
              <Crosshair className="w-7 h-7 text-primary" />
              Q-Capture Intelligence
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Sistema Estratégico de Captação Imobiliária</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={modo} onValueChange={setModo}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Modo Completo</SelectItem>
                <SelectItem value="venda">Modo Venda</SelectItem>
                <SelectItem value="aluguel">Modo Aluguel</SelectItem>
              </SelectContent>
            </Select>
            <Badge variant="outline" className="gap-1 text-xs"><Shield className="w-3 h-3" /> LGPD Safe</Badge>
            {dadosMercado.length > 0 && (
              <Badge variant="secondary" className="gap-1 text-xs"><Database className="w-3 h-3" /> {dadosMercado.length} dados reais</Badge>
            )}
          </div>
        </motion.div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">Carregando inteligência territorial...</div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { label: "Oportunidades", value: totalOportunidades, icon: Target, color: "text-primary" },
                { label: "Q-Score Médio", value: mediaqScore, icon: Crosshair, color: "text-chart-2" },
                { label: "Liquidez Média", value: `${mediaLiquidez}%`, icon: TrendingUp, color: "text-chart-1" },
                { label: "Vacância Média", value: `${mediaVacancia}%`, icon: MapPin, color: "text-chart-4" },
                { label: "Superpreço", value: superprecoCount, icon: AlertTriangle, color: "text-destructive" },
              ].map((kpi, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                      <kpi.icon className={`w-5 h-5 ${kpi.color} flex-shrink-0`} />
                      <div>
                        <p className="text-xs text-muted-foreground">{kpi.label}</p>
                        <p className="text-xl font-bold text-foreground">{kpi.value}</p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Q-Capture Score Gauge */}
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}>
                <Card className="h-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Q-Capture Score Geral</CardTitle>
                    <CardDescription>Média de oportunidade da carteira</CardDescription>
                  </CardHeader>
                  <CardContent className="flex justify-center pb-4">
                    <ScoreGauge score={mediaqScore} size={220} />
                  </CardContent>
                </Card>
              </motion.div>

              {/* Ranking Bairros */}
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }} className="lg:col-span-2">
                <Card className="h-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Ranking de Bairros</CardTitle>
                    <CardDescription>Índice de liquidez por região</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {topBairros.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-8 text-center">Cadastre imóveis para gerar análise regional.</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={topBairros} layout="vertical" margin={{ left: 10 }}>
                          <XAxis type="number" domain={[0, 100]} hide />
                          <YAxis type="category" dataKey="bairro" width={100} tick={{ fontSize: 11 }} />
                          <Tooltip formatter={(v: number) => [`${v}%`, "Liquidez"]} />
                          <Bar dataKey="indiceLiquidez" radius={[0, 6, 6, 0]}>
                            {topBairros.map((b, i) => (
                              <Cell key={i} fill={opColors[b.oportunidade]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Mapa de Calor Geoespacial */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    Mapa de Calor Territorial
                  </CardTitle>
                  <CardDescription>Concentração e oportunidade por bairro — verde (alta), amarelo (moderada), vermelho (baixa)</CardDescription>
                </CardHeader>
                <CardContent>
                  <HeatMap regioes={regioes} />
                </CardContent>
              </Card>
            </motion.div>


            <Tabs defaultValue="ranking">
              <TabsList>
              <TabsTrigger value="ranking">Top Oportunidades</TabsTrigger>
                <TabsTrigger value="regioes">Análise Regional</TabsTrigger>
                <TabsTrigger value="mercado" className="gap-1"><Database className="w-3 h-3" />Imóveis de Mercado</TabsTrigger>
                <TabsTrigger value="portais" className="gap-1"><Globe className="w-3 h-3" />Captura Portais</TabsTrigger>
              <TabsTrigger value="grupos" className="gap-1"><Users className="w-3 h-3" />Grupos & Estratégias</TabsTrigger>
               <TabsTrigger value="condominios" className="gap-1"><Users className="w-3 h-3" />Condomínios</TabsTrigger>
               <TabsTrigger value="orquestracao" className="gap-1"><Radio className="w-3 h-3" />Orquestração</TabsTrigger>
               <TabsTrigger value="enriquecimento" className="gap-1"><Sparkles className="w-3 h-3" />Enriquecimento</TabsTrigger>
               <TabsTrigger value="roteiros" className="gap-1"><FileText className="w-3 h-3" />Roteiros</TabsTrigger>
               <TabsTrigger value="agendamentos" className="gap-1"><CalendarClock className="w-3 h-3" />Agendamentos</TabsTrigger>
               <TabsTrigger value="notificacoes" className="gap-1"><Bell className="w-3 h-3" />Notificações</TabsTrigger>
             </TabsList>


              <TabsContent value="ranking">
                <Card>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/30">
                            <th className="text-left p-3 font-medium">Imóvel</th>
                            <th className="text-left p-3 font-medium">Bairro</th>
                            <th className="text-right p-3 font-medium">Preço</th>
                            <th className="text-right p-3 font-medium">R$/m²</th>
                            <th className="text-right p-3 font-medium">Mercado</th>
                            <th className="text-center p-3 font-medium">Desvio</th>
                            <th className="text-center p-3 font-medium">Score</th>
                            <th className="text-center p-3 font-medium">Risco</th>
                            <th className="text-center p-3 font-medium">Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {topOportunidades.map((op, i) => (
                            <tr key={op.imovelId} className="border-b hover:bg-muted/20 transition-colors">
                              <td className="p-3 font-medium max-w-[200px] truncate">{op.titulo}</td>
                              <td className="p-3 text-muted-foreground">{op.bairro}</td>
                              <td className="p-3 text-right">{op.preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
                              <td className="p-3 text-right">{op.precoM2.toLocaleString("pt-BR")}</td>
                              <td className="p-3 text-right">
                                {op.precoM2Mercado ? (
                                  <span className="flex items-center justify-end gap-1">
                                    {op.precoM2Mercado.toLocaleString("pt-BR")}
                                    <Database className="w-3 h-3 text-primary" />
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground text-xs">—</span>
                                )}
                              </td>
                              <td className="p-3 text-center">
                                {op.desvioMercado !== undefined ? (
                                  <Badge variant="outline" style={{
                                    borderColor: op.desvioMercado > 15 ? "hsl(0 84% 60%)" : op.desvioMercado > 5 ? "hsl(45 93% 47%)" : "hsl(142 71% 45%)",
                                    color: op.desvioMercado > 15 ? "hsl(0 84% 60%)" : op.desvioMercado > 5 ? "hsl(45 93% 47%)" : "hsl(142 71% 45%)",
                                  }}>
                                    {op.desvioMercado > 0 ? "+" : ""}{op.desvioMercado}%
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground text-xs">—</span>
                                )}
                              </td>
                              <td className="p-3 text-center">
                                <Badge variant="secondary" className="font-bold" style={{ color: op.qScore >= 71 ? "hsl(142 71% 45%)" : op.qScore >= 41 ? "hsl(45 93% 47%)" : "hsl(0 84% 60%)" }}>
                                  {op.qScore}
                                </Badge>
                              </td>
                              <td className="p-3 text-center">
                                <Badge variant="outline" style={{ borderColor: riskColors[op.riscoSuperpreco], color: riskColors[op.riscoSuperpreco] }}>
                                  {op.riscoSuperpreco}
                                </Badge>
                              </td>
                              <td className="p-3 text-center flex items-center justify-center gap-1">
                                <Button size="sm" variant="ghost" asChild>
                                  <a href={`/imovel/${op.imovelId}`} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="w-4 h-4" />
                                  </a>
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => { setSelectedOp(op); setScriptDialog(true); }}>
                                  <MessageCircle className="w-4 h-4" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                          {topOportunidades.length === 0 && (
                            <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">Nenhuma oportunidade identificada. Cadastre imóveis para análise.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="regioes">
                <Card>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/30">
                            <th className="text-left p-3 font-medium">Bairro</th>
                            <th className="text-right p-3 font-medium">Ofertas</th>
                            <th className="text-right p-3 font-medium">R$/m² Médio</th>
                            <th className="text-right p-3 font-medium">R$/m² Mercado</th>
                            <th className="text-center p-3 font-medium">Fonte</th>
                            <th className="text-center p-3 font-medium">Liquidez</th>
                            <th className="text-center p-3 font-medium">Saturação</th>
                            <th className="text-center p-3 font-medium">Oportunidade</th>
                          </tr>
                        </thead>
                        <tbody>
                          {regioes.map((r) => (
                            <tr key={r.bairro} className="border-b hover:bg-muted/20 transition-colors">
                              <td className="p-3 font-medium">{r.bairro}</td>
                              <td className="p-3 text-right">{r.totalOfertas}{r.totalOfertasMercado ? <span className="text-xs text-muted-foreground ml-1">({r.totalOfertasMercado} reais)</span> : null}</td>
                              <td className="p-3 text-right">{r.precoM2Medio.toLocaleString("pt-BR")}</td>
                              <td className="p-3 text-right">
                                {r.precoM2MercadoReal ? (
                                  <span className="flex items-center justify-end gap-1">
                                    {r.precoM2MercadoReal.toLocaleString("pt-BR")}
                                    <Database className="w-3 h-3 text-primary" />
                                  </span>
                                ) : <span className="text-muted-foreground text-xs">—</span>}
                              </td>
                              <td className="p-3 text-center">
                                <Badge variant={r.fontePreco === "mercado_real" ? "default" : r.fontePreco === "combinado" ? "secondary" : "outline"} className="text-[10px]">
                                  {r.fontePreco === "mercado_real" ? "Real" : r.fontePreco === "combinado" ? "Combinado" : "Carteira"}
                                </Badge>
                              </td>
                              <td className="p-3 text-center">{r.indiceLiquidez}%</td>
                              <td className="p-3 text-center">{r.indiceSaturacao}%</td>
                              <td className="p-3 text-center">
                                <Badge style={{ backgroundColor: opColors[r.oportunidade], color: "#fff" }}>{r.oportunidade}</Badge>
                              </td>
                            </tr>
                          ))}
                          {regioes.length === 0 && (
                            <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Sem dados regionais disponíveis.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="mercado">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Database className="w-4 h-4 text-primary" />
                      Imóveis de Mercado ({dadosMercado.length})
                    </CardTitle>
                    <CardDescription>Dados reais capturados dos portais imobiliários</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    {loadingMercado ? (
                      <p className="p-8 text-center text-muted-foreground">Carregando dados de mercado...</p>
                    ) : dadosMercado.length === 0 ? (
                      <p className="p-8 text-center text-muted-foreground">Nenhum dado de mercado. Use a aba "Captura Portais" para buscar e salvar anúncios.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-muted/30">
                              <th className="text-left p-3 font-medium">Portal</th>
                              <th className="text-left p-3 font-medium">Título</th>
                              <th className="text-left p-3 font-medium">Bairro</th>
                              <th className="text-right p-3 font-medium">Preço</th>
                              <th className="text-right p-3 font-medium">Área</th>
                              <th className="text-right p-3 font-medium">R$/m²</th>
                              <th className="text-center p-3 font-medium">Quartos</th>
                              <th className="text-center p-3 font-medium">Link</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dadosMercado.slice(0, 100).map((im, i) => (
                              <tr
                                key={im.id || i}
                                className="border-b hover:bg-primary/10 transition-colors cursor-pointer"
                                onClick={() => {
                                  if (im.url_anuncio) {
                                    window.open(im.url_anuncio, '_blank', 'noopener,noreferrer');
                                  }
                                }}
                                title={im.url_anuncio ? "Clique para abrir o anúncio" : ""}
                              >
                                <td className="p-3"><Badge variant="outline" className="text-xs">{im.portal}</Badge></td>
                                <td className="p-3 max-w-[200px] truncate font-medium">{im.titulo}</td>
                                <td className="p-3 text-muted-foreground">{im.bairro || "-"}</td>
                                <td className="p-3 text-right">{im.preco ? im.preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "-"}</td>
                                <td className="p-3 text-right">{im.area ? `${im.area}m²` : "-"}</td>
                                <td className="p-3 text-right">{im.preco_m2 ? im.preco_m2.toLocaleString("pt-BR") : "-"}</td>
                                <td className="p-3 text-center">{im.quartos || "-"}</td>
                                <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                                  <div className="flex items-center justify-center gap-1">
                                    {im.url_anuncio ? (
                                      <a href={im.url_anuncio} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline text-xs">
                                        <ExternalLink className="w-3 h-3" /> Ver
                                      </a>
                                    ) : "-"}
                                    <ImportarImovelButton
                                      imovel={{
                                        titulo: im.titulo,
                                        tipo: im.tipo || undefined,
                                        operacao: im.operacao || undefined,
                                        bairro: im.bairro || undefined,
                                        cidade: im.cidade || undefined,
                                        preco: im.preco || 0,
                                        area: im.area || undefined,
                                        quartos: im.quartos || undefined,
                                        url_anuncio: im.url_anuncio || undefined,
                                      }}
                                      size="icon"
                                      variant="ghost"
                                    />
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {dadosMercado.length > 100 && (
                          <p className="text-xs text-muted-foreground p-3 text-center">Mostrando 100 de {dadosMercado.length} registros</p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="portais">
                <PortalScraperPanel />
              </TabsContent>
              <TabsContent value="grupos">
                <GruposImoveisPanel />
              </TabsContent>
              <TabsContent value="condominios">
                <ProspeccaoCondominioPanel />
              </TabsContent>
              <TabsContent value="orquestracao">
                <OrquestracaoMulticanalPanel />
              </TabsContent>
              <TabsContent value="enriquecimento">
                <EnriquecimentoContatosPanel />
              </TabsContent>
              <TabsContent value="roteiros">
                <RoteirosMensagensPanel />
              </TabsContent>
              <TabsContent value="agendamentos">
                <AgendamentosProspeccaoPanel />
              </TabsContent>
              <TabsContent value="notificacoes">
                <NotificacoesCondominioPanel />
              </TabsContent>
            </Tabs>


            {/* LGPD Notice */}
            <Card className="border-primary/20">
              <CardContent className="p-4 flex items-start gap-3">
                <Shield className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div className="text-xs text-muted-foreground">
                  <p className="font-semibold text-foreground mb-1">Conformidade LGPD</p>
                  <p>Esta plataforma utiliza exclusivamente dados públicos disponíveis em anúncios de mercado. Não realizamos coleta de dados pessoais sensíveis. Todas as análises regionais são baseadas em dados agregados e anonimizados. Para solicitações de exclusão de dados, entre em contato pelo canal de suporte.</p>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Script Dialog */}
      <Dialog open={scriptDialog} onOpenChange={setScriptDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-primary" />
              Scripts de Abordagem — {selectedOp?.titulo}
            </DialogTitle>
          </DialogHeader>
          {scripts && selectedOp && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/30">
                <ScoreGauge score={selectedOp.qScore} size={120} />
                <div className="text-sm space-y-1">
                  <p><span className="text-muted-foreground">Faixa ideal:</span> {selectedOp.faixaIdealMin.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} – {selectedOp.faixaIdealMax.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
                  <p><span className="text-muted-foreground">Tempo estimado:</span> {selectedOp.tempoEstimadoDias} dias</p>
                  <p><span className="text-muted-foreground">Risco superpreço:</span> <Badge variant="outline" style={{ borderColor: riskColors[selectedOp.riscoSuperpreco], color: riskColors[selectedOp.riscoSuperpreco] }}>{selectedOp.riscoSuperpreco}</Badge></p>
                </div>
              </div>

              {[
                { label: "Script de Ligação", icon: Phone, text: scripts.ligacao },
                { label: "Script WhatsApp", icon: MessageCircle, text: scripts.whatsapp },
                { label: "Follow-up", icon: MessageCircle, text: scripts.followup },
              ].map((s, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium flex items-center gap-1"><s.icon className="w-4 h-4" />{s.label}</span>
                    <Button size="sm" variant="ghost" onClick={() => copyToClipboard(s.text)}><Copy className="w-3 h-3 mr-1" />Copiar</Button>
                  </div>
                  <Textarea value={s.text} readOnly className="text-xs min-h-[80px] resize-none" />
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
