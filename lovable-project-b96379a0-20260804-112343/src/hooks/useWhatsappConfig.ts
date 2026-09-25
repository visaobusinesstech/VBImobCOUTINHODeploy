import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export type WhatsappProvider = "manual" | "evolution" | "zapi";

export interface WhatsappConfig {
  id?: string;
  provider: WhatsappProvider;
  api_url: string;
  api_key: string;
  instance_name: string;
  token_zapi: string;
  instance_id_zapi: string;
  ativo: boolean;
}

const EMPTY: WhatsappConfig = {
  provider: "manual",
  api_url: "",
  api_key: "",
  instance_name: "",
  token_zapi: "",
  instance_id_zapi: "",
  ativo: false,
};

export function useWhatsappConfig() {
  const { imobiliariaId } = useAuth();
  const { toast } = useToast();
  const [config, setConfig] = useState<WhatsappConfig>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchConfig = useCallback(async () => {
    if (!imobiliariaId) return;
    setLoading(true);
    const { data } = await supabase
      .from("whatsapp_config")
      .select("*")
      .eq("imobiliaria_id", imobiliariaId)
      .maybeSingle();
    if (data) {
      setConfig({
        id: data.id,
        provider: (data.provider as WhatsappProvider) || "manual",
        api_url: data.api_url || "",
        api_key: data.api_key || "",
        instance_name: data.instance_name || "",
        token_zapi: data.token_zapi || "",
        instance_id_zapi: data.instance_id_zapi || "",
        ativo: data.ativo ?? false,
      });
    }
    setLoading(false);
  }, [imobiliariaId]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const saveConfig = useCallback(async (newConfig: WhatsappConfig) => {
    if (!imobiliariaId) return;
    setSaving(true);
    try {
      const payload = {
        imobiliaria_id: imobiliariaId,
        provider: newConfig.provider,
        api_url: newConfig.api_url || null,
        api_key: newConfig.api_key || null,
        instance_name: newConfig.instance_name || null,
        token_zapi: newConfig.token_zapi || null,
        instance_id_zapi: newConfig.instance_id_zapi || null,
        ativo: newConfig.ativo,
      };

      if (newConfig.id) {
        const { error } = await supabase
          .from("whatsapp_config")
          .update(payload as any)
          .eq("id", newConfig.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("whatsapp_config")
          .insert(payload as any);
        if (error) throw error;
      }
      toast({ title: "Configuração do WhatsApp salva!" });
      await fetchConfig();
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [imobiliariaId, toast, fetchConfig]);

  const sendMessage = useCallback(async (telefone: string, mensagem: string) => {
    if (!imobiliariaId) return { success: false, error: "Sem imobiliária" };

    if (!config.ativo || config.provider === "manual") {
      // Fallback to wa.me link
      const num = telefone.replace(/\D/g, "");
      const url = `https://wa.me/55${num}?text=${encodeURIComponent(mensagem)}`;
      window.open(url, "_blank");
      return { success: true, method: "manual" };
    }

    try {
      const res = await supabase.functions.invoke("whatsapp-send", {
        body: { telefone, mensagem, imobiliaria_id: imobiliariaId },
      });
      if (res.error) throw new Error(res.error.message);
      return { success: true, method: "api", data: res.data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }, [imobiliariaId, config]);

  return { config, setConfig, loading, saving, saveConfig, sendMessage };
}
