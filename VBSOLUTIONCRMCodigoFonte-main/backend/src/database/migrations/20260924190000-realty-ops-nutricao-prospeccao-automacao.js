"use strict";
/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Contratos↔proposta + tabelas nutrição / prospecção / automação / fila.
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

    await addColumnIfMissing(queryInterface, "realty_contratos", "propostaId", {
      type: T.INTEGER,
      allowNull: true
    });

    if (!(await tableExists(queryInterface, "realty_nutricao"))) {
      await queryInterface.createTable("realty_nutricao", {
        id: { type: T.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
        title: { type: T.STRING, allowNull: false },
        leadSaleId: { type: T.INTEGER, allowNull: true },
        cadenceDays: { type: T.INTEGER, allowNull: true, defaultValue: 7 },
        nextSendAt: { type: T.DATE, allowNull: true },
        channel: { type: T.STRING, allowNull: true, defaultValue: "whatsapp" },
        messageTemplate: { type: T.TEXT, allowNull: true },
        status: { type: T.STRING, allowNull: true, defaultValue: "ativo" },
        notes: { type: T.TEXT, allowNull: true },
        userId: { type: T.INTEGER, allowNull: true },
        companyId: { type: T.INTEGER, allowNull: false },
        createdAt: { type: T.DATE, allowNull: false },
        updatedAt: { type: T.DATE, allowNull: false }
      });
    }

    if (!(await tableExists(queryInterface, "realty_prospeccao"))) {
      await queryInterface.createTable("realty_prospeccao", {
        id: { type: T.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
        title: { type: T.STRING, allowNull: false },
        prospectDate: { type: T.DATEONLY, allowNull: true },
        leadSaleId: { type: T.INTEGER, allowNull: true },
        phone: { type: T.STRING, allowNull: true },
        targetCount: { type: T.INTEGER, allowNull: true, defaultValue: 1 },
        doneCount: { type: T.INTEGER, allowNull: true, defaultValue: 0 },
        status: { type: T.STRING, allowNull: true, defaultValue: "pendente" },
        notes: { type: T.TEXT, allowNull: true },
        userId: { type: T.INTEGER, allowNull: true },
        ticketId: { type: T.INTEGER, allowNull: true },
        companyId: { type: T.INTEGER, allowNull: false },
        createdAt: { type: T.DATE, allowNull: false },
        updatedAt: { type: T.DATE, allowNull: false }
      });
    }

    if (!(await tableExists(queryInterface, "realty_automacao_followup"))) {
      await queryInterface.createTable("realty_automacao_followup", {
        id: { type: T.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
        title: { type: T.STRING, allowNull: false },
        trigger: { type: T.STRING, allowNull: false, defaultValue: "sem_resposta" },
        daysWithoutContact: { type: T.INTEGER, allowNull: true, defaultValue: 3 },
        fromStatus: { type: T.STRING, allowNull: true },
        toStatus: { type: T.STRING, allowNull: true },
        action: { type: T.STRING, allowNull: true, defaultValue: "criar_followup" },
        messageTemplate: { type: T.TEXT, allowNull: true },
        active: { type: T.BOOLEAN, allowNull: true, defaultValue: true },
        notes: { type: T.TEXT, allowNull: true },
        companyId: { type: T.INTEGER, allowNull: false },
        createdAt: { type: T.DATE, allowNull: false },
        updatedAt: { type: T.DATE, allowNull: false }
      });
    }

    if (!(await tableExists(queryInterface, "realty_fila_config"))) {
      await queryInterface.createTable("realty_fila_config", {
        id: { type: T.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
        strategy: { type: T.STRING, allowNull: true, defaultValue: "round_robin" },
        lastUserId: { type: T.INTEGER, allowNull: true },
        userIds: { type: T.JSONB, allowNull: true },
        active: { type: T.BOOLEAN, allowNull: true, defaultValue: true },
        notes: { type: T.TEXT, allowNull: true },
        companyId: { type: T.INTEGER, allowNull: false },
        createdAt: { type: T.DATE, allowNull: false },
        updatedAt: { type: T.DATE, allowNull: false }
      });
    }
  },

  down: async (queryInterface) => {
    try { await queryInterface.removeColumn("realty_contratos", "propostaId"); } catch (_) {}
    await queryInterface.dropTable("realty_fila_config").catch(() => {});
    await queryInterface.dropTable("realty_automacao_followup").catch(() => {});
    await queryInterface.dropTable("realty_prospeccao").catch(() => {});
    await queryInterface.dropTable("realty_nutricao").catch(() => {});
  }
};
