"use strict";
/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Enrich realty_propostas with client fields (Lovable/Radarimobtech parity).
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
    const T = Sequelize;
    const table = "realty_propostas";

    if (!(await columnExists(queryInterface, table, "clienteNome"))) {
      await queryInterface.addColumn(table, "clienteNome", { type: T.STRING, allowNull: true });
    }
    if (!(await columnExists(queryInterface, table, "clienteTelefone"))) {
      await queryInterface.addColumn(table, "clienteTelefone", { type: T.STRING, allowNull: true });
    }
    if (!(await columnExists(queryInterface, table, "clienteEmail"))) {
      await queryInterface.addColumn(table, "clienteEmail", { type: T.STRING, allowNull: true });
    }
    if (!(await columnExists(queryInterface, table, "prazoContrato"))) {
      await queryInterface.addColumn(table, "prazoContrato", { type: T.STRING, allowNull: true });
    }
    if (!(await columnExists(queryInterface, table, "numeroProposta"))) {
      await queryInterface.addColumn(table, "numeroProposta", { type: T.INTEGER, allowNull: true });
    }

    // Allow proposals without a linked lead (form collects client data directly)
    await queryInterface.changeColumn(table, "leadSaleId", {
      type: T.INTEGER,
      allowNull: true
    });

    // Backfill clienteNome from title when missing
    await queryInterface.sequelize.query(
      `UPDATE realty_propostas SET "clienteNome" = COALESCE(NULLIF(TRIM(title), ''), 'Cliente')
       WHERE "clienteNome" IS NULL OR TRIM("clienteNome") = ''`
    );

    // Backfill numeroProposta sequentially per company
    await queryInterface.sequelize.query(`
      WITH ranked AS (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY "companyId" ORDER BY "createdAt" ASC, id ASC) AS rn
        FROM realty_propostas
      )
      UPDATE realty_propostas p
      SET "numeroProposta" = ranked.rn
      FROM ranked
      WHERE p.id = ranked.id AND (p."numeroProposta" IS NULL OR p."numeroProposta" = 0)
    `);
  },

  down: async (queryInterface, Sequelize) => {
    const T = Sequelize;
    const table = "realty_propostas";
    const cols = ["clienteNome", "clienteTelefone", "clienteEmail", "prazoContrato", "numeroProposta"];
    for (const col of cols) {
      if (await columnExists(queryInterface, table, col)) {
        await queryInterface.removeColumn(table, col);
      }
    }
    await queryInterface.changeColumn(table, "leadSaleId", {
      type: T.INTEGER,
      allowNull: false
    }).catch(() => {});
  }
};
