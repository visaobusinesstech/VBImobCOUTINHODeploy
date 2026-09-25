"use strict";
/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Campos premium da carteira de imóveis (paridade Lovable / Radarimobtech).
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
    const cols = {
      exclusivo: { type: T.BOOLEAN, allowNull: false, defaultValue: false },
      destaque: { type: T.BOOLEAN, allowNull: false, defaultValue: false },
      aceitaPermuta: { type: T.BOOLEAN, allowNull: false, defaultValue: false },
      aceitaFinanciamento: { type: T.BOOLEAN, allowNull: false, defaultValue: false },
      aceitaFgts: { type: T.BOOLEAN, allowNull: false, defaultValue: false },
      temEscritura: { type: T.BOOLEAN, allowNull: false, defaultValue: false },
      andar: { type: T.STRING, allowNull: true },
      posicaoSolar: { type: T.STRING, allowNull: true },
      comissaoPercentual: { type: T.DECIMAL(5, 2), allowNull: true },
      exclusividadeInicio: { type: T.DATEONLY, allowNull: true },
      exclusividadeFim: { type: T.DATEONLY, allowNull: true },
      portalOrigem: { type: T.STRING, allowNull: true },
      urlAnuncio: { type: T.STRING, allowNull: true },
      fotoCapaIndex: { type: T.INTEGER, allowNull: true, defaultValue: 0 },
      documentosMatricula: { type: T.JSONB, allowNull: true, defaultValue: [] },
      documentosIptu: { type: T.JSONB, allowNull: true, defaultValue: [] },
      documentosOutros: { type: T.JSONB, allowNull: true, defaultValue: [] },
      videos: { type: T.JSONB, allowNull: true, defaultValue: [] }
    };
    for (const [col, def] of Object.entries(cols)) {
      await addColumnIfMissing(queryInterface, "realty_imoveis", col, def);
    }
  },

  down: async (queryInterface) => {
    const cols = [
      "exclusivo",
      "destaque",
      "aceitaPermuta",
      "aceitaFinanciamento",
      "aceitaFgts",
      "temEscritura",
      "andar",
      "posicaoSolar",
      "comissaoPercentual",
      "exclusividadeInicio",
      "exclusividadeFim",
      "portalOrigem",
      "urlAnuncio",
      "fotoCapaIndex",
      "documentosMatricula",
      "documentosIptu",
      "documentosOutros",
      "videos"
    ];
    for (const col of cols) {
      if (await tableExists(queryInterface, "realty_imoveis") && (await columnExists(queryInterface, "realty_imoveis", col))) {
        await queryInterface.removeColumn("realty_imoveis", col);
      }
    }
  }
};
