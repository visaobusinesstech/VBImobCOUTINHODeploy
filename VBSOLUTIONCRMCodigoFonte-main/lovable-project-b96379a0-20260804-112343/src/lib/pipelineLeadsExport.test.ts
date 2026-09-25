import { describe, it, expect } from "vitest";
import {
  PIPELINE_PDF_COLUMNS,
  PIPELINE_CSV_COLUMNS,
  buildPipelinePdfSummary,
  buildPipelinePdfRows,
  buildPipelineCsvRows,
  buildPipelineExportSubtitle,
  buildPipelineExportFileName,
  describePipelineFilters,
} from "./pipelineLeadsExport";
import { ESTAGIOS, type Lead } from "@/hooks/useLeads";

const NO_PROCURAR = /procurar/i;

const sampleLeads: Lead[] = [
  { id: "1", nome: "Ana",  estagio: "novos",         valor: 100000, interesse: "Apto", corretor_nome: "C1", telefone: "11", email: "a@x", bairro_interesse: "Centro" } as any,
  { id: "2", nome: "Bruno", estagio: "mandar_opcoes", valor: 250000, interesse: "Casa", corretor_nome: "C2", telefone: "22", email: "b@x", bairro_interesse: "Sul"    } as any,
  { id: "3", nome: "Carla", estagio: "fechado",       valor: 300000, interesse: "",     corretor_nome: "",   telefone: "",  email: "",   bairro_interesse: ""       } as any,
];

describe("Exportação do Pipeline (CSV/PDF) — invariantes sem 'Procurar Opções'", () => {
  it("cabeçalhos do PDF são fixos e não mencionam 'Procurar Opções'", () => {
    const headers = PIPELINE_PDF_COLUMNS.map((c) => c.header);
    expect(headers).toEqual([
      "Nome", "Interesse", "Valor", "Estágio", "Corretor", "Telefone", "Email",
    ]);
    expect(headers.some((h) => NO_PROCURAR.test(h))).toBe(false);
  });

  it("cabeçalhos do CSV/Excel são fixos e não mencionam 'Procurar Opções'", () => {
    const headers = PIPELINE_CSV_COLUMNS.map((c) => c.header);
    expect(headers).toEqual([
      "Nome", "Estágio", "Valor", "Corretor", "Telefone", "Email", "Interesse", "Bairro",
    ]);
    expect(headers.some((h) => NO_PROCURAR.test(h))).toBe(false);
  });

  it("summary do PDF usa exatamente os estágios de ESTAGIOS na ordem correta", () => {
    const summary = buildPipelinePdfSummary(sampleLeads);
    expect(summary.map((s) => s.label)).toEqual(ESTAGIOS.map((e) => e.title));
    expect(summary.some((s) => NO_PROCURAR.test(s.label))).toBe(false);
    // contagem por estágio
    const map = Object.fromEntries(summary.map((s) => [s.label, Number(s.value)]));
    const novosTitle = ESTAGIOS.find((e) => e.id === "novos")!.title;
    const mandarTitle = ESTAGIOS.find((e) => e.id === "mandar_opcoes")!.title;
    const fechadoTitle = ESTAGIOS.find((e) => e.id === "fechado")!.title;
    expect(map[novosTitle]).toBe(1);
    expect(map[mandarTitle]).toBe(1);
    expect(map[fechadoTitle]).toBe(1);
  });

  it("linhas do PDF usam o título do estágio (nunca 'Procurar Opções') e formatam BRL", () => {
    const rows = buildPipelinePdfRows(sampleLeads);
    expect(rows).toHaveLength(3);
    const mandarTitle = ESTAGIOS.find((e) => e.id === "mandar_opcoes")!.title;
    expect(rows[1].estagioNome).toBe(mandarTitle);
    expect(rows[0].valorFmt).toMatch(/R\$\s?100\.000,00/);
    expect(rows[2].interesse).toBe("—");
    expect(rows[2].corretor).toBe("—");
    for (const r of rows) {
      expect(NO_PROCURAR.test(r.estagioNome)).toBe(false);
    }
  });

  it("linhas do CSV usam título do estágio e preservam valor numérico", () => {
    const rows = buildPipelineCsvRows(sampleLeads);
    expect(rows).toHaveLength(3);
    const mandarTitle = ESTAGIOS.find((e) => e.id === "mandar_opcoes")!.title;
    expect(rows[1].estagio).toBe(mandarTitle);
    expect(rows[0].valor).toBe(100000);
    expect(rows[2].corretor).toBe(""); // sem "—" em CSV
    for (const r of rows) {
      expect(NO_PROCURAR.test(r.estagio)).toBe(false);
    }
  });

  it("nenhuma coluna/summary/linha exposta contém id 'procurar_opcoes'", () => {
    const summary = buildPipelinePdfSummary(sampleLeads);
    const pdfRows = buildPipelinePdfRows(sampleLeads);
    const csvRows = buildPipelineCsvRows(sampleLeads);
    const blob = JSON.stringify({ summary, pdfRows, csvRows, PIPELINE_PDF_COLUMNS, PIPELINE_CSV_COLUMNS });
    expect(blob).not.toMatch(/procurar_opcoes/i);
    expect(blob).not.toMatch(/procurar op/i);
  });
});

