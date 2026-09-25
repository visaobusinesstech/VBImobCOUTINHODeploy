import { useState, useEffect, memo, useCallback } from "react";
import { useGlobalSearch } from "@/contexts/GlobalSearchContext";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useIsBelowDesktop } from "@/hooks/use-mobile";
import { useImobiliariaConfig } from "@/hooks/useImobiliariaConfig";
import { useModuloConfig, ROUTE_TO_MODULO } from "@/hooks/useModuloConfig";
import { useUserPermissoes } from "@/hooks/useUserPermissoes";
import { canAccessRoute, isInTrial } from "@/lib/planoAccess";
import { filterNavItems } from "@/lib/navFiltering";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationPanel } from "@/components/NotificationPanel";
import { useMask } from "@/components/shared/MetricCard";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sparkles,
  LayoutDashboard,
  Building2,
  Users,
  Kanban,
  Zap,
  DollarSign,
  FileSignature,
  Heart,
  Shield,
  Settings,
  Route,
  Search,
  LogOut,
  UserCheck,
  Menu,
  ChevronLeft,
  ChevronRight,
  Landmark,
  Target,
  CalendarDays,
  BarChart3,
  PhoneForwarded,
  MessageCircle,
  Calculator,
  Handshake,
  PenTool,
  Magnet,
  Plug,
  AlertTriangle,
  ArrowLeftRight,
  
  ClipboardCheck,
  Megaphone,
  History,
  Radar, CalendarClock,
} from "lucide-react";

export const navItems: import("@/lib/navFiltering").NavItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Feed", url: "/feed", icon: History },
  
  
  { title: "Imóveis", url: "/imoveis", icon: Building2 },
  { title: "Comparativo", url: "/comparativo", icon: ArrowLeftRight },
  { title: "CRM Pipeline", url: "/pipeline", icon: Kanban },
  { title: "Propostas", url: "/propostas", icon: Handshake },
  { title: "Follow-up", url: "/followups", icon: PhoneForwarded },
  { title: "Corretores", url: "/corretores", icon: Users },
  { title: "Produtividade", url: "/produtividade", icon: BarChart3 },
  { title: "Relatórios automáticos", url: "/relatorios-agendados", icon: CalendarClock },
  { title: "Prospecção Diária", url: "/prospeccao", icon: ClipboardCheck },
  { title: "Automações", url: "/automacoes", icon: Zap, masterOnly: true },
  { title: "Automações Follow-up", url: "/automacoes-followup", icon: Zap },
  { title: "Nutrição de Leads", url: "/nutricao", icon: Heart },
  { title: "Financeiro", url: "/financeiro", icon: DollarSign },
  { title: "Inadimplência", url: "/inadimplencia", icon: AlertTriangle },
  { title: "Contratos", url: "/contratos", icon: FileSignature },
  { title: "Proprietários", url: "/proprietarios", icon: Landmark },
  { title: "Relacionamento", url: "/relacionamento", icon: Heart },
  { title: "WhatsApp", url: "/whatsapp", icon: MessageCircle },
  { title: "Agenda", url: "/agenda", icon: CalendarDays },
  { title: "Avaliação", url: "/avaliacao", icon: Calculator },
  { title: "Inteligência", url: "/inteligencia", icon: Target },
  { title: "Conteúdo SEO", url: "/conteudo-seo", icon: PenTool },
  { title: "Curadoria Viral", url: "/curadoria-viral", icon: Sparkles },
  { title: "Captação", url: "/captacao", icon: Magnet },
  { title: "Pipeline Captação", url: "/captacao-pipeline", icon: Kanban },
  { title: "CRM Condomínios", url: "/crm-condominios", icon: Building2 },
  { title: "Monitoramento", url: "/monitoramento", icon: Radar },
  { title: "RadarZAP", url: "/radarzap", icon: Radar },
  { title: "RadarZAP · Onboarding", url: "/radarzap/onboarding", icon: Radar },
  { title: "RadarZAP · Scoring", url: "/radarzap/scoring", icon: Sparkles },
  { title: "RadarZAP · Status", url: "/radarzap/status", icon: Radar },
  { title: "RadarZAP · Logs de acesso", url: "/radarzap/acessos", icon: Radar },

  { title: "Fila de Distribuição", url: "/fila-distribuicao", icon: BarChart3 },
  { title: "LP Captação", url: "/captacao-avaliacao", icon: ClipboardCheck, external: true, masterOnly: true },
  { title: "LP Venda CRM", url: "/venda-crm", icon: Megaphone, masterOnly: true },
  { title: "CRM Landing", url: "/leads-landing", icon: Megaphone },
  { title: "Portais", url: "/integracao-portais", icon: Plug },
  { title: "Jornada do Lead", url: "/jornada", icon: Route },
  { title: "Segurança", url: "/seguranca", icon: Shield },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
  { title: "Configuração da IA", url: "/configurar-ia", icon: Sparkles },
  { title: "Auditoria IA", url: "/auditoria-extracao", icon: History, masterOnly: true },
  { title: "Métricas Extração", url: "/metricas-extracao", icon: BarChart3, masterOnly: true },

];

