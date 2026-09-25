import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { registerDynamicEstagios } from "./useLeads";

export interface PipelineEstagio {
  id: string;
  imobiliaria_id: string;
  slug: string;
  title: string;
  color: string;
  ordem: number;
  ativo: boolean;
  is_sistema: boolean;
  sistema_tipo: string | null;
}

const kebab = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);

export function usePipelineEstagios() {
  const { user, imobiliariaId } = useAuth();
  const [todos, setTodos] = useState<PipelineEstagio[]>([]);
  const [loading, setLoading] = useState(true);
  const seededRef = useRef(false);

  const carregar = useCallback(async () => {
    if (!imobiliariaId) return;
    setLoading(true);
    const { data } = await supabase
      .from("pipeline_estagios" as any)
      .select("*")
      .eq("imobiliaria_id", imobiliariaId)
      .order("ordem", { ascending: true });
    let rows = ((data as any) ?? []) as PipelineEstagio[];

    if (rows.length === 0 && !seededRef.current) {
      seededRef.current = true;
      const { data: seeded } = await supabase.rpc("pipeline_estagios_seed_defaults" as any);
      rows = ((seeded as any) ?? []) as PipelineEstagio[];
    }

    setTodos(rows);
    registerDynamicEstagios(rows.map((r) => r.slug));
    setLoading(false);
  }, [imobiliariaId]);

  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    if (!imobiliariaId) return;
    const ch = supabase
      .channel(`pipeline_estagios:${imobiliariaId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pipeline_estagios", filter: `imobiliaria_id=eq.${imobiliariaId}` },
        () => carregar(),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [imobiliariaId, carregar]);

  const estagios = useMemo(() => todos.filter((e) => e.ativo), [todos]);

  const create = useCallback(
    async (input: { title: string; color: string }) => {
      if (!user || !imobiliariaId) throw new Error("Sem sessão");
      const base = kebab(input.title) || `estagio_${Date.now()}`;
      let slug = base;
      let n = 1;
      while (todos.some((t) => t.slug === slug)) {
        slug = `${base}_${n++}`;
      }
      const ordem = Math.max(-1, ...todos.map((t) => t.ordem)) + 1;
      const { data, error } = await supabase
        .from("pipeline_estagios" as any)
        .insert({
          imobiliaria_id: imobiliariaId,
          slug,
          title: input.title.trim(),
          color: input.color,
          ordem,
          ativo: true,
          is_sistema: false,
          sistema_tipo: null,
        })
        .select()
        .single();
      if (error) throw error;
      await carregar();
      return data as unknown as PipelineEstagio;
    },
    [user, imobiliariaId, todos, carregar],
  );

  const update = useCallback(
    async (id: string, patch: Partial<Pick<PipelineEstagio, "title" | "color" | "ativo">>) => {
      const { error } = await supabase
        .from("pipeline_estagios" as any)
        .update(patch)
        .eq("id", id);
      if (error) throw error;
      await carregar();
    },
    [carregar],
  );

  const remove = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("pipeline_estagios" as any).delete().eq("id", id);
      if (error) throw error;
      await carregar();
    },
    [carregar],
  );

  const reorder = useCallback(
    async (orderedSlugs: string[]) => {
      // Optimistic
      setTodos((prev) => {
        const bySlug = new Map(prev.map((p) => [p.slug, p]));
        const reordered = orderedSlugs
          .map((s, i) => {
            const it = bySlug.get(s);
            return it ? { ...it, ordem: i } : null;
          })
          .filter(Boolean) as PipelineEstagio[];
        const missing = prev.filter((p) => !orderedSlugs.includes(p.slug));
        return [...reordered, ...missing];
      });
      const { error } = await supabase.rpc("pipeline_estagios_reorder" as any, { p_slugs: orderedSlugs });
      if (error) {
        await carregar();
        throw error;
      }
    },
    [carregar],
  );

  return { estagios, todos, loading, refetch: carregar, create, update, remove, reorder };
}
