/**
 * Testes de precedência entre `manual.descricao` (digitada pelo usuário)
 * e `dadosExtraidos.descricao` (vinda do modo por link) quando o usuário
 * alterna entre os modos MANUAL ↔ POR LINK.
 *
 * Regras espelhadas de `src/pages/Avaliacao.tsx` via
 * `resolveManualImovelDescricao` / `buildManualImovel`:
 *
 *   1. Se `manual.descricao` (após trim/NFC) tem texto → SEMPRE vence,
 *      em qualquer modo — o texto do usuário é soberano.
 *   2. Se `manual.descricao` está vazio E o modo é POR LINK → usa
 *      `dadosExtraidos.descricao` (fallback).
 *   3. Se `manual.descricao` está vazio E o modo é MANUAL → descrição é
 *      `null` (não vaza dado extraído de uma sessão anterior).
 *   4. Trocar de modo NÃO altera `manual.descricao` (o estado é preservado),
 *      então a precedência precisa se manter consistente ao voltar ao modo
 *      anterior.
 */
import { describe, it, expect } from "vitest";
import { resolveManualImovelDescricao } from "./avaliacaoDescricao";
import { buildManualImovel } from "./avaliacaoPayload";

/** Simula o estado da página: manual + modo atual + dadosExtraidos (só existe em modo link). */
type Estado = {
  manualDescricao: string;
  modo: "manual" | "link";
  dadosExtraidosDescricao: string | null;
};

/** Alterna o modo preservando o texto manual (comportamento real do componente). */
function trocarModo(estado: Estado, novoModo: "manual" | "link"): Estado {
  return { ...estado, modo: novoModo };
}

/** Reproduz a resolução final que vai para `selectedImovel.descricao` no payload. */
function resolverDescricaoFinal(estado: Estado): string | null {
  const selected = buildManualImovel(
    { descricao: estado.manualDescricao },
    estado.modo === "link",
    estado.modo === "link" ? { descricao: estado.dadosExtraidosDescricao } : null,
  );
  return (selected as any).descricao ?? null;
}

