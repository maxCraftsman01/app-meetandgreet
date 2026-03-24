

## Add "Cost Visible to Owner" Toggle

### Problem
The repair cost is currently shown to owners automatically whenever it's greater than 0. The admin needs a toggle to control whether the owner can see the repair cost, similar to the existing visibility toggles.

### Changes

**1. Database migration** — Add `cost_visible_to_owner` column:
```sql
ALTER TABLE maintenance_tickets 
ADD COLUMN cost_visible_to_owner boolean NOT NULL DEFAULT false;
```

**2. `supabase/functions/maintenance-tickets/index.ts`**
- **GET**: When returning tickets for owners, set `repair_cost` to `0` if `cost_visible_to_owner` is `false` (so the value never reaches the client)
- **PUT**: Allow admin to toggle `cost_visible_to_owner`

**3. `src/components/TicketList.tsx`**
- Admin detail dialog: Add a third toggle **"Cost Visible to Owner"** below the existing two visibility toggles
- Owner detail view: No change needed — the edge function will already hide the cost when the toggle is off
- List view: The existing `(role === "admin" || role === "owner") && ticket.repair_cost > 0` check will naturally hide it since the server returns `0`

### Admin controls will look like:
- Visible to Owner — toggle
- Visible to Cleaner — toggle
- Cost Visible to Owner — toggle (only shown when `visible_to_owner` is on, or always shown)
- Status — dropdown
- Repair Cost — input + save

