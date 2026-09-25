import api from "./api";

const HOTMART_TIMEOUT_MS = 90000;

const hotmartIntegrationService = {
  listConnections: async () => {
    const { data } = await api.get("/integrations/hotmart");
    return data;
  },

  getConnection: async (integrationId) => {
    const { data } = await api.get(`/integrations/hotmart/${integrationId}`);
    return data;
  },

  connect: async (payload) => {
    const { data } = await api.post("/integrations/hotmart/connect", payload, {
      timeout: HOTMART_TIMEOUT_MS,
    });
    return data;
  },

  disconnect: async (integrationId) => {
    const { data } = await api.delete(`/integrations/hotmart/${integrationId}`);
    return data;
  },

  saveProductMappings: async (integrationId, mappings) => {
    const { data } = await api.put(
      `/integrations/hotmart/${integrationId}/product-mappings`,
      { mappings },
      { timeout: HOTMART_TIMEOUT_MS }
    );
    return data;
  },
};

export default hotmartIntegrationService;
