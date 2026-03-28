

## Fix: Airbnb Blocked Days Not Detected from iCal

### Root Cause (Two Issues)

**Issue 1: Pattern mismatch in `fetch-ical/index.ts`**
The blocked-detection patterns include `"unavailable"` but Airbnb's actual summary for owner-blocked dates is `"Not available"`. The string `"not available"` does NOT contain `"unavailable"` as a substring — they're different words. So these entries get `status: "booked"` instead of `"blocked"`.

Current patterns:
```
["airbnb (not available)", "blocked", "unavailable", "no disponible", "nicht verfügbar"]
```

Missing: `"not available"` as a standalone pattern.

**Issue 2: Calendar allows selecting blocked days**
In `PropertyFinanceView.tsx` line 199, `isClickable` only includes `available`, `isManual`, or `isPending`. Blocked days are not clickable (correct), BUT `handleCalendarDayClick` (line 70) still fires on blocked days and starts a range selection because blocked days fall into the `else` branch. The click handler should also prevent range selection on blocked days.

### Changes

**`supabase/functions/fetch-ical/index.ts`** — Update the blocked patterns array to include `"not available"`:
```js
const airbnbBlockedPatterns = [
  "airbnb (not available)", "not available", "blocked", 
  "unavailable", "no disponible", "nicht verfügbar"
];
```

**`src/components/PropertyFinanceView.tsx`** — Line 70-74, prevent range selection on blocked days:
```tsx
const handleCalendarDayClick = (day: Date, info: any) => {
  if (info.status === "blocked") return; // Don't allow interaction with blocked days
  if (info.isManual || info.isPending) {
    setSelectedDay({ date: day, info });
    return;
  }
  // ... rest of range selection logic
```

### After deploying
You'll need to re-sync iCal feeds again so the corrected blocked detection runs on the fresh data.

