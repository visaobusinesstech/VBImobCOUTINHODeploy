"use strict";
/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Remove dados mockados/demo de realty_modulos e renomeia appName para Radar CRM.
 */

async function tableExists(queryInterface, table) {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = :table LIMIT 1`,
    { replacements: { table } }
  );
  return Array.isArray(rows) && rows.length > 0;
}

const DEMO_TITLES = [
  "Maria Silva",
  "João Pereira",
  "Ana Costa",
  "Apto 3qts — Vila Mariana",
  "Casa sobrado — Moema",
  "Carlos Mendes",
  "Fernanda Lima",
  "Residencial Parque Verde",
  "Cliente VIP — Família Souza",
  "Boas-vindas lead LP",
  "Template — 1º contato LP",
  "Pinheiros — alta demanda 2qts",
  "Configuração padrão",
  "Contrato #104 — atraso aluguel",
  "Tour virtual — lançamento Moema",
  "Pedido acesso — titular João",
  "Alerta Zap — queda de preço Moema",
  "Reel — before/after reforma",
  "Opt-in marketing — Maria Silva",
  "Sinal proposta #12"
];

module.exports = {
  up: async (queryInterface) => {
    if (await tableExists(queryInterface, "realty_modulos")) {
      await queryInterface.sequelize.query(
        `DELETE FROM realty_modulos
          WHERE title IN (:titles)
             OR (kind = 'corretor' AND (
               payload::text ILIKE '%carlos@imobiliaria.com%'
               OR payload::text ILIKE '%fernanda@imobiliaria.com%'
             ))`,
        { replacements: { titles: DEMO_TITLES } }
      );
    }

    if (await tableExists(queryInterface, "Settings")) {
      await queryInterface.sequelize.query(
        `UPDATE "Settings"
            SET value = 'Radar CRM'
          WHERE key = 'appName'
            AND (value IS NULL OR value = '' OR value ILIKE '%Visão Business%' OR value ILIKE '%VB Solution%')`
      );
    }

    if (await tableExists(queryInterface, "settings")) {
      await queryInterface.sequelize.query(
        `UPDATE settings
            SET value = 'Radar CRM'
          WHERE key = 'appName'
            AND (value IS NULL OR value = '' OR value ILIKE '%Visão Business%' OR value ILIKE '%VB Solution%')`
      );
    }
  },

  down: async () => {
    // Dados mockados não são restaurados.
  }
};
