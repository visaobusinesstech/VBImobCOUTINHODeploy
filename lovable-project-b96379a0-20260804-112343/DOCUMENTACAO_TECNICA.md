# 📘 Documentação Técnica — Radar Proptech CRM

> Versão: 1.0 · Atualizado em: 2026-03-08  
> Stack: React 18 + Vite + TypeScript + Tailwind CSS + Lovable Cloud (Supabase)

---

## 🏗️ Arquitetura Geral

```
┌─────────────────────────────────────────────────┐
│                  Frontend (SPA)                 │
│  React 18 · Vite · Tailwind · shadcn/ui         │
│  react-router-dom · @tanstack/react-query       │
├─────────────────────────────────────────────────┤
│              Lovable Cloud (Backend)            │
│  PostgreSQL · Auth · Storage · Realtime         │
│  Edge Functions (Deno)                          │
└─────────────────────────────────────────────────┘
```

### Multi-Tenancy
- Isolamento por `imobiliaria_id` (= `auth.uid()` do usuário master)
- Todas as tabelas possuem RLS com `auth.uid() = imobiliaria_id`
- Funções `SECURITY DEFINER` para checagens sem recursão

---

## 📊 Módulos & Tabelas

### 1. Dashboard (`/`)
**Arquivo:** `src/pages/Index.tsx`

Painel consolidado com métricas de todos os módulos:
- Total de imóveis, leads, contratos, receitas/despesas
- Gráficos de pipeline por estágio
- Indicadores de performance

**Tabelas consultadas:** `imoveis`, `leads`, `contratos`, `transacoes`, `compromissos`

---

### 2. CRM Pipeline (`/pipeline`)
**Arquivos:** `src/pages/Pipeline.tsx`, `src/components/pipeline/*`

#### Tabela: `leads`
| Coluna | Tipo | Nullable | Default |
|--------|------|----------|---------|
| `id` | uuid | ❌ | `gen_random_uuid()` |
| `imobiliaria_id` | uuid | ❌ | — |
| `nome` | text | ❌ | — |
| `telefone` | text | ✅ | — |
| `email` | text | ✅ | — |
| `interesse` | text | ✅ | — |
| `valor` | numeric | ❌ | `0` |
| `estagio` | text | ❌ | `'novos'` |
| `posicao` | integer | ❌ | `0` |
| `corretor_id` | uuid | ✅ | — |
| `motivo_perda` | text | ✅ | — |
| `observacoes` | text | ✅ | — |
| `created_at` | timestamptz | ❌ | `now()` |
| `updated_at` | timestamptz | ❌ | `now()` |

**FK:** `corretor_id → corretores.id`

**RLS:**
- Owner CRUD: `auth.uid() = imobiliaria_id`
- Portal INSERT público: `WITH CHECK (true)` (captação automática)

**Estágios:** `novos` → `contato` → `visita` → `proposta` → `fechado` | `perdido`

#### Tabela: `followups`
| Coluna | Tipo | Default |
|--------|------|---------|
| `id` | uuid | `gen_random_uuid()` |
| `lead_id` | uuid | — |
| `imobiliaria_id` | uuid | — |
| `data_followup` | date | — |
| `tipo` | text | `'ligacao'` |
| `status` | text | `'pendente'` |
| `descricao` | text | — |

**FK:** `lead_id → leads.id`

#### Tabela: `lead_atividades`
| Coluna | Tipo | Default |
|--------|------|---------|
| `id` | uuid | `gen_random_uuid()` |
| `lead_id` | uuid | — |
| `imobiliaria_id` | uuid | — |
| `tipo` | text | `'nota'` |
| `titulo` | text | — |
| `descricao` | text | — |
| `created_at` | timestamptz | `now()` |

**FK:** `lead_id → leads.id`

**Triggers:**
- `on_lead_created()` → Insere atividade "Lead captado"
- `on_lead_stage_changed()` → Registra mudança de estágio

#### Fluxo
```
Portal Público → INSERT lead (anon) → Trigger on_lead_created
     ↓
Kanban (drag-and-drop) → UPDATE estagio → Trigger on_lead_stage_changed
     ↓
Estágio "perdido" → Dialog motivo_perda obrigatório
     ↓
Follow-ups agendados → Painel de pendentes (atrasados/hoje)
```

