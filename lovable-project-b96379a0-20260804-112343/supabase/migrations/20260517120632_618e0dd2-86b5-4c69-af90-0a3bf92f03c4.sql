-- Add foreign key constraint to link system_logs to profiles
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'system_logs_user_id_fkey' 
        AND table_name = 'system_logs'
    ) THEN
        ALTER TABLE public.system_logs
        ADD CONSTRAINT system_logs_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES public.profiles(id)
        ON DELETE CASCADE;
    END IF;
END $$;