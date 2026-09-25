import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type CriterioIA = "probabilidade" | "urgencia" | "investimento" | "portfolio";
export type PrioridadeIA = "alta" | "media" | "baixa";
export type PerfilIA = "morador_motivado" | "morador_neutro" | "investidor" | "incerto";

export interface FiltroIAParams {
  operacao?: "Venda" | "Aluguel" | null;
  cidade?: string | null;
  bairro?: string | null;
  tipo_imovel?: string | null;
  score_min?: number;
  criterios?: Record<CriterioIA, number>;
  limite?: number;
  portfolio_hint?: string | null;
  modo_teste?: boolean;
  amostra?: number;
}

export interface ResultadoFiltroIA {
  proprietario: {
    id: string;
    nome_proprietario: string;
    telefone: string | null;
    cidade: string | null;
    bairro: string | null;
    titulo_imovel: string | null;
    operacao: string | null;
    tipo_imovel: string | null;
    preco: number | null;
    ultimo_preco: number | null;
    url_anuncio: string | null;
    motivacao_score: number;
    motivacao_sinais: any;
  };
  ai_score: number;
  prioridade: PrioridadeIA;
  perfil: PerfilIA;
  motivos: string[];
  acao_recomendada: string;
  mensagem_whatsapp: string;
}

export interface FiltroIAErro {
  message: string;
  error_code?: string | null;
  run_id?: string | null;
  duracao_ms?: number | null;
  log_excerpt?: string[];
  detalhe?: string | null;
  stack?: string | null;
  preview?: string | null;
  status?: number | null;
}

export function useFiltrarProprietariosIA() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (params: FiltroIAParams) => {
      const { data, error } = await supabase.functions.invoke("filtrar-proprietarios-ia", {
        body: params,
      });
      const payload: any = data ?? {};
      if (error) {
        const err: FiltroIAErro = {
          message: payload?.message || payload?.error || error.message || "Falha ao chamar IA Filtra",
          error_code: payload?.error_code ?? (error as any)?.code ?? "invoke_error",
          run_id: payload?.run_id ?? null,
          duracao_ms: payload?.duracao_ms ?? null,
          log_excerpt: Array.isArray(payload?.log_excerpt) ? payload.log_excerpt : [],
          detalhe: payload?.detalhe ?? null,
          stack: payload?.stack ?? null,
          preview: payload?.preview ?? null,
          status: (error as any)?.status ?? null,
        };
        throw Object.assign(new Error(err.message), { detalhes: err });
      }
      if (payload?.success === false || payload?.error_code || payload?.error) {
        const err: FiltroIAErro = {
          message: payload?.message || payload?.error || "A IA Filtra retornou um erro.",
          error_code: payload?.error_code ?? "ai_error",
          run_id: payload?.run_id ?? null,
          duracao_ms: payload?.duracao_ms ?? null,
          log_excerpt: Array.isArray(payload?.log_excerpt) ? payload.log_excerpt : [],
          detalhe: payload?.detalhe ?? null,
          stack: payload?.stack ?? null,
          preview: payload?.preview ?? null,
          status: null,
        };
        throw Object.assign(new Error(err.message), { detalhes: err });
      }
      return payload as {
        success: boolean;
        total: number;
        resultados: ResultadoFiltroIA[];
        modelo?: string;
        provider?: string;
        run_id?: string;
        duracao_ms?: number;
        modo_teste?: boolean;
        amostra?: number | null;
        persistido?: boolean;
        contagem_nivel?: Record<string, number>;
        contagem_prioridade?: { alta: number; media: number; baixa: number };
        tempos?: Record<string, number>;
        filtros_aplicados?: {
          operacao: string | null;
          cidade: string | null;
          bairro: string | null;
          tipo_imovel: string | null;
          score_min: number;
          limite: number;
          portfolio_hint: string | null;
        };
        filtros_efetivos?: Array<{ etapa: string; label: string; count: number; excluidos: number }>;
        motivos_exclusao?: Record<string, number>;
        contagens?: {
          total_bruto: number;
          total_pos_filtros: number;
          candidatos_analisados: number;
          retornados_pela_ia: number;
          por_nivel: Record<string, number>;
          por_prioridade: { alta: number; media: number; baixa: number };
        };
      };
    },
    onError: (e: any) =>
      toast({
        title: "Falha na filtragem IA",
        description: `${e?.message ?? "Tente novamente."}${e?.detalhes?.run_id ? ` · run ${String(e.detalhes.run_id).slice(0, 8)}` : ""}`,
        variant: "destructive",
      }),
  });
}
