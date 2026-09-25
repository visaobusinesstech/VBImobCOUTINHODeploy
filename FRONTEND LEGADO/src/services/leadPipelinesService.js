import api from "./api";

const leadPipelinesService = {
  async list() {
    const { data } = await api.get("/lead-pipelines");
    return data;
  },
  async bulkSave(pipelines) {
    const { data } = await api.post("/lead-pipelines/bulk", { pipelines }, { timeout: 90000 });
    return data;
  }
};

export default leadPipelinesService;
