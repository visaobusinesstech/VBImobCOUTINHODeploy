import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

// Helper to find master user id
async function getMasterUserId(): Promise<string | null> {
  const { data, error } = await supabase.rpc("get_master_user_id");
  if (error) {
    console.error("Error getting master user id:", error);
    return null;
  }
  return data as string | null;
}

export const MODULOS = [
  { id: "imoveis", label: "Imóveis", desc: "Cadastro e gestão de imóveis" },
  { id: "pipeline", label: "CRM Pipeline", desc: "Funil de leads e vendas" },
  { id: "corretores", label: "Corretores", desc: "Equipe de corretores" },
  { id: "automacoes", label: "Automações", desc: "Triggers e ações automáticas" },
  { id: "financeiro", label: "Financeiro", desc: "Receitas e despesas" },
  { id: "contratos", label: "Contratos", desc: "Gestão de contratos" },
  { id: "relacionamento", label: "Relacionamento", desc: "CRM de relacionamento" },
  { id: "jornada", label: "Jornada do Lead", desc: "Histórico e timeline" },
  { id: "seguranca", label: "Segurança", desc: "Logs e auditoria" },
  { id: "proprietarios", label: "Proprietários", desc: "Gestão de proprietários" },
  { id: "followups", label: "Follow-up", desc: "Gestão de retornos e acompanhamento de clientes" },
  { id: "whatsapp", label: "WhatsApp", desc: "Histórico de mensagens WhatsApp" },
  { id: "radarzap", label: "RadarZAP", desc: "Prospecção em grupos públicos de WhatsApp (menu e páginas)" },
  { id: "radarzap_aprovar", label: "RadarZAP · Aprovar leads", desc: "Aprovar/rejeitar leads na aba Aprovações do RadarZAP" },
  { id: "radarzap_editar_sensivel", label: "RadarZAP · Editar dados sensíveis", desc: "Editar nome do proprietário, contato e resumo antes da aprovação" },
  { id: "radarzap_config", label: "RadarZAP · Configurações", desc: "Acessar Scoring, Onboarding, Status e Agendamento do RadarZAP" },
] as const;

export type ModuloId = (typeof MODULOS)[number]["id"];

// Map route paths to module ids
export const ROUTE_TO_MODULO: Record<string, ModuloId> = {
  "/imoveis": "imoveis",
  "/pipeline": "pipeline",
  "/corretores": "corretores",
  "/automacoes": "automacoes",
  "/financeiro": "financeiro",
  "/contratos": "contratos",
  "/relacionamento": "relacionamento",
  "/jornada": "jornada",
  "/seguranca": "seguranca",
  "/proprietarios": "proprietarios",
  "/followups": "followups",
  "/whatsapp": "whatsapp",
  "/radarzap": "radarzap",
  "/radarzap/scoring": "radarzap_config",
  "/radarzap/onboarding": "radarzap_config",
  "/radarzap/status": "radarzap_config",
  "/radarzap/acessos": "radarzap_config",
};

interface ModuloConfigState {
  config: Record<ModuloId, boolean>;
  loading: boolean;
  toggleModulo: (modulo: ModuloId, ativo: boolean) => Promise<void>;
  isModuloAtivo: (modulo: ModuloId) => boolean;
}

const defaultConfig = Object.fromEntries(MODULOS.map((m) => [m.id, true])) as Record<ModuloId, boolean>;

const ModuloConfigContext = createContext<ModuloConfigState>({
  config: defaultConfig,
  loading: true,
  toggleModulo: async () => {},
  isModuloAtivo: () => true,
});

export const useModuloConfig = () => useContext(ModuloConfigContext);

export { ModuloConfigContext, defaultConfig };

export function useModuloConfigProvider(): ModuloConfigState {
  const { user, isMaster } = useAuth();
  const userId = user?.id ?? null;
  const { toast } = useToast();
  const [config, setConfig] = useState<Record<ModuloId, boolean>>(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [initialLoaded, setInitialLoaded] = useState(false);

  const fetch = useCallback(async () => {
    if (!userId) return;
    if (!initialLoaded) setLoading(true);
    const { data, error } = await supabase
      .from("modulo_config")
      .select("modulo, ativo")
      .eq("imobiliaria_id", userId);

    if (error) {
      console.error("Error loading modulo config:", error);
      setLoading(false);
      setInitialLoaded(true);
      return;
    }

    const newConfig = { ...defaultConfig };
    data?.forEach((row: any) => {
      if (row.modulo in newConfig) {
        (newConfig as any)[row.modulo] = row.ativo;
      }
    });
    setConfig(newConfig);
    setLoading(false);
    setInitialLoaded(true);
  }, [userId, initialLoaded]);

  useEffect(() => {
    if (!userId) {
      setConfig(defaultConfig);
      setLoading(false);
      return;
    }
    fetch();
  }, [fetch, userId]);

  const toggleModulo = useCallback(async (modulo: ModuloId, ativo: boolean) => {
    if (!userId || !isMaster) return;

    setConfig((prev) => ({ ...prev, [modulo]: ativo }));

    const { error } = await supabase
      .from("modulo_config")
      .upsert(
        { imobiliaria_id: userId, modulo, ativo },
        { onConflict: "imobiliaria_id,modulo" }
      );

    if (error) {
      setConfig((prev) => ({ ...prev, [modulo]: !ativo }));
      toast({ title: "Erro ao atualizar módulo", description: error.message, variant: "destructive" });
    }
  }, [userId, isMaster, toast]);

  const isModuloAtivo = useCallback((modulo: ModuloId) => config[modulo] ?? true, [config]);

  return { config, loading, toggleModulo, isModuloAtivo };
}
