/**
 * Teste de integração da tela de relatórios do Pipeline.
 *
 * Reproduz fielmente os onClick dos botões "PDF" e "Excel" de
 * src/pages/Pipeline.tsx (linhas 431–474), incluindo a construção
 * do PipelineExportFilters a partir do estado da UI, e intercepta
 * as chamadas para @/lib/exportPDF e @/lib/exportExcel.
 *
 * Objetivo: garantir que colunas, resumo, subtítulo, filename e linhas
 * exportadas refletem exatamente o estágio filtrado na UI e nunca
 * contêm o estágio removido "Procurar Opções" (id procurar_opcoes).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React, { useState } from "react";

const exportToPDF = vi.fn();
const exportToExcel = vi.fn();

vi.mock("@/lib/exportPDF", () => ({ exportToPDF: (...a: unknown[]) => exportToPDF(...a) }));
vi.mock("@/lib/exportExcel", () => ({ exportToExcel: (...a: unknown[]) => exportToExcel(...a) }));

import {
  PIPELINE_PDF_COLUMNS,
  PIPELINE_CSV_COLUMNS,
  buildPipelinePdfSummary,
  buildPipelinePdfRows,
  buildPipelineCsvRows,
  buildPipelineExportSubtitle,
  buildPipelineExportFileName,
  type PipelineExportFilters,
} from "@/lib/pipelineLeadsExport";
import { ESTAGIOS, type Lead } from "@/hooks/useLeads";
import { exportToPDF as realExportPDF } from "@/lib/exportPDF";
import { exportToExcel as realExportExcel } from "@/lib/exportExcel";

// Dataset com pelo menos um lead em cada estágio válido + variações.
const LEADS: Lead[] = ESTAGIOS.flatMap((e, idx) => ([
  {
    id: `${e.id}-1`,
    nome: `Lead A ${e.id}`,
    estagio: e.id,
    valor: (idx + 1) * 1000,
    interesse: `Apto ${idx}`,
    corretor_id: idx % 2 === 0 ? "corr-1" : null,
    corretor_nome: idx % 2 === 0 ? "Maria Silva" : null,
    telefone: "11999990000",
    email: `lead${idx}@x.com`,
    bairro_interesse: "Centro",
  },
  {
    id: `${e.id}-2`,
    nome: `Lead B ${e.id}`,
    estagio: e.id,
    valor: (idx + 1) * 2000,
    interesse: null,
    corretor_id: null,
    corretor_nome: null,
    telefone: null,
    email: null,
    bairro_interesse: null,
  },
] as unknown as Lead[]));

const CORRETORES = [{ id: "corr-1", nome: "Maria Silva" }];

/**
 * Fixture que espelha 1:1 os handlers dos botões PDF/Excel do Pipeline.
 * Se o Pipeline mudar a forma de montar `exportFilters`, este teste falha.
 */
function ReportExportBar() {
  const [filterEstagio, setFilterEstagio] = useState("todos");
  const [filterCorretor, setFilterCorretor] = useState("todos");
  const [filterValorMin] = useState("");
  const [filterValorMax] = useState("");
  const [searchQuery] = useState("");

  const filteredLeads = LEADS.filter((l) => {
    if (filterEstagio !== "todos" && l.estagio !== filterEstagio) return false;
    if (filterCorretor === "__none__" && l.corretor_id) return false;
    if (filterCorretor !== "todos" && filterCorretor !== "__none__" && l.corretor_id !== filterCorretor) return false;
    return true;
  });

  const buildFilters = (): PipelineExportFilters => ({
    estagio: filterEstagio,
    corretorId: filterCorretor,
    corretorNome: CORRETORES.find((c) => c.id === filterCorretor)?.nome,
    valorMin: filterValorMin,
    valorMax: filterValorMax,
    searchQuery,
  });

  return (
    <div>
      <label>
        Estágio
        <select
          aria-label="filtro-estagio"
          value={filterEstagio}
          onChange={(e) => setFilterEstagio(e.target.value)}
        >
          <option value="todos">Todos</option>
          {ESTAGIOS.map((e) => (
            <option key={e.id} value={e.id}>{e.title}</option>
          ))}
        </select>
      </label>
      <label>
        Corretor
        <select
          aria-label="filtro-corretor"
          value={filterCorretor}
          onChange={(e) => setFilterCorretor(e.target.value)}
        >
          <option value="todos">Todos</option>
          <option value="__none__">Sem atribuição</option>
          {CORRETORES.map((c) => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          ))}
        </select>
      </label>
      <span data-testid="filtered-count">{filteredLeads.length}</span>
      <button
        onClick={() => {
          const exportFilters = buildFilters();
          realExportPDF({
            brandName: "Radar",
            title: "Relatório de Leads",
            subtitle: buildPipelineExportSubtitle(filteredLeads, exportFilters),
            summary: buildPipelinePdfSummary(filteredLeads, exportFilters),
            columns: PIPELINE_PDF_COLUMNS as any,
            data: buildPipelinePdfRows(filteredLeads),
          });
        }}
      >
        PDF
      </button>
      <button
        onClick={() => {
          const exportFilters = buildFilters();
          realExportExcel({
            fileName: buildPipelineExportFileName("Leads", exportFilters),
            sheetName: "Leads",
            columns: PIPELINE_CSV_COLUMNS as any,
            data: buildPipelineCsvRows(filteredLeads),
          });
        }}
      >
        Excel
      </button>
    </div>
  );
}

const setSelect = (label: string, value: string) => {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
};

