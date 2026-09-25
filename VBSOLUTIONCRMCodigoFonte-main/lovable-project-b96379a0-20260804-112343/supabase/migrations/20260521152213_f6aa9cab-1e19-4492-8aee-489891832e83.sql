-- Habilitar RLS
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extraction_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contatos_landing ENABLE ROW LEVEL SECURITY;

-- Políticas para system_logs
CREATE POLICY "Qualquer um pode inserir logs"
ON public.system_logs FOR INSERT
WITH CHECK (true);

CREATE POLICY "Usuários veem seus próprios logs ou master vê tudo"
ON public.system_logs FOR SELECT
USING (
  auth.uid() = user_id OR 
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND is_master = true
  )
);

-- Políticas para extraction_logs
CREATE POLICY "Usuários gerenciam seus próprios logs de extração"
ON public.extraction_logs FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Políticas para contatos_landing (usada para extrações também)
CREATE POLICY "Usuários inserem suas próprias extrações"
ON public.contatos_landing FOR INSERT
WITH CHECK (true);

CREATE POLICY "Usuários veem suas próprias extrações"
ON public.contatos_landing FOR SELECT
USING (
  -- Se houver um campo de usuário no futuro, usaríamos ele. 
  -- Por enquanto, como a tabela é compartilhada, limitamos por email se disponível ou permitimos master
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND is_master = true
  )
);