---

### 3. Corretores (`/corretores`)
**Arquivos:** `src/pages/Corretores.tsx`

#### Tabela: `corretores`
| Coluna | Tipo | Default |
|--------|------|---------|
| `id` | uuid | `gen_random_uuid()` |
| `imobiliaria_id` | uuid | — |
| `nome` | text | — |
| `telefone` | text | — |
| `email` | text | — |
| `creci` | text | `''` |
| `status` | text | `'ativo'` |

#### Tabela: `corretor_permissoes`
| Coluna | Tipo | Default |
|--------|------|---------|
| `id` | uuid | `gen_random_uuid()` |
| `corretor_id` | uuid | — |
| `modulo` | text | — |
| `ativo` | boolean | `true` |

**FK:** `corretor_id → corretores.id`  
**RLS:** Via função `owns_corretor(_corretor_id)` (SECURITY DEFINER)

#### Módulos disponíveis para permissão:
`dashboard`, `imoveis`, `pipeline`, `automacoes`, `financeiro`, `contratos`, `relacionamento`, `jornada`, `seguranca`, `configuracoes`, `qcapture`, `proprietarios`

---

### 4. Financeiro (`/financeiro`)
**Arquivos:** `src/pages/Financeiro.tsx`, `src/components/financeiro/*`

#### Tabela: `transacoes`
| Coluna | Tipo | Default |
|--------|------|---------|
| `id` | uuid | `gen_random_uuid()` |
| `imobiliaria_id` | uuid | — |
| `descricao` | text | — |
| `valor` | numeric | `0` |
| `tipo` | text | `'entrada'` |
| `categoria` | text | `'comissao'` |
| `data` | date | `CURRENT_DATE` |
| `status` | text | `'pendente'` |
| `corretor_id` | uuid | — |
| `imovel_id` | uuid | — |
| `observacoes` | text | — |

**FK:** `corretor_id → corretores.id`, `imovel_id → imoveis.id`

**Tipos:** `entrada` | `saida`  
**Categorias:** `comissao`, `aluguel`, `marketing`, `operacional`, etc.  
**Status:** `pendente`, `pago`, `cancelado`

---

### 5. Contratos (`/contratos`)
**Arquivos:** `src/pages/Contratos.tsx`, `src/components/contratos/*`

#### Tabela: `contratos`
| Coluna | Tipo | Default |
|--------|------|---------|
| `id` | uuid | `gen_random_uuid()` |
| `imobiliaria_id` | uuid | — |
| `titulo` | text | — |
| `cliente` | text | — |
| `proprietario` | text | — |
| `proprietario_id` | uuid | — |
| `inquilino` | text | — |
| `tipo` | text | `'Venda'` |
| `status` | text | `'rascunho'` |
| `valor` | numeric | `0` |
| `data_inicio` | date | — |
| `data_fim` | date | — |
| `imovel_id` | uuid | — |
| `corretor_id` | uuid | — |
| `matricula` | text | — |
| `indice_correcao` | text | `'IGPM'` |
| `percentual_correcao` | numeric | `0` |
| `data_proxima_correcao` | date | — |
| `dia_vencimento_aluguel` | integer | `10` |
| `tipo_garantia` | text | `'seguro_fianca'` |
| `vistoria_entrada` | boolean | `false` |
| `vistoria_video` | boolean | `false` |
| `apolice_seguro` | boolean | `false` |
| `data_vencimento_apolice` | date | — |
| `contrato_anexo_url` | text | — |
| `vistoria_anexo_url` | text | — |
| `apolice_anexo_url` | text | — |

**FK:** `corretor_id → corretores.id`, `imovel_id → imoveis.id`, `proprietario_id → proprietarios.id`

**Status:** `rascunho` → `aguardando_assinatura` → `assinado` → `vencendo` → `cancelado`

**Storage Bucket:** `contratos` (público)

---

### 6. Proprietários (`/proprietarios`)
**Arquivos:** `src/pages/Proprietarios.tsx`, `src/components/proprietarios/*`

