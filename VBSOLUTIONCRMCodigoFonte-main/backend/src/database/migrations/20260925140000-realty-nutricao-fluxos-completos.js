"use strict";
/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Nutrição multi-etapa: fluxos, etapas, inscriçãos, envios, eventos e metas.
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

    if (!(await tableExists(queryInterface, "realty_nutricao_fluxos"))) {
      await queryInterface.createTable("realty_nutricao_fluxos", {
        id: { type: T.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
        companyId: { type: T.INTEGER, allowNull: false },
        nome: { type: T.STRING, allowNull: false },
        descricao: { type: T.TEXT, allowNull: true },
        publicoAlvo: { type: T.STRING, allowNull: true, defaultValue: "lead_sem_resposta" },
        diasInatividade: { type: T.INTEGER, allowNull: true, defaultValue: 30 },
        canal: { type: T.STRING, allowNull: true, defaultValue: "whatsapp" },
        encerrarAoResponder: { type: T.BOOLEAN, allowNull: true, defaultValue: true },
        ativo: { type: T.BOOLEAN, allowNull: true, defaultValue: true },
        segmentoEstagios: { type: T.JSONB, allowNull: true },
        segmentoPerfis: { type: T.JSONB, allowNull: true },
        segmentoMotivosPerda: { type: T.JSONB, allowNull: true },
        whatsappId: { type: T.INTEGER, allowNull: true },
        promptId: { type: T.INTEGER, allowNull: true },
        createdAt: { type: T.DATE, allowNull: false },
        updatedAt: { type: T.DATE, allowNull: false }
      });
    }

    if (!(await tableExists(queryInterface, "realty_nutricao_etapas"))) {
      await queryInterface.createTable("realty_nutricao_etapas", {
        id: { type: T.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
        companyId: { type: T.INTEGER, allowNull: false },
        fluxoId: { type: T.INTEGER, allowNull: false },
        ordem: { type: T.INTEGER, allowNull: false, defaultValue: 1 },
        diasApos: { type: T.INTEGER, allowNull: true, defaultValue: 0 },
        canal: { type: T.STRING, allowNull: true, defaultValue: "heranca" },
        titulo: { type: T.STRING, allowNull: true },
        mensagem: { type: T.TEXT, allowNull: true },
        ativo: { type: T.BOOLEAN, allowNull: true, defaultValue: true },
        abAtivo: { type: T.BOOLEAN, allowNull: true, defaultValue: false },
        abTituloB: { type: T.STRING, allowNull: true },
        abMensagemB: { type: T.TEXT, allowNull: true },
        abSplit: { type: T.INTEGER, allowNull: true, defaultValue: 50 },
        abAutoEscolher: { type: T.BOOLEAN, allowNull: true, defaultValue: true },
        abMinEnvios: { type: T.INTEGER, allowNull: true, defaultValue: 20 },
        abVencedor: { type: T.STRING, allowNull: true },
        abDecididoEm: { type: T.DATE, allowNull: true },
        createdAt: { type: T.DATE, allowNull: false },
        updatedAt: { type: T.DATE, allowNull: false }
      });
    }

    if (!(await tableExists(queryInterface, "realty_nutricao_inscricoes"))) {
      await queryInterface.createTable("realty_nutricao_inscricoes", {
        id: { type: T.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
        companyId: { type: T.INTEGER, allowNull: false },
        fluxoId: { type: T.INTEGER, allowNull: false },
        leadSaleId: { type: T.INTEGER, allowNull: true },
        nome: { type: T.STRING, allowNull: true },
        telefone: { type: T.STRING, allowNull: true },
        email: { type: T.STRING, allowNull: true },
        status: { type: T.STRING, allowNull: true, defaultValue: "ativa" },
        etapaAtual: { type: T.INTEGER, allowNull: true, defaultValue: 0 },
        proximaExecucao: { type: T.DATE, allowNull: true },
        ultimaExecucao: { type: T.DATE, allowNull: true },
        motivoEncerramento: { type: T.TEXT, allowNull: true },
        createdAt: { type: T.DATE, allowNull: false },
        updatedAt: { type: T.DATE, allowNull: false }
      });
    }

    if (!(await tableExists(queryInterface, "realty_nutricao_envios"))) {
      await queryInterface.createTable("realty_nutricao_envios", {
        id: { type: T.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
        companyId: { type: T.INTEGER, allowNull: false },
        inscricaoId: { type: T.INTEGER, allowNull: false },
        etapaId: { type: T.INTEGER, allowNull: true },
        leadSaleId: { type: T.INTEGER, allowNull: true },
        canal: { type: T.STRING, allowNull: true },
        destino: { type: T.STRING, allowNull: true },
        titulo: { type: T.STRING, allowNull: true },
        mensagem: { type: T.TEXT, allowNull: true },
        status: { type: T.STRING, allowNull: true, defaultValue: "pendente" },
        erro: { type: T.TEXT, allowNull: true },
        enviadoEm: { type: T.DATE, allowNull: true },
        variante: { type: T.STRING, allowNull: true },
        ticketId: { type: T.INTEGER, allowNull: true },
        createdAt: { type: T.DATE, allowNull: false },
        updatedAt: { type: T.DATE, allowNull: false }
      });
    }

    if (!(await tableExists(queryInterface, "realty_nutricao_eventos"))) {
      await queryInterface.createTable("realty_nutricao_eventos", {
        id: { type: T.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
        companyId: { type: T.INTEGER, allowNull: false },
        fluxoId: { type: T.INTEGER, allowNull: true },
        envioId: { type: T.INTEGER, allowNull: true },
        inscricaoId: { type: T.INTEGER, allowNull: true },
        etapaId: { type: T.INTEGER, allowNull: true },
        leadSaleId: { type: T.INTEGER, allowNull: true },
        tipo: { type: T.STRING, allowNull: false },
        canal: { type: T.STRING, allowNull: true },
        valor: { type: T.DECIMAL(14, 2), allowNull: true },
        createdAt: { type: T.DATE, allowNull: false },
        updatedAt: { type: T.DATE, allowNull: false }
      });
    }

    if (!(await tableExists(queryInterface, "realty_nutricao_metas_config"))) {
      await queryInterface.createTable("realty_nutricao_metas_config", {
        id: { type: T.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
        companyId: { type: T.INTEGER, allowNull: false },
        fluxoId: { type: T.INTEGER, allowNull: true },
        metaAbertura: { type: T.DECIMAL(8, 2), allowNull: true, defaultValue: 25 },
        metaResposta: { type: T.DECIMAL(8, 2), allowNull: true, defaultValue: 10 },
        metaAgendamento: { type: T.DECIMAL(8, 2), allowNull: true, defaultValue: 5 },
        metaFechamento: { type: T.DECIMAL(8, 2), allowNull: true, defaultValue: 1 },
        janelaDias: { type: T.INTEGER, allowNull: true, defaultValue: 14 },
        minEnvios: { type: T.INTEGER, allowNull: true, defaultValue: 10 },
        repetirAvisoHoras: { type: T.INTEGER, allowNull: true, defaultValue: 24 },
        alertarZeroAgendamento: { type: T.BOOLEAN, allowNull: true, defaultValue: true },
        alertarZeroResposta: { type: T.BOOLEAN, allowNull: true, defaultValue: true },
        notificarApp: { type: T.BOOLEAN, allowNull: true, defaultValue: true },
        monitoramentoAtivo: { type: T.BOOLEAN, allowNull: true, defaultValue: true },
        createdAt: { type: T.DATE, allowNull: false },
        updatedAt: { type: T.DATE, allowNull: false }
      });
    }

    if (!(await tableExists(queryInterface, "realty_nutricao_metas_alertas"))) {
      await queryInterface.createTable("realty_nutricao_metas_alertas", {
        id: { type: T.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
        companyId: { type: T.INTEGER, allowNull: false },
        fluxoId: { type: T.INTEGER, allowNull: true },
        tipo: { type: T.STRING, allowNull: false },
        severidade: { type: T.STRING, allowNull: true, defaultValue: "alerta" },
        mensagem: { type: T.TEXT, allowNull: true },
        resolvido: { type: T.BOOLEAN, allowNull: true, defaultValue: false },
        resolvidoEm: { type: T.DATE, allowNull: true },
        createdAt: { type: T.DATE, allowNull: false },
        updatedAt: { type: T.DATE, allowNull: false }
      });
    }
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("realty_nutricao_metas_alertas").catch(() => {});
    await queryInterface.dropTable("realty_nutricao_metas_config").catch(() => {});
    await queryInterface.dropTable("realty_nutricao_eventos").catch(() => {});
    await queryInterface.dropTable("realty_nutricao_envios").catch(() => {});
    await queryInterface.dropTable("realty_nutricao_inscricoes").catch(() => {});
    await queryInterface.dropTable("realty_nutricao_etapas").catch(() => {});
    await queryInterface.dropTable("realty_nutricao_fluxos").catch(() => {});
  }
};
