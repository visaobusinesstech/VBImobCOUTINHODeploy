import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarClock, Plus, Send, Trash2, Pencil, FileText, Table2, Loader2, Mail } from "lucide-react";
import {
  useRelatoriosAgendados,
  TIPOS_RELATORIO,
  PERIODOS,
  FREQUENCIAS,
  DIAS_SEMANA,
  NOVO_RELATORIO,
  type RelatorioAgendado,
} from "@/hooks/useRelatoriosAgendados";

const MODULOS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "imoveis", label: "Imóveis" },
  { key: "crm", label: "CRM Pipeline" },
  { key: "financeiro", label: "Financeiro" },
  { key: "contratos", label: "Contratos" },
  { key: "relacionamento", label: "Relacionamento" },
  { key: "followups", label: "Follow-up" },
  { key: "proprietarios", label: "Proprietários" },
];

type Form = Partial<RelatorioAgendado> & { id?: string };

const fmtData = (v?: string | null) => (v ? new Date(v).toLocaleString("pt-BR") : "—");

export default function RelatoriosAgendados() {
  const { relatorios, execucoes, loading, enviando, salvar, alternarAtivo, remover, enviarAgora } =
    useRelatoriosAgendados();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>({ ...NOVO_RELATORIO });
  const [destinatariosTexto, setDestinatariosTexto] = useState("");
  const [salvando, setSalvando] = useState(false);

  const abrirNovo = () => {
    setForm({ ...NOVO_RELATORIO });
    setDestinatariosTexto("");
    setOpen(true);
  };

  const abrirEdicao = (r: RelatorioAgendado) => {
    setForm({ ...r });
    setDestinatariosTexto((r.destinatarios ?? []).join(", "));
    setOpen(true);
  };

  const emails = useMemo(
    () =>
      destinatariosTexto
        .split(/[,;\n]/)
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.includes("@")),
    [destinatariosTexto],
  );

  const podeSalvar =
    !!form.nome?.trim() && (emails.length > 0 || !!form.enviar_para_permissao || form.incluir_corretores);

  const handleSalvar = async () => {
    setSalvando(true);
    const ok = await salvar({ ...form, destinatarios: emails });
    setSalvando(false);
    if (ok) setOpen(false);
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="order-2 sm:order-1">
          <Button onClick={abrirNovo} className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" /> Novo agendamento
          </Button>
        </div>
        <div className="order-1 text-right sm:order-2">
          <h1 className="text-xl font-semibold sm:text-2xl">Relatórios automáticos</h1>
          <p className="text-sm text-muted-foreground">
            Agende relatórios em PDF ou CSV e envie por e-mail para sua equipe.
          </p>
        </div>
      </div>

      <Tabs defaultValue="agendamentos">
        <TabsList>
          <TabsTrigger value="agendamentos">Agendamentos</TabsTrigger>
          <TabsTrigger value="historico">Histórico de envios</TabsTrigger>
        </TabsList>

        <TabsContent value="agendamentos" className="space-y-4 pt-4">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
            </div>
          ) : relatorios.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                <CalendarClock className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Nenhum relatório agendado ainda. Crie o primeiro envio automático.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {relatorios.map((r) => (
                <Card key={r.id} className={r.ativo ? "" : "opacity-70"}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <CardTitle className="flex items-center gap-2 text-base">
                          {r.formato === "pdf" ? <FileText className="h-4 w-4" /> : <Table2 className="h-4 w-4" />}
                          <span className="truncate">{r.nome}</span>
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {TIPOS_RELATORIO.find((t) => t.value === r.tipo_relatorio)?.label} ·{" "}
                          {PERIODOS.find((p) => p.value === r.periodo)?.label}
                        </CardDescription>
                      </div>
                      <Switch checked={r.ativo} onCheckedChange={(v) => alternarAtivo(r.id, v)} />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{r.formato.toUpperCase()}</Badge>
                      <Badge variant="outline">
                        {FREQUENCIAS.find((f) => f.value === r.frequencia)?.label}
                        {r.frequencia === "semanal" ? ` · ${DIAS_SEMANA[r.dia_semana]}` : ""}
                        {r.frequencia === "mensal" ? ` · dia ${r.dia_mes}` : ""} · {String(r.hora).padStart(2, "0")}h
                      </Badge>
                      {r.incluir_corretores && <Badge variant="outline">Todos os corretores</Badge>}
                      {r.enviar_para_permissao && (
                        <Badge variant="outline">
                          Permissão: {MODULOS.find((m) => m.key === r.enviar_para_permissao)?.label ?? r.enviar_para_permissao}
                        </Badge>
                      )}
                    </div>
                    {r.destinatarios?.length > 0 && (
                      <p className="flex items-start gap-2 text-muted-foreground">
                        <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span className="break-all">{r.destinatarios.join(", ")}</span>
                      </p>
                    )}
                    <Separator />
                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <span>Último envio: {fmtData(r.ultima_execucao)}</span>
                      <span>Próximo: {fmtData(r.proxima_execucao)}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => enviarAgora(r.id)} disabled={enviando === r.id}>
                        {enviando === r.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="mr-2 h-4 w-4" />
                        )}
                        Enviar agora
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => abrirEdicao(r)}>
                        <Pencil className="mr-2 h-4 w-4" /> Editar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remover(r.id)}>
                        <Trash2 className="mr-2 h-4 w-4" /> Excluir
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="historico" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Últimos envios</CardTitle>
              <CardDescription>Registros de execução automática e manual.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {execucoes.length === 0 && <p className="text-sm text-muted-foreground">Nenhum envio registrado.</p>}
              {execucoes.map((e) => {
                const rel = relatorios.find((r) => r.id === e.relatorio_id);
                return (
                  <div key={e.id} className="flex flex-col gap-1 rounded-md border p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={e.status === "sucesso" ? "secondary" : "destructive"}>{e.status}</Badge>
                      <span className="font-medium">{rel?.nome ?? "Relatório"}</span>
                      <span className="text-xs text-muted-foreground">{fmtData(e.executado_em)}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {e.total_registros} registro(s) · {e.formato?.toUpperCase() ?? "—"} ·{" "}
                      {e.destinatarios?.length ?? 0} destinatário(s)
                    </span>
                    {e.erro && <span className="text-xs text-destructive">{e.erro}</span>}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar agendamento" : "Novo relatório automático"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do relatório</Label>
              <Input
                value={form.nome ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                placeholder="Ex.: Resumo semanal de leads"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Conteúdo</Label>
                <Select
                  value={form.tipo_relatorio}
                  onValueChange={(v) => setForm((f) => ({ ...f, tipo_relatorio: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS_RELATORIO.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Formato</Label>
                <Select value={form.formato} onValueChange={(v) => setForm((f) => ({ ...f, formato: v as "pdf" | "csv" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">PDF</SelectItem>
                    <SelectItem value="csv">CSV</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Período coberto</Label>
                <Select value={form.periodo} onValueChange={(v) => setForm((f) => ({ ...f, periodo: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PERIODOS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Frequência</Label>
                <Select
                  value={form.frequencia}
                  onValueChange={(v) => setForm((f) => ({ ...f, frequencia: v as RelatorioAgendado["frequencia"] }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FREQUENCIAS.map((f) => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {form.frequencia === "semanal" && (
                <div className="space-y-2">
                  <Label>Dia da semana</Label>
                  <Select
                    value={String(form.dia_semana ?? 1)}
                    onValueChange={(v) => setForm((f) => ({ ...f, dia_semana: Number(v) }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DIAS_SEMANA.map((d, i) => (
                        <SelectItem key={d} value={String(i)}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {form.frequencia === "mensal" && (
                <div className="space-y-2">
                  <Label>Dia do mês</Label>
                  <Input
                    type="number"
                    min={1}
                    max={28}
                    value={form.dia_mes ?? 1}
                    onChange={(e) => setForm((f) => ({ ...f, dia_mes: Math.min(28, Math.max(1, Number(e.target.value) || 1)) }))}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>Hora do envio</Label>
                <Input
                  type="number"
                  min={0}
                  max={23}
                  value={form.hora ?? 8}
                  onChange={(e) => setForm((f) => ({ ...f, hora: Math.min(23, Math.max(0, Number(e.target.value) || 0)) }))}
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>E-mails adicionais</Label>
              <Input
                value={destinatariosTexto}
                onChange={(e) => setDestinatariosTexto(e.target.value)}
                placeholder="diretor@imob.com, gestor@imob.com"
              />
              <p className="text-xs text-muted-foreground">Separe por vírgula. {emails.length} e-mail(s) válido(s).</p>
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Enviar para todos os corretores ativos</p>
                <p className="text-xs text-muted-foreground">Usa o e-mail cadastrado de cada corretor.</p>
              </div>
              <Switch
                checked={!!form.incluir_corretores}
                onCheckedChange={(v) => setForm((f) => ({ ...f, incluir_corretores: v }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Enviar para usuários com permissão em</Label>
              <Select
                value={form.enviar_para_permissao ?? "nenhum"}
                onValueChange={(v) => setForm((f) => ({ ...f, enviar_para_permissao: v === "nenhum" ? null : v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhum">Não usar permissões</SelectItem>
                  {MODULOS.map((m) => (
                    <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Somente corretores da sua imobiliária com esse módulo liberado recebem o relatório.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSalvar} disabled={!podeSalvar || salvando}>
              {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar agendamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
