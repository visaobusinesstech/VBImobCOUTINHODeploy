"use strict";
/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Captações por canal (porteiro/síndico/indicação…) — paridade Lovable `captacoes`.
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

    if (!(await tableExists(queryInterface, "realty_captacoes"))) {
      await queryInterface.createTable("realty_captacoes", {
        id: { type: T.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
        companyId: { type: T.INTEGER, allowNull: false },
        userId: { type: T.INTEGER, allowNull: true },
        tipo: { type: T.STRING(40), allowNull: false, defaultValue: "porteiro" },
        nomeContato: { type: T.STRING(200), allowNull: false, defaultValue: "" },
        telefoneContato: { type: T.STRING(40), allowNull: true },
        emailContato: { type: T.STRING(200), allowNull: true },
        enderecoImovel: { type: T.TEXT, allowNull: true },
        bairro: { type: T.STRING(120), allowNull: true },
        cidade: { type: T.STRING(120), allowNull: true },
        estado: { type: T.STRING(2), allowNull: true, defaultValue: "SP" },
        tipoImovel: { type: T.STRING(80), allowNull: true, defaultValue: "Apartamento" },
        operacao: { type: T.STRING(40), allowNull: true, defaultValue: "Venda" },
        nomeConstrutora: { type: T.STRING(200), allowNull: true },
        nomeCondominio: { type: T.STRING(200), allowNull: true },
        observacoes: { type: T.TEXT, allowNull: true },
        status: { type: T.STRING(40), allowNull: false, defaultValue: "pendente" },
        createdAt: { type: T.DATE, allowNull: false },
        updatedAt: { type: T.DATE, allowNull: false }
      });

      await queryInterface.addIndex("realty_captacoes", ["companyId"], {
        name: "realty_captacoes_company_idx"
      });
      await queryInterface.addIndex("realty_captacoes", ["companyId", "tipo"], {
        name: "realty_captacoes_company_tipo_idx"
      });
      await queryInterface.addIndex("realty_captacoes", ["companyId", "status"], {
        name: "realty_captacoes_company_status_idx"
      });
    }
  },

  down: async (queryInterface) => {
    if (await tableExists(queryInterface, "realty_captacoes")) {
      await queryInterface.dropTable("realty_captacoes");
    }
  }
};
