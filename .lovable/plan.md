

## Allow Reverting Cleaning Status to Pending

### Problem
Currently, once a cleaner marks a task as "cleaned", there's no way to revert it. After supervision, an admin (or the cleaner themselves) may need to set it back to "pending".

### Solution
Allow both admins and cleaners to toggle the cleaning status back to "pending" via the existing `cleaner-operations` PUT endpoint.

### Changes

**1. `supabase/functions/cleaner-operations/index.ts`**
- Modify the PUT handler to accept an optional `cleaning_status` field in the body (values: `"completed"` or `"pending"`)
- If `cleaning_status` is `"pending"`, set `cleaning_status: "pending"` and clear `last_cleaned_at` to `null`
- Default behavior (no `cleaning_status` field) remains: mark as completed

**2. `src/lib/api.ts`**
- Add a new function `resetCleaningStatus(pin: string, reservationId: string)` that calls the same endpoint but passes `{ reservation_id, cleaning_status: "pending" }`
- Add an admin variant `adminResetCleaningStatus(adminPin, reservationId)`

**3. `src/pages/Dashboard.tsx` (Cleaner view)**
- For tasks already marked as "cleaned", show a secondary button "Mark as Pending" next to the green status badge
- On click, call `resetCleaningStatus` and refresh the task list

**4. `src/components/DailyOperations.tsx` (Admin view)**
- For completed cleaning tasks, add a "Revert to Pending" button
- On click, call `adminResetCleaningStatus` and refresh

**5. `src/components/TimelineDetailModal.tsx` (Admin timeline)**
- When viewing a reservation with `cleaning_status: "completed"`, show a clickable badge or small button to toggle it back to pending (requires passing `adminPin` and an `onUpdate` callback as props)

