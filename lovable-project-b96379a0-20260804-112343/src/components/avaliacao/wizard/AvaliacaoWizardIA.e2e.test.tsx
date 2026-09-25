/**
 * E2E tests — Edge function `avaliacao-wizard-ia` + renderização no Step 4.
 *
 * 1. Contrato JSON: payload de entrada esperado + parsing tolerante (raw, fenced, embedded).
 * 2. Integração UI: ao clicar "Analisar com IA", o componente chama supabase.functions.invoke
 *    com o corpo correto e renderiza inconsistências, suficiência, fundamentação e conclusão.
 * 3. Fallback de erro: surfaces no toast e não quebra a UI.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// ---------- Mocks globais (antes de importar o componente) ----------

const invokeMock = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: (...args: any[]) => invokeMock(...args) } },
}));

const toastMock = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

// Recharts: stub ResponsiveContainer p/ não exigir layout no jsdom
vi.mock("recharts", async () => {
  const actual = await vi.importActual<any>("recharts");
  return {
    ...actual,
    ResponsiveContainer: ({ children }: any) => (
      <div style={{ width: 500, height: 220 }}>{children}</div>
    ),
  };
});

import { Step4Resultado } from "./Step4Resultado";
import { emptyWizardState, type WizardState } from "./types";
import { FATORES_DEFAULT, type ComparavelInput } from "@/lib/avaliacao/engine";

// ---------- Helpers ----------

function comp(i: number): ComparavelInput {
  return {
    id: `c-${i}`,
    endereco: `Rua ${i}`,
    bairro: "Asa Sul",
    area: 100,
    valor_anunciado: 800_000 + i * 5_000,
    valor_negociado: 780_000 + i * 5_000,
    distancia_km: 0.5,
    data_pesquisa: "2026-06-01",
    link_fonte: "",
    observacoes: "",
  };
}

function buildState(): WizardState {
  const s = emptyWizardState();
  s.imovel = {
    ...s.imovel,
    tipo: "Apartamento",
    endereco: "SQS 308",
    bairro: "Asa Sul",
    cidade: "Brasília",
    estado: "DF",
    cep: "70355-010",
    area_construida: "100",
    quartos: "3",
    banheiros: "2",
    garagens: "2",
  };
  s.comparaveis = Array.from({ length: 6 }, (_, i) => comp(i + 1));
  s.fatores = Object.fromEntries(s.comparaveis.map((c) => [c.id, { ...FATORES_DEFAULT }]));
  return s;
}

// Reimplementação fiel do safeJson da edge function (para validar contrato)
function safeJson(text: string): any {
  try { return JSON.parse(text); } catch { /* try fence */ }
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) { try { return JSON.parse(m[1]); } catch { /* ignore */ } }
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) {
    try { return JSON.parse(text.slice(first, last + 1)); } catch { /* ignore */ }
  }
  return null;
}

// ---------- 1) Contrato JSON ----------

describe("[E2E] avaliacao-wizard-ia — contrato de resposta JSON", () => {
  const exemplo = {
    inconsistencias: ["Comparável #3 com área 60% menor", "Distância > 5km"],
    suficiencia: "Amostra com 6 elementos e CV de 12% atende NBR 14.653.",
    valor_sugerido_ia: 820_000,
    fundamentacao: "Aplicado método comparativo direto conforme ABNT NBR 14.653...",
    conclusao: "Valor final R$ 820.000, faixa R$ 780.000 a R$ 860.000.",
  };

  it("aceita JSON puro", () => {
    const parsed = safeJson(JSON.stringify(exemplo));
    expect(parsed).toMatchObject(exemplo);
  });

  it("aceita JSON dentro de fence ```json", () => {
    const parsed = safeJson("Aqui está:\n```json\n" + JSON.stringify(exemplo) + "\n```\nFim.");
    expect(parsed).toMatchObject(exemplo);
  });

  it("aceita JSON embutido em texto livre", () => {
    const parsed = safeJson("Resposta: " + JSON.stringify(exemplo) + " (assinado)");
    expect(parsed).toMatchObject(exemplo);
  });

  it("retorna null para conteúdo inválido", () => {
    expect(safeJson("texto sem JSON")).toBeNull();
  });

  it("payload obrigatório possui todas as chaves esperadas", () => {
    const parsed = safeJson(JSON.stringify(exemplo))!;
    for (const k of ["inconsistencias", "suficiencia", "valor_sugerido_ia", "fundamentacao", "conclusao"]) {
      expect(parsed).toHaveProperty(k);
    }
    expect(Array.isArray(parsed.inconsistencias)).toBe(true);
    expect(typeof parsed.suficiencia).toBe("string");
    expect(typeof parsed.fundamentacao).toBe("string");
    expect(typeof parsed.conclusao).toBe("string");
    expect(typeof parsed.valor_sugerido_ia).toBe("number");
  });
});

