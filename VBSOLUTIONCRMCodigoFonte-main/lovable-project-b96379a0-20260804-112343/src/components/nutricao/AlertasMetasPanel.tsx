import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, Bell, CheckCircle2, RefreshCw, Save, Trash2 } from "lucide-react";
import type { NutricaoFluxo } from "@/hooks/useNutricao";
import {
  META_CONFIG_PADRAO,
  useNutricaoMetas,
  type NutricaoMetaConfig,
} from "@/hooks/useNutricaoMetas";

interface Props {
  fluxos: NutricaoFluxo[];
}

const GLOBAL = "__global__";

export function AlertasMetasPanel({ fluxos }: Props) {
  const {
    configs,
    alertas,
    loading,
    verificando,
    salvarConfig,
    removerConfig,
    resolverAlerta,
    verificarAgora,
  } = useNutricaoMetas();

  const [alvo, setAlvo] = useState<string>(GLOBAL);
  const [form, setForm] = useState<NutricaoMetaConfig>(META_CONFIG_PADRAO);
  const [mostrarResolvidos, setMostrarResolvidos] = useState(false);

  const configAtual = useMemo(
    () => configs.find((c) => (c.fluxo_id ?? GLOBAL) === alvo),
    [configs, alvo],
  );

  useEffect(() => {
    setForm({
      ...META_CONFIG_PADRAO,
      ...(configAtual ?? {}),
      fluxo_id: alvo === GLOBAL ? null : alvo,
    });
  }, [configAtual, alvo]);

  const set = <K extends keyof NutricaoMetaConfig>(k: K, v: NutricaoMetaConfig[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const num = (k: keyof NutricaoMetaConfig, label: string, sufixo?: string) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="relative">
        <Input
          type="number"
          inputMode="decimal"
          min={0}
          value={String(form[k] ?? "")}
          onChange={(e) => set(k, Number(e.target.value) as never)}
          className={sufixo ? "pr-10" : ""}
        />
        {sufixo && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {sufixo}
          </span>
        )}
      </div>
    </div>
  );

  const alertasVisiveis = alertas.filter((a) => (mostrarResolvidos ? true : !a.resolvido));
  const abertos = alertas.filter((a) => !a.resolvido);
  const criticos = abertos.filter((a) => a.severidade === "critico");

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div>
              <p className="text-2xl font-semibold">{abertos.length}</p>
              <p className="text-xs text-muted-foreground">Alertas em aberto</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Bell className="h-5 w-5 text-primary" />
            <div>
              <p className="text-2xl font-semibold">{criticos.length}</p>
              <p className="text-xs text-muted-foreground">Críticos (zero resultado)</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            <div>
              <p className="text-2xl font-semibold">{configs.length}</p>
              <p className="text-xs text-muted-foreground">Configurações de meta</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Metas e regras de alerta</CardTitle>
          <CardDescription>
            Defina limites gerais ou específicos por fluxo. Abaixo da meta, o sistema gera alerta e
            notificação automática.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={alvo} onValueChange={setAlvo}>
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={GLOBAL}>Padrão para todos os fluxos</SelectItem>
                {fluxos.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {configAtual?.id && alvo !== GLOBAL && (
              <Button variant="ghost" size="sm" onClick={() => removerConfig(configAtual.id!)}>
                <Trash2 className="mr-1 h-4 w-4" /> Usar padrão
              </Button>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {num("meta_abertura", "Meta de abertura", "%")}
            {num("meta_resposta", "Meta de resposta", "%")}
            {num("meta_agendamento", "Meta de agendamento", "%")}
            {num("meta_fechamento", "Meta de fechamento", "%")}
            {num("janela_dias", "Janela de análise", "dias")}
            {num("min_envios", "Mínimo de mensagens")}
            {num("frequencia_horas", "Repetir aviso a cada", "h")}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Alertar quando zero agendamento</p>
                <p className="text-xs text-muted-foreground">Aviso crítico se nada for agendado.</p>
              </div>
              <Switch
                checked={form.alertar_zero_agendamento}
                onCheckedChange={(v) => set("alertar_zero_agendamento", v)}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Alertar quando zero resposta</p>
                <p className="text-xs text-muted-foreground">Aviso crítico se ninguém responder.</p>
              </div>
              <Switch
                checked={form.alertar_zero_resposta}
                onCheckedChange={(v) => set("alertar_zero_resposta", v)}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Notificar no app</p>
                <p className="text-xs text-muted-foreground">Envia para o sino de notificações.</p>
              </div>
              <Switch checked={form.notificar_app} onCheckedChange={(v) => set("notificar_app", v)} />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Monitoramento ativo</p>
                <p className="text-xs text-muted-foreground">Desligue para pausar os alertas.</p>
              </div>
              <Switch checked={form.ativo} onCheckedChange={(v) => set("ativo", v)} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => salvarConfig(form)} disabled={loading}>
              <Save className="mr-2 h-4 w-4" /> Salvar metas
            </Button>
            <Button variant="outline" onClick={verificarAgora} disabled={verificando}>
              <RefreshCw className={`mr-2 h-4 w-4 ${verificando ? "animate-spin" : ""}`} />
              Verificar agora
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base">Alertas gerados</CardTitle>
            <CardDescription>Fluxos que ficaram abaixo das metas definidas.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs">Mostrar resolvidos</Label>
            <Switch checked={mostrarResolvidos} onCheckedChange={setMostrarResolvidos} />
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {alertasVisiveis.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhum alerta {mostrarResolvidos ? "registrado" : "em aberto"}.
            </p>
          )}
          {alertasVisiveis.map((a) => (
            <div
              key={a.id}
              className="flex flex-wrap items-start justify-between gap-2 rounded-md border p-3"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={a.severidade === "critico" ? "destructive" : "secondary"}>
                    {a.severidade === "critico" ? "Crítico" : "Abaixo da meta"}
                  </Badge>
                  {a.metrica && <Badge variant="outline">{a.metrica}</Badge>}
                  {a.resolvido && <Badge variant="outline">Resolvido</Badge>}
                </div>
                <p className="text-sm">{a.mensagem}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(a.created_at).toLocaleString("pt-BR")}
                  {a.valor != null && a.meta != null
                    ? ` · ${Number(a.valor).toFixed(1)}% de ${Number(a.meta).toFixed(1)}%`
                    : ""}
                  {a.envios != null ? ` · ${a.envios} mensagens` : ""}
                </p>
              </div>
              <Button
                size="sm"
                variant={a.resolvido ? "ghost" : "outline"}
                onClick={() => resolverAlerta(a.id, !a.resolvido)}
              >
                {a.resolvido ? "Reabrir" : "Marcar resolvido"}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
