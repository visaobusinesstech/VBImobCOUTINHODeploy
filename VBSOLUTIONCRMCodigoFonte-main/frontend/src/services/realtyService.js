/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 */

import api from "./api";

const realtyService = {
  async listImoveis(params) {
    const { data } = await api.get("/imoveis", { params });
    return data;
  },
  async createImovel(payload) {
    const { data } = await api.post("/imoveis", payload);
    return data;
  },
  async updateImovel(id, payload) {
    const { data } = await api.put(`/imoveis/${id}`, payload);
    return data;
  },
  async deleteImovel(id) {
    const { data } = await api.delete(`/imoveis/${id}`);
    return data;
  },
  async matchImoveis(leadId) {
    const { data } = await api.get("/imoveis/match", { params: { leadId } });
    return data;
  },
  async sendMatchWhatsApp(leadId, imovelIds) {
    const { data } = await api.post("/imoveis/match/enviar-whatsapp", {
      leadId,
      imovelIds,
    });
    return data;
  },
  async listProprietarios(params) {
    const { data } = await api.get("/proprietarios", { params });
    return data;
  },
  async createProprietario(payload) {
    const { data } = await api.post("/proprietarios", payload);
    return data;
  },
  async updateProprietario(id, payload) {
    const { data } = await api.put(`/proprietarios/${id}`, payload);
    return data;
  },
  async deleteProprietario(id) {
    const { data } = await api.delete(`/proprietarios/${id}`);
    return data;
  },
  async listContratos(params) {
    const { data } = await api.get("/contratos", { params });
    return data;
  },
  async createContrato(payload) {
    const { data } = await api.post("/contratos", payload);
    return data;
  },
  async updateContrato(id, payload) {
    const { data } = await api.put(`/contratos/${id}`, payload);
    return data;
  },
  async deleteContrato(id) {
    const { data } = await api.delete(`/contratos/${id}`);
    return data;
  },
  async listFollowups(params) {
    const { data } = await api.get("/realty-followups", { params });
    return data;
  },
  async createFollowup(payload) {
    const { data } = await api.post("/realty-followups", payload);
    return data;
  },
  async updateFollowup(id, payload) {
    const { data } = await api.put(`/realty-followups/${id}`, payload);
    return data;
  },
  async deleteFollowup(id) {
    const { data } = await api.delete(`/realty-followups/${id}`);
    return data;
  },
  async listVisitas(params) {
    const { data } = await api.get("/realty-visitas", { params });
    return data;
  },
  async createVisita(payload) {
    const { data } = await api.post("/realty-visitas", payload);
    return data;
  },
  async updateVisita(id, payload) {
    const { data } = await api.put(`/realty-visitas/${id}`, payload);
    return data;
  },
  async deleteVisita(id) {
    const { data } = await api.delete(`/realty-visitas/${id}`);
    return data;
  },
  async listPropostas(params) {
    const { data } = await api.get("/realty-propostas", { params });
    return data;
  },
  async createProposta(payload) {
    const { data } = await api.post("/realty-propostas", payload);
    return data;
  },
  async updateProposta(id, payload) {
    const { data } = await api.put(`/realty-propostas/${id}`, payload);
    return data;
  },
  async deleteProposta(id) {
    const { data } = await api.delete(`/realty-propostas/${id}`);
    return data;
  },
  async leadTimeline(leadId) {
    const { data } = await api.get("/realty-jornada", { params: { leadId } });
    return data;
  },
  async listNutricao(params) {
    const { data } = await api.get("/realty-nutricao", { params });
    return data;
  },
  async createNutricao(payload) {
    const { data } = await api.post("/realty-nutricao", payload);
    return data;
  },
  async updateNutricao(id, payload) {
    const { data } = await api.put(`/realty-nutricao/${id}`, payload);
    return data;
  },
  async deleteNutricao(id) {
    const { data } = await api.delete(`/realty-nutricao/${id}`);
    return data;
  },
  async listProspeccao(params) {
    const { data } = await api.get("/realty-prospeccao", { params });
    return data;
  },
  async createProspeccao(payload) {
    const { data } = await api.post("/realty-prospeccao", payload);
    return data;
  },
  async updateProspeccao(id, payload) {
    const { data } = await api.put(`/realty-prospeccao/${id}`, payload);
    return data;
  },
  async deleteProspeccao(id) {
    const { data } = await api.delete(`/realty-prospeccao/${id}`);
    return data;
  },
  async listAutomacaoFollowup(params) {
    const { data } = await api.get("/realty-automacao-followup", { params });
    return data;
  },
  async createAutomacaoFollowup(payload) {
    const { data } = await api.post("/realty-automacao-followup", payload);
    return data;
  },
  async updateAutomacaoFollowup(id, payload) {
    const { data } = await api.put(`/realty-automacao-followup/${id}`, payload);
    return data;
  },
  async deleteAutomacaoFollowup(id) {
    const { data } = await api.delete(`/realty-automacao-followup/${id}`);
    return data;
  },
  async runAutomacaoFollowup() {
    const { data } = await api.post("/realty-automacao-followup/run");
    return data;
  },
  async getFilaConfig() {
    const { data } = await api.get("/realty-fila-config");
    return data;
  },
  async saveFilaConfig(payload) {
    const { data } = await api.put("/realty-fila-config", payload);
    return data;
  },
  async assignFilaLead(leadId, userId) {
    const { data } = await api.post("/realty-fila/assign", { leadId, userId });
    return data;
  },
  async sendComparativoWhatsApp(leadId, imovelIds) {
    const { data } = await api.post("/imoveis/comparativo/enviar-whatsapp", {
      leadId,
      imovelIds,
    });
    return data;
  },
};

export default realtyService;
