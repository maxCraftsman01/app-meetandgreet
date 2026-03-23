

## Owner Date Selection & Booking on Calendar (Airbnb-Style)

### Goal
Let owners tap a start date and end date directly on the Finance calendar to either **block dates** or **add a private reservation** — no manual date input needed.

### How it works
1. Owner taps a date on the calendar → it becomes the **start date** (highlighted)
2. Owner taps a second date → it becomes the **end date** (range highlighted)
3. A bottom sheet / modal appears with two options:
   - **Block Dates** — creates a blocked entry (no guest name needed)
   - **Add Reservation** — shows a small form: guest name, optional payout amount
4. On submit, calls a new edge function to insert into `manual_reservations`
5. Calendar refreshes to show the new entry

### Files to create

| File | Purpose |
|---|---|
| `supabase/functions/owner-reservations/index.ts` | New edge function: owner can POST to create a reservation or block, authenticated via PIN. Only allows creating entries for properties the owner has finance access to. |

### Files to modify

| File | Change |
|---|---|
| `src/pages/Dashboard.tsx` | Add date-range selection state to the Finance calendar. On first click set `rangeStart`, on second click set `rangeEnd` and open a dialog. Add a `Dialog` with "Block Dates" / "Add Reservation" options and a small form. After submit, reload data. Show visual range highlight between selected dates. |
| `src/lib/api.ts` | Add `createOwnerReservation(pin, data)` and `createOwnerBlock(pin, data)` API helpers calling the new edge function. |

### Calendar interaction detail
- Single tap on available date → sets start (blue ring)
- Tap another date after start → sets end, dates between get a light blue highlight
- Tap same date as start → cancels selection
- Tapping a booked/blocked date does nothing (keeps current click-to-view behavior)
- A small floating "Cancel selection" button appears after first tap

### Dialog form
```text
┌─────────────────────────────┐
│  June 15 → June 18          │
│                             │
│  ○ Block dates              │
│  ○ Private reservation      │
│                             │
│  [Guest name___________]    │  ← only if reservation
│  [Payout amount________]    │  ← only if reservation
│                             │
│  [Cancel]      [Confirm]    │
└─────────────────────────────┘
```

### Edge function: `owner-reservations`
- Validates PIN, looks up user and property access (must have `can_view_finance`)
- POST: inserts into `manual_reservations` with `source: "Owner"` for reservations or `is_blocked: true` for blocks
- Only creates — no edit/delete from owner side (admin manages that)

### Security
- PIN-based auth matching existing pattern
- Checks `user_property_access.can_view_finance` before allowing creation
- Uses service role key server-side only

