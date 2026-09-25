/**
 * Testes garantindo que o erro da descrição aparece em ambos os pontos da UI
 * quando o usuário tenta enviar com descrição inválida:
 *
 *  A) Painel "campos que precisam de atenção"
 *     — alimentado por `getMissingCriticalFields` (+ fallback do gate)
 *     — deve conter uma entrada iniciando com "Descrição do imóvel"
 *       e embutindo o erro detalhado.
 *
 *  B) Diálogo "Verificação de Dados Críticos"
 *     — cada item é marcado como faltando quando
 *       `missing.some(f => f.startsWith(item.key))`.
 *     — a chave "Descrição" precisa acender o badge "Faltando" nos 3 cenários.
 *
 * Cobre os 3 estados inválidos (vazio, <30, >2000) em ambos os modos
 * (manual e por link) e o cenário de fallback do gate.
 */
import { describe, it, expect } from "vitest";
import {
  getMissingCriticalFields,
  isChecklistItemMissing,
  resolveWarningPayloadForDescricao,
  CHECKLIST_KEYS,
} from "./avaliacaoCamposCriticos";
import { buildManualImovel } from "./avaliacaoPayload";
import { DESCRICAO_MIN, DESCRICAO_MAX } from "./avaliacaoDescricao";

/** Base de imóvel com TODOS os demais campos críticos válidos —
 *  isola o comportamento de "descrição inválida" sem ruído. */
function imovelBaseValido(descricao: string, dadosExtraidos: string | null = null, modoLink = false) {
  const selected = buildManualImovel(
    { titulo: "Casa X", tipo: "Casa", operacao: "Venda", descricao },
    modoLink,
    modoLink ? { descricao: dadosExtraidos } : null,
  );
  return {
    ...selected,
    preco: 850000,
    area: 120,
    cidade: "Brasília",
    bairro: "Águas Claras",
    fotos: ["https://cdn.exemplo.com/1.jpg"],
  };
}

const casosInvalidos: Array<{ nome: string; texto: string; padraoErro: RegExp }> = [
  { nome: "vazio", texto: "", padraoErro: /obrigatória/i },
  { nome: "abaixo do mínimo (29 chars)", texto: "a".repeat(DESCRICAO_MIN - 1), padraoErro: /abaixo do recomendado/i },
  { nome: "acima do máximo (2001 chars)", texto: "a".repeat(DESCRICAO_MAX + 1), padraoErro: /acima do limite/i },
];

describe('Painel "campos que precisam de atenção" — descrição inválida', () => {
  describe("MODO MANUAL", () => {
    for (const caso of casosInvalidos) {
      it(`inclui entrada "Descrição do imóvel (…)" quando ${caso.nome}`, () => {
        const imovel = imovelBaseValido(caso.texto, null, false);
        const missing = getMissingCriticalFields(imovel);
        const entrada = missing.find((f) => f.startsWith("Descrição do imóvel"));
        expect(entrada).toBeDefined();
        expect(entrada!).toMatch(caso.padraoErro);
      });
    }

    it("NÃO inclui entrada de descrição quando válida (30 chars)", () => {
      const imovel = imovelBaseValido("a".repeat(DESCRICAO_MIN), null, false);
      const missing = getMissingCriticalFields(imovel);
      expect(missing.some((f) => f.startsWith("Descrição do imóvel"))).toBe(false);
    });
  });

  describe("MODO POR LINK", () => {
    for (const caso of casosInvalidos) {
      it(`inclui entrada quando ${caso.nome} (nem manual nem extraído válidos)`, () => {
        const imovel = imovelBaseValido(caso.texto, null, true);
        const missing = getMissingCriticalFields(imovel);
        expect(missing.some((f) => f.startsWith("Descrição do imóvel"))).toBe(true);
      });
    }

    it("NÃO inclui quando o extraído é válido e usuário não digitou", () => {
      const imovel = imovelBaseValido("", "b".repeat(120), true);
      const missing = getMissingCriticalFields(imovel);
      expect(missing.some((f) => f.startsWith("Descrição do imóvel"))).toBe(false);
    });

    it("inclui quando o extraído está abaixo do mínimo (fallback também é inválido)", () => {
      const imovel = imovelBaseValido("", "b".repeat(DESCRICAO_MIN - 1), true);
      const missing = getMissingCriticalFields(imovel);
      const entrada = missing.find((f) => f.startsWith("Descrição do imóvel"));
      expect(entrada).toBeDefined();
      expect(entrada!).toMatch(/abaixo do recomendado/i);
    });
  });

  describe("fallback do gate (handleAvaliar) quando SÓ a descrição está inválida", () => {
    it("resolveWarningPayloadForDescricao devolve APENAS a descrição quando nenhum outro campo falta", () => {
      const imovel = imovelBaseValido("", null, false);
      const warnings = resolveWarningPayloadForDescricao(imovel);
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toMatch(/^Descrição do imóvel/);
      expect(warnings[0]).toMatch(/obrigatória/i);
    });

    it("preserva as demais entradas quando há OUTROS campos faltando", () => {
      const imovel = { ...imovelBaseValido("", null, false), cidade: "", bairro: "" };
      const warnings = resolveWarningPayloadForDescricao(imovel);
      expect(warnings.some((f) => f === "Cidade")).toBe(true);
      expect(warnings.some((f) => f.startsWith("Bairro"))).toBe(true);
      expect(warnings.some((f) => f.startsWith("Descrição do imóvel"))).toBe(true);
    });

    it("devolve lista SEM descrição quando ela está válida (não injeta fallback)", () => {
      const imovel = imovelBaseValido("a".repeat(DESCRICAO_MIN), null, false);
      const warnings = resolveWarningPayloadForDescricao(imovel);
      expect(warnings.some((f) => f.startsWith("Descrição do imóvel"))).toBe(false);
    });
  });
});

