"use strict";
/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Histórico de avaliações — paridade Lovable avaliacoes_historico.
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

    if (!(await tableExists(queryInterface, "realty_avaliacoes_historico"))) {
      await queryInterface.createTable("realty_avaliacoes_historico", {
        id: { type: T.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
        companyId: { type: T.INTEGER, allowNull: false },
        userId: { type: T.INTEGER, allowNull: true },
        imovelId: { type: T.INTEGER, allowNull: true },
        titulo: { type: T.STRING(255), allowNull: false, defaultValue: "" },
        tipo: { type: T.STRING(80), allowNull: false, defaultValue: "Apartamento" },
        operacao: { type: T.STRING(80), allowNull: false, defaultValue: "Venda" },
        area: { type: T.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
        quartos: { type: T.INTEGER, allowNull: false, defaultValue: 0 },
        bairro: { type: T.STRING(120), allowNull: true },
        cidade: { type: T.STRING(120), allowNull: true },
        estado: { type: T.STRING(4), allowNull: true },
        precoInformado: { type: T.DECIMAL(14, 2), allowNull: true, defaultValue: 0 },
        valorMinimo: { type: T.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
        valorIdeal: { type: T.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
        valorMaximo: { type: T.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
        precoM2Estimado: { type: T.DECIMAL(14, 2), allowNull: true, defaultValue: 0 },
        precoM2Regiao: { type: T.DECIMAL(14, 2), allowNull: true, defaultValue: 0 },
        scoreLiquidez: { type: T.INTEGER, allowNull: true, defaultValue: 0 },
        classificacaoLiquidez: { type: T.STRING(20), allowNull: true, defaultValue: "media" },
        analiseResumo: { type: T.TEXT, allowNull: true },
        pontosFortes: { type: T.JSONB, allowNull: true, defaultValue: [] },
        pontosAtencao: { type: T.JSONB, allowNull: true, defaultValue: [] },
        estrategiaVenda: { type: T.TEXT, allowNull: true },
        portaisRecomendados: { type: T.JSONB, allowNull: true, defaultValue: [] },
        sugestaoPrecoInicial: { type: T.DECIMAL(14, 2), allowNull: true, defaultValue: 0 },
        probabilidadeVenda30dias: { type: T.INTEGER, allowNull: true, defaultValue: 0 },
        probabilidadeVenda60dias: { type: T.INTEGER, allowNull: true, defaultValue: 0 },
        probabilidadeVenda90dias: { type: T.INTEGER, allowNull: true, defaultValue: 0 },
        precoCompetitivo: { type: T.BOOLEAN, allowNull: true, defaultValue: false },
        modo: { type: T.STRING(40), allowNull: true, defaultValue: "manual" },
        comparaveisCount: { type: T.INTEGER, allowNull: true, defaultValue: 0 },
        descricao: { type: T.TEXT, allowNull: true },
        dadosCompletos: { type: T.JSONB, allowNull: true, defaultValue: {} },
        createdAt: { type: T.DATE, allowNull: false },
        updatedAt: { type: T.DATE, allowNull: false }
      });

      await queryInterface.addIndex("realty_avaliacoes_historico", ["companyId"], {
        name: "realty_avaliacoes_historico_company_idx"
      });
      await queryInterface.addIndex("realty_avaliacoes_historico", ["companyId", "cidade", "bairro"], {
        name: "realty_avaliacoes_historico_regiao_idx"
      });
    }
  },

  down: async (queryInterface) => {
    if (await tableExists(queryInterface, "realty_avaliacoes_historico")) {
      await queryInterface.dropTable("realty_avaliacoes_historico");
    }
  }
};
