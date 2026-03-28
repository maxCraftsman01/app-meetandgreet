

## Clear Old Bookings and Re-Sync

### Root Cause
Bookings synced before the guest name extraction update still have `guest_name = NULL` and the raw iCal summary "CLOSED - Not available". The `fetch-ical` function already deletes and re-inserts bookings per property on each sync, but only when triggered. The simplest fix is to wipe all existing bookings so the next sync populates them with proper guest names.

### Steps

1. **Delete all rows from `bookings` table** using a data operation:
   ```sql
   DELETE FROM public.bookings;
   ```

2. **Trigger a re-sync** — After clearing, the admin can hit the sync/refresh button in the app. The `fetch-ical` function will re-fetch all iCal feeds and populate bookings with the updated parsing logic that extracts guest names and reference IDs.

### No code changes needed
The parsing logic in `fetch-ical/index.ts` and the display logic in `MasterTimeline.tsx` are already correct. This is purely a data refresh.

