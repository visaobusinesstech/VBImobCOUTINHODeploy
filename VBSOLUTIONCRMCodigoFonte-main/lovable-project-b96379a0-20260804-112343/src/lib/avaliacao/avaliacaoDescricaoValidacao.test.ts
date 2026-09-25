/**
 * Testes de integração para a validação de descrição do imóvel no fluxo
 * de Avaliação (src/pages/Avaliacao.tsx), cobrindo os 3 cenários bloqueantes
 * — vazio, abaixo do mínimo (< 30) e acima do máximo (> 2000) — nos DOIS
 * modos suportados: MANUAL e POR LINK.
 *
 * Reproduz exatamente o gate usado antes do invoke:
 *   const vDesc = validarDescricaoAvaliacao((selectedImovel as any)?.descricao || "");
 *   if (!vDesc.valid) { bloquear + focar textarea }
 *
 * Onde `selectedImovel.descricao` é resolvido por `resolveManualImovelDescricao`
 * (via buildManualImovel), garantindo que a mesma regra vale no modo por link
 * (com fallback para dadosExtraidos.descricao) e no modo manual.
 */
import { describe, it, expect } from "vitest";
import {
  validarDescricaoAvaliacao,
  DESCRICAO_MIN,
  DESCRICAO_MAX,
} from "./avaliacaoDescricao";
import { buildManualImovel } from "./avaliacaoPayload";

/** Simula o gate real de Avaliacao.tsx (handleAvaliar). */
function preSubmitGate(
  manualDescricao: string,
  modoLink: boolean,
  dadosExtraidosDescricao: string | null,
) {
  const selected = buildManualImovel(
    { descricao: manualDescricao },
    modoLink,
    modoLink ? { descricao: dadosExtraidosDescricao } : null,
  );
  const v = validarDescricaoAvaliacao((selected as any)?.descricao || "");
  return { selected, validation: v };
}

const abaixoMin = "a".repeat(DESCRICAO_MIN - 1); // 29
const noMinimo = "a".repeat(DESCRICAO_MIN); // 30
const acimaMax = "a".repeat(DESCRICAO_MAX + 1); // 2001

