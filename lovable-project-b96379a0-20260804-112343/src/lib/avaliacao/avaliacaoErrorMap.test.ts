/**
 * Testes do mapeamento padronizado de `data.code` → mensagem exibida.
 * Regra: SEMPRE prioriza `payload.error` (texto vindo do backend) quando
 * existir; senão usa a mensagem canônica do `code`; senão o fallback.
 */

import { describe, it, expect } from "vitest";
import {
  AVALIACAO_ERROR_MESSAGES,
  isKnownAvaliacaoErrorCode,
  resolveBackendErrorMessage,
} from "./avaliacaoErrorMap";

const FALLBACK = "Erro ao gerar a avaliação.";

describe("resolveBackendErrorMessage", () => {
  it("usa `error` do backend verbatim quando presente (mesmo com `code` conhecido)", () => {
    const custom = "Descrição abaixo do recomendado (17/30 caracteres mínimos).";
    const msg = resolveBackendErrorMessage(
      { error: custom, code: "DESCRICAO_ABAIXO_MINIMO" },
      FALLBACK,
    );
    expect(msg).toBe(custom);
  });

  it("aparaespaços do `error` antes de usar", () => {
    const msg = resolveBackendErrorMessage({ error: "   mensagem real   " }, FALLBACK);
    expect(msg).toBe("mensagem real");
  });

  it("cai no mapa canônico quando `error` está ausente mas `code` é conhecido", () => {
    for (const code of Object.keys(AVALIACAO_ERROR_MESSAGES)) {
      const msg = resolveBackendErrorMessage({ code }, FALLBACK);
      expect(msg).toBe(AVALIACAO_ERROR_MESSAGES[code as keyof typeof AVALIACAO_ERROR_MESSAGES]);
    }
  });

  it("cai no mapa canônico quando `error` é string vazia/whitespace", () => {
    expect(resolveBackendErrorMessage({ error: "", code: "LIMITE_ATINGIDO" }, FALLBACK))
      .toBe(AVALIACAO_ERROR_MESSAGES.LIMITE_ATINGIDO);
    expect(resolveBackendErrorMessage({ error: "   ", code: "NAO_AUTORIZADO" }, FALLBACK))
      .toBe(AVALIACAO_ERROR_MESSAGES.NAO_AUTORIZADO);
  });

  it("usa fallback quando não há `error` nem `code` conhecido", () => {
    expect(resolveBackendErrorMessage(null, FALLBACK)).toBe(FALLBACK);
    expect(resolveBackendErrorMessage(undefined, FALLBACK)).toBe(FALLBACK);
    expect(resolveBackendErrorMessage({}, FALLBACK)).toBe(FALLBACK);
    expect(resolveBackendErrorMessage({ code: "CODE_INEXISTENTE" }, FALLBACK)).toBe(FALLBACK);
    expect(resolveBackendErrorMessage({ code: 42 as any }, FALLBACK)).toBe(FALLBACK);
  });

  it("ignora `error` que não é string (número, objeto, boolean)", () => {
    expect(resolveBackendErrorMessage({ error: 500, code: "ERRO_INTERNO" }, FALLBACK))
      .toBe(AVALIACAO_ERROR_MESSAGES.ERRO_INTERNO);
    expect(resolveBackendErrorMessage({ error: { nested: "x" }, code: "ERRO_INTERNO" }, FALLBACK))
      .toBe(AVALIACAO_ERROR_MESSAGES.ERRO_INTERNO);
    expect(resolveBackendErrorMessage({ error: true }, FALLBACK)).toBe(FALLBACK);
  });

  it("isKnownAvaliacaoErrorCode filtra corretamente", () => {
    expect(isKnownAvaliacaoErrorCode("DESCRICAO_OBRIGATORIA")).toBe(true);
    expect(isKnownAvaliacaoErrorCode("ERRO_INTERNO")).toBe(true);
    expect(isKnownAvaliacaoErrorCode("UNKNOWN")).toBe(false);
    expect(isKnownAvaliacaoErrorCode(null)).toBe(false);
    expect(isKnownAvaliacaoErrorCode(undefined)).toBe(false);
    expect(isKnownAvaliacaoErrorCode(123)).toBe(false);
  });

  describe("Paridade com payloads reais da edge function", () => {
    const casos = [
      { payload: { error: "Não autorizado", code: "NAO_AUTORIZADO" }, esperado: "Não autorizado" },
      { payload: { error: "Conta não aprovada.", code: "CONTA_NAO_APROVADA" }, esperado: "Conta não aprovada." },
      {
        payload: {
          error: "Limite de 3 avaliações atingido para o plano gratuito. Faça upgrade para avaliações ilimitadas.",
          code: "LIMITE_ATINGIDO",
          limit_reached: true,
        },
        esperado: "Limite de 3 avaliações atingido para o plano gratuito. Faça upgrade para avaliações ilimitadas.",
      },
      {
        payload: {
          error: "Descrição do imóvel é obrigatória (mínimo 30 caracteres).",
          code: "DESCRICAO_OBRIGATORIA",
          field: "descricao",
        },
        esperado: "Descrição do imóvel é obrigatória (mínimo 30 caracteres).",
      },
      {
        payload: { error: "Erro ao gerar avaliação: timeout", code: "ERRO_INTERNO" },
        esperado: "Erro ao gerar avaliação: timeout",
      },
    ];
    it.each(casos)("payload %#: usa texto do backend", ({ payload, esperado }) => {
      expect(resolveBackendErrorMessage(payload, FALLBACK)).toBe(esperado);
    });
  });
});
