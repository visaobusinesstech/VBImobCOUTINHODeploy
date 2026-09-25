
-- Tabela do allowlist de portais para captação
CREATE TABLE public.captacao_portais_allowlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dominio text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  regiao text,
  notas text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.captacao_portais_allowlist TO authenticated;
GRANT ALL ON public.captacao_portais_allowlist TO service_role;

ALTER TABLE public.captacao_portais_allowlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos autenticados podem ler allowlist"
  ON public.captacao_portais_allowlist FOR SELECT TO authenticated USING (true);
CREATE POLICY "Master gerencia allowlist insert"
  ON public.captacao_portais_allowlist FOR INSERT TO authenticated
  WITH CHECK (public.is_master(auth.uid()));
CREATE POLICY "Master gerencia allowlist update"
  ON public.captacao_portais_allowlist FOR UPDATE TO authenticated
  USING (public.is_master(auth.uid()));
CREATE POLICY "Master gerencia allowlist delete"
  ON public.captacao_portais_allowlist FOR DELETE TO authenticated
  USING (public.is_master(auth.uid()));

-- Versionamento (auditoria) das mudanças
CREATE TABLE public.captacao_portais_allowlist_versoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id uuid,
  dominio text NOT NULL,
  acao text NOT NULL CHECK (acao IN ('insert','update','delete')),
  dados_antes jsonb,
  dados_depois jsonb,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.captacao_portais_allowlist_versoes TO authenticated;
GRANT ALL ON public.captacao_portais_allowlist_versoes TO service_role;

ALTER TABLE public.captacao_portais_allowlist_versoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Master lê versões allowlist"
  ON public.captacao_portais_allowlist_versoes FOR SELECT TO authenticated
  USING (public.is_master(auth.uid()));

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.tg_captacao_portais_allowlist_upd()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  NEW.updated_by = COALESCE(auth.uid(), NEW.updated_by);
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_captacao_portais_allowlist_upd
  BEFORE UPDATE ON public.captacao_portais_allowlist
  FOR EACH ROW EXECUTE FUNCTION public.tg_captacao_portais_allowlist_upd();

-- Trigger versionamento
CREATE OR REPLACE FUNCTION public.tg_captacao_portais_allowlist_versao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.captacao_portais_allowlist_versoes(portal_id, dominio, acao, dados_depois, changed_by)
    VALUES (NEW.id, NEW.dominio, 'insert', to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.captacao_portais_allowlist_versoes(portal_id, dominio, acao, dados_antes, dados_depois, changed_by)
    VALUES (NEW.id, NEW.dominio, 'update', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.captacao_portais_allowlist_versoes(portal_id, dominio, acao, dados_antes, changed_by)
    VALUES (OLD.id, OLD.dominio, 'delete', to_jsonb(OLD), auth.uid());
    RETURN OLD;
  END IF;
  RETURN NULL;
END; $$;

CREATE TRIGGER trg_captacao_portais_allowlist_versao
  AFTER INSERT OR UPDATE OR DELETE ON public.captacao_portais_allowlist
  FOR EACH ROW EXECUTE FUNCTION public.tg_captacao_portais_allowlist_versao();

-- Seed inicial com os portais atualmente hardcoded
INSERT INTO public.captacao_portais_allowlist (dominio, regiao, notas) VALUES
  ('zapimoveis.com.br','nacional','Grande portal nacional'),
  ('vivareal.com.br','nacional','Grande portal nacional'),
  ('olx.com.br','nacional','Classificados'),
  ('quintoandar.com.br','nacional','Locação'),
  ('imovelweb.com.br','nacional',null),
  ('chavesnamao.com.br','nacional',null),
  ('mercadolivre.com.br','nacional','Classificados'),
  ('dfimoveis.com.br','df','Regional DF'),
  ('wimoveis.com.br','df','Regional DF'),
  ('brasiliaimoveis.com.br','df','Regional DF'),
  ('imovelguide.com.br','nacional',null),
  ('netimoveis.com.br','nacional',null),
  ('simovel.com.br','nacional',null),
  ('62imoveis.com.br','regional',null),
  ('mgfimoveis.com.br','regional',null),
  ('casamineira.com.br','mg',null),
  ('trovit.com.br','nacional','Agregador'),
  ('imoveis.trovit.com.br','nacional','Agregador'),
  ('properati.com.br','nacional',null),
  ('buscaimoveis.com.br','nacional',null),
  ('imovelk.com.br','nacional',null),
  ('apolar.com.br','pr','Regional PR'),
  ('lopes.com.br','nacional',null),
  ('creci.org.br','nacional','Órgão CRECI')
ON CONFLICT (dominio) DO NOTHING;
