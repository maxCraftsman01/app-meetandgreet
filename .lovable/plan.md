

## Plan: Mobile Issues Filter Buttons + Title Position

### 1. Replace single "Filters" button with two separate filter buttons (mobile)
**In `TicketList.tsx`:**
- Remove the single "Filters" button that opens the bottom sheet
- Add two distinct buttons side by side: **Property** and **Status**
- Each button shows current selection (or "All properties" / "Active")
- Both buttons open the same Sheet, but the Sheet remains as-is with both controls inside
- Keep the same Sheet layout - no need for separate sheets since both filters fit compactly

**Mobile button layout:**
```
[Property: All properties] [Status: Active ▼]  [Clear (if active)]
```

- Each button uses `variant="outline"` and `size="sm"`
- Shows truncated current value (with `truncate max-w-[120px]`)
- Active filter count badge only appears if filters are non-default

### 2. Move "Maintenance Issues" title up in Admin.tsx
**In `Admin.tsx`:**
- Remove the `<h2>Maintenance Issues</h2>` from inside the `TabsContent value="tickets"` area (currently at line 234)
- Add the title as a page-level header between the `<header>` (Admin Panel) and the `<main>` content area
- The title should only appear when the active tab is "tickets"
- Position it at the same hierarchy level as the "Admin Panel" header, just below it

**Structure:**
```
<header>Admin Panel | Sync All | Logout</header>
<h2 className="container px-4 py-2 text-lg font-semibold">Maintenance Issues</h2>  {/* only when tab === tickets */}
<main>...</main>
```

- This gives the Issues tab its own consistent page title, matching the pattern used by other main sections

### 3. Layout adjustments
- Ensure the two mobile filter buttons wrap correctly with `flex-wrap gap-2`
- Keep desktop inline selects unchanged (hidden on mobile, visible on `sm:`)
- The Clear filters button stays inline next to the filter buttons when active

### Files to edit:
1. `src/components/TicketList.tsx` - Replace single Filters button with two separate buttons
2. `src/pages/Admin.tsx` - Move "Maintenance Issues" title to page level under the Admin header

