import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Loader2, PlayCircle, RefreshCw, ListChecks, CheckCircle2, XCircle,
  Clock, ExternalLink, Ban
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface QueueRow {
  id: string;
  source_url: string;
  portal: string | null;
  status: "pending" | "processing" | "done" | "failed" | "cancelled";
  attempts: number;
  max_attempts: number;
  next_run_at: string;
  last_error: string | null;
  last_error_code: string | null;
  last_block_reason: string | null;
  origin: string;
  created_at: string;
  user_id: string;
  profiles?: { nome?: string; email?: string } | null;
  result?: { fotos?: string[]; count?: number } | null;
}

const STATUS_META: Record<QueueRow["status"], { label: string; icon: any; className: string }> = {
  pending:    { label: "Pendente",    icon: Clock,        className: "bg-amber-100 text-amber-700 border-amber-200" },
  processing: { label: "Processando", icon: Loader2,      className: "bg-blue-100 text-blue-700 border-blue-200" },
  done:       { label: "Concluído",   icon: CheckCircle2, className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  failed:     { label: "Falhou",      icon: XCircle,      className: "bg-rose-100 text-rose-700 border-rose-200" },
  cancelled:  { label: "Cancelado",   icon: Ban,          className: "bg-slate-100 text-slate-600 border-slate-200" },
};

export function FilaExtracaoPanel() {
  const { user, isMaster } = useAuth();
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningWorker, setRunningWorker] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from("photo_extraction_queue")
        .select("id,source_url,portal,status,attempts,max_attempts,next_run_at,last_error,last_error_code,last_block_reason,origin,created_at,user_id,result, profiles:user_id(nome,email)")
        .order("created_at", { ascending: false })
        .limit(50);
      setRows((data || []) as any);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* auto-refresh */
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
    // eslint-disable-next-line
  }, [user]);

  const runWorkerNow = async () => {
    setRunningWorker(true);
    try {
      const { data, error } = await supabase.functions.invoke("photo-extraction-worker", { body: {} });
      if (error) throw error;
      toast.success(`Worker executado — ${data?.processed ?? 0} jobs processados`);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Falha ao executar worker");
    } finally {
      setRunningWorker(false);
    }
  };

  const requeue = async (row: QueueRow) => {
    try {
      const { data, error } = await supabase.functions.invoke("photo-extraction-enqueue", {
        body: { source_url: row.source_url, origin: "manual_retry" },
      });
      if (error) throw error;
      toast.success(data?.deduped ? "Já havia um item pendente para este link." : "Reprocessamento agendado.");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Falha ao enfileirar");
    }
  };

  const cancel = async (row: QueueRow) => {
    const { error } = await supabase
      .from("photo_extraction_queue")
      .update({ status: "cancelled" })
      .eq("id", row.id);
    if (error) toast.error(error.message); else { toast.success("Item cancelado."); load(); }
  };

  const counts = rows.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {} as Record<string, number>);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <ListChecks className="w-4 h-4 text-primary" /> Fila de reprocessamento de fotos
        </CardTitle>
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5 text-[11px]">
            {(Object.keys(STATUS_META) as QueueRow["status"][]).map(s => (
              <Badge key={s} variant="outline" className={STATUS_META[s].className}>
                {STATUS_META[s].label}: {counts[s] || 0}
              </Badge>
            ))}
          </div>
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
          {isMaster && (
            <Button size="sm" onClick={runWorkerNow} disabled={runningWorker}>
              {runningWorker
                ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Rodando</>
                : <><PlayCircle className="w-3.5 h-3.5 mr-1" /> Rodar worker agora</>}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading && rows.length === 0 ? (
          <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : rows.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Nenhum item na fila. Novos itens são adicionados automaticamente quando um portal bloqueia a extração.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-left">
                  <th className="p-3 font-semibold">Status</th>
                  <th className="p-3 font-semibold">Portal / URL</th>
                  {isMaster && <th className="p-3 font-semibold">Usuário</th>}
                  <th className="p-3 font-semibold">Tentativas</th>
                  <th className="p-3 font-semibold">Próxima execução</th>
                  <th className="p-3 font-semibold">Último erro</th>
                  <th className="p-3 font-semibold text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const S = STATUS_META[r.status];
                  const Icon = S.icon;
                  return (
                    <tr key={r.id} className="border-b hover:bg-muted/20">
                      <td className="p-3">
                        <Badge variant="outline" className={`${S.className} gap-1`}>
                          <Icon className={`w-3 h-3 ${r.status === "processing" ? "animate-spin" : ""}`} />
                          {S.label}
                        </Badge>
                        <div className="text-[10px] text-muted-foreground mt-1">{r.origin}</div>
                      </td>
                      <td className="p-3">
                        <div className="font-medium">{r.portal || "—"}</div>
                        <a href={r.source_url} target="_blank" rel="noopener noreferrer"
                           className="text-[11px] text-muted-foreground hover:text-primary flex items-center gap-1 truncate max-w-[280px]">
                          <ExternalLink className="w-3 h-3" /> {r.source_url}
                        </a>
                      </td>
                      {isMaster && (
                        <td className="p-3">
                          <div className="font-medium">{r.profiles?.nome || "—"}</div>
                          <div className="text-[10px] text-muted-foreground">{r.profiles?.email}</div>
                        </td>
                      )}
                      <td className="p-3">
                        <Badge variant={r.attempts >= r.max_attempts ? "destructive" : "secondary"}>
                          {r.attempts}/{r.max_attempts}
                        </Badge>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {r.status === "pending"
                          ? format(new Date(r.next_run_at), "dd/MM HH:mm", { locale: ptBR })
                          : "—"}
                      </td>
                      <td className="p-3 max-w-[240px]">
                        {r.last_error ? (
                          <div>
                            <div className="text-[11px] text-rose-600 truncate" title={r.last_error}>{r.last_error}</div>
                            {r.last_error_code && (
                              <Badge variant="outline" className="mt-1 text-[10px]">{r.last_error_code}</Badge>
                            )}
                          </div>
                        ) : r.status === "done" ? (
                          <span className="text-emerald-600 text-xs">{r.result?.count ?? 0} fotos coletadas</span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-1">
                          {["failed", "done", "cancelled"].includes(r.status) && (
                            <Button size="sm" variant="outline" onClick={() => requeue(r)}>
                              <RefreshCw className="w-3.5 h-3.5 mr-1" /> Reprocessar
                            </Button>
                          )}
                          {r.status === "pending" && r.user_id === user?.id && (
                            <Button size="sm" variant="ghost" onClick={() => cancel(r)}>
                              <Ban className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
