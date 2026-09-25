import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FeedItemDetailSheet, type FeedKind as SheetKind } from "@/components/feed/FeedItemDetailSheet";
import { supabase as supabaseClient } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import {
  PenTool, UserPlus, Magnet, CalendarDays, RefreshCw, Loader2, Search, ExternalLink, CalendarIcon, X,
} from "lucide-react";
import { format, subDays, isAfter, isBefore, endOfDay, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

const supabase: any = supabaseClient;

type FeedKind = "post" | "lead" | "captacao" | "compromisso";

interface FeedItem {
  id: string;
  kind: FeedKind;
  title: string;
  subtitle?: string;
  status?: string | null;
  at: string;
  href: string;
}

const KIND_META: Record<FeedKind, { label: string; icon: any; color: string }> = {
  post:        { label: "Post SEO",   icon: PenTool,     color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  lead:        { label: "Lead",       icon: UserPlus,    color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  captacao:    { label: "Captação",   icon: Magnet,      color: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  compromisso: { label: "Compromisso",icon: CalendarDays,color: "bg-violet-500/10 text-violet-600 border-violet-500/20" },
};

const DATE_RANGES = [
  { value: "1",  label: "Últimas 24h" },
  { value: "7",  label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
  { value: "0",  label: "Todo o histórico" },
  { value: "custom", label: "Personalizado" },
];

const PAGE_SIZE = 20;
const BATCH_SIZE = 60; // por fonte por carregamento

async function fetchBatch(kind: FeedKind, before?: string | null): Promise<FeedItem[]> {
  const applyBefore = (q: any) => (before ? q.lt("created_at", before) : q);

  if (kind === "post") {
    const { data } = await applyBefore(
      supabase.from("conteudos_seo").select("id,titulo,tipo,status,slug,created_at,publicado_em")
    ).order("created_at", { ascending: false }).limit(BATCH_SIZE);
    return ((data as any[]) || []).map((p) => ({
      id: `post:${p.id}`, kind: "post", title: p.titulo,
      subtitle: p.tipo, status: p.status,
      at: p.publicado_em || p.created_at,
      href: p.status === "publicado" && p.slug ? `/blog/${p.slug}` : "/conteudo-seo",
    }));
  }
  if (kind === "lead") {
    const { data } = await applyBefore(
      supabase.from("leads").select("id,nome,estagio,created_at")
    ).order("created_at", { ascending: false }).limit(BATCH_SIZE);
    return ((data as any[]) || []).map((l) => ({
      id: `lead:${l.id}`, kind: "lead", title: l.nome || "Lead sem nome",
      subtitle: "Novo lead capturado", status: l.estagio, at: l.created_at, href: "/pipeline",
    }));
  }
  if (kind === "captacao") {
    const { data } = await applyBefore(
      supabase.from("captacoes").select("id,endereco_imovel,cidade,bairro,tipo_imovel,status,created_at")
    ).order("created_at", { ascending: false }).limit(BATCH_SIZE);
    return ((data as any[]) || []).map((c) => ({
      id: `captacao:${c.id}`, kind: "captacao",
      title: c.endereco_imovel || `${c.tipo_imovel || "Imóvel"} — ${c.bairro || c.cidade || ""}`,
      subtitle: [c.tipo_imovel, c.cidade, c.bairro].filter(Boolean).join(" · "),
      status: c.status, at: c.created_at, href: "/captacao",
    }));
  }
  // compromisso
  const { data } = await applyBefore(
    supabase.from("compromissos").select("id,titulo,descricao,status,created_at")
  ).order("created_at", { ascending: false }).limit(BATCH_SIZE);
  return ((data as any[]) || []).map((c) => ({
    id: `compromisso:${c.id}`, kind: "compromisso", title: c.titulo || "Compromisso",
    subtitle: c.descricao || undefined, status: c.status, at: c.created_at, href: "/agenda",
  }));
}

export default function Feed() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState<Record<FeedKind, boolean>>({
    post: true, lead: true, captacao: true, compromisso: true,
  });
  const [kind, setKind] = useState<"todos" | FeedKind>("todos");
  const [status, setStatus] = useState<string>("todos");
  const [range, setRange] = useState<string>("7");
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const [q, setQ] = useState("");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState<{ kind: SheetKind; rawId: string } | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const fetchInitial = useCallback(async () => {
    setLoading(true);
    const results = await Promise.all(
      (["post", "lead", "captacao", "compromisso"] as FeedKind[]).map((k) => fetchBatch(k))
    );
    const merged = results.flat().sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    const nextHas: Record<FeedKind, boolean> = { post: false, lead: false, captacao: false, compromisso: false };
    (["post", "lead", "captacao", "compromisso"] as FeedKind[]).forEach((k, i) => {
      nextHas[k] = results[i].length >= BATCH_SIZE;
    });
    setHasMore(nextHas);
    setItems(merged);
    setVisible(PAGE_SIZE);
    setLoading(false);
  }, []);

  useEffect(() => { fetchInitial(); }, [fetchInitial]);

  const fetchMoreFromServer = useCallback(async () => {
    const kinds = (["post", "lead", "captacao", "compromisso"] as FeedKind[]).filter((k) => hasMore[k]);
    if (kinds.length === 0) return;
    setLoadingMore(true);
    const oldestByKind: Record<string, string | undefined> = {};
    for (const it of items) {
      oldestByKind[it.kind] = it.at; // ordenado desc, então o último visto é o mais antigo
    }
    // recompute oldest per kind (mínimo)
    for (const it of items) {
      const prev = oldestByKind[it.kind];
      if (!prev || new Date(it.at).getTime() < new Date(prev).getTime()) oldestByKind[it.kind] = it.at;
    }
    const results = await Promise.all(kinds.map((k) => fetchBatch(k, oldestByKind[k] || null)));
    const nextHas = { ...hasMore };
    kinds.forEach((k, i) => { nextHas[k] = results[i].length >= BATCH_SIZE; });
    const merged = [...items, ...results.flat()]
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    // dedup por id
    const seen = new Set<string>();
    const uniq = merged.filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)));
    setHasMore(nextHas);
    setItems(uniq);
    setLoadingMore(false);
  }, [items, hasMore]);

  // Filtros aplicados
  const cutoff = useMemo(() => {
    if (range === "custom") return null;
    const days = Number(range);
    return days > 0 ? subDays(new Date(), days) : null;
  }, [range]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const from = range === "custom" && customFrom ? startOfDay(customFrom) : null;
    const to = range === "custom" && customTo ? endOfDay(customTo) : null;
    return items.filter((i) => {
      if (kind !== "todos" && i.kind !== kind) return false;
      if (status !== "todos" && String(i.status || "") !== status) return false;
      const d = new Date(i.at);
      if (cutoff && !isAfter(d, cutoff)) return false;
      if (from && isBefore(d, from)) return false;
      if (to && isAfter(d, to)) return false;
      if (term && !`${i.title} ${i.subtitle || ""}`.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [items, kind, status, cutoff, customFrom, customTo, range, q]);

  // Contagens por filtro (respeitando os demais filtros exceto o próprio)
  const matchesExcept = (i: FeedItem, opts: { skipKind?: boolean; skipStatus?: boolean }) => {
    const term = q.trim().toLowerCase();
    const from = range === "custom" && customFrom ? startOfDay(customFrom) : null;
    const to = range === "custom" && customTo ? endOfDay(customTo) : null;
    if (!opts.skipKind && kind !== "todos" && i.kind !== kind) return false;
    if (!opts.skipStatus && status !== "todos" && String(i.status || "") !== status) return false;
    const d = new Date(i.at);
    if (cutoff && !isAfter(d, cutoff)) return false;
    if (from && isBefore(d, from)) return false;
    if (to && isAfter(d, to)) return false;
    if (term && !`${i.title} ${i.subtitle || ""}`.toLowerCase().includes(term)) return false;
    return true;
  };

  const kindCounts = useMemo(() => {
    const c: Record<string, number> = { todos: 0, post: 0, lead: 0, captacao: 0, compromisso: 0 };
    items.forEach((i) => {
      if (matchesExcept(i, { skipKind: true })) {
        c.todos++;
        c[i.kind]++;
      }
    });
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, status, cutoff, customFrom, customTo, range, q]);

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = { todos: 0 };
    items.forEach((i) => {
      if (matchesExcept(i, { skipStatus: true })) {
        c.todos++;
        const s = String(i.status || "");
        if (s) c[s] = (c[s] || 0) + 1;
      }
    });
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, kind, cutoff, customFrom, customTo, range, q]);

  const statusOptions = useMemo(
    () => Object.keys(statusCounts).filter((k) => k !== "todos").sort(),
    [statusCounts]
  );

  // Reset visíveis ao mudar filtros
  useEffect(() => { setVisible(PAGE_SIZE); }, [kind, status, range, customFrom, customTo, q]);

  const visibleItems = filtered.slice(0, visible);
  const canShowMoreLocal = visible < filtered.length;
  const anyMoreServer = Object.values(hasMore).some(Boolean);

  // Infinite scroll
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(async (entries) => {
      if (!entries[0].isIntersecting) return;
      if (canShowMoreLocal) {
        setVisible((v) => v + PAGE_SIZE);
      } else if (anyMoreServer && !loadingMore && !loading) {
        await fetchMoreFromServer();
        setVisible((v) => v + PAGE_SIZE);
      }
    }, { rootMargin: "400px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, [canShowMoreLocal, anyMoreServer, loadingMore, loading, fetchMoreFromServer]);

  const clearFilters = () => {
    setKind("todos"); setStatus("todos"); setRange("7");
    setCustomFrom(undefined); setCustomTo(undefined); setQ("");
  };
  const activeFilters =
    (kind !== "todos" ? 1 : 0) +
    (status !== "todos" ? 1 : 0) +
    (range !== "7" ? 1 : 0) +
    (q.trim() ? 1 : 0);

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Feed de atividades</h1>
          <p className="text-muted-foreground mt-1">Posts, leads, captações e compromissos recentes em um só lugar.</p>
        </div>
        <Button variant="outline" onClick={fetchInitial} disabled={loading} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </header>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <Tabs value={kind} onValueChange={(v) => { setKind(v as any); setStatus("todos"); }}>
            <TabsList className="flex flex-wrap h-auto">
              <TabsTrigger value="todos">Todos <Badge variant="secondary" className="ml-2">{kindCounts.todos}</Badge></TabsTrigger>
              <TabsTrigger value="post">Posts <Badge variant="secondary" className="ml-2">{kindCounts.post}</Badge></TabsTrigger>
              <TabsTrigger value="lead">Leads <Badge variant="secondary" className="ml-2">{kindCounts.lead}</Badge></TabsTrigger>
              <TabsTrigger value="captacao">Captações <Badge variant="secondary" className="ml-2">{kindCounts.captacao}</Badge></TabsTrigger>
              <TabsTrigger value="compromisso">Agenda <Badge variant="secondary" className="ml-2">{kindCounts.compromisso}</Badge></TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por título ou descrição..." className="pl-9" />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status ({statusCounts.todos || 0})</SelectItem>
                {statusOptions.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s} ({statusCounts[s] || 0})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={range} onValueChange={setRange}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DATE_RANGES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {range === "custom" && (
            <div className="flex flex-wrap items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("justify-start text-left font-normal gap-2", !customFrom && "text-muted-foreground")}>
                    <CalendarIcon className="w-4 h-4" />
                    {customFrom ? format(customFrom, "dd MMM yyyy", { locale: ptBR }) : "De"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} initialFocus className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
              <span className="text-muted-foreground text-sm">até</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("justify-start text-left font-normal gap-2", !customTo && "text-muted-foreground")}>
                    <CalendarIcon className="w-4 h-4" />
                    {customTo ? format(customTo, "dd MMM yyyy", { locale: ptBR }) : "Até"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customTo} onSelect={setCustomTo} initialFocus className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
              {(customFrom || customTo) && (
                <Button variant="ghost" size="sm" onClick={() => { setCustomFrom(undefined); setCustomTo(undefined); }} className="gap-1">
                  <X className="w-3 h-3" /> Limpar datas
                </Button>
              )}
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {filtered.length} resultado{filtered.length === 1 ? "" : "s"}
              {activeFilters > 0 && ` · ${activeFilters} filtro${activeFilters === 1 ? "" : "s"} ativo${activeFilters === 1 ? "" : "s"}`}
            </span>
            {activeFilters > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 gap-1">
                <X className="w-3 h-3" /> Limpar filtros
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">
          Nenhuma atividade nos filtros selecionados.
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {visibleItems.map((item) => {
            const meta = KIND_META[item.kind];
            const Icon = meta.icon;
            const rawId = item.id.split(":").slice(1).join(":");
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelected({ kind: item.kind as SheetKind, rawId })}
                className="block w-full text-left group"
              >
                <Card className="transition hover:shadow-sm hover:border-primary/40">
                  <CardContent className="py-4 flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-lg border flex items-center justify-center flex-shrink-0 ${meta.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge variant="outline" className="text-xs">{meta.label}</Badge>
                        {item.status && <Badge variant="secondary" className="text-xs">{item.status}</Badge>}
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(item.at), "dd MMM yyyy · HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                      <p className="font-medium truncate group-hover:text-primary transition">{item.title}</p>
                      {item.subtitle && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{item.subtitle}</p>
                      )}
                    </div>
                    <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition flex-shrink-0 mt-1" />
                  </CardContent>
                </Card>
              </button>
            );
          })}

          <div ref={sentinelRef} className="py-6 flex justify-center">
            {loadingMore ? (
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            ) : !canShowMoreLocal && !anyMoreServer ? (
              <span className="text-xs text-muted-foreground">Fim do feed</span>
            ) : (
              <span className="text-xs text-muted-foreground">Carregando mais…</span>
            )}
          </div>
        </div>
      )}

      <FeedItemDetailSheet
        open={!!selected}
        onOpenChange={(o) => { if (!o) setSelected(null); }}
        kind={selected?.kind ?? null}
        rawId={selected?.rawId ?? null}
      />
    </div>
  );
}
