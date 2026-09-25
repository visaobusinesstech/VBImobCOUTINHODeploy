import { useState, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Plus, AlertTriangle, TrendingUp, DollarSign, Trophy, Activity, Radar, CalendarClock, Download } from "lucide-react";
import CaptacaoFollowupPanel from "@/components/captacao-pipeline/CaptacaoFollowupPanel";
import RadarZapAuditoriaDialog from "@/components/captacao-pipeline/RadarZapAuditoriaDialog";
import GrupoDetalhesDialog from "@/components/captacao-pipeline/GrupoDetalhesDialog";
import { LgpdStatusBadge } from "@/components/captacao-pipeline/LgpdStatusBadge";
import { LgpdDossieButton } from "@/components/captacao-pipeline/LgpdDossieButton";
import { useCorretoresCap } from "@/hooks/useFilaDistribuicao";
import { useToast } from "@/hooks/use-toast";
import {
  useCaptacaoPipeline,
  useCaptacaoPipelineMetricas,
  useCaptacaoPipelineSla,
  ESTAGIOS_ATIVOS,
  ESTAGIO_LABEL,
  type CaptacaoEstagio,
  type CaptacaoPipelineRow,
} from "@/hooks/useCaptacaoPipeline";

const currency = (n?: number | null) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n ?? 0);

function hoursSince(iso?: string | null) {
  if (!iso) return 0;
  return Math.max(0, (Date.now() - new Date(iso).getTime()) / 3_600_000);
}

const SLA_POR_ESTAGIO: Record<CaptacaoEstagio, number> = {
  Prospectado: 24,
  Contactado: 48,
  Interessado: 72,
  "Avaliacao Enviada": 120,
  Autorizacao: 168,
  "Contrato Assinado": 0,
  Perdido: 0,
};

function slaVariant(row: CaptacaoPipelineRow): "ok" | "warn" | "late" {
  const sla = SLA_POR_ESTAGIO[row.estagio] || 0;
  if (!sla) return "ok";
  const h = hoursSince(row.estagio_desde);
  if (h > sla) return "late";
  if (h > sla * 0.75) return "warn";
  return "ok";
}

