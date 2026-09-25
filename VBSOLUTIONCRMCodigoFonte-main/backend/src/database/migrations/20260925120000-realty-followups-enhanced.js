"use strict";
/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Follow-ups enriquecidos: templates, WhatsApp, recorrência, vínculo contrato.
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
  if (!(await columnExists(queryInterface, table, column))) {
    await queryInterface.addColumn(table, column, definition);
  }
}

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const T = Sequelize;

    if (await tableExists(queryInterface, "realty_followups")) {
      // leadSaleId passa a ser opcional (pode vincular só a contrato)
      try {
        await queryInterface.changeColumn("realty_followups", "leadSaleId", {
          type: T.INTEGER,
          allowNull: true
        });
      } catch (_) {
        /* ignore if already nullable / dialect quirks */
      }

      await addColumnIfMissing(queryInterface, "realty_followups", "contratoId", {
        type: T.INTEGER,
        allowNull: true
      });
      await addColumnIfMissing(queryInterface, "realty_followups", "messageBody", {
        type: T.TEXT,
        allowNull: true
      });
      await addColumnIfMissing(queryInterface, "realty_followups", "messageMode", {
        type: T.STRING,
        allowNull: true,
        defaultValue: "pronta"
      });
      await addColumnIfMissing(queryInterface, "realty_followups", "messageTemplateId", {
        type: T.INTEGER,
        allowNull: true
      });
      await addColumnIfMissing(queryInterface, "realty_followups", "whatsappId", {
        type: T.INTEGER,
        allowNull: true
      });
      await addColumnIfMissing(queryInterface, "realty_followups", "metaTemplateQuickMessageId", {
        type: T.INTEGER,
        allowNull: true
      });
      await addColumnIfMissing(queryInterface, "realty_followups", "metaTemplateVariables", {
        type: T.TEXT,
        allowNull: true
      });
      await addColumnIfMissing(queryInterface, "realty_followups", "whatsappSent", {
        type: T.BOOLEAN,
        allowNull: true,
        defaultValue: false
      });
      await addColumnIfMissing(queryInterface, "realty_followups", "whatsappSentAt", {
        type: T.DATE,
        allowNull: true
      });
      await addColumnIfMissing(queryInterface, "realty_followups", "sendNow", {
        type: T.BOOLEAN,
        allowNull: true,
        defaultValue: false
      });
      await addColumnIfMissing(queryInterface, "realty_followups", "recurrenceEnabled", {
        type: T.BOOLEAN,
        allowNull: true,
        defaultValue: false
      });
      await addColumnIfMissing(queryInterface, "realty_followups", "recurrenceType", {
        type: T.STRING,
        allowNull: true
      });
      await addColumnIfMissing(queryInterface, "realty_followups", "recurrenceInterval", {
        type: T.INTEGER,
        allowNull: true,
        defaultValue: 1
      });
      await addColumnIfMissing(queryInterface, "realty_followups", "recurrenceDays", {
        type: T.STRING,
        allowNull: true
      });

      await queryInterface.sequelize.query(
        `CREATE INDEX IF NOT EXISTS realty_followups_contrato_idx ON realty_followups ("contratoId")`
      );
      await queryInterface.sequelize.query(
        `CREATE INDEX IF NOT EXISTS realty_followups_status_idx ON realty_followups ("status")`
      );
    }

    if (!(await tableExists(queryInterface, "realty_followup_templates"))) {
      await queryInterface.createTable("realty_followup_templates", {
        id: { type: T.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
        title: { type: T.STRING, allowNull: false },
        message: { type: T.TEXT, allowNull: false },
        active: { type: T.BOOLEAN, allowNull: false, defaultValue: true },
        companyId: { type: T.INTEGER, allowNull: false },
        createdAt: { type: T.DATE, allowNull: false },
        updatedAt: { type: T.DATE, allowNull: false }
      });
      await queryInterface.sequelize.query(
        `CREATE INDEX IF NOT EXISTS realty_followup_templates_company_idx ON realty_followup_templates ("companyId")`
      );
    }
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("realty_followup_templates").catch(() => {});
    const cols = [
      "contratoId",
      "messageBody",
      "messageMode",
      "messageTemplateId",
      "whatsappId",
      "metaTemplateQuickMessageId",
      "metaTemplateVariables",
      "whatsappSent",
      "whatsappSentAt",
      "sendNow",
      "recurrenceEnabled",
      "recurrenceType",
      "recurrenceInterval",
      "recurrenceDays"
    ];
    for (const col of cols) {
      try {
        await queryInterface.removeColumn("realty_followups", col);
      } catch (_) {
        /* ignore */
      }
    }
  }
};
