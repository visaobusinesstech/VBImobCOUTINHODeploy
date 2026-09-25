
-- Add estado_civil and canal_origem to proprietarios
ALTER TABLE public.proprietarios ADD COLUMN IF NOT EXISTS estado_civil text DEFAULT NULL;
ALTER TABLE public.proprietarios ADD COLUMN IF NOT EXISTS canal_origem text DEFAULT NULL;
ALTER TABLE public.proprietarios ADD COLUMN IF NOT EXISTS conjuge_nome text DEFAULT NULL;
ALTER TABLE public.proprietarios ADD COLUMN IF NOT EXISTS conjuge_cpf text DEFAULT NULL;

-- Add fiador/caucao/vistoria attachments and conjuge to contratos
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS conjuge_proprietario text DEFAULT NULL;
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS conjuge_cpf text DEFAULT NULL;
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS fiador_matricula_url text DEFAULT NULL;
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS caucao_comprovante_url text DEFAULT NULL;
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS vistoria_video_url text DEFAULT NULL;

-- Add aceita_fgts and foto_capa to imoveis
ALTER TABLE public.imoveis ADD COLUMN IF NOT EXISTS aceita_fgts boolean NOT NULL DEFAULT false;
ALTER TABLE public.imoveis ADD COLUMN IF NOT EXISTS foto_capa_index integer DEFAULT 0;
