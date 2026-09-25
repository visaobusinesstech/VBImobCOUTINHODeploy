import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  Radio, MessageCircle, Mail, Users, MapPin, Building2, Phone,
  Plus, Loader2, Calendar as CalendarIcon, ClipboardList, Send, RefreshCw,
} from "lucide-react";

type Canal = "whatsapp_business" | "email" | "facebook_groups" | "anuncio_geo" | "portaria" | "sindico" | "administradora" | "outro";
type Status = "planejado" | "em_andamento" | "aguardando_retorno" | "concluido" | "sem_sucesso" | "cancelado";

interface Iniciativa {
  id: string;
  condominio_nome: string;
  bairro: string | null;
  cep: string | null;
  canal: Canal;
  titulo: string;
  descricao: string | null;
  status: Status;
  responsavel: string | null;
  data_agendada: string | null;
  data_conclusao: string | null;
  resultado: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

interface LogItem {
  id: string;
  tipo: string;
  conteudo: string;
  autor: string | null;
  created_at: string;
}

const CANAIS: { value: Canal; label: string; icon: JSX.Element }[] = [
  { value: "whatsapp_business", label: "WhatsApp Business", icon: <MessageCircle className="w-3.5 h-3.5" /> },
  { value: "email", label: "E-mail", icon: <Mail className="w-3.5 h-3.5" /> },
  { value: "facebook_groups", label: "Facebook Groups", icon: <Users className="w-3.5 h-3.5" /> },
  { value: "anuncio_geo", label: "Anúncio Geolocalizado", icon: <MapPin className="w-3.5 h-3.5" /> },
  { value: "portaria", label: "Portaria", icon: <Phone className="w-3.5 h-3.5" /> },
  { value: "sindico", label: "Síndico", icon: <Users className="w-3.5 h-3.5" /> },
  { value: "administradora", label: "Administradora", icon: <Building2 className="w-3.5 h-3.5" /> },
  { value: "outro", label: "Outro", icon: <Radio className="w-3.5 h-3.5" /> },
];

const STATUS_META: Record<Status, { label: string; className: string }> = {
  planejado: { label: "Planejado", className: "bg-slate-100 text-slate-700 border-slate-300" },
  em_andamento: { label: "Em andamento", className: "bg-blue-100 text-blue-700 border-blue-300" },
  aguardando_retorno: { label: "Aguardando retorno", className: "bg-amber-100 text-amber-700 border-amber-300" },
  concluido: { label: "Concluído", className: "bg-emerald-100 text-emerald-700 border-emerald-300" },
  sem_sucesso: { label: "Sem sucesso", className: "bg-rose-100 text-rose-700 border-rose-300" },
  cancelado: { label: "Cancelado", className: "bg-neutral-100 text-neutral-600 border-neutral-300" },
};

const db = supabase as any;

export function OrquestracaoMulticanalPanel() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [iniciativas, setIniciativas] = useState<Iniciativa[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selecionada, setSelecionada] = useState<Iniciativa | null>(null);
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [novaNota, setNovaNota] = useState("");
  const [filtroCanal, setFiltroCanal] = useState<string>("todos");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [busca, setBusca] = useState("");

  const [form, setForm] = useState<{
    condominio_nome: string; bairro: string; cep: string; canal: Canal;
    titulo: string; descricao: string; responsavel: string; data_agendada: string;
  }>({
    condominio_nome: "", bairro: "", cep: "", canal: "whatsapp_business",
    titulo: "", descricao: "", responsavel: "", data_agendada: "",
  });

