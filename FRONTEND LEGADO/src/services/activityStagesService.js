import api from "./api";

const activityStagesService = {
  async list() {
    const { data } = await api.get("/activity-stages");
    return data;
  },
  async bulkSave(stages) {
    const { data } = await api.put("/activity-stages/bulk", { stages });
    return data;
  }
};

export default activityStagesService;
