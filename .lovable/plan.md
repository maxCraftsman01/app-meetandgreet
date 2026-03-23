
## Fix manual reservation edit/delete CORS failure

### What I found
The current `admin-reservations` function already allows the custom headers, but its preflight response is still incomplete for browser `PUT` and `DELETE` requests.

From the runtime evidence:
- `GET` requests succeed
- `PUT` and `DELETE` show `Failed to fetch`
- that pattern strongly indicates the browser is blocking the request during the CORS preflight, before the real mutation runs

### Root cause
`supabase/functions/admin-reservations/index.ts` is missing:
- `Access-Control-Allow-Methods`
- a more explicit OPTIONS response for non-GET methods

Two other functions already show the correct pattern (`admin-users`, `admin-timeline`), so I would align `admin-reservations` with that working setup.

### Plan
1. Update `supabase/functions/admin-reservations/index.ts`
   - add:
     - `Access-Control-Allow-Methods: "GET, POST, PUT, DELETE, OPTIONS"`
   - keep the existing allowed headers
   - return a proper OPTIONS response with the full CORS headers

2. Apply the same CORS-method fix to all mutation-capable edge functions so this does not happen elsewhere again:
   - `admin-properties`
   - `admin-users`
   - `cleaner-operations`
   - `fetch-ical` if it accepts writes
   - any other function supporting `POST`, `PUT`, or `DELETE`

3. Keep auth logic unchanged for this fix
   - the current manual reservation issue is not caused by the reservation payload itself
   - the browser is failing before the update/delete request reaches normal execution

4. Verify after implementation
   - edit a manual reservation
   - delete a manual reservation
   - confirm no more `Failed to fetch` / `Failed to delete` errors

### Technical detail
Recommended CORS shape for mutation functions:
```ts
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-pin, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

if (req.method === "OPTIONS") {
  return new Response("ok", { headers: corsHeaders });
}
```

### Files to update
- `supabase/functions/admin-reservations/index.ts`
- `supabase/functions/admin-properties/index.ts`
- `supabase/functions/cleaner-operations/index.ts`
- `supabase/functions/fetch-ical/index.ts`
- any other mutation-capable function still missing `Access-Control-Allow-Methods`
