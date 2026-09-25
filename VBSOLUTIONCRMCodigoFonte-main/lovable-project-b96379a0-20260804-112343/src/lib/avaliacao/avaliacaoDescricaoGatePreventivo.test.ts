/**
 * Testes da validação PREVENTIVA de descrição no front-end:
 *  - Bloqueia submit nos 3 casos (vazio, < mínimo, > máximo).
 *  - Devolve payload estruturado IDÊNTICO ao da edge function
 *    `avaliacao-imovel` (mesmos `code`, `message`, `field` e métricas)
 *    para os modos manual e por link.
 *  - Comprova que texto válido não gera erro (null).
 */

import { describe, it, expect } from "vitest";
import {
  DESCRICAO_MIN,
  DESCRICAO_MAX,
  validarDescricaoBackendShape,
} from "./avaliacaoDescricao";
import { buildManualImovel, buildAvaliacaoInvokePayload } from "./avaliacaoPayload";

/**
 * Reimplementação FIEL da validação da edge function (linhas 130-157 de
 * `supabase/functions/avaliacao-imovel/index.ts`). Usada para garantir
 * paridade byte-a-byte com o helper do front-end.
 */
function backendValidateReference(rawDescricao: unknown) {
  const normalized =
    typeof rawDescricao === "string" ? rawDescricao.normalize("NFC").trim() : "";
  const len = Array.from(normalized).length;
  const base = {
    field: "descricao" as const,
    descricao_length: len,
    descricao_min: DESCRICAO_MIN,
    descricao_max: DESCRICAO_MAX,
  };
  if (len === 0) {
    return {
      ...base,
      code: "DESCRICAO_OBRIGATORIA" as const,
      error: `Descrição do imóvel é obrigatória (mínimo ${DESCRICAO_MIN} caracteres).`,
    };
  }
  if (len < DESCRICAO_MIN) {
    return {
      ...base,
      code: "DESCRICAO_ABAIXO_MINIMO" as const,
      error: `Descrição abaixo do recomendado (${len}/${DESCRICAO_MIN} caracteres mínimos).`,
    };
  }
  if (len > DESCRICAO_MAX) {
    return {
      ...base,
      code: "DESCRICAO_ACIMA_MAXIMO" as const,
      error: `Descrição acima do limite (${len}/${DESCRICAO_MAX} caracteres).`,
    };
  }
  return null;
}

/** Simula o gate real: monta payload dos dois modos, valida ANTES de enviar. */
function simularSubmit(opts: {
  modoLink: boolean;
  manualDesc: string;
  extraidoDesc?: string | null;
}) {
  const selected = buildManualImovel(
    { descricao: opts.manualDesc },
    opts.modoLink,
    opts.extraidoDesc !== undefined ? { descricao: opts.extraidoDesc } : null,
  );
  const bloqueio = validarDescricaoBackendShape(selected.descricao);
  const payload = bloqueio ? null : buildAvaliacaoInvokePayload(selected, []);
  return { selected, bloqueio, enviado: !!payload, payload };
}

describe("Validação preventiva bloqueia submit e espelha o backend", () => {
  describe.each([
    { modo: "manual", modoLink: false },
    { modo: "link", modoLink: true },
  ])("modo $modo", ({ modoLink }) => {
    it("descrição VAZIA → bloqueia com DESCRICAO_OBRIGATORIA", () => {
      const r = simularSubmit({ modoLink, manualDesc: "", extraidoDesc: modoLink ? "" : undefined });
      expect(r.enviado).toBe(false);
      expect(r.bloqueio?.code).toBe("DESCRICAO_OBRIGATORIA");
      expect(r.bloqueio?.field).toBe("descricao");
      expect(r.bloqueio?.descricao_length).toBe(0);
      expect(r.bloqueio?.error).toBe(
        `Descrição do imóvel é obrigatória (mínimo ${DESCRICAO_MIN} caracteres).`,
      );
    });

    it("descrição só com espaços → bloqueia com DESCRICAO_OBRIGATORIA", () => {
      const r = simularSubmit({
        modoLink,
        manualDesc: "     ",
        extraidoDesc: modoLink ? "   \n\t  " : undefined,
      });
      expect(r.enviado).toBe(false);
      expect(r.bloqueio?.code).toBe("DESCRICAO_OBRIGATORIA");
    });

    it("descrição ABAIXO do mínimo (29 chars) → DESCRICAO_ABAIXO_MINIMO", () => {
      const texto = "a".repeat(29);
      const r = simularSubmit({
        modoLink,
        manualDesc: modoLink ? "" : texto,
        extraidoDesc: modoLink ? texto : undefined,
      });
      expect(r.enviado).toBe(false);
      expect(r.bloqueio?.code).toBe("DESCRICAO_ABAIXO_MINIMO");
      expect(r.bloqueio?.descricao_length).toBe(29);
      expect(r.bloqueio?.error).toBe(
        `Descrição abaixo do recomendado (29/${DESCRICAO_MIN} caracteres mínimos).`,
      );
    });

    it("descrição ACIMA do máximo (2001 chars) → DESCRICAO_ACIMA_MAXIMO", () => {
      const texto = "b".repeat(DESCRICAO_MAX + 1);
      const r = simularSubmit({
        modoLink,
        manualDesc: modoLink ? "" : texto,
        extraidoDesc: modoLink ? texto : undefined,
      });
      expect(r.enviado).toBe(false);
      expect(r.bloqueio?.code).toBe("DESCRICAO_ACIMA_MAXIMO");
      expect(r.bloqueio?.descricao_length).toBe(DESCRICAO_MAX + 1);
      expect(r.bloqueio?.error).toBe(
        `Descrição acima do limite (${DESCRICAO_MAX + 1}/${DESCRICAO_MAX} caracteres).`,
      );
    });

    it("descrição válida (30 chars) → NÃO bloqueia, payload é montado", () => {
      const texto = "x".repeat(DESCRICAO_MIN);
      const r = simularSubmit({
        modoLink,
        manualDesc: modoLink ? "" : texto,
        extraidoDesc: modoLink ? texto : undefined,
      });
      expect(r.enviado).toBe(true);
      expect(r.bloqueio).toBeNull();
      expect(r.payload?.imovel.descricao).toBe(texto);
    });
  });

  describe("Paridade byte-a-byte com o backend (mesmo payload estruturado)", () => {
    const casos: unknown[] = [
      "",
      "   ",
      "\n\t  \n",
      "a".repeat(1),
      "a".repeat(29),
      "a".repeat(DESCRICAO_MIN),
      "a".repeat(100),
      "a".repeat(DESCRICAO_MAX),
      "a".repeat(DESCRICAO_MAX + 1),
      "a".repeat(DESCRICAO_MAX + 500),
      "🏠".repeat(DESCRICAO_MAX + 1), // pares substitutos
      "café ".repeat(10), // NFC (acentos)
      null,
      undefined,
    ];

    it.each(casos.map((c, i) => ({ i, c })))("caso #$i", ({ c }) => {
      const front = validarDescricaoBackendShape(c as any);
      const back = backendValidateReference(c);
      expect(front).toEqual(back);
    });
  });

  it("erro estruturado tem exatamente as chaves esperadas pelo backend", () => {
    const r = validarDescricaoBackendShape("");
    expect(r).not.toBeNull();
    expect(Object.keys(r!).sort()).toEqual(
      ["code", "descricao_length", "descricao_max", "descricao_min", "error", "field"].sort(),
    );
  });
});
