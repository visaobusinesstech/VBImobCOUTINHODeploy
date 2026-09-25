import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface FollowupCounts {
  hoje: number;
  atrasados: number;
  semana: number;
  sem_contato: number;
}

/**
 * Contagens agregadas de follow-ups (Hoje / Atrasados / Semana / Sem Contato).
 * Executa uma única RPC no servidor em vez de recalcular no cliente.
 */
export function useFollowupCounts(opts: { includeInactive?: boolean; semContatoDays?: number } = {}) {
  const { includeInactive = false, semContatoDays = 7 } = opts;
  const { user } = useAuth();
  const [counts, setCounts] = useState<FollowupCounts | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCounts = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("get_followup_counts", {
      _include_inactive: includeInactive,
      _sem_contato_days: semContatoDays,
    });
    if (rpcError) {
      setError(rpcError.message);
      setLoading(false);
      return;
    }
    const row = Array.isArray(data) ? data[0] : (data as any);
    if (row) {
      setCounts({
        hoje: Number(row.hoje ?? 0),
        atrasados: Number(row.atrasados ?? 0),
        semana: Number(row.semana ?? 0),
        sem_contato: Number(row.sem_contato ?? 0),
      });
    }
    setLoading(false);
  }, [user, includeInactive, semContatoDays]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  return { counts, loading, error, refetch: fetchCounts };
}
