
CREATE TABLE public.whatsapp_contatos_captacao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  imobiliaria_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lista_proprietario_id UUID NOT NULL REFERENCES public.lista_proprietarios_captacao(id) ON DELETE CASCADE,
  telefone_digits TEXT NOT NULL,
  url_anuncio TEXT,
  mensagem_preview TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wa_contatos_tenant_phone_time
  ON public.whatsapp_contatos_captacao (imobiliaria_id, telefone_digits, sent_at DESC);

CREATE INDEX idx_wa_contatos_lista
  ON public.whatsapp_contatos_captacao (lista_proprietario_id, sent_at DESC);

GRANT SELECT, INSERT ON public.whatsapp_contatos_captacao TO authenticated;
GRANT ALL ON public.whatsapp_contatos_captacao TO service_role;

ALTER TABLE public.whatsapp_contatos_captacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_wa_contatos"
  ON public.whatsapp_contatos_captacao FOR SELECT
  TO authenticated
  USING (imobiliaria_id = auth.uid());

CREATE POLICY "tenant_insert_wa_contatos"
  ON public.whatsapp_contatos_captacao FOR INSERT
  TO authenticated
  WITH CHECK (imobiliaria_id = auth.uid() AND user_id = auth.uid());

-- RPC: rate-limited registration (1 contato / 7 dias por telefone dentro do tenant)
CREATE OR REPLACE FUNCTION public.register_whatsapp_contato_captacao(
  p_lista_id UUID,
  p_mensagem TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_rec  public.lista_proprietarios_captacao%ROWTYPE;
  v_digits TEXT;
  v_last  TIMESTAMPTZ;
  v_next  TIMESTAMPTZ;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'unauthenticated');
  END IF;

  SELECT * INTO v_rec FROM public.lista_proprietarios_captacao WHERE id = p_lista_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'not_found');
  END IF;

  IF v_rec.imobiliaria_id <> v_user THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'forbidden');
  END IF;

  v_digits := regexp_replace(COALESCE(v_rec.telefone, ''), '\D', '', 'g');
  IF v_digits = '' OR length(v_digits) < 10 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'invalid_phone');
  END IF;

  SELECT MAX(sent_at) INTO v_last
  FROM public.whatsapp_contatos_captacao
  WHERE imobiliaria_id = v_user
    AND telefone_digits = v_digits;

  IF v_last IS NOT NULL AND v_last > now() - INTERVAL '7 days' THEN
    v_next := v_last + INTERVAL '7 days';
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'rate_limited',
      'last_sent_at', v_last,
      'next_allowed_at', v_next
    );
  END IF;

  INSERT INTO public.whatsapp_contatos_captacao
    (imobiliaria_id, user_id, lista_proprietario_id, telefone_digits, url_anuncio, mensagem_preview)
  VALUES
    (v_user, v_user, p_lista_id, v_digits, v_rec.url_anuncio, LEFT(COALESCE(p_mensagem, ''), 500));

  RETURN jsonb_build_object('allowed', true, 'telefone_digits', v_digits);
END;
$$;

REVOKE ALL ON FUNCTION public.register_whatsapp_contato_captacao(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_whatsapp_contato_captacao(UUID, TEXT) TO authenticated;