#### Tabela: `proprietarios`
| Coluna | Tipo | Default |
|--------|------|---------|
| `id` | uuid | `gen_random_uuid()` |
| `imobiliaria_id` | uuid | — |
| `nome` | text | — |
| `cpf_cnpj` | text | — |
| `telefone` | text | — |
| `email` | text | — |
| `endereco` | text | — |
| `cidade` | text | — |
| `estado` | text | `'SP'` |
| `cep` | text | — |
| `tipo` | text | `'ambos'` |
| `banco` | text | — |
| `agencia` | text | — |
| `conta` | text | — |
| `pix` | text | — |
| `observacoes` | text | — |

**Tipos:** `venda`, `locacao`, `ambos`

---

### 7. Relacionamento (`/relacionamento`)
**Arquivos:** `src/pages/Relacionamento.tsx`, `src/components/relacionamento/*`

#### Tabela: `clientes_relacionamento`
| Coluna | Tipo | Default |
|--------|------|---------|
| `id` | uuid | `gen_random_uuid()` |
| `imobiliaria_id` | uuid | — |
| `nome` | text | — |
| `telefone` | text | — |
| `email` | text | — |
| `aniversario` | date | — |
| `data_casamento` | date | — |
| `data_compra_imovel` | date | — |
| `data_mudanca` | date | — |
| `profissao` | text | — |
| `data_profissao` | date | — |
| `filhos` | jsonb | `'[]'` |
| `observacoes` | text | — |
| `ativo` | boolean | `true` |

#### Tabela: `mensagem_templates`
| Coluna | Tipo | Default |
|--------|------|---------|
| `id` | uuid | `gen_random_uuid()` |
| `imobiliaria_id` | uuid | — |
| `tipo` | text | — |
| `mensagem` | text | — |
| `ativo` | boolean | `true` |

#### Edge Functions:
- `gerar-mensagens-ia` — Geração de mensagens personalizadas via IA
- `enviar-mensagens-relacionamento` — Envio de mensagens em lote

---

### 8. Agenda (`/agenda`)
**Arquivos:** `src/pages/Agenda.tsx`, `src/components/agenda/*`

#### Tabela: `compromissos`
| Coluna | Tipo | Default |
|--------|------|---------|
| `id` | uuid | `gen_random_uuid()` |
| `imobiliaria_id` | uuid | — |
| `titulo` | text | — |
| `tipo` | text | `'reuniao'` |
| `data_inicio` | timestamptz | — |
| `data_fim` | timestamptz | — |
| `local` | text | — |
| `descricao` | text | — |
| `status` | text | `'pendente'` |
| `corretor_id` | uuid | — |
| `lead_id` | uuid | — |
| `imovel_id` | uuid | — |
| `lembrete_whatsapp` | boolean | `false` |
| `telefone_lembrete` | text | — |
| `lembrete_enviado` | boolean | `false` |

**FK:** `corretor_id → corretores.id`, `lead_id → leads.id`, `imovel_id → imoveis.id`

**Visualizações:** Lista, Calendário Mensal, Grade Semanal (07h–20h com drag-and-drop)

**Edge Function:** `lembrete-compromissos` — Envio de lembretes via WhatsApp

---

### 9. Jornada do Lead (`/jornada`)
**Arquivo:** `src/pages/JornadaCliente.tsx`

Timeline visual que agrega dados de:
- `lead_atividades` (captação, mudanças de estágio, notas)
- `followups` (follow-ups agendados/concluídos)
- `compromissos` (visitas, reuniões vinculadas ao lead)

**Fluxo:**
```
Seleção de Lead → Query lead_atividades + followups + compromissos
     ↓
Ordenação cronológica → Timeline visual com ícones por tipo
```

---

### 10. Gerenciar Usuários (`/gerenciar-usuarios`)
**Arquivo:** `src/pages/GerenciarUsuarios.tsx`

#### Tabela: `profiles`
| Coluna | Tipo | Default |
|--------|------|---------|
| `id` | uuid | — (= `auth.users.id`) |
| `nome` | text | `''` |
| `email` | text | — |
| `approved` | boolean | `false` |
| `is_master` | boolean | `false` |

**Trigger:** `handle_new_user()` — Primeiro usuário = master (auto-aprovado); demais aguardam aprovação.

**RLS:** SELECT/UPDATE permitido para o próprio usuário ou master (`is_master(auth.uid())`)

**Edge Function:** `reset-user-password` — Reset de senha pelo master

