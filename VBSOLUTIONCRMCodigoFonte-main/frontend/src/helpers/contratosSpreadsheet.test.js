/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 */

import { buildContratoExportRows, parseContratoText } from "./contratosSpreadsheet";

describe("contratosSpreadsheet", () => {
  it("importa contratos a partir de CSV com cabeçalhos exportados", () => {
    const csv = [
      "Título;Cliente;Tipo;Status;Valor;Comissão %;Comissão R$;Início;Fim;Proprietário;Canal Origem",
      "Contrato Centro;João Silva;Locação;Ativo;3500,00;10;350,00;01/04/2026;31/03/2027;Maria Souza;Instagram",
    ].join("\n");

    const { items, errors } = parseContratoText(csv);

    expect(errors).toEqual([]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      title: "Contrato Centro",
      cliente: "João Silva",
      tipo: "Locação",
      status: "ativo",
      value: 3500,
      comissaoPercentual: 10,
      comissaoValor: 350,
      startDate: "2026-04-01",
      endDate: "2027-03-31",
      proprietario: "Maria Souza",
      canalOrigem: "instagram",
    });
  });

  it("gera linhas de exportação compatíveis com reimportação", () => {
    const contrato = {
      id: 1,
      companyId: 1,
      title: "Contrato Jardins",
      cliente: "Cliente Teste",
      clienteTelefone: "",
      clienteCpf: "",
      clienteEmail: "",
      tipo: "Venda",
      value: 820000,
      status: "rascunho",
      startDate: "2026-05-10",
      endDate: null,
      imovelId: null,
      corretorId: null,
      inquilino: null,
      proprietario: "Maria",
      notes: "teste",
      matricula: "123",
      canalOrigem: "instagram",
      comissaoPercentual: 6,
      comissaoValor: 49200,
      corretorNome: "Ana",
      corretorComissaoValor: 10000,
      numeroUnidade: "1201",
    };

    const [row] = buildContratoExportRows([contrato]);

    expect(row).toMatchObject({
      title: "Contrato Jardins",
      status: "Rascunho",
      canalOrigem: "Instagram",
      comissaoValor: 49200,
      corretorNome: "Ana",
      value: 820000,
    });
  });
});
