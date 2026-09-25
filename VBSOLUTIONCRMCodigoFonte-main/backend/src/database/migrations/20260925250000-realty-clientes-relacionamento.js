"use strict";
/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Clientes de Relacionamento + templates de mensagem (paridade Lovable).
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

    if (!(await tableExists(queryInterface, "realty_clientes_relacionamento"))) {
      await queryInterface.createTable("realty_clientes_relacionamento", {
        id: { type: T.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
        companyId: { type: T.INTEGER, allowNull: false },
        nome: { type: T.STRING, allowNull: false },
        telefone: { type: T.STRING, allowNull: true },
        email: { type: T.STRING, allowNull: true },
        aniversario: { type: T.DATEONLY, allowNull: true },
        dataCasamento: { type: T.DATEONLY, allowNull: true },
        profissao: { type: T.STRING, allowNull: true },
        dataProfissao: { type: T.DATEONLY, allowNull: true },
        dataMudanca: { type: T.DATEONLY, allowNull: true },
        dataCompraImovel: { type: T.DATEONLY, allowNull: true },
        filhos: { type: T.JSONB, allowNull: false, defaultValue: [] },
        observacoes: { type: T.TEXT, allowNull: true },
        ativo: { type: T.BOOLEAN, allowNull: false, defaultValue: true },
        createdAt: { type: T.DATE, allowNull: false },
        updatedAt: { type: T.DATE, allowNull: false }
      });

      await queryInterface.addIndex("realty_clientes_relacionamento", ["companyId"], {
        name: "realty_clientes_relacionamento_company_idx"
      });
      await queryInterface.addIndex("realty_clientes_relacionamento", ["companyId", "nome"], {
        name: "realty_clientes_relacionamento_company_nome_idx"
      });
      await queryInterface.addIndex("realty_clientes_relacionamento", ["companyId", "ativo"], {
        name: "realty_clientes_relacionamento_company_ativo_idx"
      });
    }

    if (!(await tableExists(queryInterface, "realty_mensagem_templates"))) {
      await queryInterface.createTable("realty_mensagem_templates", {
        id: { type: T.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
        companyId: { type: T.INTEGER, allowNull: false },
        tipo: { type: T.STRING, allowNull: false },
        mensagem: { type: T.TEXT, allowNull: false },
        ativo: { type: T.BOOLEAN, allowNull: false, defaultValue: true },
        createdAt: { type: T.DATE, allowNull: false },
        updatedAt: { type: T.DATE, allowNull: false }
      });

      await queryInterface.addIndex("realty_mensagem_templates", ["companyId", "tipo"], {
        unique: true,
        name: "realty_mensagem_templates_company_tipo_unique"
      });
    }
  },

  down: async (queryInterface) => {
    if (await tableExists(queryInterface, "realty_mensagem_templates")) {
      await queryInterface.dropTable("realty_mensagem_templates");
    }
    if (await tableExists(queryInterface, "realty_clientes_relacionamento")) {
      await queryInterface.dropTable("realty_clientes_relacionamento");
    }
  }
};
