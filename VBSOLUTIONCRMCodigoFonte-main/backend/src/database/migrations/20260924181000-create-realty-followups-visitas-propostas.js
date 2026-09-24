"use strict";
/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * First-class followups, visitas, propostas, lead-imovel envios.
 */

async function tableExists(queryInterface, table) {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = :table LIMIT 1`,
    { replacements: { table } }
  );
  return Array.isArray(rows) && rows.length > 0;
}

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const T = Sequelize;

    if (!(await tableExists(queryInterface, "realty_followups"))) {
      await queryInterface.createTable("realty_followups", {
        id: { type: T.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
        type: { type: T.STRING, allowNull: true, defaultValue: "whatsapp" },
        scheduledAt: { type: T.DATE, allowNull: false },
        completedAt: { type: T.DATE, allowNull: true },
        result: { type: T.STRING, allowNull: true },
        notes: { type: T.TEXT, allowNull: true },
        status: { type: T.STRING, allowNull: true, defaultValue: "pendente" },
        leadSaleId: { type: T.INTEGER, allowNull: false },
        userId: { type: T.INTEGER, allowNull: true },
        ticketId: { type: T.INTEGER, allowNull: true },
        companyId: { type: T.INTEGER, allowNull: false },
        createdAt: { type: T.DATE, allowNull: false },
        updatedAt: { type: T.DATE, allowNull: false }
      });
      await queryInterface.sequelize.query(
        `CREATE INDEX IF NOT EXISTS realty_followups_lead_idx ON realty_followups ("leadSaleId")`
      );
      await queryInterface.sequelize.query(
        `CREATE INDEX IF NOT EXISTS realty_followups_scheduled_idx ON realty_followups ("scheduledAt")`
      );
    }

    if (!(await tableExists(queryInterface, "realty_visitas"))) {
      await queryInterface.createTable("realty_visitas", {
        id: { type: T.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
        scheduledAt: { type: T.DATE, allowNull: false },
        status: { type: T.STRING, allowNull: true, defaultValue: "agendada" },
        result: { type: T.STRING, allowNull: true },
        notes: { type: T.TEXT, allowNull: true },
        location: { type: T.STRING, allowNull: true },
        leadSaleId: { type: T.INTEGER, allowNull: false },
        imovelId: { type: T.INTEGER, allowNull: true },
        userId: { type: T.INTEGER, allowNull: true },
        ticketId: { type: T.INTEGER, allowNull: true },
        companyId: { type: T.INTEGER, allowNull: false },
        createdAt: { type: T.DATE, allowNull: false },
        updatedAt: { type: T.DATE, allowNull: false }
      });
      await queryInterface.sequelize.query(
        `CREATE INDEX IF NOT EXISTS realty_visitas_lead_idx ON realty_visitas ("leadSaleId")`
      );
      await queryInterface.sequelize.query(
        `CREATE INDEX IF NOT EXISTS realty_visitas_scheduled_idx ON realty_visitas ("scheduledAt")`
      );
    }

    if (!(await tableExists(queryInterface, "realty_propostas"))) {
      await queryInterface.createTable("realty_propostas", {
        id: { type: T.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
        title: { type: T.STRING, allowNull: true },
        value: { type: T.DECIMAL(14, 2), allowNull: true },
        paymentMethod: { type: T.STRING, allowNull: true },
        downPayment: { type: T.DECIMAL(14, 2), allowNull: true },
        financing: { type: T.BOOLEAN, allowNull: true, defaultValue: false },
        conditions: { type: T.TEXT, allowNull: true },
        status: { type: T.STRING, allowNull: true, defaultValue: "rascunho" },
        validUntil: { type: T.DATE, allowNull: true },
        notes: { type: T.TEXT, allowNull: true },
        leadSaleId: { type: T.INTEGER, allowNull: false },
        imovelId: { type: T.INTEGER, allowNull: true },
        userId: { type: T.INTEGER, allowNull: true },
        ticketId: { type: T.INTEGER, allowNull: true },
        companyId: { type: T.INTEGER, allowNull: false },
        createdAt: { type: T.DATE, allowNull: false },
        updatedAt: { type: T.DATE, allowNull: false }
      });
      await queryInterface.sequelize.query(
        `CREATE INDEX IF NOT EXISTS realty_propostas_lead_idx ON realty_propostas ("leadSaleId")`
      );
    }

    if (!(await tableExists(queryInterface, "realty_lead_imovel_envios"))) {
      await queryInterface.createTable("realty_lead_imovel_envios", {
        id: { type: T.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
        leadSaleId: { type: T.INTEGER, allowNull: false },
        imovelId: { type: T.INTEGER, allowNull: false },
        ticketId: { type: T.INTEGER, allowNull: true },
        score: { type: T.INTEGER, allowNull: true },
        messageBody: { type: T.TEXT, allowNull: true },
        sentAt: { type: T.DATE, allowNull: false },
        userId: { type: T.INTEGER, allowNull: true },
        companyId: { type: T.INTEGER, allowNull: false },
        createdAt: { type: T.DATE, allowNull: false },
        updatedAt: { type: T.DATE, allowNull: false }
      });
      await queryInterface.sequelize.query(
        `CREATE INDEX IF NOT EXISTS realty_envios_lead_idx ON realty_lead_imovel_envios ("leadSaleId")`
      );
    }
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("realty_lead_imovel_envios").catch(() => {});
    await queryInterface.dropTable("realty_propostas").catch(() => {});
    await queryInterface.dropTable("realty_visitas").catch(() => {});
    await queryInterface.dropTable("realty_followups").catch(() => {});
  }
};
