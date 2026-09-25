"use strict";
/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Enrich realty_contratos + child tables (paridade Lovable).
 */

async function tableExists(queryInterface, table) {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = :table LIMIT 1`,
    { replacements: { table } }
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function columnExists(queryInterface, table, column) {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = :table AND column_name = :column LIMIT 1`,
    { replacements: { table, column } }
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function addColumnIfMissing(queryInterface, table, column, definition) {
  if (!(await tableExists(queryInterface, table))) return;
  if (await columnExists(queryInterface, table, column)) return;
  await queryInterface.addColumn(table, column, definition);
}

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const T = Sequelize;

    const cols = {
      cliente: { type: T.STRING, allowNull: true },
      clienteTelefone: { type: T.STRING, allowNull: true },
      clienteCpf: { type: T.STRING, allowNull: true },
      clienteEmail: { type: T.STRING, allowNull: true },
      clienteRg: { type: T.STRING, allowNull: true },
      tipo: { type: T.STRING, allowNull: false, defaultValue: "Venda" },
      inquilino: { type: T.STRING, allowNull: true },
      proprietario: { type: T.STRING, allowNull: true },
      contratoUrl: { type: T.STRING, allowNull: true },
      vistoriaEntrada: { type: T.BOOLEAN, allowNull: false, defaultValue: false },
      vistoriaVideo: { type: T.BOOLEAN, allowNull: false, defaultValue: false },
      apoliceSeguro: { type: T.BOOLEAN, allowNull: false, defaultValue: false },
      matricula: { type: T.STRING, allowNull: true },
      indiceCorrecao: { type: T.STRING, allowNull: true },
      percentualCorrecao: { type: T.DECIMAL(10, 4), allowNull: true },
      dataProximaCorrecao: { type: T.DATEONLY, allowNull: true },
      diaVencimentoAluguel: { type: T.INTEGER, allowNull: true },
      dataVencimentoApolice: { type: T.DATEONLY, allowNull: true },
      tipoGarantia: { type: T.STRING, allowNull: true },
      contratoAnexoUrl: { type: T.STRING, allowNull: true },
      apoliceAnexoUrl: { type: T.STRING, allowNull: true },
      vistoriaAnexoUrl: { type: T.STRING, allowNull: true },
      numeroAgua: { type: T.STRING, allowNull: true },
      numeroLuz: { type: T.STRING, allowNull: true },
      inscricaoIptu: { type: T.STRING, allowNull: true },
      canalOrigem: { type: T.STRING, allowNull: true },
      proprietarioTelefone: { type: T.STRING, allowNull: true },
      proprietarioCpf: { type: T.STRING, allowNull: true },
      proprietarioEmail: { type: T.STRING, allowNull: true },
      proprietarioRg: { type: T.STRING, allowNull: true },
      proprietarioBanco: { type: T.STRING, allowNull: true },
      proprietarioAgencia: { type: T.STRING, allowNull: true },
      proprietarioConta: { type: T.STRING, allowNull: true },
      proprietarioPix: { type: T.STRING, allowNull: true },
      comissaoPercentual: { type: T.DECIMAL(10, 4), allowNull: true },
      comissaoValor: { type: T.DECIMAL(14, 2), allowNull: true },
      comissaoTipo: { type: T.STRING, allowNull: true },
      temParceria: { type: T.BOOLEAN, allowNull: false, defaultValue: false },
      parceiroNome: { type: T.STRING, allowNull: true },
      parceiroComissaoPercentual: { type: T.DECIMAL(10, 4), allowNull: true },
      parceiroComissaoValor: { type: T.DECIMAL(14, 2), allowNull: true },
      captadorNome: { type: T.STRING, allowNull: true },
      captadorTelefone: { type: T.STRING, allowNull: true },
      captadorComissaoPercentual: { type: T.DECIMAL(10, 4), allowNull: true },
      captadorComissaoValor: { type: T.DECIMAL(14, 2), allowNull: true },
      impostoTipo: { type: T.STRING, allowNull: true },
      impostoPercentual: { type: T.DECIMAL(10, 4), allowNull: true },
      impostoValor: { type: T.DECIMAL(14, 2), allowNull: true },
      corretorNome: { type: T.STRING, allowNull: true },
      corretorComissaoPercentual: { type: T.DECIMAL(10, 4), allowNull: true },
      corretorComissaoValor: { type: T.DECIMAL(14, 2), allowNull: true },
      corretorId: { type: T.INTEGER, allowNull: true },
      valorIptu: { type: T.DECIMAL(14, 2), allowNull: true },
      iptuParcelado: { type: T.BOOLEAN, allowNull: false, defaultValue: false },
      valorCondominio: { type: T.DECIMAL(14, 2), allowNull: true },
      condominioInclui: { type: T.STRING, allowNull: true },
      inquilinoTelefone: { type: T.STRING, allowNull: true },
      inquilinoCpf: { type: T.STRING, allowNull: true },
      inquilinoEmail: { type: T.STRING, allowNull: true },
      inquilinoRg: { type: T.STRING, allowNull: true },
      inquilino2Nome: { type: T.STRING, allowNull: true },
      inquilino2Cpf: { type: T.STRING, allowNull: true },
      inquilino2Telefone: { type: T.STRING, allowNull: true },
      inquilino2Email: { type: T.STRING, allowNull: true },
      inquilino2Rg: { type: T.STRING, allowNull: true },
      caucaoValor: { type: T.DECIMAL(14, 2), allowNull: true },
      caucaoQuantidade: { type: T.INTEGER, allowNull: true },
      conjugeProprietario: { type: T.STRING, allowNull: true },
      conjugeCpf: { type: T.STRING, allowNull: true },
      conjugeTelefone: { type: T.STRING, allowNull: true },
      conjugeEmail: { type: T.STRING, allowNull: true },
      aditivoAnexoUrl: { type: T.STRING, allowNull: true },
      seguroIncendioAnexoUrl: { type: T.STRING, allowNull: true },
      seguroFiancaAnexoUrl: { type: T.STRING, allowNull: true },
      fiadorNome: { type: T.STRING, allowNull: true },
      fiadorCpf: { type: T.STRING, allowNull: true },
      fiadorTelefone: { type: T.STRING, allowNull: true },
      fiadorEmail: { type: T.STRING, allowNull: true },
      fiadorEstadoCivil: { type: T.STRING, allowNull: true },
      fiadorEndereco: { type: T.TEXT, allowNull: true },
      fiadorMatriculaUrl: { type: T.STRING, allowNull: true },
      fiadorRendaUrl: { type: T.STRING, allowNull: true },
      fiador2Nome: { type: T.STRING, allowNull: true },
      fiador2Cpf: { type: T.STRING, allowNull: true },
      fiador2Telefone: { type: T.STRING, allowNull: true },
      fiador2Email: { type: T.STRING, allowNull: true },
      fiador2EstadoCivil: { type: T.STRING, allowNull: true },
      fiador2Endereco: { type: T.TEXT, allowNull: true },
      fiador2MatriculaUrl: { type: T.STRING, allowNull: true },
      fiador2RendaUrl: { type: T.STRING, allowNull: true },
      vistoriaVideoUrl: { type: T.STRING, allowNull: true },
      caucaoComprovanteUrl: { type: T.STRING, allowNull: true },
      comprovanteAguaUrl: { type: T.STRING, allowNull: true },
      comprovanteLuzUrl: { type: T.STRING, allowNull: true },
      numeroUnidade: { type: T.STRING, allowNull: true },
      parceriaEnvolvidos: { type: T.JSONB, allowNull: false, defaultValue: [] },
      codigoContrato: { type: T.STRING, allowNull: true }
    };

    for (const [col, def] of Object.entries(cols)) {
      await addColumnIfMissing(queryInterface, "realty_contratos", col, def);
    }

    if (!(await tableExists(queryInterface, "realty_contrato_anexos_anuais"))) {
      await queryInterface.createTable("realty_contrato_anexos_anuais", {
        id: { type: T.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
        companyId: { type: T.INTEGER, allowNull: false },
        contratoId: { type: T.INTEGER, allowNull: false },
        ano: { type: T.INTEGER, allowNull: false },
        tipo: { type: T.STRING, allowNull: true },
        fileUrl: { type: T.STRING, allowNull: true },
        fileName: { type: T.STRING, allowNull: true },
        createdAt: { type: T.DATE, allowNull: false },
        updatedAt: { type: T.DATE, allowNull: false }
      });
    }

    if (!(await tableExists(queryInterface, "realty_contrato_comprovantes_mensais"))) {
      await queryInterface.createTable("realty_contrato_comprovantes_mensais", {
        id: { type: T.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
        companyId: { type: T.INTEGER, allowNull: false },
        contratoId: { type: T.INTEGER, allowNull: false },
        ano: { type: T.INTEGER, allowNull: false },
        mes: { type: T.INTEGER, allowNull: false },
        tipo: { type: T.STRING, allowNull: true },
        fileUrl: { type: T.STRING, allowNull: true },
        fileName: { type: T.STRING, allowNull: true },
        recebido: { type: T.BOOLEAN, allowNull: false, defaultValue: false },
        createdAt: { type: T.DATE, allowNull: false },
        updatedAt: { type: T.DATE, allowNull: false }
      });
    }
  },

  down: async (queryInterface) => {
    if (await tableExists(queryInterface, "realty_contrato_comprovantes_mensais")) {
      await queryInterface.dropTable("realty_contrato_comprovantes_mensais");
    }
    if (await tableExists(queryInterface, "realty_contrato_anexos_anuais")) {
      await queryInterface.dropTable("realty_contrato_anexos_anuais");
    }

    const cols = [
      "cliente",
      "clienteTelefone",
      "clienteCpf",
      "clienteEmail",
      "clienteRg",
      "tipo",
      "inquilino",
      "proprietario",
      "contratoUrl",
      "vistoriaEntrada",
      "vistoriaVideo",
      "apoliceSeguro",
      "matricula",
      "indiceCorrecao",
      "percentualCorrecao",
      "dataProximaCorrecao",
      "diaVencimentoAluguel",
      "dataVencimentoApolice",
      "tipoGarantia",
      "contratoAnexoUrl",
      "apoliceAnexoUrl",
      "vistoriaAnexoUrl",
      "numeroAgua",
      "numeroLuz",
      "inscricaoIptu",
      "canalOrigem",
      "proprietarioTelefone",
      "proprietarioCpf",
      "proprietarioEmail",
      "proprietarioRg",
      "proprietarioBanco",
      "proprietarioAgencia",
      "proprietarioConta",
      "proprietarioPix",
      "comissaoPercentual",
      "comissaoValor",
      "comissaoTipo",
      "temParceria",
      "parceiroNome",
      "parceiroComissaoPercentual",
      "parceiroComissaoValor",
      "captadorNome",
      "captadorTelefone",
      "captadorComissaoPercentual",
      "captadorComissaoValor",
      "impostoTipo",
      "impostoPercentual",
      "impostoValor",
      "corretorNome",
      "corretorComissaoPercentual",
      "corretorComissaoValor",
      "corretorId",
      "valorIptu",
      "iptuParcelado",
      "valorCondominio",
      "condominioInclui",
      "inquilinoTelefone",
      "inquilinoCpf",
      "inquilinoEmail",
      "inquilinoRg",
      "inquilino2Nome",
      "inquilino2Cpf",
      "inquilino2Telefone",
      "inquilino2Email",
      "inquilino2Rg",
      "caucaoValor",
      "caucaoQuantidade",
      "conjugeProprietario",
      "conjugeCpf",
      "conjugeTelefone",
      "conjugeEmail",
      "aditivoAnexoUrl",
      "seguroIncendioAnexoUrl",
      "seguroFiancaAnexoUrl",
      "fiadorNome",
      "fiadorCpf",
      "fiadorTelefone",
      "fiadorEmail",
      "fiadorEstadoCivil",
      "fiadorEndereco",
      "fiadorMatriculaUrl",
      "fiadorRendaUrl",
      "fiador2Nome",
      "fiador2Cpf",
      "fiador2Telefone",
      "fiador2Email",
      "fiador2EstadoCivil",
      "fiador2Endereco",
      "fiador2MatriculaUrl",
      "fiador2RendaUrl",
      "vistoriaVideoUrl",
      "caucaoComprovanteUrl",
      "comprovanteAguaUrl",
      "comprovanteLuzUrl",
      "numeroUnidade",
      "parceriaEnvolvidos",
      "codigoContrato"
    ];

    for (const col of cols) {
      if (
        (await tableExists(queryInterface, "realty_contratos")) &&
        (await columnExists(queryInterface, "realty_contratos", col))
      ) {
        await queryInterface.removeColumn("realty_contratos", col);
      }
    }
  }
};
