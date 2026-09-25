# 🚀 Radar Proptech CRM — Ecossistema Imobiliário Inteligente

O **Radar Proptech CRM** é uma solução completa de gestão para imobiliárias e corretores autônomos, focada em automação, inteligência artificial e produtividade. Construído com as tecnologias mais modernas, o sistema centraliza desde a captação de leads até a gestão financeira e de contratos.

## 📱 Visão Geral do Sistema

O projeto é dividido em diversos módulos estratégicos que cobrem toda a jornada do corretor e do cliente:

### 1. CRM & Pipeline de Vendas
- **Funil de Vendas (Kanban):** Gestão visual de leads em estágios personalizáveis (Novos, Contato, Visita, Proposta, Fechado/Perdido).
- **Follow-ups Inteligentes:** Agendamento e histórico de interações com lembretes automáticos.
- **Linha do Tempo (Jornada):** Histórico completo de todas as atividades de um lead em um único local.

### 2. Gestão de Imóveis & Captação
- **Inventário Detalhado:** Cadastro completo de imóveis com fotos, características técnicas e status.
- **Q-Capture (Web Scraping):** Monitoramento automático de portais (OLX, Zap Imóveis, Viva Real, etc.) para identificar novas oportunidades e preços de mercado.
- **Integração com Portais:** Facilidade para publicar e gerenciar anúncios.

### 3. Módulos Administrativos & Financeiros
- **Financeiro:** Controle de entradas (comissões, aluguéis) e saídas (marketing, operacional) com status de pagamento.
- **Contratos:** Gestão de rascunhos, assinaturas, índices de correção (IGP-M/IPCA) e vistorias (entrada/vídeo).
- **Gestão de Corretores:** Controle de acessos e permissões por módulo para cada membro da equipe.
- **Proprietários:** Base de dados centralizada de proprietários vinculada aos seus respectivos imóveis.

### 4. Inteligência & Automação
- **IA Generativa:** Geração de mensagens personalizadas para clientes e descrições otimizadas para imóveis.
- **Automações (Zapier-style):** Mais de 20 fluxos pré-configurados para comunicação via WhatsApp e e-mail.
- **Agenda Inteligente:** Calendário com visualização em grade e sincronização de compromissos.

---

## 🛠️ Stack Tecnológica

- **Frontend:** React 18 + Vite + TypeScript
- **Estilização:** Tailwind CSS + shadcn/ui
- **Estado & Queries:** @tanstack/react-query
- **Backend (BaaS):** Supabase (PostgreSQL, Auth, Storage, Realtime)
- **Serverless:** Edge Functions (Deno) para integrações e IA
- **Animações:** Framer Motion

---

## 📂 Estrutura de Arquivos Principal

- `/src/pages`: Telas principais do sistema (Dashboard, Pipeline, Imóveis, etc.)
- `/src/components`: Componentes reutilizáveis de UI e lógica.
- `/supabase`: Configurações de banco de dados, políticas de segurança (RLS) e Edge Functions.
- `/src/hooks`: Lógica de dados customizada para interagir com o Supabase.

## 🚀 Como Executar Localmente

1. Clone o repositório.
2. Instale as dependências: `npm install` ou `bun install`.
3. Configure o arquivo `.env` com suas credenciais do Supabase.
4. Inicie o servidor: `npm run dev`.

---

**Radar Proptech CRM** — Elevando o patamar do mercado imobiliário com tecnologia de ponta.
