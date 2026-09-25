import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export type CandidatoAprovacao = {
  id: string;
  nome_proprietario: string;
  telefone: string | null;
  email: string | null;
  cidade: string | null;
  bairro: string | null;
  operacao: string;
  titulo_imovel: string | null;
  url_anuncio: string | null;
  preco: number | null;
  status_revisao: string;
  motivo_revisao: string | null;
  rejeitado_motivo: string | null;
  aprovado_em: string | null;
  revisado_em: string | null;
  created_at: string;
  imobiliaria_id: string;
};

export type FonteDado = {
  id: string;
  campo: string;
  valor_capturado: string | null;
  fonte_url: string;
  fonte_tipo: string;
  fonte_titulo: string | null;
  fonte_snippet: string | null;
  base_legal: string;
  coletado_em: string;
  ativo: boolean;
};

export function useCandidatosPendentes(status?: "pendente" | "em_revisao" | "aprovado" | "rejeitado") {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["captacao-aprovacao", user?.id, status ?? "pendente"],
    enabled: !!user,
    queryFn: async (): Promise<CandidatoAprovacao[]> => {
      let q = (supabase as any)
        .from("lista_proprietarios_captacao")
        .select("id,nome_proprietario,telefone,email,cidade,bairro,operacao,titulo_imovel,url_anuncio,preco,status_revisao,motivo_revisao,rejeitado_motivo,aprovado_em,revisado_em,created_at,imobiliaria_id")
        .order("created_at", { ascending: false })
        .limit(200);
      if (status) q = q.eq("status_revisao", status);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as CandidatoAprovacao[];
    },
  });
}

export function useFontesCandidato(candidatoId: string | null) {
  return useQuery({
    queryKey: ["captacao-fontes", candidatoId],
    enabled: !!candidatoId,
    queryFn: async (): Promise<FonteDado[]> => {
      const { data, error } = await (supabase as any)
        .from("captacao_fontes_dados")
        .select("id,campo,valor_capturado,fonte_url,fonte_tipo,fonte_titulo,fonte_snippet,base_legal,coletado_em,ativo")
        .eq("lead_tipo", "lista_proprietarios_captacao")
        .eq("lead_id", candidatoId)
        .eq("ativo", true)
        .order("coletado_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as FonteDado[];
    },
  });
}

export function useDecidirCandidato() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: { id: string; decisao: "aprovado" | "rejeitado" | "em_revisao"; motivo?: string }) => {
      const patch: any = { status_revisao: input.decisao };
      if (input.decisao === "rejeitado") {
        if (!input.motivo || input.motivo.trim().length < 3) {
          throw new Error("Informe o motivo da rejeição (mín. 3 caracteres).");
        }
        patch.rejeitado_motivo = input.motivo.trim();
      }
      const { data, error } = await (supabase as any)
        .from("lista_proprietarios_captacao")
        .update(patch)
        .eq("id", input.id)
        .select("id,status_revisao");
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("Você não tem permissão para aprovar/rejeitar candidatos. Solicite ao administrador o módulo 'captacao.aprovar'.");
      }
      return data[0];
    },
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: ["captacao-aprovacao"] });
      toast({
        title:
          vars.decisao === "aprovado" ? "Fonte aprovada — contato liberado"
          : vars.decisao === "rejeitado" ? "Candidato rejeitado"
          : "Marcado em revisão",
      });
    },
    onError: (e: any) => {
      toast({ title: "Erro na aprovação", description: e.message, variant: "destructive" });
    },
  });
}
