/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 */

import {
  CANAIS_ORIGEM_PROP,
  DADOS_IMOVEL_TIPOS,
  ESTADOS_CIVIS,
  FAMILIAR_RELACOES,
  LOVABLE_TO_VB_FIELD_MAP,
  PROPRIETARIO_TIPOS,
  PROPRIETARIO_WRITABLE_FIELDS,
  buildDuplicateWarnings,
  buildOwnerDiligenceQuery,
  buildOwnerDiligenceSources,
  filterProprietariosByTipo,
  isCasadoOuUniao,
  normalizeProprietarioPayload,
  rankCaptacaoByCanal,
  searchProprietariosMatch
} from "../helpers/proprietarioCrm";

describe("proprietarioCrm — field parity with Lovable", () => {
  it("exposes the same option lists as ProprietarioFormDialog", () => {
    expect([...ESTADOS_CIVIS]).toEqual([
      "Solteiro(a)",
      "Casado(a)",
      "Divorciado(a)",
      "Viúvo(a)",
      "União Estável",
      "Separado(a)"
    ]);
    expect([...CANAIS_ORIGEM_PROP]).toEqual([
      "Indicação",
      "Porteiro",
      "Placa",
      "Internet",
      "Redes Sociais",
      "Portal Imobiliário",
      "Construtora",
      "Síndico",
      "Outro"
    ]);
    expect([...DADOS_IMOVEL_TIPOS]).toEqual([
      "Apartamento",
      "Casa",
      "Terreno",
      "Comercial",
      "Cobertura"
    ]);
    expect([...FAMILIAR_RELACOES]).toEqual([
      "filho",
      "filha",
      "pai",
      "mãe",
      "irmão",
      "irmã",
      "neto",
      "neta",
      "outro"
    ]);
    expect([...PROPRIETARIO_TIPOS]).toEqual(["venda", "aluguel", "ambos"]);
  });

  it("covers every writable proprietario column", () => {
    expect(PROPRIETARIO_WRITABLE_FIELDS).toEqual(
      expect.arrayContaining([
        "name",
        "document",
        "phone",
        "email",
        "address",
        "city",
        "state",
        "zipCode",
        "bank",
        "agency",
        "account",
        "pix",
        "tipo",
        "notes",
        "estadoCivil",
        "canalOrigem",
        "conjugeNome",
        "conjugeCpf",
        "conjugeDataNascimento",
        "dataNascimento",
        "dataCasamento",
        "dataCompraImovel",
        "contratoAdministracao",
        "comissaoAcordada",
        "exclusividade",
        "exclusividadeInicio",
        "exclusividadeFim",
        "exclusividadeContratoUrl",
        "saldoDevedor",
        "parcelaAtrasoFinanciamento",
        "parcelaAtrasoCondominio",
        "parcelaAtrasoIptu",
        "quitado",
        "averbacao",
        "dadosImovelEndereco",
        "dadosImovelTipo",
        "dadosImovelArea",
        "inscricaoIptu",
        "matricula",
        "certidaoOnusUrl"
      ])
    );
    expect(PROPRIETARIO_WRITABLE_FIELDS).toHaveLength(40);
  });
});

