import { describe, it, expect } from "vitest";
import {
  DESCRICAO_MIN,
  DESCRICAO_MAX,
  DESCRICAO_LIMITE_ALERTA,
  contarDescricao,
  contadorEmAlerta,
  formatarContador,
  truncarDescricao,
  validarDescricaoAvaliacao,
  resolveManualImovelDescricao,
} from "./avaliacaoDescricao";

/**
 * Testes de integração cobrindo o comportamento exato usado por
 * src/pages/Avaliacao.tsx nos modos MANUAL e POR LINK:
 *  - contador (0/2000) sempre derivado do estado real
 *  - limite máximo aplicado no onChange, resistente a colagens grandes,
 *    acentos e caracteres multi-code-unit (emojis)
 *  - resolução final de manualImovel.descricao consumido pela API
 */
describe("Avaliacao > descrição do imóvel", () => {
  describe("contador de caracteres", () => {
    it("conta 0 quando vazio / null / undefined", () => {
      expect(contarDescricao("")).toBe(0);
      expect(contarDescricao(null)).toBe(0);
      expect(contarDescricao(undefined)).toBe(0);
    });

    it("conta o comprimento exato do texto digitado", () => {
      expect(contarDescricao("Apartamento reformado")).toBe(21);
    });

    it("preserva espaços extras (não faz trim no contador)", () => {
      expect(contarDescricao("   olá   ")).toBe(9);
    });

    it("conta caracteres acentuados como 1 (após NFC)", () => {
      // "á" pode vir composto (NFC = 1 code point) ou decomposto (NFD = 2).
      const nfd = "a\u0301"; // "a" + combining acute
      const nfc = "á";
      expect(contarDescricao(nfc)).toBe(1);
      expect(contarDescricao(nfd)).toBe(1); // normalizado para NFC → 1
    });

    it("conta emojis (surrogate pair UTF-16) como 1 code point", () => {
      expect(contarDescricao("🏠")).toBe(1);
      expect(contarDescricao("🏠🏢")).toBe(2);
      expect("🏠".length).toBe(2); // sanity: .length UTF-16 daria 2
    });

    it("formatarContador reflete sempre o estado real", () => {
      expect(formatarContador("")).toBe(`0/${DESCRICAO_MAX}`);
      expect(formatarContador("abc")).toBe(`3/${DESCRICAO_MAX}`);
      expect(formatarContador("🏠")).toBe(`1/${DESCRICAO_MAX}`);
    });

    it("contadorEmAlerta usa o limite exato (DESCRICAO_LIMITE_ALERTA)", () => {
      expect(contadorEmAlerta("a".repeat(DESCRICAO_LIMITE_ALERTA))).toBe(false);
      expect(contadorEmAlerta("a".repeat(DESCRICAO_LIMITE_ALERTA + 1))).toBe(true);
      expect(contadorEmAlerta(null)).toBe(false);
    });
  });

  describe("limite de caracteres (truncarDescricao)", () => {
    it("mantém o texto inalterado abaixo do limite", () => {
      const txt = "a".repeat(500);
      expect(truncarDescricao(txt)).toHaveLength(500);
    });

    it("mantém exatamente DESCRICAO_MAX no limite", () => {
      const txt = "a".repeat(DESCRICAO_MAX);
      const out = truncarDescricao(txt);
      expect(contarDescricao(out)).toBe(DESCRICAO_MAX);
    });

    it("trunca colagem gigante (>> DESCRICAO_MAX) para exatamente DESCRICAO_MAX", () => {
      const txt = "a".repeat(DESCRICAO_MAX * 5 + 137);
      const out = truncarDescricao(txt);
      expect(contarDescricao(out)).toBe(DESCRICAO_MAX);
    });

    it("não parte um par substituto (emoji) ao truncar exatamente no limite", () => {
      // 1999 letras + 1 emoji (1 code point, 2 code units UTF-16) → total 2000 code points, cabe.
      const ok = "a".repeat(DESCRICAO_MAX - 1) + "🏠";
      const outOk = truncarDescricao(ok);
      expect(contarDescricao(outOk)).toBe(DESCRICAO_MAX);
      expect(outOk.endsWith("🏠")).toBe(true);

      // 2000 letras + 1 emoji → truncar deve descartar o emoji inteiro, não meio par.
      const overflow = "a".repeat(DESCRICAO_MAX) + "🏠";
      const outOverflow = truncarDescricao(overflow);
      expect(contarDescricao(outOverflow)).toBe(DESCRICAO_MAX);
      // não deixa surrogate solto
      const lastCharCode = outOverflow.charCodeAt(outOverflow.length - 1);
      const isLoneSurrogate = lastCharCode >= 0xd800 && lastCharCode <= 0xdfff;
      expect(isLoneSurrogate).toBe(false);
    });

    it("normaliza acentos decompostos (NFD) para NFC ao truncar", () => {
      const nfd = "a\u0301".repeat(DESCRICAO_MAX);
      const out = truncarDescricao(nfd);
      expect(contarDescricao(out)).toBe(DESCRICAO_MAX);
      expect(out).toBe("á".repeat(DESCRICAO_MAX));
    });

    it("preserva espaços, quebras de linha e tabs (colagens do clipboard)", () => {
      const pasted = "linha 1\r\nlinha 2\t com tab\n  espaços à frente";
      expect(truncarDescricao(pasted)).toBe(pasted.normalize("NFC"));
    });

    it("é idempotente ao ser aplicado várias vezes", () => {
      const txt = "b".repeat(3000);
      const once = truncarDescricao(txt);
      expect(truncarDescricao(once)).toBe(once);
    });

    it("aceita null/undefined sem quebrar e retorna string vazia", () => {
      expect(truncarDescricao(null)).toBe("");
      expect(truncarDescricao(undefined)).toBe("");
    });
  });

  describe("validarDescricaoAvaliacao (bloqueio de envio)", () => {
    it("invalida descrição vazia / null / undefined / só espaços", () => {
      for (const v of ["", "   ", null, undefined, "\n\t  "]) {
        const r = validarDescricaoAvaliacao(v as any);
        expect(r.valid).toBe(false);
        expect(r.erro).toMatch(/obrigatória|abaixo/i);
      }
    });

    it("invalida quando abaixo do mínimo recomendado", () => {
      const r = validarDescricaoAvaliacao("a".repeat(DESCRICAO_MIN - 1));
      expect(r.valid).toBe(false);
      expect(r.erro).toContain(`${DESCRICAO_MIN - 1}/${DESCRICAO_MIN}`);
    });

    it("aceita exatamente o mínimo (em code points, com acentos NFD)", () => {
      const nfd = "a\u0301".repeat(DESCRICAO_MIN);
      const r = validarDescricaoAvaliacao(nfd);
      expect(r.valid).toBe(true);
    });

    it("aceita valor típico dentro da faixa (com acentos e emojis)", () => {
      const r = validarDescricaoAvaliacao(
        "Ótimo imóvel reformado 🏠 com vista, 3 quartos, garagem coberta e área de lazer completa.",
      );
      expect(r.valid).toBe(true);
      expect(r.erro).toBeNull();
    });

    it("aceita exatamente o máximo (após truncamento)", () => {
      const r = validarDescricaoAvaliacao(truncarDescricao("a".repeat(DESCRICAO_MAX + 500)));
      expect(r.valid).toBe(true);
    });
  });

  describe("resolveManualImovelDescricao (payload manualImovel.descricao)", () => {
    describe("modo MANUAL (modoLink = false)", () => {
      it("retorna null quando o corretor não digitou nada", () => {
        expect(resolveManualImovelDescricao("", false, null)).toBeNull();
        expect(resolveManualImovelDescricao("   ", false, null)).toBeNull();
        expect(resolveManualImovelDescricao(undefined, false, undefined)).toBeNull();
      });

      it("retorna o texto digitado com trim e normalização NFC aplicados", () => {
        expect(resolveManualImovelDescricao("  a\u0301pto  ", false, null)).toBe("ápto");
      });

      it("ignora qualquer descrição vinda de dadosExtraidos no modo manual", () => {
        expect(resolveManualImovelDescricao("", false, "Descrição extraída do portal")).toBeNull();
      });
    });

    describe("modo POR LINK (modoLink = true)", () => {
      it("usa a descrição extraída quando o corretor não digitou nada", () => {
        expect(resolveManualImovelDescricao("", true, "Descrição extraída do portal")).toBe(
          "Descrição extraída do portal",
        );
      });

      it("retorna null quando não há descrição manual nem extraída", () => {
        expect(resolveManualImovelDescricao("", true, null)).toBeNull();
        expect(resolveManualImovelDescricao(undefined, true, undefined)).toBeNull();
      });

      it("dá precedência ao texto manual sobre o extraído", () => {
        expect(resolveManualImovelDescricao("Personalizada", true, "Extraída")).toBe("Personalizada");
      });

      it("aplica trim no texto manual antes de decidir precedência", () => {
        expect(resolveManualImovelDescricao("   ", true, "Descrição extraída")).toBe("Descrição extraída");
      });
    });
  });

  describe("fluxo integrado: digitar/colar → truncar → contador → validar → payload", () => {
    it("colagem gigante com acentos: contador bate com truncamento e validação passa", () => {
      const pasted = "áéíóú".repeat(1000); // 5000 code points
      const stored = truncarDescricao(pasted);
      expect(contarDescricao(stored)).toBe(DESCRICAO_MAX);
      expect(formatarContador(stored)).toBe(`${DESCRICAO_MAX}/${DESCRICAO_MAX}`);
      expect(validarDescricaoAvaliacao(stored).valid).toBe(true);
    });

    it("colagem com emojis: nunca quebra em surrogate solto", () => {
      const pasted = "🏠🏢🏡".repeat(1000);
      const stored = truncarDescricao(pasted);
      expect(contarDescricao(stored)).toBeLessThanOrEqual(DESCRICAO_MAX);
      // toda posição deve formar um code point completo
      expect(Array.from(stored).join("")).toBe(stored);
    });

    it("modo por link: texto manual curto bloqueia validação mas ainda é o payload", () => {
      const stored = truncarDescricao("   curto   ");
      expect(validarDescricaoAvaliacao(stored).valid).toBe(false);
      expect(resolveManualImovelDescricao(stored, true, "Descrição rica do portal")).toBe("curto");
    });
  });
});
