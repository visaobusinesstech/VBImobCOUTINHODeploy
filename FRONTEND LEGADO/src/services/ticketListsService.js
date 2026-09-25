import api from "./api";

const ticketListsService = {
  async list() {
    const { data } = await api.get("/ticket-lists");
    return data;
  },
  async create(payload) {
    const { data } = await api.post("/ticket-lists", payload);
    return data;
  },
  async update(id, payload) {
    const { data } = await api.put(`/ticket-lists/${id}`, payload);
    return data;
  },
  async remove(id) {
    const { data } = await api.delete(`/ticket-lists/${id}`);
    return data;
  },
  async listByContact(contactId) {
    const { data } = await api.get(`/ticket-lists/contact/${contactId}`);
    return data;
  },
  async syncContact(contactId, listIds) {
    const { data } = await api.post(`/ticket-lists/contact/${contactId}/sync`, {
      listIds
    });
    return data;
  },
  async addContact(listId, contactId) {
    const { data } = await api.post(`/ticket-lists/${listId}/contacts`, {
      contactId
    });
    return data;
  },
  async removeContact(listId, contactId) {
    const { data } = await api.delete(
      `/ticket-lists/${listId}/contacts/${contactId}`
    );
    return data;
  }
};

export default ticketListsService;
