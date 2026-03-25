

## Rename "Tickets" to "Issues" Across UI

### Scope
Change all user-facing text from "Ticket/Tickets" to "Issue/Issues" for consistency with the "Report Issue" button. Internal code identifiers (variable names, function names, type names, file names) will remain unchanged to keep this low-risk.

### Changes

**`src/pages/Admin.tsx`** — 5 text changes:
- Tab label: "Tickets" → "Issues" (line 62, both `label` and `shortLabel`)
- Desktop tab text: "Tickets" → "Issues" (line 261)
- Section heading: "Maintenance Tickets" → "Maintenance Issues" (line 472)
- Button text: "New Ticket" → "New Issue" (line 481)
- Dialog title: "Create Ticket" → "Create Issue" (line 485)

**`src/pages/Dashboard.tsx`** — 3 text changes:
- Tab label: "Tickets" → "Issues" (line 209)
- Section heading: "Property Tickets" → "Property Issues" (line 393)
- Toast error: "Failed to load tickets" → "Failed to load issues" (line 142)

**`src/components/TicketForm.tsx`** — 3 text changes:
- Toast success: "Ticket created!" → "Issue created!" (line 93)
- Toast error: "Failed to create ticket" → "Failed to create issue" (line 96)
- Button text: "Submit Ticket" → "Submit Issue" (line 206)

**`src/components/TicketList.tsx`** — 4 text changes:
- Empty state: "No tickets found." → "No issues found."
- Confirm dialog: "Delete this ticket?" → "Delete this issue?"
- Toast: "Ticket deleted" → "Issue deleted"
- Detail dialog photo alt: "Ticket photo" → "Issue photo"

**`src/pages/Admin.tsx`** — 1 additional toast:
- "Failed to load tickets" → "Failed to load issues" (line 220)

No file renames, no type renames, no API function renames — purely user-facing string updates.

