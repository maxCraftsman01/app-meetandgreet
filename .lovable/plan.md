

## Your Idea is Great — With One Enhancement

Your instinct is spot-on: embedding pending payouts inside each property card makes the workflow much more intuitive. Instead of switching to a separate tab and scanning a mixed list, the admin sees everything in context.

**One thing to consider:** Right now the "Pending Payouts" tab shows events from ALL properties in one list. By moving it per-property, you lose that global overview. I'd recommend keeping the "All Reservations" (master list) tab but removing the dedicated "Pending Payouts" tab — the per-property view replaces it. If you ever want a quick "how many pending across everything?" glance, we can add a small badge/counter to the header later.

## Plan

### 1. Move Pending Payouts into Property Cards
- Inside each property card (below the existing `ManageReservations` section), add a collapsible "Pending Payouts" section
- It will use the existing `PendingPayouts` component but filtered to only show events for that specific property
- Clicking expands/collapses the list (using an accordion or toggle)

### 2. Update PendingPayouts Component
- Add an optional `propertyId` prop to filter events to a single property
- When `propertyId` is provided, only show iCal events matching that property
- Simplify the display (remove the property name badge since it's already in context)

### 3. Remove the Separate "Pending Payouts" Tab
- Remove the tab from the admin panel since it's now per-property
- Default the admin view to the "Properties" tab
- Keep "All Reservations" master list tab as-is

### 4. UI Layout Inside Property Card
```text
┌─────────────────────────────┐
│ Property Name        [✏️][🗑️]│
│ Owner · Rate · Bookings     │
│ PIN: 12345678    [Copy Link]│
│─────────────────────────────│
│ ▶ Manage Reservations       │
│─────────────────────────────│
│ ▶ Pending Payouts (3)       │  ← new, with count badge
│   └ Guest 1  Mar 22-25 [Add]│
│   └ Guest 2  Apr 1-5   [Add]│
└─────────────────────────────┘
```

### Technical Details
- **Files modified:** `src/pages/Admin.tsx`, `src/components/PendingPayouts.tsx`
- **No database or edge function changes needed** — the existing `admin-pending-ical` endpoint returns `property_id` on each event, so filtering is done client-side
- The `PendingPayouts` component will accept `propertyId?: string` and filter `pendingEvents` accordingly

