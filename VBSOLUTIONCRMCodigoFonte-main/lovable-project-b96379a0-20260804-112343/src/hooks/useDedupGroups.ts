import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface DedupRegistro {
  id: string;
  nome_proprietario: string | null;
  telefone: string | null;
  email: string | null;
  operacao: string | null;
  titulo_imovel: string | null;
  bairro: string | null;
  cidade: string | null;
  preco: number | null;
  q_score: number | null;
  origem: string | null;
  url_anuncio: string | null;
  status_revisao: string | null;
  created_at: string;
}

export interface DedupGroup {
  telefone_e164: string;
  total: number;
  registros: DedupRegistro[];
}

/** Contagem de campos preenchidos — usado para escolher mestre automático. */
export function completenessScore(r: DedupRegistro): number {
  const fields = [
    r.nome_proprietario, r.telefone, r.email, r.titulo_imovel,
    r.bairro, r.cidade, r.url_anuncio, r.origem, r.operacao,
  ];
  let score = fields.filter((v) => v && String(v).trim() !== "").length;
  if (r.preco && Number(r.preco) > 0) score += 1;
  if (r.q_score && Number(r.q_score) > 0) score += 1;
  return score;
}

/** Mestre sugerido: maior completude; empate → mais antigo (created_at asc). */
export function pickAutoMaster(regs: DedupRegistro[]): string {
  const sorted = [...regs].sort((a, b) => {
    const d = completenessScore(b) - completenessScore(a);
    if (d !== 0) return d;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
  return sorted[0].id;
}

export function useDedupGroups() {
  const { toast } = useToast();
  const [groups, setGroups] = useState<DedupGroup[]>([]);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("find_dedup_groups_by_phone" as never, {
        _limit: 100,
        _offset: 0,
      } as never);
      if (error) throw error;
      const rows = (data as unknown as DedupGroup[]) || [];
      setGroups(rows);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Falha ao buscar duplicados";
      toast({ title: "Erro na deduplicação", description: message, variant: "destructive" });
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const merge = useCallback(async (masterId: string, duplicateIds: string[]) => {
    const { data, error } = await supabase.rpc("merge_dedup_group" as never, {
      _master_id: masterId,
      _duplicate_ids: duplicateIds,
    } as never);
    if (error) throw error;
    return data as unknown as { ok: boolean; master_id: string; deleted: number };
  }, []);

  const ignore = useCallback(async (telefoneE164: string) => {
    const { error } = await supabase.rpc("ignore_dedup_group" as never, {
      _telefone_e164: telefoneE164,
    } as never);
    if (error) throw error;
  }, []);

  return { groups, loading, refetch, merge, ignore };
}
