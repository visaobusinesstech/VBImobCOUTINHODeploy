import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ESTAGIOS } from "@/hooks/useLeads";
import { GraficoEstagiosLeadsWidget } from "@/components/dashboard/GraficoEstagiosLeadsWidget";
import { LeadFormDialog } from "@/components/pipeline/LeadFormDialog";
import { ImportExportLeadsDialog } from "@/components/pipeline/ImportLeadsDialog";

// Mocks compartilhados
vi.mock("@/integrations/supabase/client", () => {
  const chain: any = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => Promise.resolve({ error: null })),
    update: vi.fn(() => chain),
    in: vi.fn(() => Promise.resolve({ error: null })),
    eq: vi.fn(() => chain),
    ilike: vi.fn(() => chain),
    maybeSingle: vi.fn(() => Promise.resolve({ data: null })),
  };
  return {
    supabase: {
      from: vi.fn(() => chain),
      auth: { getUser: vi.fn(() => Promise.resolve({ data: { user: { id: "u1", email: "e@x" } } })) },
    },
  };
});
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ imobiliariaId: "i1", user: { id: "u1", email: "e@x" } }) }));
vi.mock("@/hooks/useLeads", async (orig) => {
  const actual: any = await orig();
  return {
    ...actual,
    useLeads: () => ({ leads: [], criarLead: vi.fn(), atualizarLead: vi.fn(), loading: false, corretores: [] }),
  };
});
vi.mock("@/components/ui/select", () => {
  const Select = ({ value, onValueChange, children }: any) => (
    <select data-testid="mock-select" value={value ?? ""} onChange={(e) => onValueChange?.(e.target.value)}>
      <option value="" />
      {children}
    </select>
  );
  const Pass = ({ children }: any) => <>{children}</>;
  const SelectItem = ({ value, children }: any) => <option value={value}>{children}</option>;
  return { Select, SelectTrigger: Pass, SelectValue: () => null, SelectContent: Pass, SelectItem };
});
// Recharts: renderiza filhos como divs simples
vi.mock("recharts", () => {
  const Pass = ({ children }: any) => <div>{children}</div>;
  return {
    ResponsiveContainer: Pass, BarChart: Pass, Bar: Pass, XAxis: Pass, YAxis: Pass,
    CartesianGrid: Pass, Tooltip: Pass, Cell: Pass,
  };
});

const NO_PROCURAR = /procurar op(ç|c)[õo]es/i;

describe("Filtros e relatórios — estágios do pipeline sem 'Procurar Opções' (integração)", () => {
  it("GraficoEstagiosLeadsWidget renderiza todos os estágios de ESTAGIOS e não exibe 'Procurar Opções'", () => {
    render(<GraficoEstagiosLeadsWidget leads={ESTAGIOS.map((e) => ({ estagio: e.id }))} />);
    for (const e of ESTAGIOS) {
      expect(screen.getAllByText(e.title).length).toBeGreaterThan(0);
    }
    expect(screen.queryByText(NO_PROCURAR)).not.toBeInTheDocument();
  });

  it("LeadFormDialog carrega o filtro de estágio a partir de ESTAGIOS", () => {
    render(<LeadFormDialog open onOpenChange={vi.fn()} lead={null} onSave={vi.fn()} saving={false} corretores={[]} />);
    const selects = screen.getAllByTestId("mock-select") as HTMLSelectElement[];
    const estagioSelect = selects.find((s) =>
      Array.from(s.options).some((o) => o.value === "mandar_opcoes")
    );
    expect(estagioSelect).toBeTruthy();
    const values = Array.from(estagioSelect!.options).map((o) => o.value).filter(Boolean);
    expect(values).not.toContain("procurar_opcoes");
    for (const e of ESTAGIOS) expect(values).toContain(e.id);
    expect(screen.queryByText(NO_PROCURAR)).not.toBeInTheDocument();
  });

  it("ImportLeadsDialog não renderiza rótulo 'Procurar Opções' na tela de mapeamento", () => {
    render(<ImportExportLeadsDialog open onOpenChange={vi.fn()} leads={[]} />);
    expect(screen.queryByText(NO_PROCURAR)).not.toBeInTheDocument();
  });
});
