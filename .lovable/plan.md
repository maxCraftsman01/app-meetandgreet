
The user wants a new `expenses` table migration following the existing zero-policy RLS pattern (all access via Edge Functions with service role).

## Plan: Create `expenses` Table Migration

### Migration SQL

```sql
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
```

### Notes
- RLS enabled, no policies — matches `maintenance_tickets` pattern (access via Edge Functions with service role).
- CHECK constraints on `category` and `payment_status` enforce allowed values.
- FK behaviors: `property_id` cascades on property delete; `assigned_to` and `linked_ticket_id` set NULL to preserve expense history; `created_by` has no cascade.
- Four indexes added per spec for common filter columns.

### Next steps after migration
This migration only creates the schema. To actually use expenses, follow-up work will be needed:
- Edge function `expenses` for CRUD (admin + assigned-user access)
- Admin UI to create/edit/assign expenses
- Owner dashboard section to view `visible_to_owner` expenses
- Optional link from maintenance ticket → create expense

Confirm and I'll run the migration.
