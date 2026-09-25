import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Seo } from "@/components/Seo";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const AuthCallback = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Confirmando seu e-mail...");

  const urlError = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    return (
      params.get("error_description") ||
      params.get("error") ||
      hash.get("error_description") ||
      hash.get("error")
    );
  }, []);

  useEffect(() => {
    let active = true;

    const finishConfirmation = async () => {
      if (urlError) {
        setStatus("error");
        setMessage(urlError);
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const code = params.get("code");
      const hasAuthToken = Boolean(code || hash.get("access_token") || hash.get("refresh_token") || hash.get("type"));

      if (!hasAuthToken) {
        setStatus("error");
        setMessage("Abra o link recebido no e-mail de confirmação.");
        return;
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!active) return;
        if (error) {
          setStatus("error");
          setMessage(error.message);
          return;
        }
      }

      const { data, error } = await supabase.auth.getSession();
      if (!active) return;

      if (error) {
        setStatus("error");
        setMessage(error.message);
        return;
      }

      if (!data.session) {
        setStatus("success");
        setMessage("E-mail confirmado. Você já pode entrar com sua senha.");
        window.setTimeout(() => navigate("/auth", { replace: true }), 1800);
        return;
      }

      setStatus("success");
      setMessage("E-mail confirmado. Acesso liberado.");
      window.setTimeout(() => navigate("/dashboard", { replace: true }), 1200);
    };

    void finishConfirmation();

    return () => {
      active = false;
    };
  }, [navigate, urlError]);

  return (
    <>
      <Seo title="Confirmar e-mail — radarimobtech" description="Confirmação de e-mail da conta radarimobtech." path="/auth/callback" noindex />
      <main className="min-h-screen bg-background flex items-center justify-center p-4">
        <section className="w-full max-w-md text-center space-y-5 rounded-lg border bg-card p-8 shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            {status === "loading" && <Loader2 className="h-7 w-7 animate-spin" />}
            {status === "success" && <CheckCircle2 className="h-7 w-7" />}
            {status === "error" && <XCircle className="h-7 w-7 text-destructive" />}
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">
              {status === "error" ? "Link inválido ou expirado" : "Confirmação de e-mail"}
            </h1>
            <p className="text-sm text-muted-foreground">{message}</p>
          </div>
          {status === "error" && (
            <Button type="button" onClick={() => navigate("/auth", { replace: true })} className="w-full">
              Voltar ao login
            </Button>
          )}
        </section>
      </main>
    </>
  );
};

export default AuthCallback;
