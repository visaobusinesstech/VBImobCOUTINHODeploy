import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { SectionHeader } from "@/components/shared/MetricCard";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, ShieldCheck, Clock, KeyRound, CreditCard, Check, Lock, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Navigate } from "react-router-dom";
import { useUserPermissoes } from "@/hooks/useUserPermissoes";
import { MODULOS } from "@/hooks/useModuloConfig";

interface Profile {
  id: string;
  nome: string;
  email: string | null;
  approved: boolean;
  is_master: boolean;
  created_at: string;
  plano?: string;
  plano_solicitado?: string | null;
  trial_start?: string | null;
}

const PLANO_LABELS: Record<string, string> = {
  gratuito: "Gratuito (Trial)",
  lite: "Básico — R$ 19,90/mês",
  basico: "Intermediário — R$ 59,90/mês",
  profissional: "Avançado — R$ 97,90/mês",
  premium: "Completo — R$ 197,90/mês",
  imobiliaria: "Imobiliária Ilimitado — R$ 2.997,90/mês",
};

const COMMON_PASSWORD_PATTERNS = [/123456/i, /password/i, /senha/i, /qwerty/i, /admin/i];

const validateStrongPassword = (password: string) => {
  if (password.length < 8) return "A senha deve ter no mínimo 8 caracteres.";
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return "A senha precisa conter letras e números.";
  }
  if (COMMON_PASSWORD_PATTERNS.some((pattern) => pattern.test(password))) {
    return "Evite palavras ou sequências comuns como senha, password ou 123456.";
  }
  return null;
};

