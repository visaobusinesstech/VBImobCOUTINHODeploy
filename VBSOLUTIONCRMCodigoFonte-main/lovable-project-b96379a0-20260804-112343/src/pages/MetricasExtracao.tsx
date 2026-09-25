import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { SectionHeader } from "@/components/shared/MetricCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  BarChart3, AlertTriangle, ShieldAlert, Clock, ImageOff, Wifi,
  CheckCircle2, XCircle, RefreshCw, Loader2, Globe, Users, Database
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend
} from "recharts";
import { useNavigate } from "react-router-dom";
import { FilaExtracaoPanel } from "@/components/extracao/FilaExtracaoPanel";

interface LogRow {
  id: string;
  portal: string | null;
  status: string;
  error_message: string | null;
  error_code: string | null;
  http_status: number | null;
  missing_fields: string[] | null;
  response_time_ms: number | null;
  created_at: string;
  user_id: string | null;
  profiles?: { nome?: string; email?: string } | null;
}

type FailureReason =
  | "captcha_bloqueio"
  | "timeout"
  | "http_erro"
  | "seletor_nao_bateu"
  | "sem_fotos"
  | "ia_desconectada"
  | "outro";

const REASON_META: Record<FailureReason, { label: string; color: string; icon: any }> = {
  captcha_bloqueio: { label: "Captcha / Anti-bot", color: "#dc2626", icon: ShieldAlert },
  timeout:          { label: "Timeout",             color: "#f59e0b", icon: Clock },
  http_erro:        { label: "Erro HTTP (4xx/5xx)", color: "#7c3aed", icon: Wifi },
  seletor_nao_bateu:{ label: "Seletor não bateu",   color: "#2563eb", icon: AlertTriangle },
  sem_fotos:        { label: "Sem fotos públicas",  color: "#0891b2", icon: ImageOff },
  ia_desconectada:  { label: "IA não conectada",    color: "#64748b", icon: XCircle },
  outro:            { label: "Outros",              color: "#94a3b8", icon: AlertTriangle },
};

function classifyReason(row: LogRow): FailureReason | null {
  if (row.status === "success") return null;
  const msg = (row.error_message || "").toLowerCase();
  const code = (row.error_code || "").toLowerCase();
  if (code.includes("captcha") || code.includes("blocked") || msg.includes("captcha") || msg.includes("bloque") || msg.includes("anti-bot") || row.http_status === 403 || row.http_status === 429)
    return "captcha_bloqueio";
  if (msg.includes("timeout") || msg.includes("timed out") || code.includes("timeout")) return "timeout";
  if (msg.includes("ia") && msg.includes("conect")) return "ia_desconectada";
  if (row.http_status && row.http_status >= 400) return "http_erro";
  const fields = row.missing_fields || [];
  if (fields.some(f => f.toLowerCase().includes("foto"))) return "sem_fotos";
  if (fields.length > 0) return "seletor_nao_bateu";
  if (msg.includes("non-2xx") || msg.includes("selector") || msg.includes("parse")) return "seletor_nao_bateu";
  return "outro";
}

const PERIODOS = [
  { v: "7",  l: "Últimos 7 dias" },
  { v: "30", l: "Últimos 30 dias" },
  { v: "90", l: "Últimos 90 dias" },
];