// Memoized nav item to prevent unnecessary re-renders on mobile
const MobileNavItem = memo(function MobileNavItem({
  item,
  isActive,
  onNavigate,
}: {
  item: (typeof navItems)[number];
  isActive: boolean;
  onNavigate?: () => void;
}) {
  if ((item as any).external) {
    return (
      <a
        key={item.url}
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onNavigate}
        className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-sidebar-foreground active:bg-sidebar-accent active:text-sidebar-accent-foreground min-h-[44px]"
      >
        <item.icon className="w-5 h-5 flex-shrink-0" />
        <span>{item.title}</span>
      </a>
    );
  }
  return (
    <NavLink
      key={item.url}
      to={item.url}
      end={item.url === "/"}
      onClick={onNavigate}
      className={`
        flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium min-h-[44px]
        ${isActive
          ? "bg-primary/10 text-primary"
          : "text-sidebar-foreground active:bg-sidebar-accent active:text-sidebar-accent-foreground"
        }
      `}
      activeClassName=""
    >
      <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? "text-primary" : ""}`} />
      <span>{item.title}</span>
      {item.url === "/configurar-ia" && !isActive && (
        <Badge variant="secondary" className="ml-auto text-[10px] bg-primary/10 text-primary border-none px-1.5 py-0 h-4">Novo</Badge>
      )}
      {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
    </NavLink>
  );
});

function SidebarContent({ collapsed, onNavigate, brandName, brandLogo }: { collapsed: boolean; onNavigate?: () => void; brandName?: string; brandLogo?: string }) {
  const location = useLocation();
  const { signOut, isMaster, plano, trialDaysLeft, trialExpired, user } = useAuth();
  const { isModuloAtivo } = useModuloConfig();
  const { canAccess } = useUserPermissoes();
  const [pendingCount, setPendingCount] = useState(0);
  const inTrial = isInTrial(plano, trialDaysLeft, trialExpired);

  useEffect(() => {
    if (!isMaster) return;
    const fetchPending = async () => {
      const { count } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("approved", false)
        .eq("is_master", false);
      setPendingCount(count ?? 0);
    };
    fetchPending();
    const channel = supabase
      .channel("pending-profiles")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => fetchPending())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isMaster]);

  const filteredItems = filterNavItems(navItems, {
    isMaster,
    plano,
    trialDaysLeft,
    trialExpired,
    isModuloAtivo,
    canAccess,
  });

  const userName = (user?.user_metadata as any)?.nome || user?.email?.split("@")[0] || "";
  const subtitle = userName ? (isMaster ? `${userName} · Admin` : userName) : (isMaster ? "Admin" : "");

  return (
    <>
      {/* Brand: imobiliária/corretor em destaque + plataforma como rótulo discreto */}
      <div className={`flex items-center border-b border-sidebar-border ${collapsed ? "h-16 justify-center px-2" : "px-4 py-3 gap-3"}`}>
        {brandLogo ? (
          <img
            src={brandLogo}
            alt={brandName || "Logo"}
            className={`rounded-lg object-cover flex-shrink-0 ring-1 ring-border ${collapsed ? "w-9 h-9" : "w-11 h-11"}`}
          />
        ) : (
          <div className={`rounded-lg bg-primary flex items-center justify-center flex-shrink-0 ${collapsed ? "w-9 h-9" : "w-11 h-11"}`}>
            <Building2 className={`text-primary-foreground ${collapsed ? "w-4 h-4" : "w-5 h-5"}`} />
          </div>
        )}
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="font-bold text-foreground text-sm leading-tight truncate">
              {brandName || "Sua Imobiliária"}
            </p>
            {subtitle && (
              <p className="text-[11px] text-muted-foreground truncate leading-tight">{subtitle}</p>
            )}
            <p className="text-[10px] text-muted-foreground/70 mt-0.5 leading-tight">
              by radar<span className="text-primary/80">imobtech</span>
            </p>
          </div>
        )}
      </div>

      {/* Navigation - optimized with CSS containment for mobile scroll perf */}
      <nav className="flex-1 py-2 px-3 space-y-0.5 overflow-y-auto overscroll-contain" style={{ contain: "layout style", WebkitOverflowScrolling: "touch" as any }}>
        {filteredItems.map((item) => {
          const isActive = location.pathname === item.url;
          if (collapsed) {
            // Desktop collapsed mode
            if ((item as any).external) {
              return (
                <a key={item.url} href={item.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent"
                >
                  <item.icon className="w-5 h-5" />
                </a>
              );
            }
            return (
              <NavLink key={item.url} to={item.url} end={item.url === "/"}
                className={`flex items-center justify-center px-3 py-2.5 rounded-lg text-sm font-medium ${isActive ? "bg-primary/10 text-primary" : "text-sidebar-foreground hover:bg-sidebar-accent"}`}
                activeClassName=""
              >
                <item.icon className={`w-5 h-5 ${isActive ? "text-primary" : ""}`} />
              </NavLink>
            );
          }
          return <MobileNavItem key={item.url} item={item} isActive={isActive} onNavigate={onNavigate} />;
        })}
        {isMaster && (
          <NavLink
            to="/usuarios"
            onClick={onNavigate}
            className={`
              relative flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium min-h-[44px]
              ${location.pathname === "/usuarios"
                ? "bg-primary/10 text-primary"
                : "text-sidebar-foreground active:bg-sidebar-accent active:text-sidebar-accent-foreground"
              }
            `}
            activeClassName=""
          >
            <UserCheck className={`w-5 h-5 flex-shrink-0 ${location.pathname === "/usuarios" ? "text-primary" : ""}`} />
            <span>Gerenciar Usuários</span>
            {pendingCount > 0 && (
              <span className="ml-auto bg-destructive text-destructive-foreground text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                {pendingCount}
              </span>
            )}
            {location.pathname === "/usuarios" && pendingCount === 0 && (
              <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
            )}
          </NavLink>
        )}
      </nav>

      {/* Bottom actions */}
      <div className="p-3 border-t border-sidebar-border">
        <button
          onClick={signOut}
          className="w-full flex items-center gap-2 px-3 py-3 rounded-lg text-sm text-destructive active:bg-destructive/10 min-h-[44px]"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </>
  );
}

// Shared open/close state so TopBar can trigger the mobile/tablet drawer.
const sidebarListeners = new Set<(open: boolean) => void>();
export function openAppSidebar() {
  sidebarListeners.forEach((l) => l(true));
}

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const belowDesktop = useIsBelowDesktop();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { nome_empresa, logo_url } = useImobiliariaConfig();

  const handleDrawerClose = useCallback(() => setDrawerOpen(false), []);

  useEffect(() => {
    const listener = (open: boolean) => setDrawerOpen(open);
    sidebarListeners.add(listener);
    return () => { sidebarListeners.delete(listener); };
  }, []);

  // Close drawer automatically when moving up to desktop
  useEffect(() => {
    if (!belowDesktop) setDrawerOpen(false);
  }, [belowDesktop]);

  if (belowDesktop) {
    return (
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" className="w-[85vw] max-w-[320px] p-0 bg-sidebar border-sidebar-border">
          <div className="flex flex-col h-full">
            <SidebarContent collapsed={false} onNavigate={handleDrawerClose} brandName={nome_empresa} brandLogo={logo_url} />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside
      className={`
        fixed left-0 top-0 h-dvh z-40 hidden xl:flex flex-col
        bg-sidebar border-r border-sidebar-border
        transition-[width] duration-300 ease-in-out
        ${collapsed ? "w-[72px]" : "w-[260px]"}
      `}
    >
      <SidebarContent collapsed={collapsed} brandName={nome_empresa} brandLogo={logo_url} />
      <div className="p-3 border-t border-sidebar-border">
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-sidebar-accent transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          {!collapsed && <span>Recolher</span>}
        </button>
      </div>
    </aside>
  );
}


export function TopBar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const belowDesktop = useIsBelowDesktop();
  const { globalSearch, setGlobalSearch } = useGlobalSearch();
  const { masked, setMasked } = useMask();

  const initials = user?.user_metadata?.nome
    ? user.user_metadata.nome.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() ?? "??";

  return (
    <header className="sticky top-0 z-30 h-14 md:h-16 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 flex items-center gap-2 px-3 md:px-6">
      {belowDesktop && (
        <button
          type="button"
          onClick={() => openAppSidebar()}
          aria-label="Abrir menu"
          className="w-10 h-10 -ml-1 rounded-lg flex items-center justify-center text-foreground hover:bg-secondary active:scale-95 transition-transform flex-shrink-0"
        >
          <Menu className="w-5 h-5" />
        </button>
      )}
      <div className="flex items-center gap-2 flex-1 min-w-0 max-w-md">

        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={globalSearch}
            onChange={e => setGlobalSearch(e.target.value)}
            placeholder="Buscar..."
            className="w-full h-9 md:h-10 pl-9 pr-8 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          {globalSearch && (
            <button onClick={() => setGlobalSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground p-1 min-w-[28px] min-h-[28px] flex items-center justify-center">
              <span className="text-xs">✕</span>
            </button>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 md:gap-3">
        <button
          onClick={() => setMasked(!masked)}
          className={`
            flex items-center gap-2 px-2 md:px-3 py-1.5 rounded-full text-[10px] md:text-xs font-bold transition-all
            ${masked 
              ? "bg-primary text-primary-foreground shadow-sm scale-105" 
              : "bg-secondary text-muted-foreground hover:bg-secondary/80"}
          `}
          title={masked ? "Desativar Modo Segurança" : "Ativar Modo Segurança para apresentar ao cliente"}
        >
          <Shield className={`w-3.5 h-3.5 ${masked ? "animate-pulse" : ""}`} />
          <span className="hidden sm:inline">{masked ? "MODO SEGURANÇA ATIVO" : "MODO SEGURANÇA"}</span>
        </button>
        <ThemeToggle />
        <NotificationPanel />
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-primary/20 flex items-center justify-center text-xs md:text-sm font-semibold text-primary cursor-pointer hover:bg-primary/30 transition-colors">
              {initials}
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/configuracoes")}>
              <Settings className="mr-2 h-4 w-4" />
              <span>Configurações</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/configurar-ia")}>
              <Sparkles className="mr-2 h-4 w-4 text-primary" />
              <span className="font-bold text-primary">Configurar IA (BYOK)</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sair</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
