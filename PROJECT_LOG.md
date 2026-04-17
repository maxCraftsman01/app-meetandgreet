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

### 6. Property Listing URLs
- `properties.listing_urls` is a `text[]` column storing multiple advertisement links per property (Airbnb, Booking.com, direct site, etc.)
- Admin form uses a newline-separated textarea (same UX pattern as iCal URLs)
- Owner Finance panel renders a "Listing Links" card with truncated URL display + Copy-to-clipboard button
- Card only renders when `listing_urls.length > 0`

---

## Database Schema

### Tables
- `properties` — rental properties with iCal URLs, listing URLs, rates, PINs
- `bookings` — synced from iCal feeds
- `manual_reservations` — manually entered or imported reservations with cleaning status
- `maintenance_tickets` — tickets with visibility toggles and cost controls
- `ticket_media` — photos/videos attached to tickets
- `app_users` — PIN-based users (not Supabase auth)
- `user_property_access` — per-user, per-property permissions (finance, cleaning, mark-cleaned)
- `pin_attempts` — rate-limit tracking for PIN authentication

### Key Columns Added During Development
- `maintenance_tickets.visible_to_cleaner` (boolean, default `true`)
- `maintenance_tickets.cost_visible_to_owner` (boolean, default `false`)
- `properties.listing_urls` (text[], default `'{}'`)

---

## Edge Functions

| Function | Purpose |
|----------|---------|
| `validate-pin` | Authenticate user by PIN, return role + accessible properties |
| `owner-data` | Fetch owner dashboard data (properties, reservations, bookings) |
| `owner-reservations` | Owner-specific reservation management |
| `cleaner-operations` | Cleaner task list with cleaning statuses |
| `maintenance-tickets` | CRUD for tickets with role-based visibility filtering |
| `admin-properties` | Admin CRUD for properties (generic insert/update — `listing_urls` flows through automatically) |
| `admin-reservations` | Admin reservation management |
| `admin-timeline` | Timeline data for admin view |
| `admin-pending-ical` | Pending iCal import management |
| `admin-users` | User and access management |
| `fetch-ical` | Sync bookings from iCal feeds |

All functions share centralized helpers from `supabase/functions/_shared/cors.ts` and `_shared/auth.ts`.

---

## Completed Refactoring (Steps 1–8)

1. **Shared types** — `src/types/index.ts` with `Property`, `Booking`, `ManualReservation`, `CleanerTask`, `Ticket`, `PropertyStatus`, `CalendarEvent`, and API response types
2. **Shared status config** — `src/lib/status-config.ts` with cleaning status config, ticket priority/status colors and icons, property colors
3. **API return types & eliminate `any`** — Typed state in `Admin.tsx` and `Dashboard.tsx`
4. **TicketList cleanup** — Extracted `handleToggleCostVisibility` inline handler
5. **Updated imports** across Dashboard, Admin, CleaningCalendar, DailyOperations, TicketList, PropertyFinanceView, ManageReservations
6. **Dashboard hooks extraction** — All data-fetching logic moved to `src/hooks/useDashboardData.ts`
7. **Admin.tsx split** — Extracted `PropertyFormDialog`, `PropertyGrid`, `AdminMobileNav` sub-components
8. **Edge function shared auth** — `_shared/cors.ts` and `_shared/auth.ts` eliminated 300+ lines of duplication

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
| 2026-04-12 | Established `MILESTONE_2026_04_12-stable` baseline |
| 2026-04-14 | Added `listing_urls` to properties — admin textarea form + owner Finance "Listing Links" card with copy-to-clipboard |

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
2. **11 edge functions deployed** — All share centralized CORS and auth helpers from `supabase/functions/_shared/cors.ts` and `auth.ts`.
3. **iCal parsing corrected** — Airbnb `SUMMARY:Reserved` parsed as bookings; `SUMMARY:Airbnb (Not available)` parsed as blocked. Booking.com "Guest" fallback removed.
4. **Authorization supports personal PINs** — `fetch-ical` and other edge functions fall back to `user_property_access` when the PIN doesn't match the property's `owner_pin`.
5. **Ticket visibility system** — Three independent toggles with server-side cost masking for cleaners (always) and owners (when toggle off).
6. **Admin panel decomposed** — `Admin.tsx` is an orchestrator importing `PropertyFormDialog`, `PropertyGrid`, and `AdminMobileNav`.
7. **Dashboard hooks extracted** — All data-fetching logic in `src/hooks/useDashboardData.ts`.
8. **Master Reservation List with edit** — All Reservations tab supports delete, mark-as-blocked, and inline edit dialog.
9. **Shared types and status config** — `src/types/index.ts` and `src/lib/status-config.ts`.
10. **Refactoring steps 1–8 complete**.
11. **Database tables** — `properties`, `bookings`, `manual_reservations`, `maintenance_tickets`, `ticket_media`, `app_users`, `user_property_access`, `pin_attempts`.
12. **Tech stack** — React 18, Vite 5, TypeScript, Tailwind CSS, shadcn/ui, Supabase (Lovable Cloud), React Query, Recharts, React Router v6, Framer Motion.

