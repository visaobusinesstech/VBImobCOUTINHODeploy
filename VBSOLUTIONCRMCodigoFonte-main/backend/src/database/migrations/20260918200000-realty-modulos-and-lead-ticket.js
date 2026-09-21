"use strict";

async function tableExists(qi, table) {
  const [rows] = await qi.sequelize.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=:table LIMIT 1`,
    { replacements: { table } }
  );
  return Array.isArray(rows) && rows.length > 0;
}
async function columnExists(qi, table, column) {
  const [rows] = await qi.sequelize.query(
    `SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=:table AND column_name=:column LIMIT 1`,
    { replacements: { table, column } }
  );
  return Array.isArray(rows) && rows.length > 0;
}

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const T = Sequelize;
    if (!(await tableExists(queryInterface, "realty_modulos"))) {
      await queryInterface.createTable("realty_modulos", {
        id: { type: T.INTEGER, autoIncrement: true, primaryKey: true },
        kind: { type: T.STRING, allowNull: false },
        title: { type: T.STRING, allowNull: false },
        status: { type: T.STRING, allowNull: true },
        notes: { type: T.TEXT, allowNull: true },
        value: { type: T.DECIMAL(14, 2), allowNull: true },
        dueDate: { type: T.DATE, allowNull: true },
        payload: { type: T.JSONB, allowNull: true },
        companyId: { type: T.INTEGER, allowNull: false },
        createdAt: { type: T.DATE, allowNull: false },
        updatedAt: { type: T.DATE, allowNull: false }
      });
    }
    if (
      (await tableExists(queryInterface, "leads_sales")) &&
      !(await columnExists(queryInterface, "leads_sales", "ticketId"))
    ) {
      await queryInterface.addColumn("leads_sales", "ticketId", {
        type: T.INTEGER,
        allowNull: true
      });
    }
  },
  down: async (queryInterface) => {
    if (await tableExists(queryInterface, "realty_modulos")) {
      await queryInterface.dropTable("realty_modulos");
    }
    if (await columnExists(queryInterface, "leads_sales", "ticketId")) {
      await queryInterface.removeColumn("leads_sales", "ticketId");
    }
  }
};
