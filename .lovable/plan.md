

## Redesign Cleaning Tab Navigation & Month Calendar

### Problem
1. Current cleaning section has **Today** and **Week/Month** as two tabs, then inside Week/Month you have to pick again between Week and Month — confusing two-level navigation
2. Month calendar shows only small colored dots instead of the rich colored-cell style used in the owner's Finance calendar

### Changes

**`src/pages/Dashboard.tsx`** (Cleaning Tab section, lines 441-528)
- Replace the nested `Tabs` structure with 3 direct tabs: **Today**, **Week**, **Month**
- Remove the inner `CleaningCalendar` component reference for the calendar tab — instead render Week and Month as separate `TabsContent` sections
- Pass a `view` prop to `CleaningCalendar` so it renders only one view at a time

**`src/components/CleaningCalendar.tsx`**
- Accept a `view` prop (`"week" | "month"`) from the parent instead of managing its own view toggle
- Remove the internal Week/Month tab switcher (lines 116-121)
- **Redesign month view** to match the owner Finance calendar style:
  - Each day cell becomes a colored square (like lines 320-332 in Dashboard.tsx) instead of just a number with dots
  - Use status-based background colors: red for same-day, yellow for checkout, orange for pending, green for cleaned, neutral for empty
  - When a day has multiple properties, show the highest-priority status color on the cell with a small count badge
  - Clicking a day still opens the expanded detail card below
- Keep the week view unchanged (it already looks good with the colored event bars)

### New tab structure
```text
┌─────────┬──────────┬──────────┐
│  Today  │   Week   │  Month   │
└─────────┴──────────┴──────────┘
   ↓           ↓          ↓
 Task cards  Week grid  Month grid (colored cells like Finance calendar)
```

### Month cell design (matching Finance calendar)
Each day cell will be:
- `aspect-square rounded-lg border` with status-colored background
- Show the day number centered
- If events exist: background = highest priority status color (same-day > checkout > pending > ready)
- Multiple events: small badge showing count in corner
- Today ring highlight
- Click to expand details below

### Files to modify

| File | Change |
|---|---|
| `src/pages/Dashboard.tsx` | 3 separate tabs (Today/Week/Month), pass `view` prop to CleaningCalendar |
| `src/components/CleaningCalendar.tsx` | Accept `view` prop, remove internal tab switcher, redesign month view with colored cells |

