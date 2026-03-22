
## Fix the user-permission save failure

### What I found
- This is **not** because the project is unpublished. The preview is already reaching the backend successfully: `GET admin-users` returns `200`.
- The failure happens specifically on **`PUT admin-users`** when saving updated property access.
- Right now the backend path that updates users is too fragile:
  - it does several writes without checking every error
  - it has almost no logging, so the browser only shows a generic **“Failed to fetch”**
  - its CORS handling is minimal, which can turn backend problems into browser-level fetch failures

### Most likely cause
The problem is in the **`admin-users` update flow**, not in the UI form itself.  
When you add another property to a cleaner, the backend likely fails during the permission rewrite step and the browser surfaces that as **“Failed to fetch”** instead of a useful message.

## Implementation plan

### 1) Harden the `admin-users` function
Update `supabase/functions/admin-users/index.ts` to make the save path reliable and diagnosable:
- add explicit CORS support for `GET, POST, PUT, DELETE, OPTIONS`
- add request logging for method, user id, and permission count
- wrap admin validation in `try/catch`
- validate required inputs before writing:
  - user id exists
  - PIN is valid
  - `property_access` is an array
  - every `property_id` exists in `properties`

### 2) Fix the PUT save logic
Refactor the update branch so it fails cleanly instead of silently:
- check errors from:
  - updating `app_users`
  - deleting old `user_property_access`
  - inserting new `user_property_access`
- return a clear JSON error message if any step fails
- keep the current “replace all permissions” behavior, but make each step explicit and checked

### 3) Improve frontend error reporting
Update the user-management save handler so the admin sees the real cause:
- if backend returns JSON error, show that exact message
- if it’s a true network/CORS failure, show a more specific message like:
  - “Couldn’t reach the user-permissions service”
- optionally log the request payload in dev mode for easier debugging

### 4) Re-test the exact failing scenario
After the fix:
1. log in as admin with `44332211`
2. open **Users**
3. edit Elena
4. add the second property under Cleaning
5. save
6. verify:
   - success toast appears
   - refreshed user card shows both properties
   - cleaner login sees both properties in the Cleaning area

## Files to update
- `supabase/functions/admin-users/index.ts`
- `src/lib/api.ts`
- `src/components/UserManagement.tsx`

## Expected result
Saving a cleaner with multiple assigned properties should work normally, and if anything still fails, the app will show a real backend error instead of the vague **“Failed to fetch”**.

## Technical notes
- I would not change the data model for this fix.
- I would not treat publish state as the issue.
- The React dialog warnings in the console are separate UI issues; they are worth cleaning up later, but they are not the main cause of this save failure.
