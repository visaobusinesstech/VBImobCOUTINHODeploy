import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { handleAiError } from "@/lib/ai/aiErrorHandler";
import { getErrorCodeGuide } from "@/lib/ai/errorCodeGuide";
import { classificarAnunciante, coletarContatosPublicos, deveCaptarAnuncio } from "@/lib/anuncioProprietario";


import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, ReferenceLine, ScatterChart, Scatter, ZAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useImoveis } from "@/hooks/useImoveis";
import { useAuth } from "@/contexts/AuthContext";
import { useImobiliariaConfig } from "@/hooks/useImobiliariaConfig";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { exportAvaliacaoPDF, shareAvaliacaoPDF, type AvaliacaoLayoutOption } from "@/lib/exportAvaliacaoPDF";
import {
  aplicarAmostragem,
  descreverAmostragem,
  listarCriteriosAmostragem,
  explicarSelecaoReferencias,
  AMOSTRAGEM_PADRAO,
  CRITERIOS_AMOSTRAGEM,
  type ConfigAmostragem,
  type CriterioAmostragem,
  parametrosAmostragemAuditoria,
} from "@/lib/avaliacao/amostragemReferencias";
import { exportAvaliacaoPremiumPDF, shareAvaliacaoPremiumPDF } from "@/lib/exportAvaliacaoPremiumPDF";
import { exportCleanLightPDF, shareCleanLightPDF } from "@/lib/exportCleanLightPDF";
import {
  Calculator, TrendingUp, BarChart3, FileDown, Share2, Loader2,
  ArrowDown, ArrowUp, Target, Building2, MapPin, DollarSign,
  Sparkles, Clock, CheckCircle2, AlertTriangle, XCircle, PenLine, ListFilter,
  Save, History, Trash2, Eye, ExternalLink, Landmark, PiggyBank, Link2, ImagePlus, Bug,
  AlertCircle, RefreshCw
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { logger } from "@/lib/logger";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SasAvaliacaoForm, type SasFormData } from "@/components/avaliacao/SasAvaliacaoForm";
import { AvaliacoesHistoricoPanel } from "@/components/avaliacao/AvaliacoesHistoricoPanel";
import { SasWizard } from "@/components/avaliacao/wizard/SasWizard";
import {
  DESCRICAO_MIN,
  DESCRICAO_MAX,
  DESCRICAO_TEXTAREA_ID,
  validarDescricaoAvaliacao,
  validarDescricaoBackendShape,
  truncarDescricao,
  resolveManualImovelDescricao,
  contadorEmAlerta,
  formatarContador,
  descricaoParaPersistencia,
  descricaoParaFormulario,
  focusDescricaoTextarea,
} from "@/lib/avaliacao/avaliacaoDescricao";
import { buildAvaliacaoInvokePayload } from "@/lib/avaliacao/avaliacaoPayload";
import { validarComparaveisReais, resumirMotivos, type ComparavelInvalido } from "@/lib/avaliacao/validarComparaveisReais";
import { construirDiagnosticoLaudo } from "@/lib/avaliacao/diagnosticoLaudo";
import { DiagnosticoLaudoPanel } from "@/components/avaliacao/DiagnosticoLaudoPanel";
import { AVALIACAO_ERROR_MESSAGES, resolveBackendErrorMessage } from "@/lib/avaliacao/avaliacaoErrorMap";
import { ReferenciasLinkPanel, type ModoReferencia } from "@/components/avaliacao/ReferenciasLinkPanel";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";




interface AvaliacaoResult {
  valor_minimo: number;
  valor_ideal: number;
  valor_maximo: number;
  preco_m2_estimado: number;
  preco_m2_regiao: number;
  score_liquidez: number;
  classificacao_liquidez: "alta" | "media" | "baixa";
  probabilidade_venda_30dias: number;
  probabilidade_venda_60dias: number;
  probabilidade_venda_90dias: number;
  preco_competitivo: boolean;
  analise_resumo: string;
  pontos_fortes: string[];
  pontos_atencao: string[];
  estrategia_venda: string;
  portais_recomendados: string[];
  sugestao_preco_inicial: number;
  rentabilidade_mensal?: number;
  rentabilidade_percentual?: number;
  preco_idealista?: number;
  preco_otimista?: number;
  preco_realista?: number;
  preco_projetado?: number;
  analise_investimento?: string;
  destaques_localizacao?: string[];
  comparaveis_gerados?: any[];
  comparativo_portais?: any[];
}

interface Comparavel {
  id: string;
  /** Referência incluída manualmente pelo avaliador, imune aos filtros da amostragem. */
  forcada?: boolean;
  /** Motivo original do descarte, preservado para exibição no laudo. */
  motivo_forcada?: string;
  titulo: string;
  preco: number;
  area: number;
  quartos: number;
  suites?: number;
  banheiros?: number;
  bairro: string | null;
  tipo: string;
  operacao: string;
  fonte: "carteira" | "mercado";
  url_anuncio?: string | null;
  portal?: string | null;
  dias_anuncio?: number | null;
}

const formatBRL = (v: any) => {
  const val = Number(v);
  if (isNaN(val)) return "R$ 0,00";
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

const PHOTO_UPLOAD_MAX_BYTES = 20 * 1024 * 1024;
const SUPPORTED_PHOTO_MIME_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const SUPPORTED_PHOTO_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);
const PHOTO_ACCEPT_VALUE = "image/jpeg,image/png,image/webp,image/jpg";

const extractFileExtension = (fileName: string) =>
  (fileName.split(".").pop() || "").toLowerCase().replace(/[^a-z0-9]/g, "");

const normalizePhotoMimeType = (file: File) => {
  const extension = extractFileExtension(file.name);
  const mimeType = (file.type || "").toLowerCase();

  if (SUPPORTED_PHOTO_MIME_TYPES.has(mimeType)) {
    return { extension: extension || mimeType.split("/")[1] || "jpg", mimeType };
  }

  if (SUPPORTED_PHOTO_EXTENSIONS.has(extension)) {
    return {
      extension,
      mimeType: extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : "image/jpeg",
    };
  }

  return null;
};


import { getMissingCriticalFields } from "@/lib/avaliacao/avaliacaoCamposCriticos";
import { validarLinkReferencia, processarLoteLinksReferencia } from "@/lib/avaliacao/normalizarLinkReferencia";


const isValidUrl = (url: string): boolean => {
  if (!url || url.length < 10) return false;
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    return ["http:", "https:"].includes(parsed.protocol) && parsed.hostname.includes(".");
  } catch {
    return false;
  }
};


const mergeUniquePhotoUrls = (...groups: string[][]) =>
  Array.from(new Set(groups.flat().map((url) => url.trim()).filter(Boolean)));

