
ALTER TABLE public.radarzap_grupos
  ADD COLUMN IF NOT EXISTS evolution_instance TEXT,
  ADD COLUMN IF NOT EXISTS evolution_group_jid TEXT,
  ADD COLUMN IF NOT EXISTS evolution_join_status TEXT,
  ADD COLUMN IF NOT EXISTS evolution_last_seen_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_radarzap_grupos_evo
  ON public.radarzap_grupos(evolution_instance, evolution_group_jid);

CREATE UNIQUE INDEX IF NOT EXISTS uq_radarzap_grupos_imob_invite
  ON public.radarzap_grupos(imobiliaria_id, invite_url);

ALTER TABLE public.radarzap_mensagens
  ADD COLUMN IF NOT EXISTS evolution_message_id TEXT,
  ADD COLUMN IF NOT EXISTS midias JSONB DEFAULT '[]'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS uq_radarzap_mensagens_evo
  ON public.radarzap_mensagens(imobiliaria_id, evolution_message_id)
  WHERE evolution_message_id IS NOT NULL;

ALTER TABLE public.radarzap_leads
  ADD COLUMN IF NOT EXISTS endereco TEXT,
  ADD COLUMN IF NOT EXISTS suites INTEGER,
  ADD COLUMN IF NOT EXISTS condominio_valor NUMERIC,
  ADD COLUMN IF NOT EXISTS iptu_valor NUMERIC,
  ADD COLUMN IF NOT EXISTS andar INTEGER,
  ADD COLUMN IF NOT EXISTS mobiliado BOOLEAN,
  ADD COLUMN IF NOT EXISTS aceita_pet BOOLEAN,
  ADD COLUMN IF NOT EXISTS aceita_financiamento BOOLEAN;

DROP VIEW IF EXISTS public.vw_radarzap_imoveis;

CREATE VIEW public.vw_radarzap_imoveis
WITH (security_invoker = true)
AS
SELECT
  l.id,
  l.imobiliaria_id,
  l.grupo_id,
  l.mensagem_id,
  l.tipo_imovel,
  l.operacao,
  l.endereco,
  l.bairro,
  l.cidade,
  g.uf AS uf,
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
  l.resumo AS descricao,
  m.midias,
  l.contato,
  l.proprietario_nome,
  l.score,
  l.status,
  g.nome AS grupo_nome,
  g.invite_url AS grupo_invite_url,
  g.categoria AS grupo_categoria,
  m.data_mensagem,
  m.texto AS mensagem_original,
  l.created_at
FROM public.radarzap_leads l
LEFT JOIN public.radarzap_grupos g ON g.id = l.grupo_id
LEFT JOIN public.radarzap_mensagens m ON m.id = l.mensagem_id
WHERE l.tipo_imovel IS NOT NULL
   OR l.preco IS NOT NULL
   OR l.endereco IS NOT NULL;

GRANT SELECT ON public.vw_radarzap_imoveis TO authenticated;
GRANT ALL ON public.vw_radarzap_imoveis TO service_role;
