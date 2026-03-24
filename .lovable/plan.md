

## Maintenance Tickets with Admin Moderation

### Problem
1. Cleaners report issues, but not all tickets should be visible to owners
2. Admin needs to review/approve tickets before owners see them
3. Admin also needs to create tickets when inspecting properties

### Solution: Ticket Visibility Flag + Shared Ticket Form

Every ticket gets a `visible_to_owner` boolean (default `false`). Cleaners and admins create tickets. Admin reviews all tickets in a dedicated tab and toggles which ones owners can see. Owners only see approved tickets.

### Database Schema

**New tables** (via migration):

```sql
-- maintenance_tickets
id uuid PK
property_id uuid (FK → properties)
created_by_user_id uuid (nullable, FK → app_users)
created_by_role text ('cleaner' | 'admin')
title text
description text
status text default 'open' -- open, in_progress, resolved
priority text default 'normal' -- low, normal, urgent
repair_cost numeric default 0
visible_to_owner boolean default false
created_at timestamptz
resolved_at timestamptz

-- ticket_media
id uuid PK
ticket_id uuid (FK → maintenance_tickets)
media_type text ('photo' | 'voice_note')
storage_path text
created_at timestamptz
```

**Storage bucket**: `ticket-media` (public read for authenticated, write via edge function)

### Edge Function: `maintenance-tickets`

Single function handling all roles:
- **POST** — Create ticket (cleaner via `x-user-pin`, admin via `x-admin-pin`). Validates property access (`can_mark_cleaned` for cleaners, admin flag for admins). Uploads media to storage.
- **GET** — List tickets. Admin sees all. Owner sees only `visible_to_owner = true` for their properties. Cleaner sees their own submissions.
- **PUT** — Update ticket. Admin can change `status`, `repair_cost`, `visible_to_owner`. Cleaner/owner cannot modify.
- **DELETE** — Admin only.

### UI Components

**New: `src/components/TicketForm.tsx`**
- Reusable form for creating tickets (used by both cleaner and admin)
- Property selector, title, description, priority
- Photo upload (camera capture on mobile + file picker)
- Voice note recorder (MediaRecorder API → WebM blob → upload)

**New: `src/components/TicketList.tsx`**
- Reusable list of tickets with status badges, thumbnails
- Props: `tickets[]`, `role`, `onToggleVisibility?`, `onUpdateStatus?`, `onSetCost?`
- Admin mode: shows toggle switch for `visible_to_owner`, status dropdown, cost input
- Owner mode: read-only view with photo/audio playback

### Integration Points

**Admin panel (`src/pages/Admin.tsx`)**
- New "Tickets" tab (goes into the mobile "More" sheet)
- Shows all tickets across properties, filterable by property/status
- Each ticket row has: toggle visibility, set status, add repair cost
- "Create Ticket" button opens `TicketForm` (admin as inspector)

**Owner Dashboard (`src/pages/Dashboard.tsx`)**
- New "Tickets" tab for owners who have finance access
- Shows only `visible_to_owner = true` tickets for their properties
- Read-only: photo gallery, audio playback, status, cost

**Cleaner Dashboard (`src/pages/Dashboard.tsx`)**
- "Report Issue" button on cleaning tab cards
- Opens `TicketForm` pre-filled with the property

### Financial Integration
- In `PropertyFinanceView`, add a "Maintenance Costs" line showing `SUM(repair_cost)` for resolved tickets in the displayed period
- Deducted from revenue summary

### Files

| File | Action |
|---|---|
| Migration SQL | Create `maintenance_tickets`, `ticket_media` tables, storage bucket |
| `supabase/functions/maintenance-tickets/index.ts` | New edge function |
| `src/components/TicketForm.tsx` | New — shared create form |
| `src/components/TicketList.tsx` | New — shared ticket list |
| `src/pages/Admin.tsx` | Add Tickets tab with moderation controls |
| `src/pages/Dashboard.tsx` | Add owner Tickets tab, cleaner Report Issue button |
| `src/components/PropertyFinanceView.tsx` | Add maintenance cost deduction |
| `src/lib/api.ts` | Add ticket API helpers |

