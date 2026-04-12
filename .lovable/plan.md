

## Pending Refactoring — Steps 6, 7, and 8

Three refactoring tasks remain from the PROJECT_LOG:

### Step 6: Dashboard Hooks Extraction
**Current state**: `Dashboard.tsx` is 469 lines with data fetching, state, and UI mixed together.
**Plan**: Extract all data-fetching logic into `src/hooks/useDashboardData.ts` — owner data, cleaner tasks, tickets, sync. Dashboard becomes a presentational wrapper (~200 lines).

### Step 7: Admin.tsx Split
**Current state**: `Admin.tsx` is 608 lines containing property form, property grid, finance sheet, and mobile nav all in one file.
**Plan**: Extract into sub-components:
- `src/components/admin/PropertyFormDialog.tsx` — create/edit property dialog
- `src/components/admin/PropertyGrid.tsx` — property cards grid
- `src/components/admin/AdminFinanceSheet.tsx` — finance side sheet
- `src/components/admin/AdminMobileNav.tsx` — bottom tab navigation
- `Admin.tsx` stays as orchestrator (~150 lines)

### Step 8: Edge Function Shared Auth
**Current state**: All 11 edge functions duplicate the same CORS headers and PIN validation (~30 lines each).
**Plan**: Create shared modules:
- `supabase/functions/_shared/cors.ts` — export `corsHeaders` and OPTIONS handler
- `supabase/functions/_shared/auth.ts` — export `validateAdminPin()` helper
- Update all edge functions to import from shared modules (~300 lines reduced total)

### Execution order
Steps 6 → 7 → 8 (frontend first, then backend). No database changes needed — pure refactoring.

