import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

export type Captacao = {
  id: string;
  imobiliaria_id: string;
  tipo: string;
  nome_contato: string;
  telefone_contato: string | null;
  email_contato: string | null;
  endereco_imovel: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  tipo_imovel: string | null;
  operacao: string | null;
  nome_construtora: string | null;
  nome_condominio: string | null;
  observacoes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export function useCaptacoes() {
  const [captacoes, setCaptacoes] = useState<Captacao[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user, imobiliariaId, loading: authLoading } = useAuth();

  const fetchCaptacoes = useCallback(async () => {
    if (!user || !imobiliariaId) {
      setCaptacoes([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("captacoes" as any)
      .select("*")
      .eq("imobiliaria_id", imobiliariaId)
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Erro ao carregar captações", description: error.message, variant: "destructive" });
      setCaptacoes([]);
      setLoading(false);
      return;
    }

    if (data) setCaptacoes(data as any as Captacao[]);
    setLoading(false);
  }, [imobiliariaId, toast, user]);

  useEffect(() => {
    if (authLoading) {
      setLoading(true);
      return;
    }

    if (!user || !imobiliariaId) {
      setCaptacoes([]);
      setLoading(false);
      return;
    }

    void fetchCaptacoes();
  }, [authLoading, fetchCaptacoes, imobiliariaId, user]);

  const createCaptacao = async (data: Partial<Captacao>) => {
    if (!user || !imobiliariaId) {
      const authError = new Error("Faça login novamente para registrar a captação.");
      toast({ title: "Sessão inválida", description: authError.message, variant: "destructive" });
      throw authError;
    }

    const { error } = await supabase
      .from("captacoes" as any)
      .insert({ ...data, imobiliaria_id: imobiliariaId } as any);

    if (error) {
      toast({ title: "Erro ao criar captação", description: error.message, variant: "destructive" });
      throw error;
    }

    toast({ title: "Captação registrada!" });
    await fetchCaptacoes();
  };

  const updateCaptacao = async (id: string, data: Partial<Captacao>) => {
    const { error } = await supabase
      .from("captacoes" as any)
      .update(data as any)
      .eq("id", id);
    if (error) {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
      throw error;
    }

    toast({ title: "Captação atualizada!" });
    await fetchCaptacoes();
  };

  const deleteCaptacao = async (id: string) => {
    const { error } = await supabase
      .from("captacoes" as any)
      .delete()
      .eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
      throw error;
    }

    toast({ title: "Captação excluída!" });
    await fetchCaptacoes();
  };

  const construtoras = Array.from(
    new Set(captacoes.filter(c => c.nome_construtora).map(c => c.nome_construtora!))
  ).sort();

  return { captacoes, loading, imobiliariaId, createCaptacao, updateCaptacao, deleteCaptacao, construtoras };
}
