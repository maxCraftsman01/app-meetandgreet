

## Admin Property Dashboard View (Reuse Owner Finance Components)

### Goal
Add a button on each property card in the Admin Properties tab that opens the same Finance dashboard view owners see — calendar, financial summary, occupancy chart, recent payouts — for that specific property.

### Approach
Rather than duplicating 300+ lines of Dashboard finance logic, extract the finance view into a **reusable component** that both the owner Dashboard and Admin can render.

### Changes

**New file: `src/components/PropertyFinanceView.tsx`**
- Extract the entire Finance tab content from `src/pages/Dashboard.tsx` (lines 370-529) into a standalone component
- Props: `propertyId`, `pin`, `properties`, `bookings`, `manualReservations`, `currency`
- Includes: calendar with date-range selection, financial summary cards, recent payouts table, occupancy chart, booking/block dialog
- Fully self-contained with its own state for `currentMonth`, `selectedDay`, `rangeStart/End`, `bookingDialog`

**Modified: `src/pages/Dashboard.tsx`**
- Replace the inline finance content with `<PropertyFinanceView>` passing the existing data
- Remove the extracted state/logic that moves into the component

**Modified: `src/pages/Admin.tsx`**
- Add an "eye" or "chart" icon button on each property card
- Clicking it opens a full-screen `Dialog` (or `Sheet`) containing `<PropertyFinanceView>` for that property
- Admin needs to fetch the property's bookings and manual reservations — reuse the `owner-data` edge function with the admin PIN (already supported since admin PIN bypasses checks), or call the existing `admin-reservations` endpoint
- Since `owner-data` already checks for finance access and admin has `is_admin` flag, the admin PIN will work if we also check for admin in `owner-data` (it currently only checks `can_view_finance`)

**Modified: `supabase/functions/owner-data/index.ts`**
- Add admin PIN / `is_admin` check so admin users get data for ALL properties (currently it only returns properties where user has `can_view_finance`)

### Files

| File | Change |
|---|---|
| `src/components/PropertyFinanceView.tsx` | New — extracted finance view component |
| `src/pages/Dashboard.tsx` | Use `PropertyFinanceView` instead of inline code |
| `src/pages/Admin.tsx` | Add "View Dashboard" button per property, open dialog with `PropertyFinanceView` |
| `supabase/functions/owner-data/index.ts` | Allow admin users to fetch all property data |
| `src/lib/api.ts` | Add helper to fetch owner data with admin PIN for a specific property |

### Admin property card button
Each property card gets a small button (e.g. `BarChart3` icon) next to edit/delete. Clicking opens a full-width dialog showing the complete owner dashboard for that property, including the Airbnb-style date selection for blocking/reservations.

