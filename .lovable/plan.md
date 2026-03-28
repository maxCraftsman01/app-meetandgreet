

## Add "Report New Issue" Button to Issues Tab

### Change

**`src/pages/Dashboard.tsx`** — Lines 408-409 (between the header row and the loading/list section):

Insert a full-width "Report New Issue" button that reuses the existing `reportDialogOpen` / `reportPropertyId` state:

```tsx
<Button
  variant="outline"
  className="w-full mb-4"
  onClick={() => {
    setReportPropertyId(userProperties.find(p => p.can_view_finance)?.id || "");
    setReportDialogOpen(true);
  }}
>
  <Wrench className="w-4 h-4 mr-1.5" />
  Report New Issue
</Button>
```

This picks the first finance-capable property as the preselected property (matching the pattern used elsewhere). The existing dialog and `TicketForm` handle everything else.

### No other files changed
Only the Issues tab panel in `Dashboard.tsx` is modified. No new state, no new dialog.

