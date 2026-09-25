import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ImobiliariaConfig {
  nome_empresa: string;
  logo_url: string;
  creci: string;
  telefone: string;
  email: string;
  cnpj: string;
  sla_primeiro_contato_horas: number;
  sla_recontato_dias: number;
  pipeline_tema_default: string;
}

const EMPTY: ImobiliariaConfig = {
  nome_empresa: "",
  logo_url: "",
  creci: "",
  telefone: "",
  email: "",
  cnpj: "",
  sla_primeiro_contato_horas: 24,
  sla_recontato_dias: 7,
  pipeline_tema_default: "premium",
};
const configCache = new Map<string, ImobiliariaConfig>();
const configPending = new Map<string, Promise<ImobiliariaConfig>>();

async function loadConfig(userId: string): Promise<ImobiliariaConfig> {
  const cached = configCache.get(userId);
  if (cached) return cached;

  const pending = configPending.get(userId);
  if (pending) return pending;

  const request = (async () => {
    try {
      const { data } = await supabase
        .from("imobiliaria_config")
        .select("nome_empresa, logo_url, creci, telefone, email, cnpj, sla_primeiro_contato_horas, sla_recontato_dias, pipeline_tema_default")
        .eq("user_id", userId)
        .maybeSingle();

      const normalized: ImobiliariaConfig = {
        nome_empresa: data?.nome_empresa || "",
        logo_url: data?.logo_url || "",
        creci: (data as any)?.creci || "",
        telefone: data?.telefone || "",
        email: data?.email || "",
        cnpj: data?.cnpj || "",
        sla_primeiro_contato_horas: (data as any)?.sla_primeiro_contato_horas ?? 24,
        sla_recontato_dias: (data as any)?.sla_recontato_dias ?? 7,
        pipeline_tema_default: (data as any)?.pipeline_tema_default || "premium",
      };

      configCache.set(userId, normalized);
      return normalized;
    } finally {
      configPending.delete(userId);
    }
  })();

  configPending.set(userId, request);
  return request;
}


export function useImobiliariaConfig() {
  const { user, imobiliariaId } = useAuth();
  const [config, setConfig] = useState<ImobiliariaConfig>(EMPTY);

  // Use imobiliariaId (which resolves to the master for shared users)
  // so that shared users see the master's brand, logo, and company info.
  const effectiveId = imobiliariaId || user?.id;

  useEffect(() => {
    if (!effectiveId) {
      setConfig(EMPTY);
      return;
    }

    loadConfig(effectiveId)
      .then(setConfig)
      .catch((error) => {
        console.error("Error loading imobiliaria config:", error);
        setConfig(EMPTY);
      });
  }, [effectiveId]);

  return config;
}
