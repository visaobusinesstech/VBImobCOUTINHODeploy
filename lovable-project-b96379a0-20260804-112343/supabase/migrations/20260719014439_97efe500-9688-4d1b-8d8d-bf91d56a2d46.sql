
-- 1) Replace normalize_reference_url with FE-parity behavior:
--    - Preserve query string and fragment
--    - Only strip trailing slash from the path portion (never from raw query/hash)
--    - Reject dangerous schemes and require host with a dot
CREATE OR REPLACE FUNCTION public.normalize_reference_url(raw text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $function$
DECLARE
  s text;
  scheme text;
  rest text;
  host text;
  path_and_rest text;
  path_only text;
  suffix text := '';
  q_pos int;
  h_pos int;
  slash_pos int;
BEGIN
  IF raw IS NULL THEN RETURN NULL; END IF;
  s := btrim(raw);
  -- strip a single surrounding pair of quotes
  s := regexp_replace(s, '^[''"]', '');
  s := regexp_replace(s, '[''"]$', '');
  s := btrim(s);
  IF s = '' THEN RETURN NULL; END IF;

  -- protocol-relative
  IF left(s, 2) = '//' THEN
    s := 'https:' || s;
  END IF;

  -- add scheme if missing; reject other schemes (javascript:, data:, mailto: etc.)
  IF s !~* '^https?://' THEN
    IF s ~* '^[a-z][a-z0-9+.-]*:' THEN
      RETURN NULL;
    END IF;
    s := 'https://' || regexp_replace(s, '^/+', '');
  END IF;

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
    path_and_rest := '';
  ELSE
    host := substring(rest from 1 for slash_pos - 1);
    path_and_rest := substring(rest from slash_pos);
  END IF;

  -- strip userinfo/port for validation
  host := regexp_replace(host, '^[^@]*@', '');
  host := split_part(host, ':', 1);

  IF host = '' OR position('.' in host) = 0 THEN
    RETURN NULL;
  END IF;
  IF host !~ '^[A-Za-z0-9.-]+$' THEN
    RETURN NULL;
  END IF;

  -- split path from ?query and #fragment
  path_only := path_and_rest;
  q_pos := position('?' in path_only);
  h_pos := position('#' in path_only);
  IF q_pos > 0 AND (h_pos = 0 OR q_pos < h_pos) THEN
    suffix := substring(path_only from q_pos);
    path_only := substring(path_only from 1 for q_pos - 1);
  ELSIF h_pos > 0 THEN
    suffix := substring(path_only from h_pos);
    path_only := substring(path_only from 1 for h_pos - 1);
  END IF;

  -- trim trailing slash on path only (never on root "/")
  IF length(path_only) > 1 AND right(path_only, 1) = '/' THEN
    path_only := regexp_replace(path_only, '/+$', '');
  END IF;

  RETURN scheme || host || path_only || suffix;
END;
$function$;

-- 2) Generic normalizer for url_anuncio (non-strict): normalize when provided,
--    leave NULL/empty as NULL. Suitable for tables where the link is optional.
CREATE OR REPLACE FUNCTION public.normalize_url_anuncio_trigger()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  normalized text;
BEGIN
  IF NEW.url_anuncio IS NULL OR btrim(NEW.url_anuncio) = '' THEN
    NEW.url_anuncio := NULL;
    RETURN NEW;
  END IF;

  normalized := public.normalize_reference_url(NEW.url_anuncio);
  IF normalized IS NULL THEN
    RAISE EXCEPTION 'Link inválido em url_anuncio: "%". Informe uma URL http(s) bem formada (ex.: https://www.exemplo.com/anuncio/123).', NEW.url_anuncio
      USING ERRCODE = '23514';
  END IF;

  NEW.url_anuncio := normalized;
  RETURN NEW;
END;
$function$;

-- 3) Apply normalization trigger on imoveis (link opcional, mas sempre normalizado)
DROP TRIGGER IF EXISTS trg_normalize_url_anuncio_imoveis ON public.imoveis;
CREATE TRIGGER trg_normalize_url_anuncio_imoveis
BEFORE INSERT OR UPDATE OF url_anuncio ON public.imoveis
FOR EACH ROW
EXECUTE FUNCTION public.normalize_url_anuncio_trigger();

-- 4) Apply normalization trigger on imoveis_mercado
DROP TRIGGER IF EXISTS trg_normalize_url_anuncio_mercado ON public.imoveis_mercado;
CREATE TRIGGER trg_normalize_url_anuncio_mercado
BEFORE INSERT OR UPDATE OF url_anuncio ON public.imoveis_mercado
FOR EACH ROW
EXECUTE FUNCTION public.normalize_url_anuncio_trigger();

-- 5) Existing strict trigger on lista_proprietarios_captacao (validate_lista_proprietario_link)
--    already calls normalize_reference_url and now inherits the FE-parity behavior.
--    Nothing to change there.
