## Plan: Link multiple issues to one expense

Move from one-ticket-per-expense to many-tickets-per-expense using a join table. Existing single links are preserved via backfill; the old `expenses.linked_ticket_id` column is removed once data is migrated.

### Why a join table (not an array column)
- Proper referential integrity (cascade when a ticket is deleted).
- Bidirectional queries are trivial: "tickets for expense X" and "expenses for ticket Y" use the same table.
- Matches how the rest of the schema is modeled (e.g. `user_property_access`).

---

### 1. Database migration

Create `expense_tickets` join table:

```text
expense_tickets
  id           uuid PK
  expense_id   uuid  → expenses.id   (ON DELETE CASCADE)
  ticket_id    uuid  → maintenance_tickets.id  (ON DELETE CASCADE)
  created_at   timestamptz default now()
  UNIQUE (expense_id, ticket_id)
```

Indexes on `expense_id` and `ticket_id`. RLS enabled with **zero policies** (matches project pattern — all access goes through edge functions using the service role).

**Backfill**, in the same migration:
```sql
INSERT INTO expense_tickets (expense_id, ticket_id)
SELECT id, linked_ticket_id FROM expenses
WHERE linked_ticket_id IS NOT NULL
ON CONFLICT DO NOTHING;
```

Then drop the old column + FK:
```sql
ALTER TABLE expenses DROP COLUMN linked_ticket_id;
```

(Doing it in one migration keeps the schema and types regenerated together — no transient broken state.)

---

### 2. Edge function `supabase/functions/expenses/index.ts`

**Reads (GET)** — embed linked tickets via the join:
```ts
.select(`
  *,
  properties:property_id(name),
  assigned_user:assigned_to(name),
  expense_tickets(
    ticket_id,
    maintenance_tickets:ticket_id(id, title, status, property_id)
  )
`)
```
Flatten in the response to `linked_tickets: [{ id, title, status, property_id }, ...]` so the frontend gets a clean shape.

**POST / PUT** — accept `linked_ticket_ids: string[]` (optional, replaces the old scalar):
- Validate every id exists and belongs to the expense's `property_id` (reject cross-property links — keeps data clean).
- POST: insert expense, then bulk-insert join rows.
- PUT: diff against existing join rows → insert new ones, delete removed ones (no full wipe-and-replace, so the audit trail via `created_at` stays meaningful).

**DELETE** — unchanged (cascade handles join rows automatically).

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

`src/integrations/supabase/types.ts` regenerates automatically after the migration.

---

### 4. Frontend — `src/components/ExpenseFormDialog.tsx`

Replace the single-select ticket dropdown with a **multi-select picker**:

- State: `linked_ticket_ids: string[]` (initialized from `expense.linked_tickets.map(t => t.id)` in edit mode).
- UI: Popover containing a searchable, scrollable list of tickets for the **currently selected property** (re-filters when the property field changes). Each row: checkbox + ticket title + small status badge. Selected tickets render as removable chips above the picker.
- If the user changes `property_id` after selecting tickets → show a small inline warning and clear the selection (prevents cross-property links, which the backend would reject anyway).
- Send `linked_ticket_ids` in the POST/PUT payload.

---

### 5. Display sites

**`src/components/ExpenseList.tsx`** — under each expense row, render linked tickets as a row of small clickable chips (chip → opens the ticket in `TicketList`, or at minimum shows the title in a tooltip).

**`src/components/OwnerExpenseStatement.tsx`** — same chip treatment, but only for tickets where `visible_to_owner` is true (need to include that flag in the backend select). Hidden tickets are silently omitted so owners don't see "ghost" links.

**`src/components/TicketList.tsx`** — when a ticket detail is open, fetch and show a **"Linked expenses"** section listing every expense referencing this ticket (title, date, amount, payment status). Requires either:
- a small new edge function endpoint `GET /expenses?linked_ticket_id=<id>`, or
- extending the existing GET with a `linked_ticket_id` query param that filters via the join table.

Going with the second option — single endpoint, less surface area.

---

### 6. Test checklist

1. Create a new expense linked to 3 tickets on the same property → all 3 chips appear in `ExpenseList`.
2. Edit that expense, remove 1 ticket, add 1 different ticket → join rows reflect the diff (old `created_at` preserved for the unchanged ones).
3. Open one of those tickets → "Linked expenses" section shows the expense.
4. Try linking a ticket from a different property → backend rejects with clear error, dialog stays open.
5. Delete a ticket → its join rows vanish, expense remains intact with the other links.
6. Confirm pre-migration expenses with a single legacy link still display that link as one chip (backfill worked).
7. Owner statement: link a hidden ticket → owner sees no chip; link a visible ticket → owner sees the chip.

---

### Out of scope
- Splitting expense amounts proportionally across linked tickets (Option C). Can be added later by adding an optional `allocated_amount` column on `expense_tickets` without breaking anything built here.
- Bulk-link UI from the ticket side (selecting multiple tickets and creating one expense). The dialog flow above covers it from the expense side.

Approve and I'll switch to default mode and ship.