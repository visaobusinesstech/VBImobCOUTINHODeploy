import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface Filho {
  nome: string;
  data_nascimento: string; // YYYY-MM-DD
}

export interface ClienteRelacionamento {
  id: string;
  imobiliaria_id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  aniversario: string | null;
  data_casamento: string | null;
  profissao: string | null;
  data_profissao: string | null;
  data_mudanca: string | null;
  data_compra_imovel: string | null;
  filhos: Filho[];
  observacoes: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export function useClientesRelacionamento() {
  const { user, imobiliariaId } = useAuth();
  const { toast } = useToast();
  const [clientes, setClientes] = useState<ClienteRelacionamento[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("clientes_relacionamento")
      .select("*")
      .order("nome");

    if (error) {
      toast({ title: "Erro ao carregar clientes", description: error.message, variant: "destructive" });
    } else {
      const mapped = (data ?? []).map((d: any) => ({
        ...d,
        filhos: Array.isArray(d.filhos) ? d.filhos : [],
      }));
      setClientes(mapped as ClienteRelacionamento[]);
    }
    setLoading(false);
  }, [user, toast]);

  useEffect(() => { fetch(); }, [fetch]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("clientes-relacionamento-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "clientes_relacionamento" }, () => fetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetch]);

  const create = async (cliente: Partial<ClienteRelacionamento>) => {
    if (!user) return null;

    // Duplicate check by phone (last 8 digits) or email
    const phone = cliente.telefone?.replace(/\D/g, "");
    const email = cliente.email?.trim().toLowerCase();

    if (phone && phone.length >= 8) {
      const { data: phoneMatches } = await supabase
        .from("clientes_relacionamento")
        .select("id, nome, telefone")
        .eq("imobiliaria_id", imobiliariaId as string)
        .ilike("telefone", `%${phone.slice(-8)}%`);
      if (phoneMatches && phoneMatches.length > 0) {
        toast({
          title: "⚠️ Contato possivelmente duplicado",
          description: `Já existe "${phoneMatches[0].nome}" com telefone semelhante. Verifique antes de cadastrar.`,
          variant: "destructive",
        });
        return null;
      }
    }

    if (email) {
      const { data: emailMatches } = await supabase
        .from("clientes_relacionamento")
        .select("id, nome, email")
        .eq("imobiliaria_id", imobiliariaId as string)
        .ilike("email", email);
      if (emailMatches && emailMatches.length > 0) {
        toast({
          title: "⚠️ Contato possivelmente duplicado",
          description: `Já existe "${emailMatches[0].nome}" com o mesmo e-mail. Verifique antes de cadastrar.`,
          variant: "destructive",
        });
        return null;
      }
    }

    const { data, error } = await supabase
      .from("clientes_relacionamento")
      .insert({ ...cliente, imobiliaria_id: imobiliariaId } as any)
      .select()
      .single();
    if (error) {
      toast({ title: "Erro ao criar cliente", description: error.message, variant: "destructive" });
      return null;
    }
    toast({ title: "Cliente adicionado!" });
    return data;
  };

  const update = async (id: string, updates: Partial<ClienteRelacionamento>) => {
    const { error } = await supabase
      .from("clientes_relacionamento")
      .update(updates as any)
      .eq("id", id);
    if (error) {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
      return false;
    }
    toast({ title: "Cliente atualizado!" });
    return true;
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("clientes_relacionamento").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
      return false;
    }
    toast({ title: "Cliente excluído!" });
    return true;
  };

  return { clientes, loading, create, update, remove, refetch: fetch };
}
