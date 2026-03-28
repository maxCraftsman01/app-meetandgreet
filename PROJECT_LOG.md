# Project Log — Meet & Greet Property Management

## Overview

A property management app for short-term rentals with three user roles: **Admin**, **Owner**, and **Cleaner**. PIN-based authentication (no Supabase Auth). Built with React + Vite + Tailwind + Supabase (Lovable Cloud).

---

## Architectural Decisions

### 1. PIN-based Authentication
- Users authenticate via a PIN stored in `app_users` table
- Role is determined by `user_property_access` permissions, not a role column
- Session stored in `src/lib/session.ts`

### 2. Role Determination Logic
- **Admin**: `app_users.is_admin = true`
- **Owner**: user has `can_view_finance` on at least one property
- **Cleaner**: user has `can_mark_cleaned` on at least one property
- Priority: admin > owner > cleaner (determined in edge functions)

### 3. Ticket Visibility System
- Three independent boolean toggles per ticket (all admin-controlled):
  - `visible_to_owner` — whether the property owner can see the ticket
  - `visible_to_cleaner` — whether cleaners can see the ticket
  - `cost_visible_to_owner` — whether the repair cost is shown to the owner
- **Ticket creators always see their own tickets** regardless of toggles
- **Repair cost is never shown to cleaners** (server-side masking to `0`)
- **Repair cost for owners** is masked server-side when `cost_visible_to_owner = false`
- Default visibility on creation:
  - Cleaner creates: `visible_to_cleaner = true`, `visible_to_owner = false`
  - Owner creates: `visible_to_owner = true`, `visible_to_cleaner = false`
  - Admin creates: both `false` by default

### 4. Finance Tab Property Selector
- Property selector dropdown lives **inside the Finance tab**, not in the global header
- Only shows properties where the user has `can_view_finance` access
- If only one property has finance access, the selector is hidden

### 5. Shared Types & Config (Refactoring)
- All shared interfaces centralized in `src/types/index.ts`
- Status colors, labels, icons, priorities in `src/lib/status-config.ts`
- Eliminates duplicate definitions across components

---

## Database Schema

### Tables
- `properties` — rental properties with iCal URLs, rates, PINs
- `bookings` — synced from iCal feeds
- `manual_reservations` — manually entered or imported reservations with cleaning status
- `maintenance_tickets` — tickets with visibility toggles and cost controls
- `ticket_media` — photos/videos attached to tickets
- `app_users` — PIN-based users (not Supabase auth)
- `user_property_access` — per-user, per-property permissions (finance, cleaning, mark-cleaned)

### Key Columns Added During Development
- `maintenance_tickets.visible_to_cleaner` (boolean, default `true`)
- `maintenance_tickets.cost_visible_to_owner` (boolean, default `false`)

---

## Edge Functions

| Function | Purpose |
|----------|---------|
| `validate-pin` | Authenticate user by PIN, return role + accessible properties |
| `owner-data` | Fetch owner dashboard data (properties, reservations, bookings) |
| `owner-reservations` | Owner-specific reservation management |
| `cleaner-operations` | Cleaner task list with cleaning statuses |
| `maintenance-tickets` | CRUD for tickets with role-based visibility filtering |
| `admin-properties` | Admin CRUD for properties |
| `admin-reservations` | Admin reservation management |
| `admin-timeline` | Timeline data for admin view |
| `admin-pending-ical` | Pending iCal import management |
| `admin-users` | User and access management |
| `fetch-ical` | Sync bookings from iCal feeds |

---

## Completed Refactoring (Steps 1–5)

1. **Shared types** — `src/types/index.ts` with `Property`, `Booking`, `ManualReservation`, `CleanerTask`, `Ticket`, `PropertyStatus`, `CalendarEvent`, and API response types
2. **Shared status config** — `src/lib/status-config.ts` with cleaning status config, ticket priority/status colors and icons, property colors
3. **API return types & eliminate `any`** — Typed state in `Admin.tsx` and `Dashboard.tsx`
4. **TicketList cleanup** — Extracted `handleToggleCostVisibility` inline handler
5. **Updated imports** across Dashboard, Admin, CleaningCalendar, DailyOperations, TicketList, PropertyFinanceView, ManageReservations

---

## Pending Refactoring (Steps 6–8)

### 6. Dashboard Hooks Extraction
- Extract data fetching into `src/hooks/useDashboardData.ts`
- Dashboard becomes purely presentational (~200 lines)

### 7. Admin.tsx Split
- Extract into sub-components:
  - `src/components/admin/PropertyFormDialog.tsx`
  - `src/components/admin/PropertyGrid.tsx`
  - `src/components/admin/AdminFinanceSheet.tsx`
  - `src/components/admin/AdminMobileNav.tsx`
- Keep `Admin.tsx` as orchestrator (~150 lines)

### 8. Edge Function Shared Auth
- Create `supabase/functions/_shared/auth.ts` and `cors.ts`
- Consolidate duplicated CORS headers and PIN validation across 11 functions
- ~300+ lines reduced total

---

## Feature Changelog

| Date | Change |
|------|--------|
| — | Initial app with admin, owner, cleaner dashboards |
| — | Added finance tab with property selector inside tab content |
| — | Removed duplicate property selector from global header |
| — | Added `visible_to_cleaner` toggle for per-role ticket visibility |
| — | Added `cost_visible_to_owner` toggle for admin-controlled cost sharing |
| — | Server-side repair cost masking for cleaners (always `0`) |
| — | Server-side repair cost masking for owners when toggle is off |
| — | Completed refactoring steps 1–5 (types, status config, typing, cleanup) |

---

## Tech Stack

- **Frontend**: React 18, Vite 5, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Supabase (Lovable Cloud) — Postgres + Edge Functions (Deno)
- **State**: React Query (`@tanstack/react-query`)
- **Charts**: Recharts
- **Routing**: React Router v6
- **Animation**: Framer Motion
