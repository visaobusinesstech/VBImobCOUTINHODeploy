import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// Mock hooks consumed by the panel
const captacoesMock: {
  id: string;
  tipo: string;
  status: string;
  operacao: string;
  observacoes: string | null;
  nome_contato: string;
  telefone_contato: string;
  created_at: string;
  updated_at: string;
}[] = [];

vi.mock("@/hooks/useCaptacoes", () => ({
  useCaptacoes: () => ({ captacoes: captacoesMock, loading: false }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ isMaster: false }),
}));

// framer-motion: render div directly to avoid animation noise
vi.mock("framer-motion", () => ({
  motion: new Proxy(
    {},
    { get: () => (props: any) => <div {...props} /> },
  ),
}));

import { RelatorioPerformancePanel } from "./RelatorioPerformancePanel";

const today = new Date();
const isoYesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString();
const isoNow = today.toISOString();

const seedData = () => {
  captacoesMock.length = 0;
  captacoesMock.push(
    {
      id: "1",
      tipo: "indicacao",
      status: "concluida",
      operacao: "Venda",
      observacoes: "Indicado por: Carlos Silva\nLead quente",
      nome_contato: "João Pereira",
      telefone_contato: "11999990001",
      created_at: isoYesterday,
      updated_at: isoNow,
    },
    {
      id: "2",
      tipo: "indicacao",
      status: "pendente",
      operacao: "Locação",
      observacoes: "Indicado por: Ana Souza",
      nome_contato: "Maria Lima",
      telefone_contato: "11999990002",
      created_at: isoYesterday,
      updated_at: isoYesterday,
    },
    {
      id: "3",
      tipo: "porteiro",
      status: "concluida",
      operacao: "Venda",
      observacoes: null,
      nome_contato: "Cliente Porteiro",
      telefone_contato: "11999990003",
      created_at: isoYesterday,
      updated_at: isoNow,
    },
  );
};

describe("RelatorioPerformancePanel — e2e Exportar CSV", () => {
  let capturedText: string | null = null;
  let capturedFilename: string | null = null;
  let originalBlob: typeof Blob;
  let originalCreateObjectURL: typeof URL.createObjectURL;
  let originalRevokeObjectURL: typeof URL.revokeObjectURL;
  let clickSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    seedData();
    capturedText = null;
    capturedFilename = null;

    originalBlob = globalThis.Blob;
    // Intercept Blob construction so we can read the CSV string directly.
    class CapturingBlob extends originalBlob {
      constructor(parts?: BlobPart[], options?: BlobPropertyBag) {
        super(parts, options);
        capturedText = (parts ?? [])
          .map((p) => (typeof p === "string" ? p : ""))
          .join("");
      }
    }
    (globalThis as any).Blob = CapturingBlob;

    originalCreateObjectURL = URL.createObjectURL;
    originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(() => "blob:mock-url") as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL;

    clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        capturedFilename = this.getAttribute("download");
      });
  });

  afterEach(() => {
    (globalThis as any).Blob = originalBlob;
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    clickSpy.mockRestore();
  });

  it("baixa CSV com coluna 'Indicado por' e bloco 'Detalhe Indicações' quando há indicações no período", async () => {
    render(<RelatorioPerformancePanel />);

    const btn = await screen.findByRole("button", { name: /exportar csv/i });
    expect(btn).not.toBeDisabled();

    fireEvent.click(btn);

    await waitFor(() => expect(capturedText).not.toBeNull());
    expect(capturedFilename).toMatch(/^relatorio-captacao-\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.csv$/);

    const text = capturedText!;

    // BOM presente para Excel pt-BR
    expect(text.charCodeAt(0)).toBe(0xfeff);

    // Cabeçalho principal com coluna Indicado por
    expect(text).toContain("Indicado por");

    // Linha do canal Indicação com indicadores agregados
    expect(text).toMatch(/Indica[cç][aã]o/);
    expect(text).toContain("Carlos Silva");
    expect(text).toContain("Ana Souza");

    // Bloco "Detalhe Indicações" presente
    expect(text).toContain("Detalhe Indicações");

    // Linhas detalhadas com nomes/contatos das indicações
    expect(text).toContain("João Pereira");
    expect(text).toContain("Maria Lima");

    // Captação não-indicação não deve aparecer no bloco de detalhe
    const detalheIdx = text.indexOf("Detalhe Indicações");
    const detalheBloco = text.slice(detalheIdx);
    expect(detalheBloco).not.toContain("Cliente Porteiro");
  });

  it("não inclui o bloco 'Detalhe Indicações' quando não há indicações no período", async () => {
    captacoesMock.length = 0;
    captacoesMock.push({
      id: "x",
      tipo: "porteiro",
      status: "concluida",
      operacao: "Venda",
      observacoes: null,
      nome_contato: "Somente Porteiro",
      telefone_contato: "11888880000",
      created_at: isoYesterday,
      updated_at: isoNow,
    });

    render(<RelatorioPerformancePanel />);
    fireEvent.click(await screen.findByRole("button", { name: /exportar csv/i }));

    await waitFor(() => expect(capturedText).not.toBeNull());
    const text = capturedText!;

    expect(text).toContain("Indicado por"); // coluna sempre presente
    expect(text).not.toContain("Detalhe Indicações"); // bloco condicional
  });
});
