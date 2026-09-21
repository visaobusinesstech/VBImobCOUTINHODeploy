# Menu do CRM — o que cada item é (explicação completa)

O menu esquerdo está em grupos. **Nada foi escondido de propósito:** atendimento clássico do VB Solution e módulos da imobiliária convivem.

Se um item não abre: a rota precisa estar em `frontend/src/routes/index.js` e o caminho no `crmMenuCatalog` / `MainListItems`. Testes conferem isso (`crmMenuDelivery.spec`).

Abaixo, grupo por grupo, em linguagem de quem nunca viu o sistema.

---

## Atendimento

- **Tickets / Conversas** — a caixa de entrada. Cada conversa WhatsApp (ou outro canal) vira um ticket. Você responde, transfere de fila, usa resposta rápida.
- **Filas** — “departamentos”: Vendas, Locação. O ticket cai numa fila.
- **Respostas rápidas** — atalhos (`/ola`) que colam um texto pronto.
- **Tags** — etiquetas na conversa.
- **Contatos** — agenda de pessoas que já falaram com você.
- **Agendamentos de mensagem** — “mande isto amanhã às 9h”.
- **Chat interno** — recado entre usuários da empresa.

## Inteligência / IA

- **Prompts** — textos-base para o assistente (se a integração OpenAI estiver ligada).
- **Fila de IA / Assistente** — onde a automação atende antes do humano (se o módulo existir no plano).

## Vendas (pipeline)

- **Pipeline / Negócios** — funil: Novo → Visita → Proposta → Ganho/Perdido. Cada card pode apontar para um **ticket** (`ticketId`). Não é um segundo WhatsApp: é o comercial **em cima** do atendimento.
- **Follow-ups** — lembretes de retorno ao lead.
- **Propostas** — documentos de oferta ligados ao negócio/imóvel.
- **Captação** — entrada de leads (formulário, importação, Q-Capture).

## Imóveis

- **Imóveis** — cadastro do bem (tipo, valor, fotos se houver, dono).
- **Proprietários** — pessoas/empresas donas.
- **Contratos** — locação ou venda formalizada.
- **Avaliação** — ferramenta de preço (módulo Realty).
- **Comparativo** — lado a lado de imóveis.
- **Jornada** — etapas do cliente no imóvel.
- **Corretores** — time comercial.
- **Agenda imobiliária** — visitas e compromissos do produto (além do calendário geral).

## Radar (ex-Radar Proptech)

- **RadarZAP** — analisa texto/print de anúncio (heurística no servidor, não é “Lovable AI”).
- **Portais / Scraping** — busca dados públicos de anúncio a partir de URL (axios + HTML). Respeite os termos do portal.
- **Q-Capture** — captura rápida para virar cadastro.
- **Inteligência / Produtividade / Fila Radar** — telas de módulo JSON (`RealtyModulo`) com os tipos que o Radar tinha.

## Conteúdo

- **Conteúdo SEO** — gera/rascunha textos de anúncio e landing.
- Outras telas de conteúdo listadas no menu (posts, descrições) — mesmo padrão: CRUD no Postgres desta API.

## Gestão

- **Campanhas** — disparo em massa (WhatsApp/e-mail) com intervalo. Precisa de Redis e conexão viva.
- **Calendário** — agenda geral da equipe (não só visita de imóvel).
- **Integrações** — chaves OpenAI, Meta, pagamentos, webhooks.
- **Kanban** (se aparecer) — visão alternativa de tickets.
- **Relatórios** — números da operação.

## Sistema

- **Usuários** — login, perfil, o que cada um pode ver.
- **Empresas** — multi-empresa (o token JWT carrega `companyId`).
- **Configurações** — horários, avisos, options do tenant.
- **Conexões** — WhatsApp QR / oficiais.
- **Financeiro / Assinatura** (se o white-label tiver) — planos Stripe etc.

## Atalhos no rodapé do menu

Itens nativos que antes ficavam “escondidos” no submenu continuam acessíveis: prompts, integrações, calendário, tickets, respostas rápidas, campanhas. Se você vê **duas** entradas para a mesma tela, é de propósito (grupo + atalho). Não apague uma achando que é duplicata inútil sem olhar a rota: podem ser o **mesmo** caminho.

## Como conferir se o menu está íntegro

Na pasta `backend`:

```bash
npx jest --config jest.realty.config.js --forceExit
```

O teste `crmMenuDelivery` falha se uma rota do catálogo não existir no React Router ou no sidebar.
