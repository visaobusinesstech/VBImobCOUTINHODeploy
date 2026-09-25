import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useCurrentCorretor } from "@/hooks/useCurrentCorretor";

export interface Contrato {
  id: string;
  imobiliaria_id: string;
  titulo: string;
  cliente: string;
  cliente_telefone: string | null;
  cliente_cpf: string | null;
  cliente_email: string | null;
  tipo: string;
  valor: number;
  status: string;
  data_inicio: string | null;
  data_fim: string | null;
  imovel_id: string | null;
  corretor_id: string | null;
  inquilino: string | null;
  proprietario: string | null;
  contrato_url: string | null;
  vistoria_entrada: boolean;
  vistoria_video: boolean;
  apolice_seguro: boolean;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  matricula: string | null;
  proprietario_id: string | null;
  indice_correcao: string | null;
  percentual_correcao: number | null;
  data_proxima_correcao: string | null;
  dia_vencimento_aluguel: number | null;
  data_vencimento_apolice: string | null;
  tipo_garantia: string | null;
  contrato_anexo_url: string | null;
  apolice_anexo_url: string | null;
  vistoria_anexo_url: string | null;
  numero_agua: string | null;
  numero_luz: string | null;
  inscricao_iptu: string | null;
  canal_origem: string | null;
  proprietario_telefone: string | null;
  proprietario_cpf: string | null;
  // New fields
  comissao_percentual: number | null;
  comissao_valor: number | null;
  tem_parceria: boolean;
  parceiro_nome: string | null;
  parceiro_comissao_percentual: number | null;
  parceiro_comissao_valor: number | null;
  captador_nome: string | null;
  captador_telefone: string | null;
  captador_comissao_percentual: number | null;
  captador_comissao_valor: number | null;
  imposto_tipo: string | null;
  imposto_percentual: number | null;
  imposto_valor: number | null;
  corretor_nome: string | null;
  corretor_comissao_percentual: number | null;
  corretor_comissao_valor: number | null;
  valor_iptu: number | null;
  iptu_parcelado: boolean;
  valor_condominio: number | null;
  condominio_inclui: string | null;
  inquilino_telefone: string | null;
  inquilino_cpf: string | null;
  caucao_valor: number | null;
  caucao_quantidade: number | null;
  aditivo_anexo_url: string | null;
  seguro_incendio_anexo_url: string | null;
  seguro_fianca_anexo_url: string | null;
  fiador_nome: string | null;
  fiador_cpf: string | null;
  fiador_telefone: string | null;
  fiador_email: string | null;
  fiador_estado_civil: string | null;
  fiador_endereco: string | null;
  numero_unidade: string | null;
  conjuge_proprietario: string | null;
  conjuge_cpf: string | null;
  conjuge_telefone: string | null;
  conjuge_email: string | null;
  inquilino_email: string | null;
  inquilino2_nome: string | null;
  inquilino2_cpf: string | null;
  inquilino2_telefone: string | null;
  inquilino2_email: string | null;
  parceria_envolvidos: string[] | null;
  vistoria_video_url: string | null;
  caucao_comprovante_url: string | null;
  fiador_matricula_url: string | null;
  fiador_renda_url: string | null;
  fiador2_nome: string | null;
  fiador2_cpf: string | null;
  fiador2_telefone: string | null;
  fiador2_email: string | null;
  fiador2_estado_civil: string | null;
  fiador2_endereco: string | null;
  fiador2_matricula_url: string | null;
  fiador2_renda_url: string | null;
  comprovante_agua_url: string | null;
  comprovante_luz_url: string | null;
  cliente_rg: string | null;
  proprietario_email: string | null;
  proprietario_rg: string | null;
  proprietario_banco: string | null;
  proprietario_agencia: string | null;
  proprietario_conta: string | null;
  proprietario_pix: string | null;
  inquilino_rg: string | null;
  inquilino2_rg: string | null;
  comissao_tipo: string | null;
  codigo_contrato: string | null;
}

export const STATUS_CONTRATO = [
  { id: "rascunho", label: "Rascunho" },
  { id: "aguardando", label: "Aguardando Assinatura" },
  { id: "assinado", label: "Assinado" },
  { id: "ativo", label: "Ativo" },
  { id: "inativo", label: "Inativo" },
  { id: "vencendo", label: "Vencendo" },
  { id: "cancelado", label: "Cancelado" },
] as const;

interface CreateContratoOptions {
  skipRefresh?: boolean;
  suppressErrorToast?: boolean;
  suppressSuccessToast?: boolean;
}