function PipelineCard({
  row,
  onMove,
  onActivity,
}: {
  row: CaptacaoPipelineRow;
  onMove: (to: CaptacaoEstagio) => void;
  onActivity: () => void;
}) {
  const variant = slaVariant(row);
  const idx = ESTAGIOS_ATIVOS.indexOf(row.estagio);
  const nextStage = idx >= 0 && idx < ESTAGIOS_ATIVOS.length - 1 ? ESTAGIOS_ATIVOS[idx + 1] : null;
  const dias = Math.floor(hoursSince(row.estagio_desde) / 24);
  const [auditOpen, setAuditOpen] = useState(false);
  const [grupoOpen, setGrupoOpen] = useState(false);
  const dadosCard = (row as any).dados as Record<string, any> | null | undefined;
  const isRadarZap = !!(dadosCard?.radarzap_lead_id || dadosCard?.origem_grupo_nome || (row.origem ?? "").toLowerCase() === "radarzap");
  const dupCount = Array.isArray(dadosCard?.radarzap_duplicados) ? dadosCard!.radarzap_duplicados.length : 0;
  return (
    <Card className="mb-2">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="font-medium text-sm leading-tight">{row.nome}</div>
          <Badge
            variant={variant === "late" ? "destructive" : variant === "warn" ? "secondary" : "outline"}
            className="text-[10px]"
          >
            {dias}d
          </Badge>
        </div>
        {row.telefone && <div className="text-xs text-muted-foreground">{row.telefone}</div>}
        {(row.imovel_bairro || row.imovel_cidade) && (
          <div className="text-xs text-muted-foreground truncate">
            {[row.imovel_bairro, row.imovel_cidade].filter(Boolean).join(" · ")}
          </div>
        )}
        {row.valor_estimado ? (
          <div className="text-xs font-medium">{currency(row.valor_estimado)}</div>
        ) : null}
        {(() => {
          const d = dadosCard;
          if (!d) return null;
          const grupo = d.origem_grupo_nome as string | undefined;
          const link = d.origem_grupo_link as string | undefined;
          const cidade = d.origem_grupo_cidade as string | undefined;
          const uf = d.origem_grupo_uf as string | undefined;
          const canal = (d.origem_canal as string | undefined) ??
            ((row.origem ?? "").toLowerCase() === "radarzap" ? "WhatsApp" : null);
          if (!grupo && !canal) return null;
          const local = [cidade, uf].filter(Boolean).join("/");
          const label = grupo
            ? `${canal ?? "Fonte"} · ${grupo}${local ? ` — ${local}` : ""}`
            : `${canal} — origem sem grupo vinculado`;
          const dataMsg = d.origem_mensagem_em as string | undefined;
          const operacao = row.operacao as string | undefined;
          return (
            <div className="pt-1 space-y-1">
              <div className="flex items-center gap-1 flex-wrap">
                <Badge
                  variant="secondary"
                  className="text-[10px] font-normal max-w-full truncate cursor-pointer"
                  title="Ver detalhes do grupo"
                  onClick={(e) => { e.stopPropagation(); setGrupoOpen(true); }}
                >
                  <Radar className="w-3 h-3 mr-1 shrink-0" />
                  <span className="truncate">{label}</span>
                </Badge>
                {link && (
                  <a href={link} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-[10px] text-primary hover:underline">grupo↗</a>
                )}
              </div>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
                {operacao && <span>Op.: <b className="text-foreground/80">{operacao}</b></span>}
                {dataMsg && <span>Msg: {new Date(dataMsg).toLocaleDateString("pt-BR")}</span>}
                {dupCount > 0 && <Badge variant="outline" className="text-[10px]">+{dupCount} dup.</Badge>}
              </div>
            </div>
          );
        })()}
        <div className="flex items-center gap-1 pt-1">
          <LgpdStatusBadge status={(row as any).lgpd_status} />
        </div>
        <div className="flex gap-1 pt-1">
          <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={onActivity}>
            Atividade
          </Button>
          <LgpdDossieButton leadTipo="pipeline" leadId={row.id} lgpdStatus={(row as any).lgpd_status} compact />
          {isRadarZap && (
            <Button size="sm" variant="ghost" className="h-7 text-xs px-2" title="Auditoria RadarZAP" onClick={() => setAuditOpen(true)}>
              <Radar className="w-3 h-3" />
            </Button>
          )}
          {nextStage && (
            <Button size="sm" className="h-7 text-xs flex-1" onClick={() => onMove(nextStage)}>
              → {ESTAGIO_LABEL[nextStage].split(" ")[0]}
            </Button>
          )}
        </div>
      </CardContent>
      {isRadarZap && (
        <>
          <RadarZapAuditoriaDialog open={auditOpen} onOpenChange={setAuditOpen} pipelineId={row.id} dados={dadosCard} />
          <GrupoDetalhesDialog
            open={grupoOpen}
            onOpenChange={setGrupoOpen}
            hint={{
              nome: dadosCard?.origem_grupo_nome,
              link: dadosCard?.origem_grupo_link,
              cidade: dadosCard?.origem_grupo_cidade,
              uf: dadosCard?.origem_grupo_uf,
              bairro: dadosCard?.origem_grupo_bairro,
            }}
          />
        </>
      )}
    </Card>
  );
}

