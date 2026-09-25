import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, RotateCw, Bell, AlertTriangle, CheckCircle2, XCircle, KeyRound, Search, Clock, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  userId: string;
  providerLabel: string;
  provider: string;
  hasAiKey: boolean;
  hasSerperKey: boolean;
}

type Cfg = {
  api_key_rotated_at: string | null;
  serper_key_rotated_at: string | null;
  rotation_interval_days: number;
  rotation_alert_days: number;
  rotation_notifications_enabled: boolean;
  last_health_check_at: string | null;
  last_health_check_status: string | null;
  last_health_check_message: string | null;
};

type Alert = {
  id: string;
  key_kind: string;
  severity: string;
  provider: string | null;
  days_since_rotation: number | null;
  interval_days: number | null;
  message: string | null;
  created_at: string;
  acknowledged_at: string | null;
};

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function fmt(iso: string | null): string {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("pt-BR"); } catch { return "—"; }
}

function keyStatus(days: number | null, interval: number, threshold: number, invalid: boolean) {
  if (invalid) return { tone: "err" as const, label: "Inválida", color: "text-destructive" };
  if (days === null) return { tone: "neutral" as const, label: "Sem dados", color: "text-muted-foreground" };
  if (days >= interval) return { tone: "err" as const, label: "Vencida", color: "text-destructive" };
  if (days >= interval - threshold) return { tone: "warn" as const, label: "Prestes a vencer", color: "text-amber-600" };
  return { tone: "ok" as const, label: "Em dia", color: "text-emerald-600" };
}

