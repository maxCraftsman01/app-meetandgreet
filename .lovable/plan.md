

## Master Timeline Calendar for Admin Panel

### Approach: Custom CSS Grid (no external library)

A custom CSS Grid solution is the best fit here. FullCalendar's timeline view requires a paid license, and the layout is straightforward enough that a custom component will be lighter, fully styled to match, and easier to maintain.

```text
┌──────────────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┐
│  Property    │ Jun 1│ Jun 2│ Jun 3│ Jun 4│ Jun 5│ Jun 6│ Jun 7│
├──────────────┼──────┴──────┴──────┴──────┴──────┴──────┴──────┤
│ Beach Villa  │ ██████ Smith (Confirmed) ██████│               │
├──────────────┼──────────────┬─────────────────────────────────┤
│ City Apt     │              │ ████ Jones (Paid) ████          │
├──────────────┼──────────────┴─────────────────────────────────┤
│ Lake House   │ ░░░░░░░░ Blocked ░░░░░░░░│                    │
└──────────────┴────────────────────────────────────────────────┘
```

### Data Fetching

**New edge function: `admin-timeline`**
- Single query joining `manual_reservations` + `bookings` + `properties` for a date range
- Returns all reservations across all properties in one call
- Filters out `is_blocked` entries by default (toggle to show them greyed out)
- No N+1 queries — one round-trip regardless of property count

### Component Structure

| Component | Purpose |
|---|---|
| `MasterTimeline.tsx` | Main timeline grid with sticky property column, date headers, horizontal scroll |
| `TimelineBar.tsx` | Individual reservation bar spanning columns, color-coded by status |
| `TimelineFilters.tsx` | Top-bar filters: property toggle, cleaner filter, date range picker |

### Key Features

**1. Sticky property column + horizontal scroll**
- CSS Grid with `position: sticky; left: 0` on the first column
- Horizontal scroll container for dates (14-day or 30-day view)
- Touch-friendly: natural horizontal swipe on mobile

**2. Color coding (reused from existing system)**
- Red: same-day turnover
- Yellow: checkout only
- Orange: arrival pending clean
- Green: ready / cleaned
- Grey striped: blocked days
- Status badge colors from `ManageReservations` (Confirmed=amber, Paid=emerald, Cancelled=red)

**3. Filters**
- Top bar with: date range selector (week/2-week/month), property checkboxes, cleaner dropdown
- Cleaner filter queries `user_property_access` to show only properties assigned to a specific cleaner

**4. Click interaction**
- Clicking a reservation bar opens a detail modal showing guest name, dates, payout, status, source, cleaning status
- Modal includes quick actions: mark as blocked, change status, mark cleaned

### Navigation

- Week/2-week/month toggle (default: 2 weeks)
- Previous/Next buttons shift the window
- "Today" button with a visual indicator line on the current date

### Files to Create/Modify

| File | Change |
|---|---|
| `supabase/functions/admin-timeline/index.ts` | New edge function: fetch all reservations + bookings for date range |
| `src/components/MasterTimeline.tsx` | Main timeline grid component |
| `src/components/TimelineBar.tsx` | Reservation bar with color coding |
| `src/components/TimelineFilters.tsx` | Filter bar (properties, cleaners, date range) |
| `src/components/TimelineDetailModal.tsx` | Click-to-open reservation detail modal |
| `src/pages/Admin.tsx` | Add "Timeline" tab to admin tabs |
| `src/lib/api.ts` | Add `getAdminTimeline()` function |

### Mobile Handling

- Property names column: fixed 120px width, sticky left
- Date columns: min 80px each, scroll horizontally
- On mobile (<768px): property column shrinks to 90px, shows abbreviated names
- Native horizontal scroll with `-webkit-overflow-scrolling: touch`
- Optional: swipe gesture hint on first visit

