import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { 
  AlertCircle, 
  Search, 
  User, 
  Building2, 
  Calendar as LucideCalendar, 
  Code2, 
  ChevronDown, 
  ChevronUp,
  Loader2,
  RefreshCw,
  Bug,
  LayoutList,
  Filter,
  ExternalLink,
  Info,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  CalendarDays,
  Home,
  RotateCcw
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { logger } from "@/lib/logger";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

interface SystemLog {
  id: string;
  correlation_id: string | null;
  user_id: string;
  module: string;
  action: string;
  level: string;
  message: string;
  metadata: any;
  stack_trace: string | null;
  created_at: string;
  profiles?: {
    nome: string;
    email: string;
  };
}

const getLevelBadge = (level: string) => {
  switch (level?.toLowerCase()) {
    case "error":
    case "fatal":
      return <Badge variant="destructive" className="gap-1"><AlertCircle className="w-3 h-3" /> Erro</Badge>;
    case "warn":
      return <Badge className="bg-amber-500 hover:bg-amber-600 gap-1 text-white"><AlertCircle className="w-3 h-3" /> Aviso</Badge>;
    case "info":
      return <Badge variant="secondary" className="gap-1 text-blue-600 bg-blue-50 border-blue-100"><Info className="w-3 h-3" /> Info</Badge>;
    default:
      return <Badge variant="outline">{level}</Badge>;
  }
};


// Fallback amigável para erros de renderização
export function DiagnosticoFallback({ error, onReset, trackingId }: { error?: Error; onReset?: () => void; trackingId?: string }) {
  return (
    <DashboardLayout>
      <div className="flex items-center justify-center min-h-[60vh] p-6 text-center">
        <Card className="max-w-md w-full border-destructive/20 shadow-lg animate-in fade-in zoom-in duration-300">
          <CardHeader className="pb-2">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <CardTitle className="text-2xl font-bold">Ops! Erro no Diagnóstico</CardTitle>
            <CardDescription className="text-muted-foreground pt-2">
              Houve um problema ao carregar as ferramentas de análise técnica. 
              Isso pode ser causado por uma falha temporária de conexão ou atualização do sistema.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="bg-muted/50 p-3 rounded text-xs text-left font-mono text-muted-foreground overflow-auto max-h-32">
              {error ? error.message : "Erro de renderização detectado no módulo DiagnosticoAvaliacao."}
            </div>
            {trackingId && (
              <p className="text-[10px] text-muted-foreground font-mono text-left pt-1">
                ID de rastreio: <span className="text-foreground select-all">{trackingId}</span>
              </p>
            )}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button 
                variant="outline" 
                className="flex-1 gap-2"
                onClick={() => window.location.href = '/dashboard'}
              >
                <Home className="w-4 h-4" />
                Ir para Início
              </Button>
              <Button 
                className="flex-1 gap-2 font-bold"
                onClick={() => onReset ? onReset() : window.location.reload()}
              >
                <RotateCcw className="w-4 h-4" />
                Tentar Novamente
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

export default function DiagnosticoAvaliacao() {
  const { user, isMaster } = useAuth();
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;
  
  // Estado para filtros persistentes
  const [filterUser, setFilterUser] = useState<string>(() => sessionStorage.getItem('diag_filterUser') || "all");
  const [filterLevel, setFilterLevel] = useState<string>(() => sessionStorage.getItem('diag_filterLevel') || "all");
  const [filterImovel, setFilterImovel] = useState<string>(() => sessionStorage.getItem('diag_filterImovel') || "all");
  const [filterCorrelation, setFilterCorrelation] = useState<string>(() => sessionStorage.getItem('diag_filterCorrelation') || "");
  const [filterAction, setFilterAction] = useState<string>(() => sessionStorage.getItem('diag_filterAction') || "all");
  const [filterMetadataKey, setFilterMetadataKey] = useState<string>(() => sessionStorage.getItem('diag_filterMetadataKey') || "");
  const [filterMetadataValue, setFilterMetadataValue] = useState<string>(() => sessionStorage.getItem('diag_filterMetadataValue') || "");
  const [searchTerm, setSearchTerm] = useState(() => sessionStorage.getItem('diag_searchTerm') || "");
  const [filterStackTrace, setFilterStackTrace] = useState(() => sessionStorage.getItem('diag_filterStackTrace') || "");
  const [dateRange, setDateRange] = useState<{from: Date | undefined, to: Date | undefined}>(() => {
    const saved = sessionStorage.getItem('diag_dateRange');
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        from: parsed.from ? new Date(parsed.from) : undefined,
        to: parsed.to ? new Date(parsed.to) : undefined
      };
    }
    return {
      from: subDays(new Date(), 7),
      to: new Date()
    };
  });

  const [users, setUsers] = useState<{id: string, nome: string}[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [imoveisComErro, setImoveisComErro] = useState<{id: string, titulo: string}[]>([]);
  const [activeTab, setActiveTab] = useState(() => sessionStorage.getItem('diag_activeTab') || "errors");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Monitorar erros não capturados globalmente (para scripts externos ou erros de rede)
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      logger.error({
        module: "DiagnosticoAvaliacao",
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
        module: "DiagnosticoAvaliacao",
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

  // Persistência de filtros no sessionStorage
  useEffect(() => {
    sessionStorage.setItem('diag_filterUser', filterUser);
    sessionStorage.setItem('diag_filterLevel', filterLevel);
    sessionStorage.setItem('diag_filterImovel', filterImovel);
    sessionStorage.setItem('diag_filterCorrelation', filterCorrelation);
    sessionStorage.setItem('diag_filterAction', filterAction);
    sessionStorage.setItem('diag_filterMetadataKey', filterMetadataKey);
    sessionStorage.setItem('diag_filterMetadataValue', filterMetadataValue);
    sessionStorage.setItem('diag_searchTerm', searchTerm);
    sessionStorage.setItem('diag_filterStackTrace', filterStackTrace);
    sessionStorage.setItem('diag_activeTab', activeTab);
    sessionStorage.setItem('diag_dateRange', JSON.stringify(dateRange));
  }, [filterUser, filterLevel, filterImovel, filterCorrelation, filterAction, filterMetadataKey, filterMetadataValue, searchTerm, filterStackTrace, activeTab, dateRange]);

  const loadLogs = async (isLoadMore = false) => {
    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setPage(0);
      setHasMore(true);
    }
    
    const currentPage = isLoadMore ? page + 1 : 0;
    const from = currentPage * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    try {
      let query = supabase
        .from("system_logs")
        .select(`
          *,
          profiles:user_id (
            nome,
            email
          )
        `)
        .in("module", ["Avaliacao", "AvaliacaoImovel", "ExtrairDadosAnuncio"])
        .order("created_at", { ascending: false })
        .range(from, to);

      if (!isMaster) {
        query = query.eq("user_id", user?.id);
      } else if (filterUser !== "all") {
        query = query.eq("user_id", filterUser);
      }

      if (filterLevel !== "all") {
        query = query.eq("level", filterLevel);
      } else if (activeTab === "errors") {
        query = query.in("level", ["error", "fatal"]);
      }

      if (filterImovel !== "all") {
        query = query.filter("metadata->>imovel_id", "eq", filterImovel);
      }

      if (filterAction !== "all") {
        query = query.eq("action", filterAction);
      }

      if (filterCorrelation) {
        query = query.eq("correlation_id", filterCorrelation);
      }

      if (filterMetadataKey && filterMetadataValue) {
        query = query.filter(`metadata->>${filterMetadataKey}`, "ilike", `%${filterMetadataValue}%`);
      }

      if (filterStackTrace) {
        query = query.ilike("stack_trace", `%${filterStackTrace}%`);
      }

      if (dateRange.from) {
        query = query.gte("created_at", startOfDay(dateRange.from).toISOString());
      }
      if (dateRange.to) {
        query = query.lte("created_at", endOfDay(dateRange.to).toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;
      
      const newLogs = (data as any) || [];
      
      setLogs(prev => {
        const updatedLogs = isLoadMore ? [...prev, ...newLogs] : newLogs;
        return updatedLogs;
      });

      if (isLoadMore) {
        setPage(currentPage);
      }
      
      if (newLogs.length < PAGE_SIZE) {
        setHasMore(false);
      }
    } catch (err) {
      console.error("Erro ao carregar logs:", err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setIsInitialLoad(false);
    }
  };

  const loadImoveisComErro = async () => {
    try {
      const { data, error } = await supabase
        .from("system_logs")
        .select("metadata")
        .in("module", ["Avaliacao", "AvaliacaoImovel"])
        .not("metadata->>imovel_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;

      const uniqueImoveis = new Map<string, string>();
      data?.forEach(log => {
        const meta = log.metadata as any;
        if (meta?.imovel_id) {
          const titulo = meta.imovel_titulo || meta.imovel?.titulo || `ID: ${meta.imovel_id.substring(0, 8)}...`;
          if (!uniqueImoveis.has(meta.imovel_id)) {
            uniqueImoveis.set(meta.imovel_id, titulo);
          }
        }
      });

      setImoveisComErro(Array.from(uniqueImoveis.entries()).map(([id, titulo]) => ({ id, titulo })));
    } catch (err) {
      console.error("Erro ao carregar imóveis com erro:", err);
    }
  };

  const fetchActions = async () => {
    try {
      const { data } = await supabase
        .from("system_logs")
        .select("action")
        .in("module", ["Avaliacao", "AvaliacaoImovel", "ExtrairDadosAnuncio"])
        .order("action");
      
      if (data) {
        const uniqueActions = Array.from(new Set(data.map(d => d.action)));
        setActions(uniqueActions);
      }
    } catch (err) {
      console.error("Erro ao carregar ações:", err);
    }
  };

  const handleSearchImovelById = async (id: string) => {
    if (!id.trim()) return;
    setFilterImovel(id.trim());
    setSearchTerm("");
    loadLogs();
  };

  const exportLogs = (formatType: 'json' | 'csv' | 'pdf') => {
    if (filteredLogs.length === 0) return;

    const dataToExport = filteredLogs.map(log => ({
      id: log.id,
      correlation_id: log.correlation_id || "N/A",
      timestamp: log.created_at,
      data_hora: format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss"),
      modulo: log.module,
      acao: log.action,
      nivel: log.level,
      usuario: log.profiles?.nome || "Sistema",
      usuario_email: log.profiles?.email || "N/A",
      mensagem: log.message,
      imovel_id: (log.metadata as any)?.imovel_id || "N/A",
      imovel_titulo: (log.metadata as any)?.imovel_titulo || "N/A",
      metadata: JSON.stringify(log.metadata),
      stack_trace: log.stack_trace || "N/A"
    }));

    if (formatType === 'json') {
      const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `logs-diagnostico-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (formatType === 'csv') {
      const headers = Object.keys(dataToExport[0]);
      const csvContent = [
        headers.join(','),
        ...dataToExport.map(row => 
          headers.map(header => {
            const val = String((row as any)[header]).replace(/"/g, '""');
            return `"${val}"`;
          }).join(',')
        )
      ].join('\n');

      const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `logs-diagnostico-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (formatType === 'pdf') {
      const doc = new jsPDF({ orientation: "landscape" });
      
      doc.setFontSize(18);
      doc.text("Logs de Diagnóstico de Avaliação", 14, 15);
      doc.setFontSize(10);
      doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm:ss")}`, 14, 22);
      
      const tableData = dataToExport.map(row => [
        row.data_hora,
        row.modulo,
        row.acao,
        row.nivel,
        row.usuario,
        row.mensagem.substring(0, 50) + (row.mensagem.length > 50 ? "..." : ""),
        row.imovel_titulo
      ]);

      autoTable(doc, {
        startY: 28,
        head: [['Data/Hora', 'Módulo', 'Ação', 'Nível', 'Usuário', 'Mensagem', 'Imóvel']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185], textColor: 255 },
        styles: { fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 30 },
          1: { cellWidth: 25 },
          2: { cellWidth: 30 },
          3: { cellWidth: 15 },
          4: { cellWidth: 30 },
          6: { cellWidth: 35 }
        }
      });
      
      doc.save(`logs-diagnostico-${new Date().toISOString().slice(0, 10)}.pdf`);
    }
  };

  const resetFilters = () => {
    setFilterUser("all");
    setFilterLevel("all");
    setFilterImovel("all");
    setFilterAction("all");
    setFilterCorrelation("");
    setFilterMetadataKey("");
    setFilterMetadataValue("");
    setFilterStackTrace("");
    const defaultDateRange = { from: subDays(new Date(), 7), to: new Date() };
    setDateRange(defaultDateRange);
    setSearchTerm("");
    setActiveTab("errors");
    
    // Limpar explicitamente o storage
    sessionStorage.removeItem('diag_filterUser');
    sessionStorage.removeItem('diag_filterLevel');
    sessionStorage.removeItem('diag_filterImovel');
    sessionStorage.removeItem('diag_filterCorrelation');
    sessionStorage.removeItem('diag_filterAction');
    sessionStorage.removeItem('diag_filterMetadataKey');
    sessionStorage.removeItem('diag_filterMetadataValue');
    sessionStorage.removeItem('diag_searchTerm');
    sessionStorage.removeItem('diag_filterStackTrace');
    sessionStorage.removeItem('diag_activeTab');
    sessionStorage.removeItem('diag_dateRange');
    
    loadLogs();
  };

  useEffect(() => {
    loadImoveisComErro();
    fetchActions();
    if (isMaster) {
      const fetchUsers = async () => {
        const { data } = await supabase
          .from("profiles")
          .select("id, nome")
          .order("nome");
        if (data) setUsers(data);
      };
      fetchUsers();
    }
  }, [isMaster]);

  useEffect(() => {
    loadLogs();
  }, [user, filterUser, filterLevel, filterImovel, filterAction, filterCorrelation, filterMetadataKey, filterMetadataValue, filterStackTrace, dateRange, activeTab]);

  const filteredLogs = useMemo(() => {
    if (!searchTerm) return logs;
    const term = searchTerm.toLowerCase();
    return logs.filter(log => 
      log.message?.toLowerCase().includes(term) ||
      log.action?.toLowerCase().includes(term) ||
      log.profiles?.nome?.toLowerCase().includes(term) ||
      log.correlation_id?.toLowerCase().includes(term) ||
      JSON.stringify(log.metadata || {}).toLowerCase().includes(term)
    );
  }, [logs, searchTerm]);


  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Bug className="w-6 h-6 text-destructive" />
              Diagnóstico de Avaliação
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Rastreamento técnico de erros e processamento de IA
            </p>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2" disabled={loading || filteredLogs.length === 0}>
                  <Download className="w-4 h-4" />
                  Exportar Dados
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Formato de Exportação</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => exportLogs('json')} className="gap-2 cursor-pointer">
                  <FileJson className="w-4 h-4 text-amber-500" />
                  Exportar JSON (Full)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportLogs('csv')} className="gap-2 cursor-pointer">
                  <FileSpreadsheet className="w-4 h-4 text-green-500" />
                  Exportar CSV (Planilha)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportLogs('pdf')} className="gap-2 cursor-pointer">
                  <FileText className="w-4 h-4 text-red-500" />
                  Exportar PDF (Relatório)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => loadLogs()} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Atualizar Logs
            </Button>
          </div>
        </div>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Busca Geral (Mensagem ou ID)</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                      placeholder="Palavra-chave ou ID do imóvel..." 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 bg-secondary/50 border-border h-9"
                    />
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-9 px-3 gap-2"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                  >
                    <Filter className="w-3.5 h-3.5" />
                    {showAdvanced ? "Ocultar" : "Avançado"}
                  </Button>
                </div>
              </div>

              {isMaster && (
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Usuário</Label>
                  <Select value={filterUser} onValueChange={setFilterUser}>
                    <SelectTrigger className="bg-secondary/50 border-border h-9">
                      <User className="w-4 h-4 mr-2 text-muted-foreground" />
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os usuários</SelectItem>
                      {users.map(u => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Nível</Label>
                <Select value={filterLevel} onValueChange={setFilterLevel}>
                  <SelectTrigger className="bg-secondary/50 border-border h-9">
                    <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os níveis</SelectItem>
                    <SelectItem value="error">Apenas Erros</SelectItem>
                    <SelectItem value="warn">Avisos</SelectItem>
                    <SelectItem value="info">Informações</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Imóvel</Label>
                <Select value={filterImovel} onValueChange={setFilterImovel}>
                  <SelectTrigger className="bg-secondary/50 border-border h-9">
                    <Building2 className="w-4 h-4 mr-2 text-muted-foreground" />
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os imóveis</SelectItem>
                    {imoveisComErro.map(i => (
                      <SelectItem key={i.id} value={i.id} className="max-w-[300px] truncate">
                        {i.titulo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {showAdvanced && (
                <>
                  <div className="space-y-1.5 md:col-span-2">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Período</Label>
                    <div className="flex gap-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full justify-start text-left font-normal bg-secondary/50 border-border h-9 text-xs",
                              !dateRange.from && "text-muted-foreground"
                            )}
                          >
                            <CalendarDays className="mr-2 h-4 w-4" />
                            {dateRange.from ? format(dateRange.from, "dd/MM/yy") : <span>De</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={dateRange.from}
                            onSelect={(date) => setDateRange(prev => ({ ...prev, from: date }))}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full justify-start text-left font-normal bg-secondary/50 border-border h-9 text-xs",
                              !dateRange.to && "text-muted-foreground"
                            )}
                          >
                            <CalendarDays className="mr-2 h-4 w-4" />
                            {dateRange.to ? format(dateRange.to, "dd/MM/yy") : <span>Até</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={dateRange.to}
                            onSelect={(date) => setDateRange(prev => ({ ...prev, to: date }))}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  <div className="space-y-1.5 md:col-span-3">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Palavra-chave no Stack Trace</Label>
                    <div className="relative">
                      <Bug className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input 
                        placeholder="Busca dentro do rastro técnico..." 
                        value={filterStackTrace}
                        onChange={(e) => setFilterStackTrace(e.target.value)}
                        className="pl-9 bg-secondary/50 border-border h-9"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">ID de Correlação</Label>
                    <Input 
                      placeholder="Busca por UUID de execução..." 
                      value={filterCorrelation}
                      onChange={(e) => setFilterCorrelation(e.target.value)}
                      className="bg-secondary/50 border-border h-9"
                    />
                  </div>

                  <div className="space-y-1.5 md:col-span-1">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Ação</Label>
                    <Select value={filterAction} onValueChange={setFilterAction}>
                      <SelectTrigger className="bg-secondary/50 border-border h-9">
                        <Code2 className="w-4 h-4 mr-2 text-muted-foreground" />
                        <SelectValue placeholder="Todas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        {actions.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5 md:col-span-3">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Filtro em Metadata (Chave : Valor)</Label>
                    <div className="flex gap-2">
                      <Input 
                        placeholder="Chave (ex: portal)" 
                        value={filterMetadataKey}
                        onChange={(e) => setFilterMetadataKey(e.target.value)}
                        className="bg-secondary/50 border-border h-9"
                      />
                      <Input 
                        placeholder="Valor procurado..." 
                        value={filterMetadataValue}
                        onChange={(e) => setFilterMetadataValue(e.target.value)}
                        className="bg-secondary/50 border-border h-9"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="flex items-center justify-between gap-4 md:col-span-5 pt-2 border-t border-border/50">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
                  <TabsList className="grid grid-cols-2 h-8">
                    <TabsTrigger value="errors" className="text-xs px-3">Erros</TabsTrigger>
                    <TabsTrigger value="all" className="text-xs px-3">Tudo</TabsTrigger>
                  </TabsList>
                </Tabs>
                
                <div className="flex items-center gap-3">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-xs text-muted-foreground h-8 hover:text-foreground"
                    onClick={resetFilters}
                  >
                    <RefreshCw className="w-3 h-3 mr-1.5" />
                    Limpar Filtros
                  </Button>
                  <p className="text-[10px] text-muted-foreground italic hidden sm:block">
                    * Paginação e carregamento progressivo ativos
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border overflow-hidden">
          <CardHeader className="border-b border-border bg-muted/30 py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <LayoutList className="w-4 h-4 text-primary" /> 
              Fluxo de Execução
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="py-20 flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Carregando logs do sistema...</p>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="py-20 text-center">
                <Bug className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhum log encontrado para os filtros selecionados.</p>
              </div>
            ) : (
              <div className="max-h-[800px] overflow-y-auto">
                <Accordion type="single" collapsible className="w-full">
                  {filteredLogs.map((log) => (
                    <AccordionItem key={log.id} value={log.id} className="border-b border-border px-4">
                      <AccordionTrigger className="hover:no-underline py-4">
                        <div className="flex items-start gap-4 text-left w-full pr-4">
                          <div className="hidden sm:flex flex-col items-center pt-0.5 min-w-[80px]">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase">
                              {format(new Date(log.created_at), "HH:mm:ss")}
                            </span>
                            <span className="text-[9px] text-muted-foreground">
                              {format(new Date(log.created_at), "dd/MM/yy")}
                            </span>
                          </div>
                          
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              {getLevelBadge(log.level)}
                              <Badge variant="outline" className="text-[10px] uppercase font-bold py-0 h-5">
                                {log.module}
                              </Badge>
                              <span className="text-xs font-semibold text-foreground truncate">
                                {log.action}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-1 font-medium">
                              {log.message}
                            </p>
                            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" /> {log.profiles?.nome || "Sistema"}
                              </span>
                              {log.metadata?.imovel_titulo && (
                                <span className="flex items-center gap-1 font-medium text-primary">
                                  <Building2 className="w-3 h-3" /> {log.metadata.imovel_titulo}
                                </span>
                              )}
                              {log.correlation_id && (
                                <span className="flex items-center gap-1 font-mono text-[9px] bg-secondary px-1 rounded">
                                  <Code2 className="w-2.5 h-2.5" /> {log.correlation_id.substring(0, 8)}
                                </span>
                              )}
                              {log.metadata?.url && !log.metadata?.imovel_titulo && (
                                <span className="flex items-center gap-1 truncate max-w-[200px]">
                                  <ExternalLink className="w-3 h-3" /> {new URL(log.metadata.url).hostname}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pb-6">
                        <div className="space-y-4 pt-2 border-t border-border/50">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <h4 className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                                <LucideCalendar className="w-3 h-3" /> Timestamp Completo
                              </h4>
                              <p className="text-sm font-mono bg-muted/50 p-2 rounded border border-border/50">
                                {format(new Date(log.created_at), "PPPP 'às' HH:mm:ss.SSS", { locale: ptBR })}
                              </p>
                            </div>
                            <div className="space-y-2">
                              <h4 className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                                <User className="w-3 h-3" /> Contexto do Usuário
                              </h4>
                              <div className="text-sm bg-muted/50 p-2 rounded border border-border/50">
                                <p><span className="font-bold">ID:</span> {log.user_id}</p>
                                <p><span className="font-bold">Nome:</span> {log.profiles?.nome}</p>
                                <p><span className="font-bold">Email:</span> {log.profiles?.email}</p>
                                {log.correlation_id && (
                                  <p className="mt-1 pt-1 border-t border-border/50">
                                    <span className="font-bold">Correlação:</span> 
                                    <code className="ml-1 text-[10px] bg-secondary px-1 rounded">{log.correlation_id}</code>
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <h4 className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                              <Code2 className="w-3 h-3" /> Parâmetros de Execução (Metadata)
                            </h4>
                            <ScrollArea className="h-[200px] w-full rounded border border-border bg-slate-950 p-3">
                              <pre className="text-xs text-blue-300 font-mono">
                                {JSON.stringify(log.metadata, null, 2)}
                              </pre>
                            </ScrollArea>
                          </div>

                          {log.stack_trace && (
                            <div className="space-y-2">
                              <h4 className="text-[10px] font-bold uppercase text-destructive flex items-center gap-1">
                                <Bug className="w-3 h-3" /> Stack Trace
                              </h4>
                              <ScrollArea className="h-[300px] w-full rounded border border-destructive/20 bg-destructive/5 p-3">
                                <pre className="text-[11px] text-destructive/80 font-mono whitespace-pre-wrap leading-relaxed">
                                  {log.stack_trace}
                                </pre>
                              </ScrollArea>
                            </div>
                          )}

                          {log.metadata?.url && (
                            <div className="flex justify-end">
                              <Button variant="outline" size="sm" asChild className="gap-2">
                                <a href={log.metadata.url} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="w-4 h-4" /> Abrir Link Afetado
                                </a>
                              </Button>
                            </div>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
                
                {hasMore && (
                  <div className="p-8 border-t border-border flex flex-col items-center justify-center gap-4 bg-muted/5">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <LayoutList className="w-4 h-4" />
                      Mostrando {filteredLogs.length} logs
                    </div>
                    <Button 
                      variant="outline" 
                      size="default" 
                      onClick={() => loadLogs(true)} 
                      disabled={loadingMore}
                      className="gap-2 px-8 py-6 h-auto text-base font-semibold border-primary/20 hover:border-primary/50 hover:bg-primary/5 transition-all shadow-sm"
                    >
                      {loadingMore ? (
                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-primary" />
                      )}
                      {loadingMore ? "Carregando mais dados..." : "Carregar mais logs (Paginação)"}
                    </Button>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                      Otimizado com índices de banco de dados
                    </p>
                  </div>
                )}
                
                {!hasMore && filteredLogs.length > 0 && (
                  <div className="p-8 text-center bg-muted/5 border-t border-border">
                    <p className="text-sm text-muted-foreground">
                      Você chegou ao fim dos registros para este filtro.
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
