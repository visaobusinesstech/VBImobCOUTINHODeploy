import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface FilaItem {
  id: string;
  imobiliaria_id: string;
  source: string;
  source_ref: string | null;
  ai_score: number;
  payload: any;
  status: "pending" | "assigned" | "closed" | "skipped";
  corretor_id: string | null;
  assigned_at: string | null;
  closed_at: string | null;
  created_at: string;
  corretor?: { nome: string } | null;
}

export interface CorretorCap {
  corretor_id: string;
  nome: string;
  status: string;
  limite: number;
  ativos: number;
  capacidade_livre: number;
}

export function useFilaDistribuicao(status: "pending" | "assigned" | "all" = "pending") {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["fila-distribuicao", user?.id, status],
    enabled: !!user?.id,
    queryFn: async (): Promise<FilaItem[]> => {
      let q = supabase
        .from("lead_distribution_queue")
        .select("*, corretor:corretores(nome)")
        .eq("imobiliaria_id", user!.id)
        .order("ai_score", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(500);
      if (status !== "all") q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as FilaItem[];
    },
    refetchInterval: 30000,
  });
}

export function useCorretoresCap() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["corretores-cap", user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<CorretorCap[]> => {
      const { data, error } = await supabase.rpc("leads_ativos_por_corretor", {
        _imobiliaria_id: user!.id,
      });
      if (error) throw error;
      return (data ?? []) as unknown as CorretorCap[];
    },
    refetchInterval: 30000,
  });
}

export function useDistribuirFila() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("distribuir-fila-leads", {
        body: { imobiliaria_id: user!.id },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (d: any) => {
      const r = d?.relatorio?.[0]?.resultado;
      toast({
        title: "Distribuição executada",
        description: r
          ? `${r.atribuidos} atribuído(s), ${r.restantes} na fila${r.sem_corretor_elegivel ? " — sem capacidade livre." : "."}`
          : "Concluído.",
      });
      qc.invalidateQueries({ queryKey: ["fila-distribuicao"] });
      qc.invalidateQueries({ queryKey: ["corretores-cap"] });
    },
    onError: (e: any) => toast({ title: "Falha", description: e?.message ?? "Erro", variant: "destructive" }),
  });
}

export function useSetLimiteCorretor() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ corretor_id, limite }: { corretor_id: string; limite: number }) => {
      const { error } = await supabase.from("corretores")
        .update({ limite_leads: Math.max(0, Math.floor(limite)) })
        .eq("id", corretor_id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["corretores-cap"] });
      toast({ title: "Limite atualizado" });
    },
    onError: (e: any) => toast({ title: "Falha", description: e?.message, variant: "destructive" }),
  });
}

export function useEncerrarLeadFila() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lead_distribution_queue")
        .update({ status: "closed", closed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fila-distribuicao"] });
      qc.invalidateQueries({ queryKey: ["corretores-cap"] });
      toast({ title: "Lead encerrado — capacidade liberada" });
    },
    onError: (e: any) => toast({ title: "Falha", description: e?.message, variant: "destructive" }),
  });
}
