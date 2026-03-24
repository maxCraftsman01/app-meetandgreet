

## Collapsible Reservations List — Show Last 2, Expand for All

### Change
Make the "List of Reservations and payouts" section collapsed by default, showing only the last 2 reservations. Add a "Show all" button (right-aligned in the header) that expands to reveal the full list.

### File: `src/components/PropertyFinanceView.tsx`

1. **Add state**: `const [expanded, setExpanded] = useState(false);`

2. **Derive visible rows**: `const visiblePayouts = expanded ? recentPayouts : recentPayouts.slice(-2);`

3. **Refactor the header row** (line 268): Replace the plain `<h3>` with a flex row:
   - Left: heading text "List of Reservations and payouts"
   - Right: a ghost button showing "Show all (N)" when collapsed, "Show less" when expanded. Only render this button if `recentPayouts.length > 2`.

4. **Render `visiblePayouts`** instead of `recentPayouts` in the table body (line 279).

5. No other files changed. Uses existing `Button` component with `variant="ghost"` and `ChevronDown`/`ChevronUp` icon for the toggle — both already imported or available.

