

## Fix: Save Guest ID (Not "Guest" or "Reserved") When Confirming Reservations

### Problem
Line 101 in `PendingPayouts.tsx` saves `convertDialog.summary || "Guest"` as the guest_name to the database. This writes "Reserved" or "Not Available" instead of the actual guest ID (like "423507b6") that was parsed from the iCal UID.

### Fix — One line change

**File: `src/components/PendingPayouts.tsx`**, line 101

Change:
```typescript
guest_name: convertDialog.summary || "Guest",
```
To:
```typescript
guest_name: convertDialog.guest_name || convertDialog.summary || "",
```

This prioritizes `guest_name` (the parsed ID like "423507b6") and falls back to `summary` only if guest_name is missing. The final fallback is an empty string instead of the word "Guest" — so you'll never get a fake name stored.

### Already correct (no changes needed)
- Lines 156 and 201 (display only) already show `evt.guest_name || evt.summary || "Guest"` — these are fine for display purposes since they don't write to the database.

### Note on existing data
Reservations already saved with "Reserved" as guest_name won't auto-fix. Those would need manual correction in the database.

