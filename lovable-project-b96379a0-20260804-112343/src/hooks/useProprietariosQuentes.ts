import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export type NivelMotivacao = "frio" | "morno" | "quente" | "fervendo";

export interface ProprietarioQuente {
  id: string;
  nome_proprietario: string;
  telefone: string | null;
  email: string | null;
  cidade: string | null;
  bairro: string | null;
  titulo_imovel: string | null;
  operacao: string | null;
  preco: number | null;
  ultimo_preco: number | null;
  origem: string | null;
  url_anuncio: string | null;
  motivacao_score: number;
  motivacao_nivel: NivelMotivacao;
  motivacao_sinais: {
    dias_no_mercado?: number;
    queda_pct?: number;
    republicacoes?: number;
    fsbo?: boolean;
    bonus?: Record<string, number>;
  };
  primeiro_visto_em: string | null;
  ultimo_visto_em: string | null;
  historico_precos: Array<{ preco: number; em: string }>;
  status_revisao?: string | null;
}

export function useProprietariosQuentes(nivelMinimo: NivelMotivacao = "morno") {
  const { user } = useAuth();
  const scoreMin =
    nivelMinimo === "fervendo" ? 75 : nivelMinimo === "quente" ? 50 : nivelMinimo === "morno" ? 25 : 0;

  return useQuery({
    queryKey: ["proprietarios-quentes", user?.id, nivelMinimo],
    enabled: !!user?.id,
    queryFn: async (): Promise<ProprietarioQuente[]> => {
      const { data, error } = await supabase
        .from("lista_proprietarios_captacao")
        .select(
          "id,nome_proprietario,telefone,email,cidade,bairro,titulo_imovel,operacao,preco,ultimo_preco,origem,url_anuncio,motivacao_score,motivacao_nivel,motivacao_sinais,primeiro_visto_em,ultimo_visto_em,historico_precos,status_revisao"
        )
        .eq("imobiliaria_id", user!.id)
        .gte("motivacao_score", scoreMin)
        .order("motivacao_score", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as ProprietarioQuente[];
    },
  });
}

export function useRecalcularMotivacao() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("recalcular_motivacao_proprietarios", {
        _imobiliaria_id: user!.id,
      });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (n) => {
      toast({ title: "Score atualizado", description: `${n} proprietários reprocessados.` });
      qc.invalidateQueries({ queryKey: ["proprietarios-quentes"] });
    },
    onError: (e: any) =>
      toast({ title: "Erro ao recalcular", description: e?.message ?? "Falha", variant: "destructive" }),
  });
}
