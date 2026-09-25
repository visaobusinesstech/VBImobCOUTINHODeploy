import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Label } from "@/components/ui/label";
import { SectionHeader } from "@/components/shared/MetricCard";
import { 
  History, 
  Search, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Globe, 
  LayoutList,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  Users,
  LayoutGrid
} from "lucide-react";


import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";


interface ExtractionLog {
  id: string;
  source_url: string;
  portal: string;
  status: string;
  error_message: string;
  missing_fields: string[];
  retry_attempt: number;
  response_time_ms: number;
  created_at: string;
  user_id: string;
  profiles?: any;
}



export default function AuditoriaExtracao() {
  const { user, isMaster } = useAuth();
  const navigate = useNavigate();
  const [logs, setLogs] = useState<ExtractionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPortal, setFilterPortal] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterField, setFilterField] = useState<string>("all");
  const [filterUser, setFilterUser] = useState<string>("all");
  const [searchUrl, setSearchUrl] = useState("");
  const [page, setPage] = useState(0);
  const [users, setUsers] = useState<{id: string, nome: string}[]>([]);
  const ITEMS_PER_PAGE = 15;



  const loadLogs = async () => {
    if (!user) return;
    setLoading(true);
    try {
      let query = supabase
        .from("extraction_logs")
        .select(`
          *,
          profiles:user_id (
            nome,
            email
          )
        `, { count: "exact" })

        .order("created_at", { ascending: false });

      if (!isMaster) {
        query = query.eq("user_id", user.id);
      } else if (filterUser !== "all") {
        query = query.eq("user_id", filterUser);
      }


      if (filterPortal !== "all") query = query.eq("portal", filterPortal);
      if (filterStatus !== "all") query = query.eq("status", filterStatus);
      if (searchUrl) query = query.ilike("source_url", `%${searchUrl}%`);
      
      // Filter by missing field (complex filter for array)
      if (filterField !== "all") {
        if (filterField === "Localização") {
          // Check for both variations of Location field
          query = query.or(`missing_fields.cs.{"Localização"},missing_fields.cs.{"Localização (Cidade/Bairro/Endereço)"}`);
        } else {
          query = query.contains("missing_fields", [filterField]);
        }
      }


      const { data, error } = await query
        .range(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE - 1);

      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      console.error("Erro ao carregar logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
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
  }, [user, page, filterPortal, filterStatus, filterField, filterUser, searchUrl]);



  const getStatusBadge = (status: string) => {

    switch (status) {
      case "success":
        return <Badge className="bg-green-500 hover:bg-green-600 gap-1"><CheckCircle2 className="w-3 h-3" /> Sucesso</Badge>;
      case "partial":
      case "incomplete":
        return <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 gap-1"><Clock className="w-3 h-3" /> Parcial</Badge>;
      case "error":
      case "failed":
        return <Badge variant="destructive" className="gap-1"><AlertCircle className="w-3 h-3" /> Falha</Badge>;

      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const portals = ["dfimoveis.com.br", "zapimoveis.com.br", "vivareal.com.br", "olx.com.br", "imovelweb.com.br", "wimoveis.com.br"];
  const fields = ["Preço", "Área", "Localização (Cidade/Bairro/Endereço)", "Fotos", "Localização"];

  return (
    <DashboardLayout>
      <SectionHeader 
        title="Auditoria de Extração" 
        subtitle="Histórico detalhado de inteligência artificial"
      />

      <div className="space-y-6">
        <Card className="bg-card border-border">

          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">

          <div className="space-y-1.5">
            <Label className="text-xs uppercase font-bold text-muted-foreground">Usuário</Label>
            <Select value={filterUser} onValueChange={setFilterUser} disabled={!isMaster}>
              <SelectTrigger className="bg-secondary border-border">
                <Users className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Todos os usuários" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os usuários</SelectItem>
                {users.map(u => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase font-bold text-muted-foreground">URL do Anúncio</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Filtrar por link..." 
                value={searchUrl}
                onChange={(e) => setSearchUrl(e.target.value)}
                className="pl-9 bg-secondary border-border"
              />
            </div>
          </div>


              <div className="space-y-1.5">
                <Label className="text-xs uppercase font-bold text-muted-foreground">Portal</Label>
                <Select value={filterPortal} onValueChange={setFilterPortal}>
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue placeholder="Todos os portais" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os portais</SelectItem>
                    {portals.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs uppercase font-bold text-muted-foreground">Status</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue placeholder="Todos os status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    <SelectItem value="success">Sucesso total</SelectItem>
                    <SelectItem value="partial">Falha parcial</SelectItem>
                    <SelectItem value="incomplete">Incompleto</SelectItem>
                    <SelectItem value="error">Erro técnico</SelectItem>
                    <SelectItem value="failed">Falhou</SelectItem>

                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs uppercase font-bold text-muted-foreground">Campo Afetado</Label>
                <Select value={filterField} onValueChange={setFilterField}>
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue placeholder="Qualquer campo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Qualquer campo</SelectItem>
                    {fields.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Logs */}
        <Card className="bg-card border-border overflow-hidden">
          <CardHeader className="border-b border-border bg-muted/30">
            <CardTitle className="text-sm flex items-center gap-2">
              <LayoutList className="w-4 h-4 text-primary" /> 
              Logs de IA Recentes
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="py-20 flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Carregando histórico...</p>
              </div>
            ) : logs.length === 0 ? (
              <div className="py-20 text-center">
                <History className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhum registro encontrado para estes filtros.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left bg-muted/20">
                      <th className="p-4 font-semibold text-muted-foreground">Data/Hora</th>
                      <th className="p-4 font-semibold text-muted-foreground">Usuário</th>
                      <th className="p-4 font-semibold text-muted-foreground">Portal</th>
                      <th className="p-4 font-semibold text-muted-foreground">Status</th>

                      <th className="p-4 font-semibold text-muted-foreground">Campos Pendentes</th>
                      <th className="p-4 font-semibold text-muted-foreground">Tempo</th>
                      <th className="p-4 font-semibold text-muted-foreground text-center">Ações</th>
                    </tr>

                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                        <td className="p-4">
                          <div className="flex flex-col">
                            <span className="font-medium">{format(new Date(log.created_at), "dd/MM/yyyy", { locale: ptBR })}</span>
                            <span className="text-[11px] text-muted-foreground">{format(new Date(log.created_at), "HH:mm:ss")}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col">
                            <span className="font-medium text-foreground">{log.profiles?.nome || "Sistema"}</span>
                            <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">{log.profiles?.email}</span>
                          </div>
                        </td>
                        <td className="p-4">

                          <div className="flex items-center gap-2">
                            <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="font-medium text-foreground">{log.portal}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          {getStatusBadge(log.status)}
                          {log.retry_attempt > 0 && (
                            <span className="ml-2 text-[10px] text-muted-foreground">({log.retry_attempt}ª tentativa)</span>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="flex flex-wrap gap-1">
                            {log.missing_fields && log.missing_fields.length > 0 ? (
                              log.missing_fields.map(f => (
                                <Badge key={f} variant="outline" className="text-[10px] bg-background">
                                  {f.split('(')[0].trim()}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </div>
                          {log.error_message && (
                            <p className="text-[11px] text-destructive mt-1 italic truncate max-w-[200px]" title={log.error_message}>
                              {log.error_message}
                            </p>
                          )}
                        </td>
                        <td className="p-4">
                          <span className="text-xs text-muted-foreground">
                            {log.response_time_ms ? `${(log.response_time_ms / 1000).toFixed(1)}s` : '—'}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center justify-center gap-2">
                            <a 
                              href={log.source_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="p-2 rounded-lg bg-secondary hover:bg-primary/10 text-primary transition-colors inline-block"
                              title="Abrir anúncio original"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </div>
                        </td>
                      </tr>

                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
          {logs.length > 0 && (
            <div className="p-4 border-t border-border bg-muted/10 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Mostrando página {page + 1}</span>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0 || loading}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setPage(p => p + 1)}
                  disabled={logs.length < ITEMS_PER_PAGE || loading}
                >
                  Próxima <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}

