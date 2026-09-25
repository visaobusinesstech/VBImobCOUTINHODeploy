import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useImoveis } from "@/hooks/useImoveis";
import { useImobiliariaConfig } from "@/hooks/useImobiliariaConfig";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { ScoreGauge } from "@/components/qcapture/ScoreGauge";
import { HeatMap } from "@/components/qcapture/HeatMap";
import { analisarRegioes, gerarOportunidades, gerarScriptAbordagem, type OportunidadeCaptacao, type ImovelMercadoInput } from "@/lib/qcaptureEngine";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import {
  Crosshair, TrendingUp, MapPin, AlertTriangle, Target, MessageCircle,
  Phone, Copy, Shield, Globe, Database, ExternalLink, Users, Search,
  Loader2, UserSearch, Building2, ClipboardList, Eye, ChevronDown, ChevronUp, Home,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PortalScraperPanel } from "@/components/qcapture/PortalScraperPanel";
import { GruposImoveisPanel } from "@/components/qcapture/GruposImoveisPanel";
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

const TIPOS_IMOVEL = [
  "Todos",
  "Apartamento", "Casa", "Cobertura", "Kitnet/Studio", "Loft",
  "Terreno", "Lote", "Chácara", "Fazenda",
  "Sala Comercial", "Loja", "Galpão", "Prédio Comercial",
  "Flat/Apart-Hotel", "Casa de Condomínio", "Sobrado",
];

const FAIXAS_PRECO = [
  { label: "Todas", value: "" },
  { label: "Até R$ 200 mil", value: "ate_200k" },
  { label: "R$ 200-500 mil", value: "200k_500k" },
  { label: "R$ 500k - 1M", value: "500k_1m" },
  { label: "R$ 1M - 2M", value: "1m_2m" },
  { label: "R$ 2M - 5M", value: "2m_5m" },
  { label: "Acima de R$ 5M", value: "acima_5m" },
];

const difficultyColors: Record<string, string> = {
  baixa: "text-green-600",
  media: "text-yellow-600",
  alta: "text-orange-600",
  muito_alta: "text-red-600",
};

type BuscaProprietarioResult = {
  probabilidade_sucesso: number;
  tempo_estimado: string;
  dificuldade: string;
  canais_investigacao: Array<{
    canal: string;
    descricao: string;
    custo_estimado: string;
    eficacia: number;
    tempo: string;
  }>;
  dados_publicos: Array<{
    fonte: string;
    tipo_dado: string;
    como_acessar: string;
    url_referencia?: string;
  }>;
  scripts_abordagem: Array<{
    canal_contato: string;
    destinatario: string;
    script: string;
    dica: string;
  }>;
  sinais_intencao: string[];
  plano_acao: Array<{
    passo: number;
    acao: string;
    prazo: string;
  }>;
  resumo_estrategia: string;
  anuncios_publicos?: Array<{ url: string; title: string; description: string; portal: string }>;
  total_anuncios_reais?: number;
  firecrawl_error?: string | null;
};