function NovoLeadDialog() {
  const { create } = useCaptacaoPipeline();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ nome: "", telefone: "", operacao: "Venda" });
  const submit = async () => {
    if (!form.nome?.trim()) return;
    await create.mutateAsync({
      ...form,
      valor_estimado: form.valor_estimado ? Number(form.valor_estimado) : null,
      estagio: "Prospectado",
    });
    setForm({ nome: "", telefone: "", operacao: "Venda" });
    setOpen(false);
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-1" /> Novo Prospectado
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo lead de captação</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome *</Label>
            <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Telefone</Label>
              <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Cidade</Label>
              <Input value={form.imovel_cidade ?? ""} onChange={(e) => setForm({ ...form, imovel_cidade: e.target.value })} />
            </div>
            <div>
              <Label>Bairro</Label>
              <Input value={form.imovel_bairro ?? ""} onChange={(e) => setForm({ ...form, imovel_bairro: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Operação</Label>
              <Select value={form.operacao} onValueChange={(v) => setForm({ ...form, operacao: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Venda">Venda</SelectItem>
                  <SelectItem value="Aluguel">Aluguel</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Valor estimado (R$)</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={form.valor_estimado ?? ""}
                onChange={(e) => setForm({ ...form, valor_estimado: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label>Origem</Label>
            <Input value={form.origem ?? ""} onChange={(e) => setForm({ ...form, origem: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={create.isPending}>
            {create.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AtividadeDialog({
  rowId,
  open,
  onOpenChange,
}: {
  rowId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { addAtividade } = useCaptacaoPipeline();
  const [tipo, setTipo] = useState("ligacao");
  const [descricao, setDescricao] = useState("");
  const submit = async () => {
    if (!rowId) return;
    await addAtividade.mutateAsync({ pipeline_id: rowId, tipo, descricao });
    setDescricao("");
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar atividade</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ligacao">Ligação</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="email">E-mail</SelectItem>
                <SelectItem value="reuniao">Reunião</SelectItem>
                <SelectItem value="nota">Nota</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={4} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={addAtividade.isPending}>Registrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function KanbanBoard({ filterOrigem }: { filterOrigem?: string } = {}) {
  const { list, move } = useCaptacaoPipeline();
  const [atvId, setAtvId] = useState<string | null>(null);
  const [atvOpen, setAtvOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const [fCategoria, setFCategoria] = useState<string>("todas");
  const [fCidade, setFCidade] = useState<string>("todas");
  const [fUf, setFUf] = useState<string>("todas");
  const [fGrupo, setFGrupo] = useState<string>("todos");

  const baseList = useMemo(
    () => (list.data ?? []).filter((r) => !filterOrigem || (r.origem ?? "").toLowerCase() === filterOrigem.toLowerCase()),
    [list.data, filterOrigem],
  );

  const opcoes = useMemo(() => {
    const cats = new Set<string>();
    const cidades = new Set<string>();
    const ufs = new Set<string>();
    const grupos = new Set<string>();
    for (const r of baseList) {
      const d = (r as any).dados as Record<string, any> | null | undefined;
      const cat = r.imovel_tipo || (d?.categoria as string | undefined);
      if (cat) cats.add(cat);
      const cid = r.imovel_cidade || (d?.origem_grupo_cidade as string | undefined);
      if (cid) cidades.add(cid);
      const uf = d?.origem_grupo_uf as string | undefined;
      if (uf) ufs.add(uf);
      const grp = d?.origem_grupo_nome as string | undefined;
      if (grp) grupos.add(grp);
    }
    const sort = (s: Set<string>) => Array.from(s).sort((a, b) => a.localeCompare(b, "pt-BR"));
    return { cats: sort(cats), cidades: sort(cidades), ufs: sort(ufs), grupos: sort(grupos) };
  }, [baseList]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return baseList.filter((r) => {
      const d = (r as any).dados as Record<string, any> | null | undefined;
      const cat = r.imovel_tipo || (d?.categoria as string | undefined) || "";
      const cid = r.imovel_cidade || (d?.origem_grupo_cidade as string | undefined) || "";
      const uf = (d?.origem_grupo_uf as string | undefined) || "";
      const grp = (d?.origem_grupo_nome as string | undefined) || "";
      if (fCategoria !== "todas" && cat !== fCategoria) return false;
      if (fCidade !== "todas" && cid !== fCidade) return false;
      if (fUf !== "todas" && uf !== fUf) return false;
      if (fGrupo !== "todos" && grp !== fGrupo) return false;
      if (!q) return true;
      const hay = [r.nome, (r as any).contato, r.imovel_bairro, cid, cat, grp, uf].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [baseList, busca, fCategoria, fCidade, fUf, fGrupo]);

  const grouped = useMemo(() => {
    const g: Record<CaptacaoEstagio, CaptacaoPipelineRow[]> = {
      Prospectado: [], Contactado: [], Interessado: [],
      "Avaliacao Enviada": [], Autorizacao: [], "Contrato Assinado": [], Perdido: [],
    };
    filtrados.forEach((r) => g[r.estagio]?.push(r));
    return g;
  }, [filtrados]);

  if (list.isLoading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>;

  const filtrosAtivos = fCategoria !== "todas" || fCidade !== "todas" || fUf !== "todas" || fGrupo !== "todos" || busca.trim().length > 0;

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Buscar por nome, contato, bairro..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="max-w-xs h-9"
        />
        <Select value={fCategoria} onValueChange={setFCategoria}>
          <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas categorias</SelectItem>
            {opcoes.cats.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fCidade} onValueChange={setFCidade}>
          <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Cidade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas cidades</SelectItem>
            {opcoes.cidades.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fUf} onValueChange={setFUf}>
          <SelectTrigger className="w-[100px] h-9"><SelectValue placeholder="UF" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">UF</SelectItem>
            {opcoes.ufs.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fGrupo} onValueChange={setFGrupo}>
          <SelectTrigger className="w-[220px] h-9"><SelectValue placeholder="Grupo RadarZAP" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os grupos</SelectItem>
            {opcoes.grupos.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        {filtrosAtivos && (
          <Button variant="ghost" size="sm" onClick={() => { setBusca(""); setFCategoria("todas"); setFCidade("todas"); setFUf("todas"); setFGrupo("todos"); }}>
            Limpar
          </Button>
        )}
        <div className="ml-auto text-xs text-muted-foreground">
          {filtrados.length} de {baseList.length} card(s)
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {ESTAGIOS_ATIVOS.map((est) => (
          <div key={est} className="bg-muted/40 rounded-lg p-2 min-h-[300px]">
            <div className="flex items-center justify-between mb-2 px-1">
              <div className="text-sm font-semibold">{ESTAGIO_LABEL[est]}</div>
              <Badge variant="outline">{grouped[est].length}</Badge>
            </div>
            <div>
              {grouped[est].map((r) => (
                <PipelineCard
                  key={r.id}
                  row={r}
                  onMove={(to) => move.mutate({ id: r.id, to })}
                  onActivity={() => { setAtvId(r.id); setAtvOpen(true); }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <AtividadeDialog rowId={atvId} open={atvOpen} onOpenChange={setAtvOpen} />
    </>
  );
}

function csvEscape(v: any): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function ExportarProprietariosCsvButton() {
  const { list } = useCaptacaoPipeline();
  const { data: corretores } = useCorretoresCap();
  const { toast } = useToast();

  const handleExport = () => {
    const rows = (list.data ?? []).filter((r) => (r.origem ?? "").toLowerCase() === "radarzap");
    if (!rows.length) {
      toast({ title: "Nada para exportar", description: "Nenhum card de Proprietários Captação encontrado." });
      return;
    }
    const nomePorId = new Map((corretores ?? []).map((c) => [c.corretor_id, c.nome]));
    const header = ["Nome","Telefone","Email","Bairro","Cidade","Tipo","Operacao","Preco","Corretor","Status","Origem","Grupo","Cidade_Grupo","Link_Grupo","Criado_em"];
    const lines = [header.join(",")];
    for (const r of rows) {
      const d = (r.dados ?? {}) as Record<string, any>;
      lines.push([
        r.nome,
        r.telefone_e164 ?? r.telefone ?? "",
        r.email ?? "",
        r.imovel_bairro ?? "",
        r.imovel_cidade ?? "",
        r.imovel_tipo ?? "",
        r.operacao ?? "",
        r.valor_estimado ?? "",
        r.corretor_id ? (nomePorId.get(r.corretor_id) ?? r.corretor_id) : "",
        ESTAGIO_LABEL[r.estagio] ?? r.estagio,
        r.origem ?? "",
        d.origem_grupo_nome ?? "",
        [d.origem_grupo_cidade, d.origem_grupo_uf].filter(Boolean).join("/"),
        d.origem_grupo_link ?? "",
        r.created_at,
      ].map(csvEscape).join(","));
    }
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `proprietarios-captacao-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exportado", description: `${rows.length} card(s) exportado(s).` });
  };

  return (
    <Button size="sm" variant="outline" onClick={handleExport}>
      <Download className="w-4 h-4 mr-1" />Exportar CSV
    </Button>
  );
}

function MetricasPanel() {
  const { data, isLoading } = useCaptacaoPipelineMetricas();
  if (isLoading || !data) return <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>;

  const porEstagio: Record<string, number> = data.por_estagio ?? {};
  const tempoMedio: Record<string, number> = data.tempo_medio_horas ?? {};

  const kpis = [
    { label: "Pipeline value", value: currency(data.pipeline_value), icon: DollarSign },
    { label: "Won value", value: currency(data.won_value), icon: Trophy },
    { label: "Win rate", value: `${data.win_rate ?? 0}%`, icon: TrendingUp },
    { label: "Atividades", value: data.total_atividades ?? 0, icon: Activity },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                <k.icon className="w-4 h-4" /> {k.label}
              </div>
              <div className="text-xl font-semibold mt-1">{k.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Funil por etapa</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {ESTAGIOS_ATIVOS.map((e, i) => {
            const cur = porEstagio[e] ?? 0;
            const prev = i > 0 ? porEstagio[ESTAGIOS_ATIVOS[i - 1]] ?? 0 : cur;
            const conv = i === 0 || prev === 0 ? null : Math.round((cur / prev) * 100);
            const tm = tempoMedio[e];
            return (
              <div key={e} className="flex items-center justify-between text-sm border-b last:border-0 py-2">
                <div className="w-40 font-medium">{ESTAGIO_LABEL[e]}</div>
                <div className="flex-1 text-right pr-4">{cur} leads</div>
                <div className="w-24 text-right text-muted-foreground">
                  {conv !== null ? `${conv}% conv.` : "—"}
                </div>
                <div className="w-28 text-right text-muted-foreground">
                  {tm ? `${Number(tm).toFixed(1)}h médias` : "—"}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function SlaPanel() {
  const { data, isLoading } = useCaptacaoPipelineSla();
  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>;
  const rows = data ?? [];
  if (rows.length === 0) {
    return <div className="text-center text-muted-foreground py-12">Nenhum SLA em atraso 🎉</div>;
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-destructive" /> SLA em atraso ({rows.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {rows.map((r: any) => (
          <div key={r.id} className="flex items-center justify-between text-sm border-b last:border-0 py-2">
            <div>
              <div className="font-medium">{r.nome}</div>
              <div className="text-xs text-muted-foreground">
                {ESTAGIO_LABEL[r.estagio as CaptacaoEstagio]} · {r.tipo_alerta}
              </div>
            </div>
            <div className="text-right">
              <Badge variant="destructive">{Number(r.horas_no_estagio).toFixed(0)}h</Badge>
              <div className="text-[10px] text-muted-foreground mt-1">
                SLA: {r.sla_horas}h {r.escalonado_em ? "· escalonado" : ""}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function CaptacaoPipeline() {
  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Pipeline de Captação</h1>
          <p className="text-sm text-muted-foreground">
            Prospectado → Contactado → Interessado → Avaliação → Autorização → Contrato
          </p>
        </div>
        <NovoLeadDialog />
      </div>

      <Tabs defaultValue="kanban">
        <TabsList>
          <TabsTrigger value="kanban">Kanban</TabsTrigger>
          <TabsTrigger value="radarzap"><Radar className="w-4 h-4 mr-1" />Proprietários Captação</TabsTrigger>
          <TabsTrigger value="metricas">Métricas</TabsTrigger>
          <TabsTrigger value="followup"><CalendarClock className="w-4 h-4 mr-1" />Follow-up SLA</TabsTrigger>
          <TabsTrigger value="sla">SLA / Alertas</TabsTrigger>
        </TabsList>
        <TabsContent value="followup" className="mt-4"><CaptacaoFollowupPanel /></TabsContent>
        <TabsContent value="kanban" className="mt-4"><KanbanBoard /></TabsContent>
        <TabsContent value="radarzap" className="mt-4">
          <div className="mb-3 rounded-md border border-primary/20 bg-primary/5 p-3 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium flex items-center gap-2"><Radar className="w-4 h-4 text-primary" />Fluxo automático RadarZAP → CRM</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Leads gerados no RadarZAP com imóvel e operação (venda / aluguel / temporada) viram cards
                  automaticamente com bairro, cidade, tipo e preço. Quando a imobiliária tem apenas um corretor ativo, ele é definido como responsável.
                </div>
              </div>
              <ExportarProprietariosCsvButton />
            </div>
          </div>
          <KanbanBoard filterOrigem="RadarZAP" />
        </TabsContent>
        <TabsContent value="metricas" className="mt-4"><MetricasPanel /></TabsContent>
        <TabsContent value="sla" className="mt-4"><SlaPanel /></TabsContent>
      </Tabs>
    </div>
  );
}
