import {
  extractIndicadoPor,
  stripIndicadoPor,
  buildObservacoes,
  isCaptacaoSubmittable,
  computeCaptacaoKpis,
  CAPTACAO_TIPOS,
  CAPTACAO_STATUS_OPTIONS,
  CAPTACAO_TIPOS_IMOVEL,
  CAPTACAO_OPERACOES,
  buildCaptacaoSavePayload,
  captacaoRecordToForm,
  rankCaptacaoByOperacao,
} from "./captacaoIndicacao";

describe("captacaoIndicacao – campo Indicado por", () => {
  describe("extractIndicadoPor", () => {
    it("retorna o nome quando observacoes começa com Indicado por:", () => {
      expect(extractIndicadoPor("Indicado por: João Silva")).toBe("João Silva");
    });
    it("ignora linhas adicionais após o nome", () => {
      expect(extractIndicadoPor("Indicado por: Maria\nCliente premium")).toBe("Maria");
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
    it("remove a linha Indicado por preservando o restante", () => {
      expect(stripIndicadoPor("Indicado por: Pedro\nrestante da observação")).toBe(
        "restante da observação"
      );
    });
    it("não altera observações sem marcação", () => {
      expect(stripIndicadoPor("nota qualquer")).toBe("nota qualquer");
    });
  });

  describe("buildObservacoes", () => {
    it("prefixa Indicado por: quando tipo = indicacao", () => {
      expect(buildObservacoes("indicacao", "Carlos", "lead quente")).toBe(
        "Indicado por: Carlos\nlead quente"
      );
    });
    it("aceita apenas o nome sem observação adicional", () => {
      expect(buildObservacoes("indicacao", "Carlos", "")).toBe("Indicado por: Carlos");
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
      expect(isCaptacaoSubmittable({ tipo: "porteiro", nome: "  " })).toBe(false);
    });
    it("exige Indicado por quando tipo = indicacao", () => {
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
      expect(isCaptacaoSubmittable({ tipo: "porteiro", nome: "Lead" })).toBe(true);
    });
  });

  describe("persistência ↔ exibição", () => {
    it("roundtrip: o que é salvo via buildObservacoes é extraído de volta", () => {
      const persisted = buildObservacoes("indicacao", "Fernanda", "Procura cobertura");
      expect(persisted).not.toBeNull();
      expect(extractIndicadoPor(persisted)).toBe("Fernanda");
      expect(stripIndicadoPor(persisted)).toBe("Procura cobertura");
    });
  });

  describe("computeCaptacaoKpis", () => {
    const sample = [
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

    it("retorna zeros para lista vazia", () => {
      expect(computeCaptacaoKpis([])).toEqual({
        total: 0,
        pendentes: 0,
        andamento: 0,
        concluidas: 0,
        indicacoes: 0,
        taxa: 0,
      });
    });
  });

  describe("constantes de paridade Lovable", () => {
    it("tem os 5 canais com labels", () => {
      expect(CAPTACAO_TIPOS.map((t) => t.id)).toEqual([
        "porteiro",
        "construtor",
        "construtora",
        "sindico",
        "indicacao",
      ]);
      expect(CAPTACAO_TIPOS.map((t) => t.label)).toEqual([
        "Porteiro",
        "Construtor",
        "Construtora",
        "Síndico",
        "Indicação",
      ]);
    });
    it("tem os 4 status", () => {
      expect(CAPTACAO_STATUS_OPTIONS.map((s) => s.id)).toEqual([
        "pendente",
        "em_andamento",
        "concluida",
        "cancelada",
      ]);
    });
    it("tem 16 tipos de imóvel e operações Venda/Locação", () => {
      expect(CAPTACAO_TIPOS_IMOVEL).toEqual([
        "Apartamento",
        "Casa",
        "Terreno",
        "Comercial",
        "Cobertura",
        "Kitnet",
        "Galpão",
        "Sala Comercial",
        "Loja",
        "Flat",
        "Sobrado",
        "Chácara",
        "Fazenda",
        "Ponto Comercial",
        "Prédio",
        "Conjunto de Salas",
      ]);
      expect(CAPTACAO_OPERACOES).toEqual(["Venda", "Locação"]);
    });
  });

  describe("buildCaptacaoSavePayload – mapeamento Lovable", () => {
    const baseForm = {
      tipo: "porteiro",
      nomeContato: "  João  ",
      telefoneContato: "(61) 99999-0000",
      emailContato: "a@b.com",
      cep: "70000-000",
      enderecoImovel: "SQN 100",
      bairro: "Asa Norte",
      cidade: "Brasília",
      estado: "DF",
      tipoImovel: "Apartamento",
      operacao: "Venda",
      nomeConstrutora: "",
      nomeCondominio: "",
      indicadoPor: "",
      aceitaCorretor: true,
      observacoes: "obs livre",
      status: "em_andamento",
    };

    it("não persiste cep nem aceitaCorretor (UI-only)", () => {
      const payload = buildCaptacaoSavePayload(baseForm);
      expect(payload).not.toHaveProperty("cep");
      expect(payload).not.toHaveProperty("aceitaCorretor");
      expect(Object.keys(payload).sort()).toEqual(
        [
          "bairro",
          "cidade",
          "emailContato",
          "enderecoImovel",
          "estado",
          "nomeCondominio",
          "nomeConstrutora",
          "nomeContato",
          "observacoes",
          "operacao",
          "status",
          "telefoneContato",
          "tipo",
          "tipoImovel",
        ].sort()
      );
    });

    it("trim nome e mapeia campos 1:1 com Lovable", () => {
      const payload = buildCaptacaoSavePayload(baseForm);
      expect(payload.nomeContato).toBe("João");
      expect(payload.telefoneContato).toBe("(61) 99999-0000");
      expect(payload.emailContato).toBe("a@b.com");
      expect(payload.enderecoImovel).toBe("SQN 100");
      expect(payload.bairro).toBe("Asa Norte");
      expect(payload.cidade).toBe("Brasília");
      expect(payload.estado).toBe("DF");
      expect(payload.tipoImovel).toBe("Apartamento");
      expect(payload.operacao).toBe("Venda");
      expect(payload.status).toBe("em_andamento");
      expect(payload.observacoes).toBe("obs livre");
      expect(payload.nomeConstrutora).toBeNull();
      expect(payload.nomeCondominio).toBeNull();
    });

    it("construtora/construtor envia nomeConstrutora", () => {
      const payload = buildCaptacaoSavePayload({
        ...baseForm,
        tipo: "construtora",
        nomeConstrutora: "MRV",
      });
      expect(payload.tipo).toBe("construtora");
      expect(payload.nomeConstrutora).toBe("MRV");
    });

    it("síndico envia nomeCondominio", () => {
      const payload = buildCaptacaoSavePayload({
        ...baseForm,
        tipo: "sindico",
        nomeCondominio: "Residencial Sol",
      });
      expect(payload.nomeCondominio).toBe("Residencial Sol");
    });

    it("indicação prefixa Indicado por nas observações", () => {
      const payload = buildCaptacaoSavePayload({
        ...baseForm,
        tipo: "indicacao",
        indicadoPor: "Cliente X",
        observacoes: "cobertura",
      });
      expect(payload.observacoes).toBe("Indicado por: Cliente X\ncobertura");
    });

    it("defaults quando campos vazios", () => {
      const payload = buildCaptacaoSavePayload({
        nomeContato: "Lead",
        tipo: "",
      }, "porteiro");
      expect(payload.tipo).toBe("porteiro");
      expect(payload.tipoImovel).toBe("Apartamento");
      expect(payload.operacao).toBe("Venda");
      expect(payload.status).toBe("pendente");
      expect(payload.estado).toBe("SP");
      expect(payload.telefoneContato).toBeNull();
      expect(payload.observacoes).toBeNull();
    });
  });

  describe("captacaoRecordToForm + roundtrip", () => {
    it("hidrata formulário e reconstrói payload equivalente", () => {
      const record = {
        tipo: "indicacao",
        nomeContato: "Lead",
        telefoneContato: "1199",
        emailContato: null,
        enderecoImovel: "Rua A",
        bairro: "Centro",
        cidade: "SP",
        estado: "SP",
        tipoImovel: "Casa",
        operacao: "Locação",
        nomeConstrutora: null,
        nomeCondominio: null,
        observacoes: "Indicado por: Ana\nDetalhe",
        status: "pendente",
      };
      const form = captacaoRecordToForm(record);
      expect(form.indicadoPor).toBe("Ana");
      expect(form.observacoes).toBe("Detalhe");
      expect(form.cep).toBe("");
      expect(form.aceitaCorretor).toBe(false);
      const payload = buildCaptacaoSavePayload(form);
      expect(payload.observacoes).toBe("Indicado por: Ana\nDetalhe");
      expect(payload.operacao).toBe("Locação");
      expect(payload.tipoImovel).toBe("Casa");
    });
  });

  describe("rankCaptacaoByOperacao", () => {
    const sample = [
      { tipo: "porteiro", operacao: "Venda" },
      { tipo: "porteiro", operacao: "Venda" },
      { tipo: "sindico", operacao: "Locação" },
      { tipo: "sindico", operacao: "Aluguel" },
    ];
    it("agrupa venda por canal", () => {
      expect(rankCaptacaoByOperacao(sample, "Venda")).toEqual([
        { canal: "Porteiro", count: 2 },
      ]);
    });
    it("trata Aluguel como alias de Locação", () => {
      expect(rankCaptacaoByOperacao(sample, "Locação")).toEqual([
        { canal: "Síndico", count: 2 },
      ]);
    });
  });
});
