import { describe, it, expect } from "vitest";
import {
  buildManualImovel,
  buildAvaliacaoInvokePayload,
} from "./avaliacaoPayload";

describe("payload da edge function avaliacao-imovel — descricao sempre presente", () => {
  describe("modo MANUAL", () => {
    it("inclui a descrição digitada pelo usuário no payload", () => {
      const manual = {
        titulo: "Casa Teste",
        tipo: "Casa",
        operacao: "Venda",
        descricao: "Casa ampla com 3 quartos, sendo 1 suíte, em condomínio fechado.",
      };
      const selected = buildManualImovel(manual, false, null);
      const payload = buildAvaliacaoInvokePayload(selected, [], "corr-1");
      expect(payload.imovel).toHaveProperty("descricao");
      expect(payload.imovel.descricao).toBe(
        "Casa ampla com 3 quartos, sendo 1 suíte, em condomínio fechado.",
      );
      expect(payload.correlation_id).toBe("corr-1");
    });

    it("mantém a chave descricao = null quando o usuário não digita nada (modo manual)", () => {
      const selected = buildManualImovel({ descricao: "" }, false, null);
      const payload = buildAvaliacaoInvokePayload(selected, []);
      expect(Object.keys(payload.imovel)).toContain("descricao");
      expect(payload.imovel.descricao).toBeNull();
    });

    it("faz trim de espaços/acentos e preserva o valor no payload", () => {
      const selected = buildManualImovel(
        { descricao: "   Apartamento com varanda gourmet e área de lazer.   " },
        false,
        null,
      );
      const payload = buildAvaliacaoInvokePayload(selected, []);
      expect(payload.imovel.descricao).toBe(
        "Apartamento com varanda gourmet e área de lazer.",
      );
    });
  });

  describe("modo POR LINK", () => {
    it("usa dadosExtraidos.descricao quando o usuário não digita nada — não perde a descrição", () => {
      const extraidos = {
        descricao: "Descrição extraída automaticamente do anúncio original.",
      };
      const selected = buildManualImovel({ descricao: "" }, true, extraidos);
      const payload = buildAvaliacaoInvokePayload(selected, []);
      expect(payload.imovel.descricao).toBe(
        "Descrição extraída automaticamente do anúncio original.",
      );
    });

    it("sobrescreve a descrição extraída quando o usuário digita algo", () => {
      const extraidos = { descricao: "Texto original do anúncio." };
      const selected = buildManualImovel(
        { descricao: "Ajuste manual feito pelo corretor." },
        true,
        extraidos,
      );
      const payload = buildAvaliacaoInvokePayload(selected, []);
      expect(payload.imovel.descricao).toBe("Ajuste manual feito pelo corretor.");
    });

    it("mantém descricao = null quando não há texto manual e extraidos.descricao é vazio/undefined", () => {
      const selected = buildManualImovel({ descricao: "   " }, true, { descricao: null });
      const payload = buildAvaliacaoInvokePayload(selected, []);
      expect(Object.keys(payload.imovel)).toContain("descricao");
      expect(payload.imovel.descricao).toBeNull();
    });

    it("mantém descricao = null quando dadosExtraidos é null (extração ainda não rodou)", () => {
      const selected = buildManualImovel({ descricao: "" }, true, null);
      const payload = buildAvaliacaoInvokePayload(selected, []);
      expect(Object.keys(payload.imovel)).toContain("descricao");
      expect(payload.imovel.descricao).toBeNull();
    });
  });

  describe("garantia estrutural do payload", () => {
    it("a chave 'descricao' SEMPRE existe em payload.imovel (10 cenários variados)", () => {
      const cenarios: Array<{ manual: any; modoLink: boolean; extraidos: any }> = [
        { manual: { descricao: "" }, modoLink: false, extraidos: null },
        { manual: { descricao: "" }, modoLink: true, extraidos: null },
        { manual: { descricao: "" }, modoLink: true, extraidos: { descricao: null } },
        { manual: { descricao: "" }, modoLink: true, extraidos: { descricao: "" } },
        { manual: { descricao: "abc" }, modoLink: false, extraidos: null },
        { manual: { descricao: "abc" }, modoLink: true, extraidos: { descricao: "xyz" } },
        { manual: {}, modoLink: false, extraidos: null },
        { manual: {}, modoLink: true, extraidos: { descricao: "só o extraído" } },
        { manual: { descricao: null }, modoLink: true, extraidos: { descricao: "fallback" } },
        { manual: { descricao: undefined }, modoLink: false, extraidos: undefined as any },
      ];
      for (const c of cenarios) {
        const selected = buildManualImovel(c.manual, c.modoLink, c.extraidos);
        const payload = buildAvaliacaoInvokePayload(selected, []);
        expect(Object.prototype.hasOwnProperty.call(payload.imovel, "descricao")).toBe(true);
        // valor válido: string não-vazia ou null explícito (nunca undefined)
        expect(payload.imovel.descricao === null || typeof payload.imovel.descricao === "string").toBe(true);
      }
    });

    it("preserva comparaveis e correlation_id sem afetar a descrição", () => {
      const selected = buildManualImovel({ descricao: "ok mínimo válido teste teste teste" }, false, null);
      const comps = [{ id: "c1" }, { id: "c2" }];
      const payload = buildAvaliacaoInvokePayload(selected, comps, "corr-xyz");
      expect(payload.comparaveis).toEqual(comps);
      expect(payload.correlation_id).toBe("corr-xyz");
      expect(payload.imovel.descricao).toBe("ok mínimo válido teste teste teste");
    });

    it("mesmo com spread de selectedImovel, descricao final vem da regra e não é sobrescrita por undefined", () => {
      const selectedComUndefined = {
        id: "manual",
        titulo: "X",
        descricao: undefined as unknown as string | null,
      };
      const payload = buildAvaliacaoInvokePayload(selectedComUndefined as any, []);
      expect(payload.imovel.descricao).toBeNull();
    });
  });
});