// ---------- 2) Renderização no Step 4 ----------

describe("[E2E] avaliacao-wizard-ia — integração com Step4Resultado", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    toastMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("invoca a edge function com payload completo e renderiza todas as seções da IA", async () => {
    const iaPayload = {
      inconsistencias: ["Comparável #2 com data de pesquisa > 12 meses"],
      suficiencia: "Amostra de 6 elementos com CV adequado — método comparativo aplicável.",
      valor_sugerido_ia: 815_000,
      fundamentacao: "Conforme ABNT NBR 14.653, o método comparativo direto foi aplicado...",
      conclusao: "Valor final atribuído: R$ 815.000 com faixa de IC 95%.",
    };
    invokeMock.mockResolvedValueOnce({ data: iaPayload, error: null });

    const state = buildState();
    const onResult = vi.fn();
    const onIA = vi.fn();

    const { rerender } = render(
      <Step4Resultado state={state} onResult={onResult} onIA={onIA} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Analisar com IA/i }));

    await waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(1));

    // Valida nome da função + estrutura do body
    const [fnName, opts] = invokeMock.mock.calls[0];
    expect(fnName).toBe("avaliacao-wizard-ia");
    expect(opts.headers).toEqual(
      expect.objectContaining({ "x-request-id": expect.stringMatching(/^aval_/) }),
    );
    expect(opts.body).toMatchObject({
      imovel: expect.objectContaining({ tipo: "Apartamento", cidade: "Brasília" }),
      comparaveis: expect.any(Array),
      estatisticas: expect.objectContaining({
        media: expect.any(Number),
        mediana: expect.any(Number),
        coeficienteVariacao: expect.any(Number),
        intervaloConfianca: expect.objectContaining({
          inferior: expect.any(Number),
          superior: expect.any(Number),
        }),
      }),
      valor_sugerido: expect.any(Number),
      qualidade: expect.objectContaining({ nivel: expect.any(String) }),
      area: 100,
    });
    expect(opts.body.comparaveis.length).toBeGreaterThan(0);

    // Confirma callback de IA com o payload normalizado
    await waitFor(() => expect(onIA).toHaveBeenCalledTimes(1));
    const iaArg = onIA.mock.calls[0][0];
    expect(iaArg).toMatchObject({
      inconsistencias: iaPayload.inconsistencias,
      suficiencia: iaPayload.suficiencia,
      valor_sugerido_ia: iaPayload.valor_sugerido_ia,
      fundamentacao: iaPayload.fundamentacao,
      conclusao: iaPayload.conclusao,
    });
    expect(iaArg.gerado_em).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    // Toast de sucesso
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringMatching(/Análise pronta/i) }),
    );

    // Re-renderiza com state.iaAnalise para validar as seções
    rerender(
      <Step4Resultado
        state={{ ...state, iaAnalise: { ...iaArg } }}
        onResult={onResult}
        onIA={onIA}
      />,
    );

    expect(await screen.findByText(/Inconsistências/i)).toBeInTheDocument();
    expect(screen.getByText(iaPayload.inconsistencias[0])).toBeInTheDocument();

    expect(screen.getByText(/Suficiência da amostra/i)).toBeInTheDocument();
    expect(screen.getByText(iaPayload.suficiencia)).toBeInTheDocument();

    expect(screen.getAllByText(/Fundamentação técnica/i).length).toBeGreaterThan(0);
    expect(screen.getByText(iaPayload.fundamentacao)).toBeInTheDocument();

    expect(screen.getAllByText(/^Conclusão$/i).length).toBeGreaterThan(0);
    expect(screen.getByText(iaPayload.conclusao)).toBeInTheDocument();

    // Valor IA formatado em pt-BR (NBSP entre R$ e número)
    expect(screen.getAllByText(/815\.000/).length).toBeGreaterThan(0);
  });

  it("não renderiza inconsistências quando a lista vem vazia", async () => {
    const iaPayload = {
      inconsistencias: [],
      suficiencia: "Tudo certo.",
      fundamentacao: "Base técnica.",
      conclusao: "Valor final OK.",
    };
    invokeMock.mockResolvedValueOnce({ data: iaPayload, error: null });

    const state = buildState();
    const onIA = vi.fn();
    const { rerender } = render(
      <Step4Resultado state={state} onResult={vi.fn()} onIA={onIA} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Analisar com IA/i }));
    await waitFor(() => expect(onIA).toHaveBeenCalled());

    rerender(
      <Step4Resultado
        state={{ ...state, iaAnalise: { ...onIA.mock.calls[0][0] } }}
        onResult={vi.fn()}
        onIA={onIA}
      />,
    );

    expect(screen.queryByText(/Inconsistências/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Suficiência da amostra/i)).toBeInTheDocument();
  });

  it("exibe toast de erro quando a edge function falha", async () => {
    invokeMock.mockResolvedValueOnce({ data: null, error: new Error("IA retornou 402") });

    render(<Step4Resultado state={buildState()} onResult={vi.fn()} onIA={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Analisar com IA/i }));

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringMatching(/Falha ao analisar/i),
          variant: "destructive",
        }),
      ),
    );
  });

  it("bloqueia chamada quando não há comparáveis válidos", async () => {
    const s = buildState();
    s.comparaveis = [];
    s.fatores = {};
    render(<Step4Resultado state={s} onResult={vi.fn()} onIA={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /Analisar com IA/i }));

    expect(invokeMock).not.toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringMatching(/Sem dados/i) }),
    );
  });
});