export default function MetricasExtracao() {
  const { user, isMaster } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [periodo, setPeriodo] = useState("30");
  const [filterPortal, setFilterPortal] = useState("all");
  const [filterUser, setFilterUser] = useState("all");
  const [users, setUsers] = useState<{ id: string; nome: string }[]>([]);
  const [cacheStats, setCacheStats] = useState<{ total: number; blocked: number; hits: number } | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const since = new Date();
      since.setDate(since.getDate() - Number(periodo));

      let q = supabase
        .from("extraction_logs")
        .select("id,portal,status,error_message,error_code,http_status,missing_fields,response_time_ms,created_at,user_id, profiles:user_id(nome,email)")
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false })
        .limit(5000);

      if (!isMaster) q = q.eq("user_id", user.id);
      else if (filterUser !== "all") q = q.eq("user_id", filterUser);
      if (filterPortal !== "all") q = q.eq("portal", filterPortal);

      const { data, error } = await q;
      if (error) throw error;
      setLogs((data || []) as any);

      // cache metrics
      const { data: cache } = await supabase
        .from("photo_extraction_cache")
        .select("blocked,hits")
        .gte("created_at", since.toISOString());
      if (cache) {
        setCacheStats({
          total: cache.length,
          blocked: cache.filter((c: any) => c.blocked).length,
          hits: cache.reduce((s: number, c: any) => s + (c.hits || 0), 0),
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isMaster) return;
    supabase.from("profiles").select("id,nome").order("nome").then(({ data }) => data && setUsers(data as any));
  }, [isMaster]);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user, periodo, filterPortal, filterUser]);

  const kpis = useMemo(() => {
    const total = logs.length;
    const sucesso = logs.filter(l => l.status === "success").length;
    const parcial = logs.filter(l => ["partial", "incomplete"].includes(l.status)).length;
    const falha = total - sucesso - parcial;
    const tempoMedio = total
      ? Math.round(logs.reduce((s, l) => s + (l.response_time_ms || 0), 0) / total)
      : 0;
    return { total, sucesso, parcial, falha, tempoMedio };
  }, [logs]);

  const porPortal = useMemo(() => {
    const map: Record<string, { portal: string; total: number; sucesso: number; falha: number }> = {};
    logs.forEach(l => {
      const p = l.portal || "desconhecido";
      map[p] ??= { portal: p, total: 0, sucesso: 0, falha: 0 };
      map[p].total++;
      if (l.status === "success") map[p].sucesso++; else map[p].falha++;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [logs]);

  const porMotivo = useMemo(() => {
    const map: Record<string, number> = {};
    logs.forEach(l => {
      const r = classifyReason(l);
      if (!r) return;
      map[r] = (map[r] || 0) + 1;
    });
    return (Object.keys(REASON_META) as FailureReason[])
      .filter(k => map[k])
      .map(k => ({ key: k, name: REASON_META[k].label, value: map[k], color: REASON_META[k].color }));
  }, [logs]);

  const porUsuario = useMemo(() => {
    const map: Record<string, { user_id: string; nome: string; email: string; total: number; falha: number }> = {};
    logs.forEach(l => {
      const id = l.user_id || "system";
      map[id] ??= { user_id: id, nome: l.profiles?.nome || "Sistema", email: l.profiles?.email || "—", total: 0, falha: 0 };
      map[id].total++;
      if (l.status !== "success") map[id].falha++;
    });
    return Object.values(map).sort((a, b) => b.falha - a.falha).slice(0, 10);
  }, [logs]);

  const matriz = useMemo(() => {
    // portal x motivo
    const portais = porPortal.map(p => p.portal);
    const rows = portais.map(p => {
      const row: Record<string, any> = { portal: p };
      (Object.keys(REASON_META) as FailureReason[]).forEach(k => (row[k] = 0));
      logs.filter(l => (l.portal || "desconhecido") === p).forEach(l => {
        const r = classifyReason(l);
        if (r) row[r]++;
      });
      return row;
    });
    return rows;
  }, [logs, porPortal]);

  const portaisUnicos = Array.from(new Set(logs.map(l => l.portal).filter(Boolean))) as string[];

  return (
    <DashboardLayout>
      <SectionHeader
        title="Métricas de Extração"
        subtitle="Painel administrativo de saúde da extração de dados e fotos por portal e por usuário"
      />

      <div className="space-y-6">
        {/* Filtros */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase font-bold text-muted-foreground">Período</Label>
                <Select value={periodo} onValueChange={setPeriodo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PERIODOS.map(p => <SelectItem key={p.v} value={p.v}>{p.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase font-bold text-muted-foreground">Portal</Label>
                <Select value={filterPortal} onValueChange={setFilterPortal}>
                  <SelectTrigger><Globe className="w-4 h-4 mr-2 text-muted-foreground" /><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os portais</SelectItem>
                    {portaisUnicos.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase font-bold text-muted-foreground">Usuário</Label>
                <Select value={filterUser} onValueChange={setFilterUser} disabled={!isMaster}>
                  <SelectTrigger><Users className="w-4 h-4 mr-2 text-muted-foreground" /><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os usuários</SelectItem>
                    {users.map(u => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button onClick={load} variant="outline" className="w-full" disabled={loading}>
                  <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Recarregar
                </Button>
                <Button onClick={() => navigate("/auditoria-extracao")} variant="secondary" className="w-full">
                  Ver logs
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="py-24 flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Carregando métricas...</p>
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <KpiCard icon={BarChart3} label="Extrações" value={kpis.total} />
              <KpiCard icon={CheckCircle2} label="Sucesso" value={kpis.sucesso} tone="success"
                       hint={kpis.total ? `${((kpis.sucesso / kpis.total) * 100).toFixed(1)}%` : "—"} />
              <KpiCard icon={AlertTriangle} label="Parcial" value={kpis.parcial} tone="warn"
                       hint={kpis.total ? `${((kpis.parcial / kpis.total) * 100).toFixed(1)}%` : "—"} />
              <KpiCard icon={XCircle} label="Falhas" value={kpis.falha} tone="danger"
                       hint={kpis.total ? `${((kpis.falha / kpis.total) * 100).toFixed(1)}%` : "—"} />
              <KpiCard icon={Clock} label="Tempo médio" value={`${(kpis.tempoMedio / 1000).toFixed(1)}s`} />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Globe className="w-4 h-4 text-primary" /> Falhas por portal</CardTitle></CardHeader>
                <CardContent className="h-72">
                  {porPortal.length === 0 ? <Empty /> : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={porPortal}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="portal" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={60} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="sucesso" stackId="a" fill="#16a34a" name="Sucesso" />
                        <Bar dataKey="falha" stackId="a" fill="#dc2626" name="Falha" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-sm flex items-center gap-2"><ShieldAlert className="w-4 h-4 text-primary" /> Motivos de falha</CardTitle></CardHeader>
                <CardContent className="h-72">
                  {porMotivo.length === 0 ? <Empty /> : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={porMotivo} dataKey="value" nameKey="name" outerRadius={90} label>
                          {porMotivo.map(m => <Cell key={m.key} fill={m.color} />)}
                        </Pie>
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Matriz portal x motivo */}
            <Card>
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-primary" /> Motivos por portal</CardTitle></CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                {matriz.length === 0 ? <div className="p-6"><Empty /></div> : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30 text-left">
                        <th className="p-3 font-semibold">Portal</th>
                        {(Object.keys(REASON_META) as FailureReason[]).map(k => (
                          <th key={k} className="p-3 font-semibold text-center">
                            <div className="flex flex-col items-center gap-1">
                              <span className="w-2 h-2 rounded-full" style={{ background: REASON_META[k].color }} />
                              <span className="text-[11px]">{REASON_META[k].label}</span>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {matriz.map(r => (
                        <tr key={r.portal} className="border-b hover:bg-muted/20">
                          <td className="p-3 font-medium">{r.portal}</td>
                          {(Object.keys(REASON_META) as FailureReason[]).map(k => (
                            <td key={k} className="p-3 text-center">
                              {r[k] > 0
                                ? <Badge variant="outline" style={{ borderColor: REASON_META[k].color, color: REASON_META[k].color }}>{r[k]}</Badge>
                                : <span className="text-muted-foreground/40">—</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>

            {/* Top usuários com falhas */}
            <Card>
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Users className="w-4 h-4 text-primary" /> Usuários com mais falhas</CardTitle></CardHeader>
              <CardContent className="p-0">
                {porUsuario.length === 0 ? <div className="p-6"><Empty /></div> : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30 text-left">
                        <th className="p-3 font-semibold">Usuário</th>
                        <th className="p-3 font-semibold text-right">Extrações</th>
                        <th className="p-3 font-semibold text-right">Falhas</th>
                        <th className="p-3 font-semibold text-right">Taxa de falha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {porUsuario.map(u => {
                        const taxa = u.total ? (u.falha / u.total) * 100 : 0;
                        return (
                          <tr key={u.user_id} className="border-b hover:bg-muted/20">
                            <td className="p-3">
                              <div className="flex flex-col">
                                <span className="font-medium">{u.nome}</span>
                                <span className="text-[11px] text-muted-foreground">{u.email}</span>
                              </div>
                            </td>
                            <td className="p-3 text-right">{u.total}</td>
                            <td className="p-3 text-right">{u.falha}</td>
                            <td className="p-3 text-right">
                              <Badge variant={taxa > 50 ? "destructive" : taxa > 20 ? "outline" : "secondary"}>
                                {taxa.toFixed(1)}%
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>

            {/* Cache */}
            <FilaExtracaoPanel />

            {cacheStats && (
              <Card>
                <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Database className="w-4 h-4 text-primary" /> Cache de fotos</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <KpiCard icon={Database} label="URLs cacheadas" value={cacheStats.total} />
                    <KpiCard icon={CheckCircle2} label="Reaproveitamentos (hits)" value={cacheStats.hits} tone="success" />
                    <KpiCard icon={ShieldAlert} label="Bloqueadas" value={cacheStats.blocked} tone="danger" />
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

function KpiCard({ icon: Icon, label, value, tone, hint }: { icon: any; label: string; value: any; tone?: "success" | "warn" | "danger"; hint?: string }) {
  const toneColor =
    tone === "success" ? "text-emerald-600" :
    tone === "warn" ? "text-amber-600" :
    tone === "danger" ? "text-rose-600" : "text-primary";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase font-bold text-muted-foreground">{label}</p>
            <p className={`text-2xl font-bold ${toneColor}`}>{value}</p>
            {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
          </div>
          <Icon className={`w-8 h-8 ${toneColor} opacity-30`} />
        </div>
      </CardContent>
    </Card>
  );
}

function Empty() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-muted-foreground py-8">
      <BarChart3 className="w-10 h-10 opacity-30 mb-2" />
      <p className="text-sm">Sem dados no período selecionado.</p>
    </div>
  );
}
