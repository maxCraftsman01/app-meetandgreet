

## Admin Mobile Navigation: Bottom Bar with "More" Sheet

### Problem
5 tabs overflow horizontally on mobile. Need a scalable pattern that works for current tabs and future additions.

### Approach
Fixed bottom navigation bar on mobile (hidden on desktop) with 4 pinned tabs + a "More" button that opens a bottom sheet listing remaining/future tabs.

### Layout

```text
Desktop (unchanged):
┌────────────┬───────┬─────────────────┬──────────┬───────────┐
│ Properties │ Users │ All Reservations│ Timeline │ Daily Ops │
└────────────┴───────┴─────────────────┴──────────┘───────────┘

Mobile bottom bar:
┌──────┬──────┬──────┬──────┬────────┐
│ 🏢  │ 👥  │ 📋  │ 📅  │  •••  │
│Props │Users │Reserv│Time  │ More  │
└──────┴──────┴──────┴──────┴────────┘
                              ↓ opens Sheet
                    ┌─────────────────┐
                    │ ⚡ Daily Ops    │
                    │ (future tabs…)  │
                    └─────────────────┘
```

### Changes

**`src/pages/Admin.tsx`**
- Define a `tabs` array with `{ id, label, shortLabel, icon }` for all 5 tabs
- Hide `TabsList` on mobile (`hidden md:flex`)
- Add a fixed bottom nav bar (`md:hidden fixed bottom-0 inset-x-0 z-50 border-t bg-background`) showing the first 4 tabs as icon+short-label buttons
- 5th slot is a "More" button (`MoreHorizontal` icon) that opens a `Sheet` from bottom
- Sheet lists remaining tabs (Daily Ops + any future tabs) as tappable rows
- Clicking any nav item calls `setActiveTab(id)` and closes the sheet
- Active tab gets `text-primary` color + top accent line
- Add `pb-20 md:pb-0` to content area to clear the bottom bar
- Touch targets: min `h-12` per item, `pb-safe` on the bar for notched devices

### Scalability
Adding a new tab = push to the `tabs` array. First 4 stay pinned, all extras go in the "More" sheet automatically.

### Files
| File | Change |
|---|---|
| `src/pages/Admin.tsx` | Add mobile bottom nav bar + More sheet, hide desktop TabsList on mobile |

