"use strict";
/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Remove histórico de consultas CPF simuladas/mockadas.
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
  up: async (queryInterface) => {
    if (!(await tableExists(queryInterface, "realty_consulta_cpf"))) return;

    await queryInterface.sequelize.query(
      `DELETE FROM realty_consulta_cpf WHERE simulated = true`
    );

    await queryInterface.sequelize.query(
      `ALTER TABLE realty_consulta_cpf ALTER COLUMN simulated SET DEFAULT false`
    );
  },

  down: async (queryInterface) => {
    if (!(await tableExists(queryInterface, "realty_consulta_cpf"))) return;
    await queryInterface.sequelize.query(
      `ALTER TABLE realty_consulta_cpf ALTER COLUMN simulated SET DEFAULT true`
    );
  }
};
