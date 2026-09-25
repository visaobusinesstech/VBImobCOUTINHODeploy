/**
 * Validações de formatação (moeda BRL, datas ISO e percentuais derivados)
 * nos artefatos de exportação do Pipeline, garantindo que os valores
 * permanecem corretos mesmo quando o rótulo/ordem dos estágios muda
 * — e que "Procurar Opções" nunca reaparece.
 */
import { describe, it, expect, vi } from "vitest";

// Remap de ESTAGIOS com ordem/rótulos diferentes dos usados em produção,
// mantendo IDs canônicos consumidos pelos helpers.
vi.mock("@/hooks/useLeads", () => ({
  ESTAGIOS: [
    { id: "fechado",       title: "Z — Fechado (novo rótulo)", color: "hsl(0 0% 0%)" },
    { id: "novos",         title: "A — Novos (novo rótulo)",   color: "hsl(0 0% 0%)" },
    { id: "mandar_opcoes", title: "M — Mandar (novo rótulo)",  color: "hsl(0 0% 0%)" },
    { id: "qualificados",  title: "Q — Qualificados (novo)",   color: "hsl(0 0% 0%)" },
  ] as const,
}));

import {
  buildPipelinePdfSummary,
  buildPipelinePdfRows,
  buildPipelineCsvRows,
  buildPipelineExportSubtitle,
  buildPipelineExportFileName,
  describePipelineFilters,
} from "./pipelineLeadsExport";
import { ESTAGIOS } from "@/hooks/useLeads";

// Regex tolerante a NBSP/espaços finos que o Intl pode usar entre "R$" e o número.
const BRL = (int: string, dec: string) => new RegExp(`R\\$\\s*${int.replace(/\./g, "\\.")},${dec}`);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

type L = { id: string; nome: string; estagio: string; valor: number };

const dataset: L[] = [
  { id: "1", nome: "Ana",   estagio: "novos",         valor: 1250.5 },
  { id: "2", nome: "Bruno", estagio: "novos",         valor: 0 },
  { id: "3", nome: "Carla", estagio: "mandar_opcoes", valor: 350000 },
  { id: "4", nome: "Diego", estagio: "fechado",       valor: 1200000.99 },
  { id: "5", nome: "Eva",   estagio: "qualificados",  valor: 42 },
];

