import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface SeoChecklistItem {
  id?: string;
  imobiliaria_id: string;
  route_path: string;
  tag_key: string;
  resolved: boolean;
  notes: string | null;
  resolved_at: string | null;
  updated_at?: string;
}

const TABLE = "seo_correcoes_checklist";

export function useSeoChecklist(routePath?: string | null) {
  const { imobiliariaId: tenantId } = useAuth();
  const imobiliariaId = tenantId ?? null;
  const [items, setItems] = useState<SeoChecklistItem[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!imobiliariaId || !routePath) {
      setItems([]);
      return;
    }
    setLoading(true);
    const { data } = await (supabase as any)
      .from(TABLE)
      .select("*")
      .eq("imobiliaria_id", imobiliariaId)
      .eq("route_path", routePath);
    setItems((data as SeoChecklistItem[]) || []);
    setLoading(false);
  }, [imobiliariaId, routePath]);

  useEffect(() => {
    load();
  }, [load]);

  const upsert = useCallback(
    async (tagKey: string, patch: Partial<SeoChecklistItem>) => {
      if (!imobiliariaId || !routePath) return;
      const existing = items.find((i) => i.tag_key === tagKey);
      const row: SeoChecklistItem = {
        ...(existing || {
          imobiliaria_id: imobiliariaId,
          route_path: routePath,
          tag_key: tagKey,
          resolved: false,
          notes: null,
          resolved_at: null,
        }),
        ...patch,
        imobiliaria_id: imobiliariaId,
        route_path: routePath,
        tag_key: tagKey,
      };
      if (patch.resolved === true && !row.resolved_at) {
        row.resolved_at = new Date().toISOString();
      }
      if (patch.resolved === false) {
        row.resolved_at = null;
      }
      // optimistic
      setItems((prev) => {
        const others = prev.filter((i) => i.tag_key !== tagKey);
        return [...others, row];
      });
      await (supabase as any)
        .from(TABLE)
        .upsert(row, { onConflict: "imobiliaria_id,route_path,tag_key" });
    },
    [imobiliariaId, routePath, items],
  );

  return { items, loading, upsert, reload: load };
}

export async function fetchAllSeoChecklist(imobiliariaId: string) {
  const { data } = await (supabase as any)
    .from(TABLE)
    .select("*")
    .eq("imobiliaria_id", imobiliariaId)
    .order("updated_at", { ascending: false });
  return (data as SeoChecklistItem[]) || [];
}
