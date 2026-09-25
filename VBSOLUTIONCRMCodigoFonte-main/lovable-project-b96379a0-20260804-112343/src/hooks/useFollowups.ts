import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useCurrentCorretor } from "@/hooks/useCurrentCorretor";
import { parseISO, isToday, isPast } from "date-fns";

export interface Followup {
  id: string;
  imobiliaria_id: string;
  lead_id: string | null;
  contrato_id: string | null;
  data_followup: string;
  tipo: string;
  descricao: string | null;
  resultado: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  // Lead-related enrichment
  lead_nome?: string;
  lead_telefone?: string | null;
  lead_email?: string | null;
  lead_estagio?: string | null;
  // Contrato-related enrichment
  contrato_titulo?: string | null;
  contrato_status?: string | null;
  contrato_cliente?: string | null;
  contrato_tipo?: string | null;
}

export const LEAD_INATIVO_ESTAGIOS = ["fechado", "perdido", "descartado", "inativo"];
export const CONTRATO_INATIVO_STATUS = ["inativo", "cancelado", "encerrado", "finalizado", "distratado"];

export const isLeadInativo = (estagio?: string | null) =>
  !!estagio && LEAD_INATIVO_ESTAGIOS.includes(estagio.toLowerCase());
export const isContratoInativo = (status?: string | null) =>
  !!status && CONTRATO_INATIVO_STATUS.includes(status.toLowerCase());

/** Determines if a followup target (lead OR contract) is inactive and therefore should not push the pending counters. */
export const isFollowupAlvoInativo = (f: Pick<Followup, "lead_id" | "contrato_id" | "lead_estagio" | "contrato_status">) => {
  if (f.contrato_id) return isContratoInativo(f.contrato_status);
  if (f.lead_id) return isLeadInativo(f.lead_estagio);
  return true; // orphan followup (no target)
};

