/**
 * E2E: simula a edge function `avaliacao-imovel` devolvendo erro HTTP 400
 * de validação da descrição e confirma que o payload estruturado chega ao
 * front-end intacto, passando pelo MESMO caminho de extração usado em
 * `src/pages/Avaliacao.tsx` (`getFunctionErrorMessage` → `resolveBackendErrorMessage`).
 *
 * Cobre os 3 códigos (`DESCRICAO_OBRIGATORIA`, `DESCRICAO_ABAIXO_MINIMO`,
 * `DESCRICAO_ACIMA_MAXIMO`) nos DOIS modos (manual e por link) e valida:
 *   - `data === null` e `error` presente com formato FunctionsHttpError
 *   - `error.context.json()` reidrata o payload sem perdas
 *   - `resolveBackendErrorMessage` prioriza `payload.error` verbatim
 *   - `code`, `field`, `descricao_length`, `descricao_min`, `descricao_max`
 *     e `correlation_id` sobrevivem ao roundtrip JSON
 *   - Front-end e backend concordam sobre o `code` para o MESMO texto
 *     (via `validarDescricaoBackendShape`)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { invokeSpy } = vi.hoisted(() => ({ invokeSpy: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: invokeSpy } },
}));

import { supabase } from "@/integrations/supabase/client";
import {
  buildManualImovel,
  buildAvaliacaoInvokePayload,
} from "./avaliacaoPayload";
import {
  DESCRICAO_MIN,
  DESCRICAO_MAX,
  validarDescricaoBackendShape,
  type DescricaoErroBackend,
} from "./avaliacaoDescricao";
import {
  AVALIACAO_ERROR_MESSAGES,
  resolveBackendErrorMessage,
} from "./avaliacaoErrorMap";

type BackendPayload = DescricaoErroBackend & {
  correlation_id?: string;
  stage?: string;
  http_status?: number;
};

/**
 * Mocka o invoke para responder como uma FunctionsHttpError REAL:
 * `data: null`, `error.context.json()` reidrata o body do 400.
 */
function mockEdge400(payload: BackendPayload) {
  invokeSpy.mockImplementationOnce(async () => {
    const serialized = JSON.stringify(payload); // simula a serialização wire
    return {
      data: null,
      error: {
        name: "FunctionsHttpError",
        message: `Edge Function returned a non-2xx status code`,
        status: 400,
        context: {
          status: 400,
          headers: { "content-type": "application/json" },
          // Espelha Response.json() do fetch — precisa reidratar do JSON serializado.
          json: async () => JSON.parse(serialized),
          text: async () => serialized,
        },
      },
    };
  });
}

/**
 * Réplica pura da lógica de `getFunctionErrorMessage` em `Avaliacao.tsx`
 * (linhas 424-446) para testar o pipeline completo sem montar o React.
 */
async function getFunctionErrorMessage(error: any, fallback: string) {
  let payload: any = null;
  if (error?.context && typeof error.context.json === "function") {
    try { payload = await error.context.json(); } catch { /* ignore */ }
  }
  const isGatewayTimeout = error?.status === 502 || error?.status === 504;
  const gatewayFallback = isGatewayTimeout
    ? AVALIACAO_ERROR_MESSAGES.TIMEOUT_UPSTREAM
    : (error?.message || fallback);
  const message = resolveBackendErrorMessage(payload, gatewayFallback);
  return {
    message,
    code: (typeof payload?.code === "string" ? payload.code : undefined) as string | undefined,
    stage: payload?.stage as string | undefined,
    correlationId: (payload?.correlation_id as string | undefined) || undefined,
    httpStatus: (payload?.http_status as number | undefined) ?? error?.status ?? undefined,
    payload,
  };
}

const CORR = "corr-e2e-error";

async function callEdgeWith(descricao: string, modoLink: boolean, extraida: string | null = null) {
  const selected = buildManualImovel(
    { descricao },
    modoLink,
    extraida !== null ? { descricao: extraida } : null,
  );
  return supabase.functions.invoke("avaliacao-imovel", {
    body: buildAvaliacaoInvokePayload(selected, [], CORR),
  });
}

