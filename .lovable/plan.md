

## Add Property Listing Links

### Database Change
Add a `listing_urls` column (text array) to the `properties` table via migration:
```sql
ALTER TABLE properties ADD COLUMN listing_urls text[] DEFAULT '{}'::text[];
```

### Admin: Property Form
**File: `src/components/admin/PropertyFormDialog.tsx`**
- Add `listing_urls: string` to `PropertyFormData` and `emptyForm`
- After the Cleaning Notes textarea, add a "Listing URLs" section: a textarea (one URL per line), same pattern as iCal URLs

### Admin: Property Save Logic
**File: `src/pages/Admin.tsx`**
- When building the payload for create/update, split `form.listing_urls` by newline and filter empty strings into an array, same as `ical_urls`
- When editing, populate form with `listing_urls.join("\n")`

### Types
**File: `src/types/index.ts`**
- Add `listing_urls?: string[]` to the `Property` interface

### Owner Dashboard: Links Section
**File: `src/components/PropertyFinanceView.tsx`**
- At the bottom of the component (after the monthly occupancy chart and booking dialog), render a "Listing Links" section if `property.listing_urls` has entries
- Each link shown as a row: truncated URL text (using `text-ellipsis overflow-hidden`) + a Copy button that copies the full URL to clipboard with a toast confirmation

### No edge function changes needed
The `admin-properties` function already does generic `insert(body)` / `update(body)`, so the new column flows through automatically.

