
CREATE TABLE public.contatos_landing (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  telefone TEXT,
  mensagem TEXT NOT NULL,
  lido BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Public table - no auth required for inserts
ALTER TABLE public.contatos_landing ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (public contact form)
CREATE POLICY "Anyone can submit contact form"
  ON public.contatos_landing
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Only authenticated master users can read
CREATE POLICY "Master can read contacts"
  ON public.contatos_landing
  FOR SELECT
  TO authenticated
  USING (public.is_master(auth.uid()));
