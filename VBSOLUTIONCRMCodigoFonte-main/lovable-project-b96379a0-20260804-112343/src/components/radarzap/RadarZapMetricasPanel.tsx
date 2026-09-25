import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Loader2, Download, BarChart3, MapPin, TrendingUp, Filter, Search } from "lucide-react";

type DrillDim = "cidade" | "bairro" | "operacao" | "tipo";
type DrillTarget = { dim: DrillDim; value: string; label: string } | null;

type Grupo = { id: string; cidade: string | null; bairro: string | null; uf: string | null; status: string; total_mensagens: number | null; total_leads: number | null; created_at: string; nome: string | null; };
type Mensagem = { id: string; grupo_id: string | null; intencao: string | null; score_intencao: number | null; tem_imovel: boolean | null; created_at: string; };
type Lead = { id: string; grupo_id: string | null; cidade: string | null; bairro: string | null; tipo_imovel: string | null; operacao: string | null; status: string; score: number | null; is_principal: boolean | null; preco: number | null; contato: string | null; proprietario_nome: string | null; resumo: string | null; lead_id: string | null; created_at: string; };

function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    if (v == null) return "";
    const s = String(v).replace(/"/g, '""');
    return /[",\n;]/.test(s) ? `"${s}"` : s;
  };
  return [headers.join(","), ...rows.map(r => headers.map(h => esc(r[h])).join(","))].join("\n");
}

