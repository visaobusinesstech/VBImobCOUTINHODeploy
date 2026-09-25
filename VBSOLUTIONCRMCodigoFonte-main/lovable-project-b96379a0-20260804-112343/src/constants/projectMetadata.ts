export const PROJECT_METADATA = {
  name: "Radar Proptech CRM",
  version: "1.0.0",
  description: "Ecossistema completo de gestão imobiliária focado em IA e automação.",
  technologies: [
    "React 18",
    "Vite",
    "TypeScript",
    "Tailwind CSS",
    "shadcn/ui",
    "Supabase",
    "Edge Functions",
    "Framer Motion"
  ],
  modules: [
    {
      id: "dashboard",
      name: "Dashboard",
      description: "Visão 360º com métricas de leads, imóveis e financeiro.",
      icon: "LayoutDashboard"
    },
    {
      id: "pipeline",
      name: "CRM Pipeline",
      description: "Gestão visual de funil de vendas com Kanban e follow-ups.",
      icon: "Kanban"
    },
    {
      id: "imoveis",
      name: "Gestão de Imóveis",
      description: "Catálogo completo com fotos, filtros avançados e status.",
      icon: "Building2"
    },
    {
      id: "qcapture",
      name: "Q-Capture (Scraping)",
      description: "Monitoramento de portais de terceiros para captação automática.",
      icon: "Search"
    },
    {
      id: "financeiro",
      name: "Financeiro",
      description: "Controle de comissões, aluguéis e despesas operacionais.",
      icon: "DollarSign"
    },
    {
      id: "contratos",
      name: "Contratos",
      description: "Gestão de assinaturas, vistorias e correções monetárias.",
      icon: "FileText"
    },
    {
      id: "automacoes",
      name: "Automações",
      description: "Fluxos automáticos para WhatsApp e e-mail.",
      icon: "Zap"
    },
    {
      id: "ai",
      name: "Inteligência Artificial",
      description: "Geração de textos e análises de mercado via IA.",
      icon: "Sparkles"
    }
  ],
  features: [
    "Multi-tenancy com isolamento total via RLS",
    "Notificações em tempo real",
    "Gestão de permissões por usuário",
    "Backup automático e segurança via Supabase Cloud"
  ]
};
