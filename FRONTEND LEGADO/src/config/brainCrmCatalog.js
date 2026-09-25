export const BRAIN_CRM_MCP_OPTIONS = [
  {
    id: "hubspot",
    name: "HubSpot",
    provider: "HubSpot",
    description: "Contatos, deals, pipelines e automações de marketing no Brain.",
    accent: "#FF7A59",
  },
  {
    id: "pipedrive",
    name: "Pipedrive",
    provider: "Pipedrive",
    description: "Funis de vendas, deals e atividades comerciais no contexto do Brain.",
    accent: "#017737",
  },
  {
    id: "clickup",
    name: "ClickUp",
    provider: "ClickUp",
    description: "Listas, tarefas e entregas de projetos sincronizadas com o Brain.",
    accent: "#7B68EE",
  },
  {
    id: "notion",
    name: "Notion",
    provider: "Notion",
    description: "Páginas, bases, wikis e atividades/tarefas do workspace via MCP.",
    accent: "#000000",
  },
  {
    id: "supabase",
    name: "Supabase",
    provider: "Supabase",
    description: "Mirror opcional de dados CRM e APIs auxiliares.",
    accent: "#3ECF8E",
  },
];

export function getBrainCrmMcpById(id) {
  return BRAIN_CRM_MCP_OPTIONS.find((item) => item.id === id) || null;
}
