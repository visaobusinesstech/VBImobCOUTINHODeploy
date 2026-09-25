
-- Profiles table for logged-in users (imobiliárias)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL DEFAULT '',
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', ''), NEW.email);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Corretores table (brokers owned by each imobiliária)
CREATE TABLE public.corretores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  imobiliaria_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  status TEXT NOT NULL DEFAULT 'ativo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.corretores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can select corretores" ON public.corretores FOR SELECT USING (auth.uid() = imobiliaria_id);
CREATE POLICY "Owner can insert corretores" ON public.corretores FOR INSERT WITH CHECK (auth.uid() = imobiliaria_id);
CREATE POLICY "Owner can update corretores" ON public.corretores FOR UPDATE USING (auth.uid() = imobiliaria_id);
CREATE POLICY "Owner can delete corretores" ON public.corretores FOR DELETE USING (auth.uid() = imobiliaria_id);

-- Corretor permissions table (toggle on/off per module)
CREATE TABLE public.corretor_permissoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  corretor_id UUID NOT NULL REFERENCES public.corretores(id) ON DELETE CASCADE,
  modulo TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(corretor_id, modulo)
);

ALTER TABLE public.corretor_permissoes ENABLE ROW LEVEL SECURITY;

-- Helper function to check corretor ownership
CREATE OR REPLACE FUNCTION public.owns_corretor(_corretor_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.corretores WHERE id = _corretor_id AND imobiliaria_id = auth.uid()
  );
$$;

CREATE POLICY "Owner can select permissoes" ON public.corretor_permissoes FOR SELECT USING (public.owns_corretor(corretor_id));
CREATE POLICY "Owner can insert permissoes" ON public.corretor_permissoes FOR INSERT WITH CHECK (public.owns_corretor(corretor_id));
CREATE POLICY "Owner can update permissoes" ON public.corretor_permissoes FOR UPDATE USING (public.owns_corretor(corretor_id));
CREATE POLICY "Owner can delete permissoes" ON public.corretor_permissoes FOR DELETE USING (public.owns_corretor(corretor_id));
