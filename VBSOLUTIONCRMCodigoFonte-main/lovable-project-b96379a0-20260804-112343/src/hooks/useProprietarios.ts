import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface ProprietarioFamiliar {
  id?: string;
  proprietario_id?: string;
  imobiliaria_id?: string;
  nome: string;
  data_nascimento: string | null;
  relacao: string;
}

export interface Proprietario {
  id: string;
  imobiliaria_id: string;
  nome: string;
  cpf_cnpj: string | null;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  pix: string | null;
  tipo: string;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  estado_civil: string | null;
  canal_origem: string | null;
  conjuge_nome: string | null;
  conjuge_cpf: string | null;
  contrato_administracao: boolean;
  comissao_acordada: number;
  exclusividade: boolean;
  exclusividade_inicio: string | null;
  exclusividade_fim: string | null;
  saldo_devedor: boolean;
  parcela_atraso_financiamento: boolean;
  parcela_atraso_condominio: boolean;
  parcela_atraso_iptu: boolean;
  quitado: boolean;
  averbacao: boolean;
  dados_imovel_endereco: string | null;
  dados_imovel_tipo: string | null;
  dados_imovel_area: number | null;
  exclusividade_contrato_url: string | null;
  inscricao_iptu: string | null;
  matricula: string | null;
  certidao_onus_url: string | null;
  // Datas de relacionamento
  data_nascimento: string | null;
  data_casamento: string | null;
  data_compra_imovel: string | null;
  conjuge_data_nascimento: string | null;
  familiares?: ProprietarioFamiliar[];
}

async function syncFamiliares(
  proprietarioId: string,
  imobiliariaId: string,
  familiares: ProprietarioFamiliar[]
) {
  // Carrega os atuais para calcular diff
  const { data: existentes } = await supabase
    .from("proprietario_familiares" as any)
    .select("id")
    .eq("proprietario_id", proprietarioId);

  const existentesIds = new Set(((existentes as any[]) ?? []).map(f => f.id));
  const enviadosIds = new Set(
    familiares.filter(f => f.id).map(f => f.id as string)
  );

  const idsParaRemover = [...existentesIds].filter(id => !enviadosIds.has(id));
  if (idsParaRemover.length > 0) {
    await supabase
      .from("proprietario_familiares" as any)
      .delete()
      .in("id", idsParaRemover);
  }

  const paraCriar = familiares.filter(f => !f.id && f.nome?.trim());
  const paraAtualizar = familiares.filter(f => f.id && f.nome?.trim());

  if (paraCriar.length > 0) {
    await supabase.from("proprietario_familiares" as any).insert(
      paraCriar.map(f => ({
        proprietario_id: proprietarioId,
        imobiliaria_id: imobiliariaId,
        nome: f.nome.trim(),
        data_nascimento: f.data_nascimento || null,
        relacao: f.relacao || "filho",
      })) as any
    );
  }

  for (const f of paraAtualizar) {
    await supabase
      .from("proprietario_familiares" as any)
      .update({
        nome: f.nome.trim(),
        data_nascimento: f.data_nascimento || null,
        relacao: f.relacao || "filho",
      } as any)
      .eq("id", f.id!);
  }
}

