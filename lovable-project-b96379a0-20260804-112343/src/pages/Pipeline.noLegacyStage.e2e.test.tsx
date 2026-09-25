/**
 * E2E guard: garante que o estágio legado "Procurar Opções"
 * (id: procurar_opcoes) NUNCA apareça em nenhuma visão do CRM/Pipeline
 * após o carregamento da página.
 *
 * Cobre 3 camadas:
 *  1. Fonte única (ESTAGIOS) — não expõe o id/rótulo legado.
 *  2. Normalização defensiva (normalizeEstagio) — mapeia legado -> atual.
 *  3. Varredura estática das telas/componentes que renderizam colunas,
 *     filtros, gráficos e relatórios do pipeline — nenhum arquivo pode
 *     conter a string "Procurar Opções" ou o id "procurar_opcoes"
 *     fora de contextos de remap/teste.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ESTAGIOS,
  LEGACY_ESTAGIO_REMAP,
  normalizeEstagio,
} from "@/hooks/useLeads";

const LEGACY_ID = "procurar_opcoes";
const LEGACY_LABEL = "Procurar Opções";

// Arquivos que compõem "todas as visões" do pipeline no CRM.
const PIPELINE_VIEW_FILES = [
  "src/pages/Pipeline.tsx",
  "src/pages/JornadaCliente.tsx",
  "src/pages/Configuracoes.tsx",
  "src/components/pipeline/TransferLeadsDialog.tsx",
  "src/components/pipeline/ImportLeadsDialog.tsx",
  "src/components/pipeline/LeadFormDialog.tsx",
  "src/components/dashboard/GraficoEstagiosLeadsWidget.tsx",
  "src/components/auditoria/AutoAssignReport.tsx",
  "src/lib/pipelineLeadsExport.ts",
  "src/lib/dashboardMetrics.ts",
];

describe("Pipeline · guard contra estágio legado 'Procurar Opções'", () => {
  it("ESTAGIOS não expõe o id nem o rótulo legado", () => {
    const ids = ESTAGIOS.map((e) => e.id);
    const titles = ESTAGIOS.map((e) => e.title);
    expect(ids).not.toContain(LEGACY_ID);
    expect(ids).not.toContain("opcoes");
    expect(titles).not.toContain(LEGACY_LABEL);
  });

  it("LEGACY_ESTAGIO_REMAP redireciona o id legado para 'mandar_opcoes'", () => {
    expect(LEGACY_ESTAGIO_REMAP[LEGACY_ID]).toBe("mandar_opcoes");
    expect(normalizeEstagio(LEGACY_ID)).toBe("mandar_opcoes");
    expect(normalizeEstagio("opcoes")).toBe("mandar_opcoes");
    expect(normalizeEstagio(undefined)).toBe("novos");
  });

  it.each(PIPELINE_VIEW_FILES)(
    "%s não renderiza o rótulo/id legado",
    (relPath) => {
      const source = readFileSync(resolve(process.cwd(), relPath), "utf8");
      // Rótulo humano nunca deve aparecer em UI/labels.
      expect(source).not.toMatch(/Procurar\s+Opções/);
      // O id legado só é aceito dentro do mapa de remap (em useLeads.ts,
      // que NÃO faz parte desta lista). Aqui garantimos ausência total.
      expect(source.includes(LEGACY_ID)).toBe(false);
    },
  );
});
