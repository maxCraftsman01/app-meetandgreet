

## Codebase Refactoring Plan

### Priority Ranking

Files are ranked by size, complexity, and how central they are to the app.

| Rank | File | Lines | Issue Summary |
|------|------|-------|---------------|
| 1 | `src/pages/Admin.tsx` | 614 | God component — all admin logic in one file |
| 2 | `src/pages/Dashboard.tsx` | 456 | God component — all user logic in one file |
| 3 | `src/components/PropertyFinanceView.tsx` | 365 | Large, mixed concerns (calendar + chart + table + dialog) |
| 4 | `src/components/CleaningCalendar.tsx` | 357 | Long but more focused; duplicated status config |
| 5 | `src/components/TicketList.tsx` | 333 | Reasonable size; inline async handlers in JSX |
| 6 | `src/components/UserManagement.tsx` | 350 | Self-contained but large |
| 7 | `src/components/ManageReservations.tsx` | 319 | Self-contained but large |
| 8 | `src/lib/api.ts` | 200+ | No types on return values; repetitive pattern |
| 9 | Edge functions | Various | Duplicated CORS headers and auth logic across all 11 functions |
| 10 | `src/components/DailyOperations.tsx` | 265 | Duplicated status config with CleaningCalendar |

---

### Findings and Recommendations

#### 1. Extract shared types into `src/types/` (Low risk)

**Problem:** `Booking`, `ManualReservation`, `Property`, `CleanerTask`, and ticket interfaces are duplicated across `Admin.tsx`, `Dashboard.tsx`, `PropertyFinanceView.tsx`, and `CleaningCalendar.tsx`. Each file defines its own version.

**Refactoring:** Create `src/types/index.ts` with shared type definitions. Update all imports.

**Impact:** Eliminates 6-8 duplicate interface definitions. Ensures type consistency. Zero UI change.

---

#### 2. Extract duplicated status config (Low risk)

**Problem:** `STATUS_CONFIG`, `DOT_COLORS`, `STATUS_LABELS`, and priority maps are defined independently in `Dashboard.tsx`, `CleaningCalendar.tsx`, and `DailyOperations.tsx`.

**Refactoring:** Create `src/lib/status-config.ts` with a single source of truth for status colors, labels, icons, and priority.

**Impact:** ~60 lines removed across 3 files. No UI change.

---

#### 3. Split `Admin.tsx` into sub-components (Medium risk)

**Problem:** 614-line component with 18 state variables, property CRUD, finance viewer, ticket management, and 6 tab contents all in one file.

**Refactoring:**
- Extract the property form dialog into `src/components/admin/PropertyFormDialog.tsx`
- Extract the property card grid into `src/components/admin/PropertyGrid.tsx`
- Extract the finance sheet into `src/components/admin/AdminFinanceSheet.tsx`
- Extract the bottom mobile nav into `src/components/admin/AdminMobileNav.tsx`
- Keep `Admin.tsx` as the orchestrator (~150 lines)

**Impact:** Reduces `Admin.tsx` from 614 to ~150 lines. Each extracted component becomes independently testable.

---

#### 4. Split `Dashboard.tsx` into custom hooks (Medium risk)

**Problem:** 456-line component mixing data fetching, state management, and UI. Multiple `loadX` functions with identical loading/error patterns.

**Refactoring:**
- Create `src/hooks/useDashboardData.ts` — handles `loadData`, `loadCleaningTasks`, `loadOwnerTickets`, sync, mark/revert
- Dashboard component becomes purely presentational (~200 lines)

**Impact:** Separates business logic from UI. Enables unit testing of data logic without rendering.

---

#### 5. Add return types to `src/lib/api.ts` (Low risk)

**Problem:** Every API function returns `Promise<any>`. No compile-time safety on responses.

**Refactoring:** Add typed return values using the shared types from step 1:
```text
validatePin(pin: string): Promise<ValidatePinResponse>
getOwnerData(pin: string): Promise<OwnerDataResponse>
getCleanerTasks(pin: string): Promise<CleanerTask[]>
```

**Impact:** Catches type errors at compile time. Zero runtime change.

---

#### 6. Eliminate inline `any` usage (Low risk)

**Problem:** 28 occurrences of `any[]` across page components and edge functions. Examples:
- `adminTickets: any[]`, `ownerTickets: any[]`, `financeData: { bookings: any[] }`
- `arrival_reservation: any` in DailyOperations

**Refactoring:** Replace with proper typed state using shared types.

**Impact:** Better IDE autocomplete and error detection. Zero UI change.

---

#### 7. Consolidate edge function auth into shared module (Medium risk)

**Problem:** Every edge function (11 total) independently:
- Defines identical CORS headers
- Creates a Supabase client
- Validates admin/user PIN with the same logic

**Refactoring:** Create `supabase/functions/_shared/auth.ts` and `supabase/functions/_shared/cors.ts`:
- Shared CORS headers
- Shared `authenticateRequest(req, supabase)` function returning `{ role, userId, propertyIds }`

**Impact:** ~30-40 lines removed per function (300+ total). Auth changes happen in one place.

---

#### 8. Clean up inline async handlers in `TicketList.tsx` (Low risk)

**Problem:** The "Cost Visible to Owner" toggle has an inline async handler (lines 270-279) while other toggles use extracted functions. Inconsistent pattern.

**Refactoring:** Extract `handleToggleCostVisibility` to match the pattern of `handleToggleOwnerVisibility` and `handleToggleCleanerVisibility`.

**Impact:** Consistent code style. ~10 lines moved. Zero UI change.

---

### Implementation Order

Each step is independent and can be merged separately:

1. **Shared types** — foundation for other steps, zero risk
2. **Shared status config** — quick win, zero risk
3. **API return types** — uses types from step 1
4. **Eliminate `any` usage** — uses types from step 1
5. **TicketList inline handler cleanup** — isolated, 5-minute change
6. **Dashboard hooks extraction** — moderate scope, test manually
7. **Admin.tsx split** — largest change, test each tab
8. **Edge function shared auth** — backend change, test all endpoints

### Testing Strategy

- Steps 1-5: Type-only changes. If it compiles, it works. Run existing tests.
- Steps 6-7: Manual smoke test each tab/view after extraction. No behavior change expected.
- Step 8: Run each edge function endpoint via the app after deploying. Verify admin, owner, and cleaner flows.

