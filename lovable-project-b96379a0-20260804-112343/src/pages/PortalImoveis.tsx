import { useEffect, useState, useMemo } from "react";
import { Seo } from "@/components/Seo";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Search, MapPin, Bed, Bath, Car, Maximize, SlidersHorizontal, X, Building2, Loader2, LogIn, Globe, ExternalLink, Link2, LayoutGrid, Sparkles } from "lucide-react";
import { ImovelPremiumCard } from "@/components/portal/ImovelPremiumCard";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { LeadCaptureDialog } from "@/components/portal/LeadCaptureDialog";
import { LoginDialog } from "@/components/LoginDialog";
import { ImportarViaLinkDialog } from "@/components/imoveis/ImportarViaLinkDialog";
import { useAuth } from "@/contexts/AuthContext";

const formatPreco = (preco: number, operacao: string) => {
  const formatted = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(preco);
  return operacao === "Aluguel" ? `${formatted}/mês` : formatted;
};

const TIPOS = ["Apartamento", "Casa", "Terreno", "Comercial", "Cobertura", "Kitnet"];
const QUARTOS_OPTIONS = ["1+", "2+", "3+", "4+"];

// Reusable property card for user's own properties
function ImovelCard({ imovel, onInteresse }: { imovel: any; onInteresse: (im: any) => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 }}>
      <div className="group rounded-xl border border-border bg-card overflow-hidden hover:shadow-lg transition-all duration-300">
        <div className="relative aspect-[4/3] bg-muted overflow-hidden">
          {imovel.fotos?.length > 0 ? (
            <img src={imovel.fotos[0]} alt={imovel.titulo} loading="lazy" decoding="async" className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500" />

          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Building2 className="w-12 h-12 text-muted-foreground/30" />
            </div>
          )}
          <div className="absolute top-3 left-3 flex gap-1.5">
            <Badge className={imovel.operacao === "Venda" ? "bg-primary text-primary-foreground" : "bg-blue-500 text-white"}>
              {imovel.operacao}
            </Badge>
            {imovel.exclusivo && <Badge className="bg-green-600 text-white">Exclusivo</Badge>}
          </div>
          <div className="absolute bottom-3 right-3">
            <span className="px-3 py-1.5 rounded-lg bg-background/90 backdrop-blur text-sm font-bold text-foreground">
              {formatPreco(imovel.preco, imovel.operacao)}
            </span>
          </div>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <h3 className="font-semibold text-foreground line-clamp-1">{imovel.titulo}</h3>
            {(imovel.bairro || imovel.cidade) && (
              <p className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                <MapPin className="w-3.5 h-3.5" />
                {[imovel.bairro, imovel.cidade].filter(Boolean).join(", ")}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {imovel.quartos > 0 && <span className="flex items-center gap-1"><Bed className="w-3.5 h-3.5" /> {imovel.quartos}</span>}
            {imovel.banheiros > 0 && <span className="flex items-center gap-1"><Bath className="w-3.5 h-3.5" /> {imovel.banheiros}</span>}
            {imovel.vagas > 0 && <span className="flex items-center gap-1"><Car className="w-3.5 h-3.5" /> {imovel.vagas}</span>}
            {imovel.area > 0 && <span className="flex items-center gap-1"><Maximize className="w-3.5 h-3.5" /> {imovel.area}m²</span>}
          </div>
          <div className="flex gap-2 pt-1">
            <Link to={`/imovel/${imovel.id}`} className="flex-1">
              <Button variant="outline" size="sm" className="w-full text-xs">Ver detalhes</Button>
            </Link>
            <Button size="sm" className="flex-1 text-xs" onClick={() => onInteresse(imovel)}>
              Tenho interesse
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// Card for market/captured properties
function ImovelMercadoCard({ imovel }: { imovel: any }) {
  const handleClick = () => {
    if (imovel.url_anuncio) {
      window.open(imovel.url_anuncio, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 }}>
      <div
        className={`group rounded-xl border border-border bg-card overflow-hidden hover:shadow-lg transition-all duration-300 ${imovel.url_anuncio ? "cursor-pointer" : ""}`}
        onClick={handleClick}
      >
        <div className="relative aspect-[4/3] bg-muted overflow-hidden">
          {imovel.fotos?.length > 0 ? (
            <img src={imovel.fotos[0]} alt={imovel.titulo} loading="lazy" decoding="async" className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
              <Globe className="w-12 h-12 text-muted-foreground/30" />
            </div>
          )}
          <div className="absolute top-3 left-3 flex gap-1.5">
            <Badge variant="secondary" className="text-xs">
              {imovel.portal}
            </Badge>
            {imovel.operacao && (
              <Badge className={imovel.operacao === "Venda" ? "bg-primary text-primary-foreground" : "bg-blue-500 text-white"}>
                {imovel.operacao}
              </Badge>
            )}
          </div>
          {imovel.url_anuncio && (
            <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-background/80 backdrop-blur flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <ExternalLink className="w-4 h-4 text-foreground" />
            </div>
          )}
          <div className="absolute bottom-3 right-3">
            {imovel.preco > 0 && (
              <span className="px-3 py-1.5 rounded-lg bg-background/90 backdrop-blur text-sm font-bold text-foreground">
                {formatPreco(imovel.preco, imovel.operacao || "Venda")}
              </span>
            )}
          </div>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <h3 className="font-semibold text-foreground line-clamp-1">{imovel.titulo}</h3>
            {(imovel.bairro || imovel.cidade) && (
              <p className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                <MapPin className="w-3.5 h-3.5" />
                {[imovel.bairro, imovel.cidade].filter(Boolean).join(", ")}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {imovel.quartos > 0 && <span className="flex items-center gap-1"><Bed className="w-3.5 h-3.5" /> {imovel.quartos}</span>}
            {imovel.banheiros > 0 && <span className="flex items-center gap-1"><Bath className="w-3.5 h-3.5" /> {imovel.banheiros}</span>}
            {imovel.vagas > 0 && <span className="flex items-center gap-1"><Car className="w-3.5 h-3.5" /> {imovel.vagas}</span>}
            {imovel.area > 0 && <span className="flex items-center gap-1"><Maximize className="w-3.5 h-3.5" /> {imovel.area}m²</span>}
          </div>
          {imovel.url_anuncio && (
            <div className="flex items-center gap-1.5 text-xs text-primary pt-1">
              <ExternalLink className="w-3 h-3" />
              <span>Abrir anúncio original</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function PortalImoveis() {
  const { session, isMaster } = useAuth();
  const isLoggedIn = !!session;
  const [imoveis, setImoveis] = useState<any[]>([]);
  const [imoveisMercado, setImoveisMercado] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMercado, setLoadingMercado] = useState(true);
  const [busca, setBusca] = useState("");
  const [operacao, setOperacao] = useState<string>("todos");
  const [tipo, setTipo] = useState<string>("todos");
  const [quartosMin, setQuartosMin] = useState<string>("todos");
  const [cidade, setCidade] = useState<string>("todos");
  const [bairro, setBairro] = useState<string>("todos");
  const [precoMax, setPrecoMax] = useState<string>("todos");
  const [showFilters, setShowFilters] = useState(false);
  const [captureImovel, setCaptureImovel] = useState<any>(null);
  const [secao, setSecao] = useState<"meus" | "captacao">("meus");
  const [importLinkOpen, setImportLinkOpen] = useState(false);
  const [layout, setLayout] = useState<"padrao" | "premium">(() => {
    if (typeof window === "undefined") return "padrao";
    return (localStorage.getItem("portal-imoveis:layout") as "padrao" | "premium") || "padrao";
  });
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("portal-imoveis:layout", layout);
  }, [layout]);

  useEffect(() => {
    const fetchImoveis = async () => {
      const { data } = await supabase
        .from("imoveis")
        .select("*")
        .eq("status", "Ativo")
        .order("created_at", { ascending: false });
      setImoveis(data ?? []);
      setLoading(false);
    };
    const fetchMercado = async () => {
      const { data } = await supabase
        .from("imoveis_mercado")
        .select("*")
        .order("data_scraping", { ascending: false });
      setImoveisMercado((data as any[]) ?? []);
      setLoadingMercado(false);
    };
    fetchImoveis();
    if (isLoggedIn) {
      fetchMercado();
    } else {
      setLoadingMercado(false);
    }
  }, [isLoggedIn]);

  const currentList = secao === "meus" ? imoveis : imoveisMercado;

  const cidades = useMemo(() => [...new Set(currentList.map(i => i.cidade).filter(Boolean))].sort(), [currentList]);
  const bairros = useMemo(() => {
    const filtered = cidade !== "todos" ? currentList.filter(i => i.cidade === cidade) : currentList;
    return [...new Set(filtered.map(i => i.bairro).filter(Boolean))].sort();
  }, [currentList, cidade]);

  const filtered = useMemo(() => {
    return currentList.filter(i => {
      if (busca && !i.titulo?.toLowerCase().includes(busca.toLowerCase()) && !i.bairro?.toLowerCase().includes(busca.toLowerCase()) && !i.cidade?.toLowerCase().includes(busca.toLowerCase())) return false;
      if (operacao !== "todos" && i.operacao !== operacao) return false;
      if (tipo !== "todos" && i.tipo !== tipo) return false;
      if (quartosMin !== "todos" && (i.quartos || 0) < parseInt(quartosMin)) return false;
      if (cidade !== "todos" && i.cidade !== cidade) return false;
      if (bairro !== "todos" && i.bairro !== bairro) return false;
      if (precoMax !== "todos") {
        const max = parseInt(precoMax);
        if ((i.preco || 0) > max) return false;
      }
      return true;
    });
  }, [currentList, busca, operacao, tipo, quartosMin, cidade, bairro, precoMax]);

  const activeFilters = [operacao, tipo, quartosMin, cidade, bairro, precoMax].filter(f => f !== "todos").length;
  const isLoading = secao === "meus" ? loading : loadingMercado;

  return (
    <div className="min-h-screen bg-background">
      <Seo title="Portal de imóveis — venda e aluguel | radarimobtech" description="Encontre apartamentos, casas e imóveis à venda e para alugar. Busque por cidade, bairro, tipo, preço e quartos no portal público radarimobtech." path="/portal" />
      {/* Top Bar with Login */}
      <div className="bg-background border-b border-border">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-sm">Radar<span className="text-primary">Proptech</span></span>
          </Link>
          <div className="flex items-center gap-2">
            <LoginDialog
              trigger={
                <Button variant="ghost" size="sm" className="gap-1.5">
                  <LogIn className="w-4 h-4" /> Entrar
                </Button>
              }
              defaultMode="login"
            />
            <LoginDialog
              trigger={
                <Button size="sm" className="bg-gradient-to-r from-primary to-blue-600 hover:opacity-90">
                  Criar Conta
                </Button>
              }
              defaultMode="signup"
            />
          </div>
        </div>
      </div>

      {/* Hero Header */}
      <header className="bg-primary text-primary-foreground">
        <div className="max-w-7xl mx-auto px-4 py-12 md:py-20 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-3xl md:text-5xl font-bold mb-3">Encontre seu imóvel ideal</h1>
            <p className="text-primary-foreground/80 text-lg mb-8">Busque entre centenas de opções de venda e aluguel</p>
            <div className="max-w-2xl mx-auto relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Buscar por título, bairro ou cidade..."
                className="pl-12 h-14 text-base rounded-xl bg-background text-foreground border-0 shadow-lg"
              />
            </div>
          </motion.div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Section Toggle */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <Button
            variant={secao === "meus" ? "default" : "outline"}
            onClick={() => { setSecao("meus"); setBusca(""); setOperacao("todos"); setTipo("todos"); setQuartosMin("todos"); setCidade("todos"); setBairro("todos"); setPrecoMax("todos"); }}
            className="gap-2"
          >
            <Building2 className="w-4 h-4" />
            Nossos Imóveis
            <Badge variant="secondary" className="ml-1">{imoveis.length}</Badge>
          </Button>
          {isLoggedIn && (
            <Button
              variant={secao === "captacao" ? "default" : "outline"}
              onClick={() => { setSecao("captacao"); setBusca(""); setOperacao("todos"); setTipo("todos"); setQuartosMin("todos"); setCidade("todos"); setBairro("todos"); setPrecoMax("todos"); }}
              className="gap-2"
            >
              <Globe className="w-4 h-4" />
              Imóveis de Captação
              <Badge variant="secondary" className="ml-1">{imoveisMercado.length}</Badge>
            </Button>
          )}
          {isLoggedIn && isMaster && (
            <Button
              variant="outline"
              onClick={() => setImportLinkOpen(true)}
              className="gap-2 ml-auto border-primary/30 text-primary hover:bg-primary/10"
            >
              <Link2 className="w-4 h-4" />
              Importar via Link
            </Button>
          )}
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <Select value={operacao} onValueChange={setOperacao}>
            <SelectTrigger className="w-[130px] h-10"><SelectValue placeholder="Operação" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas</SelectItem>
              <SelectItem value="Venda">Venda</SelectItem>
              <SelectItem value="Aluguel">Aluguel</SelectItem>
            </SelectContent>
          </Select>

          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger className="w-[150px] h-10"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {TIPOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={cidade} onValueChange={v => { setCidade(v); setBairro("todos"); }}>
            <SelectTrigger className="w-[150px] h-10"><SelectValue placeholder="Cidade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas</SelectItem>
              {cidades.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>

          <Button variant={showFilters ? "default" : "outline"} size="sm" onClick={() => setShowFilters(!showFilters)} className="gap-1.5">
            <SlidersHorizontal className="w-4 h-4" />
            Filtros {activeFilters > 0 && <Badge variant="secondary" className="ml-1 h-5 px-1.5">{activeFilters}</Badge>}
          </Button>

          {activeFilters > 0 && (
            <Button variant="ghost" size="sm" onClick={() => { setOperacao("todos"); setTipo("todos"); setQuartosMin("todos"); setCidade("todos"); setBairro("todos"); setPrecoMax("todos"); setBusca(""); }}>
              <X className="w-4 h-4 mr-1" /> Limpar
            </Button>
          )}

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden sm:flex items-center rounded-lg border border-border bg-card p-0.5">
              <Button
                type="button"
                variant={layout === "padrao" ? "default" : "ghost"}
                size="sm"
                onClick={() => setLayout("padrao")}
                className="h-8 gap-1.5 px-2.5"
              >
                <LayoutGrid className="w-3.5 h-3.5" /> Padrão
              </Button>
              <Button
                type="button"
                variant={layout === "premium" ? "default" : "ghost"}
                size="sm"
                onClick={() => setLayout("premium")}
                className={`h-8 gap-1.5 px-2.5 ${layout === "premium" ? "bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-900 hover:opacity-90" : ""}`}
              >
                <Sparkles className="w-3.5 h-3.5" /> Premium
              </Button>
            </div>
            <span className="text-sm text-muted-foreground">{filtered.length} imóveis encontrados</span>
          </div>
        </div>

        {/* Extended Filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-6">
              <div className="flex flex-wrap gap-3 p-4 rounded-xl bg-card border border-border">
                <Select value={bairro} onValueChange={setBairro}>
                  <SelectTrigger className="w-[160px]"><SelectValue placeholder="Bairro" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {bairros.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>

                <Select value={quartosMin} onValueChange={setQuartosMin}>
                  <SelectTrigger className="w-[120px]"><SelectValue placeholder="Quartos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Quartos</SelectItem>
                    {QUARTOS_OPTIONS.map(q => <SelectItem key={q} value={q.replace("+", "")}>{q} quartos</SelectItem>)}
                  </SelectContent>
                </Select>

                <Select value={precoMax} onValueChange={setPrecoMax}>
                  <SelectTrigger className="w-[180px]"><SelectValue placeholder="Preço máximo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Sem limite</SelectItem>
                    <SelectItem value="200000">Até R$ 200 mil</SelectItem>
                    <SelectItem value="500000">Até R$ 500 mil</SelectItem>
                    <SelectItem value="1000000">Até R$ 1 milhão</SelectItem>
                    <SelectItem value="2000000">Até R$ 2 milhões</SelectItem>
                    <SelectItem value="5000000">Até R$ 5 milhões</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results Grid */}
        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            {secao === "meus" ? (
              <Building2 className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
            ) : (
              <Globe className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
            )}
            <p className="text-muted-foreground">
              {secao === "meus"
                ? "Nenhum imóvel encontrado com os filtros selecionados."
                : "Nenhum imóvel de captação disponível. Faça uma busca no Q-Capture para captar imóveis do mercado."}
            </p>
          </div>
        ) : layout === "premium" ? (
          <div className="grid gap-6 md:gap-8 [grid-template-columns:repeat(auto-fit,minmax(min(28rem,100%),1fr))]">
            {filtered.map((imovel) => (
              <ImovelPremiumCard
                key={imovel.id}
                imovel={imovel}
                variant={secao === "meus" ? "meus" : "captacao"}
                onInteresse={setCaptureImovel}
              />
            ))}
          </div>
        ) : (
          <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(18rem,100%),1fr))]">
            {filtered.map((imovel) =>
              secao === "meus" ? (
                <ImovelCard key={imovel.id} imovel={imovel} onInteresse={setCaptureImovel} />
              ) : (
                <ImovelMercadoCard key={imovel.id} imovel={imovel} />
              )
            )}
          </div>
        )}
      </main>

      {/* Lead Capture Dialog */}
      <LeadCaptureDialog
        open={!!captureImovel}
        onOpenChange={(open) => !open && setCaptureImovel(null)}
        imovel={captureImovel}
      />

      {/* Import via Link Dialog - Master only */}
      <ImportarViaLinkDialog open={importLinkOpen} onOpenChange={setImportLinkOpen} />
    </div>
  );
}
