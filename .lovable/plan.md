## Plan: Link multiple issues to one expense

Move from one-ticket-per-expense to many-tickets-per-expense using a join table. Existing single links are preserved via backfill; the legacy `expenses.linked_ticket_id` column is removed once data is migrated.

### Why a join table (not an array column)
- Proper referential integrity (cascade when a ticket is deleted).
- Bidirectional queries: "tickets for expense X" and "expenses for ticket Y" use the same table.
- Matches existing schema patterns (e.g. `user_property_access`).

---

### 1. Database migration

Create `expense_tickets` join table:

```text
expense_tickets
  id           uuid PK
  expense_id   uuid  → expenses.id              (ON DELETE CASCADE)
  ticket_id    uuid  → maintenance_tickets.id   (ON DELETE CASCADE)
  created_at   timestamptz default now()
  UNIQUE (expense_id, ticket_id)
```

Indexes on `expense_id` and `ticket_id`. RLS enabled with **zero policies** (project pattern — all access via edge functions using service role).

**Backfill** in the same migration:
```sql
INSERT INTO expense_tickets (expense_id, ticket_id)
SELECT id, linked_ticket_id FROM expenses
WHERE linked_ticket_id IS NOT NULL
ON CONFLICT DO NOTHING;
```

Then drop the old column:
```sql
ALTER TABLE expenses DROP COLUMN linked_ticket_id;
```

One migration → schema + types regenerate together, no broken intermediate state.

---

### 2. Edge function `supabase/functions/expenses/index.ts`

**GET** — embed linked tickets via the join and flatten:
```ts
.select(`
  *,
  properties:property_id(name),
  assigned_user:assigned_to(name),
  expense_tickets(
    maintenance_tickets:ticket_id(id, title, status, property_id, visible_to_owner)
  )
`)
```
Response shape: `linked_tickets: [{ id, title, status, property_id }, ...]`. For owner role, filter out tickets where `visible_to_owner = false` before returning.

Add support for `?linked_ticket_id=<id>` query param → returns expenses joined to that ticket (used by ticket detail view).

**POST / PUT** — accept `linked_ticket_ids: string[]` (replaces the old scalar):
- Validate every id exists and belongs to the expense's `property_id` (reject cross-property links).
- POST: insert expense, then bulk-insert join rows.
- PUT: diff vs. existing rows → insert new, delete removed (preserves `created_at` on unchanged links).

**DELETE** — unchanged (cascade handles join rows).

---

### 3. Types — `src/types/index.ts`

```ts
export interface LinkedTicketSummary {
  id: string;
  title: string;
  status: string;
  property_id: string;
}

export interface Expense {
  // ...existing fields, MINUS linked_ticket_id
  linked_tickets: LinkedTicketSummary[];
}
```

`src/integrations/supabase/types.ts` regenerates automatically.

---

### 4. Frontend — `src/components/ExpenseFormDialog.tsx`

Replace the single-select ticket dropdown with a **multi-select picker**:

- State: `linked_ticket_ids: string[]` (initialized from `expense.linked_tickets.map(t => t.id)` in edit mode).
- UI: Popover with searchable, scrollable list of tickets for the **currently selected property** (re-filters when property changes). Each row: checkbox + title + status badge. Selected tickets render as removable chips above the picker.
- Changing `property_id` after selecting tickets → inline warning + clear selection (backend would reject anyway).
- Send `linked_ticket_ids` in POST/PUT payload.

---

### 5. Display sites

**`src/components/ExpenseList.tsx`** — under each expense row, render linked tickets as small clickable chips.

**`src/components/OwnerExpenseStatement.tsx`** — same chip treatment. Backend already filters hidden tickets out for owner role, so frontend just renders what it gets.

**`src/components/TicketList.tsx`** — when a ticket detail is open, fetch `GET /expenses?linked_ticket_id=<id>` and show a **"Linked expenses"** section listing every expense referencing the ticket (title, date, amount, payment status).

---

### 6. Test checklist

1. Create expense linked to 3 tickets on same property → 3 chips appear in `ExpenseList`.
2. Edit, remove 1 ticket, add a different one → diff applied, untouched links keep their `created_at`.
3. Open one of those tickets → "Linked expenses" section shows the expense.
4. Try linking a ticket from a different property → backend rejects with clear error.
5. Delete a ticket → its join rows vanish, expense remains intact.
6. Pre-migration expenses with a single legacy link still display that link as one chip.
7. Owner statement: hidden ticket → no chip; visible ticket → chip shown.

---

### Out of scope
- Splitting expense amounts proportionally across linked tickets. Easy add later via optional `allocated_amount` column on `expense_tickets`.
- Bulk-link UI from the ticket side (one expense covering multiple tickets selected from ticket list).

Approve and I'll switch to default mode and ship it.