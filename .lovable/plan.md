

## Confirmation: How the cancellation detection works

Yes — exactly. Here's the flow in plain terms:

### What gets auto-flagged
Only manual reservations that **originally came from iCal** (have an `external_id` like `propertyId_checkin_checkout`) get touched. These are the rows you created by clicking "Confirm" on a pending Airbnb/Booking event in PendingPayouts.

**Direct bookings you typed in by hand never have an `external_id`, so the sync will never auto-cancel them.** That's the safety guarantee.

### What happens on every sync
1. `fetch-ical` pulls the current iCal feed and rebuilds the `bookings` table (mirror layer).
2. It then looks at `manual_reservations` for the same property where `external_id IS NOT NULL` and status is still active.
3. Any row whose `external_id` is **no longer in the current feed** = the guest cancelled on Airbnb/Booking.
4. Those rows get `status = "Cancelled-iCal"` (a new status, distinct from manual `Cancelled`).
5. They are **NOT deleted** — only re-labelled.

### What you see as admin
- **Sync toast**: "Synced 12 events · 1 cancelled by guest"
- **Master Reservation List**: cancelled rows stay visible with a red **"Cancelled by guest"** badge so you can review them.
- **Finance / Timeline / Payouts / Cleaning lists**: these rows disappear from active calculations (no revenue, no cleaning task, no payout).
- **Action you take**: open the row → either delete it permanently, or if it was a false alarm (Airbnb republished), edit status back to `Confirmed`.

### Why "flag" instead of "delete"
- Audit trail preserved — you always see what happened.
- Reversible — false cancellations from a temporarily broken iCal feed don't lose data.
- Distinguishes guest cancellations (`Cancelled-iCal`) from your own manual cancellations (`Cancelled`).

### Edge cases handled
- **Guest re-books same dates** → next sync sees the `external_id` again, but the row is already `Cancelled-iCal` and excluded from the "skip" filter, so it shows up again in PendingPayouts for you to re-confirm. (Or we can auto-restore — tell me which you prefer.)
- **iCal feed temporarily fails to load** → `fetch-ical` already skips failed URLs silently. **Risk**: if ALL URLs fail, the feed looks empty and everything would get flagged. Mitigation in the plan: only run reconciliation when `allEvents.length > 0` AND at least one iCal URL fetched successfully.
- **Manual reservations with no `external_id`** → never touched.

### Ready to implement?
The plan from the previous turn is unchanged. Approve and I'll switch to default mode and ship it. If you want the "auto-restore on re-appearance" behavior instead of re-queuing in PendingPayouts, say so and I'll adjust step 1.

