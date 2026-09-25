import { describe, it, expect } from "vitest";
import {
  extractIndicadoPor,
  stripIndicadoPor,
  buildObservacoes,
  isCaptacaoSubmittable,
  computeCaptacaoKpis,
  type CaptacaoLike,
} from "./captacaoIndicacao";

describe("captacaoIndicacao – campo 'Indicado por'", () => {
  describe("extractIndicadoPor", () => {
    it("retorna o nome quando observacoes começa com 'Indicado por:'", () => {
      expect(extractIndicadoPor("Indicado por: João Silva")).toBe("João Silva");
    });
    it("ignora linhas adicionais após o nome", () => {
      expect(
        extractIndicadoPor("Indicado por: Maria\nCliente premium")
      ).toBe("Maria");
    });
    it("retorna null quando não há marcação", () => {
      expect(extractIndicadoPor("observação livre")).toBeNull();
      expect(extractIndicadoPor(null)).toBeNull();
      expect(extractIndicadoPor(undefined)).toBeNull();
      expect(extractIndicadoPor("")).toBeNull();
    });
    it("trata espaços extras", () => {
      expect(extractIndicadoPor("Indicado por:    Ana  ")).toBe("Ana");
    });
  });

  describe("stripIndicadoPor", () => {
    it("remove a linha 'Indicado por' preservando o restante", () => {
      expect(
        stripIndicadoPor("Indicado por: Pedro\nrestante da observação")
      ).toBe("restante da observação");
    });
    it("não altera observações sem marcação", () => {
      expect(stripIndicadoPor("nota qualquer")).toBe("nota qualquer");
    });
  });

  describe("buildObservacoes", () => {
    it("prefixa 'Indicado por:' quando tipo = indicacao", () => {
      expect(buildObservacoes("indicacao", "Carlos", "lead quente")).toBe(
        "Indicado por: Carlos\nlead quente"
      );
    });
    it("aceita apenas o nome sem observação adicional", () => {
      expect(buildObservacoes("indicacao", "Carlos", "")).toBe(
        "Indicado por: Carlos"
      );
    });
    it("para outros tipos retorna apenas a observação ou null", () => {
      expect(buildObservacoes("porteiro", "", "")).toBeNull();
      expect(buildObservacoes("porteiro", "", "obs")).toBe("obs");
    });
    it("ignora indicadoPor vazio mesmo com tipo = indicacao", () => {
      expect(buildObservacoes("indicacao", "   ", "x")).toBe("x");
    });
  });

  describe("isCaptacaoSubmittable", () => {
    it("bloqueia quando nome é vazio", () => {
      expect(
        isCaptacaoSubmittable({ tipo: "porteiro", nome: "  " })
      ).toBe(false);
    });
    it("exige 'Indicado por' quando tipo = indicacao", () => {
      expect(
        isCaptacaoSubmittable({ tipo: "indicacao", nome: "Lead", indicadoPor: "" })
      ).toBe(false);
      expect(
        isCaptacaoSubmittable({
          tipo: "indicacao",
          nome: "Lead",
          indicadoPor: "Cliente X",
        })
      ).toBe(true);
    });
    it("permite outros tipos sem indicadoPor", () => {
      expect(
        isCaptacaoSubmittable({ tipo: "porteiro", nome: "Lead" })
      ).toBe(true);
    });
  });

  describe("persistência ↔ exibição", () => {
    it("roundtrip: o que é salvo via buildObservacoes é extraído de volta", () => {
      const persisted = buildObservacoes(
        "indicacao",
        "Fernanda",
        "Procura cobertura"
      );
      expect(persisted).not.toBeNull();
      expect(extractIndicadoPor(persisted)).toBe("Fernanda");
      expect(stripIndicadoPor(persisted)).toBe("Procura cobertura");
    });
  });

  describe("computeCaptacaoKpis (KPI strip)", () => {
    const sample: CaptacaoLike[] = [
      { tipo: "indicacao", status: "pendente", observacoes: "Indicado por: A" },
      { tipo: "indicacao", status: "concluida", observacoes: "Indicado por: B" },
      { tipo: "porteiro", status: "em_andamento" },
      { tipo: "construtor", status: "concluida" },
      { tipo: "sindico", status: "cancelada" },
    ];

    it("conta total, status e indicações corretamente", () => {
      const k = computeCaptacaoKpis(sample);
      expect(k.total).toBe(5);
      expect(k.pendentes).toBe(1);
      expect(k.andamento).toBe(1);
      expect(k.concluidas).toBe(2);
      expect(k.indicacoes).toBe(2);
    });

    it("calcula taxa de conversão como % de concluídas", () => {
      expect(computeCaptacaoKpis(sample).taxa).toBe(40);
    });

    it("retorna zeros para lista vazia (sem divisão por zero)", () => {
      const k = computeCaptacaoKpis([]);
      expect(k).toEqual({
        total: 0,
        pendentes: 0,
        andamento: 0,
        concluidas: 0,
        indicacoes: 0,
        taxa: 0,
      });
    });

    it("indicações criadas via buildObservacoes são contadas no KPI", () => {
      const list: CaptacaoLike[] = [
        {
          tipo: "indicacao",
          status: "pendente",
          observacoes: buildObservacoes("indicacao", "João", ""),
        },
      ];
      const k = computeCaptacaoKpis(list);
      expect(k.indicacoes).toBe(1);
      expect(extractIndicadoPor(list[0].observacoes)).toBe("João");
    });
  });
});
