

## Ticket Visibility Control - Per-Role Visibility

### Problem
The current `visible_to_owner` toggle is a single boolean that doesn't give you fine-grained control over who sees each ticket. Additionally, there may be a bug where a cleaner user also has `can_view_finance` permission, causing them to be treated as an "owner" role — which means the `visible_to_owner` toggle affects their view too.

### Root Cause (Likely Bug)
The edge function assigns roles with priority: if a user has `can_view_finance` on any property, they become "owner" even if they also have `can_mark_cleaned`. This means a cleaner with finance access gets filtered by `visible_to_owner` instead of `created_by_user_id`.

### Proposed Solution: Separate Visibility Toggles

Replace the single `visible_to_owner` boolean with two independent toggles:
- `visible_to_owner` — owner can see this ticket
- `visible_to_cleaner` — the creating cleaner (and other cleaners on that property) can see this ticket

**Default behavior when a ticket is created:**
- Created by cleaner: `visible_to_cleaner = true`, `visible_to_owner = false` (admin decides to share with owner)
- Created by admin: both `false` by default (admin toggles as needed)
- Created by owner: `visible_to_owner = true`, `visible_to_cleaner = false`

The ticket creator always sees their own tickets regardless of toggles.

### Changes

**1. Database migration** — Add `visible_to_cleaner` column:
```sql
ALTER TABLE maintenance_tickets 
ADD COLUMN visible_to_cleaner boolean NOT NULL DEFAULT true;
```

**2. `supabase/functions/maintenance-tickets/index.ts`**
- **GET**: For cleaners, show tickets where `created_by_user_id = userId` OR (`visible_to_cleaner = true` AND `property_id` in their accessible properties). For owners, keep existing `visible_to_owner` filter but also always include tickets they created.
- **POST**: Set defaults based on creator role
- **PUT**: Allow admin to toggle both `visible_to_owner` and `visible_to_cleaner`

**3. `src/components/TicketList.tsx`**
- Admin detail dialog: Add a second toggle "Visible to Cleaner" alongside existing "Visible to Owner"
- Show both toggles in the admin controls section

**4. Edge function role assignment fix** — In the authentication block, if a user has `can_mark_cleaned` access, they should be treated as a cleaner for ticket purposes even if they also have finance access. Alternatively, assign the most permissive role and adjust the query logic accordingly.

### Visibility Summary

| Scenario | Admin | Owner | Cleaner (creator) | Other cleaners |
|---|---|---|---|---|
| Default (cleaner creates) | Always | Toggle ON needed | Always (creator) | Toggle ON needed |
| Default (admin creates) | Always | Toggle ON needed | Toggle ON needed | Toggle ON needed |
| Default (owner creates) | Always | Always (creator) | Toggle ON needed | Toggle ON needed |

