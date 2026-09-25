import { useState } from "react";
import { useAutomacaoFollowupRegras, useAutomacaoFollowupExecucoes, AutomacaoFollowupRegra } from "@/hooks/useAutomacaoFollowup";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Zap, Clock, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const ESTAGIOS = ["novos","qualificado","visita","proposta_enviada","negociacao","fechado","perdido"];

const emptyRegra: Partial<AutomacaoFollowupRegra> = {
  ativo: true,
  tipo: "transicao_etapa",
  acao_titulo: "Follow-up automático",
  acao_descricao: "Contatar {lead} sobre {estagio} em até {prazo}.",
  prazo_tarefa_horas: 24,
  escalonamento_horas: 4,
  notificar_gerente: true,
  tipo_followup: "tarefa",
  estagio_origem: null,
  estagio_destino: null,
};

export default function AutomacoesFollowup() {
  const { list, create, update, toggle, remove } = useAutomacaoFollowupRegras();
  const execs = useAutomacaoFollowupExecucoes(100);
  const [openDialog, setOpenDialog] = useState(false);
  const [form, setForm] = useState<Partial<AutomacaoFollowupRegra>>(emptyRegra);
  const [editingId, setEditingId] = useState<string | null>(null);

  const openNew = () => { setForm(emptyRegra); setEditingId(null); setOpenDialog(true); };
  const openEdit = (r: AutomacaoFollowupRegra) => { setForm(r); setEditingId(r.id); setOpenDialog(true); };

  const save = async () => {
    if (editingId) {
      await update.mutateAsync({ id: editingId, ...form } as any);
    } else {
      await create.mutateAsync(form);
    }
    setOpenDialog(false);
  };

  const preview = (form.acao_descricao ?? "")
    .replace(/\{lead\}/g, "João Silva")
    .replace(/\{estagio\}/g, String(form.estagio_destino ?? "qualificado"))
    .replace(/\{prazo\}/g, `${form.prazo_tarefa_horas ?? 24}h`);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Zap className="w-7 h-7 text-primary" /> Automações de Follow-up</h1>
          <p className="text-muted-foreground mt-1">Crie tarefas e alertas automáticos quando leads mudam de etapa ou agendamentos expiram.</p>
        </div>
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" /> Nova regra</Button>
      </div>

      <Tabs defaultValue="regras">
        <TabsList>
          <TabsTrigger value="regras">Regras</TabsTrigger>
          <TabsTrigger value="execucoes">Execuções recentes</TabsTrigger>
        </TabsList>

        <TabsContent value="regras" className="space-y-3 mt-4">
          {list.isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {list.data?.length === 0 && (
            <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhuma regra ainda. Clique em "Nova regra".</CardContent></Card>
          )}
          {(list.data ?? []).map((r) => (
            <Card key={r.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      {r.tipo === "transicao_etapa" ? "🔄" : "⏰"} {r.acao_titulo}
                      <Badge variant={r.ativo ? "default" : "secondary"}>{r.ativo ? "Ativa" : "Pausada"}</Badge>
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {r.tipo === "transicao_etapa"
                        ? <>Quando lead vai de <b>{r.estagio_origem ?? "*"}</b> → <b>{r.estagio_destino ?? "*"}</b></>
                        : <>Quando um agendamento expirar sem conclusão</>}
                      {" · "}Prazo tarefa: <b>{r.prazo_tarefa_horas}h</b>{" · "}Escala: <b>{r.escalonamento_horas}h</b>
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={r.ativo} onCheckedChange={(v) => toggle.mutate({ id: r.id, ativo: v })} />
                    <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Pencil className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remover regra?")) remove.mutate(r.id); }}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{r.acao_descricao}</CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="execucoes" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Últimas execuções</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quando</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Transição</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(execs.data ?? []).map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="text-xs">
                        <Clock className="inline w-3 h-3 mr-1" />
                        {formatDistanceToNow(new Date(e.created_at), { addSuffix: true, locale: ptBR })}
                      </TableCell>
                      <TableCell>{e.tipo === "transicao_etapa" ? "🔄 Etapa" : "⏰ Agend."}</TableCell>
                      <TableCell className="text-xs">
                        {e.estagio_origem ? `${e.estagio_origem} → ${e.estagio_destino}` : "—"}
                      </TableCell>
                      <TableCell>
                        {e.escalado
                          ? <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" /> Escalado</Badge>
                          : <Badge variant="secondary">Ativa</Badge>}
                      </TableCell>
                    </TableRow>
                  ))}
                  {execs.data?.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Sem execuções ainda.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingId ? "Editar regra" : "Nova regra"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(v: any) => setForm(f => ({ ...f, tipo: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="transicao_etapa">Transição de etapa do lead</SelectItem>
                  <SelectItem value="agendamento_expirado">Agendamento expirado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.tipo === "transicao_etapa" && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Etapa de origem</Label>
                  <Select value={form.estagio_origem ?? "any"} onValueChange={(v) => setForm(f => ({ ...f, estagio_origem: v === "any" ? null : v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Qualquer</SelectItem>
                      {ESTAGIOS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Etapa de destino</Label>
                  <Select value={form.estagio_destino ?? "any"} onValueChange={(v) => setForm(f => ({ ...f, estagio_destino: v === "any" ? null : v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Qualquer</SelectItem>
                      {ESTAGIOS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div>
              <Label>Título da tarefa</Label>
              <Input value={form.acao_titulo ?? ""} onChange={(e) => setForm(f => ({ ...f, acao_titulo: e.target.value }))} />
            </div>
            <div>
              <Label>Descrição (variáveis: {"{lead} {estagio} {prazo}"})</Label>
              <Textarea rows={3} value={form.acao_descricao ?? ""} onChange={(e) => setForm(f => ({ ...f, acao_descricao: e.target.value }))} />
              <p className="text-xs text-muted-foreground mt-1">Pré-visualização: <span className="italic">{preview}</span></p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Prazo tarefa (horas)</Label>
                <Input type="number" min={1} value={form.prazo_tarefa_horas ?? 24} onChange={(e) => setForm(f => ({ ...f, prazo_tarefa_horas: Number(e.target.value) }))} />
              </div>
              <div>
                <Label>Escalar após (horas)</Label>
                <Input type="number" min={1} value={form.escalonamento_horas ?? 4} onChange={(e) => setForm(f => ({ ...f, escalonamento_horas: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Tipo de follow-up</Label>
                <Select value={form.tipo_followup ?? "tarefa"} onValueChange={(v) => setForm(f => ({ ...f, tipo_followup: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["tarefa","ligacao","whatsapp","email","reuniao"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2">
                <Switch checked={form.notificar_gerente ?? true} onCheckedChange={(v) => setForm(f => ({ ...f, notificar_gerente: v }))} />
                <Label>Notificar gerente</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenDialog(false)}>Cancelar</Button>
            <Button onClick={save}>{editingId ? "Salvar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
