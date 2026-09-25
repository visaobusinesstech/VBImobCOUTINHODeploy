import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface MotivacaoConfig {
  imobiliaria_id: string;
  dias_tier1: number;
  dias_tier2: number;
  dias_tier3: number;
  bonus_tempo_tier1: number;
  bonus_tempo_tier2: number;
  bonus_tempo_tier3: number;
  queda_tier1: number;
  queda_tier2: number;
  bonus_queda_tier1: number;
  bonus_queda_tier2: number;
  bonus_republicacao: number;
  bonus_fsbo: number;
  nivel_morno_min: number;
  nivel_quente_min: number;
  nivel_fervendo_min: number;
}

export const MOTIVACAO_CONFIG_PADRAO: Omit<MotivacaoConfig, "imobiliaria_id"> = {
  dias_tier1: 60, dias_tier2: 90, dias_tier3: 180,
  bonus_tempo_tier1: 10, bonus_tempo_tier2: 25, bonus_tempo_tier3: 40,
  queda_tier1: 5, queda_tier2: 10,
  bonus_queda_tier1: 25, bonus_queda_tier2: 35,
  bonus_republicacao: 20, bonus_fsbo: 10,
  nivel_morno_min: 25, nivel_quente_min: 50, nivel_fervendo_min: 75,
};

export function useMotivacaoConfig() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["motivacao-config", user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<MotivacaoConfig> => {
      const { data, error } = await (supabase as any)
        .from("motivacao_config")
        .select("*")
        .eq("imobiliaria_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data ?? { imobiliaria_id: user!.id, ...MOTIVACAO_CONFIG_PADRAO }) as MotivacaoConfig;
    },
  });
}

export function useSalvarMotivacaoConfig() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (cfg: Partial<MotivacaoConfig>) => {
      const payload = { ...MOTIVACAO_CONFIG_PADRAO, ...cfg, imobiliaria_id: user!.id };
      const { error } = await (supabase as any)
        .from("motivacao_config")
        .upsert(payload, { onConflict: "imobiliaria_id" });
      if (error) throw error;
      const { data, error: rpcErr } = await supabase.rpc("recalcular_motivacao_proprietarios", {
        _imobiliaria_id: user!.id,
      });
      if (rpcErr) throw rpcErr;
      return data as number;
    },
    onSuccess: (n) => {
      toast({ title: "Critérios salvos", description: `${n} proprietários reprocessados com os novos parâmetros.` });
      qc.invalidateQueries({ queryKey: ["motivacao-config"] });
      qc.invalidateQueries({ queryKey: ["proprietarios-quentes"] });
    },
    onError: (e: any) =>
      toast({ title: "Erro ao salvar", description: e?.message ?? "Falha", variant: "destructive" }),
  });
}
