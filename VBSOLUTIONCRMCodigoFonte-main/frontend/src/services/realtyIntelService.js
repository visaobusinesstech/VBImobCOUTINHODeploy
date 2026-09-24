/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 */

import api from "./api";

const realtyIntelService = {
  listGrupos: async () => (await api.get("/radarzap/grupos")).data,
  createGrupo: async (payload) => (await api.post("/radarzap/grupos", payload)).data,
  deleteGrupo: async (id) => (await api.delete(`/radarzap/grupos/${id}`)).data,
  listMensagens: async () => (await api.get("/radarzap/mensagens")).data,
  analisar: async (payload) => (await api.post("/radarzap/analisar", payload)).data,
  listRadarLeads: async () => (await api.get("/radarzap/leads")).data,
  converterLead: async (id) => (await api.post(`/radarzap/leads/${id}/converter`)).data,
  listMercado: async () => (await api.get("/mercado")).data,
  scrape: async (payload) => (await api.post("/mercado/scrape", payload, { timeout: 120000 })).data,
  salvarMercado: async (imoveis) => (await api.post("/mercado", { imoveis })).data,
  importarImovel: async (id) => (await api.post(`/mercado/${id}/importar`)).data,
  qcapture: async () => (await api.get("/qcapture")).data,
  listSeo: async () => (await api.get("/seo")).data,
  gerarSeo: async (payload) => (await api.post("/seo/gerar", payload)).data,
  salvarSeo: async (payload) => (await api.post("/seo", payload)).data,
  listModulos: async (kind) => (await api.get("/realty-modulos", { params: { kind } })).data,
  createModulo: async (payload) => (await api.post("/realty-modulos", payload)).data,
  updateModulo: async (id, payload) => (await api.put(`/realty-modulos/${id}`, payload)).data,
  deleteModulo: async (id) => (await api.delete(`/realty-modulos/${id}`)).data,
  avaliar: async (payload) => (await api.post("/avaliacao", payload)).data,
  jornada: async () => (await api.get("/jornada")).data,
  inteligencia: async () => (await api.get("/inteligencia")).data,
  dashboard: async () => (await api.get("/realty-dashboard")).data,
  seedDemo: async () => (await api.post("/realty-seed-demo")).data,
};

export default realtyIntelService;
