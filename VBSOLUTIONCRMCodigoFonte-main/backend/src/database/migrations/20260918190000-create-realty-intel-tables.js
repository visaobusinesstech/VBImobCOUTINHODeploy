"use strict";

async function tableExists(queryInterface, table) {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=:table LIMIT 1`,
    { replacements: { table } }
  );
  return Array.isArray(rows) && rows.length > 0;
}

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const T = Sequelize;
    const tables = [
      ["realty_radarzap_grupos", {
        id: { type: T.INTEGER, autoIncrement: true, primaryKey: true },
        name: { type: T.STRING, allowNull: false },
        inviteUrl: { type: T.STRING, allowNull: true },
        city: { type: T.STRING, allowNull: true },
        status: { type: T.STRING, allowNull: true, defaultValue: "ativo" },
        companyId: { type: T.INTEGER, allowNull: false },
        createdAt: { type: T.DATE, allowNull: false },
        updatedAt: { type: T.DATE, allowNull: false }
      }],
      ["realty_radarzap_mensagens", {
        id: { type: T.INTEGER, autoIncrement: true, primaryKey: true },
        texto: { type: T.TEXT, allowNull: false },
        autorContato: { type: T.STRING, allowNull: true },
        analisado: { type: T.BOOLEAN, defaultValue: false },
        temImovel: { type: T.BOOLEAN, defaultValue: false },
        intencao: { type: T.STRING, allowNull: true },
        scoreIntencao: { type: T.INTEGER, allowNull: true },
        extraido: { type: T.JSONB, allowNull: true },
        grupoId: { type: T.INTEGER, allowNull: true },
        companyId: { type: T.INTEGER, allowNull: false },
        createdAt: { type: T.DATE, allowNull: false },
        updatedAt: { type: T.DATE, allowNull: false }
      }],
      ["realty_radarzap_leads", {
        id: { type: T.INTEGER, autoIncrement: true, primaryKey: true },
        tipoImovel: { type: T.STRING, allowNull: true },
        operacao: { type: T.STRING, allowNull: true },
        bairro: { type: T.STRING, allowNull: true },
        cidade: { type: T.STRING, allowNull: true },
        preco: { type: T.DECIMAL(14, 2), allowNull: true },
        contato: { type: T.STRING, allowNull: true },
        resumo: { type: T.TEXT, allowNull: true },
        status: { type: T.STRING, defaultValue: "novo" },
        mensagemId: { type: T.INTEGER, allowNull: true },
        grupoId: { type: T.INTEGER, allowNull: true },
        companyId: { type: T.INTEGER, allowNull: false },
        createdAt: { type: T.DATE, allowNull: false },
        updatedAt: { type: T.DATE, allowNull: false }
      }],
      ["realty_imoveis_mercado", {
        id: { type: T.INTEGER, autoIncrement: true, primaryKey: true },
        portal: { type: T.STRING, allowNull: false },
        url: { type: T.STRING, allowNull: true },
        titulo: { type: T.STRING, allowNull: false },
        tipo: { type: T.STRING, allowNull: true },
        operacao: { type: T.STRING, allowNull: true },
        bairro: { type: T.STRING, allowNull: true },
        cidade: { type: T.STRING, allowNull: true },
        preco: { type: T.DECIMAL(14, 2), allowNull: true },
        area: { type: T.DECIMAL(10, 2), allowNull: true },
        quartos: { type: T.INTEGER, allowNull: true },
        diasAnuncio: { type: T.INTEGER, allowNull: true },
        qScore: { type: T.INTEGER, allowNull: true },
        raw: { type: T.JSONB, allowNull: true },
        companyId: { type: T.INTEGER, allowNull: false },
        createdAt: { type: T.DATE, allowNull: false },
        updatedAt: { type: T.DATE, allowNull: false }
      }],
      ["realty_seo_conteudos", {
        id: { type: T.INTEGER, autoIncrement: true, primaryKey: true },
        titulo: { type: T.STRING, allowNull: false },
        slug: { type: T.STRING, allowNull: true },
        keyword: { type: T.STRING, allowNull: true },
        meta: { type: T.TEXT, allowNull: true },
        corpo: { type: T.TEXT, allowNull: true },
        score: { type: T.INTEGER, allowNull: true },
        checks: { type: T.JSONB, allowNull: true },
        imovelId: { type: T.INTEGER, allowNull: true },
        companyId: { type: T.INTEGER, allowNull: false },
        createdAt: { type: T.DATE, allowNull: false },
        updatedAt: { type: T.DATE, allowNull: false }
      }]
    ];
    for (const [name, cols] of tables) {
      if (!(await tableExists(queryInterface, name))) {
        await queryInterface.createTable(name, cols);
      }
    }
  },
  down: async (queryInterface) => {
    for (const name of [
      "realty_seo_conteudos",
      "realty_imoveis_mercado",
      "realty_radarzap_leads",
      "realty_radarzap_mensagens",
      "realty_radarzap_grupos"
    ]) {
      if (await tableExists(queryInterface, name)) await queryInterface.dropTable(name);
    }
  }
};
