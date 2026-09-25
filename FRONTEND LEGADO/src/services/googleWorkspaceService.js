import api from "./api";

const GOOGLE_KEYS = new Set([
  "google-drive",
  "google-sheets",
  "google-calendar",
]);

export function isGoogleWorkspaceIntegrationKey(key) {
  return GOOGLE_KEYS.has(key);
}

export async function getOAuthStatus() {
  const { data } = await api.get("/google/oauth/status");
  return data;
}

export async function getAuthorizeUrl(integrationKey) {
  const { data } = await api.get("/google/oauth/authorize", {
    params: { integrationKey },
  });
  return data;
}

export async function listConnections(integrationKey) {
  const { data } = await api.get("/google/connections", {
    params: integrationKey ? { service: integrationKey } : {},
  });
  return data?.items || [];
}

export async function getConnectionCounts() {
  const { data } = await api.get("/google/connections/counts");
  return data?.counts || {};
}

export async function deleteConnection(id) {
  await api.delete(`/google/connections/${id}`);
}

export async function listCalendarEvents(connectionId, params = {}) {
  const { data } = await api.get(
    `/google/connections/${connectionId}/calendar/events`,
    { params }
  );
  return data;
}

/** Eventos do Google Calendar para a página Agendamentos (calendário unificado). */
export async function listSchedulesCalendarEvents(params = {}) {
  const { data } = await api.get("/schedules/google-calendar/events", {
    params,
  });
  return data;
}

export async function importCalendarEventToActivity(payload) {
  const { data } = await api.post("/schedules/google-calendar/import", payload);
  return data;
}
