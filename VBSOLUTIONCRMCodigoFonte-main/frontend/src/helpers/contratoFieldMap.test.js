/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 */

import {
  API_TO_LOVABLE,
  LOVABLE_TO_API,
  apiToLovable,
  emptyContratoForm,
  getCommissionBaseValue,
  lovableToApi,
  recalculateCommissionState,
} from "./contratoFieldMap";

describe("contratoFieldMap", () => {
  it("mapeia campos especiais Lovable → API", () => {
    expect(LOVABLE_TO_API.titulo).toBe("title");
    expect(LOVABLE_TO_API.valor).toBe("value");
    expect(LOVABLE_TO_API.data_inicio).toBe("startDate");
    expect(LOVABLE_TO_API.data_fim).toBe("endDate");
    expect(LOVABLE_TO_API.observacoes).toBe("notes");
    expect(LOVABLE_TO_API.proprietario_id).toBe("proprietarioId");
    expect(LOVABLE_TO_API.imovel_id).toBe("imovelId");
    expect(LOVABLE_TO_API.contrato_anexo_url).toBe("contratoAnexoUrl");
  });

  it("faz round-trip lovableToApi ↔ apiToLovable", () => {
    const lovable = {
      titulo: "Contrato Teste",
      valor: 1500,
      data_inicio: "2026-01-01",
      data_fim: "2026-12-31",
      observacoes: "obs",
      proprietario_id: "10",
      imovel_id: "20",
      comissao_percentual: 10,
      canal_origem: "instagram",
    };

    const api = lovableToApi(lovable);
    expect(api).toMatchObject({
      title: "Contrato Teste",
      value: 1500,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      notes: "obs",
      proprietarioId: "10",
      imovelId: "20",
      comissaoPercentual: 10,
      canalOrigem: "instagram",
    });

    const back = apiToLovable(api);
    expect(back).toMatchObject(lovable);
  });

  it("emptyContratoForm retorna defaults camelCase esperados", () => {
    const form = emptyContratoForm();
    expect(form.title).toBe("");
    expect(form.value).toBe(0);
    expect(form.tipo).toBe("Venda");
    expect(form.status).toBe("rascunho");
    expect(form.comissaoTipo).toBe("mensal");
    expect(form.indiceCorrecao).toBe("IGPM");
    expect(form.tipoGarantia).toBe("seguro_fianca");
    expect(form.diaVencimentoAluguel).toBe(10);
    expect(Array.isArray(form.parceriaEnvolvidos)).toBe(true);
    expect(form.contratoAnexoUrl).toBe("");
    expect(form.startDate).toBe("");
    expect(form.notes).toBe("");
    expect(Object.values(LOVABLE_TO_API)).toEqual(
      expect.arrayContaining(["title", "value", "startDate", "endDate", "notes"])
    );
    expect(API_TO_LOVABLE.title).toBe("titulo");
  });

  it("recalcula comissão mensal e anual (Locação)", () => {
    const mensal = recalculateCommissionState({
      ...emptyContratoForm(),
      tipo: "Locação",
      comissaoTipo: "mensal",
      value: 2000,
      comissaoPercentual: 10,
      parceiroComissaoPercentual: 50,
      captadorComissaoPercentual: 20,
      corretorComissaoPercentual: 30,
      impostoPercentual: 5,
    });

    expect(getCommissionBaseValue(mensal)).toBe(2000);
    expect(mensal.comissaoValor).toBe(200);
    expect(mensal.parceiroComissaoValor).toBe(100);
    expect(mensal.captadorComissaoValor).toBe(40);
    expect(mensal.corretorComissaoValor).toBe(60);
    expect(mensal.impostoValor).toBe(10);

    const anual = recalculateCommissionState({
      ...emptyContratoForm(),
      tipo: "Locação",
      comissaoTipo: "anual",
      value: 2000,
      comissaoPercentual: 10,
    });
    expect(getCommissionBaseValue(anual)).toBe(24000);
    expect(anual.comissaoValor).toBe(2400);
  });
});
