

## Update iCal UID Parsing and Smart Display Names

### Problem
The code already parses UID and builds smart summaries from the last edit, but two things need updating per your spec:

1. **UID parsing** — line 46 doesn't `.trim()` the UID value
2. **UID reference format** — currently takes last 8 chars of raw UID. You want it to strip the `@domain` part and non-alphanumeric chars, then take last 10 chars (e.g., `BKNG-1234567890@booking.com` → `1234567890`)
3. **Blocked detection** — currently only checks Booking.com OR Airbnb patterns, but not both together. Your spec uses `||` to check both sources correctly
4. **Blocked bookings still get platform name** — current code sets `"Blocked"` for blocked entries. Your spec keeps blocked entries showing `"Blocked"` status but with a platform-labeled summary. Actually re-reading your spec: blocked entries should still get `status: "blocked"` but the summary should still be the smart name. Wait — your spec sets `displaySummary` before the blocked check, so blocked entries also get `"Booking.com #REF"`. Let me re-read... No, your spec builds `displaySummary` unconditionally (not gated on `!isBlocked`), so blocked entries also show `"Booking.com #1234567890"` with `status: "blocked"`.

### Changes to `supabase/functions/fetch-ical/index.ts`

**Line 46**: Add `.trim()` to UID parsing
```
current.uid = line.substring(4).trim();
```

**Lines 131-167**: Replace the mapping logic with your exact spec:
- Move blocked pattern arrays before the map
- Use `||` for blocked detection (check both Airbnb AND Booking.com patterns)
- Build `shortUid` by stripping `@...` suffix and non-alphanumeric chars, taking last 10 chars
- Always build platform-labeled summary (even for blocked entries)
- Set `status: "blocked"` or `"booked"` based on detection

### No other files changed