export function useFollowups() {
  const { user, imobiliariaId } = useAuth();
  const { corretorId, isBroker, ready: corretorReady } = useCurrentCorretor();
  const { toast } = useToast();
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFollowups = useCallback(async () => {
    if (!user || !corretorReady) return;
    setFollowups(prev => {
      if (prev.length === 0) setLoading(true);
      return prev;
    });
    const { data, error } = await supabase
      .from("followups")
      .select("*, leads(nome, telefone, email, estagio, corretor_id), contratos(titulo, status, cliente, tipo, corretor_id)")
      .order("data_followup", { ascending: true });

    if (error) {
      toast({ title: "Erro ao carregar follow-ups", description: error.message, variant: "destructive" });
    } else {
      let rows = (data ?? []) as any[];
      if (isBroker && corretorId) {
        rows = rows.filter((d: any) => {
          const leadCorr = d.leads?.corretor_id ?? null;
          const contratoCorr = d.contratos?.corretor_id ?? null;
          return leadCorr === corretorId || contratoCorr === corretorId;
        });
      }
      setFollowups(
        rows.map((d: any) => ({
          ...d,
          lead_nome: d.leads?.nome ?? (d.lead_id ? "Lead removido" : null),
          lead_telefone: d.leads?.telefone ?? null,
          lead_email: d.leads?.email ?? null,
          lead_estagio: d.leads?.estagio ?? null,
          contrato_titulo: d.contratos?.titulo ?? (d.contrato_id ? "Contrato removido" : null),
          contrato_status: d.contratos?.status ?? null,
          contrato_cliente: d.contratos?.cliente ?? null,
          contrato_tipo: d.contratos?.tipo ?? null,
        }))
      );
    }
    setLoading(false);
  }, [user, corretorReady, isBroker, corretorId, toast]);

  /** Locally patch followups to power optimistic UI. Reverted / confirmed on next refetch. */
  const patchFollowups = useCallback((updater: (prev: Followup[]) => Followup[]) => {
    setFollowups(updater);
  }, []);

  useEffect(() => {
    fetchFollowups();
  }, [fetchFollowups]);

  useEffect(() => {
    if (!user || !imobiliariaId) return;
    let debounceTimer: ReturnType<typeof setTimeout>;
    const channel = supabase
      .channel(`followups-realtime:${imobiliariaId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "followups", filter: `imobiliaria_id=eq.${imobiliariaId}` }, () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          if (document.visibilityState === "visible") fetchFollowups();
        }, 700);
      })
      .subscribe();
    return () => {
      clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [user, imobiliariaId, fetchFollowups]);

  const createFollowup = async (data: {
    lead_id?: string | null;
    contrato_id?: string | null;
    data_followup: string;
    tipo: string;
    descricao?: string;
  }) => {
    if (!user) return null;

    if (!data.lead_id && !data.contrato_id) {
      toast({ title: "Selecione um lead ou contrato para o follow-up.", variant: "destructive" });
      return null;
    }

    let targetImobiliariaId = imobiliariaId;
    if (!targetImobiliariaId) {
      const { data: authData } = await supabase.rpc("get_master_user_id");
      targetImobiliariaId = authData ?? null;
    }

    if (!targetImobiliariaId) {
      toast({ title: "Erro ao criar follow-up", description: "Não foi possível identificar a imobiliária.", variant: "destructive" });
      return null;
    }

    const { data: result, error } = await supabase
      .from("followups")
      .insert({
        lead_id: data.lead_id ?? null,
        contrato_id: data.contrato_id ?? null,
        data_followup: data.data_followup,
        tipo: data.tipo,
        descricao: data.descricao ?? null,
        imobiliaria_id: targetImobiliariaId,
      } as any)
      .select()
      .single();

    if (error) {
      toast({ title: "Erro ao criar follow-up", description: error.message, variant: "destructive" });
      return null;
    }

    if (data.lead_id) {
      await supabase.from("lead_atividades").insert({
        lead_id: data.lead_id,
        imobiliaria_id: targetImobiliariaId,
        tipo: "followup",
        titulo: "Follow-up agendado",
        descricao: `${data.tipo.charAt(0).toUpperCase() + data.tipo.slice(1)} para o dia ${new Date(data.data_followup).toLocaleDateString("pt-BR")}`,
      });
    }

    toast({ title: "Follow-up agendado!" });
    await fetchFollowups();
    return result;
  };

  const updateFollowup = async (id: string, updates: Partial<Followup>) => {
    // Optimistic update — patch local state immediately.
    const snapshot = followups;
    setFollowups(prev => prev.map(f => f.id === id ? { ...f, ...updates } as Followup : f));

    const { error } = await supabase.from("followups").update(updates as any).eq("id", id);
    if (error) {
      // Rollback
      setFollowups(snapshot);
      toast({ title: "Erro ao atualizar follow-up", description: error.message, variant: "destructive" });
      return false;
    }

    if (updates.status === "concluido") {
      const f = snapshot.find(item => item.id === id);
      if (f?.lead_id) {
        await supabase.from("lead_atividades").insert({
          lead_id: f.lead_id,
          imobiliaria_id: imobiliariaId,
          tipo: "followup",
          titulo: "Follow-up concluído",
          descricao: `Resultado: ${updates.resultado || "Concluído com sucesso"}`,
        });
      }
    }

    await fetchFollowups();
    return true;
  };

  const deleteFollowup = async (id: string) => {
    const snapshot = followups;
    setFollowups(prev => prev.filter(f => f.id !== id));
    const { error } = await supabase.from("followups").delete().eq("id", id);
    if (error) {
      setFollowups(snapshot);
      toast({ title: "Erro ao excluir follow-up", description: error.message, variant: "destructive" });
      return false;
    }
    toast({ title: "Follow-up removido!" });
    await fetchFollowups();
    return true;
  };

  /** Auto-conclude followups whose lead OR contract is inactive/closed. */
  const concluirFollowupsInativos = async () => {
    const orfaos = followups.filter(f => f.status === "pendente" && isFollowupAlvoInativo(f));
    if (orfaos.length === 0) {
      toast({ title: "Nenhum follow-up pendente de alvo inativo encontrado." });
      return 0;
    }
    const ids = orfaos.map(o => o.id);
    const snapshot = followups;
    // Optimistic: mark them concluded locally right away.
    setFollowups(prev => prev.map(f => ids.includes(f.id)
      ? { ...f, status: "concluido", resultado: "Encerrado automaticamente (lead/contrato inativo)" }
      : f
    ));
    const { error } = await supabase
      .from("followups")
      .update({ status: "concluido", resultado: "Encerrado automaticamente (lead/contrato inativo)" } as any)
      .in("id", ids);
    if (error) {
      setFollowups(snapshot);
      toast({ title: "Erro ao concluir follow-ups", description: error.message, variant: "destructive" });
      return 0;
    }
    toast({ title: `${orfaos.length} follow-up(s) de alvos inativos foram encerrados.` });
    await fetchFollowups();
    return orfaos.length;
  };

  const pendentes = followups.filter(f => f.status === "pendente" && !isFollowupAlvoInativo(f));
  const atrasados = pendentes.filter(f => {
    const d = parseISO(f.data_followup);
    return isPast(d) && !isToday(d);
  });
  const hoje = pendentes.filter(f => isToday(parseISO(f.data_followup)));

  return { followups, loading, pendentes, atrasados, hoje, createFollowup, updateFollowup, deleteFollowup, concluirFollowupsInativos, patchFollowups, refetch: fetchFollowups };
}
