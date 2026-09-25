import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCaptacoes } from "./useCaptacoes";

const {
  toastMock,
  useAuthMock,
  orderMock,
  eqSelectMock,
  selectMock,
  insertMock,
  updateEqMock,
  updateMock,
  deleteEqMock,
  deleteMock,
  fromMock,
} = vi.hoisted(() => {
  const toastMock = vi.fn();
  const useAuthMock = vi.fn();
  const orderMock = vi.fn();
  const eqSelectMock = vi.fn(() => ({ order: orderMock }));
  const selectMock = vi.fn(() => ({ eq: eqSelectMock }));
  const insertMock = vi.fn();
  const updateEqMock = vi.fn();
  const updateMock = vi.fn(() => ({ eq: updateEqMock }));
  const deleteEqMock = vi.fn();
  const deleteMock = vi.fn(() => ({ eq: deleteEqMock }));
  const fromMock = vi.fn(() => ({
    select: selectMock,
    insert: insertMock,
    update: updateMock,
    delete: deleteMock,
  }));

  return {
    toastMock,
    useAuthMock,
    orderMock,
    eqSelectMock,
    selectMock,
    insertMock,
    updateEqMock,
    updateMock,
    deleteEqMock,
    deleteMock,
    fromMock,
  };
});

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: fromMock,
  },
}));

describe("useCaptacoes", () => {
  const flushAsync = async () => {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();

    useAuthMock.mockReturnValue({
      user: { id: "user-1" },
      imobiliariaId: "imob-1",
      loading: false,
    });

    orderMock.mockResolvedValue({ data: [], error: null });
    insertMock.mockResolvedValue({ error: null });
    updateEqMock.mockResolvedValue({ error: null });
    deleteEqMock.mockResolvedValue({ error: null });
  });

  it("carrega captações do imobiliariaId autenticado", async () => {
    renderHook(() => useCaptacoes());

    await flushAsync();

    expect(eqSelectMock).toHaveBeenCalledWith("imobiliaria_id", "imob-1");
  });

  it("usa o imobiliariaId autenticado ao criar uma captação", async () => {
    const { result } = renderHook(() => useCaptacoes());

    await flushAsync();

    await act(async () => {
      await result.current.createCaptacao({ nome_contato: "Teste", tipo: "porteiro" } as Partial<ReturnType<typeof useCaptacoes>["captacoes"][number]>);
    });

    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        nome_contato: "Teste",
        tipo: "porteiro",
        imobiliaria_id: "imob-1",
      }),
    );
  });

  it("propaga erro ao criar captação para não sinalizar falso sucesso", async () => {
    insertMock.mockResolvedValueOnce({ error: { message: "falha ao inserir" } });
    const { result } = renderHook(() => useCaptacoes());

    await flushAsync();

    await act(async () => {
      await expect(
        result.current.createCaptacao({ nome_contato: "Teste", tipo: "porteiro" } as Partial<ReturnType<typeof useCaptacoes>["captacoes"][number]>),
      ).rejects.toMatchObject({ message: "falha ao inserir" });
    });

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Erro ao criar captação",
        variant: "destructive",
      }),
    );
  });
});