

## Move "Add Property" Button into Properties Tab

### Change
Move the "Add Property" button from the top header bar into the Properties tab content area, and keep the Dialog definition there as well.

### File: `src/pages/Admin.tsx`

1. **Header (lines ~228-239)**: Remove the Dialog wrapper and "Add Property" button from the header. Keep only "Sync All" and "Logout" buttons.

2. **Properties tab content (line ~330)**: Add an "Add Property" button at the top of the properties tab, before the grid. Show it as a header row with the button right-aligned. The existing Dialog (with the form inside, lines 233-301) moves here, wrapping this new button.

3. The empty-state "Add Property" button (line ~340) stays as-is.

