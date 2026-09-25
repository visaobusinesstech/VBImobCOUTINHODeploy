import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Descobre se o usuário autenticado é um corretor cadastrado dentro de uma
 * imobiliária (via `master_autorizacoes`) e retorna o `corretor_id` correspondente.
 *
 * - Master ou dono da própria imobiliária ⇒ `isBroker=false`, `corretorId=null`
 *   (deve enxergar o painel completo da imobiliária).
 * - Corretor vinculado (email bate com um registro em `corretores`) ⇒
 *   `isBroker=true`, `corretorId` preenchido — usado para filtrar leads,
 *   compromissos, contratos e transações apenas do próprio corretor.
 */
export function useCurrentCorretor() {
  const { user, imobiliariaId, isMaster } = useAuth();
  const [corretorId, setCorretorId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const cacheRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;

    const resolve = async () => {
      if (!user || !imobiliariaId) {
        setCorretorId(null);
        setReady(true);
        return;
      }

      // Master ou dono da própria conta ⇒ sem restrição de corretor
      if (isMaster || user.id === imobiliariaId) {
        setCorretorId(null);
        setReady(true);
        return;
      }

      const email = user.email?.toLowerCase().trim();
      if (!email) {
        setCorretorId(null);
        setReady(true);
        return;
      }

      if (cacheRef.current) {
        setCorretorId(cacheRef.current);
        setReady(true);
        return;
      }

      const { data } = await supabase
        .from("corretores")
        .select("id")
        .eq("imobiliaria_id", imobiliariaId)
        .ilike("email", email)
        .limit(1)
        .maybeSingle();

      if (!active) return;
      const id = (data as any)?.id ?? null;
      cacheRef.current = id;
      setCorretorId(id);
      setReady(true);
    };

    resolve();
    return () => {
      active = false;
    };
  }, [user, imobiliariaId, isMaster]);

  return {
    corretorId,
    isBroker: !!corretorId,
    ready,
  };
}
