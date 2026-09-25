import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useImoveis } from "@/hooks/useImoveis";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { scrapePortais, salvarImoveisMercado, getImoveisMercado, limparImoveisMercado, PORTAIS_DISPONIVEIS, type ImovelMercado } from "@/lib/api/portalScraper";
import { ResultFilters, getEmptyFilters, applyFilters, type FilterState } from "./ResultFilters";
import { ImportarImovelButton } from "./ImportarImovelButton";
import { ListaProprietariosDialog } from "@/components/captacao/ListaProprietariosDialog";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Download, Trash2, Globe, Loader2, Database, ExternalLink, ShieldCheck, ShieldAlert, ShieldQuestion, Brain, Bookmark, ListChecks, FileSpreadsheet, History, Calendar, FileText, XCircle, CheckCircle2, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useVirtualizer } from "@tanstack/react-virtual";
import { exportToExcel, exportToExcelMultiSheet } from "@/lib/exportExcel";

type AnaliseProprietario = {
  index: number;
  classificacao: "proprietario" | "imobiliaria" | "incerto";
  confianca: number;
  motivo: string;
  sinais: string[];
  nome?: string;
  email?: string;
  telefone?: string;
};

export function PortalScraperPanel({
  presetPortal,
  title,
  description,
}: {
  presetPortal?: string;
  title?: string;
  description?: string;
} = {}) {
  const { user, imobiliariaId, isMaster } = useAuth();
  const { toast } = useToast();
  const { createImovel, imoveis } = useImoveis();
  const [cidade, setCidade] = useState("Brasília");
  const [estado, setEstado] = useState("DF");
  const [tipo, setTipo] = useState("apartamento");
  const [operacao, setOperacao] = useState("Venda");
  const [portaisSelecionados, setPortaisSelecionados] = useState<string[]>(["olx", "mercadolivre", "chavenaomao", "quintoandar", "zapimoveis", "vivareal", "i123", "wimoveis"]);
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [resultados, setResultados] = useState<ImovelMercado[]>([]);
  const [dadosSalvos, setDadosSalvos] = useState<ImovelMercado[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [tab, setTab] = useState<"buscar" | "salvos">("buscar");
  const [filters, setFilters] = useState<FilterState>(getEmptyFilters());
  const [analisando, setAnalisando] = useState(false);
  const [analises, setAnalises] = useState<Record<number, AnaliseProprietario>>({});
  const [salvandoTodos, setSalvandoTodos] = useState(false);
  const [listaDialogOpen, setListaDialogOpen] = useState(false);
  const [exportingBatch, setExportingBatch] = useState(false);
  const [batchExportId, setBatchExportId] = useState<string | null>(null);
  const [exportProgress, setExportProgress] = useState(0);
  const [lastExport, setLastExport] = useState<{ url: string; filename: string } | null>(null);
  const [savingToList, setSavingToList] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [exportHistory, setExportHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [salvarDialog, setSalvarDialog] = useState<{ imovel: ImovelMercado | null; nome: string; email: string; telefone: string }>({
    imovel: null,
    nome: "",
    email: "",
    telefone: "",
  });
  const [retryDialog, setRetryDialog] = useState<any>(null);
  const [cancelDialog, setCancelDialog] = useState<any>(null);
  const [confirmCancelImpact, setConfirmCancelImpact] = useState(false);
  const [historyPage, setHistoryPage] = useState(0);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyStatus, setHistoryStatus] = useState<string>("all");
  const [historySearch, setHistorySearch] = useState("");
  const itemsPerPage = 10;
  const [duplicateExport, setDuplicateExport] = useState<any>(null);
  const [fieldErrors, setFieldErrors] = useState<{ nome?: string; email?: string; telefone?: string }>({});
  const nomeRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const telefoneRef = useRef<HTMLInputElement>(null);
  
  const parentRef = useRef<HTMLDivElement>(null);

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "");
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  };

  const getImovelRowKey = (imovel: ImovelMercado) => imovel.id || imovel.url_anuncio || `${imovel.portal}-${imovel.titulo}`;
  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
  const isValidPhone = (value: string) => value.replace(/\D/g, "").length >= 10;

  useEffect(() => {
    if (presetPortal) {
      setPortaisSelecionados([presetPortal]);
    }
  }, [presetPortal]);

  // Garante que portais restritos não fiquem selecionados para não-Master
  useEffect(() => {
    if (!isMaster) {
      setPortaisSelecionados(prev => prev.filter(k => k !== 'alude' && k !== 'imovel_proprietario'));
    }
  }, [isMaster]);

  const togglePortal = (key: string) => {
    setPortaisSelecionados(prev =>
      prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key]
    );
  };

  const handleScrape = async () => {
    if (!cidade.trim()) {
      toast({ title: "Informe a cidade", variant: "destructive" });
      return;
    }
    setLoading(true);
    setErrors([]);
    setResultados([]);
    setAnalises({});

    try {
      const result = await scrapePortais(cidade, tipo, operacao, portaisSelecionados, estado);
      if (result.success && result.data) {
        setResultados(result.data);
        toast({ title: `${result.total} anúncios encontrados de ${result.portais_consultados} portais` });
        if (result.errors) setErrors(result.errors);
      } else {
        toast({ title: "Erro na busca", description: result.error, variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Erro ao conectar", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleAnaliseIA = async () => {
    const lista = imoveisExibidos.slice(0, 20);
    if (lista.length === 0) return;

    setAnalisando(true);
    try {
      const payload = lista.map(im => ({
        titulo: im.titulo,
        portal: im.portal,
        preco: im.preco,
        area: im.area,
        bairro: (im as any).bairro || null,
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

      if (data?.error) {
        toast({ title: "Erro na análise", description: data.error, variant: "destructive" });
        return;
      }

      if (data?.resultados) {
        const map: Record<number, AnaliseProprietario> = {};
        const novosResultados = [...resultados];
        
        (data.resultados as AnaliseProprietario[]).forEach(r => {
          map[r.index] = r;
          if (novosResultados[r.index]) {
            novosResultados[r.index] = {
              ...novosResultados[r.index],
              q_score: r.classificacao === "proprietario" ? r.confianca : 0,
              telefone: r.telefone || novosResultados[r.index].telefone,
              email: r.email || novosResultados[r.index].email,
            };
          }
        });
        
        setResultados(novosResultados);
        setAnalises(map);
        const proprietarios = data.resultados.filter((r: AnaliseProprietario) => r.classificacao === "proprietario").length;
        toast({
          title: `Análise concluída!`,
          description: `${proprietarios} de ${data.resultados.length} anúncios identificados como proprietários diretos.`,
        });
      }
    } catch (e: any) {
      toast({ title: "Erro na análise de IA", description: e?.message || "Não foi possível concluir a verificação.", variant: "destructive" });
    } finally {
      setAnalisando(false);
    }
  };

  const handleSalvar = async () => {
    if (!user || !imobiliariaId || resultados.length === 0) return;
    setSalvando(true);
    const result = await salvarImoveisMercado(imobiliariaId, resultados);
    setSalvando(false);
    if (result.success) {
      toast({ title: `${result.count} anúncios salvos no banco de dados` });
    } else {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    }
  };

  const handleCarregarSalvos = async () => {
    if (!user || !imobiliariaId) return;
    const data = await getImoveisMercado(imobiliariaId);
    setDadosSalvos(data);
    setTab("salvos");
  };

  const handleLimpar = async () => {
    if (!user || !imobiliariaId) return;
    await limparImoveisMercado(imobiliariaId);
    setDadosSalvos([]);
    toast({ title: "Dados de mercado limpos" });
  };

  const handleSalvarTodosProprietarios = async () => {
    if (!imobiliariaId) return;
    const proprietarioIndices = Object.entries(analises)
      .filter(([, a]) => a.classificacao === "proprietario")
      .map(([idx]) => Number(idx));

    if (proprietarioIndices.length === 0) {
      toast({ title: "Nenhum proprietário identificado pela IA", variant: "destructive" });
      return;
    }

    setSalvandoTodos(true);
    let salvos = 0;
    let erros = 0;

    for (const idx of proprietarioIndices) {
      const im = imoveisExibidos[idx];
      if (!im) continue;
      try {
        const descricao = im.url_anuncio
          ? `Importado via IA (Proprietário Direto). Anúncio: ${im.url_anuncio}`
          : "Importado via IA — classificado como Proprietário Direto.";

        const result = await createImovel({
          titulo: im.titulo,
          tipo: im.tipo || "Apartamento",
          operacao: im.operacao || "Venda",
          bairro: (im as any).bairro || null,
          cidade: (im as any).cidade || "Brasília",
          estado: (im as any).estado || "DF",
          preco: im.preco,
          area: im.area || 0,
          quartos: im.quartos || 0,
          banheiros: im.banheiros || 0,
          vagas: im.vagas || 0,
          descricao,
          status: "Ativo",
          fotos: (im as any).fotos?.length > 0 ? (im as any).fotos : [],
        });
        if (result) salvos++;
        else erros++;
      } catch {
        erros++;
      }
    }

    setSalvandoTodos(false);
    toast({
      title: `${salvos} imóvel(is) de proprietários salvos na carteira!`,
      description: erros > 0 ? `${erros} erro(s) durante importação.` : undefined,
    });
  };

  const abrirSalvarNaLista = (imovel: ImovelMercado) => {
    if (!isMaster) {
      toast({ title: "Acesso restrito", description: "A lista de proprietários é exclusiva do login Master.", variant: "destructive" });
      return;
    }

    const index = imoveisExibidos.findIndex(item => getImovelRowKey(item) === getImovelRowKey(imovel));
    const analise = analises[index];

    setSalvarDialog({ 
      imovel, 
      nome: analise?.nome || "", 
      email: analise?.email || "", 
      telefone: analise?.telefone || imovel.telefone || "" 
    });
  };

  const validateField = (field: "nome" | "email" | "telefone", value: string) => {
    const isGenericName = (val: string) => {
      const normalized = val.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      return /^(anuncio|proprietario|direto|particular|imovel|contato|vendedor|dono)$/i.test(normalized);
    };

    if (field === "nome") {
      if (!value || value.trim().length < 3 || isGenericName(value.trim())) {
        return "Nome inválido ou genérico. Ex: 'João da Silva'.";
      }
    }

    if (field === "email") {
      if (!isValidEmail(value)) {
        return "E-mail inválido. Ex: 'contato@email.com'.";
      }
    }

    if (field === "telefone") {
      const digits = value.replace(/\D/g, "");
      if (!isValidPhone(value) || /^(00|11|22|33|44|55|66|77|88|99)/.test(digits.substring(2, 4))) {
        return "Telefone inválido ou incompleto. Ex: '(61) 98765-4321'.";
      }
    }
    return undefined;
  };

  const confirmarSalvarNaLista = async () => {
    if (!imobiliariaId || !salvarDialog.imovel) return;

    const nome = salvarDialog.nome.trim();
    const email = salvarDialog.email.trim();
    const telefone = salvarDialog.telefone.trim();
    
    const errors: { nome?: string; email?: string; telefone?: string } = {
      nome: validateField("nome", nome),
      email: validateField("email", email),
      telefone: validateField("telefone", telefone),
    };

    // Remove undefined values
    Object.keys(errors).forEach(key => {
      if (!errors[key as keyof typeof errors]) delete errors[key as keyof typeof errors];
    });

    setFieldErrors(errors);
    
    if (Object.keys(errors).length > 0) {
      if (errors.nome) {
        nomeRef.current?.focus();
        toast({ title: "Erro no nome", description: errors.nome, variant: "destructive" });
      } else if (errors.email) {
        emailRef.current?.focus();
        toast({ title: "Erro no e-mail", description: errors.email, variant: "destructive" });
      } else if (errors.telefone) {
        telefoneRef.current?.focus();
        toast({ title: "Erro no telefone", description: errors.telefone, variant: "destructive" });
      }
      return;
    }

    const rowKey = getImovelRowKey(salvarDialog.imovel);
    const operacaoNorm = (salvarDialog.imovel.operacao || operacao || "").toLowerCase().includes("alugu") ? "aluguel" : "venda";

    setSavingToList(rowKey);

    // Verificação de duplicidade por telefone ou e-mail
    const { data: existente } = await supabase
      .from("lista_proprietarios_captacao")
      .select("id")
      .or(`telefone.eq.${telefone},email.eq.${email}`)
      .eq("imobiliaria_id", imobiliariaId)
      .maybeSingle();

    if (existente) {
      setSavingToList(null);
      toast({ 
        title: "Proprietário já cadastrado", 
        description: "Um contato com este telefone ou e-mail já existe na sua lista.", 
        variant: "destructive" 
      });
      return;
    }

    let status_revisao = "aprovado";
    let motivo_revisao: string | null = null;

    const nomeError = validateField("nome", nome);
    const emailError = validateField("email", email);
    const telefoneError = validateField("telefone", telefone);

    if (nomeError) {
      status_revisao = "pendente_revisao";
      motivo_revisao = "Nome suspeito ou genérico";
    } else if (emailError) {
      status_revisao = "pendente_revisao";
      motivo_revisao = "E-mail inválido";
    } else if (telefoneError) {
      status_revisao = "pendente_revisao";
      motivo_revisao = "Telefone suspeito ou inválido";
    }

    const { error } = await supabase.from("lista_proprietarios_captacao").insert({
      imobiliaria_id: imobiliariaId,
      nome_proprietario: nome,
      telefone,
      email,
      operacao: operacaoNorm,
      titulo_imovel: salvarDialog.imovel.titulo,
      bairro: salvarDialog.imovel.bairro || null,
      cidade: salvarDialog.imovel.cidade || cidade || null,
      preco: salvarDialog.imovel.preco || null,
      q_score: analises[imoveisExibidos.findIndex((item) => getImovelRowKey(item) === rowKey)]?.confianca ?? null,
      origem: presetPortal ? `portal_${presetPortal}` : `portal_${String(salvarDialog.imovel.portal || "captacao").toLowerCase().replace(/\s+/g, "_")}`,
      imovel_id_ref: salvarDialog.imovel.id || null,
      url_anuncio: salvarDialog.imovel.url_anuncio || null,
      observacoes: (salvarDialog.imovel.url_anuncio ? `Anúncio captado em ${salvarDialog.imovel.portal}. Link: ${salvarDialog.imovel.url_anuncio}` : `Anúncio captado em ${salvarDialog.imovel.portal}.`) + (motivo_revisao ? ` [REVISÃO: ${motivo_revisao}]` : ""),
      status_revisao,
      motivo_revisao,
      dados_extraidos_raw: {
        nome_original: nome,
        telefone_original: telefone,
        email_original: email,
        analise_ia: analises[imoveisExibidos.findIndex((item) => getImovelRowKey(item) === rowKey)] || null
      }
    });
    setSavingToList(null);

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }

    setSalvarDialog({ imovel: null, nome: "", email: "", telefone: "" });
    toast({ title: "Salvo na lista", description: `Proprietário adicionado à lista de ${operacaoNorm}.` });
  };

  const imoveisBase = tab === "buscar" ? resultados : dadosSalvos;
  const portaisUnicos = useMemo(() => [...new Set(imoveisBase.map(i => i.portal))], [imoveisBase]);
  const imoveisExibidos = useMemo(() => applyFilters(imoveisBase, filters), [imoveisBase, filters]);

  const virtualizer = useVirtualizer({
    count: imoveisExibidos.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 52,
    overscan: 10,
  });

  // Subscribe to Realtime updates for all exports of this imobiliaria
  useEffect(() => {
    if (!imobiliariaId) return;

    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'batch_exports',
          filter: `imobiliaria_id=eq.${imobiliariaId}`,
        },
        (payload) => {
          const updatedRecord = payload.new as any;
          if (!updatedRecord) return;

          // Update local history if open
          if (historyOpen) {
            setExportHistory(prev => 
              prev.map(item => item.id === updatedRecord.id ? updatedRecord : item)
            );
          }

          // Update duplicate export status if active
          setDuplicateExport(prev => 
            prev?.id === updatedRecord.id ? updatedRecord : prev
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [imobiliariaId, historyOpen]);

  const fetchExportHistory = useCallback(async () => {
    if (!imobiliariaId) return;
    setLoadingHistory(true);
    try {
      let query = supabase
        .from('batch_exports')
        .select('*', { count: 'exact' })
        .eq('imobiliaria_id', imobiliariaId);

      if (historyStatus !== "all") {
        query = query.eq('status', historyStatus);
      }

      if (historySearch) {
        query = query.or(`filename.ilike.%${historySearch}%,id.cast.text.ilike.%${historySearch}%`);
      }

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(historyPage * itemsPerPage, (historyPage + 1) * itemsPerPage - 1);
      
      if (error) throw error;
      setExportHistory(data || []);
      setHistoryTotal(count || 0);
    } catch (error) {
      console.error("Error fetching export history:", error);
    } finally {
      setLoadingHistory(false);
    }
  }, [imobiliariaId, historyStatus, historySearch, historyPage, historyOpen]);

  const handleCancelExport = async (item: any) => {
    if (!imobiliariaId || !item) return;
    
    const exportId = item.id;

    try {
      const { error } = await supabase
        .from('batch_exports')
        .update({ 
          status: 'failed', 
          error_message: 'Cancelado pelo usuário.' 
        })
        .eq('id', exportId)
        .eq('imobiliaria_id', imobiliariaId);

      if (error) throw error;
      
      toast({ title: "Exportação cancelada" });
      if (historyOpen) fetchExportHistory();
      
      // Also update duplicate export state if it's the one cancelled
      setDuplicateExport(prev => 
        prev?.id === exportId ? { ...prev, status: 'failed', error_message: 'Cancelado pelo usuário.' } : prev
      );
    } catch (error: any) {
      console.error("Cancel export error:", error);
      toast({ title: "Erro ao cancelar", description: error.message, variant: "destructive" });
    }
  };

  useEffect(() => {
    if (historyOpen) {
      fetchExportHistory();
    } else {
      setHistoryPage(0);
      setHistoryStatus("all");
      setHistorySearch("");
    }
  }, [historyOpen, historyPage, historyStatus]);

  // Use separate effect for search with debounce
  useEffect(() => {
    if (!historyOpen) return;
    const timer = setTimeout(() => {
      if (historyPage !== 0) {
        setHistoryPage(0);
      } else {
        fetchExportHistory();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [historySearch]);


  const handleExportExcel = async () => {
    if (imoveisExibidos.length === 0) {
      toast({ title: "Nenhum dado para exportar", variant: "destructive" });
      return;
    }

    if (!user || !imobiliariaId) {
      toast({ title: "Erro de autenticação", variant: "destructive" });
      return;
    }

    setExportingBatch(true);
    const filename = `captacao-${cidade}-${operacao}-${new Date().toISOString().slice(0, 10)}`;
    
    // Gerar chave de idempotência baseada em parâmetros e data (dia atual)
    const idempotencyData = {
      cidade, estado, tipo, operacao, 
      portais: portaisSelecionados, 
      filters, 
      date: new Date().toISOString().slice(0, 10)
    };
    const idempotencyKey = btoa(JSON.stringify(idempotencyData));

    try {
      // Verificar se já existe uma exportação idêntica pendente ou processando
      const { data: existing } = await supabase
        .from('batch_exports')
        .select('*')
        .eq('imobiliaria_id', imobiliariaId)
        .eq('idempotency_key', idempotencyKey)
        .in('status', ['pending', 'processing'])
        .maybeSingle();

      if (existing) {
        setExportingBatch(false);
        setDuplicateExport(existing);
        return;
      }

      const { data: exportRecord, error: exportError } = await supabase
        .from('batch_exports')
        .insert({
          user_id: user.id,
          imobiliaria_id: imobiliariaId,
          filename,
          total_items: imoveisExibidos.length,
          status: 'pending',
          filters: filters,
          idempotency_key: idempotencyKey,
          search_params: {
            cidade,
            estado,
            tipo,
            operacao,
            portais: portaisSelecionados
          }
        })
        .select()
        .single();

      if (exportError) {
        if (exportError.code === '23505') {
          setExportingBatch(false);
          const { data: current } = await supabase
            .from('batch_exports')
            .select('*')
            .eq('imobiliaria_id', imobiliariaId)
            .eq('idempotency_key', idempotencyKey)
            .in('status', ['pending', 'processing'])
            .maybeSingle();

          if (current) setDuplicateExport(current);
          return;
        }
        throw exportError;
      }

      setBatchExportId(exportRecord.id);

      const batchSize = 100;
      for (let i = 0; i < imoveisExibidos.length; i += batchSize) {
        const chunk = imoveisExibidos.slice(i, i + batchSize).map(im => ({
          export_id: exportRecord.id,
          data: {
            portal: im.portal,
            titulo: im.titulo,
            tipo: im.tipo,
            operacao: im.operacao,
            bairro: (im as any).bairro || "",
            cidade: (im as any).cidade || "",
            estado: (im as any).estado || "",
            preco: im.preco,
            area: im.area,
            quartos: im.quartos,
            banheiros: im.banheiros,
            vagas: im.vagas,
            telefone: im.telefone,
            email: im.email,
            url_anuncio: im.url_anuncio
          }
        }));

        const { error: queueError } = await supabase
          .from('export_queue_items')
          .insert(chunk);

        if (queueError) throw queueError;
      }

      supabase.functions.invoke('process-batch-export', {
        body: { exportId: exportRecord.id }
      }).catch(err => console.error("Edge function call error:", err));

      toast({ 
        title: "Exportação iniciada", 
        description: "O arquivo está sendo gerado em segundo plano. Você será notificado ao finalizar." 
      });

      // 4. Inscrição no Supabase Realtime para progresso em tempo real
      const channel = supabase
        .channel(`export-status-${exportRecord.id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'batch_exports',
            filter: `id=eq.${exportRecord.id}`,
          },
          (payload) => {
            const statusData = payload.new as any;
            if (statusData) {
              const progress = statusData.total_items > 0 
                ? Math.round((statusData.processed_items / statusData.total_items) * 100) 
                : 0;
              setExportProgress(progress);

              if (statusData.status === 'completed') {
                channel.unsubscribe();
                setExportingBatch(false);
                setBatchExportId(null);
                setExportProgress(0);
                if (statusData.download_url) {
                  setLastExport({ url: statusData.download_url, filename: statusData.filename });
                }
                toast({ 
                  title: "Exportação concluída! ✅", 
                  description: "Seu arquivo Excel está pronto para download.",
                  action: statusData.download_url ? (
                    <Button 
                      variant="default" 
                      size="sm" 
                      className="bg-success hover:bg-success/90"
                      onClick={() => window.open(statusData.download_url, '_blank')}
                    >
                      <Download className="w-3 h-3 mr-1" /> Baixar
                    </Button>
                  ) : undefined
                });
              } else if (statusData.status === 'failed') {
                channel.unsubscribe();
                setExportingBatch(false);
                setBatchExportId(null);
                setExportProgress(0);
                toast({ 
                  title: "Falha na exportação ❌", 
                  description: statusData.error_message || "Ocorreu um erro ao gerar o arquivo.", 
                  variant: "destructive" 
                });
              }
            }
          }
        )
        .subscribe();

    } catch (error: any) {
      console.error("Export error:", error);
      setExportingBatch(false);
      setBatchExportId(null);
      toast({ title: "Erro ao iniciar exportação", description: error.message, variant: "destructive" });
    }
  };

  const handleRetryExport = async (item: any) => {
    if (!user || !imobiliariaId) return;
    
    setLoadingHistory(true);
    try {
      // Se tiver parâmetros de busca salvos, vamos tentar buscar os dados atuais primeiro?
      // Ou re-exportar os dados exatos que estavam na fila?
      // O usuário pediu "a partir do mesmo filtro e datas anteriores", o que sugere re-executar a lógica.
      
      // Se tiver search_params, podemos restaurar o estado de busca
      if (item.search_params) {
        setCidade(item.search_params.cidade || cidade);
        setEstado(item.search_params.estado || estado);
        setTipo(item.search_params.tipo || tipo);
        setOperacao(item.search_params.operacao || operacao);
        setPortaisSelecionados(item.search_params.portais || portaisSelecionados);
      }
      
      if (item.filters) {
        setFilters(item.filters);
      }

      // Agora criamos um novo registro de exportação
      const filename = `${item.filename}-retry-${new Date().toISOString().slice(0, 10)}`;
      
      // Nova chave de idempotência para a reexecução (incluindo o timestamp para permitir a reexecução manual proposital)
      const idempotencyData = {
        originalId: item.id,
        timestamp: Date.now()
      };
      const idempotencyKey = btoa(JSON.stringify(idempotencyData));

      const { data: exportRecord, error: exportError } = await supabase
        .from('batch_exports')
        .insert({
          user_id: user.id,
          imobiliaria_id: imobiliariaId,
          filename,
          total_items: item.total_items,
          status: 'pending',
          filters: item.filters,
          search_params: item.search_params,
          idempotency_key: idempotencyKey
        })
        .select()
        .single();

      if (exportError) throw exportError;

      // 2. Buscar itens da fila da exportação anterior e copiar para a nova
      // Isso garante que se a falha foi no processamento do Excel, os dados originais são preservados
      const { data: oldItems, error: fetchError } = await supabase
        .from('export_queue_items')
        .select('data')
        .eq('export_id', item.id);
      
      if (fetchError) throw fetchError;

      if (oldItems && oldItems.length > 0) {
        const batchSize = 100;
        for (let i = 0; i < oldItems.length; i += batchSize) {
          const chunk = oldItems.slice(i, i + batchSize).map(oi => ({
            export_id: exportRecord.id,
            data: oi.data
          }));

          const { error: insertError } = await supabase
            .from('export_queue_items')
            .insert(chunk);
          
          if (insertError) throw insertError;
        }
      }

      // 3. Chamar a function
      supabase.functions.invoke('process-batch-export', {
        body: { exportId: exportRecord.id }
      }).catch(err => console.error("Edge function call error:", err));

      toast({ 
        title: "Reexecução iniciada", 
        description: "Os mesmos parâmetros e dados estão sendo processados novamente." 
      });
      
      setHistoryOpen(false);
      setDuplicateExport(null);
      setBatchExportId(exportRecord.id);
      setExportingBatch(true);
      setExportProgress(0);

      // Iniciar Realtime para o novo registro
      const channel = supabase
        .channel(`export-status-${exportRecord.id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'batch_exports',
            filter: `id=eq.${exportRecord.id}`,
          },
          (payload) => {
            const statusData = payload.new as any;
            if (statusData) {
              const progress = statusData.total_items > 0 
                ? Math.round((statusData.processed_items / statusData.total_items) * 100) 
                : 0;
              setExportProgress(progress);

              if (statusData.status === 'completed') {
                channel.unsubscribe();
                setExportingBatch(false);
                setBatchExportId(null);
                setExportProgress(0);
                if (statusData.download_url) {
                  setLastExport({ url: statusData.download_url, filename: statusData.filename });
                }
                toast({ title: "Exportação concluída! ✅" });
              } else if (statusData.status === 'failed') {
                channel.unsubscribe();
                setExportingBatch(false);
                setBatchExportId(null);
                setExportProgress(0);
                toast({ title: "Falha na exportação ❌", variant: "destructive" });
              }
            }
          }
        )
        .subscribe();

    } catch (error: any) {
      console.error("Retry export error:", error);
      toast({ title: "Erro ao reexecutar exportação", description: error.message, variant: "destructive" });
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleExportTudo = async () => {
    if (resultados.length === 0) {
      toast({ title: "Nenhum resultado de busca para exportar", variant: "destructive" });
      return;
    }
    handleExportExcel();
  };

  const getClassificacaoBadge = (analise: AnaliseProprietario | undefined) => {
    if (!analise) return null;
    const { classificacao, confianca } = analise;
    if (classificacao === "proprietario") {
      return (
        <Badge variant="outline" className="gap-1 text-[10px] border-success/30 bg-success/10 text-success hover:bg-success/15">
          <ShieldCheck className="w-3 h-3" />
          Proprietário {confianca}%
        </Badge>
      );
    }
    if (classificacao === "imobiliaria") {
      return (
        <Badge variant="outline" className="gap-1 text-[10px] border-warning/30 bg-warning/10 text-warning hover:bg-warning/15">
          <ShieldAlert className="w-3 h-3" />
          Imobiliária {confianca}%
        </Badge>
      );
    }
    return (
      <Badge className="gap-1 text-[10px] bg-muted text-muted-foreground border-border hover:bg-muted/80">
        <ShieldQuestion className="w-3 h-3" />
        Incerto {confianca}%
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      {/* Search Controls */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" />
            {title ?? "Captura de Dados Reais — Portais Imobiliários"}
          </CardTitle>
          <CardDescription>
            {description ?? "Somente portais onde proprietários anunciam direto — sem intermediação obrigatória"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <Select value={cidade} onValueChange={setCidade}>
              <SelectTrigger><SelectValue placeholder="Cidade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Brasília">Brasília</SelectItem>
                <SelectItem value="Águas Claras">Águas Claras</SelectItem>
                <SelectItem value="Taguatinga">Taguatinga</SelectItem>
                <SelectItem value="Ceilândia">Ceilândia</SelectItem>
                <SelectItem value="Samambaia">Samambaia</SelectItem>
                <SelectItem value="Guará">Guará</SelectItem>
                <SelectItem value="Sobradinho">Sobradinho</SelectItem>
                <SelectItem value="Planaltina">Planaltina</SelectItem>
                <SelectItem value="Gama">Gama</SelectItem>
                <SelectItem value="Santa Maria">Santa Maria</SelectItem>
                <SelectItem value="Recanto das Emas">Recanto das Emas</SelectItem>
                <SelectItem value="Vicente Pires">Vicente Pires</SelectItem>
                <SelectItem value="São Sebastião">São Sebastião</SelectItem>
                <SelectItem value="Valparaíso">Valparaíso de Goiás</SelectItem>
                <SelectItem value="Novo Gama">Novo Gama</SelectItem>
                <SelectItem value="Luziânia">Luziânia</SelectItem>
                <SelectItem value="Águas Lindas">Águas Lindas de Goiás</SelectItem>
                <SelectItem value="Formosa">Formosa</SelectItem>
              </SelectContent>
            </Select>
            <Select value={estado} onValueChange={setEstado}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="DF">DF</SelectItem>
                <SelectItem value="GO">GO (Entorno)</SelectItem>
              </SelectContent>
            </Select>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="apartamento">Apartamento</SelectItem>
                <SelectItem value="casa">Casa</SelectItem>
                <SelectItem value="terreno">Terreno</SelectItem>
                <SelectItem value="comercial">Comercial</SelectItem>
                <SelectItem value="sala">Sala</SelectItem>
              </SelectContent>
            </Select>
            <Select value={operacao} onValueChange={setOperacao}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Venda">Venda</SelectItem>
                <SelectItem value="Aluguel">Aluguel</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleScrape} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {loading ? "Buscando..." : presetPortal ? `Buscar na ${title ?? "plataforma"}` : "Buscar Portais"}
            </Button>
          </div>

          {/* Portal Checkboxes (Alude e Imóvel do Proprietário só para Master) */}
          <div className="flex flex-wrap gap-3">
            {PORTAIS_DISPONIVEIS
              .filter(p => isMaster || (p.key !== 'alude' && p.key !== 'imovel_proprietario'))
              .map(p => (
                <label key={p.key} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <Checkbox
                    checked={portaisSelecionados.includes(p.key)}
                    onCheckedChange={() => togglePortal(p.key)}
                    disabled={presetPortal === p.key}
                  />
                  {p.label}
                </label>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Errors */}
      {errors.length > 0 && (
        <Card className="border-destructive/30">
          <CardContent className="p-3">
            <p className="text-xs font-medium text-destructive mb-1">Avisos de portais:</p>
            {errors.map((e, i) => (
              <p key={i} className="text-xs text-muted-foreground">{e}</p>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Export Progress Bar */}
      {exportingBatch && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 space-y-2">
            <div className="flex justify-between items-center text-sm font-medium">
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                Processando exportação em lote...
              </span>
              <span className="text-primary">{exportProgress}%</span>
            </div>
            <Progress value={exportProgress} className="h-2" />
            <p className="text-[10px] text-muted-foreground">
              Você pode continuar navegando. O arquivo será disponibilizado via notificação assim que estiver pronto.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Duplicate Export Alert */}
      {duplicateExport && (
        <Card className="border-destructive/30 bg-destructive/5 animate-in fade-in slide-in-from-top-2 duration-300">
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-destructive/10 text-destructive">
                {duplicateExport.status === 'completed' ? (
                  <CheckCircle2 className="w-5 h-5 text-success" />
                ) : duplicateExport.status === 'failed' ? (
                  <XCircle className="w-5 h-5" />
                ) : (
                  <Loader2 className="w-5 h-5 animate-spin" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-destructive">
                  {duplicateExport.status === 'completed' ? 'Exportação finalizada' : 
                   duplicateExport.status === 'failed' ? 'Exportação falhou' : 
                   'Exportação idêntica em andamento'}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="text-[10px] h-4">
                    {duplicateExport.status === 'processing' ? 'Processando' : 
                     duplicateExport.status === 'pending' ? 'Pendente' : 
                     duplicateExport.status === 'completed' ? 'Concluída' : 'Falha'}
                  </Badge>
                  {duplicateExport.status !== 'completed' && duplicateExport.status !== 'failed' && (
                    <span className="text-[10px] text-muted-foreground font-medium">
                      Progresso: {duplicateExport.total_items > 0 ? Math.round((duplicateExport.processed_items / duplicateExport.total_items) * 100) : 0}%
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground">• ID: {duplicateExport.id.slice(0, 8)}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button 
                size="sm" 
                variant="outline" 
                className="h-8 text-xs border-destructive/20 hover:bg-destructive/10"
                onClick={() => {
                  setDuplicateExport(null);
                  if (historySearch && historyOpen) {
                    setHistorySearch("");
                  }
                }}
              >
                Fechar
              </Button>
              <div className="flex flex-col gap-1">
                {duplicateExport.status === 'completed' ? (
                  <Button 
                    size="sm" 
                    className="h-7 text-[10px] py-0 bg-success hover:bg-success/90"
                    onClick={() => {
                      if (duplicateExport.download_url) window.open(duplicateExport.download_url, '_blank');
                    }}
                  >
                    Baixar Excel
                  </Button>
                ) : (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="h-7 text-[10px] py-0"
                    onClick={() => {
                      setHistoryOpen(true);
                      setHistorySearch(duplicateExport.id.slice(0, 8));
                      setDuplicateExport(null);
                    }}
                  >
                    Ver Histórico
                  </Button>
                )}
                {(duplicateExport.status === 'processing' || duplicateExport.status === 'pending') && (
                  <Button 
                    size="sm" 
                    variant="destructive" 
                    className="h-7 text-[10px] py-0"
                    onClick={() => setCancelDialog(duplicateExport)}
                  >
                    Cancelar
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
          {duplicateExport.total_items > 0 && duplicateExport.status !== 'completed' && duplicateExport.status !== 'failed' && (
            <Progress 
              value={(duplicateExport.processed_items / duplicateExport.total_items) * 100} 
              className="h-1 rounded-none bg-transparent"
            />
          )}
        </Card>
      )}

      {/* Progress Bar for the new export being created */}
      {exportingBatch && !duplicateExport && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 space-y-2">
            <div className="flex justify-between items-center text-sm font-medium">
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                Processando nova exportação...
              </span>
              <span className="text-primary">{exportProgress}%</span>
            </div>
            <Progress value={exportProgress} className="h-2" />
            <p className="text-[10px] text-muted-foreground">
              Sua exportação está sendo gerada. Você pode continuar navegando normalmente.
            </p>
          </CardContent>
        </Card>
      )}

      {lastExport && !exportingBatch && (
        <Card className="border-success/30 bg-success/5 animate-in fade-in slide-in-from-top-2 duration-300">
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-success/10 text-success">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-success">Exportação finalizada!</p>
                <p className="text-xs text-muted-foreground truncate max-w-[200px] md:max-w-xs">
                  {lastExport.filename}.xlsx
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                size="sm" 
                variant="outline" 
                className="h-8 text-xs"
                onClick={() => setLastExport(null)}
              >
                Fechar
              </Button>
              <Button 
                size="sm" 
                className="h-8 text-xs bg-success hover:bg-success/90 gap-1"
                onClick={() => window.open(lastExport.url, '_blank')}
              >
                <Download className="w-3 h-3" /> Baixar Excel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Bar */}
      {(resultados.length > 0 || dadosSalvos.length > 0) && (
        <div className="flex items-center gap-2 flex-wrap">
          {isMaster && (
            <Button size="sm" variant="default" onClick={() => setListaDialogOpen(true)} className="gap-1">
              <ListChecks className="w-3 h-3" /> Lista Proprietários
            </Button>
          )}
          <Button
            size="sm"
            variant={tab === "buscar" ? "default" : "outline"}
            onClick={() => setTab("buscar")}
            className="gap-1"
          >
            <Search className="w-3 h-3" />
            Resultados ({resultados.length})
          </Button>
          <Button
            size="sm"
            variant={tab === "salvos" ? "default" : "outline"}
            onClick={handleCarregarSalvos}
            className="gap-1"
          >
            <Database className="w-3 h-3" />
            Salvos ({dadosSalvos.length})
          </Button>
          {resultados.length > 0 && (
            <Button size="sm" variant="outline" onClick={handleSalvar} disabled={salvando} className="gap-1">
              <Download className="w-3 h-3" />
              {salvando ? "Salvando..." : "Salvar no Banco"}
            </Button>
          )}
          {imoveisExibidos.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleAnaliseIA}
              disabled={analisando}
              className="gap-1 border-primary/30 text-primary hover:bg-primary/10"
            >
              {analisando ? <Loader2 className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />}
              {analisando ? "Analisando IA..." : `Verificar Proprietário (IA)`}
            </Button>
          )}
          {Object.keys(analises).length > 0 && (
            <Button
              size="sm"
              variant="default"
              onClick={handleSalvarTodosProprietarios}
              disabled={salvandoTodos}
              className="gap-1"
            >
              {salvandoTodos ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
              {salvandoTodos ? "Salvando..." : `Salvar Proprietários na Carteira (${Object.values(analises).filter(a => a.classificacao === "proprietario").length})`}
            </Button>
          )}
          {imoveisExibidos.length > 0 && (
            <Button size="sm" variant="outline" onClick={handleExportExcel} disabled={exportingBatch} className="gap-1 border-success/30 text-success hover:bg-success/10">
              {exportingBatch ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileSpreadsheet className="w-3 h-3" />}
              {exportingBatch ? "Exportando..." : `Baixar Todos (${imoveisExibidos.length}) Excel`}
            </Button>
          )}
          <Button size="sm" onClick={handleExportTudo} disabled={exportingBatch} className="gap-1">
            {exportingBatch ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
            {exportingBatch ? "Processando..." : "Baixar Tudo (Carteira + Busca)"}
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => {
              setHistoryOpen(true);
              setHistorySearch("");
            }} 
            className="gap-1 border-muted-foreground/30"
          >
            <History className="w-3 h-3" />
            Histórico
          </Button>
          {dadosSalvos.length > 0 && tab === "salvos" && (
            <Button size="sm" variant="ghost" onClick={handleLimpar} className="gap-1 text-destructive">
              <Trash2 className="w-3 h-3" />
              Limpar Salvos
            </Button>
          )}
        </div>
      )}

      {/* Filters */}
      {imoveisBase.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <ResultFilters
              filters={filters}
              onChange={setFilters}
              portais={portaisUnicos}
              totalResults={imoveisBase.length}
              filteredCount={imoveisExibidos.length}
            />
          </CardContent>
        </Card>
      )}

      {/* Statistics Summary */}
      {imoveisExibidos.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {(() => {
            const total = imoveisExibidos.length;
            if (total === 0) return null;
            const avgPreco = total > 0 ? imoveisExibidos.reduce((a, b) => a + (b.preco || 0), 0) / total : 0;
            const imoveisComArea = imoveisExibidos.filter(i => i.area && i.area > 0);
            const avgArea = imoveisComArea.length > 0 ? imoveisComArea.reduce((a, b) => a + b.area, 0) / imoveisComArea.length : 0;
            const imoveisComM2 = imoveisExibidos.filter(i => i.preco_m2 && i.preco_m2 > 0);
            const avgM2 = imoveisComM2.length > 0 ? imoveisComM2.reduce((a, b) => a + b.preco_m2, 0) / imoveisComM2.length : 0;
            const propCount = Object.values(analises || {}).filter(a => a.classificacao === "proprietario").length;
            const portalCount = [...new Set(imoveisExibidos.map(i => i.portal))].length;
            return [
              { label: "Anúncios", value: String(total), color: "text-primary" },
              { label: "Portais", value: String(portalCount), color: "text-chart-2" },
              { label: "Preço Médio", value: avgPreco.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }), color: "text-foreground" },
              { label: "Área Média", value: `${Math.round(avgArea)}m²`, color: "text-foreground" },
              { label: "R$/m² Médio", value: Math.round(avgM2).toLocaleString("pt-BR"), color: "text-chart-1" },
              ...(propCount > 0 ? [{ label: "🏠 Proprietários", value: String(propCount), color: "text-success" }] : [{ label: "IA Análise", value: "Clique acima", color: "text-muted-foreground" }]),
            ].map((kpi, i) => (
              <div key={i} className="p-2 rounded-lg bg-card border text-center">
                <p className="text-[10px] text-muted-foreground font-medium">{kpi.label}</p>
                <p className={`text-sm font-bold ${kpi.color}`}>{kpi.value}</p>
              </div>
            ));
          })()}
        </div>
      )}

      {/* Results Table with Virtualization */}
      {imoveisExibidos.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardContent className="p-0">
              <div 
                ref={parentRef}
                className="overflow-auto max-h-[600px] relative"
                style={{ contain: 'strict' }}
              >
                <div
                  style={{
                    height: `${virtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative',
                  }}
                >
                  <table className="w-full text-sm border-collapse">
                    <thead className="sticky top-0 z-10 bg-background border-b shadow-sm">
                      <tr className="bg-muted/30">
                        <th className="text-left p-3 font-medium w-[100px]">Portal</th>
                        <th className="text-left p-3 font-medium min-w-[200px]">Título</th>
                        <th className="text-left p-3 font-medium">Bairro</th>
                        <th className="text-right p-3 font-medium">Preço</th>
                        <th className="text-right p-3 font-medium">Área</th>
                        <th className="text-right p-3 font-medium">R$/m²</th>
                        <th className="text-center p-3 font-medium">Quartos</th>
                        {Object.keys(analises).length > 0 && (
                          <th className="text-center p-3 font-medium">
                            <span className="flex items-center gap-1 justify-center">
                              <Brain className="w-3 h-3" /> Análise IA
                            </span>
                          </th>
                        )}
                        <th className="text-center p-3 font-medium">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      <TooltipProvider>
                        {virtualizer.getVirtualItems().map((virtualRow) => {
                          const im = imoveisExibidos[virtualRow.index];
                          const analise = analises[virtualRow.index];
                          return (
                            <tr 
                              key={virtualRow.key}
                              data-index={virtualRow.index}
                              ref={virtualizer.measureElement}
                              className="border-b hover:bg-muted/20 transition-colors cursor-pointer absolute top-0 left-0 w-full"
                              style={{
                                transform: `translateY(${virtualRow.start}px)`,
                                height: `${virtualRow.size}px`,
                              }}
                              onClick={() => im.url_anuncio && window.open(im.url_anuncio, '_blank', 'noopener,noreferrer')}
                            >
                              <td className="p-3">
                                <Badge variant="outline" className="text-xs">{im.portal}</Badge>
                              </td>
                              <td className="p-3 max-w-[200px] truncate font-medium">{im.titulo}</td>
                              <td className="p-3 text-sm text-muted-foreground">{(im as any).bairro || "-"}</td>
                              <td className="p-3 text-right">
                                {im.preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                              </td>
                              <td className="p-3 text-right">{im.area > 0 ? `${im.area}m²` : "-"}</td>
                              <td className="p-3 text-right">
                                {im.preco_m2 > 0 ? im.preco_m2.toLocaleString("pt-BR") : "-"}
                              </td>
                              <td className="p-3 text-center">{im.quartos || "-"}</td>
                              {Object.keys(analises).length > 0 && (
                                <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                                  {analise ? (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="inline-flex">
                                          {getClassificacaoBadge(analise)}
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent side="left" className="max-w-xs">
                                        <p className="font-medium text-sm mb-1">{analise.motivo}</p>
                                        <ul className="text-xs text-muted-foreground space-y-0.5">
                                          {analise.sinais.map((s, j) => (
                                            <li key={j}>• {s}</li>
                                          ))}
                                        </ul>
                                      </TooltipContent>
                                    </Tooltip>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">—</span>
                                  )}
                                </td>
                              )}
                              <td className="p-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  {im.url_anuncio ? (
                                    <a href={im.url_anuncio} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline text-xs">
                                      <ExternalLink className="w-3 h-3" /> Ver
                                    </a>
                                  ) : "-"}
                                  {isMaster && (
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        abrirSalvarNaLista(im);
                                      }}
                                      title="Salvar na lista de proprietários"
                                    >
                                      {savingToList === getImovelRowKey(im) ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bookmark className="w-3 h-3 text-primary" />}
                                    </Button>
                                  )}
                                  <ImportarImovelButton
                                    imovel={{
                                      titulo: im.titulo,
                                      tipo: im.tipo,
                                      operacao: im.operacao,
                                      bairro: (im as any).bairro,
                                      cidade: (im as any).cidade,
                                      estado: (im as any).estado,
                                      preco: im.preco,
                                      area: im.area,
                                      quartos: im.quartos,
                                      banheiros: im.banheiros,
                                      vagas: im.vagas,
                                      url_anuncio: im.url_anuncio,
                                      fotos: (im as any).fotos,
                                    }}
                                    size="icon"
                                    variant="ghost"
                                  />
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </TooltipProvider>
                    </tbody>
                  </table>
                </div>
              </div>
              <p className="text-xs text-muted-foreground p-3 text-center border-t">
                Exibindo todos os {imoveisExibidos.length} resultados com virtualização de alta performance.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <ListaProprietariosDialog open={listaDialogOpen} onOpenChange={setListaDialogOpen} />

      <Dialog open={!!salvarDialog.imovel} onOpenChange={(open) => { if (!open) setSalvarDialog({ imovel: null, nome: "", email: "", telefone: "" }); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bookmark className="w-4 h-4 text-primary" /> Salvar proprietário na lista
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Preencha os dados do proprietário para salvar na lista exportável de captação.
            </p>
            <div className="space-y-1">
              <Label className={`text-xs ${fieldErrors.nome ? 'text-destructive' : ''}`}>Nome do proprietário *</Label>
              <Input 
                ref={nomeRef}
                value={salvarDialog.nome} 
                onChange={(e) => {
                  const val = e.target.value;
                  setSalvarDialog((prev) => ({ ...prev, nome: val }));
                  const error = validateField("nome", val);
                  setFieldErrors(prev => ({ ...prev, nome: error }));
                }} 
                onBlur={(e) => {
                  const error = validateField("nome", e.target.value);
                  setFieldErrors(prev => ({ ...prev, nome: error }));
                }}
                placeholder="Ex.: João Silva" 
                className={fieldErrors.nome ? 'border-destructive' : ''}
              />
              {fieldErrors.nome && <p className="text-[10px] text-destructive">{fieldErrors.nome}</p>}
            </div>
            <div className="space-y-1">
              <Label className={`text-xs ${fieldErrors.email ? 'text-destructive' : ''}`}>E-mail *</Label>
              <Input 
                ref={emailRef}
                type="email" 
                value={salvarDialog.email} 
                onChange={(e) => {
                  const val = e.target.value;
                  setSalvarDialog((prev) => ({ ...prev, email: val }));
                  const error = validateField("email", val);
                  setFieldErrors(prev => ({ ...prev, email: error }));
                }} 
                onBlur={(e) => {
                  const error = validateField("email", e.target.value);
                  setFieldErrors(prev => ({ ...prev, email: error }));
                }}
                placeholder="proprietario@exemplo.com" 
                className={fieldErrors.email ? 'border-destructive' : ''}
              />
              {fieldErrors.email && <p className="text-[10px] text-destructive">{fieldErrors.email}</p>}
            </div>
            <div className="space-y-1">
              <Label className={`text-xs ${fieldErrors.telefone ? 'text-destructive' : ''}`}>Telefone *</Label>
              <Input 
                ref={telefoneRef}
                value={salvarDialog.telefone} 
                onChange={(e) => {
                  const val = formatPhone(e.target.value);
                  setSalvarDialog((prev) => ({ ...prev, telefone: val }));
                  const error = validateField("telefone", val);
                  setFieldErrors(prev => ({ ...prev, telefone: error }));
                }}
                onBlur={(e) => {
                  const error = validateField("telefone", e.target.value);
                  setFieldErrors(prev => ({ ...prev, telefone: error }));
                }}
                placeholder="(61) 99999-0000" 
                className={fieldErrors.telefone ? 'border-destructive' : ''}
              />
              {fieldErrors.telefone && <p className="text-[10px] text-destructive">{fieldErrors.telefone}</p>}
            </div>
            <Button onClick={confirmarSalvarNaLista} disabled={!salvarDialog.imovel || !!savingToList} className="w-full gap-2">
              {savingToList ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bookmark className="w-4 h-4" />}
              Salvar na lista
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Export History Dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-primary" />
              Histórico de Exportações
            </DialogTitle>
          </DialogHeader>

          <div className="mt-4 flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome do arquivo..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <Select value={historyStatus} onValueChange={setHistoryStatus}>
              <SelectTrigger className="w-full md:w-[150px] h-9">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Status</SelectItem>
                <SelectItem value="completed">Concluídos</SelectItem>
                <SelectItem value="failed">Falhas</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="processing">Processando</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {historySearch && (
            <div className="mt-2 flex items-center justify-between bg-primary/5 p-2 rounded border border-primary/10">
              <span className="text-[10px] text-primary font-medium">Filtrando por ID: {historySearch}</span>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-5 text-[10px] hover:bg-primary/10"
                onClick={() => setHistorySearch("")}
              >
                Limpar Busca
              </Button>
            </div>
          )}
          
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar mt-4">
            {loadingHistory ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Carregando histórico...</p>
              </div>
            ) : exportHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-3 text-center">
                <div className="p-4 rounded-full bg-muted">
                  <FileSpreadsheet className="w-8 h-8 text-muted-foreground/50" />
                </div>
                <div>
                  <p className="font-medium text-muted-foreground">Nenhuma exportação encontrada</p>
                  <p className="text-xs text-muted-foreground/70">As exportações realizadas aparecerão aqui.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {exportHistory.map((item) => (
                  <div 
                    key={item.id} 
                    className="p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors flex items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`p-2 rounded-full flex-shrink-0 ${
                        item.status === 'completed' ? 'bg-success/10 text-success' : 
                        item.status === 'failed' ? 'bg-destructive/10 text-destructive' : 
                        'bg-primary/10 text-primary'
                      }`}>
                        {item.status === 'completed' ? <CheckCircle2 className="w-4 h-4" /> : 
                         item.status === 'failed' ? <XCircle className="w-4 h-4" /> : 
                         <Loader2 className="w-4 h-4 animate-spin" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{item.filename}.xlsx</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(item.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </span>
                          <span className="text-[10px] text-muted-foreground">•</span>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <FileText className="w-3 h-3" />
                            {item.total_items} registros
                          </span>
                        </div>
                        {item.search_params && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-muted/30">
                              {item.search_params.cidade}
                            </Badge>
                            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-muted/30">
                              {item.search_params.tipo}
                            </Badge>
                          </div>
                        )}
                        {item.status === 'failed' && item.error_message && (
                          <p className="text-[10px] text-destructive mt-1 italic">Erro: {item.error_message}</p>
                        )}
                      </div>
                    </div>
                    
                    {item.status === 'completed' && item.download_url && (
                      <Button 
                        size="sm" 
                        className="flex-shrink-0 h-8 gap-1 bg-success hover:bg-success/90"
                        onClick={() => window.open(item.download_url, '_blank')}
                      >
                        <Download className="w-3 h-3" />
                        Baixar
                      </Button>
                    )}
                    
                    {item.status === 'failed' && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="flex-shrink-0 h-8 gap-1 border-primary/30 text-primary hover:bg-primary/5"
                        onClick={() => setRetryDialog(item)}
                      >
                        <RotateCcw className="w-3 h-3" />
                        Reexecutar
                      </Button>
                    )}
                    
                    {item.status === 'processing' && (
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="animate-pulse border-primary text-primary">
                          Processando...
                        </Badge>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          onClick={() => setCancelDialog(item)}
                          title="Cancelar Exportação"
                        >
                          <XCircle className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="mt-4 pt-4 border-t flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={historyPage === 0 || loadingHistory}
                onClick={() => setHistoryPage(p => p - 1)}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-xs text-muted-foreground">
                Página {historyPage + 1} de {Math.max(1, Math.ceil(historyTotal / itemsPerPage))}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={(historyPage + 1) * itemsPerPage >= historyTotal || loadingHistory}
                onClick={() => setHistoryPage(p => p + 1)}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            <Button variant="outline" onClick={() => setHistoryOpen(false)}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Retry Export Confirmation Dialog */}
      <Dialog open={!!retryDialog} onOpenChange={(open) => !open && setRetryDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-primary" />
              Confirmar Reexecução
            </DialogTitle>
          </DialogHeader>
          
          {retryDialog && (
            <div className="space-y-4 py-2">
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <p className="text-xs font-bold text-destructive flex items-center gap-1 mb-1">
                  <XCircle className="w-3 h-3" /> Motivo da Falha:
                </p>
                <p className="text-xs text-destructive italic">
                  {retryDialog.error_message || "Erro desconhecido durante o processamento."}
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Parâmetros Originais:</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded border bg-muted/30">
                    <p className="text-[10px] text-muted-foreground">Localização</p>
                    <p className="text-xs font-medium">{retryDialog.search_params?.cidade || "-"}, {retryDialog.search_params?.estado || "-"}</p>
                  </div>
                  <div className="p-2 rounded border bg-muted/30">
                    <p className="text-[10px] text-muted-foreground">Tipo / Operação</p>
                    <p className="text-xs font-medium capitalize">{retryDialog.search_params?.tipo || "-"} / {retryDialog.search_params?.operacao || "-"}</p>
                  </div>
                </div>
                
                {retryDialog.filters && (
                  <div className="p-2 rounded border bg-muted/30">
                    <p className="text-[10px] text-muted-foreground mb-1">Filtros Aplicados</p>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(retryDialog.filters).map(([key, value]) => {
                        if (!value || value === "todos" || value === "") return null;
                        return (
                          <Badge key={key} variant="secondary" className="text-[9px] px-1 h-4">
                            {key}: {String(value)}
                          </Badge>
                        );
                      })}
                      {(!retryDialog.filters || Object.values(retryDialog.filters).every(v => !v || v === "todos" || v === "")) && (
                        <span className="text-[10px] text-muted-foreground italic">Nenhum filtro aplicado</span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-2 flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setRetryDialog(null)}>
                  Cancelar
                </Button>
                <Button 
                  className="flex-1 gap-2" 
                  onClick={() => {
                    handleRetryExport(retryDialog);
                    setRetryDialog(null);
                  }}
                >
                  <RotateCcw className="w-4 h-4" />
                  Iniciar Agora
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel Export Confirmation Dialog */}
      <Dialog open={!!cancelDialog} onOpenChange={(open) => {
        if (!open) {
          setCancelDialog(null);
          setConfirmCancelImpact(false);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-destructive" />
              Confirmar Cancelamento
            </DialogTitle>
          </DialogHeader>
          
          {cancelDialog && (
            <div className="space-y-4 py-2">
              <div className="p-4 rounded-lg bg-orange-50 border border-orange-200">
                <p className="text-sm text-orange-800 font-medium">Atenção ao cancelar esta exportação:</p>
                <ul className="text-xs text-orange-700 mt-2 space-y-1 list-disc pl-4">
                  <li>O processamento de <strong>{cancelDialog.total_items} itens</strong> será interrompido.</li>
                  <li>O progresso atual de <strong>{Math.round((cancelDialog.processed_items / cancelDialog.total_items) * 100)}%</strong> será perdido.</li>
                  <li>Nenhum arquivo Excel será gerado para esta tentativa.</li>
                </ul>
              </div>

              <div className="flex items-start space-x-2 p-3 border rounded bg-accent/5">
                <Checkbox 
                  id="confirm-impact" 
                  checked={confirmCancelImpact}
                  onCheckedChange={(checked) => setConfirmCancelImpact(!!checked)}
                />
                <Label 
                  htmlFor="confirm-impact" 
                  className="text-xs font-normal leading-snug cursor-pointer"
                >
                  Estou ciente de que o progresso atual será perdido e nenhum arquivo será gerado.
                </Label>
              </div>

              <div className="space-y-1 bg-muted/30 p-3 rounded border">
                <p className="text-[10px] text-muted-foreground uppercase font-bold">Arquivo:</p>
                <p className="text-xs font-medium truncate">{cancelDialog.filename}.xlsx</p>
              </div>

              <div className="pt-2 flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => {
                  setCancelDialog(null);
                  setConfirmCancelImpact(false);
                }}>
                  Manter Exportação
                </Button>
                <Button 
                  variant="destructive"
                  className="flex-1 gap-2" 
                  disabled={!confirmCancelImpact}
                  onClick={() => {
                    handleCancelExport(cancelDialog);
                    setCancelDialog(null);
                    setConfirmCancelImpact(false);
                  }}
                >
                  <XCircle className="w-4 h-4" />
                  Confirmar e Parar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
