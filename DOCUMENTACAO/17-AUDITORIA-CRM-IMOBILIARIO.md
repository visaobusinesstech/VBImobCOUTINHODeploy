# 17 — Auditoria CRM Imobiliário Integrado

Documento da Fase 1 do plano *CRM Imobiliário Integrado + Deploy*.  
Fontes: CRM VB Solution atual, Radar LEGADO (`radar LEGADO-proptech-crm-premium/project`), Coutinho LEGADO (`CRM LEGADO Coutinho`).

**Regra:** este documento descreve o estado atual, o ideal e os gaps. A implementação (Fases 2–4) segue o backlog e o mapa de migrations abaixo.

---

## 1. Mapeamento atual do sistema

O módulo imobiliário no VB Solution é uma camada PostgreSQL (`realty_*` + `leads_sales` enriquecido) sobre o CRM WhatsApp clássico (tickets/Baileys).

| Camada | Tecnologia |
|--------|------------|
| Frontend | CRA + Craco, rotas em `frontend/src/routes/index.js`, menus em `MainListItems.js` |
| Backend | Express + Sequelize, `realtyCrmRoutes`, `leadsSalesRoutes` |
| WhatsApp | Tickets canônicos; vínculo `leads_sales.ticketId` |
| Captação | RadarZAP (`realty_radarzap_*`), mercado (`realty_imoveis_mercado`) |

**Gap estrutural:** visitas/propostas/negociação são em grande parte **status** de lead; no Radar LEGADO são **entidades**. Várias telas usam `RealtyCrudPage` + `realty_modulos` (CRUD genérico) sem regra de negócio específica.

---

## 2. Todas as páginas (inventário)

### Vendas

| Rota | Página | Particularidade estratégica | Estado atual |
|------|--------|----------------------------|--------------|
| `/leads-sales` | Leads e Vendas | Cadastro único do lead comercial | CRUD real; campos imob de interesse pouco expostos no wizard |
| `/pipeline` | Pipeline | Kanban do funil | Kanban sobre `leads_sales`; match imóvel; ticket |
| `/propostas` | Propostas | Documento comercial | **Stub:** só lista status=`proposta` |
| `/followups` | Follow-up | Fila de retornos | Só edita `followUpAt` (sem histórico) |
| `/jornada` | Jornada | Timeline do lead | Agrega módulos intel (limitado) |
| `/fila-distribuicao` | Fila distribuição | Atribuição de corretor | UI parcial |
| `/nutricao` | Nutrição | Cadência leads frios | CRUD genérico `realty_modulos` |
| `/prospeccao` | Prospecção diária | Meta diária corretor | CRUD genérico |
| `/activities` | Atividades | Tarefas gerais CRM | Genérico (não só imob) |
| `/projects` | Projetos | **Fora do domínio imobiliário** | Kanban projetos genéricos |
| `/leads-landing` | Leads landing | Entrada de LP | Módulo kind |

### Imobiliário

| Rota | Página | Particularidade | Estado |
|------|--------|-----------------|--------|
| `/dashboard` | Dashboard imob | KPIs | Custom |
| `/imoveis` | Imóveis | Portfólio / matching | CRUD real; faltam IPTU, código, suítes, vagas, corretor, proprietário no form |
| `/comparativo` | Comparativo | 2–3 imóveis lado a lado | Custom leitura |
| `/avaliacao` | Avaliação | Precificação | Custom + API |
| `/proprietarios` | Proprietários | Lado oferta | CRUD real |
| `/contratos` | Contratos | Fechamento | CRUD real |
| `/captacao` | Captação | Imóveis em captação | Subconjunto imóveis |
| `/pipeline-captacao` | Pipeline captação | Funil de captação | Módulo kind |
| `/agenda` | Agenda | Visitas/retornos | Lista followUpAt (sem entidade visita) |
| `/corretores` | Corretores | Equipe | Custom / users |
| `/condominios` … `/consulta-cpf` | Suporte | CRUD genérico ou tools | Thin |

### Radar e portais

| Rota | Página | Particularidade | Estado |
|------|--------|-----------------|--------|
| `/radarzap*` | RadarZAP | Grupos WA → leads | Real (`realty_radarzap_*`) |
| `/portais` `/qcapture` `/monitoramento` | Portais | Scraping/mercado | Parcial |
| `/whatsapp` | WhatsApp imob | Hub atendimento | **Hub-only** (links para tickets/conexões) |

---

## 3. Todos os inputs (núcleo)

### Lead (`leads_sales`) — modelo atual

`id`, `name`, `description`, `status`, `value`, `companyName`, `phone`, `email`, `site`, `origin`, `document`, `birthDate`, `address` (JSON), `tags`, `contactId`, `responsibleId`, `pipelineId`, `imovelId`, `proprietarioId`, `interestCity`, `interestNeighborhood`, `interestType`, `bedrooms`, `followUpAt`, `ticketId`, `date`, `dateEnd`, `companyId`

