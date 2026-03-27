

## Extract Guest Name & Reservation ID from iCal

### Problem
The iCal parser only captures `SUMMARY` (which is often just "Reserved" or "Closed - Not available"). Guest names and reservation references are in `DESCRIPTION` and `UID` fields, which are currently ignored.

### Typical iCal data structure
- **Airbnb**: `SUMMARY: Reserved`, `DESCRIPTION: CHECKIN: ...\nCHECKOUT: ...\nGUEST: John Smith\nPHONE: ...`, `UID: abc123-airbnb-ref@airbnb.com`
- **Booking.com**: `SUMMARY: CLOSED - Not available`, `DESCRIPTION: Booking reference: 12345678\nGuest: Jane Doe`, `UID: booking-ref-hash`

### Changes

**Database migration** — Add `description` and `uid` columns to `bookings`:
```sql
ALTER TABLE public.bookings ADD COLUMN description text;
ALTER TABLE public.bookings ADD COLUMN uid text;
ALTER TABLE public.bookings ADD COLUMN guest_name text;
```

**`supabase/functions/fetch-ical/index.ts`**:
1. Extend `ICalEvent` interface to include `description` and `uid`
2. Parse `DESCRIPTION:` and `UID:` lines in the iCal parser (handle multi-line DESCRIPTION with line folding)
3. Add a `extractGuestName(summary, description, uid, sourceUrl)` function that:
   - Checks DESCRIPTION for patterns like `GUEST: ...`, `Guest name: ...`, `Booker: ...`
   - Falls back to extracting a reference ID from UID (e.g., last 10 alphanumeric chars)
   - Falls back to the existing summary if nothing better is found
4. Store `guest_name`, `description`, and `uid` in the bookings insert

**Display** — The `MasterReservationList` and timeline components already display `guest_name` from manual reservations. For synced bookings shown in the admin timeline/list, the `guest_name` field will now contain meaningful data instead of "Reserved"/"Closed".

### Parsing logic (key extract)
```typescript
function extractGuestName(summary: string, description: string, uid: string, sourceUrl: string): string {
  // Try DESCRIPTION patterns first
  const guestMatch = description.match(/(?:GUEST|Guest name|Booker|Guest):\s*(.+)/i);
  if (guestMatch) return guestMatch[1].trim();
  
  // If summary is generic, try UID for a reference
  const genericSummaries = ["reserved", "closed - not available", "booked", "not available"];
  if (genericSummaries.includes(summary.toLowerCase())) {
    const cleanUid = uid.replace(/@.*$/, "").replace(/[^a-zA-Z0-9]/g, "");
    if (cleanUid.length > 4) {
      const platform = sourceUrl.includes("booking.com") ? "Booking.com" : 
                       sourceUrl.includes("airbnb") ? "Airbnb" : "Booking";
      return `${platform} #${cleanUid.slice(-8).toUpperCase()}`;
    }
  }
  
  return summary; // fallback to original
}
```

### Risk
Low — additive columns, backward compatible. Existing bookings get `null` for new columns until next sync.

