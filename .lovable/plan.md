

## Cleaning Dashboard: 3-Tab Navigation & Finance-Style Calendar

### Problem
The cleaning section still uses a 2-tab layout ("Today" / "Week / Month") requiring an extra click to switch views. The navigation buttons inside `CleaningCalendar` are small and inconsistent with the Finance calendar style.

### Changes

**`src/pages/Dashboard.tsx`** (lines 441-529)
- Replace the 2-tab structure with 3 direct tabs: **Today**, **Week**, **Month**
- Render `CleaningCalendar` twice with `view="week"` and `view="month"` in separate `TabsContent` blocks
- Remove the "Week / Month" combined tab

**`src/components/CleaningCalendar.tsx`** (lines 134-150)
- Update the navigation buttons to match the Finance calendar style:
  - `variant="outline"` instead of `ghost`
  - `h-10 w-10 sm:h-9 sm:w-9 rounded-full` for mobile-friendly touch targets
  - Larger chevron icons (`w-5 h-5 sm:w-4 sm:h-4`)
  - "Today" button with `variant="outline"` and proper sizing
- Wrap navigation in a `Card` with `p-6` to match Finance calendar layout
- Add the month title styling to match Finance (`text-lg font-semibold`)

### Result
```text
Cleaning Tab:
┌─────────┬──────────┬──────────┐
│  Today  │   Week   │  Month   │
└─────────┴──────────┴──────────┘
Each with Finance-style nav buttons (rounded, outlined, large touch targets)
```

### Files
| File | Change |
|---|---|
| `src/pages/Dashboard.tsx` | 3 separate tabs, two CleaningCalendar instances |
| `src/components/CleaningCalendar.tsx` | Finance-style navigation buttons |

