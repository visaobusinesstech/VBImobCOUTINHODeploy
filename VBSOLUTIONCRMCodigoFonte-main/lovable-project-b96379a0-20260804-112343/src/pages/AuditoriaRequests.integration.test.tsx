import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

// ---- Mocks ----
const toastMock = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ isMaster: true, loading: false }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: () => ({
          limit: () =>
            Promise.resolve({
              data: [
                {
                  id: "1",
                  request_id: "aval_abc",
                  function_name: "avaliacao-wizard-ia",
                  user_id: null,
                  status: "ok",
                  http_status: 200,
                  duration_ms: 123,
                  error_message: null,
                  metadata: null,
                  created_at: new Date().toISOString(),
                },
                {
                  id: "2",
                  request_id: "aval_def",
                  function_name: "test-ai-config",
                  user_id: null,
                  status: "error",
                  http_status: 500,
                  duration_ms: 50,
                  error_message: "boom",
                  metadata: null,
                  created_at: new Date().toISOString(),
                },
              ],
              error: null,
            }),
        }),
      }),
    }),
  },
}));

import AuditoriaRequests from "./AuditoriaRequests";

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/auditoria-requests" element={<AuditoriaRequests />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AuditoriaRequests — shared link integration", () => {
  beforeEach(() => {
    toastMock.mockClear();
    localStorage.clear();
  });

  it("restores filters/sort/pagination from URL and shows shared-config toast", async () => {
    renderAt("/auditoria-requests?q=aval_&status=error&sort=function_name&dir=asc&size=100&page=1");

    await waitFor(() => {
      expect(screen.getByDisplayValue("aval_")).toBeInTheDocument();
    });

    const sharedToast = toastMock.mock.calls.find(
      ([t]) => t?.title === "Configuração compartilhada aplicada",
    );
    expect(sharedToast).toBeTruthy();
    expect(String(sharedToast?.[0].description)).toContain('busca "aval_"');
    expect(String(sharedToast?.[0].description)).toContain("status=error");
    expect(String(sharedToast?.[0].description)).toContain("ordem=function_name:asc");
  });

  it("shows named-view toast when ?view=… is present", async () => {
    renderAt("/auditoria-requests?view=Minha%20view&status=ok");

    await waitFor(() => {
      const named = toastMock.mock.calls.find(([t]) => t?.title === "Visualização carregada");
      expect(named).toBeTruthy();
      expect(named?.[0].description).toBe("Minha view");
    });
  });

  it("emits a destructive toast listing invalid params that were discarded", async () => {
    renderAt("/auditoria-requests?sort=bogus&dir=sideways&status=nope&size=999&page=-3&fn=has%20space");

    await waitFor(() => {
      const dropped = toastMock.mock.calls.find(
        ([t]) => t?.title === "Parâmetros inválidos ignorados",
      );
      expect(dropped).toBeTruthy();
      expect(dropped?.[0].variant).toBe("destructive");
      const desc = String(dropped?.[0].description);
      ["sort", "dir", "status", "size", "page", "fn"].forEach((k) =>
        expect(desc).toContain(k),
      );
    });
  });

  it("reconciles unknown fn against loaded data and notifies the user", async () => {
    renderAt("/auditoria-requests?fn=funcao-inexistente");

    await waitFor(() => {
      const reconciled = toastMock.mock.calls.find(
        ([t]) => t?.title === "Função desconhecida ignorada",
      );
      expect(reconciled).toBeTruthy();
      expect(String(reconciled?.[0].description)).toContain("funcao-inexistente");
    });
  });

  it("does not emit shared-config toast when URL has no filter params", async () => {
    renderAt("/auditoria-requests");

    await waitFor(() => {
      // wait for data to settle
      expect(screen.getByText(/Auditoria de requisições/i)).toBeInTheDocument();
    });

    const shared = toastMock.mock.calls.find(
      ([t]) => t?.title === "Configuração compartilhada aplicada",
    );
    const named = toastMock.mock.calls.find(([t]) => t?.title === "Visualização carregada");
    expect(shared).toBeFalsy();
    expect(named).toBeFalsy();
  });
});
