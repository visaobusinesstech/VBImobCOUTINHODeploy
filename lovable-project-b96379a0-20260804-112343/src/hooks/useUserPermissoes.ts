import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { MODULOS, type ModuloId } from "@/hooks/useModuloConfig";
import { isOpenAccess } from "@/lib/openAccess";

interface UserPermissao {
  user_id: string;
  modulo: string;
  ativo: boolean;
}

const ALL_MODULOS = MODULOS.map((m) => m.id);
type PermissionScope = "self" | "all";

const selfPermissionsCache = new Map<string, UserPermissao[]>();
const selfPermissionsPending = new Map<string, Promise<UserPermissao[]>>();

function getInitialPermissoes(userId?: string, isMaster = false, scope: PermissionScope = "self") {
  if (!userId) return [];
  if (scope === "self" && isMaster) return [];
  return scope === "self" ? selfPermissionsCache.get(userId) ?? [] : [];
}

function getInitialLoading(userId?: string, isMaster = false, scope: PermissionScope = "self") {
  if (!userId) return false;
  if (scope === "self") {
    if (isMaster) return false;
    return !selfPermissionsCache.has(userId);
  }

  return true;
}

async function loadSelfPermissions(userId: string): Promise<UserPermissao[]> {
  const cached = selfPermissionsCache.get(userId);
  if (cached) return cached;

  const pending = selfPermissionsPending.get(userId);
  if (pending) return pending;

  const request = (async () => {
    try {
      const { data, error } = await supabase
        .from("user_permissoes")
        .select("user_id, modulo, ativo")
        .eq("user_id", userId);

      if (error) throw error;

      const result = (data as UserPermissao[] | null) ?? [];
      selfPermissionsCache.set(userId, result);
      return result;
    } finally {
      selfPermissionsPending.delete(userId);
    }
  })();

  selfPermissionsPending.set(userId, request);
  return request;
}

export function useUserPermissoes(scope: PermissionScope = "self") {
  const { user, isMaster } = useAuth();
  const userId = user?.id;
  const [permissoes, setPermissoes] = useState<UserPermissao[]>(() => getInitialPermissoes(userId, isMaster, scope));
  const [loading, setLoading] = useState(() => getInitialLoading(userId, isMaster, scope));

  useEffect(() => {
    setPermissoes(getInitialPermissoes(userId, isMaster, scope));
    setLoading(getInitialLoading(userId, isMaster, scope));
  }, [userId, isMaster, scope]);

  const fetchPermissoes = useCallback(async () => {
    if (!user) {
      setPermissoes([]);
      setLoading(false);
      return;
    }

    if (scope === "self" && isMaster) {
      setPermissoes([]);
      setLoading(false);
      return;
    }

    try {
      if (scope === "self") {
        const cached = selfPermissionsCache.get(user.id);
        if (cached) {
          setPermissoes(cached);
          setLoading(false);
          return;
        }

        setLoading(true);
        const data = await loadSelfPermissions(user.id);
        setPermissoes(data);
      } else {
        setLoading(true);
        const { data, error } = await supabase
          .from("user_permissoes")
          .select("user_id, modulo, ativo");

        if (error) throw error;
        setPermissoes((data as UserPermissao[] | null) ?? []);
      }
    } catch (error) {
      console.error("Error loading user permissions:", error);
      setPermissoes([]);
    } finally {
      setLoading(false);
    }
  }, [isMaster, scope, user]);

  useEffect(() => {
    fetchPermissoes();
  }, [fetchPermissoes]);

  const permissionsMap = useMemo(() => {
    const map = new Map<string, boolean>();
    permissoes.forEach((p) => {
      map.set(`${p.user_id}:${p.modulo}`, p.ativo);
    });
    return map;
  }, [permissoes]);

  const canAccess = useCallback(
    (modulo: ModuloId): boolean => {
      if (isOpenAccess()) return true;
      if (!user) return false;
      if (isMaster) return true;
      return permissionsMap.get(`${user.id}:${modulo}`) ?? true;
    },
    [user, isMaster, permissionsMap]
  );

  const getPermissoesForUser = useCallback(
    (userId: string): Record<string, boolean> => {
      const result: Record<string, boolean> = {};
      ALL_MODULOS.forEach((m) => {
        result[m] = permissionsMap.get(`${userId}:${m}`) ?? true;
      });
      return result;
    },
    [permissionsMap]
  );

  const togglePermissao = useCallback(
    async (userId: string, modulo: string, ativo: boolean) => {
      if (!isMaster) return;

      setPermissoes((prev) => {
        const existing = prev.find((p) => p.user_id === userId && p.modulo === modulo);
        if (existing) {
          return prev.map((p) =>
            p.user_id === userId && p.modulo === modulo ? { ...p, ativo } : p
          );
        }
        return [...prev, { user_id: userId, modulo, ativo }];
      });

      const existing = permissoes.find((p) => p.user_id === userId && p.modulo === modulo);
      const valorAnterior = existing ? existing.ativo : true;

      const { error } = await supabase
        .from("user_permissoes")
        .upsert({ user_id: userId, modulo, ativo } as any, { onConflict: "user_id,modulo" });

      selfPermissionsCache.delete(userId);
      selfPermissionsPending.delete(userId);

      if (error) {
        console.error("[useUserPermissoes] togglePermissao error:", error);
        await fetchPermissoes();
      } else if (user) {
        await supabase.from("audit_log").insert({
          master_id: user.id,
          target_user_id: userId,
          acao: ativo ? "ativar_modulo" : "desativar_modulo",
          modulo,
          valor_anterior: valorAnterior,
          valor_novo: ativo,
          detalhes: `Módulo "${modulo}" ${ativo ? "ativado" : "desativado"}`,
        } as any);
      }
    },
    [fetchPermissoes, isMaster, permissoes, user]
  );

  return { permissoes, loading, canAccess, getPermissoesForUser, togglePermissao, refetch: fetchPermissoes };
}
