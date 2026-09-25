import api from "./api";

const CAKTO_TIMEOUT_MS = 90000;

const caktoIntegrationService = {
  listConnections: async () => {
    const { data } = await api.get("/integrations/cakto");
    return data;
  },

  /** @deprecated use listConnections */
  getIntegration: async (integrationId) => {
    if (integrationId) {
      const { data } = await api.get(`/integrations/cakto/${integrationId}`);
      return data;
    }
    const { data } = await api.get("/integrations/cakto");
    const connections = data?.connections || [];
    const connected = connections.find((c) => c.connected);
    if (connected) return connected;
    return {
      connected: false,
      connections,
      count: data?.count ?? 0,
    };
  },

  getConnection: async (integrationId) => {
    const { data } = await api.get(`/integrations/cakto/${integrationId}`);
    return data;
  },

  connect: async (payload) => {
    const { data } = await api.post("/integrations/cakto/connect", payload, {
      timeout: CAKTO_TIMEOUT_MS,
    });
    return data;
  },

  oauthAuthorize: async (payload) => {
    const { data } = await api.post("/integrations/cakto/oauth/authorize", payload, {
      timeout: CAKTO_TIMEOUT_MS,
    });
    return data;
  },

  disconnect: async (integrationId) => {
    const { data } = await api.delete(`/integrations/cakto/${integrationId}`);
    return data;
  },

  testIntegration: async (payload) => {
    const { data } = await api.post("/integrations/cakto/test", payload, {
      timeout: CAKTO_TIMEOUT_MS,
    });
    return data;
  },

  syncProducts: async (integrationId) => {
    const { data } = await api.post(
      `/integrations/cakto/${integrationId}/sync-products`,
      {},
      { timeout: CAKTO_TIMEOUT_MS }
    );
    return data;
  },

  saveProductMappings: async (integrationId, mappings) => {
    const { data } = await api.put(
      `/integrations/cakto/${integrationId}/product-mappings`,
      { mappings },
      { timeout: CAKTO_TIMEOUT_MS }
    );
    return data;
  },
};

export default caktoIntegrationService;