describe("E2E: edge function retorna erro de validação e payload chega ao front", () => {
  beforeEach(() => invokeSpy.mockReset());

  const cases: Array<{
    label: string;
    modoLink: boolean;
    descricao: string;
    extraida: string | null;
    backend: BackendPayload;
  }> = [
    {
      label: "MANUAL — descrição VAZIA → DESCRICAO_OBRIGATORIA",
      modoLink: false,
      descricao: "",
      extraida: null,
      backend: {
        error: `Descrição do imóvel é obrigatória (mínimo ${DESCRICAO_MIN} caracteres).`,
        code: "DESCRICAO_OBRIGATORIA",
        field: "descricao",
        descricao_length: 0,
        descricao_min: DESCRICAO_MIN,
        descricao_max: DESCRICAO_MAX,
        correlation_id: CORR,
        stage: "validate_input",
        http_status: 400,
      },
    },
    {
      label: "MANUAL — 29 chars → DESCRICAO_ABAIXO_MINIMO",
      modoLink: false,
      descricao: "a".repeat(29),
      extraida: null,
      backend: {
        error: `Descrição abaixo do recomendado (29/${DESCRICAO_MIN} caracteres mínimos).`,
        code: "DESCRICAO_ABAIXO_MINIMO",
        field: "descricao",
        descricao_length: 29,
        descricao_min: DESCRICAO_MIN,
        descricao_max: DESCRICAO_MAX,
        correlation_id: CORR,
        stage: "validate_input",
        http_status: 400,
      },
    },
    {
      label: "MANUAL — 2001 chars → DESCRICAO_ACIMA_MAXIMO",
      modoLink: false,
      descricao: "b".repeat(2001),
      extraida: null,
      backend: {
        error: `Descrição acima do limite (2001/${DESCRICAO_MAX} caracteres).`,
        code: "DESCRICAO_ACIMA_MAXIMO",
        field: "descricao",
        descricao_length: 2001,
        descricao_min: DESCRICAO_MIN,
        descricao_max: DESCRICAO_MAX,
        correlation_id: CORR,
        stage: "validate_input",
        http_status: 400,
      },
    },
    {
      label: "POR LINK — extraído VAZIO → DESCRICAO_OBRIGATORIA",
      modoLink: true,
      descricao: "",
      extraida: "",
      backend: {
        error: `Descrição do imóvel é obrigatória (mínimo ${DESCRICAO_MIN} caracteres).`,
        code: "DESCRICAO_OBRIGATORIA",
        field: "descricao",
        descricao_length: 0,
        descricao_min: DESCRICAO_MIN,
        descricao_max: DESCRICAO_MAX,
        correlation_id: CORR,
        stage: "validate_input",
        http_status: 400,
      },
    },
    {
      label: "POR LINK — extraído 29 chars → DESCRICAO_ABAIXO_MINIMO",
      modoLink: true,
      descricao: "",
      extraida: "x".repeat(29),
      backend: {
        error: `Descrição abaixo do recomendado (29/${DESCRICAO_MIN} caracteres mínimos).`,
        code: "DESCRICAO_ABAIXO_MINIMO",
        field: "descricao",
        descricao_length: 29,
        descricao_min: DESCRICAO_MIN,
        descricao_max: DESCRICAO_MAX,
        correlation_id: CORR,
        stage: "validate_input",
        http_status: 400,
      },
    },
    {
      label: "POR LINK — extraído 2001 chars → DESCRICAO_ACIMA_MAXIMO",
      modoLink: true,
      descricao: "",
      extraida: "y".repeat(2001),
      backend: {
        error: `Descrição acima do limite (2001/${DESCRICAO_MAX} caracteres).`,
        code: "DESCRICAO_ACIMA_MAXIMO",
        field: "descricao",
        descricao_length: 2001,
        descricao_min: DESCRICAO_MIN,
        descricao_max: DESCRICAO_MAX,
        correlation_id: CORR,
        stage: "validate_input",
        http_status: 400,
      },
    },
  ];

  for (const c of cases) {
    it(c.label, async () => {
      mockEdge400(c.backend);

      const { data, error } = await callEdgeWith(c.descricao, c.modoLink, c.extraida);

      // 1. FunctionsHttpError-shape chega ao front
      expect(data).toBeNull();
      expect(error).toBeDefined();
      expect(error?.status).toBe(400);
      expect(error?.name).toBe("FunctionsHttpError");

      // 2. Pipeline real de extração de erro
      const info = await getFunctionErrorMessage(error, "Erro ao gerar a avaliação.");

      // 3. Message vem VERBATIM do backend (regra 1 de resolveBackendErrorMessage)
      expect(info.message).toBe(c.backend.error);
      // 4. Code preservado
      expect(info.code).toBe(c.backend.code);
      // 5. Correlation ID e stage sobreviveram ao roundtrip
      expect(info.correlationId).toBe(CORR);
      expect(info.stage).toBe("validate_input");
      expect(info.httpStatus).toBe(400);

      // 6. Payload completo intacto (field + limites + length real)
      expect(info.payload.field).toBe("descricao");
      expect(info.payload.descricao_min).toBe(DESCRICAO_MIN);
      expect(info.payload.descricao_max).toBe(DESCRICAO_MAX);
      expect(info.payload.descricao_length).toBe(c.backend.descricao_length);

      // 7. Front-end concorda com o backend sobre o code para a mesma entrada
      const wireDescricao = c.modoLink ? (c.extraida ?? "") : c.descricao;
      const frontShape = validarDescricaoBackendShape(wireDescricao);
      expect(frontShape?.code).toBe(c.backend.code);
      expect(frontShape?.descricao_length).toBe(c.backend.descricao_length);
    });
  }

  it("payload sem `error` (só `code`) faz fallback pelo dicionário canônico", async () => {
    // Backend hipotético que devolve apenas o code (sem string).
    mockEdge400({
      error: "" as unknown as string, // simula ausência efetiva de string
      code: "DESCRICAO_OBRIGATORIA",
      field: "descricao",
      descricao_length: 0,
      descricao_min: DESCRICAO_MIN,
      descricao_max: DESCRICAO_MAX,
      correlation_id: CORR,
    });

    const { error } = await callEdgeWith("", false);
    const info = await getFunctionErrorMessage(error, "fallback-nao-usado");

    // Regra 2 do resolver: cai no dicionário canônico
    expect(info.message).toBe(AVALIACAO_ERROR_MESSAGES.DESCRICAO_OBRIGATORIA);
    expect(info.code).toBe("DESCRICAO_OBRIGATORIA");
    expect(info.correlationId).toBe(CORR);
  });

  it("context.json() lançando exceção não derruba a extração — cai no fallback", async () => {
    invokeSpy.mockImplementationOnce(async () => ({
      data: null,
      error: {
        name: "FunctionsHttpError",
        message: "Edge Function returned a non-2xx status code",
        status: 400,
        context: {
          status: 400,
          json: async () => { throw new Error("body já lido"); },
        },
      },
    }));

    const { error } = await callEdgeWith("", false);
    const info = await getFunctionErrorMessage(error, "fallback-final");

    // Sem payload → resolveBackendErrorMessage devolve o fallback (error.message).
    expect(info.message).toBe("Edge Function returned a non-2xx status code");
    expect(info.code).toBeUndefined();
    expect(info.payload).toBeNull();
    expect(info.httpStatus).toBe(400);
  });
});
