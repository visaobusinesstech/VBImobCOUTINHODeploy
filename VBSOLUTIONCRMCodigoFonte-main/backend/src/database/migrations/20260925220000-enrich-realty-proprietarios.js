"use strict";
/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Campos completos de proprietários (paridade Lovable ProprietarioFormDialog).
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

async function indexExists(queryInterface, table, indexName) {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = :table AND indexname = :indexName LIMIT 1`,
    { replacements: { table, indexName } }
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
      address: { type: T.STRING, allowNull: true },
      city: { type: T.STRING, allowNull: true },
      state: { type: T.STRING, allowNull: true, defaultValue: "DF" },
      zipCode: { type: T.STRING, allowNull: true },
      bank: { type: T.STRING, allowNull: true },
      agency: { type: T.STRING, allowNull: true },
      account: { type: T.STRING, allowNull: true },
      pix: { type: T.STRING, allowNull: true },
      tipo: { type: T.STRING, allowNull: false, defaultValue: "ambos" },
      estadoCivil: { type: T.STRING, allowNull: true },
      canalOrigem: { type: T.STRING, allowNull: true },
      conjugeNome: { type: T.STRING, allowNull: true },
      conjugeCpf: { type: T.STRING, allowNull: true },
      conjugeDataNascimento: { type: T.DATEONLY, allowNull: true },
      dataNascimento: { type: T.DATEONLY, allowNull: true },
      dataCasamento: { type: T.DATEONLY, allowNull: true },
      dataCompraImovel: { type: T.DATEONLY, allowNull: true },
      contratoAdministracao: { type: T.BOOLEAN, allowNull: false, defaultValue: false },
      comissaoAcordada: { type: T.DECIMAL(5, 2), allowNull: true, defaultValue: 0 },
      exclusividade: { type: T.BOOLEAN, allowNull: false, defaultValue: false },
      exclusividadeInicio: { type: T.DATEONLY, allowNull: true },
      exclusividadeFim: { type: T.DATEONLY, allowNull: true },
      exclusividadeContratoUrl: { type: T.TEXT, allowNull: true },
      saldoDevedor: { type: T.BOOLEAN, allowNull: false, defaultValue: false },
      parcelaAtrasoFinanciamento: { type: T.BOOLEAN, allowNull: false, defaultValue: false },
      parcelaAtrasoCondominio: { type: T.BOOLEAN, allowNull: false, defaultValue: false },
      parcelaAtrasoIptu: { type: T.BOOLEAN, allowNull: false, defaultValue: false },
      quitado: { type: T.BOOLEAN, allowNull: false, defaultValue: false },
      averbacao: { type: T.BOOLEAN, allowNull: false, defaultValue: false },
      dadosImovelEndereco: { type: T.STRING, allowNull: true },
      dadosImovelTipo: { type: T.STRING, allowNull: true },
      dadosImovelArea: { type: T.DECIMAL(10, 2), allowNull: true, defaultValue: 0 },
      inscricaoIptu: { type: T.STRING, allowNull: true },
      matricula: { type: T.STRING, allowNull: true },
      certidaoOnusUrl: { type: T.TEXT, allowNull: true }
    };

    for (const [col, def] of Object.entries(cols)) {
      await addColumnIfMissing(queryInterface, "realty_proprietarios", col, def);
    }

    // Backfill tipo for any null rows (safety if column existed without default)
    if (await columnExists(queryInterface, "realty_proprietarios", "tipo")) {
      await queryInterface.sequelize.query(
        `UPDATE "realty_proprietarios" SET "tipo" = 'ambos' WHERE "tipo" IS NULL`
      );
    }

    if (!(await tableExists(queryInterface, "realty_proprietario_familiares"))) {
      await queryInterface.createTable("realty_proprietario_familiares", {
        id: { type: T.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
        nome: { type: T.STRING, allowNull: false },
        dataNascimento: { type: T.DATEONLY, allowNull: true },
        relacao: { type: T.STRING, allowNull: true, defaultValue: "filho" },
        proprietarioId: { type: T.INTEGER, allowNull: false },
        companyId: { type: T.INTEGER, allowNull: false },
        createdAt: { type: T.DATE, allowNull: false },
        updatedAt: { type: T.DATE, allowNull: false }
      });
    }

    if (
      (await tableExists(queryInterface, "realty_proprietario_familiares")) &&
      !(await indexExists(queryInterface, "realty_proprietario_familiares", "realty_proprietario_familiares_proprietario_id"))
    ) {
      await queryInterface.addIndex("realty_proprietario_familiares", ["proprietarioId"], {
        name: "realty_proprietario_familiares_proprietario_id"
      });
    }

    if (
      (await tableExists(queryInterface, "realty_proprietario_familiares")) &&
      !(await indexExists(queryInterface, "realty_proprietario_familiares", "realty_proprietario_familiares_company_id"))
    ) {
      await queryInterface.addIndex("realty_proprietario_familiares", ["companyId"], {
        name: "realty_proprietario_familiares_company_id"
      });
    }
  },

  down: async (queryInterface) => {
    if (await tableExists(queryInterface, "realty_proprietario_familiares")) {
      await queryInterface.dropTable("realty_proprietario_familiares");
    }
    const cols = [
      "address",
      "city",
      "state",
      "zipCode",
      "bank",
      "agency",
      "account",
      "pix",
      "tipo",
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
    ];
    for (const col of cols) {
      if (
        (await tableExists(queryInterface, "realty_proprietarios")) &&
        (await columnExists(queryInterface, "realty_proprietarios", col))
      ) {
        await queryInterface.removeColumn("realty_proprietarios", col);
      }
    }
  }
};
