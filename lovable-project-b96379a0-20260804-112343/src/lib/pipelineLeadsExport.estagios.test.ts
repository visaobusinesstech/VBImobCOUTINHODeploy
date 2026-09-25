import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Estes testes garantem que os helpers de exportação do Pipeline
 * derivam colunas de resumo e nomes de estágio a partir do ID de ESTAGIOS
 * (fonte única) — mesmo quando o rótulo ou a ordem dos estágios muda,
 * e nunca reintroduzem "Procurar Opções".
 */

// Mock ESTAGIOS com ordem/rótulos diferentes dos usados em produção,
// mantendo os mesmos IDs canônicos consumidos pelos helpers.
vi.mock("@/hooks/useLeads", () => ({
  ESTAGIOS: [
    { id: "fechado", title: "🏁 Deal Closed", color: "hsl(0, 0%, 0%)" },
    { id: "novos", title: "🌱 Brand New", color: "hsl(0, 0%, 0%)" },
    { id: "mandar_opcoes", title: "📨 Send Options (Renamed)", color: "hsl(0, 0%, 0%)" },
    { id: "qualificados", title: "✅ Qualified Now", color: "hsl(0, 0%, 0%)" },
  ] as const,
}));

// Importa APÓS o mock ser registrado.
import {
  PIPELINE_PDF_COLUMNS,
  PIPELINE_CSV_COLUMNS,
  buildPipelinePdfSummary,
  buildPipelinePdfRows,
  buildPipelineCsvRows,
  describePipelineFilters,
  buildPipelineExportFileName,
} from "./pipelineLeadsExport";
import { ESTAGIOS } from "@/hooks/useLeads";

const NO_PROCURAR = /procurar/i;

type L = { id: string; nome: string; estagio: string; valor: number; interesse?: string; corretor_nome?: string; telefone?: string; email?: string; bairro_interesse?: string };

const leads: L[] = [
  { id: "1", nome: "Ana",    estagio: "novos",         valor: 100 },
  { id: "2", nome: "Bruno",  estagio: "mandar_opcoes", valor: 200 },
  { id: "3", nome: "Carla",  estagio: "fechado",       valor: 300 },
  { id: "4", nome: "Diego",  estagio: "qualificados",  valor: 400 },
];

describe("Exportação do Pipeline — resiliência à mudança de rótulo/ordem de ESTAGIOS", () => {
  beforeEach(() => {
    // Sanity check: nenhum id de "procurar_opcoes" foi reintroduzido no mock.
    expect(ESTAGIOS.some((e) => String(e.id) === "procurar_opcoes")).toBe(false);
    expect(ESTAGIOS.some((e) => NO_PROCURAR.test(e.title))).toBe(false);
  });

  it("summary preserva a ordem definida em ESTAGIOS (não é alfabética)", () => {
    const summary = buildPipelinePdfSummary(leads);
    expect(summary.map((s) => s.label)).toEqual(ESTAGIOS.map((e) => e.title));
    // Confirma que a ordem NÃO é a padrão de produção (fechado deve vir primeiro no mock).
    expect(summary[0].label).toBe("🏁 Deal Closed");
  });

  it("summary usa o novo rótulo mesmo quando o ID original é 'mandar_opcoes'", () => {
    const summary = buildPipelinePdfSummary(leads);
    const item = summary.find((s) => s.label === "📨 Send Options (Renamed)");
    expect(item).toBeDefined();
    expect(item?.value).toBe("1"); // Bruno
  });

  it("summary filtrado por estágio usa o ID (não o rótulo) para restringir", () => {
    const s = buildPipelinePdfSummary(leads, { estagio: "mandar_opcoes" });
    expect(s).toHaveLength(1);
    expect(s[0].label).toBe("📨 Send Options (Renamed)");
    expect(s[0].value).toBe("1");
  });

  it("linhas PDF traduzem o ID via ESTAGIOS mockado, refletindo o novo rótulo", () => {
    const rows = buildPipelinePdfRows(leads as any);
    const map = Object.fromEntries(rows.map((r) => [r.nome, r.estagioNome]));
    expect(map["Ana"]).toBe("🌱 Brand New");
    expect(map["Bruno"]).toBe("📨 Send Options (Renamed)");
    expect(map["Carla"]).toBe("🏁 Deal Closed");
    expect(map["Diego"]).toBe("✅ Qualified Now");
  });

  it("linhas CSV também respeitam o rótulo atual e mantêm o valor numérico", () => {
    const rows = buildPipelineCsvRows(leads as any);
    expect(rows.find((r) => r.nome === "Bruno")?.estagio).toBe("📨 Send Options (Renamed)");
    expect(rows.find((r) => r.nome === "Carla")?.valor).toBe(300);
  });

  it("describePipelineFilters resolve o rótulo do estágio pelo ID", () => {
    const desc = describePipelineFilters({ estagio: "fechado" });
    expect(desc).toContain("Estágio: 🏁 Deal Closed");
  });

  it("filename usa slug do rótulo atual, derivado do ID", () => {
    const name = buildPipelineExportFileName(
      "Leads",
      { estagio: "mandar_opcoes" },
      new Date("2026-07-02T00:00:00Z"),
    );
    // Slug remove emojis e acentos: "send-options-renamed"
    expect(name).toMatch(/send-options-renamed/);
    expect(name).toMatch(/2026-07-02$/);
  });

  it("nenhum artefato exposto reintroduz 'Procurar Opções' após o remap", () => {
    const blob = JSON.stringify({
      PIPELINE_PDF_COLUMNS,
      PIPELINE_CSV_COLUMNS,
      summary: buildPipelinePdfSummary(leads),
      pdfRows: buildPipelinePdfRows(leads as any),
      csvRows: buildPipelineCsvRows(leads as any),
      filters: describePipelineFilters({ estagio: "fechado", corretorId: "__none__" }),
      filename: buildPipelineExportFileName("Leads", { estagio: "fechado" }, new Date()),
    });
    expect(blob).not.toMatch(/procurar/i);
    expect(blob).not.toMatch(/procurar_opcoes/i);
  });

  it("estágios não mapeados caem no ID cru (contrato explícito para IDs desconhecidos)", () => {
    const orfaos: L[] = [{ id: "x", nome: "Fora", estagio: "id_inexistente_xyz", valor: 1 }];
    const pdf = buildPipelinePdfRows(orfaos as any);
    const csv = buildPipelineCsvRows(orfaos as any);
    expect(pdf[0].estagioNome).toBe("id_inexistente_xyz");
    expect(csv[0].estagio).toBe("id_inexistente_xyz");
  });
});
