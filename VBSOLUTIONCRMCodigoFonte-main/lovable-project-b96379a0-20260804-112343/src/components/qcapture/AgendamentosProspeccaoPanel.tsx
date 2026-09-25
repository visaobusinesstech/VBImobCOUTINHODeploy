import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { CalendarClock, Play, Pause, CheckCircle2, XCircle, Plus, RotateCcw, Clock } from "lucide-react";
import { format, isPast, isToday, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";

type Etapa = "portaria" | "administradora" | "sindico" | "canais_publicos" | "registro_lgpd" | "custom";
type Status = "pendente" | "concluida" | "sem_resposta" | "cancelada" | "pausada" | "expirada";

interface Agendamento {
  id: string;
  prospeccao_id: string;
  etapa: Etapa;
  descricao: string | null;
  agendado_para: string;
  tentativa_num: number;
  max_tentativas: number;
  intervalo_dias: number;
  status: Status;
  pausado_ate: string | null;
  motivo_pausa: string | null;
  observacao: string | null;
  concluido_em: string | null;
  created_at: string;
}

interface Prospeccao {
  id: string;
  condominio_nome: string | null;
}

const ETAPA_LABEL: Record<Etapa, string> = {
  portaria: "Portaria",
  administradora: "Administradora",
  sindico: "Síndico",
  canais_publicos: "Canais públicos",
  registro_lgpd: "Registro LGPD",
  custom: "Personalizada",
};

const STATUS_STYLE: Record<Status, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  pendente: { label: "Pendente", variant: "default" },
  concluida: { label: "Concluída", variant: "secondary" },
  sem_resposta: { label: "Sem resposta", variant: "outline" },
  cancelada: { label: "Cancelada", variant: "outline" },
  pausada: { label: "Pausada", variant: "destructive" },
  expirada: { label: "Expirada", variant: "destructive" },
};

