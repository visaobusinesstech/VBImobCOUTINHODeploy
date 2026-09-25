import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, CheckCircle2, Clock, AlertTriangle, CalendarClock, Phone, Mail, MessageCircle, Save, PlayCircle } from "lucide-react";
import { toast } from "sonner";

type Followup = {
  id: string;
  pipeline_id: string;
  imobiliaria_id: string;
  corretor_id: string | null;
  dia_offset: number;
  agendado_para: string;
  canal: "whatsapp" | "ligacao" | "email" | string;
  status: "pendente" | "atrasado" | "concluido" | "cancelado" | string;
  notificado_em: string | null;
  executado_em: string | null;
  resultado: string | null;
  observacao: string | null;
  captacao_pipeline?: {
    nome: string;
    telefone: string | null;
    email: string | null;
    imovel_cidade: string | null;
    imovel_bairro: string | null;
    estagio: string;
  } | null;
};

const canalIcon = (c: string) =>
  c === "whatsapp" ? <MessageCircle className="w-3.5 h-3.5" />
  : c === "ligacao" ? <Phone className="w-3.5 h-3.5" />
  : <Mail className="w-3.5 h-3.5" />;

const canalLabel: Record<string, string> = { whatsapp: "WhatsApp", ligacao: "Ligação", email: "E-mail" };

