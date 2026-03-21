

## Finalized Cleaning Workflow & Status Logic

Most of this is already implemented. Here's what needs to change:

### 1. Ensure `cleaning_status` defaults to `'pending'` on creation
- **Already done** in the database schema (`cleaning_status text NOT NULL DEFAULT 'pending'`).
- Verify the `admin-reservations` edge function does NOT set `cleaning_status` on POST — it doesn't, so the DB default applies. No change needed.

### 2. Add "Confirm Cleaning Complete" toggle to Admin Daily Ops
- **Cleaner Portal**: Already has "Mark as Cleaned" button — no change needed.
- **Admin DailyOperations.tsx**: Add a "Confirm Cleaning Complete" button on cards with `arrival-pending` or `same-day` status. Clicking calls the existing `markAsCleaned` API (reuse the same edge function endpoint). Once done, reload and card turns green.

### 3. Split Daily Ops into "Cleaning Needed" and "Ready for Guest" sections
- In `DailyOperations.tsx`, replace the single sorted list with two grouped sections:
  - **Cleaning Needed**: Properties with status `same-day` or `arrival-pending` (Red/Orange cards with the cleaning toggle button).
  - **Ready for Guest**: Properties with status `arrival-ready` (Green cards with "Notify Owner" button).
  - **Other Activity**: `checkout-only` shown separately (Yellow, informational).
- Keep the summary counters and property map as-is.

### 4. Data Integrity — preserve `cleaning_status` on reservation edits
- In `admin-reservations` edge function PUT handler, strip `cleaning_status` from the update body unless explicitly provided. This prevents accidental resets when editing dates.

### Files Modified
- `src/components/DailyOperations.tsx` — add cleaning toggle button, split list into sections
- `supabase/functions/admin-reservations/index.ts` — preserve `cleaning_status` on updates
- `src/lib/api.ts` — add admin-facing `markAsCleaned` variant using admin pin

