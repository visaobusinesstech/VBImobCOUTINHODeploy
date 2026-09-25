import { useState } from "react";
import { Mail, Lock, Loader2, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

/**
 * Área "Minha Conta" — alteração de e-mail e senha do próprio usuário.
 *
 * Segurança:
 * - Todas as operações usam a sessão autenticada atual (supabase.auth), portanto
 *   só o dono logado pode disparar as mudanças. Nenhum outro usuário do SaaS
 *   consegue ver ou alterar estes dados: eles vivem em `auth.users` e são
 *   inacessíveis via PostgREST/RLS.
 * - Antes de qualquer alteração exigimos re-autenticação com a senha atual
 *   (signInWithPassword). Assim, mesmo que um invasor tenha uma sessão ativa
 *   (ex.: computador destravado), não consegue trocar e-mail/senha sem a senha.
 * - A troca de e-mail dispara confirmação em ambos os endereços (antigo e novo)
 *   pelo próprio Supabase Auth — protege contra sequestro de conta.
 * - A senha nova exige mínimo de 8 caracteres com letras e números, e precisa
 *   ser digitada duas vezes.
 * - Nenhum dado sensível é logado, cacheado ou enviado a terceiros.
 */

const isStrongPassword = (p: string) =>
  p.length >= 8 && /[a-zA-Z]/.test(p) && /[0-9]/.test(p);

export function MinhaContaSection() {
  const { user } = useAuth();
  const { toast } = useToast();

  // Email
  const [novoEmail, setNovoEmail] = useState("");
  const [senhaAtualEmail, setSenhaAtualEmail] = useState("");
  const [showSenhaEmail, setShowSenhaEmail] = useState(false);
  const [salvandoEmail, setSalvandoEmail] = useState(false);

  // Senha
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmaSenha, setConfirmaSenha] = useState("");
  const [showAtual, setShowAtual] = useState(false);
  const [showNova, setShowNova] = useState(false);
  const [salvandoSenha, setSalvandoSenha] = useState(false);

  const emailAtual = user?.email ?? "";

  /**
   * Re-autentica com a senha atual usando SEMPRE o e-mail vigente no servidor
   * (via getUser). Isso evita "senha incorreta" quando a sessão do navegador
   * ainda carrega um e-mail antigo (ex.: após uma troca de e-mail recente,
   * o JWT em cache pode conter o endereço anterior).
   */
  async function reautenticar(senha: string): Promise<boolean> {
    const { data: fresh } = await supabase.auth.getUser();
    const emailReal = fresh?.user?.email ?? emailAtual;
    if (!emailReal) {
      toast({ title: "Sessão expirada", description: "Faça login novamente.", variant: "destructive" });
      return false;
    }
    const { error } = await supabase.auth.signInWithPassword({
      email: emailReal,
      password: senha,
    });
    if (error) {
      toast({
        title: "Senha atual incorreta",
        description: `Verifique sua senha. Conta em uso: ${emailReal}`,
        variant: "destructive",
      });
      return false;
    }
    return true;
  }


  async function handleAlterarEmail(e: React.FormEvent) {
    e.preventDefault();
    const email = novoEmail.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({ title: "E-mail inválido", variant: "destructive" });
      return;
    }
    if (email === emailAtual.toLowerCase()) {
      toast({ title: "O novo e-mail é igual ao atual", variant: "destructive" });
      return;
    }
    if (!senhaAtualEmail) {
      toast({ title: "Confirme sua senha atual", variant: "destructive" });
      return;
    }
    setSalvandoEmail(true);
    try {
      // A re-autenticação também é validada no servidor (edge function),
      // mas fazemos aqui para dar feedback imediato de "senha incorreta".
      const ok = await reautenticar(senhaAtualEmail);
      if (!ok) return;

      const { data, error } = await supabase.functions.invoke("alterar-email-conta", {
        body: {
          novoEmail: email,
          senhaAtual: senhaAtualEmail,
          emailRedirectTo: `${window.location.origin}/`,
        },
      });
      if (error) throw error;
      if (data?.error) {
        const map: Record<string, string> = {
          invalid_password: "Senha atual incorreta.",
          invalid_email: "E-mail inválido.",
          same_email: "O novo e-mail é igual ao atual.",
          unauthorized: "Sessão expirada. Faça login novamente.",
        };
        throw new Error(map[data.error] ?? data.message ?? data.error);
      }

      toast({
        title: "Verifique seu novo e-mail",
        description: "Acesse o novo e-mail para confirmar a troca.",
      });

      setNovoEmail("");
      setSenhaAtualEmail("");
    } catch (err: any) {
      toast({
        title: "Não foi possível alterar o e-mail",
        description: err?.message ?? "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setSalvandoEmail(false);
    }
  }

  async function handleAlterarSenha(e: React.FormEvent) {
    e.preventDefault();
    if (!senhaAtual) {
      toast({ title: "Informe a senha atual", variant: "destructive" });
      return;
    }
    if (!isStrongPassword(novaSenha)) {
      toast({
        title: "Senha fraca",
        description: "Use no mínimo 8 caracteres com letras e números.",
        variant: "destructive",
      });
      return;
    }
    if (novaSenha !== confirmaSenha) {
      toast({ title: "As senhas não coincidem", variant: "destructive" });
      return;
    }
    if (novaSenha === senhaAtual) {
      toast({
        title: "A nova senha deve ser diferente da atual",
        variant: "destructive",
      });
      return;
    }
    setSalvandoSenha(true);
    try {
      const ok = await reautenticar(senhaAtual);
      if (!ok) return;
      const { error } = await supabase.auth.updateUser({ password: novaSenha });
      if (error) throw error;
      toast({
        title: "Senha atualizada",
        description: "Sua senha foi alterada com sucesso.",
      });
      setSenhaAtual("");
      setNovaSenha("");
      setConfirmaSenha("");
    } catch (err: any) {
      toast({
        title: "Não foi possível alterar a senha",
        description: err?.message ?? "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setSalvandoSenha(false);
    }
  }

  return (
    <div className="glass-card p-6 space-y-6 border border-border/50">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-primary/10">
          <ShieldCheck className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-foreground">Minha Conta</h3>
          <p className="text-sm text-muted-foreground">
            Alterações restritas ao dono da conta. Exigem confirmação da senha
            atual.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* E-mail */}
        <form
          onSubmit={handleAlterarEmail}
          className="space-y-4 p-4 rounded-lg border border-border/50 bg-secondary/10"
        >
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-primary" />
            <h4 className="text-sm font-semibold">E-mail de acesso</h4>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">E-mail atual</Label>
            <Input value={emailAtual} disabled readOnly />
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Novo e-mail</Label>
            <Input
              type="email"
              autoComplete="off"
              value={novoEmail}
              onChange={(e) => setNovoEmail(e.target.value)}
              placeholder="novo@email.com"
              required
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              Confirme sua senha atual
            </Label>
            <div className="relative">
              <Input
                type={showSenhaEmail ? "text" : "password"}
                autoComplete="current-password"
                value={senhaAtualEmail}
                onChange={(e) => setSenhaAtualEmail(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowSenhaEmail((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
                aria-label={showSenhaEmail ? "Ocultar senha" : "Mostrar senha"}
              >
                {showSenhaEmail ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>


          <Button type="submit" disabled={salvandoEmail} className="w-full">
            {salvandoEmail ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Mail className="w-4 h-4 mr-2" />
            )}
            Alterar e-mail
          </Button>
        </form>

        {/* Senha */}
        <form
          onSubmit={handleAlterarSenha}
          className="space-y-4 p-4 rounded-lg border border-border/50 bg-secondary/10"
        >
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-primary" />
            <h4 className="text-sm font-semibold">Senha de acesso</h4>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Senha atual</Label>
            <div className="relative">
              <Input
                type={showAtual ? "text" : "password"}
                autoComplete="current-password"
                value={senhaAtual}
                onChange={(e) => setSenhaAtual(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowAtual((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
                aria-label={showAtual ? "Ocultar senha" : "Mostrar senha"}
              >
                {showAtual ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Nova senha</Label>
            <div className="relative">
              <Input
                type={showNova ? "text" : "password"}
                autoComplete="new-password"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                minLength={8}
                required
              />
              <button
                type="button"
                onClick={() => setShowNova((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
                aria-label={showNova ? "Ocultar senha" : "Mostrar senha"}
              >
                {showNova ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Mínimo 8 caracteres, com letras e números.
            </p>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              Confirmar nova senha
            </Label>
            <Input
              type={showNova ? "text" : "password"}
              autoComplete="new-password"
              value={confirmaSenha}
              onChange={(e) => setConfirmaSenha(e.target.value)}
              minLength={8}
              required
            />
          </div>

          <Button type="submit" disabled={salvandoSenha} className="w-full">
            {salvandoSenha ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Lock className="w-4 h-4 mr-2" />
            )}
            Alterar senha
          </Button>
        </form>
      </div>
    </div>
  );
}
