
-- Fase 1: Ingestão ao vivo via Evolution API
ALTER TABLE public.radarzap_grupos
  ADD COLUMN IF NOT EXISTS evolution_instance text,
  ADD COLUMN IF NOT EXISTS evolution_group_jid text,
  ADD COLUMN IF NOT EXISTS evolution_join_status text,
  ADD COLUMN IF NOT EXISTS evolution_last_seen_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_radarzap_grupos_evolution_jid
  ON public.radarzap_grupos (imobiliaria_id, evolution_group_jid);

ALTER TABLE public.radarzap_mensagens
  ADD COLUMN IF NOT EXISTS evolution_message_id text,
  ADD COLUMN IF NOT EXISTS midias jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS uq_radarzap_msg_evolution_id
  ON public.radarzap_mensagens (imobiliaria_id, evolution_message_id)
  WHERE evolution_message_id IS NOT NULL;

-- Fase 3: enriquecimento — colunas explícitas usadas na aba "Imóveis captados"
ALTER TABLE public.radarzap_leads
  ADD COLUMN IF NOT EXISTS quartos int,
  ADD COLUMN IF NOT EXISTS banheiros int,
  ADD COLUMN IF NOT EXISTS vagas int,
  ADD COLUMN IF NOT EXISTS suites int,
  ADD COLUMN IF NOT EXISTS area_util numeric,
  ADD COLUMN IF NOT EXISTS area_total numeric,
  ADD COLUMN IF NOT EXISTS condominio_valor numeric,
  ADD COLUMN IF NOT EXISTS iptu_valor numeric,
  ADD COLUMN IF NOT EXISTS andar int,
  ADD COLUMN IF NOT EXISTS mobiliado boolean,
  ADD COLUMN IF NOT EXISTS aceita_pet boolean,
  ADD COLUMN IF NOT EXISTS aceita_financiamento boolean,
  ADD COLUMN IF NOT EXISTS endereco text,
  ADD COLUMN IF NOT EXISTS descricao text,
  ADD COLUMN IF NOT EXISTS midias jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS dados_extra jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Fase 4: view achatada "Imóveis captados" (apenas leads principais aprovados / pendentes com dados)
CREATE OR REPLACE VIEW public.vw_radarzap_imoveis
WITH (security_invoker = true)
AS
SELECT
  l.id,
  l.imobiliaria_id,
  l.tipo_imovel,
  l.operacao,
  l.endereco,
  l.bairro,
  l.cidade,
  g.uf,
  l.preco,
  l.condominio_valor,
  l.iptu_valor,
  l.quartos,
  l.suites,
  l.banheiros,
  l.vagas,
  l.area_util,
  l.area_total,
  l.andar,
  l.mobiliado,
  l.aceita_pet,
  l.aceita_financiamento,
  l.descricao,
  l.midias,
  l.contato,
  l.proprietario_nome,
  l.score,
  l.status,
  g.id           AS grupo_id,
  g.nome         AS grupo_nome,
  g.invite_url   AS grupo_invite_url,
  g.categoria    AS grupo_categoria,
  m.data_mensagem,
  m.texto        AS mensagem_original,
  l.created_at,
  l.updated_at
FROM public.radarzap_leads l
LEFT JOIN public.radarzap_grupos g ON g.id = l.grupo_id
LEFT JOIN public.radarzap_mensagens m ON m.id = l.mensagem_id
WHERE l.is_principal = true
  AND l.status IN ('pendente_aprovacao','aprovado','convertido');

GRANT SELECT ON public.vw_radarzap_imoveis TO authenticated;
