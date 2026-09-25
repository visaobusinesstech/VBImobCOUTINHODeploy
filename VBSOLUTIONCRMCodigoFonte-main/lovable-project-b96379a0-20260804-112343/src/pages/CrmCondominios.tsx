import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Building2, Phone, Mail, Users, TrendingUp, CalendarClock, ExternalLink, Search, AlertTriangle, CheckCircle2 } from "lucide-react";
import { formatDistanceToNow, isPast, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

type Iniciativa = {
  id: string; condominio_nome: string; bairro: string | null; canal: string;
  titulo: string; status: string; data_agendada: string | null; data_conclusao: string | null;
  responsavel: string | null; resultado: string | null;
};
type Contato = {
  id: string; condominio_nome: string; tipo: string; nome: string | null;
  telefone: string | null; email: string | null; url_fonte: string | null;
  status: string | null; confianca: number | null;
};
type Lead = {
  id: string; nome: string; telefone: string | null; email: string | null;
  interesse: string | null; bairro_interesse: string | null; estagio: string;
  valor: number; canal_origem: string | null; created_at: string;
};

const STATUS_BADGE: Record<string, string> = {
  planejado: "bg-slate-100 text-slate-700",
  em_andamento: "bg-blue-100 text-blue-700",
  aguardando_retorno: "bg-amber-100 text-amber-700",
  concluido: "bg-emerald-100 text-emerald-700",
  sem_sucesso: "bg-rose-100 text-rose-700",
  cancelado: "bg-slate-100 text-slate-500",
};

export default function CrmCondominios() {
  const { imobiliariaId } = useAuth();
  const [iniciativas, setIniciativas] = useState<Iniciativa[]>([]);
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!imobiliariaId) return;
    (async () => {
      setLoading(true);
      const [i, c, l] = await Promise.all([
        supabase.from("condominio_iniciativas").select("id,condominio_nome,bairro,canal,titulo,status,data_agendada,data_conclusao,responsavel,resultado").eq("imobiliaria_id", imobiliariaId).order("created_at", { ascending: false }),
        supabase.from("condominio_contatos" as any).select("id,condominio_nome,tipo,nome,telefone,email,url_fonte,status,confianca").eq("imobiliaria_id", imobiliariaId),
        supabase.from("leads").select("id,nome,telefone,email,interesse,bairro_interesse,estagio,valor,canal_origem,created_at").eq("imobiliaria_id", imobiliariaId).order("created_at", { ascending: false }).limit(2000),
      ]);
      setIniciativas((i.data || []) as any);
      setContatos((c.data || []) as any);
      setLeads((l.data || []) as any);
      setLoading(false);
    })();
  }, [imobiliariaId]);

  // Agrupar por condomínio_nome (a partir de iniciativas + contatos)
  const condominios = useMemo(() => {
    const map = new Map<string, {
      nome: string; bairro: string | null;
      iniciativas: Iniciativa[]; contatos: Contato[]; leads: Lead[];
    }>();
    const push = (nome: string, bairro: string | null) => {
      const key = nome.trim();
      if (!map.has(key)) map.set(key, { nome: key, bairro, iniciativas: [], contatos: [], leads: [] });
      return map.get(key)!;
    };
    iniciativas.forEach((it) => { push(it.condominio_nome, it.bairro).iniciativas.push(it); });
    contatos.forEach((c) => { push(c.condominio_nome, null).contatos.push(c); });

    // Match leads por interesse/bairro contendo nome do condomínio
    for (const entry of map.values()) {
      const needle = entry.nome.toLowerCase();
      entry.leads = leads.filter((ld) => {
        const hay = `${ld.interesse ?? ""} ${ld.bairro_interesse ?? ""}`.toLowerCase();
        return hay.includes(needle);
      });
    }

    let arr = Array.from(map.values());
    if (search.trim()) {
      const q = search.toLowerCase();
      arr = arr.filter((c) => c.nome.toLowerCase().includes(q) || (c.bairro ?? "").toLowerCase().includes(q));
    }
    // Ordena por leads desc, depois iniciativas
    return arr.sort((a, b) => (b.leads.length - a.leads.length) || (b.iniciativas.length - a.iniciativas.length));
  }, [iniciativas, contatos, leads, search]);

  const kpis = useMemo(() => {
    const totalCondos = condominios.length;
    const totalLeads = condominios.reduce((s, c) => s + c.leads.length, 0);
    const proximos = iniciativas.filter((i) => i.data_agendada && !i.data_conclusao).length;
    const atrasados = iniciativas.filter((i) => i.data_agendada && !i.data_conclusao && isPast(parseISO(i.data_agendada))).length;
    const fechados = leads.filter((l) => l.estagio === "fechados").length;
    return { totalCondos, totalLeads, proximos, atrasados, fechados };
  }, [condominios, iniciativas, leads]);

  const active = selected ? condominios.find((c) => c.nome === selected) ?? condominios[0] : condominios[0];

  useEffect(() => {
    if (!selected && condominios[0]) setSelected(condominios[0].nome);
  }, [condominios, selected]);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" /> CRM · Condomínios
          </h1>
          <p className="text-sm text-muted-foreground">Leads, origens, performance e próximos passos por empreendimento, administradora e síndico.</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi label="Condomínios" value={kpis.totalCondos} icon={<Building2 className="w-4 h-4" />} />
        <Kpi label="Leads vinculados" value={kpis.totalLeads} icon={<Users className="w-4 h-4" />} />
        <Kpi label="Fechados" value={kpis.fechados} icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />} />
        <Kpi label="Próximos passos" value={kpis.proximos} icon={<CalendarClock className="w-4 h-4" />} />
        <Kpi label="Atrasados" value={kpis.atrasados} icon={<AlertTriangle className="w-4 h-4 text-rose-600" />} tone={kpis.atrasados > 0 ? "danger" : undefined} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4">
        {/* Lista de condomínios */}
        <Card>
          <CardHeader className="pb-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-8" placeholder="Buscar condomínio ou bairro" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[62vh]">
              {loading && <p className="p-4 text-sm text-muted-foreground">Carregando…</p>}
              {!loading && condominios.length === 0 && (
                <p className="p-4 text-sm text-muted-foreground">Nenhum condomínio com iniciativa ou contato ainda. Use Q-Capture → Orquestração / Enriquecimento.</p>
              )}
              <ul className="divide-y">
                {condominios.map((c) => {
                  const isSel = active?.nome === c.nome;
                  const atrasadosCondo = c.iniciativas.filter((i) => i.data_agendada && !i.data_conclusao && isPast(parseISO(i.data_agendada))).length;
                  return (
                    <li key={c.nome}>
                      <button onClick={() => setSelected(c.nome)} className={`w-full text-left px-3 py-2 hover:bg-muted/50 ${isSel ? "bg-muted" : ""}`}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-medium truncate">{c.nome}</div>
                            <div className="text-xs text-muted-foreground truncate">{c.bairro || "—"}</div>
                          </div>
                          <div className="flex flex-col items-end text-xs gap-1">
                            <Badge variant="secondary">{c.leads.length} leads</Badge>
                            {atrasadosCondo > 0 && <Badge className="bg-rose-100 text-rose-700">{atrasadosCondo} atrasado</Badge>}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Detalhe */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" /> {active?.nome ?? "Selecione um condomínio"}
            </CardTitle>
            {active?.bairro && <p className="text-xs text-muted-foreground">{active.bairro}</p>}
          </CardHeader>
          <CardContent>
            {active ? (
              <Tabs defaultValue="leads" className="w-full">
                <TabsList>
                  <TabsTrigger value="leads">Leads ({active.leads.length})</TabsTrigger>
                  <TabsTrigger value="contatos">Contatos ({active.contatos.length})</TabsTrigger>
                  <TabsTrigger value="proximos">Próximos passos</TabsTrigger>
                  <TabsTrigger value="performance">Performance</TabsTrigger>
                </TabsList>

                <TabsContent value="leads" className="space-y-2">
                  {active.leads.length === 0 && <p className="text-sm text-muted-foreground">Nenhum lead vinculado por interesse/bairro.</p>}
                  {active.leads.map((l) => (
                    <div key={l.id} className="border rounded-lg p-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{l.nome}</div>
                        <div className="text-xs text-muted-foreground truncate">{l.interesse || "—"}</div>
                        <div className="text-xs text-muted-foreground">Origem: {l.canal_origem || "—"} · {formatDistanceToNow(parseISO(l.created_at), { locale: ptBR, addSuffix: true })}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline">{l.estagio}</Badge>
                        {l.telefone && <a href={`https://wa.me/${l.telefone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"><Button size="sm" variant="ghost"><Phone className="w-3 h-3" /></Button></a>}
                        {l.email && <a href={`mailto:${l.email}`}><Button size="sm" variant="ghost"><Mail className="w-3 h-3" /></Button></a>}
                      </div>
                    </div>
                  ))}
                </TabsContent>

                <TabsContent value="contatos" className="space-y-2">
                  {active.contatos.length === 0 && <p className="text-sm text-muted-foreground">Sem contatos de administradora/síndico. Use Q-Capture → Enriquecimento.</p>}
                  {active.contatos.map((c) => (
                    <div key={c.id} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="font-medium">{c.nome || "(sem nome)"} <Badge variant="outline" className="ml-1 capitalize">{c.tipo}</Badge></div>
                          <div className="text-xs text-muted-foreground">Status: {c.status || "pendente"} · Confiança: {c.confianca ?? 0}%</div>
                        </div>
                        <div className="flex items-center gap-1">
                          {c.telefone && <a href={`tel:${c.telefone}`}><Button size="sm" variant="ghost"><Phone className="w-3 h-3" /></Button></a>}
                          {c.email && <a href={`mailto:${c.email}`}><Button size="sm" variant="ghost"><Mail className="w-3 h-3" /></Button></a>}
                          {c.url_fonte && <a href={c.url_fonte} target="_blank" rel="noreferrer"><Button size="sm" variant="ghost"><ExternalLink className="w-3 h-3" /></Button></a>}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {c.telefone && <span className="mr-2">{c.telefone}</span>}
                        {c.email && <span>{c.email}</span>}
                      </div>
                    </div>
                  ))}
                </TabsContent>

                <TabsContent value="proximos" className="space-y-2">
                  {active.iniciativas.filter((i) => !i.data_conclusao).length === 0 && (
                    <p className="text-sm text-muted-foreground">Sem iniciativas abertas para este condomínio.</p>
                  )}
                  {active.iniciativas
                    .filter((i) => !i.data_conclusao)
                    .sort((a, b) => (a.data_agendada ?? "").localeCompare(b.data_agendada ?? ""))
                    .map((i) => {
                      const atrasado = i.data_agendada && isPast(parseISO(i.data_agendada));
                      return (
                        <div key={i.id} className={`border rounded-lg p-3 ${atrasado ? "border-rose-300 bg-rose-50/40" : ""}`}>
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <div className="font-medium">{i.titulo}</div>
                              <div className="text-xs text-muted-foreground capitalize">Canal: {i.canal.replace(/_/g, " ")} · Resp.: {i.responsavel || "—"}</div>
                            </div>
                            <Badge className={STATUS_BADGE[i.status] || ""}>{i.status.replace(/_/g, " ")}</Badge>
                          </div>
                          {i.data_agendada && (
                            <div className={`text-xs mt-1 ${atrasado ? "text-rose-700 font-medium" : "text-muted-foreground"}`}>
                              <CalendarClock className="w-3 h-3 inline mr-1" />
                              {atrasado ? "Atrasado " : "Agendado "}
                              {formatDistanceToNow(parseISO(i.data_agendada), { locale: ptBR, addSuffix: true })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </TabsContent>

                <TabsContent value="performance" className="space-y-3">
                  <PerformanceView leads={active.leads} iniciativas={active.iniciativas} contatos={active.contatos} />
                </TabsContent>
              </Tabs>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum condomínio selecionado.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ label, value, icon, tone }: { label: string; value: number; icon: React.ReactNode; tone?: "danger" }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
        <div className={`text-2xl font-semibold ${tone === "danger" ? "text-rose-600" : ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function PerformanceView({ leads, iniciativas, contatos }: { leads: Lead[]; iniciativas: Iniciativa[]; contatos: Contato[] }) {
  const porOrigem = new Map<string, number>();
  leads.forEach((l) => porOrigem.set(l.canal_origem || "—", (porOrigem.get(l.canal_origem || "—") || 0) + 1));
  const porEstagio = new Map<string, number>();
  leads.forEach((l) => porEstagio.set(l.estagio, (porEstagio.get(l.estagio) || 0) + 1));
  const porCanal = new Map<string, number>();
  iniciativas.forEach((i) => porCanal.set(i.canal, (porCanal.get(i.canal) || 0) + 1));
  const fechados = leads.filter((l) => l.estagio === "fechados").length;
  const conv = leads.length ? Math.round((fechados / leads.length) * 100) : 0;
  const receita = leads.filter((l) => l.estagio === "fechados").reduce((s, l) => s + Number(l.valor || 0), 0);

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Conversão" value={conv} icon={<TrendingUp className="w-4 h-4" />} />
        <Kpi label="Fechados" value={fechados} icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />} />
        <Kpi label="Iniciativas" value={iniciativas.length} icon={<CalendarClock className="w-4 h-4" />} />
        <Kpi label="Contatos" value={contatos.length} icon={<Users className="w-4 h-4" />} />
      </div>
      <div className="text-xs text-muted-foreground">Receita estimada de fechados: <b className="text-foreground">R$ {receita.toLocaleString("pt-BR")}</b></div>

      <div className="grid md:grid-cols-3 gap-3">
        <Breakdown title="Leads por origem" data={porOrigem} />
        <Breakdown title="Leads por estágio" data={porEstagio} />
        <Breakdown title="Iniciativas por canal" data={porCanal} />
      </div>
    </>
  );
}

function Breakdown({ title, data }: { title: string; data: Map<string, number> }) {
  const entries = Array.from(data.entries()).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, v]) => s + v, 0) || 1;
  return (
    <Card>
      <CardHeader className="pb-1"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-1">
        {entries.length === 0 && <p className="text-xs text-muted-foreground">Sem dados.</p>}
        {entries.map(([k, v]) => (
          <div key={k}>
            <div className="flex items-center justify-between text-xs">
              <span className="capitalize truncate">{k.replace(/_/g, " ")}</span>
              <span className="text-muted-foreground">{v}</span>
            </div>
            <div className="h-1.5 bg-muted rounded"><div className="h-1.5 bg-primary rounded" style={{ width: `${(v / total) * 100}%` }} /></div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
