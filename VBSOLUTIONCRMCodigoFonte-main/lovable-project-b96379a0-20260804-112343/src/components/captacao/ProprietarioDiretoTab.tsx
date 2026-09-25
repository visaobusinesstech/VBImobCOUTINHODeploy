import { useState, useMemo, useEffect, useCallback } from "react";
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
import { analisarRegioes, gerarOportunidades, gerarScriptAbordagem, type OportunidadeCaptacao, type ImovelMercadoInput } from "@/lib/qcaptureEngine";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Crosshair, TrendingUp, MapPin, AlertTriangle, Target, MessageCircle, Phone, Copy, Shield, Globe, Database, ExternalLink, Users, Search, Loader2 as SearchSpinner, Building, Brain, ShieldCheck, ShieldAlert, ShieldQuestion, Save, Filter, Home } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { PortalScraperPanel } from "@/components/qcapture/PortalScraperPanel";
import { GruposImoveisPanel } from "@/components/qcapture/GruposImoveisPanel";
import { ImportarImovelButton } from "@/components/qcapture/ImportarImovelButton";
import { scrapePortais, salvarImoveisMercado, type ImovelMercado } from "@/lib/api/portalScraper";
import { ListaProprietariosDialog } from "@/components/captacao/ListaProprietariosDialog";
import { ListChecks, Bookmark } from "lucide-react";
import { normalizeExternalUrl, normalizeAndValidateReferenceUrl } from "@/lib/externalUrl";

type AnaliseProprietarioMercado = {
  index: number;
  classificacao: "proprietario" | "imobiliaria" | "incerto";
  confianca: number;
  motivo: string;
  sinais: string[];
};

const getImovelKey = (im: { id?: string; url_anuncio?: string | null; titulo?: string; portal?: string }) =>
  im.id || im.url_anuncio || `${im.portal || ""}::${im.titulo || ""}`;

type CepResult = {
  bairro: string;
  logradouro: string;
  cidade: string;
};

type MercadoIARecord = ImovelMercadoInput & {
  estado?: string | null;
  nome_predio?: string | null;
  origem?: "scraping" | "ia";
  banheiros?: number | null;
  vagas?: number | null;
  fotos?: string[] | null;
};

const SEARCH_STORAGE_KEY = "captacao_proprietario_search_state";

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

const normalizeSearchValue = (value?: string | null) =>
  value
    ?.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim() || "";

const GENERIC_CEP_CITY_VALUES = new Set(["brasilia", "df", "distrito federal"]);

const compactWhitespace = (value?: string | null) => value?.replace(/\s+/g, " ").trim() || "";

const isGenericCepCity = (value?: string | null) => {
  const normalized = normalizeSearchValue(value);
  return !normalized || GENERIC_CEP_CITY_VALUES.has(normalized);
};

const extractParentheticalValues = (value?: string | null) => {
  if (!value) return [];

  return Array.from(value.matchAll(/\(([^)]+)\)/g))
    .map((match) => compactWhitespace(match[1]))
    .filter(Boolean);
};

const addCepAlias = (aliases: Set<string>, value?: string | null) => {
  const normalized = compactWhitespace(normalizeSearchValue(value));
  if (normalized && normalized.length >= 3) {
    aliases.add(normalized);
  }
};

function buildCepSearchAliases(cepResult: CepResult | null) {
  if (!cepResult) return [];

  const aliases = new Set<string>();
  const bairro = compactWhitespace(cepResult.bairro);
  const logradouro = compactWhitespace(cepResult.logradouro);
  const cidade = compactWhitespace(cepResult.cidade);

  addCepAlias(aliases, bairro);
  addCepAlias(aliases, bairro.replace(/\([^)]*\)/g, " "));
  extractParentheticalValues(bairro).forEach((value) => addCepAlias(aliases, value));

  addCepAlias(aliases, logradouro);
  addCepAlias(
    aliases,
    logradouro.replace(/\b(quadra|conjunto|bloco|lote|rua|avenida|av\.?|alameda)\b/gi, " "),
  );

  const quadraCodes = logradouro.match(/\b[a-z]{1,4}\s*-?\s*\d{1,4}\b/gi) ?? [];
  quadraCodes.forEach((value) => addCepAlias(aliases, value));

  if ((aliases.size === 0 || (!bairro && !logradouro)) && !isGenericCepCity(cidade)) {
    addCepAlias(aliases, cidade);
  }

  return Array.from(aliases).sort((a, b) => b.length - a.length);
}

function getCepPortalSearchLocation(cepResult: CepResult) {
  const parentheticalRegion = extractParentheticalValues(cepResult.bairro)[0];
  if (parentheticalRegion) return parentheticalRegion;

  const bairroSemParenteses = compactWhitespace(cepResult.bairro.replace(/\([^)]*\)/g, " "));
  if (bairroSemParenteses && !/\d/.test(bairroSemParenteses)) return bairroSemParenteses;

  const bairro = compactWhitespace(cepResult.bairro);
  if (bairro && !/\d/.test(bairro)) return bairro;

  if (!isGenericCepCity(cepResult.cidade)) {
    return compactWhitespace(cepResult.cidade);
  }

  return parentheticalRegion || bairroSemParenteses || bairro || compactWhitespace(cepResult.cidade) || "Brasília";
}

function getCepAiSearchBairro(cepResult: CepResult | null) {
  if (!cepResult) return "";

  const options = [
    ...extractParentheticalValues(cepResult.bairro),
    compactWhitespace(cepResult.bairro.replace(/\([^)]*\)/g, " ")),
    compactWhitespace(cepResult.bairro),
  ].filter(Boolean);

  return options.find((value) => value && !/\d/.test(value)) || getCepPortalSearchLocation(cepResult);
}

function inferPortalFromUrl(url?: string | null, anunciante?: string | null) {
  if (url) {
    try {
      const host = new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
      if (host.includes("olx")) return "OLX";
      if (host.includes("zapimoveis")) return "ZAP Imóveis";
      if (host.includes("vivareal")) return "VivaReal";
      if (host.includes("quintoandar")) return "QuintoAndar";
      if (host.includes("mercadolivre")) return "Mercado Livre";
      if (host.includes("123i")) return "123i";
      if (host.includes("wimoveis")) return "WImóveis";
      if (host.includes("dfimoveis")) return "DFImóveis";
    } catch {
      // ignore invalid URL and use a fallback label below
    }
  }

  return anunciante === "proprietario" ? "IA Proprietário" : "IA Mercado";
}

