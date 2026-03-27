

## Fix: Display Guest Name Instead of "Closed - Not available"

### Root Cause
In `src/components/MasterTimeline.tsx` line 89, synced bookings use `b.summary` for the display name instead of the new `b.guest_name` column. Since `summary` often contains raw iCal values like "Closed - Not available" or "Reserved", the extracted guest name is ignored.

### Changes

**`src/components/MasterTimeline.tsx`** — Line 89:
```
// Before
guest_name: b.summary || "iCal Booking",

// After
guest_name: b.guest_name || b.summary || "iCal Booking",
```

This single change makes the timeline prefer the extracted guest name (which contains parsed names or platform reference IDs like "Booking.com #ABC123") over the raw summary.

### Note
After this code change, you will need to **re-sync** your properties' iCal feeds for the `guest_name` column to be populated on existing bookings. Bookings synced before the migration will have `guest_name = null` until the next sync.

