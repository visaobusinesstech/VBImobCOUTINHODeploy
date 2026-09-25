import { useEffect } from "react";
import { useModuloConfig, ROUTE_TO_MODULO, type ModuloId } from "@/hooks/useModuloConfig";
import { useUserPermissoes } from "@/hooks/useUserPermissoes";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation, Navigate, Link } from "react-router-dom";
import { canAccessRoute, ROUTE_PLAN_GATE, PLANO_LABELS, isInTrial, type PlanoType } from "@/lib/planoAccess";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isRadarZapRoute, logRadarZapAccess } from "@/lib/radarzapAccessLog";
import { isOpenAccess } from "@/lib/openAccess";

interface ModuleGuardProps {
  children: React.ReactNode;
  moduloId?: ModuloId;
}

export function ModuleGuard({ children, moduloId }: ModuleGuardProps) {
  const { isModuloAtivo, loading } = useModuloConfig();
  const { canAccess, loading: loadingPerms } = useUserPermissoes();
  const { plano, isMaster, trialDaysLeft, trialExpired } = useAuth();
  const location = useLocation();
  const openAccess = isOpenAccess();

  const modulo = moduloId || ROUTE_TO_MODULO[location.pathname];

  // Check plan-based route gate
  const inTrial = isInTrial(plano, trialDaysLeft, trialExpired);
  const planAllowed = openAccess || isMaster || inTrial || canAccessRoute(plano, location.pathname, isMaster);

  const isRz = isRadarZapRoute(location.pathname);
  const modOk = openAccess || !modulo || isModuloAtivo(modulo);
  const permOk = openAccess || !modulo || canAccess(modulo);
  const blockedReason = !planAllowed
    ? "plan_gate"
    : !modOk
    ? "modulo_desativado"
    : !permOk
    ? "sem_permissao"
    : null;

  useEffect(() => {
    if (!isRz) return;
    if (loading || loadingPerms) return;
    if (blockedReason) {
      logRadarZapAccess({ route: location.pathname, status: "blocked", motivo: blockedReason });
    } else {
      logRadarZapAccess({ route: location.pathname, status: "allowed", motivo: null });
    }
  }, [isRz, blockedReason, loading, loadingPerms, location.pathname]);

  if (!planAllowed) {
    const requiredPlano = ROUTE_PLAN_GATE[location.pathname] as PlanoType;
    const planoLabel = requiredPlano ? PLANO_LABELS[requiredPlano] : "superior";

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Lock className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Módulo Bloqueado</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Este recurso está disponível a partir do plano{" "}
              <strong className="text-foreground">{planoLabel}</strong>.
              Solicite o upgrade ao administrador para desbloquear.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link to="/dashboard">Voltar ao Dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!modulo || openAccess) return <>{children}</>;

  if (loading || loadingPerms) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isModuloAtivo(modulo) || !canAccess(modulo)) {
    if (isRz) {
      const motivo = !isModuloAtivo(modulo) ? "modulo_desativado" : "sem_permissao";
      const motivoLabel =
        motivo === "modulo_desativado"
          ? "O módulo RadarZAP está desativado para a sua imobiliária."
          : "Seu perfil não tem permissão para acessar esta área do RadarZAP.";
      const mailto = `mailto:acoutinhoimoveis@gmail.com?subject=${encodeURIComponent(
        "Solicitação de acesso ao RadarZAP",
      )}&body=${encodeURIComponent(
        `Olá,\n\nGostaria de solicitar acesso à rota ${location.pathname} do RadarZAP.\n\nMotivo do bloqueio: ${motivo}.\n\nObrigado.`,
      )}`;
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="w-full max-w-md text-center space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <Lock className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Acesso ao RadarZAP bloqueado</h1>
              <p className="text-sm text-muted-foreground mt-2">{motivoLabel}</p>
              <p className="text-xs text-muted-foreground mt-3">
                Rota: <code className="font-mono">{location.pathname}</code>
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button asChild>
                <a href={mailto}>Pedir acesso ao administrador</a>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/dashboard">Voltar ao Dashboard</Link>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Administradores podem liberar em <Link to="/corretores" className="underline">/corretores</Link> (permissões)
              ou <Link to="/configuracoes" className="underline">/configuracoes</Link> (módulos).
            </p>
          </div>
        </div>
      );
    }
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
