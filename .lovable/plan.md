# Exclude blocked days from booked-nights and occupancy

## Problem
On the owner dashboard Finance view, owner-created **blocks** (manual reservations with `is_blocked = true`, e.g. for renovations/repairs) are being counted as:
- "Nights booked" total
- Overall occupancy %
- Bars in the "Monthly occupancy" chart

Blocks are not guest stays and should not inflate these metrics.

## Root cause
In `src/components/PropertyFinanceView.tsx`, both calculations filter manual reservations with `isActiveReservation(r)` only — which keeps anything not cancelled, including blocks.

- `financials` (line 180–185) sums nights/revenue over all active manual rows.
- `chartData` (line 187–201) counts any day covered by an active manual row as "booked" for the monthly bars.
- `recentPayouts` (line 203–205) also lists blocks (net_payout 0) alongside real payouts.

## Fix (frontend only)
Add an `is_blocked` filter alongside `isActiveReservation` in the three memos:

```ts
const guestReservations = propertyManual.filter(r => isActiveReservation(r) && !r.is_blocked);
```

Then derive:
- `financials`: reservations count, totalNights, totalRevenue, occupancy — all from `guestReservations`.
- `chartData`: inner loop iterates `guestReservations` instead of `propertyManual`.
- `recentPayouts`: source from `guestReservations` so the payouts list stops showing 0€ "Blocked" rows.

The calendar `getDayInfo()` logic (already fixed last turn to render blocks as gray) is unchanged — blocks still appear on the calendar with the blocked color, they just don't count toward booked-nights / occupancy / monthly chart.

## Out of scope
No DB, edge function, or other component changes. The legend, color tokens, and tap-to-detail behavior stay as-is.
