

## Move Refresh Button to Top-Right

### Problem
On mobile, the `flex-col` layout causes the Refresh button to stack below the tab buttons instead of sitting to the right.

### Fix
**`src/pages/Dashboard.tsx` (line 234)**
- Change `flex-col sm:flex-row` to just `flex-row` so the Refresh button always stays to the right of the tabs, even on mobile
- Keep `justify-between` and `items-center` for alignment

