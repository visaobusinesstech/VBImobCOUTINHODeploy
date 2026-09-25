import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Brain, Loader2, MapPin, TrendingUp, TrendingDown, Minus,
  Star, Target, Building2, ArrowRight, Sparkles, Search,
  DoorOpen, HardHat, UserCheck, Plug, Users, ChevronDown, ChevronUp,
  ExternalLink, Home, Building, Download, FileText, FileSpreadsheet, UserPlus,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { handleAiError } from "@/lib/ai/aiErrorHandler";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { exportCaptacaoCSV, exportCaptacaoPDF, type CaptacaoExportFiltros } from "@/lib/exportCaptacaoInteligente";
import type { Captacao } from "@/hooks/useCaptacoes";
import { normalizeExternalUrl, openExternalUrl } from "@/lib/externalUrl";
import { ProcessamentoCompletoDFPanel } from "./ProcessamentoCompletoDFPanel";
import { ExportarProprietariosDialog } from "./ExportarProprietariosDialog";
import { DeduplicacaoPanel } from "./DeduplicacaoPanel";
import { AgendarBuscaCaptacaoDialog } from "./AgendarBuscaCaptacaoDialog";

type Oportunidade = {
  titulo: string;
  endereco: string;
  bairro: string;
  tipo_imovel: string;
  operacao: string;
  preco_estimado: number;
  area_estimada: number;
  quartos: number;
  score_oportunidade: number;
  motivo_oportunidade: string;
  canal_sugerido: string;
  acao_recomendada: string;
  link_anuncio?: string;
  tipo_anunciante?: string;
  nome_predio?: string;
  portal_origem?: string;
  tempo_mercado_label?: "recente" | "medio" | "prolongado";
  idade_estimada_dias?: number;
  sinais_dificuldade?: string[];
};

type ResultadoBusca = {
  oportunidades: Oportunidade[];
  resumo_mercado: string;
  tendencia: string;
  melhor_bairro: string;
  preco_m2_medio: number;
  fonte_dados?: string;
  total_anuncios_reais?: number;
  aviso_lgpd?: string;
  portais_pesquisados?: string[];
  distribuicao_portais?: Record<string, number>;
  cidades_satelites_cobertas?: string[];
  queries_executadas?: { query: string; google_url: string; portais: string[] }[];
  urls_publicas?: { url: string; portal: string; title: string }[];
};

type AnaliseImovel = {
  score: number;
  preco_estimado_min: number;
  preco_estimado_max: number;
  preco_m2_regiao: number;
  liquidez: string;
  pontos_fortes: string[];
  pontos_atencao: string[];
  estrategia_captacao: string;
  tempo_estimado_venda: string;
  publico_alvo: string;
};

const BAIRROS_BRASILIA = [
  // Plano Piloto e regiões centrais
  "Asa Sul", "Asa Norte", "Lago Sul", "Lago Norte", "Sudoeste", "Noroeste",
  "Cruzeiro", "Octogonal", "Park Way", "Jardim Botânico", "SIA", "SAAN",
  // Cidades satélites / Regiões Administrativas do DF
  "Águas Claras", "Taguatinga", "Ceilândia", "Guará", "Guará I", "Guará II",
  "Samambaia", "Sobradinho", "Sobradinho II", "Vicente Pires", "Arniqueira",
  "Gama", "Recanto das Emas", "Riacho Fundo", "Riacho Fundo II",
  "Núcleo Bandeirante", "Candangolândia", "São Sebastião", "Planaltina",
  "Brazlândia", "Paranoá", "Itapoã", "Santa Maria", "Estrutural",
  "SCIA", "Fercal", "Varjão",
];

const CANAL_ICONS: Record<string, any> = {
  porteiro: DoorOpen,
  construtor: HardHat,
  construtora: Building2,
  sindico: UserCheck,
  portal: Plug,
  indicacao: Users,
};

const CANAL_LABELS: Record<string, string> = {
  porteiro: "Porteiro",
  construtor: "Construtor",
  construtora: "Construtora",
  sindico: "Síndico",
  portal: "Portal",
  indicacao: "Indicação",
};

function ScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? "bg-green-500" : score >= 60 ? "bg-yellow-500" : score >= 40 ? "bg-orange-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={`h-full rounded-full ${color}`}
        />
      </div>
      <span className="text-sm font-bold min-w-[3ch]">{score}</span>
    </div>
  );
}

function TendenciaIcon({ tendencia }: { tendencia: string }) {
  if (tendencia === "alta") return <TrendingUp className="w-5 h-5 text-green-500" />;
  if (tendencia === "queda") return <TrendingDown className="w-5 h-5 text-red-500" />;
  return <Minus className="w-5 h-5 text-yellow-500" />;
}

function AnuncianteBadge({ tipo }: { tipo?: string }) {
  if (!tipo) return null;
  if (tipo === "proprietario") {
    return (
      <Badge className="text-[10px] gap-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-300">
        <Home className="w-3 h-3" />
        Proprietário
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] gap-1">
      <Building className="w-3 h-3" />
      {tipo === "imobiliaria" ? "Imobiliária" : "Corretor"}
    </Badge>
  );
}

