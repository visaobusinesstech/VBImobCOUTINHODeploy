# Pipeline dinâmico com drag-and-drop

Hoje o `ESTAGIOS` está fixo no código (`src/hooks/useLeads.ts`). Vou torná-lo editável por imobiliária, com colunas arrastáveis para reordenar e a mesma UX atual de arrastar cards entre colunas — tudo persistido no backend.

## O que muda para o usuário

- Cada imobiliária define suas próprias colunas do pipeline: nome, cor, ordem e se está ativa.
- Botão **Editar pipeline** no topo do CRM abre um painel para:
  - Adicionar/renomear/excluir estágio.
  - Escolher cor (paleta pré-definida).
  - Reordenar estágios arrastando (define a ordem das colunas).
  - Marcar como inativo (some do quadro sem apagar histórico).
- Colunas do quadro passam a ser arrastáveis horizontalmente para reordenar in-loco (com feedback visual).
- Cards continuam arrastáveis entre colunas, como já funciona.
- Estágios "sistema" (Fechado, Perdido) ficam protegidos contra exclusão porque disparam regras (comissão, motivo de perda). Podem ser renomeados/recoloridos, não removidos.

## O que muda no backend

Nova tabela `pipeline_estagios` (multi-tenant, por `imobiliaria_id`):
- `id`, `imobiliaria_id`, `slug` (estável, usado em `leads.estagio`), `title`, `color`, `ordem`, `ativo`, `is_sistema`, `sistema_tipo` (fechado/perdido/null), `created_at`, `updated_at`.
- GRANTs + RLS: SELECT/INSERT/UPDATE/DELETE só do próprio `imobiliaria_id`. DELETE bloqueado por trigger quando `is_sistema = true` ou quando existem leads com aquele `slug`.
- Seed automático na primeira leitura: se a imobiliária não tem registros, insere os 12 estágios atuais preservando os slugs (`novos`, `qualificados`, ..., `perdido`) para não quebrar leads existentes.

## O que muda no frontend

- Novo hook `usePipelineEstagios()` (com realtime + cache): substitui o `ESTAGIOS` estático. Expõe `estagios` (ativos, ordenados), `todos` (incluindo inativos), `create/update/delete/reorder`.
- `useLeads.ts`: `normalizeEstagio` deixa de derrubar slug desconhecido para `"novos"` — passa a aceitar qualquer slug existente na tabela; mantém `LEGACY_ESTAGIO_REMAP` para os slugs antigos e continua caindo em `"novos"` só se o slug não existir em lugar nenhum.
- `Pipeline.tsx`: consome o hook; DnD de colunas via `@dnd-kit/core` + `@dnd-kit/sortable` (já é o padrão do shadcn stack). Mantém `handleDrop` atual dos cards.
- Novo componente `PipelineEstagiosDialog.tsx`: painel de edição (form + lista sortable).
- `PipelineThemeSelector.tsx`: continua controlando o tema visual; cor por coluna vem agora do banco.
- Pontos que hoje hardcoded o slug ("fechado", "perdido", `LEAD_INATIVO_ESTAGIOS`, `ESTAGIOS_INATIVOS_CONTATO`, `AutomacoesFollowup`, `dashboardMetrics`) continuam usando os slugs sistema (`fechado`, `perdido`) — por isso a proteção `is_sistema` no backend.

## Arquivos afetados

- Migration nova (tabela + policies + trigger de proteção + função de seed).
- `src/hooks/usePipelineEstagios.ts` (novo).
- `src/hooks/useLeads.ts` (afrouxa normalização).
- `src/components/pipeline/PipelineEstagiosDialog.tsx` (novo).
- `src/pages/Pipeline.tsx` (troca `ESTAGIOS` estático, adiciona DnD de colunas, botão "Editar pipeline").
- Instalar `@dnd-kit/core` e `@dnd-kit/sortable`.

## Detalhes técnicos

- Reordenar coluna faz `UPDATE` em lote de `ordem` (transação via RPC `pipeline_estagios_reorder(slugs text[])`) para evitar N chamadas.
- Slug é gerado a partir do título (kebab-case) na criação e é imutável depois — evita quebrar `leads.estagio` histórico.
- Ao inativar um estágio que ainda tem leads, o painel avisa e oferece mover leads para outro estágio antes de desativar.
- Realtime: canal `pipeline_estagios:imobiliaria_id=eq.<id>` para refletir em outras abas abertas.
- Testes: adiciono `usePipelineEstagios.test.ts` (seed + reorder) e atualizo `useLeads.normalize.test.ts` para o novo comportamento.

Confirma que posso implementar?
