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
  async uploadImovelMedia(files) {
    const formData = new FormData();
    formData.append("typeArch", "imoveis");
    (files || []).forEach((file) => formData.append("file", file));
    const { data } = await api.post("/imoveis/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
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
  async getProprietario(id) {
    const { data } = await api.get(`/proprietarios/${id}`);
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
  async uploadProprietarioMedia(files) {
    const formData = new FormData();
    formData.append("typeArch", "proprietarios");
    (files || []).forEach((file) => formData.append("file", file));
    const { data } = await api.post("/proprietarios/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
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
  async uploadContratoMedia(files) {
    const formData = new FormData();
    formData.append("typeArch", "contratos");
    (files || []).forEach((file) => formData.append("file", file));
    const { data } = await api.post("/contratos/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },
  async listContratoAnexosAnuais(contratoId) {
    const { data } = await api.get(`/contratos/${contratoId}/anexos-anuais`);
    return data;
  },
  async createContratoAnexoAnual(contratoId, payload) {
    const { data } = await api.post(`/contratos/${contratoId}/anexos-anuais`, payload);
    return data;
  },
  async updateContratoAnexoAnual(contratoId, anexoId, payload) {
    const { data } = await api.put(`/contratos/${contratoId}/anexos-anuais/${anexoId}`, payload);
    return data;
  },
  async deleteContratoAnexoAnual(contratoId, anexoId) {
    const { data } = await api.delete(`/contratos/${contratoId}/anexos-anuais/${anexoId}`);
    return data;
  },
  async listContratoComprovantesMensais(contratoId) {
    const { data } = await api.get(`/contratos/${contratoId}/comprovantes-mensais`);
    return data;
  },
  async createContratoComprovanteMensal(contratoId, payload) {
    const { data } = await api.post(`/contratos/${contratoId}/comprovantes-mensais`, payload);
    return data;
  },
  async updateContratoComprovanteMensal(contratoId, compId, payload) {
    const { data } = await api.put(
      `/contratos/${contratoId}/comprovantes-mensais/${compId}`,
      payload
    );
    return data;
  },
  async deleteContratoComprovanteMensal(contratoId, compId) {
    const { data } = await api.delete(`/contratos/${contratoId}/comprovantes-mensais/${compId}`);
    return data;
  },
  async listFollowups(params) {
    const { data } = await api.get("/realty-followups", { params });
    return data;
  },
  async getFollowupCounts(params) {
    const { data } = await api.get("/realty-followups/counts", { params });
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
  async sendFollowupWhatsApp(id, payload = {}) {
    const { data } = await api.post(`/realty-followups/${id}/enviar-whatsapp`, payload);
    return data;
  },
  async concluirFollowupsInativos() {
    const { data } = await api.post("/realty-followups/concluir-inativos");
    return data;
  },
  async listFollowupTemplates(params) {
    const { data } = await api.get("/realty-followup-templates", { params });
    return data;
  },
  async createFollowupTemplate(payload) {
    const { data } = await api.post("/realty-followup-templates", payload);
    return data;
  },
  async updateFollowupTemplate(id, payload) {
    const { data } = await api.put(`/realty-followup-templates/${id}`, payload);
    return data;
  },
  async deleteFollowupTemplate(id) {
    const { data } = await api.delete(`/realty-followup-templates/${id}`);
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
  async listCompromissos(params) {
    const { data } = await api.get("/realty-compromissos", { params });
    return data;
  },
  async createCompromisso(payload) {
    const { data } = await api.post("/realty-compromissos", payload);
    return data;
  },
  async updateCompromisso(id, payload) {
    const { data } = await api.put(`/realty-compromissos/${id}`, payload);
    return data;
  },
  async deleteCompromisso(id) {
    const { data } = await api.delete(`/realty-compromissos/${id}`);
    return data;
  },
  async gerarConfirmacaoCompromisso(id) {
    const { data } = await api.post(`/realty-compromissos/${id}/gerar-confirmacao`);
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
  async sendNutricaoWhatsApp(id) {
    const { data } = await api.post(`/realty-nutricao/${id}/enviar-whatsapp`);
    return data;
  },
  async processNutricao(body) {
    const { data } = await api.post("/realty-nutricao/processar", body || {});
    return data;
  },
  async listNutricaoDashboard() {
    const { data } = await api.get("/realty-nutricao/dashboard");
    return data;
  },
  async createNutricaoFluxo(payload) {
    const { data } = await api.post("/realty-nutricao/fluxos", payload);
    return data;
  },
  async updateNutricaoFluxo(id, payload) {
    const { data } = await api.put(`/realty-nutricao/fluxos/${id}`, payload);
    return data;
  },
  async deleteNutricaoFluxo(id) {
    const { data } = await api.delete(`/realty-nutricao/fluxos/${id}`);
    return data;
  },
  async toggleNutricaoFluxo(id, ativo) {
    const { data } = await api.patch(`/realty-nutricao/fluxos/${id}/toggle`, { ativo });
    return data;
  },
  async enviarNutricaoEnvio(id) {
    const { data } = await api.post(`/realty-nutricao/envios/${id}/enviar`);
    return data;
  },
  async updateNutricaoEnvioStatus(id, status) {
    const { data } = await api.patch(`/realty-nutricao/envios/${id}/status`, { status });
    return data;
  },
  async encerrarNutricaoInscricao(id) {
    const { data } = await api.post(`/realty-nutricao/inscricoes/${id}/encerrar`);
    return data;
  },
  async registrarNutricaoEvento(payload) {
    const { data } = await api.post("/realty-nutricao/eventos", payload);
    return data;
  },
  async aplicarAbVencedor(etapaId, vencedor) {
    const { data } = await api.post(`/realty-nutricao/etapas/${etapaId}/ab-vencedor`, {
      vencedor,
    });
    return data;
  },
  async reabrirAb(etapaId) {
    const { data } = await api.post(`/realty-nutricao/etapas/${etapaId}/ab-reabrir`);
    return data;
  },
  async getNutricaoMetas() {
    const { data } = await api.get("/realty-nutricao/metas");
    return data;
  },
  async saveNutricaoMetas(payload) {
    const { data } = await api.put("/realty-nutricao/metas", payload);
    return data;
  },
  async verificarNutricaoMetas() {
    const { data } = await api.post("/realty-nutricao/metas/verificar");
    return data;
  },
  async resolverNutricaoAlerta(id) {
    const { data } = await api.patch(`/realty-nutricao/metas/alertas/${id}/resolver`);
    return data;
  },
  async sugerirMensagemNutricao(payload) {
    const { data } = await api.post("/realty-nutricao/ia/sugerir-mensagem", payload);
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
  async listProspeccaoDiaria(params) {
    const { data } = await api.get("/realty-prospeccao-diaria", { params });
    return data;
  },
  async upsertProspeccaoDiaria(payload) {
    const { data } = await api.post("/realty-prospeccao-diaria/upsert", payload);
    return data;
  },
  async deleteProspeccaoDiaria(id) {
    const { data } = await api.delete(`/realty-prospeccao-diaria/${id}`);
    return data;
  },
  async listTransacoes(params) {
    const { data } = await api.get("/realty-transacoes", { params });
    return data;
  },
  async createTransacao(payload) {
    const { data } = await api.post("/realty-transacoes", payload);
    return data;
  },
  async updateTransacao(id, payload) {
    const { data } = await api.put(`/realty-transacoes/${id}`, payload);
    return data;
  },
  async deleteTransacao(id) {
    const { data } = await api.delete(`/realty-transacoes/${id}`);
    return data;
  },
  async getInadimplencia() {
    const { data } = await api.get("/inadimplencia");
    return data;
  },
  async gerarAlertasInadimplencia() {
    const { data } = await api.post("/inadimplencia/alertas", {});
    return data;
  },
  async listClientesRelacionamento(params) {
    const { data } = await api.get("/realty-relacionamento", { params });
    return data;
  },
  async createClienteRelacionamento(payload) {
    const { data } = await api.post("/realty-relacionamento", payload);
    return data;
  },
  async updateClienteRelacionamento(id, payload) {
    const { data } = await api.put(`/realty-relacionamento/${id}`, payload);
    return data;
  },
  async deleteClienteRelacionamento(id) {
    const { data } = await api.delete(`/realty-relacionamento/${id}`);
    return data;
  },
  async listRelacionamentoTemplates() {
    const { data } = await api.get("/realty-relacionamento/templates");
    return data;
  },
  async upsertRelacionamentoTemplate(payload) {
    const { data } = await api.post("/realty-relacionamento/templates", payload);
    return data;
  },
  async gerarMensagensRelacionamentoIa(payload) {
    const { data } = await api.post("/realty-relacionamento/ia/gerar-mensagens", payload);
    return data;
  },
  async listCaptacoes(params) {
    const { data } = await api.get("/realty-captacoes", { params });
    return data;
  },
  async createCaptacao(payload) {
    const { data } = await api.post("/realty-captacoes", payload);
    return data;
  },
  async updateCaptacao(id, payload) {
    const { data } = await api.put(`/realty-captacoes/${id}`, payload);
    return data;
  },
  async deleteCaptacao(id) {
    const { data } = await api.delete(`/realty-captacoes/${id}`);
    return data;
  },
  async hubCondominios(params) {
    const { data } = await api.get("/realty-condominios/hub", { params });
    return data;
  },
  async listCondominioIniciativas(params) {
    const { data } = await api.get("/realty-condominio-iniciativas", { params });
    return data;
  },
  async createCondominioIniciativa(payload) {
    const { data } = await api.post("/realty-condominio-iniciativas", payload);
    return data;
  },
  async updateCondominioIniciativa(id, payload) {
    const { data } = await api.put(`/realty-condominio-iniciativas/${id}`, payload);
    return data;
  },
  async deleteCondominioIniciativa(id) {
    const { data } = await api.delete(`/realty-condominio-iniciativas/${id}`);
    return data;
  },
  async listCondominioIniciativaLogs(id) {
    const { data } = await api.get(`/realty-condominio-iniciativas/${id}/logs`);
    return data;
  },
  async createCondominioIniciativaLog(id, payload) {
    const { data } = await api.post(`/realty-condominio-iniciativas/${id}/logs`, payload);
    return data;
  },
  async listCondominioContatos(params) {
    const { data } = await api.get("/realty-condominio-contatos", { params });
    return data;
  },
  async createCondominioContato(payload) {
    const { data } = await api.post("/realty-condominio-contatos", payload);
    return data;
  },
  async updateCondominioContato(id, payload) {
    const { data } = await api.put(`/realty-condominio-contatos/${id}`, payload);
    return data;
  },
  async deleteCondominioContato(id) {
    const { data } = await api.delete(`/realty-condominio-contatos/${id}`);
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
  async getFilaOverview(status = "pending") {
    const { data } = await api.get("/realty-fila/overview", { params: { status } });
    return data;
  },
  async assignFilaLead(leadId, userId) {
    const { data } = await api.post("/realty-fila/assign", { leadId, userId });
    return data;
  },
  async distribuirFila() {
    const { data } = await api.post("/realty-fila/distribuir");
    return data;
  },
  async setLimiteCorretorFila(corretorId, limite) {
    const { data } = await api.put("/realty-fila/limite-corretor", {
      corretor_id: corretorId,
      limite,
    });
    return data;
  },
  async encerrarLeadFila(leadId) {
    const { data } = await api.post(`/realty-fila/${leadId}/encerrar`);
    return data;
  },
  async listCorretores() {
    const { data } = await api.get("/realty-corretores");
    return data;
  },
  async createCorretor(payload) {
    const { data } = await api.post("/realty-corretores", payload);
    return data;
  },
  async updateCorretor(id, payload) {
    const { data } = await api.put(`/realty-corretores/${id}`, payload);
    return data;
  },
  async deleteCorretor(id) {
    const { data } = await api.delete(`/realty-corretores/${id}`);
    return data;
  },
  async listCorretorPermissoes(id) {
    const { data } = await api.get(`/realty-corretores/${id}/permissoes`);
    return data;
  },
  async upsertCorretorPermissao(id, modulo, ativo) {
    const { data } = await api.put(`/realty-corretores/${id}/permissoes`, {
      modulo,
      ativo,
    });
    return data;
  },
  async getCorretoresDesempenho(periodo = "30") {
    const { data } = await api.get("/realty-corretores-desempenho", {
      params: { periodo },
    });
    return data;
  },
  async listCorretoresAtribuicao() {
    const { data } = await api.get("/realty-corretores-atribuicao");
    return data;
  },
  async createCorretorAtribuicao(payload) {
    const { data } = await api.post("/realty-corretores-atribuicao", payload);
    return data;
  },
  async updateCorretorAtribuicao(id, payload) {
    const { data } = await api.put(`/realty-corretores-atribuicao/${id}`, payload);
    return data;
  },
  async deleteCorretorAtribuicao(id) {
    const { data } = await api.delete(`/realty-corretores-atribuicao/${id}`);
    return data;
  },
  async creditCheckConsultaCpf(payload) {
    const { data } = await api.post("/realty-consulta-cpf/credit-check", payload);
    return data;
  },
  async listConsultaCpfHistorico(params) {
    const { data } = await api.get("/realty-consulta-cpf/historico", { params });
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