function isToday(iso: string) {
  const d = new Date(iso), n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

export default function CaptacaoFollowupPanel() {
  const { imobiliariaId } = useAuth();
  const [rows, setRows] = useState<Followup[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [cfg, setCfg] = useState<{ dias: number[]; ativo: boolean; atrasoH: number }>({ dias: [1, 3, 7, 14], ativo: true, atrasoH: 24 });
  const [diasInput, setDiasInput] = useState("1, 3, 7, 14");

  async function load() {
    if (!imobiliariaId) return;
    setLoading(true);
    const [{ data: fu }, { data: c }] = await Promise.all([
      supabase
        .from("captacao_pipeline_followups")
        .select("*, captacao_pipeline!inner(nome,telefone,email,imovel_cidade,imovel_bairro,estagio)")
        .order("agendado_para", { ascending: true })
        .limit(500),
      supabase.from("captacao_pipeline_config").select("sla_followup_dias_json, followup_ativo, followup_atraso_horas").eq("imobiliaria_id", imobiliariaId).maybeSingle(),
    ]);
    setRows((fu as any) ?? []);
    if (c) {
      const dias = Array.isArray(c.sla_followup_dias_json) ? (c.sla_followup_dias_json as number[]) : [1, 3, 7, 14];
      setCfg({ dias, ativo: !!c.followup_ativo, atrasoH: c.followup_atraso_horas ?? 24 });
      setDiasInput(dias.join(", "));
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [imobiliariaId]);

  const buckets = useMemo(() => {
    const atrasados = rows.filter((r) => r.status === "atrasado" || (r.status === "pendente" && new Date(r.agendado_para) < new Date() && !isToday(r.agendado_para)));
    const hoje = rows.filter((r) => r.status === "pendente" && isToday(r.agendado_para));
    const proximos = rows.filter((r) => r.status === "pendente" && new Date(r.agendado_para) > new Date() && !isToday(r.agendado_para));
    const concluidos = rows.filter((r) => r.status === "concluido");
    return { atrasados, hoje, proximos, concluidos };
  }, [rows]);

  async function marcarConcluido(id: string, resultado: string) {
    const { error } = await supabase.from("captacao_pipeline_followups").update({
      status: "concluido", executado_em: new Date().toISOString(), resultado,
    }).eq("id", id);
    if (error) return toast.error("Falha ao concluir follow-up");
    toast.success("Follow-up concluído");
    load();
  }

  async function reagendar(id: string, dias: number) {
    const d = new Date(); d.setDate(d.getDate() + dias);
    const { error } = await supabase.from("captacao_pipeline_followups").update({
      agendado_para: d.toISOString(), status: "pendente", notificado_em: null,
    }).eq("id", id);
    if (error) return toast.error("Falha ao reagendar");
    toast.success(`Reagendado para +${dias}d`);
    load();
  }

  async function salvarConfig() {
    if (!imobiliariaId) return;
    const dias = Array.from(new Set(diasInput.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => Number.isFinite(n) && n >= 0 && n <= 365))).sort((a, b) => a - b);
    if (!dias.length) return toast.error("Informe ao menos um dia (ex.: 1, 3, 7, 14)");
    setSaving(true);
    const { error } = await supabase.from("captacao_pipeline_config").upsert({
      imobiliaria_id: imobiliariaId,
      sla_followup_dias_json: dias as any,
      followup_ativo: cfg.ativo,
      followup_atraso_horas: cfg.atrasoH,
    } as any);
    setSaving(false);
    if (error) return toast.error("Falha ao salvar configuração");
    toast.success("Configuração salva. Vale para novos cards.");
    setCfg({ ...cfg, dias });
  }

  async function processarAgora() {
    setProcessing(true);
    const { data, error } = await supabase.rpc("processar_captacao_followups" as any);
    setProcessing(false);
    if (error) return toast.error("Falha ao processar");
    toast.success(`Processado: ${JSON.stringify(data)}`);
    load();
  }

  const Row = ({ r, atrasado }: { r: Followup; atrasado?: boolean }) => (
    <div className={`flex flex-col md:flex-row md:items-center gap-2 border rounded-md p-3 ${atrasado ? "border-destructive/40 bg-destructive/5" : ""}`}>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{r.captacao_pipeline?.nome ?? "—"}</div>
        <div className="text-xs text-muted-foreground truncate">
          {r.captacao_pipeline?.imovel_bairro || r.captacao_pipeline?.imovel_cidade || "—"} • Estágio: {r.captacao_pipeline?.estagio}
        </div>
      </div>
      <Badge variant="outline" className="gap-1">{canalIcon(r.canal)} {canalLabel[r.canal] ?? r.canal}</Badge>
      <Badge variant="secondary">D+{r.dia_offset}</Badge>
      <div className="text-xs text-muted-foreground min-w-[140px]">
        <CalendarClock className="w-3 h-3 inline mr-1" />
        {new Date(r.agendado_para).toLocaleString("pt-BR")}
      </div>
      <div className="flex gap-1 flex-wrap">
        <Button size="sm" variant="outline" onClick={() => marcarConcluido(r.id, "contato_feito")}>
          <CheckCircle2 className="w-3 h-3 mr-1" />Concluir
        </Button>
        <Button size="sm" variant="ghost" onClick={() => reagendar(r.id, 1)}>+1d</Button>
        <Button size="sm" variant="ghost" onClick={() => reagendar(r.id, 3)}>+3d</Button>
        <Button size="sm" variant="ghost" onClick={() => reagendar(r.id, 7)}>+7d</Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="w-4 h-4" /> Configuração de Follow-up automático
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <Label>Dias após criação (separados por vírgula)</Label>
              <Input value={diasInput} onChange={(e) => setDiasInput(e.target.value)} placeholder="1, 3, 7, 14" />
              <p className="text-xs text-muted-foreground mt-1">Ex.: 1,3,7,14 gera 4 tarefas por card</p>
            </div>
            <div>
              <Label>Horas para virar "Atrasado"</Label>
              <Input type="number" min={1} max={168} value={cfg.atrasoH} onChange={(e) => setCfg({ ...cfg, atrasoH: parseInt(e.target.value || "24", 10) })} />
            </div>
            <div className="flex items-end gap-3">
              <div className="flex items-center gap-2">
                <Switch checked={cfg.ativo} onCheckedChange={(v) => setCfg({ ...cfg, ativo: v })} />
                <span className="text-sm">Ativo</span>
              </div>
              <Button onClick={salvarConfig} disabled={saving} className="ml-auto">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}Salvar
              </Button>
              <Button variant="outline" onClick={processarAgora} disabled={processing}>
                {processing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <PlayCircle className="w-4 h-4 mr-1" />}Processar agora
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Atrasados</div><div className="text-2xl font-semibold text-destructive flex items-center gap-2"><AlertTriangle className="w-5 h-5" />{buckets.atrasados.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Hoje</div><div className="text-2xl font-semibold flex items-center gap-2"><Clock className="w-5 h-5" />{buckets.hoje.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Próximos</div><div className="text-2xl font-semibold flex items-center gap-2"><CalendarClock className="w-5 h-5" />{buckets.proximos.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Concluídos</div><div className="text-2xl font-semibold text-emerald-600 flex items-center gap-2"><CheckCircle2 className="w-5 h-5" />{buckets.concluidos.length}</div></CardContent></Card>
      </div>

      <Tabs defaultValue="atrasados">
        <TabsList>
          <TabsTrigger value="atrasados">Atrasados ({buckets.atrasados.length})</TabsTrigger>
          <TabsTrigger value="hoje">Hoje ({buckets.hoje.length})</TabsTrigger>
          <TabsTrigger value="proximos">Próximos ({buckets.proximos.length})</TabsTrigger>
          <TabsTrigger value="concluidos">Concluídos ({buckets.concluidos.length})</TabsTrigger>
        </TabsList>
        {loading ? (
          <div className="p-6 text-center text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Carregando…</div>
        ) : (
          <>
            <TabsContent value="atrasados" className="mt-3 space-y-2">
              {buckets.atrasados.length === 0 ? <div className="text-sm text-muted-foreground p-4">Sem follow-ups atrasados 🎉</div> : buckets.atrasados.map((r) => <Row key={r.id} r={r} atrasado />)}
            </TabsContent>
            <TabsContent value="hoje" className="mt-3 space-y-2">
              {buckets.hoje.length === 0 ? <div className="text-sm text-muted-foreground p-4">Nada agendado para hoje.</div> : buckets.hoje.map((r) => <Row key={r.id} r={r} />)}
            </TabsContent>
            <TabsContent value="proximos" className="mt-3 space-y-2">
              {buckets.proximos.slice(0, 100).map((r) => <Row key={r.id} r={r} />)}
              {buckets.proximos.length === 0 && <div className="text-sm text-muted-foreground p-4">Sem próximos.</div>}
            </TabsContent>
            <TabsContent value="concluidos" className="mt-3 space-y-2">
              {buckets.concluidos.slice(0, 100).map((r) => <Row key={r.id} r={r} />)}
              {buckets.concluidos.length === 0 && <div className="text-sm text-muted-foreground p-4">Nenhum concluído ainda.</div>}
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}
