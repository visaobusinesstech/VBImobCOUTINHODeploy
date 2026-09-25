"use strict";
/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Agenda imobiliária — compromissos (paridade Lovable: tabela compromissos).
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

    if (!(await tableExists(queryInterface, "realty_compromissos"))) {
      await queryInterface.createTable("realty_compromissos", {
        id: { type: T.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
        title: { type: T.STRING, allowNull: false },
        description: { type: T.TEXT, allowNull: true },
        tipo: { type: T.STRING, allowNull: false, defaultValue: "reuniao" },
        dataInicio: { type: T.DATE, allowNull: false },
        dataFim: { type: T.DATE, allowNull: true },
        local: { type: T.STRING, allowNull: true },
        leadSaleId: { type: T.INTEGER, allowNull: true },
        userId: { type: T.INTEGER, allowNull: true },
        imovelId: { type: T.INTEGER, allowNull: true },
        status: { type: T.STRING, allowNull: false, defaultValue: "pendente" },
        lembreteWhatsapp: { type: T.BOOLEAN, allowNull: false, defaultValue: false },
        telefoneLembrete: { type: T.STRING, allowNull: true },
        prioridade: { type: T.STRING, allowNull: false, defaultValue: "media" },
        emailCliente: { type: T.STRING, allowNull: true },
        googleMapsLink: { type: T.STRING, allowNull: true },
        confirmado: { type: T.BOOLEAN, allowNull: false, defaultValue: false },
        lembreteNivel: { type: T.INTEGER, allowNull: false, defaultValue: 0 },
        checkinAt: { type: T.DATE, allowNull: true },
        checkoutAt: { type: T.DATE, allowNull: true },
        feedbackVisita: { type: T.TEXT, allowNull: true },
        feedbackIa: { type: T.TEXT, allowNull: true },
        confirmacaoStatus: { type: T.STRING, allowNull: true, defaultValue: "pendente" },
        confirmacaoToken: { type: T.STRING, allowNull: true },
        confirmacaoMensagem: { type: T.TEXT, allowNull: true },
        clienteResposta: { type: T.TEXT, allowNull: true },
        dataReagendamentoSugerida: { type: T.DATE, allowNull: true },
        resultadoCliente: { type: T.STRING, allowNull: true },
        companyId: { type: T.INTEGER, allowNull: false },
        createdAt: { type: T.DATE, allowNull: false },
        updatedAt: { type: T.DATE, allowNull: false }
      });
      await queryInterface.sequelize.query(
        `CREATE INDEX IF NOT EXISTS realty_compromissos_company_idx ON realty_compromissos ("companyId")`
      );
      await queryInterface.sequelize.query(
        `CREATE INDEX IF NOT EXISTS realty_compromissos_data_idx ON realty_compromissos ("dataInicio")`
      );
      await queryInterface.sequelize.query(
        `CREATE INDEX IF NOT EXISTS realty_compromissos_lead_idx ON realty_compromissos ("leadSaleId")`
      );
      await queryInterface.sequelize.query(
        `CREATE INDEX IF NOT EXISTS realty_compromissos_user_idx ON realty_compromissos ("userId")`
      );
      await queryInterface.sequelize.query(
        `CREATE INDEX IF NOT EXISTS realty_compromissos_status_idx ON realty_compromissos ("status")`
      );
    }

    // Backfill from realty_visitas → compromissos (tipo visita), once
    if (await tableExists(queryInterface, "realty_visitas")) {
      await queryInterface.sequelize.query(`
        INSERT INTO realty_compromissos (
          title, description, tipo, "dataInicio", "dataFim", local,
          "leadSaleId", "userId", "imovelId", status,
          "lembreteWhatsapp", prioridade, "confirmado", "lembreteNivel",
          "feedbackVisita", "resultadoCliente", "confirmacaoStatus",
          "companyId", "createdAt", "updatedAt"
        )
        SELECT
          COALESCE(NULLIF(TRIM(v.notes), ''), 'Visita agendada') AS title,
          v.notes AS description,
          'visita' AS tipo,
          v."scheduledAt" AS "dataInicio",
          NULL AS "dataFim",
          v.location AS local,
          v."leadSaleId",
          v."userId",
          v."imovelId",
          CASE
            WHEN LOWER(COALESCE(v.status, '')) IN ('realizada', 'concluido', 'concluída', 'concluida') THEN 'concluido'
            WHEN LOWER(COALESCE(v.status, '')) IN ('cancelada', 'cancelado') THEN 'cancelado'
            ELSE 'pendente'
          END AS status,
          false AS "lembreteWhatsapp",
          'media' AS prioridade,
          CASE WHEN LOWER(COALESCE(v.status, '')) = 'confirmada' THEN true ELSE false END AS "confirmado",
          0 AS "lembreteNivel",
          v.notes AS "feedbackVisita",
          v.result AS "resultadoCliente",
          'pendente' AS "confirmacaoStatus",
          v."companyId",
          v."createdAt",
          v."updatedAt"
        FROM realty_visitas v
        WHERE NOT EXISTS (
          SELECT 1 FROM realty_compromissos c
          WHERE c."companyId" = v."companyId"
            AND c.tipo = 'visita'
            AND c."leadSaleId" IS NOT DISTINCT FROM v."leadSaleId"
            AND c."dataInicio" = v."scheduledAt"
        )
      `);
    }
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("realty_compromissos").catch(() => {});
  }
};
