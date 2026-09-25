import { describe, it, expect } from "vitest";
import { filterNavItems, type NavItem, type FilterCtx } from "@/lib/navFiltering";

const RZ_ITEMS: NavItem[] = [
  { title: "RadarZAP", url: "/radarzap", icon: null },
  { title: "RadarZAP · Scoring", url: "/radarzap/scoring", icon: null },
  { title: "RadarZAP · Status", url: "/radarzap/status", icon: null },
  { title: "RadarZAP · Onboarding", url: "/radarzap/onboarding", icon: null },
  { title: "RadarZAP · Logs de acesso", url: "/radarzap/acessos", icon: null },
  { title: "Dashboard", url: "/dashboard", icon: null },
  { title: "Automações", url: "/automacoes", icon: null, masterOnly: true },
];

function ctx(overrides: Partial<FilterCtx> = {}): FilterCtx {
  return {
    isMaster: true,
    plano: "premium",
    trialDaysLeft: null,
    trialExpired: false,
    isModuloAtivo: () => true,
    canAccess: () => true,
    ...overrides,
  };
}

describe("filterNavItems (AppLayout sidebar)", () => {
  it("mostra todos os itens RadarZAP para Master com módulos e permissões ativos", () => {
    const out = filterNavItems(RZ_ITEMS, ctx());
    expect(out.map((i) => i.url)).toEqual(expect.arrayContaining([
      "/radarzap",
      "/radarzap/scoring",
      "/radarzap/status",
      "/radarzap/onboarding",
      "/radarzap/acessos",
    ]));
  });

  it("esconde /radarzap quando o módulo 'radarzap' está desativado", () => {
    const out = filterNavItems(RZ_ITEMS, ctx({
      isModuloAtivo: (m) => m !== "radarzap",
    }));
    expect(out.find((i) => i.url === "/radarzap")).toBeUndefined();
  });

  it("esconde sub-rotas de configuração quando 'radarzap_config' está desativado", () => {
    const out = filterNavItems(RZ_ITEMS, ctx({
      isModuloAtivo: (m) => m !== "radarzap_config",
    }));
    for (const url of ["/radarzap/scoring", "/radarzap/status", "/radarzap/onboarding", "/radarzap/acessos"]) {
      expect(out.find((i) => i.url === url)).toBeUndefined();
    }
    expect(out.find((i) => i.url === "/radarzap")).toBeDefined();
  });

  it("esconde itens quando o usuário não tem permissão (canAccess=false) mesmo com módulo ativo", () => {
    const out = filterNavItems(RZ_ITEMS, ctx({
      isMaster: false,
      canAccess: (m) => m !== "radarzap" && m !== "radarzap_config",
    }));
    for (const url of ["/radarzap", "/radarzap/scoring", "/radarzap/status", "/radarzap/onboarding", "/radarzap/acessos"]) {
      expect(out.find((i) => i.url === url)).toBeUndefined();
    }
  });

  it("respeita masterOnly: esconde de não-master", () => {
    const out = filterNavItems(RZ_ITEMS, ctx({ isMaster: false }));
    expect(out.find((i) => i.url === "/automacoes")).toBeUndefined();
  });

  it("mantém rotas não-RadarZAP quando apenas RadarZAP está desativado", () => {
    const out = filterNavItems(RZ_ITEMS, ctx({
      isModuloAtivo: (m) => !String(m).startsWith("radarzap"),
    }));
    expect(out.find((i) => i.url === "/dashboard")).toBeDefined();
  });
});
