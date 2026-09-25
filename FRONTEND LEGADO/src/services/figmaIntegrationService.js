import api from "./api";

const figmaIntegrationService = {
  getIntegration: async () => {
    const { data } = await api.get("/integrations/figma");
    return data;
  },
  createIntegration: async (payload) => {
    const { data } = await api.post("/integrations/figma", payload);
    return data;
  },
  saveIntegration: async (payload) => {
    const { data } = await api.put("/integrations/figma", payload);
    return data;
  },
  testIntegration: async (payload) => {
    const { data } = await api.post("/integrations/figma/test", payload);
    return data;
  },
};

export default figmaIntegrationService;
