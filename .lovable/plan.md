# Fix blocked-day color on owner dashboard calendar

## The problem
On the owner dashboard (Finance view), blocked days for **Lagos Old Town** are rendered in red — the same color as guest reservations — instead of the gray "Blocked" color shown in the legend.

## Root cause
In `src/components/PropertyFinanceView.tsx`, `getDayInfo()` returns the day's status from two sources:

1. **Manual reservations** (`manual_reservations` table) — every active record is returned as `status: "booked"`, ignoring its `is_blocked` flag.
2. **iCal bookings** (`bookings` table) — correctly checks `b.status === "blocked"` and returns `status: "blocked"`.

Owner-created blocks are saved as `manual_reservations` rows with `is_blocked = true` (verified in DB for Lagos Old Town: 2 rows with `is_blocked: true`, `guest_name: "Blocked"`). Because branch (1) doesn't look at `is_blocked`, those days get the red "booked" style from `statusColors.booked`.

## Fix
One-line logic change in `PropertyFinanceView.tsx` `getDayInfo()` — when a manual reservation matches the day, check `is_blocked`:

```ts
if (r.is_blocked) {
  return { status: "blocked", label: "Blocked", isManual: true, isPending: false, reservation: r };
}
return { status: "booked", label: `${r.guest_name} (${r.source})`, isManual: true, isPending: false, reservation: r };
```

This routes those days through the existing `statusColors.blocked` style (`bg-status-blocked-light border-status-blocked`) — the same gray tokens used in the legend, so visuals match the label.

## Out of scope
No DB, edge function, or other component changes. The day-click handler already treats `isManual` days as detail-only (no range selection), so blocked manual days keep their existing tap-to-view-details behavior.
