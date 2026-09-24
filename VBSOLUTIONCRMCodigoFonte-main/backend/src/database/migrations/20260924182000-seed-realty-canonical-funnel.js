"use strict";
/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Seed canonical realty funnel stages on default pipelines.
 */

const STAGES = [
  { key: "novo", label: "Novos", order: 1 },
  { key: "contato", label: "Contato", order: 2 },
  { key: "qualificacao", label: "Qualificação", order: 3 },
  { key: "imoveis_enviados", label: "Imóveis enviados", order: 4 },
  { key: "visita", label: "Visita", order: 5 },
  { key: "proposta", label: "Proposta", order: 6 },
  { key: "negociacao", label: "Negociação", order: 7 },
  { key: "fechado", label: "Fechado", order: 8 },
  { key: "perdido", label: "Perdido", order: 9 },
  { key: "pos_venda", label: "Pós-venda", order: 10 }
];

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
    if (!(await tableExists(queryInterface, "LeadPipelines")) &&
        !(await tableExists(queryInterface, "lead_pipelines"))) {
      return;
    }

    const pipelineTable = (await tableExists(queryInterface, "lead_pipelines"))
      ? "lead_pipelines"
      : "LeadPipelines";
    const stageTable = (await tableExists(queryInterface, "lead_pipeline_stages"))
      ? "lead_pipeline_stages"
      : (await tableExists(queryInterface, "LeadPipelineStages"))
        ? "LeadPipelineStages"
        : null;

    if (!stageTable) return;

    const [pipelines] = await queryInterface.sequelize.query(
      `SELECT id, "companyId" FROM "${pipelineTable}"`
    );

    const now = new Date();
    for (const pipeline of pipelines || []) {
      for (const stage of STAGES) {
        const [existing] = await queryInterface.sequelize.query(
          `SELECT id FROM "${stageTable}"
            WHERE "pipelineId" = :pipelineId AND (key = :key OR name = :label)
            LIMIT 1`,
          { replacements: { pipelineId: pipeline.id, key: stage.key, label: stage.label } }
        );
        if (existing && existing.length) continue;

        // Support both schema variants (key/name/orderIndex vs name/order)
        try {
          await queryInterface.bulkInsert(stageTable, [{
            name: stage.label,
            key: stage.key,
            order: stage.order,
            orderIndex: stage.order,
            pipelineId: pipeline.id,
            companyId: pipeline.companyId,
            createdAt: now,
            updatedAt: now
          }]);
        } catch (_) {
          try {
            await queryInterface.bulkInsert(stageTable, [{
              name: stage.label,
              pipelineId: pipeline.id,
              companyId: pipeline.companyId,
              createdAt: now,
              updatedAt: now
            }]);
          } catch (__) {
            /* schema variants — ignore if columns differ */
          }
        }
      }
    }
  },

  down: async () => {
    /* keep seeded stages */
  }
};
