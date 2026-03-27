

## Update iCal Display Names: Shorter Labels

### Change from approved plan

In **`supabase/functions/fetch-ical/index.ts`**, the smart summary rewriting step:

- `"Airbnb Reservation"` → `"Airbnb"`
- `"Booking.com Reservation"` → `"Booking.com"`

With UID appended: e.g. `"Airbnb #A3F2B1C4"`, `"Booking.com #A3F2B1C4"`

Everything else from the approved plan remains identical (UID capture, Booking.com blocked detection, no frontend changes needed).

