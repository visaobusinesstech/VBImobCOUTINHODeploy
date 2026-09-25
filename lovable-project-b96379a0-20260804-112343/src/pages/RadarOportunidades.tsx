import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { SectionHeader, MetricCard } from "@/components/shared/MetricCard";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Flame, Circle, Target, TrendingUp, MapPin, Loader2, BarChart3, ExternalLink, Home, User, Search, X } from "lucide-react";
import { ImportarImovelButton } from "@/components/qcapture/ImportarImovelButton";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const chartTooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "12px",
  color: "hsl(var(--foreground))",
  padding: "10px 14px",
  fontSize: "13px",
};

type Oportunidade = {
  id: string;
  titulo: string;
  bairro: string;
  cidade: string;
  preco: number;
  preco_m2: number;
  media_bairro: number;
  desvio: number;
  classificacao: "alta" | "media" | "baixa";
  portal: string;
  tipo: string;
  operacao: string;
  area: number;
  quartos: number;
  url_anuncio?: string;
  is_proprietario: boolean;
  dias_anuncio?: number;
};

const BRASILIA_RAS = [
  "Águas Claras", "Asa Norte", "Asa Sul", "Brasília", "Ceilândia", "Cruzeiro", "Gama",
  "Guará", "Lago Norte", "Lago Sul", "Noroeste", "Núcleo Bandeirante", "Octogonal",
  "Paranoá", "Park Way", "Planaltina", "Recanto das Emas", "Riacho Fundo", "Riacho Fundo II",
  "Samambaia", "Santa Maria", "São Sebastião", "SCIA", "SIA", "Sobradinho", "Sobradinho II",
  "Sudoeste", "Taguatinga", "Vicente Pires", "Arniqueira", "Sol Nascente", "Pôr do Sol",
  "Jardim Botânico", "Itapoã", "Varjão", "Fercal", "Candangolândia",
];