describe("Exportação do Pipeline — formatação de moeda, datas e percentuais", () => {
  it("PDF: valorFmt segue pt-BR BRL para todos os leads, independente da ordem de ESTAGIOS", () => {
    const rows = buildPipelinePdfRows(dataset as any);
    const map = Object.fromEntries(rows.map((r) => [r.nome, r.valorFmt]));

    expect(map["Ana"]).toMatch(BRL("1.250", "50"));
    expect(map["Bruno"]).toMatch(BRL("0", "00"));
    expect(map["Carla"]).toMatch(BRL("350.000", "00"));
    expect(map["Diego"]).toMatch(BRL("1.200.000", "99"));
    expect(map["Eva"]).toMatch(BRL("42", "00"));

    // Toda linha tem exatamente 2 casas decimais.
    rows.forEach((r) => expect(r.valorFmt).toMatch(/,\d{2}$/));
  });

  it("CSV: coluna 'valor' permanece numérica (sem formatação), preservando o dado bruto", () => {
    const rows = buildPipelineCsvRows(dataset as any);
    rows.forEach((r) => expect(typeof r.valor).toBe("number"));
    expect(rows.find((r) => r.nome === "Diego")!.valor).toBe(1200000.99);
    expect(rows.find((r) => r.nome === "Bruno")!.valor).toBe(0);
  });

  it("Subtítulo do PDF exibe total em BRL e contagem de leads corretamente", () => {
    const subtitle = buildPipelineExportSubtitle(dataset as any);
    const total = dataset.reduce((s, l) => s + l.valor, 0); // 1_551_293.49
    expect(total).toBeCloseTo(1551293.49, 2);
    expect(subtitle).toContain(`${dataset.length} leads`);
    expect(subtitle).toMatch(BRL("1.551.293", "49"));
    expect(subtitle).toContain("em pipeline");
  });

  it("Subtítulo formata faixas de valor min/max em BRL mesmo quando ESTAGIOS mudam", () => {
    const subtitle = buildPipelineExportSubtitle(dataset as any, {
      valorMin: 1000,
      valorMax: 500000,
      estagio: "fechado",
    });
    expect(subtitle).toMatch(/Valor mín\.:\s*R\$/);
    expect(subtitle).toMatch(BRL("1.000", "00"));
    expect(subtitle).toMatch(BRL("500.000", "00"));
    // O estágio filtrado usa o rótulo REMAPPED da mock (não o de produção).
    expect(subtitle).toContain("Estágio: Z — Fechado (novo rótulo)");
  });

  it("Filename termina em data ISO (YYYY-MM-DD) da data fornecida", () => {
    const name = buildPipelineExportFileName("Leads", {}, new Date("2026-01-15T12:34:56Z"));
    const iso = name.split("_").pop()!;
    expect(iso).toMatch(ISO_DATE);
    expect(iso).toBe("2026-01-15");
  });

  it("Filename com estágio filtrado usa o slug do rótulo ATUAL (não o antigo) e data ISO", () => {
    const name = buildPipelineExportFileName(
      "Leads",
      { estagio: "mandar_opcoes" },
      new Date("2026-07-02T00:00:00Z"),
    );
    // Rótulo remapeado "M — Mandar (novo rótulo)" → slug "m-mandar-novo-rotulo"
    expect(name).toMatch(/m-mandar-novo-rotulo/);
    expect(name).toMatch(/_2026-07-02$/);
  });

  it("Percentuais derivados do summary batem com a contagem por estágio de ESTAGIOS", () => {
    const summary = buildPipelinePdfSummary(dataset as any);
    const total = summary.reduce((s, i) => s + Number(i.value), 0);
    expect(total).toBe(dataset.length);

    const pct = summary.map((i) => ({
      label: i.label,
      pct: Math.round((Number(i.value) / total) * 1000) / 10, // 1 casa decimal
    }));

    // Ordem preservada de ESTAGIOS (rótulos remapeados).
    expect(pct.map((p) => p.label)).toEqual(ESTAGIOS.map((e) => e.title));

    const byLabel = Object.fromEntries(pct.map((p) => [p.label, p.pct]));
    // 2 novos, 1 mandar_opcoes, 1 fechado, 1 qualificados de 5.
    expect(byLabel["A — Novos (novo rótulo)"]).toBe(40);
    expect(byLabel["M — Mandar (novo rótulo)"]).toBe(20);
    expect(byLabel["Z — Fechado (novo rótulo)"]).toBe(20);
    expect(byLabel["Q — Qualificados (novo)"]).toBe(20);

    // Soma dos percentuais é 100%.
    expect(pct.reduce((s, p) => s + p.pct, 0)).toBeCloseTo(100, 1);
  });

  it("Filtro por estágio: summary contém apenas o estágio filtrado e o percentual é 100%", () => {
    const summary = buildPipelinePdfSummary(dataset as any, { estagio: "novos" });
    expect(summary).toHaveLength(1);
    expect(summary[0].label).toBe("A — Novos (novo rótulo)");
    expect(Number(summary[0].value)).toBe(2);
    const total = Number(summary[0].value);
    expect(Math.round((total / total) * 100)).toBe(100);
  });

  it("describePipelineFilters formata valores min/max em BRL com precisão", () => {
    const parts = describePipelineFilters({ valorMin: 99.9, valorMax: 1234567.8 });
    expect(parts.some((p) => BRL("99", "90").test(p))).toBe(true);
    expect(parts.some((p) => BRL("1.234.567", "80").test(p))).toBe(true);
  });

  it("Nenhum artefato de exportação (moeda/data/percentual) menciona 'Procurar Opções'", () => {
    const blob = JSON.stringify({
      pdf: buildPipelinePdfRows(dataset as any),
      csv: buildPipelineCsvRows(dataset as any),
      summary: buildPipelinePdfSummary(dataset as any),
      subtitle: buildPipelineExportSubtitle(dataset as any, { valorMin: 1, valorMax: 9 }),
      filename: buildPipelineExportFileName("Leads", { estagio: "mandar_opcoes" }, new Date("2026-07-02")),
    });
    expect(blob).not.toMatch(/procurar/i);
    expect(blob).not.toMatch(/procurar_opcoes/);
  });
});
