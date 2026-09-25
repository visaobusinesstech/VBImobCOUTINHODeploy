import api from "./api";

const inventoryService = {
  list: async ({ searchParam, pageNumber }) => {
    const { data } = await api.get("/inventory", {
      params: { searchParam, pageNumber }
    });
    return data;
  },
  create: async (payload) => {
    const { data } = await api.post("/inventory", payload);
    return data;
  },
  update: async (id, payload) => {
    const { data } = await api.put(`/inventory/${id}`, payload);
    return data;
  },
  delete: async (id) => {
    const { data } = await api.delete(`/inventory/${id}`);
    return data;
  },
  bulkDelete: async (ids) => {
    const { data } = await api.post("/inventory/bulk-delete", { ids });
    return data;
  },
  bulkUpdateReplySettings: async ({ ids, replySettings }) => {
    const { data } = await api.put("/inventory/bulk-reply-settings", {
      ids,
      replySettings
    });
    return data;
  },
  importFile: async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    const { data } = await api.post("/inventory/import", formData, {
      headers: { "Content-Type": "multipart/form-data" }
    });
    return data;
  }
};

export default inventoryService;
