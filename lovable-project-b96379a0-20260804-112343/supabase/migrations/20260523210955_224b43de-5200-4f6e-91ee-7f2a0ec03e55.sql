-- 1. Limpeza da tabela contatos_landing
-- Removemos a política redundante que poderia estar causando alertas
DROP POLICY IF EXISTS "Usuários veem suas próprias extrações" ON public.contatos_landing;

-- 2. Proteção da tabela error_notifications
-- Garantimos que apenas administradores (is_master) possam ler os erros
DROP POLICY IF EXISTS "Masters can view error notifications" ON public.error_notifications;
CREATE POLICY "Only admins can view error notifications" 
ON public.error_notifications 
FOR SELECT 
TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_master = true));

-- Bloqueamos qualquer inserção, atualização ou deleção externa (já que deve ser via trigger/função interna)
DROP POLICY IF EXISTS "Deny all writes to error_notifications" ON public.error_notifications;
-- RLS já bloqueia por padrão o que não tem política, mas seremos explícitos se necessário.
-- Como queremos bloquear escrita externa, simplesmente não criamos políticas de INSERT/UPDATE/DELETE.

-- 3. Proteção da tabela error_threshold_logs
-- Garantimos que apenas administradores possam ler
DROP POLICY IF EXISTS "Masters can view threshold logs" ON public.error_threshold_logs;
CREATE POLICY "Only admins can view threshold logs" 
ON public.error_threshold_logs 
FOR SELECT 
TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_master = true));

-- Tabelas de log/erro não devem permitir escrita manual via API pública
-- Mantemos apenas as políticas de leitura para administradores.
