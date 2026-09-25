
CREATE TABLE public.edge_function_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id text NOT NULL,
  function_name text NOT NULL,
  user_id uuid,
  status text NOT NULL DEFAULT 'started',
  http_status integer,
  duration_ms integer,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_edge_function_requests_request_id ON public.edge_function_requests(request_id);
CREATE INDEX idx_edge_function_requests_user_id ON public.edge_function_requests(user_id);
CREATE INDEX idx_edge_function_requests_function_name ON public.edge_function_requests(function_name);
CREATE INDEX idx_edge_function_requests_created_at ON public.edge_function_requests(created_at DESC);

GRANT SELECT ON public.edge_function_requests TO authenticated;
GRANT ALL ON public.edge_function_requests TO service_role;

ALTER TABLE public.edge_function_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Masters podem ver todas as requisições"
  ON public.edge_function_requests
  FOR SELECT
  TO authenticated
  USING (public.is_master(auth.uid()));

CREATE POLICY "Usuários veem suas próprias requisições"
  ON public.edge_function_requests
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
