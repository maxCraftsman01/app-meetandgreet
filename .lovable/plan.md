

## Blocked Days Solution for Airbnb iCal Imports

### The Problem
Airbnb exports blocked/unavailable dates as iCal events identical to real reservations. The system currently treats all iCal events as bookings, which incorrectly triggers cleaning assignments for dates that are simply blocked by the host.

### Your Idea — Enhanced

Your approach of letting the admin mark entries as "blocked" is solid. Here's a refined version:

**Two-layer solution:**

1. **Auto-detection**: During iCal parsing, detect likely blocked days by checking the `SUMMARY` field. Airbnb typically uses summaries like "Not available", "Airbnb (Not available)", or "Blocked" for these entries. Auto-tag them as `blocked` status instead of `booked`.

2. **Manual override**: In the admin reservation list and pending iCal view, add a toggle so you can manually mark any entry as "Blocked" or flip it back to "Booked" if the auto-detection got it wrong.

### Changes

**Database** — `manual_reservations` table:
- Add `is_blocked` boolean column (default `false`) — simpler than a new status value, keeps existing status logic untouched

**Database** — `bookings` table:
- Already has a `status` column. Use `blocked` as a new status value alongside `booked`

**Backend — `fetch-ical/index.ts`**:
- In `parseICS`, extract the `SUMMARY` field (already done)
- When inserting into `bookings`, check if summary matches known blocked patterns (e.g., contains "Not available", "Blocked", "Unavailable") → set `status = 'blocked'`

**Backend — `cleaner-operations/index.ts`**:
- Filter out reservations where `is_blocked = true` from cleaning task queries
- Filter out bookings where `status = 'blocked'` from cleaning schedule

**Backend — `admin-reservations/index.ts`**:
- Support toggling `is_blocked` via PUT

**Frontend — `ManageReservations.tsx`**:
- Add a "Blocked" toggle/badge on each reservation row
- Blocked entries shown with distinct styling (grey, strikethrough)

**Frontend — `MasterReservationList.tsx`**:
- Show blocked badge, allow quick toggle

**Frontend — Pending iCal view** (if applicable):
- Auto-detected blocked entries shown with "Blocked" label, convertible to real reservation if needed

### Files Modified

| File | Change |
|---|---|
| Migration SQL | Add `is_blocked` to `manual_reservations` |
| `supabase/functions/fetch-ical/index.ts` | Auto-detect blocked summaries → `status = 'blocked'` |
| `supabase/functions/cleaner-operations/index.ts` | Exclude blocked entries from cleaning |
| `supabase/functions/admin-reservations/index.ts` | Support `is_blocked` toggle |
| `src/components/ManageReservations.tsx` | Blocked toggle UI |
| `src/components/MasterReservationList.tsx` | Blocked badge + toggle |

