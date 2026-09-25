import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface NutricaoMetaConfig {
  id?: string;
  imobiliaria_id?: string;
  fluxo_id: string | null;
  ativo: boolean;
  janela_dias: number;
  min_envios: number;
  meta_abertura: number;
  meta_resposta: number;
  meta_agendamento: number;
  meta_fechamento: number;
  alertar_zero_agendamento: boolean;
  alertar_zero_resposta: boolean;
  frequencia_horas: number;
  notificar_app: boolean;
}

export interface NutricaoMetaAlerta {
  id: string;
  fluxo_id: string | null;
  fluxo_nome: string | null;
  tipo: string;
  severidade: string;
  mensagem: string;
  metrica: string | null;
  valor: number | null;
  meta: number | null;
  envios: number | null;
  janela_dias: number | null;
  resolvido: boolean;
  resolvido_em: string | null;
  created_at: string;
}

export const META_CONFIG_PADRAO: NutricaoMetaConfig = {
  fluxo_id: null,
  ativo: true,
  janela_dias: 14,
  min_envios: 10,
  meta_abertura: 25,
  meta_resposta: 10,
  meta_agendamento: 5,
  meta_fechamento: 1,
  alertar_zero_agendamento: true,
  alertar_zero_resposta: true,
  frequencia_horas: 24,
  notificar_app: true,
};

export function useNutricaoMetas() {
  const { imobiliariaId } = useAuth();
  const { toast } = useToast();
  const [configs, setConfigs] = useState<NutricaoMetaConfig[]>([]);
  const [alertas, setAlertas] = useState<NutricaoMetaAlerta[]>([]);
  const [loading, setLoading] = useState(true);
  const [verificando, setVerificando] = useState(false);

  const carregar = useCallback(async () => {
    if (!imobiliariaId) return;
    setLoading(true);
    const [{ data: cfg }, { data: alt }] = await Promise.all([
      supabase.from("nutricao_metas_config").select("*").eq("imobiliaria_id", imobiliariaId),
      supabase
        .from("nutricao_metas_alertas")
        .select("*")
        .eq("imobiliaria_id", imobiliariaId)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);
    setConfigs((cfg ?? []) as NutricaoMetaConfig[]);
    setAlertas((alt ?? []) as NutricaoMetaAlerta[]);
    setLoading(false);
  }, [imobiliariaId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const salvarConfig = useCallback(
    async (config: NutricaoMetaConfig) => {
      if (!imobiliariaId) return false;
      const payload = { ...config, imobiliaria_id: imobiliariaId };
      const existente = configs.find((c) => (c.fluxo_id ?? null) === (config.fluxo_id ?? null));
      const query = existente?.id
        ? supabase.from("nutricao_metas_config").update(payload).eq("id", existente.id)
        : supabase.from("nutricao_metas_config").insert(payload);
      const { error } = await query;
      if (error) {
        toast({ title: "Erro ao salvar metas", description: error.message, variant: "destructive" });
        return false;
      }
      toast({ title: "Metas salvas", description: "Os alertas usarão os novos limites." });
      await carregar();
      return true;
    },
    [configs, imobiliariaId, toast, carregar],
  );

  const removerConfig = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("nutricao_metas_config").delete().eq("id", id);
      if (error) {
        toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
        return;
      }
      await carregar();
    },
    [toast, carregar],
  );

  const resolverAlerta = useCallback(
    async (id: string, resolvido = true) => {
      const { error } = await supabase
        .from("nutricao_metas_alertas")
        .update({ resolvido, resolvido_em: resolvido ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
        return;
      }
      setAlertas((prev) =>
        prev.map((a) =>
          a.id === id ? { ...a, resolvido, resolvido_em: resolvido ? new Date().toISOString() : null } : a,
        ),
      );
    },
    [toast],
  );

  const verificarAgora = useCallback(async () => {
    if (!imobiliariaId) return;
    setVerificando(true);
    const { data, error } = await supabase.functions.invoke("nutricao-alertas-metas", {
      body: { imobiliaria_id: imobiliariaId },
    });
    setVerificando(false);
    if (error) {
      toast({ title: "Erro na verificação", description: error.message, variant: "destructive" });
      return;
    }
    const total = (data as { alertas?: number })?.alertas ?? 0;
    toast({
      title: total > 0 ? `${total} alerta(s) gerado(s)` : "Tudo dentro das metas",
      description: total > 0 ? "Confira a lista de alertas." : "Nenhum fluxo abaixo das metas agora.",
    });
    await carregar();
  }, [imobiliariaId, toast, carregar]);

  return {
    configs,
    alertas,
    loading,
    verificando,
    salvarConfig,
    removerConfig,
    resolverAlerta,
    verificarAgora,
    recarregar: carregar,
  };
}
