/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 */

import {
  CANAIS_ORIGEM_PROP,
  DADOS_IMOVEL_TIPOS,
  ESTADOS_CIVIS,
  FAMILIAR_RELACOES,
  LOVABLE_TO_VB_FIELD_MAP,
  PROPRIETARIO_FORM_FIELD_KEYS,
  PROPRIETARIO_TIPO_LABEL,
  buildOwnerDiligenceQuery,
  buildOwnerDiligenceSources,
  buildProprietarioPayload,
  emptyProprietarioForm,
  filterProprietariosByTipo,
  isCasadoOuUniao,
  proprietarioFromApi,
  rankCaptacaoByCanal,
  searchProprietariosMatch,
} from "./proprietarioCrm";

describe("proprietarioCrm frontend — Lovable parity", () => {
  it("keeps the same select options as Lovable form", () => {
    expect(ESTADOS_CIVIS).toEqual([
      "Solteiro(a)",
      "Casado(a)",
      "Divorciado(a)",
      "Viúvo(a)",
      "União Estável",
      "Separado(a)",
    ]);
    expect(CANAIS_ORIGEM_PROP).toEqual([
      "Indicação",
      "Porteiro",
      "Placa",
      "Internet",
      "Redes Sociais",
      "Portal Imobiliário",
      "Construtora",
      "Síndico",
      "Outro",
    ]);
    expect(DADOS_IMOVEL_TIPOS).toEqual([
      "Apartamento",
      "Casa",
      "Terreno",
      "Comercial",
      "Cobertura",
    ]);
    expect(FAMILIAR_RELACOES).toEqual([
      "filho",
      "filha",
      "pai",
      "mãe",
      "irmão",
      "irmã",
      "neto",
      "neta",
      "outro",
    ]);
    expect(PROPRIETARIO_TIPO_LABEL).toEqual({
      venda: "Venda",
      aluguel: "Aluguel",
      ambos: "Ambos",
    });
  });

  it("maps every Lovable snake_case input to a VB form field", () => {
    expect(Object.keys(LOVABLE_TO_VB_FIELD_MAP).sort()).toEqual(
      [
        "nome",
        "cpf_cnpj",
        "telefone",
        "email",
        "endereco",
        "cidade",
        "estado",
        "cep",
        "banco",
        "agencia",
        "conta",
        "pix",
        "tipo",
        "observacoes",
        "estado_civil",
        "canal_origem",
        "conjuge_nome",
        "conjuge_cpf",
        "conjuge_data_nascimento",
        "data_nascimento",
        "data_casamento",
        "data_compra_imovel",
        "contrato_administracao",
        "comissao_acordada",
        "exclusividade",
        "exclusividade_inicio",
        "exclusividade_fim",
        "exclusividade_contrato_url",
        "saldo_devedor",
        "parcela_atraso_financiamento",
        "parcela_atraso_condominio",
        "parcela_atraso_iptu",
        "quitado",
        "averbacao",
        "dados_imovel_endereco",
        "dados_imovel_tipo",
        "dados_imovel_area",
        "inscricao_iptu",
        "matricula",
        "certidao_onus_url",
      ].sort()
    );
    const vbKeys = new Set(PROPRIETARIO_FORM_FIELD_KEYS);
    Object.values(LOVABLE_TO_VB_FIELD_MAP).forEach((vbKey) => {
      expect(vbKeys.has(vbKey)).toBe(true);
    });
    expect(PROPRIETARIO_FORM_FIELD_KEYS).toHaveLength(40);
  });

  it("empty form defaults match Lovable emptyProprietarioForm", () => {
    const form = emptyProprietarioForm();
    expect(form.tipo).toBe("ambos");
    expect(form.state).toBe("DF");
    expect(form.contratoAdministracao).toBe(false);
    expect(form.exclusividade).toBe(false);
    expect(form.comissaoAcordada).toBe(0);
    expect(form.dadosImovelArea).toBe(0);
    expect(form.saldoDevedor).toBe(false);
    expect(form.quitado).toBe(false);
  });

  it("maps API record into form fields 1:1", () => {
    const form = proprietarioFromApi({
      id: 1,
      name: "João",
      document: "111",
      phone: "61",
      email: "a@b.c",
      address: "Rua 1",
      city: "DF",
      state: "DF",
      zipCode: "70000",
      bank: "Itaú",
      agency: "1",
      account: "2",
      pix: "pix",
      tipo: "aluguel",
      notes: "obs",
      estadoCivil: "Casado(a)",
      canalOrigem: "Placa",
      conjugeNome: "Maria",
      conjugeCpf: "222",
      conjugeDataNascimento: "1990-01-01",
      dataNascimento: "1988-02-02",
      dataCasamento: "2012-03-03",
      dataCompraImovel: "2015-04-04",
      contratoAdministracao: true,
      comissaoAcordada: 4,
      exclusividade: true,
      exclusividadeInicio: "2024-01-01",
      exclusividadeFim: "2025-01-01",
      exclusividadeContratoUrl: "/public/c.pdf",
      saldoDevedor: true,
      parcelaAtrasoFinanciamento: true,
      parcelaAtrasoCondominio: false,
      parcelaAtrasoIptu: true,
      quitado: false,
      averbacao: true,
      dadosImovelEndereco: "End",
      dadosImovelTipo: "Casa",
      dadosImovelArea: 200,
      inscricaoIptu: "i1",
      matricula: "m1",
      certidaoOnusUrl: "/public/o.pdf",
      familiares: [{ id: 9, nome: "Filho", dataNascimento: "2015-01-01", relacao: "filho" }],
    });

    expect(form.name).toBe("João");
    expect(form.document).toBe("111");
    expect(form.tipo).toBe("aluguel");
    expect(form.estadoCivil).toBe("Casado(a)");
    expect(form.canalOrigem).toBe("Placa");
    expect(form.conjugeNome).toBe("Maria");
    expect(form.contratoAdministracao).toBe(true);
    expect(form.exclusividade).toBe(true);
    expect(form.comissaoAcordada).toBe(4);
    expect(form.dadosImovelTipo).toBe("Casa");
    expect(form.dadosImovelArea).toBe(200);
    expect(form.certidaoOnusUrl).toBe("/public/o.pdf");
    expect(form.familiares).toHaveLength(1);
    expect(form.familiares[0].nome).toBe("Filho");
  });

  it("builds save payload dropping empty familiares and blank strings", () => {
    const form = {
      ...emptyProprietarioForm(),
      name: "X",
      notes: "",
      phone: "619",
      contratoAdministracao: true,
      comissaoAcordada: 3.5,
    };
    const payload = buildProprietarioPayload(form, [
      { nome: " Ana ", dataNascimento: "", relacao: "filha" },
      { nome: "   ", relacao: "filho" },
    ]);
    expect(payload.name).toBe("X");
    expect(payload.notes).toBeNull();
    expect(payload.phone).toBe("619");
    expect(payload.contratoAdministracao).toBe(true);
    expect(payload.comissaoAcordada).toBe(3.5);
    expect(payload.familiares).toEqual([
      { id: undefined, nome: "Ana", dataNascimento: null, relacao: "filha" },
    ]);
  });

  it("filters, ranks and searches like Lovable page", () => {
    const items = [
      { name: "Alpha", tipo: "venda", canalOrigem: "Internet", phone: "61911112222" },
      { name: "Beta", tipo: "ambos", canalOrigem: "Internet", dadosImovelEndereco: "Lago Sul" },
    ];
    expect(filterProprietariosByTipo(items, "venda")).toHaveLength(2);
    expect(rankCaptacaoByCanal(items, "venda")[0]).toEqual({ canal: "Internet", count: 2 });
    expect(searchProprietariosMatch(items[1], "lago")).toBe(true);
    expect(isCasadoOuUniao("Casado(a)")).toBe(true);
  });

  it("builds owner diligence query and sources like Lovable", () => {
    const query = buildOwnerDiligenceQuery({ name: "Maria Silva", city: "Brasília" });
    expect(query).toBe("Maria Silva Brasília consulta jurídica processos notícias");
    const sources = buildOwnerDiligenceSources(query);
    expect(sources).toHaveLength(4);
    expect(sources[0].url).toContain("google.com/search");
    expect(sources[2].url).toContain("jusbrasil.com.br");
  });
});
