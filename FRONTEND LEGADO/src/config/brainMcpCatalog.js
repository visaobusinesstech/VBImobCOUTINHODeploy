import { BRAIN_CRM_MCP_OPTIONS } from "./brainCrmCatalog";

export const BRAIN_MCP_OPTIONS = [
  {
    id: "google_drive",
    name: "Google Drive",
    provider: "Google",
    description: "Criar planilhas no Drive/Sheets, ler dados e enviar links ao WhatsApp.",
    accent: "#4285F4",
  },
  {
    id: "google_sheets",
    name: "Google Sheets",
    provider: "Google",
    description: "Criar e ler planilhas; salvar no Drive da conta conectada.",
    accent: "#34A853",
  },
  {
    id: "google_calendar",
    name: "Google Calendário",
    provider: "Google",
    description: "Consultar e criar eventos na agenda Google + CRM.",
    accent: "#4285F4",
  },
  {
    id: "figma",
    name: "Figma",
    provider: "Figma",
    description:
      "Protótipo navegável + export PNG/PDF/SVG; design system e Google Drive.",
    accent: "#A259FF",
  },
  {
    id: "github",
    name: "GitHub",
    provider: "GitHub",
    description: "Repos, pull requests, leitura de código e publicação do IDE Build.",
    accent: "#24292F",
  },
  {
    id: "notion",
    name: "Notion",
    provider: "Notion",
    description: "Páginas, bases, atividades e documentação interna da equipe.",
    accent: "#111111",
  },
  ...BRAIN_CRM_MCP_OPTIONS.filter((item) => item.id !== "notion"),
];

export { BRAIN_CRM_MCP_OPTIONS };

export const ALL_BRAIN_MCP_IDS = BRAIN_MCP_OPTIONS.map((item) => item.id);

export function getBrainMcpById(id) {
  return (
    BRAIN_MCP_OPTIONS.find((item) => item.id === id) ||
    BRAIN_CRM_MCP_OPTIONS.find((item) => item.id === id) ||
    null
  );
}
