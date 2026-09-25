import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldAlert, ShieldCheck, RefreshCcw, Download } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type LogRow = {
  id: string;
  user_id: string | null;
  user_email: string | null;
  route: string;
  status: "allowed" | "blocked";
  motivo: string | null;
  user_agent: string | null;
  created_at: string;
};

const MOTIVOS: Record<string, string> = {
  plan_gate: "Plano insuficiente",
  modulo_desativado: "Módulo desativado",
  sem_permissao: "Sem permissão",
};

export default function RadarZapAcessos() {
  const { isMaster } = useAuth();
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"todos" | "allowed" | "blocked">("todos");
  const [dias, setDias] = useState<"1" | "7" | "30" | "90">("7");

  const load = async () => {
    setLoading(true);
    const since = new Date(Date.now() - Number(dias) * 86_400_000).toISOString();
    const { data, error } = await supabase
      .from("radarzap_access_log" as any)
      .select("*")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) console.error(error);
    setRows(((data as any) || []) as LogRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dias]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== "todos" && r.status !== status) return false;
      if (!term) return true;
      return (
        (r.user_email || "").toLowerCase().includes(term) ||
        r.route.toLowerCase().includes(term) ||
        (r.motivo || "").toLowerCase().includes(term)
      );
    });
  }, [rows, q, status]);

  const totals = useMemo(() => ({
    total: filtered.length,
    blocked: filtered.filter((r) => r.status === "blocked").length,
    allowed: filtered.filter((r) => r.status === "allowed").length,
    users: new Set(filtered.map((r) => r.user_email || r.user_id || "")).size,
  }), [filtered]);

  const exportCsv = () => {
    const header = ["data", "usuario", "rota", "status", "motivo", "user_agent"].join(",");
    const esc = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;
    const lines = filtered.map((r) =>
      [
        new Date(r.created_at).toISOString(),
        r.user_email || r.user_id || "",
        r.route,
        r.status,
        r.motivo || "",
        r.user_agent || "",
      ].map(esc).join(",")
    );
    const csv = "\uFEFF" + [header, ...lines].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `radarzap-acessos-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ShieldAlert className="h-6 w-6 text-primary" />
              Logs de acesso do RadarZAP
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Quem acessou (ou tentou acessar) as páginas do RadarZAP, rota e data.
              {!isMaster && " Você vê apenas os seus próprios registros."}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCcw className="h-4 w-4 mr-2" /> Atualizar
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!filtered.length}>
              <Download className="h-4 w-4 mr-2" /> CSV
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Registros" value={totals.total} />
          <KpiCard label="Permitidos" value={totals.allowed} tone="ok" />
          <KpiCard label="Bloqueados" value={totals.blocked} tone="warn" />
          <KpiCard label="Usuários únicos" value={totals.users} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filtros</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Input
              placeholder="Buscar por usuário, rota ou motivo"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full sm:w-72"
            />
            <Select value={status} onValueChange={(v) => setStatus(v as any)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="allowed">Permitidos</SelectItem>
                <SelectItem value="blocked">Bloqueados</SelectItem>
              </SelectContent>
            </Select>
            <Select value={dias} onValueChange={(v) => setDias(v as any)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Últimas 24h</SelectItem>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Histórico</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-muted-foreground py-8 text-center">Carregando…</div>
            ) : filtered.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">Nenhum registro no período.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted-foreground border-b">
                    <tr>
                      <th className="py-2 pr-3">Data</th>
                      <th className="py-2 pr-3">Usuário</th>
                      <th className="py-2 pr-3">Rota</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2 pr-3">Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => (
                      <tr key={r.id} className="border-b last:border-0 hover:bg-muted/40">
                        <td className="py-2 pr-3 whitespace-nowrap">
                          {format(new Date(r.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                        </td>
                        <td className="py-2 pr-3">
                          <div className="font-medium">{r.user_email || "—"}</div>
                          <div className="text-xs text-muted-foreground truncate max-w-[220px]">{r.user_id || ""}</div>
                        </td>
                        <td className="py-2 pr-3 font-mono text-xs">{r.route}</td>
                        <td className="py-2 pr-3">
                          {r.status === "allowed" ? (
                            <Badge variant="secondary" className="gap-1"><ShieldCheck className="h-3 w-3" /> Permitido</Badge>
                          ) : (
                            <Badge variant="destructive" className="gap-1"><ShieldAlert className="h-3 w-3" /> Bloqueado</Badge>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-xs">
                          {r.motivo ? (MOTIVOS[r.motivo] || r.motivo) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function KpiCard({ label, value, tone }: { label: string; value: number; tone?: "ok" | "warn" }) {
  const color =
    tone === "ok" ? "text-emerald-600" :
    tone === "warn" ? "text-red-600" : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-2xl font-bold ${color}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
