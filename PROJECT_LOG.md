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

### 6. Dashboard Hooks Extraction ✅
- Extracted all data-fetching logic from `Dashboard.tsx` into `src/hooks/useDashboardData.ts`
- Dashboard is now a presentational wrapper importing the custom hook

### 7. Admin.tsx Split ✅
- Extracted sub-components:
  - `src/components/admin/PropertyFormDialog.tsx`
  - `src/components/admin/PropertyGrid.tsx`
  - `src/components/admin/AdminMobileNav.tsx`
- `Admin.tsx` is now an orchestrator (~200 lines)

### 8. Edge Function Shared Auth ✅
- Created `supabase/functions/_shared/cors.ts` (corsHeaders, handleCors, json helper)
- Created `supabase/functions/_shared/auth.ts` (getSupabaseClient, validateAdminPin)
- All 11 edge functions now import from shared modules
- ~300+ lines of duplication eliminated

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
| — | Completed refactoring steps 6–8 (dashboard hooks, admin split, shared edge modules) |

---

## Tech Stack

- **Frontend**: React 18, Vite 5, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Supabase (Lovable Cloud) — Postgres + Edge Functions (Deno)
- **State**: React Query (`@tanstack/react-query`)
- **Charts**: Recharts
- **Routing**: React Router v6
- **Animation**: Framer Motion

---

## Milestones

### MILESTONE_2026_04_12-stable

Reference baseline established 2026-04-12. All future conversations may reference this milestone name.

1. **Three-role PIN-based auth** — Admin, Owner, and Cleaner roles determined by `user_property_access` permissions; no Supabase Auth used. Session managed in `src/lib/session.ts`.
2. **11 edge functions deployed** — All share centralized CORS and auth helpers from `supabase/functions/_shared/cors.ts` and `auth.ts`. Functions cover validation, CRUD, iCal sync, timeline, and user management.
3. **iCal parsing corrected** — Airbnb `SUMMARY:Reserved` parsed as bookings; `SUMMARY:Airbnb (Not available)` parsed as blocked. Booking.com "Guest" fallback removed — only ref IDs stored in `guest_name`.
4. **Authorization supports personal PINs** — `fetch-ical` and other edge functions now fall back to `user_property_access` when the PIN doesn't match the property's `owner_pin` directly.
5. **Ticket visibility system** — Three independent toggles (`visible_to_owner`, `visible_to_cleaner`, `cost_visible_to_owner`) with server-side cost masking for cleaners (always) and owners (when toggle off).
6. **Admin panel decomposed** — `Admin.tsx` is an orchestrator importing `PropertyFormDialog`, `PropertyGrid`, and `AdminMobileNav` sub-components.
7. **Dashboard hooks extracted** — All data-fetching logic lives in `src/hooks/useDashboardData.ts`; `Dashboard.tsx` is a presentational wrapper.
8. **Master Reservation List with edit** — All Reservations tab supports delete, mark-as-blocked, and inline edit dialog (guest name, dates, source, status, net payout).
9. **Shared types and status config** — `src/types/index.ts` centralizes all interfaces; `src/lib/status-config.ts` holds colors, labels, icons, and priorities.
10. **Refactoring steps 1–8 complete** — Types, status config, API typing, TicketList cleanup, import updates, dashboard hooks, admin split, and shared edge modules all done.
11. **Database tables** — `properties`, `bookings`, `manual_reservations`, `maintenance_tickets`, `ticket_media`, `app_users`, `user_property_access`. Existing records cleaned of "Booking.com Guest" prefix.
12. **Tech stack** — React 18, Vite 5, TypeScript, Tailwind CSS, shadcn/ui, Supabase (Lovable Cloud), React Query, Recharts, React Router v6, Framer Motion.