describe("Avaliacao — validação de descrição (gate pré-envio)", () => {
  describe("MODO MANUAL", () => {
    it("bloqueia envio quando a descrição está vazia", () => {
      const { validation, selected } = preSubmitGate("", false, null);
      expect(selected.descricao).toBeNull();
      expect(validation.valid).toBe(false);
      if (!validation.valid) {
        expect(validation.erro).toMatch(/obrigatória/i);
        expect(validation.erro).toContain(String(DESCRICAO_MIN));
      }
    });

    it("bloqueia envio quando a descrição só tem espaços/quebras", () => {
      const { validation } = preSubmitGate("   \n\t   ", false, null);
      expect(validation.valid).toBe(false);
      if (!validation.valid) expect(validation.erro).toMatch(/obrigatória/i);
    });

    it("bloqueia envio quando a descrição está abaixo do mínimo (29 chars)", () => {
      const { validation, selected } = preSubmitGate(abaixoMin, false, null);
      expect(selected.descricao).toBe(abaixoMin);
      expect(validation.valid).toBe(false);
      if (!validation.valid) {
        expect(validation.erro).toMatch(/abaixo do recomendado/i);
        expect(validation.erro).toContain(`${DESCRICAO_MIN - 1}/${DESCRICAO_MIN}`);
      }
    });

    it("bloqueia envio quando a descrição está acima do máximo (2001 chars)", () => {
      const { validation } = preSubmitGate(acimaMax, false, null);
      expect(validation.valid).toBe(false);
      if (!validation.valid) {
        expect(validation.erro).toMatch(/acima do limite/i);
        expect(validation.erro).toContain(`${DESCRICAO_MAX + 1}/${DESCRICAO_MAX}`);
      }
    });

    it("libera envio com descrição exatamente no mínimo (30 chars)", () => {
      const { validation } = preSubmitGate(noMinimo, false, null);
      expect(validation.valid).toBe(true);
    });

    it("libera envio com descrição exatamente no máximo (2000 chars)", () => {
      const { validation } = preSubmitGate("a".repeat(DESCRICAO_MAX), false, null);
      expect(validation.valid).toBe(true);
    });
  });

  describe("MODO POR LINK", () => {
    it("bloqueia envio quando nem manual nem extraído possuem descrição", () => {
      const { validation, selected } = preSubmitGate("", true, null);
      expect(selected.descricao).toBeNull();
      expect(validation.valid).toBe(false);
      if (!validation.valid) expect(validation.erro).toMatch(/obrigatória/i);
    });

    it("bloqueia envio quando manual vazio e extraído também vazio", () => {
      const { validation } = preSubmitGate("   ", true, "");
      expect(validation.valid).toBe(false);
    });

    it("bloqueia envio quando extraído está abaixo do mínimo e usuário não digitou nada", () => {
      const { validation, selected } = preSubmitGate("", true, abaixoMin);
      expect(selected.descricao).toBe(abaixoMin);
      expect(validation.valid).toBe(false);
      if (!validation.valid) {
        expect(validation.erro).toMatch(/abaixo do recomendado/i);
      }
    });

    it("bloqueia envio quando manual está abaixo do mínimo (sobrepõe extraído válido)", () => {
      // Regra: se o usuário digita algo, o manual prevalece — mesmo se pior que o extraído.
      const extraidoValido = "b".repeat(120);
      const { validation, selected } = preSubmitGate(abaixoMin, true, extraidoValido);
      expect(selected.descricao).toBe(abaixoMin);
      expect(validation.valid).toBe(false);
      if (!validation.valid) expect(validation.erro).toMatch(/abaixo do recomendado/i);
    });

    it("bloqueia envio quando extraído está acima do máximo e usuário não digitou nada", () => {
      const { validation, selected } = preSubmitGate("", true, acimaMax);
      expect(selected.descricao).toBe(acimaMax);
      expect(validation.valid).toBe(false);
      if (!validation.valid) expect(validation.erro).toMatch(/acima do limite/i);
    });

    it("bloqueia envio quando manual acima do máximo (sobrepõe extraído válido)", () => {
      const { validation } = preSubmitGate(acimaMax, true, "b".repeat(120));
      expect(validation.valid).toBe(false);
      if (!validation.valid) expect(validation.erro).toMatch(/acima do limite/i);
    });

    it("libera envio quando apenas o extraído tem descrição válida (usuário não digitou)", () => {
      const { validation, selected } = preSubmitGate("", true, "b".repeat(80));
      expect(selected.descricao).toBe("b".repeat(80));
      expect(validation.valid).toBe(true);
    });

    it("libera envio quando o usuário digita uma descrição válida e ignora o extraído", () => {
      const { validation, selected } = preSubmitGate(
        "Descrição manual completa e detalhada do imóvel avaliado.",
        true,
        "extraído irrelevante",
      );
      expect(selected.descricao).toBe(
        "Descrição manual completa e detalhada do imóvel avaliado.",
      );
      expect(validation.valid).toBe(true);
    });
  });

  describe("consistência entre modos", () => {
    it.each([
      ["vazio", ""],
      ["abaixo do mínimo", abaixoMin],
      ["acima do máximo", acimaMax],
    ])("bloqueia igualmente nos dois modos: %s", (_label, texto) => {
      const manual = preSubmitGate(texto, false, null).validation;
      const link = preSubmitGate(texto, true, null).validation;
      expect(manual.valid).toBe(false);
      expect(link.valid).toBe(false);
      if (!manual.valid && !link.valid) {
        // mesma mensagem de erro para o mesmo input, independente do modo
        expect(manual.erro).toBe(link.erro);
      }
    });
  });
});
