"use strict";
/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 */

async function tableExists(queryInterface, table) {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT 1
       FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = :table
      LIMIT 1`,
    { replacements: { table } }
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function columnExists(queryInterface, table, column) {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT 1
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = :table
        AND column_name = :column
      LIMIT 1`,
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

    if (!(await tableExists(queryInterface, "realty_proprietarios"))) {
      await queryInterface.createTable("realty_proprietarios", {
        id: { type: T.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
        name: { type: T.STRING, allowNull: false },
        phone: { type: T.STRING, allowNull: true },
        email: { type: T.STRING, allowNull: true },
        document: { type: T.STRING, allowNull: true },
        notes: { type: T.TEXT, allowNull: true },
        companyId: { type: T.INTEGER, allowNull: false },
        createdAt: { type: T.DATE, allowNull: false },
        updatedAt: { type: T.DATE, allowNull: false }
      });
    }

    if (!(await tableExists(queryInterface, "realty_imoveis"))) {
      await queryInterface.createTable("realty_imoveis", {
        id: { type: T.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
        title: { type: T.STRING, allowNull: false },
        description: { type: T.TEXT, allowNull: true },
        type: { type: T.STRING, allowNull: true },
        status: { type: T.STRING, allowNull: true, defaultValue: "disponivel" },
        price: { type: T.DECIMAL(14, 2), allowNull: true },
        city: { type: T.STRING, allowNull: true },
        neighborhood: { type: T.STRING, allowNull: true },
        address: { type: T.STRING, allowNull: true },
        bedrooms: { type: T.INTEGER, allowNull: true },
        bathrooms: { type: T.INTEGER, allowNull: true },
        areaM2: { type: T.DECIMAL(10, 2), allowNull: true },
        images: { type: T.JSONB, allowNull: true },
        proprietarioId: { type: T.INTEGER, allowNull: true },
        companyId: { type: T.INTEGER, allowNull: false },
        createdAt: { type: T.DATE, allowNull: false },
        updatedAt: { type: T.DATE, allowNull: false }
      });
    }

    if (!(await tableExists(queryInterface, "realty_contratos"))) {
      await queryInterface.createTable("realty_contratos", {
        id: { type: T.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
        title: { type: T.STRING, allowNull: false },
        status: { type: T.STRING, allowNull: true, defaultValue: "rascunho" },
        value: { type: T.DECIMAL(14, 2), allowNull: true },
        startDate: { type: T.DATE, allowNull: true },
        endDate: { type: T.DATE, allowNull: true },
        notes: { type: T.TEXT, allowNull: true },
        imovelId: { type: T.INTEGER, allowNull: true },
        proprietarioId: { type: T.INTEGER, allowNull: true },
        leadSaleId: { type: T.INTEGER, allowNull: true },
        companyId: { type: T.INTEGER, allowNull: false },
        createdAt: { type: T.DATE, allowNull: false },
        updatedAt: { type: T.DATE, allowNull: false }
      });
    }

    await addColumnIfMissing(queryInterface, "leads_sales", "imovelId", {
      type: T.INTEGER,
      allowNull: true
    });
    await addColumnIfMissing(queryInterface, "leads_sales", "proprietarioId", {
      type: T.INTEGER,
      allowNull: true
    });
    await addColumnIfMissing(queryInterface, "leads_sales", "interestCity", {
      type: T.STRING,
      allowNull: true
    });
    await addColumnIfMissing(queryInterface, "leads_sales", "interestNeighborhood", {
      type: T.STRING,
      allowNull: true
    });
    await addColumnIfMissing(queryInterface, "leads_sales", "interestType", {
      type: T.STRING,
      allowNull: true
    });
    await addColumnIfMissing(queryInterface, "leads_sales", "bedrooms", {
      type: T.INTEGER,
      allowNull: true
    });
    await addColumnIfMissing(queryInterface, "leads_sales", "followUpAt", {
      type: T.DATE,
      allowNull: true
    });
  },

  down: async (queryInterface) => {
    const cols = [
      "imovelId",
      "proprietarioId",
      "interestCity",
      "interestNeighborhood",
      "interestType",
      "bedrooms",
      "followUpAt"
    ];
    for (const col of cols) {
      if (await columnExists(queryInterface, "leads_sales", col)) {
        await queryInterface.removeColumn("leads_sales", col);
      }
    }
    if (await tableExists(queryInterface, "realty_contratos")) {
      await queryInterface.dropTable("realty_contratos");
    }
    if (await tableExists(queryInterface, "realty_imoveis")) {
      await queryInterface.dropTable("realty_imoveis");
    }
    if (await tableExists(queryInterface, "realty_proprietarios")) {
      await queryInterface.dropTable("realty_proprietarios");
    }
  }
};
