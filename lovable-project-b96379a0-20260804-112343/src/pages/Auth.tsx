import { useState } from "react";
import { Seo } from "@/components/Seo";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Mail, Lock, User, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { getPendingAuthRedirect } from "@/hooks/usePendingAuthRedirect";
import { getEmailConfirmationRedirectUrl, getPasswordResetRedirectUrl } from "@/lib/authRedirect";

const Auth = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingConfirmationEmail, setPendingConfirmationEmail] = useState("");
  const { toast } = useToast();

  const getPostLoginPath = () => getPendingAuthRedirect() || "/dashboard";

  const redirectAfterAuth = () => {
    navigate(getPostLoginPath(), { replace: true });
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (user) return <Navigate to={getPostLoginPath()} replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: getPasswordResetRedirectUrl(),
        });
        if (error) throw error;
        toast({ title: "E-mail enviado!", description: "Verifique sua caixa de entrada para redefinir a senha." });
        setMode("login");
      } else if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast({ title: "Login realizado com sucesso!" });
        redirectAfterAuth();
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { nome }, emailRedirectTo: getEmailConfirmationRedirectUrl() },
        });
        if (error) throw error;

        // Track signup IP for abuse detection (fire and forget)
        if (data?.user?.id) {
          supabase.functions.invoke("track-signup-ip", {
            body: { user_id: data.user.id },
          }).catch(() => {});
        }

        // GA4 via GTM: trial iniciado ao criar conta (7 dias grátis)
        const { trackFreeTrialSignupSuccess } = await import("@/lib/analytics");
        trackFreeTrialSignupSuccess({
          user_id: data?.user?.id,
          plan_selected: "gratuito",
          signup_method: "email_password",
        });

        toast({ title: "Conta criada!", description: "Verifique seu e-mail para confirmar o cadastro antes de entrar." });
        setPendingConfirmationEmail(email);
        setMode("login");
        setEmail("");
        setPassword("");
        setNome("");
      }
    } catch (error: any) {
      const message = error.message || "Não foi possível concluir a ação.";
      if (message.toLowerCase().includes("email not confirmed")) {
        setPendingConfirmationEmail(email);
        toast({ title: "Confirme seu e-mail", description: "Reenvie o link de confirmação abaixo e depois tente entrar novamente.", variant: "destructive" });
      } else {
        toast({ title: "Erro", description: message, variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  };

  const resendConfirmation = async () => {
    const targetEmail = pendingConfirmationEmail || email;
    if (!targetEmail) {
      toast({ title: "Informe seu e-mail", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: targetEmail,
        options: { emailRedirectTo: getEmailConfirmationRedirectUrl() },
      });
      if (error) throw error;
      toast({ title: "Link reenviado", description: "Abra o e-mail e siga o link de confirmação." });
    } catch (error: any) {
      toast({ title: "Erro ao reenviar", description: error.message || "Tente novamente em instantes.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Seo
        title="Entrar — radarimobtech"
        description="Acesse sua conta radarimobtech: CRM imobiliário com IA para corretores e imobiliárias."
        path="/auth"
        noindex
      />
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            radar<span className="text-primary">imobtech</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "login" ? "Entre na sua conta" : mode === "signup" ? "Crie sua conta" : "Recuperar senha"}
          </p>
        </div>

        <div className="glass-card p-6 glow-border">
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <Label className="text-muted-foreground text-xs">Nome da Imobiliária</Label>
                <div className="relative mt-1">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Sua imobiliária"
                    className="pl-10 bg-secondary border-border"
                    required
                  />
                </div>
              </div>
            )}
            <div>
              <Label className="text-muted-foreground text-xs">E-mail</Label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="pl-10 bg-secondary border-border"
                  required
                />
              </div>
            </div>
            {mode !== "forgot" && (
              <div>
                <Label className="text-muted-foreground text-xs">Senha</Label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-10 bg-secondary border-border"
                    required
                    minLength={6}
                  />
                </div>
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading
                ? "Aguarde..."
                : mode === "login"
                ? "Entrar"
                : mode === "signup"
                ? "Criar conta"
                : "Enviar link de recuperação"}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </form>

          {mode === "login" && (
            <div className="mt-3 space-y-2">
              {pendingConfirmationEmail && (
                <Button type="button" variant="outline" className="w-full" onClick={resendConfirmation} disabled={loading}>
                  Reenviar link de confirmação
                </Button>
              )}
              <button
                onClick={() => setMode("forgot")}
                className="w-full text-center text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                Esqueci minha senha
              </button>
            </div>
          )}

          <div className="mt-4 text-center">
            {mode === "forgot" ? (
              <button
                onClick={() => setMode("login")}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Voltar ao login
              </button>
            ) : (
              <button
                onClick={() => setMode(mode === "login" ? "signup" : "login")}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                {mode === "login" ? "Não tem conta? Cadastre-se" : "Já tem conta? Entre"}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
    </>
  );
};

export default Auth;
