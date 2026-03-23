

## Enhance Timeline Color Coding & Improvements

### Current state
The `TimelineBar` already has color logic, but blocked/unavailable days use a generic muted style that doesn't stand out well. iCal-imported blocks (Airbnb "Not Available") aren't visually distinct from other blocked entries.

### Color coding improvements

**`src/components/TimelineBar.tsx`** — Refine `getBarColor()`:

| Condition | Color | Visual |
|---|---|---|
| Blocked (manual or iCal "not available") | Grey with diagonal stripe pattern | `bg-gray-200 text-gray-500` + CSS diagonal stripes |
| Same-day turnover (checkout + checkin today) | Red | `bg-red-100 text-red-800` (unchanged) |
| Checkout today, pending clean | Yellow | `bg-yellow-100 text-yellow-800` (unchanged) |
| Checkin today, pending clean | Orange | `bg-orange-100 text-orange-800` (unchanged) |
| Cleaned | Green | `bg-emerald-100 text-emerald-800` (unchanged) |
| Paid reservation | Light green | `bg-emerald-50 text-emerald-700` (unchanged) |
| Confirmed reservation | Amber | `bg-amber-50 text-amber-700` (unchanged) |
| Cancelled | Red outline | `bg-red-50 text-red-600` (unchanged) |

For blocked days, add a CSS diagonal stripe pattern to make them instantly recognizable as unavailable.

### Additional improvements worth making

1. **Overlapping bars** — If two reservations overlap on the same property, stack them vertically instead of overlapping. Add a second row offset (`top: 50%`) when collisions are detected.

2. **Legend bar** — Add a small color legend below the filters showing what each color means (Grey striped = Blocked, Red = Turnover, Yellow = Checkout, etc.).

3. **Tooltip on hover** — Show guest name, dates, and status on hover without needing to click, using a lightweight tooltip. Keep click for the full detail modal.

4. **Empty day highlighting** — Available (unbooked) days could get a subtle green tint so admins can quickly spot gaps.

5. **Source icon on bars** — Show a small Airbnb/Booking.com/Manual icon on each bar so you can see where the reservation came from at a glance.

### Files to modify

| File | Change |
|---|---|
| `src/components/TimelineBar.tsx` | Grey striped style for blocked, hover tooltip, source icon |
| `src/components/MasterTimeline.tsx` | Overlap detection for stacked bars, legend component |
| `src/index.css` | CSS class for diagonal stripe pattern |

### Technical detail

Diagonal stripe CSS:
```css
.stripe-blocked {
  background: repeating-linear-gradient(
    135deg,
    hsl(0 0% 88%),
    hsl(0 0% 88%) 4px,
    hsl(0 0% 82%) 4px,
    hsl(0 0% 82%) 8px
  );
}
```

Overlap detection: sort reservations by start date, check if bar N overlaps bar N-1, and assign a `row` index (0 or 1) to offset vertically within the cell.