export function AgendamentosProspeccaoPanel() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<Agendamento[]>([]);
  const [prosp, setProsp] = useState<Prospeccao[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<Status | "todos">("pendente");
  const [openNew, setOpenNew] = useState(false);
  const [form, setForm] = useState({
    prospeccao_id: "",
    etapa: "portaria" as Etapa,
    descricao: "",
    agendado_para: format(addDays(new Date(), 3), "yyyy-MM-dd'T'HH:mm"),
    max_tentativas: 3,
    intervalo_dias: 3,
  });

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: ags }, { data: ps }] = await Promise.all([
      supabase
        .from("condominio_prospeccao_agendamentos" as any)
        .select("*")
        .eq("imobiliaria_id", user.id)
        .order("agendado_para", { ascending: true }),
      supabase
        .from("condominio_prospeccoes" as any)
        .select("id, condominio_nome")
        .eq("imobiliaria_id", user.id)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);
    setItems(((ags as any) || []) as Agendamento[]);
    setProsp(((ps as any) || []) as Prospeccao[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const filtered = useMemo(
    () => (filtroStatus === "todos" ? items : items.filter((i) => i.status === filtroStatus)),
    [items, filtroStatus]
  );

  const kpis = useMemo(() => {
    const now = new Date();
    return {
      pend: items.filter((i) => i.status === "pendente").length,
      hoje: items.filter((i) => i.status === "pendente" && isToday(new Date(i.agendado_para))).length,
      atras: items.filter((i) => i.status === "pendente" && isPast(new Date(i.agendado_para)) && !isToday(new Date(i.agendado_para))).length,
      pausadas: items.filter((i) => i.status === "pausada").length,
    };
  }, [items]);

  const criar = async () => {
    if (!user || !form.prospeccao_id) {
      toast({ title: "Selecione uma prospecção", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("condominio_prospeccao_agendamentos" as any).insert({
      imobiliaria_id: user.id,
      prospeccao_id: form.prospeccao_id,
      etapa: form.etapa,
      descricao: form.descricao || null,
      agendado_para: new Date(form.agendado_para).toISOString(),
      max_tentativas: form.max_tentativas,
      intervalo_dias: form.intervalo_dias,
      tentativa_num: 1,
    });
    if (error) {
      toast({ title: "Erro ao agendar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Agendamento criado" });
    setOpenNew(false);
    load();
  };

  const concluir = async (id: string, resultado: "concluida" | "sem_resposta") => {
    const obs = resultado === "sem_resposta" ? window.prompt("Observação (opcional):") || null : null;
    const { error } = await supabase.rpc("condo_prosp_agendamento_concluir" as any, {
      _id: id,
      _resultado: resultado,
      _observacao: obs,
      _agendar_proxima: true,
    });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: resultado === "concluida" ? "Marcado como concluído" : "Registrado — próxima tentativa agendada",
    });
    load();
  };

  const alterarStatus = async (id: string, patch: Partial<Agendamento>) => {
    const { error } = await supabase
      .from("condominio_prospeccao_agendamentos" as any)
      .update(patch)
      .eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    load();
  };

  const pausar = async (id: string) => {
    const dias = Number(window.prompt("Pausar por quantos dias?", "7") || 0);
    if (!dias) return;
    await alterarStatus(id, {
      status: "pausada",
      pausado_ate: addDays(new Date(), dias).toISOString(),
      motivo_pausa: `Pausa manual por ${dias} dias`,
    });
    toast({ title: `Pausado por ${dias} dias` });
  };

  const retomar = async (id: string) => {
    await alterarStatus(id, { status: "pendente", pausado_ate: null, motivo_pausa: null });
    toast({ title: "Retomado" });
  };

  const reagendar = async (id: string) => {
    const dias = Number(window.prompt("Reagendar para daqui a quantos dias?", "3") || 0);
    if (!dias) return;
    await alterarStatus(id, {
      status: "pendente",
      agendado_para: addDays(new Date(), dias).toISOString(),
    });
    toast({ title: "Reagendado" });
  };

  const cancelar = async (id: string) => {
    if (!window.confirm("Cancelar este agendamento?")) return;
    await alterarStatus(id, { status: "cancelada" });
  };

  const nomeProsp = (id: string) => prosp.find((p) => p.id === id)?.condominio_nome || "—";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Pendentes</div><div className="text-2xl font-semibold">{kpis.pend}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Hoje</div><div className="text-2xl font-semibold text-primary">{kpis.hoje}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Atrasadas</div><div className="text-2xl font-semibold text-destructive">{kpis.atras}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Pausadas</div><div className="text-2xl font-semibold">{kpis.pausadas}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2"><CalendarClock className="w-4 h-4" /> Agendamentos de prospecção</CardTitle>
            <CardDescription>Programe reexecuções (ex.: novo contato após 3 dias), controle tentativas e pause automaticamente.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={filtroStatus} onValueChange={(v) => setFiltroStatus(v as any)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="pendente">Pendentes</SelectItem>
                <SelectItem value="concluida">Concluídas</SelectItem>
                <SelectItem value="sem_resposta">Sem resposta</SelectItem>
                <SelectItem value="pausada">Pausadas</SelectItem>
                <SelectItem value="cancelada">Canceladas</SelectItem>
              </SelectContent>
            </Select>
            <Dialog open={openNew} onOpenChange={setOpenNew}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Novo agendamento</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Agendar etapa de prospecção</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>Prospecção</Label>
                    <Select value={form.prospeccao_id} onValueChange={(v) => setForm({ ...form, prospeccao_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione o condomínio prospectado" /></SelectTrigger>
                      <SelectContent>
                        {prosp.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.condominio_nome || p.id.slice(0, 8)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Etapa</Label>
                      <Select value={form.etapa} onValueChange={(v) => setForm({ ...form, etapa: v as Etapa })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(ETAPA_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Data e hora</Label>
                      <Input type="datetime-local" value={form.agendado_para} onChange={(e) => setForm({ ...form, agendado_para: e.target.value })} />
                    </div>
                    <div>
                      <Label>Máx. tentativas</Label>
                      <Input type="number" min={1} max={10} value={form.max_tentativas} onChange={(e) => setForm({ ...form, max_tentativas: Number(e.target.value) })} />
                    </div>
                    <div>
                      <Label>Intervalo entre tentativas (dias)</Label>
                      <Input type="number" min={1} max={60} value={form.intervalo_dias} onChange={(e) => setForm({ ...form, intervalo_dias: Number(e.target.value) })} />
                    </div>
                  </div>
                  <div>
                    <Label>Descrição / roteiro</Label>
                    <Textarea rows={3} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Ex.: Ligar para a administradora e falar com Dra. Maria sobre parceria." />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpenNew(false)}>Cancelar</Button>
                  <Button onClick={criar}>Agendar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">Carregando…</div>
          ) : filtered.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">Nenhum agendamento nesta visão.</div>
          ) : (
            <div className="space-y-2">
              {filtered.map((a) => {
                const dt = new Date(a.agendado_para);
                const atrasado = a.status === "pendente" && isPast(dt) && !isToday(dt);
                return (
                  <div key={a.id} className={`border rounded-lg p-3 flex flex-wrap items-center gap-3 ${atrasado ? "border-destructive/40 bg-destructive/5" : ""}`}>
                    <div className="flex-1 min-w-[220px]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={STATUS_STYLE[a.status].variant}>{STATUS_STYLE[a.status].label}</Badge>
                        <Badge variant="outline">{ETAPA_LABEL[a.etapa]}</Badge>
                        <Badge variant="outline">Tentativa {a.tentativa_num}/{a.max_tentativas}</Badge>
                        {atrasado && <Badge variant="destructive"><Clock className="w-3 h-3 mr-1" />Atrasado</Badge>}
                      </div>
                      <div className="text-sm font-medium mt-1">{nomeProsp(a.prospeccao_id)}</div>
                      <div className="text-xs text-muted-foreground">
                        {format(dt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} · intervalo {a.intervalo_dias}d
                      </div>
                      {a.descricao && <div className="text-xs mt-1 text-muted-foreground line-clamp-2">{a.descricao}</div>}
                      {a.motivo_pausa && <div className="text-xs text-destructive mt-1">⏸ {a.motivo_pausa}</div>}
                      {a.observacao && <div className="text-xs italic mt-1">"{a.observacao}"</div>}
                    </div>
                    <div className="flex items-center gap-1 flex-wrap justify-end">
                      {a.status === "pendente" && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => concluir(a.id, "concluida")}><CheckCircle2 className="w-3 h-3 mr-1" />Concluir</Button>
                          <Button size="sm" variant="outline" onClick={() => concluir(a.id, "sem_resposta")}><RotateCcw className="w-3 h-3 mr-1" />Sem resposta</Button>
                          <Button size="sm" variant="ghost" onClick={() => reagendar(a.id)}>Reagendar</Button>
                          <Button size="sm" variant="ghost" onClick={() => pausar(a.id)}><Pause className="w-3 h-3" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => cancelar(a.id)}><XCircle className="w-3 h-3" /></Button>
                        </>
                      )}
                      {a.status === "pausada" && (
                        <Button size="sm" variant="outline" onClick={() => retomar(a.id)}><Play className="w-3 h-3 mr-1" />Retomar</Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
