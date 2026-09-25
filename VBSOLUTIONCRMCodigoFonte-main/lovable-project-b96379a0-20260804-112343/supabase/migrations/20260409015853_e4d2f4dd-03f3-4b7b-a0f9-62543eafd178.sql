-- Add signup_ip to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS signup_ip text NULL;

-- Table to track registration IPs for abuse detection
CREATE TABLE IF NOT EXISTS public.signup_ips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.signup_ips ENABLE ROW LEVEL SECURITY;

-- Only service role can insert (via edge function), no direct user access
CREATE POLICY "No direct access to signup_ips"
ON public.signup_ips FOR SELECT TO authenticated
USING (false);

-- Function to check IP abuse (called from edge functions)
CREATE OR REPLACE FUNCTION public.check_ip_abuse(_ip text)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer
  FROM public.signup_ips
  WHERE ip_address = _ip
    AND created_at > now() - interval '30 days'
$$;

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_signup_ips_ip ON public.signup_ips(ip_address);
CREATE INDEX IF NOT EXISTS idx_signup_ips_created ON public.signup_ips(created_at);