describe("normalizeProprietarioPayload", () => {
  it("maps Lovable snake_case aliases to VB camelCase", () => {
    const { data, familiares } = normalizeProprietarioPayload({
      nome: "Maria Silva",
      cpf_cnpj: "123.456.789-00",
      telefone: "61999999999",
      email: "maria@test.com",
      endereco: "SQN 100",
      cidade: "Brasília",
      estado: "DF",
      cep: "70000-000",
      banco: "BB",
      agencia: "1234",
      conta: "56789-0",
      pix: "maria@pix",
      tipo: "venda",
      observacoes: "VIP",
      estado_civil: "Casado(a)",
      canal_origem: "Indicação",
      conjuge_nome: "João",
      conjuge_cpf: "111.222.333-44",
      conjuge_data_nascimento: "1980-01-01",
      data_nascimento: "1982-05-10",
      data_casamento: "2005-06-15",
      data_compra_imovel: "2010-03-20",
      contrato_administracao: true,
      comissao_acordada: 5.5,
      exclusividade: true,
      exclusividade_inicio: "2024-01-01",
      exclusividade_fim: "2025-01-01",
      exclusividade_contrato_url: "/public/x.pdf",
      saldo_devedor: false,
      parcela_atraso_financiamento: true,
      parcela_atraso_condominio: false,
      parcela_atraso_iptu: false,
      quitado: true,
      averbacao: true,
      dados_imovel_endereco: "Asa Norte",
      dados_imovel_tipo: "Apartamento",
      dados_imovel_area: 120,
      inscricao_iptu: "IPTU-1",
      matricula: "MAT-9",
      certidao_onus_url: "/public/y.pdf",
      familiares: [
        { nome: "Pedro", data_nascimento: "2010-01-01", relacao: "filho" },
        { nome: "  ", data_nascimento: null, relacao: "filha" }
      ]
    });

    expect(data.name).toBe("Maria Silva");
    expect(data.document).toBe("123.456.789-00");
    expect(data.phone).toBe("61999999999");
    expect(data.email).toBe("maria@test.com");
    expect(data.address).toBe("SQN 100");
    expect(data.city).toBe("Brasília");
    expect(data.state).toBe("DF");
    expect(data.zipCode).toBe("70000-000");
    expect(data.bank).toBe("BB");
    expect(data.agency).toBe("1234");
    expect(data.account).toBe("56789-0");
    expect(data.pix).toBe("maria@pix");
    expect(data.tipo).toBe("venda");
    expect(data.notes).toBe("VIP");
    expect(data.estadoCivil).toBe("Casado(a)");
    expect(data.canalOrigem).toBe("Indicação");
    expect(data.conjugeNome).toBe("João");
    expect(data.conjugeCpf).toBe("111.222.333-44");
    expect(data.conjugeDataNascimento).toBe("1980-01-01");
    expect(data.dataNascimento).toBe("1982-05-10");
    expect(data.dataCasamento).toBe("2005-06-15");
    expect(data.dataCompraImovel).toBe("2010-03-20");
    expect(data.contratoAdministracao).toBe(true);
    expect(data.comissaoAcordada).toBe(5.5);
    expect(data.exclusividade).toBe(true);
    expect(data.exclusividadeInicio).toBe("2024-01-01");
    expect(data.exclusividadeFim).toBe("2025-01-01");
    expect(data.exclusividadeContratoUrl).toBe("/public/x.pdf");
    expect(data.saldoDevedor).toBe(false);
    expect(data.parcelaAtrasoFinanciamento).toBe(true);
    expect(data.quitado).toBe(true);
    expect(data.averbacao).toBe(true);
    expect(data.dadosImovelEndereco).toBe("Asa Norte");
    expect(data.dadosImovelTipo).toBe("Apartamento");
    expect(data.dadosImovelArea).toBe(120);
    expect(data.inscricaoIptu).toBe("IPTU-1");
    expect(data.matricula).toBe("MAT-9");
    expect(data.certidaoOnusUrl).toBe("/public/y.pdf");
    expect(familiares).toHaveLength(1);
    expect(familiares[0]).toMatchObject({
      nome: "Pedro",
      dataNascimento: "2010-01-01",
      relacao: "filho"
    });
  });

  it("accepts native camelCase VB payload and clamps commission", () => {
    const { data } = normalizeProprietarioPayload({
      name: "Ana",
      tipo: "invalid",
      comissaoAcordada: 150,
      contratoAdministracao: "true",
      notes: ""
    });
    expect(data.name).toBe("Ana");
    expect(data.tipo).toBe("ambos");
    expect(data.comissaoAcordada).toBe(100);
    expect(data.contratoAdministracao).toBe(true);
    expect(data.notes).toBeNull();
  });

  it("requires name on create via empty check", () => {
    const { data } = normalizeProprietarioPayload({ phone: "61" });
    expect(data.name).toBeUndefined();
  });
});

