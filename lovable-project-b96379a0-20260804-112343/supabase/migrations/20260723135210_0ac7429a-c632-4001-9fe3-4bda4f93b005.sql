
-- 1) Primeiro rejeitar leads sem fonte (o trigger antigo só valida quando url_anuncio muda, então esta UPDATE passa)
UPDATE public.lista_proprietarios_captacao
SET
  status_revisao = 'rejeitado',
  rejeitado_motivo = COALESCE(NULLIF(rejeitado_motivo, ''), 'LGPD: sem fonte pública (url_anuncio ausente). Lead gerado sem origem verificável foi bloqueado automaticamente para contato.'),
  revisado_em = COALESCE(revisado_em, now())
WHERE (url_anuncio IS NULL OR btrim(url_anuncio) = '')
  AND COALESCE(status_revisao, 'pendente') <> 'rejeitado';

-- 2) Agora endurecer o trigger para validar todo INSERT/UPDATE
DROP TRIGGER IF EXISTS trg_validate_lista_proprietario_link ON public.lista_proprietarios_captacao;

CREATE TRIGGER trg_validate_lista_proprietario_link
BEFORE INSERT ON public.lista_proprietarios_captacao
FOR EACH ROW EXECUTE FUNCTION public.validate_lista_proprietario_link();

CREATE TRIGGER trg_validate_lista_proprietario_link_upd
BEFORE UPDATE OF url_anuncio ON public.lista_proprietarios_captacao
FOR EACH ROW EXECUTE FUNCTION public.validate_lista_proprietario_link();
