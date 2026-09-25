import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AlertTriangle, Sparkles, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type Status = "loading" | "ok" | "missing" | "invalid";

const DISMISS_KEY = "byok_banner_dismissed_at";
const INVALID_KEY = "byok:invalid";
const DISMISS_TTL_MS = 1000 * 60 * 60 * 6; // 6h

export function ByokBanner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState<Status>("loading");
  const [invalidCode, setInvalidCode] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // Load dismissal state
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DISMISS_KEY);
      if (raw && Date.now() - Number(raw) < DISMISS_TTL_MS) setDismissed(true);
    } catch { /* noop */ }
  }, []);

  // Read invalid flag reactively (updated by aiErrorHandler + storage events)
  useEffect(() => {
    const read = () => {
      try {
        const code = localStorage.getItem(INVALID_KEY);
        setInvalidCode(code);
      } catch { setInvalidCode(null); }
    };
    read();
    const onStorage = (e: StorageEvent) => {
      if (e.key === INVALID_KEY || e.key === null) read();
    };
    window.addEventListener("storage", onStorage);
    const t = setInterval(read, 5000);
    return () => { window.removeEventListener("storage", onStorage); clearInterval(t); };
  }, []);

  // Fetch config
  useEffect(() => {
    if (!user) { setStatus("loading"); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("user_ai_config" as any)
        .select("provider, byok_active, provider_keys")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (!data) { setStatus("missing"); return; }
      const d = data as any;
      const provider = d.provider as string | undefined;
      const keys = (d.provider_keys || {}) as Record<string, string>;
      const hasKey = !!(provider && keys[provider]);
      if (!hasKey || d.byok_active === false) setStatus("missing");
      else setStatus("ok");
    })();
    return () => { cancelled = true; };
  }, [user, location.pathname]);

  // Hide on the config page itself
  if (location.pathname === "/configurar-ia") return null;
  if (!user) return null;
  if (status === "loading" || status === "ok") {
    // If OK but marked invalid recently, still show
    if (!invalidCode) return null;
  }
  if (dismissed) return null;

  const effective: Exclude<Status, "loading" | "ok"> =
    invalidCode ? "invalid" : (status as "missing");

  const isInvalid = effective === "invalid";
  const title = isInvalid
    ? "Sua chave de IA parece inválida ou expirada"
    : "Conecte sua chave de IA para ativar a geração de conteúdo";
  const description = isInvalid
    ? "O último uso falhou na autenticação com o provedor. Reconecte a chave para continuar usando IA."
    : "Você ainda não configurou uma chave BYOK. Cadastre uma para liberar Curadoria Viral, Conteúdo SEO, Avaliação IA e demais módulos.";

  const handleDismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* noop */ }
    setDismissed(true);
  };

  const handleCta = () => {
    if (isInvalid) {
      try { localStorage.removeItem(INVALID_KEY); } catch { /* noop */ }
    }
    navigate("/configurar-ia");
  };

  return (
    <div
      role="alert"
      className={`w-full border-b px-4 py-2.5 md:px-6 flex items-center gap-3 ${
        isInvalid
          ? "bg-destructive/10 border-destructive/30 text-destructive"
          : "bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200"
      }`}
    >
      <div className="flex-shrink-0">
        {isInvalid
          ? <AlertTriangle className="w-5 h-5" />
          : <Sparkles className="w-5 h-5" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-tight truncate">{title}</p>
        <p className="text-xs opacity-90 leading-snug line-clamp-2">{description}</p>
      </div>
      <button
        onClick={handleCta}
        className={`flex-shrink-0 text-xs md:text-sm font-semibold px-3 py-1.5 rounded-md transition-colors ${
          isInvalid
            ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
            : "bg-amber-600 text-white hover:bg-amber-700"
        }`}
      >
        {isInvalid ? "Reconectar IA" : "Configurar agora"}
      </button>
      <button
        onClick={handleDismiss}
        aria-label="Dispensar aviso"
        className="flex-shrink-0 opacity-60 hover:opacity-100 p-1"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
