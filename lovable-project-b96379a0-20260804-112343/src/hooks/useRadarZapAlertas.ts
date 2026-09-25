import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export type RadarZapAlertasConfig = {
  enabled: boolean;
  alertarErro: boolean;
  alertarLeadsAcima: boolean;
  limiteLeads: number;
  som: boolean;
  criarNotificacao: boolean;
};

export const DEFAULT_ALERTAS_CFG: RadarZapAlertasConfig = {
  enabled: true,
  alertarErro: true,
  alertarLeadsAcima: true,
  limiteLeads: 5,
  som: false,
  criarNotificacao: true,
};

export function cfgStorageKey(userId?: string) {
  return `radarzap-alertas-cfg-${userId ?? "anon"}`;
}

export function loadAlertasCfg(userId?: string): RadarZapAlertasConfig {
  try {
    const raw = localStorage.getItem(cfgStorageKey(userId));
    if (!raw) return DEFAULT_ALERTAS_CFG;
    return { ...DEFAULT_ALERTAS_CFG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_ALERTAS_CFG;
  }
}

export function saveAlertasCfg(userId: string | undefined, cfg: RadarZapAlertasConfig) {
  try {
    localStorage.setItem(cfgStorageKey(userId), JSON.stringify(cfg));
  } catch {
    /* noop */
  }
}

type ExecRow = {
  id: string;
  run_id: string;
  imobiliaria_id: string;
  cidades: string[] | null;
  termo: string | null;
  modo: string | null;
  retry_of_run_id: string | null;
  encontrados: number;
  inseridos: number;
  erros: unknown;
  created_at: string;
};

function beep() {
  try {
    const AC =
      (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
        .AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 880;
    o.type = "sine";
    g.gain.value = 0.08;
    o.connect(g).connect(ctx.destination);
    o.start();
    setTimeout(() => {
      o.stop();
      ctx.close();
    }, 180);
  } catch {
    /* noop */
  }
}

/**
 * Escuta em tempo real inserções em `radarzap_descoberta_execucoes` e dispara
 * alertas quando a execução termina com erro ou quando insere leads acima do
 * limite configurado. Também pode gravar uma notificação persistente.
 */
export function useRadarZapAlertas() {
  const { user, isMaster } = useAuth();
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`radarzap-alertas-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "radarzap_descoberta_execucoes",
          filter: isMaster ? undefined : `imobiliaria_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as ExecRow;
          if (!row?.id || seen.current.has(row.id)) return;
          seen.current.add(row.id);

          const cfg = loadAlertasCfg(user.id);
          if (!cfg.enabled) return;

          const errosArr = Array.isArray(row.erros) ? (row.erros as unknown[]) : [];
          const isRetry = row.modo === "retry_erros" || !!row.retry_of_run_id;
          const rotulo = isRetry ? "Reexecução" : "Descoberta";
          const runShort = row.run_id?.slice(0, 8) ?? "";
          const cidade = row.cidades?.[0] ?? row.termo ?? "";
          const contexto = [rotulo, cidade, `run ${runShort}`].filter(Boolean).join(" · ");

          const houveErro = errosArr.length > 0 && row.encontrados === 0;
          const acimaLimite =
            cfg.alertarLeadsAcima && row.inseridos >= Math.max(1, cfg.limiteLeads);

          if (houveErro && cfg.alertarErro) {
            if (cfg.som) beep();
            toast.error(`${rotulo} falhou`, {
              description: `${contexto} — ${errosArr.length} erro(s), 0 grupos encontrados.`,
              duration: 8000,
            });
            if (cfg.criarNotificacao) {
              void supabase.from("notifications").insert({
                user_id: row.imobiliaria_id,
                title: `RadarZap: ${rotulo} com erro`,
                description: `${contexto} — ${errosArr.length} erro(s).`,
              } as never);
            }
          } else if (acimaLimite) {
            if (cfg.som) beep();
            toast.success(`Novos leads capturados`, {
              description: `${contexto} — ${row.inseridos} grupos inseridos (limite ≥ ${cfg.limiteLeads}).`,
              duration: 7000,
            });
            if (cfg.criarNotificacao) {
              void supabase.from("notifications").insert({
                user_id: row.imobiliaria_id,
                title: `RadarZap: ${row.inseridos} novos grupos`,
                description: `${contexto} — acima do limite (${cfg.limiteLeads}).`,
              } as never);
            }
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, isMaster]);
}
