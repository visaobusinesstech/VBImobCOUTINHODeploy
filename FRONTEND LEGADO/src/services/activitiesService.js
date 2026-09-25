import api from "./api";

const activitiesService = {
  list: async (params) => {
    const { data } = await api.get("/activities", { params });
    return data;
  },
  create: async (data) => {
    const response = await api.post("/activities", data);
    return response.data;
  },
  update: async (id, data) => {
    const response = await api.put(`/activities/${id}`, data);
    return response.data;
  },
  delete: async (id) => {
    const response = await api.delete(`/activities/${id}`);
    return response.data;
  },
};

export default activitiesService;
