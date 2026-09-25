"use strict";
/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Histórico de Consulta CPF — paridade Lovable credit-check.
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

    if (!(await tableExists(queryInterface, "realty_consulta_cpf"))) {
      await queryInterface.createTable("realty_consulta_cpf", {
        id: { type: T.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
        companyId: { type: T.INTEGER, allowNull: false },
        userId: { type: T.INTEGER, allowNull: true },
        cpf: { type: T.STRING(11), allowNull: false },
        cpfMasked: { type: T.STRING(20), allowNull: true },
        lgpdConsent: { type: T.BOOLEAN, allowNull: false, defaultValue: false },
        contratoId: { type: T.INTEGER, allowNull: true },
        score: { type: T.INTEGER, allowNull: true },
        riskLevel: { type: T.STRING(20), allowNull: true },
        status: { type: T.STRING(20), allowNull: true },
        simulated: { type: T.BOOLEAN, allowNull: false, defaultValue: false },
        resultado: { type: T.JSONB, allowNull: true },
        consultedAt: { type: T.DATE, allowNull: false },
        createdAt: { type: T.DATE, allowNull: false },
        updatedAt: { type: T.DATE, allowNull: false }
      });

      await queryInterface.addIndex("realty_consulta_cpf", ["companyId", "consultedAt"], {
        name: "realty_consulta_cpf_company_consulted_idx"
      });
      await queryInterface.addIndex("realty_consulta_cpf", ["companyId", "cpf"], {
        name: "realty_consulta_cpf_company_cpf_idx"
      });
    }
  },

  down: async (queryInterface) => {
    if (await tableExists(queryInterface, "realty_consulta_cpf")) {
      await queryInterface.dropTable("realty_consulta_cpf");
    }
  }
};
