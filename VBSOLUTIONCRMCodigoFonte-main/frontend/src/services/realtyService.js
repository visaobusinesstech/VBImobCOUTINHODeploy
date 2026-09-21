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
};

export default realtyService;
