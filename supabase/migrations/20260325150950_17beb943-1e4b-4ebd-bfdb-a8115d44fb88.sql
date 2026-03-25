CREATE TABLE public.pin_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pin_attempts ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_pin_attempts_ip_time ON public.pin_attempts (ip_address, attempted_at DESC);