describe("proprietario list helpers", () => {
  const items = [
    { name: "A", tipo: "venda", canalOrigem: "Placa", phone: "61988887777" },
    { name: "B", tipo: "aluguel", canalOrigem: "Indicação", email: "b@x.com" },
    { name: "C", tipo: "ambos", canalOrigem: "Placa", document: "999" },
    { name: "D", tipo: "venda", canalOrigem: null, dadosImovelEndereco: "Asa Sul 10" }
  ];

  it("filters by tipo tabs including ambos", () => {
    expect(filterProprietariosByTipo(items, "todos")).toHaveLength(4);
    expect(filterProprietariosByTipo(items, "venda").map(i => i.name)).toEqual(["A", "C", "D"]);
    expect(filterProprietariosByTipo(items, "aluguel").map(i => i.name)).toEqual(["B", "C"]);
  });

  it("ranks capturao by canal", () => {
    const ranking = rankCaptacaoByCanal(items, "venda");
    expect(ranking[0]).toEqual({ canal: "Placa", count: 2 });
    expect(ranking.find(r => r.canal === "Não informado")?.count).toBe(1);
  });

  it("searches across name/phone/email/document/canal/imovel", () => {
    expect(searchProprietariosMatch(items[0], "888")).toBe(true);
    expect(searchProprietariosMatch(items[1], "b@x")).toBe(true);
    expect(searchProprietariosMatch(items[2], "999")).toBe(true);
    expect(searchProprietariosMatch(items[3], "asa sul")).toBe(true);
    expect(searchProprietariosMatch(items[0], "xyz")).toBe(false);
  });

  it("detects married/union for spouse section", () => {
    expect(isCasadoOuUniao("Casado(a)")).toBe(true);
    expect(isCasadoOuUniao("União Estável")).toBe(true);
    expect(isCasadoOuUniao("Solteiro(a)")).toBe(false);
  });
});

describe("duplicate + diligence parity", () => {
  it("maps every Lovable field alias to a writable VB column", () => {
    const writable = new Set(PROPRIETARIO_WRITABLE_FIELDS as readonly string[]);
    Object.entries(LOVABLE_TO_VB_FIELD_MAP).forEach(([lovable, vb]) => {
      if (lovable === "familiares") return;
      expect(writable.has(vb)).toBe(true);
    });
    expect(Object.keys(LOVABLE_TO_VB_FIELD_MAP).filter(k => k !== "familiares")).toHaveLength(40);
  });

  it("blocks create when duplicate document/phone/email matched", () => {
    const warnings = buildDuplicateWarnings({
      document: "123.456.789-00",
      phone: "61988887777",
      email: "a@b.com",
      matches: {
        byDocument: { name: "João" },
        byPhone: { name: "Maria" },
        byEmail: { name: "Ana" }
      }
    });
    expect(warnings).toHaveLength(3);
    expect(warnings[0]).toContain("CPF/CNPJ");
    expect(warnings[1]).toContain("telefone");
    expect(warnings[2]).toContain("e-mail");
  });

  it("allows create when no matches", () => {
    expect(
      buildDuplicateWarnings({
        document: "123.456.789-00",
        phone: "61988887777",
        email: "a@b.com",
        matches: {}
      })
    ).toEqual([]);
  });

  it("builds owner diligence query/sources like Lovable WebResearch", () => {
    const q = buildOwnerDiligenceQuery({ name: "Pedro", city: "Goiânia" });
    expect(q).toBe("Pedro Goiânia consulta jurídica processos notícias");
    const sources = buildOwnerDiligenceSources(q);
    expect(sources).toHaveLength(4);
    expect(sources.some(s => s.url.includes("jusbrasil"))).toBe(true);
  });
});
