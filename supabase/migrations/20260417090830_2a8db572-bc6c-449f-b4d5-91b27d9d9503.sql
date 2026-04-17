CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('cleaning','maintenance','repair','shopping','supplies','other')),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  amount NUMERIC,
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','invoiced')),
  paid_at TIMESTAMPTZ,
  visible_to_owner BOOLEAN NOT NULL DEFAULT false,
  assigned_to UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
  linked_ticket_id UUID REFERENCES public.maintenance_tickets(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES public.app_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_expenses_property_id ON public.expenses(property_id);
CREATE INDEX idx_expenses_payment_status ON public.expenses(payment_status);
CREATE INDEX idx_expenses_date ON public.expenses(date);
CREATE INDEX idx_expenses_assigned_to ON public.expenses(assigned_to);