export function useContratos(options: { enabled?: boolean } = {}) {
  const { enabled = true } = options;
  const { user, imobiliariaId } = useAuth();
  const { corretorId, isBroker, ready: corretorReady } = useCurrentCorretor();
  const { toast } = useToast();
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchingRef = useRef(false);

  const fetchContratos = useCallback(async (attempt = 1) => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    if (!user || !corretorReady || fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      let q = supabase
        .from("contratos")
        .select("*")
        .order("created_at", { ascending: false })
        .abortSignal(controller.signal);
      if (isBroker && corretorId) q = q.eq("corretor_id", corretorId) as any;
      const { data, error } = await q;
      clearTimeout(timeout);
      if (error) throw error;
      setContratos((data as unknown as Contrato[]) ?? []);
    } catch (err: any) {
      clearTimeout(timeout);
      if (err.name === "AbortError" && attempt < 3) {
        fetchingRef.current = false;
        return fetchContratos(attempt + 1);
      }
      if (err.name === "AbortError") {
        toast({ title: "Conexão lenta", description: "Não foi possível carregar contratos. Tente novamente.", variant: "destructive" });
      } else {
        toast({ title: "Erro ao carregar contratos", description: err.message, variant: "destructive" });
      }
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [enabled, user, corretorReady, isBroker, corretorId, toast]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    if (user && corretorReady) fetchContratos();
  }, [enabled, user, corretorReady, fetchContratos]);

  const createContrato = async (c: Partial<Contrato>, options: CreateContratoOptions = {}) => {
    if (!user) return null;

    const resolvedImobiliariaId = imobiliariaId || user.id;

    // Prevent duplicate rental contracts: same client CPF + property unit + active status
    if (c.tipo === "Locação") {
      const clienteCpf = c.cliente_cpf?.replace(/\D/g, "");
      const inquilinoCpf = c.inquilino_cpf?.replace(/\D/g, "");
      const titulo = c.titulo?.trim().toLowerCase();

      let dupQuery = supabase
        .from("contratos")
        .select("id, titulo, cliente, cliente_cpf, inquilino_cpf, numero_unidade, status")
        .eq("tipo", "Locação")
        .not("status", "eq", "cancelado");

      // Check by client CPF if available
      if (clienteCpf && clienteCpf.length >= 11) {
        const { data: dupByCpf } = await dupQuery.ilike("cliente_cpf", `%${clienteCpf}%`);
        if (dupByCpf && dupByCpf.length > 0) {
          const match = dupByCpf[0];
          if (!options.suppressErrorToast) {
            toast({
              title: "Contrato duplicado detectado",
              description: `Já existe um contrato de aluguel ativo para este CPF: "${match.titulo}" (${match.cliente}). Cancele o existente antes de criar um novo.`,
              variant: "destructive",
            });
          }
          return null;
        }
      }

      // Check by inquilino CPF if available
      if (inquilinoCpf && inquilinoCpf.length >= 11) {
        const { data: dupByInq } = await supabase
          .from("contratos")
          .select("id, titulo, cliente, inquilino_cpf, status")
          .eq("tipo", "Locação")
          .not("status", "eq", "cancelado")
          .ilike("inquilino_cpf", `%${inquilinoCpf}%`);
        if (dupByInq && dupByInq.length > 0) {
          const match = dupByInq[0];
          if (!options.suppressErrorToast) {
            toast({
              title: "Contrato duplicado detectado",
              description: `Já existe um contrato de aluguel ativo para este inquilino (CPF): "${match.titulo}". Cancele o existente antes de criar um novo.`,
              variant: "destructive",
            });
          }
          return null;
        }
      }

      // Check by titulo exact match
      if (titulo) {
        const { data: dupByTitle } = await supabase
          .from("contratos")
          .select("id, titulo, cliente, status")
          .eq("tipo", "Locação")
          .not("status", "eq", "cancelado")
          .ilike("titulo", titulo);
        if (dupByTitle && dupByTitle.length > 0) {
          const match = dupByTitle[0];
          if (!options.suppressErrorToast) {
            toast({
              title: "Contrato duplicado detectado",
              description: `Já existe um contrato de aluguel com o mesmo título: "${match.titulo}" (${match.cliente}). Verifique antes de continuar.`,
              variant: "destructive",
            });
          }
          return null;
        }
      }
    }

    const payload = { ...c, imobiliaria_id: resolvedImobiliariaId };


    const { data, error } = await supabase
      .from("contratos")
      .insert(payload as any)
      .select()
      .single();

    if (error) {
      console.error("Erro ao criar contrato:", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      if (!options.suppressErrorToast) {
        toast({
          title: "Erro ao criar contrato",
          description: error.message,
          variant: "destructive",
        });
      }
      return null;
    }

    if (!options.suppressSuccessToast) {
      toast({ title: "Contrato criado!" });
    }

    if (!options.skipRefresh) {
      await fetchContratos();
    }

    return data;
  };

  const updateContrato = async (id: string, updates: Partial<Contrato>) => {
    const { error } = await supabase
      .from("contratos")
      .update(updates as any)
      .eq("id", id);

    if (error) {
      toast({ title: "Erro ao atualizar contrato", description: error.message, variant: "destructive" });
      return false;
    }
    toast({ title: "Contrato atualizado!" });
    await fetchContratos();
    return true;
  };

  const deleteContrato = async (id: string) => {
    const { error } = await supabase.from("contratos").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir contrato", description: error.message, variant: "destructive" });
      return false;
    }
    toast({ title: "Contrato excluído!" });
    await fetchContratos();
    return true;
  };

  return { contratos, loading, createContrato, updateContrato, deleteContrato, refetch: fetchContratos };
}