export function CaptacaoInteligenteTab({
  onConvertToCaptacao,
}: {
  onConvertToCaptacao: (data: Partial<Captacao>) => Promise<void>;
}) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { imobiliariaId, user } = useAuth();
  const [criandoLead, setCriandoLead] = useState<string | null>(null);
  const [criandoLote, setCriandoLote] = useState(false);
  const [leadsCriados, setLeadsCriados] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [analisando, setAnalisando] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoBusca | null>(null);
  const [coletadoEm, setColetadoEm] = useState<string | null>(null);
  const [lgpdOpen, setLgpdOpen] = useState(false);
  const [analises, setAnalises] = useState<Record<number, AnaliseImovel>>({});
  const [expandedCard, setExpandedCard] = useState<number | null>(null);
  const [filtrosAplicados, setFiltrosAplicados] = useState<CaptacaoExportFiltros | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  // Post-search view filters (aplicados aos resultados já carregados, sem refazer busca)
  const [filtroPortal, setFiltroPortal] = useState<string>("todos");
  const [filtroAnunciante, setFiltroAnunciante] = useState<string>("todos");
  const [filtroBairroView, setFiltroBairroView] = useState<string>("todos");
  const [filtroTexto, setFiltroTexto] = useState<string>("");


  // Search params
  const [bairro, setBairro] = useState("");
  const [cep, setCep] = useState("");
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [tipoImovel, setTipoImovel] = useState("Apartamento");
  const [operacao, setOperacao] = useState("Venda");
  const [faixaPreco, setFaixaPreco] = useState("");
  const [apenasProprietarios, setApenasProprietarios] = useState(false);
  const [nomePredio, setNomePredio] = useState("");

  const buscarCep = async (cepVal: string) => {
    const clean = cepVal.replace(/\D/g, "");
    if (clean.length !== 8) return;
    setBuscandoCep(true);
    try {
      const resp = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = await resp.json();
      if (!data.erro) {
        setBairro(data.bairro || "");
      }
    } catch { /* silent */ } finally { setBuscandoCep(false); }
  };

  const buscarOportunidades = async () => {
    setLoading(true);
    setResultado(null);
    setAnalises({});
    try {
      const { data, error } = await supabase.functions.invoke("captacao-inteligente", {
        body: {
          action: "buscar_oportunidades",
          params: {
            bairro: bairro || null,
            cidade: "Brasília",
            estado: "DF",
            tipo_imovel: tipoImovel,
            operacao,
            faixa_preco: faixaPreco || null,
            apenas_proprietarios: apenasProprietarios,
            nome_predio: nomePredio || null,
          },
        },
      });

      if (handleAiError(data, error, navigate)) return;
      if (error) throw error;
      if (data?.error && !data?.error_code) throw new Error(data.error);
      if (data?.success) {
        setResultado(data.data);
        setColetadoEm(new Date().toISOString());
        setFiltrosAplicados({
          bairro: bairro || undefined,
          cidade: "Brasília",
          tipo_imovel: tipoImovel,
          operacao,
          faixa_preco: faixaPreco || undefined,
          apenas_proprietarios: apenasProprietarios,
          nome_predio: nomePredio || undefined,
        });
        toast({ title: "Busca concluída!", description: `${data.data.oportunidades.length} oportunidades encontradas` });
      }

    } catch (e: any) {
      toast({ title: "Erro na busca", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const analisarImovel = async (op: Oportunidade, index: number) => {
    setAnalisando(`${index}`);
    try {
      const { data, error } = await supabase.functions.invoke("captacao-inteligente", {
        body: {
          action: "analisar_imovel",
          params: {
            endereco: op.endereco,
            bairro: op.bairro,
            cidade: "Brasília",
            estado: "DF",
            tipo_imovel: op.tipo_imovel,
            area: op.area_estimada,
          },
        },
      });

      if (handleAiError(data, error, navigate)) return;
      if (error) throw error;
      if (data?.success) {
        setAnalises(prev => ({ ...prev, [index]: data.data }));
        setExpandedCard(index);
      }
    } catch (e: any) {
      toast({ title: "Erro na análise", description: e.message, variant: "destructive" });
    } finally {
      setAnalisando(null);
    }
  };

  const converterParaCaptacao = async (op: Oportunidade) => {
    try {
      await onConvertToCaptacao({
        tipo: op.canal_sugerido === "portal" || op.canal_sugerido === "indicacao" ? "porteiro" : op.canal_sugerido,
        nome_contato: "Captação IA - " + op.titulo,
        endereco_imovel: op.endereco,
        bairro: op.bairro,
        cidade: "Brasília",
        estado: "DF",
        tipo_imovel: op.tipo_imovel,
        operacao: op.operacao,
        observacoes: `🤖 Captação via IA\nScore: ${op.score_oportunidade}/100\nMotivo: ${op.motivo_oportunidade}\nAção: ${op.acao_recomendada}\nPreço estimado: R$ ${op.preco_estimado.toLocaleString("pt-BR")}${op.link_anuncio ? `\n🔗 Link: ${op.link_anuncio}` : ""}${op.tipo_anunciante ? `\n👤 Anunciante: ${op.tipo_anunciante}` : ""}${op.nome_predio ? `\n🏢 Prédio: ${op.nome_predio}` : ""}`,
        status: "pendente",
      });
    } catch {
      // Toast exibido no hook de captações
    }
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

  const opKey = (op: Oportunidade) =>
    `${(op.link_anuncio || "").trim()}|${op.titulo}|${op.endereco}|${op.operacao}`;

  const mapCanalOrigem = (portal?: string): string => {
    const p = (portal || "").toLowerCase();
    if (p.includes("olx")) return "olx";
    if (p.includes("dfimoveis") || p.includes("df imoveis") || p.includes("df imóveis")) return "dfimoveis";
    if (p.includes("chavena") || p.includes("chave na mao") || p.includes("chave na mão")) return "chave_na_mao";
    if (p.includes("wimoveis") || p.includes("w imoveis") || p.includes("w imóveis")) return "wimoveis";
    if (p) return "portal_imoveis";
    return "outro";
  };

  const buildLeadPayload = (op: Oportunidade) => {
    const sinais = op.sinais_dificuldade && op.sinais_dificuldade.length > 0
      ? op.sinais_dificuldade.join(", ")
      : "—";
    const tempo = op.tempo_mercado_label
      ? `${op.tempo_mercado_label}${op.idade_estimada_dias ? ` (~${op.idade_estimada_dias}d)` : ""}`
      : "n/d";
    const observacoes = [
      `🎯 Lead criado a partir de Oportunidade IA`,
      `📍 CEP: ${cep || "não informado"}`,
      `🏘️ Bairro: ${op.bairro || "não informado"}`,
      `🏷️ Tipo de Lead / Oportunidade: ${op.tipo_imovel} — ${op.operacao}`,
      `⭐ Score da Oportunidade: ${op.score_oportunidade}/100`,
      `⏱️ Tempo de mercado: ${tempo}`,
      `⚠️ Sinais de Dificuldade: ${sinais}`,
      `💡 Motivo: ${op.motivo_oportunidade}`,
      `🎬 Ação recomendada: ${op.acao_recomendada}`,
      op.nome_predio ? `🏢 Prédio: ${op.nome_predio}` : "",
      op.tipo_anunciante ? `👤 Anunciante: ${op.tipo_anunciante}` : "",
      op.link_anuncio ? `🔗 Anúncio: ${op.link_anuncio}` : "",
    ].filter(Boolean).join("\n");

    return {
      imobiliaria_id: imobiliariaId,
      created_by: user?.id ?? null,
      nome: op.nome_predio
        ? `${op.nome_predio} — ${op.tipo_imovel}`
        : `${op.tipo_imovel} · ${op.bairro || op.endereco}`.slice(0, 120),
      interesse: `${op.tipo_imovel} para ${op.operacao}`,
      valor: op.preco_estimado || 0,
      tipo_operacao: (op.operacao || "venda").toLowerCase().includes("alug") ? "aluguel" : "venda",
      bairro_interesse: op.bairro || null,
      tipo_imovel_interesse: op.tipo_imovel || null,
      canal_origem: mapCanalOrigem(op.portal_origem),
      estagio: "novos",
      observacoes,
    };
  };

  const criarLeadDeOportunidade = async (op: Oportunidade) => {
    if (!imobiliariaId) {
      toast({ title: "Sessão expirada", description: "Faça login novamente.", variant: "destructive" });
      return;
    }
    const key = opKey(op);
    setCriandoLead(key);
    try {
      const { error } = await supabase.from("leads").insert(buildLeadPayload(op) as any);
      if (error) throw error;
      setLeadsCriados(prev => new Set(prev).add(key));
      toast({ title: "Lead criado no CRM", description: `Score ${op.score_oportunidade}/100 · ${op.bairro || "sem bairro"}` });
    } catch (e: any) {
      toast({ title: "Erro ao criar lead", description: e.message, variant: "destructive" });
    } finally {
      setCriandoLead(null);
    }
  };

  const criarLeadsEmLote = async () => {
    if (!imobiliariaId) {
      toast({ title: "Sessão expirada", description: "Faça login novamente.", variant: "destructive" });
      return;
    }
    const pendentes = oportunidadesVisiveis.filter(op => !leadsCriados.has(opKey(op)));
    if (pendentes.length === 0) {
      toast({ title: "Nada a criar", description: "Todas as oportunidades visíveis já viraram leads." });
      return;
    }
    setCriandoLote(true);
    try {
      const payload = pendentes.map(buildLeadPayload);
      const { error } = await supabase.from("leads").insert(payload as any);
      if (error) throw error;
      setLeadsCriados(prev => {
        const next = new Set(prev);
        pendentes.forEach(op => next.add(opKey(op)));
        return next;
      });
      toast({ title: `${pendentes.length} leads criados no CRM`, description: "Verifique no Pipeline · estágio Novos." });
    } catch (e: any) {
      toast({ title: "Erro ao criar leads em lote", description: e.message, variant: "destructive" });
    } finally {
      setCriandoLote(false);
    }
  };



  // Lista visível após aplicar filtros de tela (portal/cidade/anunciante/busca)
  const oportunidadesVisiveis = (resultado?.oportunidades || []).filter((op) => {
    if (filtroPortal !== "todos" && (op.portal_origem || "") !== filtroPortal) return false;
    if (filtroAnunciante !== "todos" && (op.tipo_anunciante || "") !== filtroAnunciante) return false;
    if (filtroBairroView !== "todos" && (op.bairro || "") !== filtroBairroView) return false;
    if (filtroTexto.trim()) {
      const q = filtroTexto.trim().toLowerCase();
      const hay = `${op.titulo} ${op.endereco} ${op.bairro} ${op.nome_predio || ""} ${op.portal_origem || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const totalVisiveis = oportunidadesVisiveis.length;
  const totalGeral = resultado?.oportunidades.length || 0;
  const temFiltroAtivo =
    filtroPortal !== "todos" ||
    filtroAnunciante !== "todos" ||
    filtroBairroView !== "todos" ||
    filtroTexto.trim() !== "";

  const portaisDisponiveis = Array.from(
    new Set((resultado?.oportunidades || []).map((o) => o.portal_origem).filter(Boolean) as string[])
  ).sort();
  const bairrosDisponiveis = Array.from(
    new Set((resultado?.oportunidades || []).map((o) => o.bairro).filter(Boolean) as string[])
  ).sort();
  const anunciantesDisponiveis = Array.from(
    new Set((resultado?.oportunidades || []).map((o) => o.tipo_anunciante).filter(Boolean) as string[])
  ).sort();

  return (
    <div className="space-y-6">

      {/* Processamento Completo DF — automação em lote de todas as RAs × Venda/Aluguel */}
      <ProcessamentoCompletoDFPanel tipoImovel={tipoImovel} />

      {/* Exportação avançada da lista de proprietários captados */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setExportDialogOpen(true)}>
          <Download className="w-4 h-4 mr-2" />
          Exportar Relatório de Proprietários (CSV/PDF)
        </Button>
      </div>
      <ExportarProprietariosDialog open={exportDialogOpen} onOpenChange={setExportDialogOpen} />

      {/* Deduplicação por telefone E.164 */}
      <DeduplicacaoPanel />


      {/* Search Panel */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Brain className="w-5 h-5 text-primary" />
            Busca Inteligente de Oportunidades
          </CardTitle>
          <p className="text-sm text-muted-foreground">A IA analisa o mercado e identifica as melhores oportunidades de captação na região</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div>
              <Label className="text-xs">📍 CEP</Label>
              <div className="relative">
                <Input
                  value={cep}
                  onChange={e => {
                    setCep(e.target.value);
                    if (e.target.value.replace(/\D/g, "").length === 8) buscarCep(e.target.value);
                  }}
                  placeholder="70000-000"
                  maxLength={9}
                />
                {buscandoCep && <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-3 text-muted-foreground" />}
              </div>
            </div>
            <div>
              <Label className="text-xs">Bairro / Região</Label>
              <Input
                value={bairro}
                onChange={e => setBairro(e.target.value)}
                placeholder="Ex: Asa Sul"
                list="bairros-ia"
              />
              <datalist id="bairros-ia">
                {BAIRROS_BRASILIA.map(b => <option key={b} value={b} />)}
              </datalist>
            </div>
            <div>
              <Label className="text-xs">Tipo de Imóvel</Label>
              <Select value={tipoImovel} onValueChange={setTipoImovel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Apartamento", "Casa", "Terreno", "Comercial", "Cobertura", "Kitnet", "Galpão", "Sala Comercial", "Loja", "Flat", "Sobrado", "Chácara", "Fazenda", "Ponto Comercial", "Prédio", "Conjunto de Salas"].map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Operação</Label>
              <Select value={operacao} onValueChange={setOperacao}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Venda">Venda</SelectItem>
                  <SelectItem value="Locação">Locação</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Faixa de Preço</Label>
              <Select value={faixaPreco} onValueChange={setFaixaPreco}>
                <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  <SelectItem value="ate_300k">Até R$ 300 mil</SelectItem>
                  <SelectItem value="300k_600k">R$ 300 - 600 mil</SelectItem>
                  <SelectItem value="600k_1m">R$ 600 mil - 1M</SelectItem>
                  <SelectItem value="1m_2m">R$ 1M - 2M</SelectItem>
                  <SelectItem value="acima_2m">Acima de R$ 2M</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* New filters row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
            <div>
              <Label className="text-xs">🏢 Prédio / Condomínio</Label>
              <Input
                value={nomePredio}
                onChange={e => setNomePredio(e.target.value)}
                placeholder="Ex: Ed. Solar, Cond. Águas Claras"
              />
            </div>
            <div className="flex items-end gap-3 col-span-1 md:col-span-2">
              <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
                <Switch
                  checked={apenasProprietarios}
                  onCheckedChange={setApenasProprietarios}
                  id="filtro-proprietario"
                />
                <Label htmlFor="filtro-proprietario" className="text-xs cursor-pointer flex items-center gap-1.5">
                  <Home className="w-3.5 h-3.5 text-green-600" />
                  Apenas Proprietários
                </Label>
              </div>
            </div>
          </div>

          <Button onClick={buscarOportunidades} disabled={loading} className="w-full mt-4">
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Analisando mercado com IA...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Buscar Oportunidades com IA
              </>
            )}
          </Button>

          <AgendarBuscaCaptacaoDialog
            params={{
              bairro: bairro || null,
              cidade: "Brasília",
              estado: "DF",
              tipo_imovel: tipoImovel,
              operacao,
              faixa_preco: faixaPreco || null,
              apenas_proprietarios: apenasProprietarios,
              nome_predio: nomePredio || null,
            }}
          />
        </CardContent>
      </Card>

      {/* Market Summary */}
      {resultado && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {/* Filtros de tela + exportação (opera apenas sobre os itens já carregados) */}
          <Card className="p-3 mb-3">
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[180px]">
                <Label className="text-[11px] text-muted-foreground">Buscar nos resultados</Label>
                <Input
                  value={filtroTexto}
                  onChange={(e) => setFiltroTexto(e.target.value)}
                  placeholder="Título, endereço, prédio..."
                  className="h-8 text-xs"
                />
              </div>
              <div className="min-w-[140px]">
                <Label className="text-[11px] text-muted-foreground">Portal</Label>
                <Select value={filtroPortal} onValueChange={setFiltroPortal}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os portais</SelectItem>
                    {portaisDisponiveis.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-[140px]">
                <Label className="text-[11px] text-muted-foreground">Cidade / Bairro</Label>
                <Select value={filtroBairroView} onValueChange={setFiltroBairroView}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {bairrosDisponiveis.map((b) => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-[140px]">
                <Label className="text-[11px] text-muted-foreground">Anunciante</Label>
                <Select value={filtroAnunciante} onValueChange={setFiltroAnunciante}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {anunciantesDisponiveis.map((a) => (
                      <SelectItem key={a} value={a}>{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {temFiltroAtivo && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs"
                  onClick={() => {
                    setFiltroPortal("todos");
                    setFiltroAnunciante("todos");
                    setFiltroBairroView("todos");
                    setFiltroTexto("");
                  }}
                >
                  Limpar filtros
                </Button>
              )}
            </div>
          </Card>

          <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
            <p className="text-sm text-muted-foreground">
              {temFiltroAtivo ? (
                <>
                  <strong>{totalVisiveis}</strong> de {totalGeral} resultado(s) após filtros
                </>
              ) : (
                <>
                  <strong>{totalGeral}</strong> resultado(s) da busca atual
                </>
              )}
            </p>
            <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="default"
              onClick={criarLeadsEmLote}
              disabled={criandoLote || totalVisiveis === 0}
              title="Cria um lead no CRM (Pipeline · Novos) para cada oportunidade visível"
            >
              {criandoLote ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}
              Criar {totalVisiveis} lead(s) no CRM
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" disabled={totalVisiveis === 0}>
                  <Download className="w-4 h-4 mr-2" />
                  {temFiltroAtivo ? `Exportar (${totalVisiveis} filtrados)` : "Exportar"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() =>
                    exportCaptacaoCSV({
                      itens: oportunidadesVisiveis,
                      filtros: {
                        ...(filtrosAplicados || {}),
                        ...(filtroPortal !== "todos" ? { portal_filtro: filtroPortal } : {}),
                        ...(filtroBairroView !== "todos" ? { bairro_filtro: filtroBairroView } : {}),
                        ...(filtroAnunciante !== "todos" ? { anunciante_filtro: filtroAnunciante } : {}),
                        ...(filtroTexto.trim() ? { busca_texto: filtroTexto.trim() } : {}),
                      },
                      portais: filtroPortal !== "todos" ? [filtroPortal] : resultado.portais_pesquisados,
                      cidades: filtroBairroView !== "todos" ? [filtroBairroView] : resultado.cidades_satelites_cobertas,
                      coletadoEm,
                    })
                  }
                >
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Exportar CSV {temFiltroAtivo ? "(filtrado)" : ""}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    exportCaptacaoPDF({
                      itens: oportunidadesVisiveis,
                      filtros: {
                        ...(filtrosAplicados || {}),
                        ...(filtroPortal !== "todos" ? { portal_filtro: filtroPortal } : {}),
                        ...(filtroBairroView !== "todos" ? { bairro_filtro: filtroBairroView } : {}),
                        ...(filtroAnunciante !== "todos" ? { anunciante_filtro: filtroAnunciante } : {}),
                        ...(filtroTexto.trim() ? { busca_texto: filtroTexto.trim() } : {}),
                      },
                      portais: filtroPortal !== "todos" ? [filtroPortal] : resultado.portais_pesquisados,
                      cidades: filtroBairroView !== "todos" ? [filtroBairroView] : resultado.cidades_satelites_cobertas,
                      coletadoEm,
                    })
                  }
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Exportar PDF {temFiltroAtivo ? "(filtrado)" : ""}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            </div>
          </div>


          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <Card className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <TendenciaIcon tendencia={resultado.tendencia} />
                <span className="text-xs text-muted-foreground">Tendência</span>
              </div>
              <p className="font-bold capitalize">{resultado.tendencia === "alta" ? "📈 Em Alta" : resultado.tendencia === "queda" ? "📉 Em Queda" : "➡️ Estável"}</p>
            </Card>
            <Card className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground">Melhor Bairro</span>
              </div>
              <p className="font-bold text-sm">{resultado.melhor_bairro}</p>
            </Card>
            <Card className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <Building2 className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground">Preço/m² Médio</span>
              </div>
              <p className="font-bold text-sm">{fmt(resultado.preco_m2_medio)}</p>
            </Card>
            <Card className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <Target className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground">Oportunidades</span>
              </div>
              <p className="font-bold text-sm">{resultado.oportunidades.length} encontradas</p>
            </Card>
          </div>

          <Card className="p-3 mb-4 bg-muted/50">
            <p className="text-sm"><strong>Resumo do Mercado:</strong> {resultado.resumo_mercado}</p>
            {resultado.fonte_dados === "anuncios_publicos_firecrawl" ? (
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-2 flex items-center gap-1">
                🔒 <strong>{resultado.total_anuncios_reais ?? 0}</strong> anúncios públicos reais utilizados · LGPD-safe (apenas dados de portais abertos)
              </p>
            ) : (
              <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-2">
                ⚠️ Nenhum anúncio público real foi encontrado nesta busca — resultado apenas estimativo. Ajuste bairro/tipo para obter links reais.
              </p>
            )}
          </Card>

          {/* LGPD Transparency Panel (auditoria interna) */}
          <Card className="p-3 mb-4 border-dashed">
            <button
              type="button"
              onClick={() => setLgpdOpen((v) => !v)}
              className="w-full flex items-center justify-between text-left"
              aria-expanded={lgpdOpen}
            >
              <span className="text-xs font-semibold flex items-center gap-2">
                🛡️ Transparência LGPD · auditoria interna
                <Badge variant="outline" className="text-[10px]">
                  {resultado.fonte_dados === "anuncios_publicos_firecrawl" ? "dados públicos" : "estimativa"}
                </Badge>
              </span>
              {lgpdOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {lgpdOpen && (
              <div className="mt-3 space-y-2 text-[11px]">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div className="p-2 rounded bg-muted/40">
                    <div className="text-muted-foreground">Fonte de dados</div>
                    <div className="font-mono break-all">{resultado.fonte_dados || "n/d"}</div>
                  </div>
                  <div className="p-2 rounded bg-muted/40">
                    <div className="text-muted-foreground">Anúncios reais</div>
                    <div className="font-semibold">{resultado.total_anuncios_reais ?? 0}</div>
                  </div>
                  <div className="p-2 rounded bg-muted/40">
                    <div className="text-muted-foreground">Coletado em</div>
                    <div className="font-mono">
                      {coletadoEm ? new Date(coletadoEm).toLocaleString("pt-BR") : "—"}
                    </div>
                  </div>
                  <div className="p-2 rounded bg-muted/40">
                    <div className="text-muted-foreground">Oportunidades</div>
                    <div className="font-semibold">{resultado.oportunidades.length}</div>
                  </div>
                </div>
                {resultado.aviso_lgpd && (
                  <div className="p-2 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300">
                    ⚠️ {resultado.aviso_lgpd}
                  </div>
                )}
                {resultado.portais_pesquisados && resultado.portais_pesquisados.length > 0 && (
                  <div className="p-2 rounded bg-muted/40">
                    <div className="text-muted-foreground mb-1">
                      Portais pesquisados ({resultado.portais_pesquisados.length}) — DF + cidades satélites
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {resultado.portais_pesquisados.map((p) => {
                        const count = resultado.distribuicao_portais?.[p] ?? 0;
                        return (
                          <Badge
                            key={p}
                            variant={count > 0 ? "default" : "outline"}
                            className="text-[10px] font-mono"
                            title={count > 0 ? `${count} anúncio(s) encontrado(s)` : "Sem retorno nesta busca"}
                          >
                            {p}{count > 0 ? ` · ${count}` : ""}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                )}
                {resultado.cidades_satelites_cobertas && resultado.cidades_satelites_cobertas.length > 0 && (
                  <div className="p-2 rounded bg-muted/40">
                    <div className="text-muted-foreground mb-1">
                      Cobertura geográfica ({resultado.cidades_satelites_cobertas.length} RAs do DF)
                    </div>
                    <div className="text-[10px] leading-relaxed">
                      {resultado.cidades_satelites_cobertas.join(" · ")}
                    </div>
                  </div>
                )}
                {resultado.queries_executadas && resultado.queries_executadas.length > 0 && (
                  <div className="p-2 rounded bg-muted/40">
                    <div className="text-muted-foreground mb-1">
                      🔎 Buscas realizadas ({resultado.queries_executadas.length}) — clique para reproduzir no Google
                    </div>
                    <div className="space-y-1">
                      {resultado.queries_executadas.map((q, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <span className="text-muted-foreground shrink-0">#{idx + 1}</span>
                          <a
                            href={q.google_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline break-all font-mono text-[10px]"
                            title={q.query}
                          >
                            {q.query}
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {resultado.urls_publicas && resultado.urls_publicas.length > 0 && (
                  <div className="p-2 rounded bg-muted/40">
                    <div className="text-muted-foreground mb-1">
                      🔗 Todos os links coletados ({resultado.urls_publicas.length})
                    </div>
                    <ul className="space-y-0.5 max-h-48 overflow-auto">
                      {resultado.urls_publicas.map((u, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <Badge variant="outline" className="text-[9px] shrink-0">{u.portal}</Badge>
                          <a
                            href={u.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline break-all text-[10px] font-mono"
                            title={u.title || u.url}
                          >
                            {u.url}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="overflow-x-auto border rounded">
                  <table className="w-full text-[11px]">
                    <thead className="bg-muted/40">
                      <tr>
                        <th className="text-left p-1.5">#</th>
                        <th className="text-left p-1.5">Portal</th>
                        <th className="text-left p-1.5">Link do anúncio</th>
                        <th className="text-left p-1.5">Anunciante</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultado.oportunidades.map((op, i) => (
                        <tr key={i} className="border-t">
                          <td className="p-1.5 text-muted-foreground">{i + 1}</td>
                          <td className="p-1.5">{op.portal_origem || "—"}</td>
                          <td className="p-1.5 max-w-[380px]">
                            {(() => {
                              const href = normalizeExternalUrl(op.link_anuncio);
                              return href ? (
                                <a
                                  href={href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary hover:underline truncate inline-block max-w-full align-bottom"
                                  title={href}
                                >
                                  {href}
                                </a>
                              ) : (
                                <span className="text-muted-foreground italic">sem link real</span>
                              );
                            })()}
                          </td>
                          <td className="p-1.5">{op.tipo_anunciante || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Base legal: dados públicos veiculados em portais imobiliários abertos. Nenhum dado pessoal do proprietário é coletado nesta etapa (apenas título, URL e portal do anúncio). Registro mantido para auditoria interna.
                </p>
              </div>
            )}
          </Card>



          {/* Opportunity Cards */}
          {temFiltroAtivo && totalVisiveis === 0 && totalGeral > 0 && (
            <Card className="p-6 text-center text-sm text-muted-foreground mb-3">
              Nenhum resultado corresponde aos filtros ativos. Ajuste os filtros ou clique em <strong>Limpar filtros</strong>.
            </Card>
          )}
          <div className="space-y-3">
            <AnimatePresence>
              {oportunidadesVisiveis
                .sort((a, b) => b.score_oportunidade - a.score_oportunidade)
                .map((op, i) => {
                  const CanalIcon = CANAL_ICONS[op.canal_sugerido] || Target;
                  const analise = analises[i];
                  const isExpanded = expandedCard === i;

                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <Card className="overflow-hidden hover:shadow-md transition-shadow">
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <h3 className="font-semibold text-sm truncate">{op.titulo}</h3>
                                {op.score_oportunidade >= 80 && (
                                  <Star className="w-4 h-4 text-yellow-500 fill-yellow-500 shrink-0" />
                                )}
                                <AnuncianteBadge tipo={op.tipo_anunciante} />
                                {op.tempo_mercado_label === "prolongado" && (
                                  <Badge className="text-[10px] bg-orange-600 hover:bg-orange-600 text-white gap-1">
                                    🔥 {op.idade_estimada_dias ?? 30}+ dias no mercado
                                  </Badge>
                                )}
                                {op.tempo_mercado_label === "recente" && (
                                  <Badge variant="outline" className="text-[10px]">
                                    ⏱ recente
                                  </Badge>
                                )}
                                {op.sinais_dificuldade?.map((s) => (
                                  <Badge key={s} variant="secondary" className="text-[10px]">💡 {s}</Badge>
                                ))}
                              </div>
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {op.endereco} — {op.bairro}
                              </p>
                              {op.nome_predio && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                  <Building className="w-3 h-3" />
                                  {op.nome_predio}
                                </p>
                              )}
                            </div>
                            <div className="text-right shrink-0">
                              <p className="font-bold text-primary text-sm">{fmt(op.preco_estimado)}</p>
                              <p className="text-[10px] text-muted-foreground">{op.area_estimada}m² · {op.quartos}q</p>
                            </div>
                          </div>

                          <div className="mt-3 grid grid-cols-3 gap-2">
                            <div>
                              <p className="text-[10px] text-muted-foreground mb-1">Score</p>
                              <ScoreBar score={op.score_oportunidade} />
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Badge variant="outline" className="text-[10px] gap-1">
                                <CanalIcon className="w-3 h-3" />
                                {CANAL_LABELS[op.canal_sugerido] || op.canal_sugerido}
                              </Badge>
                              <Badge variant="secondary" className="text-[10px]">
                                {op.operacao}
                              </Badge>
                            </div>
                            <div className="flex items-center justify-end gap-1">
                              {normalizeExternalUrl(op.link_anuncio) && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-xs px-2"
                                  onClick={() => openExternalUrl(op.link_anuncio)}
                                  title="Ver anúncio original"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                onClick={() => isExpanded ? setExpandedCard(null) : analisarImovel(op, i)}
                                disabled={analisando === `${i}`}
                              >
                                {analisando === `${i}` ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : analise ? (
                                  <>
                                    {isExpanded ? <ChevronUp className="w-3 h-3 mr-1" /> : <ChevronDown className="w-3 h-3 mr-1" />}
                                    Detalhes
                                  </>
                                ) : (
                                  <>
                                    <Search className="w-3 h-3 mr-1" />
                                    Analisar
                                  </>
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                className="h-7 text-xs"
                                onClick={() => criarLeadDeOportunidade(op)}
                                disabled={criandoLead === opKey(op) || leadsCriados.has(opKey(op))}
                                title="Criar lead no CRM (Pipeline · Novos)"
                              >
                                {criandoLead === opKey(op) ? (
                                  <Loader2 className="w-3 h-3 animate-spin mr-1" />
                                ) : (
                                  <UserPlus className="w-3 h-3 mr-1" />
                                )}
                                {leadsCriados.has(opKey(op)) ? "Lead criado" : "Criar Lead"}
                              </Button>
                              <Button
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => converterParaCaptacao(op)}
                              >
                                <ArrowRight className="w-3 h-3 mr-1" />
                                Captar
                              </Button>
                            </div>
                          </div>

                          <p className="text-xs text-muted-foreground mt-2 italic">💡 {op.motivo_oportunidade}</p>

                          {/* Link do anúncio público (origem real) */}
                          {(() => {
                            const href = normalizeExternalUrl(op.link_anuncio);
                            if (!href) return null;
                            return (
                              <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 mt-2 text-[11px] text-primary hover:underline max-w-full"
                                title={href}
                              >
                                <ExternalLink className="w-3 h-3 shrink-0" />
                                <span className="font-medium">Anúncio em {op.portal_origem || "portal público"}</span>
                                <span className="truncate text-muted-foreground">· {href}</span>
                              </a>
                            );
                          })()}

                          {/* Expanded Analysis */}
                          <AnimatePresence>
                            {isExpanded && analise && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="mt-4 pt-4 border-t border-border space-y-3">
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <div className="bg-muted/50 rounded-lg p-2">
                                      <p className="text-[10px] text-muted-foreground">Faixa de Preço</p>
                                      <p className="text-xs font-bold">{fmt(analise.preco_estimado_min)} - {fmt(analise.preco_estimado_max)}</p>
                                    </div>
                                    <div className="bg-muted/50 rounded-lg p-2">
                                      <p className="text-[10px] text-muted-foreground">Preço/m² Região</p>
                                      <p className="text-xs font-bold">{fmt(analise.preco_m2_regiao)}</p>
                                    </div>
                                    <div className="bg-muted/50 rounded-lg p-2">
                                      <p className="text-[10px] text-muted-foreground">Liquidez</p>
                                      <Badge variant={analise.liquidez === "alta" ? "default" : "secondary"} className="text-[10px] mt-0.5">
                                        {analise.liquidez === "alta" ? "🟢" : analise.liquidez === "media" ? "🟡" : "🔴"} {analise.liquidez}
                                      </Badge>
                                    </div>
                                    <div className="bg-muted/50 rounded-lg p-2">
                                      <p className="text-[10px] text-muted-foreground">Tempo Estimado</p>
                                      <p className="text-xs font-bold">{analise.tempo_estimado_venda}</p>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <p className="text-xs font-semibold mb-1 text-green-600">✅ Pontos Fortes</p>
                                      <ul className="space-y-0.5">
                                        {analise.pontos_fortes.map((p, j) => (
                                          <li key={j} className="text-xs text-muted-foreground">• {p}</li>
                                        ))}
                                      </ul>
                                    </div>
                                    <div>
                                      <p className="text-xs font-semibold mb-1 text-orange-600">⚠️ Atenção</p>
                                      <ul className="space-y-0.5">
                                        {analise.pontos_atencao.map((p, j) => (
                                          <li key={j} className="text-xs text-muted-foreground">• {p}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  </div>

                                  <div className="bg-primary/5 rounded-lg p-3">
                                    <p className="text-xs font-semibold mb-1">🎯 Estratégia de Captação</p>
                                    <p className="text-xs text-muted-foreground">{analise.estrategia_captacao}</p>
                                  </div>
                                  <div className="bg-muted/50 rounded-lg p-3">
                                    <p className="text-xs font-semibold mb-1">👥 Público-Alvo</p>
                                    <p className="text-xs text-muted-foreground">{analise.publico_alvo}</p>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </Card>
                    </motion.div>
                  );
                })}
            </AnimatePresence>
          </div>
        </motion.div>
      )}

      {/* Empty state */}
      {!resultado && !loading && (
        <div className="text-center py-16 text-muted-foreground">
          <Brain className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Busca Inteligente com IA</p>
          <p className="text-sm mt-1">Configure os filtros acima e clique em buscar para a IA analisar o mercado e identificar oportunidades de captação.</p>
        </div>
      )}
    </div>
  );
}
