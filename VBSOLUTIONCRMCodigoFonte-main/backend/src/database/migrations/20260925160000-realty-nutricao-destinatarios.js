"use strict";
/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Destinatários manuais (contatos/leads) nos fluxos de nutrição.
 */

async function columnExists(queryInterface, table, column) {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = :table AND column_name = :column LIMIT 1`,
    { replacements: { table, column } }
  );
  return Array.isArray(rows) && rows.length > 0;
}

module.exports = {
  up: async (queryInterface, Sequelize) => {
    if (!(await columnExists(queryInterface, "realty_nutricao_fluxos", "destinatarioContactIds"))) {
      await queryInterface.addColumn("realty_nutricao_fluxos", "destinatarioContactIds", {
        type: Sequelize.JSONB,
        allowNull: true
      });
    }
    if (!(await columnExists(queryInterface, "realty_nutricao_fluxos", "destinatarioLeadSaleIds"))) {
      await queryInterface.addColumn("realty_nutricao_fluxos", "destinatarioLeadSaleIds", {
        type: Sequelize.JSONB,
        allowNull: true
      });
    }
  },

  down: async (queryInterface) => {
    if (await columnExists(queryInterface, "realty_nutricao_fluxos", "destinatarioLeadSaleIds")) {
      await queryInterface.removeColumn("realty_nutricao_fluxos", "destinatarioLeadSaleIds");
    }
    if (await columnExists(queryInterface, "realty_nutricao_fluxos", "destinatarioContactIds")) {
      await queryInterface.removeColumn("realty_nutricao_fluxos", "destinatarioContactIds");
    }
  }
};
