import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, RefreshCw, ShieldAlert, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import AutoAssignReport from "@/components/auditoria/AutoAssignReport";

interface Atividade {
  id: string;
  lead_id: string;
  tipo: string;
  titulo: string;
  descricao: string | null;
  created_at: string;
  lead_nome?: string;
}

interface SysLog {
  id: string;
  module: string;
  action: string;
  level: string;
  message: string;
  metadata: any;
  created_at: string;
}

const today = () => format(new Date(), "yyyy-MM-dd");
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return format(d, "yyyy-MM-dd");
};

const PAGE_SIZES = [25, 50, 100, 200];

export default function AuditoriaLeads() {
  const { isMaster } = useAuth();
  const [tab, setTab] = useState("atividades");
  const [loading, setLoading] = useState(false);
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [logs, setLogs] = useState<SysLog[]>([]);
  const [totalAtividades, setTotalAtividades] = useState(0);
  const [totalLogs, setTotalLogs] = useState(0);

  // Filtros
  const [leadQuery, setLeadQuery] = useState("");
  const [regra, setRegra] = useState("");
  const [tipo, setTipo] = useState("atribuicao");
  const [module, setModule] = useState("LeadsAutoAssign");
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(today());

  // Paginação
  const [pageAtiv, setPageAtiv] = useState(1);
  const [pageLogs, setPageLogs] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Busca rápida (client-side, sobre a página carregada)
  const [quickSearch, setQuickSearch] = useState("");
  const [quickDebounced, setQuickDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQuickDebounced(quickSearch.trim().toLowerCase()), 250);
    return () => clearTimeout(t);
  }, [quickSearch]);

  const fetchAtividades = async (page = pageAtiv) => {
    setLoading(true);
    const fromIdx = (page - 1) * pageSize;
    const toIdx = fromIdx + pageSize - 1;
    let q = supabase
      .from("lead_atividades")
      .select("id, lead_id, tipo, titulo, descricao, created_at, leads(nome)", { count: "exact" })
      .gte("created_at", `${from}T00:00:00`)
      .lte("created_at", `${to}T23:59:59`)
      .order("created_at", { ascending: false })
      .range(fromIdx, toIdx);
    if (tipo) q = q.eq("tipo", tipo);
    if (regra) q = q.ilike("descricao", `%${regra}%`);
    if (leadQuery) q = q.ilike("leads.nome", `%${leadQuery}%`);
    const { data, error, count } = await q;
    if (!error && data) {
      setAtividades(
        (data as any[]).map((r) => ({ ...r, lead_nome: r.leads?.nome ?? "—" })),
      );
      setTotalAtividades(count ?? 0);
    }
    setLoading(false);
  };

  const fetchLogs = async (page = pageLogs) => {
    setLoading(true);
    const fromIdx = (page - 1) * pageSize;
    const toIdx = fromIdx + pageSize - 1;
    let q = supabase
      .from("system_logs")
      .select("id, module, action, level, message, metadata, created_at", { count: "exact" })
      .gte("created_at", `${from}T00:00:00`)
      .lte("created_at", `${to}T23:59:59`)
      .order("created_at", { ascending: false })
      .range(fromIdx, toIdx);
    if (module) q = q.eq("module", module);
    if (regra) q = q.contains("metadata", { regra });
    if (leadQuery) q = q.ilike("message", `%${leadQuery}%`);
    const { data, error, count } = await q;
    if (!error && data) {
      setLogs(data as SysLog[]);
      setTotalLogs(count ?? 0);
    }
    setLoading(false);
  };

  const refresh = () => (tab === "atividades" ? fetchAtividades(pageAtiv) : fetchLogs(pageLogs));

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    if (tab === "atividades") fetchAtividades(pageAtiv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageAtiv, pageSize]);

  useEffect(() => {
    if (tab === "logs") fetchLogs(pageLogs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageLogs, pageSize]);

  const applyAtividades = () => { setPageAtiv(1); fetchAtividades(1); };
  const applyLogs = () => { setPageLogs(1); fetchLogs(1); };

  const filteredAtividades = useMemo(() => {
    if (!quickDebounced) return atividades;
    return atividades.filter((a) =>
      [a.lead_nome, a.tipo, a.titulo, a.descricao].some((v) =>
        (v ?? "").toString().toLowerCase().includes(quickDebounced),
      ),
    );
  }, [atividades, quickDebounced]);

  const filteredLogs = useMemo(() => {
    if (!quickDebounced) return logs;
    return logs.filter((l) =>
      [l.module, l.action, l.level, l.message, JSON.stringify(l.metadata ?? {})].some((v) =>
        (v ?? "").toString().toLowerCase().includes(quickDebounced),
      ),
    );
  }, [logs, quickDebounced]);

  const totalPagesAtiv = Math.max(1, Math.ceil(totalAtividades / pageSize));
  const totalPagesLogs = Math.max(1, Math.ceil(totalLogs / pageSize));

  const filtrosAtividades = (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
      <div>
        <Label>Lead</Label>
        <Input placeholder="Nome do lead" value={leadQuery} onChange={(e) => setLeadQuery(e.target.value)} />
      </div>
      <div>
        <Label>Tipo</Label>
        <Input placeholder="atribuicao, estagio…" value={tipo} onChange={(e) => setTipo(e.target.value)} />
      </div>
      <div>
        <Label>Regra (texto)</Label>
        <Input placeholder="auto_assign_ludmila_v1" value={regra} onChange={(e) => setRegra(e.target.value)} />
      </div>
      <div>
        <Label>De</Label>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
      </div>
      <div>
        <Label>Até</Label>
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
    </div>
  );

  const filtrosLogs = (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
      <div>
        <Label>Busca (mensagem)</Label>
        <Input placeholder="texto na mensagem" value={leadQuery} onChange={(e) => setLeadQuery(e.target.value)} />
      </div>
      <div>
        <Label>Módulo</Label>
        <Input placeholder="LeadsAutoAssign" value={module} onChange={(e) => setModule(e.target.value)} />
      </div>
      <div>
        <Label>Regra (metadata.regra)</Label>
        <Input placeholder="auto_assign_ludmila_v1" value={regra} onChange={(e) => setRegra(e.target.value)} />
      </div>
      <div>
        <Label>De</Label>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
      </div>
      <div>
        <Label>Até</Label>
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
    </div>
  );

  const Pager = ({
    page, setPage, totalPages, total,
  }: { page: number; setPage: (n: number) => void; totalPages: number; total: number }) => (
    <div className="flex items-center justify-between px-3 py-2 border-t bg-muted/30 text-xs">
      <div className="text-muted-foreground">
        {total.toLocaleString("pt-BR")} registros • página {page} de {totalPages}
      </div>
      <div className="flex items-center gap-2">
        <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPageAtiv(1); setPageLogs(1); }}>
          <SelectTrigger className="h-8 w-24"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PAGE_SIZES.map((s) => <SelectItem key={s} value={String(s)}>{s}/pág.</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <Button size="sm" variant="outline" disabled={page >= totalPages || loading} onClick={() => setPage(page + 1)}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );

  if (!isMaster) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-8 flex items-center gap-3">
            <ShieldAlert className="w-6 h-6 text-destructive" />
            <div>
              <p className="font-semibold">Acesso restrito</p>
              <p className="text-sm text-muted-foreground">Somente administradores podem visualizar a auditoria de leads.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Auditoria de Leads</h1>
          <p className="text-sm text-muted-foreground">Atividades de leads e logs do sistema (atribuições automáticas, mudanças de estágio, etc.).</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Busca rápida na página…"
              value={quickSearch}
              onChange={(e) => setQuickSearch(e.target.value)}
              className="pl-8 w-64"
            />
          </div>
          <Button onClick={refresh} disabled={loading} variant="outline">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Atualizar
          </Button>
        </div>
      </div>

      <AutoAssignReport />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="atividades">Lead Atividades</TabsTrigger>
          <TabsTrigger value="logs">System Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="atividades" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Filtros</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {filtrosAtividades}
              <Button onClick={applyAtividades} disabled={loading}>Aplicar</Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Lead</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Descrição</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAtividades.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum registro encontrado.</TableCell></TableRow>
                  ) : filteredAtividades.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="text-xs whitespace-nowrap">{format(new Date(a.created_at), "dd/MM/yyyy HH:mm")}</TableCell>
                      <TableCell className="font-medium">{a.lead_nome}</TableCell>
                      <TableCell><Badge variant="secondary">{a.tipo}</Badge></TableCell>
                      <TableCell>{a.titulo}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-md">{a.descricao}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pager page={pageAtiv} setPage={setPageAtiv} totalPages={totalPagesAtiv} total={totalAtividades} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Filtros</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {filtrosLogs}
              <Button onClick={applyLogs} disabled={loading}>Aplicar</Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Nível</TableHead>
                    <TableHead>Módulo</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Mensagem</TableHead>
                    <TableHead>Regra</TableHead>
                    <TableHead>Metadata</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum registro encontrado.</TableCell></TableRow>
                  ) : filteredLogs.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="text-xs whitespace-nowrap">{format(new Date(l.created_at), "dd/MM/yyyy HH:mm")}</TableCell>
                      <TableCell><Badge variant={l.level === "error" || l.level === "fatal" ? "destructive" : "secondary"}>{l.level}</Badge></TableCell>
                      <TableCell className="text-xs">{l.module}</TableCell>
                      <TableCell className="text-xs">{l.action}</TableCell>
                      <TableCell className="text-xs">{l.message}</TableCell>
                      <TableCell className="text-xs font-mono">{l.metadata?.regra ?? "—"}</TableCell>
                      <TableCell className="text-[10px] font-mono max-w-xs truncate" title={JSON.stringify(l.metadata)}>{JSON.stringify(l.metadata)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pager page={pageLogs} setPage={setPageLogs} totalPages={totalPagesLogs} total={totalLogs} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
