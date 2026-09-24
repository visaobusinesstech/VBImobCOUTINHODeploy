"use strict";
/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Enrich leads_sales + realty_imoveis for integrated realty CRM.
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

    const leadCols = {
      temperature: { type: T.STRING, allowNull: true },
      purpose: { type: T.STRING, allowNull: true },
      priceMin: { type: T.DECIMAL(14, 2), allowNull: true },
      priceMax: { type: T.DECIMAL(14, 2), allowNull: true },
      paymentMethod: { type: T.STRING, allowNull: true },
      downPayment: { type: T.DECIMAL(14, 2), allowNull: true },
      financing: { type: T.BOOLEAN, allowNull: true, defaultValue: false },
      parkingSpots: { type: T.INTEGER, allowNull: true },
      suitesDesired: { type: T.INTEGER, allowNull: true },
      featuresDesired: { type: T.TEXT, allowNull: true },
      lostReason: { type: T.TEXT, allowNull: true },
      nextContactAt: { type: T.DATE, allowNull: true }
    };
    for (const [col, def] of Object.entries(leadCols)) {
      await addColumnIfMissing(queryInterface, "leads_sales", col, def);
    }

    const imovelCols = {
      code: { type: T.STRING, allowNull: true },
      purpose: { type: T.STRING, allowNull: true },
      condoFee: { type: T.DECIMAL(14, 2), allowNull: true },
      iptu: { type: T.DECIMAL(14, 2), allowNull: true },
      state: { type: T.STRING, allowNull: true },
      zipCode: { type: T.STRING, allowNull: true },
      suites: { type: T.INTEGER, allowNull: true },
      parkingSpots: { type: T.INTEGER, allowNull: true },
      userId: { type: T.INTEGER, allowNull: true },
      videoUrl: { type: T.STRING, allowNull: true }
    };
    for (const [col, def] of Object.entries(imovelCols)) {
      await addColumnIfMissing(queryInterface, "realty_imoveis", col, def);
    }

    if (await tableExists(queryInterface, "leads_sales")) {
      await queryInterface.sequelize.query(
        `CREATE INDEX IF NOT EXISTS leads_sales_follow_up_at_idx ON leads_sales ("followUpAt")`
      );
      await queryInterface.sequelize.query(
        `CREATE INDEX IF NOT EXISTS leads_sales_ticket_id_idx ON leads_sales ("ticketId")`
      );
      await queryInterface.sequelize.query(
        `CREATE INDEX IF NOT EXISTS leads_sales_next_contact_at_idx ON leads_sales ("nextContactAt")`
      );
    }
  },

  down: async (queryInterface) => {
    const leadCols = [
      "temperature", "purpose", "priceMin", "priceMax", "paymentMethod",
      "downPayment", "financing", "parkingSpots", "suitesDesired",
      "featuresDesired", "lostReason", "nextContactAt"
    ];
    for (const col of leadCols) {
      try { await queryInterface.removeColumn("leads_sales", col); } catch (_) {}
    }
    const imovelCols = [
      "code", "purpose", "condoFee", "iptu", "state", "zipCode",
      "suites", "parkingSpots", "userId", "videoUrl"
    ];
    for (const col of imovelCols) {
      try { await queryInterface.removeColumn("realty_imoveis", col); } catch (_) {}
    }
  }
};
