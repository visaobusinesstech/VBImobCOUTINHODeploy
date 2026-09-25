import { ROUTE_TO_MODULO, type ModuloId } from "@/hooks/useModuloConfig";
import { canAccessRoute, isInTrial } from "@/lib/planoAccess";

export type NavItem = {
  title: string;
  url: string;
  icon: any;
  external?: boolean;
  masterOnly?: boolean;
};

export interface FilterCtx {
  isMaster: boolean;
  plano: any;
  trialDaysLeft: number | null | undefined;
  trialExpired: boolean;
  isModuloAtivo: (m: ModuloId) => boolean;
  canAccess: (m: ModuloId) => boolean;
}

export function filterNavItems(items: NavItem[], ctx: FilterCtx): NavItem[] {
  const inTrial = isInTrial(ctx.plano as any, ctx.trialDaysLeft as any, ctx.trialExpired);
  return items.filter((item) => {
    if (item.masterOnly && !ctx.isMaster) return false;
    const moduloId = ROUTE_TO_MODULO[item.url];
    if (moduloId && !ctx.isModuloAtivo(moduloId)) return false;
    if (moduloId && !ctx.canAccess(moduloId)) return false;
    if (!ctx.isMaster && !inTrial && !canAccessRoute(ctx.plano as any, item.url, ctx.isMaster)) return false;
    return true;
  });
}
