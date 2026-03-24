

## Fix Booking.com iCal Sync - Blocked Detection

### Problem
Booking.com uses "CLOSED - Not available" as the summary for **actual confirmed bookings**, but the current `fetch-ical` function treats any summary containing "not available" as a blocked/owner-block entry. This causes all Booking.com reservations to be marked as `status: "blocked"` instead of `status: "booked"`.

As a result:
- The "pending iCal" list never shows them (it filters for `status: "booked"` only)
- No manual reservations exist for A Casa Elena, so the All Reservations tab is empty
- You cannot add payouts

### Solution

**1. Fix blocked-detection logic in `supabase/functions/fetch-ical/index.ts`**

Update the blocked pattern matching to distinguish between Booking.com's "CLOSED" entries (which are real bookings) and Airbnb-style blocks. Booking.com uses "CLOSED - Not available" for confirmed reservations, so we should treat entries from Booking.com URLs differently, or refine the patterns:

- If the source URL contains `booking.com`, treat "CLOSED - Not available" as a **booked** entry, not blocked
- Keep the existing blocked patterns for Airbnb sources (e.g. "Airbnb (Not available)")

**2. Clear existing sync data and re-sync**

After deploying the fix, clicking "Sync All" will automatically clear old bookings for each property and re-import with the corrected logic (the function already does `DELETE` then `INSERT`).

### Technical details

In `fetch-ical/index.ts` around line 128-140, change the booking insert logic:

```typescript
const airbnbBlockedPatterns = ["airbnb (not available)", "blocked", "unavailable", "no disponible", "nicht verfügbar"];

allEvents.map((e) => {
  const summaryLower = (e.summary || "").toLowerCase();
  const isFromBookingCom = (e.sourceUrl || "").includes("booking.com");
  
  // Booking.com "CLOSED - Not available" = real booking
  // Airbnb "Not available" = blocked
  const isBlocked = !isFromBookingCom && 
    airbnbBlockedPatterns.some((p) => summaryLower.includes(p));
  
  return {
    property_id,
    summary: e.summary,
    start_date: e.startDate,
    end_date: e.endDate,
    source_url: e.sourceUrl,
    status: isBlocked ? "blocked" : "booked",
  };
});
```

After this fix is deployed, simply clicking "Sync All" in the admin panel will re-sync all properties with the corrected logic. The Booking.com entries will then appear as "booked" and show up in the pending iCal list for payout entry.