**Fluxo:**
```
Novo cadastro → handle_new_user() → approved=false
     ↓
Master aprova → UPDATE profiles SET approved=true
     ↓
Login bloqueado até approved=true
```

---

## 🏢 Imóveis (`/imoveis`)

#### Tabela: `imoveis`
| Coluna | Tipo | Default |
|--------|------|---------|
| `id` | uuid | `gen_random_uuid()` |
| `imobiliaria_id` | uuid | — |
| `titulo` | text | — |
| `tipo` | text | `'Apartamento'` |
| `operacao` | text | `'Venda'` |
| `preco` | numeric | `0` |
| `area` | numeric | `0` |
| `quartos` | integer | `0` |
| `suites` | integer | `0` |
| `banheiros` | integer | `0` |
| `vagas` | integer | `0` |
| `endereco` | text | — |
| `bairro` | text | — |
| `cidade` | text | — |
| `estado` | text | `'SP'` |
| `cep` | text | — |
| `descricao` | text | — |
| `status` | text | `'Ativo'` |
| `fotos` | text[] | `'{}'` |
| `destaque` | boolean | `false` |
| `exclusivo` | boolean | `false` |
| `aceita_financiamento` | boolean | `false` |
| `aceita_permuta` | boolean | `false` |
| `tem_escritura` | boolean | `false` |
| `valor_condominio` | numeric | `0` |
| `valor_iptu` | numeric | `0` |
| `andar` | text | — |
| `posicao_solar` | text | — |

**Storage Bucket:** `imoveis` (público)  
**RLS:** Owner CRUD + SELECT público (`true`) para portal

---

## 🤖 Automações (`/automacoes`)

#### Tabela: `automacoes`
| Coluna | Tipo | Default |
|--------|------|---------|
| `id` | uuid | `gen_random_uuid()` |
| `imobiliaria_id` | uuid | — |
| `nome` | text | — |
| `tipo` | text | `'whatsapp'` |
| `categoria` | text | `'comunicacao'` |
| `trigger_desc` | text | — |
| `acao` | text | — |
| `ativo` | boolean | `true` |
| `execucoes` | integer | `0` |
| `ultima_execucao` | timestamptz | — |
| `plataforma_nome` | text | — |
| `plataforma_url` | text | — |

**Seed automático:** 22 automações padrão ao primeiro acesso

---

## 🔍 Q-Capture / Captação (`/qcapture`)

#### Tabela: `imoveis_mercado`
| Coluna | Tipo | Default |
|--------|------|---------|
| `id` | uuid | `gen_random_uuid()` |
| `imobiliaria_id` | uuid | — |
| `portal` | text | — |
| `titulo` | text | — |
| `preco` | numeric | `0` |
| `preco_m2` | numeric | `0` |
| `area` | numeric | `0` |
| `quartos` | integer | `0` |
| `banheiros` | integer | `0` |
| `vagas` | integer | `0` |
| `tipo` | text | `'Apartamento'` |
| `operacao` | text | `'Venda'` |
| `bairro` | text | — |
| `cidade` | text | — |
| `estado` | text | `'SP'` |
| `url_anuncio` | text | — |
| `dias_anuncio` | integer | `0` |
| `data_scraping` | timestamptz | `now()` |
| `dados_raw` | jsonb | — |

**Portais monitorados:** OLX, Wimoveis, DFimoveis, Zap Imóveis, Viva Real

**Edge Function:** `scrape-portais-imoveis` — Web scraping via Firecrawl API

---

## 🔔 Notificações

#### Tabela: `notifications`
| Coluna | Tipo | Default |
|--------|------|---------|
| `id` | uuid | `gen_random_uuid()` |
| `user_id` | uuid | — |
| `title` | text | — |
| `description` | text | — |
| `read` | boolean | `false` |
| `created_at` | timestamptz | `now()` |

**Realtime:** Supabase Realtime habilitado para atualização em tempo real no painel

---

## ⚙️ Configurações (`/configuracoes`)

