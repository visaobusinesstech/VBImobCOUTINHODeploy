/** Integrações disponíveis no modal Importar */
export const CRM_SYNC_PROVIDERS = [
  { key: "hubspot", label: "HubSpot", oauth: true },
  { key: "clickup", label: "ClickUp", oauth: true },
  { key: "pipedrive", label: "Pipedrive", oauth: true },
  { key: "notion", label: "Notion", oauth: true, importOnly: true }
];

/** Módulos do CRM VBSolution cobertos pelo sync */
export const CRM_SYNC_MODULE_KEYS = [
  "leads",
  "companies",
  "converted_leads",
  "activities",
  "projects",
  "inventory",
  "calendar"
];

/** Texto curto para documentação (sidebar, catálogo, modal) */
export const CRM_MODULES_DOC =
  "Leads e Vendas, Empresas (leads convertidos), Atividades, Projetos e Inventário";

export const CRM_IMPORT_EXPORT_DOC =
  "Importe dados do CRM externo para cada módulo correspondente do VBSolution.";

/** Providers com OAuth popup em Integrações → Conexões */
export const CRM_OAUTH_PROVIDERS = new Set([
  "hubspot",
  "pipedrive",
  "clickup",
  "notion",
  "supabase"
]);

export function supportsCrmOAuth(provider) {
  return CRM_OAUTH_PROVIDERS.has(provider);
}

/** Exportação por módulo × CRM (false = não suportado no adapter) */
export const CRM_EXPORT_SUPPORT = {
  activities: { hubspot: true, clickup: true, pipedrive: true, notion: false },
  leads: { hubspot: true, clickup: false, pipedrive: true, notion: false },
  projects: { hubspot: false, clickup: true, pipedrive: true, notion: false },
  inventory: { hubspot: false, clickup: false, pipedrive: false, notion: false },
  calendar: { hubspot: false, clickup: true, pipedrive: false, notion: false },
  companies: { hubspot: true, clickup: false, pipedrive: true, notion: false },
  converted_leads: { hubspot: true, clickup: false, pipedrive: false, notion: false }
};

export function crmSupportsExport(pageKey, provider) {
  if (!provider) return false;
  const row = CRM_EXPORT_SUPPORT[pageKey];
  if (!row) return true;
  return row[provider] !== false;
}

/** Configuração por módulo da página (import/export direto via API) */
export const CRM_PAGE_CONFIG = {
  activities: {
    entity: "atividades",
    exportEntityType: "activities",
    recordLabel: (r) => r?.title || `Atividade #${r?.id}`
  },
  leads: {
    entity: "leads e deals",
    exportEntityType: "leads",
    recordLabel: (r) => r?.name || `Lead #${r?.id}`
  },
  projects: {
    entity: "projetos",
    exportEntityType: "projects",
    recordLabel: (r) => r?.name || r?.title || `Projeto #${r?.id}`
  },
  inventory: {
    entity: "produtos",
    exportEntityType: "products",
    recordLabel: (r) => r?.name || r?.title || `Produto #${r?.id}`
  },
  calendar: {
    entity: "compromissos",
    exportEntityType: "activities",
    recordLabel: (r) => r?.title || `Evento #${r?.id}`
  },
  companies: {
    entity: "contatos",
    exportEntityType: "contacts",
    recordLabel: (r) => r?.name || `Contato #${r?.id}`
  },
  converted_leads: {
    entity: "empresas",
    exportEntityType: "companies",
    recordLabel: (r) => r?.name || `Empresa #${r?.id}`
  }
};
