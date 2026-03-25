

## Bottom Nav + Card Touch Targets + Calendar Readability

### Overview
Create a mobile-only bottom navigation bar for the Dashboard, add tactile press feedback to cards with proper event bubbling prevention, and improve calendar month-view status visibility.

### Files to Create

**`src/components/BottomNav.tsx`**
- Fixed bottom bar, visible only on mobile (`md:hidden`)
- Renders nav items conditionally based on user permissions:
  - Finance (DollarSign) — shown if `hasAnyFinance`
  - Cleaning (Brush) — shown if `hasAnyCleaning`
  - Issues (Wrench) — shown if `hasAnyFinance`
  - Profile/More (User icon) — always shown, houses Logout + Sync + Report Issue
- Props: `activeTab`, `onTabChange`, `hasAnyFinance`, `hasAnyCleaning`, permission flags
- Active state: primary color icon + label; inactive: muted
- Styling: `fixed bottom-0 left-0 right-0 bg-card border-t border-border pb-safe z-50`
- Profile tab opens a small sheet/popover with Logout, Sync (if finance), Report Issue (if cleaning)

### Files to Modify

**`src/pages/Dashboard.tsx`**
1. Import and render `<BottomNav />` at the bottom of the page
2. Convert from `Tabs defaultValue` to controlled `Tabs value={activeTab}` state so bottom nav can drive tab changes
3. Hide the top `TabsList` on mobile (`hidden md:flex`), keep it for desktop
4. Add `pb-20 md:pb-0` to `<main>` for bottom bar clearance on mobile
5. Add `active:scale-[0.98] transition-transform` to cleaning task Cards for press feedback
6. On cleaning task card buttons (Mark as Cleaned, Report Issue, Mark as Pending), add `onClick={(e) => { e.stopPropagation(); ... }}` to prevent event bubbling
7. Move the floating "Report Issue" button into the bottom nav's profile/more menu on mobile
8. Wire `onTabChange` to also trigger data loading (cleaning tasks, tickets) on first visit

**`src/components/TicketList.tsx`**
- Already has full-card click to open detail dialog — no structural change needed
- Cards already use `cursor-pointer hover:shadow-md`
- Add `active:scale-[0.98] transition-transform` for press feedback

**`src/components/CleaningCalendar.tsx`** (Calendar Readability — Rule 4)
- Month view cells: increase the status indicator size. Currently cells use `cfg.cellBg` background which is good, but enhance with:
  - Bolder border: `border-2` instead of `border`
  - Larger text weight on the day number: `font-bold` when events exist
  - Add a small colored bar/stripe at the bottom of the cell using the status color (e.g., `h-1.5 rounded-full` bar with `cfg.dot` color) for outdoor visibility
- Legend dots: increase from `w-3 h-3` to `w-4 h-4` with bolder borders

### Architectural Rules Compliance
1. **Event Bubbling**: All inner buttons on cleaning cards get `e.stopPropagation()` in their onClick handlers
2. **Role-Based Bottom Nav**: Conditionally renders icons using the same `hasAnyFinance`/`hasAnyCleaning` permission checks already in Dashboard
3. **De-cluster Actions**: Not directly applicable here (Property Cards with Edit/Delete are in Admin.tsx, not Dashboard) — but noted for future Admin improvements
4. **Calendar Readability**: Month cells get bolder borders, colored status bars, and heavier font weights

### Layout Change (Mobile)
```text
BEFORE:                        AFTER:
┌──────────────────┐          ┌──────────────────┐
│ Header           │          │ Header           │
│ [Finance][Clean] │          ├──────────────────┤
├──────────────────┤          │                  │
│                  │          │  Content         │
│  Content         │          │  (full height)   │
│                  │          │                  │
│                  │          ├──────────────────┤
└──────────────────┘          │ 💰  🧹  🔧  👤  │
                              └──────────────────┘
```

Desktop (768px+) remains unchanged — top tabs stay visible, bottom nav hidden.

