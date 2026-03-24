

## Add Property Selector to Finance Tab

### Current State
There is already a property selector in the header (line 200-211), but it controls the entire dashboard and is tied to finance, sync, and other features. The user wants a dedicated way to choose which property's finance data is shown, ideally within the Finance tab itself.

### Solution
Move the property selector dropdown **inside the Finance tab content area**, at the top, so the user can switch between their finance-accessible properties directly. This replaces the current header-level selector for finance context.

### Changes

**`src/pages/Dashboard.tsx`**

1. Inside the Finance `TabsContent` (line 261), add a property dropdown at the top that lists only properties where the user has `can_view_finance` access
2. Keep the existing `selectedPropertyId` state — it already drives which property is shown
3. Remove the header-level property selector (or keep it only if needed for other tabs)
4. If the user has only one finance property, skip showing the dropdown

The dropdown will sit above the `PropertyFinanceView` component, styled consistently with existing selects.

### Technical details
- Filter `properties` to only those with finance access: `userProperties.filter(p => p.can_view_finance)`
- Use existing `Select` component with the finance-accessible properties
- On change, update `selectedPropertyId` which already triggers the correct `PropertyFinanceView` render

