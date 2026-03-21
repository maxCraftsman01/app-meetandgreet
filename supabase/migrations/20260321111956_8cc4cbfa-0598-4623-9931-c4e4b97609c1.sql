
ALTER TABLE public.manual_reservations ADD COLUMN external_id text;
CREATE INDEX idx_manual_reservations_external_id ON public.manual_reservations(external_id);
