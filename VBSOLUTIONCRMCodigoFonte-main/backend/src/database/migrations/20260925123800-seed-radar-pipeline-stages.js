"use strict";
/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Atualiza funil padrão para as 12 etapas do CRM Pipeline (Radarimobtech).
 */

const STAGES = [
  { key: "novos", label: "Novos Leads", order: 1, color: "#0ea5e9" },
  { key: "qualificados", label: "Qualificados", order: 2, color: "#f59e0b" },
  { key: "visita", label: "Visita Agendada", order: 3, color: "#8b5cf6" },
  { key: "proposta", label: "Proposta", order: 4, color: "#22c55e" },
  { key: "mandar_opcoes", label: "Mandar Opções", order: 5, color: "#3b82f6" },
  { key: "pediu_tempo", label: "Pediu Tempo", order: 6, color: "#f97316" },
  { key: "quer_alugar", label: "Quer Alugar", order: 7, color: "#14b8a6" },
  { key: "nao_responde", label: "Não Responde", order: 8, color: "#8c8c8c" },
  { key: "fechado", label: "Fechado", order: 9, color: "#eab308" },
  { key: "comprou_outra", label: "Comprou c/ Outra", order: 10, color: "#ea580c" },
  { key: "desistiu", label: "Desistiu", order: 11, color: "#b91c1c" },
  { key: "perdido", label: "Perdido", order: 12, color: "#ef4444" },
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
    if (
      !(await tableExists(queryInterface, "LeadPipelines")) &&
      !(await tableExists(queryInterface, "lead_pipelines"))
    ) {
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
            WHERE "pipelineId" = :pipelineId AND (key = :key OR name = :label OR label = :label)
            LIMIT 1`,
          { replacements: { pipelineId: pipeline.id, key: stage.key, label: stage.label } }
        );
        if (existing && existing.length) {
          try {
            await queryInterface.sequelize.query(
              `UPDATE "${stageTable}"
                 SET key = :key, label = :label, name = :label, "order" = :order, color = :color, "updatedAt" = :now
               WHERE id = :id`,
              {
                replacements: {
                  id: existing[0].id,
                  key: stage.key,
                  label: stage.label,
                  order: stage.order,
                  color: stage.color,
                  now,
                },
              }
            );
          } catch (_) {
            /* schema variants */
          }
          continue;
        }

        try {
          await queryInterface.bulkInsert(stageTable, [
            {
              name: stage.label,
              label: stage.label,
              key: stage.key,
              color: stage.color,
              order: stage.order,
              orderIndex: stage.order,
              pipelineId: pipeline.id,
              companyId: pipeline.companyId,
              createdAt: now,
              updatedAt: now,
            },
          ]);
        } catch (_) {
          try {
            await queryInterface.bulkInsert(stageTable, [
              {
                name: stage.label,
                key: stage.key,
                order: stage.order,
                pipelineId: pipeline.id,
                companyId: pipeline.companyId,
                createdAt: now,
                updatedAt: now,
              },
            ]);
          } catch (__) {
            /* ignore */
          }
        }
      }
    }
  },

  down: async () => {
    /* keep stages */
  },
};
