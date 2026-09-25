ALTER TABLE public.imobiliaria_config
  ADD COLUMN IF NOT EXISTS sem_contato_days integer NOT NULL DEFAULT 7
    CHECK (sem_contato_days BETWEEN 1 AND 90);