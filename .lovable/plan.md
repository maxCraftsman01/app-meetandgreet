

## Fix: Hide Repair Cost from Cleaners

### Problem
The cleaner GET path (lines 118-131) returns `repair_cost` without any masking. Cost masking only exists for the owner path. So cleaners always see the full repair cost.

### Changes

**`supabase/functions/maintenance-tickets/index.ts`** (line 128-130)
- After fetching tickets for cleaners, mask `repair_cost` to `0` for all tickets (cleaners should never see costs)

**`src/components/TicketList.tsx`**
- Already has the `(role === "admin" || role === "owner")` check on the client side, but the server still sends the data. The server-side fix ensures the cost never reaches the client for cleaners.

### Summary
One-line server fix: map cleaner results to set `repair_cost: 0` before returning, same pattern as the owner masking but unconditional.

