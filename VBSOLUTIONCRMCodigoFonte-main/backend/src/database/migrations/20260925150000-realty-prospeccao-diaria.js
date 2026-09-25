"use strict";
/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Prospecção Diária — totais do dia (paridade Lovable prospeccao_diaria).
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

    if (!(await tableExists(queryInterface, "realty_prospeccao_diaria"))) {
      await queryInterface.createTable("realty_prospeccao_diaria", {
        id: { type: T.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
        companyId: { type: T.INTEGER, allowNull: false },
        userId: { type: T.INTEGER, allowNull: true },
        data: { type: T.DATEONLY, allowNull: false },
        prospeccoesAluguel: { type: T.INTEGER, allowNull: false, defaultValue: 0 },
        prospeccoesVenda: { type: T.INTEGER, allowNull: false, defaultValue: 0 },
        proprietariosContatados: { type: T.INTEGER, allowNull: false, defaultValue: 0 },
        leadsConversados: { type: T.INTEGER, allowNull: false, defaultValue: 0 },
        observacoes: { type: T.TEXT, allowNull: true },
        createdAt: { type: T.DATE, allowNull: false },
        updatedAt: { type: T.DATE, allowNull: false }
      });

      await queryInterface.addIndex("realty_prospeccao_diaria", ["companyId", "data"], {
        unique: true,
        name: "realty_prospeccao_diaria_company_data_unique"
      });
    }
  },

  down: async (queryInterface) => {
    if (await tableExists(queryInterface, "realty_prospeccao_diaria")) {
      await queryInterface.dropTable("realty_prospeccao_diaria");
    }
  }
};