export default function RadarOportunidades() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [imoveis, setImoveis] = useState<any[]>([]);
  const [mercado, setMercado] = useState<any[]>([]);
  const [filtroClassificacao, setFiltroClassificacao] = useState<string>("todos");
  const [filtroBairro, setFiltroBairro] = useState<string>("todos");
  const [filtroProprietario, setFiltroProprietario] = useState<string>("todos");
  const [filtroCidade, setFiltroCidade] = useState<string>("todos");
  const [busca, setBusca] = useState("");

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const [proprios, mercadoRes] = await Promise.all([
        supabase.from("imoveis").select("*").eq("status", "Ativo"),
        supabase.from("imoveis_mercado").select("*"),
      ]);
      setImoveis(proprios.data ?? []);
      setMercado(mercadoRes.data ?? []);
      setLoading(false);
    };
    fetch();
  }, [user]);

  const { oportunidades, bairroStats, precoMedioPorBairro } = useMemo(() => {
    const allImoveis = [
      ...imoveis.filter(i => i.bairro && i.bairro.trim()).map(i => ({ ...i, source: "proprio" })),
      ...mercado.filter(m => m.bairro && m.bairro.trim()).map(m => ({ ...m, source: "mercado", preco_m2: m.area > 0 ? Math.round(m.preco / m.area) : 0 })),
    ];

    const byBairro: Record<string, { precos: number[]; precos_m2: number[]; count: number }> = {};
    allImoveis.forEach(i => {
      const b = i.bairro || "Sem bairro";
      if (!byBairro[b]) byBairro[b] = { precos: [], precos_m2: [], count: 0 };
      if (i.preco > 0) byBairro[b].precos.push(i.preco);
      const pm2 = i.preco_m2 || (i.area > 0 ? i.preco / i.area : 0);
      if (pm2 > 0) byBairro[b].precos_m2.push(pm2);
      byBairro[b].count++;
    });

    const stats: Record<string, { mediaPreco: number; mediaM2: number; count: number }> = {};
    Object.entries(byBairro).forEach(([b, d]) => {
      stats[b] = {
        mediaPreco: d.precos.length > 0 ? d.precos.reduce((a, b) => a + b, 0) / d.precos.length : 0,
        mediaM2: d.precos_m2.length > 0 ? d.precos_m2.reduce((a, b) => a + b, 0) / d.precos_m2.length : 0,
        count: d.count,
      };
    });

    const ops: Oportunidade[] = [];
    [...imoveis, ...mercado].filter(i => i.bairro && i.bairro.trim()).forEach(i => {
      const b = i.bairro;
      const bairroMedia = stats[b]?.mediaPreco || 0;
      if (bairroMedia === 0 || i.preco <= 0) return;

      const desvio = ((i.preco - bairroMedia) / bairroMedia) * 100;
      let classificacao: "alta" | "media" | "baixa" = "baixa";
      if (desvio <= -15) classificacao = "alta";
      else if (desvio <= -5) classificacao = "media";
      else return;

      const pm2 = i.area > 0 ? Math.round(i.preco / i.area) : 0;
      // Detect proprietário: portal contains keywords or dados_raw hints
      const portalLower = (i.portal || "").toLowerCase();
      const tituloLower = (i.titulo || "").toLowerCase();
      const isProprietario = portalLower.includes("olx") || portalLower.includes("mercado livre") ||
        tituloLower.includes("proprietário") || tituloLower.includes("dono") || tituloLower.includes("direto") ||
        tituloLower.includes("particular") || (i.dados_raw && JSON.stringify(i.dados_raw).toLowerCase().includes("proprietário"));

      ops.push({
        id: i.id,
        titulo: i.titulo,
        bairro: b,
        cidade: i.cidade || "",
        preco: i.preco,
        preco_m2: pm2,
        media_bairro: bairroMedia,
        desvio: Math.round(desvio),
        classificacao,
        portal: i.portal || "Próprio",
        tipo: i.tipo || "Apartamento",
        operacao: i.operacao || "Venda",
        area: i.area || 0,
        quartos: i.quartos || 0,
        url_anuncio: i.url_anuncio || undefined,
        is_proprietario: isProprietario,
        dias_anuncio: i.dias_anuncio || undefined,
      });
    });

    ops.sort((a, b) => a.desvio - b.desvio);

    const chartData = Object.entries(stats)
      .filter(([, v]) => v.mediaM2 > 0)
      .map(([bairro, v]) => ({ bairro, mediaM2: Math.round(v.mediaM2), count: v.count }))
      .sort((a, b) => b.mediaM2 - a.mediaM2)
      .slice(0, 15);

    return { oportunidades: ops, bairroStats: stats, precoMedioPorBairro: chartData };
  }, [imoveis, mercado]);

  const bairros = useMemo(() => [...new Set(oportunidades.map(o => o.bairro))].sort(), [oportunidades]);
  const cidades = useMemo(() => [...new Set(oportunidades.map(o => o.cidade).filter(Boolean))].sort(), [oportunidades]);

  const filtered = useMemo(() => {
    return oportunidades.filter(o => {
      if (filtroClassificacao !== "todos" && o.classificacao !== filtroClassificacao) return false;
      if (filtroBairro !== "todos" && o.bairro !== filtroBairro) return false;
      if (filtroCidade !== "todos" && o.cidade !== filtroCidade) return false;
      if (filtroProprietario === "sim" && !o.is_proprietario) return false;
      if (filtroProprietario === "nao" && o.is_proprietario) return false;
      if (busca) {
        const q = busca.toLowerCase();
        if (!o.titulo.toLowerCase().includes(q) && !o.bairro.toLowerCase().includes(q) && !o.cidade.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [oportunidades, filtroClassificacao, filtroBairro, filtroCidade, filtroProprietario, busca]);

  const altas = oportunidades.filter(o => o.classificacao === "alta").length;
  const medias = oportunidades.filter(o => o.classificacao === "media").length;
  const proprietarios = oportunidades.filter(o => o.is_proprietario).length;

  const classBadge = (c: string) => {
    if (c === "alta") return <Badge className="bg-destructive/10 text-destructive border-destructive/20">🔥 Alta</Badge>;
    if (c === "media") return <Badge className="bg-warning/10 text-warning border-warning/20">🟡 Média</Badge>;
    return <Badge variant="secondary">⚪ Baixa</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <SectionHeader title="Radar de Oportunidades" subtitle="Imóveis abaixo do preço médio de mercado — novos no mercado com proprietários diretos" />

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <MetricCard title="Oportunidades" value={String(oportunidades.length)} icon={Target} delay={0} />
              <MetricCard title="🔥 Alta" value={String(altas)} change="Abaixo de -15%" changeType="positive" icon={Flame} delay={0.05} />
              <MetricCard title="🟡 Média" value={String(medias)} change="-5% a -15%" changeType="neutral" icon={TrendingUp} delay={0.1} />
              <MetricCard title="🏠 Proprietários" value={String(proprietarios)} change="Direto com dono" changeType="positive" icon={Home} delay={0.15} />
              <MetricCard title="Bairros" value={String(Object.keys(bairroStats).length)} icon={MapPin} delay={0.2} />
            </div>

            {precoMedioPorBairro.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card p-5 glow-border">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-5 h-5 text-primary" />
                  <h3 className="text-base font-semibold text-foreground">Preço Médio por Bairro (R$/m²)</h3>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={precoMedioPorBairro} layout="vertical" margin={{ left: 100 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" opacity={0.5} />
                    <XAxis type="number" fontSize={11} tickFormatter={v => `R$ ${v.toLocaleString("pt-BR")}`} />
                    <YAxis type="category" dataKey="bairro" fontSize={11} width={90} />
                    <Tooltip contentStyle={chartTooltipStyle} formatter={(v: number) => [`R$ ${v.toLocaleString("pt-BR")}/m²`, "Preço médio"]} />
                    <Bar dataKey="mediaM2" radius={[0, 6, 6, 0]}>
                      {precoMedioPorBairro.map((_, i) => (
                        <Cell key={i} fill={`hsl(220, 70%, ${50 + i * 2}%)`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </motion.div>
            )}

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Buscar por título ou bairro..." value={busca} onChange={e => setBusca(e.target.value)} className="pl-10" />
                {busca && <button onClick={() => setBusca("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>}
              </div>
              <Select value={filtroClassificacao} onValueChange={setFiltroClassificacao}>
                <SelectTrigger className="w-[160px]"><SelectValue placeholder="Classificação" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  <SelectItem value="alta">🔥 Alta</SelectItem>
                  <SelectItem value="media">🟡 Média</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filtroProprietario} onValueChange={setFiltroProprietario}>
                <SelectTrigger className="w-[160px]"><SelectValue placeholder="Proprietário" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="sim">🏠 Proprietário</SelectItem>
                  <SelectItem value="nao">🏢 Imobiliária</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filtroBairro} onValueChange={setFiltroBairro}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Bairro" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Bairros</SelectItem>
                  {bairros.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filtroCidade} onValueChange={setFiltroCidade}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Cidade / RA" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas as Cidades</SelectItem>
                  {/* Show cities from data + Brasilia RAs */}
                  {[...new Set([...cidades, ...BRASILIA_RAS])].sort().map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="ml-auto text-sm text-muted-foreground self-center">{filtered.length} oportunidades</span>
            </div>

            {filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Target className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Nenhuma oportunidade encontrada. Execute o Q-Capture para alimentar dados de mercado.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filtered.map((op, i) => (
                  <motion.div key={op.id + i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                    className={`rounded-xl border bg-card p-4 space-y-3 hover:shadow-md transition-shadow ${op.is_proprietario ? "border-success/40 ring-1 ring-success/20" : "border-border"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {op.is_proprietario && (
                            <Badge className="bg-success/10 text-success border-success/20 text-[10px] px-1.5 py-0">🏠 Proprietário</Badge>
                          )}
                          {op.dias_anuncio != null && op.dias_anuncio <= 7 && (
                            <Badge className="bg-info/10 text-info border-info/20 text-[10px] px-1.5 py-0">🆕 Novo</Badge>
                          )}
                        </div>
                        {op.url_anuncio ? (
                          <a href={op.url_anuncio} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary text-sm line-clamp-1 hover:underline flex items-center gap-1 mt-1">
                            {op.titulo} <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                        ) : (
                          <h4 className="font-semibold text-foreground text-sm line-clamp-1 mt-1">{op.titulo}</h4>
                        )}
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3" /> {op.bairro}, {op.cidade}
                        </p>
                      </div>
                      {classBadge(op.classificacao)}
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-lg bg-secondary p-2">
                        <p className="text-xs text-muted-foreground">Preço</p>
                        <p className="text-sm font-bold text-foreground">{formatCurrency(op.preco)}</p>
                      </div>
                      <div className="rounded-lg bg-secondary p-2">
                        <p className="text-xs text-muted-foreground">Média bairro</p>
                        <p className="text-sm font-bold text-foreground">{formatCurrency(op.media_bairro)}</p>
                      </div>
                      <div className={`rounded-lg p-2 ${op.desvio <= -15 ? "bg-destructive/10" : "bg-warning/10"}`}>
                        <p className="text-xs text-muted-foreground">Desvio</p>
                        <p className={`text-sm font-bold ${op.desvio <= -15 ? "text-destructive" : "text-warning"}`}>{op.desvio}%</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-xs">{op.tipo}</Badge>
                      <Badge variant="outline" className="text-xs">{op.operacao}</Badge>
                      {op.area > 0 && <span>{op.area}m²</span>}
                      {op.quartos > 0 && <span>{op.quartos} qts</span>}
                      {op.dias_anuncio != null && <span>{op.dias_anuncio}d</span>}
                      <span className="ml-auto">{op.portal}</span>
                    </div>

                    <ImportarImovelButton
                      imovel={{
                        titulo: op.titulo, tipo: op.tipo, operacao: op.operacao,
                        bairro: op.bairro, cidade: op.cidade, preco: op.preco,
                        area: op.area, quartos: op.quartos, url_anuncio: op.url_anuncio,
                      }}
                      size="default" variant="default"
                    />
                  </motion.div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
