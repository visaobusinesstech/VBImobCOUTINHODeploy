import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export type CaptacaoEstagio =
  | "Prospectado"
  | "Contactado"
  | "Interessado"
  | "Avaliacao Enviada"
  | "Autorizacao"
  | "Contrato Assinado"
  | "Perdido";

export const ESTAGIOS_ATIVOS: CaptacaoEstagio[] = [
  "Prospectado",
  "Contactado",
  "Interessado",
  "Avaliacao Enviada",
  "Autorizacao",
  "Contrato Assinado",
];

export const ESTAGIO_LABEL: Record<CaptacaoEstagio, string> = {
  Prospectado: "Prospectado",
  Contactado: "Contactado",
  Interessado: "Interessado",
  "Avaliacao Enviada": "Avaliação Enviada",
  Autorizacao: "Autorização",
  "Contrato Assinado": "Contrato Assinado",
  Perdido: "Perdido",
};

export interface CaptacaoPipelineRow {
  id: string;
  imobiliaria_id: string;
  corretor_id: string | null;
  nome: string;
  telefone: string | null;
  telefone_e164: string | null;
  email: string | null;
  imovel_endereco: string | null;
  imovel_cidade: string | null;
  imovel_bairro: string | null;
  imovel_tipo: string | null;
  operacao: string | null;
  valor_estimado: number | null;
  origem: string | null;
  estagio: CaptacaoEstagio;
  estagio_desde: string;
  ultima_atividade_em: string | null;
  perdido_motivo: string | null;
  won_valor: number | null;
  won_em: string | null;
  created_at: string;
  updated_at: string;
  dados?: Record<string, any> | null;
  radarzap_lead_id?: string | null;
}

const TABLE = "captacao_pipeline" as any;

export function useCaptacaoPipeline() {
  const { user, imobiliariaId } = useAuth();
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["captacao_pipeline", imobiliariaId ?? user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .select("*")
        .order("estagio_desde", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CaptacaoPipelineRow[];
    },
  });

  const create = useMutation({
    mutationFn: async (input: Partial<CaptacaoPipelineRow>) => {
      const payload = { ...input, imobiliaria_id: imobiliariaId ?? user?.id };
      const { data, error } = await (supabase as any).from(TABLE).insert(payload).select("*").single();
      if (error) throw error;
      return data as CaptacaoPipelineRow;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["captacao_pipeline"] });
      toast.success("Lead criado no pipeline de captação");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao criar lead"),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...changes }: Partial<CaptacaoPipelineRow> & { id: string }) => {
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .update(changes)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      return data as CaptacaoPipelineRow;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["captacao_pipeline"] }),
    onError: (e: any) => toast.error(e?.message ?? "Erro ao atualizar"),
  });

  const move = useMutation({
    mutationFn: async ({ id, to, motivo }: { id: string; to: CaptacaoEstagio; motivo?: string }) => {
      const { data, error } = await (supabase as any).rpc("captacao_pipeline_move", {
        _id: id,
        _to: to,
        _motivo: motivo ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["captacao_pipeline"] });
      qc.invalidateQueries({ queryKey: ["captacao_pipeline_metricas"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao mover estágio"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from(TABLE).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["captacao_pipeline"] }),
  });

  const addAtividade = useMutation({
    mutationFn: async (input: { pipeline_id: string; tipo: string; descricao?: string }) => {
      const { data, error } = await (supabase as any)
        .from("captacao_pipeline_atividades")
        .insert({
          pipeline_id: input.pipeline_id,
          imobiliaria_id: imobiliariaId ?? user?.id,
          tipo: input.tipo,
          descricao: input.descricao ?? null,
        })
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["captacao_pipeline"] });
      toast.success("Atividade registrada");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao registrar atividade"),
  });

  return { list, create, update, move, remove, addAtividade };
}

export function useCaptacaoPipelineMetricas(corretorId?: string | null) {
  return useQuery({
    queryKey: ["captacao_pipeline_metricas", corretorId ?? "all"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("captacao_pipeline_metricas", {
        _corretor_id: corretorId ?? null,
        _desde: null,
        _ate: null,
      });
      if (error) throw error;
      return data as any;
    },
  });
}

export function useCaptacaoPipelineSla() {
  return useQuery({
    queryKey: ["captacao_pipeline_sla"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("captacao_pipeline_sla_pendentes");
      if (error) throw error;
      return (data ?? []) as any[];
    },
    refetchInterval: 60_000,
  });
}
