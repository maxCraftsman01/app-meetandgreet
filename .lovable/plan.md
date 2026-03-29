

## Fix Guest Name Display and Add Channel Badges for iCal Bookings

### Problem
Several components show `b.summary` (raw iCal text like "Not Available") instead of `b.guest_name` (parsed guest info). Channel source is also not shown separately for iCal bookings.

### Changes

**1. `src/components/MasterTimeline.tsx`** (line 89)
- Change `guest_name: b.summary || "iCal Booking"` to `guest_name: b.guest_name || b.summary || "iCal Booking"`
- Add `source` field derived from `b.source_url` (Booking.com / Airbnb / Other)
- Add `source_url` passthrough so downstream components can use it

**2. `src/components/TimelineBar.tsx`**
- Already shows `guest_name || summary` — no name change needed
- The `getSourceLabel` function already handles source display in the tooltip
- Source badge is already shown inline via `sourceLabel` — just ensure the new `source` field flows through

**3. `src/components/TimelineDetailModal.tsx`**
- Add `source_url?: string` to the Reservation interface
- Add a "Channel" row that derives the channel from `r.source` (manual reservations) or `r.source_url` (iCal bookings) using the same Booking.com/Airbnb detection logic
- Display as a badge matching existing styling

**4. `src/components/PropertyFinanceView.tsx`** (line 64)
- Change `b.summary || "Booked"` to `b.guest_name || b.summary || "Booked"`
- Derive channel from `b.source_url` and append as a separate badge in the label, e.g. `"GuestName"` + `[Airbnb]` badge
- Keep the "(Pending Verification)" suffix for unverified iCal bookings

**5. `src/components/PendingPayouts.tsx`** (lines 155, 200)
- Change `evt.summary || "Guest"` to `evt.guest_name || evt.summary || "Guest"` in both the list item and the confirm dialog
- Add `guest_name` to the `ICalEvent` interface
- Enrich events in the `load` function to carry `guest_name` from the API response
- Channel badge already shown via `platform` variable — no change needed there

### No backend or schema changes

