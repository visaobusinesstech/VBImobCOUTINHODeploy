import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface CuradoriaTema {
  id: string;
  imobiliaria_id: string;
  nome: string;
  descricao: string | null;
  palavras_chave: string[];
  fontes_permitidas: string[];
  fontes_bloqueadas: string[];
  idioma: string;
  periodo_busca: string;
  max_por_execucao: number;
  ativo: boolean;
  ultima_execucao: string | null;
  created_at: string;
  updated_at: string;
}

export interface CuradoriaDescoberta {
  id: string;
  tema_id: string;
  url: string;
  titulo: string;
  resumo: string | null;
  autor: string | null;
  fonte_nome: string | null;
  fonte_dominio: string | null;
  imagem_url: string | null;
  score_viralidade: number;
  status: string;
  conteudo_seo_id: string | null;
  created_at: string;
  sinais: Record<string, unknown>;
}

export interface CuradoriaConfig {
  id?: string;
  imobiliaria_id?: string;
  modo_publicacao: "manual" | "automatico" | "agendado";
  frequencia_horas: number;
  max_posts_por_dia: number;
  aprovacao_obrigatoria: boolean;
  score_minimo: number;
  ativo: boolean;
}

export function useCuradoriaTemas() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["curadoria_temas", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("curadoria_temas")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CuradoriaTema[];
    },
  });
}

export function useCuradoriaDescobertas(filtroStatus: string = "nova") {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["curadoria_descobertas", user?.id, filtroStatus],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase
        .from("curadoria_descobertas")
        .select("*")
        .order("score_viralidade", { ascending: false })
        .limit(100);
      if (filtroStatus && filtroStatus !== "todas") q = q.eq("status", filtroStatus);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as CuradoriaDescoberta[];
    },
  });
}

export function useCuradoriaConfig() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["curadoria_config", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("curadoria_configuracao")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return (data ?? {
        modo_publicacao: "manual",
        frequencia_horas: 4,
        max_posts_por_dia: 3,
        aprovacao_obrigatoria: true,
        score_minimo: 50,
        ativo: true,
      }) as CuradoriaConfig;
    },
  });
}

export function useCuradoriaExecucoes() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["curadoria_execucoes", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("curadoria_execucoes_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSalvarTema() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (tema: Partial<CuradoriaTema> & { id?: string }) => {
      if (!user) throw new Error("Sem sessão");
      if (tema.id) {
        const { error } = await supabase
          .from("curadoria_temas")
          .update(tema)
          .eq("id", tema.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("curadoria_temas").insert({
          ...tema,
          imobiliaria_id: user.id,
        } as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["curadoria_temas"] });
      toast.success("Tema salvo");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useExcluirTema() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("curadoria_temas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["curadoria_temas"] });
      toast.success("Tema removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSalvarConfig() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (cfg: CuradoriaConfig) => {
      if (!user) throw new Error("Sem sessão");
      const payload = { ...cfg, imobiliaria_id: user.id };
      const { error } = await supabase
        .from("curadoria_configuracao")
        .upsert(payload, { onConflict: "imobiliaria_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["curadoria_config"] });
      toast.success("Configuração salva");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useBuscarAgora() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tema_id?: string) => {
      const { data, error } = await supabase.functions.invoke(
        "curadoria-viral-descobrir",
        { body: { tema_id } },
      );
      if (error) throw error;
      return data;
    },
    onSuccess: (data: { novas?: number; encontradas?: number }) => {
      qc.invalidateQueries({ queryKey: ["curadoria_descobertas"] });
      qc.invalidateQueries({ queryKey: ["curadoria_execucoes"] });
      qc.invalidateQueries({ queryKey: ["curadoria_temas"] });
      toast.success(
        `Busca concluída: ${data?.novas ?? 0} novas de ${data?.encontradas ?? 0} encontradas`,
      );
    },
    onError: (e: Error) => toast.error(`Falha na busca: ${e.message}`),
  });
}

export function useGerarRascunho() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (descoberta_id: string) => {
      const { data, error } = await supabase.functions.invoke(
        "curadoria-viral-gerar",
        { body: { descoberta_id } },
      );
      if (error) throw error;
      if ((data as { error_code?: string })?.error_code) {
        throw new Error((data as { message?: string }).message || "Falha ao gerar");
      }
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["curadoria_descobertas"] });
      qc.invalidateQueries({ queryKey: ["curadoria_execucoes"] });
      toast.success("Rascunho gerado! Veja em Conteúdo SEO → Histórico");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDescartarDescoberta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, motivo }: { id: string; motivo?: string }) => {
      const { error } = await supabase
        .from("curadoria_descobertas")
        .update({ status: "descartada", motivo_descarte: motivo ?? null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["curadoria_descobertas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