export function QCaptureTab() {
  const { imoveis, loading } = useImoveis({ suppressFetchErrors: true });
  const { nome_empresa } = useImobiliariaConfig();
  const { user, isMaster } = useAuth();
  const canSeeAlude = isMaster || (user?.email?.toLowerCase().includes("victor") ?? false);
  const { toast } = useToast();
  const [modo, setModo] = useState<string>("todos");
  const [tipoImovelFiltro, setTipoImovelFiltro] = useState<string>("Todos");
  const [faixaPreco, setFaixaPreco] = useState<string>("");
  const [bairroFiltro, setBairroFiltro] = useState<string>("");
  const [selectedOp, setSelectedOp] = useState<OportunidadeCaptacao | null>(null);
  const [scriptDialog, setScriptDialog] = useState(false);
  const [dadosMercado, setDadosMercado] = useState<ImovelMercadoInput[]>([]);
  const [loadingMercado, setLoadingMercado] = useState(true);

  // Busca proprietário state
  const [buscaProprietarioDialog, setBuscaProprietarioDialog] = useState(false);
  const [bpEndereco, setBpEndereco] = useState("");
  const [bpBairro, setBpBairro] = useState("");
  const [bpTipoImovel, setBpTipoImovel] = useState("Apartamento");
  const [bpOperacao, setBpOperacao] = useState("Venda");
  const [bpNomePredio, setBpNomePredio] = useState("");
  const [bpLoading, setBpLoading] = useState(false);
  const [bpResultado, setBpResultado] = useState<BuscaProprietarioResult | null>(null);
  const [bpExpandedScript, setBpExpandedScript] = useState<number | null>(null);

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

  const buscarProprietario = async () => {
    if (!bpEndereco && !bpBairro && !bpNomePredio) {
      toast({ title: "Preencha ao menos um campo", description: "Informe endereço, bairro ou nome do prédio.", variant: "destructive" });
      return;
    }
    setBpLoading(true);
    setBpResultado(null);
    try {
      const { data, error } = await supabase.functions.invoke("captacao-inteligente", {
        body: {
          action: "buscar_proprietario",
          params: {
            endereco: bpEndereco || null,
            bairro: bpBairro || null,
            cidade: "Brasília",
            estado: "DF",
            tipo_imovel: bpTipoImovel,
            operacao: bpOperacao,
            nome_predio: bpNomePredio || null,
          },
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.success) {
        setBpResultado(data.data);
        toast({ title: "Investigação concluída!", description: "Resultados da busca de proprietário prontos." });
      }
    } catch (e: any) {
      toast({ title: "Erro na busca", description: e.message, variant: "destructive" });
    } finally {
      setBpLoading(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">Carregando inteligência territorial...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Advanced Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={modo} onValueChange={setModo}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Operação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas Operações</SelectItem>
                <SelectItem value="venda">Venda</SelectItem>
                <SelectItem value="aluguel">Aluguel</SelectItem>
              </SelectContent>
            </Select>

            <Select value={tipoImovelFiltro} onValueChange={setTipoImovelFiltro}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Tipo Imóvel" />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_IMOVEL.map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={faixaPreco} onValueChange={setFaixaPreco}>
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="Faixa de Preço" />
              </SelectTrigger>
              <SelectContent>
                {FAIXAS_PRECO.map(f => (
                  <SelectItem key={f.value || "all"} value={f.value || "all"}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              placeholder="Filtrar bairro..."
              value={bairroFiltro}
              onChange={e => setBairroFiltro(e.target.value)}
              className="w-[160px]"
            />

            <Badge variant="outline" className="gap-1 text-xs"><Shield className="w-3 h-3" /> LGPD Safe</Badge>
            {dadosMercado.length > 0 && (
              <Badge variant="secondary" className="gap-1 text-xs"><Database className="w-3 h-3" /> {dadosMercado.length} dados reais</Badge>
            )}

            <div className="ml-auto">
              <Button
                variant="default"
                className="gap-2"
                onClick={() => setBuscaProprietarioDialog(true)}
              >
                <UserSearch className="w-4 h-4" />
                Buscar Proprietário com IA
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

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

      {/* Heat Map */}
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
        <TabsList className="flex-wrap">
          <TabsTrigger value="ranking">Top Oportunidades</TabsTrigger>
          <TabsTrigger value="regioes">Análise Regional</TabsTrigger>
          <TabsTrigger value="mercado" className="gap-1"><Database className="w-3 h-3" />Imóveis de Mercado</TabsTrigger>
          <TabsTrigger value="portais" className="gap-1"><Globe className="w-3 h-3" />Captura Portais</TabsTrigger>
          {canSeeAlude && <TabsTrigger value="alude" className="gap-1"><Home className="w-3 h-3" />Alude</TabsTrigger>}
          <TabsTrigger value="grupos" className="gap-1"><Users className="w-3 h-3" />Grupos & Estratégias</TabsTrigger>
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
                      <th className="text-center p-3 font-medium">Link Anúncio</th>
                      <th className="text-center p-3 font-medium">Ações</th>
                    </tr>

                  </thead>
                  <tbody>
                    {topOportunidades.map((op) => (
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
                          ) : <span className="text-muted-foreground text-xs">—</span>}
                        </td>
                        <td className="p-3 text-center">
                          {op.desvioMercado !== undefined ? (
                            <Badge variant="outline" style={{
                              borderColor: op.desvioMercado > 15 ? "hsl(0 84% 60%)" : op.desvioMercado > 5 ? "hsl(45 93% 47%)" : "hsl(142 71% 45%)",
                              color: op.desvioMercado > 15 ? "hsl(0 84% 60%)" : op.desvioMercado > 5 ? "hsl(45 93% 47%)" : "hsl(142 71% 45%)",
                            }}>
                              {op.desvioMercado > 0 ? "+" : ""}{op.desvioMercado}%
                            </Badge>
                          ) : <span className="text-muted-foreground text-xs">—</span>}
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
                        <td className="p-3 text-center">
                          {op.urlAnuncio ? (
                            <a
                              href={op.urlAnuncio}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-primary hover:underline text-xs"
                              title={op.urlAnuncio}
                            >
                              <ExternalLink className="w-3 h-3" /> Ver anúncio
                            </a>
                          ) : (
                            <span className="text-muted-foreground text-xs" title="Cadastre o link de referência do anúncio no imóvel">—</span>
                          )}
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
                      <tr><td colSpan={10} className="p-8 text-center text-muted-foreground">Nenhuma oportunidade identificada. Cadastre imóveis para análise.</td></tr>
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
                            if (im.url_anuncio) window.open(im.url_anuncio, '_blank', 'noopener,noreferrer');
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
        {canSeeAlude && (
          <TabsContent value="alude">
            <PortalScraperPanel
              presetPortal="alude"
              title="Plataforma Alude"
              description="Busca dedicada na plataforma Alude para captação direta com proprietários."
            />
          </TabsContent>
        )}
        <TabsContent value="grupos">
          <GruposImoveisPanel />
        </TabsContent>
      </Tabs>

      {/* LGPD Notice */}
      <Card className="border-primary/20">
        <CardContent className="p-4 flex items-start gap-3">
          <Shield className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground">
            <p className="font-semibold text-foreground mb-1">Conformidade LGPD</p>
            <p>Esta plataforma utiliza exclusivamente dados públicos disponíveis em anúncios de mercado. Não realizamos coleta de dados pessoais sensíveis. Todas as análises regionais são baseadas em dados agregados e anonimizados.</p>
          </div>
        </CardContent>
      </Card>

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

      {/* Buscar Proprietário Dialog */}
      <Dialog open={buscaProprietarioDialog} onOpenChange={setBuscaProprietarioDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserSearch className="w-5 h-5 text-primary" />
              Busca Minuciosa de Proprietário com IA
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Search Form */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Endereço do Imóvel</Label>
                    <Input
                      placeholder="Ex: SQS 308, Bloco A, Apt 401"
                      value={bpEndereco}
                      onChange={e => setBpEndereco(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Bairro</Label>
                    <Input
                      placeholder="Ex: Asa Sul"
                      value={bpBairro}
                      onChange={e => setBpBairro(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Nome do Prédio/Condomínio</Label>
                    <Input
                      placeholder="Ex: Ed. Solar do Lago"
                      value={bpNomePredio}
                      onChange={e => setBpNomePredio(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Tipo de Imóvel</Label>
                      <Select value={bpTipoImovel} onValueChange={setBpTipoImovel}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIPOS_IMOVEL.filter(t => t !== "Todos").map(t => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Operação</Label>
                      <Select value={bpOperacao} onValueChange={setBpOperacao}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Venda">Venda</SelectItem>
                          <SelectItem value="Locação">Locação</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <Button
                  onClick={buscarProprietario}
                  disabled={bpLoading}
                  className="w-full gap-2"
                >
                  {bpLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  {bpLoading ? "Investigando com IA..." : "Iniciar Investigação"}
                </Button>
              </CardContent>
            </Card>

            {/* Results */}
            <AnimatePresence>
              {bpResultado && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  {/* Summary Card */}
                  <Card className="border-primary/30">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4 flex-wrap">
                        <div className="flex-1 min-w-[200px]">
                          <p className="text-xs text-muted-foreground mb-1">Probabilidade de Sucesso</p>
                          <div className="flex items-center gap-2">
                            <Progress value={bpResultado.probabilidade_sucesso} className="flex-1" />
                            <span className="text-lg font-bold text-primary">{bpResultado.probabilidade_sucesso}%</span>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Tempo Estimado</p>
                          <p className="font-semibold text-foreground">{bpResultado.tempo_estimado}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Dificuldade</p>
                          <Badge variant="outline" className={difficultyColors[bpResultado.dificuldade]}>
                            {bpResultado.dificuldade === "muito_alta" ? "Muito Alta" : bpResultado.dificuldade.charAt(0).toUpperCase() + bpResultado.dificuldade.slice(1)}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mt-3">{bpResultado.resumo_estrategia}</p>
                    </CardContent>
                  </Card>

                  {/* Anúncios Públicos Reais — link de referência do imóvel */}
                  <Card className="border-primary/30 bg-primary/5">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        🔗 Anúncios Públicos Encontrados ({bpResultado.anuncios_publicos?.length || 0})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {bpResultado.firecrawl_error && (
                        <p className="text-xs text-amber-600">⚠️ {bpResultado.firecrawl_error}</p>
                      )}
                      {(!bpResultado.anuncios_publicos || bpResultado.anuncios_publicos.length === 0) && !bpResultado.firecrawl_error && (
                        <p className="text-xs text-muted-foreground">Nenhum anúncio público real encontrado nos portais para os filtros informados.</p>
                      )}
                      {(bpResultado.anuncios_publicos || []).map((a, i) => (
                        <div key={i} className="p-2 rounded-md bg-background border border-border">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="secondary" className="text-[10px]">{a.portal}</Badge>
                            <a
                              href={a.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline truncate flex-1"
                              title={a.url}
                            >
                              {a.title || a.url}
                            </a>
                          </div>
                          {a.description && (
                            <p className="text-[11px] text-muted-foreground line-clamp-2">{a.description}</p>
                          )}
                        </div>
                      ))}
                    </CardContent>
                  </Card>


                  {/* Canais de Investigação */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Eye className="w-4 h-4 text-primary" />
                        Canais de Investigação ({bpResultado.canais_investigacao.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-muted/30">
                              <th className="text-left p-3 font-medium">Canal</th>
                              <th className="text-left p-3 font-medium">Descrição</th>
                              <th className="text-center p-3 font-medium">Eficácia</th>
                              <th className="text-center p-3 font-medium">Custo</th>
                              <th className="text-center p-3 font-medium">Tempo</th>
                            </tr>
                          </thead>
                          <tbody>
                            {bpResultado.canais_investigacao.map((c, i) => (
                              <tr key={i} className="border-b hover:bg-muted/20">
                                <td className="p-3 font-medium">{c.canal}</td>
                                <td className="p-3 text-muted-foreground text-xs">{c.descricao}</td>
                                <td className="p-3 text-center">
                                  <Badge variant="secondary" style={{ color: c.eficacia >= 70 ? "hsl(142 71% 45%)" : c.eficacia >= 40 ? "hsl(45 93% 47%)" : "hsl(0 84% 60%)" }}>
                                    {c.eficacia}%
                                  </Badge>
                                </td>
                                <td className="p-3 text-center text-xs">{c.custo_estimado}</td>
                                <td className="p-3 text-center text-xs">{c.tempo}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Dados Públicos */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Database className="w-4 h-4 text-primary" />
                        Fontes de Dados Públicos ({bpResultado.dados_publicos.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {bpResultado.dados_publicos.map((d, i) => (
                        <div key={i} className="p-3 rounded-lg bg-muted/30 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">{d.fonte}</span>
                            {d.url_referencia && (
                              <a href={d.url_referencia} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs flex items-center gap-1">
                                <ExternalLink className="w-3 h-3" /> Acessar
                              </a>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground"><strong>Dado:</strong> {d.tipo_dado}</p>
                          <p className="text-xs text-muted-foreground"><strong>Como acessar:</strong> {d.como_acessar}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  {/* Scripts de Abordagem */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <MessageCircle className="w-4 h-4 text-primary" />
                        Scripts de Abordagem ({bpResultado.scripts_abordagem.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {bpResultado.scripts_abordagem.map((s, i) => (
                        <div key={i} className="border rounded-lg overflow-hidden">
                          <button
                            className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors"
                            onClick={() => setBpExpandedScript(bpExpandedScript === i ? null : i)}
                          >
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px]">
                                {s.canal_contato === "telefone" ? "📞" : s.canal_contato === "whatsapp" ? "💬" : s.canal_contato === "presencial" ? "🤝" : s.canal_contato === "email" ? "📧" : "✉️"}
                                {" "}{s.canal_contato}
                              </Badge>
                              <span className="text-sm font-medium">{s.destinatario}</span>
                            </div>
                            {bpExpandedScript === i ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                          <AnimatePresence>
                            {bpExpandedScript === i && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="p-3 border-t space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-muted-foreground font-medium">Script:</span>
                                    <Button size="sm" variant="ghost" onClick={() => copyToClipboard(s.script)}>
                                      <Copy className="w-3 h-3 mr-1" />Copiar
                                    </Button>
                                  </div>
                                  <Textarea value={s.script} readOnly className="text-xs min-h-[80px] resize-none" />
                                  <div className="p-2 rounded bg-primary/5 border border-primary/10">
                                    <p className="text-xs"><strong className="text-primary">💡 Dica:</strong> {s.dica}</p>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  {/* Plano de Ação */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <ClipboardList className="w-4 h-4 text-primary" />
                        Plano de Ação
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {bpResultado.plano_acao.map((p, i) => (
                        <div key={i} className="flex items-start gap-3 p-2">
                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold text-primary">{p.passo}</span>
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium">{p.acao}</p>
                            <p className="text-xs text-muted-foreground">Prazo: {p.prazo}</p>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  {/* Sinais de Intenção */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Target className="w-4 h-4 text-primary" />
                        Sinais de Intenção de Venda/Locação
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-1">
                        {bpResultado.sinais_intencao.map((s, i) => (
                          <li key={i} className="text-sm flex items-start gap-2">
                            <span className="text-primary mt-0.5">•</span>
                            {s}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
