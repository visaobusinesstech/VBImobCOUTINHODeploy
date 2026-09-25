import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { ImovelCaptado } from "@/lib/exportImoveisXlsx";

export type ImoveisFiltros = {
  q?: string;
  cidade?: string;
  uf?: string;
  bairro?: string;
  tipo?: string;
  operacao?: string;
  quartos_min?: number;
  preco_min?: number;
  preco_max?: number;
  grupo_id?: string;
  desde?: string; // ISO date
};

export function useRadarZapImoveis(filtros: ImoveisFiltros) {
  const { user } = useAuth();
  const [imoveis, setImoveis] = useState<ImovelCaptado[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    let alive = true;
    (async () => {
      setLoading(true); setError(null);
      let q = supabase
        .from("vw_radarzap_imoveis" as any)
        .select("*")
        .eq("imobiliaria_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (filtros.cidade) q = q.eq("cidade", filtros.cidade);
      if (filtros.uf) q = q.eq("uf", filtros.uf);
      if (filtros.bairro) q = q.eq("bairro", filtros.bairro);
      if (filtros.tipo) q = q.eq("tipo_imovel", filtros.tipo);
      if (filtros.operacao) q = q.eq("operacao", filtros.operacao);
      if (filtros.grupo_id) q = q.eq("grupo_id", filtros.grupo_id);
      if (filtros.quartos_min) q = q.gte("quartos", filtros.quartos_min);
      if (filtros.preco_min) q = q.gte("preco", filtros.preco_min);
      if (filtros.preco_max) q = q.lte("preco", filtros.preco_max);
      if (filtros.desde) q = q.gte("created_at", filtros.desde);

      const { data, error } = await q;
      if (!alive) return;
      if (error) setError(error.message);
      setImoveis((data as any) ?? []);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [user?.id, JSON.stringify(filtros)]);

  const filtered = useMemo(() => {
    if (!filtros.q) return imoveis;
    const q = filtros.q.toLowerCase();
    return imoveis.filter((i) =>
      [i.endereco, i.bairro, i.cidade, i.descricao, i.proprietario_nome, i.contato, i.grupo_nome]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [imoveis, filtros.q]);

  return { imoveis: filtered, loading, error };
}
