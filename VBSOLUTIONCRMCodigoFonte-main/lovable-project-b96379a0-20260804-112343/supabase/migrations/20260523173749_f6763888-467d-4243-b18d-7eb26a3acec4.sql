ALTER TABLE public.user_ai_config 
ADD COLUMN serper_config JSONB DEFAULT '{
  "real_estate": {
    "enabled": true,
    "portals": ["zapimoveis.com.br", "vivareal.com.br", "olx.com.br", "imovelweb.com.br"]
  },
  "owner_diligence": {
    "enabled": true,
    "portals": ["jusbrasil.com.br", "escavador.com", "linkedin.com", "facebook.com", "instagram.com"]
  }
}'::jsonb;