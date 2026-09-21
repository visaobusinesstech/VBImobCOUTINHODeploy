# Mapa do CRM: Radar (`project/`) + VB Solution nativo

O arquivo **não** lista só o imobiliário. O VB Solution já tinha tickets, prompts, integrações, calendário, campanhas etc. Elas **continuam no sistema**. Agora também aparecem no **menu principal** (lado esquerdo), além da faixa de baixo (Atendimento / Agente IA / Integrações).

---

## 1. Telas nativas do VB Solution (o que você perguntou)

| O que você procura | Menu | URL |
|---|---|---|
| **Tickets / atendimento WhatsApp** | Tickets (também o botão **Atendimento** embaixo) | `/tickets` |
| **Agentes de IA / prompts** | Agente IA / Prompts | `/prompts` |
| **Brain.AI** | Brain.AI | `/brain-ai` |
| **Integrações (WhatsApp, canais)** | Integrações (conexões) | `/connections` |
| **Integrações de filas (n8n, Dialogflow, typebot…)** | Integrações de filas | `/integrations` (igual `/queue-integration`) |
| **Calendário / agendamentos** | Calendário / Agendamentos | `/schedules` |
| **Agenda imobiliária** (follow-ups + visitas) | Agenda | `/agenda` |
| **Respostas rápidas** | Respostas rápidas | `/quick-messages` |
| **Campanhas** | Campanhas | `/campaigns` |
| **Filas e chatbot** | Filas & Chatbot | `/queues` |
| **Kanban de tickets** | Kanban | `/Kanban` |
| **Relatórios** | Relatórios | `/reports` |
| **Financeiro** | Financeiro | `/financeiro` |
| **Etiquetas** | Etiquetas | `/tags` |
| **Email** | Email | `/email` |
| **Flow builder / automações de fluxo** | Flow builder | `/flowbuilders` |
| **Usuários** | Usuários | `/users` |
| **Configurações** | Configurações | `/settings` |
| **Contatos** | Contatos (se o perfil tiver permissão) | `/contacts` |
| **Dashboard WhatsApp** | dentro de Atendimento (embaixo) | `/whatsapp-dashboard` |
| **Config de campanhas** | URL | `/campaigns-config` |
| **Avisos** | URL | `/announcements` |
| **Chat interno** | URL | `/chats` |
| **Arquivos** | URL | `/files` |
| **API / MCP** | Mais → API & MCP | `/platform-api` |

Nada disso foi removido das **rotas**. Antes algumas só apareciam embaixo ou dentro de “Atendimento”, por isso parecia que “sumiram” do mapa do Radar.

---

## 2. Rotas do `project/` (Radar) → VB Solution

| Rota no `project/` | Rota no VBSolution |
|---|---|
| `/dashboard` | `/dashboard` e `/` |
| `/pipeline` | `/pipeline` + `/leads-sales` |
| `/imoveis` `/comparativo` `/propostas` `/followups` | iguais |
| `/corretores` | `/corretores` + `/users` |
| `/produtividade` `/relatorios-agendados` `/prospeccao` | iguais (`/prospeccao-diaria` também) |
| `/automacoes` `/automacoes-followup` `/nutricao` | iguais (`/flowbuilders` é o flow nativo do VB) |
| `/financeiro` | `/financeiro` |
| `/inadimplencia` `/contratos` `/proprietarios` `/relacionamento` | iguais |
| `/whatsapp` | `/whatsapp` + **`/tickets`** + `/connections` |
| `/agenda` | `/agenda` + **`/schedules`** |
| `/avaliacao` `/inteligencia` `/conteudo-seo` `/captacao` | iguais |
| `/curadoria-viral` | `/curadoria` e `/curadoria-viral` |
| `/captacao-pipeline` | `/pipeline-captacao` e `/captacao-pipeline` |
| `/crm-condominios` | `/condominios` e `/crm-condominios` |
| `/monitoramento` `/radarzap` + scoring/onboarding/status/acessos | iguais |
| `/fila-distribuicao` `/jornada` `/leads-landing` | iguais |
| `/integracao-portais` | `/portais` e `/integracao-portais` |
| `/qcapture` | `/qcapture` |
| `/configurar-ia` | `/configurar-ia` **e** `/prompts` + `/brain-ai` |
| `/configuracoes` | `/settings` + `/configuracoes-imobiliaria` |
| `/usuarios` | `/users` |
| `/feed` | `/feed` |

Auth Vite (`/auth`) = **Login** do VB (`/login`).