export function RotacaoChavesPanel({ userId, providerLabel, provider, hasAiKey, hasSerperKey }: Props) {
  const { toast } = useToast();
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [rotating, setRotating] = useState<"ai" | "serper" | null>(null);

  const load = useCallback(async () => {
    const [{ data: c }, { data: a }] = await Promise.all([
      supabase.from("user_ai_config" as any).select(
        "api_key_rotated_at, serper_key_rotated_at, rotation_interval_days, rotation_alert_days, rotation_notifications_enabled, last_health_check_at, last_health_check_status, last_health_check_message"
      ).eq("user_id", userId).maybeSingle(),
      supabase.from("ai_key_rotation_alerts" as any).select("*")
        .eq("user_id", userId).order("created_at", { ascending: false }).limit(10),
    ]);
    setCfg((c as any) || null);
    setAlerts((a as any) || []);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const save = async (patch: Partial<Cfg>) => {
    setSaving(true);
    const merged = { ...(cfg || {}), ...patch };
    setCfg(merged as Cfg);
    const { error } = await supabase.from("user_ai_config" as any)
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    }
  };

  const markRotated = async (kind: "ai" | "serper") => {
    setRotating(kind);
    const field = kind === "ai" ? "api_key_rotated_at" : "serper_key_rotated_at";
    const now = new Date().toISOString();
    const { error } = await supabase.from("user_ai_config" as any)
      .update({ [field]: now, ...(kind === "ai" ? { last_health_check_status: null, last_health_check_message: null } : {}), updated_at: now })
      .eq("user_id", userId);
    setRotating(null);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Rotação registrada", description: "O contador foi zerado. Não esqueça de atualizar a chave no provedor." });
    load();
  };

  const runCheck = async () => {
    setChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke("check-ai-keys-rotation", {
        body: { user_id: userId },
      });
      if (error) throw new Error(error.message);
      const created = (data?.results?.[0]?.alertsCreated?.length) || 0;
      toast({
        title: "Checagem concluída",
        description: created > 0 ? `${created} alerta(s) gerado(s).` : "Tudo em ordem — nenhuma chave próxima do vencimento.",
      });
      load();
    } catch (e: any) {
      toast({ title: "Falha na checagem", description: e.message, variant: "destructive" });
    } finally {
      setChecking(false);
    }
  };

  const ack = async (id: string) => {
    await supabase.from("ai_key_rotation_alerts" as any)
      .update({ acknowledged_at: new Date().toISOString() }).eq("id", id);
    load();
  };

  if (loading) {
    return (
      <Card className="border-border/60 shadow-sm">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const interval = cfg?.rotation_interval_days ?? 90;
  const threshold = cfg?.rotation_alert_days ?? 15;
  const invalidAi = cfg?.last_health_check_status === "invalid";

  const aiDays = daysSince(cfg?.api_key_rotated_at ?? null);
  const serperDays = daysSince(cfg?.serper_key_rotated_at ?? null);
  const aiStatus = keyStatus(aiDays, interval, threshold, invalidAi);
  const serperStatus = keyStatus(serperDays, interval, threshold, false);

  const KeyRow = ({
    icon, title, subtitle, days, rotatedAt, status, onRotate, rotatingBusy, disabled,
  }: {
    icon: React.ReactNode; title: string; subtitle: string;
    days: number | null; rotatedAt: string | null;
    status: ReturnType<typeof keyStatus>;
    onRotate: () => void; rotatingBusy: boolean; disabled?: boolean;
  }) => {
    const pct = days !== null ? Math.min(100, (days / interval) * 100) : 0;
    return (
      <div className="rounded-lg border border-border/60 p-4 space-y-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            {icon}
            <div>
              <div className="font-semibold text-sm">{title}</div>
              <div className="text-[11px] text-muted-foreground">{subtitle}</div>
            </div>
          </div>
          <Badge variant="outline" className={cn("gap-1 text-[11px] font-semibold",
            status.tone === "ok" && "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400",
            status.tone === "warn" && "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400",
            status.tone === "err" && "bg-destructive/10 border-destructive/30 text-destructive",
            status.tone === "neutral" && "bg-muted text-muted-foreground",
          )}>
            {status.tone === "ok" && <CheckCircle2 className="w-3 h-3" />}
            {status.tone === "warn" && <AlertTriangle className="w-3 h-3" />}
            {status.tone === "err" && <XCircle className="w-3 h-3" />}
            {status.label}
          </Badge>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>Rotacionada em {fmt(rotatedAt)}</span>
            <span>{days !== null ? `${days} de ${interval} dias` : "—"}</span>
          </div>
          <Progress value={pct} className={cn(
            "h-1.5",
            status.tone === "err" && "[&>div]:bg-destructive",
            status.tone === "warn" && "[&>div]:bg-amber-500",
          )} />
        </div>
        <Button
          variant="outline" size="sm" className="w-full h-8 text-xs"
          onClick={onRotate} disabled={rotatingBusy || disabled}
        >
          {rotatingBusy ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RotateCw className="w-3 h-3 mr-1" />}
          Marcar como rotacionada agora
        </Button>
      </div>
    );
  };

  return (
    <Card className="border-border/60 shadow-sm overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <RotateCw className="w-5 h-5 text-primary" />
            Rotação de chaves e alertas
          </CardTitle>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={runCheck} disabled={checking}>
            {checking ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
            Checar agora
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          A plataforma monitora a idade das suas chaves e avisa antes do vencimento. Rotação manual: gere uma chave nova no provedor, cole aqui e clique em "Marcar como rotacionada".
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Keys */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {hasAiKey ? (
            <KeyRow
              icon={<KeyRound className="w-4 h-4 text-primary" />}
              title={`Chave ${providerLabel}`}
              subtitle={invalidAi ? "Falhou no último health check" : "Chave da IA principal"}
              days={aiDays}
              rotatedAt={cfg?.api_key_rotated_at ?? null}
              status={aiStatus}
              onRotate={() => markRotated("ai")}
              rotatingBusy={rotating === "ai"}
            />
          ) : (
            <div className="rounded-lg border border-dashed border-border/60 p-4 text-xs text-muted-foreground flex items-center gap-2">
              <KeyRound className="w-4 h-4" /> Nenhuma chave de IA cadastrada.
            </div>
          )}
          {hasSerperKey ? (
            <KeyRow
              icon={<Search className="w-4 h-4 text-primary" />}
              title="Chave Serper"
              subtitle="Pesquisa Google"
              days={serperDays}
              rotatedAt={cfg?.serper_key_rotated_at ?? null}
              status={serperStatus}
              onRotate={() => markRotated("serper")}
              rotatingBusy={rotating === "serper"}
            />
          ) : (
            <div className="rounded-lg border border-dashed border-border/60 p-4 text-xs text-muted-foreground flex items-center gap-2">
              <Search className="w-4 h-4" /> Serper não configurado (opcional).
            </div>
          )}
        </div>

        {/* Settings */}
        <div className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                Intervalo de rotação
              </Label>
              <Select
                value={String(interval)}
                onValueChange={(v) => save({ rotation_interval_days: Number(v) })}
                disabled={saving}
              >
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 dias (rígido)</SelectItem>
                  <SelectItem value="60">60 dias</SelectItem>
                  <SelectItem value="90">90 dias (recomendado)</SelectItem>
                  <SelectItem value="180">180 dias</SelectItem>
                  <SelectItem value="365">365 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                Alerta antecipado (dias)
              </Label>
              <Input
                type="number" min={1} max={60}
                value={threshold}
                onChange={(e) => setCfg((c) => c ? { ...c, rotation_alert_days: Number(e.target.value) } : c)}
                onBlur={(e) => save({ rotation_alert_days: Math.max(1, Math.min(60, Number(e.target.value) || 15)) })}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                Notificações
              </Label>
              <div className="h-9 flex items-center gap-2 rounded-md border border-input px-3">
                <Bell className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs flex-1">
                  {cfg?.rotation_notifications_enabled ? "Ativadas" : "Desligadas"}
                </span>
                <Switch
                  checked={!!cfg?.rotation_notifications_enabled}
                  onCheckedChange={(v) => save({ rotation_notifications_enabled: v })}
                />
              </div>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Checagem automática diária às 10h UTC. Alertas aparecem no sino de notificações e no histórico abaixo.
          </p>
        </div>

        {/* Alerts history */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-primary" />
            <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              Alertas recentes ({alerts.length})
            </span>
          </div>
          {alerts.length === 0 ? (
            <div className="text-xs text-muted-foreground italic px-1">Nenhum alerta emitido ainda.</div>
          ) : (
            <div className="space-y-1.5">
              {alerts.map((a) => (
                <div key={a.id} className={cn(
                  "rounded-md border px-3 py-2 text-xs flex items-start gap-2",
                  a.severity === "warning" && "border-amber-500/30 bg-amber-500/5",
                  a.severity === "expired" && "border-destructive/30 bg-destructive/5",
                  a.severity === "invalid" && "border-destructive/30 bg-destructive/5",
                  a.acknowledged_at && "opacity-60",
                )}>
                  {a.severity === "warning"
                    ? <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                    : <XCircle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{a.message}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(a.created_at).toLocaleString("pt-BR")} · {a.key_kind === "ai" ? (a.provider ?? "IA") : "Serper"}
                    </div>
                  </div>
                  {!a.acknowledged_at && (
                    <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => ack(a.id)}>
                      Reconhecer
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
