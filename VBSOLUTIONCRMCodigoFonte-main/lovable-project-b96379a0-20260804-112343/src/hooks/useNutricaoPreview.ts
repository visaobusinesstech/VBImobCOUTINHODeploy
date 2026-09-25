import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  CONTEXTO_EXEMPLO,
  montarContextoNutricao,
  type ConfigLike,
  type ImovelLike,
  type LeadLike,
} from "@/lib/nutricaoVariaveis";

interface Opcao {
  id: string;
  label: string;
  raw: Record<string, unknown>;
}

/**
 * Carrega um lead, um imóvel e a configuração da imobiliária para gerar
 * a pré-visualização real das mensagens de nutrição.
 */
export function useNutricaoPreview(enabled: boolean) {
  const { imobiliariaId } = useAuth();
  const [leads, setLeads] = useState<Opcao[]>([]);
  const [imoveis, setImoveis] = useState<Opcao[]>([]);
  const [config, setConfig] = useState<ConfigLike>(null);
  const [leadId, setLeadId] = useState<string>("exemplo");
  const [imovelId, setImovelId] = useState<string>("exemplo");
  const [carregando, setCarregando] = useState(false);

  const carregar = useCallback(async () => {
    if (!enabled || !imobiliariaId) return;
    setCarregando(true);
    const [l, i, c] = await Promise.all([
      supabase
        .from("leads")
        .select(
          "id, nome, telefone, email, interesse, tipo_operacao, tipo_imovel_interesse, bairro_interesse, valor, valor_maximo, quartos_minimo, vagas_minimo, urgencia, estagio",
        )
        .eq("imobiliaria_id", imobiliariaId)
        .order("updated_at", { ascending: false })
        .limit(30),
      supabase
        .from("imoveis")
        .select(
          "id, titulo, tipo, operacao, preco, endereco, cidade, bairro, quartos, suites, banheiros, vagas, area, valor_condominio, valor_iptu, url_anuncio",
        )
        .eq("imobiliaria_id", imobiliariaId)
        .order("updated_at", { ascending: false })
        .limit(30),
      supabase.from("imobiliaria_config").select("*").eq("user_id", imobiliariaId).maybeSingle(),
    ]);

    setLeads(
      (l.data ?? []).map((row) => ({
        id: row.id as string,
        label: (row.nome as string) || "Sem nome",
        raw: row as Record<string, unknown>,
      })),
    );
    setImoveis(
      (i.data ?? []).map((row) => ({
        id: row.id as string,
        label: ((row.titulo as string) || (row.endereco as string) || "Imóvel").slice(0, 60),
        raw: row as Record<string, unknown>,
      })),
    );
    setConfig((c.data as ConfigLike) ?? null);
    setCarregando(false);
  }, [enabled, imobiliariaId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const contexto = useMemo(() => {
    const lead: LeadLike = leads.find((x) => x.id === leadId)?.raw ?? null;
    const imovel: ImovelLike = imoveis.find((x) => x.id === imovelId)?.raw ?? null;
    const base = montarContextoNutricao(lead, imovel, config, {
      imovelLink: imovel?.id ? `${window.location.origin}/imovel/${imovel.id}` : null,
    });
    // Sem dados reais selecionados, completa com o exemplo para a pré-visualização.
    const final: Record<string, string> = { ...base };
    Object.keys(CONTEXTO_EXEMPLO).forEach((k) => {
      if (!final[k]) final[k] = CONTEXTO_EXEMPLO[k];
    });
    return { real: base, preview: final };
  }, [leads, imoveis, config, leadId, imovelId]);

  return {
    leads,
    imoveis,
    carregando,
    leadId,
    imovelId,
    setLeadId,
    setImovelId,
    contexto: contexto.preview,
    contextoReal: contexto.real,
    recarregar: carregar,
  };
}