  const carregar = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await db
      .from("condominio_iniciativas")
      .select("*")
      .eq("imobiliaria_id", user.id)
      .order("updated_at", { ascending: false });
    if (error) {
      toast({ title: "Erro ao carregar iniciativas", description: error.message, variant: "destructive" });
    } else {
      setIniciativas((data ?? []) as Iniciativa[]);
    }
    setLoading(false);
  };

  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [user?.id]);

  const abrirDetalhes = async (i: Iniciativa) => {
    setSelecionada(i);
    setNovaNota("");
    const { data } = await db
      .from("condominio_iniciativa_logs")
      .select("id,tipo,conteudo,autor,created_at")
      .eq("iniciativa_id", i.id)
      .order("created_at", { ascending: false });
    setLogs((data ?? []) as LogItem[]);
  };

  const criar = async () => {
    if (!user) return;
    if (!form.condominio_nome.trim() || !form.titulo.trim()) {
      toast({ title: "Preencha condomínio e título", variant: "destructive" });
      return;
    }
    const payload = {
      imobiliaria_id: user.id,
      condominio_nome: form.condominio_nome.trim(),
      bairro: form.bairro || null,
      cep: form.cep || null,
      canal: form.canal,
      titulo: form.titulo.trim(),
      descricao: form.descricao || null,
      responsavel: form.responsavel || null,
      data_agendada: form.data_agendada || null,
      status: "planejado" as Status,
    };
    const { error } = await db.from("condominio_iniciativas").insert(payload);
    if (error) {
      toast({ title: "Erro ao criar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Iniciativa registrada" });
    setDialogOpen(false);
    setForm({ condominio_nome: "", bairro: "", cep: "", canal: "whatsapp_business", titulo: "", descricao: "", responsavel: "", data_agendada: "" });
    carregar();
  };

  const mudarStatus = async (i: Iniciativa, novo: Status) => {
    const patch: any = { status: novo };
    if (novo === "concluido" || novo === "sem_sucesso" || novo === "cancelado") {
      patch.data_conclusao = new Date().toISOString();
    }
    const { error } = await db.from("condominio_iniciativas").update(patch).eq("id", i.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Status atualizado" });
    if (selecionada?.id === i.id) {
      setSelecionada({ ...i, ...patch });
      abrirDetalhes({ ...i, ...patch });
    }
    carregar();
  };

  const adicionarNota = async () => {
    if (!selecionada || !user || !novaNota.trim()) return;
    const { error } = await db.from("condominio_iniciativa_logs").insert({
      iniciativa_id: selecionada.id,
      imobiliaria_id: user.id,
      tipo: "nota",
      conteudo: novaNota.trim(),
      autor: user.email || null,
    });
    if (error) {
      toast({ title: "Erro ao anotar", description: error.message, variant: "destructive" });
      return;
    }
    setNovaNota("");
    abrirDetalhes(selecionada);
  };

  const filtradas = useMemo(() => {
    return iniciativas.filter((i) => {
      if (filtroCanal !== "todos" && i.canal !== filtroCanal) return false;
      if (filtroStatus !== "todos" && i.status !== filtroStatus) return false;
      if (busca) {
        const q = busca.toLowerCase();
        return (
          i.condominio_nome.toLowerCase().includes(q) ||
          i.titulo.toLowerCase().includes(q) ||
          (i.descricao ?? "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [iniciativas, filtroCanal, filtroStatus, busca]);

  const porCanal = useMemo(() => {
    const m = new Map<Canal, number>();
    iniciativas.forEach((i) => m.set(i.canal, (m.get(i.canal) ?? 0) + 1));
    return m;
  }, [iniciativas]);

  const abertas = iniciativas.filter((i) => i.status !== "concluido" && i.status !== "cancelado" && i.status !== "sem_sucesso").length;
  const concluidas = iniciativas.filter((i) => i.status === "concluido").length;

  const canalMeta = (c: Canal) => CANAIS.find((x) => x.value === c)!;

  return (
    <div className="space-y-4">
      {/* Header + KPIs */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Radio className="w-4 h-4 text-primary" />
                Orquestração Multicanal por Condomínio
              </CardTitle>
              <CardDescription>
                Registre iniciativas (WhatsApp Business, e-mail, Facebook Groups, anúncios geolocalizados) por condomínio, acompanhe status e mantenha logs auditáveis.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={carregar} disabled={loading} className="gap-1">
                {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                Atualizar
              </Button>
              <Button size="sm" onClick={() => setDialogOpen(true)} className="gap-1">
                <Plus className="w-3.5 h-3.5" />
                Nova iniciativa
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Kpi label="Total" value={iniciativas.length} />
          <Kpi label="Em aberto" value={abertas} />
          <Kpi label="Concluídas" value={concluidas} />
          <Kpi label="Canais ativos" value={porCanal.size} />
        </CardContent>
      </Card>

      {/* Filtros */}
      <Card>
        <CardContent className="p-3 flex flex-col md:flex-row gap-2">
          <Input
            placeholder="Buscar por condomínio, título ou descrição..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="md:max-w-sm"
          />
          <Select value={filtroCanal} onValueChange={setFiltroCanal}>
            <SelectTrigger className="md:w-52"><SelectValue placeholder="Canal" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os canais</SelectItem>
              {CANAIS.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="md:w-52"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {(Object.keys(STATUS_META) as Status[]).map((s) => (
                <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Lista */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 flex justify-center text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : filtradas.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nenhuma iniciativa. Clique em <strong>Nova iniciativa</strong> para começar.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs">
                  <tr>
                    <th className="text-left p-3">Condomínio</th>
                    <th className="text-left p-3">Canal</th>
                    <th className="text-left p-3">Título</th>
                    <th className="text-left p-3">Responsável</th>
                    <th className="text-left p-3">Agendada</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-right p-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtradas.map((i) => {
                    const cm = canalMeta(i.canal);
                    return (
                      <tr key={i.id} className="border-t hover:bg-muted/20">
                        <td className="p-3 font-medium">
                          <div>{i.condominio_nome}</div>
                          {i.bairro && <div className="text-xs text-muted-foreground">{i.bairro}{i.cep ? ` • ${i.cep}` : ""}</div>}
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className="gap-1">{cm.icon}{cm.label}</Badge>
                        </td>
                        <td className="p-3 max-w-[280px] truncate">{i.titulo}</td>
                        <td className="p-3 text-xs text-muted-foreground">{i.responsavel || "—"}</td>
                        <td className="p-3 text-xs text-muted-foreground">
                          {i.data_agendada ? new Date(i.data_agendada).toLocaleDateString("pt-BR") : "—"}
                        </td>
                        <td className="p-3">
                          <Badge className={STATUS_META[i.status].className} variant="outline">
                            {STATUS_META[i.status].label}
                          </Badge>
                        </td>
                        <td className="p-3 text-right">
                          <Button size="sm" variant="ghost" onClick={() => abrirDetalhes(i)} className="gap-1">
                            <ClipboardList className="w-3.5 h-3.5" />
                            Abrir
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog nova iniciativa */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova iniciativa multicanal</DialogTitle>
            <DialogDescription>
              Registre uma ação de prospecção associada a um condomínio e ao canal escolhido.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <Label>Condomínio *</Label>
                <Input value={form.condominio_nome} onChange={(e) => setForm({ ...form, condominio_nome: e.target.value })} />
              </div>
              <div>
                <Label>Bairro</Label>
                <Input value={form.bairro} onChange={(e) => setForm({ ...form, bairro: e.target.value })} />
              </div>
              <div>
                <Label>CEP</Label>
                <Input value={form.cep} onChange={(e) => setForm({ ...form, cep: e.target.value })} />
              </div>
              <div>
                <Label>Canal *</Label>
                <Select value={form.canal} onValueChange={(v) => setForm({ ...form, canal: v as Canal })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CANAIS.map((c) => (<SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Responsável</Label>
                <Input value={form.responsavel} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} placeholder="Ex.: Ana / equipe MKT" />
              </div>
              <div className="sm:col-span-2">
                <Label>Título da iniciativa *</Label>
                <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ex.: Campanha WhatsApp - moradores Life Park" />
              </div>
              <div className="sm:col-span-2">
                <Label>Descrição / roteiro</Label>
                <Textarea rows={3} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Label className="flex items-center gap-1"><CalendarIcon className="w-3.5 h-3.5" /> Data agendada</Label>
                <Input type="datetime-local" value={form.data_agendada} onChange={(e) => setForm({ ...form, data_agendada: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={criar} className="gap-1"><Send className="w-3.5 h-3.5" /> Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog detalhes / logs */}
      <Dialog open={!!selecionada} onOpenChange={(o) => { if (!o) { setSelecionada(null); setLogs([]); } }}>
        <DialogContent className="max-w-2xl">
          {selecionada && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {canalMeta(selecionada.canal).icon}
                  {selecionada.titulo}
                </DialogTitle>
                <DialogDescription>
                  {selecionada.condominio_nome}
                  {selecionada.bairro ? ` • ${selecionada.bairro}` : ""}
                  {selecionada.cep ? ` • ${selecionada.cep}` : ""}
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="detalhes">
                <TabsList>
                  <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
                  <TabsTrigger value="logs">Logs & Timeline</TabsTrigger>
                </TabsList>

                <TabsContent value="detalhes" className="space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Label className="text-xs">Status:</Label>
                    <Select value={selecionada.status} onValueChange={(v) => mudarStatus(selecionada, v as Status)}>
                      <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(STATUS_META) as Status[]).map((s) => (
                          <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Badge className={STATUS_META[selecionada.status].className} variant="outline">
                      {STATUS_META[selecionada.status].label}
                    </Badge>
                  </div>
                  {selecionada.descricao && (
                    <div>
                      <Label className="text-xs">Descrição</Label>
                      <p className="text-sm whitespace-pre-wrap border rounded-md p-3 bg-muted/20">{selecionada.descricao}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                    <div>Responsável: <strong className="text-foreground">{selecionada.responsavel || "—"}</strong></div>
                    <div>Agendada: <strong className="text-foreground">{selecionada.data_agendada ? new Date(selecionada.data_agendada).toLocaleString("pt-BR") : "—"}</strong></div>
                    <div>Concluída: <strong className="text-foreground">{selecionada.data_conclusao ? new Date(selecionada.data_conclusao).toLocaleString("pt-BR") : "—"}</strong></div>
                    <div>Criada: <strong className="text-foreground">{new Date(selecionada.created_at).toLocaleString("pt-BR")}</strong></div>
                  </div>
                </TabsContent>

                <TabsContent value="logs" className="space-y-3">
                  <div className="flex gap-2">
                    <Textarea
                      rows={2}
                      placeholder="Adicionar nota / registro..."
                      value={novaNota}
                      onChange={(e) => setNovaNota(e.target.value)}
                    />
                    <Button onClick={adicionarNota} disabled={!novaNota.trim()} className="gap-1 shrink-0">
                      <Plus className="w-3.5 h-3.5" /> Registrar
                    </Button>
                  </div>
                  <div className="max-h-80 overflow-y-auto space-y-2">
                    {logs.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">Sem registros ainda.</p>
                    ) : (
                      logs.map((l) => (
                        <div key={l.id} className="border rounded-md p-2 text-xs bg-muted/10">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <Badge variant="outline" className="text-[10px]">{l.tipo}</Badge>
                            <span className="text-muted-foreground">{new Date(l.created_at).toLocaleString("pt-BR")}</span>
                          </div>
                          <p className="whitespace-pre-wrap">{l.conteudo}</p>
                          {l.autor && <p className="text-muted-foreground mt-1">por {l.autor}</p>}
                        </div>
                      ))
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="border rounded-md p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}