// ---------- 3) JSON inválido / malformado vindo da edge function ----------

describe("[E2E] avaliacao-wizard-ia — respostas inválidas não quebram a UI", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    toastMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  async function clickAnalisar(state = buildState()) {
    const onIA = vi.fn();
    const onResult = vi.fn();
    const utils = render(
      <Step4Resultado state={state} onResult={onResult} onIA={onIA} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Analisar com IA/i }));
    return { ...utils, onIA, onResult };
  }

  it("trata data=null com toast destrutivo e não invoca onIA", async () => {
    invokeMock.mockResolvedValueOnce({ data: null, error: null });
    const { onIA } = await clickAnalisar();

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringMatching(/Resposta da IA inválida/i),
          variant: "destructive",
        }),
      ),
    );
    expect(onIA).not.toHaveBeenCalled();
    // UI continua viva — KPIs ainda renderizados
    expect(screen.getByText(/Amostra válida/i)).toBeInTheDocument();
  });

  it("trata data como string (não-objeto) sem renderizar análise", async () => {
    invokeMock.mockResolvedValueOnce({ data: "texto solto sem JSON", error: null });
    const { onIA } = await clickAnalisar();

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "destructive" }),
      ),
    );
    expect(onIA).not.toHaveBeenCalled();
    expect(screen.queryByText(/^Conclusão$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Suficiência da amostra/i)).not.toBeInTheDocument();
  });

  it("trata objeto vazio {} como inválido (sem conteúdo mínimo)", async () => {
    invokeMock.mockResolvedValueOnce({ data: {}, error: null });
    const { onIA } = await clickAnalisar();

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringMatching(/Resposta da IA inválida/i),
          variant: "destructive",
        }),
      ),
    );
    expect(onIA).not.toHaveBeenCalled();
  });

  it("trata campos com tipos errados (números/objetos onde se esperava string)", async () => {
    invokeMock.mockResolvedValueOnce({
      data: {
        inconsistencias: "não é array",
        suficiencia: 12345,
        fundamentacao: { foo: "bar" },
        conclusao: null,
        valor_sugerido_ia: "abc",
      },
      error: null,
    });
    const { onIA } = await clickAnalisar();

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringMatching(/Resposta da IA inválida/i),
          variant: "destructive",
        }),
      ),
    );
    expect(onIA).not.toHaveBeenCalled();
  });

  it("normaliza payload parcial válido (apenas fundamentação) e renderiza", async () => {
    invokeMock.mockResolvedValueOnce({
      data: {
        inconsistencias: ["", "  ", "Item válido"], // entradas vazias serão filtradas pelo schema
        fundamentacao: "Análise técnica fundamentada conforme NBR.",
        // suficiencia, conclusao, valor_sugerido_ia ausentes
      },
      error: null,
    });
    const state = buildState();
    const onIA = vi.fn();
    const { rerender } = render(
      <Step4Resultado state={state} onResult={vi.fn()} onIA={onIA} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Analisar com IA/i }));

    await waitFor(() => expect(onIA).toHaveBeenCalledTimes(1));
    const ia = onIA.mock.calls[0][0];
    expect(ia.fundamentacao).toMatch(/NBR/);
    expect(ia.suficiencia).toBe("");
    expect(ia.conclusao).toBe("");
    expect(ia.valor_sugerido_ia).toBeUndefined();

    rerender(
      <Step4Resultado
        state={{ ...state, iaAnalise: { ...ia } }}
        onResult={vi.fn()}
        onIA={onIA}
      />,
    );

    // Fundamentação aparece; conclusão e suficiência não
    expect(screen.getByText(/Análise técnica fundamentada/i)).toBeInTheDocument();
    expect(screen.queryByText(/Suficiência da amostra/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Conclusão$/i)).not.toBeInTheDocument();
  });

  it("não trava quando a edge function devolve data=undefined", async () => {
    invokeMock.mockResolvedValueOnce({ data: undefined, error: null });
    const { onIA } = await clickAnalisar();

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "destructive" }),
      ),
    );
    expect(onIA).not.toHaveBeenCalled();
    // Botão volta a ficar habilitado após a falha
    expect(screen.getByRole("button", { name: /Analisar com IA/i })).not.toBeDisabled();
  });

  it("permite uma nova tentativa após resposta inválida (retry funciona)", async () => {
    invokeMock
      .mockResolvedValueOnce({ data: { foo: "bar" }, error: null })
      .mockResolvedValueOnce({
        data: {
          inconsistencias: [],
          suficiencia: "Amostra OK.",
          fundamentacao: "Base técnica.",
          conclusao: "Valor final OK.",
          valor_sugerido_ia: 815000,
        },
        error: null,
      });

    const state = buildState();
    const onIA = vi.fn();
    render(<Step4Resultado state={state} onResult={vi.fn()} onIA={onIA} />);

    const btn = screen.getByRole("button", { name: /Analisar com IA/i });
    fireEvent.click(btn);
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "destructive" }),
      ),
    );
    expect(onIA).not.toHaveBeenCalled();

    // Segunda tentativa com payload válido
    fireEvent.click(btn);
    await waitFor(() => expect(onIA).toHaveBeenCalledTimes(1));
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringMatching(/Análise pronta/i) }),
    );
    expect(invokeMock).toHaveBeenCalledTimes(2);
  });
});