describe("Precedência manual × extraído — alternância entre modos", () => {
  describe("Regra 1: manual não-vazio SEMPRE vence", () => {
    it("modo manual → manual vence (sem dados extraídos)", () => {
      const r = resolveManualImovelDescricao("Descrição digitada", false, null);
      expect(r).toBe("Descrição digitada");
    });

    it("modo link → manual vence sobre extraído", () => {
      const r = resolveManualImovelDescricao("Descrição digitada", true, "Extraído do anúncio");
      expect(r).toBe("Descrição digitada");
    });

    it("modo link → manual mesmo curto vence sobre extraído longo", () => {
      const r = resolveManualImovelDescricao("Curto", true, "b".repeat(200));
      expect(r).toBe("Curto");
    });

    it("modo link → manual com espaços internos preserva a formatação (só trim externo)", () => {
      const r = resolveManualImovelDescricao("  Casa com    3 quartos  ", true, "outro");
      expect(r).toBe("Casa com    3 quartos");
    });
  });

  describe("Regra 2: manual vazio em modo LINK → fallback para extraído", () => {
    it("string vazia → usa extraído", () => {
      expect(resolveManualImovelDescricao("", true, "Do anúncio")).toBe("Do anúncio");
    });

    it("só espaços/quebras → usa extraído", () => {
      expect(resolveManualImovelDescricao("   \n\t  ", true, "Do anúncio")).toBe("Do anúncio");
    });

    it("null → usa extraído", () => {
      expect(resolveManualImovelDescricao(null, true, "Do anúncio")).toBe("Do anúncio");
    });

    it("undefined → usa extraído", () => {
      expect(resolveManualImovelDescricao(undefined, true, "Do anúncio")).toBe("Do anúncio");
    });

    it("manual vazio E extraído null → null (não inventa descrição)", () => {
      expect(resolveManualImovelDescricao("", true, null)).toBeNull();
    });
  });

  describe("Regra 3: manual vazio em modo MANUAL → null (não vaza extraído)", () => {
    it("modo manual ignora dadosExtraidos mesmo se fornecidos", () => {
      // buildManualImovel só olha dadosExtraidos quando modoLink=true.
      const selected = buildManualImovel({ descricao: "" }, false, { descricao: "Fantasma" });
      expect(selected.descricao).toBeNull();
    });

    it("string vazia em modo manual → null (não caminho de fallback)", () => {
      expect(resolveManualImovelDescricao("", false, "Fantasma")).toBeNull();
    });
  });

  describe("Regra 4: alternância de modos preservando manual", () => {
    it("MANUAL(vazio) → LINK(com extraído) → volta a MANUAL: mantém null quando volta", () => {
      let estado: Estado = { manualDescricao: "", modo: "manual", dadosExtraidosDescricao: null };
      expect(resolverDescricaoFinal(estado)).toBeNull();

      // Usuário troca para modo por link e a extração roda.
      estado = { ...trocarModo(estado, "link"), dadosExtraidosDescricao: "Casa em Águas Claras…" };
      expect(resolverDescricaoFinal(estado)).toBe("Casa em Águas Claras…");

      // Volta para manual — dadosExtraidos NÃO é usado no modo manual.
      estado = trocarModo(estado, "manual");
      expect(resolverDescricaoFinal(estado)).toBeNull();
    });

    it("LINK(usuário digitou) → MANUAL → LINK: manual segue prevalecendo em ambos os modos", () => {
      let estado: Estado = {
        manualDescricao: "Ajuste feito pelo corretor",
        modo: "link",
        dadosExtraidosDescricao: "Texto extraído original",
      };
      expect(resolverDescricaoFinal(estado)).toBe("Ajuste feito pelo corretor");

      estado = trocarModo(estado, "manual");
      expect(resolverDescricaoFinal(estado)).toBe("Ajuste feito pelo corretor");

      estado = trocarModo(estado, "link");
      expect(resolverDescricaoFinal(estado)).toBe("Ajuste feito pelo corretor");
    });

    it("LINK(usa extraído) → MANUAL(vazio) → LINK: fallback ao extraído volta a valer", () => {
      let estado: Estado = {
        manualDescricao: "",
        modo: "link",
        dadosExtraidosDescricao: "Do anúncio",
      };
      expect(resolverDescricaoFinal(estado)).toBe("Do anúncio");

      estado = trocarModo(estado, "manual");
      expect(resolverDescricaoFinal(estado)).toBeNull();

      estado = trocarModo(estado, "link");
      expect(resolverDescricaoFinal(estado)).toBe("Do anúncio");
    });

    it("LINK(usa extraído) → usuário digita manual → volta a MANUAL: manual prevalece nas duas etapas", () => {
      let estado: Estado = {
        manualDescricao: "",
        modo: "link",
        dadosExtraidosDescricao: "Do anúncio",
      };
      expect(resolverDescricaoFinal(estado)).toBe("Do anúncio");

      // Usuário digita algo — sobrescreve o extraído no modo link
      estado = { ...estado, manualDescricao: "Correção manual do corretor" };
      expect(resolverDescricaoFinal(estado)).toBe("Correção manual do corretor");

      // Vai para manual — segue prevalecendo
      estado = trocarModo(estado, "manual");
      expect(resolverDescricaoFinal(estado)).toBe("Correção manual do corretor");
    });

    it("LINK(usa extraído) → apaga manual (não havia texto) → MANUAL: null; volta ao link → extraído", () => {
      // Extraído carregado
      let estado: Estado = { manualDescricao: "", modo: "link", dadosExtraidosDescricao: "E1" };
      expect(resolverDescricaoFinal(estado)).toBe("E1");

      // Vai para manual, sem digitar
      estado = trocarModo(estado, "manual");
      expect(resolverDescricaoFinal(estado)).toBeNull();

      // Volta para link — extraído ainda no estado, volta a ser usado
      estado = trocarModo(estado, "link");
      expect(resolverDescricaoFinal(estado)).toBe("E1");
    });

    it("LINK: apagar o manual (após ter digitado) restaura o fallback para o extraído", () => {
      let estado: Estado = {
        manualDescricao: "editado",
        modo: "link",
        dadosExtraidosDescricao: "Do anúncio",
      };
      expect(resolverDescricaoFinal(estado)).toBe("editado");

      estado = { ...estado, manualDescricao: "" };
      expect(resolverDescricaoFinal(estado)).toBe("Do anúncio");
    });

    it("MANUAL(digitado) → LINK sem extração ainda: manual continua vencendo", () => {
      let estado: Estado = {
        manualDescricao: "Texto do corretor",
        modo: "manual",
        dadosExtraidosDescricao: null,
      };
      expect(resolverDescricaoFinal(estado)).toBe("Texto do corretor");

      estado = trocarModo(estado, "link"); // ainda sem dadosExtraidos
      expect(resolverDescricaoFinal(estado)).toBe("Texto do corretor");
    });

    it("MANUAL(vazio) → LINK sem extração ainda: null (não há de onde puxar)", () => {
      let estado: Estado = { manualDescricao: "", modo: "manual", dadosExtraidosDescricao: null };
      expect(resolverDescricaoFinal(estado)).toBeNull();

      estado = trocarModo(estado, "link");
      expect(resolverDescricaoFinal(estado)).toBeNull();
    });
  });

  describe("Sequência longa (fluxo real do corretor)", () => {
    it("cobre ciclo completo: link → extraído → editar → limpar → manual → digitar → link", () => {
      const trilha: Array<{ label: string; estado: Estado; esperado: string | null }> = [];

      let estado: Estado = { manualDescricao: "", modo: "link", dadosExtraidosDescricao: null };
      trilha.push({ label: "1) modo link, ainda sem extração", estado, esperado: null });

      estado = { ...estado, dadosExtraidosDescricao: "Casa 3q, suíte, garagem" };
      trilha.push({ label: "2) extração concluída", estado, esperado: "Casa 3q, suíte, garagem" });

      estado = { ...estado, manualDescricao: "Casa 3 quartos com suíte e 2 vagas" };
      trilha.push({ label: "3) usuário edita manual — vence sobre extraído", estado, esperado: "Casa 3 quartos com suíte e 2 vagas" });

      estado = { ...estado, manualDescricao: "" };
      trilha.push({ label: "4) usuário limpa manual — volta a usar extraído", estado, esperado: "Casa 3q, suíte, garagem" });

      estado = trocarModo(estado, "manual");
      trilha.push({ label: "5) troca para modo manual — null (extraído não vaza)", estado, esperado: null });

      estado = { ...estado, manualDescricao: "Descrição totalmente nova, feita à mão" };
      trilha.push({ label: "6) digita em manual — manual vence", estado, esperado: "Descrição totalmente nova, feita à mão" });

      estado = trocarModo(estado, "link");
      trilha.push({ label: "7) volta ao link — manual continua vencendo", estado, esperado: "Descrição totalmente nova, feita à mão" });

      for (const { esperado, estado: e } of trilha) {
        expect(resolverDescricaoFinal(e)).toBe(esperado);
      }
    });
  });
});
