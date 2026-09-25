import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Mail, Lock, User, ArrowRight, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { setPendingAuthRedirect } from "@/hooks/usePendingAuthRedirect";
import { getEmailConfirmationRedirectUrl, getPasswordResetRedirectUrl } from "@/lib/authRedirect";

interface LoginDialogProps {
  trigger: React.ReactNode;
  defaultMode?: "login" | "signup";
}

export function LoginDialog({ trigger, defaultMode = "login" }: LoginDialogProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const loginSuccessRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"login" | "signup" | "forgot">(defaultMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [loading, setLoading] = useState(false);
  const [retryInfo, setRetryInfo] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string; nome?: string }>({});
  const [formError, setFormError] = useState("");
  const [pendingConfirmationEmail, setPendingConfirmationEmail] = useState("");
  const abortRef = useRef(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!loginSuccessRef.current || !user) return;

    loginSuccessRef.current = false;
    navigate("/dashboard", { replace: true });
  }, [navigate, user]);

  const redirectToDashboard = () => {
    const dashboardPath = "/dashboard";

    setPendingAuthRedirect(dashboardPath);
    loginSuccessRef.current = true;
    setOpen(false);
    navigate(dashboardPath, { replace: true });
    window.setTimeout(() => {
      if (window.location.pathname !== dashboardPath) {
        window.location.replace(dashboardPath);
      }
    }, 1200);
  };

  const validate = () => {
    const errors: typeof fieldErrors = {};
    if (!email.trim()) errors.email = "E-mail é obrigatório";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "E-mail inválido";
    if (mode !== "forgot") {
      if (!password) errors.password = "Senha é obrigatória";
      else if (password.length < 6) errors.password = "Mínimo de 6 caracteres";
    }
    if (mode === "signup" && !nome.trim()) errors.nome = "Nome é obrigatório";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!validate()) return;
    setLoading(true);

    try {
      if (mode === "forgot") {
        const { error } = await (supabase.auth as any).resetPasswordForEmail(email, {
          redirectTo: getPasswordResetRedirectUrl(),
        });
        if (error) throw error;
        toast({ title: "E-mail enviado!", description: "Verifique sua caixa de entrada para redefinir a senha." });
        setMode("login");
      } else if (mode === "login") {
        const MAX_RETRIES = 3;
        const DELAYS = [0, 3000, 6000]; // progressive: 0s, 3s, 6s

        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
          if (abortRef.current) break;

          if (attempt > 0) {
            setRetryInfo(`Tentativa ${attempt + 1} de ${MAX_RETRIES}...`);
            await new Promise(r => setTimeout(r, DELAYS[attempt]));
          }

          const { error } = await (supabase.auth as any).signInWithPassword({ email, password });

          if (!error) {
            setRetryInfo("");
            toast({ title: "Login realizado com sucesso!" });
            redirectToDashboard();
            return;
          }

          const msg = error?.message || error?.error_description || String(error) || "";
          const isTimeout = msg.includes("timeout") || msg.includes("504") || msg.includes("fetch") || msg === "[object Object]" || !msg.trim();

          if (!isTimeout) {
            // Non-timeout error — don't retry
            setRetryInfo("");
            if (msg.includes("Invalid login")) {
              setFormError("E-mail ou senha incorretos");
              setFieldErrors({ email: " ", password: " " });
            } else if (msg.toLowerCase().includes("email not confirmed")) {
              setPendingConfirmationEmail(email);
              setFormError("Seu e-mail ainda não foi confirmado. Reenvie o link e abra o e-mail recebido.");
            } else {
              setFormError(msg);
            }
            return;
          }

          // Last attempt failed with timeout
          if (attempt === MAX_RETRIES - 1) {
            setRetryInfo("");
            setFormError("Servidor temporariamente lento após 3 tentativas. Tente novamente em alguns minutos.");
            return;
          }
        }
        setRetryInfo("");
        return;
      } else {
        const { error } = await (supabase.auth as any).signUp({
          email,
          password,
          options: { data: { nome }, emailRedirectTo: getEmailConfirmationRedirectUrl() },
        });
        if (error) {
          const msg = error?.message || error?.error_description || String(error) || "";
          if (msg.includes("already registered")) {
            setFormError("Este e-mail já está cadastrado");
            setFieldErrors({ email: " " });
          } else if (msg.includes("timeout") || msg.includes("504") || msg === "[object Object]" || !msg.trim()) {
            setFormError("Servidor temporariamente lento. Tente novamente em alguns segundos.");
          } else {
            setFormError(msg);
          }
          return;
        }
        toast({ title: "Conta criada!", description: "Verifique seu e-mail para confirmar o cadastro antes de entrar." });
        setPendingConfirmationEmail(email);
        setMode("login");
        setEmail("");
        setPassword("");
        setNome("");
      }
    } catch (error: any) {
      const msg = error?.message || error?.error_description || String(error) || "";
      if (msg.includes("timeout") || msg.includes("504") || msg.includes("fetch") || msg === "[object Object]" || !msg.trim()) {
        setFormError("Servidor temporariamente lento. Tente novamente em alguns segundos.");
      } else {
        setFormError(msg);
      }
    } finally {
      setLoading(false);
      setRetryInfo("");
    }
  };

  const clearErrors = () => {
    setFieldErrors({});
    setFormError("");
    setRetryInfo("");
    abortRef.current = false;
  };

  const resendConfirmation = async () => {
    const targetEmail = pendingConfirmationEmail || email;
    if (!targetEmail) {
      setFormError("Informe seu e-mail para reenviar a confirmação.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await (supabase.auth as any).resend({
        type: "signup",
        email: targetEmail,
        options: { emailRedirectTo: getEmailConfirmationRedirectUrl() },
      });
      if (error) throw error;
      toast({ title: "Link reenviado", description: "Abra o e-mail e siga o link de confirmação." });
    } catch (error: any) {
      setFormError(error?.message || "Não foi possível reenviar agora.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) { setMode(defaultMode); clearErrors(); } }}>
      {/* @ts-ignore */}
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary-foreground" />
            </div>
            <DialogTitle>
              {mode === "login" ? "Entrar" : mode === "signup" ? "Criar Conta" : "Recuperar Senha"}
            </DialogTitle>
          </div>
        </DialogHeader>

        {formError && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {formError}
          </div>
        )}

        {retryInfo && (
          <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm text-primary">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
            {retryInfo}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {mode === "signup" && (
            <div>
              <label className="text-muted-foreground text-xs font-medium">Nome da Imobiliária</label>
              <div className="relative mt-1">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={nome}
                  onChange={(e) => { setNome(e.target.value); setFieldErrors(p => ({ ...p, nome: undefined })); }}
                  placeholder="Sua imobiliária"
                  className={`pl-10 bg-secondary border-border ${fieldErrors.nome ? "border-destructive ring-1 ring-destructive" : ""}`}
                />
              </div>
              {fieldErrors.nome && fieldErrors.nome.trim() && (
                <p className="text-xs text-destructive mt-1">{fieldErrors.nome}</p>
              )}
            </div>
          )}
          <div>
            <label className="text-muted-foreground text-xs font-medium">E-mail</label>
            <div className="relative mt-1">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setFieldErrors(p => ({ ...p, email: undefined })); setFormError(""); }}
                placeholder="seu@email.com"
                className={`pl-10 bg-secondary border-border ${fieldErrors.email ? "border-destructive ring-1 ring-destructive" : ""}`}
              />
            </div>
            {fieldErrors.email && fieldErrors.email.trim() && (
              <p className="text-xs text-destructive mt-1">{fieldErrors.email}</p>
            )}
          </div>
          {mode !== "forgot" && (
            <div>
              <label className="text-muted-foreground text-xs font-medium">Senha</label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setFieldErrors(p => ({ ...p, password: undefined })); setFormError(""); }}
                  placeholder="••••••••"
                  className={`pl-10 bg-secondary border-border ${fieldErrors.password ? "border-destructive ring-1 ring-destructive" : ""}`}
                  minLength={6}
                />
              </div>
              {fieldErrors.password && fieldErrors.password.trim() && (
                <p className="text-xs text-destructive mt-1">{fieldErrors.password}</p>
              )}
            </div>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading
              ? (retryInfo || "Aguarde...")
              : mode === "login"
              ? "Entrar"
              : mode === "signup"
              ? "Criar conta"
              : "Enviar link de recuperação"}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </form>

        {mode === "login" && (
          <div className="space-y-2 mt-1">
            {pendingConfirmationEmail && (
              <Button type="button" variant="outline" className="w-full" onClick={resendConfirmation} disabled={loading}>
                Reenviar link de confirmação
              </Button>
            )}
            <button
              onClick={() => { setMode("forgot"); clearErrors(); }}
              className="w-full text-center text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              Esqueci minha senha
            </button>
          </div>
        )}

        <div className="text-center mt-2">
          {mode === "forgot" ? (
            <button
              onClick={() => { setMode("login"); clearErrors(); }}
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              Voltar ao login
            </button>
          ) : (
            <button
              onClick={() => { setMode(mode === "login" ? "signup" : "login"); clearErrors(); }}
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              {mode === "login" ? "Não tem conta? Cadastre-se" : "Já tem conta? Entre"}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