describe('Diálogo "Verificação de Dados Críticos" — badge da Descrição', () => {
  it("expõe a chave 'Descrição' no checklist", () => {
    expect(CHECKLIST_KEYS).toContain("Descrição");
  });

  describe("MODO MANUAL", () => {
    for (const caso of casosInvalidos) {
      it(`badge "Descrição" fica como Faltando quando ${caso.nome}`, () => {
        const imovel = imovelBaseValido(caso.texto, null, false);
        const missing = getMissingCriticalFields(imovel);
        expect(isChecklistItemMissing(missing, "Descrição")).toBe(true);
      });
    }

    it(`badge "Descrição" fica OK quando descrição é válida`, () => {
      const imovel = imovelBaseValido("a".repeat(DESCRICAO_MIN + 5), null, false);
      const missing = getMissingCriticalFields(imovel);
      expect(isChecklistItemMissing(missing, "Descrição")).toBe(false);
    });
  });

  describe("MODO POR LINK", () => {
    for (const caso of casosInvalidos) {
      it(`badge "Descrição" fica como Faltando quando ${caso.nome}`, () => {
        const imovel = imovelBaseValido(caso.texto, null, true);
        const missing = getMissingCriticalFields(imovel);
        expect(isChecklistItemMissing(missing, "Descrição")).toBe(true);
      });
    }

    it(`badge "Descrição" fica OK quando extraído é válido e usuário não digitou`, () => {
      const imovel = imovelBaseValido("", "b".repeat(120), true);
      const missing = getMissingCriticalFields(imovel);
      expect(isChecklistItemMissing(missing, "Descrição")).toBe(false);
    });
  });

  it("não confunde com outros campos: badge Descrição não acende por Cidade faltando", () => {
    const imovel = { ...imovelBaseValido("a".repeat(DESCRICAO_MIN), null, false), cidade: "" };
    const missing = getMissingCriticalFields(imovel);
    expect(isChecklistItemMissing(missing, "Cidade")).toBe(true);
    expect(isChecklistItemMissing(missing, "Descrição")).toBe(false);
  });

  it("cenário misto: apenas Descrição faltando → só o badge Descrição acende", () => {
    const imovel = imovelBaseValido("", null, false);
    const missing = getMissingCriticalFields(imovel);
    for (const key of CHECKLIST_KEYS) {
      const esperado = key === "Descrição";
      expect(isChecklistItemMissing(missing, key)).toBe(esperado);
    }
  });
});
