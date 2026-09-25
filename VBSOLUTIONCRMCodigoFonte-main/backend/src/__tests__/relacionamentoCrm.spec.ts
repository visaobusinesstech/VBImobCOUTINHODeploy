/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 */

import {
  EVENTO_FILTROS,
  LOVABLE_TO_VB_FIELD_MAP,
  RELACIONAMENTO_WRITABLE_FIELDS,
  TEMPLATE_TIPOS,
  TEMPLATE_TIPOS_VALUES,
  applyTemplateVars,
  clienteTemEvento,
  clientesComEventoProximo,
  digitsOnly,
  filterClientesByEventos,
  getDefaultTemplate,
  getWhatsAppLink,
  isValidTemplateTipo,
  normalizeClienteRelacionamentoPayload,
  proximoEventoLabel,
  searchClientesRelacionamentoMatch
} from "../helpers/relacionamentoCrm";

describe("relacionamentoCrm — field parity with Lovable", () => {
  it("maps every Lovable snake_case input to a VB field", () => {
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
        "telefone"
      ].sort()
    );
  });

  it("covers every writable cliente column", () => {
    expect([...RELACIONAMENTO_WRITABLE_FIELDS]).toEqual([
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
      "ativo"
    ]);
  });

  it("exposes the same template tipos as Lovable", () => {
    expect([...TEMPLATE_TIPOS_VALUES]).toEqual([
      "aniversario",
      "casamento",
      "profissao",
      "filho_aniversario",
      "mudanca",
      "compra_imovel",
      "reativacao"
    ]);
    expect(TEMPLATE_TIPOS.map(t => t.value)).toEqual([...TEMPLATE_TIPOS_VALUES]);
    TEMPLATE_TIPOS.forEach(t => {
      expect(t.defaultMsg).toBeTruthy();
      expect(t.opcoes.length).toBe(5);
      expect(isValidTemplateTipo(t.value)).toBe(true);
    });
  });

  it("exposes the same event filters as Lovable", () => {
    expect(EVENTO_FILTROS.map(e => e.tipo)).toEqual([
      "aniversario",
      "casamento",
      "profissao",
      "mudanca",
      "compra",
      "filhos"
    ]);
  });

  it("normalizes snake_case and empty dates like Lovable save", () => {
    const data = normalizeClienteRelacionamentoPayload({
      nome: "  Maria Silva  ",
      telefone: "(11) 99999-0000",
      email: "  Maria@Exemplo.com ",
      aniversario: "",
      data_casamento: "1990-05-20",
      data_profissao: null,
      data_mudanca: "2020-01-01",
      data_compra_imovel: "",
      profissao: "Engenheira",
      filhos: [{ nome: "João", data_nascimento: "2015-03-10" }],
      observacoes: "VIP"
    });

    expect(data.nome).toBe("Maria Silva");
    expect(data.email).toBe("maria@exemplo.com");
    expect(data.aniversario).toBeNull();
    expect(data.dataCasamento).toBe("1990-05-20");
    expect(data.dataProfissao).toBeNull();
    expect(data.dataMudanca).toBe("2020-01-01");
    expect(data.dataCompraImovel).toBeNull();
    expect(data.filhos).toEqual([{ nome: "João", dataNascimento: "2015-03-10" }]);
    expect(data.ativo).toBe(true);
  });

  it("requires nome on full normalize", () => {
    const data = normalizeClienteRelacionamentoPayload({ nome: "   " });
    expect(data.nome).toBe("");
  });

  it("detects events like Lovable clienteTemEvento", () => {
    const c = {
      aniversario: "1990-01-01",
      dataCasamento: null,
      dataProfissao: "2000-01-01",
      dataMudanca: null,
      dataCompraImovel: "2019-01-01",
      filhos: [{ nome: "A", dataNascimento: "2010-01-01" }]
    };
    expect(clienteTemEvento(c, "aniversario")).toBe(true);
    expect(clienteTemEvento(c, "casamento")).toBe(false);
    expect(clienteTemEvento(c, "profissao")).toBe(true);
    expect(clienteTemEvento(c, "mudanca")).toBe(false);
    expect(clienteTemEvento(c, "compra")).toBe(true);
    expect(clienteTemEvento(c, "filhos")).toBe(true);
  });

  it("computes próximo evento and 7-day count", () => {
    const hoje = new Date(2026, 8, 25); // 25 set 2026
    const in3 = "2000-09-28"; // 28 set
    const cliente = {
      ativo: true,
      aniversario: in3,
      dataCasamento: null,
      dataProfissao: null,
      dataMudanca: null,
      dataCompraImovel: null,
      filhos: [],
      profissao: null
    };
    expect(proximoEventoLabel(cliente, hoje)).toBe("Aniversário em 3 dias");
    expect(clientesComEventoProximo([cliente], 7, hoje)).toBe(1);
    expect(clientesComEventoProximo([{ ...cliente, ativo: false }], 7, hoje)).toBe(0);
  });

  it("searches and filters like Lovable page", () => {
    const lista = [
      {
        nome: "Ana",
        telefone: "11999990000",
        email: "ana@x.com",
        profissao: "Médica",
        aniversario: "1990-01-01",
        filhos: []
      },
      {
        nome: "Bruno",
        telefone: "11888880000",
        email: "bruno@x.com",
        profissao: "Advogado",
        aniversario: null,
        filhos: [{ nome: "Lia", dataNascimento: "2012-01-01" }]
      }
    ];
    expect(searchClientesRelacionamentoMatch(lista[0], "méd")).toBe(true);
    expect(searchClientesRelacionamentoMatch(lista[1], "ana")).toBe(false);
    expect(filterClientesByEventos(lista, ["filhos"]).map((c: any) => c.nome)).toEqual([
      "Bruno"
    ]);
  });

  it("applies template vars and builds WhatsApp link", () => {
    expect(applyTemplateVars("Oi {nome} — {profissao}", { nome: "Ana", profissao: "Médica" })).toBe(
      "Oi Ana — Médica"
    );
    expect(getDefaultTemplate("aniversario")).toContain("{nome}");
    expect(digitsOnly("(11) 9.9999-0000")).toBe("11999990000");
    expect(getWhatsAppLink("(11) 99999-0000", "Oi")).toContain("wa.me/5511999990000");
  });
});