---

## Post-Milestone Changes

### Property Listing URLs (2026-04-14)
- **DB migration**: `ALTER TABLE public.properties ADD COLUMN listing_urls text[] DEFAULT '{}'::text[];`
- **Types**: Added `listing_urls?: string[]` to `Property` interface
- **Admin form** (`PropertyFormDialog.tsx`): Added "Listing URLs" textarea after Cleaning Notes (one URL per line)
- **Admin save logic** (`Admin.tsx`): Splits/joins newline-separated URLs into the `text[]` column, mirroring `ical_urls` handling
- **Owner Finance** (`PropertyFinanceView.tsx`): New "Listing Links" card at the bottom (after monthly occupancy) with truncated URL display and Copy button using `navigator.clipboard.writeText` + toast confirmation
- **No edge function changes** — `admin-properties` uses generic `insert(body)` / `update(body)`
- **Note**: Card is conditionally rendered (`listing_urls.length > 0`); existing properties have empty arrays until an admin adds links

---

### Owner Expenses & Expense Statement (2026-04-17)
- **Owner Finance Expenses sub-section** (`PropertyFinanceView.tsx`): Added collapsible "Property Expenses" section that surfaces expenses where `visible_to_owner = true`. Includes category badges, filtering controls, empty state, and per-section totals.
- **Admin Owner Expense Statement** (`OwnerExpenseStatement.tsx`): New billing/reconciliation view with:
  - Owner selector (filters by users with `can_view_finance` access)
  - Per-property expense tables
  - Grand totals with pending vs. paid breakdown
  - Monthly breakdown toggle
  - Print/export support via `@media print` CSS for clean PDF output
- **Purpose**: Gives admins a one-page reconciliation document per owner and gives owners visibility into approved expenses charged against their property.

---

### Edge Function Auth Standardization (2026-04-17)
- **Problem**: Several edge functions still authenticated admins via a strict `pin === Deno.env.get("ADMIN_PIN")` equality check, which rejected DB-defined admins from `app_users` and caused `401 Unauthorized` runtime errors (notably on `admin-properties`, `admin-pending-ical`, and `cleaner-operations`).
- **Fix**: Audited every edge function and standardized all admin checks on the shared `validateAdminPin()` helper from `supabase/functions/_shared/auth.ts`, which accepts **both** the legacy env `ADMIN_PIN` and any user with `is_admin = true` in `app_users`.
- **Functions updated**: `admin-properties`, `admin-pending-ical`, `admin-reservations`, `cleaner-operations`, `owner-reservations`, `owner-data`, `expenses`, `maintenance-tickets`, `validate-pin`, `fetch-ical`.
- **Hardening applied alongside auth fix**:
  - Replaced fragile `.single()` lookups with `.limit(1)` + safe array indexing (`rows?.[0]`) where uniqueness wasn't guaranteed
  - Wrapped `req.json()` in try/catch so malformed bodies return `400` instead of crashing
  - Standardized JSON error responses with correct status codes: `400` (validation/invalid input), `401` (unauthorized), `404` (missing resource), `500` (DB/runtime)
  - Added server-side `console.error` logging for underlying Supabase errors to aid debugging
- **Backwards compatibility**: Legacy env `ADMIN_PIN` continues to work; the helper short-circuits on it before hitting the database.

---

## Current Pending Tasks

- None active. Suggested next enhancement: add a small Deno test suite covering `validateAdminPin()` (legacy env PIN, DB admin PIN, non-admin PIN, empty PIN) so future auth regressions are caught automatically.
