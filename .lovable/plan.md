

## Add Edit Button to All Reservations (Master List)

### What changes
**File: `src/components/MasterReservationList.tsx`**

Add an edit dialog identical to the one in `ManageReservations.tsx`:

1. Add state for `dialogOpen`, `editingId`, and `form` (guest_name, check_in, check_out, source, net_payout, status)
2. Add a `handleEdit` function that populates the form from the selected reservation and opens the dialog
3. Add a `handleSave` function that calls `updateReservation(adminPin, id, payload)` — reusing the existing API import
4. Add a `Dialog` component with the same form fields (Guest Name, Check-in, Check-out, Source, Status, Net Payout) — matching the existing pattern in `ManageReservations`
5. Add a `Pencil` edit button (already imported but unused) between the Block and Delete buttons in each row
6. The property dropdown in the edit dialog is read-only (shows property name) since changing property assignment from this view would be unusual

### No backend changes needed
The `PUT` endpoint in `admin-reservations` already supports updating all these fields.

