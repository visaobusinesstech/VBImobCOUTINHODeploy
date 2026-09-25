/**
 * Seed de demonstração desativado — não criar dados fictícios em produção.
 */

export type DemoModulo = {
  kind: string;
  title: string;
  status?: string;
  value?: number;
  notes?: string;
  payload?: Record<string, unknown>;
};

/** Títulos conhecidos do seed antigo (para limpeza / migração). */
export const REALTY_DEMO_TITLES: string[] = [
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

export const REALTY_DEMO_ROWS: DemoModulo[] = [];

export const DEMO_BY_KIND: Record<string, DemoModulo[]> = {};
