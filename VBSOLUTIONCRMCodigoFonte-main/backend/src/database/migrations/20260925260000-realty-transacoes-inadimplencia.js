"use strict";
/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Transações financeiras + alertas de inadimplência (paridade Lovable).
 */

async function tableExists(queryInterface, table) {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = :table LIMIT 1`,
    { replacements: { table } }
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function indexExists(queryInterface, indexName) {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT 1 FROM pg_indexes WHERE indexname = :name LIMIT 1`,
    { replacements: { name: indexName } }
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function addIndexSafe(queryInterface, table, fields, options) {
  if (await indexExists(queryInterface, options.name)) return;
  await queryInterface.addIndex(table, fields, options);
}

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const T = Sequelize;

    if (!(await tableExists(queryInterface, "realty_transacoes"))) {
      await queryInterface.createTable("realty_transacoes", {
        id: { type: T.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
        companyId: { type: T.INTEGER, allowNull: false },
        descricao: { type: T.STRING(500), allowNull: false, defaultValue: "" },
        tipo: { type: T.STRING(40), allowNull: false, defaultValue: "entrada" },
        categoria: { type: T.STRING(80), allowNull: false, defaultValue: "outros" },
        valor: { type: T.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
        data: { type: T.DATEONLY, allowNull: false },
        status: { type: T.STRING(40), allowNull: false, defaultValue: "pendente" },
        imovelId: { type: T.INTEGER, allowNull: true },
        contratoId: { type: T.INTEGER, allowNull: true },
        corretorId: { type: T.INTEGER, allowNull: true },
        observacoes: { type: T.TEXT, allowNull: true },
        canalOrigem: { type: T.STRING(120), allowNull: true },
        recorrencia: { type: T.STRING(40), allowNull: true },
        corretorNome: { type: T.STRING(200), allowNull: true },
        parceiroNome: { type: T.STRING(200), allowNull: true },
        captadorNome: { type: T.STRING(200), allowNull: true },
        comissaoPercentual: { type: T.DECIMAL(8, 2), allowNull: true },
        comissaoValor: { type: T.DECIMAL(14, 2), allowNull: true },
        dataRecebimento: { type: T.DATEONLY, allowNull: true },
        numeroUnidade: { type: T.STRING(80), allowNull: true },
        proprietarioNome: { type: T.STRING(200), allowNull: true },
        createdAt: { type: T.DATE, allowNull: false },
        updatedAt: { type: T.DATE, allowNull: false }
      });
    }

    await addIndexSafe(queryInterface, "realty_transacoes", ["companyId"], {
      name: "realty_transacoes_company_idx"
    });
    await addIndexSafe(queryInterface, "realty_transacoes", ["companyId", "data"], {
      name: "realty_transacoes_company_data_idx"
    });
    await addIndexSafe(
      queryInterface,
      "realty_transacoes",
      ["companyId", "categoria", "status"],
      { name: "realty_transacoes_company_cat_status_idx" }
    );

    if (!(await tableExists(queryInterface, "realty_inadimplencia_alertas"))) {
      await queryInterface.createTable("realty_inadimplencia_alertas", {
        id: { type: T.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
        companyId: { type: T.INTEGER, allowNull: false },
        contratoId: { type: T.INTEGER, allowNull: true },
        titulo: { type: T.STRING(300), allowNull: false },
        description: { type: T.TEXT, allowNull: true },
        diasAtraso: { type: T.INTEGER, allowNull: false, defaultValue: 0 },
        gravidade: { type: T.STRING(40), allowNull: true },
        createdAt: { type: T.DATE, allowNull: false },
        updatedAt: { type: T.DATE, allowNull: false }
      });
    }

    await addIndexSafe(
      queryInterface,
      "realty_inadimplencia_alertas",
      ["companyId", "createdAt"],
      { name: "realty_inadimplencia_alertas_company_created_idx" }
    );
  },

  down: async (queryInterface) => {
    if (await tableExists(queryInterface, "realty_inadimplencia_alertas")) {
      await queryInterface.dropTable("realty_inadimplencia_alertas");
    }
    if (await tableExists(queryInterface, "realty_transacoes")) {
      await queryInterface.dropTable("realty_transacoes");
    }
  }
};
