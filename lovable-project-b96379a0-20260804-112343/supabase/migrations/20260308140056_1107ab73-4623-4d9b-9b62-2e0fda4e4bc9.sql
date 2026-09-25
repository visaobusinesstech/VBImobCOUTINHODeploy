-- Allow anonymous/public insert into leads table (for portal lead capture)
CREATE POLICY "Public can insert leads via portal"
ON public.leads
FOR INSERT
TO anon
WITH CHECK (true);
