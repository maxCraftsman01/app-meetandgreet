

## Refine Mobile Issues Panel Layout

### Summary
Replace the mobile Filters button+Sheet with two inline dropdown selects (Property + Status) shown directly in the panel. Change default filter to "All statuses" for clarity. Tighten vertical spacing around the "Maintenance Issues" title on mobile.

### Changes

**1. TicketList.tsx — Mobile Filter UI**
- Remove the mobile "Filters" button (lines 162-175) and the Sheet component (lines 279-316)
- Add two `Select` dropdowns that are visible on mobile (`sm:hidden` removed, keep `hidden sm:flex` for desktop)
- Layout: stacked vertically on mobile with gap-2, full-width triggers
- Property dropdown: default "All properties"
- Status dropdown: default "All statuses", options: All statuses, Open, In Progress, Resolved
- Keep desktop inline controls unchanged (`hidden sm:flex`)

**2. TicketList.tsx — Filter Defaults**
- Change default `statusFilter` from `"active"` to `"all"` (line 50)
- Remove "active" option from status dropdown; use explicit values only
- Update `StatusFilter` type to exclude "active": `type StatusFilter = "all" | "open" | "in_progress" | "resolved"`
- Update `filteredTickets` logic to remove the "active" special case

**3. Admin.tsx — Title Spacing**
- Adjust Tickets tab content spacing (lines 231-251)
- Change outer container from `space-y-4` to `space-y-3` (or use responsive `space-y-3 sm:space-y-4`)
- Tighten the title row gap slightly on mobile if needed (e.g., `gap-2` instead of implicit)

**4. Desktop Behavior**
- Keep existing inline filter row for desktop (`sm:` breakpoint)
- Ensure no visual regression on tablet/desktop

### Files to Edit
- `src/components/TicketList.tsx`
- `src/pages/Admin.tsx`