const GerenciarUsuarios = () => {
  const { user, isMaster } = useAuth();
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetTarget, setResetTarget] = useState<Profile | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [permTarget, setPermTarget] = useState<Profile | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { getPermissoesForUser, togglePermissao } = useUserPermissoes("all");

  const handleDeleteUser = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete-user", {
        body: { user_id: deleteTarget.id },
      });
      if (error) throw error;
      // Formato de erro padronizado admin: { error_code, message, details?, request_id }
      if (data?.error_code) throw new Error(data.message ?? data.error_code);
      toast({ title: "Usuário excluído com sucesso!" });
      setProfiles((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err: any) {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const fetchProfiles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, email, approved, is_master, created_at, plano, plano_solicitado, trial_start")
        .order("created_at", { ascending: false });
      if (error) {
        console.error("[GerenciarUsuarios] fetchProfiles error:", error);
        toast({ title: "Erro ao carregar usuários", description: error.message, variant: "destructive" });
        return;
      }
      setProfiles((data as any) ?? []);
    } catch (err: any) {
      console.error("[GerenciarUsuarios] fetchProfiles exception:", err);
      toast({ title: "Erro ao carregar usuários", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isMaster) fetchProfiles();
  }, [isMaster]);

  if (!isMaster) return <Navigate to="/" replace />;

  const toggleApproval = async (profileId: string, approved: boolean) => {
    const { error } = await supabase
      .from("profiles")
      .update({ approved })
      .eq("id", profileId);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: approved ? "Usuário aprovado!" : "Acesso revogado" });
      setProfiles((prev) =>
        prev.map((p) => (p.id === profileId ? { ...p, approved } : p))
      );
    }
  };

  const approvePlan = async (profileId: string, plano: string) => {
    const { error } = await supabase
      .from("profiles")
      .update({ plano, plano_solicitado: null, trial_start: null } as any)
      .eq("id", profileId);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Plano ${PLANO_LABELS[plano] || plano} ativado!` });
      setProfiles((prev) =>
        prev.map((p) => (p.id === profileId ? { ...p, plano, plano_solicitado: null, trial_start: null } : p))
      );
      // Notify user
      await supabase.from("notifications").insert({
        user_id: profileId,
        title: "Plano ativado!",
        description: `Seu plano ${PLANO_LABELS[plano] || plano} foi ativado pelo administrador. Aproveite!`,
      } as any);
    }
  };

  const changePlan = async (profileId: string, plano: string) => {
    const updates: any = { plano, plano_solicitado: null };
    if (plano === "gratuito") {
      updates.trial_start = new Date().toISOString();
    } else {
      updates.trial_start = null;
    }
    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", profileId);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Plano alterado para ${PLANO_LABELS[plano] || plano}` });
      fetchProfiles();
    }
  };

  const passwordValidationMessage = newPassword ? validateStrongPassword(newPassword) : null;

  const handleResetPassword = async () => {
    if (!resetTarget || passwordValidationMessage) return;
    setResetting(true);
    try {
      const { data, error } = await supabase.functions.invoke("reset-user-password", {
        body: { user_id: resetTarget.id, password: newPassword },
      });
      if (error) throw error;
      // Formato de erro padronizado admin: { error_code, message, details?, request_id }
      if (data?.error_code) throw new Error(data.message ?? data.error_code);
      toast({ title: "Senha redefinida com sucesso!" });
      setResetTarget(null);
      setNewPassword("");
      setConfirmReset(false);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setResetting(false);
    }
  };

  const pendingCount = profiles.filter((p) => !p.approved && !p.is_master).length;
  const pendingPlans = profiles.filter((p) => p.plano_solicitado).length;

  const getTrialInfo = (p: Profile) => {
    if (p.is_master || !p.trial_start || (p.plano && p.plano !== "gratuito")) return null;
    const start = new Date(p.trial_start);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const remaining = 7 - diffDays;
    return remaining;
  };

  return (
    <DashboardLayout>
      <SectionHeader
        title="Gerenciar Usuários"
        subtitle="Aprove acessos, gerencie planos e controle permissões"
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="glass-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{profiles.length}</p>
            <p className="text-xs text-muted-foreground">Total de contas</p>
          </div>
        </div>
        <div className="glass-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">
              {profiles.filter((p) => p.approved).length}
            </p>
            <p className="text-xs text-muted-foreground">Aprovados</p>
          </div>
        </div>
        <div className="glass-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
            <Clock className="w-5 h-5 text-accent-foreground" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{pendingCount}</p>
            <p className="text-xs text-muted-foreground">Pendentes</p>
          </div>
        </div>
        <div className="glass-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{pendingPlans}</p>
            <p className="text-xs text-muted-foreground">Planos pendentes</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Usuário</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">E-mail</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Plano</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Trial</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Acesso</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => {
                const trialDays = getTrialInfo(p);
                return (
                  <tr key={p.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{p.nome || "Sem nome"}</span>
                        {p.is_master && (
                          <Badge variant="outline" className="text-xs border-primary text-primary">Master</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-muted-foreground">{p.email}</td>
                    <td className="px-5 py-4 text-center">
                      {p.is_master ? (
                        <Badge variant="outline" className="border-primary text-primary">Admin</Badge>
                      ) : p.plano_solicitado ? (
                        <div className="flex flex-col items-center gap-1">
                          <Badge variant="secondary" className="text-xs">
                            {PLANO_LABELS[p.plano || "gratuito"]}
                          </Badge>
                          <Button
                            size="sm"
                            className="text-xs h-7 bg-gradient-to-r from-primary to-blue-600"
                            onClick={() => approvePlan(p.id, p.plano_solicitado!)}
                          >
                            <Check className="w-3 h-3 mr-1" />
                            Aprovar {PLANO_LABELS[p.plano_solicitado] || p.plano_solicitado}
                          </Button>
                        </div>
                      ) : (
                        <Select
                          value={p.plano || "gratuito"}
                          onValueChange={(val) => changePlan(p.id, val)}
                        >
                          <SelectTrigger className="w-[140px] h-8 text-xs mx-auto">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(PLANO_LABELS).map(([key, label]) => (
                              <SelectItem key={key} value={key}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </td>
                    <td className="px-5 py-4 text-center">
                      {trialDays !== null ? (
                        <Badge variant={trialDays <= 0 ? "destructive" : trialDays <= 5 ? "secondary" : "outline"} className="text-xs">
                          {trialDays <= 0 ? "Expirado" : `${trialDays}d restantes`}
                        </Badge>
                      ) : p.is_master ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <Badge variant="outline" className="text-xs border-primary text-primary">Ativo</Badge>
                      )}
                    </td>
                    <td className="px-5 py-4 text-center">
                      {p.is_master ? (
                        <span className="text-xs text-muted-foreground">Admin</span>
                      ) : (
                        <Switch
                          checked={p.approved}
                          onCheckedChange={(checked) => toggleApproval(p.id, checked)}
                        />
                      )}
                    </td>
                    <td className="px-5 py-4 text-center">
                      {!p.is_master && (
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPermTarget(p)}
                            title="Permissões de acesso"
                          >
                            <Lock className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setResetTarget(p)}
                            title="Redefinir senha"
                          >
                            <KeyRound className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteTarget(p)}
                            title="Excluir usuário"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!resetTarget} onOpenChange={(open) => { if (!open) { setResetTarget(null); setNewPassword(""); setConfirmReset(false); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redefinir senha</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Definir nova senha para <strong>{resetTarget?.nome || resetTarget?.email}</strong>
          </p>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Nova Senha (mín. 8 caracteres, com letras e números)</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              minLength={8}
            />
            <p className="text-xs text-muted-foreground">
              {passwordValidationMessage || "Evite senhas comuns ou já vazadas, como senha123 ou password123."}
            </p>
          </div>
          <Button onClick={() => setConfirmReset(true)} disabled={resetting || !newPassword || !!passwordValidationMessage} className="w-full">
            {resetting ? "Aguarde..." : "Redefinir senha"}
          </Button>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">⚠️ Confirmar redefinição de senha</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                Esta ação é <strong>irreversível</strong>. A senha atual de{" "}
                <strong>{resetTarget?.nome || resetTarget?.email}</strong> será substituída imediatamente
                e o usuário perderá o acesso até receber a nova senha.
              </span>
              <span className="block font-medium text-foreground">
                Tem certeza absoluta que deseja prosseguir?
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              autoFocus
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold border-primary"
            >
              Cancelar (recomendado)
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetPassword}
              disabled={resetting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {resetting ? "Redefinindo..." : "Sim, redefinir senha"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      {/* Permissions Dialog */}
      <Dialog open={!!permTarget} onOpenChange={(open) => { if (!open) setPermTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-primary" />
              Permissões de Acesso
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Ative ou desative módulos para <strong>{permTarget?.nome || permTarget?.email}</strong>
          </p>
          {permTarget && (
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
              {MODULOS.map((modulo) => {
                const perms = getPermissoesForUser(permTarget.id);
                return (
                  <div
                    key={modulo.id}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                      perms[modulo.id] ? "border-primary/30 bg-primary/5" : "border-border bg-secondary/30 opacity-60"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{modulo.label}</p>
                      <p className="text-[11px] text-muted-foreground">{modulo.desc}</p>
                    </div>
                    <Switch
                      checked={perms[modulo.id]}
                      onCheckedChange={(checked) => togglePermissao(permTarget.id, modulo.id, checked)}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário permanentemente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá remover <strong>{deleteTarget?.nome || deleteTarget?.email}</strong> da plataforma. Os dados em tabelas (imóveis, contratos, leads) serão preservados, mas o login será desativado. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Excluindo..." : "Sim, excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default GerenciarUsuarios;
