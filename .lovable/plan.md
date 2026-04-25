

## Plan: Fix past-reservation false-cancellation + add safety threshold

### The bug (recap)
In `fetch-ical/index.ts` reconciliation, ANY `manual_reservation` with `external_id` not in the current iCal feed gets flagged `Cancelled-iCal`. But Airbnb/Booking iCal feeds drop past events after a few days — so completed stays get wrongly flagged, removing them from revenue and payouts.

### Fix #1 — Only reconcile future reservations

In `supabase/functions/fetch-ical/index.ts`, scope the reconciliation query to reservations whose `check_out >= today`:

```ts
const today = new Date().toISOString().split("T")[0];

const { data: existingManual } = await supabase
  .from("manual_reservations")
  .select("id, external_id, status, check_out")
  .eq("property_id", property_id)
  .not("external_id", "is", null)
  .neq("status", "Cancelled")
  .neq("status", "Cancelled-iCal")
  .gte("check_out", today);   // ← key change
```

Past stays become **immutable** — once a guest has checked out, no iCal sync can ever change their status. This is the correct invariant.

### Fix #2 — 50% safety threshold

Before running the UPDATE, check the ratio of orphans to total active future reservations. If more than 50% of future reservations would be cancelled in a single sync, **skip and log a warning** instead.

```ts
const totalActive = (existingManual || []).length;
const orphans = (existingManual || []).filter(
  (r) => r.external_id && !currentExternalIds.has(r.external_id)
);

let cancelledCount = 0;
let skippedReason: string | null = null;

if (orphans.length > 0) {
  // Safety: don't mass-cancel if >50% would be flagged
  if (totalActive >= 4 && orphans.length / totalActive > 0.5) {
    console.warn(
      `[fetch-ical] Skipping reconciliation for property ${property_id}: ` +
      `${orphans.length}/${totalActive} (>50%) would be cancelled. ` +
      `Possible feed issue.`
    );
    skippedReason = `safety_threshold:${orphans.length}/${totalActive}`;
  } else {
    const { error: updErr } = await supabase
      .from("manual_reservations")
      .update({ status: "Cancelled-iCal", updated_at: new Date().toISOString() })
      .in("id", orphans.map((r) => r.id));
    if (!updErr) cancelledCount = orphans.length;
  }
}
```

Threshold only kicks in when there are at least 4 active future reservations — otherwise small properties with 1-2 bookings would always trip it (1 of 2 = 50%).

Return both values to the client:
```ts
return new Response(JSON.stringify({
  bookings: bookings || [],
  synced: allEvents.length,
  cancelled: cancelledCount,
  skipped: skippedReason,
}), { ... });
```

### Fix #3 — Repair existing wrongly-cancelled rows

One-time SQL migration to restore past reservations that were incorrectly flagged by the previous version of the logic:

```sql
UPDATE public.manual_reservations
SET status = 'Confirmed', updated_at = now()
WHERE status = 'Cancelled-iCal'
  AND check_out < CURRENT_DATE;
```

This brings back revenue/payouts for any past stay that was wrongly cancelled. Future reservations correctly flagged as cancelled stay flagged.

### Fix #4 — Surface the safety-threshold skip in the UI

In `src/pages/Admin.tsx` (`handleSyncAll`) and `src/hooks/useDashboardData.ts` (`handleSync`), if the response contains `skipped`, show a warning toast:

> ⚠️ Sync paused for [Property]: too many bookings would be cancelled. Check the iCal feed.

This way you immediately know if Airbnb returned a partial/broken feed.

### Fix #5 — Update memory

Update `mem://logic/ical-cancellation-reconciliation` to record:
- "future-only" rule (`check_out >= today`)
- 50% safety threshold (only applies when ≥4 active future reservations)

### Files to change
1. `supabase/functions/fetch-ical/index.ts` — date filter + threshold logic + extended response.
2. **New SQL migration** — restore past `Cancelled-iCal` rows.
3. `src/pages/Admin.tsx` — handle `skipped` field in sync toast.
4. `src/hooks/useDashboardData.ts` — same.
5. `mem://logic/ical-cancellation-reconciliation` — updated rule.

No schema change. No new dependencies.

### Verification after deploy
1. Run sync once — confirm past reservations stay `Confirmed` and revenue snaps back.
2. Inspect `manual_reservations` where `status = 'Cancelled-iCal'` — should only contain future or current stays where the guest genuinely cancelled.
3. Sync toast should still show "X synced · Y cancelled by guest" when a real future cancellation happens.

Approve and I'll switch to default mode and ship.

