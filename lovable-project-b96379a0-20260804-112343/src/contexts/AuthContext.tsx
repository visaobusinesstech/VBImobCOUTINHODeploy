import { createContext, useCallback, useContext, useEffect, useState, useRef, ReactNode, useMemo } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { isOpenAccess, OPEN_ACCESS_EMAIL, OPEN_ACCESS_USER_ID } from "@/lib/openAccess";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  approved: boolean;
  isMaster: boolean;
  imobiliariaId: string | null;
  trialDaysLeft: number | null;
  trialExpired: boolean;
  plano: string;
  planoSolicitado: string | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  approved: false,
  isMaster: false,
  imobiliariaId: null,
  trialDaysLeft: null,
  trialExpired: false,
  plano: "gratuito",
  planoSolicitado: null,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

// SEGURANÇA: dados de autorização (approved, is_master, plano) NUNCA são
// persistidos em localStorage — seriam editáveis pelo usuário no navegador.
// O cache vive apenas em memória, no ciclo de vida da aba.
const LEGACY_PROFILE_CACHE_KEY = "auth_profile_cache";
const PROFILE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

let memoryProfileCache: { userId: string; data: any; ts: number } | null = null;

function getCachedProfile(userId: string) {
  if (
    memoryProfileCache &&
    memoryProfileCache.userId === userId &&
    Date.now() - memoryProfileCache.ts < PROFILE_CACHE_TTL
  ) {
    return memoryProfileCache.data;
  }
  return null;
}

function setCachedProfile(userId: string, data: any) {
  memoryProfileCache = { userId, data, ts: Date.now() };
}

function clearCachedProfile() {
  memoryProfileCache = null;
  // limpa resíduo de versões anteriores que gravavam autorização no navegador
  try { localStorage.removeItem(LEGACY_PROFILE_CACHE_KEY); } catch {}
}


