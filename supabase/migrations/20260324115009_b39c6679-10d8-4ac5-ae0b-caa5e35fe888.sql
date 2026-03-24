
-- Maintenance tickets table
CREATE TABLE public.maintenance_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  created_by_user_id uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  created_by_role text NOT NULL DEFAULT 'cleaner',
  title text NOT NULL,
  description text DEFAULT '',
  status text NOT NULL DEFAULT 'open',
  priority text NOT NULL DEFAULT 'normal',
  repair_cost numeric NOT NULL DEFAULT 0,
  visible_to_owner boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

-- Ticket media table
CREATE TABLE public.ticket_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.maintenance_tickets(id) ON DELETE CASCADE,
  media_type text NOT NULL,
  storage_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.maintenance_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_media ENABLE ROW LEVEL SECURITY;

-- Storage bucket for ticket media
INSERT INTO storage.buckets (id, name, public) VALUES ('ticket-media', 'ticket-media', true);

-- Storage policy: allow authenticated uploads
CREATE POLICY "Allow public read on ticket-media"
ON storage.objects FOR SELECT
USING (bucket_id = 'ticket-media');

-- Allow uploads via service role (edge function handles auth)
CREATE POLICY "Allow service role uploads on ticket-media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'ticket-media');
