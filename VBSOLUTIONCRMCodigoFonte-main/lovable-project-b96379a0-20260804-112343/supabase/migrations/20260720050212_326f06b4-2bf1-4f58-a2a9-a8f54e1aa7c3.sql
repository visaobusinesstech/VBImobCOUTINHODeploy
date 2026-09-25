
-- 1) Configurable threshold
ALTER TABLE public.lighthouse_config
  ADD COLUMN IF NOT EXISTS regression_delta INT NOT NULL DEFAULT 10;

-- 2) Alerts table
CREATE TABLE IF NOT EXISTS public.lighthouse_regression_alertas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  path TEXT NOT NULL,
  strategy TEXT NOT NULL CHECK (strategy IN ('mobile','desktop')),
  metric TEXT NOT NULL CHECK (metric IN ('performance','seo','accessibility','best_practices')),
  previous_score INT NOT NULL,
  current_score INT NOT NULL,
  delta INT NOT NULL,
  threshold INT NOT NULL,
  previous_audit_id UUID,
  current_audit_id UUID,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.lighthouse_regression_alertas TO authenticated;
GRANT ALL ON public.lighthouse_regression_alertas TO service_role;

ALTER TABLE public.lighthouse_regression_alertas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read regression alerts"
  ON public.lighthouse_regression_alertas FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated resolve regression alerts"
  ON public.lighthouse_regression_alertas FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (status IN ('open','resolved'));

CREATE POLICY "Service role manage regression alerts"
  ON public.lighthouse_regression_alertas FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_lh_reg_alertas_status_created
  ON public.lighthouse_regression_alertas (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lh_reg_alertas_path
  ON public.lighthouse_regression_alertas (path, strategy);

-- 3) Trigger: compare each new OK audit against the previous one for same path+strategy
CREATE OR REPLACE FUNCTION public.detect_lighthouse_regression()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prev RECORD;
  threshold INT;
  delta INT;
BEGIN
  IF NEW.status <> 'ok' THEN
    RETURN NEW;
  END IF;

  -- lowest configured threshold across tenants, default 10
  SELECT COALESCE(MIN(regression_delta), 10) INTO threshold
  FROM public.lighthouse_config;

  SELECT * INTO prev
  FROM public.lighthouse_audits
  WHERE path = NEW.path
    AND strategy = NEW.strategy
    AND status = 'ok'
    AND id <> NEW.id
    AND created_at < NEW.created_at
  ORDER BY created_at DESC
  LIMIT 1;

  IF prev.id IS NULL THEN
    RETURN NEW;
  END IF;

  -- performance
  IF prev.performance_score IS NOT NULL AND NEW.performance_score IS NOT NULL THEN
    delta := prev.performance_score - NEW.performance_score;
    IF delta >= threshold THEN
      INSERT INTO public.lighthouse_regression_alertas
        (path, strategy, metric, previous_score, current_score, delta, threshold, previous_audit_id, current_audit_id)
      VALUES (NEW.path, NEW.strategy, 'performance', prev.performance_score, NEW.performance_score, delta, threshold, prev.id, NEW.id);
    END IF;
  END IF;

  -- seo
  IF prev.seo_score IS NOT NULL AND NEW.seo_score IS NOT NULL THEN
    delta := prev.seo_score - NEW.seo_score;
    IF delta >= threshold THEN
      INSERT INTO public.lighthouse_regression_alertas
        (path, strategy, metric, previous_score, current_score, delta, threshold, previous_audit_id, current_audit_id)
      VALUES (NEW.path, NEW.strategy, 'seo', prev.seo_score, NEW.seo_score, delta, threshold, prev.id, NEW.id);
    END IF;
  END IF;

  -- accessibility
  IF prev.accessibility_score IS NOT NULL AND NEW.accessibility_score IS NOT NULL THEN
    delta := prev.accessibility_score - NEW.accessibility_score;
    IF delta >= threshold THEN
      INSERT INTO public.lighthouse_regression_alertas
        (path, strategy, metric, previous_score, current_score, delta, threshold, previous_audit_id, current_audit_id)
      VALUES (NEW.path, NEW.strategy, 'accessibility', prev.accessibility_score, NEW.accessibility_score, delta, threshold, prev.id, NEW.id);
    END IF;
  END IF;

  -- best practices
  IF prev.best_practices_score IS NOT NULL AND NEW.best_practices_score IS NOT NULL THEN
    delta := prev.best_practices_score - NEW.best_practices_score;
    IF delta >= threshold THEN
      INSERT INTO public.lighthouse_regression_alertas
        (path, strategy, metric, previous_score, current_score, delta, threshold, previous_audit_id, current_audit_id)
      VALUES (NEW.path, NEW.strategy, 'best_practices', prev.best_practices_score, NEW.best_practices_score, delta, threshold, prev.id, NEW.id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_detect_lighthouse_regression ON public.lighthouse_audits;
CREATE TRIGGER trg_detect_lighthouse_regression
  AFTER INSERT ON public.lighthouse_audits
  FOR EACH ROW EXECUTE FUNCTION public.detect_lighthouse_regression();
