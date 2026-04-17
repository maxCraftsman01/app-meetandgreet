
## Update PROJECT_LOG.md with today's changes

**Summary:** Add three new entries to the "Post-Milestone Changes" section for 2026-04-17: Owner Expenses sub-section in Finance view, Owner Expense Statement in Admin panel, and Edge Function Authentication Standardization across all functions.

**Changes to add:**

1. **Owner Expenses & Expense Statement (2026-04-17)**
   - Owner Finance Expenses sub-section (`PropertyFinanceView.tsx`): Added collapsible "Property Expenses" section showing expenses where `visible_to_owner = true` with category badges, filtering controls, empty state, and totals
   - Admin Owner Expense Statement (`OwnerExpenseStatement.tsx`): New billing/reconciliation view with owner selector, per-property expense tables, grand totals with pending/paid breakdown, monthly breakdown toggle, and print/export functionality via `@media print` CSS

2. **Edge Function Auth Standardization (2026-04-17)**
   - Audited and standardized all edge functions to use shared `validateAdminPin()` helper
   - Updated: `admin-properties`, `admin-pending-ical`, `admin-reservations`, `cleaner-operations`, `owner-reservations`, `owner-data`, `expenses`, `maintenance-tickets`, `validate-pin`, `fetch-ical`
   - Replaced legacy env-only `ADMIN_PIN` checks with database-aware validation supporting both legacy env PIN and DB admins from `app_users`
   - Added defensive validation, safe array access (`.limit(1)` instead of `.single()`), structured JSON error responses (400/401/404/500), and proper error logging

**File to edit:** `PROJECT_LOG.md` — append two new subsections to "Post-Milestone Changes" section, replacing the current "None active" pending tasks line.

**No SQL migrations or other file changes required.**
