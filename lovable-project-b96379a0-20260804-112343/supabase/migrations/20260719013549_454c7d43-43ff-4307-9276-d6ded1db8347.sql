-- Server-side validation of the mandatory reference link (`url_anuncio`)
-- for the "Owner Ad" entity (lista_proprietarios_captacao).
-- Enforces the same rules as the client: required, http(s), host with TLD,
-- normalized (trim, add https:// scheme, remove trailing slash unless root).

CREATE OR REPLACE FUNCTION public.normalize_reference_url(raw text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  s text;
  scheme text;
  rest text;
  host text;
  path text;
  slash_pos int;
BEGIN
  IF raw IS NULL THEN RETURN NULL; END IF;
  s := btrim(raw);
  s := regexp_replace(s, '^[''"]|[''"]$', '', 'g');
  IF s = '' THEN RETURN NULL; END IF;

  -- Protocol-relative //example.com/x
  IF left(s, 2) = '//' THEN
    s := 'https:' || s;
  END IF;

  -- Add scheme if missing; reject other schemes (javascript:, data:, ftp: etc.)
  IF s !~* '^https?://' THEN
    IF s ~* '^[a-z][a-z0-9+.-]*:' THEN
      RETURN NULL;
    END IF;
    s := 'https://' || regexp_replace(s, '^/+', '');
  END IF;

  -- Split scheme and rest
  IF s ~* '^https://' THEN
    scheme := 'https://';
    rest := substring(s from 9);
  ELSE
    scheme := 'http://';
    rest := substring(s from 8);
  END IF;

  IF rest = '' THEN RETURN NULL; END IF;

  slash_pos := position('/' in rest);
  IF slash_pos = 0 THEN
    host := rest;
    path := '';
  ELSE
    host := substring(rest from 1 for slash_pos - 1);
    path := substring(rest from slash_pos); -- starts with '/'
  END IF;

  -- Strip userinfo/port for host validation
  host := regexp_replace(host, '^[^@]*@', '');
  host := split_part(host, ':', 1);

  IF host = '' OR position('.' in host) = 0 THEN
    RETURN NULL;
  END IF;

  -- Host must contain only valid chars
  IF host !~ '^[A-Za-z0-9.-]+$' THEN
    RETURN NULL;
  END IF;

  -- Trim trailing slash unless path is empty or root
  IF path <> '' AND path <> '/' AND right(path, 1) = '/' THEN
    -- remove all trailing slashes (query/fragment aren't at end after trim since we did not touch them)
    path := regexp_replace(path, '/+$', '');
  END IF;

  RETURN scheme || rest_rebuild(host, path);
END;
$$;

-- Helper used above to keep original host casing + reconstructed path
CREATE OR REPLACE FUNCTION public.rest_rebuild(host text, path text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT host || COALESCE(path, '');
$$;

CREATE OR REPLACE FUNCTION public.validate_lista_proprietario_link()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  normalized text;
BEGIN
  IF NEW.url_anuncio IS NULL OR btrim(NEW.url_anuncio) = '' THEN
    RAISE EXCEPTION 'O link de referência (url_anuncio) é obrigatório para o Anúncio de Proprietário.'
      USING ERRCODE = '23514';
  END IF;

  normalized := public.normalize_reference_url(NEW.url_anuncio);
  IF normalized IS NULL THEN
    RAISE EXCEPTION 'Link de referência inválido: "%". Informe uma URL http(s) bem formada (ex.: https://www.exemplo.com/anuncio/123).', NEW.url_anuncio
      USING ERRCODE = '23514';
  END IF;

  NEW.url_anuncio := normalized;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_lista_proprietario_link ON public.lista_proprietarios_captacao;
CREATE TRIGGER trg_validate_lista_proprietario_link
BEFORE INSERT OR UPDATE OF url_anuncio ON public.lista_proprietarios_captacao
FOR EACH ROW EXECUTE FUNCTION public.validate_lista_proprietario_link();
