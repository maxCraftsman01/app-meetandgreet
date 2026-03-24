

## Add Property Filter to "All Reservations" Tab

### Change
**`src/components/MasterReservationList.tsx`**:

1. Add a `selectedProperty` state (default `""` = all properties)
2. Add a `<select>` dropdown at the top of the list with "All Properties" + each property name
3. Filter the displayed reservations by `selectedProperty` before rendering

The dropdown will use the same styling as the cleaner filter in TimelineFilters (`h-8 rounded-md border border-input bg-background px-2 text-xs`).

