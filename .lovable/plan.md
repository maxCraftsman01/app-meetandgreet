

## Checkpoint: MILESTONE_2026_04_12-stable

This milestone captures the current stable state of the Meet & Greet Property Management app. The `PROJECT_LOG.md` will be updated with this checkpoint section.

---

### Current App State Summary

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

---

### Implementation

Append a `## Milestones` section to `PROJECT_LOG.md` with the name `MILESTONE_2026_04_12-stable` and the 12 bullets above. This becomes the reference baseline for all future conversations.

