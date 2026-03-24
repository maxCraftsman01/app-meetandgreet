## Codebase Refactoring — Progress

### ✅ Completed (Steps 1–5)

1. **Shared types** — Created `src/types/index.ts` with `Property`, `Booking`, `ManualReservation`, `CleanerTask`, `Ticket`, `PropertyStatus`, `CalendarEvent`, and API response types. Updated all imports across Dashboard, Admin, CleaningCalendar, DailyOperations, TicketList, PropertyFinanceView, ManageReservations.

2. **Shared status config** — Created `src/lib/status-config.ts` with `CLEANING_STATUS_CONFIG`, `CLEANING_STATUS_PRIORITY`, `TICKET_PRIORITY_COLORS`, `TICKET_STATUS_ICONS`, `TICKET_STATUS_COLORS`, `PROPERTY_COLORS`. Removed duplicate definitions from Dashboard.tsx, CleaningCalendar.tsx, DailyOperations.tsx, TicketList.tsx.

3. **API return types & eliminate `any`** — Replaced `any[]` state in Admin.tsx (`financeData`, `adminTickets`) and Dashboard.tsx (`ownerTickets`) with proper typed state.

4. **TicketList inline handler cleanup** — Extracted `handleToggleCostVisibility` to match the pattern of other toggle handlers.

### 🔜 Deferred (Steps 6–8)

5. **Dashboard hooks extraction** — Extract data fetching into `useDashboardData` hook
6. **Admin.tsx split** — Extract property form, grid, finance sheet, mobile nav into sub-components
7. **Edge function shared auth** — Consolidate CORS/auth across 11 functions
