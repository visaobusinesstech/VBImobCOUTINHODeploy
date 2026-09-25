import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Sparkles, Search, Plus, RefreshCw, ExternalLink, FileText, X, Trash2, Edit, Clock,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  useCuradoriaTemas, useCuradoriaDescobertas, useCuradoriaConfig, useCuradoriaExecucoes,
  useSalvarTema, useExcluirTema, useSalvarConfig, useBuscarAgora, useGerarRascunho, useDescartarDescoberta,
  type CuradoriaTema, type CuradoriaConfig,
} from "@/hooks/useCuradoriaViral";

const PERIODOS = [
  { value: "qdr:d", label: "Últimas 24 horas" },
  { value: "qdr:w", label: "Última semana" },
  { value: "qdr:m", label: "Último mês" },
  { value: "qdr:y", label: "Último ano" },
];

function scoreBadge(score: number) {
  if (score >= 75) return <Badge className="bg-emerald-600">🔥 {score}</Badge>;
  if (score >= 55) return <Badge className="bg-amber-600">⚡ {score}</Badge>;
  return <Badge variant="secondary">{score}</Badge>;
}

// -------- Descobertas Panel --------
function DescobertasPanel() {
  const [status, setStatus] = useState("nova");
  const [q, setQ] = useState("");
  const { data: descobertas = [], isLoading } = useCuradoriaDescobertas(status);
  const gerar = useGerarRascunho();
  const descartar = useDescartarDescoberta();
  const buscar = useBuscarAgora();

  const filtradas = descobertas.filter((d) =>
    !q || d.titulo.toLowerCase().includes(q.toLowerCase()) || (d.fonte_dominio || "").includes(q.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <Button onClick={() => buscar.mutate(undefined)} disabled={buscar.isPending} size="sm">
          {buscar.isPending ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
          Buscar agora
        </Button>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="nova">Novas</SelectItem>
            <SelectItem value="rascunho_gerado">Rascunho gerado</SelectItem>
            <SelectItem value="descartada">Descartadas</SelectItem>
            <SelectItem value="todas">Todas</SelectItem>
          </SelectContent>
        </Select>
        <Input placeholder="Buscar por título ou fonte..." value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <div className="ml-auto text-sm text-muted-foreground">{filtradas.length} descoberta(s)</div>
      </div>

      {isLoading && <div className="text-muted-foreground text-sm">Carregando…</div>}
      {!isLoading && filtradas.length === 0 && (
        <Card><CardContent className="py-10 text-center text-muted-foreground">
          Nenhuma descoberta ainda. Cadastre um tema e clique em "Buscar agora".
        </CardContent></Card>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {filtradas.map((d) => (
          <Card key={d.id} className="flex flex-col">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base leading-snug line-clamp-2">{d.titulo}</CardTitle>
                {scoreBadge(Number(d.score_viralidade))}
              </div>
              <CardDescription className="flex items-center gap-2 text-xs">
                <span className="truncate">{d.fonte_nome || d.fonte_dominio}</span>
                <span>•</span>
                <Clock className="w-3 h-3" />
                <span>{formatDistanceToNow(new Date(d.created_at), { addSuffix: true, locale: ptBR })}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-3">
              {d.resumo && <p className="text-sm text-muted-foreground line-clamp-3">{d.resumo}</p>}
              <div className="flex flex-wrap gap-2 mt-auto pt-2">
                <Button size="sm" variant="outline" asChild>
                  <a href={d.url} target="_blank" rel="noopener noreferrer nofollow">
                    <ExternalLink className="w-3 h-3 mr-1" /> Abrir original
                  </a>
                </Button>
                {d.status === "nova" && (
                  <>
                    <Button size="sm" onClick={() => gerar.mutate(d.id)} disabled={gerar.isPending}>
                      <Sparkles className="w-3 h-3 mr-1" /> Gerar rascunho
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => descartar.mutate({ id: d.id })}>
                      <X className="w-3 h-3 mr-1" /> Descartar
                    </Button>
                  </>
                )}
                {d.status === "rascunho_gerado" && d.conteudo_seo_id && (
                  <Button size="sm" variant="outline" asChild>
                    <a href={`/conteudo-seo`}><FileText className="w-3 h-3 mr-1" /> Ver rascunho</a>
                  </Button>
                )}
                {d.status === "descartada" && <Badge variant="outline">Descartada</Badge>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// -------- Temas Panel --------
function TemaDialog({
  open, onOpenChange, tema, onSave,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  tema?: CuradoriaTema | null;
  onSave: (t: Partial<CuradoriaTema>) => void;
}) {
  const [form, setForm] = useState<Partial<CuradoriaTema>>(
    tema ?? { nome: "", palavras_chave: [], fontes_permitidas: [], fontes_bloqueadas: [], idioma: "pt-BR", periodo_busca: "qdr:w", max_por_execucao: 10, ativo: true },
  );
  const toArr = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{tema ? "Editar tema" : "Novo tema de curadoria"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome do tema</Label>
            <Input value={form.nome || ""} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Mercado imobiliário DF" />
          </div>
          <div>
            <Label>Palavras-chave (vírgula)</Label>
            <Textarea value={(form.palavras_chave || []).join(", ")}
              onChange={(e) => setForm({ ...form, palavras_chave: toArr(e.target.value) })}
              placeholder="financiamento caixa, taxa selic, aluguel brasília" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Período de busca</Label>
              <Select value={form.periodo_busca} onValueChange={(v) => setForm({ ...form, periodo_busca: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PERIODOS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Máx por execução</Label>
              <Input type="number" min={1} max={20} value={form.max_por_execucao ?? 10}
                onChange={(e) => setForm({ ...form, max_por_execucao: parseInt(e.target.value) || 10 })} />
            </div>
          </div>
          <div>
            <Label>Fontes permitidas (domínios, vírgula) — opcional</Label>
            <Input value={(form.fontes_permitidas || []).join(", ")}
              onChange={(e) => setForm({ ...form, fontes_permitidas: toArr(e.target.value) })}
              placeholder="g1.globo.com, infomoney.com.br" />
          </div>
          <div>
            <Label>Fontes bloqueadas (domínios, vírgula)</Label>
            <Input value={(form.fontes_bloqueadas || []).join(", ")}
              onChange={(e) => setForm({ ...form, fontes_bloqueadas: toArr(e.target.value) })}
              placeholder="exemplo-spam.com" />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.ativo ?? true} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
            <Label>Tema ativo</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => { onSave(form); onOpenChange(false); }} disabled={!form.nome}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TemasPanel() {
  const { data: temas = [], isLoading } = useCuradoriaTemas();
  const salvar = useSalvarTema();
  const excluir = useExcluirTema();
  const buscar = useBuscarAgora();
  const [openDialog, setOpenDialog] = useState(false);
  const [editing, setEditing] = useState<CuradoriaTema | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={() => { setEditing(null); setOpenDialog(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Novo tema
        </Button>
      </div>

      {isLoading && <div className="text-muted-foreground text-sm">Carregando…</div>}
      {!isLoading && temas.length === 0 && (
        <Card><CardContent className="py-10 text-center text-muted-foreground">
          Nenhum tema cadastrado. Cadastre o primeiro para começar a curadoria.
        </CardContent></Card>
      )}

      <div className="grid gap-3">
        {temas.map((t) => (
          <Card key={t.id}>
            <CardContent className="py-4 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{t.nome}</span>
                  {t.ativo ? <Badge className="bg-emerald-600">Ativo</Badge> : <Badge variant="secondary">Pausado</Badge>}
                </div>
                <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-1">
                  {t.palavras_chave.slice(0, 6).map((k, i) => <Badge key={i} variant="outline">{k}</Badge>)}
                </div>
                {t.ultima_execucao && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Última busca: {formatDistanceToNow(new Date(t.ultima_execucao), { addSuffix: true, locale: ptBR })}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => buscar.mutate(t.id)} disabled={buscar.isPending}>
                  <Search className="w-3 h-3 mr-1" /> Buscar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setEditing(t); setOpenDialog(true); }}>
                  <Edit className="w-3 h-3" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { if (confirm("Excluir este tema?")) excluir.mutate(t.id); }}>
                  <Trash2 className="w-3 h-3 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <TemaDialog open={openDialog} onOpenChange={setOpenDialog} tema={editing}
        onSave={(t) => salvar.mutate(editing ? { ...t, id: editing.id } : t)} />
    </div>
  );
}

// -------- Configuração Panel --------
function ConfigPanel() {
  const { data: cfg } = useCuradoriaConfig();
  const salvar = useSalvarConfig();
  const [form, setForm] = useState<CuradoriaConfig | null>(null);
  const value = form ?? cfg;
  if (!value) return <div className="text-muted-foreground text-sm">Carregando…</div>;

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Política de publicação</CardTitle>
        <CardDescription>Defina como os rascunhos gerados devem ser publicados no seu blog.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Modo de publicação</Label>
          <Select value={value.modo_publicacao} onValueChange={(v) => setForm({ ...value, modo_publicacao: v as CuradoriaConfig["modo_publicacao"] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">Manual — revisar cada post antes de publicar</SelectItem>
              <SelectItem value="automatico">Automático — publica direto se atender ao score mínimo</SelectItem>
              <SelectItem value="agendado">Agendado — enfileira X posts por dia</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Frequência de busca (horas)</Label>
            <Input type="number" min={1} value={value.frequencia_horas}
              onChange={(e) => setForm({ ...value, frequencia_horas: parseInt(e.target.value) || 4 })} />
          </div>
          <div>
            <Label>Máx posts por dia</Label>
            <Input type="number" min={1} value={value.max_posts_por_dia}
              onChange={(e) => setForm({ ...value, max_posts_por_dia: parseInt(e.target.value) || 3 })} />
          </div>
        </div>
        <div>
          <Label>Score mínimo de viralidade para gerar rascunho</Label>
          <Input type="number" min={0} max={100} value={value.score_minimo}
            onChange={(e) => setForm({ ...value, score_minimo: parseInt(e.target.value) || 50 })} />
          <p className="text-xs text-muted-foreground mt-1">Descobertas abaixo do score não são convertidas automaticamente.</p>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={value.aprovacao_obrigatoria}
            onCheckedChange={(v) => setForm({ ...value, aprovacao_obrigatoria: v })} />
          <Label>Aprovação humana obrigatória antes de publicar</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={value.ativo} onCheckedChange={(v) => setForm({ ...value, ativo: v })} />
          <Label>Módulo ativo</Label>
        </div>
        <div className="pt-2 flex gap-2">
          <Button onClick={() => salvar.mutate(value)} disabled={salvar.isPending}>Salvar configuração</Button>
        </div>
        <div className="mt-6 p-3 rounded-md bg-muted/40 border text-sm">
          <p className="font-semibold mb-1">🛡️ Atribuição obrigatória</p>
          <p className="text-muted-foreground">
            Todo post gerado inclui a fonte original com link direto (rel="nofollow noopener") e uma seção "Fontes e Créditos".
            Rascunhos sem ao menos uma fonte válida não podem ser publicados — regra dura, não configurável.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// -------- Histórico Panel --------
function HistoricoPanel() {
  const { data: logs = [] } = useCuradoriaExecucoes();
  return (
    <div className="space-y-2">
      {logs.length === 0 && (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Nenhuma execução registrada ainda.</CardContent></Card>
      )}
      {logs.map((l: {
        id: string; tipo: string; status: string; descobertas_novas: number;
        descobertas_encontradas: number; posts_gerados: number; duracao_ms: number | null;
        created_at: string; erro: string | null;
      }) => (
        <Card key={l.id}>
          <CardContent className="py-3 flex flex-wrap items-center gap-3 text-sm">
            <Badge variant={l.status === "sucesso" ? "default" : "destructive"}>{l.tipo}</Badge>
            <span>{l.descobertas_novas} novas / {l.descobertas_encontradas} encontradas</span>
            {l.posts_gerados > 0 && <span>• {l.posts_gerados} post(s) gerado(s)</span>}
            {l.duracao_ms && <span className="text-muted-foreground">• {(l.duracao_ms / 1000).toFixed(1)}s</span>}
            <span className="ml-auto text-muted-foreground">
              {formatDistanceToNow(new Date(l.created_at), { addSuffix: true, locale: ptBR })}
            </span>
            {l.erro && <div className="w-full text-destructive text-xs">Erro: {l.erro}</div>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function CuradoriaViral() {
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Sparkles className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Curadoria Viral com IA</h1>
          <p className="text-muted-foreground">
            Descubra conteúdo em alta sobre seus temas, gere posts originais e publique no blog com atribuição obrigatória à fonte.
          </p>
        </div>
      </div>

      <Tabs defaultValue="descobertas">
        <TabsList>
          <TabsTrigger value="descobertas">Descobertas</TabsTrigger>
          <TabsTrigger value="temas">Temas</TabsTrigger>
          <TabsTrigger value="config">Configuração</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>
        <TabsContent value="descobertas" className="mt-4"><DescobertasPanel /></TabsContent>
        <TabsContent value="temas" className="mt-4"><TemasPanel /></TabsContent>
        <TabsContent value="config" className="mt-4"><ConfigPanel /></TabsContent>
        <TabsContent value="historico" className="mt-4"><HistoricoPanel /></TabsContent>
      </Tabs>
    </div>
  );
}
