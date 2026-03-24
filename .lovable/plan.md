

## Always-Accessible "Report Issue" Button for Cleaners

### Problem
The current "Report Issue" button is buried inside each task card and only appears in the Today view when tasks exist. Cleaners need quick access at all times — even when there are no tasks or they're on a different calendar view.

### Solution
Add a **floating action button (FAB)** at the bottom-right of the Cleaning tab. This is the best location because:
- It's always visible regardless of which sub-tab (Today/Week/Month) is active
- It follows mobile UX conventions (thumb-reachable)
- It doesn't interfere with the existing per-card "Report Issue" buttons
- It stays visible even when scrolling

### File: `src/pages/Dashboard.tsx`

1. **Add a FAB inside the Cleaning `TabsContent`** (after the inner `Tabs` block, around line 370): A fixed-position button with a `Wrench` icon + "Report Issue" label, styled as a primary button with rounded-full and shadow. Positioned `fixed bottom-6 right-6` with a high z-index.

2. **Only show the FAB when the Cleaning tab is active** — track active tab state or simply place it inside the cleaning `TabsContent` wrapper so it only renders when that tab is shown.

3. **On click**, opens the existing `reportDialogOpen` dialog. If the cleaner has multiple properties, pre-select the first one or show the property selector inside the dialog (already handled by `TicketForm`).

4. **Keep existing per-card "Report Issue" buttons** — they provide contextual convenience (auto-selects the property). The FAB is the fallback for global access.

### Visual
```text
┌─────────────────────────┐
│  Cleaning  [Today] ...  │
│                         │
│  ┌─ Task Card ────────┐ │
│  │  Report Issue btn   │ │  ← existing, per-property
│  └────────────────────┘ │
│                         │
│              ┌────────┐ │
│              │🔧 FAB  │ │  ← new floating button
│              └────────┘ │
└─────────────────────────┘
```

### Technical details
- Button: `<Button className="fixed bottom-6 right-6 z-50 rounded-full shadow-lg h-12 px-5 gap-2">` with `Wrench` icon
- Reuses existing `setReportDialogOpen(true)` and sets `reportPropertyId` to the first available cleaning property
- Safe-area padding (`pb-safe`) already handled by the layout

