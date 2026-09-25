/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 */

import {
  EVENTO_FILTROS,
  LOVABLE_TO_VB_FIELD_MAP,
  RELACIONAMENTO_FORM_FIELD_KEYS,
  TEMPLATE_TIPOS,
  applyTemplateVars,
  buildClientePayload,
  clienteFromApi,
  clienteTemEvento,
  clientesComEventoProximo,
  emptyClienteForm,
  filterByEventos,
  getDefaultTemplate,
  getWhatsAppLink,
  proximoEvento,
  searchClientesMatch,
} from "./relacionamentoCrm";

describe("relacionamentoCrm frontend — Lovable parity", () => {
  it("maps every Lovable snake_case input to a VB form field", () => {
    expect(Object.keys(LOVABLE_TO_VB_FIELD_MAP).sort()).toEqual(
      [
        "ativo",
        "aniversario",
        "data_casamento",
        "data_compra_imovel",
        "data_mudanca",
        "data_profissao",
        "email",
        "filhos",
        "nome",
        "observacoes",
        "profissao",
        "telefone",
      ].sort()
    );
  });

  it("keeps form fields aligned with Lovable emptyForm", () => {
    expect(Object.keys(emptyClienteForm()).sort()).toEqual(
      [
        "aniversario",
        "dataCasamento",
        "dataCompraImovel",
        "dataMudanca",
        "dataProfissao",
        "email",
        "filhos",
        "nome",
        "observacoes",
        "profissao",
        "telefone",
      ].sort()
    );
    expect(RELACIONAMENTO_FORM_FIELD_KEYS).toEqual([
      "nome",
      "telefone",
      "email",
      "aniversario",
      "dataCasamento",
      "profissao",
      "dataProfissao",
      "dataMudanca",
      "dataCompraImovel",
      "filhos",
      "observacoes",
    ]);
  });

  it("exposes the same template tipos and event filters", () => {
    expect(TEMPLATE_TIPOS.map((t) => t.value)).toEqual([
      "aniversario",
      "casamento",
      "profissao",
      "filho_aniversario",
      "mudanca",
      "compra_imovel",
      "reativacao",
    ]);
    expect(EVENTO_FILTROS.map((e) => e.tipo)).toEqual([
      "aniversario",
      "casamento",
      "profissao",
      "mudanca",
      "compra",
      "filhos",
    ]);
  });

  it("maps API → form and form → payload like Lovable", () => {
    const fromApi = clienteFromApi({
      id: 1,
      nome: "Maria",
      telefone: "11999990000",
      email: "m@x.com",
      aniversario: "1990-05-20T00:00:00.000Z",
      dataCasamento: null,
      profissao: "Engenheira",
      dataProfissao: "2005-06-15",
      dataMudanca: "",
      dataCompraImovel: "2018-01-01",
      filhos: [{ nome: "João", data_nascimento: "2015-03-10" }],
      observacoes: "VIP",
      ativo: true,
    });

    expect(fromApi.aniversario).toBe("1990-05-20");
    expect(fromApi.filhos[0]).toEqual({ nome: "João", dataNascimento: "2015-03-10" });

    const payload = buildClientePayload({
      ...fromApi,
      aniversario: "",
      dataCasamento: "",
    });
    expect(payload.nome).toBe("Maria");
    expect(payload.aniversario).toBeNull();
    expect(payload.dataCasamento).toBeNull();
    expect(payload.filhos[0].dataNascimento).toBe("2015-03-10");
  });

  it("filters/search/próximo evento like Lovable page", () => {
    const hoje = new Date(2026, 8, 25);
    const clientes = [
      {
        nome: "Ana",
        telefone: "1199",
        email: "ana@x.com",
        profissao: "Médica",
        aniversario: "2000-09-28",
        dataCasamento: null,
        dataProfissao: null,
        dataMudanca: null,
        dataCompraImovel: null,
        filhos: [],
        ativo: true,
      },
      {
        nome: "Bruno",
        telefone: "1188",
        email: "b@x.com",
        profissao: null,
        aniversario: null,
        dataCasamento: null,
        dataProfissao: null,
        dataMudanca: null,
        dataCompraImovel: null,
        filhos: [{ nome: "Lia", dataNascimento: "2012-01-01" }],
        ativo: false,
      },
    ];

    expect(searchClientesMatch(clientes[0], "méd")).toBe(true);
    expect(clienteTemEvento(clientes[1], "filhos")).toBe(true);
    expect(filterByEventos(clientes, ["filhos"]).map((c) => c.nome)).toEqual(["Bruno"]);
    expect(proximoEvento(clientes[0], hoje)).toBe("Aniversário em 3 dias");
    expect(clientesComEventoProximo(clientes, 7, hoje)).toBe(1);
    expect(applyTemplateVars("Oi {nome}", { nome: "Ana" })).toBe("Oi Ana");
    expect(getDefaultTemplate("reativacao")).toContain("{nome}");
    expect(getWhatsAppLink("11999990000", "oi")).toContain("wa.me/5511999990000");
  });
});
