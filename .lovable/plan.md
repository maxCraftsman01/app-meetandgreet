

## Plan: Filterable Issues panel with admin Edit mode

### 1. New filter bar (TicketList.tsx)
Add filter controls at top of the list (props-driven so the same component works for admin and dashboard):

- **Property filter** — Select with "All properties" + one item per property (built from `tickets` or passed-in `properties`).
- **Status filter** — Tabs/Segmented on desktop, Select on mobile. Values: All · Open · In Progress · Resolved.
- **Clear filters** button shown only when any filter is non-default.
- **Default**: `status = active` (Open + In Progress) so the list opens focused on actionable issues. A toggle "Active only" off → "All" exposes Resolved.

Layout:
- Desktop (`sm:`): inline row above list — `[Property select] [Status segmented] [Clear]`.
- Mobile (`<sm`): single "Filters" button (with active-count badge) → opens a `Sheet` (bottom drawer) containing the same controls + Clear + Apply.

Filtering happens client-side over the already-loaded `tickets` array — no API change.

### 2. Issue list (unchanged interaction)
- Cards remain tap-to-open. **Remove** any inline edit affordance from row (none exists today beyond cost/visibility — those move to detail edit mode).
- Keep status icon, priority badge, photo/voice icons, cost (admin/owner), chevron.
- Empty state respects filters: "No issues match your filters" with Clear button.

### 3. Detail dialog — view mode (default)
Refactored DialogContent into two modes controlled by local `mode: 'view' | 'edit'`.

**View mode** shows:
- Title, badges (priority, status), property, created date, description, photos, voice notes.
- Owner sees masked cost.
- Admin-only footer:
  - **Quick status update**: small inline `Select` to change status without entering edit mode (uses existing PUT `status`).
  - **Edit Issue** button → switches to edit mode.
  - **Delete** button (kept, with confirm).

### 4. Detail dialog — edit mode (admin only)
Triggered by "Edit Issue". Replaces view body with a form. Fields editable today (PUT supports these):
- **Title** *(needs edge fn extension — see §6)*
- **Description** *(needs edge fn extension)*
- **Property** *(needs edge fn extension — `property_id`)*
- **Status** (open / in_progress / resolved)
- **Priority** (low / normal / high / urgent — match existing values)
- **Repair cost** + currency
- **Visible to owner** / **Visible to cleaner** / **Cost visible to owner** (Switches)

Footer: `[Cancel]` returns to view mode without saving · `[Save changes]` PUTs and refreshes, then returns to view mode.

**Not adding** "Assigned person/vendor" or "Internal admin notes" — `maintenance_tickets` table has no columns for these. Calling these out as out-of-scope; if user wants them I'll propose a migration in a follow-up.

### 5. Component shape
`TicketList.tsx` gains:
- `properties?: { id: string; name: string }[]` prop (optional; falls back to deriving unique properties from tickets).
- Internal state: `propertyFilter`, `statusFilter`, `mobileFiltersOpen`, `mode` (view|edit), `editForm` (snapshot of selected ticket).
- Memoized `filteredTickets`.

`Admin.tsx`: pass `properties={properties.map(...)}` to `<TicketList>`. No other changes.
`Dashboard.tsx` (owner): pass owner-visible properties. Edit mode hidden (role !== admin).

### 6. Edge function extension (`supabase/functions/maintenance-tickets/index.ts`)
PUT branch currently whitelists status/repair_cost/visible_*/priority/cost_visible_to_owner. Add to whitelist:
- `title` (string, non-empty)
- `description` (string)
- `property_id` (uuid, must exist)

Validate types; reject empty title with 400. No schema changes. No SQL migration.

### 7. Files to change
- `src/components/TicketList.tsx` — filters bar + mobile Filters sheet + view/edit modes.
- `src/pages/Admin.tsx` — pass `properties` prop to `TicketList` (1 line).
- `src/pages/Dashboard.tsx` — pass `properties` prop to `TicketList` (1 line).
- `supabase/functions/maintenance-tickets/index.ts` — extend PUT whitelist (title/description/property_id) with validation.

No new dependencies. No schema migration. Auto-deploy on edge fn save.