**Wizard UI atual:** name, phone, email, contact, companyName, date, address, value, pipeline, status, responsible, site, origin, description, tags.  
**Não no wizard (mas no modelo):** interest*, bedrooms, imovelId, followUpAt, ticketId, document, birthDate.  
**Só UI (não persiste):** prioridade.

### Imóvel (`realty_imoveis`) — modelo atual

`title`, `description`, `type`, `status`, `price`, `city`, `neighborhood`, `address`, `bedrooms`, `bathrooms`, `areaM2`, `images`, `proprietarioId`, `companyId`

**Form UI:** title*, type, status, price, city, neighborhood, address, bedrooms, bathrooms, areaM2, description.  
**Não no form:** images, proprietarioId.

### Faltantes vs CRM imobiliário ideal (lead)

temperatura, finalidade (compra/aluguel), faixa preço min/max, pagamento, entrada, financiamento, vagas desejadas, suítes, características, lostReason, nextContactAt (além de followUpAt), estágio canônico alinhado.

### Faltantes (imóvel)

código externo, finalidade, IPTU, condomínio, UF/CEP, suítes, vagas, corretor (`userId`), disponibilidade granular, vídeos.

---

## 4–5. Funcionalidades e funcionamento atual por página

Ver tabelas da seção 2. Em resumo:

- **Pipeline** e **LeadsSales** são o coração real.
- **Match** `GET /imoveis/match?leadId=` pontua cidade/bairro/tipo/quartos/preço/disponibilidade e permite vincular `imovelId`.
- **Propostas/Followups/Agenda** não têm entidade própria.
- **WhatsApp imob** não embute painel CRM no ticket.

Estágios default (`REALTY_PIPELINE_STAGES`): `novo → contato → visita → proposta → fechado | perdido`.  
Board LeadsSales usa outro default (`qualificacao`, `negociacao`) — **inconsistência**.

---

## 6–11. Problemas, inputs incorretos/faltantes, incompletos, integrações, relacionamentos

| # | Problema |
|---|----------|
| 1 | Propostas = filtro de status, não entidade |
| 2 | Follow-up sem histórico (`realty_followups`) |
| 3 | Visitas só como estágio, sem agenda entity |
| 4 | Campos interest* fora do wizard de lead |
| 5 | Imóvel sem código/IPTU/condomínio/vagas/suítes/corretor no form |
| 6 | WhatsApp imob hub-only |
| 7 | Sem “enviar match no WhatsApp” |
| 8 | Sem painel lead/imóvel/follow-up no ticket |
| 9 | Projects no menu Vendas (ruído) |
| 10 | Muitos kind pages sem regra estratégica |
| 11 | Funis divergentes Pipeline vs LeadsSales |
| 12 | Nutrição/prospecção/automações = CRUD genérico |
| 13 | Contratos existem mas pouco ligados a proposta entity |
| 14 | Dados isolados em `realty_modulos` sem FK lead |

---

## 12–13. Fluxo ideal por módulo e fluxo completo

```
Prospecção/RadarZAP/Portais/Landing
  → Lead único (leads_sales)
  → Qualificação (interest* + temperatura)
  → Ticket WhatsApp
  → Match imóveis → envio WA (log envios)
  → Follow-up / Nutrição
  → Visita (realty_visitas)
  → Proposta (realty_propostas)
  → Negociação / Contrato
  → Fechado | Perdido(+motivo)
  → Pós-venda (relacionamento)
```

Cada mudança de estágio atualiza histórico e pode disparar automação.

---

## 14. Integração WhatsApp (atual vs ideal)

**Atual:** `POST /leads-sales/:id/ticket` → ResolveTicket; `LeadChatPane`; card `ticket #` no Pipeline; hub `/whatsapp`.

**Ideal:** no atendimento: ver lead, imóveis, follow-ups, mudar estágio, enviar match, agendar visita, registrar proposta — sem sair do fluxo.

---

## 15–23. Fluxos (leads, prospecção, follow-up, nutrição, imóveis, visitas, propostas, negociação, vendas)

| Fluxo | Ideal | Gap |
|-------|-------|-----|
| Leads | Cadastro único + interest + ticket | Wizard incompleto |
| Prospecção | Meta diária + WA | Genérico |
| Follow-up | Histórico + fila + auto | Só data |
| Nutrição | Cadência frios | Genérico |
| Imóveis | Portfólio completo + match | Campos faltantes |
| Visitas | Entity + lembrete WA | Só status |
| Propostas | Entity + envio WA | Filtro status |
| Negociação | Estágio + proposta ativa | Sem entity |
| Venda/locação | Contrato + pós-venda | Parcial |

---

## 24. Automações necessárias

| Gatilho | Ação |
|---------|------|
| Novo lead | Atribuir corretor, criar ticket, follow-up +24h |
| Sem resposta X dias | Follow-up + alerta |
| Match enviado | Status → imoveis_enviados |
| Visita agendada | Lembrete WA D-1 |
| Visita realizada | Tarefa retorno |
| Proposta enviada | Follow-up +3d |
| Lead parado | Nutrição |
| Fechado | Contrato + pós-venda |
| Perdido | Exigir motivo |

