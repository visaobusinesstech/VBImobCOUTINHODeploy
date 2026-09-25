"use strict";
/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Corretores — permissões e regras de atribuição (paridade Lovable).
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

    if (!(await tableExists(queryInterface, "realty_corretor_permissoes"))) {
      await queryInterface.createTable("realty_corretor_permissoes", {
        id: { type: T.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
        companyId: { type: T.INTEGER, allowNull: false },
        corretorId: { type: T.INTEGER, allowNull: false },
        modulo: { type: T.STRING, allowNull: false },
        ativo: { type: T.BOOLEAN, allowNull: false, defaultValue: true },
        createdAt: { type: T.DATE, allowNull: false },
        updatedAt: { type: T.DATE, allowNull: false }
      });
      await queryInterface.sequelize.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS realty_corretor_permissoes_unique
          ON realty_corretor_permissoes ("corretorId", modulo)`
      );
      await queryInterface.sequelize.query(
        `CREATE INDEX IF NOT EXISTS realty_corretor_permissoes_company_idx
          ON realty_corretor_permissoes ("companyId")`
      );
    }

    if (!(await tableExists(queryInterface, "realty_corretor_atribuicao_regras"))) {
      await queryInterface.createTable("realty_corretor_atribuicao_regras", {
        id: { type: T.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
        companyId: { type: T.INTEGER, allowNull: false },
        corretorId: { type: T.INTEGER, allowNull: false },
        cidade: { type: T.STRING, allowNull: true },
        bairro: { type: T.STRING, allowNull: true },
        prioridade: { type: T.INTEGER, allowNull: false, defaultValue: 100 },
        peso: { type: T.INTEGER, allowNull: false, defaultValue: 1 },
        ativo: { type: T.BOOLEAN, allowNull: false, defaultValue: true },
        createdAt: { type: T.DATE, allowNull: false },
        updatedAt: { type: T.DATE, allowNull: false }
      });
      await queryInterface.sequelize.query(
        `CREATE INDEX IF NOT EXISTS realty_corretor_atribuicao_company_idx
          ON realty_corretor_atribuicao_regras ("companyId")`
      );
      await queryInterface.sequelize.query(
        `CREATE INDEX IF NOT EXISTS realty_corretor_atribuicao_corretor_idx
          ON realty_corretor_atribuicao_regras ("corretorId")`
      );
      await queryInterface.sequelize.query(
        `CREATE INDEX IF NOT EXISTS realty_corretor_atribuicao_prio_idx
          ON realty_corretor_atribuicao_regras (prioridade)`
      );
    }
  },

  down: async (queryInterface) => {
    if (await tableExists(queryInterface, "realty_corretor_atribuicao_regras")) {
      await queryInterface.dropTable("realty_corretor_atribuicao_regras");
    }
    if (await tableExists(queryInterface, "realty_corretor_permissoes")) {
      await queryInterface.dropTable("realty_corretor_permissoes");
    }
  }
};
