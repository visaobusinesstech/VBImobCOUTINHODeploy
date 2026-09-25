import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  DEFAULT_TEMPLATE_BODY,
  DEFAULT_TEMPLATE_VARIABLES,
  TemplateVariable,
} from "@/lib/whatsappTemplate";

export interface WhatsappCaptacaoTemplate {
  id?: string;
  imobiliaria_id: string;
  template_body: string;
  variables: TemplateVariable[];
}

const TABLE = "whatsapp_captacao_templates" as const;

export function useWhatsappCaptacaoTemplate() {
  const { user, imobiliariaId } = useAuth();
  const { toast } = useToast();
  const tenantId = imobiliariaId || user?.id || null;

  const [template, setTemplate] = useState<WhatsappCaptacaoTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchTemplate = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from(TABLE)
      .select("id, imobiliaria_id, template_body, variables")
      .eq("imobiliaria_id", tenantId)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      toast({ title: "Erro ao carregar template", description: error.message, variant: "destructive" });
    }

    if (data) {
      setTemplate({
        id: data.id,
        imobiliaria_id: data.imobiliaria_id,
        template_body: data.template_body ?? DEFAULT_TEMPLATE_BODY,
        variables: Array.isArray(data.variables) ? (data.variables as TemplateVariable[]) : DEFAULT_TEMPLATE_VARIABLES,
      });
    } else {
      setTemplate({
        imobiliaria_id: tenantId,
        template_body: DEFAULT_TEMPLATE_BODY,
        variables: DEFAULT_TEMPLATE_VARIABLES,
      });
    }
    setLoading(false);
  }, [tenantId, toast]);

  useEffect(() => {
    fetchTemplate();
  }, [fetchTemplate]);

  const save = async (body: string, variables: TemplateVariable[]) => {
    if (!tenantId) return false;
    setSaving(true);
    const payload = {
      imobiliaria_id: tenantId,
      template_body: body,
      variables: variables as any,
    };
    const { error } = await (supabase as any)
      .from(TABLE)
      .upsert(payload, { onConflict: "imobiliaria_id" });
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar template", description: error.message, variant: "destructive" });
      return false;
    }
    toast({ title: "Template salvo!" });
    await fetchTemplate();
    return true;
  };

  return { template, loading, saving, save, refetch: fetchTemplate };
}
