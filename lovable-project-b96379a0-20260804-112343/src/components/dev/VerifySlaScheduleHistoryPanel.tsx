import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Clock, CheckCircle2, XCircle } from "lucide-react";

type ScheduleConfig = {
  id: string;
  cron_expression: string;
  ativo: boolean;
  ultima_execucao_em: string | null;
  ultima_execucao_status: string | null;
  falhas_consecutivas: number;
};

type ExecLog = {
  id: string;
  executado_em: string;
  status: string;
  http_status: number | null;
  duracao_ms: number | null;
  payload: any;
  erro: string | null;
};

const CRON_PRESETS = [
  { label: "A cada 15 min", value: "*/15 * * * *" },
  { label: "A cada 30 min", value: "*/30 * * * *" },
  { label: "A cada 1 hora", value: "0 * * * *" },
  { label: "A cada 6 horas", value: "0 */6 * * *" },
  { label: "1x por dia (03h)", value: "0 3 * * *" },
];

export default function VerifySlaScheduleHistoryPanel() {
  const [config, setConfig] = useState<ScheduleConfig | null>(null);
  const [logs, setLogs] = useState<ExecLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: cfg }, { data: hist }] = await Promise.all([
      supabase
        .from("verify_sla_schedule_config")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("verify_sla_execucoes_log")
        .select("*")
        .order("executado_em", { ascending: false })
        .limit(30),
    ]);
    setConfig(cfg as any);
    setLogs((hist as any) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updateCron = async (expr: string, ativo?: boolean) => {
    if (!config) return;
    setSaving(true);
    await supabase
      .from("verify_sla_schedule_config")
      .update({
        cron_expression: expr,
        ativo: ativo ?? config.ativo,
      })
      .eq("id", config.id);
    setSaving(false);
    await load();
  };

  const toggleAtivo = async () => {
    if (!config) return;
    setSaving(true);
    await supabase
      .from("verify_sla_schedule_config")
      .update({ ativo: !config.ativo })
      .eq("id", config.id);
    setSaving(false);
    await load();
  };

  const successRate = logs.length
    ? Math.round(
        (logs.filter((l) => l.status === "triggered" || l.status === "success")
          .length /
          logs.length) *
          100
      )
    : 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">
            Agendamento automático do Verify SLA
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Executa <code>verify-captacao-sla</code> periodicamente para
            detectar regressões antes dos usuários.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {config && (
          <div className="rounded-lg border p-3 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={config.ativo ? "default" : "secondary"}>
                {config.ativo ? "Ativo" : "Pausado"}
              </Badge>
              <code className="text-xs bg-muted px-2 py-1 rounded">
                {config.cron_expression}
              </code>
              {config.ultima_execucao_em && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Última:{" "}
                  {new Date(config.ultima_execucao_em).toLocaleString("pt-BR")}
                </span>
              )}
              {config.falhas_consecutivas > 0 && (
                <Badge variant="destructive">
                  {config.falhas_consecutivas} falhas seguidas
                </Badge>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={toggleAtivo}
                disabled={saving}
                className="ml-auto"
              >
                {config.ativo ? "Pausar" : "Reativar"}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {CRON_PRESETS.map((p) => (
                <Button
                  key={p.value}
                  size="sm"
                  variant={
                    config.cron_expression === p.value ? "default" : "outline"
                  }
                  onClick={() => updateCron(p.value)}
                  disabled={saving}
                >
                  {p.label}
                </Button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              O agendador (pg_cron) roda de hora em hora. O intervalo salvo
              aqui é lido a cada disparo — presets menores que 1h serão
              respeitados após atualização do cron no banco.
            </p>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium">
              Histórico ({logs.length}) · taxa de sucesso {successRate}%
            </h4>
          </div>
          <div className="max-h-80 overflow-auto rounded-lg border divide-y">
            {logs.length === 0 && (
              <div className="p-4 text-xs text-muted-foreground text-center">
                Nenhuma execução registrada ainda.
              </div>
            )}
            {logs.map((l) => {
              const ok = l.status === "triggered" || l.status === "success";
              return (
                <div
                  key={l.id}
                  className="p-2 flex items-center gap-2 text-xs"
                >
                  {ok ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-red-600 shrink-0" />
                  )}
                  <span className="text-muted-foreground w-40 shrink-0">
                    {new Date(l.executado_em).toLocaleString("pt-BR")}
                  </span>
                  <Badge variant={ok ? "outline" : "destructive"}>
                    {l.status}
                  </Badge>
                  {l.http_status && (
                    <span className="text-muted-foreground">
                      HTTP {l.http_status}
                    </span>
                  )}
                  {l.duracao_ms != null && (
                    <span className="text-muted-foreground">
                      {l.duracao_ms}ms
                    </span>
                  )}
                  {l.erro && (
                    <span className="text-red-600 truncate">{l.erro}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