#### Tabela: `imobiliaria_config`
| Coluna | Tipo | Default |
|--------|------|---------|
| `id` | uuid | `gen_random_uuid()` |
| `user_id` | uuid | — |
| `nome_empresa` | text | `''` |
| `cnpj` | text | `''` |
| `creci` | text | `''` |
| `endereco` | text | `''` |
| `cidade` | text | `''` |
| `estado` | text | `'SP'` |
| `cep` | text | `''` |
| `telefone` | text | `''` |
| `email` | text | `''` |
| `logo_url` | text | `''` |

**Storage Bucket:** `logos` (público)

#### Tabela: `modulo_config`
| Coluna | Tipo | Default |
|--------|------|---------|
| `id` | uuid | `gen_random_uuid()` |
| `imobiliaria_id` | uuid | — |
| `modulo` | text | — |
| `ativo` | boolean | `true` |

**RLS:** SELECT para todos autenticados; INSERT/UPDATE/DELETE apenas master

---

## 🔐 Funções de Banco (Security Definer)

| Função | Retorno | Descrição |
|--------|---------|-----------|
| `get_master_user_id()` | uuid | Retorna ID do usuário master |
| `is_master(_user_id)` | boolean | Verifica se é master |
| `owns_corretor(_corretor_id)` | boolean | Verifica se corretor pertence ao usuário |
| `handle_new_user()` | trigger | Auto-cria perfil no cadastro |
| `handle_updated_at()` | trigger | Atualiza `updated_at` automaticamente |
| `on_lead_created()` | trigger | Registra atividade de captação |
| `on_lead_stage_changed()` | trigger | Registra mudança de estágio |

---

## 📦 Edge Functions

| Função | Descrição | Secrets |
|--------|-----------|---------|
| `scrape-portais-imoveis` | Scraping de portais imobiliários | `FIRECRAWL_API_KEY` |
| `gerar-mensagens-ia` | Geração de mensagens com IA | `LOVABLE_API_KEY` |
| `enviar-mensagens-relacionamento` | Envio em lote de mensagens | — |
| `lembrete-compromissos` | Lembretes de compromissos via WhatsApp | — |
| `reset-user-password` | Reset de senha pelo master | `SUPABASE_SERVICE_ROLE_KEY` |

---

## 🗄️ Storage Buckets

| Bucket | Público | Uso |
|--------|---------|-----|
| `imoveis` | ✅ | Fotos de imóveis |
| `logos` | ✅ | Logo da imobiliária |
| `contratos` | ✅ | Anexos de contratos, vistorias, apólices |

---

## 🛣️ Rotas da Aplicação

| Rota | Página | Protegida | Módulo |
|------|--------|-----------|--------|
| `/` | Dashboard | ✅ | `dashboard` |
| `/pipeline` | CRM Pipeline | ✅ | `pipeline` |
| `/imoveis` | Imóveis | ✅ | `imoveis` |
| `/corretores` | Corretores | ✅ | `corretores` |
| `/financeiro` | Financeiro | ✅ | `financeiro` |
| `/contratos` | Contratos | ✅ | `contratos` |
| `/proprietarios` | Proprietários | ✅ | `proprietarios` |
| `/relacionamento` | Relacionamento | ✅ | `relacionamento` |
| `/agenda` | Agenda | ✅ | `agenda` |
| `/jornada` | Jornada do Lead | ✅ | `jornada` |
| `/automacoes` | Automações | ✅ | `automacoes` |
| `/qcapture` | Q-Capture | ✅ | `qcapture` |
| `/radar` | Radar Oportunidades | ✅ | `radar` |
| `/configuracoes` | Configurações | ✅ | — |
| `/seguranca` | Segurança | ✅ | — |
| `/gerenciar-usuarios` | Gerenciar Usuários | ✅ (master) | — |
| `/portal` | Portal Público | ❌ | — |
| `/imovel/:id` | Imóvel Público | ❌ | — |
| `/auth` | Login/Cadastro | ❌ | — |
| `/reset-password` | Reset Senha | ❌ | — |

---

## 🔄 Fluxo de Autenticação

```
/auth (login/cadastro)
     ↓
handle_new_user() → profiles (approved=false se não é primeiro)
     ↓
Master aprova via /gerenciar-usuarios
     ↓
Login → AuthContext verifica approved=true
     ↓
ProtectedRoute → ModuleGuard (verifica permissões)
     ↓
Acesso ao módulo
```

---

*Gerado automaticamente pelo Radar Proptech CRM — Lovable Cloud*
