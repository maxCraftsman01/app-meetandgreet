

## Weekly & Monthly Cleaning Calendar View

### The Problem
Currently the Cleaning tab only shows today's tasks. Cleaners managing multiple properties need to plan ahead — seeing the full week or month of check-ins/check-outs across all their properties in one calendar.

### Solution

**A multi-property cleaning calendar** with toggle between Today / Week / Month views, using color-coded events.

```text
Cleaning Tab Layout:
[Today] [Week] [Month]    ← view toggle

Week View:
┌─────┬─────┬─────┬─────┬─────┬─────┬─────┐
│ Mon │ Tue │ Wed │ Thu │ Fri │ Sat │ Sun │
├─────┼─────┼─────┼─────┼─────┼─────┼─────┤
│     │ 🔴  │     │ 🟠  │     │ 🟡  │     │
│     │Villa│     │Apart│     │Lodge│     │
│     │ OUT │     │ IN  │     │ OUT │     │
│     │+ IN │     │     │     │     │     │
└─────┴─────┴─────┴─────┴─────┴─────┴─────┘

Month View: standard calendar grid with colored dots per property
```

### Backend Change

**`cleaner-operations/index.ts`**: Accept optional `from` and `to` query params. When provided, fetch reservations in that date range instead of just today. Returns an array of events with date, property, and type (check-in/check-out/both).

### Frontend Changes

**`src/pages/Dashboard.tsx`** — Cleaning tab:

1. Add a view toggle: `Today | Week | Month` (using existing Tabs component)
2. **Today view**: Keep current traffic-light cards (unchanged)
3. **Week view**: 7-column grid showing the current week. Each day cell shows colored pills for each property with activity (check-in, check-out, or both). Color = traffic light logic. Tap a pill to expand details + "Mark as Cleaned" button.
4. **Month view**: Standard calendar grid (reuse the same pattern as the Finance tab calendar). Each day shows small colored dots per property. Tap a day to see the task list for that day.
5. New API call `getCleanerSchedule(pin, from, to)` in `src/lib/api.ts`

### New API Function

```typescript
export async function getCleanerSchedule(pin: string, from: string, to: string) {
  return callFunction("cleaner-operations", {
    method: "GET",
    headers: { "x-user-pin": pin },
    params: { from, to },
  });
}
```

### Files Modified

| File | Change |
|---|---|
| `supabase/functions/cleaner-operations/index.ts` | Accept `from`/`to` params, return multi-day schedule |
| `src/lib/api.ts` | Add `getCleanerSchedule` function |
| `src/pages/Dashboard.tsx` | Add Week/Month calendar views to Cleaning tab |