const normalizeUrl = (url: string): string => {
  if (!url) return "";
  try {
    let cleaned = url.trim();
    // Remove double slashes (except protocol)
    cleaned = cleaned.replace(/([^:])\/\//g, "$1/");
    
    const parsed = new URL(cleaned.startsWith("http") ? cleaned : `https://${cleaned}`);
    
    // Remove tracking params
    const paramsToRemove = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid"];
    paramsToRemove.forEach(p => parsed.searchParams.delete(p));
    
    // Portal specific cleanup
    if (parsed.hostname.includes("dfimoveis.com.br")) {
      // Ensure no trailing slashes before query
      parsed.pathname = parsed.pathname.replace(/\/+$/, "");
    }

    return parsed.toString();
  } catch (e) {
    return url.trim();
  }
};


const createEmptyManualState = () => ({
  titulo: "",
  tipo: "Apartamento",
  operacao: "Venda",
  area: "",
  quartos: "",
  suites: "",
  banheiros: "",
  vagas: "",
  bairro: "",
  cidade: "",
  estado: "DF",
  cep: "",
  endereco: "",
  proprietario: "",
  data_avaliacao: "",
  latitude: "",
  longitude: "",
  lavabos: "",
  ano_construcao: "",
  estado_conservacao: "",
  valor_taxa_extra: "",
  taxa_extra_descricao: "",
  elevador: false,
  vista_livre: false,
  vista_permanente: false,
  mobiliado: false,
  reformado: false,
  preco: "",
  valor_condominio: "",
  valor_iptu: "",
  andar: "",
  posicao_solar: "",
  exclusivo: false,
  aceita_permuta: false,
  aceita_financiamento: false,
  tem_escritura: false,
  corretor_nome: "",
  corretor_creci: "",
  link_imovel: "",
  fotos_url: "",
  descricao: "",
});

export default function Avaliacao() {
  // Teste de Regressão Automático: Detectar duplicidade de IDs ou instâncias críticas ao montar o componente
  useEffect(() => {
    const instances = document.querySelectorAll('[data-component="avaliacao-page"]');
    if (instances.length > 1) {
      console.error("Detectada duplicidade crítica de scripts na aba de avaliação. Limpando instâncias...");
      window.location.reload();
    }
  }, []);


  const { imoveis, loading: loadingImoveis } = useImoveis();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const { imobiliariaId, isMaster, plano, trialDaysLeft, trialExpired, user } = useAuth();
  const { nome_empresa, creci, telefone, email: emailImob, logo_url, cnpj } = useImobiliariaConfig();
  const { toast } = useToast();

  // Monitorar erros não capturados globalmente (para scripts externos ou erros de rede)
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      logger.error({
        module: "Avaliacao",
        action: "uncaught_error",
        message: event.message || "Erro não capturado (Global)",
        stackTrace: event.error?.stack,
        userId: user?.id,
        metadata: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        }
      });
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      logger.error({
        module: "Avaliacao",
        action: "unhandled_rejection",
        message: event.reason?.message || "Rejeição de promessa não tratada",
        stackTrace: event.reason?.stack,
        userId: user?.id,
        metadata: {
          reason: event.reason
        }
      });
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, [user?.id]);


  const [selectedImovelId, setSelectedImovelId] = useState<string>("");
  const [avaliacao, setAvaliacao] = useState<AvaliacaoResult | null>(null);
  const [comparaveis, setComparaveis] = useState<Comparavel[]>([]);
  const [comparaveisDescartados, setComparaveisDescartados] = useState<ComparavelInvalido[]>([]);
  /** Referências removidas pelo avaliador — nunca voltam ao laudo (persistido). */
  const [referenciasBloqueadas, setReferenciasBloqueadas] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem("avaliacao:referencias-bloqueadas");
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  });

  const chaveReferencia = useCallback((c: any) => {
    const url = String(c?.url_anuncio || c?.url || "").trim().toLowerCase();
    return url ? `url:${url}` : `id:${String(c?.id ?? "")}`;
  }, []);

  const bloqueadasSet = useMemo(() => new Set(referenciasBloqueadas), [referenciasBloqueadas]);

  /** Remove da lista qualquer referência que o avaliador já descartou. */
  const semBloqueadas = useCallback(
    <T,>(lista: T[]): T[] => (lista || []).filter((c: any) => !bloqueadasSet.has(chaveReferencia(c))),
    [bloqueadasSet, chaveReferencia],
  );

  const bloquearReferencia = useCallback((c: any) => {
    const chave = chaveReferencia(c);
    setReferenciasBloqueadas((prev) => {
      const next = prev.includes(chave) ? prev : [...prev, chave];
      try {
        localStorage.setItem("avaliacao:referencias-bloqueadas", JSON.stringify(next));
      } catch { /* ignore */ }
      return next;
    });
  }, [chaveReferencia]);

  /** Referências forçadas no assistente — persistidas para sobreviverem ao recarregamento. */
  const [referenciasForcadas, setReferenciasForcadas] = useState<Comparavel[]>(() => {
    try {
      const raw = localStorage.getItem("avaliacao:referencias-forcadas");
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });


  const handleForcadasChange = useCallback((refs: any[]) => {
    const mapeadas: Comparavel[] = (refs || []).map((r) => ({
      id: String(r.id),
      titulo: r.titulo || "Imóvel sem título",
      preco: Number(r.preco || 0),
      area: Number(r.area || 0),
      quartos: Number(r.quartos || 0),
      suites: Number(r.suites || 0),
      banheiros: Number(r.banheiros || 0),
      bairro: r.bairro ?? null,
      tipo: r.tipo || "",
      operacao: r.operacao || "",
      fonte: r.origem === "carteira" ? "carteira" : "mercado",
      url_anuncio: r.url ?? null,
      portal: r.portal ?? null,
      forcada: true,
      motivo_forcada: r.motivoDescarte || "Inclusão manual pelo avaliador",
    }));
    setReferenciasForcadas((prev) =>
      JSON.stringify(prev) === JSON.stringify(mapeadas) ? prev : mapeadas,
    );
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("avaliacao:referencias-forcadas", JSON.stringify(referenciasForcadas));
    } catch {
      /* ignore */
    }
  }, [referenciasForcadas]);

  /** Junta as forçadas às referências validadas, sem duplicar e sem trazer de volta as removidas. */
  const mesclarForcadas = useCallback(
    (lista: Comparavel[]): Comparavel[] => {
      const base = semBloqueadas(lista).map((c) => {
        const f = referenciasForcadas.find((r) => String(r.id) === String(c.id) && r.fonte === c.fonte);
        return f ? { ...c, forcada: true, motivo_forcada: f.motivo_forcada } : c;
      });
      const faltantes = semBloqueadas(referenciasForcadas).filter(
        (r) => !base.some((c) => String(c.id) === String(r.id) && c.fonte === r.fonte),
      );
      return [...base, ...faltantes];
    },
    [referenciasForcadas, semBloqueadas],
  );

  // Modo diagnóstico: exibe em tela o payload completo enviado ao laudo
  const [modoDiagnostico, setModoDiagnostico] = useState<boolean>(() => {
    try {
      if (typeof window === "undefined") return false;
      const params = new URLSearchParams(window.location.search);
      if (params.get("diag") === "1" || params.get("diagnostic") === "1") return true;
      return localStorage.getItem("avaliacao:modo-diagnostico") === "1";
    } catch { return false; }
  });
  const [ultimoPayloadLaudo, setUltimoPayloadLaudo] = useState<{ origem: string; em: string; dados: any } | null>(null);
  const [substituicaoAlvo, setSubstituicaoAlvo] = useState<{ index: number; invalido: ComparavelInvalido } | null>(null);
  const [candidatosSubstituicao, setCandidatosSubstituicao] = useState<Comparavel[]>([]);
  const [carregandoCandidatos, setCarregandoCandidatos] = useState(false);
  const [buscaCandidato, setBuscaCandidato] = useState("");
  const [substituicoesRealizadas, setSubstituicoesRealizadas] = useState<
    { descartado: string; motivo: string; substituto: string; fonte: string; em: string }[]
  >([]);
  const substitutosManuaisRef = useRef<Comparavel[]>([]);
  const [modoReferencia, setModoReferencia] = useState<ModoReferencia>("sistema");
  const [configAmostragemOpen, setConfigAmostragemOpen] = useState(false);
  const [referenciasLink, setReferenciasLink] = useState<Comparavel[]>([]);
  const [adicionandoReferenciaLink, setAdicionandoReferenciaLink] = useState(false);
  const [avaliando, setAvaliando] = useState(false);
  const [modoManual, setModoManual] = useState(false);
  const [modoLink, setModoLink] = useState(false);
  const [avisoLinkDescontinuado, setAvisoLinkDescontinuado] = useState<"carteira" | "manual" | null>(null);
  const [redirectPendente, setRedirectPendente] = useState<{ destino: "carteira" | "manual"; url: string } | null>(null);
  const [preferenciaRedirecionoLink, setPreferenciaRedirecionoLink] = useState<"auto" | "carteira" | "manual">(() => {
    try {
      const v = localStorage.getItem("avaliacao:preferencia-redirect-link");
      return v === "carteira" || v === "manual" ? v : "auto";
    } catch {
      return "auto";
    }
  });

  const [pdfLayout, setPdfLayout] = useState<AvaliacaoLayoutOption>(() => {
    try {
      // Prioridade para a nova chave de layout que define "gamma" como padrão
      const saved = localStorage.getItem("avaliacao:pdf-layout");
      if (saved) return saved as AvaliacaoLayoutOption;
      
      // Fallback para a chave antiga se existir
      const salvoAntigo = localStorage.getItem("avaliacao-pdf-layout") as AvaliacaoLayoutOption | null;
      if (salvoAntigo) return salvoAntigo;

      return "gamma"; // O padrão antigo (Gamma) agora é o padrão correto para análise de mercado
    } catch {
      return "gamma";
    }
  });


  const [historico, setHistorico] = useState<any[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  const handleResetConfigs = useCallback(() => {
    // Lista de chaves para limpar
    const keysToClear = [
      "avaliacao:referencias-bloqueadas",
      "avaliacao:referencias-forcadas",
      "avaliacao:pdf-layout",
      "avaliacao:modo-diagnostico",
      "avaliacao:preferencia-redirect-link",
      "avaliacao-pdf-layout",
      "draft:sas-avaliacao-form",
      "avaliacao:amostragem-config"
    ];

    keysToClear.forEach(key => localStorage.removeItem(key));
    
    // Notificar sucesso e recarregar para aplicar o estado limpo
    toast({
      title: "Configurações Resetadas",
      description: "A aba de avaliação foi restaurada para o estado inicial.",
    });

    // Pequeno delay para o toast ser visível antes do reload
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  }, [toast]);

  const [showHistorico, setShowHistorico] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingHistoricoId, setEditingHistoricoId] = useState<string | null>(null);
    const [linkUrl, setLinkUrl] = useState("");
    const [extraindo, setExtraindo] = useState(false);
    const [erroExtracao, setErroExtracao] = useState<{message: string, detail?: string, stage?: string, correlationId?: string, httpStatus?: number, upstreamStatus?: number, hint?: string, errorCode?: string} | null>(null);
    const [erroAvaliacao, setErroAvaliacao] = useState<{message: string, detail?: string, code?: string, stage?: string, correlationId?: string, httpStatus?: number, upstreamStatus?: number, hint?: string} | null>(null);
    const [dadosExtraidos, setDadosExtraidos] = useState<any>(null);
    const [retryCount, setRetryCount] = useState(0);
    const [configIA, setConfigIA] = useState({ maxRetries: 2, retryDelay: 2000 });




  const [linksDetectados, setLinksDetectados] = useState<string[]>([]);
  const [linkDetectadoAtivo, setLinkDetectadoAtivo] = useState<string | null>(null);
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [avaliacoesUsadas, setAvaliacoesUsadas] = useState<number | null>(null);
    const [amostragem, setAmostragemState] = useState<ConfigAmostragem>(() => {
      try {
        const salvo = localStorage.getItem("avaliacao-amostragem-config");
        if (salvo) return { ...AMOSTRAGEM_PADRAO, ...JSON.parse(salvo) };
      } catch { /* ignore */ }
      return AMOSTRAGEM_PADRAO;
    });
    const setAmostragem = (patch: Partial<ConfigAmostragem>) => {
      setAmostragemState((prev) => {
        const next = { ...prev, ...patch };
        try { localStorage.setItem("avaliacao-amostragem-config", JSON.stringify(next)); } catch { /* ignore */ }
        return next;
      });
    };
    const [editTab, setEditTab] = useState<"imovel" | "valores">("imovel");
    const [imovelOverrides, setImovelOverrides] = useState<Record<string, any>>({});
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
    const [confirmAvaliarDialogOpen, setConfirmAvaliarDialogOpen] = useState(false);
    const [pendingExtractionData, setPendingExtractionData] = useState<{data: any, url: string} | null>(null);
    const [missingFieldsWarning, setMissingFieldsWarning] = useState<string[]>([]);
    const [missingFieldsAvaliarWarning, setMissingFieldsAvaliarWarning] = useState<string[]>([]);
    const [descricaoErro, setDescricaoErro] = useState<string | null>(null);
    const [currentCorrelationId, setCurrentCorrelationId] = useState<string | null>(null);
    const [reextraindoParciais, setReextraindoParciais] = useState(false);
    const [photoExtractionInfo, setPhotoExtractionInfo] = useState<{ blocked?: boolean; block_reason?: string; strategy_stats?: Record<string, number> } | null>(null);
    



  // During trial/solo: AI usage is limited on the frontend to match backend rules.
  const inTrial = plano === "gratuito" && !trialExpired && trialDaysLeft !== null && trialDaysLeft > 0;
  const isLimitedUser = !isMaster && (plano === "gratuito" || plano === "basico");
  const LIMITE_AVALIACOES = plano === "basico" ? 10 : 3;
  const [manual, setManual] = useState(createEmptyManualState);

  useEffect(() => {
    if (!user?.id || !isLimitedUser) {
      setAvaliacoesUsadas(null);
      return;
    }

    supabase
      .from("ai_usage_log")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("function_name", "avaliacao-imovel")
      .then(({ count, error }) => {
        if (error) {
          console.error("Erro ao carregar uso de avaliações:", error);
          setAvaliacoesUsadas(0);
          return;
        }
        setAvaliacoesUsadas(count ?? 0);
      });
  }, [user?.id, isLimitedUser]);
  useEffect(() => {
    if (!user) return;
    supabase
      .from("imobiliaria_config")
      .select("extraction_max_retries, extraction_retry_delay_ms")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setConfigIA({
            maxRetries: (data as any).extraction_max_retries ?? 2,
            retryDelay: (data as any).extraction_retry_delay_ms ?? 2000,
          });
        }
      });
  }, [user]);



  const limiteAtingido = isLimitedUser && (avaliacoesUsadas ?? 0) >= LIMITE_AVALIACOES;
  const manualAreaFilled = Number(manual.area) > 0;

  const manualImovel = useMemo(() => {
    if (!modoManual && !modoLink) return null;

    const extractedPhotos = Array.from(
      new Set(
        [
          ...uploadedPhotos,
          ...(manual.fotos_url
            ? manual.fotos_url.split(",").map((url) => url.trim()).filter((url) => /^https?:\/\//i.test(url))
            : []),
        ].filter(Boolean),
      ),
    );

    const normalizedCidade = manual.cidade || (manual.estado === "DF" ? "Brasília" : null);
    const normalizedBairro = manual.bairro || normalizedCidade || null;

    return {
      id: "manual",
      titulo: manual.titulo || "Imóvel Manual",
      tipo: manual.tipo,
      operacao: manual.operacao,
      area: Number(manual.area) || 0,
      quartos: Number(manual.quartos) || 0,
      suites: Number(manual.suites) || 0,
      banheiros: Number(manual.banheiros) || 0,
      vagas: Number(manual.vagas) || 0,
      lavabos: Number(manual.lavabos) || 0,
      bairro: normalizedBairro,
      cidade: normalizedCidade,
      estado: manual.estado || null,
      preco: Number(manual.preco) || 0,
      valor_condominio: Number(manual.valor_condominio) || 0,
      valor_iptu: Number(manual.valor_iptu) || 0,
      valor_taxa_extra: Number(manual.valor_taxa_extra) || 0,
      taxa_extra_descricao: manual.taxa_extra_descricao || null,
      andar: manual.andar || null,
      posicao_solar: manual.posicao_solar || null,
      proprietario: manual.proprietario || null,
      data_avaliacao: manual.data_avaliacao || null,
      latitude: Number(manual.latitude) || null,
      longitude: Number(manual.longitude) || null,
      ano_construcao: Number(manual.ano_construcao) || null,
      estado_conservacao: manual.estado_conservacao || null,
      elevador: manual.elevador,
      vista_livre: manual.vista_livre,
      vista_permanente: manual.vista_permanente,
      mobiliado: manual.mobiliado,
      reformado: manual.reformado,
      exclusivo: manual.exclusivo,
      aceita_permuta: manual.aceita_permuta,
      aceita_financiamento: manual.aceita_financiamento,
      tem_escritura: manual.tem_escritura,
      status: "Ativo",
      fotos: extractedPhotos,
      foto_capa_index: extractedPhotos.length > 0 ? 0 : null,
      destaque: false,
      cep: manual.cep || (modoLink ? (dadosExtraidos?.cep ?? null) : null),
      endereco: manual.endereco || (modoLink ? (dadosExtraidos?.endereco ?? null) : null),
      descricao: resolveManualImovelDescricao(manual.descricao, modoLink, dadosExtraidos?.descricao),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      imobiliaria_id: imobiliariaId || "",
    };
  }, [modoManual, modoLink, manual, uploadedPhotos, dadosExtraidos, imobiliariaId]);

  const selectedImovel = useMemo(() => {
    if (modoManual || modoLink) return manualImovel;
    const base = imoveis.find((i) => i.id === selectedImovelId) ?? null;
    if (!base || Object.keys(imovelOverrides).length === 0) return base;
    return { ...base, ...imovelOverrides };
  }, [imoveis, selectedImovelId, modoManual, modoLink, manualImovel, imovelOverrides]);

  const imoveisAtivos = useMemo(() => imoveis.filter((i) => i.status === "Ativo"), [imoveis]);

  const getFunctionErrorMessage = async (error: any, fallback: string) => {
    let payload: any = null;
    if (error?.context && typeof error.context.json === "function") {
      try { payload = await error.context.json(); } catch { /* ignore */ }
    }
    // Padronização: sempre o texto vindo do backend quando existir; senão,
    // resolve pelo `code` canônico; senão, aplica fallback específico do call-site.
    // Timeout de gateway (502/504) tem mensagem dedicada quando não há payload.
    const isGatewayTimeout = error?.status === 502 || error?.status === 504;
    const gatewayFallback = isGatewayTimeout
      ? AVALIACAO_ERROR_MESSAGES.TIMEOUT_UPSTREAM
      : (error?.message || fallback);
    const message = resolveBackendErrorMessage(payload, gatewayFallback);
    const errorCode =
      (typeof payload?.error_code === "string" ? payload.error_code : undefined) ??
      (typeof error?.error_code === "string" ? error.error_code : undefined);
    return {
      message,
      code: (typeof payload?.code === "string" ? payload.code : undefined) as string | undefined,
      errorCode,
      stage: payload?.stage as string | undefined,
      correlationId: (payload?.correlation_id as string | undefined) || undefined,
      httpStatus: (payload?.http_status as number | undefined) ?? error?.status ?? undefined,
      upstreamStatus: (payload?.upstream_status as number | undefined) ?? undefined,
      hint: payload?.hint as string | undefined,
    };
  };


  const logSystemAction = useCallback(async (params: { 
    action: string, 
    level?: 'info' | 'warn' | 'error' | 'fatal', 
    message: string, 
    metadata?: any, 
    stack?: string,
    correlationId?: string
  }) => {
    await logger.log({
      module: "Avaliacao",
      action: params.action,
      message: params.message,
      level: params.level || 'info',
      userId: user?.id,
      correlationId: params.correlationId || currentCorrelationId || undefined,
      stackTrace: params.stack,
      metadata: params.metadata
    });
  }, [user, currentCorrelationId]);

  const hasUsefulExtractedData = (data: any) =>
    Boolean(
      data?.area ||
      data?.preco ||

      data?.bairro ||
      data?.cidade ||
      data?.endereco ||
      (Array.isArray(data?.fotos) && data.fotos.length > 0)
    );

  const sanitizeImportedDescription = (value: unknown): string | null => {
    if (value === null || value === undefined) return null;

    const cleaned = String(value)
      .replace(/<[^>]*>/g, " ")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gi, "$1")
      .replace(/https?:\/\/[^\s)]+/gi, " ")
      .replace(/\bwww\.[^\s]+/gi, " ")
      .replace(/\b(?:olx|zapimoveis|vivareal|imovelweb|wimoveis|quintoandar|netimoveis|chavenaomao|chavenamao)\b/gi, " ")
      .replace(/\b(?:url do an[uú]ncio|url do anuncio|link do im[oó]vel|copiar link|ver telefone|fale conosco|acesse o portal)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim();

    return cleaned.length >= 30 ? cleaned : null;
  };

  const handleResetEstado = useCallback(() => {
    setSelectedImovelId("");
    setAvaliacao(null);
    setComparaveis([]);
    setAvaliando(false);
    setModoManual(false);
    setModoLink(false);
    setEditMode(false);
    setEditingHistoricoId(null);
    setLinkUrl("");
    setExtraindo(false);
    setErroExtracao(null);
    setErroAvaliacao(null);
    setDadosExtraidos(null);
    setRetryCount(0);
    setImovelOverrides({});
    setManual(createEmptyManualState());
    setLinksDetectados([]);
    setLinkDetectadoAtivo(null);
    setUploadedPhotos([]);
    setUploadingPhotos(false);
    
    // Recarregar dados essenciais
    if (imobiliariaId) {
      // Se necessário, recarregar outras configs aqui
    }
    
    toast({ title: "Ferramenta restaurada", description: "O estado da ferramenta foi resetado com sucesso." });
  }, [imobiliariaId, toast]);

  useEffect(() => {
    const handleResetAction = () => {
      handleResetEstado();
    };
    window.addEventListener('avaliacao:reset-state', handleResetAction);
    return () => window.removeEventListener('avaliacao:reset-state', handleResetAction);
  }, [handleResetEstado]);



  const normalizeExtractedData = (data: any) => ({
    ...data,
    descricao: sanitizeImportedDescription(data?.descricao),
    fotos: Array.isArray(data?.fotos)
      ? Array.from(
          new Set(
            data.fotos.filter(
              (foto: unknown) => typeof foto === "string" && /^https?:\/\//i.test(foto),
            ),
          ),
        )
      : [],
  });

  const resetLinkExtractionDraft = useCallback((nextUrl: string) => {
    setDadosExtraidos(null);
    setLinksDetectados([]);
    setLinkDetectadoAtivo(null);
    setUploadedPhotos([]);
    setComparaveis([]);
    setAvaliacao(null);
    setPhotoExtractionInfo(null);
    setManual({
      ...createEmptyManualState(),
      link_imovel: nextUrl,
    });
  }, [setManual]);


  const applyExtractedData = useCallback(async (data: any, sourceUrl: string, force = false, retry = 0) => {
    const startTime = Date.now();
    const normalizedData = normalizeExtractedData(data);
    
    // Validar campos críticos
    const missingFields = getMissingCriticalFields(normalizedData);

    // Captação automatizada (LGPD): registra link de origem + contato público
    // SEMPRE que o anúncio não for de intermediário, mesmo com extração incompleta.
    const registrarCaptacao = async () => {
      if (!user?.id) return;
      const status = missingFields.length === 0 ? 'completed' : 'incomplete';
      let portal = sourceUrl;
      try { portal = new URL(sourceUrl).hostname.replace('www.', ''); } catch { /* noop */ }

      const classificacao = classificarAnunciante({
        titulo: normalizedData.titulo,
        descricao: normalizedData.descricao,
        anunciante: (data as any)?.anunciante ?? (normalizedData as any)?.anunciante,
        url: sourceUrl,
      });
      if (!deveCaptarAnuncio(classificacao)) return;

      const contatos = coletarContatosPublicos({ bruto: data, normalizado: normalizedData });

      await supabase.from("captacao_anuncios_extraidos").upsert({
        imobiliaria_id: user.id,
        url_anuncio: sourceUrl,
        portal,
        titulo: normalizedData.titulo || "Imóvel",
        preco: Number(normalizedData.preco) > 0 ? Number(normalizedData.preco) : 0,
        bairro: normalizedData.bairro || null,
        cidade: normalizedData.cidade || null,
        estado: normalizedData.estado || null,
        telefone: contatos.telefone,
        email: contatos.email,
        anunciante_tipo: classificacao.tipo,
        extraction_status: status,
        missing_fields: missingFields,
        observacoes: classificacao.motivo,
        dados: normalizedData as any,
      }, { onConflict: "imobiliaria_id,url_anuncio" });
    };

    if (missingFields.length > 0 && !force) {
      void registrarCaptacao();
      setPendingExtractionData({ data, url: sourceUrl });
      setMissingFieldsWarning(missingFields);
      setConfirmDialogOpen(true);
      return;
    }

    // Registrar o status da extração no banco para consulta posterior
    if (user?.id) {
      const status = missingFields.length === 0 ? 'completed' : 'incomplete';
      let portal = sourceUrl;
      try { portal = new URL(sourceUrl).hostname.replace('www.', ''); } catch { /* noop */ }

      await Promise.all([
        supabase.from("extraction_logs").insert({
          user_id: user.id,
          source_url: sourceUrl,
          portal,
          status: status === 'completed' ? 'success' : 'partial',
          missing_fields: missingFields,
          retry_attempt: retry,
          response_time_ms: Date.now() - startTime
        }) as unknown as Promise<unknown>,
        registrarCaptacao(),
      ]);
    }





    const normalizedCidade = normalizedData.cidade || (normalizedData.estado === "DF" ? "Brasília" : null);
    const normalizedBairro = normalizedData.bairro || normalizedCidade || null;
    const nextManual = createEmptyManualState();

    setDadosExtraidos(normalizedData);
    setLinksDetectados([]);
    setLinkDetectadoAtivo(null);
    setUploadedPhotos([]);
    setManual({
      ...nextManual,
      titulo: normalizedData.titulo || nextManual.titulo,
      tipo: normalizedData.tipo || nextManual.tipo,
      operacao: normalizedData.operacao || nextManual.operacao,
      area: Number(normalizedData.area) > 0 ? String(normalizedData.area) : nextManual.area,
      quartos: Number(normalizedData.quartos) >= 0 ? String(normalizedData.quartos) : nextManual.quartos,
      suites: Number(normalizedData.suites) >= 0 ? String(normalizedData.suites) : nextManual.suites,
      banheiros: Number(normalizedData.banheiros) >= 0 ? String(normalizedData.banheiros) : nextManual.banheiros,
      vagas: Number(normalizedData.vagas) >= 0 ? String(normalizedData.vagas) : nextManual.vagas,
      bairro: normalizedBairro || nextManual.bairro,
      cidade: normalizedCidade || nextManual.cidade,
      estado: normalizedData.estado || nextManual.estado,
      preco: Number(normalizedData.preco) > 0 ? String(normalizedData.preco) : nextManual.preco,
      valor_condominio: Number(normalizedData.valor_condominio) >= 0 ? String(normalizedData.valor_condominio) : nextManual.valor_condominio,
      valor_iptu: Number(normalizedData.valor_iptu) >= 0 ? String(normalizedData.valor_iptu) : nextManual.valor_iptu,
      andar: normalizedData.andar || nextManual.andar,
      link_imovel: sourceUrl,
      fotos_url: normalizedData.fotos.length > 0 ? normalizedData.fotos.join(", ") : "",
    });

    if (missingFields.length === 0) {
      toast({ title: "Dados extraídos!", description: "Informações do anúncio foram preenchidas com sucesso." });
    } else {
      toast({ 
        title: "Atenção: Dados ausentes", 
        description: `Não encontramos: ${missingFields.join(", ")}. Complete manualmente.`,
        variant: "destructive"
      });
    }
    
    setConfirmDialogOpen(false);
    setPendingExtractionData(null);
  }, [user, setManual]);


  const invokeExtracaoAnuncio = useCallback(async (url: string, mode: "single" | "auto", correlationId?: string) => {
    const { invokeWithRetry } = await import("@/lib/retryExtracao");
    return invokeWithRetry(
      () => supabase.functions.invoke("extrair-dados-anuncio", {
        body: { url, mode, correlation_id: correlationId },
      }),
      {
        onRetry: ({ attempt, delayMs, result }) => {
          console.warn(
            `[extrair-dados-anuncio] retry ${attempt} em ${Math.round(delayMs)}ms`,
            result.data?.error_code || result.error?.message,
          );
        },
      },
    );
  }, []);


  /**
   * Reextrai apenas os campos que estão faltando/vazios na extração atual,
   * preservando tudo o que já foi preenchido (manual ou pela primeira extração).
   */
  const reextrairCamposFaltantes = useCallback(async () => {
    const sourceUrl = (manual.link_imovel || linkUrl || "").trim();
    if (!sourceUrl) {
      toast({ title: "Sem link", description: "Nenhum link de anúncio disponível para reextrair.", variant: "destructive" });
      return;
    }

    setReextraindoParciais(true);
    try {
      const { data, error } = await invokeExtracaoAnuncio(sourceUrl, "single");
      if (error) throw error;
      if (data?.error_code && !data?.dados) {
        toast({ title: "Falha na reextração", description: data?.message || data?.error || "Não foi possível reextrair.", variant: "destructive" });
        return;
      }
      if (!data?.dados) {
        toast({ title: "Sem novos dados", description: "O anúncio não retornou dados adicionais.", variant: "destructive" });
        return;
      }

      const normalized = normalizeExtractedData(data.dados);
      setPhotoExtractionInfo(data?.photo_extraction ?? null);

      // Merge somente onde o campo atual está vazio
      const isEmptyStr = (v: any) => v === undefined || v === null || String(v).trim() === "";
      const isEmptyNum = (v: any) => v === undefined || v === null || String(v).trim() === "" || Number(v) <= 0;

      setManual(prev => ({
        ...prev,
        titulo: isEmptyStr(prev.titulo) && normalized.titulo ? normalized.titulo : prev.titulo,
        tipo: isEmptyStr(prev.tipo) && normalized.tipo ? normalized.tipo : prev.tipo,
        operacao: isEmptyStr(prev.operacao) && normalized.operacao ? normalized.operacao : prev.operacao,
        area: isEmptyNum(prev.area) && Number(normalized.area) > 0 ? String(normalized.area) : prev.area,
        quartos: isEmptyStr(prev.quartos) && Number(normalized.quartos) >= 0 ? String(normalized.quartos) : prev.quartos,
        suites: isEmptyStr(prev.suites) && Number(normalized.suites) >= 0 ? String(normalized.suites) : prev.suites,
        banheiros: isEmptyStr(prev.banheiros) && Number(normalized.banheiros) >= 0 ? String(normalized.banheiros) : prev.banheiros,
        vagas: isEmptyStr(prev.vagas) && Number(normalized.vagas) >= 0 ? String(normalized.vagas) : prev.vagas,
        bairro: isEmptyStr(prev.bairro) && normalized.bairro ? normalized.bairro : prev.bairro,
        cidade: isEmptyStr(prev.cidade) && normalized.cidade ? normalized.cidade : prev.cidade,
        estado: isEmptyStr(prev.estado) && normalized.estado ? normalized.estado : prev.estado,
        preco: isEmptyNum(prev.preco) && Number(normalized.preco) > 0 ? String(normalized.preco) : prev.preco,
        valor_condominio: isEmptyStr(prev.valor_condominio) && Number(normalized.valor_condominio) >= 0 ? String(normalized.valor_condominio) : prev.valor_condominio,
        valor_iptu: isEmptyStr(prev.valor_iptu) && Number(normalized.valor_iptu) >= 0 ? String(normalized.valor_iptu) : prev.valor_iptu,
        andar: isEmptyStr(prev.andar) && normalized.andar ? normalized.andar : prev.andar,
        fotos_url: isEmptyStr(prev.fotos_url) && normalized.fotos?.length > 0 ? normalized.fotos.join(", ") : prev.fotos_url,
      }));

      // Merge complementar em dadosExtraidos (fotos, características, descrição)
      setDadosExtraidos((prev: any) => {
        const base = prev ?? {};
        const prevFotos: string[] = Array.isArray(base.fotos) ? base.fotos : [];
        const prevCaract: string[] = Array.isArray(base.caracteristicas) ? base.caracteristicas : [];
        const newFotos: string[] = Array.isArray(normalized.fotos) ? normalized.fotos : [];
        const newCaract: string[] = Array.isArray(normalized.caracteristicas) ? normalized.caracteristicas : [];
        return {
          ...base,
          fotos: prevFotos.length === 0 && newFotos.length > 0 ? newFotos : prevFotos,
          caracteristicas: prevCaract.length === 0 && newCaract.length > 0 ? newCaract : prevCaract,
          descricao: (!base.descricao || String(base.descricao).trim() === "") && normalized.descricao ? normalized.descricao : base.descricao,
          cep: base.cep || normalized.cep || null,
          endereco: base.endereco || normalized.endereco || null,
        };
      });

      // Recalcula lista de faltantes após merge
      setTimeout(() => {
        const merged = { ...normalized };
        const stillMissing = getMissingCriticalFields(merged);
        setMissingFieldsWarning(stillMissing);
      }, 0);

      const stillMissingNow = getMissingCriticalFields(normalized);
      if (stillMissingNow.length === 0) {
        toast({ title: "Campos preenchidos!", description: "Todos os campos críticos foram obtidos na reextração." });
      } else {
        toast({
          title: "Reextração concluída",
          description: `Ainda faltando: ${stillMissingNow.slice(0, 4).join(", ")}${stillMissingNow.length > 4 ? "…" : ""}. Complete manualmente.`,
        });
      }

      logSystemAction({
        action: "extrair-link-reextracao-parcial",
        level: "info",
        message: `Reextração de campos faltantes: ${sourceUrl}`,
        metadata: { url: sourceUrl, previous_missing: missingFieldsWarning, still_missing: stillMissingNow },
      });
    } catch (err: any) {
      toast({ title: "Erro na reextração", description: err?.message || "Não foi possível reextrair os campos.", variant: "destructive" });
    } finally {
      setReextraindoParciais(false);
    }
  }, [manual.link_imovel, linkUrl, invokeExtracaoAnuncio, setManual, missingFieldsWarning, toast, logSystemAction]);


  const handleExtrairLinkDetectado = async (url: string) => {
    const finalUrl = normalizeUrl(url);
    resetLinkExtractionDraft(finalUrl);
    setExtraindo(true);
    setLinkDetectadoAtivo(finalUrl);
    setErroExtracao(null);


    try {
      const { data, error } = await invokeExtracaoAnuncio(finalUrl, "single");
      if (handleAiError(data, error, navigate)) {
        setExtraindo(false);
        return;
      }
      if (error) {
        if (user?.id) {
          await supabase.from("extraction_logs").insert({
            user_id: user.id,
            source_url: finalUrl,
            portal: (() => { try { return new URL(finalUrl).hostname.replace("www.", ""); } catch { return "desconhecido"; } })(),
            status: "failed",
            error_message: error.message,
          } as any);
        }

        throw error;
      }
      if (data?.error_code || data?.success === false) {
        const e: any = new Error(data.message || data.error || "Falha na extração do anúncio.");
        e.error_code = data.error_code;
        e.payload = data;
        throw e;
      }
      if (data?.error) throw new Error(data.error);
      if (!data?.dados || !hasUsefulExtractedData(data.dados)) {
        const e: any = new Error("Não foi possível extrair dados suficientes deste anúncio. Escolha outro link da lista.");
        e.error_code = "insufficient_data";
        throw e;
      }


      setLinkUrl(url);
      setPhotoExtractionInfo(data?.photo_extraction ?? null);
      await applyExtractedData(data.dados, url);

    } catch (err: any) {
      const errInfo = await getFunctionErrorMessage(err, "Erro ao extrair dados do anúncio selecionado.");
      
      await logger.error({
        module: "Avaliacao",
        action: "extrair-link-detectado-falha",
        message: errInfo.message,
        stackTrace: err.stack,
        userId: user?.id,
        correlationId: errInfo.correlationId,
        metadata: { url: finalUrl, error: err, stage: errInfo.stage, httpStatus: errInfo.httpStatus, upstreamStatus: errInfo.upstreamStatus }
      });

      setErroExtracao({ message: "Falha na Extração", detail: errInfo.message, stage: errInfo.stage, correlationId: errInfo.correlationId, httpStatus: errInfo.httpStatus, upstreamStatus: errInfo.upstreamStatus, hint: errInfo.hint, errorCode: errInfo.errorCode });
      toast({ title: "Erro ao extrair dados", description: errInfo.message, variant: "destructive" });

    } finally {
      setExtraindo(false);
      setLinkDetectadoAtivo(null);
    }
  };

  const handleExtrairLink = useCallback(async (customUrl?: string, retry = 0) => {
    const startTime = Date.now();
    const targetUrl = customUrl || linkUrl;
    const finalUrl = normalizeUrl(targetUrl);
    let correlationId = currentCorrelationId;

    if (!finalUrl) {
      toast({ title: "URL obrigatória", description: "Cole o link do anúncio.", variant: "destructive" });
      return;
    }

    if (!isValidUrl(finalUrl)) {
      toast({ 
        title: "Link inválido", 
        description: "O endereço colado não parece ser um link válido de anúncio.", 
        variant: "destructive" 
      });
      return;
    }

    if (retry === 0) {
      correlationId = crypto.randomUUID();
      setCurrentCorrelationId(correlationId);
      (window as any).currentCorrelationId = correlationId;
      setRetryCount(0);
      setLinkUrl(finalUrl);
      resetLinkExtractionDraft(finalUrl);
      logSystemAction({
        action: "extrair-link-inicio",
        message: `Iniciando extração do link: ${finalUrl}`,
        correlationId: correlationId,
        metadata: { url: finalUrl }
      });
    }
    
    setExtraindo(true);
    setErroExtracao(null);

    try {
      const { data, error } = await invokeExtracaoAnuncio(finalUrl, "auto", correlationId || undefined);

      if (error || data?.error) {
        const errorMsg = error?.message || data?.error;
        const portal = new URL(finalUrl).hostname.replace('www.', '');
        
        logSystemAction({
          action: "extrair-link-falha",
          level: "error",
          message: `Falha na tentativa ${retry + 1}: ${errorMsg}`,
          metadata: { 
            url: finalUrl, 
            portal, 
            retry, 
            error_obj: error || data?.error,
            imovel_id: selectedImovel?.id 
          }
        });

        if (user?.id) {
          await supabase.from("extraction_logs").insert({
            user_id: user.id,
            source_url: finalUrl,
            portal,
            status: 'error',
            error_message: errorMsg,
            error_code: (data?.error_code || (error as any)?.error_code) ?? null,
            http_status: (data?.http_status || (error as any)?.status) ?? null,
            retry_attempt: retry,
            response_time_ms: Date.now() - startTime
          });
        }


        // Lógica de Reprocessamento Automático
        if (retry < configIA.maxRetries) {
          setRetryCount(retry + 1);
          toast({ 
            title: `Tentativa ${retry + 1} falhou`, 
            description: `Reprocessando link em ${configIA.retryDelay/1000}s...`,
          });
          
          await new Promise(resolve => setTimeout(resolve, configIA.retryDelay));
          return handleExtrairLink(finalUrl, retry + 1);
        }

        if (user?.id) {
          await supabase.from("extraction_logs").insert({
            user_id: user.id,
            source_url: finalUrl,
            portal: (() => { try { return new URL(finalUrl).hostname.replace("www.", ""); } catch { return "desconhecido"; } })(),
            status: "failed",
            retry_attempt: retry,
            error_message: errorMsg,
          } as any);
        }


        const e: any = new Error(errorMsg);
        e.error_code = data?.error_code;
        e.payload = data;
        throw e;
      }

      if (data?.is_listing && Array.isArray(data.property_urls) && data.property_urls.length > 0) {
        setLinksDetectados(data.property_urls.slice(0, 12));
        toast({
          title: "Encontramos vários imóveis nesse link",
          description: "Selecione abaixo o anúncio correto para preencher a avaliação.",
        });
        return;
      }

      if (data?.dados && (hasUsefulExtractedData(data.dados) || data?.partial)) {
        const isPartial = !!data?.partial;
        const missing: string[] = Array.isArray(data?.missing_fields) ? data.missing_fields : [];
        logSystemAction({
          action: isPartial ? "extrair-link-parcial" : "extrair-link-sucesso",
          level: isPartial ? "warn" : "info",
          message: isPartial
            ? `Extração PARCIAL do link: ${finalUrl} (faltando: ${missing.join(", ") || "n/a"})`
            : `Dados extraídos com sucesso do link: ${finalUrl}`,
          metadata: { url: finalUrl, dados: data.dados, missing_fields: missing, partial: isPartial, time: Date.now() - startTime }
        });
        setPhotoExtractionInfo(data?.photo_extraction ?? null);
        await applyExtractedData(data.dados, finalUrl, false, retry);
        if (isPartial) {
          toast({
            title: "Extração parcial",
            description: `Alguns campos não puderam ser obtidos${missing.length ? ` (${missing.slice(0, 4).join(", ")}${missing.length > 4 ? "…" : ""})` : ""}. Complete manualmente se necessário.`,
          });
        }
        return;
      }


        const e: any = new Error("Não encontramos dados suficientes neste anúncio. Tente outro link do imóvel ou preencha os campos manualmente.");
        e.error_code = "insufficient_data";
        throw e;
    } catch (err: any) {
      const errInfo = await getFunctionErrorMessage(err, "Erro ao extrair dados do anúncio.");
      logSystemAction({
        action: "extrair-link-erro-final",
        level: "error",
        message: `Erro final: ${errInfo.message}`,
        correlationId: errInfo.correlationId,
        metadata: { 
          url: finalUrl, 
          error: err,
          imovel_id: selectedImovel?.id,
          stage: errInfo.stage,
          httpStatus: errInfo.httpStatus,
          upstreamStatus: errInfo.upstreamStatus
        }
      });
      setErroExtracao({ message: "Falha na Extração", detail: errInfo.message, stage: errInfo.stage, correlationId: errInfo.correlationId, httpStatus: errInfo.httpStatus, upstreamStatus: errInfo.upstreamStatus, hint: errInfo.hint, errorCode: errInfo.errorCode });
      toast({ title: "Erro ao extrair dados", description: errInfo.message, variant: "destructive" });
    } finally {
      setExtraindo(false);
    }
  }, [linkUrl, resetLinkExtractionDraft, invokeExtracaoAnuncio, configIA, user, applyExtractedData, getFunctionErrorMessage, toast, logSystemAction]);


  useEffect(() => {
    // Avaliação por link foi descontinuada: pede confirmação antes de redirecionar.
    if (searchParams.get("url") || searchParams.get("autoExtrair")) {
      const urlOrigem = searchParams.get("url") || "";
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("url");
      nextParams.delete("autoExtrair");
      setSearchParams(nextParams, { replace: true });

      const destino: "carteira" | "manual" =
        preferenciaRedirecionoLink === "auto"
          ? ((imoveis || []).length > 0 ? "carteira" : "manual")
          : preferenciaRedirecionoLink;

      setRedirectPendente({ destino, url: urlOrigem });

      toast({
        title: "Avaliação por link descontinuada",
        description: `Revise o link de origem ou continue para ${destino === "carteira" ? "Carteira" : "Manual (SAS)"}.`,
      });

      logSystemAction({
        action: "avaliacao-link-descontinuada-aviso",
        level: "info",
        message: "Aviso de redirecionamento exibido (aguardando confirmação)",
        metadata: { destino, preferencia: preferenciaRedirecionoLink, url: urlOrigem },
      });
    }
  }, [searchParams, setSearchParams, imoveis, toast, logSystemAction, preferenciaRedirecionoLink]);

  /** Aplica o redirecionamento após confirmação do usuário. */
  const confirmarRedirectLink = useCallback((destino: "carteira" | "manual", url: string) => {
    setModoLink(false);
    setModoManual(destino === "manual");
    setAvisoLinkDescontinuado(destino);
    setRedirectPendente(null);
    logSystemAction({
      action: "avaliacao-link-descontinuada-redirect",
      level: "info",
      message: "Redirecionamento confirmado pelo usuário",
      metadata: { destino, url },
    });
  }, [logSystemAction]);







  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    const uploaderId = user?.id;

    if (!files || files.length === 0) return;
    if (!uploaderId) {
      toast({
        title: "Sessão inválida",
        description: "Faça login novamente antes de anexar fotos.",
        variant: "destructive",
      });
      e.target.value = "";
      return;
    }

    setUploadingPhotos(true);

    try {
      const uploadResults = await Promise.all(
        Array.from(files).map(async (file) => {
          const normalizedFile = normalizePhotoMimeType(file);
          if (!normalizedFile) {
            return {
              success: false as const,
              error: `${file.name}: formato não suportado. Use JPG, PNG ou WEBP`,
            };
          }

          if (file.size > PHOTO_UPLOAD_MAX_BYTES) {
            return { success: false as const, error: `${file.name}: maior que 20MB` };
          }

          const ext = normalizedFile.extension || "jpg";
          const safeBaseName = file.name
            .replace(/\.[^.]+$/, "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 50) || "foto";
          const path = `${uploaderId}/avaliacoes/${Date.now()}-${crypto.randomUUID()}-${safeBaseName}.${ext}`;

          try {
            const { error } = await supabase.storage.from("imoveis").upload(path, file, {
              contentType: normalizedFile.mimeType,
              cacheControl: "3600",
              upsert: false,
            });

            if (error) {
              const friendlyMessage = /row-level security|permission/i.test(error.message)
                ? "sem permissão para salvar a foto. Faça login novamente e tente de novo"
                : /mime|content.?type/i.test(error.message)
                  ? "formato de arquivo não aceito. Use JPG, PNG ou WEBP"
                  : error.message;

              return { success: false as const, error: `${file.name}: ${friendlyMessage}` };
            }

            const { data: urlData } = supabase.storage.from("imoveis").getPublicUrl(path);
            return { success: true as const, url: urlData.publicUrl };
          } catch (innerErr: any) {
            return {
              success: false as const,
              error: `${file.name}: ${innerErr?.message || "falha desconhecida"}`,
            };
          }
        }),
      );

      const newUrls = uploadResults.filter((result) => result.success).map((result) => result.url);
      const errors = uploadResults.filter((result) => !result.success).map((result) => result.error);

      if (newUrls.length > 0) {
        setUploadedPhotos((prev) => mergeUniquePhotoUrls(prev, newUrls));
        setManual((prev) => ({
          ...prev,
          fotos_url: mergeUniquePhotoUrls(
            prev.fotos_url ? prev.fotos_url.split(",") : [],
            newUrls,
          ).join(", "),
        }));
        toast({
          title: `${newUrls.length} foto(s) enviada(s)!`,
          description: "As imagens foram anexadas à avaliação manual.",
        });
      }

      if (errors.length > 0) {
        toast({
          title: newUrls.length > 0 ? "Algumas fotos falharam" : "Falha no envio das fotos",
          description: errors.slice(0, 3).join(" • "),
          variant: "destructive",
        });
      }
    } finally {
      setUploadingPhotos(false);
      e.target.value = "";
    }
  };

  const handleRemoveUploadedPhoto = (index: number) => {
    setUploadedPhotos(prev => {
      const removed = prev[index];
      const updated = prev.filter((_, i) => i !== index);
      // Also remove from fotos_url
      setManual(p => ({
        ...p,
        fotos_url: p.fotos_url.split(',').map(u => u.trim()).filter(u => u !== removed).join(', '),
      }));
      return updated;
    });
  };

  /** Extrai e salva um link já normalizado como referência real. Sem toasts (uso em lote). */
  const processarLinkReferencia = useCallback(async (
    urlNormalizada: string,
  ): Promise<{ ok: boolean; comp?: Comparavel; erro?: string }> => {
    if (!imobiliariaId) return { ok: false, erro: "Sessão inválida." };
    const parsed = new URL(urlNormalizada);

    const { data, error } = await invokeExtracaoAnuncio(parsed.toString(), "single");
    if (error || data?.success === false || !data?.dados) {
      return { ok: false, erro: "Não foi possível extrair o anúncio." };
    }
    const d = data.dados as any;
    const preco = Number(d.preco) || 0;
    const area = Number(d.area) || 0;
    if (preco <= 0 || area <= 0) {
      return { ok: false, erro: "Anúncio sem preço e área válidos." };
    }

    const { data: inserted, error: insertError } = await supabase
      .from("imoveis_mercado")
      .insert({
        imobiliaria_id: imobiliariaId,
        portal: parsed.hostname.replace(/^www\./, ""),
        url_anuncio: parsed.toString(),
        titulo: String(d.titulo || `Referência ${parsed.hostname}`).slice(0, 200),
        tipo: d.tipo || selectedImovel?.tipo || "Apartamento",
        operacao: d.operacao || selectedImovel?.operacao || "Venda",
        bairro: d.bairro || null,
        cidade: d.cidade || (selectedImovel as any)?.cidade || null,
        preco,
        area,
        quartos: Number(d.quartos) || 0,
        banheiros: Number(d.banheiros) || 0,
        vagas: Number(d.vagas) || 0,
        preco_m2: area > 0 ? Math.round(preco / area) : 0,
        dados_raw: { origem: "referencia-manual-link" },
      })
      .select("*")
      .maybeSingle();

    if (insertError || !inserted) {
      return { ok: false, erro: insertError?.message || "Erro ao salvar referência." };
    }

    const comp: Comparavel = {
      id: inserted.id,
      titulo: inserted.titulo,
      preco: Number(inserted.preco) || 0,
      area: Number(inserted.area) || 0,
      quartos: inserted.quartos || 0,
      suites: 0,
      banheiros: inserted.banheiros || 0,
      bairro: inserted.bairro,
      tipo: inserted.tipo || "",
      operacao: inserted.operacao || "",
      fonte: "mercado",
      url_anuncio: inserted.url_anuncio,
      portal: inserted.portal,
    };
    if (bloqueadasSet.has(chaveReferencia(comp))) {
      toast({
        title: "Referência removida anteriormente",
        description: "Este anúncio foi descartado por você e não volta ao laudo.",
        variant: "destructive",
      });
      return;
    }
    setReferenciasLink((prev) => (prev.some((r) => r.id === comp.id) ? prev : [...prev, comp]));


    logSystemAction({
      action: "referencia-link-adicionada",
      message: `Referência manual adicionada por link: ${comp.titulo}`,
      metadata: { url: parsed.toString(), comparavel: comp },
    });

    return { ok: true, comp };
  }, [imobiliariaId, invokeExtracaoAnuncio, logSystemAction, selectedImovel]);

  /** Adiciona um anúncio enviado por link como referência real (salvo em imoveis_mercado). */
  const adicionarReferenciaLink = useCallback(async (url: string) => {
    if (!imobiliariaId) {
      toast({ title: "Sessão inválida", description: "Faça login novamente.", variant: "destructive" });
      return;
    }
    const validacao = validarLinkReferencia(url, referenciasLink.map((r) => r.url_anuncio));
    if (!validacao.ok) {
      toast({
        title: validacao.erro?.includes("já foi adicionado") ? "Link duplicado" : "Link inválido",
        description: validacao.erro,
        variant: "destructive",
      });
      return;
    }

    setAdicionandoReferenciaLink(true);
    try {
      const r = await processarLinkReferencia(validacao.url!);
      if (!r.ok) {
        toast({ title: "Não foi possível adicionar", description: r.erro, variant: "destructive" });
        return;
      }
      toast({ title: "Referência adicionada", description: r.comp?.titulo });
    } finally {
      setAdicionandoReferenciaLink(false);
    }
  }, [imobiliariaId, processarLinkReferencia, referenciasLink, toast]);

  /** Importa vários links colados de uma vez, agregando os válidos como referências reais. */
  const adicionarReferenciasLote = useCallback(async (texto: string) => {
    if (!imobiliariaId) {
      toast({ title: "Sessão inválida", description: "Faça login novamente.", variant: "destructive" });
      return;
    }
    const { validos, invalidos } = processarLoteLinksReferencia(
      texto,
      referenciasLink.map((r) => r.url_anuncio),
    );
    if (validos.length === 0) {
      toast({
        title: "Nenhum link válido",
        description: invalidos[0]?.erro || "Cole um link por linha.",
        variant: "destructive",
      });
      return;
    }

    setAdicionandoReferenciaLink(true);
    const falhas: { entrada: string; erro: string }[] = [...invalidos];
    let sucessos = 0;
    try {
      for (const url of validos) {
        const r = await processarLinkReferencia(url);
        if (r.ok) sucessos += 1;
        else falhas.push({ entrada: url, erro: r.erro || "Falha na extração." });
      }
    } finally {
      setAdicionandoReferenciaLink(false);
    }

    logSystemAction({
      action: "referencias-link-importacao-lote",
      message: `Importação em lote de referências: ${sucessos} adicionada(s), ${falhas.length} falha(s)`,
      metadata: { total: validos.length + invalidos.length, sucessos, falhas },
    });

    toast({
      title: `${sucessos} referência(s) adicionada(s)`,
      description: falhas.length
        ? `${falhas.length} link(s) ignorado(s): ${falhas.slice(0, 3).map((f) => f.erro).join(" • ")}`
        : "Todos os links foram importados.",
      variant: sucessos === 0 ? "destructive" : "default",
    });
  }, [imobiliariaId, logSystemAction, processarLinkReferencia, referenciasLink, toast]);


  /** Remove uma referência da avaliação e a bloqueia permanentemente. */
  const removerReferenciaLink = useCallback((id: string) => {
    setReferenciasLink((prev) => {
      const alvo = prev.find((r) => r.id === id);
      if (alvo) {
        bloquearReferencia(alvo);
        logSystemAction({
          action: "referencia-link-removida",
          message: `Referência por link removida (bloqueada): ${alvo.titulo}`,
          metadata: { id, url: alvo.url_anuncio },
        });
      }
      return prev.filter((r) => r.id !== id);
    });
    setReferenciasForcadas((prev) => prev.filter((r) => String(r.id) !== String(id)));
    setComparaveis((prev) => prev.filter((c) => String(c.id) !== String(id)));
  }, [bloquearReferencia, logSystemAction]);


  /** Edita manualmente os dados de uma referência enviada por link. */
  const editarReferenciaLink = useCallback(async (
    id: string,
    patch: { titulo: string; preco: number; area: number; bairro: string | null },
  ) => {
    const anterior = referenciasLink.find((r) => r.id === id);
    const preco_m2 = patch.area > 0 ? Math.round(patch.preco / patch.area) : 0;

    setReferenciasLink((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch, preco_m2 } as Comparavel : r)),
    );

    const { error } = await supabase
      .from("imoveis_mercado")
      .update({ titulo: patch.titulo, preco: patch.preco, area: patch.area, bairro: patch.bairro, preco_m2 })
      .eq("id", id);

    if (error) {
      toast({ title: "Erro ao salvar edição", description: error.message, variant: "destructive" });
      if (anterior) setReferenciasLink((prev) => prev.map((r) => (r.id === id ? anterior : r)));
      return;
    }

    logSystemAction({
      action: "referencia-link-editada",
      message: `Referência por link editada: ${patch.titulo}`,
      metadata: { id, antes: anterior, depois: patch },
    });
    toast({ title: "Referência atualizada", description: "Recompile o laudo para aplicar." });
  }, [logSystemAction, referenciasLink, toast]);

  /** Reordena as referências por link (prioridade no laudo). */
  const reordenarReferenciaLink = useCallback((id: string, direcao: -1 | 1) => {
    setReferenciasLink((prev) => {
      const idx = prev.findIndex((r) => r.id === id);
      const destino = idx + direcao;
      if (idx < 0 || destino < 0 || destino >= prev.length) return prev;
      const novo = [...prev];
      [novo[idx], novo[destino]] = [novo[destino], novo[idx]];
      return novo;
    });
  }, []);

  



  const buscarComparaveis = async () => {
    if (!selectedImovel || !imobiliariaId) return [];

    // Modo "somente meus links": usa exclusivamente as referências enviadas pelo usuário
    if (modoReferencia === "links") {
      logSystemAction({
        action: "buscar-comparaveis-links-manuais",
        message: `Usando ${referenciasLink.length} referência(s) enviadas por link`,
        metadata: { total: referenciasLink.length },
      });
      return referenciasLink;
    }

    logSystemAction({
      action: "buscar-comparaveis-inicio",
      message: `Iniciando busca de comparáveis para ${selectedImovel.titulo}`,
      metadata: { imovel: selectedImovel }
    });

    const allComps: Comparavel[] = [];
    if (modoReferencia === "ambos") allComps.push(...referenciasLink);



    const iArea = selectedImovel.area || 0;
    const iQuartos = selectedImovel.quartos || 0;
    const iSuites = (selectedImovel as any).suites || 0;
    const iBanheiros = (selectedImovel as any).banheiros || 0;

    // ─── Score de similaridade para ordenar comparáveis ───
    const calcSimilaridade = (comp: any): number => {
      let score = 0;
      // Mesma tipologia = +30
      if (comp.tipo === selectedImovel.tipo) score += 30;
      // Mesmo bairro = +25
      if (comp.bairro && comp.bairro === selectedImovel.bairro) score += 25;
      // Mesma operação = +40 (prioridade máxima: não misturar venda com aluguel)
      if (comp.operacao === selectedImovel.operacao) score += 40;
      else score -= 100; // penalizar fortemente operação diferente
      // Área similar (±20% = +15, ±30% = +8)
      if (iArea > 0 && comp.area > 0) {
        const diff = Math.abs(comp.area - iArea) / iArea;
        if (diff <= 0.15) score += 15;
        else if (diff <= 0.3) score += 8;
      }
      // Quartos iguais = +8
      if (iQuartos > 0 && comp.quartos === iQuartos) score += 8;
      // Suítes iguais = +5
      if (iSuites > 0 && (comp.suites || 0) === iSuites) score += 5;
      // Banheiros iguais = +5
      if (iBanheiros > 0 && (comp.banheiros || 0) === iBanheiros) score += 5;
      // Tempo de anúncio recente = +2
      if (comp.dias_anuncio && comp.dias_anuncio <= 90) score += 2;
      return score;
    };

    // ─── Carteira interna ───
    const normalizar = (valor: unknown) => String(valor || "").trim().toLocaleLowerCase("pt-BR");
    const mesmaOperacao = (valor: unknown) => {
      const atual = normalizar(selectedImovel.operacao);
      const candidato = normalizar(valor);
      const atualLocacao = atual.includes("loca") || atual.includes("alug");
      const candidatoLocacao = candidato.includes("loca") || candidato.includes("alug");
      return atualLocacao === candidatoLocacao;
    };

    const internos = imoveis.filter(
      (i) =>
        i.id !== selectedImovel.id &&
        (i.preco || 0) > 0 &&
        (i.area || 0) > 0 &&
        normalizar(i.tipo) === normalizar(selectedImovel.tipo) &&
        mesmaOperacao(i.operacao) &&
        (selectedImovel.bairro ? normalizar(i.bairro) === normalizar(selectedImovel.bairro) : true) &&
        (iArea > 0 ? Math.abs(i.area - iArea) / iArea <= 0.35 : true)
    );
    internos.forEach((i) =>
      allComps.push({
        id: i.id, titulo: i.titulo, preco: i.preco, area: i.area,
        quartos: i.quartos, suites: (i as any).suites || 0, banheiros: (i as any).banheiros || 0,
        bairro: i.bairro, tipo: i.tipo, operacao: i.operacao, fonte: "carteira",
      })
    );

    // ─── Mercado (imoveis_mercado) com busca progressiva ───
    // Estratégia em camadas: começa restrito e vai relaxando até obter base suficiente.
    const MIN_COMPS = 6;
    const seenIds = new Set(allComps.map((c) => c.id));

    const pushMercado = (rows: any[] | null) => {
      (rows || []).forEach((m) => {
        if (seenIds.has(m.id)) return;
        if (!(Number(m.preco) > 0) || !(Number(m.area) > 0)) return;
        seenIds.add(m.id);
        allComps.push({
          id: m.id, titulo: m.titulo, preco: m.preco ?? 0, area: m.area ?? 0,
          quartos: m.quartos ?? 0, suites: 0, banheiros: m.banheiros ?? 0,
          bairro: m.bairro, tipo: m.tipo ?? "", operacao: m.operacao ?? "", fonte: "mercado",
          url_anuncio: m.url_anuncio || null,
          portal: m.portal || null,
          dias_anuncio: m.dias_anuncio || null,
        });
      });
    };

    const cidadeImovel = (selectedImovel as any).cidade || null;

    // Camada 1: bairro exato + área ±35% (+ banheiros)
    // Camada 2: bairro (ilike) + área ±50%
    // Camada 3: cidade + área ±50%
    // Camada 4: cidade, sem restrição de área
    // Camada 5: tipo + operação (qualquer localização), sem restrição de área
    // Camada 6: mesma operação, qualquer tipo/localização (último fallback real)
    const camadas: Array<() => any> = [
      () => {
        let q = supabase.from("imoveis_mercado").select("*").limit(200);
        if (selectedImovel.tipo) q = q.ilike("tipo", selectedImovel.tipo);
        if (selectedImovel.operacao) q = q.ilike("operacao", selectedImovel.operacao === "Locação" ? "%loca%" : "%venda%");
        if (selectedImovel.bairro) q = q.ilike("bairro", selectedImovel.bairro);
        if (iArea > 0) q = q.gte("area", Math.round(iArea * 0.65)).lte("area", Math.round(iArea * 1.35));
        if (iBanheiros >= 2) q = q.gte("banheiros", iBanheiros - 1);
        return q;
      },
      () => {
        let q = supabase.from("imoveis_mercado").select("*").limit(200);
        if (selectedImovel.tipo) q = q.ilike("tipo", selectedImovel.tipo);
        if (selectedImovel.operacao) q = q.ilike("operacao", selectedImovel.operacao === "Locação" ? "%loca%" : "%venda%");
        if (selectedImovel.bairro) q = q.ilike("bairro", `%${selectedImovel.bairro}%`);
        if (iArea > 0) q = q.gte("area", Math.round(iArea * 0.5)).lte("area", Math.round(iArea * 1.5));
        return q;
      },
      () => {
        let q = supabase.from("imoveis_mercado").select("*").limit(200);
        if (selectedImovel.tipo) q = q.ilike("tipo", selectedImovel.tipo);
        if (selectedImovel.operacao) q = q.ilike("operacao", selectedImovel.operacao === "Locação" ? "%loca%" : "%venda%");
        if (cidadeImovel) q = q.ilike("cidade", `%${cidadeImovel}%`);
        if (iArea > 0) q = q.gte("area", Math.round(iArea * 0.5)).lte("area", Math.round(iArea * 1.5));
        return q;
      },
      () => {
        let q = supabase.from("imoveis_mercado").select("*").limit(200);
        if (selectedImovel.tipo) q = q.ilike("tipo", selectedImovel.tipo);
        if (selectedImovel.operacao) q = q.ilike("operacao", selectedImovel.operacao === "Locação" ? "%loca%" : "%venda%");
        if (cidadeImovel) q = q.ilike("cidade", `%${cidadeImovel}%`);
        return q;
      },
      () => {
        let q = supabase.from("imoveis_mercado").select("*").limit(200);
        if (selectedImovel.tipo) q = q.ilike("tipo", selectedImovel.tipo);
        if (selectedImovel.operacao) q = q.ilike("operacao", selectedImovel.operacao === "Locação" ? "%loca%" : "%venda%");
        return q;
      },
      () => {
        let q = supabase.from("imoveis_mercado").select("*").limit(200);
        if (selectedImovel.operacao) q = q.ilike("operacao", selectedImovel.operacao === "Locação" ? "%loca%" : "%venda%");
        return q;
      },
    ];

    for (const buildQuery of camadas) {
      if (allComps.length >= MIN_COMPS) break;
      const { data, error } = await buildQuery();
      if (error) {
        logSystemAction({
          action: "buscar-comparaveis-erro",
          message: `Falha ao buscar mercado: ${error.message}`,
          metadata: { error: error.message },
        });
        continue;
      }
      pushMercado(data as any[]);
    }

    // Última rede de segurança: carteira do mesmo tipo/operação (sem filtro de bairro/área)
    if (allComps.length < 3) {
      imoveis
        .filter(
          (i) =>
            i.id !== selectedImovel.id &&
            !seenIds.has(i.id) &&
            (i.preco || 0) > 0 &&
            (i.area || 0) > 0 &&
            normalizar(i.tipo) === normalizar(selectedImovel.tipo) &&
            mesmaOperacao(i.operacao),
        )
        .forEach((i) => {
          seenIds.add(i.id);
          allComps.push({
            id: i.id, titulo: i.titulo, preco: i.preco, area: i.area,
            quartos: i.quartos, suites: (i as any).suites || 0, banheiros: (i as any).banheiros || 0,
            bairro: i.bairro, tipo: i.tipo, operacao: i.operacao, fonte: "carteira",
          });
        });
    }


    // ─── Ordenar por score de similaridade (mais parecido primeiro) ───
    // Filtrar: NUNCA incluir comparáveis de operação diferente
    const sameOpComps = allComps.filter(c => mesmaOperacao(c.operacao));
    const scored = sameOpComps.map(c => ({ ...c, _score: calcSimilaridade(c) }));
    scored.sort((a, b) => b._score - a._score);
    
    logSystemAction({
      action: "buscar-comparaveis-fim",
      message: `Busca finalizada: ${scored.length} comparáveis encontrados`,
      metadata: { count: scored.length, top_score: scored[0]?._score }
    });


    // Priorizar portais-chave no topo entre items de mesmo score
    const prioritarios = ['WImóveis', 'DFImóveis', 'Chave na Mão'];
    scored.sort((a, b) => {
      if (a._score !== b._score) return b._score - a._score;
      const aPri = a.portal && prioritarios.includes(a.portal) ? 0 : 1;
      const bPri = b.portal && prioritarios.includes(b.portal) ? 0 : 1;
      return aPri - bPri;
    });

    return scored.slice(0, 50).map(({ _score, ...rest }) => rest);
  };

  const handleAvaliar = useCallback(async (force = false) => {
    if (!selectedImovel) return;
    
    const correlationId = crypto.randomUUID();
    setCurrentCorrelationId(correlationId);
    (window as any).currentCorrelationId = correlationId;

    logSystemAction({
      action: "handleAvaliar-inicio",
      message: `Iniciando processo de avaliação IA para ${selectedImovel.titulo}`,
      correlationId: correlationId,
      metadata: { imovel: selectedImovel, force }
    });

    // Verificar limite de avaliações para usuários trial
    if (limiteAtingido) {
      logSystemAction({
        action: "handleAvaliar-limite",
        level: "warn",
        message: "Limite de avaliações IA atingido",
        metadata: { user_id: user?.id, plano }
      });
      toast({
        title: "Limite de avaliações atingido",
        description: "Você já utilizou sua avaliação gratuita com IA. Faça upgrade do plano para avaliações ilimitadas.",
        variant: "destructive",
      });
      return;
    }
    if ((modoManual || modoLink) && !manualAreaFilled) {
      toast({ title: "Dados incompletos", description: "Preencha ao menos a área do imóvel.", variant: "destructive" });
      return;
    }

    if (!selectedImovel || (!selectedImovel.id && !selectedImovel.titulo)) {
      toast({ title: "Nenhum imóvel selecionado", description: "Selecione um imóvel da carteira ou preencha os dados manuais.", variant: "destructive" });
      return;
    }

    const missingFields = getMissingCriticalFields(selectedImovel);

    // Bloqueio DURO preventivo: espelha 1:1 a validação da edge function
    // `avaliacao-imovel`. Se falhar aqui, evitamos a chamada de rede e
    // apresentamos ao usuário o MESMO erro estruturado (code/message/field)
    // que o backend devolveria — nos dois modos (manual e por link).
    const backendDesc = validarDescricaoBackendShape((selectedImovel as any)?.descricao || "");
    if (backendDesc) {
      setDescricaoErro(backendDesc.error);
      setMissingFieldsAvaliarWarning(missingFields.length ? missingFields : [`Descrição do imóvel (${backendDesc.error})`]);
      logSystemAction({
        action: "handleAvaliar-bloqueio-descricao",
        level: "warn",
        message: `Bloqueio preventivo (front) por descrição: ${backendDesc.code}`,
        metadata: {
          code: backendDesc.code,
          descricao_length: backendDesc.descricao_length,
          descricao_min: backendDesc.descricao_min,
          descricao_max: backendDesc.descricao_max,
          modo: modoLink ? "link" : modoManual ? "manual" : "carteira",
          imovel_id: selectedImovel?.id,
        },
      });
      toast({
        title: "Descrição inválida",
        description: backendDesc.error,
        variant: "destructive",
      });
      void focusDescricaoTextarea();
      return;
    }
    setDescricaoErro(null);

    if (missingFields.length > 0 && !force) {
      setMissingFieldsAvaliarWarning(missingFields);
      setConfirmAvaliarDialogOpen(true);
      return;
    }

    setAvaliando(true);
    setAvaliacao(null);
    setErroAvaliacao(null);
    setConfirmAvaliarDialogOpen(false);

    try {
      const compsBase = await buscarComparaveis();

      // Preserva as referências que o usuário substituiu manualmente
      const manuais = substitutosManuaisRef.current;
      const idsBase = new Set(compsBase.map((c) => String(c.id)));
      const comps = semBloqueadas([...compsBase, ...manuais.filter((m) => !idsBase.has(String(m.id)))]);

      setComparaveis(comps);


      const { data, error } = await supabase.functions.invoke("avaliacao-imovel", {
        body: buildAvaliacaoInvokePayload(selectedImovel as any, comps, correlationId),
      });

      if (handleAiError(data, error, navigate)) {
        setAvaliando(false);
        return;
      }

      if (error) {
        logSystemAction({
          action: "handleAvaliar-erro-supabase",
          level: "error",
          message: `Erro na invocação da função: ${error.message}`,
          metadata: { 
            error, 
            imovel_id: selectedImovel.id,
            imovel_titulo: selectedImovel.titulo 
          }
        });
        throw error;
      }

      if (data?.error || (typeof data?.code === "string" && data.code)) {
        const resolvedMsg = resolveBackendErrorMessage(data, "Erro ao gerar a avaliação.");
        logSystemAction({
          action: "handleAvaliar-erro-ia",
          level: "error",
          message: `Erro retornado pela IA: ${resolvedMsg}`,
          metadata: {
            data,
            code: data?.code,
            imovel_id: selectedImovel.id,
            imovel_titulo: selectedImovel.titulo,
          },
        });
        throw new Error(resolvedMsg);
      }

      if (error) throw error;
      if (!data?.avaliacao) throw new Error("Não foi possível gerar a avaliação deste imóvel.");

      // Os imóveis de referência exibidos e exportados no PDF são SEMPRE os
      // comparáveis reais levantados (carteira + mercado). Itens retornados pela
      // IA que não correspondam a um comparável real são descartados.
      const aiComps = Array.isArray(data.avaliacao?.comparaveis_gerados) ? data.avaliacao.comparaveis_gerados : [];
      if (aiComps.length > 0) {
        const chave = (c: any) =>
          (c?.url_anuncio || "").trim().toLowerCase() ||
          `${String(c?.titulo || "").trim().toLowerCase()}|${Math.round(Number(c?.preco) || 0)}|${Math.round(Number(c?.area) || 0)}`;
        const reais = new Set(comps.map(chave));
        const validos = aiComps.filter((c: any) => reais.has(chave(c)));
        data.avaliacao.comparaveis_gerados = validos;
        if (validos.length !== aiComps.length) {
          logSystemAction({
            action: "comparaveis-ia-descartados",
            level: "warn",
            message: `${aiComps.length - validos.length} comparáveis retornados pela IA foram descartados por não corresponderem a imóveis reais`,
            metadata: { recebidos: aiComps.length, validos: validos.length },
          });
        }
      }


      setAvaliacao(data.avaliacao);
      // Atualizar contador de avaliações para trial
      if (isLimitedUser) {
        setAvaliacoesUsadas((prev) => (prev ?? 0) + 1);
      }
      toast({ title: "Avaliação concluída!", description: "A análise do imóvel foi gerada com sucesso." });
    } catch (err: any) {
      const errInfo = await getFunctionErrorMessage(err, "Erro ao gerar a avaliação.");
      logSystemAction({
        action: "handleAvaliar-falha-final",
        level: "error",
        message: `Falha ao avaliar: ${errInfo.message}`,
        correlationId: errInfo.correlationId,
        metadata: { 
          error: err, 
          imovel_id: selectedImovel.id,
          imovel_titulo: selectedImovel.titulo,
          stage: errInfo.stage,
          httpStatus: errInfo.httpStatus,
          upstreamStatus: errInfo.upstreamStatus
        }
      });
      setErroAvaliacao({ message: "Falha na Avaliação", detail: errInfo.message, code: errInfo.code, stage: errInfo.stage, correlationId: errInfo.correlationId, httpStatus: errInfo.httpStatus, upstreamStatus: errInfo.upstreamStatus, hint: errInfo.hint });
      toast({ title: "Erro na avaliação", description: errInfo.message, variant: "destructive" });
    } finally {
      setAvaliando(false);
    }
  }, [selectedImovel, limiteAtingido, modoManual, modoLink, manualAreaFilled, user, plano, isLimitedUser, buscarComparaveis, getFunctionErrorMessage, toast, logSystemAction]);


  /**
   * Gate obrigatório: valida que todo imóvel de referência do laudo existe de
   * fato na carteira (imoveis) ou no mercado (imoveis_mercado). Retorna a lista
   * validada ou lança erro impedindo a geração do PDF.
   */
  const validarComparaveisParaLaudo = useCallback(async (): Promise<Comparavel[]> => {
    const lista = comparaveis || [];
    const idsCarteira = lista.filter(c => c.fonte === "carteira").map(c => String(c.id));
    const idsMercado = lista.filter(c => c.fonte === "mercado").map(c => String(c.id));

    const [carteiraRes, mercadoRes] = await Promise.all([
      idsCarteira.length
        ? supabase.from("imoveis").select("id").in("id", idsCarteira)
        : Promise.resolve({ data: [] as any[], error: null } as any),
      idsMercado.length
        ? supabase.from("imoveis_mercado").select("id").in("id", idsMercado)
        : Promise.resolve({ data: [] as any[], error: null } as any),
    ]);

    if (carteiraRes.error || mercadoRes.error) {
      throw new Error("Não foi possível validar os imóveis de referência. Tente novamente.");
    }

    const resultado = validarComparaveisReais<Comparavel>(lista, {
      idsCarteira: ((carteiraRes.data || []) as any[]).map(r => String(r.id)),
      idsMercado: ((mercadoRes.data || []) as any[]).map(r => String(r.id)),
      minimoValidos: 1,
    });

    if (resultado.totalInvalidos > 0) {
      logSystemAction({
        action: "validacao-comparaveis-laudo",
        level: "warn",
        message: resultado.resumo,
        metadata: {
          imovel_id: selectedImovel?.id,
          total: resultado.total,
          validos: resultado.totalValidos,
          motivos: resumirMotivos(resultado.invalidos),
          descartados: resultado.invalidos.map((i) => ({
            id: i.comparavel?.id ?? null,
            titulo: i.comparavel?.titulo ?? null,
            fonte: i.comparavel?.fonte ?? null,
            url_anuncio: i.comparavel?.url_anuncio ?? null,
            motivo: i.motivo,
            descricao: i.descricao,
          })),
        },
      });
    }

    setComparaveisDescartados(resultado.invalidos);

    if (resultado.totalValidos === 0) {
      throw new Error(
        "Não há imóveis de referência reais (carteira ou mercado) para este laudo. Gere a avaliação novamente antes de exportar.",
      );
    }

    if (resultado.totalInvalidos > 0) {
      toast({
        title: "Referências ajustadas",
        description: `${resultado.totalInvalidos} imóvel(is) sem correspondência real foram removidos do laudo.`,
      });
      setComparaveis(semBloqueadas(resultado.validos));
    }

    return semBloqueadas(resultado.validos);
  }, [comparaveis, selectedImovel, logSystemAction, toast, semBloqueadas]);


  /** Abre o seletor de substituição para um comparável descartado. */
  const abrirSubstituicao = useCallback(async (index: number, invalido: ComparavelInvalido) => {
    setSubstituicaoAlvo({ index, invalido });
    setBuscaCandidato("");
    setCarregandoCandidatos(true);
    try {
      const reais = await buscarComparaveis();
      const usados = new Set((comparaveis || []).map((c) => String(c.id)));
      setCandidatosSubstituicao(
        (reais || []).filter(
          (c) => !usados.has(String(c.id)) && (c.preco || 0) > 0 && (c.area || 0) > 0,
        ),
      );
    } catch {
      setCandidatosSubstituicao([]);
      toast({
        title: "Não foi possível carregar candidatos",
        description: "Tente novamente em instantes.",
        variant: "destructive",
      });
    } finally {
      setCarregandoCandidatos(false);
    }
  }, [buscarComparaveis, comparaveis, toast]);

  /** Substitui manualmente um descartado por um comparável real e recompila o laudo. */
  const confirmarSubstituicao = useCallback((substituto: Comparavel) => {
    if (!substituicaoAlvo) return;
    const { index, invalido } = substituicaoAlvo;

    setComparaveis((prev) => {
      if (prev.some((c) => String(c.id) === String(substituto.id))) return prev;
      return [...prev, substituto];
    });
    setComparaveisDescartados((prev) => prev.filter((_, i) => i !== index));
    if (!substitutosManuaisRef.current.some((c) => String(c.id) === String(substituto.id))) {
      substitutosManuaisRef.current = [...substitutosManuaisRef.current, substituto];
    }

    const registro = {
      descartado: invalido.comparavel?.titulo || String(invalido.comparavel?.id || "sem identificação"),
      motivo: invalido.motivo,
      substituto: substituto.titulo || String(substituto.id),
      fonte: substituto.fonte,
      em: new Date().toISOString(),
    };
    setSubstituicoesRealizadas((prev) => [...prev, registro]);

    logSystemAction({
      action: "comparavel-substituido-manualmente",
      message: `Referência "${registro.descartado}" substituída manualmente por "${registro.substituto}" (${registro.fonte})`,
      metadata: {
        imovel_id: selectedImovel?.id ?? null,
        descartado: {
          id: invalido.comparavel?.id ?? null,
          titulo: invalido.comparavel?.titulo ?? null,
          fonte: invalido.comparavel?.fonte ?? null,
          url_anuncio: invalido.comparavel?.url_anuncio ?? null,
          motivo: invalido.motivo,
          descricao: invalido.descricao,
        },
        substituto: {
          id: substituto.id,
          titulo: substituto.titulo,
          fonte: substituto.fonte,
          preco: substituto.preco,
          area: substituto.area,
          bairro: substituto.bairro,
          url_anuncio: substituto.url_anuncio ?? null,
        },
      },
    });

    setSubstituicaoAlvo(null);
    setCandidatosSubstituicao([]);
    toast({
      title: "Referência substituída",
      description: "O histórico ficou registrado no log. Recompile o laudo para aplicar no relatório.",
    });
  }, [substituicaoAlvo, logSystemAction, selectedImovel, toast]);

  /** Recompila o laudo com as referências ajustadas manualmente. */
  const recompilarLaudo = useCallback(async () => {
    logSystemAction({
      action: "recompilar-laudo-referencias-ajustadas",
      message: `Recompilando laudo após ${substituicoesRealizadas.length} substituição(ões) manual(is)`,
      metadata: { imovel_id: selectedImovel?.id ?? null, substituicoes: substituicoesRealizadas },
    });
    await handleAvaliar(true);
  }, [handleAvaliar, logSystemAction, selectedImovel, substituicoesRealizadas]);

  /** Persiste a preferência do modo diagnóstico (localStorage + URL, para reabrir igual). */
  useEffect(() => {
    try { localStorage.setItem("avaliacao:modo-diagnostico", modoDiagnostico ? "1" : "0"); } catch { /* ignore */ }
    try {
      const url = new URL(window.location.href);
      if (modoDiagnostico) url.searchParams.set("diag", "1");
      else url.searchParams.delete("diag");
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    } catch { /* ignore */ }
  }, [modoDiagnostico]);

  /** Registra o payload efetivamente enviado ao gerador do laudo. */
  const registrarPayloadLaudo = useCallback((origem: string, dados: any) => {
    setUltimoPayloadLaudo({ origem, em: new Date().toISOString(), dados });
    if (modoDiagnostico) {
      const diag = construirDiagnosticoLaudo({
        ...dados,
        comparaveisSelecao: amostragem.criterio === "similaridade" 
          ? aplicarAmostragem(comparaveis, selectedImovel as any, amostragem).diagnosticoSelecao
          : undefined
      });
      logSystemAction({
        action: "diagnostico-payload-laudo",
        message: `Diagnóstico do laudo (${origem}): ${diag.totais.camposMapeados} campos mapeados, ${diag.totais.camposDescartados} descartados, ${diag.totais.comparaveisUsados} referências usadas`,
        metadata: {
          origem,
          imovel_id: selectedImovel?.id ?? null,
          totais: diag.totais,
          descartados: diag.descartados.map((c) => ({ campo: c.campo, motivo: c.motivo })),
        },
      });
    }
  }, [modoDiagnostico, logSystemAction, selectedImovel]);

  /** Diagnóstico em tela: usa o último payload enviado ou o estado atual (prévia). */
  const diagnosticoLaudo = useMemo(() => {
    if (!modoDiagnostico) return null;
    if (ultimoPayloadLaudo) return construirDiagnosticoLaudo(ultimoPayloadLaudo.dados);
    const selecaoDiag = amostragem.criterio === "similaridade" 
      ? aplicarAmostragem(comparaveis, selectedImovel as any, amostragem).diagnosticoSelecao
      : undefined;

    return construirDiagnosticoLaudo({
      imovel: selectedImovel as any,
      avaliacao: avaliacao as any,
      comparaveis: comparaveis as any,
      comparaveisDescartados: comparaveisDescartados as any,
      corretorInfo: { creci, telefone, email: emailImob, nome: nome_empresa || "ImobPro", cnpj },
      brandName: nome_empresa || "ImobPro",
      logoUrl: logo_url || null,
      layout: pdfLayout,
      comparaveisSelecao: selecaoDiag,
    });
  }, [modoDiagnostico, ultimoPayloadLaudo, selectedImovel, avaliacao, comparaveis, comparaveisDescartados, creci, telefone, emailImob, nome_empresa, cnpj, logo_url, pdfLayout]);


  /** Valida se as configurações de amostragem estão consistentes antes da exportação. */
  const validarConfigAmostragem = useCallback((imovelReferencia: any) => {
    const warnings: string[] = [];
    
    // Verificar se o tamanho da amostra é maior que o disponível
    if (amostragem.tamanho > comparaveis.length && comparaveis.length > 0) {
      warnings.push(`Amostra solicitada (${amostragem.tamanho}) é maior que o total disponível (${comparaveis.length}).`);
    }

    // Verificar se filtros restritivos demais esvaziaram a lista
    const previa = aplicarAmostragem(comparaveis, imovelReferencia, amostragem);
    if (previa.selecionados.length === 0 && comparaveis.length > 0) {
      warnings.push("Os filtros atuais (bairro/tipo/área) removeram todas as referências.");
    }

    // Verificar se a tolerância de área é muito baixa
    if (amostragem.toleranciaAreaPct > 0 && amostragem.toleranciaAreaPct < 10) {
      warnings.push("Tolerância de área muito baixa (<10%) pode restringir excessivamente a amostra.");
    }

    return warnings;
  }, [amostragem, comparaveis]);

  /** Baixa o laudo no padrão antigo já com a tabela de amostragem e a seção de descartados/motivos. */
  const handleExportLaudoCompleto = async () => {
    if (!avaliacao || !selectedImovel) return;
    try {
      const comparaveisValidados = mesclarForcadas(await validarComparaveisParaLaudo());
      const extraPhotos: string[] = [
        ...uploadedPhotos,
        ...(manual.fotos_url ? manual.fotos_url.split(",").map((u) => u.trim()).filter(Boolean) : []),
      ];
      const existingFotos: string[] = Array.isArray(selectedImovel.fotos) ? selectedImovel.fotos.filter(Boolean) : [];
      const imovelWithPhotos = { ...selectedImovel, fotos: existingFotos.length > 0 ? existingFotos : extraPhotos };

      const warnings = validarConfigAmostragem(imovelWithPhotos);
      if (warnings.length > 0) {
        toast({
          title: "Aviso de consistência na amostragem",
          description: warnings.join(" "),
          variant: "destructive",
        });
      }

      const amostra = aplicarAmostragem(comparaveisValidados as any[], imovelWithPhotos, amostragem);

      const descartadosLaudo = [
        ...comparaveisDescartados.map((d) => ({
          titulo: d.comparavel?.titulo ?? null,
          motivo: d.descricao || d.motivo || null,
          fonte: (d.comparavel?.fonte as string) ?? null,
          url: (d.comparavel?.url_anuncio as string) ?? null,
        })),
        ...(comparaveisValidados as any[])
          .filter((c) => !amostra.selecionados.some((s: any) => String(s.id) === String(c.id) && s.fonte === c.fonte))
          .map((c) => ({
            titulo: c.titulo ?? null,
            motivo: "Fora da amostra configurada (filtros/tamanho da amostragem)",
            fonte: c.fonte ?? null,
            url: c.url_anuncio ?? null,
          })),
      ];

      logSystemAction({
        action: "exportar-laudo-completo",
        message: `Laudo completo exportado: ${amostra.selecionados.length} referências e ${descartadosLaudo.length} descartadas`,
        metadata: { imovel_id: selectedImovel.id, ...amostragem },
      });

      await exportAvaliacaoPDF({
        imovel: imovelWithPhotos,
        avaliacao,
        comparaveis: amostra.selecionados,
        brandName: nome_empresa || "ImobPro",
        corretorInfo: { creci, telefone, email: emailImob },

        logoUrl: logo_url || undefined,
        layout: "gamma",
        maxComparaveis: amostragem.tamanho,
        notaAmostragem: descreverAmostragem(amostragem, amostra, imovelWithPhotos),
        criteriosAmostragem: listarCriteriosAmostragem(amostragem, imovelWithPhotos),
        motivosSelecao: explicarSelecaoReferencias(amostra.selecionados, amostragem, imovelWithPhotos),
        parametrosAmostragem: parametrosAmostragemAuditoria(amostragem, amostra, imovelWithPhotos as any),
        descartados: descartadosLaudo,
      });
      toast({ title: "Laudo completo baixado", description: "Inclui tabela de amostragem e motivos dos descartes." });
    } catch (err: any) {
      toast({ title: "Erro ao baixar laudo completo", description: err?.message || "Tente novamente.", variant: "destructive" });
    }
  };

  const handleExportPDF = async () => {
    if (!avaliacao || !selectedImovel) return;
    try {
      const comparaveisValidados = mesclarForcadas(await validarComparaveisParaLaudo());

      logSystemAction({
        action: "exportar-pdf-inicio",
        message: `Iniciando exportação PDF (Layout: ${pdfLayout}) para ${selectedImovel.titulo}`,
        metadata: { layout: pdfLayout, imovel_id: selectedImovel.id }
      });

      const extraPhotos: string[] = [
        ...uploadedPhotos,
        ...(manual.fotos_url ? manual.fotos_url.split(",").map(u => u.trim()).filter(Boolean) : []),
      ];
      const existingFotos: string[] = Array.isArray(selectedImovel.fotos) ? selectedImovel.fotos.filter(Boolean) : [];
      const allFotos = existingFotos.length > 0 ? existingFotos : extraPhotos;
      
      const imovelWithPhotos = { ...selectedImovel, fotos: allFotos };

      const corretorInfoFull = { creci, telefone, email: emailImob, nome: nome_empresa || "ImobPro", cnpj };

      registrarPayloadLaudo("exportar-pdf", {
        imovel: imovelWithPhotos,
        avaliacao,
        comparaveis: comparaveisValidados,
        comparaveisDescartados,
        corretorInfo: corretorInfoFull,
        brandName: nome_empresa || "ImobPro",
        logoUrl: logo_url || null,
        layout: pdfLayout,
      });

      if (pdfLayout === "premium") {
        await exportAvaliacaoPremiumPDF({
          imovel: imovelWithPhotos,
          avaliacao,
          comparaveis: comparaveisValidados,
          brandName: nome_empresa || "ImobPro",
          corretorInfo: corretorInfoFull,
          logoUrl: logo_url || undefined,
          profilePhotoUrl: logo_url || undefined,
        });
      } else if (pdfLayout === "clean_light" || pdfLayout === "estudo_completo") {
        await exportCleanLightPDF({
          imovel: imovelWithPhotos,
          avaliacao,
          comparaveis: comparaveisValidados,
          brandName: nome_empresa || "ImobPro",
          corretorInfo: corretorInfoFull,
          logoUrl: logo_url || undefined,
          profilePhotoUrl: logo_url || undefined,
        });
      } else {
        const amostra = aplicarAmostragem(comparaveisValidados as any[], imovelWithPhotos, amostragem);
        logSystemAction({
          action: "amostragem-referencias",
          message: `Amostragem aplicada: ${amostra.selecionados.length}/${amostra.totalDisponivel} referências (${amostragem.criterio})`,
          metadata: { ...amostragem, ...{ selecionados: amostra.selecionados.length, total: amostra.totalDisponivel, removidos: amostra.removidosPorFiltro } },
        });
        await exportAvaliacaoPDF({
          imovel: imovelWithPhotos,
          avaliacao,
          comparaveis: amostra.selecionados,
          brandName: nome_empresa || "ImobPro",
          corretorInfo: corretorInfoFull,
          logoUrl: logo_url || undefined,
          layout: pdfLayout,
          maxComparaveis: amostragem.tamanho,
          notaAmostragem: descreverAmostragem(amostragem, amostra, imovelWithPhotos),
          criteriosAmostragem: listarCriteriosAmostragem(amostragem, imovelWithPhotos),
          motivosSelecao: explicarSelecaoReferencias(amostra.selecionados, amostragem, imovelWithPhotos),
        parametrosAmostragem: parametrosAmostragemAuditoria(amostragem, amostra, imovelWithPhotos as any),
          descartados: comparaveisDescartados.map((d) => ({
            titulo: d.comparavel?.titulo ?? null,
            motivo: d.descricao || d.motivo || null,
            fonte: (d.comparavel?.fonte as string) ?? null,
            url: (d.comparavel?.url_anuncio as string) ?? null,
          })),
        });
      }
      toast({ title: "PDF exportado com sucesso!" });
    } catch (err: any) {
      logSystemAction({
        action: "exportar-pdf-falha",
        level: "error",
        message: `Erro ao exportar PDF: ${err.message}`,
        metadata: { error: err, layout: pdfLayout }
      });
      toast({ title: "Erro ao exportar PDF", description: err?.message || "Erro desconhecido", variant: "destructive" });
    }
  };

  const handleSalvar = async () => {
    if (!avaliacao || !selectedImovel || !imobiliariaId) return;
    setSalvando(true);
    try {
      const { error } = await supabase.from("avaliacoes_historico" as any).insert({
        imobiliaria_id: imobiliariaId,
        titulo: selectedImovel.titulo,
        tipo: selectedImovel.tipo,
        operacao: selectedImovel.operacao,
        area: selectedImovel.area,
        quartos: selectedImovel.quartos,
        bairro: selectedImovel.bairro,
        cidade: selectedImovel.cidade,
        estado: selectedImovel.estado,
        preco_informado: selectedImovel.preco,
        valor_minimo: avaliacao.valor_minimo,
        valor_ideal: avaliacao.valor_ideal,
        valor_maximo: avaliacao.valor_maximo,
        preco_m2_estimado: avaliacao.preco_m2_estimado,
        preco_m2_regiao: avaliacao.preco_m2_regiao,
        score_liquidez: avaliacao.score_liquidez,
        classificacao_liquidez: avaliacao.classificacao_liquidez,
        analise_resumo: avaliacao.analise_resumo,
        pontos_fortes: avaliacao.pontos_fortes,
        pontos_atencao: avaliacao.pontos_atencao,
        estrategia_venda: avaliacao.estrategia_venda,
        portais_recomendados: avaliacao.portais_recomendados,
        sugestao_preco_inicial: avaliacao.sugestao_preco_inicial,
        probabilidade_venda_30dias: avaliacao.probabilidade_venda_30dias,
        probabilidade_venda_60dias: avaliacao.probabilidade_venda_60dias,
        probabilidade_venda_90dias: avaliacao.probabilidade_venda_90dias,
        preco_competitivo: avaliacao.preco_competitivo,
        imovel_id: modoManual ? null : selectedImovel.id,
        modo: modoManual ? "manual" : "carteira",
        comparaveis_count: comparaveis.length,
        descricao: descricaoParaPersistencia((selectedImovel as any).descricao),
      } as any);
      if (error) throw error;
      toast({ title: "Avaliação salva!", description: "O histórico foi atualizado com sucesso." });
      if (showHistorico) fetchHistorico();
    } catch (err: any) {
      logSystemAction({
        action: "salvar-avaliacao-falha",
        level: "error",
        message: `Erro ao salvar avaliação: ${err.message}`,
        metadata: { error: err, imovel_id: selectedImovel.id }
      });
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  };

  const fetchHistorico = async () => {
    if (!imobiliariaId) return;
    setLoadingHistorico(true);
    try {
      const { data, error } = await supabase
        .from("avaliacoes_historico" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      setHistorico(data || []);
    } catch (err: any) {
      toast({ title: "Erro ao carregar histórico", description: err.message, variant: "destructive" });
    } finally {
      setLoadingHistorico(false);
    }
  };

  const handleDeleteHistorico = async (id: string) => {
    try {
      const { error } = await supabase.from("avaliacoes_historico" as any).delete().eq("id", id);
      if (error) throw error;
      setHistorico((prev) => prev.filter((h) => h.id !== id));
      toast({ title: "Avaliação removida do histórico." });
    } catch (err: any) {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    }
  };

  const handleLoadFromHistorico = (item: any) => {
    setAvaliacao({
      valor_minimo: item.valor_minimo,
      valor_ideal: item.valor_ideal,
      valor_maximo: item.valor_maximo,
      preco_m2_estimado: item.preco_m2_estimado,
      preco_m2_regiao: item.preco_m2_regiao,
      score_liquidez: item.score_liquidez,
      classificacao_liquidez: item.classificacao_liquidez || "media",
      probabilidade_venda_30dias: item.probabilidade_venda_30dias || 0,
      probabilidade_venda_60dias: item.probabilidade_venda_60dias || 0,
      probabilidade_venda_90dias: item.probabilidade_venda_90dias || 0,
      preco_competitivo: item.preco_competitivo || false,
      analise_resumo: item.analise_resumo || "",
      pontos_fortes: Array.isArray(item.pontos_fortes) ? item.pontos_fortes : [],
      pontos_atencao: Array.isArray(item.pontos_atencao) ? item.pontos_atencao : [],
      estrategia_venda: item.estrategia_venda || "",
      portais_recomendados: Array.isArray(item.portais_recomendados) ? item.portais_recomendados : [],
      sugestao_preco_inicial: item.sugestao_preco_inicial || 0,
    });
    setEditingHistoricoId(null);
    setModoManual(true);
    setManual({
      ...createEmptyManualState(),
      titulo: item.titulo || "", tipo: item.tipo || "Apartamento", operacao: item.operacao || "Venda",
      area: String(item.area || ""), quartos: String(item.quartos || ""), suites: "",
      banheiros: "", vagas: "", bairro: item.bairro || "", cidade: item.cidade || "",
      estado: item.estado || "DF", cep: item.cep || "", endereco: item.endereco || "", preco: String(item.preco_informado || ""),
      valor_condominio: "", valor_iptu: "", andar: "", posicao_solar: "",
      exclusivo: false, aceita_permuta: false, aceita_financiamento: false, tem_escritura: false,
      corretor_nome: "", corretor_creci: "", link_imovel: "", fotos_url: "", descricao: descricaoParaFormulario(item.descricao),
    });
    setComparaveis([]);
    setShowHistorico(false);
    toast({ title: "Avaliação carregada do histórico." });
  };

  const handleEditHistorico = (item: any) => {
    handleLoadFromHistorico(item);
    setEditingHistoricoId(item.id);
    setEditMode(true);
    toast({ title: "Modo edição ativado", description: "Edite os valores e clique em 'Salvar Alterações'." });
  };

  const handleUpdateHistorico = async () => {
    if (!avaliacao || !editingHistoricoId || !selectedImovel) return;
    setSalvando(true);
    try {
      const { error } = await supabase.from("avaliacoes_historico" as any).update({
        titulo: selectedImovel.titulo,
        tipo: selectedImovel.tipo,
        operacao: selectedImovel.operacao,
        area: selectedImovel.area,
        quartos: selectedImovel.quartos,
        bairro: selectedImovel.bairro,
        cidade: selectedImovel.cidade,
        estado: selectedImovel.estado,
        preco_informado: selectedImovel.preco,
        valor_minimo: avaliacao.valor_minimo,
        valor_ideal: avaliacao.valor_ideal,
        valor_maximo: avaliacao.valor_maximo,
        preco_m2_estimado: avaliacao.preco_m2_estimado,
        preco_m2_regiao: avaliacao.preco_m2_regiao,
        score_liquidez: avaliacao.score_liquidez,
        classificacao_liquidez: avaliacao.classificacao_liquidez,
        analise_resumo: avaliacao.analise_resumo,
        pontos_fortes: avaliacao.pontos_fortes,
        pontos_atencao: avaliacao.pontos_atencao,
        estrategia_venda: avaliacao.estrategia_venda,
        portais_recomendados: avaliacao.portais_recomendados,
        sugestao_preco_inicial: avaliacao.sugestao_preco_inicial,
        probabilidade_venda_30dias: avaliacao.probabilidade_venda_30dias,
        probabilidade_venda_60dias: avaliacao.probabilidade_venda_60dias,
        probabilidade_venda_90dias: avaliacao.probabilidade_venda_90dias,
        preco_competitivo: avaliacao.preco_competitivo,
        descricao: descricaoParaPersistencia((selectedImovel as any).descricao),
      } as any).eq("id", editingHistoricoId);
      if (error) throw error;
      toast({ title: "Avaliação atualizada!", description: "As alterações foram salvas com sucesso." });
      setEditingHistoricoId(null);
      if (showHistorico) fetchHistorico();
    } catch (err: any) {
      toast({ title: "Erro ao atualizar", description: err.message, variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  };

  const handleShare = async () => {
    if (!avaliacao || !selectedImovel) return;
    try {
      const comparaveisValidados = mesclarForcadas(await validarComparaveisParaLaudo());
      const corretorInfoFull = { creci, telefone, email: emailImob, nome: nome_empresa || "ImobPro", cnpj };
      registrarPayloadLaudo("compartilhar-pdf", {
        imovel: selectedImovel,
        avaliacao,
        comparaveis: comparaveisValidados,
        comparaveisDescartados,
        corretorInfo: corretorInfoFull,
        brandName: nome_empresa || "ImobPro",
        logoUrl: logo_url || null,
        layout: "premium",
      });
      
      if (pdfLayout === "premium") {
        const selecaoPremium = aplicarAmostragem(comparaveisValidados as any[], selectedImovel, amostragem);
        await shareAvaliacaoPremiumPDF({
          imovel: selectedImovel,
          avaliacao,
          comparaveis: selecaoPremium.selecionados,
          brandName: nome_empresa || "ImobPro",
          corretorInfo: corretorInfoFull,
          logoUrl: logo_url || undefined,
          profilePhotoUrl: logo_url || undefined,
          parametrosAmostragem: parametrosAmostragemAuditoria(amostragem, selecaoPremium, selectedImovel as any),
        });
      } else if (pdfLayout === "clean_light" || pdfLayout === "estudo_completo") {
        await shareCleanLightPDF({
          imovel: selectedImovel,
          avaliacao,
          comparaveis: comparaveisValidados,
          brandName: nome_empresa || "ImobPro",
          corretorInfo: corretorInfoFull,
          logoUrl: logo_url || undefined,
          profilePhotoUrl: logo_url || undefined,
        });
      } else {
        const amostraShare = aplicarAmostragem(comparaveisValidados as any[], selectedImovel, amostragem);
        await shareAvaliacaoPDF({
          imovel: selectedImovel,
          avaliacao,
          comparaveis: amostraShare.selecionados,
          brandName: nome_empresa || "ImobPro",
          corretorInfo: corretorInfoFull,
          logoUrl: logo_url || undefined,
          layout: "premium",
          maxComparaveis: amostragem.tamanho,
          notaAmostragem: descreverAmostragem(amostragem, amostraShare, selectedImovel),
          criteriosAmostragem: listarCriteriosAmostragem(amostragem, selectedImovel as any),
          motivosSelecao: explicarSelecaoReferencias(amostraShare.selecionados, amostragem, selectedImovel as any),
        parametrosAmostragem: parametrosAmostragemAuditoria(amostragem, amostraShare, selectedImovel as any),
        });
      }
      toast({ title: "PDF compartilhado com sucesso!" });
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      console.error("Erro ao compartilhar PDF:", err);
      toast({ title: "Erro ao compartilhar", description: err?.message || "Erro desconhecido", variant: "destructive" });
    }
  };

  const getLiquidezIcon = (cls: string) => {
    if (cls === "alta") return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    if (cls === "media") return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
    return <XCircle className="w-5 h-5 text-red-500" />;
  };

  const getLiquidezColor = (cls: string) => {
    if (cls === "alta") return "text-green-500";
    if (cls === "media") return "text-yellow-500";
    return "text-red-500";
  };

  /** Prévia da amostragem exibida no painel do padrão antigo (antes de gerar o PDF). */
  const previaAmostragem = useMemo(() => {
    if (!selectedImovel || comparaveis.length === 0) return null;
    try {
      const base = mesclarForcadas(comparaveis) as any[];
      const amostra = aplicarAmostragem(base, selectedImovel as any, amostragem);
      const motivos = explicarSelecaoReferencias(amostra.selecionados, amostragem, selectedImovel as any);
      return { amostra, motivos };
    } catch {
      return null;
    }
  }, [comparaveis, selectedImovel, amostragem, referenciasForcadas]);

  return (

    <DashboardLayout>
      <div className="space-y-6" data-component="avaliacao-page">

        {redirectPendente && (
          <div className="flex flex-col gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 sm:flex-row sm:items-start">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1 text-sm">
              <p className="font-semibold text-foreground">Antes de redirecionar</p>
              <p className="text-muted-foreground mt-1">
                A avaliação por link foi descontinuada. Você pode revisar o anúncio de origem
                antes de continuar para o modo{" "}
                <strong>{redirectPendente.destino === "carteira" ? "Carteira" : "Manual (SAS)"}</strong>.
              </p>
              {redirectPendente.url && (
                <p className="text-xs text-muted-foreground mt-1 break-all">{redirectPendente.url}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {redirectPendente.url && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => {
                      window.open(redirectPendente.url, "_blank", "noopener,noreferrer");
                      logSystemAction({
                        action: "avaliacao-link-revisao-origem",
                        level: "info",
                        message: "Usuário revisou o link de origem antes do redirecionamento",
                        metadata: { url: redirectPendente.url },
                      });
                    }}
                  >
                    <ExternalLink className="w-4 h-4" />
                    Revisar no modo de origem
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={() => confirmarRedirectLink(redirectPendente.destino, redirectPendente.url)}
                >
                  Continuar para {redirectPendente.destino === "carteira" ? "Carteira" : "Manual (SAS)"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {avisoLinkDescontinuado && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1 text-sm">
              <p className="font-semibold text-foreground">Avaliação por link foi descontinuada</p>
              <p className="text-muted-foreground mt-1">
                Para garantir laudos com comparáveis reais, agora a avaliação é feita pela{" "}
                <strong>Carteira</strong> ou pelo <strong>Formulário Manual (SAS)</strong>. Você foi
                redirecionado para o modo{" "}
                <strong>{avisoLinkDescontinuado === "carteira" ? "Carteira" : "Manual (SAS)"}</strong>.
              </p>
              <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2">
                <span className="text-xs text-muted-foreground">Sempre me redirecionar para:</span>
                <Select
                  value={preferenciaRedirecionoLink}
                  onValueChange={(v) => {
                    const pref = v as "auto" | "carteira" | "manual";
                    setPreferenciaRedirecionoLink(pref);
                    try { localStorage.setItem("avaliacao:preferencia-redirect-link", pref); } catch { /* ignore */ }
                    const destino = pref === "auto" ? ((imoveis || []).length > 0 ? "carteira" : "manual") : pref;
                    setModoLink(false);
                    setModoManual(destino === "manual");
                    setAvisoLinkDescontinuado(destino);
                    toast({
                      title: "Preferência salva",
                      description: pref === "auto"
                        ? "Escolha automática (Carteira se houver imóveis)."
                        : `Sempre ${pref === "carteira" ? "Carteira" : "Manual (SAS)"}.`,
                    });
                  }}
                >
                  <SelectTrigger className="h-8 w-full sm:w-56 bg-background text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Automático (recomendado)</SelectItem>
                    <SelectItem value="carteira">Sempre Carteira</SelectItem>
                    <SelectItem value="manual">Sempre Manual (SAS)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setAvisoLinkDescontinuado(null)}>
              Entendi
            </Button>
          </div>
        )}



        {/* Header */}

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex flex-col gap-2 self-start">
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Calculator className="w-6 h-6 text-primary" />
                Avaliação Imobiliária
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => setResetDialogOpen(true)}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Resetar configurações iniciais</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Análise inteligente de valor com IA e comparativos de mercado
              </p>
              <Badge
                variant="outline"
                className="mt-2 w-fit font-mono text-[10px] gap-1 cursor-pointer hover:bg-muted"
                title="Clique para copiar o carimbo de build"
                onClick={() => {
                  navigator.clipboard.writeText(__BUILD_STAMP__).catch(() => {});
                  toast({ title: "Carimbo de build copiado", description: __BUILD_STAMP__ });
                }}
              >
                build: {__BUILD_STAMP__}
              </Badge>

            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="gap-2" asChild>
              <a href="/diagnostico-avaliacao">
                <Bug className="w-4 h-4 text-destructive" /> Diagnóstico
              </a>
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => { setShowHistorico(!showHistorico); if (!showHistorico) { fetchHistorico(); setAvaliacao(null); } }}>
              <History className="w-4 h-4" /> {showHistorico ? "Fechar Histórico" : "Ver Histórico"}
            </Button>
          </div>

        </div>

        {/* Banner limite trial/solo */}
        {isLimitedUser && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <div className="text-sm">
              {limiteAtingido ? (
                <span className="text-amber-700 dark:text-amber-400 font-medium">
                  {inTrial
                    ? "Você já utilizou sua avaliação com IA do período de teste. Faça upgrade para o plano PRO para avaliações ilimitadas."
                    : "Limite de avaliações atingido. Faça upgrade para o plano PRO para avaliações ilimitadas."}
                </span>
              ) : (
                <span className="text-amber-700 dark:text-amber-400">
                  {inTrial
                    ? <>Período de teste: <strong>{LIMITE_AVALIACOES - (avaliacoesUsadas ?? 0)}</strong> avaliação com IA disponível. Aproveite para conhecer o poder dessa funcionalidade!</>
                    : <>Plano Corretor Solo: <strong>{LIMITE_AVALIACOES - (avaliacoesUsadas ?? 0)}</strong> avaliação com IA restante neste mês. Upgrade para PRO!</>}
                </span>
              )}
            </div>
          </div>
        )}

        <Card className="bg-card border-border">
          <CardContent className="pt-6 space-y-4">
            <div className="flex gap-2 flex-wrap">
              <Button variant={!modoManual && !modoLink ? "default" : "outline"} size="sm" onClick={() => { setModoManual(false); setModoLink(false); setDadosExtraidos(null); }} className="gap-2">
                <ListFilter className="w-4 h-4" /> Selecionar da Carteira
              </Button>
              <Button variant={modoManual && !modoLink ? "default" : "outline"} size="sm" onClick={() => { setModoManual(true); setModoLink(false); setDadosExtraidos(null); }} className="gap-2">
                <Sparkles className="w-4 h-4" /> Avaliação Manual (SAS)
              </Button>
            </div>

              <Button variant={modoLink ? "default" : "outline"} size="sm" onClick={() => { setModoLink(true); setModoManual(false); setDadosExtraidos(null); }} className="gap-2">
                <Link2 className="w-4 h-4" /> Avaliação via Link
              </Button>

            {modoLink ? (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3 items-end">
                  <div className="flex-1 w-full">
                    <Label className="text-xs font-medium">Cole o link do anúncio do imóvel</Label>
                    <Input
                      placeholder="https://www.olx.com.br/..., https://www.zapimoveis.com.br/..., etc."
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      className="bg-secondary"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Suporta links de OLX, ZAP, VivaReal, DFImóveis, WImóveis, Mercado Livre e outros portais
                    </p>
                  </div>
                  <Button onClick={() => handleExtrairLink()} disabled={extraindo || !linkUrl.trim()} className="gap-2 whitespace-nowrap">
                    {extraindo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {extraindo ? "Extraindo..." : "Extrair Dados"}
                  </Button>
                </div>

                {linksDetectados.length > 0 && (
                  <div className="rounded-lg border border-border bg-secondary/40 p-4 space-y-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-foreground">Esse link contém vários anúncios.</p>
                        <p className="text-xs text-muted-foreground">Selecione o imóvel correto para preencher automaticamente os dados da avaliação.</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {linksDetectados.map((url, index) => (
                        <div key={url} className="flex flex-col gap-2 rounded-lg border border-border bg-background/90 p-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-foreground">Anúncio {index + 1}</p>
                            <a
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-muted-foreground break-all hover:text-foreground transition-colors"
                            >
                              {url}
                              <ExternalLink className="w-3 h-3 shrink-0" />
                            </a>
                          </div>

                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleExtrairLinkDetectado(url)}
                            disabled={extraindo}
                            className="gap-2"
                          >
                            {extraindo && linkDetectadoAtivo === url ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                            {extraindo && linkDetectadoAtivo === url ? "Extraindo..." : "Usar este"}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}


                {dadosExtraidos && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="font-medium">Dados extraídos com sucesso! Revise abaixo e clique em "Avaliar com IA"</span>
                    </div>

                    {missingFieldsWarning.length > 0 && (
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900 p-3">
                        <div className="text-xs text-amber-800 dark:text-amber-200">
                          <span className="font-semibold">Campos faltantes:</span>{" "}
                          {missingFieldsWarning.slice(0, 5).join(", ")}
                          {missingFieldsWarning.length > 5 ? "…" : ""}
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={reextraindoParciais}
                          onClick={reextrairCamposFaltantes}
                          className="gap-2 border-amber-300 text-amber-900 hover:bg-amber-100 dark:text-amber-100 dark:hover:bg-amber-900/40"
                        >
                          {reextraindoParciais ? (
                            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Reextraindo…</>
                          ) : (
                            <><Sparkles className="w-3.5 h-3.5" /> Reextrair só os faltantes</>
                          )}
                        </Button>
                      </div>
                    )}

                    {/* Show extracted photos */}
                    {dadosExtraidos?.fotos && dadosExtraidos.fotos.length > 0 && (
                      <div>
                        <Label className="text-xs font-medium mb-1 block">Fotos extraídas ({dadosExtraidos.fotos.length})</Label>
                        <div className="flex gap-2 flex-wrap">
                          {dadosExtraidos.fotos.slice(0, 8).map((foto: string, i: number) => (
                            <img key={i} src={foto} alt={`Foto ${i + 1}`} className="w-20 h-20 rounded-lg object-cover border border-border" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Show extracted features */}
                    {dadosExtraidos?.caracteristicas && dadosExtraidos.caracteristicas.length > 0 && (
                      <div>
                        <Label className="text-xs font-medium mb-1 block">Características identificadas</Label>
                        <div className="flex gap-1.5 flex-wrap">
                          {dadosExtraidos.caracteristicas.map((c: string, i: number) => (
                            <Badge key={i} variant="secondary" className="text-xs">{c}</Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {dadosExtraidos.descricao && (
                      <div>
                        <Label className="text-xs font-medium mb-1 block">Descrição extraída</Label>
                        <p className="text-xs text-muted-foreground bg-secondary/50 p-3 rounded-lg border border-border max-h-24 overflow-y-auto">
                          {dadosExtraidos.descricao}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Fallback consistente quando a extração de fotos falhou/foi bloqueada */}
                {dadosExtraidos && (!Array.isArray(dadosExtraidos.fotos) || dadosExtraidos.fotos.length === 0) && (
                  <div className="rounded-lg border-2 border-dashed border-amber-400/50 bg-amber-50 dark:bg-amber-950/20 p-3 space-y-1">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <p className="text-xs font-medium text-amber-900 dark:text-amber-100">
                          Nenhuma foto foi extraída automaticamente
                        </p>
                        <p className="text-[11px] text-amber-800 dark:text-amber-300">
                          {photoExtractionInfo?.blocked
                            ? "O portal bloqueou a coleta (proteção anti-bot). Anexe as fotos manualmente abaixo para enriquecer o laudo."
                            : "O anúncio não expôs as imagens publicamente. Anexe as fotos manualmente abaixo para enriquecer o laudo."}
                        </p>
                        {photoExtractionInfo?.strategy_stats && (
                          <p className="text-[10px] text-amber-700 dark:text-amber-400 font-mono">
                            Estratégias tentadas: {Object.entries(photoExtractionInfo.strategy_stats).map(([k, v]) => `${k}=${v}`).join(" · ")}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Upload de fotos */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium flex items-center gap-1.5">
                    <ImagePlus className="w-3.5 h-3.5" />
                    Adicionar fotos do imóvel
                  </Label>
                  <div className="flex items-center gap-3">
                    <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-md border border-dashed border-border bg-secondary/50 hover:bg-secondary transition-colors text-sm text-muted-foreground">
                      <ImagePlus className="w-4 h-4" />
                      {uploadingPhotos ? "Enviando..." : "Selecionar fotos"}
                      <input
                        type="file"
                        accept={PHOTO_ACCEPT_VALUE}
                        multiple
                        className="hidden"
                        onChange={handlePhotoUpload}
                        disabled={uploadingPhotos}
                      />
                    </label>
                    {uploadingPhotos && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                  </div>
                  {uploadedPhotos.length > 0 && (
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">Fotos enviadas ({uploadedPhotos.length})</Label>
                      <div className="flex gap-2 flex-wrap">
                        {uploadedPhotos.map((url, i) => (
                          <div key={i} className="relative group">
                            <img src={url} alt={`Upload ${i + 1}`} className="w-20 h-20 rounded-lg object-cover border border-border" />
                            <button
                              onClick={() => handleRemoveUploadedPhoto(i)}
                              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Descrição específica do imóvel para avaliação (modo link) */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium flex items-center justify-between gap-2">
                    <span>Descrição do imóvel (para a avaliação)</span>
                    <span className={`text-[11px] tabular-nums ${contadorEmAlerta(manual.descricao) ? "text-destructive" : "text-muted-foreground"}`}>
                      {formatarContador(manual.descricao)}
                    </span>
                  </Label>
                  <Textarea
                    id={DESCRICAO_TEXTAREA_ID}
                    value={manual.descricao}
                    onChange={(e) => {
                      const next = truncarDescricao(e.target.value);
                      setManual({ ...manual, descricao: next });
                      if (descricaoErro) {
                        const v = validarDescricaoAvaliacao(next);
                        setDescricaoErro(v.valid ? null : v.erro);
                      }
                    }}
                    onBlur={() => {
                      if (!descricaoErro) return;
                      // Mantém o foco até o usuário corrigir a descrição.
                      requestAnimationFrame(() => {
                        const el = document.getElementById(DESCRICAO_TEXTAREA_ID) as HTMLTextAreaElement | null;
                        el?.focus({ preventScroll: true });
                      });
                    }}
                    placeholder="Descreva o imóvel: acabamento, reformas, vista, diferenciais, posição, entorno, condomínio…"
                    rows={4}
                    aria-invalid={!!descricaoErro}
                    className={`bg-secondary resize-y min-h-[100px] leading-relaxed ${descricaoErro ? "border-destructive focus-visible:ring-destructive" : ""}`}
                  />
                  {descricaoErro ? (
                    <p className="text-[11px] text-destructive flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {descricaoErro}
                    </p>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">
                      Quanto mais detalhes, mais precisa fica a avaliação da IA (mínimo {DESCRICAO_MIN} caracteres).
                    </p>
                  )}
                </div>


                {/* Formulário editável para avaliação por link */}
                <>
                  <Separator />
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Dados do Imóvel (edite se necessário)</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <Label className="text-xs">Título</Label>
                      <Input value={manual.titulo} onChange={(e) => setManual({ ...manual, titulo: e.target.value })} className="bg-secondary" />
                    </div>
                    <div>
                      <Label className="text-xs">Tipo</Label>
                      <Select value={manual.tipo} onValueChange={(v) => setManual({ ...manual, tipo: v })}>
                        <SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["Apartamento", "Casa", "Terreno", "Comercial", "Cobertura", "Kitnet", "Sala", "Loja", "Galpão", "Prédio", "Sobrado"].map(t => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Operação</Label>
                      <Select value={manual.operacao} onValueChange={(v) => setManual({ ...manual, operacao: v })}>
                        <SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Venda">Venda</SelectItem>
                          <SelectItem value="Aluguel">Aluguel</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Área (m²)</Label>
                      <Input type="number" value={manual.area} onChange={(e) => setManual({ ...manual, area: e.target.value })} className="bg-secondary" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <Label className="text-xs">Quartos</Label>
                      <Input type="number" value={manual.quartos} onChange={(e) => setManual({ ...manual, quartos: e.target.value })} className="bg-secondary" />
                    </div>
                    <div>
                      <Label className="text-xs">Bairro</Label>
                      <Input value={manual.bairro} onChange={(e) => setManual({ ...manual, bairro: e.target.value })} className="bg-secondary" />
                    </div>
                    <div>
                      <Label className="text-xs">Cidade</Label>
                      <Input value={manual.cidade} onChange={(e) => setManual({ ...manual, cidade: e.target.value })} className="bg-secondary" />
                    </div>
                    <div>
                      <Label className="text-xs">Preço (R$)</Label>
                      <Input type="number" value={manual.preco} onChange={(e) => setManual({ ...manual, preco: e.target.value })} className="bg-secondary" />
                    </div>
                  </div>
                  <div className="flex justify-end">
                      <Button onClick={() => handleAvaliar()} disabled={avaliando || !manualAreaFilled || limiteAtingido} className="gap-2">
                      {avaliando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      {limiteAtingido ? "Limite atingido" : avaliando ? "Avaliando..." : "Avaliar com IA"}
                    </Button>
                  </div>
                </>
              </div>
            ) : !modoManual ? (
              <div className="flex flex-col sm:flex-row gap-3 items-end">
                <div className="flex-1 w-full">
                  <label className="text-sm font-medium text-foreground mb-1 block">Selecione um imóvel da carteira</label>
                  <Select value={selectedImovelId} onValueChange={setSelectedImovelId}>
                    <SelectTrigger className="bg-secondary border-border">
                      <SelectValue placeholder="Escolha um imóvel para avaliar..." />
                    </SelectTrigger>
                    <SelectContent>
                      {imoveisAtivos.map((im) => (
                        <SelectItem key={im.id} value={im.id}>
                          {im.titulo} — {im.bairro || im.cidade || "Sem localização"} — {formatBRL(im.preco)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={() => handleAvaliar()} disabled={!selectedImovelId || avaliando || limiteAtingido} className="gap-2">

                  {avaliando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {limiteAtingido ? "Limite atingido" : avaliando ? "Avaliando..." : "Avaliar com IA"}
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                <details open className="rounded-lg border-2 border-primary/40 bg-gradient-to-br from-primary/5 to-transparent p-4 group">
                  <summary className="cursor-pointer font-semibold flex items-center gap-2 text-sm">
                    <Sparkles className="w-4 h-4 text-primary" />
                    Wizard Profissional NBR 14.653 — pesquisa, homogeneização, IA e laudo PDF
                    <Badge className="ml-2">NOVO</Badge>
                    <span className="ml-auto text-xs text-muted-foreground group-open:hidden">Expandir</span>
                    <span className="ml-auto text-xs text-muted-foreground hidden group-open:inline">Recolher</span>
                  </summary>
                  <div className="mt-4">
                    <SasWizard />
                  </div>
                </details>

                <details className="rounded-lg border bg-muted/30 p-4 group">
                  <summary className="cursor-pointer font-semibold flex items-center gap-2 text-sm">
                    <Sparkles className="w-4 h-4 text-primary" />
                    Formulário Completo SAS — preenchimento guiado (modo clássico)
                    <span className="ml-auto text-xs text-muted-foreground group-open:hidden">Expandir</span>
                    <span className="ml-auto text-xs text-muted-foreground hidden group-open:inline">Recolher</span>
                  </summary>
                  <div className="mt-4">
                    <SasAvaliacaoForm
                      onForcadasChange={handleForcadasChange}
                      onSubmit={(data: SasFormData) => {
                        const area = data.area_privativa || data.area_construida || data.area_total || data.area_terreno;
                        setManual({
                          ...createEmptyManualState(),
                          titulo: data.codigo ? `${data.tipo} ${data.codigo}` : `${data.tipo} em ${data.bairro}`,
                          tipo: data.tipo,
                          operacao: data.operacao.includes("Locação") && !data.operacao.includes("Venda") ? "Locação" : "Venda",
                          area,
                          quartos: data.quartos,
                          suites: data.suites,
                          banheiros: data.banheiros,
                          vagas: data.vagas,
                          bairro: data.bairro,
                          cidade: data.cidade,
                          estado: data.estado,
                          preco: data.preco,
                          valor_condominio: data.valor_condominio,
                          valor_iptu: data.valor_iptu,
                          andar: data.andar,
                          posicao_solar: data.posicao_solar,
                          corretor_nome: data.corretor_nome,
                          corretor_creci: data.corretor_creci,
                          cep: data.cep,
                          endereco: [data.endereco, data.numero, data.complemento].filter(Boolean).join(", "),
                          proprietario: data.proprietario,
                          data_avaliacao: data.data_avaliacao,
                          latitude: data.latitude,
                          longitude: data.longitude,
                          lavabos: data.lavabos,
                          ano_construcao: data.ano_construcao,
                          estado_conservacao: data.estado_conservacao,
                          valor_taxa_extra: data.valor_taxa_extra,
                          taxa_extra_descricao: data.taxa_extra_descricao,
                          elevador: data.elevador,
                          vista_livre: data.vista_livre,
                          vista_permanente: data.vista_permanente,
                          mobiliado: data.mobiliado,
                          reformado: data.reformado,
                          descricao: data.descricao,
                        });
                        toast({ title: "Dados aplicados", description: "Revise abaixo e clique em Avaliar com IA." });
                      }}
                    />
                  </div>
                </details>

                <div className="space-y-4">

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <Label className="text-xs">Título / Descrição</Label>
                    <Input placeholder="Ex: Apt 3Q Águas Claras" value={manual.titulo} onChange={(e) => setManual({ ...manual, titulo: e.target.value })} className="bg-secondary" />
                  </div>
                  <div>
                    <Label className="text-xs">Tipo</Label>
                    <Select value={manual.tipo} onValueChange={(v) => setManual({ ...manual, tipo: v })}>
                      <SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["Apartamento", "Casa", "Terreno", "Comercial", "Cobertura", "Kitnet", "Sala", "Loja", "Galpão", "Prédio"].map(t => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Operação</Label>
                    <Select value={manual.operacao} onValueChange={(v) => setManual({ ...manual, operacao: v })}>
                      <SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Venda">Venda</SelectItem>
                        <SelectItem value="Aluguel">Aluguel</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Área (m²) *</Label>
                    <Input 
                      type="number" 
                      placeholder="80" 
                      value={manual.area} 
                      onChange={(e) => setManual({ ...manual, area: e.target.value })} 
                      className="bg-secondary" 
                    />
                  </div>


                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <Label className="text-xs">Quartos</Label>
                    <Input type="number" placeholder="3" value={manual.quartos} onChange={(e) => setManual({ ...manual, quartos: e.target.value })} className="bg-secondary" />
                  </div>
                  <div>
                    <Label className="text-xs">Suítes</Label>
                    <Input type="number" placeholder="1" value={manual.suites} onChange={(e) => setManual({ ...manual, suites: e.target.value })} className="bg-secondary" />
                  </div>
                  <div>
                    <Label className="text-xs">Banheiros</Label>
                    <Input type="number" placeholder="2" value={manual.banheiros} onChange={(e) => setManual({ ...manual, banheiros: e.target.value })} className="bg-secondary" />
                  </div>
                  <div>
                    <Label className="text-xs">Vagas</Label>
                    <Input type="number" placeholder="2" value={manual.vagas} onChange={(e) => setManual({ ...manual, vagas: e.target.value })} className="bg-secondary" />
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <Label className="text-xs">Bairro</Label>
                    <Input 
                      placeholder="Águas Claras" 
                      value={manual.bairro} 
                      onChange={(e) => setManual({ ...manual, bairro: e.target.value })} 
                      className="bg-secondary" 
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Cidade</Label>
                    <Input 
                      placeholder="Brasília" 
                      value={manual.cidade} 
                      onChange={(e) => setManual({ ...manual, cidade: e.target.value })} 
                      className="bg-secondary" 
                    />
                  </div>


                  <div>
                    <Label className="text-xs">Estado</Label>
                    <Input placeholder="DF" value={manual.estado} onChange={(e) => setManual({ ...manual, estado: e.target.value })} className="bg-secondary" />
                  </div>
                  <div>
                    <Label className="text-xs">Preço pretendido (R$)</Label>
                    <Input 
                      type="number" 
                      placeholder="500000" 
                      value={manual.preco} 
                      onChange={(e) => setManual({ ...manual, preco: e.target.value })} 
                      className="bg-secondary" 
                    />
                  </div>


                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <Label className="text-xs">Condomínio (R$)</Label>
                    <Input type="number" placeholder="800" value={manual.valor_condominio} onChange={(e) => setManual({ ...manual, valor_condominio: e.target.value })} className="bg-secondary" />
                  </div>
                  <div>
                    <Label className="text-xs">IPTU (R$)</Label>
                    <Input type="number" placeholder="300" value={manual.valor_iptu} onChange={(e) => setManual({ ...manual, valor_iptu: e.target.value })} className="bg-secondary" />
                  </div>
                  <div>
                    <Label className="text-xs">Andar</Label>
                    <Input placeholder="8º" value={manual.andar} onChange={(e) => setManual({ ...manual, andar: e.target.value })} className="bg-secondary" />
                  </div>
                  <div>
                    <Label className="text-xs">Posição Solar</Label>
                    <Input placeholder="Nascente" value={manual.posicao_solar} onChange={(e) => setManual({ ...manual, posicao_solar: e.target.value })} className="bg-secondary" />
                  </div>
                </div>
                {/* Dados do Corretor/Imobiliária */}
                <Separator className="my-2" />
                <p className="text-xs font-semibold text-muted-foreground uppercase">Dados do Corretor / Imobiliária</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <Label className="text-xs">Nome do Corretor</Label>
                    <Input placeholder="Ex: João Silva" value={manual.corretor_nome} onChange={(e) => setManual({ ...manual, corretor_nome: e.target.value })} className="bg-secondary" />
                  </div>
                  <div>
                    <Label className="text-xs">CRECI</Label>
                    <Input placeholder="Ex: 12345-F" value={manual.corretor_creci} onChange={(e) => setManual({ ...manual, corretor_creci: e.target.value })} className="bg-secondary" />
                  </div>
                  <div>
                    <Label className="text-xs">Link do Imóvel</Label>
                    <Input placeholder="https://..." value={manual.link_imovel} onChange={(e) => setManual({ ...manual, link_imovel: e.target.value })} className="bg-secondary" />
                  </div>
                  <div>
                    <Label className="text-xs">URLs de Fotos (separadas por vírgula)</Label>
                    <Input placeholder="https://foto1.jpg, https://foto2.jpg" value={manual.fotos_url} onChange={(e) => setManual({ ...manual, fotos_url: e.target.value })} className="bg-secondary" />
                  </div>
                </div>
                {manual.link_imovel && (
                  <a href={manual.link_imovel} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                    <ExternalLink className="w-3 h-3" /> Abrir link do imóvel
                  </a>
                )}
                {manual.fotos_url && (
                  <div className="flex gap-2 flex-wrap">
                    {manual.fotos_url.split(",").filter(u => u.trim()).map((url, i) => (
                      <img key={i} src={url.trim()} alt={`Foto ${i + 1}`} className="w-20 h-20 rounded-lg object-cover border border-border" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-4">
                  {[
                    { key: "exclusivo", label: "Exclusivo" },
                    { key: "aceita_permuta", label: "Aceita Permuta" },
                    { key: "aceita_financiamento", label: "Aceita Financiamento" },
                    { key: "tem_escritura", label: "Tem Escritura" },
                  ].map(({ key, label }) => (
                    <div key={key} className="flex items-center gap-2">
                      <Checkbox
                        id={`manual-${key}`}
                        checked={(manual as any)[key]}
                        onCheckedChange={(v) => setManual({ ...manual, [key]: !!v })}
                      />
                      <Label htmlFor={`manual-${key}`} className="text-xs cursor-pointer">{label}</Label>
                    </div>
                  ))}
                </div>

                {/* Upload de fotos no modo manual */}
                <Separator className="my-2" />
                <div className="space-y-2">
                  <Label className="text-xs font-medium flex items-center gap-1.5">
                    <ImagePlus className="w-3.5 h-3.5" />
                    Adicionar fotos do imóvel
                  </Label>


                  <div className="flex items-center gap-3">
                    <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-md border border-dashed border-border bg-secondary/50 hover:bg-secondary transition-colors text-sm text-muted-foreground">
                      <ImagePlus className="w-4 h-4" />
                      {uploadingPhotos ? "Enviando..." : "Selecionar fotos"}
                      <input
                        type="file"
                        accept={PHOTO_ACCEPT_VALUE}
                        multiple
                        className="hidden"
                        onChange={handlePhotoUpload}
                        disabled={uploadingPhotos}
                      />
                    </label>
                    {uploadingPhotos && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                  </div>
                  {uploadedPhotos.length > 0 && uploadedPhotos.length < 4 && (
                    <div className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Recomendado: pelo menos 4 fotos para uma avaliação mais precisa ({uploadedPhotos.length}/4).
                    </div>
                  )}
                  {uploadedPhotos.length === 0 && (
                    <div className="text-xs text-muted-foreground italic">
                      Sem fotos anexadas. Recomendado adicionar fotos para enriquecer o laudo.
                    </div>
                  )}

                  {uploadedPhotos.length > 0 && (
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">Fotos enviadas ({uploadedPhotos.length})</Label>
                      <div className="flex gap-2 flex-wrap">
                        {uploadedPhotos.map((url, i) => (
                          <div key={i} className="relative group">
                            <img src={url} alt={`Upload ${i + 1}`} className="w-20 h-20 rounded-lg object-cover border border-border" />
                            <button
                              onClick={() => handleRemoveUploadedPhoto(i)}
                              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Descrição específica do imóvel para avaliação (modo manual) */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium flex items-center justify-between gap-2">
                    <span>Descrição do imóvel (para a avaliação)</span>
                    <span className={`text-[11px] tabular-nums ${contadorEmAlerta(manual.descricao) ? "text-destructive" : "text-muted-foreground"}`}>
                      {formatarContador(manual.descricao)}
                    </span>
                  </Label>
                  <Textarea
                    id={DESCRICAO_TEXTAREA_ID}
                    value={manual.descricao}
                    onChange={(e) => {
                      const next = truncarDescricao(e.target.value);
                      setManual({ ...manual, descricao: next });
                      if (descricaoErro) {
                        const v = validarDescricaoAvaliacao(next);
                        setDescricaoErro(v.valid ? null : v.erro);
                      }
                    }}
                    onBlur={() => {
                      if (!descricaoErro) return;
                      // Mantém o foco até o usuário corrigir a descrição.
                      requestAnimationFrame(() => {
                        const el = document.getElementById(DESCRICAO_TEXTAREA_ID) as HTMLTextAreaElement | null;
                        el?.focus({ preventScroll: true });
                      });
                    }}
                    placeholder="Descreva o imóvel: acabamento, reformas, vista, diferenciais, posição, entorno, condomínio…"
                    rows={4}
                    aria-invalid={!!descricaoErro}
                    className={`bg-secondary resize-y min-h-[100px] leading-relaxed ${descricaoErro ? "border-destructive focus-visible:ring-destructive" : ""}`}
                  />
                  {descricaoErro ? (
                    <p className="text-[11px] text-destructive flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {descricaoErro}
                    </p>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">
                      Quanto mais detalhes, mais precisa fica a avaliação da IA (mínimo {DESCRICAO_MIN} caracteres).
                    </p>
                  )}
                </div>

                

                <div className="flex justify-end">

                  <Button onClick={() => handleAvaliar()} disabled={avaliando || !manualAreaFilled || limiteAtingido} className="gap-2">
                    {avaliando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {limiteAtingido ? "Limite atingido" : avaliando ? "Avaliando..." : "Avaliar com IA"}
                  </Button>
                </div>
                </div>
              </div>
            )}


            {/* Preview do imóvel selecionado */}
            {!modoManual && selectedImovel && (
              <div className="mt-4 p-4 rounded-lg bg-secondary/50 border border-border grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div><span className="text-muted-foreground">Tipo:</span> <strong>{selectedImovel.tipo}</strong></div>
                <div><span className="text-muted-foreground">Operação:</span> <strong>{selectedImovel.operacao}</strong></div>
                <div><span className="text-muted-foreground">Área:</span> <strong>{selectedImovel.area}m²</strong></div>
                <div><span className="text-muted-foreground">Quartos:</span> <strong>{selectedImovel.quartos}</strong></div>
                <div><span className="text-muted-foreground">Bairro:</span> <strong>{selectedImovel.bairro || "—"}</strong></div>
                <div><span className="text-muted-foreground">Cidade:</span> <strong>{selectedImovel.cidade || "—"}</strong></div>
                <div><span className="text-muted-foreground">Preço atual:</span> <strong>{formatBRL(selectedImovel.preco)}</strong></div>
                <div><span className="text-muted-foreground">Vagas:</span> <strong>{selectedImovel.vagas}</strong></div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Histórico de avaliações da mesma região/imóvel */}
        <AvaliacoesHistoricoPanel
          bairro={modoManual ? manual.bairro : selectedImovel?.bairro}
          cidade={modoManual ? manual.cidade : selectedImovel?.cidade}
          tipo={modoManual ? manual.tipo : selectedImovel?.tipo}
          imovelId={!modoManual ? selectedImovel?.id : null}
        />



        {/* Loading */}
        {avaliando && (
          <Card className="bg-card border-border">
            <CardContent className="py-12 flex flex-col items-center gap-4">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
              <p className="text-muted-foreground text-sm">Analisando dados de mercado e calculando estimativa...</p>
            </CardContent>
          </Card>
        )}

        {/* ============ RESULTADO COMPLETO ============ */}
        {avaliacao && selectedImovel && !avaliando && (
          <div className="space-y-6">
            {/* Action bar */}
            <div className="flex flex-wrap gap-2">
              {editingHistoricoId ? (
                <Button variant="default" size="sm" onClick={handleUpdateHistorico} disabled={salvando} className="gap-2">
                  {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar Alterações
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={handleSalvar} disabled={salvando} className="gap-2">
                  {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar
                </Button>
              )}
              <Button
                variant={editMode ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  const next = !editMode;
                  setEditMode(next);
                  if (next) {
                    setEditTab("imovel");
                    if (!modoManual && !modoLink && selectedImovel) {
                      setImovelOverrides({});
                    }
                  }
                }}
                className="gap-2"
              >
                <PenLine className="w-4 h-4" />
                {editMode ? "Concluir Edição" : "Editar Valores"}
              </Button>
              <div className="flex flex-col gap-1.5">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Layout do Relatório</Label>
                <Select
                  value={pdfLayout}
                  onValueChange={(v) => {
                    setPdfLayout(v as AvaliacaoLayoutOption);
                    try { localStorage.setItem("avaliacao-pdf-layout", v); } catch { /* ignore */ }
                  }}
                >
                  <SelectTrigger className="w-[220px] h-9 text-xs font-medium bg-background border-primary/20 hover:border-primary/40 transition-colors">
                    <SelectValue placeholder="Escolher layout..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="premium" className="text-xs">✨ Premium IA Editorial (Recomendado)</SelectItem>
                    <SelectItem value="gamma" className="text-xs">📑 Padrão (Amostragem NBR)</SelectItem>
                    <SelectItem value="executivo" className="text-xs">📊 Executivo Profissional</SelectItem>
                    <SelectItem value="compacto" className="text-xs">📄 Compacto (Uma página)</SelectItem>
                    <SelectItem value="clean_light" className="text-xs">☀️ Clean Light (Minimalista)</SelectItem>
                    <SelectItem value="estudo_completo" className="text-xs">📋 Estudo de Viabilidade</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" size="sm" onClick={handleExportPDF} className="gap-2">
                <FileDown className="w-4 h-4" /> Exportar PDF
              </Button>
              <Button size="sm" onClick={handleExportLaudoCompleto} className="gap-2">
                <FileDown className="w-4 h-4" /> Baixar laudo completo (amostragem + motivos)
              </Button>
              <Button variant="outline" size="sm" onClick={handleShare} className="gap-2">
                <Share2 className="w-4 h-4" /> WhatsApp
              </Button>
            </div>

            {(pdfLayout === "gamma" || pdfLayout === "executivo" || pdfLayout === "compacto" || pdfLayout === "premium") && (
              <Dialog open={configAmostragemOpen} onOpenChange={setConfigAmostragemOpen}>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-2 border-primary/40 text-primary hover:bg-primary/5 mb-4"
                  onClick={() => setConfigAmostragemOpen(true)}
                >
                  <ListFilter className="w-4 h-4" /> Configurar Amostragem
                </Button>
                <DialogContent className="max-w-3xl">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-primary" />
                      Critérios de Amostragem (NBR 14.653)
                    </DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Tamanho da amostra</Label>
                        <Input
                          type="number"
                          min={1}
                          max={30}
                          value={amostragem.tamanho}
                          onChange={(e) => setAmostragem({ tamanho: Math.max(1, Math.min(30, Number(e.target.value) || 1)) })}
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Critério de seleção</Label>
                        <Select
                          value={amostragem.criterio}
                          onValueChange={(v) => setAmostragem({ criterio: v as CriterioAmostragem })}
                        >
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CRITERIOS_AMOSTRAGEM.map((c) => (
                              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Tolerância de área (%)</Label>
                        <Select
                          value={String(amostragem.toleranciaAreaPct)}
                          onValueChange={(v) => setAmostragem({ toleranciaAreaPct: Number(v) })}
                        >
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">Sem limite</SelectItem>
                            <SelectItem value="10">±10%</SelectItem>
                            <SelectItem value="20">±20%</SelectItem>
                            <SelectItem value="30">±30%</SelectItem>
                            <SelectItem value="50">±50%</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-6 p-3 rounded-lg bg-muted/50 border border-border">
                      <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                        <Checkbox 
                          checked={amostragem.somenteMesmoBairro}
                          onCheckedChange={(checked) => setAmostragem({ somenteMesmoBairro: !!checked })}
                        />
                        Somente o mesmo bairro
                      </label>
                      <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                        <Checkbox 
                          checked={amostragem.somenteMesmoTipo}
                          onCheckedChange={(checked) => setAmostragem({ somenteMesmoTipo: !!checked })}
                        />
                        Somente o mesmo tipo de imóvel
                      </label>
                    </div>

                    {previaAmostragem && (
                      <div className="rounded-lg border border-border bg-background p-3 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-foreground uppercase tracking-wider">
                            Prévia da Seleção ({previaAmostragem.amostra.selecionados.length})
                          </p>
                          <Badge variant="secondary" className="text-[10px]">
                            {previaAmostragem.amostra.totalDisponivel} totais · {previaAmostragem.amostra.removidosPorFiltro} filtrados
                          </Badge>
                        </div>
                        <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                          {previaAmostragem.amostra.selecionados.map((ref: any, idx: number) => (
                            <div key={`${ref?.id ?? idx}`} className="text-[11px] p-2 rounded border border-border/40 bg-muted/20">
                              <div className="flex justify-between font-medium mb-1">
                                <span className="truncate flex-1">#{idx+1} {ref.titulo}</span>
                                <span className="ml-2 whitespace-nowrap">{formatBRL(ref.preco)}</span>
                              </div>
                              <p className="text-muted-foreground italic leading-tight">
                                {previaAmostragem.motivos[idx]?.motivo}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end gap-2 mt-2">
                      <Button variant="ghost" size="sm" onClick={() => setAmostragem(AMOSTRAGEM_PADRAO)}>
                        Restaurar Padrão
                      </Button>
                      <Button size="sm" onClick={() => setConfigAmostragemOpen(false)}>
                        Salvar e Aplicar
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}


            {editMode && (
              <Card className="bg-primary/5 border-primary/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <PenLine className="w-4 h-4 text-primary" /> Editar Material da Avaliação
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-xs text-muted-foreground">Ajuste todos os dados antes de exportar o PDF. As alterações são refletidas em tempo real.</p>

                  {/* Tabs */}
                  <div className="flex gap-2 border-b border-border pb-2">
                    <Button
                      variant={editTab === "imovel" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setEditTab("imovel")}
                      className="gap-1.5 text-xs"
                    >
                      <Building2 className="w-3.5 h-3.5" /> Dados do Imóvel
                    </Button>
                    <Button
                      variant={editTab === "valores" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setEditTab("valores")}
                      className="gap-1.5 text-xs"
                    >
                      <DollarSign className="w-3.5 h-3.5" /> Valores e Textos
                    </Button>
                  </div>

                  {editTab === "imovel" && (
                    <div className="space-y-4">
                      {/* Dados básicos do imóvel */}
                      <p className="text-xs font-semibold text-muted-foreground uppercase">Informações do Imóvel</p>
                      {(() => {
                        const isManualMode = modoManual || modoLink;
                        const getVal = (field: string) => {
                          if (isManualMode) return (manual as any)[field] || "";
                          return imovelOverrides[field] !== undefined ? imovelOverrides[field] : (selectedImovel as any)?.[field] || "";
                        };
                        const setVal = (field: string, value: any) => {
                          if (isManualMode) {
                            setManual(prev => ({ ...prev, [field]: value }));
                          } else {
                            setImovelOverrides(prev => ({ ...prev, [field]: value }));
                          }
                        };
                        return (
                          <>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              <div>
                                <Label className="text-xs">Título</Label>
                                <Input value={getVal("titulo")} onChange={(e) => setVal("titulo", e.target.value)} className="bg-background" />
                              </div>
                              <div>
                                <Label className="text-xs">Tipo</Label>
                                <Select value={getVal("tipo")} onValueChange={(v) => setVal("tipo", v)}>
                                  <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {["Apartamento", "Casa", "Terreno", "Comercial", "Cobertura", "Kitnet", "Sala", "Loja", "Galpão", "Prédio", "Sobrado"].map(t => (
                                      <SelectItem key={t} value={t}>{t}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label className="text-xs">Operação</Label>
                                <Select value={getVal("operacao")} onValueChange={(v) => setVal("operacao", v)}>
                                  <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Venda">Venda</SelectItem>
                                    <SelectItem value="Aluguel">Aluguel</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label className="text-xs">Área (m²)</Label>
                                <Input type="number" value={isManualMode ? getVal("area") : getVal("area")} onChange={(e) => setVal("area", isManualMode ? e.target.value : Number(e.target.value))} className="bg-background" />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              <div>
                                <Label className="text-xs">Quartos</Label>
                                <Input type="number" value={isManualMode ? getVal("quartos") : getVal("quartos")} onChange={(e) => setVal("quartos", isManualMode ? e.target.value : Number(e.target.value))} className="bg-background" />
                              </div>
                              <div>
                                <Label className="text-xs">Suítes</Label>
                                <Input type="number" value={isManualMode ? getVal("suites") : getVal("suites")} onChange={(e) => setVal("suites", isManualMode ? e.target.value : Number(e.target.value))} className="bg-background" />
                              </div>
                              <div>
                                <Label className="text-xs">Banheiros</Label>
                                <Input type="number" value={isManualMode ? getVal("banheiros") : getVal("banheiros")} onChange={(e) => setVal("banheiros", isManualMode ? e.target.value : Number(e.target.value))} className="bg-background" />
                              </div>
                              <div>
                                <Label className="text-xs">Vagas</Label>
                                <Input type="number" value={isManualMode ? getVal("vagas") : getVal("vagas")} onChange={(e) => setVal("vagas", isManualMode ? e.target.value : Number(e.target.value))} className="bg-background" />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              <div>
                                <Label className="text-xs">Bairro</Label>
                                <Input value={getVal("bairro")} onChange={(e) => setVal("bairro", e.target.value)} className="bg-background" />
                              </div>
                              <div>
                                <Label className="text-xs">Cidade</Label>
                                <Input value={getVal("cidade")} onChange={(e) => setVal("cidade", e.target.value)} className="bg-background" />
                              </div>
                              <div>
                                <Label className="text-xs">Estado</Label>
                                <Input value={getVal("estado")} onChange={(e) => setVal("estado", e.target.value)} className="bg-background" />
                              </div>
                              <div>
                                <Label className="text-xs">Preço Informado (R$)</Label>
                                <Input type="number" value={isManualMode ? getVal("preco") : getVal("preco")} onChange={(e) => setVal("preco", isManualMode ? e.target.value : Number(e.target.value))} className="bg-background" />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              <div>
                                <Label className="text-xs">Condomínio (R$)</Label>
                                <Input type="number" value={isManualMode ? getVal("valor_condominio") : getVal("valor_condominio")} onChange={(e) => setVal("valor_condominio", isManualMode ? e.target.value : Number(e.target.value))} className="bg-background" />
                              </div>
                              <div>
                                <Label className="text-xs">IPTU (R$)</Label>
                                <Input type="number" value={isManualMode ? getVal("valor_iptu") : getVal("valor_iptu")} onChange={(e) => setVal("valor_iptu", isManualMode ? e.target.value : Number(e.target.value))} className="bg-background" />
                              </div>
                              <div>
                                <Label className="text-xs">Andar</Label>
                                <Input value={isManualMode ? getVal("andar") : getVal("andar")} onChange={(e) => setVal("andar", e.target.value)} className="bg-background" />
                              </div>
                              <div>
                                <Label className="text-xs">Posição Solar</Label>
                                <Input value={isManualMode ? getVal("posicao_solar") : getVal("posicao_solar")} onChange={(e) => setVal("posicao_solar", e.target.value)} className="bg-background" />
                              </div>
                            </div>

                            {/* Descrição */}
                            {!isManualMode && (
                              <div>
                                <Label className="text-xs">Descrição</Label>
                                <Textarea rows={3} value={getVal("descricao")} onChange={(e) => setVal("descricao", e.target.value)} className="bg-background" />
                              </div>
                            )}

                            {/* Checkboxes */}
                            <div className="flex flex-wrap gap-4">
                              {[
                                { key: "exclusivo", label: "Exclusivo" },
                                { key: "aceita_permuta", label: "Aceita Permuta" },
                                { key: "aceita_financiamento", label: "Aceita Financiamento" },
                                { key: "tem_escritura", label: "Tem Escritura" },
                              ].map(({ key, label }) => (
                                <div key={key} className="flex items-center gap-2">
                                  <Checkbox
                                    id={`edit-${key}`}
                                    checked={!!getVal(key)}
                                    onCheckedChange={(v) => setVal(key, !!v)}
                                  />
                                  <Label htmlFor={`edit-${key}`} className="text-xs cursor-pointer">{label}</Label>
                                </div>
                              ))}
                            </div>

                            {/* Fotos */}
                            <Separator />
                            <p className="text-xs font-semibold text-muted-foreground uppercase">Fotos do Imóvel</p>
                            {isManualMode && (
                              <div>
                                <Label className="text-xs">URLs de Fotos (separadas por vírgula)</Label>
                                <Input value={getVal("fotos_url")} onChange={(e) => setVal("fotos_url", e.target.value)} className="bg-background" placeholder="https://foto1.jpg, https://foto2.jpg" />
                              </div>
                            )}
                            <div className="space-y-2">
                              <div className="flex items-center gap-3">
                                <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-md border border-dashed border-border bg-secondary/50 hover:bg-secondary transition-colors text-sm text-muted-foreground">
                                  <ImagePlus className="w-4 h-4" />
                                  {uploadingPhotos ? "Enviando..." : "Adicionar fotos"}
                                  <input type="file" accept={PHOTO_ACCEPT_VALUE} multiple className="hidden" onChange={handlePhotoUpload} disabled={uploadingPhotos} />
                                </label>
                                {uploadingPhotos && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                              </div>
                              {/* Preview das fotos atuais */}
                              {(() => {
                                const fotos = Array.isArray(selectedImovel?.fotos) ? selectedImovel.fotos.filter(Boolean) : [];
                                const extras = uploadedPhotos.filter(u => !fotos.includes(u));
                                const allPhotos = [...fotos, ...extras];
                                if (allPhotos.length === 0) return null;
                                return (
                                  <div>
                                    <Label className="text-xs text-muted-foreground mb-1 block">Fotos ({allPhotos.length})</Label>
                                    <div className="flex gap-2 flex-wrap">
                                      {allPhotos.map((url, i) => (
                                        <div key={i} className="relative group">
                                          <img src={url} alt={`Foto ${i + 1}`} className="w-20 h-20 rounded-lg object-cover border border-border" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                          {extras.includes(url) && (
                                            <button
                                              onClick={() => handleRemoveUploadedPhoto(uploadedPhotos.indexOf(url))}
                                              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                            >×</button>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>

                            {/* Dados do Corretor */}
                            <Separator />
                            <p className="text-xs font-semibold text-muted-foreground uppercase">Dados do Corretor / Imobiliária</p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              <div>
                                <Label className="text-xs">Nome do Corretor</Label>
                                <Input value={isManualMode ? getVal("corretor_nome") : getVal("corretor_nome")} onChange={(e) => setVal("corretor_nome", e.target.value)} className="bg-background" placeholder="Ex: João Silva" />
                              </div>
                              <div>
                                <Label className="text-xs">CRECI</Label>
                                <Input value={isManualMode ? getVal("corretor_creci") : getVal("corretor_creci")} onChange={(e) => setVal("corretor_creci", e.target.value)} className="bg-background" placeholder="Ex: 12345-F" />
                              </div>
                              <div>
                                <Label className="text-xs">Link do Imóvel</Label>
                                <Input value={isManualMode ? getVal("link_imovel") : getVal("link_imovel")} onChange={(e) => setVal("link_imovel", e.target.value)} className="bg-background" placeholder="https://..." />
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  )}

                  {editTab === "valores" && (
                    <div className="space-y-4">
                  {/* Valores principais (existing content below) */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <Label className="text-xs">Valor Mínimo (R$)</Label>
                      <Input type="number" value={avaliacao.valor_minimo} onChange={(e) => setAvaliacao({ ...avaliacao, valor_minimo: Number(e.target.value) })} className="bg-background" />
                    </div>
                    <div>
                      <Label className="text-xs">Valor Ideal (R$)</Label>
                      <Input type="number" value={avaliacao.valor_ideal} onChange={(e) => setAvaliacao({ ...avaliacao, valor_ideal: Number(e.target.value) })} className="bg-background" />
                    </div>
                    <div>
                      <Label className="text-xs">Valor Máximo (R$)</Label>
                      <Input type="number" value={avaliacao.valor_maximo} onChange={(e) => setAvaliacao({ ...avaliacao, valor_maximo: Number(e.target.value) })} className="bg-background" />
                    </div>
                    <div>
                      <Label className="text-xs">Sugestão Preço Inicial (R$)</Label>
                      <Input type="number" value={avaliacao.sugestao_preco_inicial} onChange={(e) => setAvaliacao({ ...avaliacao, sugestao_preco_inicial: Number(e.target.value) })} className="bg-background" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <Label className="text-xs">R$/m² Estimado</Label>
                      <Input type="number" value={avaliacao.preco_m2_estimado} onChange={(e) => setAvaliacao({ ...avaliacao, preco_m2_estimado: Number(e.target.value) })} className="bg-background" />
                    </div>
                    <div>
                      <Label className="text-xs">R$/m² Região</Label>
                      <Input type="number" value={avaliacao.preco_m2_regiao} onChange={(e) => setAvaliacao({ ...avaliacao, preco_m2_regiao: Number(e.target.value) })} className="bg-background" />
                    </div>
                    <div>
                      <Label className="text-xs">Score Liquidez (0-100)</Label>
                      <Input type="number" min={0} max={100} value={avaliacao.score_liquidez} onChange={(e) => setAvaliacao({ ...avaliacao, score_liquidez: Number(e.target.value) })} className="bg-background" />
                    </div>
                    <div>
                      <Label className="text-xs">Classificação Liquidez</Label>
                      <Select value={avaliacao.classificacao_liquidez} onValueChange={(v) => setAvaliacao({ ...avaliacao, classificacao_liquidez: v as "alta" | "media" | "baixa" })}>
                        <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="alta">Alta</SelectItem>
                          <SelectItem value="media">Média</SelectItem>
                          <SelectItem value="baixa">Baixa</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Probabilidades */}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs">Prob. Venda 30 dias (%)</Label>
                      <Input type="number" min={0} max={100} value={avaliacao.probabilidade_venda_30dias} onChange={(e) => setAvaliacao({ ...avaliacao, probabilidade_venda_30dias: Number(e.target.value) })} className="bg-background" />
                    </div>
                    <div>
                      <Label className="text-xs">Prob. Venda 60 dias (%)</Label>
                      <Input type="number" min={0} max={100} value={avaliacao.probabilidade_venda_60dias} onChange={(e) => setAvaliacao({ ...avaliacao, probabilidade_venda_60dias: Number(e.target.value) })} className="bg-background" />
                    </div>
                    <div>
                      <Label className="text-xs">Prob. Venda 90 dias (%)</Label>
                      <Input type="number" min={0} max={100} value={avaliacao.probabilidade_venda_90dias} onChange={(e) => setAvaliacao({ ...avaliacao, probabilidade_venda_90dias: Number(e.target.value) })} className="bg-background" />
                    </div>
                  </div>

                  {/* Cenários de preço */}
                  <Separator />
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Cenários de Preço</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <Label className="text-xs">Preço Idealista (R$)</Label>
                      <Input type="number" value={avaliacao.preco_idealista || ""} onChange={(e) => setAvaliacao({ ...avaliacao, preco_idealista: Number(e.target.value) || undefined })} className="bg-background" />
                    </div>
                    <div>
                      <Label className="text-xs">Preço Realista (R$)</Label>
                      <Input type="number" value={avaliacao.preco_realista || ""} onChange={(e) => setAvaliacao({ ...avaliacao, preco_realista: Number(e.target.value) || undefined })} className="bg-background" />
                    </div>
                    <div>
                      <Label className="text-xs">Preço Projetado (R$)</Label>
                      <Input type="number" value={avaliacao.preco_projetado || ""} onChange={(e) => setAvaliacao({ ...avaliacao, preco_projetado: Number(e.target.value) || undefined })} className="bg-background" />
                    </div>
                    <div>
                      <Label className="text-xs">Preço Otimista (R$)</Label>
                      <Input type="number" value={avaliacao.preco_otimista || ""} onChange={(e) => setAvaliacao({ ...avaliacao, preco_otimista: Number(e.target.value) || undefined })} className="bg-background" />
                    </div>
                  </div>

                  {/* Rentabilidade */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs">Rentabilidade Mensal (R$)</Label>
                      <Input type="number" value={avaliacao.rentabilidade_mensal || ""} onChange={(e) => setAvaliacao({ ...avaliacao, rentabilidade_mensal: Number(e.target.value) || undefined })} className="bg-background" />
                    </div>
                    <div>
                      <Label className="text-xs">Rentabilidade % (mensal)</Label>
                      <Input type="number" step="0.01" value={avaliacao.rentabilidade_percentual || ""} onChange={(e) => setAvaliacao({ ...avaliacao, rentabilidade_percentual: Number(e.target.value) || undefined })} className="bg-background" />
                    </div>
                  </div>

                  {/* Textos */}
                  <Separator />
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Textos da Análise</p>
                  <div>
                    <Label className="text-xs">Análise Resumo</Label>
                    <Textarea rows={3} value={avaliacao.analise_resumo} onChange={(e) => setAvaliacao({ ...avaliacao, analise_resumo: e.target.value })} className="bg-background" />
                  </div>
                  <div>
                    <Label className="text-xs">Estratégia de Venda</Label>
                    <Textarea rows={3} value={avaliacao.estrategia_venda} onChange={(e) => setAvaliacao({ ...avaliacao, estrategia_venda: e.target.value })} className="bg-background" />
                  </div>
                  <div>
                    <Label className="text-xs">Análise de Investimento</Label>
                    <Textarea rows={3} value={avaliacao.analise_investimento || ""} onChange={(e) => setAvaliacao({ ...avaliacao, analise_investimento: e.target.value || undefined })} className="bg-background" />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Pontos Fortes (um por linha)</Label>
                      <Textarea rows={4} value={(avaliacao.pontos_fortes || []).join("\n")} onChange={(e) => setAvaliacao({ ...avaliacao, pontos_fortes: e.target.value.split("\n").filter(Boolean) })} className="bg-background" />
                    </div>
                    <div>
                      <Label className="text-xs">Pontos de Atenção (um por linha)</Label>
                      <Textarea rows={4} value={(avaliacao.pontos_atencao || []).join("\n")} onChange={(e) => setAvaliacao({ ...avaliacao, pontos_atencao: e.target.value.split("\n").filter(Boolean) })} className="bg-background" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Destaques Localização (um por linha)</Label>
                      <Textarea rows={3} value={(avaliacao.destaques_localizacao || []).join("\n")} onChange={(e) => setAvaliacao({ ...avaliacao, destaques_localizacao: e.target.value.split("\n").filter(Boolean) })} className="bg-background" />
                    </div>
                    <div>
                      <Label className="text-xs">Portais Recomendados (um por linha)</Label>
                      <Textarea rows={3} value={(avaliacao.portais_recomendados || []).join("\n")} onChange={(e) => setAvaliacao({ ...avaliacao, portais_recomendados: e.target.value.split("\n").filter(Boolean) })} className="bg-background" />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button size="sm" onClick={() => setEditMode(false)} className="gap-2">
                      <CheckCircle2 className="w-4 h-4" /> Concluir Edição
                    </Button>
                  </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ── SEÇÃO 1: Dados do Imóvel ── */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-primary" /> Dados do Imóvel
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  <div><span className="text-muted-foreground block text-xs">Título</span><strong>{selectedImovel.titulo || "Imóvel sem título"}</strong></div>
                  <div><span className="text-muted-foreground block text-xs">Tipo</span><strong>{selectedImovel.tipo || "—"}</strong></div>
                  <div><span className="text-muted-foreground block text-xs">Operação</span><strong>{selectedImovel.operacao || "—"}</strong></div>
                  <div><span className="text-muted-foreground block text-xs">Área</span><strong>{selectedImovel.area || 0}m²</strong></div>
                  <div><span className="text-muted-foreground block text-xs">Quartos</span><strong>{selectedImovel.quartos || 0}</strong></div>
                  <div><span className="text-muted-foreground block text-xs">Suítes</span><strong>{selectedImovel.suites || 0}</strong></div>
                  <div><span className="text-muted-foreground block text-xs">Vagas</span><strong>{selectedImovel.vagas || 0}</strong></div>
                  <div><span className="text-muted-foreground block text-xs">Bairro</span><strong>{selectedImovel.bairro || "—"}</strong></div>
                  <div><span className="text-muted-foreground block text-xs">Cidade/UF</span><strong>{selectedImovel.cidade || "—"}/{selectedImovel.estado || "—"}</strong></div>
                  {selectedImovel.preco > 0 && (
                    <div><span className="text-muted-foreground block text-xs">Preço Informado</span><strong className="text-primary">{formatBRL(selectedImovel.preco)}</strong></div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* ── SEÇÃO 2: Faixa de Valores ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="bg-card border-border">
                <CardContent className="pt-6 text-center">
                  <ArrowDown className="w-5 h-5 mx-auto text-orange-500 mb-2" />
                  <p className="text-xs text-muted-foreground">Valor Mínimo</p>
                  <p className="text-xl font-bold text-foreground">{formatBRL(avaliacao.valor_minimo)}</p>
                </CardContent>
              </Card>
              <Card className="bg-primary/5 border-primary/30 ring-1 ring-primary/20">
                <CardContent className="pt-6 text-center">
                  <Target className="w-5 h-5 mx-auto text-primary mb-2" />
                  <p className="text-xs text-muted-foreground">Valor Ideal</p>
                  <p className="text-2xl font-bold text-primary">{formatBRL(avaliacao.valor_ideal)}</p>
                  <p className="text-xs text-muted-foreground mt-1">R$ {avaliacao.preco_m2_estimado?.toFixed(0)}/m²</p>
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardContent className="pt-6 text-center">
                  <ArrowUp className="w-5 h-5 mx-auto text-green-500 mb-2" />
                  <p className="text-xs text-muted-foreground">Valor Máximo</p>
                  <p className="text-xl font-bold text-foreground">{formatBRL(avaliacao.valor_maximo)}</p>
                </CardContent>
              </Card>
            </div>

            {/* ── SEÇÃO 3: Precificação Otimista vs Realista ── */}
            {(avaliacao.preco_otimista || avaliacao.preco_realista) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card className="bg-green-500/5 border-green-500/20">
                  <CardContent className="pt-6 text-center">
                    <TrendingUp className="w-6 h-6 mx-auto text-green-600 mb-2" />
                    <p className="text-xs text-muted-foreground font-medium">Preço Otimista</p>
                    <p className="text-2xl font-bold text-green-600">{formatBRL(avaliacao.preco_otimista || avaliacao.valor_maximo)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Cenário com acabamento premium e mercado aquecido</p>
                  </CardContent>
                </Card>
                <Card className="bg-blue-500/5 border-blue-500/20">
                  <CardContent className="pt-6 text-center">
                    <DollarSign className="w-6 h-6 mx-auto text-blue-600 mb-2" />
                    <p className="text-xs text-muted-foreground font-medium">Preço Realista</p>
                    <p className="text-2xl font-bold text-blue-600">{formatBRL(avaliacao.preco_realista || avaliacao.valor_ideal)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Valor conservador e aderente ao mercado atual</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ── SEÇÃO 4: Score & Probabilidade ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    {getLiquidezIcon(avaliacao.classificacao_liquidez)}
                    Score de Liquidez
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <div className={`text-4xl font-bold ${getLiquidezColor(avaliacao.classificacao_liquidez)}`}>
                      {avaliacao.score_liquidez}
                    </div>
                    <div className="flex-1">
                      <Progress value={avaliacao.score_liquidez} className="h-3" />
                      <p className="text-xs text-muted-foreground mt-1 capitalize">
                        Liquidez {avaliacao.classificacao_liquidez === "alta" ? "🟢 Alta" : avaliacao.classificacao_liquidez === "media" ? "🟡 Média" : "🔴 Baixa"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" />
                    Probabilidade de Venda
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    {[
                      { label: "30 dias", value: avaliacao.probabilidade_venda_30dias },
                      { label: "60 dias", value: avaliacao.probabilidade_venda_60dias },
                      { label: "90 dias", value: avaliacao.probabilidade_venda_90dias },
                    ].map((p) => (
                      <div key={p.label} className="flex justify-between items-center">
                        <span className="text-muted-foreground">{p.label}</span>
                        <div className="flex items-center gap-2">
                          <Progress value={p.value} className="h-2 w-20" />
                          <span className="font-semibold w-10 text-right">{p.value}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* ── SEÇÃO 5: Preço atual vs sugerido ── */}
            {selectedImovel.preco > 0 && (
              <Card className="bg-card border-border">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Preço Atual</p>
                      <p className="text-lg font-bold">{formatBRL(selectedImovel.preco)}</p>
                    </div>
                    <div className="text-center">
                      {avaliacao.preco_competitivo ? (
                        <Badge className="bg-green-500/10 text-green-600 border-green-500/30">Competitivo</Badge>
                      ) : selectedImovel.preco > avaliacao.valor_ideal ? (
                        <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/30">Acima do Mercado</Badge>
                      ) : (
                        <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/30">Abaixo do Mercado</Badge>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Sugestão</p>
                      <p className="text-lg font-bold text-primary">{formatBRL(avaliacao.sugestao_preco_inicial)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── SEÇÃO 6: Análise da IA ── */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" /> Análise da IA
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-foreground leading-relaxed">{avaliacao.analise_resumo}</p>
                <Separator />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-xs font-semibold text-green-600 mb-2">✅ Pontos Fortes</h4>
                    <ul className="space-y-1">
                      {(avaliacao.pontos_fortes || []).map((p, i) => (
                        <li key={i} className="text-xs text-muted-foreground">• {p}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-orange-600 mb-2">⚠️ Pontos de Atenção</h4>
                    <ul className="space-y-1">
                      {(avaliacao.pontos_atencao || []).map((p, i) => (
                        <li key={i} className="text-xs text-muted-foreground">• {p}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ── SEÇÃO 7: Destaques da Localização ── */}
            {(avaliacao.destaques_localizacao || []).length > 0 && (
              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Landmark className="w-4 h-4 text-primary" /> Localização Estratégica
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {avaliacao.destaques_localizacao!.map((d, i) => (
                      <div key={i} className="flex items-start gap-2 p-3 rounded-lg bg-secondary/50 border border-border">
                        <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <p className="text-sm text-foreground">{d}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── SEÇÃO 8: Retorno sobre Investimento ── */}
            {(avaliacao.rentabilidade_mensal || avaliacao.analise_investimento) && (
              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <PiggyBank className="w-4 h-4 text-primary" /> Retorno sobre Investimento
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {(avaliacao.rentabilidade_mensal || avaliacao.rentabilidade_percentual) && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {avaliacao.rentabilidade_mensal ? (
                        <div className="p-3 rounded-lg bg-secondary/50 border border-border text-center">
                          <p className="text-xs text-muted-foreground">Aluguel Estimado</p>
                          <p className="text-lg font-bold text-foreground">{formatBRL(avaliacao.rentabilidade_mensal)}</p>
                          <p className="text-xs text-muted-foreground">/mês</p>
                        </div>
                      ) : null}
                      {avaliacao.rentabilidade_percentual ? (
                        <div className="p-3 rounded-lg bg-secondary/50 border border-border text-center">
                          <p className="text-xs text-muted-foreground">Rentabilidade</p>
                          <p className="text-lg font-bold text-foreground">{avaliacao.rentabilidade_percentual.toFixed(2)}%</p>
                          <p className="text-xs text-muted-foreground">ao mês</p>
                        </div>
                      ) : null}
                      <div className="p-3 rounded-lg bg-secondary/50 border border-border text-center">
                        <p className="text-xs text-muted-foreground">Preço m² Região</p>
                        <p className="text-lg font-bold text-foreground">R$ {avaliacao.preco_m2_regiao?.toFixed(0)}</p>
                        <p className="text-xs text-muted-foreground">vs R$ {avaliacao.preco_m2_estimado?.toFixed(0)} imóvel</p>
                      </div>
                    </div>
                  )}
                  {avaliacao.analise_investimento && (
                    <p className="text-sm text-foreground leading-relaxed">{avaliacao.analise_investimento}</p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ── Modo diagnóstico do laudo ── */}
            <div className="flex justify-end">
              <Button
                size="sm"
                variant={modoDiagnostico ? "default" : "outline"}
                onClick={() => setModoDiagnostico((v) => !v)}
              >
                <Bug className="w-3.5 h-3.5 mr-1" />
                {modoDiagnostico ? "Diagnóstico ativo" : "Ativar modo diagnóstico"}
              </Button>
            </div>
            {modoDiagnostico && diagnosticoLaudo && (
              <DiagnosticoLaudoPanel
                diagnostico={diagnosticoLaudo}
                origem={ultimoPayloadLaudo ? `${ultimoPayloadLaudo.origem} · ${new Date(ultimoPayloadLaudo.em).toLocaleString("pt-BR")}` : "prévia (antes de exportar)"}
                onFechar={() => setModoDiagnostico(false)}
              />
            )}


            {/* ── Referências bloqueadas permanentemente pelo avaliador ── */}
            {referenciasBloqueadas.length > 0 && (
              <Card className="border-destructive/30 bg-destructive/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-destructive" />
                    Referências bloqueadas ({referenciasBloqueadas.length})
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Estas referências foram removidas por você e não voltam ao laudo, mesmo após recarregar ou recompilar.
                  </p>
                </CardHeader>
                <CardContent>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setReferenciasBloqueadas([]);
                      try { localStorage.removeItem("avaliacao:referencias-bloqueadas"); } catch { /* ignore */ }
                      toast({ title: "Bloqueios limpos", description: "As referências podem voltar a ser buscadas." });
                    }}
                  >
                    Limpar bloqueios
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* ── Comparáveis descartados por falta de correspondência real ── */}

            {comparaveisDescartados.length > 0 && (
              <Card className="border-amber-500/40 bg-amber-500/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    Referências descartadas ({comparaveisDescartados.length})
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Estes imóveis não foram usados no laudo por não terem correspondência real na carteira ou na base de mercado. O descarte foi registrado no log do sistema.
                  </p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {comparaveisDescartados.map((d, idx) => (
                    <div
                      key={`${d.comparavel?.id || "sem-id"}-${idx}`}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-md border border-border/60 bg-background/60 p-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {d.comparavel?.titulo || "Imóvel sem título"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Fonte informada: {d.comparavel?.fonte || "não informada"}
                          {d.comparavel?.id ? ` · ID ${String(d.comparavel.id).slice(0, 8)}` : ""}
                        </p>
                        {d.comparavel?.url_anuncio && (
                          <a
                            href={String(d.comparavel.url_anuncio)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary underline break-all"
                          >
                            {String(d.comparavel.url_anuncio)}
                          </a>
                        )}
                      </div>
                      <div className="flex items-center gap-2 self-start sm:self-center">
                        <Badge variant="outline" className="border-amber-500/50 text-amber-600 whitespace-nowrap">
                          {d.descricao}
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 whitespace-nowrap"
                          onClick={() => abrirSubstituicao(idx, d)}
                        >
                          <RefreshCw className="w-3.5 h-3.5" /> Substituir
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* ── Histórico de substituições manuais ── */}
            {substituicoesRealizadas.length > 0 && (
              <Card className="border-primary/30 bg-primary/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <History className="w-4 h-4 text-primary" />
                    Substituições manuais ({substituicoesRealizadas.length})
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Todas as trocas ficam registradas no log do sistema. Recompile o laudo para aplicar as novas referências.
                  </p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {substituicoesRealizadas.map((s, idx) => (
                    <div key={`${s.substituto}-${idx}`} className="rounded-md border border-border/60 bg-background/60 p-3">
                      <p className="text-sm">
                        <span className="line-through text-muted-foreground">{s.descartado}</span>
                        {" → "}
                        <span className="font-medium">{s.substituto}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Motivo do descarte: {s.motivo} · Fonte do substituto: {s.fonte} ·{" "}
                        {new Date(s.em).toLocaleString("pt-BR")}
                      </p>
                    </div>
                  ))}
                  <Button onClick={recompilarLaudo} disabled={avaliando} className="gap-2 w-full sm:w-auto">
                    {avaliando ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    Recompilar laudo
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Diálogo de substituição de referência */}
            <Dialog
              open={!!substituicaoAlvo}
              onOpenChange={(open) => {
                if (!open) {
                  setSubstituicaoAlvo(null);
                  setCandidatosSubstituicao([]);
                }
              }}
            >
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Substituir referência descartada</DialogTitle>
                </DialogHeader>
                <p className="text-xs text-muted-foreground">
                  Escolha um imóvel real (carteira ou mercado) para entrar no lugar de{" "}
                  <span className="font-medium">
                    {substituicaoAlvo?.invalido.comparavel?.titulo || "referência descartada"}
                  </span>
                  .
                </p>
                <Input
                  placeholder="Buscar por título ou bairro..."
                  value={buscaCandidato}
                  onChange={(e) => setBuscaCandidato(e.target.value)}
                />
                <div className="max-h-[50vh] overflow-y-auto space-y-2">
                  {carregandoCandidatos ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground p-4">
                      <Loader2 className="w-4 h-4 animate-spin" /> Buscando imóveis válidos...
                    </div>
                  ) : (
                    (() => {
                      const termo = buscaCandidato.trim().toLowerCase();
                      const lista = candidatosSubstituicao.filter(
                        (c) =>
                          !termo ||
                          (c.titulo || "").toLowerCase().includes(termo) ||
                          (c.bairro || "").toLowerCase().includes(termo),
                      );
                      if (lista.length === 0) {
                        return (
                          <p className="text-sm text-muted-foreground p-4">
                            Nenhum imóvel disponível para substituição.
                          </p>
                        );
                      }
                      return lista.slice(0, 40).map((c) => (
                        <div
                          key={c.id}
                          className="flex items-center justify-between gap-3 rounded-md border border-border/60 p-3"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{c.titulo}</p>
                            <p className="text-xs text-muted-foreground">
                              {c.bairro || "Sem bairro"} · {c.area} m² · {formatBRL(c.preco)} ·{" "}
                              <Badge variant="outline" className="ml-1">{c.fonte}</Badge>
                            </p>
                          </div>
                          <Button size="sm" onClick={() => confirmarSubstituicao(c)}>
                            Usar
                          </Button>
                        </div>
                      ));
                    })()
                  )}
                </div>
              </DialogContent>
            </Dialog>


            {/* ── SEÇÃO 9: Imóveis de Referência (Comparáveis) ── */}
            {comparaveis.length > 0 && (
              <>
                {/* Gráfico: Preço por m² */}
                {(() => {
                  if (!selectedImovel) return null;
                  const imovelM2 = (selectedImovel.area || 0) > 0 ? (selectedImovel.preco || 0) / selectedImovel.area : 0;
                  const chartData = [
                    { name: (selectedImovel.titulo || "Imóvel").slice(0, 18), precoM2: Math.round(imovelM2), isSelected: true, fonte: "avaliado" },
                    ...(comparaveis || [])
                      .filter(c => (c.area || 0) > 0 && (c.preco || 0) > 0)
                      .slice(0, 14)
                      .map(c => ({
                        name: (c.titulo || "Comparável").slice(0, 18),
                        precoM2: Math.round(c.preco / c.area),
                        isSelected: false,
                        fonte: c.fonte,
                      }))
                  ];
                  const validComps = (comparaveis || []).filter(c => (c.area || 0) > 0 && (c.preco || 0) > 0);
                  const avgM2 = validComps.length > 0 
                    ? validComps.reduce((s, c) => s + (c.preco / c.area), 0) / validComps.length 
                    : imovelM2;

                  return (
                    <Card className="bg-card border-border">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <BarChart3 className="w-4 h-4 text-primary" /> Preço por m² — Imóvel vs Comparáveis
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={320}>
                          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 60 }}>
                            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                            <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-40} textAnchor="end" interval={0} />
                            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${v}`} />
                            <RechartsTooltip formatter={(v: number) => [`R$ ${v.toLocaleString("pt-BR")}/m²`, "Preço/m²"]} />
                            <ReferenceLine y={Math.round(avgM2)} stroke="hsl(var(--primary))" strokeDasharray="6 3" label={{ value: `Média: R$${Math.round(avgM2)}`, position: "top", fontSize: 11, fill: "hsl(var(--primary))" }} />
                            <Bar dataKey="precoM2" radius={[4, 4, 0, 0]}>
                              {chartData.map((entry, idx) => (
                                <Cell key={idx} fill={entry.isSelected ? "hsl(var(--primary))" : entry.fonte === "carteira" ? "hsl(var(--muted-foreground) / 0.5)" : "hsl(var(--muted-foreground) / 0.3)"} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                        <div className="flex gap-4 justify-center mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-primary inline-block" /> Imóvel avaliado</span>
                          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-muted-foreground/50 inline-block" /> Carteira</span>
                          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-muted-foreground/30 inline-block" /> Mercado</span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })()}

                {/* Gráfico: Dispersão Preço x Área */}
                {(() => {
                  if (!selectedImovel) return null;
                  const scatterData = (comparaveis || [])
                    .filter(c => (c.area || 0) > 0 && (c.preco || 0) > 0)
                    .map(c => ({ x: c.area, y: c.preco, name: (c.titulo || "Comparável").slice(0, 20), fonte: c.fonte }));
                  const imovelDot = { x: selectedImovel.area || 0, y: selectedImovel.preco || 0, name: (selectedImovel.titulo || "Imóvel").slice(0, 20), fonte: "avaliado" as const };

                  return (
                    <Card className="bg-card border-border">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-primary" /> Dispersão: Preço × Área (m²)
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={280}>
                          <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                            <XAxis type="number" dataKey="x" name="Área" unit="m²" tick={{ fontSize: 11 }} />
                            <YAxis type="number" dataKey="y" name="Preço" tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                            <ZAxis range={[60, 60]} />
                            <RechartsTooltip formatter={(v: number, name: string) => [name === "Preço" ? formatBRL(v) : `${v}m²`, name]} />
                            <Scatter name="Comparáveis" data={scatterData} fill="hsl(var(--muted-foreground) / 0.4)" />
                            <Scatter name="Imóvel Avaliado" data={[imovelDot]} fill="hsl(var(--primary))" shape="star" />
                          </ScatterChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  );
                })()}

                {/* Lista de Referências com Links */}
                <Card className="bg-card border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-primary" /> Imóveis semelhantes anunciados ({comparaveis.length})
                      </div>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6">
                              <AlertCircle className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>Esta amostragem utiliza o padrão antigo validado para garantir precisão estatística na análise de mercado.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {comparaveis.map((c, idx) => {
                        const precoM2 = c.area > 0 ? c.preco / c.area : 0;
                        return (
                          <div key={c.id} className="p-4 rounded-lg bg-secondary/50 border border-border space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-bold text-primary">#{idx + 1}</span>
                                  <p className="text-sm font-medium text-foreground truncate">{c.titulo || "Comparável sem título"}</p>
                                </div>
                                <div className="flex gap-1.5 flex-wrap">
                                  <Badge variant="outline" className="text-[10px]">
                                    {c.fonte === "carteira" ? "Carteira" : c.portal || "Mercado"}
                                  </Badge>
                                  {c.dias_anuncio && c.dias_anuncio > 0 && (
                                    <Badge variant="secondary" className="text-[10px]">
                                      {c.dias_anuncio} dias no ar
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <p className="text-base font-bold text-foreground shrink-0">{formatBRL(c.preco)}</p>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-xs">
                              <div className="p-2 rounded bg-background border border-border text-center">
                                <p className="text-muted-foreground">Área</p>
                                <p className="font-semibold">{c.area}m²</p>
                              </div>
                              <div className="p-2 rounded bg-background border border-border text-center">
                                <p className="text-muted-foreground">Quartos</p>
                                <p className="font-semibold">{c.quartos}</p>
                              </div>
                              <div className="p-2 rounded bg-background border border-border text-center">
                                <p className="text-muted-foreground">R$/m²</p>
                                <p className="font-semibold">R$ {precoM2.toFixed(0)}</p>
                              </div>
                            </div>
                            {c.bairro && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <MapPin className="w-3 h-3" />{c.bairro}
                              </p>
                            )}
                            {c.url_anuncio && (
                              <a
                                href={c.url_anuncio}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline mt-1"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                Ver anúncio completo
                              </a>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {/* ── SEÇÃO 10: Estratégia de Venda ── */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" /> Estratégia de Venda
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-foreground leading-relaxed">{avaliacao.estrategia_venda}</p>
              </CardContent>
            </Card>

            {/* ── SEÇÃO 11: Portais Recomendados ── */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary" /> Portais Recomendados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {avaliacao.portais_recomendados?.map((p, i) => (
                    <Badge key={i} variant="secondary" className="text-sm px-3 py-1">{p}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Histórico */}
        {showHistorico && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <History className="w-4 h-4 text-primary" /> Histórico de Avaliações
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingHistorico ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : historico.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhuma avaliação salva ainda.</p>
              ) : (
                <div className="space-y-2">
                  {historico.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-medium text-foreground truncate">{item.titulo || "Sem título"}</p>
                          <Badge variant="outline" className="text-[10px] shrink-0">
                            {item.modo === "manual" ? "Manual" : "Carteira"}
                          </Badge>
                        </div>
                        <div className="flex gap-3 text-xs text-muted-foreground">
                          {item.bairro && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{item.bairro}</span>}
                          <span>{(item.area || 0)}m² · {(item.quartos || 0)}q</span>
                          <span className="font-semibold text-primary">{formatBRL(item.valor_ideal)}</span>
                          <span>Score: {item.score_liquidez}/100</span>
                          <span>{new Date(item.created_at).toLocaleDateString("pt-BR")}</span>
                        </div>
                      </div>
                      <div className="flex gap-1 ml-2 shrink-0">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditHistorico(item)} title="Editar">
                          <PenLine className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleLoadFromHistorico(item)} title="Carregar">
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteHistorico(item.id)} title="Excluir">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Revisão de Dados Críticos
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4 pt-2">
              <p className="text-foreground font-medium">Resumo da Extração:</p>
              
              <div className="grid grid-cols-2 gap-3 pb-2">
                {[
                  { label: "Preço", key: "Preço" },
                  { label: "Área (m²)", key: "Área" },
                  { label: "Cidade", key: "Cidade" },
                  { label: "Bairro", key: "Bairro" },
                  { label: "Fotos", key: "Fotos" }
                ].map((item) => {
                  const isMissing = missingFieldsWarning.some(f => f.startsWith(item.key));
                  return (
                    <div key={item.key} className="flex items-center justify-between p-2.5 rounded-lg border bg-background">
                      <span className="text-xs font-medium">{item.label}</span>
                      {isMissing ? (
                        <Badge variant="outline" className="text-[10px] text-amber-600 bg-amber-50 border-amber-200 gap-1 uppercase">
                          <Clock className="w-2.5 h-2.5" /> Pendente
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-green-600 bg-green-50 border-green-200 gap-1 uppercase">
                          <CheckCircle2 className="w-2.5 h-2.5" /> Confirmado
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>

              <p className="text-sm text-muted-foreground border-t pt-3">
                Você pode importar os dados confirmados agora e preencher os itens pendentes manualmente no formulário.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel onClick={() => setPendingExtractionData(null)} className="sm:mt-0">Cancelar</AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => {
                if (pendingExtractionData) {
                  setConfirmDialogOpen(false);
                  handleExtrairLink(pendingExtractionData.url);
                }
              }}


              className="gap-2 border-primary text-primary hover:bg-primary/5"
            >
              <Loader2 className="w-4 h-4" />
              Tentar novamente
            </Button>
            <AlertDialogAction
              onClick={async () => {
                if (pendingExtractionData) {
                  await applyExtractedData(pendingExtractionData.data, pendingExtractionData.url, true, retryCount);
                }
              }}


              className="bg-primary hover:bg-primary/90"
            >
              Sim, revisar manualmente
            </AlertDialogAction>
          </AlertDialogFooter>

        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={confirmAvaliarDialogOpen} onOpenChange={setConfirmAvaliarDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Checklist de Avaliação
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4 pt-2">
              <p className="text-foreground font-medium">Verificação de Dados Críticos:</p>
              
              <div className="grid grid-cols-2 gap-3 pb-2">
                {[
                  { label: "Preço", key: "Preço" },
                  { label: "Área (m²)", key: "Área" },
                  { label: "Cidade", key: "Cidade" },
                  { label: "Bairro", key: "Bairro" },
                  { label: "Fotos", key: "Fotos" },
                  { label: "Descrição", key: "Descrição" }
                ].map((item) => {
                  const isMissing = missingFieldsAvaliarWarning.some(f => f.startsWith(item.key));
                  return (
                    <div key={item.key} className="flex items-center justify-between p-2.5 rounded-lg border bg-background">
                      <span className="text-xs font-medium">{item.label}</span>
                      {isMissing ? (
                        <Badge variant="outline" className="text-[10px] text-amber-600 bg-amber-50 border-amber-200 gap-1 uppercase">
                          <AlertTriangle className="w-2.5 h-2.5" /> Faltando
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-green-600 bg-green-50 border-green-200 gap-1 uppercase">
                          <CheckCircle2 className="w-2.5 h-2.5" /> OK
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>

              <p className="text-sm text-muted-foreground border-t pt-3">
                Para uma avaliação mais precisa, recomendamos que todos os campos estejam marcados como "OK". Deseja prosseguir com os dados atuais?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="sm:mt-0">Voltar e preencher</AlertDialogCancel>
            {manual.link_imovel && (
              <Button
                variant="outline"
                onClick={async () => {
                  setConfirmAvaliarDialogOpen(false);
                  await handleExtrairLink();
                }}
                className="gap-2 border-primary text-primary hover:bg-primary/5"
              >
                <Loader2 className={`w-4 h-4 ${extraindo ? 'animate-spin' : ''}`} />
                Reprocessar link
              </Button>
            )}
            <AlertDialogAction
              onClick={() => handleAvaliar(true)}
              className="bg-primary hover:bg-primary/90"
            >
              Avaliar mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>

        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={!!erroExtracao} onOpenChange={(open) => !open && setErroExtracao(null)}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="w-5 h-5" />
              {erroExtracao?.message || "Erro na Extração"}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4 pt-2">
              <div className="bg-destructive/5 p-4 rounded-lg border border-destructive/20">
                <p className="text-sm text-foreground font-medium mb-1 flex items-center gap-2">
                   <AlertTriangle className="w-4 h-4 text-destructive" /> Motivo detectado:
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {erroExtracao?.detail || "Ocorreu um erro inesperado ao processar o link. Verifique a URL e tente novamente."}
                </p>
                {(erroExtracao?.stage || erroExtracao?.httpStatus || erroExtracao?.upstreamStatus) && (
                  <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] font-mono">
                    {erroExtracao?.stage && (
                      <span className="px-2 py-0.5 rounded bg-destructive/10 text-destructive border border-destructive/20">Etapa: {erroExtracao.stage}</span>
                    )}
                    {erroExtracao?.httpStatus && (
                      <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground border">HTTP {erroExtracao.httpStatus}</span>
                    )}
                    {erroExtracao?.upstreamStatus && (
                      <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground border">Upstream {erroExtracao.upstreamStatus}</span>
                    )}
                  </div>
                )}
              </div>

              {(() => {
                const guide = getErrorCodeGuide(erroExtracao?.errorCode);
                if (!guide) return null;
                const tone =
                  guide.severity === "error"
                    ? "bg-destructive/5 border-destructive/20 text-destructive"
                    : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-100";
                return (
                  <div className={`p-3 rounded-lg border ${tone}`}>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-1 flex items-center gap-2">
                      🛠 Como resolver
                      {erroExtracao?.errorCode && (
                        <span className="ml-auto px-1.5 py-0.5 rounded bg-background/60 border text-[10px] font-mono text-muted-foreground">
                          {erroExtracao.errorCode}
                        </span>
                      )}
                    </p>
                    <p className="text-sm font-semibold leading-snug">{guide.title}</p>
                    <p className="text-sm leading-relaxed mt-1 opacity-90">{guide.instruction}</p>
                    {guide.cta && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="mt-3"
                        onClick={() => {
                          setErroExtracao(null);
                          navigate(guide.cta!.href);
                        }}
                      >
                        {guide.cta.label}
                      </Button>
                    )}
                  </div>
                );
              })()}

              {erroExtracao?.hint && (
                <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg border border-blue-200 dark:border-blue-900">
                  <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-1">💡 Dica de correção</p>
                  <p className="text-sm text-blue-900 dark:text-blue-100 leading-relaxed">{erroExtracao.hint}</p>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Sugestões gerais:</p>
                <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Verifique se o link abre normalmente no seu navegador</li>
                  <li>Certifique-se de que o anúncio não é um vídeo ou carrossel de fotos (Reels/Stories)</li>
                  <li>Tente remover barras extras ou parâmetros no final da URL</li>
                </ul>
              </div>

              {erroExtracao?.correlationId && (
                <p className="text-[10px] font-mono text-muted-foreground border-t pt-2">
                  ID de rastreio: <span className="select-all">{erroExtracao.correlationId}</span>
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="sm:mt-0">Fechar</AlertDialogCancel>
            <Button 
              onClick={async () => {
                setErroExtracao(null);
                await handleExtrairLink();
              }}
              disabled={extraindo}
              className="gap-2"
            >
              <Loader2 className={`w-4 h-4 ${extraindo ? 'animate-spin' : ''}`} />
              Tentar novamente
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>

      </AlertDialog>
      <AlertDialog open={!!erroAvaliacao} onOpenChange={(open) => !open && setErroAvaliacao(null)}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              {erroAvaliacao?.message || "Erro na Avaliação"}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4 pt-2">
              <div className="bg-destructive/5 p-4 rounded-lg border border-destructive/20">
                <p className="text-sm text-foreground font-medium mb-1">Motivo detectado:</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {erroAvaliacao?.detail || "Ocorreu um erro ao processar a avaliação com Inteligência Artificial."}
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Como prosseguir:</p>
                <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Tente novamente clicando no botão abaixo sem recarregar a página</li>
                  <li>Se o erro persistir, verifique se os dados do imóvel estão corretos</li>
                  <li>Em casos raros, a IA pode estar temporariamente sobrecarregada</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="sm:mt-0">Revisar dados</AlertDialogCancel>
            <Button 
              onClick={async () => {
                setErroAvaliacao(null);
                await handleAvaliar(true);
              }}
              disabled={avaliando}
              className="gap-2"
            >
              <Loader2 className={`w-4 h-4 ${avaliando ? 'animate-spin' : ''}`} />
              Tentar avaliar novamente
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resetar aba de avaliação?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso removerá todas as referências forçadas, imóveis bloqueados e restaurará o padrão antigo (Gamma) como layout padrão. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetConfigs} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Confirmar Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}

// Fallback amigável para erros de renderização
export function AvaliacaoFallback({ error, onReset, trackingId }: { error?: Error; onReset?: () => void; trackingId?: string }) {
  const handleTryAgain = useCallback(() => {
    // Resetar o estado da ferramenta localmente antes de re-renderizar
    const resetEvent = new CustomEvent('avaliacao:reset-state');
    window.dispatchEvent(resetEvent);

    if (onReset) {
      onReset();
    } else {
      window.location.reload();
    }
  }, [onReset]);

  return (
    <DashboardLayout>
      <div className="flex items-center justify-center min-h-[60vh] p-6 text-center">
        <Card className="max-w-md w-full border-destructive/20 shadow-lg animate-in fade-in zoom-in duration-300">
          <CardHeader className="pb-2">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <CardTitle className="text-2xl font-bold">Ops! Algo deu errado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-muted-foreground leading-relaxed">
              Não conseguimos carregar a ferramenta de avaliação no momento. Isso pode ser um problema temporário de conexão ou uma falha de sistema.
            </p>

            {error && (
              <div className="bg-destructive/5 p-3 rounded-lg border border-destructive/10 text-left">
                <p className="text-[10px] uppercase font-bold text-destructive/60 mb-1">Detalhes do erro:</p>
                <code className="text-[10px] text-destructive block break-words font-mono max-h-24 overflow-y-auto">
                  {error.message}
                </code>
              </div>
            )}

            {trackingId && (
              <div className="pt-2">
                <p className="text-[10px] text-muted-foreground font-mono">
                  ID de rastreio: <span className="text-foreground select-all font-bold">{trackingId}</span>
                </p>
              </div>
            )}

            
            <div className="flex flex-col gap-3">
              <Button 
                onClick={handleTryAgain} 
                variant="default"
                size="lg"
                className="gap-2 w-full shadow-sm font-bold"
              >
                <RefreshCw className="w-5 h-5 text-white" /> Tentar Novamente
              </Button>
              <Button 
                onClick={() => window.location.href = '/dashboard'} 
                variant="outline"
                className="w-full"
              >
                Ir para o Painel Principal
              </Button>
            </div>
            
            <p className="text-[11px] text-muted-foreground italic bg-muted/50 py-2 rounded">
              Se o problema persistir, entre em contato com o suporte técnico.
            </p>
          </CardContent>
        </Card>
      </div>

    </DashboardLayout>
  );
}




