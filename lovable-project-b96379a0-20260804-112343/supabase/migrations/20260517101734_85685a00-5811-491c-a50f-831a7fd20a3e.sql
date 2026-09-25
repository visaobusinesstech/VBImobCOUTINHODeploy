-- Create extraction status enum if not exists
DO $$ BEGIN
    CREATE TYPE extraction_status AS ENUM ('pending', 'completed', 'incomplete', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add columns to contatos_landing
ALTER TABLE public.contatos_landing
ADD COLUMN IF NOT EXISTS extraction_status extraction_status DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS missing_fields TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS source_url TEXT,
ADD COLUMN IF NOT EXISTS extracted_data JSONB;

-- Create index for faster lookup of incomplete extractions
CREATE INDEX IF NOT EXISTS idx_contatos_landing_extraction_status ON public.contatos_landing(extraction_status);
