import api from "./api";

const crmIntegrationService = {
  getStatus: async () => {
    const { data } = await api.get("/integrations/platform/status");
    return data;
  },
  getProvider: async (provider) => {
    const { data } = await api.get(`/integrations/platform/${provider}`);
    return data;
  },
  connect: async (provider, payload) => {
    const { data } = await api.post(`/integrations/platform/${provider}/connect`, payload);
    return data;
  },
  disconnect: async (provider) => {
    const { data } = await api.delete(`/integrations/platform/${provider}`);
    return data;
  },
  test: async (provider, payload = {}) => {
    const { data } = await api.post(`/integrations/platform/${provider}/test`, payload);
    return data;
  },
  getOAuthMeta: async (provider) => {
    const { data } = await api.get(`/integrations/platform/${provider}/oauth/meta`);
    return data;
  },
  getOAuthAuthorizeUrl: async (provider) => {
    const frontendUrl = window.location.origin.replace(/\/$/, "");
    const backendUrl = String(api.defaults.baseURL || "")
      .replace(/\/$/, "")
      || `${window.location.protocol}//${window.location.hostname}:3000`;
    const { data } = await api.get(`/integrations/platform/${provider}/oauth/authorize`, {
      params: { frontendUrl, backendUrl }
    });
    return data;
  },
  getSupabasePendingProjects: async (token) => {
    const { data } = await api.get("/integrations/platform/supabase/oauth/pending", {
      params: { token }
    });
    return data;
  },
  finalizeSupabaseProject: async (token, projectRef) => {
    const { data } = await api.post("/integrations/platform/supabase/oauth/finalize", {
      token,
      projectRef
    });
    return data;
  },
  saveMetadata: async (provider, payload) => {
    const { data } = await api.patch(`/integrations/platform/${provider}/metadata`, payload);
    return data;
  },
  sync: async ({ provider, direction, pageKey, internalIds }) => {
    const { data } = await api.post(
      "/integrations/platform/sync",
      {
        provider,
        direction,
        pageKey,
        internalIds: Array.isArray(internalIds) && internalIds.length ? internalIds : undefined
      },
      { timeout: 120000 }
    );
    return data;
  },
  summarizeImportResults(data) {
    const rows = Array.isArray(data?.results) ? data.results : [];
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors = [];
    rows.forEach((row) => {
      created += Number(row.created || 0);
      updated += Number(row.updated || 0);
      skipped += Number(row.skipped || 0);
      (row.errors || []).forEach((err) => errors.push(String(err)));
    });
    return { created, updated, skipped, errors, rows };
  },
  buildImportToast(summary, entityLabel = "registros") {
    if (!summary) return "Importação concluída.";
    const parts = [];
    if (summary.created) parts.push(`${summary.created} novo(s)`);
    if (summary.updated) parts.push(`${summary.updated} atualizado(s)`);
    if (!parts.length && !summary.errors.length) {
      return `Nenhum ${entityLabel} novo para importar.`;
    }
    if (summary.errors.length) {
      const first = summary.errors[0];
      if (!parts.length) return first;
      return `${parts.join(", ")}. ${first}`;
    }
    return `${parts.join(", ")} importado(s).`;
  },
  buildExportToast(summary, entityLabel = "registros") {
    if (!summary) return "Exportação concluída.";
    const parts = [];
    if (summary.created) parts.push(`${summary.created} enviado(s)`);
    if (summary.updated) parts.push(`${summary.updated} atualizado(s)`);
    if (!parts.length && !summary.errors.length) {
      return `Nenhum ${entityLabel} novo para exportar.`;
    }
    if (summary.errors.length) {
      const first = summary.errors[0];
      const extra =
        summary.errors.length > 1 ? ` (+${summary.errors.length - 1} aviso(s))` : "";
      return `${parts.join(", ") || "Exportação parcial"}. ${first}${extra}`;
    }
    return `${parts.join(", ")} para o CRM externo.`;
  }
};

export default crmIntegrationService;
