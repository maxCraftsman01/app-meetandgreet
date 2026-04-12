

## Fix: Remove "Booking.com Guest" Fallback from iCal Parser

### Problem
In `supabase/functions/fetch-ical/index.ts`, the `extractBookingComInfo` function (line 87) uses `"Booking.com Guest"` as a fallback when no guest name is found in the DESCRIPTION. This writes strings like `Booking.com Guest (#1418fb94)` into the `guest_name` column instead of just the reference ID.

### Fix

**File: `supabase/functions/fetch-ical/index.ts`**

Change the guest_name construction in `extractBookingComInfo` (around line 85-87):

From:
```typescript
const guest_name = guestFromDesc
  ? guestFromDesc + (ref ? ` (#${ref})` : "")
  : "Booking.com Guest" + (ref ? ` (#${ref})` : "");
```

To:
```typescript
const guest_name = guestFromDesc
  ? guestFromDesc + (ref ? ` (#${ref})` : "")
  : ref || "";
```

This way, if there's no guest name from DESCRIPTION, it stores just the reference ID (e.g. `1418fb94`) — no fake "Booking.com Guest" prefix.

### Database cleanup
Run a SQL update to fix existing records that already have "Booking.com Guest" in the `guest_name`:

```sql
-- In bookings table
UPDATE bookings
SET guest_name = regexp_replace(guest_name, '^Booking\.com Guest \(#', '')
WHERE guest_name LIKE 'Booking.com Guest%';

UPDATE bookings
SET guest_name = rtrim(guest_name, ')')
WHERE guest_name LIKE '%)'
  AND guest_name NOT LIKE 'Booking.com%';

-- In manual_reservations table
UPDATE manual_reservations
SET guest_name = regexp_replace(guest_name, '^Booking\.com Guest \(#', '')
WHERE guest_name LIKE 'Booking.com Guest%';

UPDATE manual_reservations
SET guest_name = rtrim(guest_name, ')')
WHERE guest_name LIKE '%)'
  AND guest_name NOT LIKE 'Booking.com%';
```

### Deploy
Redeploy the `fetch-ical` edge function after the code change.

