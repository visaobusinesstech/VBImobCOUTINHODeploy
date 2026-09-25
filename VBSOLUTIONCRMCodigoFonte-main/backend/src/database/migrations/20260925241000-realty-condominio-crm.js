"use strict";
/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * CRM Condomínios — iniciativas + contatos (paridade Lovable condominio_*).
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
    `SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = :indexName LIMIT 1`,
    { replacements: { indexName } }
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function ensureIndex(queryInterface, table, columns, name) {
  if (await indexExists(queryInterface, name)) return;
  await queryInterface.addIndex(table, columns, { name });
}

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const T = Sequelize;

    if (!(await tableExists(queryInterface, "realty_condominio_iniciativas"))) {
      await queryInterface.createTable("realty_condominio_iniciativas", {
        id: { type: T.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
        companyId: { type: T.INTEGER, allowNull: false },
        condominioNome: { type: T.STRING(255), allowNull: false },
        bairro: { type: T.STRING(160), allowNull: true },
        cep: { type: T.STRING(20), allowNull: true },
        canal: { type: T.STRING(40), allowNull: false },
        titulo: { type: T.STRING(255), allowNull: false },
        descricao: { type: T.TEXT, allowNull: true },
        status: { type: T.STRING(40), allowNull: false, defaultValue: "planejado" },
        responsavel: { type: T.STRING(160), allowNull: true },
        dataAgendada: { type: T.DATE, allowNull: true },
        dataConclusao: { type: T.DATE, allowNull: true },
        resultado: { type: T.TEXT, allowNull: true },
        metadata: { type: T.JSONB, allowNull: false, defaultValue: {} },
        createdBy: { type: T.INTEGER, allowNull: true },
        createdAt: { type: T.DATE, allowNull: false },
        updatedAt: { type: T.DATE, allowNull: false }
      });
    }

    await ensureIndex(queryInterface, "realty_condominio_iniciativas", ["companyId"], "realty_condo_inic_company_idx");
    await ensureIndex(
      queryInterface,
      "realty_condominio_iniciativas",
      ["companyId", "condominioNome"],
      "realty_condo_inic_company_nome_idx"
    );
    await ensureIndex(queryInterface, "realty_condominio_iniciativas", ["status"], "realty_condo_inic_status_idx");
    await ensureIndex(queryInterface, "realty_condominio_iniciativas", ["canal"], "realty_condo_inic_canal_idx");

    if (!(await tableExists(queryInterface, "realty_condominio_iniciativa_logs"))) {
      await queryInterface.createTable("realty_condominio_iniciativa_logs", {
        id: { type: T.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
        companyId: { type: T.INTEGER, allowNull: false },
        iniciativaId: { type: T.INTEGER, allowNull: false },
        tipo: { type: T.STRING(40), allowNull: false },
        conteudo: { type: T.TEXT, allowNull: false },
        autor: { type: T.STRING(160), allowNull: true },
        metadata: { type: T.JSONB, allowNull: false, defaultValue: {} },
        createdAt: { type: T.DATE, allowNull: false },
        updatedAt: { type: T.DATE, allowNull: false }
      });
    }

    await ensureIndex(
      queryInterface,
      "realty_condominio_iniciativa_logs",
      ["iniciativaId", "createdAt"],
      "realty_condo_inic_log_inic_idx"
    );
    await ensureIndex(
      queryInterface,
      "realty_condominio_iniciativa_logs",
      ["companyId"],
      "realty_condo_inic_log_company_idx"
    );

    if (!(await tableExists(queryInterface, "realty_condominio_contatos"))) {
      await queryInterface.createTable("realty_condominio_contatos", {
        id: { type: T.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
        companyId: { type: T.INTEGER, allowNull: false },
        condominioNome: { type: T.STRING(255), allowNull: false },
        tipo: { type: T.STRING(40), allowNull: false },
        nome: { type: T.STRING(160), allowNull: true },
        cargo: { type: T.STRING(120), allowNull: true },
        telefone: { type: T.STRING(40), allowNull: true },
        email: { type: T.STRING(160), allowNull: true },
        urlFonte: { type: T.STRING(500), allowNull: false, defaultValue: "manual" },
        trechoFonte: { type: T.TEXT, allowNull: true },
        confianca: { type: T.INTEGER, allowNull: false, defaultValue: 50 },
        status: { type: T.STRING(40), allowNull: false, defaultValue: "pendente" },
        metadata: { type: T.JSONB, allowNull: false, defaultValue: {} },
        createdAt: { type: T.DATE, allowNull: false },
        updatedAt: { type: T.DATE, allowNull: false }
      });
    }

    await ensureIndex(queryInterface, "realty_condominio_contatos", ["companyId"], "realty_condo_ct_company_idx");
    await ensureIndex(
      queryInterface,
      "realty_condominio_contatos",
      ["companyId", "condominioNome"],
      "realty_condo_ct_company_nome_idx"
    );
    await ensureIndex(queryInterface, "realty_condominio_contatos", ["tipo"], "realty_condo_ct_tipo_idx");
  },

  down: async (queryInterface) => {
    if (await tableExists(queryInterface, "realty_condominio_iniciativa_logs")) {
      await queryInterface.dropTable("realty_condominio_iniciativa_logs");
    }
    if (await tableExists(queryInterface, "realty_condominio_contatos")) {
      await queryInterface.dropTable("realty_condominio_contatos");
    }
    if (await tableExists(queryInterface, "realty_condominio_iniciativas")) {
      await queryInterface.dropTable("realty_condominio_iniciativas");
    }
  }
};
