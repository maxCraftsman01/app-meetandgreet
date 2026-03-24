

## Hide Repair Cost from Cleaners

### Problem
Cleaners can currently see the repair cost value on tickets in both the list view and detail dialog. This should only be visible to admins and property owners.

### Changes

**`src/components/TicketList.tsx`** — 2 locations:

1. **List card** (line 165-167): Wrap the repair cost display with a role check — only show when `role === "admin" || role === "owner"`

2. **Detail dialog** (lines 257-268): The repair cost input section is already inside the `role === "admin"` block, so it's already hidden from cleaners and owners. However, we should also add a read-only cost display for owners. Currently owners see no cost info at all in the detail view.

   Add a read-only cost display for owners (after the admin controls block): if `role === "owner"` and `repair_cost > 0`, show the cost as plain text.

### Summary of visibility:
| Element | Admin | Owner | Cleaner |
|---------|-------|-------|---------|
| Cost in list card | Yes | Yes | **No** |
| Cost edit in detail | Yes | No | No |
| Cost read-only in detail | Yes | Yes | **No** |

