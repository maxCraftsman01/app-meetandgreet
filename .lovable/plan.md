

## Update iCal Parser for Booking.com Guest Names

### Problem
The `parseICS` function only captures `SUMMARY`, ignoring `UID` and `DESCRIPTION` fields. Booking.com sends "CLOSED - Not available" or "Reserved" as the summary instead of the guest name. Currently the raw summary is stored as-is, with no guest name extraction or reservation ID parsing.

### Changes

**`supabase/functions/fetch-ical/index.ts`**

1. **Expand `ICalEvent` interface** — add `uid` and `description` fields

2. **Update `parseICS`** to capture `UID:` and `DESCRIPTION:` lines (with multi-line folding already handled by the existing `replace(/\r\n /g, "")`)

3. **Add helper function `extractBookingComInfo`** that:
   - Detects Booking.com patterns: summary contains "closed - not available" or "reserved" (case-insensitive)
   - Extracts reservation ID from UID (e.g., first 8 chars or numeric fragment)
   - Also checks DESCRIPTION for `GUEST:` patterns or reservation references
   - Returns `{ guest_name: "Booking.com Guest (#423507b6)", isBookingComReservation: true }` or null

4. **Update the insert mapping** (lines 130-145):
   - For Booking.com events matching the patterns: set `guest_name` to the constructed name, `summary` to a smart display like "Booking.com #REF", `status` to "booked" (confirmed)
   - For all other events: keep existing logic (Airbnb blocked detection, etc.)
   - Populate `uid` and `description` columns in the bookings table (already exist in schema)

### Booking.com Detection Logic
```text
summary matches "CLOSED - Not available" or "Reserved"?
  ├─ YES → guest_name = "Booking.com Guest"
  │        extract ref from UID → append " (#abc123)" if found
  │        status = "booked" (maps to Busy/Coral in UI)
  │        summary = "Booking.com #abc123" or "Booking.com Guest"
  └─ NO  → existing logic (Airbnb blocked check, etc.)
```

### No database migration needed
The `bookings` table already has `guest_name`, `uid`, and `description` columns.

### No UI changes
The existing UI already displays `guest_name` and `summary` from the bookings table. The new values will flow through automatically, showing "Booking.com Guest (#ref)" instead of "CLOSED - Not available".

