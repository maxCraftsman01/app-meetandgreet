-- Create join table for many-to-many expense<->ticket relationship
CREATE TABLE IF NOT EXISTS public.expense_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_id UUID NOT NULL,
  ticket_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (expense_id, ticket_id)
);

CREATE INDEX IF NOT EXISTS idx_expense_tickets_expense ON public.expense_tickets(expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_tickets_ticket ON public.expense_tickets(ticket_id);

ALTER TABLE public.expense_tickets ENABLE ROW LEVEL SECURITY;

-- Backfill from legacy column
INSERT INTO public.expense_tickets (expense_id, ticket_id)
SELECT id, linked_ticket_id
FROM public.expenses
WHERE linked_ticket_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Drop legacy column
ALTER TABLE public.expenses DROP COLUMN IF EXISTS linked_ticket_id;
