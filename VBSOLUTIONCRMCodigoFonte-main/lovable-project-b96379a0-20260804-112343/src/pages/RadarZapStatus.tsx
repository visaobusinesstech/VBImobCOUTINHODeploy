import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Activity, AlertTriangle, CheckCircle2, Clock, MessageSquare, RefreshCw, Radar, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type Kpis = {
  total24h: number;
  total7d: number;
  totalAll: number;
  ultimaMensagem: string | null;
  gruposAtivos: number;
  gruposConectados: number;
};

type ErroLog = {
  id: string;
  created_at: string;
  function_name?: string | null;
  http_status?: number | null;
  error_message?: string | null;
  message?: string | null;
  level?: string | null;
  source: "edge" | "system";
};

type SerieItem = { hora: string; total: number };

export default function RadarZapStatus() {
  const { user } = useAuth();
  const imobiliariaId = user?.id;
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [serie, setSerie] = useState<SerieItem[]>([]);
  const [erros, setErros] = useState<ErroLog[]>([]);
  const [refreshedAt, setRefreshedAt] = useState<Date>(new Date());

  const carregar = async () => {
    if (!imobiliariaId) return;
    setLoading(true);
    const agora = new Date();
    const h24 = new Date(agora.getTime() - 24 * 3600 * 1000).toISOString();
    const d7 = new Date(agora.getTime() - 7 * 24 * 3600 * 1000).toISOString();

    const [msgs24, msgs7, msgsTotal, ultima, grupos, edgeErr, sysErr] = await Promise.all([
      supabase.from("radarzap_mensagens").select("id", { count: "exact", head: true })
        .eq("imobiliaria_id", imobiliariaId).gte("created_at", h24),
      supabase.from("radarzap_mensagens").select("id", { count: "exact", head: true })
        .eq("imobiliaria_id", imobiliariaId).gte("created_at", d7),
      supabase.from("radarzap_mensagens").select("id", { count: "exact", head: true })
        .eq("imobiliaria_id", imobiliariaId),
      supabase.from("radarzap_mensagens").select("created_at")
        .eq("imobiliaria_id", imobiliariaId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("radarzap_grupos")
        .select("id, evolution_join_status, evolution_last_seen_at")
        .eq("imobiliaria_id", imobiliariaId),
      (supabase.from("edge_function_requests") as any)
        .select("id, created_at, function_name, http_status, error_message, status")
        .like("function_name", "radarzap%")
        .or("status.eq.error,http_status.gte.400")
        .order("created_at", { ascending: false }).limit(20),
      (supabase.from("system_logs") as any)
        .select("id, created_at, module, action, level, message")
        .eq("imobiliaria_id", imobiliariaId)
        .ilike("module", "%radarzap%")
        .in("level", ["error", "warn", "warning"])
        .order("created_at", { ascending: false }).limit(20),
    ]);

    // série 24h por hora
    const { data: serieData } = await supabase.from("radarzap_mensagens")
      .select("created_at").eq("imobiliaria_id", imobiliariaId)
      .gte("created_at", h24).order("created_at", { ascending: true });
    const buckets = new Map<string, number>();
    for (let i = 23; i >= 0; i--) {
      const d = new Date(agora.getTime() - i * 3600 * 1000);
      const key = `${d.getHours().toString().padStart(2, "0")}h`;
      buckets.set(key, 0);
    }
    (serieData ?? []).forEach((m: any) => {
      const d = new Date(m.created_at);
      const key = `${d.getHours().toString().padStart(2, "0")}h`;
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
    });
    setSerie(Array.from(buckets.entries()).map(([hora, total]) => ({ hora, total })));

    const gruposArr = grupos.data ?? [];
    setKpis({
      total24h: msgs24.count ?? 0,
      total7d: msgs7.count ?? 0,
      totalAll: msgsTotal.count ?? 0,
      ultimaMensagem: (ultima.data as any)?.created_at ?? null,
      gruposAtivos: gruposArr.filter((g: any) => g.evolution_last_seen_at &&
        new Date(g.evolution_last_seen_at).getTime() > agora.getTime() - 24 * 3600 * 1000).length,
      gruposConectados: gruposArr.filter((g: any) => g.evolution_join_status === "joined").length,
    });

    const errosMerged: ErroLog[] = [
      ...((edgeErr.data ?? []) as any[]).map((e) => ({
        id: `e-${e.id}`, created_at: e.created_at, function_name: e.function_name,
        http_status: e.http_status, error_message: e.error_message, source: "edge" as const,
      })),
      ...((sysErr.data ?? []) as any[]).map((s) => ({
        id: `s-${s.id}`, created_at: s.created_at, function_name: s.module,
        message: `${s.action ?? ""} ${s.message ?? ""}`.trim(), level: s.level, source: "system" as const,
      })),
    ].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, 25);
    setErros(errosMerged);

    setRefreshedAt(new Date());
    setLoading(false);
  };

  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [imobiliariaId]);
  useEffect(() => {
    const id = setInterval(() => carregar(), 60_000);
    return () => clearInterval(id);
    // eslint-disable-next-line
  }, [imobiliariaId]);

  const status = useMemo(() => {
    if (!kpis) return { label: "Verificando…", color: "bg-slate-200 text-slate-700", icon: Clock };
    const ultimaMs = kpis.ultimaMensagem ? new Date(kpis.ultimaMensagem).getTime() : 0;
    const min = ultimaMs ? (Date.now() - ultimaMs) / 60000 : Infinity;
    if (kpis.gruposConectados === 0) return { label: "Sem conexão Evolution", color: "bg-red-100 text-red-700", icon: XCircle };
    if (min <= 60) return { label: "Recebendo eventos", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 };
    if (min <= 24 * 60) return { label: "Baixa atividade", color: "bg-amber-100 text-amber-700", icon: AlertTriangle };
    return { label: "Sem eventos nas últimas 24h", color: "bg-red-100 text-red-700", icon: XCircle };
  }, [kpis]);

  const maxSerie = Math.max(1, ...serie.map((s) => s.total));

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Radar className="h-6 w-6 text-primary" /> RadarZAP · Status
          </h1>
          <p className="text-sm text-muted-foreground">
            Monitoramento de webhooks, mensagens recebidas e erros recentes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={status.color + " gap-1"}>
            <status.icon className="h-3.5 w-3.5" /> {status.label}
          </Badge>
          <Button variant="outline" size="sm" onClick={carregar} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard title="Mensagens 24h" value={kpis?.total24h} loading={loading} icon={MessageSquare} />
        <KpiCard title="Mensagens 7 dias" value={kpis?.total7d} loading={loading} icon={Activity} />
        <KpiCard title="Grupos conectados" value={kpis?.gruposConectados} loading={loading} icon={Radar}
          hint={kpis ? `${kpis.gruposAtivos} ativos nas últimas 24h` : undefined} />
        <KpiCard title="Última mensagem" loading={loading}
          value={kpis?.ultimaMensagem
            ? formatDistanceToNow(new Date(kpis.ultimaMensagem), { locale: ptBR, addSuffix: true })
            : "—"} icon={Clock} raw />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recebimento de eventos (últimas 24h)</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-32 w-full" /> : (
            <div className="flex items-end gap-1 h-32">
              {serie.map((s) => (
                <div key={s.hora} className="flex-1 flex flex-col items-center gap-1" title={`${s.hora}: ${s.total}`}>
                  <div className="w-full bg-primary/80 rounded-t"
                    style={{ height: `${(s.total / maxSerie) * 100}%`, minHeight: s.total > 0 ? 4 : 2 }} />
                  <span className="text-[10px] text-muted-foreground">{s.hora}</span>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            Total: {serie.reduce((a, b) => a + b.total, 0)} mensagens recebidas via webhook nas últimas 24h.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3 flex-row items-center justify-between">
          <CardTitle className="text-base">Erros recentes</CardTitle>
          <Badge variant="outline">{erros.length}</Badge>
        </CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-24 w-full" /> : erros.length === 0 ? (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Nenhum erro registrado.
            </div>
          ) : (
            <ul className="divide-y">
              {erros.map((e) => (
                <li key={e.id} className="py-2 flex items-start gap-3">
                  <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium">{e.function_name ?? "radarzap"}</span>
                      {e.http_status ? <Badge variant="destructive" className="text-[10px]">HTTP {e.http_status}</Badge> : null}
                      {e.level ? <Badge variant="outline" className="text-[10px]">{e.level}</Badge> : null}
                      <Badge variant="secondary" className="text-[10px]">{e.source}</Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(e.created_at), { locale: ptBR, addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground break-words">
                      {e.error_message || e.message || "Sem detalhes"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span>Atualizado {formatDistanceToNow(refreshedAt, { locale: ptBR, addSuffix: true })}.</span>
        <span>·</span>
        <Link to="/radarzap/onboarding" className="text-primary hover:underline">Onboarding</Link>
        <span>·</span>
        <Link to="/radarzap" className="text-primary hover:underline">Painel RadarZAP</Link>
      </div>
    </div>
  );
}

function KpiCard({ title, value, loading, icon: Icon, hint, raw }: {
  title: string; value?: number | string | null; loading: boolean;
  icon: React.ComponentType<{ className?: string }>; hint?: string; raw?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{title}</p>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        {loading ? <Skeleton className="h-7 w-20 mt-2" /> : (
          <p className="text-2xl font-semibold mt-1 truncate">
            {value === null || value === undefined ? "—" : raw ? String(value) : Number(value).toLocaleString("pt-BR")}
          </p>
        )}
        {hint ? <p className="text-[11px] text-muted-foreground mt-1">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
