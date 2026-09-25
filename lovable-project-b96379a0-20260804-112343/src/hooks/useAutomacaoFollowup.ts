import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useEffect } from "react";

export type AutomacaoFollowupTipo = "transicao_etapa" | "agendamento_expirado";

export interface AutomacaoFollowupRegra {
  id: string;
  imobiliaria_id: string;
  ativo: boolean;
  tipo: AutomacaoFollowupTipo;
  estagio_origem: string | null;
  estagio_destino: string | null;
  acao_titulo: string;
  acao_descricao: string;
  prazo_tarefa_horas: number;
  escalonamento_horas: number;
  notificar_gerente: boolean;
  tipo_followup: string;
  created_at: string;
  updated_at: string;
}

export interface AutomacaoFollowupExecucao {
  id: string;
  imobiliaria_id: string;
  regra_id: string | null;
  tipo: string;
  lead_id: string | null;
  compromisso_id: string | null;
  followup_id: string | null;
  estagio_origem: string | null;
  estagio_destino: string | null;
  escalado: boolean;
  escalado_em: string | null;
  created_at: string;
}

const REGRAS = "automacao_followup_regras" as any;
const EXEC = "automacao_followup_execucoes" as any;

export function useAutomacaoFollowupRegras() {
  const { user, imobiliariaId } = useAuth();
  const qc = useQueryClient();
  const key = ["automacao_followup_regras", imobiliariaId ?? user?.id];

  const list = useQuery({
    queryKey: key,
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from(REGRAS).select("*").order("tipo").order("created_at");
      if (error) throw error;
      return (data ?? []) as AutomacaoFollowupRegra[];
    },
  });

  // Seed defaults on first load
  useEffect(() => {
    if (!user || !imobiliariaId) return;
    if (list.data && list.data.length === 0) {
      (supabase as any).rpc("seed_automacao_followup_defaults", { _imob: imobiliariaId })
        .then(() => qc.invalidateQueries({ queryKey: ["automacao_followup_regras"] }));
    }
  }, [list.data, user, imobiliariaId, qc]);

  const create = useMutation({
    mutationFn: async (input: Partial<AutomacaoFollowupRegra>) => {
      const { data, error } = await (supabase as any)
        .from(REGRAS)
        .insert({ ...input, imobiliaria_id: imobiliariaId ?? user?.id })
        .select("*").single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["automacao_followup_regras"] });
      toast.success("Regra criada");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao criar regra"),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...changes }: Partial<AutomacaoFollowupRegra> & { id: string }) => {
      const { data, error } = await (supabase as any).from(REGRAS).update(changes).eq("id", id).select("*").single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["automacao_followup_regras"] });
      toast.success("Regra atualizada");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao atualizar"),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await (supabase as any).from(REGRAS).update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automacao_followup_regras"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from(REGRAS).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["automacao_followup_regras"] });
      toast.success("Regra removida");
    },
  });

  return { list, create, update, toggle, remove };
}

export function useAutomacaoFollowupExecucoes(limit = 50) {
  return useQuery({
    queryKey: ["automacao_followup_execucoes", limit],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from(EXEC).select("*").order("created_at", { ascending: false }).limit(limit);
      if (error) throw error;
      return (data ?? []) as AutomacaoFollowupExecucao[];
    },
    refetchInterval: 60_000,
  });
}
