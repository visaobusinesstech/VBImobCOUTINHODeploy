import fs from "fs";
import path from "path";

const FRONT = path.resolve(__dirname, "../../../frontend/src");
const catalogPath = path.join(FRONT, "config/crmMenuCatalog.js");

function loadPaths(): string[] {
  const src = fs.readFileSync(catalogPath, "utf8");
  const match = src.match(/export const CRM_MENU_PATHS = \[([\s\S]*?)\];/);
  if (!match) throw new Error("CRM_MENU_PATHS not found");
  return match[1]
    .split("\n")
    .map((l) => l.trim().replace(/,$/, "").replace(/"/g, ""))
    .filter((l) => l.startsWith("/"));
}

function read(rel: string) {
  return fs.readFileSync(path.join(FRONT, rel), "utf8");
}

describe("entrega CRM unificado (12-MENU)", () => {
  const paths = loadPaths();
  const routes = read("routes/index.js");
  const menu = read("layout/MainListItems.js");
  const modules = read("pages/RealtyModules/index.js");

  it("catalog has documented menu size", () => {
    expect(paths.length).toBeGreaterThan(60);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("every catalog path is registered in routes", () => {
    const missing = paths.filter((p) => {
      if (p === "/") return !/path=["']\/["']/.test(routes);
      if (p === "/tickets") return !routes.includes('path="/tickets');
      return !routes.includes(`path="${p}"`);
    });
    expect(missing).toEqual([]);
  });

  it("every catalog path (except home) is in the sidebar", () => {
    const missing = paths.filter((p) => p !== "/" && !menu.includes(`to="${p}"`));
    expect(missing).toEqual([]);
  });

  it("realty module pages export required screens", () => {
    [
      "export const Condominios",
      "export const Avaliacao",
      "export const AgendaImobiliaria",
      "export const Corretores",
      "export const RadarZapOnboarding",
      "export const Automacoes",
      "export const Seguranca",
      "export const ComparativoImoveis",
      "export const JornadaCliente"
    ].forEach((line) => expect(modules).toContain(line));
  });

  it("VBSolution does not import the Vite project/ folder", () => {
    expect(routes).not.toMatch(/project\/src/);
    expect(menu).not.toMatch(/project\/src/);
  });
});