function mergeMercadoRecords(current: MercadoIARecord[], incoming: MercadoIARecord[]) {
  const merged = new Map<string, MercadoIARecord>();

  [...incoming, ...current].forEach((item) => {
    const key = normalizeSearchValue(item.url_anuncio || `${item.portal}::${item.titulo}::${item.bairro || ""}`);
    if (!merged.has(key)) merged.set(key, item);
  });

  return Array.from(merged.values());
}

function mapMercadoRecordToSave(item: MercadoIARecord): ImovelMercado {
  return {
    portal: item.portal,
    url_anuncio: item.url_anuncio || undefined,
    titulo: item.titulo,
    tipo: item.tipo || "Apartamento",
    operacao: item.operacao || "Venda",
    bairro: item.bairro || undefined,
    cidade: item.cidade || undefined,
    estado: item.estado || "DF",
    preco: Number(item.preco || 0),
    area: Number(item.area || 0),
    quartos: Number(item.quartos || 0),
    banheiros: Number(item.banheiros || 0),
    vagas: Number(item.vagas || 0),
    preco_m2: Number(item.preco_m2 || 0),
    dias_anuncio: Number(item.dias_anuncio || 0),
    data_scraping: item.data_scraping || new Date().toISOString(),
    fotos: item.fotos || undefined,
  };
}

function mapAiOpportunityToMercado(item: any, cidade: string, estado: string): MercadoIARecord {
  const preco = Number(item?.preco_estimado || 0);
  const area = Number(item?.area_estimada || 0);
  const tituloBase = compactWhitespace(item?.titulo);
  const nomePredio = compactWhitespace(item?.nome_predio);

  return {
    id: crypto.randomUUID(),
    titulo: tituloBase || nomePredio || "Oportunidade IA",
    tipo: item?.tipo_imovel || "Apartamento",
    operacao: item?.operacao === "Locação" ? "Aluguel" : item?.operacao || "Venda",
    bairro: item?.bairro || null,
    cidade: cidade || "Brasília",
    estado: estado || "DF",
    preco: preco || null,
    area: area || null,
    preco_m2: preco > 0 && area > 0 ? Math.round(preco / area) : null,
    quartos: item?.quartos || 0,
    banheiros: 0,
    vagas: 0,
    dias_anuncio: 0,
    portal: inferPortalFromUrl(item?.link_anuncio, item?.tipo_anunciante),
    data_scraping: new Date().toISOString(),
    url_anuncio: normalizeExternalUrl(item?.link_anuncio) || null,
    nome_predio: nomePredio || null,
    origem: "ia",
    fotos: [],
  };
}

function filtrarDadosMercadoPorBusca(
  dadosMercado: MercadoIARecord[],
  {
    cepResult,
    searchPredio,
    searchCidade,
    tiposFiltro,
  }: {
    cepResult: CepResult | null;
    searchPredio: string;
    searchCidade: string;
    tiposFiltro: string[];
  },
) {
  let result = dadosMercado;

  if (cepResult) {
    const cepAliases = buildCepSearchAliases(cepResult);

    if (cepAliases.length > 0) {
      result = result.filter((imovel) => {
        const searchableText = normalizeSearchValue([
          imovel.bairro,
          imovel.cidade,
          imovel.titulo,
          imovel.nome_predio,
        ].filter(Boolean).join(" "));

        return cepAliases.some((alias) => searchableText.includes(alias));
      });
    }
  }

  if (searchPredio.trim()) {
    const termoPredio = normalizeSearchValue(searchPredio);
    result = result.filter(
      (imovel) =>
        normalizeSearchValue(imovel.titulo).includes(termoPredio) ||
        normalizeSearchValue(imovel.bairro).includes(termoPredio) ||
        normalizeSearchValue(imovel.nome_predio).includes(termoPredio),
    );
  }

  if (searchCidade) {
    const cidadeBusca = normalizeSearchValue(searchCidade);
    result = result.filter(
      (imovel) =>
        normalizeSearchValue(imovel.cidade).includes(cidadeBusca) ||
        normalizeSearchValue(imovel.bairro).includes(cidadeBusca),
    );
  }

  if (tiposFiltro.length > 0) {
    result = result.filter((imovel) => {
      const tipoNormalizado = normalizeSearchValue(imovel.tipo);
      return tiposFiltro.some((tipoFiltro) => tipoNormalizado.includes(normalizeSearchValue(tipoFiltro)));
    });
  }

  return result;
}

