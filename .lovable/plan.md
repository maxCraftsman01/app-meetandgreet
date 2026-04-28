## Plan: Add photo upload + delete to issue Edit panel

Currently the Edit panel in `TicketList.tsx` only edits text fields, status, cost, and visibility flags. Existing photos are shown only in View mode and there's no way to add or remove them after creation. This plan adds full photo management to the Edit panel for admins.

### Scope
Admin-only (matches the rest of the Edit panel, which is admin-gated). Photos: max 5 per ticket (same limit as `TicketForm`). Voice notes are out of scope for this request — only photos.

### Changes

**1. `supabase/functions/maintenance-tickets/index.ts`**
- In the existing `PUT` handler, accept an optional `media_add: [{ media_type, storage_path }]` array → insert each into `ticket_media` with the ticket id.
- Accept an optional `media_remove: [mediaId, ...]` array → for each, look up the row, delete the row from `ticket_media`, and best-effort remove the underlying storage object from the `ticket-media` bucket (parse the public URL to derive the object path).
- Both arrays are optional and processed before the final `select` so the response already reflects the new media list.

**2. `src/components/TicketList.tsx` — Edit panel**
- Extend `EditForm` with `existingMedia: TicketMedia[]`, `mediaToRemove: string[]`, `newPhotos: File[]`.
- Initialize from `selectedTicket.ticket_media` filtered to `media_type === "photo"` when entering edit mode.
- Add a new "Photos" section in the Edit panel (above the visibility switches), reusing the same UI pattern as `TicketForm`:
  - Thumbnail grid for existing photos with an `X` button → moves the id into `mediaToRemove` and hides it from the grid.
  - Thumbnail grid for newly picked files (object URLs) with `X` to remove from the pending list.
  - "+" tile with camera icon opens the file picker (`accept="image/*"`, `multiple`); enforces total count ≤ 5 (existing minus removed + new).
- In `handleSaveEdit`:
  - Upload each `newPhotos` file via `uploadTicketMedia(file, selectedTicket.id)` to get its public URL.
  - Send `media_add` (uploaded URLs) and `media_remove` (ids) alongside the existing field updates in a single `updateTicket` call.
  - On success, the response already contains the updated `ticket_media`, so `setSelectedTicket({ ...selectedTicket, ...updated })` shows the new state immediately.

**3. `src/lib/api.ts`**
- No new function needed. `updateTicket` already forwards the request body — just include `media_add` / `media_remove` in the payload from the component.

### UX details
- Show upload progress via the existing `saving` state (label changes to "Uploading…" while photos upload, then "Saving…" while the PUT runs).
- If any individual upload fails, abort the save with a toast and keep the dialog open so the user can retry without losing other edits.
- Removing a photo is reversible until "Save changes" is clicked (Cancel restores the original list).

### Out of scope
- Editing voice notes (can be added later with the same pattern).
- Reordering photos.
- Owner/cleaner edit access (still admin-only).

After approval I'll switch to default mode and ship.