describe("Exportação do Pipeline — respeita filtros ativos", () => {
  it("summary limita ao estágio filtrado quando não é 'todos'", () => {
    const summary = buildPipelinePdfSummary(sampleLeads, { estagio: "mandar_opcoes" });
    const mandarTitle = ESTAGIOS.find((e) => e.id === "mandar_opcoes")!.title;
    expect(summary).toEqual([{ label: mandarTitle, value: "1" }]);
  });

  it("summary usa todos os estágios quando filtro é 'todos' ou ausente", () => {
    const full = buildPipelinePdfSummary(sampleLeads, { estagio: "todos" });
    expect(full.map((s) => s.label)).toEqual(ESTAGIOS.map((e) => e.title));
  });

  it("describePipelineFilters descreve estágio, corretor, faixa de valor e busca", () => {
    const desc = describePipelineFilters({
      estagio: "novos",
      corretorId: "abc",
      corretorNome: "João",
      valorMin: "100000",
      valorMax: "300000",
      searchQuery: "ana",
    });
    const novosTitle = ESTAGIOS.find((e) => e.id === "novos")!.title;
    expect(desc[0]).toBe(`Estágio: ${novosTitle}`);
    expect(desc[1]).toBe("Corretor: João");
    expect(desc[2]).toMatch(/^Valor mín\.: R\$\s?100\.000,00$/);
    expect(desc[3]).toMatch(/^Valor máx\.: R\$\s?300\.000,00$/);
    expect(desc[4]).toBe('Busca: "ana"');
    expect(desc).toHaveLength(5);
  });

  it("describePipelineFilters retorna vazio quando nenhum filtro está ativo", () => {
    expect(describePipelineFilters({ estagio: "todos", corretorId: "todos" })).toEqual([]);
  });

  it("describePipelineFilters trata corretor '__none__' como 'sem atribuição'", () => {
    const desc = describePipelineFilters({ corretorId: "__none__" });
    expect(desc).toContain("Corretor: sem atribuição");
  });

  it("subtitle inclui contagem, total e filtros ativos", () => {
    const subtitle = buildPipelineExportSubtitle(sampleLeads, {
      estagio: "novos",
    });
    expect(subtitle).toMatch(/3 leads/);
    expect(subtitle).toMatch(/em pipeline/);
    expect(subtitle).toMatch(/Filtros: Estágio:/);
  });

  it("subtitle sem filtros omite a seção 'Filtros'", () => {
    const subtitle = buildPipelineExportSubtitle(sampleLeads, {});
    expect(subtitle).not.toMatch(/Filtros:/);
  });

  it("filename inclui slug do estágio, corretor e marca de busca", () => {
    const name = buildPipelineExportFileName(
      "Leads",
      { estagio: "mandar_opcoes", corretorId: "abc", corretorNome: "João Silva", searchQuery: "x" },
      new Date("2026-07-02T00:00:00Z"),
    );
    expect(name).toMatch(/^Leads_/);
    expect(name).toMatch(/joao-silva/);
    expect(name).toMatch(/2026-07-02$/);
    expect(name).toContain("busca");
  });

  it("filename sem filtros mantém apenas prefixo e data", () => {
    const name = buildPipelineExportFileName("Leads", {}, new Date("2026-07-02T00:00:00Z"));
    expect(name).toBe("Leads_2026-07-02");
  });
});