export function ProprietarioDiretoTab() {
  const { imoveis, loading, createImovel } = useImoveis({ suppressFetchErrors: true });
  const { nome_empresa } = useImobiliariaConfig();
  const { user, imobiliariaId, isMaster } = useAuth();
  const canSeeAlude = isMaster || (user?.email?.toLowerCase().includes("victor") ?? false);
  const { toast } = useToast();
  const [modo, setModo] = useState<string>("todos");
  const [selectedOp, setSelectedOp] = useState<OportunidadeCaptacao | null>(null);
  const [scriptDialog, setScriptDialog] = useState(false);
  const [dadosMercado, setDadosMercado] = useState<MercadoIARecord[]>([]);
  const [tiposFiltro, setTiposFiltro] = useState<string[]>([]);
  const [loadingMercado, setLoadingMercado] = useState(true);
  const [activeTab, setActiveTab] = useState("ranking");
  const [buscandoMercado, setBuscandoMercado] = useState(false);
  const [buscandoMercadoIA, setBuscandoMercadoIA] = useState(false);
  const [apenasProprietariosIA, setApenasProprietariosIA] = useState(false);

  // AI analysis states
  const [analisandoMercado, setAnalisandoMercado] = useState(false);
  const [analisesMercado, setAnalisesMercado] = useState<Record<string, AnaliseProprietarioMercado>>({});
  const [salvandoTodosMercado, setSalvandoTodosMercado] = useState(false);
  const [listaDialogOpen, setListaDialogOpen] = useState(false);
  const [savingToList, setSavingToList] = useState<string | null>(null);
  const [salvarDialog, setSalvarDialog] = useState<{ op: OportunidadeCaptacao | null; nome: string; email: string; telefone: string }>({ op: null, nome: "", email: "", telefone: "" });

  const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
  const isValidPhone = (v: string) => v.replace(/\D/g, "").length >= 10;

  const abrirSalvarNaLista = (op: OportunidadeCaptacao) => {
    if (!isMaster) {
      toast({ title: "Acesso restrito", description: "Esta funcionalidade é exclusiva do login Master.", variant: "destructive" });
      return;
    }
    setSalvarDialog({ op, nome: "", email: "", telefone: "" });
  };

  const confirmarSalvarNaLista = async () => {
    const op = salvarDialog.op;
    if (!op || !imobiliariaId) return;
    const nome = salvarDialog.nome.trim();
    const email = salvarDialog.email.trim();
    const telefone = salvarDialog.telefone.trim();
    if (!nome) { toast({ title: "Nome obrigatório", variant: "destructive" }); return; }
    if (!isValidEmail(email)) { toast({ title: "E-mail inválido", description: "Informe um e-mail válido (validação IA).", variant: "destructive" }); return; }
    if (!isValidPhone(telefone)) { toast({ title: "Telefone inválido", description: "Informe um telefone com DDD válido.", variant: "destructive" }); return; }

    const linkValidation = normalizeAndValidateReferenceUrl(
      (op as any).url_anuncio || (op as any).urlAnuncio || null,
    );
    if (linkValidation.ok !== true) {
      toast({
        title: "Link de referência obrigatório",
        description: (linkValidation as { ok: false; error: string }).error,
        variant: "destructive",
      });
      return;
    }
    const urlAnuncioNormalizado: string = linkValidation.url;

    setSavingToList(op.imovelId);
    const operacaoNorm = (op.operacao || "").toLowerCase().includes("alug") ? "aluguel" : "venda";
    const { error } = await supabase.from("lista_proprietarios_captacao").insert({
      imobiliaria_id: imobiliariaId,
      nome_proprietario: nome,
      email,
      telefone,
      operacao: operacaoNorm,
      titulo_imovel: op.titulo,
      bairro: op.bairro,
      cidade: op.cidade,
      preco: op.preco,
      q_score: op.qScore,
      origem: (op as any).portal ? `portal_${String((op as any).portal).toLowerCase().replace(/\s+/g, "_")}` : "captacao_oportunidade_ia",
      imovel_id_ref: op.imovelId,
      url_anuncio: urlAnuncioNormalizado,
    });
    setSavingToList(null);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    setSalvarDialog({ op: null, nome: "", email: "", telefone: "" });
    toast({ title: "Salvo na lista", description: `Adicionado à lista de ${operacaoNorm} com dados validados.` });
  };

  // Search states - restore from sessionStorage
  const [searchCep, setSearchCep] = useState(() => {
    try { const s = sessionStorage.getItem(SEARCH_STORAGE_KEY); return s ? JSON.parse(s).searchCep || "" : ""; } catch { return ""; }
  });
  const [searchPredio, setSearchPredio] = useState(() => {
    try { const s = sessionStorage.getItem(SEARCH_STORAGE_KEY); return s ? JSON.parse(s).searchPredio || "" : ""; } catch { return ""; }
  });
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [cepResult, setCepResult] = useState<CepResult | null>(() => {
    try { const s = sessionStorage.getItem(SEARCH_STORAGE_KEY); return s ? JSON.parse(s).cepResult || null : null; } catch { return null; }
  });
  const [searchCidade, setSearchCidade] = useState(() => {
    try { const s = sessionStorage.getItem(SEARCH_STORAGE_KEY); return s ? JSON.parse(s).searchCidade || "" : ""; } catch { return ""; }
  });

  // Persist search state
  useEffect(() => {
    try {
      sessionStorage.setItem(SEARCH_STORAGE_KEY, JSON.stringify({ searchCep, searchPredio, cepResult, searchCidade }));
    } catch { /* ignore */ }
  }, [searchCep, searchPredio, cepResult, searchCidade]);

  useEffect(() => {
    if (!user) return;
    const fetchMercado = async () => {
      setLoadingMercado(true);
      const { data, error } = await supabase
        .from("imoveis_mercado")
        .select("id, titulo, tipo, operacao, bairro, cidade, estado, preco, area, preco_m2, quartos, banheiros, vagas, dias_anuncio, portal, data_scraping, url_anuncio")
        .not("url_anuncio", "is", null)
        .neq("url_anuncio", "")
        .order("data_scraping", { ascending: false })
        .limit(1000);
      if (!error && data) {
        setDadosMercado(data as MercadoIARecord[]);
      }
      setLoadingMercado(false);
    };
    fetchMercado();
  }, [user]);

  const operacaoFiltro = modo === "todos" ? undefined : modo === "venda" ? "Venda" : "Aluguel";
  const regioes = useMemo(() => analisarRegioes(imoveis as any[], operacaoFiltro, dadosMercado), [imoveis, operacaoFiltro, dadosMercado]);
  const oportunidades = useMemo(() => gerarOportunidades(imoveis as any[], regioes), [imoveis, regioes]);

  // CEP search handler
  const buscarPorCep = async (cepVal: string): Promise<CepResult | null> => {
    const clean = cepVal.replace(/\D/g, "");
    if (clean.length !== 8) return null;
    setBuscandoCep(true);
    setCepResult(null);
    try {
      const resp = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = await resp.json();
      if (!data.erro) {
        const result = { bairro: data.bairro || "", logradouro: data.logradouro || "", cidade: data.localidade || "" };
        setCepResult(result);
        toast({ title: "CEP encontrado!", description: `${data.logradouro || ""} — ${data.bairro || ""}, ${data.localidade || ""}` });
        return result;
      } else {
        toast({ title: "CEP não encontrado", variant: "destructive" });
        return null;
      }
    } catch {
      toast({ title: "Erro ao buscar CEP", variant: "destructive" });
      return null;
    } finally {
      setBuscandoCep(false);
    }
  };

  // Filtered data based on search
  const hasActiveSearch = !!(cepResult || searchPredio.trim() || searchCidade || tiposFiltro.length > 0);

  const dadosMercadoFiltrados = useMemo(() => {
    return filtrarDadosMercadoPorBusca(dadosMercado, {
      cepResult,
      searchPredio,
      searchCidade,
      tiposFiltro,
    });
  }, [dadosMercado, cepResult, searchPredio, searchCidade, tiposFiltro]);

  useEffect(() => {
    setAnalisesMercado({});
  }, [cepResult, searchCep, searchPredio, searchCidade, tiposFiltro]);

  const oportunidadesFiltradas = useMemo(() => {
    let result = oportunidades;
    if (cepResult) {
      const cepAliases = buildCepSearchAliases(cepResult);
      if (cepAliases.length > 0) {
        result = result.filter((op) => {
          const searchableText = normalizeSearchValue([op.bairro, op.titulo].filter(Boolean).join(" "));
          return cepAliases.some((alias) => searchableText.includes(alias));
        });
      }
    }
    if (searchPredio.trim()) {
      const t = searchPredio.trim().toLowerCase();
      result = result.filter(op => op.titulo?.toLowerCase().includes(t) || op.bairro?.toLowerCase().includes(t));
    }
    if (searchCidade) {
      const c = searchCidade.toLowerCase();
      result = result.filter(op => op.bairro?.toLowerCase().includes(c));
    }
    return result;
  }, [oportunidades, cepResult, searchPredio, searchCidade]);

  const clearSearch = () => {
    setSearchCep(""); setSearchPredio(""); setCepResult(null); setSearchCidade(""); setTiposFiltro([]);
    setAnalisesMercado({});
    setApenasProprietariosIA(false);
    try { sessionStorage.removeItem(SEARCH_STORAGE_KEY); } catch { /* ignore */ }
  };

  const handleBuscarComIA = useCallback(async () => {
    const digits = searchCep.replace(/\D/g, "");

    if (digits && digits.length !== 8) {
      toast({ title: "CEP inválido", description: "Digite os 8 dígitos do CEP", variant: "destructive" });
      return;
    }

    if (!digits && !searchPredio.trim() && !searchCidade) {
      toast({
        title: "Informe um CEP, cidade ou nome do prédio",
        description: "A busca com IA precisa de pelo menos um critério.",
        variant: "destructive",
      });
      return;
    }

    let resolvedCep = cepResult;
    if (digits && !resolvedCep) {
      resolvedCep = await buscarPorCep(digits);
      if (!resolvedCep) return;
    }

    setBuscandoMercadoIA(true);
    setAnalisesMercado({});
    setApenasProprietariosIA(false);
    setActiveTab("mercado");

    try {
      const cidadeBusca = searchCidade || (resolvedCep?.cidade && !isGenericCepCity(resolvedCep.cidade) ? resolvedCep.cidade : "Brasília");
      const bairroBusca = searchCidade || getCepAiSearchBairro(resolvedCep) || null;
      const tipoBusca = tiposFiltro[0] || "Apartamento";
      const operacaoBusca = modo === "aluguel" ? "Locação" : "Venda";

      const { data, error } = await supabase.functions.invoke("captacao-inteligente", {
        body: {
          action: "buscar_oportunidades",
          params: {
            bairro: bairroBusca,
            cidade: cidadeBusca,
            estado: "DF",
            tipo_imovel: tipoBusca,
            operacao: operacaoBusca,
            apenas_proprietarios: true,
            nome_predio: searchPredio.trim() || null,
            logradouro: resolvedCep?.logradouro || null,
            cep: digits || null,
          },
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const oportunidadesRaw = Array.isArray(data?.data?.oportunidades) ? data.data.oportunidades : [];
      // Regra de negócio: todo anúncio exibido/salvo em Captação DEVE ter link de referência público válido.
      const oportunidades = oportunidadesRaw.filter((op: any) => !!normalizeExternalUrl(op?.link_anuncio));
      const descartados = oportunidadesRaw.length - oportunidades.length;
      if (oportunidades.length === 0) {
        toast({
          title: "Nenhum imóvel com link de referência encontrado",
          description: descartados > 0
            ? `${descartados} resultado(s) foram descartados por não incluírem link público do anúncio.`
            : "Tente refinar o CEP, a cidade ou o nome do prédio.",
          variant: "destructive",
        });
        return;
      }

      const novosImoveis = oportunidades.map((op: any) => mapAiOpportunityToMercado(op, cidadeBusca, "DF"));

      if (imobiliariaId) {
        await salvarImoveisMercado(imobiliariaId, novosImoveis.map(mapMercadoRecordToSave));
      }

      const proximoDadosMercado = mergeMercadoRecords(dadosMercado, novosImoveis);
      setDadosMercado(proximoDadosMercado);

      const novasAnalises: Record<string, AnaliseProprietarioMercado> = (oportunidades as any[]).reduce((acc: Record<string, AnaliseProprietarioMercado>, op: any, index: number) => {
        const imovel = novosImoveis[index];
        const classificacao = op?.tipo_anunciante === "proprietario"
          ? "proprietario"
          : op?.tipo_anunciante === "imobiliaria" || op?.tipo_anunciante === "corretor"
            ? "imobiliaria"
            : "incerto";

        acc[getImovelKey(imovel)] = {
          index,
          classificacao,
          confianca: classificacao === "proprietario" ? 92 : classificacao === "imobiliaria" ? 78 : 60,
          motivo: op?.motivo_oportunidade || "Resultado territorial gerado por IA.",
          sinais: [
            digits ? `CEP ${digits}` : null,
            op?.nome_predio ? `Prédio: ${op.nome_predio}` : null,
            op?.bairro ? `Bairro: ${op.bairro}` : null,
          ].filter(Boolean) as string[],
        };

        return acc;
      }, {});

      setAnalisesMercado(novasAnalises);
      if (novosImoveis.some((imovel) => novasAnalises[getImovelKey(imovel)]?.classificacao === "proprietario")) {
        setApenasProprietariosIA(true);
      }

      toast({
        title: `${novosImoveis.length} imóvel(is) encontrados com IA`,
        description: "Os resultados já foram exibidos e salvos na base de mercado.",
      });
    } catch (e) {
      toast({
        title: "Erro na busca com IA",
        description: e instanceof Error ? e.message : "Não foi possível concluir a busca.",
        variant: "destructive",
      });
    } finally {
      setBuscandoMercadoIA(false);
    }
  }, [searchCep, searchPredio, searchCidade, cepResult, tiposFiltro, modo, toast, buscarPorCep, imobiliariaId, dadosMercado, isMaster]);

  // AI analysis for mercado table
  const mercadoBase = useMemo(() => (hasActiveSearch ? dadosMercadoFiltrados : dadosMercado).slice(0, 100), [hasActiveSearch, dadosMercadoFiltrados, dadosMercado]);
  const mercadoExibidos = useMemo(() => {
    if (!apenasProprietariosIA) return mercadoBase;
    return mercadoBase.filter((im) => analisesMercado[getImovelKey(im)]?.classificacao === "proprietario");
  }, [mercadoBase, apenasProprietariosIA, analisesMercado]);

  const handleAnaliseIAMercado = useCallback(async (listaParaAnalise?: ImovelMercadoInput[]) => {
    const lista = (listaParaAnalise ?? mercadoExibidos).slice(0, 20);
    if (lista.length === 0) {
      toast({
        title: "Nenhum imóvel encontrado",
        description: "Ajuste o CEP ou os filtros antes de rodar a análise com IA.",
        variant: "destructive",
      });
      return;
    }
    setAnalisandoMercado(true);
    try {
      const payload = lista.map(im => ({
        titulo: im.titulo,
        portal: im.portal,
        preco: im.preco,
        area: im.area,
        bairro: im.bairro || null,
        url_anuncio: im.url_anuncio || null,
      }));
      const { data, error } = await supabase.functions.invoke("analise-proprietario", {
        body: { imoveis: payload },
      });
      if (error) {
        let message = error.message;
        try {
          if ((error as any).context && typeof (error as any).context.json === "function") {
            const body = await (error as any).context.json();
            message = body?.error || message;
          }
        } catch {
          // keep original message
        }
        toast({ title: "Erro na análise", description: message, variant: "destructive" });
        return;
      }
      if (data?.error) { toast({ title: "Erro na análise", description: data.error, variant: "destructive" }); return; }
      if (data?.resultados) {
        const map: Record<string, AnaliseProprietarioMercado> = {};
        (data.resultados as AnaliseProprietarioMercado[]).forEach(r => {
          const im = lista[r.index];
          if (im) map[getImovelKey(im)] = r;
        });
        setAnalisesMercado(prev => ({ ...prev, ...map }));
        const proprietarios = data.resultados.filter((r: AnaliseProprietarioMercado) => r.classificacao === "proprietario").length;
        toast({ title: `Análise concluída!`, description: `${proprietarios} de ${data.resultados.length} anúncios identificados como proprietários diretos.` });
      }
    } catch (e: any) { toast({ title: "Erro na análise de IA", description: e?.message || "Não foi possível concluir a verificação.", variant: "destructive" }); }
    finally { setAnalisandoMercado(false); }
  }, [mercadoExibidos, toast]);

  const handleSalvarTodosMercado = useCallback(async () => {
    if (!imobiliariaId) return;
    const proprietarioKeys = Object.entries(analisesMercado)
      .filter(([, a]) => a.classificacao === "proprietario")
      .map(([key]) => key);
    if (proprietarioKeys.length === 0) {
      toast({ title: "Nenhum proprietário identificado pela IA", variant: "destructive" });
      return;
    }
    setSalvandoTodosMercado(true);
    let sucesso = 0, erros = 0;
    for (const key of proprietarioKeys) {
      const im = mercadoExibidos.find(m => getImovelKey(m) === key);
      if (!im) continue;
      try {
        await createImovel({
          titulo: im.titulo || `Imóvel ${im.bairro || "Captado"}`,
          tipo: im.tipo || "Apartamento",
          operacao: im.operacao || "Venda",
          bairro: im.bairro || undefined,
          cidade: im.cidade || undefined,
          preco: im.preco || 0,
          area: im.area || 0,
          quartos: im.quartos || 0,
          descricao: `📍 Captado via IA (Proprietário Direto)\n🏢 Portal: ${im.portal}\n💰 Preço: R$ ${im.preco?.toLocaleString("pt-BR") || "N/A"}\n📐 Área: ${im.area || "N/A"}m²`,
        } as any);
        sucesso++;
      } catch { erros++; }
    }
    setSalvandoTodosMercado(false);
    toast({ title: `${sucesso} imóvel(is) salvos na carteira`, description: erros > 0 ? `${erros} erro(s)` : undefined });
  }, [analisesMercado, mercadoExibidos, imobiliariaId, createImovel, toast]);

  const displayOportunidades = hasActiveSearch ? oportunidadesFiltradas : oportunidades;
  const totalOportunidades = displayOportunidades.length;
  const mediaqScore = totalOportunidades > 0 ? Math.round(displayOportunidades.reduce((a, b) => a + b.qScore, 0) / totalOportunidades) : 0;
  const mediaLiquidez = regioes.length > 0 ? Math.round(regioes.reduce((a, b) => a + b.indiceLiquidez, 0) / regioes.length) : 0;
  const mediaVacancia = regioes.length > 0 ? Math.round(regioes.reduce((a, b) => a + b.indiceVacancia, 0) / regioes.length) : 0;
  const superprecoCount = displayOportunidades.filter(o => o.riscoSuperpreco === "alto" || o.riscoSuperpreco === "critico").length;
  const topOportunidades = displayOportunidades.slice(0, 10);
  const topBairros = regioes.slice(0, 8);

  const scripts = selectedOp ? gerarScriptAbordagem(selectedOp, nome_empresa || "Consultor") : null;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado!" });
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">Carregando inteligência territorial...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header com filtro */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Crosshair className="w-5 h-5 text-primary" />
            Captação Direta com Proprietário
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">Inteligência territorial para captar imóveis direto com proprietários</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={modo} onValueChange={setModo}>
            <SelectTrigger className="w-[180px]">
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
          {isMaster && (
            <Button
              size="sm"
              className="gap-1 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md font-semibold"
              onClick={() => setListaDialogOpen(true)}
            >
              <ListChecks className="w-4 h-4" /> Lista Proprietários
            </Button>
          )}
        </div>
      </div>


      {/* Search Panel - CEP & Building Name */}
      <Card className="border-primary/20 bg-gradient-to-br from-accent/30 to-transparent">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Search className="w-5 h-5 text-primary" />
            <div>
              <p className="text-sm font-semibold">Busca Direta com Proprietário</p>
              <p className="text-xs text-muted-foreground">Encontre imóveis por CEP, cidade/satélite ou nome do prédio</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
            <div>
              <Label className="text-xs flex items-center gap-1 mb-1">
                <MapPin className="w-3 h-3" /> Buscar por CEP
              </Label>
              <div className="relative flex gap-1">
                <Input
                  value={searchCep}
                  onChange={e => {
                    const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
                    const formatted = digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
                    setSearchCep(formatted);
                    if (digits.length === 8) {
                      buscarPorCep(digits);
                    } else {
                      setCepResult(null);
                    }
                  }}
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      const digits = searchCep.replace(/\D/g, "");
                      if (digits.length === 8) buscarPorCep(digits);
                      else toast({ title: "CEP inválido", description: "Digite os 8 dígitos do CEP", variant: "destructive" });
                    }
                  }}
                  placeholder="70000-000"
                  maxLength={9}
                  inputMode="numeric"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={buscandoCep}
                  onClick={() => {
                    const digits = searchCep.replace(/\D/g, "");
                    if (digits.length === 8) buscarPorCep(digits);
                    else toast({ title: "CEP inválido", description: "Digite os 8 dígitos do CEP", variant: "destructive" });
                  }}
                >
                  {buscandoCep ? <SearchSpinner className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
              </div>
              {cepResult && (
                <p className="text-[11px] text-primary mt-1">
                  📍 {cepResult.logradouro} — {cepResult.bairro}, {cepResult.cidade}
                </p>
              )}
              <Button
                type="button"
                size="sm"
                variant="default"
                className="w-full mt-2 gap-1"
                disabled={buscandoCep || buscandoMercado}
                onClick={async () => {
                  const digits = searchCep.replace(/\D/g, "");
                  if (digits.length !== 8) {
                    toast({ title: "CEP inválido", description: "Digite os 8 dígitos do CEP", variant: "destructive" });
                    return;
                  }

                  const resolvedCep = cepResult ?? await buscarPorCep(digits);
                  if (!resolvedCep) return;

                  const filtrosCep = {
                    cepResult: resolvedCep,
                    searchPredio: "",
                    searchCidade: "",
                    tiposFiltro,
                  };

                  let detalhesFalha = "Tente um CEP de uma região com mais anúncios ativos.";
                  setAnalisesMercado({});
                  setApenasProprietariosIA(false);
                  setActiveTab("mercado");
                  setSearchPredio("");
                  setSearchCidade("");

                  let imoveisDoCep = filtrarDadosMercadoPorBusca(dadosMercado, filtrosCep).slice(0, 100);

                  if (imoveisDoCep.length === 0) {
                    setBuscandoMercado(true);
                    toast({
                      title: "Buscando imóveis nos portais...",
                      description: `Coletando anúncios de ${getCepPortalSearchLocation(resolvedCep)} em tempo real.`,
                    });

                    try {
                      const cidadeBusca = getCepPortalSearchLocation(resolvedCep);
                      const tipoBusca = tiposFiltro[0]?.toLowerCase() || "apartamento";
                      const result = await scrapePortais(cidadeBusca, tipoBusca, "Venda");

                      if (result.success && result.data && result.data.length > 0) {
                        if (imobiliariaId) {
                          await salvarImoveisMercado(imobiliariaId, result.data);
                        }

                        const novosImoveis = result.data.map((im) => ({
                          id: im.id || crypto.randomUUID(),
                          titulo: im.titulo,
                          tipo: im.tipo,
                          operacao: im.operacao,
                          bairro: im.bairro,
                          cidade: im.cidade,
                          preco: im.preco,
                          area: im.area,
                          preco_m2: im.preco_m2,
                          quartos: im.quartos,
                          dias_anuncio: im.dias_anuncio,
                          portal: im.portal,
                          data_scraping: im.data_scraping,
                          url_anuncio: im.url_anuncio,
                        })) as ImovelMercadoInput[];

                        const proximoDadosMercado = [...novosImoveis, ...dadosMercado];
                        setDadosMercado(proximoDadosMercado);
                        imoveisDoCep = filtrarDadosMercadoPorBusca(proximoDadosMercado, filtrosCep).slice(0, 100);

                        // Se o filtro estrito por CEP zerou os resultados frescos, relaxar:
                        // limpar cepResult e usar a cidade/região como filtro para garantir que apareçam.
                        if (imoveisDoCep.length === 0) {
                          setCepResult(null);
                          setSearchCidade(cidadeBusca);
                          imoveisDoCep = novosImoveis.slice(0, 100);
                          toast({
                            title: `${novosImoveis.length} imóvel(is) capturados e salvos`,
                            description: `Exibindo resultados de "${cidadeBusca}" (filtro de CEP relaxado).`,
                          });
                        } else {
                          toast({
                            title: `${imoveisDoCep.length} imóvel(is) capturados e salvos`,
                            description: `Anúncios de ${cidadeBusca} adicionados ao banco de mercado.`,
                          });
                        }
                      } else {
                        detalhesFalha = result.error || result.errors?.[0] || detalhesFalha;
                      }
                    } catch (e) {
                      console.error("Scrape error:", e);
                      detalhesFalha = e instanceof Error ? e.message : detalhesFalha;
                    } finally {
                      setBuscandoMercado(false);
                    }
                  }

                  if (imoveisDoCep.length === 0) {
                    toast({
                      title: "Nenhum imóvel encontrado para este CEP",
                      description: detalhesFalha,
                      variant: "destructive",
                    });
                    return;
                  }

                  toast({
                    title: `${imoveisDoCep.length} imóvel(is) encontrado(s)`,
                    description: 'Use o botão "Filtrar com IA" para identificar proprietários diretos.',
                  });
                }}
              >
                {buscandoMercado ? <SearchSpinner className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Buscar Oportunidades por CEP
              </Button>
            </div>
            <div>
              <Label className="text-xs flex items-center gap-1 mb-1">
                <Building className="w-3 h-3" /> Nome do Prédio / Condomínio
              </Label>
              <Input
                value={searchPredio}
                onChange={e => setSearchPredio(e.target.value)}
                placeholder="Ex: Residencial Park, Torre Sul..."
              />
            </div>
            <div>
              <Label className="text-xs flex items-center gap-1 mb-1">
                <MapPin className="w-3 h-3" /> Cidade / Satélite
              </Label>
              <Select value={searchCidade || "all_cities"} onValueChange={(value) => setSearchCidade(value === "all_cities" ? "" : value)}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todas as cidades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_cities">Todas</SelectItem>
                  <SelectItem value="Brasília">Brasília (Plano Piloto)</SelectItem>
                  <SelectItem value="Águas Claras">Águas Claras</SelectItem>
                  <SelectItem value="Taguatinga">Taguatinga</SelectItem>
                  <SelectItem value="Ceilândia">Ceilândia</SelectItem>
                  <SelectItem value="Samambaia">Samambaia</SelectItem>
                  <SelectItem value="Gama">Gama</SelectItem>
                  <SelectItem value="Guará">Guará</SelectItem>
                  <SelectItem value="Sobradinho">Sobradinho</SelectItem>
                  <SelectItem value="Planaltina">Planaltina</SelectItem>
                  <SelectItem value="Recanto das Emas">Recanto das Emas</SelectItem>
                  <SelectItem value="Santa Maria">Santa Maria</SelectItem>
                  <SelectItem value="São Sebastião">São Sebastião</SelectItem>
                  <SelectItem value="Vicente Pires">Vicente Pires</SelectItem>
                  <SelectItem value="Riacho Fundo">Riacho Fundo</SelectItem>
                  <SelectItem value="Lago Sul">Lago Sul</SelectItem>
                  <SelectItem value="Lago Norte">Lago Norte</SelectItem>
                  <SelectItem value="Jardim Botânico">Jardim Botânico</SelectItem>
                  <SelectItem value="Sudoeste">Sudoeste / Octogonal</SelectItem>
                  <SelectItem value="Noroeste">Noroeste</SelectItem>
                  <SelectItem value="Park Way">Park Way</SelectItem>
                  <SelectItem value="Arniqueira">Arniqueira</SelectItem>
                  <SelectItem value="Itapoã">Itapoã</SelectItem>
                  <SelectItem value="Paranoá">Paranoá</SelectItem>
                  <SelectItem value="Brazlândia">Brazlândia</SelectItem>
                  <SelectItem value="Candangolândia">Candangolândia</SelectItem>
                  <SelectItem value="Cruzeiro">Cruzeiro</SelectItem>
                  <SelectItem value="Núcleo Bandeirante">Núcleo Bandeirante</SelectItem>
                  <SelectItem value="Estrutural">Estrutural (SCIA)</SelectItem>
                  <SelectItem value="SIA">SIA</SelectItem>
                  <SelectItem value="Fercal">Fercal</SelectItem>
                  <SelectItem value="Sol Nascente">Sol Nascente / Pôr do Sol</SelectItem>
                  <SelectItem value="Valparaíso">Valparaíso de Goiás</SelectItem>
                  <SelectItem value="Novo Gama">Novo Gama</SelectItem>
                  <SelectItem value="Luziânia">Luziânia</SelectItem>
                  <SelectItem value="Formosa">Formosa</SelectItem>
                  <SelectItem value="Cidade Ocidental">Cidade Ocidental</SelectItem>
                  <SelectItem value="Águas Lindas">Águas Lindas de Goiás</SelectItem>
                  <SelectItem value="Santo Antônio do Descoberto">Santo Antônio do Descoberto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              {hasActiveSearch && (
                <>
                  <Badge variant="secondary" className="text-xs">
                    {dadosMercadoFiltrados.length} imóvel(is)
                  </Badge>
                  <Button size="sm" variant="ghost" onClick={clearSearch} className="text-xs">
                    Limpar busca
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Filtro por Tipo de Imóvel — Checkboxes */}
          <div className="mt-4 pt-3 border-t border-border/50">
            <div className="flex items-center gap-2 mb-2">
              <Filter className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-semibold text-foreground">Filtrar por Tipo de Imóvel</span>
              {tiposFiltro.length > 0 && (
                <Badge variant="secondary" className="text-[10px]">{tiposFiltro.length} selecionado(s)</Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {["Apartamento", "Casa", "Terreno", "Comercial", "Cobertura", "Kitnet", "Galpão", "Sala Comercial", "Loja", "Flat", "Sobrado", "Chácara", "Fazenda", "Ponto Comercial", "Prédio", "Conjunto de Salas"].map(tipo => (
                <label key={tipo} className="flex items-center gap-1.5 cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <Checkbox
                    checked={tiposFiltro.includes(tipo)}
                    onCheckedChange={(checked) => {
                      setTiposFiltro(prev =>
                        checked ? [...prev, tipo] : prev.filter(t => t !== tipo)
                      );
                    }}
                    className="h-3.5 w-3.5"
                  />
                  {tipo}
                </label>
              ))}
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
            <CardDescription>Concentração e oportunidade por bairro</CardDescription>
          </CardHeader>
          <CardContent>
            <HeatMap regioes={regioes} />
          </CardContent>
        </Card>
      </motion.div>

      {/* Sub-tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="ranking">Top Oportunidades</TabsTrigger>
          <TabsTrigger value="regioes">Análise Regional</TabsTrigger>
          <TabsTrigger value="mercado" className="gap-1"><Database className="w-3 h-3" />Imóveis de Mercado</TabsTrigger>
          <TabsTrigger value="portais" className="gap-1"><Globe className="w-3 h-3" />Captura Portais</TabsTrigger>
          {canSeeAlude && <TabsTrigger value="alude" className="gap-1"><Home className="w-3 h-3" />Alude</TabsTrigger>}
          <TabsTrigger value="imovel_proprietario" className="gap-1"><Home className="w-3 h-3" />Imóvel do Proprietário</TabsTrigger>
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
                        <td className="p-3 text-center flex items-center justify-center gap-1">
                          <Button size="sm" variant="ghost" asChild>
                            <a href={`/imovel/${op.imovelId}`} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { setSelectedOp(op); setScriptDialog(true); }} title="Script de abordagem">
                            <MessageCircle className="w-4 h-4" />
                          </Button>
                          {isMaster && (
                            <Button size="sm" variant="ghost" disabled={savingToList === op.imovelId} onClick={() => abrirSalvarNaLista(op)} title="Salvar na lista de proprietários (Master)">
                              {savingToList === op.imovelId ? <SearchSpinner className="w-4 h-4 animate-spin" /> : <Bookmark className="w-4 h-4 text-primary" />}
                            </Button>
                          )}
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
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Database className="w-4 h-4 text-primary" />
                    Imóveis de Mercado ({(hasActiveSearch ? dadosMercadoFiltrados : dadosMercado).length})
                  </CardTitle>
                  <CardDescription>Dados reais capturados dos portais imobiliários</CardDescription>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {mercadoBase.length > 0 && (
                    <Button size="sm" variant="default" onClick={() => void handleAnaliseIAMercado(mercadoBase)} disabled={analisandoMercado} className="gap-1">
                      {analisandoMercado ? (
                        <><SearchSpinner className="w-4 h-4 animate-spin" /> Analisando...</>
                      ) : (
                        <><Brain className="w-4 h-4" /> Filtrar com IA (Verificar Proprietários)</>
                      )}
                    </Button>
                  )}
                  {Object.keys(analisesMercado).length > 0 && (
                    <Button
                      size="sm"
                      variant={apenasProprietariosIA ? "default" : "outline"}
                      onClick={() => setApenasProprietariosIA((v) => !v)}
                      className="gap-1"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      {apenasProprietariosIA ? "Mostrar todos" : "Só proprietários IA"}
                    </Button>
                  )}
                  {Object.values(analisesMercado).some(a => a.classificacao === "proprietario") && (
                    <Button size="sm" onClick={handleSalvarTodosMercado} disabled={salvandoTodosMercado} className="gap-1">
                      {salvandoTodosMercado ? <SearchSpinner className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Salvar Proprietários na Carteira
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loadingMercado && !hasActiveSearch ? (
                <p className="p-8 text-center text-muted-foreground">Carregando dados de mercado...</p>
              ) : (hasActiveSearch ? dadosMercadoFiltrados : dadosMercado).length === 0 ? (
                <p className="p-8 text-center text-muted-foreground">{hasActiveSearch ? "Nenhum imóvel encontrado com os filtros de busca." : 'Nenhum dado de mercado. Use a aba "Captura Portais" para buscar e salvar anúncios.'}</p>
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
                        {Object.keys(analisesMercado).length > 0 && <th className="text-center p-3 font-medium">IA</th>}
                        <th className="text-center p-3 font-medium">Link</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mercadoExibidos.map((im, i) => {
                        const analise = analisesMercado[getImovelKey(im)];
                        return (
                          <tr
                            key={im.id || i}
                            className={`border-b hover:bg-primary/10 transition-colors cursor-pointer ${analise?.classificacao === "proprietario" ? "bg-green-50 dark:bg-green-900/10" : analise?.classificacao === "imobiliaria" ? "bg-red-50 dark:bg-red-900/10" : ""}`}
                            onClick={() => { if (im.url_anuncio) window.open(im.url_anuncio, '_blank', 'noopener,noreferrer'); }}
                            title={analise ? `${analise.motivo}` : im.url_anuncio ? "Clique para abrir o anúncio" : ""}
                          >
                            <td className="p-3"><Badge variant="outline" className="text-xs">{im.portal}</Badge></td>
                            <td className="p-3 max-w-[200px] truncate font-medium">{im.titulo}</td>
                            <td className="p-3 text-muted-foreground">{im.bairro || "-"}</td>
                            <td className="p-3 text-right">{im.preco ? im.preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "-"}</td>
                            <td className="p-3 text-right">{im.area ? `${im.area}m²` : "-"}</td>
                            <td className="p-3 text-right">{im.preco_m2 ? im.preco_m2.toLocaleString("pt-BR") : "-"}</td>
                            <td className="p-3 text-center">{im.quartos || "-"}</td>
                            {Object.keys(analisesMercado).length > 0 && (
                              <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                                {analise ? (
                                  <Badge variant="outline" className="text-[10px] gap-1" style={{
                                    borderColor: analise.classificacao === "proprietario" ? "hsl(142 71% 45%)" : analise.classificacao === "imobiliaria" ? "hsl(0 84% 60%)" : "hsl(45 93% 47%)",
                                    color: analise.classificacao === "proprietario" ? "hsl(142 71% 45%)" : analise.classificacao === "imobiliaria" ? "hsl(0 84% 60%)" : "hsl(45 93% 47%)",
                                  }}>
                                    {analise.classificacao === "proprietario" ? <ShieldCheck className="w-3 h-3" /> : analise.classificacao === "imobiliaria" ? <ShieldAlert className="w-3 h-3" /> : <ShieldQuestion className="w-3 h-3" />}
                                    {analise.classificacao === "proprietario" ? "Proprietário" : analise.classificacao === "imobiliaria" ? "Imobiliária" : "Incerto"}
                                    <span className="ml-0.5">{analise.confianca}%</span>
                                  </Badge>
                                ) : <span className="text-muted-foreground text-xs">—</span>}
                              </td>
                            )}
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
                        );
                      })}
                    </tbody>
                  </table>
                  {(hasActiveSearch ? dadosMercadoFiltrados : dadosMercado).length > 100 && (
                    <p className="text-xs text-muted-foreground p-3 text-center">Mostrando 100 de {(hasActiveSearch ? dadosMercadoFiltrados : dadosMercado).length} registros</p>
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
              description="Busca dedicada na plataforma Alude para localizar anúncios diretos de proprietários."
            />
          </TabsContent>
        )}
        <TabsContent value="imovel_proprietario">
          <PortalScraperPanel
            presetPortal="imovel_proprietario"
            title="Imóvel do Proprietário"
            description="Busca dedicada por anúncios diretos de proprietários para salvar na lista e exportar depois."
          />
        </TabsContent>
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
            <p>Esta plataforma utiliza exclusivamente dados públicos disponíveis em anúncios de mercado. Não realizamos coleta de dados pessoais sensíveis.</p>
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

      <ListaProprietariosDialog open={listaDialogOpen} onOpenChange={setListaDialogOpen} />

      <Dialog open={!!salvarDialog.op} onOpenChange={(o) => { if (!o) setSalvarDialog({ op: null, nome: "", email: "", telefone: "" }); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Brain className="w-4 h-4 text-primary" /> Salvar proprietário (validação IA)</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Apenas proprietários com <strong>e-mail e telefone válidos</strong> são salvos nesta lista. Os dados serão usados para campanhas Meta Ads.
            </p>
            <div className="space-y-1">
              <Label className="text-xs">Nome do proprietário *</Label>
              <Input value={salvarDialog.nome} onChange={(e) => setSalvarDialog((p) => ({ ...p, nome: e.target.value }))} placeholder="Ex.: João Silva" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">E-mail *</Label>
              <Input type="email" value={salvarDialog.email} onChange={(e) => setSalvarDialog((p) => ({ ...p, email: e.target.value }))} placeholder="proprietario@exemplo.com" />
              {salvarDialog.email && !isValidEmail(salvarDialog.email) && (
                <p className="text-xs text-destructive">E-mail inválido</p>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Telefone (com DDD) *</Label>
              <Input value={salvarDialog.telefone} onChange={(e) => setSalvarDialog((p) => ({ ...p, telefone: e.target.value }))} placeholder="(61) 99999-9999" />
              {salvarDialog.telefone && !isValidPhone(salvarDialog.telefone) && (
                <p className="text-xs text-destructive">Telefone inválido</p>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setSalvarDialog({ op: null, nome: "", email: "", telefone: "" })}>Cancelar</Button>
              <Button size="sm" onClick={confirmarSalvarNaLista} disabled={!salvarDialog.nome || !isValidEmail(salvarDialog.email) || !isValidPhone(salvarDialog.telefone)}>
                <ShieldCheck className="w-4 h-4 mr-1" /> Validar e Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