export function AuthProvider({ children }: { children: ReactNode }) {
  const openAccess = isOpenAccess();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(!openAccess);
  const [approved, setApproved] = useState(openAccess);
  const [isMaster, setIsMaster] = useState(openAccess);
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(openAccess ? null : null);
  const [trialExpired, setTrialExpired] = useState(false);
  const [plano, setPlano] = useState(openAccess ? "imobiliaria" : "gratuito");
  const [planoSolicitado, setPlanoSolicitado] = useState<string | null>(null);
  const [imobiliariaId, setImobiliariaId] = useState<string | null>(openAccess ? OPEN_ACCESS_USER_ID : null);
  const profileFetchedRef = useRef<string | null>(null);

  const openAccessUser = useMemo<User | null>(() => {
    if (!openAccess) return null;
    return {
      id: OPEN_ACCESS_USER_ID,
      email: OPEN_ACCESS_EMAIL,
      app_metadata: {},
      user_metadata: { nome: "Open Access" },
      aud: "authenticated",
      created_at: new Date().toISOString(),
    } as User;
  }, [openAccess]);

  const resetProfileState = useCallback(() => {
    setApproved(false);
    setIsMaster(false);
    setTrialDaysLeft(null);
    setTrialExpired(false);
    setPlano("gratuito");
    setPlanoSolicitado(null);
    setImobiliariaId(null);
    profileFetchedRef.current = null;
    clearCachedProfile();
  }, []);

  const applyProfileData = useCallback((data: any, authData: any, userId: string) => {
    if (!data) {
      resetProfileState();
      setImobiliariaId(userId);
      profileFetchedRef.current = userId;
      return;
    }

    setApproved(data.approved);
    setIsMaster(data.is_master);
    setPlano(data.plano || "gratuito");
    setPlanoSolicitado(data.plano_solicitado || null);

    const sharedMasterId = authData?.master_id;
    setImobiliariaId(sharedMasterId || userId);

    const trialStart = data.trial_start;
    const currentPlano = data.plano || "gratuito";

    if (currentPlano === "gratuito" && trialStart && !data.is_master) {
      const start = new Date(trialStart);
      const now = new Date();
      const diffMs = now.getTime() - start.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const remaining = 7 - diffDays;
      setTrialDaysLeft(Math.max(0, remaining));
      setTrialExpired(remaining <= 0);
    } else {
      setTrialDaysLeft(null);
      setTrialExpired(false);
    }

    profileFetchedRef.current = userId;
  }, [resetProfileState]);

  const fetchProfile = useCallback(async (userId: string, useCacheFirst = false) => {
    if (profileFetchedRef.current === userId) return;

    // Try cache first for instant render
    if (useCacheFirst) {
      const cached = getCachedProfile(userId);
      if (cached) {
        applyProfileData(cached.profile, cached.auth, userId);
        setLoading(false);
        // Revalidate in background without blocking UI
        (async () => {
          try {
            const [profileResult, authResult] = await Promise.all([
              supabase.from("profiles").select("approved, is_master, trial_start, plano, plano_solicitado").eq("id", userId).single(),
              supabase.from("master_autorizacoes").select("master_id").eq("user_id", userId).eq("ativo", true).limit(1).maybeSingle(),
            ]);
            if (profileResult.error || authResult.error) return;
            applyProfileData(profileResult.data, authResult.data, userId);
            setCachedProfile(userId, { profile: profileResult.data, auth: authResult.data });
          } catch {}
        })();
        return;
      }
    }

    // Don't block UI on profile fetch - session is enough to render
    try {
      const [profileResult, authResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("approved, is_master, trial_start, plano, plano_solicitado")
          .eq("id", userId)
          .single(),
        supabase
          .from("master_autorizacoes")
          .select("master_id")
          .eq("user_id", userId)
          .eq("ativo", true)
          .limit(1)
          .maybeSingle(),
      ]);

      if (profileResult.error) throw profileResult.error;
      if (authResult.error) throw authResult.error;

      const data = profileResult.data;
      applyProfileData(data, authResult.data, userId);

      // Cache for next load
      setCachedProfile(userId, { profile: data, auth: authResult.data });
    } catch (error) {
      console.error("[AuthContext] fetchProfile error:", error);
      resetProfileState();
      setImobiliariaId(userId);
    } finally {
      setLoading(false);
    }
  }, [resetProfileState, applyProfileData]);

  useEffect(() => {
    if (openAccess) {
      setLoading(false);
      return;
    }

    let mounted = true;

    const syncSession = (nextSession: Session | null, forceProfileRefetch = false) => {
      if (!mounted) return;

      setSession(nextSession);

      if (!nextSession?.user) {
        resetProfileState();
        setLoading(false);
        return;
      }

      if (forceProfileRefetch) {
        profileFetchedRef.current = null;
      }

      // Release UI immediately — profile loads in background
      setLoading(false);

      if (profileFetchedRef.current === nextSession.user.id) {
        return;
      }

      void fetchProfile(nextSession.user.id, !forceProfileRefetch);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;


      if (event === "INITIAL_SESSION") {
        // Use INITIAL_SESSION directly instead of waiting for getSession
        syncSession(nextSession, false);
        return;
      }

      if (event === "SIGNED_OUT") {
        syncSession(null);
        return;
      }

      if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        syncSession(nextSession, true);
        return;
      }

      if (event === "TOKEN_REFRESHED") {
        if (!nextSession) {
          setSession(null);
          return;
        }

        if (profileFetchedRef.current !== nextSession.user.id) {
          syncSession(nextSession, true);
          return;
        }

        setSession(nextSession);
      }
    });

    void supabase.auth
      .getSession()
      .then(({ data: { session: restoredSession } }) => {
        if (!mounted) return;
        syncSession(restoredSession, false);
      })
      .catch((error) => {
        if (!mounted) return;
        console.error("[AuthContext] getSession error:", error);
        setSession(null);
        setLoading(false);
      });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile, resetProfileState, openAccess]);

  const signOut = async () => {
    if (openAccess) return;
    clearCachedProfile();
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user: openAccess ? openAccessUser : (session?.user ?? null), loading, approved, isMaster, imobiliariaId, trialDaysLeft, trialExpired, plano, planoSolicitado, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}