// ---------- 4) Falhas de rede / timeout / HTTP não-200 ----------

describe("[E2E] avaliacao-wizard-ia — falhas de rede e HTTP não-200", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    toastMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  async function clickAndExpectFailure(matcher: RegExp = /Falha ao analisar/i) {
    const onIA = vi.fn();
    render(<Step4Resultado state={buildState()} onResult={vi.fn()} onIA={onIA} />);
    fireEvent.click(screen.getByRole("button", { name: /Analisar com IA/i }));

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringMatching(matcher),
          variant: "destructive",
        }),
      ),
    );
    expect(onIA).not.toHaveBeenCalled();
    // UI preservada: KPIs e botão habilitado novamente
    expect(screen.getByText(/Amostra válida/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Analisar com IA/i })).not.toBeDisabled();
  }

  it("trata TypeError 'Failed to fetch' (rede offline)", async () => {
    invokeMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await clickAndExpectFailure();
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ description: expect.stringMatching(/Failed to fetch/i) }),
    );
  });

  it("trata AbortError de timeout do client", async () => {
    const abort = new Error("The operation was aborted due to timeout");
    abort.name = "AbortError";
    invokeMock.mockRejectedValueOnce(abort);
    await clickAndExpectFailure();
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ description: expect.stringMatching(/aborted|timeout/i) }),
    );
  });

  it("trata FunctionsHttpError 500 (Internal Server Error)", async () => {
    const err = Object.assign(new Error("Edge Function returned a non-2xx status code"), {
      name: "FunctionsHttpError",
      context: { status: 500 },
    });
    invokeMock.mockResolvedValueOnce({ data: null, error: err });
    await clickAndExpectFailure();
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ description: expect.stringMatching(/non-2xx|500/i) }),
    );
  });

  it("trata HTTP 401 (não autenticado)", async () => {
    const err = Object.assign(new Error("Unauthorized"), {
      name: "FunctionsHttpError",
      context: { status: 401 },
    });
    invokeMock.mockResolvedValueOnce({ data: null, error: err });
    await clickAndExpectFailure();
  });

  it("trata HTTP 402 (créditos insuficientes do AI Gateway)", async () => {
    const err = Object.assign(new Error("Payment Required: AI credits exhausted"), {
      name: "FunctionsHttpError",
      context: { status: 402 },
    });
    invokeMock.mockResolvedValueOnce({ data: null, error: err });
    await clickAndExpectFailure();
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ description: expect.stringMatching(/credits|Payment/i) }),
    );
  });

  it("trata HTTP 429 (rate limit)", async () => {
    const err = Object.assign(new Error("Too Many Requests"), {
      name: "FunctionsHttpError",
      context: { status: 429 },
    });
    invokeMock.mockResolvedValueOnce({ data: null, error: err });
    await clickAndExpectFailure();
  });

  it("trata HTTP 503 (serviço indisponível)", async () => {
    const err = Object.assign(new Error("Service Unavailable"), {
      name: "FunctionsHttpError",
      context: { status: 503 },
    });
    invokeMock.mockResolvedValueOnce({ data: null, error: err });
    await clickAndExpectFailure();
  });

  it("trata FunctionsRelayError (relay/edge runtime down)", async () => {
    const err = Object.assign(new Error("Relay error invoking the Edge Function"), {
      name: "FunctionsRelayError",
    });
    invokeMock.mockResolvedValueOnce({ data: null, error: err });
    await clickAndExpectFailure();
  });

  it("usa mensagem genérica quando o erro não traz .message", async () => {
    invokeMock.mockRejectedValueOnce({});
    await clickAndExpectFailure();
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ description: expect.stringMatching(/Tente novamente/i) }),
    );
  });

  it("após falha, permite nova tentativa bem-sucedida (retry)", async () => {
    const netErr = new TypeError("Failed to fetch");
    invokeMock
      .mockRejectedValueOnce(netErr)
      .mockResolvedValueOnce({
        data: {
          inconsistencias: [],
          suficiencia: "Amostra OK.",
          fundamentacao: "Base técnica.",
          conclusao: "Valor final OK.",
          valor_sugerido_ia: 820000,
        },
        error: null,
      });

    const state = buildState();
    const onIA = vi.fn();
    render(<Step4Resultado state={state} onResult={vi.fn()} onIA={onIA} />);

    const btn = screen.getByRole("button", { name: /Analisar com IA/i });
    fireEvent.click(btn);
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: expect.stringMatching(/Falha ao analisar/i) }),
      ),
    );
    expect(onIA).not.toHaveBeenCalled();
    expect(btn).not.toBeDisabled();

    fireEvent.click(btn);
    await waitFor(() => expect(onIA).toHaveBeenCalledTimes(1));
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringMatching(/Análise pronta/i) }),
    );
    expect(invokeMock).toHaveBeenCalledTimes(2);
  });
});
