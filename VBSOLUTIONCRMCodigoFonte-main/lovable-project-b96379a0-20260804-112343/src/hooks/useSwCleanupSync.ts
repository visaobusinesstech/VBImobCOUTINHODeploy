import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const FLAG_KEY = "lovable:disable-sw-cleanup";

/**
 * Sincroniza o toggle "desativar limpeza SW/caches" (controlado pelo Super Admin
 * por tenant em `imobiliaria_config.sw_cleanup_disabled`) com o flag local que
 * `main.tsx` consulta no boot seguinte. Efeito prático:
 *   - master liga → próxima recarga do usuário do tenant preserva SW/caches.
 *   - master desliga → volta ao comportamento padrão de limpeza única.
 */
export function useSwCleanupSync() {
  const { imobiliariaId } = useAuth();

  useEffect(() => {
    if (!imobiliariaId) return;
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from("imobiliaria_config")
        .select("sw_cleanup_disabled")
        .eq("user_id", imobiliariaId)
        .maybeSingle();
      if (cancelled || error) return;
      try {
        if ((data as any)?.sw_cleanup_disabled) {
          localStorage.setItem(FLAG_KEY, "1");
        } else {
          localStorage.removeItem(FLAG_KEY);
        }
      } catch {
        // ignore storage failures
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [imobiliariaId]);
}