---

## 25–27. Melhorias, estrutura de dados, relacionamentos

### Migrations (mapa)

1. Enrich `leads_sales`: temperature, purpose, priceMin, priceMax, paymentMethod, downPayment, financing, parkingSpots, suitesDesired, featuresDesired, lostReason, nextContactAt, garagesDesired  
2. Enrich `realty_imoveis`: code, purpose, condoFee, iptu, state, zipCode, suites, parkingSpots, userId (corretor), videoUrl  
3. Create `realty_followups`  
4. Create `realty_visitas`  
5. Create `realty_propostas`  
6. Create `realty_lead_imovel_envios`  
7. Seed funil canônico (stages)  
8. Índices em ticketId, followUpAt, imovelId, userId  

### Relacionamentos

```
Company 1—N LeadSale, Imovel, Proprietario, Contrato, Followup, Visita, Proposta
LeadSale N—1 Contact, User(responsible), Imovel, Ticket
LeadSale 1—N Followups, Visitas, Propostas, Envios
Imovel N—1 Proprietario, User(corretor)
Contrato N—1 LeadSale, Imovel, Proposta
```

---

## 28–30. Manter / corrigir / criar

**Manter:** tickets WhatsApp, `leads_sales` como lead único, match scoring, RadarZAP, CRUD imóveis/proprietários/contratos base, Sequelize migrate no boot.

**Corrigir:** wizard lead (interest*), form imóvel, funil único, Propostas/Followups/Agenda com dados reais, WhatsApp hub → painel, menu Projects fora de Vendas.

**Criar:** tabelas followups/visitas/propostas/envios; APIs; UI estratégica por página; envio match→WA; automações fila Redis.

---

## Matriz legado × VB (campo a campo — resumo)

| Domínio | Radar | Coutinho | VB atual | Gap |
|---------|-------|----------|----------|-----|
| Lead nome/tel/email | sim | sim | sim | — |
| Temperatura | sim | sim | **não** | criar |
| Interesse cidade/bairro/tipo/quartos | sim | sim | modelo sim / UI parcial | UI + enrich |
| Finalidade/pagamento/entrada | sim | sim | **não** | criar |
| Funil visitas/proposta entities | sim | estágio | status only | criar tabelas |
| Follow-up histórico | sim | nextAction | só data | criar |
| Nutrição | sim | fraco | stub | real |
| Imóvel IPTU/cond/código/vagas | sim | parcial | **não** | enrich |
| Match lead↔imóvel | sim | fraco | **sim API** | + envio WA |
| WhatsApp inbox | log+wa.me | mock | **tickets reais** | painel CRM |
| RadarZAP | sim | radar manual | **sim** | — |
| Projects imob | não | não | genérico no menu | remover/relabel |

---

## Auditoria WhatsApp + Projects

### WhatsApp

- Vínculo: `ResolveTicketForLeadPreviewService` + `ticketId`.
- Falta: enviar imóvel pelo match; follow-up a partir da mensagem; mudar estágio no inbox; visita/proposta no painel do ticket.

### Projects

Página genérica de projetos/kanban (`/projects`). **Não** é módulo imobiliário. Ação: remover do grupo Vendas (mover para área genérica CRM ou esconder do fluxo imob).

---

## Spec estratégica por página (contrato Fase 3)

Ver plano: cada página = particularidade + migration/API + critério de aceite (salvar → refletir Pipeline/Jornada/WA).

### Backlog P0–P2

**P0:** enrich lead/imóvel + seed funil; LeadsSales wizard interest*; Pipeline match→WA; Imoveis form completo; WhatsApp hub com deep-links contextuais + API envio match.  
**P1:** followups/visitas/propostas/envios tables + páginas Followups, Agenda, Propostas, Nutricao, Prospeccao, Automações, Jornada, Fila.  
**P2:** Captação/RadarZAP polish, Contratos↔proposta, Comparativo enviar WA, limpar stubs/menu Projects.

---

## 30 seções — índice rápido

1 Mapa atual · 2 Páginas · 3 Inputs · 4 Funcionalidades · 5 Funcionamento · 6 Problemas · 7 Inputs incorretos · 8 Faltantes · 9 Incompletas · 10 Integrações faltando · 11 Relacionamentos · 12 Fluxo ideal módulo · 13 Fluxo CRM · 14 WhatsApp · 15 Leads · 16 Prospecção · 17 Follow-up · 18 Nutrição · 19 Imóveis · 20 Visitas · 21 Propostas · 22 Negociação · 23 Vendas/locações · 24 Automações · 25 Melhorias · 26 Dados · 27 Relacionamentos · 28 Manter · 29 Corrigir · 30 Criar

---

*Fim da Fase 1 — auditoria. Próximo: implementação com migrations no Postgres Railway.*
