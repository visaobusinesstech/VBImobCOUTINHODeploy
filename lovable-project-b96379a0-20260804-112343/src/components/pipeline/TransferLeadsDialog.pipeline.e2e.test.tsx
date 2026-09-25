import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TransferLeadsDialog } from "./TransferLeadsDialog";
import { ESTAGIOS } from "@/hooks/useLeads";

// Mocks alinhados ao TransferLeadsDialog.test.tsx
vi.mock("@/integrations/supabase/client", () => {
  const chain: any = {
    update: vi.fn(() => chain),
    in: vi.fn(() => Promise.resolve({ error: null })),
    insert: vi.fn(() => Promise.resolve({ error: null })),
    select: vi.fn(() => chain),
    ilike: vi.fn(() => chain),
    maybeSingle: vi.fn(() => Promise.resolve({ data: null })),
  };
  return {
    supabase: {
      from: vi.fn(() => chain),
      auth: { getUser: vi.fn(() => Promise.resolve({ data: { user: { id: "u1", email: "admin@test" } } })) },
    },
  };
});
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
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

describe("Pipeline / TransferLeadsDialog / Filtros — pipeline sem 'Procurar Opções' (e2e)", () => {
  it("ESTAGIOS não contém 'procurar_opcoes' nem o título 'Procurar Opções'", () => {
    expect(ESTAGIOS.map(e => e.id)).not.toContain("procurar_opcoes");
    expect(ESTAGIOS.some(e => /procurar/i.test(e.title))).toBe(false);
    expect(ESTAGIOS.some(e => e.id === "mandar_opcoes")).toBe(true);
  });

  it("filtro de estágio no TransferLeadsDialog carrega apenas ids de ESTAGIOS e nunca renderiza 'Procurar Opções'", () => {
    render(
      <TransferLeadsDialog
        open
        onOpenChange={vi.fn()}
        corretores={[{ id: "c1", nome: "Ana", email: "ana@x", status: "ativo" }]}
        leads={ESTAGIOS.map((e, i) => ({
          id: `l${i}`, nome: `Lead ${i}`, estagio: e.id, canal_origem: "site", corretor_id: null,
        } as any))}
      />
    );

    // Não deve haver a string em nenhum lugar do diálogo
    expect(screen.queryByText(/Procurar Opções/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/procurar_opcoes/i)).not.toBeInTheDocument();

    // O select de estágio deve ter exatamente as opções de ESTAGIOS (+ "todos" + a option vazia do mock)
    const selects = screen.getAllByTestId("mock-select") as HTMLSelectElement[];
    const estagioSelect = selects.find(s =>
      Array.from(s.options).some(o => o.value === "todos")
    );
    expect(estagioSelect).toBeTruthy();
    const values = Array.from(estagioSelect!.options).map(o => o.value).filter(Boolean);
    expect(values).not.toContain("procurar_opcoes");
    for (const e of ESTAGIOS) expect(values).toContain(e.id);
  });

  it("linhas do pipeline renderizadas no diálogo não exibem 'Procurar Opções' como badge de estágio", () => {
    render(
      <TransferLeadsDialog
        open
        onOpenChange={vi.fn()}
        corretores={[{ id: "c1", nome: "Ana", email: "ana@x", status: "ativo" }]}
        leads={ESTAGIOS.map((e, i) => ({
          id: `l${i}`, nome: `Lead ${i}`, estagio: e.id, canal_origem: "site", corretor_id: null,
        } as any))}
      />
    );
    for (const badge of screen.queryAllByText(/opções/i)) {
      expect(badge.textContent?.toLowerCase()).not.toContain("procurar");
    }
  });
});