function download(name: string, csv: string) {
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export default function RadarZapMetricasPanel() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);

  const carregar = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [g, m, l] = await Promise.all([
      supabase.from("radarzap_grupos").select("id,cidade,bairro,uf,status,total_mensagens,total_leads,created_at,nome").limit(2000),
      supabase.from("radarzap_mensagens").select("id,grupo_id,intencao,score_intencao,tem_imovel,created_at").limit(5000),
      supabase.from("radarzap_leads").select("id,grupo_id,cidade,bairro,tipo_imovel,operacao,status,score,is_principal,preco,contato,proprietario_nome,resumo,lead_id,created_at").limit(5000),
    ]);
    if (g.error) toast.error("Erro grupos: " + g.error.message);
    if (m.error) toast.error("Erro mensagens: " + m.error.message);
    if (l.error) toast.error("Erro leads: " + l.error.message);
    setGrupos((g.data ?? []) as Grupo[]);
    setMensagens((m.data ?? []) as Mensagem[]);
    setLeads((l.data ?? []) as Lead[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { carregar(); }, [carregar]);

  const metrics = useMemo(() => {
    const totalGrupos = grupos.length;
    const monitorando = grupos.filter(g => g.status === "monitorando").length;
    const totalMsgs = mensagens.length;
    const msgsComImovel = mensagens.filter(m => m.tem_imovel).length;
    const totalLeads = leads.length;
    const principais = leads.filter(l => l.is_principal !== false).length;
    const aprovados = leads.filter(l => ["aprovado", "convertido", "novo", "contato"].includes(l.status)).length;
    const pendentes = leads.filter(l => l.status === "pendente_aprovacao").length;
    const descartados = leads.filter(l => l.status === "descartado").length;
    const convertidos = leads.filter(l => l.status === "convertido").length;

    const taxaGeracao = totalMsgs > 0 ? (totalLeads / totalMsgs) * 100 : 0;
    const taxaAprovacao = totalLeads > 0 ? (aprovados / totalLeads) * 100 : 0;
    const taxaConversao = aprovados > 0 ? (convertidos / aprovados) * 100 : 0;

    const cidadeMap = new Map<string, number>();
    const bairroMap = new Map<string, number>();
    const operacaoMap = new Map<string, number>();
    const tipoMap = new Map<string, number>();
    leads.forEach(l => {
      if (l.cidade) cidadeMap.set(l.cidade, (cidadeMap.get(l.cidade) ?? 0) + 1);
      if (l.bairro) {
        const key = `${l.bairro}${l.cidade ? ` · ${l.cidade}` : ""}`;
        bairroMap.set(key, (bairroMap.get(key) ?? 0) + 1);
      }
      if (l.operacao) operacaoMap.set(l.operacao, (operacaoMap.get(l.operacao) ?? 0) + 1);
      if (l.tipo_imovel) tipoMap.set(l.tipo_imovel, (tipoMap.get(l.tipo_imovel) ?? 0) + 1);
    });
    const sortDesc = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]);

    const APROVADOS = new Set(["aprovado", "convertido", "novo", "contato"]);
    const gruposById = new Map(grupos.map(g => [g.id, g] as const));
    const gruposComLeads = new Set(leads.map(l => l.grupo_id).filter(Boolean) as string[]).size;

    type Agg = { total: number; aprovados: number; convertidos: number; label: string; sublabel?: string };
    const grupoAgg = new Map<string, Agg>();
    const localAgg = new Map<string, Agg>();
    leads.forEach(l => {
      if (l.grupo_id) {
        const g = gruposById.get(l.grupo_id);
        const label = g?.nome || "(Grupo sem nome)";
        const sublabel = [g?.cidade, g?.uf].filter(Boolean).join("/") || undefined;
        const cur = grupoAgg.get(l.grupo_id) ?? { total: 0, aprovados: 0, convertidos: 0, label, sublabel };
        cur.total++;
        if (APROVADOS.has(l.status)) cur.aprovados++;
        if (l.status === "convertido") cur.convertidos++;
        grupoAgg.set(l.grupo_id, cur);
      }
      const grupoLoc = l.grupo_id ? gruposById.get(l.grupo_id) : null;
      const cidade = l.cidade || grupoLoc?.cidade || "";
      const uf = grupoLoc?.uf || "";
      const key = [cidade, uf].filter(Boolean).join("/") || "(sem local)";
      const cur = localAgg.get(key) ?? { total: 0, aprovados: 0, convertidos: 0, label: key };
      cur.total++;
      if (APROVADOS.has(l.status)) cur.aprovados++;
      if (l.status === "convertido") cur.convertidos++;
      localAgg.set(key, cur);
    });
    const rankingGrupos = [...grupoAgg.values()].sort((a, b) => b.total - a.total).slice(0, 10);
    const rankingLocais = [...localAgg.values()].sort((a, b) => b.total - a.total).slice(0, 10);

    return {
      totalGrupos, monitorando, gruposComLeads, totalMsgs, msgsComImovel,
      totalLeads, principais, aprovados, pendentes, descartados, convertidos,
      taxaGeracao, taxaAprovacao, taxaConversao,
      cidades: sortDesc(cidadeMap).slice(0, 10),
      bairros: sortDesc(bairroMap).slice(0, 10),
      operacoes: sortDesc(operacaoMap),
      tipos: sortDesc(tipoMap),
      rankingGrupos, rankingLocais,
    };
  }, [grupos, mensagens, leads]);

  const [cidadeSel, setCidadeSel] = useState<string>("__all__");
  const [bairroSel, setBairroSel] = useState<string>("__all__");
  const [drill, setDrill] = useState<DrillTarget>(null);

  const norm = (s: string | null | undefined) => (s ?? "").trim();
  const eqCI = (a: string | null | undefined, b: string) =>
    norm(a).toLocaleLowerCase("pt-BR") === b.toLocaleLowerCase("pt-BR");

  const cidadesDisponiveis = useMemo(() => {
    const set = new Set<string>();
    grupos.forEach(g => { if (norm(g.cidade)) set.add(norm(g.cidade)); });
    leads.forEach(l => { if (norm(l.cidade)) set.add(norm(l.cidade)); });
    return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [grupos, leads]);

  const bairrosDisponiveis = useMemo(() => {
    const set = new Set<string>();
    const filtroCidade = cidadeSel !== "__all__" ? cidadeSel : null;
    grupos.forEach(g => {
      if (filtroCidade && !eqCI(g.cidade, filtroCidade)) return;
      if (norm(g.bairro)) set.add(norm(g.bairro));
    });
    leads.forEach(l => {
      if (filtroCidade && !eqCI(l.cidade, filtroCidade)) return;
      if (norm(l.bairro)) set.add(norm(l.bairro));
    });
    return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [grupos, leads, cidadeSel]);

  useEffect(() => {
    if (bairroSel !== "__all__" && !bairrosDisponiveis.includes(bairroSel)) {
      setBairroSel("__all__");
    }
  }, [bairrosDisponiveis, bairroSel]);

  const filtrarPorLocal = <T extends { cidade?: string | null; bairro?: string | null }>(rows: T[]) => {
    return rows.filter(r => {
      if (cidadeSel !== "__all__" && !eqCI(r.cidade, cidadeSel)) return false;
      if (bairroSel !== "__all__" && !eqCI(r.bairro, bairroSel)) return false;
      return true;
    });
  };

  const dataSets = useMemo(() => {
    const gruposFiltrados = filtrarPorLocal(grupos);
    const leadsFiltrados = filtrarPorLocal(leads);
    const idsGrupos = new Set(gruposFiltrados.map(g => g.id));
    const mensagensFiltradas = (cidadeSel === "__all__" && bairroSel === "__all__")
      ? mensagens
      : mensagens.filter(m => m.grupo_id && idsGrupos.has(m.grupo_id));
    return { gruposFiltrados, leadsFiltrados, mensagensFiltradas };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grupos, leads, mensagens, cidadeSel, bairroSel]);

  const exportar = (tipo: "grupos" | "mensagens" | "leads") => {
    const rows =
      tipo === "grupos" ? dataSets.gruposFiltrados :
      tipo === "mensagens" ? dataSets.mensagensFiltradas :
      dataSets.leadsFiltrados;
    if (!rows.length) return toast.info("Sem dados para exportar neste recorte.");
    const stamp = new Date().toISOString().slice(0, 10);
    const slug = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/(^-|-$)/g, "").toLowerCase();
    const loc = [
      cidadeSel !== "__all__" ? slug(cidadeSel) : null,
      bairroSel !== "__all__" ? slug(bairroSel) : null,
    ].filter(Boolean).join("_");
    const suffix = loc ? `_${loc}` : "";
    download(`radarzap_${tipo}${suffix}_${stamp}.csv`, toCSV(rows as unknown as Record<string, unknown>[]));
  };

  if (loading) return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando métricas…</div>;

  const KPI = ({ label, value, hint }: { label: string; value: string | number; hint?: string }) => (
    <Card><CardContent className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>}
    </CardContent></Card>
  );

  const Bar = ({ label, value, max, onClick }: { label: string; value: number; max: number; onClick?: () => void }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`w-full text-left space-y-1 rounded p-1 -mx-1 transition-colors ${onClick ? "hover:bg-muted/60 cursor-pointer" : "cursor-default"}`}
      aria-label={onClick ? `Drill-down em ${label}` : undefined}
    >
      <div className="flex justify-between text-xs">
        <span className="truncate pr-2 flex items-center gap-1">
          {onClick && <Search className="h-3 w-3 opacity-50" />}
          {label}
        </span>
        <span className="font-medium">{value}</span>
      </div>
      <div className="h-2 bg-muted rounded overflow-hidden">
        <div className="h-full bg-primary" style={{ width: `${max > 0 ? (value / max) * 100 : 0}%` }} />
      </div>
    </button>
  );

  const maxCidade = metrics.cidades[0]?.[1] ?? 0;
  const maxBairro = metrics.bairros[0]?.[1] ?? 0;

  const filtroAtivo = cidadeSel !== "__all__" || bairroSel !== "__all__";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Exportação segmentada por local
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Cidade</Label>
              <Select value={cidadeSel} onValueChange={setCidadeSel}>
                <SelectTrigger><SelectValue placeholder="Todas as cidades" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas as cidades</SelectItem>
                  {cidadesDisponiveis.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Bairro</Label>
              <Select value={bairroSel} onValueChange={setBairroSel} disabled={bairrosDisponiveis.length === 0}>
                <SelectTrigger><SelectValue placeholder="Todos os bairros" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos os bairros</SelectItem>
                  {bairrosDisponiveis.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>Recorte atual:</span>
            <Badge variant="secondary">Grupos: {dataSets.gruposFiltrados.length}</Badge>
            <Badge variant="secondary">Mensagens: {dataSets.mensagensFiltradas.length}</Badge>
            <Badge variant="secondary">Leads: {dataSets.leadsFiltrados.length}</Badge>
            {filtroAtivo && (
              <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => { setCidadeSel("__all__"); setBairroSel("__all__"); }}>
                Limpar filtros
              </Button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => exportar("grupos")}><Download className="h-4 w-4 mr-1" />Grupos CSV</Button>
            <Button variant="outline" size="sm" onClick={() => exportar("mensagens")}><Download className="h-4 w-4 mr-1" />Mensagens CSV</Button>
            <Button variant="outline" size="sm" onClick={() => exportar("leads")}><Download className="h-4 w-4 mr-1" />Leads CSV</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Grupos" value={metrics.totalGrupos} hint={`${metrics.monitorando} monitorando`} />
        <KPI label="Grupos gerando leads" value={metrics.gruposComLeads} hint={metrics.totalGrupos > 0 ? `${((metrics.gruposComLeads / metrics.totalGrupos) * 100).toFixed(1)}% do total` : undefined} />
        <KPI label="Mensagens analisadas" value={metrics.totalMsgs} hint={`${metrics.msgsComImovel} com imóvel`} />
        <KPI label="Leads gerados" value={metrics.totalLeads} hint={`${metrics.principais} principais`} />
        <KPI label="Taxa de geração" value={`${metrics.taxaGeracao.toFixed(1)}%`} hint="leads / mensagens" />
        <KPI label="Pendentes aprovação" value={metrics.pendentes} />
        <KPI label="Aprovados" value={metrics.aprovados} hint={`${metrics.taxaAprovacao.toFixed(1)}% aprovação`} />
        <KPI label="Convertidos pipeline" value={metrics.convertidos} hint={`${metrics.taxaConversao.toFixed(1)}% dos aprovados`} />
        <KPI label="Descartados" value={metrics.descartados} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><MapPin className="h-4 w-4" />Top cidades <span className="text-[10px] font-normal text-muted-foreground">(clique para ver detalhes)</span></CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {metrics.cidades.length === 0
              ? <p className="text-sm text-muted-foreground">Sem dados de cidade.</p>
              : metrics.cidades.map(([c, v]) => (
                  <Bar key={c} label={c} value={v} max={maxCidade}
                    onClick={() => setDrill({ dim: "cidade", value: c, label: c })} />
                ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><MapPin className="h-4 w-4" />Top bairros <span className="text-[10px] font-normal text-muted-foreground">(clique para ver detalhes)</span></CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {metrics.bairros.length === 0
              ? <p className="text-sm text-muted-foreground">Sem dados de bairro.</p>
              : metrics.bairros.map(([b, v]) => {
                  const bairroOnly = b.split(" · ")[0];
                  return (
                    <Bar key={b} label={b} value={v} max={maxBairro}
                      onClick={() => setDrill({ dim: "bairro", value: bairroOnly, label: b })} />
                  );
                })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4" />Operação</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {metrics.operacoes.length === 0
              ? <p className="text-sm text-muted-foreground">Sem dados.</p>
              : metrics.operacoes.map(([k, v]) => (
                  <button key={k} type="button" onClick={() => setDrill({ dim: "operacao", value: k, label: k })}>
                    <Badge variant="secondary" className="cursor-pointer hover:bg-secondary/70">{k}: {v}</Badge>
                  </button>
                ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4" />Tipo de imóvel</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {metrics.tipos.length === 0
              ? <p className="text-sm text-muted-foreground">Sem dados.</p>
              : metrics.tipos.map(([k, v]) => (
                  <button key={k} type="button" onClick={() => setDrill({ dim: "tipo", value: k, label: k })}>
                    <Badge variant="outline" className="cursor-pointer hover:bg-muted">{k}: {v}</Badge>
                  </button>
                ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4" />Ranking por grupo <span className="text-[10px] font-normal text-muted-foreground">(leads · aprovação · conversão)</span></CardTitle></CardHeader>
          <CardContent>
            {metrics.rankingGrupos.length === 0
              ? <p className="text-sm text-muted-foreground">Sem leads vinculados a grupos.</p>
              : <RankingTable rows={metrics.rankingGrupos} />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><MapPin className="h-4 w-4" />Ranking por cidade/UF</CardTitle></CardHeader>
          <CardContent>
            {metrics.rankingLocais.length === 0
              ? <p className="text-sm text-muted-foreground">Sem dados de localização.</p>
              : <RankingTable rows={metrics.rankingLocais} />}
          </CardContent>
        </Card>
      </div>


      <DrillDownDialog
        target={drill}
        onClose={() => setDrill(null)}
        grupos={grupos}
        mensagens={mensagens}
        leads={leads}
      />
    </div>
  );
}

function RankingTable({ rows }: { rows: { label: string; sublabel?: string; total: number; aprovados: number; convertidos: number }[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground border-b">
            <th className="py-1.5 pr-2 font-medium">Item</th>
            <th className="py-1.5 px-2 font-medium text-right">Leads</th>
            <th className="py-1.5 px-2 font-medium text-right">Aprov.</th>
            <th className="py-1.5 pl-2 font-medium text-right">Conv.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const aprov = r.total > 0 ? (r.aprovados / r.total) * 100 : 0;
            const conv = r.aprovados > 0 ? (r.convertidos / r.aprovados) * 100 : 0;
            return (
              <tr key={i} className="border-b last:border-0">
                <td className="py-1.5 pr-2">
                  <div className="font-medium truncate max-w-[220px]">{r.label}</div>
                  {r.sublabel && <div className="text-[11px] text-muted-foreground">{r.sublabel}</div>}
                </td>
                <td className="py-1.5 px-2 text-right tabular-nums">{r.total}</td>
                <td className="py-1.5 px-2 text-right tabular-nums">{aprov.toFixed(0)}%<div className="text-[10px] text-muted-foreground">{r.aprovados}</div></td>
                <td className="py-1.5 pl-2 text-right tabular-nums">{conv.toFixed(0)}%<div className="text-[10px] text-muted-foreground">{r.convertidos}</div></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DrillDownDialog({
  target, onClose, grupos, mensagens, leads,
}: {
  target: DrillTarget;
  onClose: () => void;
  grupos: Grupo[];
  mensagens: Mensagem[];
  leads: Lead[];
}) {
  const open = target !== null;
  const norm = (s: string | null | undefined) => (s ?? "").trim().toLocaleLowerCase("pt-BR");

  const { gruposF, mensagensF, leadsF, titulo } = useMemo(() => {
    if (!target) return { gruposF: [], mensagensF: [], leadsF: [], titulo: "" };
    const val = target.value.toLocaleLowerCase("pt-BR");

    let gruposF: Grupo[] = [];
    let leadsF: Lead[] = [];

    if (target.dim === "cidade") {
      gruposF = grupos.filter(g => norm(g.cidade) === val);
      leadsF = leads.filter(l => norm(l.cidade) === val);
    } else if (target.dim === "bairro") {
      gruposF = grupos.filter(g => norm(g.bairro) === val);
      leadsF = leads.filter(l => norm(l.bairro) === val);
    } else if (target.dim === "operacao") {
      leadsF = leads.filter(l => norm(l.operacao) === val);
      const gruposIds = new Set(leadsF.map(l => l.id));
      // operação não filtra grupos diretamente — mantemos todos os grupos associados às mensagens dos leads
      gruposF = grupos.filter(g => gruposIds.size > 0);
    } else if (target.dim === "tipo") {
      leadsF = leads.filter(l => norm(l.tipo_imovel) === val);
      gruposF = [];
    }

    let mensagensF: Mensagem[];
    if (target.dim === "cidade" || target.dim === "bairro") {
      const gIds = new Set(gruposF.map(g => g.id));
      mensagensF = mensagens.filter(m => m.grupo_id && gIds.has(m.grupo_id));
    } else {
      mensagensF = [];
    }

    const titulo =
      target.dim === "cidade" ? `Cidade: ${target.label}` :
      target.dim === "bairro" ? `Bairro: ${target.label}` :
      target.dim === "operacao" ? `Operação: ${target.label}` :
      `Tipo: ${target.label}`;

    return { gruposF, mensagensF, leadsF, titulo };
  }, [target, grupos, mensagens, leads]);

  const fmtDate = (d: string) => new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  const fmtBRL = (v: number | null) => v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Search className="h-4 w-4" />Drill-down · {titulo}</DialogTitle>
          <DialogDescription>
            {gruposF.length} grupo(s) · {mensagensF.length} mensagem(ns) · {leadsF.length} lead(s)
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="leads" className="w-full">
          <TabsList>
            <TabsTrigger value="leads">Leads ({leadsF.length})</TabsTrigger>
            <TabsTrigger value="mensagens" disabled={mensagensF.length === 0 && (target?.dim === "operacao" || target?.dim === "tipo")}>
              Mensagens ({mensagensF.length})
            </TabsTrigger>
            <TabsTrigger value="grupos" disabled={gruposF.length === 0}>
              Grupos ({gruposF.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="leads">
            <ScrollArea className="h-[420px] pr-3">
              {leadsF.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4">Nenhum lead neste recorte.</p>
              ) : (
                <div className="space-y-2">
                  {leadsF
                    .slice()
                    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
                    .map(l => (
                      <div key={l.id} className="rounded border p-3 text-sm">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="font-medium">{l.proprietario_nome || l.contato || "Sem identificação"}</span>
                          {l.is_principal && <Badge variant="default" className="text-[10px]">Principal</Badge>}
                          <Badge variant="outline" className="text-[10px]">{l.status}</Badge>
                          {l.score != null && <Badge variant="secondary" className="text-[10px]">Score {l.score}</Badge>}
                          {l.operacao && <Badge variant="outline" className="text-[10px]">{l.operacao}</Badge>}
                          {l.tipo_imovel && <Badge variant="outline" className="text-[10px]">{l.tipo_imovel}</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                          <span>{[l.bairro, l.cidade].filter(Boolean).join(" · ") || "sem local"}</span>
                          <span>{fmtBRL(l.preco)}</span>
                          <span>{fmtDate(l.created_at)}</span>
                          {l.contato && <span>{l.contato}</span>}
                        </div>
                        {l.resumo && <p className="text-xs mt-1 line-clamp-2">{l.resumo}</p>}
                      </div>
                    ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="mensagens">
            <ScrollArea className="h-[420px] pr-3">
              {mensagensF.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4">Nenhuma mensagem neste recorte.</p>
              ) : (
                <div className="space-y-2">
                  {mensagensF
                    .slice()
                    .sort((a, b) => (b.score_intencao ?? 0) - (a.score_intencao ?? 0))
                    .map(m => {
                      const g = grupos.find(gr => gr.id === m.grupo_id);
                      return (
                        <div key={m.id} className="rounded border p-3 text-sm">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            {m.intencao && <Badge variant="secondary" className="text-[10px]">{m.intencao}</Badge>}
                            {m.score_intencao != null && <Badge variant="outline" className="text-[10px]">Intenção {m.score_intencao}</Badge>}
                            {m.tem_imovel && <Badge variant="default" className="text-[10px]">Com imóvel</Badge>}
                          </div>
                          <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3">
                            <span>{g?.nome || "Grupo desconhecido"}</span>
                            <span>{[g?.bairro, g?.cidade].filter(Boolean).join(" · ")}</span>
                            <span>{fmtDate(m.created_at)}</span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="grupos">
            <ScrollArea className="h-[420px] pr-3">
              {gruposF.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4">Nenhum grupo neste recorte.</p>
              ) : (
                <div className="space-y-2">
                  {gruposF.map(g => (
                    <div key={g.id} className="rounded border p-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-medium">{g.nome || "Sem nome"}</span>
                        <Badge variant="outline" className="text-[10px]">{g.status}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3">
                        <span>{[g.bairro, g.cidade].filter(Boolean).join(" · ") || "sem local"}</span>
                        <span>{g.total_mensagens ?? 0} msgs</span>
                        <span>{g.total_leads ?? 0} leads</span>
                        <span>Desde {fmtDate(g.created_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
