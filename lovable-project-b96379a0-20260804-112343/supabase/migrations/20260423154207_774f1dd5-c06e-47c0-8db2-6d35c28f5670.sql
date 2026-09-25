ALTER TABLE public.imoveis 
  ADD COLUMN IF NOT EXISTS url_anuncio text,
  ADD COLUMN IF NOT EXISTS portal_origem text;