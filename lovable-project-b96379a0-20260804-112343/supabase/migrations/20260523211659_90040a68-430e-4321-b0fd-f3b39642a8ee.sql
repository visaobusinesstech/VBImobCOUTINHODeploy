-- Table for WordPress sites
CREATE TABLE public.wordpress_sites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  imobiliaria_id UUID NOT NULL REFERENCES public.imobiliaria_config(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  username TEXT NOT NULL, -- The user email as per instructions
  application_password TEXT NOT NULL,
  seo_plugin TEXT DEFAULT 'none', -- none, yoast
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for Article Types / Prompt Models
CREATE TABLE public.article_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  imobiliaria_id UUID NOT NULL REFERENCES public.imobiliaria_config(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  prompt_template TEXT NOT NULL,
  use_serper BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.wordpress_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_types ENABLE ROW LEVEL SECURITY;

-- Policies for wordpress_sites
CREATE POLICY "Users can manage their own imobiliaria wordpress sites"
ON public.wordpress_sites
FOR ALL
USING (
  imobiliaria_id IN (
    SELECT id FROM public.imobiliaria_config WHERE id = public.wordpress_sites.imobiliaria_id
  )
);

-- Policies for article_types
CREATE POLICY "Users can manage their own imobiliaria article types"
ON public.article_types
FOR ALL
USING (
  imobiliaria_id IN (
    SELECT id FROM public.imobiliaria_config WHERE id = public.article_types.imobiliaria_id
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_wordpress_sites_updated_at
BEFORE UPDATE ON public.wordpress_sites
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_article_types_updated_at
BEFORE UPDATE ON public.article_types
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