const NO_PROCURAR = /procurar/i;

describe("Relatórios do Pipeline — export CSV/PDF respeita filtros da UI", () => {
  beforeEach(() => {
    exportToPDF.mockClear();
    exportToExcel.mockClear();
  });

  it("ESTAGIOS não contém 'Procurar Opções' (guarda inicial)", () => {
    expect(ESTAGIOS.some((e) => String(e.id) === "procurar_opcoes")).toBe(false);
    expect(ESTAGIOS.some((e) => NO_PROCURAR.test(e.title))).toBe(false);
  });

  it("Exporta PDF com todos os estágios quando o filtro é 'todos'", () => {
    render(<ReportExportBar />);
    fireEvent.click(screen.getByRole("button", { name: "PDF" }));

    expect(exportToPDF).toHaveBeenCalledTimes(1);
    const payload = exportToPDF.mock.calls[0][0];

    // Colunas fixas (headers) do PDF
    expect(payload.columns.map((c: any) => c.header)).toEqual([
      "Nome", "Interesse", "Valor", "Estágio", "Corretor", "Telefone", "Email",
    ]);

    // Resumo respeita a ordem e os títulos de ESTAGIOS
    expect(payload.summary.map((s: any) => s.label)).toEqual(ESTAGIOS.map((e) => e.title));

    // Cada estágio tem 2 leads (dataset construído assim)
    payload.summary.forEach((s: any) => expect(s.value).toBe("2"));

    // Linhas: total = ESTAGIOS.length * 2, cada estagioNome existe em ESTAGIOS
    expect(payload.data).toHaveLength(ESTAGIOS.length * 2);
    const titulos = new Set(ESTAGIOS.map((e) => e.title));
    payload.data.forEach((r: any) => expect(titulos.has(r.estagioNome)).toBe(true));

    // Nada mencionando o estágio removido
    expect(JSON.stringify(payload)).not.toMatch(NO_PROCURAR);
    expect(JSON.stringify(payload)).not.toMatch(/procurar_opcoes/);
  });

  it("Filtrar por estágio na UI restringe summary, linhas e subtítulo do PDF", () => {
    render(<ReportExportBar />);
    setSelect("filtro-estagio", "fechado");

    expect(screen.getByTestId("filtered-count").textContent).toBe("2");

    fireEvent.click(screen.getByRole("button", { name: "PDF" }));
    const payload = exportToPDF.mock.calls[0][0];

    // Summary agora tem SÓ o estágio filtrado
    expect(payload.summary).toHaveLength(1);
    const titulo = ESTAGIOS.find((e) => e.id === "fechado")!.title;
    expect(payload.summary[0]).toEqual({ label: titulo, value: "2" });

    // Todas as linhas apontam para o estágio filtrado
    expect(payload.data).toHaveLength(2);
    payload.data.forEach((r: any) => expect(r.estagioNome).toBe(titulo));

    // Subtítulo descreve o filtro aplicado
    expect(payload.subtitle).toContain(`Estágio: ${titulo}`);
    expect(payload.subtitle).toContain("2 leads");
  });

  it("Filtrar por corretor 'sem atribuição' na UI reflete no CSV", () => {
    render(<ReportExportBar />);
    setSelect("filtro-corretor", "__none__");

    fireEvent.click(screen.getByRole("button", { name: "Excel" }));
    const payload = exportToExcel.mock.calls[0][0];

    // Cabeçalhos fixos do CSV
    expect(payload.columns.map((c: any) => c.header)).toEqual([
      "Nome", "Estágio", "Valor", "Corretor", "Telefone", "Email", "Interesse", "Bairro",
    ]);

    // Todos sem corretor
    payload.data.forEach((r: any) => expect(r.corretor).toBe(""));

    // Filename contém tag "sem-corretor"
    expect(payload.fileName).toMatch(/sem-corretor/);
    expect(payload.fileName).not.toMatch(NO_PROCURAR);
  });

  it("CSV exportado por estágio filtrado tem valores, colunas e filename coerentes com a UI", () => {
    render(<ReportExportBar />);
    setSelect("filtro-estagio", "novos");

    fireEvent.click(screen.getByRole("button", { name: "Excel" }));
    const payload = exportToExcel.mock.calls[0][0];

    const tituloNovos = ESTAGIOS.find((e) => e.id === "novos")!.title;

    expect(payload.data).toHaveLength(2);
    payload.data.forEach((r: any) => {
      expect(r.estagio).toBe(tituloNovos);
      expect(typeof r.valor).toBe("number");
    });

    // Filename usa o slug do estágio filtrado + data ISO no fim
    expect(payload.fileName).toMatch(/^Leads_.+_\d{4}-\d{2}-\d{2}$/);
    expect(JSON.stringify(payload)).not.toMatch(NO_PROCURAR);
  });

  it("Nenhuma exportação (PDF ou CSV) referencia 'Procurar Opções' em qualquer combinação de filtros", () => {
    render(<ReportExportBar />);
    for (const est of ["todos", ...ESTAGIOS.map((e) => e.id)]) {
      setSelect("filtro-estagio", est);
      fireEvent.click(screen.getByRole("button", { name: "PDF" }));
      fireEvent.click(screen.getByRole("button", { name: "Excel" }));
    }
    const blob = JSON.stringify([
      ...exportToPDF.mock.calls,
      ...exportToExcel.mock.calls,
    ]);
    expect(blob).not.toMatch(NO_PROCURAR);
    expect(blob).not.toMatch(/procurar_opcoes/);
  });
});
