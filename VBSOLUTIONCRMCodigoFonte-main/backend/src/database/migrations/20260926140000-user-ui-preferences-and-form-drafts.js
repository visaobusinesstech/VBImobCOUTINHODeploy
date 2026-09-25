"use strict";
/**
 * Preferências de UI e rascunhos de formulário passam a viver no banco
 * (não em localStorage).
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
      WHERE table_schema = 'public' AND table_name = :table AND column_name = :column
      LIMIT 1`,
    { replacements: { table, column } }
  );
  return Array.isArray(rows) && rows.length > 0;
}

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const usersTable = (await tableExists(queryInterface, "Users"))
      ? "Users"
      : (await tableExists(queryInterface, "users"))
        ? "users"
        : null;

    if (usersTable && !(await columnExists(queryInterface, usersTable, "uiPreferences"))) {
      await queryInterface.addColumn(usersTable, "uiPreferences", {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {},
      });
    }

    if (!(await tableExists(queryInterface, "UserFormDrafts"))) {
      await queryInterface.createTable("UserFormDrafts", {
        id: {
          type: Sequelize.INTEGER,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false,
        },
        companyId: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: "Companies", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },
        userId: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: usersTable || "Users", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },
        draftKey: {
          type: Sequelize.STRING(120),
          allowNull: false,
        },
        payload: {
          type: Sequelize.JSONB,
          allowNull: false,
          defaultValue: {},
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
        },
      });

      await queryInterface.addIndex("UserFormDrafts", ["userId", "draftKey"], {
        unique: true,
        name: "user_form_drafts_user_key_unique",
      });
      await queryInterface.addIndex("UserFormDrafts", ["companyId"], {
        name: "user_form_drafts_company_idx",
      });
    }

    // Garantir appName Radar CRM no Settings (company-wide)
    if (await tableExists(queryInterface, "Settings")) {
      await queryInterface.sequelize.query(
        `UPDATE "Settings"
            SET value = 'Radar CRM', "updatedAt" = NOW()
          WHERE key = 'appName'
            AND (value IS NULL OR value = '' OR value ILIKE '%Visão Business%' OR value ILIKE '%VB Solution%' OR value ILIKE '%VBImobiliaria%')`
      );
    }
  },

  down: async (queryInterface) => {
    if (await tableExists(queryInterface, "UserFormDrafts")) {
      await queryInterface.dropTable("UserFormDrafts");
    }
    const usersTable = (await tableExists(queryInterface, "Users"))
      ? "Users"
      : (await tableExists(queryInterface, "users"))
        ? "users"
        : null;
    if (usersTable && (await columnExists(queryInterface, usersTable, "uiPreferences"))) {
      await queryInterface.removeColumn(usersTable, "uiPreferences");
    }
  },
};
