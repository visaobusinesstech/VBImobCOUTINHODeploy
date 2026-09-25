import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface ProspeccaoDiaria {
  id: string;
  imobiliaria_id: string;
  data: string;
  prospeccoes_aluguel: number;
  prospeccoes_venda: number;
  proprietarios_contatados: number;
  leads_conversados: number;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export function useProspeccaoDiaria() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: registros = [], isLoading } = useQuery({
    queryKey: ["prospeccao_diaria", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prospeccao_diaria" as any)
        .select("*")
        .eq("imobiliaria_id", user!.id)
        .order("data", { ascending: false })
        .limit(90);
      if (error) throw error;
      return (data || []) as unknown as ProspeccaoDiaria[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (values: {
      data: string;
      prospeccoes_aluguel: number;
      prospeccoes_venda: number;
      proprietarios_contatados: number;
      leads_conversados: number;
      observacoes?: string;
    }) => {
      const existing = registros.find((r) => r.data === values.data);
      if (existing) {
        const { error } = await supabase
          .from("prospeccao_diaria" as any)
          .update({
            prospeccoes_aluguel: values.prospeccoes_aluguel,
            prospeccoes_venda: values.prospeccoes_venda,
            proprietarios_contatados: values.proprietarios_contatados,
            leads_conversados: values.leads_conversados,
            observacoes: values.observacoes || null,
            updated_at: new Date().toISOString(),
          } as any)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("prospeccao_diaria" as any)
          .insert({
            imobiliaria_id: user!.id,
            data: values.data,
            prospeccoes_aluguel: values.prospeccoes_aluguel,
            prospeccoes_venda: values.prospeccoes_venda,
            proprietarios_contatados: values.proprietarios_contatados,
            leads_conversados: values.leads_conversados,
            observacoes: values.observacoes || null,
          } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prospeccao_diaria"] });
      toast.success("Prospecção salva com sucesso!");
    },
    onError: () => toast.error("Erro ao salvar prospecção"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("prospeccao_diaria" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prospeccao_diaria"] });
      toast.success("Registro removido");
    },
    onError: () => toast.error("Erro ao remover"),
  });

  return { registros, isLoading, upsert, remove };
}
