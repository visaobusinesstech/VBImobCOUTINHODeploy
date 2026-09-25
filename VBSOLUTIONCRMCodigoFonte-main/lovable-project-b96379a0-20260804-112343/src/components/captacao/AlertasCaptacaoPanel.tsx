import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Bell, Flame, Target, ExternalLink, Loader2, Save } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const NIVEIS = ["frio", "morno", "quente", "fervendo"] as const;

interface AlertaLog {
  id: string;
  proprietario_id: string;
  proprietario_nome: string | null;
  imovel_ref: string | null;
  tipo_evento: string;
  nivel_anterior: string | null;
  nivel_novo: string | null;
  score_anterior: number | null;
  score_novo: number | null;
  delivered_app: boolean;
  delivered_whatsapp: boolean;
  whatsapp_error: string | null;
  link: string | null;
  created_at: string;
  detalhes: any;
}

export function AlertasCaptacaoPanel() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const uid = user?.id;

  const { data: cfg } = useQuery({
    queryKey: ["alertas-captacao-config", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data } = await supabase
        .from("alertas_captacao_config")
        .select("*")
        .eq("imobiliaria_id", uid!)
        .maybeSingle();
      return (
        data ?? {
          imobiliaria_id: uid!,
          enabled_app: true,
          enabled_whatsapp: true,
          score_min_alerta: 75,
          niveis_monitorados: ["morno", "quente", "fervendo"],
          only_on_upgrade: true,
          whatsapp_grupo_numero: "",
        }
      );
    },
  });

  const [form, setForm] = useState<any>(null);
  useEffect(() => {
    if (cfg && !form) setForm(cfg);
  }, [cfg, form]);

  const saveCfg = useMutation({
    mutationFn: async (payload: any) => {
      const { error } = await supabase
        .from("alertas_captacao_config")
        .upsert({ ...payload, imobiliaria_id: uid });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configuração salva");
      qc.invalidateQueries({ queryKey: ["alertas-captacao-config", uid] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  const { data: alertas = [] } = useQuery({
    queryKey: ["alertas-captacao-log", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data } = await supabase
        .from("alertas_captacao_log")
        .select("*")
        .eq("imobiliaria_id", uid!)
        .order("created_at", { ascending: false })
        .limit(50);
      return (data ?? []) as AlertaLog[];
    },
  });

  // Realtime: novo alerta -> toast + refresh
  useEffect(() => {
    if (!uid) return;
    const ch = supabase
      .channel("alertas_captacao_log_rt")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "alertas_captacao_log",
          filter: `imobiliaria_id=eq.${uid}`,
        },
        (payload) => {
          const a = payload.new as AlertaLog;
          toast(
            a.tipo_evento === "upgrade_nivel"
              ? `🔥 ${a.proprietario_nome} → ${a.nivel_novo?.toUpperCase()}`
              : `🎯 Score ${a.score_novo} — ${a.proprietario_nome}`,
            {
              description: a.detalhes?.cidade
                ? `${a.detalhes?.bairro ?? ""} ${a.detalhes?.cidade}`
                : undefined,
              action: a.link
                ? { label: "Abrir", onClick: () => (window.location.href = a.link!) }
                : undefined,
              duration: 10000,
            }
          );
          qc.invalidateQueries({ queryKey: ["alertas-captacao-log", uid] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [uid, qc]);

  if (!form) return null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" /> Configuração de Alertas em Tempo Real
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label>Alertas in-app</Label>
              <p className="text-xs text-muted-foreground">
                Banner + centro de notificações
              </p>
            </div>
            <Switch
              checked={form.enabled_app}
              onCheckedChange={(v) => setForm({ ...form, enabled_app: v })}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label>Alertas WhatsApp</Label>
              <p className="text-xs text-muted-foreground">
                Corretor responsável + grupo central
              </p>
            </div>
            <Switch
              checked={form.enabled_whatsapp}
              onCheckedChange={(v) => setForm({ ...form, enabled_whatsapp: v })}
            />
          </div>
          <div>
            <Label>Score mínimo para alerta</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={form.score_min_alerta}
              onChange={(e) =>
                setForm({ ...form, score_min_alerta: Number(e.target.value) })
              }
            />
          </div>
          <div>
            <Label>Nº do grupo WhatsApp central</Label>
            <Input
              placeholder="Ex: 5561999998888 ou ID do grupo"
              value={form.whatsapp_grupo_numero ?? ""}
              onChange={(e) =>
                setForm({ ...form, whatsapp_grupo_numero: e.target.value })
              }
            />
          </div>
          <div className="md:col-span-2">
            <Label className="mb-2 block">Níveis monitorados</Label>
            <div className="flex flex-wrap gap-2">
              {NIVEIS.map((n) => {
                const active = form.niveis_monitorados?.includes(n);
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => {
                      const set = new Set<string>(form.niveis_monitorados ?? []);
                      if (set.has(n)) set.delete(n);
                      else set.add(n);
                      setForm({ ...form, niveis_monitorados: [...set] });
                    }}
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${
                      active
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground"
                    }`}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3 md:col-span-2">
            <div>
              <Label>Somente em upgrade</Label>
              <p className="text-xs text-muted-foreground">
                Dispara apenas quando o nível ou score SUBIR (recomendado)
              </p>
            </div>
            <Switch
              checked={form.only_on_upgrade}
              onCheckedChange={(v) => setForm({ ...form, only_on_upgrade: v })}
            />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <Button
              onClick={() => saveCfg.mutate(form)}
              disabled={saveCfg.isPending}
            >
              {saveCfg.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-orange-500" /> Últimos alertas disparados
          </CardTitle>
        </CardHeader>
        <CardContent>
          {alertas.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nenhum alerta ainda. Quando um proprietário mudar de nível ou
              atingir o score configurado, o alerta aparece aqui em tempo real.
            </p>
          ) : (
            <div className="space-y-2">
              {alertas.map((a) => (
                <div
                  key={a.id}
                  className="flex items-start justify-between gap-3 rounded-lg border p-3 hover:bg-muted/40"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {a.tipo_evento === "upgrade_nivel" ? (
                        <Badge className="bg-orange-500 text-white">
                          <Flame className="h-3 w-3 mr-1" /> Alteração de Prioridade
                        </Badge>
                      ) : (
                        <Badge className="bg-blue-600 text-white">
                          <Target className="h-3 w-3 mr-1" /> Score atingido
                        </Badge>
                      )}
                      <span className="font-medium">
                        {a.proprietario_nome ?? "Proprietário"}
                      </span>
                      {a.imovel_ref && (
                        <span className="text-xs text-muted-foreground">
                          Ref: {a.imovel_ref}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Nível: <b>{a.nivel_novo?.toUpperCase()}</b>
                      {a.nivel_anterior && ` (antes ${a.nivel_anterior})`}
                      {" · "}
                      Score: <b>{a.score_novo}</b>
                      {a.score_anterior != null && ` (antes ${a.score_anterior})`}
                      {" · "}
                      {formatDistanceToNow(new Date(a.created_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </div>
                    <div className="text-xs mt-1 flex gap-2">
                      <span
                        className={
                          a.delivered_app
                            ? "text-emerald-600"
                            : "text-muted-foreground"
                        }
                      >
                        App: {a.delivered_app ? "✓" : "—"}
                      </span>
                      <span
                        className={
                          a.delivered_whatsapp
                            ? "text-emerald-600"
                            : a.whatsapp_error
                            ? "text-red-600"
                            : "text-muted-foreground"
                        }
                        title={a.whatsapp_error ?? undefined}
                      >
                        WhatsApp: {a.delivered_whatsapp ? "✓" : a.whatsapp_error ? "erro" : "—"}
                      </span>
                    </div>
                  </div>
                  {a.link && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => (window.location.href = a.link!)}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
