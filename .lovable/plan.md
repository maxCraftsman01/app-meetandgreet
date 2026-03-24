

## Add "Revert to Pending" to Week/Month Cleaning Calendar

### Problem
The "Mark as Pending" button only exists on the **Today** tab. When viewing the Week or Month calendar, completed cleaning tasks show as green but have no option to revert them.

### Solution
Pass the revert handler into the `CleaningCalendar` component and show a "Mark as Pending" button alongside the existing "Mark as Cleaned" button for completed tasks.

### Changes

**1. `src/pages/Dashboard.tsx`**
- Pass `onRevertCleaning={handleRevertCleaning}` prop to both `CleaningCalendar` instances (week and month)

**2. `src/components/CleaningCalendar.tsx`**
- Add `onRevertCleaning` to the Props interface
- In the task detail rendering (where "Mark as Cleaned" button appears), add a "Mark as Pending" button for tasks with `status === "arrival-ready"` that calls `onRevertCleaning`
- This applies to both the week view's expanded task cards and the month view's day-detail popup/modal

