import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface Proposta {
  id: string;
  imobiliaria_id: string;
  imovel_id: string | null;
  lead_id: string | null;
  cliente_nome: string;
  cliente_telefone: string | null;
  cliente_email: string | null;
  valor: number;
  forma_pagamento: string;
  observacoes: string | null;
  status: string;
  numero_proposta: number;
  created_at: string;
  updated_at: string;
}

export const STATUS_PROPOSTA = [
  { id: "em_negociacao", label: "Em Negociação" },
  { id: "aceita", label: "Aceita" },
  { id: "recusada", label: "Recusada" },
  { id: "cancelada", label: "Cancelada" },
] as const;

export const FORMAS_PAGAMENTO = [
  { id: "a_vista", label: "À Vista" },
  { id: "financiamento", label: "Financiamento" },
  { id: "parcelado", label: "Parcelado" },
  { id: "permuta", label: "Permuta" },
  { id: "consorcio", label: "Consórcio" },
  { id: "outro", label: "Outro" },
] as const;

export function usePropostas() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [propostas, setPropostas] = useState<Proposta[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPropostas = useCallback(async () => {
    if (!user) {
      setPropostas([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("propostas")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Erro ao carregar propostas", description: error.message, variant: "destructive" });
    } else {
      setPropostas((data as unknown as Proposta[]) ?? []);
    }
    setLoading(false);
  }, [user, toast]);

  useEffect(() => {
    fetchPropostas();
  }, [fetchPropostas]);

  const createProposta = async (p: Partial<Proposta>) => {
    if (!user) {
      toast({
        title: "Sessão expirada",
        description: "Faça login novamente para registrar a proposta.",
        variant: "destructive",
      });
      return null;
    }

    // Auto-increment numero_proposta for the same imovel
    let numero = 1;
    if (p.imovel_id) {
      const existing = propostas.filter(pr => pr.imovel_id === p.imovel_id);
      numero = existing.length > 0 ? Math.max(...existing.map(pr => pr.numero_proposta)) + 1 : 1;
    }

    const { data: authData } = await supabase.rpc("get_master_user_id");
    const targetImobiliariaId = authData ?? null;

    if (!targetImobiliariaId) {
      toast({ title: "Erro ao criar proposta", description: "Não foi possível identificar a imobiliária.", variant: "destructive" });
      return null;
    }

    const payload = {
      imobiliaria_id: targetImobiliariaId,
      cliente_nome: p.cliente_nome,
      cliente_telefone: p.cliente_telefone || null,
      cliente_email: p.cliente_email || null,
      valor: p.valor || 0,
      forma_pagamento: p.forma_pagamento || "a_vista",
      observacoes: p.observacoes || null,
      status: p.status || "em_negociacao",
      imovel_id: p.imovel_id || null,
      lead_id: p.lead_id || null,
      numero_proposta: numero,
    };

    const { error } = await supabase
      .from("propostas")
      .insert(payload as any);

    if (error) {
      const detailedMessage = [error.message, (error as any).details, (error as any).hint].filter(Boolean).join(" • ");
      toast({ title: "Erro ao criar proposta", description: detailedMessage, variant: "destructive" });
      return null;
    }

    if (p.lead_id) {
      await supabase.from("lead_atividades").insert({
        lead_id: p.lead_id,
        imobiliaria_id: targetImobiliariaId,
        tipo: "proposta",
        titulo: "Nova proposta registrada",
        descricao: `Valor: ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(p.valor || 0)} | Forma: ${p.forma_pagamento}`,
      });
    }

    toast({ title: "Proposta registrada!" });
    await fetchPropostas();
    return true;
  };

  const updateProposta = async (id: string, updates: Partial<Proposta>) => {
    const { error } = await supabase
      .from("propostas")
      .update(updates as any)
      .eq("id", id);

    if (error) {
      toast({ title: "Erro ao atualizar proposta", description: error.message, variant: "destructive" });
      return false;
    }
    toast({ title: "Proposta atualizada!" });
    await fetchPropostas();
    return true;
  };

  const deleteProposta = async (id: string) => {
    const { error } = await supabase.from("propostas").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir proposta", description: error.message, variant: "destructive" });
      return false;
    }
    toast({ title: "Proposta excluída!" });
    await fetchPropostas();
    return true;
  };

  const getPropostasPorImovel = (imovelId: string) => {
    return propostas.filter(p => p.imovel_id === imovelId);
  };

  const hasPropostaAtiva = (imovelId: string) => {
    return propostas.some(p => p.imovel_id === imovelId && p.status === "em_negociacao");
  };

  return { propostas, loading, createProposta, updateProposta, deleteProposta, getPropostasPorImovel, hasPropostaAtiva, refetch: fetchPropostas };
}