export function useProprietarios() {
  const { user, imobiliariaId } = useAuth();
  const { toast } = useToast();
  const [proprietarios, setProprietarios] = useState<Proprietario[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("proprietarios" as any)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Erro ao carregar proprietários", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    const lista = (data as unknown as Proprietario[]) ?? [];
    if (lista.length > 0) {
      const ids = lista.map(p => p.id);
      const { data: fams } = await supabase
        .from("proprietario_familiares" as any)
        .select("*")
        .in("proprietario_id", ids);
      const porProp = new Map<string, ProprietarioFamiliar[]>();
      ((fams as any[]) ?? []).forEach((f: any) => {
        const arr = porProp.get(f.proprietario_id) ?? [];
        arr.push(f as ProprietarioFamiliar);
        porProp.set(f.proprietario_id, arr);
      });
      lista.forEach(p => { p.familiares = porProp.get(p.id) ?? []; });
    }

    setProprietarios(lista);
    setLoading(false);
  }, [user, toast]);

  useEffect(() => { fetch(); }, [fetch]);

  const create = async (p: Partial<Proprietario>) => {
    if (!user) return null;

    // Duplicate check by CPF/CNPJ, phone, or email
    const cpf = p.cpf_cnpj?.replace(/\D/g, "");
    const phone = p.telefone?.replace(/\D/g, "");
    const email = p.email?.trim().toLowerCase();

    if (cpf && cpf.length >= 11) {
      const { data: cpfMatches } = await supabase
        .from("proprietarios" as any)
        .select("id, nome, cpf_cnpj")
        .ilike("cpf_cnpj", `%${cpf}%`);
      if (cpfMatches && (cpfMatches as any[]).length > 0) {
        toast({
          title: "⚠️ Proprietário possivelmente duplicado",
          description: `Já existe "${(cpfMatches as any[])[0].nome}" com CPF/CNPJ semelhante. Verifique antes de cadastrar.`,
          variant: "destructive",
        });
        return null;
      }
    }

    if (phone && phone.length >= 8) {
      const { data: phoneMatches } = await supabase
        .from("proprietarios" as any)
        .select("id, nome, telefone")
        .ilike("telefone", `%${phone.slice(-8)}%`);
      if (phoneMatches && (phoneMatches as any[]).length > 0) {
        toast({
          title: "⚠️ Proprietário possivelmente duplicado",
          description: `Já existe "${(phoneMatches as any[])[0].nome}" com telefone semelhante. Verifique antes de cadastrar.`,
          variant: "destructive",
        });
        return null;
      }
    }

    if (email) {
      const { data: emailMatches } = await supabase
        .from("proprietarios" as any)
        .select("id, nome, email")
        .ilike("email", email);
      if (emailMatches && (emailMatches as any[]).length > 0) {
        toast({
          title: "⚠️ Proprietário possivelmente duplicado",
          description: `Já existe "${(emailMatches as any[])[0].nome}" com o mesmo e-mail. Verifique antes de cadastrar.`,
          variant: "destructive",
        });
        return null;
      }
    }

    const { familiares, ...propData } = p as any;

    const { data, error } = await supabase
      .from("proprietarios" as any)
      .insert({ ...propData, imobiliaria_id: imobiliariaId } as any)
      .select()
      .single();
    if (error) {
      toast({ title: "Erro ao criar proprietário", description: error.message, variant: "destructive" });
      return null;
    }

    const criado = data as any;
    if (Array.isArray(familiares) && familiares.length > 0 && criado?.id && imobiliariaId) {
      try {
        await syncFamiliares(criado.id, imobiliariaId, familiares);
      } catch (err: any) {
        console.error("Erro ao sincronizar familiares:", err);
      }
    }

    toast({ title: "Proprietário cadastrado!" });
    await fetch();
    return criado;
  };

  const update = async (id: string, updates: Partial<Proprietario>) => {
    const { familiares, ...propData } = updates as any;

    const { error } = await supabase
      .from("proprietarios" as any)
      .update(propData as any)
      .eq("id", id);
    if (error) {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
      return false;
    }

    if (Array.isArray(familiares) && imobiliariaId) {
      try {
        await syncFamiliares(id, imobiliariaId, familiares);
      } catch (err: any) {
        console.error("Erro ao sincronizar familiares:", err);
      }
    }

    toast({ title: "Proprietário atualizado!" });
    await fetch();
    return true;
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("proprietarios" as any).delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
      return false;
    }
    toast({ title: "Proprietário excluído!" });
    await fetch();
    return true;
  };

  return { proprietarios, loading, create, update, remove, refetch: fetch };
}
