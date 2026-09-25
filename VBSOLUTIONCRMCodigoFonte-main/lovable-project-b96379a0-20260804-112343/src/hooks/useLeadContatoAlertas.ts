import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Lead } from "@/hooks/useLeads";
import type { Followup } from "@/hooks/useFollowups";
import {
  classifyLeadContato,
  ESTAGIOS_INATIVOS_CONTATO,
} from "@/components/pipeline/LeadsContatoPanel";

interface Params {
  leads: Lead[];
  followups: Followup[];
  slaPrimeiroContatoHoras: number;
  slaRecontatoDias: number;
  /** Aviso quando um lead em "A contatar" está a X horas de virar Atrasado. */
  avisoAntecipadoHoras?: number;
  enabled?: boolean;
}

type Estado = "atrasado" | "prestes";

const storageKey = (userId: string) => `lead-contato-alertas:${userId}`;

function loadNotified(userId: string): Record<string, Estado> {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    // Reseta a cada novo dia para permitir re-alerta diário
    if (parsed?.dia !== new Date().toDateString()) return {};
    return parsed.map ?? {};
  } catch {
    return {};
  }
}

function saveNotified(userId: string, map: Record<string, Estado>) {
  try {
    localStorage.setItem(
      storageKey(userId),
      JSON.stringify({ dia: new Date().toDateString(), map }),
    );
  } catch {
    /* ignore */
  }
}

/**
 * Detecta transições de leads para o bucket "Atrasados" (ou prestes a atrasar)
 * e dispara toast + notificação persistida para o usuário atual.
 *
 * Idempotente por dia: cada lead alerta no máximo 1x por estado por dia,
 * usando localStorage como memória.
 */
export function useLeadContatoAlertas({
  leads,
  followups,
  slaPrimeiroContatoHoras,
  slaRecontatoDias,
  avisoAntecipadoHoras = 4,
  enabled = true,
}: Params) {
  const { user } = useAuth();
  const inFlight = useRef(false);

  useEffect(() => {
    if (!enabled || !user || leads.length === 0) return;
    if (inFlight.current) return;
    inFlight.current = true;

    const run = async () => {
      const now = new Date();
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const pendentesPorLead = new Map<string, Followup[]>();
      const concluidosPorLead = new Map<string, Followup[]>();
      followups.forEach((f) => {
        if (!f.lead_id) return;
        const bucket =
          f.status === "concluido" ? concluidosPorLead : pendentesPorLead;
        const arr = bucket.get(f.lead_id) ?? [];
        arr.push(f);
        bucket.set(f.lead_id, arr);
      });

      const notified = loadNotified(user.id);
      const novosAtrasados: Array<{ lead: Lead; motivo: string }> = [];
      const novosPrestes: Array<{ lead: Lead; motivo: string }> = [];

      leads.forEach((lead) => {
        if (ESTAGIOS_INATIVOS_CONTATO.has(lead.estagio)) return;

        const status = classifyLeadContato(
          lead,
          pendentesPorLead.get(lead.id) ?? [],
          concluidosPorLead.get(lead.id) ?? [],
          slaPrimeiroContatoHoras,
          slaRecontatoDias,
          today,
          now,
        );

        if (status.bucket === "atrasados") {
          if (notified[lead.id] !== "atrasado") {
            notified[lead.id] = "atrasado";
            novosAtrasados.push({ lead, motivo: status.motivo });
          }
          return;
        }

        // Prestes a atrasar: "A contatar" sem contato há mais do que
        // (SLA primeiro contato - avisoAntecipadoHoras)
        if (
          status.bucket === "a_contatar" &&
          status.totalContatos === 0 &&
          status.horasDesdeCriacao >=
            Math.max(0, slaPrimeiroContatoHoras - avisoAntecipadoHoras) &&
          status.horasDesdeCriacao < slaPrimeiroContatoHoras
        ) {
          if (!notified[lead.id]) {
            notified[lead.id] = "prestes";
            const restante = Math.max(
              1,
              Math.ceil(slaPrimeiroContatoHoras - status.horasDesdeCriacao),
            );
            novosPrestes.push({
              lead,
              motivo: `Prazo estoura em ~${restante}h`,
            });
          }
        }
      });

      if (novosAtrasados.length === 0 && novosPrestes.length === 0) {
        inFlight.current = false;
        return;
      }

      if (novosAtrasados.length > 0) {
        const first = novosAtrasados[0];
        const extra = novosAtrasados.length - 1;
        toast.error(
          extra > 0
            ? `⚠️ ${novosAtrasados.length} leads atrasados no CRM`
            : `⚠️ Lead atrasado: ${first.lead.nome}`,
          {
            description:
              extra > 0
                ? `${first.lead.nome} e mais ${extra}. Abra o CRM → Contatos.`
                : first.motivo,
            duration: 8000,
          },
        );
      }

      if (novosPrestes.length > 0) {
        const first = novosPrestes[0];
        const extra = novosPrestes.length - 1;
        toast.warning(
          extra > 0
            ? `⏰ ${novosPrestes.length} leads prestes a atrasar`
            : `⏰ ${first.lead.nome} está prestes a atrasar`,
          {
            description: extra > 0 ? `${first.lead.nome} e mais ${extra}.` : first.motivo,
            duration: 6000,
          },
        );
      }

      saveNotified(user.id, notified);

      // Persistir notificações agregadas (não bloqueia UI se falhar).
      // Antes era criada 1 linha por lead atrasado; em bases grandes isso podia
      // disparar centenas de INSERTs + eventos realtime de uma vez e travar a UI.
      const rows = [
        novosAtrasados.length > 0
          ? {
              user_id: user.id,
              title:
                novosAtrasados.length > 1
                  ? `⚠️ ${novosAtrasados.length} leads atrasados no CRM`
                  : `⚠️ Lead atrasado — ${novosAtrasados[0].lead.nome}`,
              description:
                novosAtrasados.length > 1
                  ? `${novosAtrasados[0].lead.nome} e mais ${novosAtrasados.length - 1}. Abra o CRM → Contatos.`
                  : novosAtrasados[0].motivo,
            }
          : null,
        novosPrestes.length > 0
          ? {
              user_id: user.id,
              title:
                novosPrestes.length > 1
                  ? `⏰ ${novosPrestes.length} leads prestes a atrasar`
                  : `⏰ Lead prestes a atrasar — ${novosPrestes[0].lead.nome}`,
              description:
                novosPrestes.length > 1
                  ? `${novosPrestes[0].lead.nome} e mais ${novosPrestes.length - 1}.`
                  : novosPrestes[0].motivo,
            }
          : null,
      ].filter(Boolean);
      if (rows.length > 0) {
        try {
          await supabase.from("notifications").insert(rows as any[]);
        } catch {
          /* silencioso */
        }
      }

      inFlight.current = false;
    };

    run().catch(() => {
      inFlight.current = false;
    });
  }, [
    enabled,
    user,
    leads,
    followups,
    slaPrimeiroContatoHoras,
    slaRecontatoDias,
    avisoAntecipadoHoras,
  ]);
}
