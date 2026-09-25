import { useEffect, useState } from "react";
import { Bell, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import {
  DEFAULT_ALERTAS_CFG,
  loadAlertasCfg,
  saveAlertasCfg,
  type RadarZapAlertasConfig,
} from "@/hooks/useRadarZapAlertas";
import { toast } from "sonner";

export default function AlertasRealtimeConfigPopover() {
  const { user } = useAuth();
  const [cfg, setCfg] = useState<RadarZapAlertasConfig>(DEFAULT_ALERTAS_CFG);

  useEffect(() => {
    if (user?.id) setCfg(loadAlertasCfg(user.id));
  }, [user?.id]);

  const update = <K extends keyof RadarZapAlertasConfig>(
    k: K,
    v: RadarZapAlertasConfig[K],
  ) => {
    const next = { ...cfg, [k]: v };
    setCfg(next);
    saveAlertasCfg(user?.id, next);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          {cfg.enabled ? (
            <BellRing className="h-4 w-4 text-primary" />
          ) : (
            <Bell className="h-4 w-4 text-muted-foreground" />
          )}
          Alertas
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-3">
          <div>
            <div className="font-medium text-sm">Alertas em tempo real</div>
            <p className="text-xs text-muted-foreground">
              Notifica quando uma execução termina com erro ou gera leads acima do limite.
            </p>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <Label className="text-sm">Ativar alertas</Label>
            <Switch
              checked={cfg.enabled}
              onCheckedChange={(v) => update("enabled", v)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-sm">Falha (erro na execução)</Label>
            <Switch
              checked={cfg.alertarErro}
              disabled={!cfg.enabled}
              onCheckedChange={(v) => update("alertarErro", v)}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Leads acima do limite</Label>
              <Switch
                checked={cfg.alertarLeadsAcima}
                disabled={!cfg.enabled}
                onCheckedChange={(v) => update("alertarLeadsAcima", v)}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">
                Limite (grupos inseridos)
              </Label>
              <Input
                type="number"
                min={1}
                value={cfg.limiteLeads}
                disabled={!cfg.enabled || !cfg.alertarLeadsAcima}
                onChange={(e) =>
                  update("limiteLeads", Math.max(1, Number(e.target.value) || 1))
                }
              />
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <Label className="text-sm">Som ao alertar</Label>
            <Switch
              checked={cfg.som}
              disabled={!cfg.enabled}
              onCheckedChange={(v) => update("som", v)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-sm">Gravar notificação</Label>
            <Switch
              checked={cfg.criarNotificacao}
              disabled={!cfg.enabled}
              onCheckedChange={(v) => update("criarNotificacao", v)}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() =>
              toast.info("Alerta de teste", {
                description: "Assim aparecerá quando uma execução disparar.",
              })
            }
          >
            Enviar alerta de teste
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
